// =====================================================================
// Tabibi -- Configuration centrale
// =====================================================================
// Toutes les cles publiques de l'application sont ici. Modifier ce fichier
// avant deploiement. Voir DEPLOY_NOTES.md pour la liste des secrets a editer.

window.TABIBI_CONFIG = {
  // ---- Version de l'application (SOURCE UNIQUE) ------------------------
  // [A12 2026-09-09] Six numeros de version coexistaient (package.json 1.0.0,
  // tauri 0.1.0, Android 1.0.2, iOS 1.0, sw v37, Sentry 'v10.27.0' en dur).
  // Celui-ci fait autorite pour le web et pour Sentry. Aligne sur versionName
  // Android. A bumper a chaque livraison, dans le meme commit.
  APP_VERSION: '1.0.2',

  // ---- Supabase ------------------------------------------------------
  SUPABASE_URL: 'https://pudugodhiofqrctcdwfl.supabase.co',
  // [ROTATION 2026-09-10] Clé publiable (sb_publishable_…), publique par conception ; l'ancienne clé anon
  // (JWT HS256) est révoquée. Le nom de la propriété est conservé : js/, scripts/ et v2 la lisent ainsi.
  SUPABASE_ANON_KEY: 'sb_publishable_BtOCWQiqEik8gvzcVdIiQw_NKe4Ig9d',

  // ---- Cloudflare Turnstile (captcha) --------------------------------
  // Site key PUBLIQUE (OK dans le code client). La Secret Key reste cote
  // serveur uniquement, dans Edge Function secret TURNSTILE_SECRET_KEY.
  // Setup: https://dash.cloudflare.com -> Turnstile
  TURNSTILE_SITE_KEY: '0x4AAAAAADR6IhCWO9RLIipE',

  // ---- URL publique du site ------------------------------------------
  // Utilisee pour les liens email Supabase Auth (verification, reset password).
  SITE_URL: 'https://tabibi.doctor',

  // ---- Sentry (monitoring erreurs production) ------------------------
  // Creer le projet sur https://sentry.io (plan Developer gratuit, 5k events/mois)
  // Puis copier le DSN ici. Tant que la valeur contient "REPLACE_", Sentry est DESACTIVE.
  SENTRY_DSN: 'https://11c38796ddebc291cae7945f09e4aa58@o4511831260987392.ingest.de.sentry.io/4511831267475536',

  // ---- Dawini (localisation de medicaments en temps reel) -------------
  // [DAWINI 2026-07-08] Nom de la fonctionnalite — modifiable en UN SEUL
  // endroit (utilise par dawini.html, dawini-pharmacie.html, tabibi-dawini.js).
  DAWINI_NAME: 'Dawini',

  // ---- Redirections post-login (par role) ----------------------------
  REDIRECTS: {
    patient: 'patient-dashboard.html',
    doctor: 'doctor-dashboard.html',
    medecin: 'doctor-dashboard.html',  // alias FR
    admin: 'admin-dashboard.html',
    pharmacie: 'dawini-pharmacie.html',  // [DAWINI 2026-07-08] compte pharmacie → espace Dawini
    afterLogout: 'index.html',
    notLoggedIn: 'login.html',
    afterPasswordReset: 'login.html?reset=ok',
    afterEmailVerified: 'login.html?email=verified',
  },
};
