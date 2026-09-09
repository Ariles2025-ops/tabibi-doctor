// =====================================================================
// Session courante
// ---------------------------------------------------------------------
// Ce fichier contenait aussi un `useDoctorProfile` qui interrogeait
// `doctor_profiles` sur les colonnes `nom, prenom, specialite, wilaya`.
// AUCUNE n'existe : le schéma réel expose `full_name`, `full_name_ar`,
// `specialty_raw`, `wilaya_code`. La requête aurait échoué en production.
//
// Le typage généré l'a prouvé à la compilation, littéralement :
//   TS2352: SelectQueryError<"column 'nom' does not exist on 'doctor_profiles'.">
//
// Le profil médecin est désormais lu par `useProfilMedecin`
// (src/donnees/agenda.ts), typé sur le schéma réel et servi par TanStack Query.
// =====================================================================
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let vivant = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivant) return;
      setSession(data.session);
      setChargement(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (vivant) setSession(s);
    });
    return () => { vivant = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, chargement };
}
