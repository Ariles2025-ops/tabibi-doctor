/* ============================================================
   js/tabibi-langbar.js — Barre de langue FR/AR/EN factorisée
   ------------------------------------------------------------
   Remplace le markup dupliqué (sélecteur inline + IIFE syncLangBtns)
   d'index / login / signup + pages pilotes.

   Usage par page :
     <div data-langbar></div>                     <!-- emplacement voulu dans le header -->
     <script src="js/tabibi-langbar.js"></script> <!-- après tabibi-lang.js / tabibi-i18n.js -->

   Ce que fait le composant (reprend À L'IDENTIQUE l'existant) :
   - Injecte le sélecteur À LA PLACE du <div data-langbar> (markup identique :
     pill var(--bg2) arrondie, boutons FR/AR/EN, actif = var(--blue)/#fff,
     inactif = transparent/var(--text3)).
   - Au clic, route vers le mécanisme de la page :
       • window.tabibiLang.set(l)  → login, signup, pilotes (engine tabibi-lang.js)
       • sinon window.setLang(l)    → index (setLang gère i18n + boutons + RTL)
     Les deux persistent 'tabibi_lang' et appliquent l'i18n : rien ne change.
   - Synchronise le bouton actif : au load, sur 'tabibi:lang-change', + filet setTimeout.
   - Masque le switcher flottant #tabibi-lang-switcher → un seul sélecteur (le header).

   Ne touche à AUCUN hook JS. Ne charge PAS l'engine (tabibi-lang.js /
   tabibi-i18n.js restent liés par chaque page).
   ============================================================ */
