// =====================================================================
// Configuration v2
// ---------------------------------------------------------------------
// Mêmes valeurs publiques que js/config.js du site actuel — les deux
// versions parlent au MÊME projet Supabase. Aucune donnée n'est dupliquée.
// La clé anon est publique par conception : la sécurité repose sur la RLS.
// =====================================================================

export const CONFIG = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL
    ?? 'https://pudugodhiofqrctcdwfl.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
    ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZHVnb2RoaW9mcXJjdGNkd2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzUwNzAsImV4cCI6MjA5Mzc1MTA3MH0.XUmkPhXN8W0bX9L2-MVPuqWVjOsNP69zDqTF2XpR0U4',
  SITE_URL: 'https://tabibi.doctor',
  // Retour vers le site v1 quand un écran n'existe pas encore en v2
  V1_BASE: '/',
} as const;
