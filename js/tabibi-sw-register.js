/* ====================================================================
 * Tabibi — Service Worker registration loader
 * --------------------------------------------------------------------
 * Phase 11.3
 *
 * sw.js existait depuis Phase 1 mais n'était JAMAIS enregistré
 * (bug majeur découvert audit Phase 5.4 #5). Toutes les bumps v15→v18
 * du CACHE_VERSION ont été sans effet runtime — aucun navigateur n'a
 * jamais installé le SW.
 *
 * Ce loader appelle navigator.serviceWorker.register('/sw.js') et
 * gère :
 *   - Browsers sans support SW (silent skip)
 *   - Erreur d'enregistrement (warning console, app fonctionne sans)
 *   - Update détecté → reload propre via skipWaiting (déjà dans sw.js)
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 *
 * NB : à inclure SEULEMENT sur les pages publiques (pas dans /admin/*
 *      ni les pages auth-only où le offline pourrait causer confusion).
 * ==================================================================== */
(function () {
  'use strict';

  if (window.__tabibiSWRegistered) return;
  window.__tabibiSWRegistered = true;

  if (!('serviceWorker' in navigator)) {
    // Browser trop ancien, on n'insiste pas
    return;
  }

  // Évite de registrer sur localhost dev (pollue le cache et masque les
  // updates code). Pour tester PWA localement → utiliser un domaine type
  // 127.0.0.1 ou activer manuellement.
  if (location.hostname === 'localhost') return;

  function _register() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) {
        // Detect un nouveau SW dispo (cache version bumpée côté serveur)
        reg.addEventListener('updatefound', function () {
          var newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', function () {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // Une nouvelle version est prête. sw.js fait skipWaiting() à
              // l'install, donc le nouveau SW prend le contrôle au prochain
              // reload. On peut afficher une notif discrète pour inciter
              // au refresh, ou attendre la prochaine navigation.
              if (window.__TABIBI_DEBUG__) {
                console.info('[Tabibi/SW] Nouvelle version installée — actif au prochain reload.');
              }
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[Tabibi/SW] register failed:', err && err.message);
      });
  }

  if (document.readyState === 'complete') {
    _register();
  } else {
    window.addEventListener('load', _register);
  }
})();
