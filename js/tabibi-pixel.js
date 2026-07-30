/* ====================================================================
 * js/tabibi-pixel.js — Meta Pixel, chargé UNIQUEMENT après consentement
 * --------------------------------------------------------------------
 * Tabibi est un site de santé : le pixel est traité comme un traceur
 * marketing strict, jamais comme une brique de fonctionnement.
 *
 * RÈGLE CENTRALE — RIEN n'est chargé tant que la catégorie « marketing »
 * du bandeau cookies n'est pas acceptée. Ce fichier peut donc être
 * inclus dans le <head> de n'importe quelle page publique : à lui seul
 * il ne pose aucun cookie, n'ouvre aucune connexion à Meta et n'exécute
 * aucun script tiers. Il se contente d'écouter le consentement.
 *
 * Déclencheurs (deux chemins, le premier qui vient gagne — enable() est
 * idempotent) :
 *   1. js/tabibi-cookies.js appelle window.tabibiPixel.enable() depuis
 *      son hook apply() quand c.marketing est vrai (choix déjà stocké
 *      OU clic « Tout accepter »).
 *   2. Filet : écoute de l'événement 'tabibi:cookie-consent'. Utile si
 *      l'ordre de chargement change, ou si le consentement est modifié
 *      depuis legal/cookies.html sans rechargement.
 *
 * CE QUI EST ENVOYÉ À META — volontairement le minimum :
 *   • fbq('init', ID) SANS 2e argument  → Advanced Matching DÉSACTIVÉ :
 *     aucun email, téléphone, prénom/nom n'est haché ni transmis.
 *   • autoConfig = false → coupe la collecte automatique par Meta du
 *     texte des boutons et des métadonnées de champs de formulaire.
 *     Sur un site médical ces libellés peuvent trahir une spécialité ou
 *     un motif de consultation : c'est précisément ce qu'on refuse.
 *   • fbq('track','PageView') et RIEN d'autre. Aucun event métier :
 *     pas d'id/nom de médecin, pas de spécialité, pas de wilaya, pas
 *     d'identité patient, aucun event de réservation.
 *
 * ⚠️ LIMITE STRUCTURELLE → D'OÙ LA LISTE DE PAGES RESTREINTE
 * Un PageView transmet TOUJOURS l'URL courante et le referrer : c'est le
 * mécanisme même du pixel, rien côté client ne permet de l'en empêcher.
 * Sur une page qui identifie un praticien (doctor-profile.html?id=…,
 * reservation.html, les 490 pages /seo/ qui portent nom + spécialité +
 * wilaya), Meta recevrait donc l'identité du médecin consulté — une
 * donnée de santé par déduction — même sans aucun event personnalisé.
 *
 * C'est pourquoi ce fichier n'est inclus QUE dans index.html et
 * signup.html, dont les URLs ne révèlent rien de médical. Il a été
 * retiré de doctor-profile.html et reservation.html le 2026-08-03,
 * précisément pour cette raison.
 *
 * ⛔ NE PAS l'ajouter à une page dont l'URL identifie un praticien, une
 * spécialité ou un motif de consultation. Toute extension de la liste
 * doit d'abord passer par legal/cookies.html et la politique RGPD.
 *
 * Révocation : si le consentement marketing repasse à faux, on émet
 * fbq('consent','revoke'). Le script déjà injecté ne peut pas être
 * « désinstallé », mais Meta cesse d'envoyer. Un rechargement de page
 * repart de zéro, sans pixel.
 * ==================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const META_PIXEL_ID = "1697262591542844";

  var loaded = false;   // snippet Meta injecté ?
  var revoked = false;  // consentement retiré après coup ?

  /* Snippet officiel Meta, inchangé, exécuté seulement sur enable(). */
  function injectSnippet() {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  function enable() {
    if (loaded) {
      // Ré-autorisation après un revoke, sans réinjecter le script.
      if (revoked && window.fbq) { window.fbq('consent', 'grant'); revoked = false; }
      return;
    }
    loaded = true;
    injectSnippet();
    // autoConfig AVANT init : sinon Meta a déjà armé sa collecte auto.
    window.fbq('set', 'autoConfig', false, META_PIXEL_ID);
    // Pas de 2e argument = pas d'Advanced Matching = aucune PII.
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function disable() {
    if (!loaded || !window.fbq) return;
    window.fbq('consent', 'revoke');
    revoked = true;
  }

  /* Le bandeau rediffuse le consentement à chaque apply() ET à chaque
     changement de choix — on suit les deux sens. */
  document.addEventListener('tabibi:cookie-consent', function (e) {
    var c = e && e.detail;
    if (!c) return;
    if (c.marketing) enable(); else disable();
  });

  /* Consentement déjà accordé lors d'une visite précédente et bandeau
     initialisé avant ce fichier : on ne dépend pas de l'ordre. */
  try {
    if (window.tabibiCookies && window.tabibiCookies.hasConsent('marketing')) enable();
  } catch (err) { /* pas de localStorage → pas de pixel, comportement voulu */ }

  window.tabibiPixel = {
    enable: enable,
    disable: disable,
    isLoaded: function () { return loaded && !revoked; },
    id: META_PIXEL_ID
  };
})();
