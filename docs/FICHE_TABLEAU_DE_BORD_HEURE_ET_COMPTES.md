# Chantier — le tableau de bord dit l'heure du cabinet, et ne compte que ce qui existe

**Ouvert le :** 13/09/2026, en vérifiant #78.
**Position :** **après le déploiement.** Aucun de ces défauts n'est une régression de la vague, tous sont
déjà en production. On ne retient pas dix-huit PR pour eux.
**Périmètre :** `doctor-dashboard.html`, plus l'utilitaire de fuseau à créer.
**Preuve d'origine :** `docs/preuves/FIX-MEDECIN-VOIT-SES-RDV-2026-09-12.md`, section « Trois défauts restants ».

Ils ont été trouvés en vérifiant autre chose. #78 rendait enfin les rendez-vous visibles au médecin ;
c'est en regardant ce qu'il voyait qu'on a vu **comment** il le voyait.

---

## 1. Le rendez-vous annulé s'affiche comme honoré, et il est compté

**Le plus grave du lot, donc le premier.** Un médecin attend un patient qui ne viendra pas, et ses chiffres
sont faux. C'est la même famille que les quatre faux succès : l'écran affirme quelque chose que la base ne
confirme pas.

### Ce qui est mesuré

- `renderAgenda` filtre les rendez-vous du jour **par date seulement**, jamais par statut. L'annulé est
  listé, et le titre annonce « RDV DU LUNDI 14 SEPTEMBRE (2) » pour **un** rendez-vous réel.
- Le badge est choisi ainsi : `status==='Confirmed' ? bleu : status==='Pending' ? ambre : vert`.
  `Cancelled` tombe dans le `else` et reçoit le **vert avec une coche**, l'apparence exacte d'un
  rendez-vous honoré.
- Le compteur « Ce mois » compte sans filtrer non plus : **2** affichés pour **1** rendez-vous non annulé.

### Ce qu'il faut faire

Exclure `cancelled` (et décider explicitement pour `no_show`) des listes et des compteurs, et donner à
chaque statut son propre badge au lieu d'un `else` fourre-tout. Un statut inconnu doit s'afficher comme
inconnu, jamais comme validé.

**Contrôle d'acceptation :** un rendez-vous annulé ne figure ni dans la liste du jour, ni dans « Ce mois ».
« Mes RDV » continue de l'afficher, sous son étiquette « Annulé » — c'est là qu'il a sa place.

---

## 2. Le fuseau — un seul défaut, pas deux

La date calculée en UTC et l'heure calculée en local sont **le même motif** : une règle métier laissée à
chaque appelant. On les traite ensemble.

```js
const dt   = new Date(r.scheduled_at);
const date = dt.toISOString().split('T')[0];         // la DATE en UTC
const time = String(dt.getHours()).padStart(2,'0');  // l'HEURE dans le fuseau de la machine
```

### Ce qui est mesuré

- Machine sur Europe/Paris (UTC+2 en été) : un rendez-vous stocké à `09:00Z` vaut **10:00 à Alger** et
  s'affiche **11:00**. Le même rendez-vous s'affiche **10:00 côté patient** et **11:00 côté médecin**.
- Entre minuit et l'heure du décalage UTC, la date bascule à la veille : la bande de semaine affichait
  « lun. 7 … dim. 13 » tandis que chaque cellule appelait `selDay()` sur **le jour précédent**, et l'agenda
  s'ouvrait sur samedi 12 un dimanche 13.
- Sur une machine réglée sur Alger, le décalage d'heure ne se voit pas ; le décalage de date, lui, se voit
  toujours entre 00:00 et 01:00.

### Ce qu'il faut faire

**Le fuseau du cabinet est une règle métier, pas un détail d'affichage.** Il doit vivre dans un utilitaire
partagé, pas dans chaque `getHours()` du dépôt. C'est la même leçon que la garde de disponibilité : une
règle métier a une seule implémentation de référence, et tous les fronts l'appellent.

Consigné dans `docs/ARCHITECTURE_CIBLE.md` **§9 ter**, à côté du §9 bis qui porte la leçon jumelle.

Deux motifs à traquer dans tout le dépôt : `getHours()` sur une date destinée à l'affichage, et
`toISOString().split('T')[0]` sur une date locale.

**Contrôle d'acceptation :** le même rendez-vous affiche la même heure côté patient et côté médecin, quelle
que soit la machine ; et l'agenda ouvert à 00h30 heure d'Alger montre le bon jour.

---

## 3. La navigation de semaine — une fonction manquante, pas un bug

`renderAgenda` reconstruit toujours la semaine de `new Date()`. Il n'existe ni bouton précédent ni bouton
suivant. Un dimanche 13, **lundi 14 n'est pas atteignable à l'écran** : il a fallu appeler
`selDay('2026-09-14')` pour afficher la journée. Un médecin ne peut pas consulter la semaine suivante.

Ce n'est pas un écran qui ment, c'est un écran qui n'a jamais été fini. **Carte produit à part**, à
arbitrer avec le reste du backlog médecin, pas avec les correctifs ci-dessus.

---

## Ordre

1. L'annulé affiché comme honoré. Le plus grave, le plus petit, le premier.
2. Le fuseau, les deux symptômes ensemble, avec l'utilitaire partagé.
3. La navigation de semaine, en carte produit.

Tous **après** le déploiement de la vague.
