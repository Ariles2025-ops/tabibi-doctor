/* ============================================================
   js/tabibi-desktop-diag.js — Diagnostic WebView desktop (TEMPORAIRE)
   ------------------------------------------------------------
   No-op total hors Tauri. En desktop : remonte l'origine réelle,
   les erreurs console et l'état du script Turnstile vers stderr du
   binaire via la commande Rust diag_log. À retirer après diagnostic.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.TABIBI_PLATFORM !== 'desktop') return;

  function send(m) {
    try {
      var inv = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
             || (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
      if (inv) inv('diag_log', { msg: m });
    } catch (e) {}
  }

  send('BOOT origin=' + location.origin + ' hostname=' + location.hostname +
       ' protocol=' + location.protocol + ' href=' + location.href);

  // Événements du captcha visible (js/tabibi-captcha-visible.js) → stderr
  document.addEventListener('tabibi:captcha', function (e) {
    var d = (e && e.detail) || {};
    send('CAPTCHA ' + d.ev + (d.info ? ' — ' + d.info : ''));
  });

  var _err = console.error, _warn = console.warn;
  console.error = function () { send('console.error: ' + [].slice.call(arguments).join(' ')); _err.apply(console, arguments); };
  console.warn  = function () { send('console.warn: '  + [].slice.call(arguments).join(' ')); _warn.apply(console, arguments); };
  window.addEventListener('error', function (e) {
    send('window.onerror: ' + (e.message || '(ressource)') + ' @' + (e.filename || (e.target && (e.target.src || e.target.href)) || '?'));
  }, true);

  setTimeout(function () {
    send('T+4s turnstile=' + typeof window.turnstile +
         ' siteKeyLue=' + !!(window.TABIBI_CONFIG && window.TABIBI_CONFIG.TURNSTILE_SITE_KEY));
  }, 4000);

  // Exercice complet de la chaîne captcha SANS identifiants : charge le
  // script cf, rend le widget, tente d'obtenir un token (jamais loggé —
  // uniquement présence/longueur).
  setTimeout(function () {
    if (!window.tabibiTurnstile || typeof window.tabibiTurnstile.getCaptchaToken !== 'function') {
      send('PROBE getCaptchaToken indisponible'); return;
    }
    var t0 = Date.now();
    send('PROBE getCaptchaToken() démarré…');
    window.tabibiTurnstile.getCaptchaToken().then(function (tok) {
      send('PROBE résultat après ' + (Date.now() - t0) + 'ms : token=' +
           (tok ? ('OUI (' + String(tok).length + ' chars)') : 'NULL') +
           ' · turnstile=' + typeof window.turnstile);
    }, function (e) {
      send('PROBE rejet après ' + (Date.now() - t0) + 'ms : ' + (e && e.message || e));
    });
  }, 1500);
})();
