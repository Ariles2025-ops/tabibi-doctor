# Recette finale sur l'arbre de `main` — Parcours 1 (médecin AVEC fiche)

Exécutée le 13/09/2026 sur l'arbre de **`main` au commit `033b51b`** (la vague fusionnée),
servi en local, chaque chargement cache-busté.

## Remise à zéro préalable

La remise à zéro n'avait pas été lancée : les deux rendez-vous de test des preuves précédentes étaient
encore en base. Supprimés par un `DELETE` borné au marqueur `RECETTE-20260912`, qui a rendu exactement
deux lignes :

| id | statut | heure d'Alger |
|---|---|---|
| `2750cd25` | `cancelled` | 14/09 09:00 |
| `a7be539b` | `pending` | 14/09 10:00 |

Contrôle d'après : 0 rendez-vous sur la fiche, **12 créneaux** le lundi 14, mercredi à `09:00-12:00`.
La fixture est celle que décrit la fiche de recette.

## Identité de la session

| Mesure | Valeur |
|---|---|
| `auth.uid()` | `2ed31cea-5851-40b4-89ae-14094a2f2ca0` |
| e-mail | `recette-20260912.medecin-fiche@tabibi.doctor` |
| téléphone | `213555000201` |
| libellé | `R1 medecin avec fiche` |
| fiche résolue par `getMyDoctorId()` | `85a6972c-…` |

## Les cinq étapes

| # | À l'écran | En base | Verdict |
|---|---|---|---|
| 1 | Bandeau « RECETTE 20260912 », pas de « Bienvenue » nu. « RDV aujourd'hui » 0, « Ce mois » 0 | 0 rendez-vous | **cohérent** |
| 2 | « Mes horaires » ouvre la modale : parent `BODY`, **1280×690**, pas 0×0 | — | **cohérent** (correctif #69, place rétablie par #76) |
| 3 | Les sept jours : lun/mar/jeu **matin ET après-midi**, mer/sam matin, ven/dim fermés | identique jour par jour | **cohérent**, deuxième plage conservée |
| 4 | Mercredi 12:00 → 13:00, « Enregistrer » : toast **« Horaires enregistrés »**, `update_my_doctor_profile` **200** | `wed` = 09:00-13:00, `updated_at` 12/09 19:58 → **13/09 00:35** | **cohérent**, écriture réelle |
| 5 | Rechargement cache-busté, réouverture : mercredi affiche **13:00** | idem base | **cohérent**, relu depuis la base |

**Aucun faux succès** : le toast n'apparaît jamais sans écriture correspondante, et aucune autre plage
n'a bougé.

## Remise en état

Mercredi ramené à `09:00-12:00` par le même chemin d'interface. Contrôle : 12 créneaux le lundi,
0 rendez-vous. La fixture est prête pour les parcours 2 et 3.

## Verdict du parcours 1 : **cohérent**

## Observations, sans effet sur ce verdict

- **La cloche affiche 3** alors que les rendez-vous qui les ont produites viennent d'être supprimés. Les
  notifications ne sont pas supprimées en cascade avec le rendez-vous : elles restent, orphelines. À
  décider — c'est défendable comme historique, mais il faut le vouloir.
- Le compteur « Ce mois » affiche 0, en accord avec la base. Le défaut d'over-comptage des annulés,
  consigné dans `docs/FICHE_TABLEAU_DE_BORD_HEURE_ET_COMPTES.md`, ne se voit que lorsqu'un rendez-vous
  annulé existe. Il n'est pas corrigé, seulement invisible sur cette fixture.

## Fichiers

- `final-P1-1-tableau-de-bord.png`
- `final-P1-2-modale-horaires.png`
- `final-P1-3-toast-horaires-enregistres.png`
- `final-P1-4-valeur-relue-13h.png`
