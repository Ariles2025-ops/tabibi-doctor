# Front — messages honnêtes sur double-booking et créneau hors disponibilité (12/09/2026)

Deux erreurs de la base doivent devenir un message clair côté patient, pas une erreur brute, avec rafraîchissement des créneaux :
- **`23P01`** (violation de la contrainte EXCLUDE `appointments_no_overlap_per_doctor`) : deux RDV qui se chevauchent →
  « ce créneau vient d'être pris ».
- **`slot_unavailable`** (garde `enforce_appointment_availability`, `errcode 23514`, message préfixé `slot_unavailable`) :
  créneau hors disponibilité du médecin → « ce créneau n'est plus disponible ».

## Correctif (branche #74, `js/tabibi-booking.js` + `reservation.html`)

- `_mapPostgrestError` : `23P01`/`23505` → `ERR_SLOT_TAKEN` ; `23514` **selon le message** — `slot_unavailable` →
  `ERR_SLOT_OUTSIDE_HOURS`, sinon `ERR_INVALID_INPUT` (ex. `appointment_time_missing`).
- Messages : `ERR_SLOT_TAKEN` = « Ce créneau vient d'être pris. Choisissez-en un autre. » ;
  `ERR_SLOT_OUTSIDE_HOURS` = « Ce créneau n'est plus disponible. Choisissez-en un autre. »
- `reservation.html` (`confirmRDV`) : la branche de rafraîchissement (invalide le cache, revient à l'étape 1, re-fetch les
  créneaux) se déclenche désormais sur `ERR_SLOT_TAKEN` **et** `ERR_SLOT_OUTSIDE_HOURS`, et le toast affiche le message mappé
  (wording exact par code) suivi de « Voici les créneaux à jour ».

## Preuve 1 — mapping déterministe (node, sur objets d'erreur réels)

| Erreur base | Code mappé |
|---|---|
| `23P01` exclusion | ERR_SLOT_TAKEN ✓ |
| `23505` unique | ERR_SLOT_TAKEN ✓ |
| `23514` « slot_unavailable… » | ERR_SLOT_OUTSIDE_HOURS ✓ |
| `23514` « appointment_time_missing… » | ERR_INVALID_INPUT ✓ |
| `42501` | ERR_RLS_DENIED ✓ |

## Preuve 2 — navigateur, cache-busté, via le vrai `confirmRDV()` (createAppointment stubbé sur le retour d'erreur)

| Cas | Toast affiché | Retour étape 1 |
|---|---|---|
| `23P01` → ERR_SLOT_TAKEN | « Ce créneau vient d'être pris. Choisissez-en un autre. Voici les créneaux à jour. » | oui |
| `23514 slot_unavailable` → ERR_SLOT_OUTSIDE_HOURS | « Ce créneau n'est plus disponible. Choisissez-en un autre. Voici les créneaux à jour. » | oui |

Limite honnête : le chemin complet erreur base réelle → mapping → toast n'est pas exerçable sans une session patient connectée
sur l'origine de la branche (OTP requis) ; le mapping est prouvé de façon déterministe (node), et la partie visible
(message + rafraîchissement) est prouvée en pilotant `confirmRDV()` avec le retour d'erreur stubbé. Le jour d'un vrai
double-booking en session, le comportement sera identique.
