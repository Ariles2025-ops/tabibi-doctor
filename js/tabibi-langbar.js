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
    } catch (e) {}
    try {
      var s = localStorage.getItem('tabibi_lang');
      if (s) return s;
    } catch (e) {}
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
    try { localStorage.setItem('tabibi_lang', l); } catch (e) {}
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

  // Recolore le bouton actif + masque le switcher flottant (un seul sélecteur).
  function syncLangBtns() {
    var l = currentLang();
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      var active = b.getAttribute('data-lang-btn') === l;
      b.style.background = active ? 'var(--blue)' : 'transparent';
      b.style.color      = active ? '#fff' : 'var(--text3)';
    });
    var sw = document.getElementById('tabibi-lang-switcher');
    if (sw) sw.style.display = 'none';
  }

  function inject() {
    document.querySelectorAll('[data-langbar]').forEach(function (slot) {
      slot.replaceWith(buildPill());   // le pill prend EXACTEMENT la place du placeholder
    });
    syncLangBtns();
  }

  function init() {
    inject();
    document.addEventListener('tabibi:lang-change', syncLangBtns);
    setTimeout(syncLangBtns, 300);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
