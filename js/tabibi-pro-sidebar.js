/* ============================================================
   js/tabibi-pro-sidebar.js — Sidebar poste de travail partagée
   ------------------------------------------------------------
   Reprend le pattern sidebar d'agenda-cabinet.html (lot 3) pour les
   autres pages pro : visible UNIQUEMENT ≥1024px, aucun impact mobile.
   No-op si la page possède déjà une sidebar statique (.ag-sidebar).

   Usage : <script src="js/tabibi-pro-sidebar.js"></script> en fin de
   page. La sidebar pousse le contenu via html.tbi-has-sidebar ; chaque
   page garde la main sur SON layout large (media query locale).

   Actif web + desktop (les pages pro restent utilisables en
   navigateur) ; lien actif détecté via location.pathname ; libellés
   fr/ar/en re-rendus au changement de langue.
   ============================================================ */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var I18N = {
    fr: { agenda: 'Agenda', dash: 'Tableau de bord', stats: 'Statistiques', rx: 'Ordonnances',
          msg: 'Messages', notif: 'Notifications', profile: 'Mon profil', logout: 'Déconnexion' },
    ar: { agenda: 'الأجندة', dash: 'لوحة القيادة', stats: 'الإحصائيات', rx: 'الوصفات',
          msg: 'الرسائل', notif: 'الإشعارات', profile: 'ملفي', logout: 'تسجيل الخروج' },
    en: { agenda: 'Agenda', dash: 'Dashboard', stats: 'Statistics', rx: 'Prescriptions',
          msg: 'Messages', notif: 'Notifications', profile: 'My profile', logout: 'Sign out' }
  };
  var LINKS = [
    { key: 'agenda',  href: 'agenda-cabinet.html',   icon: 'fa-calendar-week' },
    { key: 'dash',    href: 'doctor-dashboard.html', icon: 'fa-gauge-high' },
    { key: 'stats',   href: 'doctor-analytics.html', icon: 'fa-chart-line' },
    { key: 'rx',      href: 'medecin-ordonnance.html', icon: 'fa-file-prescription' },
    { key: 'msg',     href: 'messages.html',         icon: 'fa-comments' },
    { key: 'notif',   href: 'notifications.html',    icon: 'fa-bell' },
    { key: 'profile', href: 'medecin-profile.html',  icon: 'fa-user-doctor' }
  ];

  function lang() {
    try { var s = localStorage.getItem('tabibi_lang'); if (s === 'fr' || s === 'ar' || s === 'en') return s; } catch (e) {}
    return (document.documentElement.lang || 'fr').slice(0, 2);
  }

  var CSS =
    '.tbi-pro-sidebar{display:none}' +
    '@media (min-width:1024px){' +
    'html.tbi-has-sidebar #tabibi-beta-banner{display:none !important}' +
    'html.tbi-has-sidebar header.app-bar{padding:0 20px !important;gap:10px !important}' +
    'html.tbi-has-sidebar header.app-bar > a:first-child,html.tbi-has-sidebar header.app-bar > button:first-child,html.tbi-has-sidebar header.app-bar .notif-bell,'+
    'html.tbi-has-sidebar header.app-bar #user-pill,html.tbi-has-sidebar header.app-bar button[aria-label="Se déconnecter"]'+
    '{width:40px !important;height:40px !important;border-radius:10px !important;margin:0 !important}' +
    'html.tbi-has-sidebar header.app-bar [data-langbar]{display:flex;align-items:center;height:40px;margin:0 !important}' +
      'html.tbi-has-sidebar .tbi-pro-sidebar{display:flex;flex-direction:column;gap:4px;position:fixed;' +
        'top:0;inset-inline-start:0;bottom:0;width:224px;z-index:150;background:#fff;' +
        'border-inline-end:1px solid var(--border,#e2e8f0);padding:16px 12px;overflow-y:auto}' +
      /* width:auto = occupe l'espace restant (certaines pages posent body{width:100%}
         → débordement de 224px sinon). margin-inline-* : miroir RTL automatique. */
      'html.tbi-has-sidebar body{margin-inline-start:224px;width:auto !important;max-width:none !important}' +
      '.tbi-pro-sidebar .sb-brand{display:flex;align-items:center;gap:8px;padding:6px 10px 16px;font-weight:800;font-size:14px;color:var(--text,#0f172a)}' +
    '}' +
    '.tbi-pro-sidebar .nav{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;' +
      'font-size:13.5px;font-weight:700;color:var(--text2,#475569);text-decoration:none;border:none;background:none;' +
      'cursor:pointer;font-family:inherit;width:100%;text-align:start;border-inline-start:3px solid transparent;' +
      'transition:background .15s,color .15s,transform .15s}' +
    '.tbi-pro-sidebar .nav i{width:20px;text-align:center;font-size:15px}' +
    '.tbi-pro-sidebar .nav:hover{background:var(--bg2,#f1f5f9);color:var(--text,#0f172a);transform:translateX(2px)}' +
    '[dir="rtl"] .tbi-pro-sidebar .nav:hover{transform:translateX(-2px)}' +
    '.tbi-pro-sidebar .nav.active{background:var(--brand-green-50,#f0fdf4);color:var(--brand-green-700,#0E5F46);border-inline-start-color:var(--gold,#d4a437)}' +
    '.tbi-pro-sidebar .sb-spacer{flex:1}' +
    '.tbi-pro-sidebar .nav.danger{color:#D21010}' +
    '.tbi-pro-sidebar .nav.danger:hover{background:#fff0f0;color:#D21010}' +
    '@media (prefers-reduced-motion:reduce){.tbi-pro-sidebar .nav{transition:none}}';

  function currentPage() { return (location.pathname.split('/').pop() || '').toLowerCase(); }

  function doLogout() {
    if (typeof window.logout === 'function') { window.logout(); return; }
    var sb = window.tabibi && window.tabibi.supabase;
    (sb ? sb.auth.signOut() : Promise.resolve()).then(
      function () { location.href = 'login.html'; },
      function () { location.href = 'login.html'; }
    );
  }

  function render(nav) {
    var L = I18N[lang()] || I18N.fr, cur = currentPage();
    nav.innerHTML = LINKS.map(function (l) {
      var on = cur === l.href.toLowerCase();
      return '<a class="nav' + (on ? ' active' : '') + '" href="' + l.href + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<i class="fa ' + l.icon + '"></i> <span>' + L[l.key] + '</span></a>';
    }).join('') +
    '<div class="sb-spacer"></div>' +
    '<button type="button" class="nav danger" data-sb-logout><i class="fa fa-right-from-bracket"></i> <span>' + L.logout + '</span></button>';
    nav.querySelector('[data-sb-logout]').addEventListener('click', doLogout);
  }

  function init() {
    if (document.querySelector('.ag-sidebar') || document.querySelector('.tbi-pro-sidebar')) return; // agenda ou double include
    var st = document.createElement('style'); st.textContent = CSS;
    document.head.appendChild(st);
    var nav = document.createElement('nav');
    nav.className = 'tbi-pro-sidebar';
    nav.setAttribute('aria-label', 'Navigation espace pro');
    render(nav);
    document.body.appendChild(nav);
    document.documentElement.classList.add('tbi-has-sidebar');
    document.addEventListener('tabibi:lang-change', function () { setTimeout(function () { render(nav); }, 100); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
