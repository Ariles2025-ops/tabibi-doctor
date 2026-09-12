/* ============================================================
   js/tabibi-platform.js — Détection de plateforme — Phase 3
   ------------------------------------------------------------
   Pose window.TABIBI_PLATFORM = 'web' | 'mobile' | 'desktop' :
     • desktop : app Tauri (window.__TAURI_INTERNALS__ / __TAURI__)
     • mobile  : wrapper Capacitor natif (iOS/Android)
     • web     : navigateur classique (défaut)

   Charge-le AVANT tout script qui doit brancher un comportement
   par plateforme. Zéro dépendance, zéro effet de bord hors :
     - window.TABIBI_PLATFORM
     - attribut data-platform sur <html> (hooks CSS :
       html[data-platform="desktop"] { … })

   Le frontend reste identique sur les 3 plateformes ; ce flag sert
   aux ajustements ciblés (ex. masquer l'install-banner PWA dans
   Tauri, liens externes via openUrl côté desktop).
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function detect() {
    // Tauri v2 : __TAURI_INTERNALS__ toujours présent dans la WebView ;
    // __TAURI__ seulement si app.withGlobalTauri = true (filet).
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) return 'desktop';
    // Capacitor natif (le web via navigateur expose parfois l'objet
    // sans être natif → isNativePlatform() fait foi).
    try {
      if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
          && window.Capacitor.isNativePlatform()) return 'mobile';
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-platform.js:32'); }
    return 'web';
  }

  var p = detect();
  window.TABIBI_PLATFORM = p;
  try { document.documentElement.setAttribute('data-platform', p); } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-platform.js:38'); }
})();
