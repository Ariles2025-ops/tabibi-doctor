// =====================================================================
// Client TanStack Query — politique de cache
// ---------------------------------------------------------------------
// Les valeurs ci-dessous ne sont pas des réglages par défaut recopiés : elles
// répondent à l'usage réel d'un agenda de cabinet.
//
//   staleTime 30 s   Un médecin ouvre son agenda, répond au téléphone, revient.
//                    Refaire la requête à chaque retour d'onglet ferait clignoter
//                    la grille pour rien. 30 s couvre ce va-et-vient tout en
//                    gardant l'agenda vivant.
//   gcTime 5 min     Naviguer entre deux semaines puis revenir doit être
//                    instantané, sans re-télécharger.
//   retry 2          Le réseau mobile algérien coupe. Deux reprises avec un
//                    délai croissant évitent de montrer une erreur pour une
//                    micro-coupure. Au-delà, c'est une vraie panne : on le dit.
//   refetchOnWindowFocus  ACTIF : un rendez-vous peut être pris par le
//                    secrétariat pendant que le médecin regarde son écran.
//                    Un agenda périmé est pire qu'un agenda qui se rafraîchit.
// =====================================================================
import { QueryClient } from '@tanstack/react-query';

export const clientRequete = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (essai) => Math.min(1000 * 2 ** essai, 8000),
      refetchOnWindowFocus: true,
    },
  },
});

/** Clés de cache centralisées : évite les invalidations qui ratent leur cible. */
export const cles = {
  profilMedecin: (userId: string) => ['profil-medecin', userId] as const,
  agenda: (idsMedecin: readonly string[], debutISO: string) =>
    ['agenda', [...idsMedecin].sort().join('|'), debutISO] as const,
  patients: (ids: readonly string[]) =>
    ['patients', [...ids].sort().join('|')] as const,
} as const;
