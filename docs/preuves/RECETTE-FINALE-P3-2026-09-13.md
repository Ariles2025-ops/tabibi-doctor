# Recette finale sur l'arbre de `main` — Parcours 3 (patient réserve puis annule)

Arbre de `main` au commit `033b51b`, servi en local, chargements cache-bustés.

## Identité de la session

| Mesure | Valeur |
|---|---|
| `auth.uid()` | `49d22433-d723-44df-9a93-eae62753142f` |
| e-mail | `recette-20260912.patient@tabibi.doctor` |
| téléphone | `213555000203` |
| rôle | `patient` |

## Les cinq étapes

| # | À l'écran | En base | Verdict |
|---|---|---|---|
| 1 | Recherche « RECETTE » + Alger : **1 médecin trouvé**. « Prendre RDV » mène à `reservation.html` avec l'identifiant de fiche. Lundi 14 : **12 créneaux** | `chercher_praticiens` 200, `get_available_slots` 200 avec 12 lignes | **cohérent** |
| 2 | Choix 09:00, motif saisi, « Confirmer » → **« RDV confirmé ! »**, récapitulatif « lun. 14 septembre 2026 » | insertion **201**, RDV `588b7b54` | **cohérent** |
| 3 | « Mes RDV » : « À venir 1 », « lundi 14 septembre 2026 · **09:00** », « En attente » | `pending` | **cohérent** |
| 4 | Dimanche 20 : « Aucun créneau disponible ce jour ». Les deux cas négatifs refusés avec un message humain | **0 ligne** écrite | **cohérent** |
| 5 | Annulation : dialogue de confirmation, toast **« Rendez-vous annulé. »**, « À venir 0 / Annulés 1 » | `cancelled`, `cancelled_by_user_id` = R3, `cancelled_at` renseigné | **cohérent** |

### L'heure : aucun décalage

| Mesure | Valeur |
|---|---|
| affiché à l'écran | lundi 14 septembre · **09:00** |
| envoyé par le front | `2026-09-14T08:00:00.000Z` |
| stocké en base | `2026-09-14 08:00:00+00` |
| relu en heure d'Alger | **2026-09-14 09:00:00** |

Africa/Algiers est à UTC+1 : les quatre lignes disent la même heure.

### Identifiants

| Champ | Contrôle |
|---|---|
| `patient_id` | = R3 ✔ |
| `doctor_id` | = `doctor_profiles.id` de la fiche 9000002 ✔ |
| `cancelled_by_user_id` | = R3 ✔ |

### Effets de bord

| Effet | Avant | Après réservation | Après annulation |
|---|---|---|---|
| créneaux offerts lundi 14 | 12 | **11** | **12** |
| 09:00 proposé | oui | **non** | **oui, revenu** |
| notifications pour R1 | 0 | **1** | **2** |

## Étape 4 en détail — la garde de disponibilité

À l'écran, un dimanche ne propose rien : `get_available_slots` rend `[]` et la page affiche
« Aucun créneau disponible ce jour. Choisissez un autre jour. »

Les deux cas négatifs ont été tentés par la fonction de réservation de l'application elle-même,
donc avec sa vraie chaîne d'erreurs :

| Cas | Résultat | Code | Message rendu à l'utilisateur |
|---|---|---|---|
| dimanche 20/09 09:00, jour fermé | **refusé** | `ERR_SLOT_OUTSIDE_HOURS` | « Ce créneau n'est plus disponible. Choisissez-en un autre. » |
| lundi 14/09 20:00, hors plage | **refusé** | `ERR_SLOT_OUTSIDE_HOURS` | idem |

Contrôle en base : **0 ligne** écrite pour ces deux tentatives. Message humain, jamais d'erreur brute.

## Verdict du parcours 3 : **cohérent**

## Fichiers

- `final-P3-1-recherche.png`
- `final-P3-2-rdv-confirme.png`
- `final-P3-3-mes-rdv.png`
- `final-P3-4-dimanche-aucun-creneau.png`
- `final-P3-5-apres-annulation.png`
