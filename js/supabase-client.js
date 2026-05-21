// =====================================================================
// Tabibi — Initialisation du client Supabase
// =====================================================================
(function() {
  if (!window.TABIBI_CONFIG) {
    console.error('[Tabibi] config.js non chargé');
    return;
  }
  if (!window.supabase) {
    console.error('[Tabibi] SDK Supabase non chargé');
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.TABIBI_CONFIG;

  window.tabibi = window.tabibi || {};
  window.tabibi.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
