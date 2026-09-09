/**
 * Tabibi — Script anti-FOUC (Flash Of Unstyled Content)
 * [I18N-UNIFY-2026]
 *
 * À inclure dans le <head> de TOUTES les pages, AVANT tout autre script :
 *   <script src="js/tabibi-prelang.js"></script>
 *
 * Applique <html lang/dir> dès le 1er rendu pour éviter le clignotement FR→AR.
 * Lecture : 1) localStorage.tabibi_lang  2) navigator.language  3) fallback 'fr'.
 *
 * Ce fichier est minimaliste et sans dépendances pour s'exécuter en quelques µs.
 */
(function () {
  try {
    var l = null;
    try {
      var stored = localStorage.getItem('tabibi_lang');
      if (stored === 'fr' || stored === 'ar' || stored === 'en') l = stored;
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-prelang.js:19'); }
    if (!l) {
      // Détection navigateur (BCP-47, ex: "fr-FR" → "fr")
      var nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase().slice(0, 2);
      if (nav === 'fr' || nav === 'ar' || nav === 'en') l = nav;
      else l = 'fr';
    }
    document.documentElement.lang = l;
    // [PERF 2026-09-09] Annonce le dictionnaire de la langue courante en PRELOAD :
    // le telechargement demarre tout de suite, sans bloquer le premier rendu.
    // (Une premiere version l'injectait ici en document.write : le fichier
    // devenait parseur-bloquant dans <head>, FCP 3,2 s -> 5,1 s. Retire.)
    // C'est js/tabibi-i18n.js qui l'insere, a SA position (fin de body).
    try {
      var _cs = document.currentScript, _base = 'js/';
      if (_cs && _cs.getAttribute('src')) _base = _cs.getAttribute('src').replace(/tabibi-prelang\.js.*$/, '');
      window.__TABIBI_I18N_BASE = _base;
      var _lk = document.createElement('link');
      _lk.rel = 'preload'; _lk.as = 'script'; _lk.href = _base + 'i18n/' + l + '.js';
      document.head.appendChild(_lk);
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'prelang:i18n'); }
    document.documentElement.dir = (l === 'ar') ? 'rtl' : 'ltr';
    // [FIX 2026-05-19] Classe lang-XX sur <html> (body pas encore dispo) pour
    // que les CSS specifiques langue puissent matcher des le pre-render
    document.documentElement.classList.remove('lang-fr', 'lang-ar', 'lang-en');
    document.documentElement.classList.add('lang-' + l);
    // Au DOMContentLoaded, propager sur body
    document.addEventListener('DOMContentLoaded', function () {
      if (document.body) {
        document.body.dir = document.documentElement.dir;
        document.body.classList.remove('lang-fr', 'lang-ar', 'lang-en');
        document.body.classList.add('lang-' + l);
      }
    });
  } catch (e) {
    // Silencieux : si tout échoue, on garde le HTML par défaut
  }
})();
