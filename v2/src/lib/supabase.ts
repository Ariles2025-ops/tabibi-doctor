// =====================================================================
// Client Supabase typé de bout en bout
// ---------------------------------------------------------------------
// IMPORTANT : la v1 (site actuel) et la v2 tournent sur le même domaine et
// partagent donc le même localStorage. On garde la clé de session par défaut
// de supabase-js pour qu'un médecin connecté sur le site actuel soit AUSSI
// connecté en v2, et inversement. C'est ce qui rend la migration écran par
// écran possible sans reconnexion.
//
// Le paramètre de type <Database> fait remonter le schéma réel jusqu'aux
// appels : une colonne inexistante devient une erreur de compilation, plus
// une erreur PostgREST découverte par un médecin en consultation.
// =====================================================================
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { CONFIG } from './config';

export const supabase = createClient<Database>(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

/** Lignes des tables et vues, dérivées du schéma généré. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Vues<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
