/* ============================================================
   js/tabibi-desktop-nav.js — Navigation sûre en mode desktop
   ------------------------------------------------------------
   Actif UNIQUEMENT quand TABIBI_PLATFORM === 'desktop' (Tauri).
   No-op complet sur web et mobile.

   Problème réglé : le bundle desktop est une LISTE BLANCHE de pages
   pro — tout lien/redirection vers une page absente (index.html,
   pages patient, signup…) provoquait « asset not found ».

   4 couches :
   1. REDIRECTS patchés (config + auth.js) : médecin → agenda,
      secrétaire → son dashboard, logout → login. Patient/admin/
      pharmacie → message « espace web » + retour login.
   2. redirectFor() de login.html wrappé (même règles).
   3. Intercepteur de clics (capture) : lien hors bundle → remappé
      (index → agenda) ou neutralisé.
   4. Balayage DOM : les liens morts (signup, claim…) sont masqués.

   ⚠ SYNC : la liste PAGES ci-dessous doit refléter desktop/build-dist.sh.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.TABIBI_PLATFORM !== 'desktop') return;

  /* Pages présentes dans le bundle (= PAGES de desktop/build-dist.sh) */
  var PAGES = {};
  ['login.html', 'forgot-password.html', 'reset-password.html',
   'agenda-cabinet.html', 'doctor-dashboard.html', 'secretaire-dashboard.html',
   'medecin-ordonnance.html', 'medecin-profile.html', 'doctor-profile.html',
   'doctor-analytics.html', 'medecin-waitinglist.html', 'doctor-reservation.html',
   'messages.html', 'conversation.html', 'notifications.html',
   'offline.html', '404.html'].forEach(function (p) { PAGES[p] = true; });

  /* Hors bundle mais avec équivalent pro raisonnable */
  var REMAP = {
    'index.html': 'agenda-cabinet.html',        // logo / « Accueil »
    'mes-rdv.html': 'agenda-cabinet.html',      // tab-bar « Mes RDV »
    'patient-dashboard.html': 'login.html',
    'admin-dashboard.html': 'login.html'
  };

  var ENTRY = 'agenda-cabinet.html';            // page pro d'entrée (rôle-agnostique)

  function msgWebOnly() {
    var l = (function () { try { return localStorage.getItem('tabibi_lang') || 'fr'; } catch (e) { return 'fr'; } })();
    return l === 'ar' ? 'هذه المساحة متاحة عبر الويب فقط: tabibi.doctor'
         : l === 'en' ? 'This space is available on the web only: tabibi.doctor'
         : 'Cet espace est disponible sur le web uniquement : tabibi.doctor';
  }

  /* Retourne : href inchangé si sûr · href remappé · null si à bloquer */
  function safeHref(href) {
    if (href == null) return href;
    var h = String(href).trim();
    // Ancres, protocoles externes, JS : on ne touche pas (peu de liens
    // externes sur les pages pro ; à traiter via plugin opener plus tard)
    if (h === '' || h.charAt(0) === '#') return href;
    if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(h)) return href;
    var page = h.split('#')[0].split('?')[0].split('/').pop();
    if (!/\.html$/i.test(page)) return href;    // ressources non-page
    if (PAGES[page]) return href;
    if (REMAP[page]) return REMAP[page];
    return null;
  }

  /* 1 ─ REDIRECTS de config.js (utilisés par auth.js : redirectByRole,
         requireAuth mauvais-rôle, logout) */
  function patchRedirects() {
    var cfg = window.TABIBI_CONFIG;
    if (!cfg || !cfg.REDIRECTS) return;
    cfg.REDIRECTS.doctor = ENTRY;
    cfg.REDIRECTS.medecin = ENTRY;
    cfg.REDIRECTS.secretaire = 'secretaire-dashboard.html';
    cfg.REDIRECTS.patient = 'login.html';
    cfg.REDIRECTS.admin = 'login.html';
    cfg.REDIRECTS.pharmacie = 'login.html';
    cfg.REDIRECTS.afterLogout = 'login.html';
  }

  /* 2 ─ redirectFor() inline de login.html (déclaré plus tard que nous
         → wrap au DOMContentLoaded ; l'identifiant global résout notre
         version au moment de l'appel) */
  function wrapRedirectFor() {
    if (typeof window.redirectFor !== 'function' || window.redirectFor.__tbiDesktop) return;
    var orig = window.redirectFor;
    var wrapped = function (role) {
      var r = String(role || '').toLowerCase();
      if (r === 'medecin' || r === 'doctor' || r === 'médecin') return ENTRY;
      if (r === 'secretaire') return 'secretaire-dashboard.html';
      var t = safeHref(orig(role));
      if (t) return t;
      alert(msgWebOnly());
      return 'login.html';
    };
    wrapped.__tbiDesktop = true;
    window.redirectFor = wrapped;
  }

  /* 3 ─ Clics sur liens (phase capture : passe avant les handlers pages) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href');
    var s = safeHref(raw);
    if (s === raw) return;                      // sûr → laisser faire
    e.preventDefault(); e.stopPropagation();
    if (s) window.location.href = s;            // remappé
    // null → lien mort : no-op (déjà masqué par le balayage en principe)
  }, true);

  /* 4 ─ Balayage : masquer les liens sans équivalent desktop */
  function sweep() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (safeHref(a.getAttribute('href')) === null) a.classList.add('tbi-desktop-hidden');
    });
  }
  function injectStyle() {
    if (document.getElementById('tbi-desktop-style')) return;
    var st = document.createElement('style');
    st.id = 'tbi-desktop-style';
    st.textContent = '.tbi-desktop-hidden{display:none !important}';
    (document.head || document.documentElement).appendChild(st);
  }

  function boot() {
    injectStyle();
    patchRedirects();
    wrapRedirectFor();
    sweep();
    // Filets : contenus injectés après coup (i18n, composants, data)
    setTimeout(sweep, 800);
    setTimeout(function () { patchRedirects(); sweep(); }, 2000);
    document.addEventListener('tabibi:lang-change', function () { setTimeout(sweep, 100); });
  }

  window.tabibiDesktopNav = { safeHref: safeHref, pages: PAGES };

  patchRedirects();                              // config.js peut déjà être là
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
