// =====================================================================
// Règles métier de l'agenda — fonctions PURES, testables sans navigateur
// ---------------------------------------------------------------------
// Tout ce qui peut se tromper silencieusement est isolé ici et couvert par
// des tests. Le reste de l'écran n'est que de l'affichage.
// =====================================================================
import type { Tables } from '../lib/supabase';

export type RendezVous = Tables<'appointments'>;

// ---------------------------------------------------------------------
// 1. L'identité du médecin — le piège le plus coûteux du projet
// ---------------------------------------------------------------------
// `appointments.doctor_id` référence `doctor_profiles.id`. Mais des lignes
// anciennes portent un `auth.uid()`, et `prescriptions` comme `doctor_schedule`
// comparent `doctor_id = auth.uid()`. Deux espaces d'identifiants coexistent
// donc dans la même colonne.
//
// Conséquence : interroger un seul des deux renvoie un agenda PARTIEL, sans
// la moindre erreur. Un médecin voit une journée vide et conclut qu'il n'a
// pas de patients. C'est le mode de panne le plus dangereux du produit —
// silencieux, et impossible à distinguer d'une journée réellement vide.
//
// On interroge donc les deux, comme le fait js/tabibi-agenda.js. Cette
// fonction existe pour que ce choix soit VISIBLE et TESTÉ, au lieu d'être
// une ligne perdue dans un composant.
//
// À supprimer le jour où `migrations/P1_test_coherence_doctor_id.sql` prouve
// que la colonne ne contient plus qu'un seul espace d'identifiants.
// ---------------------------------------------------------------------
export function resoudreIdsMedecin(
  idProfil: string | null | undefined,
  authUid: string | null | undefined,
): string[] {
  const ids = [idProfil, authUid].filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  return [...new Set(ids)];
}

// ---------------------------------------------------------------------
// 2. La colonne de temps — pourquoi scheduled_at et pas starts_at
// ---------------------------------------------------------------------
// Le schéma réel (vérifié le 09/09/2026) :
//     scheduled_at : string        NOT NULL
//     starts_at    : string | null NULLABLE
//
// js/tabibi-agenda.js FILTRE sur `starts_at` (lignes 198-199) mais AFFICHE
// `scheduled_at` (lignes 111 et 133). Tout rendez-vous dont `starts_at` est
// nul est donc absent de l'agenda, sans erreur ni message.
//
// La v2 filtre et trie sur `scheduled_at`, la seule colonne dont le schéma
// garantit qu'elle est renseignée. `migrations/P1_diagnostic_starts_at.sql`
// mesure combien de rendez-vous étaient concernés en production.
// ---------------------------------------------------------------------
export const COLONNE_TEMPS = 'scheduled_at' as const;

/** Instant d'un rendez-vous. `scheduled_at` est NOT NULL : jamais d'Invalid Date. */
export function instantRdv(rdv: Pick<RendezVous, 'scheduled_at'>): Date {
  return new Date(rdv.scheduled_at);
}

// ---------------------------------------------------------------------
// 3. La semaine algérienne
// ---------------------------------------------------------------------
// Elle commence le DIMANCHE. Un calcul calé sur le lundi décalerait la grille
// d'un jour pour tout le pays.
// ---------------------------------------------------------------------
export const JOURS_SEMAINE = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const;

export function debutSemaine(reference: Date = new Date()): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function finSemaine(debut: Date): Date {
  const f = new Date(debut);
  f.setDate(f.getDate() + 7);
  return f;
}

export function decalerSemaine(debut: Date, semaines: number): Date {
  const d = new Date(debut);
  d.setDate(d.getDate() + semaines * 7);
  return d;
}

// ---------------------------------------------------------------------
// 4. Répartition des rendez-vous sur les 7 jours
// ---------------------------------------------------------------------
// Renvoie TOUJOURS 7 cases, même vides : une grille dont le nombre de colonnes
// dépend des données saute visuellement d'une semaine à l'autre.
// ---------------------------------------------------------------------
export function repartirParJour(
  rdvs: readonly RendezVous[],
  debut: Date,
): RendezVous[][] {
  const jours: RendezVous[][] = Array.from({ length: 7 }, () => []);
  const fin = finSemaine(debut);

  for (const rdv of rdvs) {
    const t = instantRdv(rdv);
    if (t < debut || t >= fin) continue;   // hors semaine : ignoré, pas empilé sur le jour 0
    const index = Math.floor((t.getTime() - debut.getTime()) / 86_400_000);
    if (index >= 0 && index < 7) jours[index].push(rdv);
  }

  for (const j of jours) {
    j.sort((a, b) => instantRdv(a).getTime() - instantRdv(b).getTime());
  }
  return jours;
}

// ---------------------------------------------------------------------
// 5. Statuts — l'énumération vient du schéma, pas d'une chaîne libre
// ---------------------------------------------------------------------
export const STATUTS_ANNULES = ['cancelled', 'no_show'] as const;

export function estAnnule(rdv: Pick<RendezVous, 'status'>): boolean {
  return (STATUTS_ANNULES as readonly string[]).includes(rdv.status);
}

/** Rendez-vous qui occupent réellement le créneau (pour les compteurs). */
export function rdvActifs(rdvs: readonly RendezVous[]): RendezVous[] {
  return rdvs.filter((r) => !estAnnule(r));
}

// ---------------------------------------------------------------------
// 6. Identité patient
// ---------------------------------------------------------------------
// `public.users` reste muette côté médecin : sa RLS scope par `auth.uid()`.
// L'identité passe par la vue `doctor_patients_directory`. Quand elle ne
// renvoie rien, on affiche un repli explicite — jamais un nom inventé.
//
// La v1 avalait cet échec sans log (js/tabibi-agenda.js:188-194), d'où les
// « Patient » anonymes historiques que personne n'arrivait à expliquer.
// ---------------------------------------------------------------------
export type IdentitePatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export function nomPatient(p: IdentitePatient | undefined): string {
  if (!p) return 'Patient';
  const nom = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return nom || 'Patient';
}
