/* ============================================================
   js/tabibi-nav.js — Tab-bar bas de page factorisée — Phase 0 shell
   ------------------------------------------------------------
   Extrait initTabBar()/tabClick() d'index.html (inline → composant),
   sur le même pattern que tabibi-footer.js / tabibi-langbar.js.
   Corrige au passage la tab-bar VIDE des sous-pages (mes-rdv.html,
   reservation.html appelaient initTabBar() qui n'existait que sur index).

   Usage par page :
     <nav class="tab-bar" id="tab-bar" data-active="home"></nav>
     <script src="js/tabibi-nav.js"></script>
   Puis (optionnel, comme avant) : initTabBar("rdv") — ré-appelable au
   changement de langue, conserve l'onglet actif via [aria-current].

   Garanties :
   - Comportement index INCHANGÉ : mêmes 6 onglets, mêmes hooks
     (openMapOverlay, openModal, isLogged, goDash, T) résolus au clic.
   - Fallbacks hors index (pages sans ces hooks inline) :
       carte → index.html#carte · rdv → mes-rdv.html ·
       profile → login.html · ancres d'index → navigation vers index.
   - i18n : window.T (index) puis window.tabibiT (tabibi-i18n.js), sinon
     dico fr/ar/en embarqué (copie exacte du TR d'index — les clés nav_*
     n'existent PAS dans tabibi-i18n.js à ce jour).
   - A11y : pose data-tab + aria-current="page" sur l'onglet actif
     (répare la perte d'onglet actif au changement de langue).
   ============================================================ */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // Copie exacte des clés nav_* du dico TR inline d'index.html
  var FALLBACK = {
    fr: { nav_home: 'Accueil', nav_spec: 'Spécialités', nav_docs: 'Médecins', nav_rdv: 'Mes RDV', nav_profile: 'Profil', nav_map: 'Carte' },
    ar: { nav_home: 'الرئيسية', nav_spec: 'التخصصات', nav_docs: 'الأطباء', nav_rdv: 'مواعيدي', nav_profile: 'حسابي', nav_map: 'الخريطة' },
    en: { nav_home: 'Home', nav_spec: 'Specialties', nav_docs: 'Doctors', nav_rdv: 'My Appts', nav_profile: 'Profile', nav_map: 'Map' }
  };

  function lang() {
    try {
      var s = localStorage.getItem('tabibi_lang');
      if (s === 'fr' || s === 'ar' || s === 'en') return s;
    } catch (e) {}
    return (document.documentElement.lang || 'fr').slice(0, 2);
  }

  function t(key) {
    var v;
    if (typeof window.T === 'function') { v = window.T(key); if (v && v !== key) return v; }
    if (typeof window.tabibiT === 'function') { v = window.tabibiT(key); if (v && v !== key) return v; }
    var L = FALLBACK[lang()] || FALLBACK.fr;
    return L[key] || key;
  }

  var ITEMS = [
    { id: 'home',    icon: 'fa-home',             i18n: 'nav_home',    href: 'index.html' },
    { id: 'search',  icon: 'fa-search',           i18n: 'nav_docs',    href: 'index.html#sec-search' },
    { id: 'carte',   icon: 'fa-map-location-dot', i18n: 'nav_map',     href: '#carte' },
    { id: 'rdv',     icon: 'fa-calendar-check',   i18n: 'nav_rdv',     href: '#' },
    { id: 'spec',    icon: 'fa-stethoscope',      i18n: 'nav_spec',    href: 'index.html#sec-spec' },
    { id: 'profile', icon: 'fa-user',             i18n: 'nav_profile', href: '#' }
  ];

  function initTabBar(active) {
    var bar = document.getElementById('tab-bar');
    if (!bar) return;
    bar.innerHTML = ITEMS.map(function (it) {
      var on = active === it.id;
      return '<button class="tab-item' + (on ? ' active' : '') + '" data-tab="' + it.id + '"' +
        (on ? ' aria-current="page"' : '') +
        ' onclick="tabClick(\'' + it.id + '\',\'' + it.href + '\')" aria-label="' + t(it.i18n) + '">' +
        '<i class="fa ' + it.icon + '"></i>' +
        '<span>' + t(it.i18n) + '</span></button>';
    }).join('');
  }

  /* Navigation sûre : en desktop (Tauri), tabibi-desktop-nav remappe les
     cibles hors bundle (index → agenda) ou neutralise. Web/mobile : direct. */
  function go(href) {
    if (window.tabibiDesktopNav) {
      var s = window.tabibiDesktopNav.safeHref(href);
      if (s === null) return;
      href = s;
    }
    window.location.href = href;
  }

  function tabClick(id, href) {
    if (id === 'carte') {
      if (typeof window.openMapOverlay === 'function') { window.openMapOverlay(); return; }
      go('index.html#carte'); return;
    }
    if (id === 'rdv' || id === 'profile') {
      if (typeof window.isLogged === 'function') {           // index : hooks inline présents
        if (!window.isLogged()) {
          if (typeof window.openModal === 'function') { window.openModal('login'); return; }
          go('login.html'); return;
        }
        if (typeof window.goDash === 'function') { window.goDash(); return; }
      }
      go((id === 'rdv') ? 'mes-rdv.html' : 'login.html');
      return;
    }
    if (href && href.indexOf('#') > -1) {
      var anchor = href.split('#')[1];
      var el = document.getElementById(anchor);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      // Ancre absente de la page courante (sous-page) : naviguer vers la cible
      if (href.charAt(0) !== '#') { go(href); return; }
      return;
    }
    if (href && href !== '#') go(href);
  }

  window.tabibiNav = { init: initTabBar };
  window.initTabBar = initTabBar;
  window.tabClick = tabClick;

  // Auto-init si la page déclare son onglet actif : <nav id="tab-bar" data-active="rdv">
  function autoInit() {
    var bar = document.getElementById('tab-bar');
    if (bar && bar.hasAttribute('data-active') && !bar.firstChild) {
      initTabBar(bar.getAttribute('data-active'));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
