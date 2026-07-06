// ========================================================================
// js/payments.js — STUB paiement (bêta cash-only)
// ------------------------------------------------------------------------
// [FIX 2026-07-04] L'original scripts/payments.js 404ait en prod : scripts/
// est export-ignore (.gitattributes L8) donc jamais présent dans dist/.
// Ce stub vit dans js/ (déployé) et est chargé par reservation.html seule
// (recensement grep : une seule page web + un seul symbole attendu).
// Aucun paiement en ligne n'est réactivé : renderPayMethods retourne ''
// → #pay-methods reste vide (identique au markup statique), le wizard
// reste sur window._pay = "cash" posé par init().
// NB : index.html et patient-dashboard.html ont leur propre renderPayMethods
// inline et ne chargent PAS ce fichier — aucun conflit.
// ========================================================================
(function () {
  'use strict';

  function _warn() {
    console.warn('[payments] payments disabled (beta cash-only)');
  }

  // Attendu par reservation.html init() : innerHTML = renderPayMethods("cash")
  // → doit retourner une STRING ('' = div vide, comportement prod actuel).
  window.renderPayMethods = function () {
    _warn();
    return '';
  };

  // Drapeau consultable par le reste du front.
  window.tabibiPayments = { enabled: false };
})();
