/* ====================================================================
 * Tabibi — Analytics loader (Plausible, privacy-friendly, feature-flagged)
 * --------------------------------------------------------------------
 * Phase 10.5
 *
 * Injecte le script Plausible UNIQUEMENT si :
 *   1. window.TABIBI_FEATURES.analytics === true
 *   2. L'utilisateur n'a pas refusé les cookies/analytics (tabibi-cookies.js)
 *
 * Activation post-création compte Plausible (DEPLOY_INSTRUCTIONS.md) :
 *   1. Créer compte https://plausible.io ou self-host
 *   2. Configurer domaine tabibi.doctor dans Plausible dashboard
 *   3. Passer window.TABIBI_FEATURES.analytics = true (tabibi-features.js)
 *   4. Vérifier que les events arrivent dans Plausible dashboard
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * RGPD : Plausible est cookieless par défaut, conforme RGPD sans consent.
 *        On respecte quand même le consent côté tabibi-cookies si défini.
 * ==================================================================== */
(function () {
  'use strict';

  if (window.__tabibiAnalyticsLoaded) return;
  window.__tabibiAnalyticsLoaded = true;

  function _hasAnalyticsConsent() {
    // Si tabibi-cookies a stocké un refus → respecter
    try {
      var raw = localStorage.getItem('tabibi_cookie_consent');
      if (raw) {
        var c = JSON.parse(raw);
        if (c && c.analytics === false) return false;
      }
    } catch (e) { /* localStorage indispo → on assume consent */ }
    return true;
  }

  function _loadPlausible() {
    if (document.querySelector('script[data-domain="tabibi.doctor"]')) return;
    var s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', 'tabibi.doctor');
    s.src = 'https://plausible.io/js/script.js';
    s.onerror = function () {
      console.warn('[Tabibi] Plausible script failed to load (DSN absent ou domaine non configuré)');
    };
    document.head.appendChild(s);
    // Stub window.plausible pour les éventuels event tracking custom
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
  }

  function _maybeLoad() {
    if (!window.TABIBI_FEATURES || window.TABIBI_FEATURES.analytics !== true) return;
    if (!_hasAnalyticsConsent()) return;
    _loadPlausible();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _maybeLoad);
  } else {
    _maybeLoad();
  }
})();
