/* ====================================================================
 * Tabibi — Feature Flags (frontend pur, lecture localStorage en option)
 * --------------------------------------------------------------------
 * Phase 7.4 + Phase 8.4 + Phase 9.5 + Phase 10.5 + Phase 12.1
 *
 * Source unique de vérité pour activer/désactiver les fonctionnalités
 * dont les dépendances backend (RPC / Edge Function / API tierce) ne
 * sont pas encore prêtes en M0.
 *
 * Lecture :
 *   window.TABIBI_FEATURES.video
 *   window.TABIBI_FEATURES.payments
 *   window.TABIBI_FEATURES.notifications
 *   window.TABIBI_FEATURES.reviews
 *   window.TABIBI_FEATURES.analytics
 *   window.TABIBI_FEATURES.sentry
 *
 * Override runtime (debug / QA, jamais en prod) :
 *   localStorage.setItem('tabibi_features_override', JSON.stringify({video:true}))
 *   → reload, le flag est ON
 *
 * Activer une feature pour de bon :
 *   1. Mettre `true` dans ce fichier (default ci-dessous)
 *   2. Vérifier que la dépendance backend / tierce est prête
 *      (cf SQL_TODO.md + Phase 13)
 *   3. Tester staging avant prod
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';

  if (window.TABIBI_FEATURES && typeof window.TABIBI_FEATURES === 'object'
      && Object.isFrozen(window.TABIBI_FEATURES)) {
    return;  // déjà chargé
  }

  // ─── Defaults M0 — tout OFF sauf le core ────────────────────────────
  // Activer feature par feature en Phase 13 après validation backend.
  var defaults = {
    // Téléconsultation Daily.co (Phase 7) :
    //   - Frontend teleconsultation.html : ✅ câblé
    //   - RPC get_video_session : ❌ inexistante en DB (TODO-SQL-008)
    //   - RPC set_video_recording_consent : ❌ inexistante en DB (TODO-SQL-008)
    //   → Bloquer côté UI (boutons "Téléconsulter" masqués)
    video: false,

    // Paiements (Phase 8) :
    //   - Stripe Test : compte non créé
    //   - Edge Function webhook : non déployée
    //   → Bloquer côté UI (cards paiement = "Bientôt disponible")
    payments: false,

    // Notifications in-app (Phase 9) :
    //   - Table notifications : non créée (TODO-SQL-009)
    //   - Triggers : non créés (TODO-SQL-010)
    notifications: false,

    // Avis (Phase 9) :
    //   - Table reviews : non créée (TODO-SQL-011)
    //   - RLS post-completed : non créée (TODO-SQL-012)
    reviews: false,

    // Analytics Plausible (Phase 10) :
    //   - Compte Plausible non créé
    //   - Script injection désactivé pour éviter erreur 404 + bruit
    analytics: false,

    // Sentry frontend errors (Phase 12) :
    //   - Compte Sentry non créé / DSN non configuré
    //   - Script déjà inclus mais bridge inerte si pas de DSN
    sentry: false
  };

  // ─── Override runtime (QA / debug) ──────────────────────────────────
  var overrides = {};
  try {
    var raw = localStorage.getItem('tabibi_features_override') || '';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') overrides = parsed;
    }
  } catch (e) { /* localStorage indispo / JSON cassé → no override */ }

  var merged = {};
  Object.keys(defaults).forEach(function (k) {
    merged[k] = (k in overrides) ? !!overrides[k] : defaults[k];
  });

  window.TABIBI_FEATURES = Object.freeze(merged);

  // ─── Helper : afficher / masquer des éléments par flag ──────────────
  // Usage HTML : <button data-feature="video">Téléconsulter</button>
  //  → masqué si TABIBI_FEATURES.video === false
  //  Inverse : data-feature-not="video" → visible UNIQUEMENT si video=false
  function _applyFeatureVisibility() {
    var nodes = document.querySelectorAll('[data-feature]');
    Array.prototype.forEach.call(nodes, function (el) {
      var key = el.getAttribute('data-feature');
      if (key && merged[key] === false) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      }
    });
    var antiNodes = document.querySelectorAll('[data-feature-not]');
    Array.prototype.forEach.call(antiNodes, function (el) {
      var key = el.getAttribute('data-feature-not');
      if (key && merged[key] === true) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyFeatureVisibility);
  } else {
    _applyFeatureVisibility();
  }
  window.tabibiApplyFeatureVisibility = _applyFeatureVisibility;
})();
