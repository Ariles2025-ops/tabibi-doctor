# Correctif — la section des blocages revient dans l'onglet Agenda

Régression trouvée par le parcours 2 de la recette, le 12/09/2026, et jugée bloquante pour la vague.
Détail du diagnostic : `docs/preuves/RECETTE-P2-2026-09-12.md` §2.

## Ce qui a été fait

1. **La section « BLOCAGES EXCEPTIONNELS » retourne dans `#tab-agenda`**, à la place qu'elle occupe sur
   `origin/main` : juste avant `#unavail-modal`, en fin d'onglet. Seule `#schedule-modal` reste en fin de
   document, ce qui est correct : c'est une surcouche en `position:fixed`.
2. **Le commentaire de section est corrigé.** Il affirmait « Section sous l'onglet Agenda » alors qu'elle
   n'y était plus. Il dit maintenant où elle doit être, pourquoi, et rappelle la régression pour éviter
   qu'on la refasse.
3. **Le message d'erreur de la modale passe au-dessus de la liste des sept jours.** Un message qu'il faut
   aller chercher en défilant est un message qui n'existe pas.
4. **Aucun changement de logique.** Aucune condition, aucun appel, aucun identifiant modifié.

### Preuve que le déplacement est pur

Le contenu du bloc déplacé est **identique caractère pour caractère** à celui de `origin/main`
(17 lignes utiles, comparaison après normalisation des espaces). Le seul texte réellement nouveau est
le commentaire d'en-tête. Le diff en ignorant l'indentation ne montre que trois choses : le bloc retiré
en fin de document, le bloc ajouté dans l'onglet, et l'échange de deux lignes dans la modale.

| Repère | Avant (#56) | Après |
|---|---|---|
| `.app-root` | 154 → 1371 | 154 → 1398 |
| `#tab-agenda` | 229 → 285 | 229 → 312 |
| bandeau `#unavail-not-claimed` | **1443**, hors de la coquille | **258**, dans l'onglet Agenda |
| `#schedule-modal` | 1410 → 1428 | 1437 → 1455 |
| `#schedule-modal-msg` | après la liste des jours | **avant** la liste des jours |

Balises équilibrées : 155 `<div>` pour 155 `</div>`.

## Portes de vérification

| Porte | Résultat |
|---|---|
| `npm run i18n:verifier` | 1506 clés, 0 manquante, 0 orpheline, dictionnaires alignés |
| `npm run verifier:cles` | aucun littéral hors `js/config.js`, 369 fichiers examinés |
| `npm run verifier:c1` | OK |
| `npm run lint` | 0 erreur, 129 avertissements (inchangé) |
| `npm run build` | ✓ built in 392ms |

## Preuves au navigateur, sur R2, cache-bustées

Session mesurée avant : `auth.uid()` `75188423-…`, `recette-20260912.medecin-sans-fiche@tabibi.doctor`,
aucune fiche liée.

### 1. Le bandeau est visible dans la coquille, sans écran de vide

`fix-blocages-1-bandeau-dans-onglet-agenda.png`

| Mesure | Valeur |
|---|---|
| bandeau dans `.app-root` | oui |
| bandeau dans `#tab-agenda` | oui |
| classe `hidden` retirée par `loadUnavailSlots()` | oui, `display: flex` |
| largeur rendue | 909 px, dans la colonne |
| hauteur du document | 1122 px, **égale au bas de `.app-root`** |

Ce dernier chiffre est le point : avant le correctif, le document dépassait la coquille et la section
était rendue au-delà, après une hauteur d'écran de vide. Elle est maintenant dans le flux normal de
l'onglet, sous « Blocages exceptionnels », avec le bouton « Bloquer un créneau » grisé comme attendu
pour un médecin sans fiche.

### 2. « Bloquer un créneau » est dans l'onglet Agenda et nulle part ailleurs

| Onglet actif | bandeau rendu | bouton « Bloquer un créneau » rendu |
|---|---|---|
| Aujourd'hui | non | non |
| Agenda | **oui** | **oui** |
| Mes RDV | non | non |

### 3. Le message de la modale est lisible sans défiler

`fix-blocages-2-message-visible-sans-defiler.png`

| Mesure | Avant | Après |
|---|---|---|
| haut du message | y = 1033 | y = **196** |
| bas du message | y = 1094 | y = **256** |
| hauteur de la fenêtre | 690 | 690 |
| visible sans défiler | **non** | **oui** |

Comportement inchangé par ailleurs : `POST /rest/v1/rpc/update_my_doctor_profile` rend toujours
`403 profile_not_found_or_not_claimed`, le texte du message est le même, le lien fonctionne.

### 4. Non-régression de #69

Depuis l'onglet **Aujourd'hui**, le bouton « Mes horaires » ouvre toujours la modale :
`1280×690`, pas `0×0`. `#schedule-modal` est restée seule en fin de document, hors de tout onglet,
ce qui est sa place.

## Ce que ce correctif ne fait pas

Il rétablit le comportement de `main` : l'invitation à réclamer sa fiche vit dans l'onglet Agenda.
Un médecin sans fiche qui reste sur l'onglet « Aujourd'hui » ne la voit toujours pas. C'est le défaut
produit d'origine, pas la régression, et il relève du chantier « écran de revendication »
(`docs/FICHE_REVENDICATION_MEDECIN.md`). Le corriger ici aurait demandé un changement de logique.
