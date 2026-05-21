// =====================================================================
// Tabibi -- Configuration centrale
// =====================================================================
// Toutes les cles publiques de l'application sont ici. Modifier ce fichier
// avant deploiement. Voir DEPLOY_NOTES.md pour la liste des secrets a editer.

window.TABIBI_CONFIG = {
  // ---- Supabase ------------------------------------------------------
  SUPABASE_URL: 'https://pudugodhiofqrctcdwfl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZHVnb2RoaW9mcXJjdGNkd2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzUwNzAsImV4cCI6MjA5Mzc1MTA3MH0.XUmkPhXN8W0bX9L2-MVPuqWVjOsNP69zDqTF2XpR0U4',

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
  SENTRY_DSN: 'REPLACE_WITH_SENTRY_DSN',

  // ---- Redirections post-login (par role) ----------------------------
  REDIRECTS: {
    patient: 'patient-dashboard.html',
    doctor: 'doctor-dashboard.html',
    medecin: 'doctor-dashboard.html',  // alias FR
    admin: 'admin-dashboard.html',
    afterLogout: 'index.html',
    notLoggedIn: 'login.html',
    afterPasswordReset: 'login.html?reset=ok',
    afterEmailVerified: 'login.html?email=verified',
  },
};
