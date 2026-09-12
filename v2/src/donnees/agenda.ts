// =====================================================================
// Accès aux données de l'agenda — TanStack Query
// ---------------------------------------------------------------------
// Aucune de ces fonctions n'avale une erreur. Quand une requête échoue, elle
// remonte : l'écran l'affiche, et Sentry la reçoit. C'est l'inverse du code
// v1, où 173 blocs `catch {}` rendaient les pannes invisibles.
// =====================================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables, type Enums } from '../lib/supabase';
import { cles } from '../lib/requete';
import {
  COLONNE_TEMPS, finSemaine, resoudreIdsMedecin,
  type RendezVous, type IdentitePatient,
} from '../domaine/agenda';

export type ProfilMedecin = Pick<
  Tables<'doctor_profiles'>,
  'id' | 'user_id' | 'full_name' | 'full_name_ar' | 'specialty_raw' | 'wilaya_code' | 'is_active'
>;

/**
 * Profil médecin de l'utilisateur connecté.
 *
 * Les colonnes sont celles du schéma réel. La première version de la v2
 * demandait `nom, prenom, specialite, wilaya` : aucune n'existe, la requête
 * aurait échoué en production. Le typage rend désormais l'erreur impossible
 * à compiler.
 */
export function useProfilMedecin(userId: string | undefined) {
  return useQuery({
    queryKey: cles.profilMedecin(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfilMedecin | null> => {
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select('id, user_id, full_name, full_name_ar, specialty_raw, wilaya_code, is_active')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Rendez-vous de la semaine.
 *
 * Deux points sur lesquels cette requête diffère volontairement de la v1 :
 *   - elle filtre sur `scheduled_at` (NOT NULL) et non `starts_at` (nullable),
 *     qui masquait silencieusement des rendez-vous ;
 *   - elle interroge les DEUX espaces d'identifiants médecin.
 */
export function useAgendaSemaine(
  idProfil: string | null | undefined,
  authUid: string | undefined,
  debut: Date,
) {
  const ids = resoudreIdsMedecin(idProfil, authUid);
  const fin = finSemaine(debut);

  return useQuery({
    queryKey: cles.agenda(ids, debut.toISOString()),
    enabled: ids.length > 0,
    queryFn: async (): Promise<RendezVous[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .in('doctor_id', ids)
        .gte(COLONNE_TEMPS, debut.toISOString())
        .lt(COLONNE_TEMPS, fin.toISOString())
        .order(COLONNE_TEMPS, { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Identités patients, via `doctor_patients_directory`.
 *
 * `public.users` est muette côté médecin (RLS scopée par `auth.uid()`).
 * En v1, l'échec de cette lecture était avalé sans log : d'où les « Patient »
 * anonymes que personne n'expliquait. Ici l'erreur remonte.
 */
export function usePatients(ids: readonly string[]) {
  const uniques = [...new Set(ids)].filter(Boolean);
  return useQuery({
    queryKey: cles.patients(uniques),
    enabled: uniques.length > 0,
    staleTime: 5 * 60_000,          // une identité patient ne change pas en 30 s
    queryFn: async (): Promise<Record<string, IdentitePatient>> => {
      const { data, error } = await supabase
        .from('doctor_patients_directory')
        .select('id, first_name, last_name, phone')
        .in('id', uniques);
      if (error) throw error;
      const index: Record<string, IdentitePatient> = {};
      for (const p of data ?? []) {
        if (p.id) index[p.id] = p as IdentitePatient;
      }
      return index;
    },
  });
}

/**
 * Changement de statut d'un rendez-vous.
 *
 * `onSettled` invalide l'agenda : après une confirmation ou une annulation,
 * la grille doit refléter la base, pas l'espoir du client.
 */
export function useChangerStatut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; statut: Enums<'appointment_status'> }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: params.statut })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['agenda'] }),
  });
}