(function () {
  'use strict';

  var LANGS  = ['fr', 'ar', 'en'];
  var LABELS = { fr: 'FR', ar: 'AR', en: 'EN' };

  // Style des boutons — identique à index/login/signup (transition = comportement
  // d'index ; sur login/signup c'est un simple fondu 120ms, aucun impact fonctionnel).
  var BTN_BASE = 'padding:3px 7px;border-radius:var(--rfull);border:none;font-size:10px;'
               + 'font-weight:700;cursor:pointer;transition:all .12s;';

  // Langue courante — même source que l'existant (clé 'tabibi_lang').
  function currentLang() {
    try {
      if (window.tabibiLang && typeof window.tabibiLang.get === 'function') {
        return window.tabibiLang.get() || 'fr';
      }
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-langbar.js:42'); }
    try {
      var s = localStorage.getItem('tabibi_lang');
      if (s) return s;
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-langbar.js:46'); }
    return document.documentElement.lang || 'fr';
  }

  // Route le changement de langue vers le mécanisme de la page (aucun hook modifié).
  function switchLang(l) {
    if (window.tabibiLang && typeof window.tabibiLang.set === 'function') {
      window.tabibiLang.set(l); return;            // login / signup / pilotes
    }
    if (typeof window.setLang === 'function') {
      window.setLang(l); return;                   // index
    }
    // Filet ultime (aucun engine) : persister + poser dir/lang au minimum.
    try { localStorage.setItem('tabibi_lang', l); } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-langbar.js:59'); }
    document.documentElement.lang = l;
    document.documentElement.dir  = (l === 'ar') ? 'rtl' : 'ltr';
  }

  function buildPill() {
    var pill = document.createElement('div');
    pill.setAttribute('role', 'group');
    pill.setAttribute('aria-label', 'Langue');
    pill.setAttribute('data-langbar-ready', '');
    pill.style.cssText = 'display:flex;gap:2px;background:var(--bg2);border-radius:var(--rfull);'
                       + 'padding:2px;flex-shrink:0';
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-lang-btn', l);
      b.textContent = LABELS[l];
      b.style.cssText = BTN_BASE + 'background:transparent;color:var(--text3)';
      b.addEventListener('click', function () { switchLang(l); });
      pill.appendChild(b);
    });
    return pill;
  }

  // Recolore le bouton actif.
  //
  // ⚠️ [15/09/2026] ELLE NE MASQUE PLUS LE SWITCHER FLOTTANT. Elle le faisait,
  // sans condition — donc AUSSI quand aucun pill n'avait pu etre injecte. Sur
  // l'accueil construit, ou le pill ne venait jamais (voir plus bas), le
  // resultat etait : **aucun selecteur de langue, nulle part**.
  //
  // Le flottant est le FILET. On ne retire un filet qu'apres avoir constate
  // que l'autre chemin fonctionne — c'est `masquerFlottant()`, appelee
  // uniquement quand un pill existe pour de bon.
  function syncLangBtns() {
    var l = currentLang();
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      var active = b.getAttribute('data-lang-btn') === l;
      b.style.background = active ? 'var(--blue)' : 'transparent';
      b.style.color      = active ? '#fff' : 'var(--text3)';
    });
  }

  function masquerFlottant() {
    var sw = document.getElementById('tabibi-lang-switcher');
    if (sw) sw.style.display = 'none';
  }

  /**
   * Remplace chaque `[data-langbar]` par un pill. Rend le nombre de pills
   * POSES — l'appelant doit savoir si le travail a eu lieu.
   *
   * Idempotente : un emplacement deja remplace n'existe plus, et un pill
   * porte `data-langbar-ready`. Deux initialisations ne font donc pas deux
   * selecteurs — c'est ce qui permet de garder l'auto-init pour les pages non
   * construites ET un appel explicite pour les pages construites.
   */
  function inject() {
    var poses = 0;
    document.querySelectorAll('[data-langbar]').forEach(function (slot) {
      if (slot.hasAttribute('data-langbar-ready')) return;
      slot.replaceWith(buildPill());   // le pill prend EXACTEMENT la place du placeholder
      poses++;
    });
    syncLangBtns();
    if (document.querySelector('[data-langbar-ready]')) masquerFlottant();
    return poses;
  }

  /**
   * ⚠️ LE PLACEHOLDER N'EST PAS TOUJOURS LA QUAND ON PASSE.
   *
   * Sur l'accueil, `[data-langbar]` est pose par `tabibi-header.js` A
   * L'EXECUTION. Selon l'ordre de chargement, `inject()` peut arriver avant
   * lui, ne rien trouver, et ne jamais repasser : le selecteur n'apparait
   * jamais, et rien ne le signale.
   *
   * On observe donc le document jusqu'a ce qu'un emplacement apparaisse, avec
   * une borne : **une attente sans fin est une fuite, pas un filet**.
   */
  function guetter() {
    if (typeof MutationObserver !== 'function') return;
    var fini = false;
    var obs = new MutationObserver(function () {
      if (fini) return;
      if (inject() > 0) { fini = true; obs.disconnect(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Borne : au-dela, le placeholder ne viendra plus. Le switcher flottant,
    // lui, n'a pas ete masque — la langue reste changeable.
    setTimeout(function () { if (!fini) { fini = true; obs.disconnect(); } }, 8000);
  }

  function init() {
    var poses = inject();
    if (poses === 0) guetter();
    document.addEventListener('tabibi:lang-change', syncLangBtns);
    setTimeout(syncLangBtns, 300);
  }

  // ⚠️ CE QUI SUIT N'EST PAS DECORATIF — c'est le correctif de P-29.
  //
  // `src/entries/index.js` faisait `import '../../js/tabibi-langbar.js';` : un
  // import a EFFET DE BORD SEUL. Rollup ne voyait aucune valeur consommee et
  // ELIMINAIT l'import — le module etait bien construit en morceau separe,
  // mais l'accueil construit ne le chargeait plus. Mesure du 15/09 :
  //
  //   sans cette ligne : accueil-public.html charge 3 morceaux, pas le langbar
  //   avec cette ligne : il en charge 4, dont `tabibi-langbar-*.js`
  //
  // Une affectation sur `window` au premier niveau donne au module un effet de
  // bord que le bundler ne peut plus ignorer. Et elle sert a quelque chose :
  // les entrees construites appellent `init()` explicitement.
  window.tabibiLangbar = { init: init, inject: inject };

  // Auto-init, pour les pages chargees SANS build (`<script src=…>`).
  // Sur les pages construites, l'entree rappelle `init()` : `inject()` est
  // idempotente, la seconde passe ne fait rien.
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
