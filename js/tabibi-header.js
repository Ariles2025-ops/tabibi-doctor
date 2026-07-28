/* ============================================================
   js/tabibi-header.js — Header (app-bar) factorisé — Phase 0 shell
   ------------------------------------------------------------
   Remplace le <header class="app-bar"> dupliqué des pages app par un
   composant injecté, sur le même pattern que tabibi-langbar.js /
   tabibi-footer.js. Markup repris À L'IDENTIQUE des pages sources
   (index.html, login.html, patient-dashboard.html).

   Usage par page (à l'emplacement exact de l'ancien <header>) :
     <div data-tabibi-header data-variant="landing"></div>
     <script src="js/tabibi-header.js"></script>   <!-- juste après → injection synchrone -->

   Variantes (data-variant) :
     • landing : logo + lockup titre + langbar + #uarea-desk (index.html)
     • auth    : flèche retour (data-back, défaut index.html) + logo +
                 titre + sous-titre data-i18n="auth_header_sub" + langbar
                 (login / signup / forgot / reset / verify)
     • app     : lien accueil + tbi-lockup (#hdr-title dynamique) + cloche
                 notifs (#notif-count) + pill user (#user-pill/#user-init)
                 + logout + langbar (dashboards)

   Slots (variante app) — pour les dashboards dont le sous-titre ou les
   actions diffèrent du défaut patient, SANS perdre leurs hooks :
     <div data-tabibi-header data-variant="app">
       <span data-slot="sub">…contenu exact du .lk-sub…</span>
       <div data-slot="actions">…boutons/langbar exacts, déplacés tels quels…</div>
     </div>
   data-slot="sub" remplace le contenu du .lk-sub (défaut : #hdr-title
   data-i18n={data-title-key} + " · طبيبي"). data-slot="actions" remplace
   TOUT le côté droit (défaut : cloche + pill + logout + langbar) — une
   page qui fournit ce slot garde exactement ses ids/onclick, y compris
   l'absence volontaire d'un élément (ex. admin sans langbar).

   Garanties :
   - Injection SYNCHRONE si le placeholder précède le <script> (le header
     existe avant DOMContentLoaded → renderUserUI(), i18n, langbar OK).
   - Idempotent : no-op si un <header class="app-bar"> existe déjà.
   - Aucun hook JS modifié : ids (#uarea-desk, #hdr-title, #notif-count,
     #user-pill, #user-init) et onclick (toggleNotif/toggleMenu/logout)
     identiques à l'existant — résolus au clic, définis par chaque page.
   - Le slot <div data-langbar></div> est rendu pour tabibi-langbar.js.
   ============================================================ */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  /* Logo Tabibi (croix masquée + tracé ECG or). Couleurs via CSS vars avec
     fallback = valeurs hardcodées des pages sources (rendu identique). */
  function logo(size) {
    return '<svg class="logo-svg" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tabibi" style="flex-shrink:0">' +
      '<defs><mask id="tbCrossShell"><rect width="48" height="48" fill="#fff"/><path d="M21 10h6v11h11v6h-11v11h-6v-11h-11v-6h11z" fill="#000"/></mask></defs>' +
      '<rect x="2" y="2" width="44" height="44" rx="12" fill="var(--logo-bg,#0F7560)" mask="url(#tbCrossShell)"/>' +
      '<path d="M5 24h8l3-8 4 16 4-12 3 4h13" fill="none" stroke="var(--logo-accent,#D4A437)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* Étoile DZ (croissant + étoile rouges) accolée au lockup "Tabibi DZ". */
  function star(size, ml) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-1px' + (ml ? ';margin-left:5px' : '') + '">' +
      '<path d="M14.8 3.5a8.5 8.5 0 1 0 0 17 6.8 6.8 0 1 1 0-17z" fill="#D21010"/>' +
      '<path d="M18.4 8.2l1.05 2.13 2.35.34-1.7 1.66.4 2.34-2.1-1.1-2.1 1.1.4-2.34-1.7-1.66 2.35-.34z" fill="#D21010"/></svg>';
  }

  var DZ = '<span style="font-weight:800;letter-spacing:-.5px"><span style="color:#2E8B57">D</span><span style="color:#D21010">Z</span></span>';

  /* Titre "Tabibi DZ ★" — version app-bar (landing/auth). */
  var TITLE = 'Tabibi <span style="color:var(--green)">' + DZ + '</span>' + star(13, true);
  /* Version lockup dashboards (patient-dashboard). */
  var TITLE_LK = 'Tabibi <span style="font-weight:800"><span style="color:#2E8B57">D</span><span style="color:#D21010">Z</span></span>' + star(11, false);

  function buildLanding() {
    return logo(32) +
      '<div class="app-bar-body">' +
        '<div class="app-bar-title">' + TITLE + '</div>' +
        '<div class="app-bar-sub" style="font-family:\'Cairo\',sans-serif">طبيبي · Médecins Algérie</div>' +
      '</div>' +
      '<div data-langbar></div>' +
      '<div id="uarea-desk" style="display:flex;align-items:center;gap:6px"></div>';
  }

  function buildAuth(back) {
    return '<a href="' + back + '" class="app-bar-back" aria-label="Retour à l\'accueil"><i class="fa fa-arrow-left" aria-hidden="true"></i></a>' +
      logo(32) +
      '<div class="app-bar-body">' +
        '<div class="app-bar-title">' + TITLE + '</div>' +
        '<div class="app-bar-sub" style="font-family:\'Cairo\',sans-serif" data-i18n="auth_header_sub">طبيبي · Médecins Algérie</div>' +
      '</div>' +
      '<div data-langbar></div>';
  }

  function buildApp(home, titleKey, subHtml, actionsHtml) {
    return '<a href="' + home + '" title="Retour à l\'accueil" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:rgba(0,0,0,.04);color:var(--text2);text-decoration:none;flex-shrink:0;transition:.15s" onmouseover="this.style.background=\'var(--blue-l)\';this.style.color=\'var(--blue)\'" onmouseout="this.style.background=\'rgba(0,0,0,.04)\';this.style.color=\'var(--text2)\'"><i class="fa fa-house"></i></a>' +
      '<div class="tbi-lockup">' +
        logo(34) +
        '<div class="lk-col">' +
          '<div class="lk-title">' + TITLE_LK + '</div>' +
          '<div class="lk-sub">' + (subHtml != null ? subHtml
            : '<span id="hdr-title" data-i18n="' + titleKey + '">Mon espace</span> · طبيبي') + '</div>' +
        '</div>' +
      '</div>' +
      (actionsHtml != null ? actionsHtml : defaultAppActions());
  }

  /* Côté droit par défaut (= patient-dashboard). Remplacé intégralement
     par le slot data-slot="actions" quand la page en fournit un. */
  function defaultAppActions() {
    /* Cloche notifications — hooks page : toggleNotif(), #notif-count */
    return '<button class="btn btn-icon btn-icon-sm notif-bell" onclick="toggleNotif()" title="Notifications" style="background:rgba(0,0,0,.04);color:var(--text2);width:36px;height:36px;position:relative">' +
        '<i class="fa fa-bell" style="font-size:14px"></i>' +
        '<span class="notif-badge" id="notif-count" style="position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;background:var(--red);color:#fff;font-size:10px;font-weight:800;border-radius:9px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;animation:bell-ring 2s ease-in-out infinite">0</span>' +
      '</button>' +
      /* Pill user — hooks page : toggleMenu(), #user-init */
      '<button onclick="toggleMenu()" aria-label="Mon compte" title="Mon compte" id="user-pill" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0F7560,#0a4d3e);color:#fff;font-weight:800;font-size:13px;border:none;cursor:pointer;flex-shrink:0;box-shadow:0 2px 6px rgba(15,117,96,.4);display:flex;align-items:center;justify-content:center"><span id="user-init"><i class="fa fa-user" style="font-size:14px"></i></span></button>' +
      /* Logout — hook page : logout() */
      '<button onclick="logout()" aria-label="Se déconnecter" title="Se déconnecter" style="width:36px;height:36px;border-radius:10px;background:#fff0f0;color:#dc2626;border:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;transition:.15s;margin-left:4px" onmouseover="this.style.background=\'#dc2626\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'#fff0f0\';this.style.color=\'#dc2626\'"><i class="fa fa-right-from-bracket"></i></button>' +
      '<div data-langbar></div>';
  }

  function render(ph) {
    var variant = ph.getAttribute('data-variant') || 'landing';
    var header = document.createElement('header');
    header.className = 'app-bar';
    header.setAttribute('role', 'banner');
    if (variant === 'auth') {
      header.innerHTML = buildAuth(ph.getAttribute('data-back') || 'index.html');
    } else if (variant === 'app') {
      // Slots optionnels : contenus page-spécifiques déjà parsés dans le placeholder
      var subSlot = ph.querySelector('[data-slot="sub"]');
      var actionsSlot = ph.querySelector('[data-slot="actions"]');
      header.innerHTML = buildApp(ph.getAttribute('data-home') || 'index.html',
                                  ph.getAttribute('data-title-key') || 'my_space',
                                  subSlot ? subSlot.innerHTML : null,
                                  actionsSlot ? actionsSlot.innerHTML : null);
    } else {
      header.innerHTML = buildLanding();
    }
    ph.parentNode.replaceChild(header, ph);
  }

  function init() {
    // Idempotent : header déjà présent (page non migrée ou double include) → no-op
    if (document.querySelector('header.app-bar')) return;
    var ph = document.querySelector('[data-tabibi-header]');
    if (ph) render(ph);
  }

  // Synchrone si le placeholder précède le <script> (cas nominal), sinon filet DOM ready
  init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
