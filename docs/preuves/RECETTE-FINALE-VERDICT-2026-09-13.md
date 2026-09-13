# Recette finale de la vague — verdict

**Arbre testé :** `main` au commit `033b51b`, la vague fusionnée en commit de fusion.
**Date :** 13/09/2026, entre 00h30 et 01h00.
**Méthode :** trois parcours réels en session connectée, écran contre base à chaque étape,
chaque chargement cache-busté. C'est cette exécution qui vaut porte de déploiement, pas les
exécutions intermédiaires obtenues branche par branche.

## Verdict : **GO technique**

Les trois parcours sont cohérents. Aucun faux succès, aucune écriture parasite, aucun écran
qui affirme ce que la base ne confirme pas.

| Parcours | Compte | Verdict | Document |
|---|---|---|---|
| 1 — médecin AVEC fiche | R1 `2ed31cea` | **cohérent** | `RECETTE-FINALE-P1-2026-09-13.md` |
| 2 — médecin SANS fiche | R2 `75188423` | **cohérent** | `RECETTE-FINALE-P2-2026-09-13.md` |
| 3 — patient réserve puis annule | R3 `49d22433` | **cohérent** | `RECETTE-FINALE-P3-2026-09-13.md` |

L'identité de chaque session a été établie par `auth.uid()` avant toute mesure, jamais par le nom
affiché — les deux comptes médecin portent le même nom et la même pastille.

## Ce que la recette a confirmé

- **Les horaires s'écrivent vraiment.** Toast et écriture en base vont de pair, `updated_at` avance,
  aucune plage voisine n'est perdue.
- **Le refus est honnête.** Un médecin sans fiche reçoit un 403 explicite, un message lisible sans
  défiler, et zéro ligne n'est écrite.
- **L'heure ne décale plus** sur le chemin patient : écran, requête, stockage et relecture en heure
  d'Alger disent tous 09:00.
- **La garde de disponibilité tient** : jour fermé et heure hors plage refusés, message humain,
  zéro écriture.
- **Les effets de bord sont réversibles** : le créneau disparaît à la réservation et revient à
  l'annulation, exactement.
- **Les trois correctifs de la nuit fonctionnent** : la bannière de revendication est dans la
  coquille et cloisonnée à son onglet (#76), la recherche publique répond (#77), et le médecin voit
  les rendez-vous de ses patients (#78).

## Ce qui reste, et qui ne bloque pas

Quatre défauts connus, tous **déjà en production**, aucun introduit par la vague. Ils sont ordonnés
dans `docs/FICHE_TABLEAU_DE_BORD_HEURE_ET_COMPTES.md` et passent après le déploiement :
le rendez-vous annulé affiché comme honoré, le fuseau du cabinet, la navigation de semaine.

Deux observations de cette recette, sans effet sur le verdict :

- **Les notifications survivent à la suppression du rendez-vous.** Après la remise à zéro, la cloche
  de R1 affichait encore 3 notifications d'événements dont les rendez-vous n'existaient plus. Il n'y
  a pas de suppression en cascade. Défendable comme historique, mais il faut le vouloir.
- **Le décalage de dates de l'agenda s'est refermé de lui-même** entre 00h14 et 02h42, ce qui
  confirme la fenêtre décrite dans la fiche : il n'apparaît que tant que l'heure locale est
  inférieure au décalage UTC. Le code est inchangé, le défaut est intact.

## Ce que ce verdict ne couvre pas

- **Le déploiement lui-même.** Il n'a pas eu lieu : `vars.DEPLOIEMENT_AUTO` n'est pas défini, et le
  job a été **sauté** au push sur `main`. Le go de déploiement appartient à Aghiles.
- **Le parcours médecin en conditions réelles sur mobile**, et l'app Capacitor.
- **Les comptes de recette** sont encore en base. Purge prévue par `recette-purge-finale.sql`, puis
  suppression des comptes d'authentification par l'API admin.

## Point de retour

Tag annoté `avant-fusion-2026-09-12` → `18183bd`, intact, vérifié avant et après la fusion.
