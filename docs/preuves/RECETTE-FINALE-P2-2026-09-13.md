# Recette finale sur l'arbre de `main` — Parcours 2 (médecin SANS fiche)

Arbre de `main` au commit `033b51b`, servi en local, chargements cache-bustés.

## Identité de la session

| Mesure | Valeur |
|---|---|
| `auth.uid()` | `75188423-03a6-4598-961d-d11f5bb94cc6` |
| e-mail | `recette-20260912.medecin-sans-fiche@tabibi.doctor` |
| téléphone | `213555000202` |
| `getMyDoctorId()` | **AUCUNE** — c'est bien le compte sans fiche |

## Les deux correctifs de la nuit, mesurés

### #76 — la bannière est dans la coquille, et seulement dans l'onglet Agenda

| Onglet actif | bannière rendue | bouton « Bloquer un créneau » | hauteur du document | bas de `.app-root` |
|---|---|---|---|---|
| Aujourd'hui | non | non | 690 | 690 |
| **Agenda** | **oui** | **oui** | 1122 | 1122 |
| Mes RDV | non | non | 874 | 874 |

Deux choses à lire dans ce tableau.

1. **Le cloisonnement est rétabli** : la bannière et le bouton ne sont rendus que dans l'onglet Agenda.
   Structurellement, la bannière est dans `.app-root` et dans `#tab-agenda` sur les trois onglets, ce qui
   est la preuve que le bloc a bien retrouvé sa place dans l'arbre.
2. **Plus d'écran de vide** : sur les trois onglets, la hauteur du document est **exactement** égale au
   bas de la coquille. Rien n'est rendu au-delà. Avant #76, le document dépassait d'une hauteur d'écran.

La bannière fait 909 px de large, dans la colonne, sous « Blocages exceptionnels », avec le bouton
« Bloquer un créneau » grisé et la liste remplacée par « — (réclamez votre fiche pour activer cette
section) ». Elle se trouve à 963 px, donc sous le pli d'une fenêtre de 690 px : c'est du contenu normal
en bas d'un onglet, atteignable par un défilement ordinaire, et non plus une section orpheline.

### #77 et le message de refus — lisible sans défiler

| Mesure | Avant (12/09) | Maintenant |
|---|---|---|
| haut du message | y = 1033 | **y = 196** |
| bas du message | y = 1094 | **y = 256** |
| hauteur de la fenêtre | 690 | 690 |
| **visible sans défiler** | **non**, 343 px sous le pli | **oui** |

Le message est bien placé **avant** la liste des sept jours dans le document, vérifié par comparaison de
position des nœuds.

## Le refus d'enregistrement

| Plan | Constat |
|---|---|
| **Écran** | modale 1280×690, pré-remplie d'horaires par défaut 08:00-12:00 / 14:00-17:00 ; après « Enregistrer », bandeau jaune « Réclamez votre fiche dans l'annuaire pour pouvoir gérer vos disponibilités » avec lien actif, plus le toast « Vous devez d'abord réclamer votre fiche dans l'annuaire avant de pouvoir l'éditer. » |
| **Réseau** | `POST /rest/v1/rpc/update_my_doctor_profile` → **403** `{"code":"42501","message":"profile_not_found_or_not_claimed"}` |
| **Base** | 0 fiche liée à R2, 0 fiche créée, 0 indisponibilité, fiche de R1 intacte |

## Verdict par étape

| Étape | Verdict |
|---|---|
| 1. Tableau de bord, compte sans fiche | **cohérent** |
| 2. Bannière de revendication visible, dans la coquille, onglet Agenda seulement | **cohérent — correctif #76 confirmé** |
| 3. Modale des horaires, message avant la liste des jours | **cohérent — correctif confirmé** |
| 4. Refus d'enregistrement, écran / réseau / base | **cohérent**, refus honnête, zéro écriture |

**Parcours 2 : cohérent.**

## Observation — le décalage de dates de l'agenda s'est refermé tout seul

Cette nuit à 00h14 heure de Paris, la bande de semaine affichait « lun. 7 … dim. 13 » alors que chaque
cellule chargeait le jour précédent. À 02h42, les sept cellules chargent la date qu'elles affichent, et
le libellé dit « RDV DU DIMANCHE 13 SEPTEMBRE », correct.

Ce n'est pas une correction : c'est la confirmation de la fenêtre décrite dans
`docs/FICHE_TABLEAU_DE_BORD_HEURE_ET_COMPTES.md` §2. Le décalage n'existe que tant que l'heure locale est
inférieure au décalage UTC — avant 02:00 à Paris, avant 01:00 à Alger. Le défaut est intact dans le code,
il n'est simplement plus dans sa fenêtre d'apparition.

## Fichiers

- `final-P2-1-banniere-dans-onglet-agenda.png`
- `final-P2-2-refus-visible-sans-defiler.png`
