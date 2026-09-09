// =====================================================================
// Tabibi — enregistrement du jeton push (natif uniquement)
// ---------------------------------------------------------------------
// [PUSH 2026-09-09] Avant, ce declencheur n'existait QUE dans
// doctor-dashboard.html — page que scripts/build-mobile.sh exclut
// volontairement du bundle mobile. Resultat : l'application n'enregistrait
// AUCUN jeton, pour personne. Ce module est charge par les pages qui font
// reellement partie de l'app (accueil, espace patient) et reste un no-op sur
// le web et sans session.
//
// Idempotent par page-load (window._tabibiPushInitDone). Aucune erreur
// n'est avalee : un echec de permission ou de plugin remonte a Sentry.
// =====================================================================
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    try {
      if (window._tabibiPushInitDone) return;
      var b = window.tabibi && window.tabibi.bridge;
      if (!b || !b.isNative) return;
      var sb = window.tabibi && window.tabibi.supabase;
      if (!sb) return;
      var s = await sb.auth.getSession();
      if (!s || !s.data || !s.data.session) return;
      window._tabibiPushInitDone = true;
      await b.initPushNotifications();
      if (typeof b.onPushNotification === 'function') {
        // Reception au premier plan + tap : route vers la page portee par le payload.
        b.onPushNotification(function (notif) {
          try {
            var cible = notif && notif.data && notif.data.url;
            if (cible && /^\/[a-z0-9-]+\.html/.test(cible)) window.location.href = cible;
          } catch (e) { (window.tabibiErreur || console.warn)(e, 'push:route'); }
        });
      }
    } catch (e) {
      (window.tabibiErreur || console.warn)(e, 'push:init');
    }
  });
})();
