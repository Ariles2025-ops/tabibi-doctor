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
       carte → accueil-public.html#carte · rdv → mes-rdv.html ·
       profile → login.html · ancres de l'accueil → navigation
       vers accueil-public.html (JAMAIS index.html : porte fermee).
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
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-nav.js:42'); }
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
    // =================================================================
    // [17/09/2026] `index.html` N'EST PAS L'ACCUEIL — C'EST LA PORTE FERMEE
    // =================================================================
    // Depuis l'inversion du 13/09 (cf. `scripts/verifier-porte.mjs`),
    // `index.html` a la racine EST la page « Bientot disponible », et
    // l'application vit dans `accueil-public.html`. Ces items n'avaient pas
    // suivi : depuis mes-rdv, reservation ou dawini, Accueil / Specialites /
    // Carte / loupe renvoyaient l'utilisateur DEHORS — sur la porte close,
    // alors qu'il etait deja a l'interieur.
    //
    // ⚠️ Et ils ne visaient pas seulement la mauvaise page : `#sec-spec` et
    // `#name-search` n'existent QUE sur `accueil-public.html`. La cible
    // portait donc une ancre qui ne pouvait pas etre trouvee sur la page
    // visee — deux fautes qui se cachaient l'une l'autre.
    //
    // ⚠️ APRES L'OUVERTURE, `porte.mjs ouverte` copie `accueil-public.html`
    // PAR-DESSUS `index.html` : les deux URL servent alors la meme page, et
    // `accueil-public.html` porte deja `<link rel="canonical" href="…/">`.
    // Ces liens restent donc justes dans les deux etats de la porte — ce que
    // `index.html` ne fait pas.
    { id: 'home',    icon: 'fa-home',             i18n: 'nav_home',    href: 'accueil-public.html' },
    // ⚠️ [17/09/2026] CETTE ANCRE POINTAIT SUR `#sec-search` — le bloc FILTRES.
    // Sur l'accueil, cet element EXISTE : `tabClick` le trouvait et y faisait
    // defiler la page. Un utilisateur qui touche la loupe pour CHERCHER se
    // retrouvait devant deux menus deroulants et un curseur de prix, la barre
    // de saisie restee trois ecrans plus haut.
    //
    // La loupe vise desormais la barre elle-meme — et ne se contente pas d'y
    // faire defiler : elle y met le FOCUS. Toucher une loupe, c'est vouloir
    // taper.
    { id: 'search',  icon: 'fa-search',           i18n: 'nav_docs',    href: 'accueil-public.html#name-search' },
    { id: 'carte',   icon: 'fa-map-location-dot', i18n: 'nav_map',     href: '#carte' },
    // ⚠️ [18/09/2026] CES DEUX ENTREES DECLARAIENT `href: '#'`.
    // Elles n'etaient pas mortes — `tabClick` a une branche dediee — mais le
    // `'#'` ne disait RIEN a qui lit le fichier, et il ne dit rien non plus au
    // remappage du bundle desktop (`safeHref`), qui travaille sur des chemins.
    // Une cible declaree est une cible qu'on peut verifier.
    { id: 'rdv',     icon: 'fa-calendar-check',   i18n: 'nav_rdv',     href: 'mes-rdv.html' },
    { id: 'spec',    icon: 'fa-stethoscope',      i18n: 'nav_spec',    href: 'accueil-public.html#sec-spec' },
    // `login.html` est le defaut DECLARE : c'est la destination d'un visiteur.
    // Un utilisateur connecte est aiguille vers SON espace a l'execution, par
    // `_espaceDeLUtilisateur()` — un href statique ne peut pas connaitre le role.
    { id: 'profile', icon: 'fa-user',             i18n: 'nav_profile', href: 'login.html' }
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

  /**
   * Ou mene « Profil » — et pourquoi ce n'etait pas `login.html`.
   *
   * ⚠️ LE DEFAUT : le repli envoyait vers `login.html` SANS REGARDER LA
   * SESSION. Sur l'accueil, `window.isLogged` / `window.goDash` existent (ils
   * viennent de `js/home-app.js`) et le bon ecran s'ouvrait. **Partout
   * ailleurs** — mes-rdv, reservation, dawini, notifications — ces hooks
   * n'existent pas : un patient DEJA CONNECTE qui touchait « Profil »
   * atterrissait sur l'ecran de connexion.
   *
   * ⚠️ LA TABLE DES ESPACES EXISTE DEJA : `TABIBI_CONFIG.REDIRECTS`, celle
   * qu'utilise `auth.js` apres une connexion. On la lit au lieu d'ecrire une
   * seconde liste role -> page, qui divergerait au premier role ajoute.
   *
   * ⚠️ ET LA SESSION SE LIT COMME AILLEURS : `tabibi_user` dans
   * `localStorage` — meme source que `loadUser()` (home-app) et
   * `_peutRevendiquer()` (doctor-profile). La vraie session est verifiee par
   * la page d'arrivee ; ici on choisit une DESTINATION, pas un droit.
   */
  function _espaceDeLUtilisateur() {
    var red = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.REDIRECTS) || {};
    var connexion = red.notLoggedIn || 'login.html';
    var u = null;
    // `catch` sans liaison : le cliquet de dette compte les `e` inutilises,
    // et il a raison — il en a attrape un ici, ajoute par ce lot meme.
    try { u = JSON.parse(localStorage.getItem('tabibi_user') || 'null'); } catch { u = null; }
    if (!u || !u.id) return connexion;
    var role = String(u.role || '').toLowerCase();
    if (role === 'médecin') role = 'medecin';
    return red[role] || connexion;
  }

  function tabClick(id, href) {
    // La loupe : le curseur dans la barre, pas un defilement vers les filtres.
    //
    // ⚠️ On NE passe PAS par le traitement d'ancre generique plus bas : il fait
    // `scrollIntoView` et s'arrete la. Ce qui manque a un champ de recherche
    // qu'on vient de demander, c'est le curseur dedans — sur telephone, c'est
    // meme la difference entre « le clavier s'ouvre » et « il ne se passe rien ».
    //
    // `preventScroll` puis `scrollIntoView` : le focus seul ferait sauter la
    // page d'un coup, sans transition, et parfois au mauvais endroit quand un
    // en-tete colle. On separe les deux gestes pour garder le defilement doux.
    if (id === 'search') {
      var champ = document.getElementById('name-search');
      if (champ) {
        // `catch` sans liaison : l ancienne forme laissait un `e` inutilise, et
        // le cliquet de dette le comptait — a juste titre.
        try { champ.focus({ preventScroll: true }); } catch { champ.focus(); }
        champ.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // Sous-page sans barre de recherche : on va la ou elle existe.
      // ⚠️ C'est CE repli qui envoyait sur la porte fermee : le cas special
      // au-dessus ne joue que sur l'accueil, donc la garde de la loupe, qui
      // s'ouvrait sur l'accueil, ne l'a jamais traverse. Une garde ne couvre
      // que le chemin qu'elle emprunte.
      go(href || 'accueil-public.html#name-search');
      return;
    }
    if (id === 'carte') {
      if (typeof window.openMapOverlay === 'function') { window.openMapOverlay(); return; }
      // ⚠️ IL N'EXISTE AUCUN `id="carte"` DANS LE DEPOT — verifie, pas suppose.
      // La carte est une surcouche (`#map-overlay`, `hidden`) qu'on OUVRE ;
      // il n'y a pas d'ancre vers laquelle defiler. `#carte` est donc une
      // consigne, pas une ancre — et `js/home-app.js` la lit a l'arrivee.
      // Sans cette moitie-la, on remplacait une porte fermee par un
      // cul-de-sac : l'accueil s'afficherait, et pas la carte.
      go('accueil-public.html#carte'); return;
    }
    if (id === 'rdv' || id === 'profile') {
      if (typeof window.isLogged === 'function') {           // index : hooks inline présents
        if (!window.isLogged()) {
          if (typeof window.openModal === 'function') { window.openModal('login'); return; }
          go('login.html'); return;
        }
        if (typeof window.goDash === 'function') { window.goDash(); return; }
      }
      // `rdv` a une seule destination ; `profile` depend de qui regarde.
      go((id === 'rdv') ? (href || 'mes-rdv.html') : _espaceDeLUtilisateur());
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
