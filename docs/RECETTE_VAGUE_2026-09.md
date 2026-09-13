# Recette de la vague de fusion — go / no-go de déploiement

Cette liste est la **porte de vérification** de la vague. On ne déploie pas tant que les **trois parcours** ci-dessous ne
passent pas, chacun vérifié **à l'écran** ET **en base**. Ce sont les trois parcours prouvés le 12/09/2026 ; ils portent le
produit. Un seul « l'écran ment » qui réapparaît = no-go.

## Règles de recette

- **Cache-bust obligatoire** : chaque page se charge avec un paramètre unique (`?cb=<horodatage>`), sinon un service worker
  ou le cache HTTP peut servir une ancienne version et faire conclure l'inverse de la réalité (règle 8 de CLAUDE.md).
- **Preuve d'interface** : un parcours médecin/patient n'est prouvé que par un passage réel dans l'interface, en session
  connectée, pas par une requête SQL seule.
- **Comptes de test** : recréer trois comptes marqués `RECETTE-<date>` (médecin lié à une fiche, médecin sans fiche, patient),
  purgeables d'un coup par le marqueur (cf. `tests/manual/test-congres/`). Les supprimer après la recette.

### Regle de fusion — « auto-merging » ne veut pas dire « coherent »

`Auto-merging <fichier>` signifie exactement une chose : **git n'a pas trouve de conflit textuel.**
Il ne dit rien de la coherence du resultat. Git compare des lignes ; il ne sait pas qu'un journal se
lit dans l'ordre, qu'une table est datee, ou qu'une section 4 ne se place pas avant une section 3.

**Apres toute fusion qui touche un document structure** — journal de deploiement, fiche de recette,
table de mesures datee, inventaire — relire l'**ORDRE** et la coherence du resultat, pas seulement
l'absence de marqueurs `<<<<<<<`.

Le cas du 13/09/2026. Les PR #96 et #97 touchaient toutes deux
`docs/JOURNAL_DEPLOIEMENTS.md`. Les deux fusions ont affiche `Auto-merging`, sans un seul conflit, et
les sept portes sont passees au vert sur l'arbre fusionne. Le journal se lisait pourtant
**2, 4, 3** : l'insertion du deploiement 4 avait ete ancree avant la section 3, et la fusion a
fidelement conserve cette erreur. Aucun outil ne pouvait la signaler — il n'y avait rien d'anormal a
signaler, au sens de git.

Une deuxieme lecon du meme jour, sur le meme sujet : **ne pas annoncer « 0 conflit » sur la foi d'un
`git merge-tree` a blanc.** Le test avait annonce zero conflit entre trois branches ; la fusion reelle
de #94 en a produit un sur `docs/FICHE_R3_APPELS_DANS_LE_VIDE.md`. Le resultat d'une fusion ne se
connait qu'a la fusion.

En pratique, apres chaque fusion touchant un tel document :

```bash
grep -n "^## " docs/JOURNAL_DEPLOIEMENTS.md      # l'ordre des sections
grep -n "^| [0-9]" docs/JOURNAL_DEPLOIEMENTS.md  # l'ordre des lignes datees
```

et lire. C'est la meme famille de faute que « la console est propre » et que « le test est vert » :
un signal automatique repond a la question qu'on lui a posee, jamais a celle qu'on a oublie de poser.

### Regle generale — un INSTANT et un JOUR CALENDAIRE sont deux TYPES differents

Un rendez-vous a lieu a un **instant**. Des horaires d'ouverture portent sur un **jour calendaire**.
Ce ne sont pas deux facons de dire la meme chose : deux types, deux regles d'affichage opposees.

- Un **instant** (`timestamptz`) se rend **dans le fuseau du CABINET**. Le medecin et le patient
  doivent lire la meme heure, ou qu'ils soient.
- Un **jour calendaire** (`'YYYY-MM-DD'`) se rend **sans aucun fuseau**. Le 16 septembre est le
  16 septembre partout ; lui appliquer un fuseau ne peut que le deplacer.

**Tout bug de fuseau nait a l'endroit ou l'un est converti en l'autre par `new Date()`.**

Les quatre cas, mesures le 13/09/2026 (RDV a 00h30 heure cabinet = `2026-09-15T23:30:00Z`) :

| Cas | Ce que le code fait | Alger | Paris | UTC |
|---|---|---|---|---|
| **1. Instant, sans fuseau** | `toISOString()` pour la date, `getHours()` pour l'heure | mer. 16 · 00:30 | mer. 16 · **01:30** | **mar. 15** · **23:30** |
| **1 bis. Instant, fuseau cabinet** | `tabibiTemps.jourDe` / `heureDe` | mer. 16 · 00:30 | mer. 16 · 00:30 | mer. 16 · 00:30 |
| **2. Jour calendaire `'2026-09-16'`** | formate sans fuseau | mer. 16 | mer. 16 | mer. 16 |
| **3. Date construite en LOCAL pour un jour** | `x.setHours(0,0,0,0)` puis rendu en fuseau cabinet | mer. 16 | **mar. 15** | mer. 16 |
| **4. `new Date(jour+'T'+heure)`** | chaine sans fuseau, parsee en LOCAL | 09:00 | **08:00** | 10:00 |

Le cas 1 est le defaut d'origine : la date sortait en UTC pendant que l'heure sortait en local, et
**les deux se contredisaient**. Le fuseau n'y etait pour rien — c'est le MELANGE.

Les cas 3 et 4 sont le piege inverse, et c'est pour cela que « ajouter un `timeZone` partout » est une
mauvaise reponse : poser le fuseau du cabinet sur une valeur qui n'est PAS un instant la casse. Le
cas 4 est le plus grave : quand son resultat est ecrit en base, ce n'est plus un defaut d'affichage,
c'est **une donnee fausse**.

En pratique, `js/tabibi-temps.js` :

```js
tabibiTemps.jourDe(instant)    // 'YYYY-MM-DD' du CABINET — remplace toISOString().split('T')[0]
tabibiTemps.heureDe(instant)   // 'HH:MM' du CABINET      — remplace getHours()/getMinutes()
tabibiTemps.instant(v, opts)   // un instant, fuseau cabinet
tabibiTemps.jourCalendaire(s)  // un jour, AUCUN fuseau, jamais de new Date()
tabibiTemps.ajouterJours(s, n) // arithmetique sans derive
tabibiTemps.instantDepuisJourEtHeure(jour, heure)  // heure murale cabinet -> instant UTC
```

Le fuseau du cabinet est **une constante nommee**, a un seul endroit. On ne code pas « +1 » : le jour
du deuxieme pays, elle devient une colonne de `doctor_profiles`. **Et il faudra alors corriger DEUX
couches** — la meme regle vit en SQL, ou `'Africa/Algiers'` est ecrit en dur dans
`get_available_slots`, la garde de disponibilite et le trigger de notifications.

Les deux gardes : `npm run lint:dette` (`no-restricted-syntax`, plafond **3**) pour `js/src/scripts`,
et `npm run verifier:fuseau` pour le JS inline des pages HTML — **invisible a eslint**, et c'est la
que vivaient 105 des 134 lectures d'horloge du 13/09.

### Pourquoi la garde doit etre a l'ECRITURE, pas a la lecture

**Un instant faux ecrit en base est indiscernable d'un instant juste.** `2026-09-14T08:00:00+00` est
une valeur parfaitement valide. Rien, dans la colonne, ne dit si elle vient d'un patient qui a
choisi 09:00 heure cabinet ou d'un navigateur parisien qui croyait ecrire 09:00. **Aucun audit
posterieur ne peut les separer** — il n'y a pas de trace de l'intention, seulement le resultat.

Le 13/09/2026, `secretaire-dashboard.html:437` faisait
`new Date(date + "T" + time + ":00").toISOString()`. Depuis Paris, un rendez-vous saisi a 09:00
partait a `07:00Z`, soit **08:00 heure cabinet**. Une heure d'ecart, silencieuse, definitive.

Nous avons eu de la chance : la table ne contenait **qu'une seule ligne**,
`2026-09-14 08:00:00+00`, soit 09:00 pile heure cabinet, minutes a `00`, creee par le parcours
patient. Rien a rattraper.

**Si la table avait contenu six mois de rendez-vous, cette ligne aurait produit des degats
irreparables et invisibles.** Pas un ecran a corriger : des milliers de rendez-vous decales d'une
heure, sans moyen de savoir lesquels.

C'est pour cela que la garde vit **au point d'ecriture** :

- `tabibiTemps.instantDepuisJourEtHeure(jour, heure)` est le SEUL chemin autorise pour transformer
  une heure murale saisie en instant. Il calcule le decalage du fuseau du cabinet a la date visee,
  au lieu de laisser `new Date()` appliquer celui du navigateur.
- `scripts/verifier-fuseau.mjs` attrape `new Date(<chaine sans fuseau>)` **avant** qu'il n'atteigne
  la base, pas apres.

La regle qui en decoule, generale : **un defaut d'affichage se corrige un jour ; un defaut
d'ecriture se corrige jamais.** Quand les deux existent, on commence par l'ecriture.

La preuve : `npx playwright test tests/e2e/fuseau-cabinet.spec.js` — le meme rendez-vous a 00h30 lu
depuis Alger, Paris et UTC, plus les trois cas de non-regression.

### Regle generale — une assertion visuelle porte sur le STYLE CALCULE

**Jamais sur la classe.** Une classe est une intention ; le style calcule est ce que l'oeil recoit.
Entre les deux il y a la cascade, les valeurs par defaut, et les regles qu'on a oublie d'ecrire.

Le 13/09/2026, le tableau de bord medecin affichait les bons badges — « Annule » en rouge, « Statut
inconnu » en gris — et **les quatre cartes gardaient une bordure gauche verte**, parce que
`.appt-card` avait `border-left:4px solid var(--green)` en base et que rien ne surchargeait cette
valeur pour un annule. Les assertions sur les badges passaient toutes. Seule la capture l'a montre.

C'est **exactement la meme faute** que « la console est propre » sur un bouton qui ment : on mesure
ce qui repond, pas ce qui trompe.

```js
// NON — teste l'intention
await expect(carte).toHaveClass(/cancelled/);

// OUI — teste ce que l'oeil recoit
const couleurs = await liste.locator('.appt-card').evaluateAll(
  (els) => els.map((e) => getComputedStyle(e).borderLeftColor));
expect(couleurs.filter(estVert).length).toBeLessThanOrEqual(1);
```

Deux corollaires :

1. **Regarder la capture, pas seulement le vert du test.** Une assertion ne voit que ce qu'on lui a
   demande de voir. Un defaut de valeur par defaut n'est jamais dans la liste.
2. **Verifier que l'ecran teste est l'ecran servi.** Le meme jour, des assertions portaient sur
   `#rdv-list` de `patient-dashboard.html` — du DOM mort, neutralise depuis la phase 5.2.5, dont
   l'onglet redirige vers `mes-rdv.html`. Elles passaient, sur un ecran que personne ne voit.

### Portes locales — la liste complète, dans cet ordre

Avant de pousser quoi que ce soit, et avant d'annoncer « portes vertes », **les sept** doivent passer. Aucune
n'est facultative, et `lint` ne remplace **pas** `lint:dette`.

| # | Commande | Ce qu'elle attrape | Échoue si |
|---|---|---|---|
| 1 | `npx eslint js src scripts --quiet` | erreurs de parsing, `no-undef` | une seule erreur |
| 2 | **`npm run lint:dette`** | **la dette mesurée dépasse le plafond versionné** | **un compteur passe au-dessus** |
| 3 | `npm run i18n:verifier` | clés manquantes ou orphelines dans fr/ar/en | désalignement |
| 4 | `npm run verifier:cles` | littéral de clé hors `js/config.js` | une occurrence |
| 5 | `npm run verifier:c1` | accès direct à la vue `public_doctors` | un appelant |
| 6 bis | `npm run verifier:fuseau` | une lecture d'horloge locale sur une date de rendez-vous | le compte depasse le plafond |
| 6 | `npm run verifier:statuts` | un statut de rendez-vous declare d'un cote et pas de l'autre | un ecart, dans un sens ou l'autre |
| 7 | `npm run build` puis `npm run test:e2e` | les parcours critiques, sources et sortie de build | un test rouge |

La porte 6 est l'etage **structurel** : elle compare `js/tabibi-statut-rdv.js` a
`supabase/enums/appointment_status.txt`, sans secret et sans reseau. Elle ne voit **pas** un
`ALTER TYPE` fait en base — cela, c'est `node scripts/verifier-statuts.mjs --base`, **etape
obligatoire de la procedure de deploiement manuelle**, pas une porte locale.

> **Pourquoi la ligne 2 est en gras.** Le 12/09/2026, une PR a été annoncée « portes vertes » puis a fait rougir
> la CI. `npm run lint` avait été lancé, pas `npm run lint:dette`. Or `lint` compte 129 avertissements et ne
> renvoie jamais d'erreur : il ne peut pas échouer. `lint:dette` compare à un plafond versionné dans
> `scripts/compter-dette.mjs` et c'est lui, et lui seul, qui bloque. La cause réelle était une fonction morte
> laissée par #74, `getTakenSlots`, qui poussait `no-unused-vars` de 43 à 44.
> **Lancer `lint` et croire avoir tout couvert est précisément l'erreur que cette liste doit empêcher.**

Ces six portes sont celles du job `verifier` de `.github/workflows/verification.yml`. Le second job,
`verifier-v2`, couvre l'application React de `v2/` avec sa propre chaîne d'outils : typage strict, tests, build.

---

## Étape 0 — Remise à zéro de la fixture. **Avant le parcours 1, pas pendant.**

**Cette étape est obligatoire et vient en premier.** Le 13/09/2026 elle a été traitée comme une
vérification en cours de route : on a démarré le parcours 1, constaté que deux rendez-vous de test
traînaient encore, puis remis à zéro. Un aller-retour perdu, et un compteur qu'on a d'abord soupçonné
d'être faux alors qu'il disait la vérité sur une base sale.

Avant de demander la moindre connexion, remettre la fixture dans l'état que décrivent les préconditions
ci-dessous, et le **prouver par un contrôle**, pas par une intention.

| # | Action | Contrôle attendu |
|---|---|---|
| 0.1 | Supprimer les rendez-vous de test, bornés au marqueur `RECETTE-<date>` | le `DELETE` rend **exactement** le nombre de lignes attendu, ni plus ni moins |
| 0.2 | Vérifier la fiche du médecin de test | `working_hours` conforme : lun/mar/jeu matin **et** après-midi, mer/sam matin, ven/dim fermés |
| 0.3 | Compter les créneaux du lundi visé | **12** créneaux de 30 min |
| 0.4 | Compter les rendez-vous sur la fiche | **0** |

Tant que ces quatre lignes ne sont pas vraies, **ne pas commencer**. Un parcours joué sur une fixture
sale ne prouve rien : on ne sait plus si un écart vient du code ou des données.

**Corollaire à garder en tête.** Certains défauts ne sont visibles que sur une fixture *sale*. Le
compteur « Ce mois » qui additionne les rendez-vous annulés affiche 0 sur une base propre, en accord
avec elle : il paraît correct. Il ne ment que lorsqu'un annulé existe. Une fixture propre est
nécessaire pour lire les parcours, elle ne suffit pas pour trouver ce genre de défaut.

---

## Parcours 1 — Médecin AVEC fiche liée

Précondition : un compte médecin dont `doctor_profiles.user_id = auth.uid()`, fiche `is_claimed=true`,
`validation_status='approved'`, `working_hours` renseigné (lun/mar/jeu matin **et** après-midi, mer/sam matin, ven/dim fermés).

| # | Action | À l'écran (attendu) | En base (attendu) |
|---|---|---|---|
| 1 | Se connecter, ouvrir le tableau de bord | Le bandeau affiche le **nom** du médecin (pas « Bienvenue » nu) | `public.users.first_name` non nul, ou `doctor_profiles.full_name` |
| 2 | Onglet « Aujourd'hui », cliquer « Mes horaires » | La modale s'ouvre (elle ne doit **pas** être 0×0 : `#schedule-modal` est sous `<body>`) | — |
| 3 | Lire les plages | Lundi/mardi/jeudi affichent **matin ET après-midi** ; la 2ᵉ plage n'est pas perdue | `working_hours` identique jour par jour |
| 4 | Modifier une plage, « Enregistrer mes horaires » | Toast **« Horaires enregistrés »** ; RPC `update_my_doctor_profile` → **200** | `working_hours` reflète le changement, `updated_at` avance |
| 5 | Rouvrir la modale | La valeur modifiée est relue depuis la base | idem base |

**Verdict attendu : cohérent.** Faux succès à surveiller : un toast de succès sans écriture réelle en base (défaut historique
« Créneaux ajoutés ! » en localStorage).

---

## Parcours 2 — Médecin SANS fiche liée

Précondition : un compte médecin sans `doctor_profiles` (`get_my_doctor_profile()` → null).

| # | Action | À l'écran (attendu **aujourd'hui**) | En base (attendu) |
|---|---|---|---|
| 1 | Se connecter, ouvrir le tableau de bord | Tableau de bord médecin complet, compteurs à 0 | `select doctor_profiles where user_id=auth.uid()` → **0 ligne** |
| 2 | Cliquer « Mes horaires » | La modale s'ouvre, **pré-remplie d'horaires par défaut** (08:00–12:00 / 14:00–17:00) | — |
| 3 | « Enregistrer mes horaires » | Message **honnête** : « Réclamez votre fiche dans l'annuaire… » ; RPC → **403** | aucune écriture |

**Verdict attendu : l'écriture est honnête (403 + message), mais le tableau de bord ment par omission.**
Le jour où l'écran de revendication existe, ce parcours devra montrer, à l'étape 1, une invitation à réclamer sa fiche
à la place de l'agenda vide.

> **Requalification du 12/09, mesurée (`docs/preuves/RECETTE-P2-2026-09-12.md`).** Le constat « il n'existe pas de tunnel
> de revendication » est faux. Le tunnel existe (`doctor-claim.html`), le bandeau d'invitation existe dans le tableau de
> bord, et `loadUnavailSlots()` le démasque correctement pour un médecin sans fiche. Le problème est un **placement** :
> #69 a sorti la section « BLOCAGES EXCEPTIONNELS » de `#tab-agenda` en même temps que la modale, et l'a laissée **après**
> la fermeture de `.app-root` (ligne 1443 contre une coquille qui se ferme ligne 1371). Elle est donc rendue hors de la
> colonne de l'application, sous une hauteur d'écran entière, invisible en pratique. Sur `main` elle est bien à la ligne
> 272, dans l'onglet Agenda. **C'est une régression de la vague, et elle est bloquante** : le correctif est de remettre
> le bloc dans `#tab-agenda` et de n'y laisser que `#schedule-modal` en fin de document.
> Défaut secondaire du même parcours : le message de refus de la modale s'affiche 343 px sous le pli.

---

## Parcours 3 — Patient réserve puis annule

Précondition : un compte patient, et la fiche de test du parcours 1 visible dans `public_doctors`.
La garde de disponibilité (trigger `enforce_appointment_availability`) doit être **appliquée en base**.

### 3a. Réservation (par la fiche → `reservation.html`, PAS le quick-book de l'accueil)

| # | Action | À l'écran (attendu) | En base (attendu) |
|---|---|---|---|
| 1 | Rechercher le médecin, ouvrir sa fiche, « Réserver » | Arrivée sur `reservation.html` avec un **calendrier réel** | — |
| 2 | Choisir un lundi, lire les créneaux | Exactement les créneaux de `working_hours` (RPC `get_available_slots` → 200) | `get_available_slots(fiche, lundi)` = ces créneaux |
| 3 | Choisir 09:00, motif, confirmer | **« RDV confirmé ! »**, date et heure = ce qui a été choisi (pas de décalage d'1 h) | `appointments` : `patient_id`=patient, `doctor_id`=**fiche**, `starts_at`=09:00 Alger, `status='pending'` |

Effets de bord à vérifier :

| Effet | À l'écran | En base |
|---|---|---|
| Créneau consommé | 09:00 disparaît des créneaux | `get_available_slots(lundi)` passe de N à N−1, 09:00 absent |
| Notification médecin | — | `notifications` : 1 ligne `rdv_new` pour le compte médecin |
| Côté patient | « Mes RDV » liste le RDV, statut « En attente » | idem |

### 3b. Garde de disponibilité (négatif)

| Action | À l'écran (attendu) | En base (attendu) |
|---|---|---|
| Tenter de réserver un dimanche fermé ou une heure hors plage (auto-réservation patient) | Toast **« Ce créneau n'est plus disponible… »**, retour à l'étape 1, créneaux rafraîchis | insert **refusé** (`slot_unavailable`, 23514) ; aucune ligne créée |
| Deux réservations qui se chevauchent | Toast **« Ce créneau vient d'être pris… »** | 2ᵉ insert **refusé** (`23P01`, contrainte EXCLUDE) |

### 3c. Annulation depuis l'espace patient

| # | Action | À l'écran (attendu) | En base (attendu) |
|---|---|---|---|
| 1 | « Mes RDV » → « Annuler ce RDV » (RDV à plus de 24 h) | Modale de confirmation, puis le RDV passe dans « Annulés » | — |
| 2 | Confirmer | `PATCH appointments` → **200** | `status='cancelled'`, `cancelled_at` renseigné, `cancelled_by_user_id`=patient |
| 3 | — | Le créneau redevient réservable | `get_available_slots(lundi)` repasse de N−1 à N, 09:00 de nouveau présent |

**Verdict attendu : cohérent** sur toute la chaîne réserver → garde → annuler.

---

## Parcours permanent — aucun bouton n'annonce ce qu'il ne fait pas

**A derouler a chaque vague, avant le deploiement.** Ce controle manquait a la liste de verification
et l'a laissee passer **deux fois** : une console propre ne detecte pas un bouton qui ment. Le bouton
s'execute sans erreur — c'est precisement le probleme. Il affiche une phrase, ne fait rien, et rien
dans les journaux ne le signale.

### La mesure — deux fois : sur le build, puis sur le domaine reel

Sur la sortie de build, pas sur les sources — c'est ce qui part en ligne qui compte :

```bash
npm run build
grep -rnE 'onclick="[^"]*(alert|confirm)\(' dist-web/*.html dist-web/legal/*.html
```

**Puis apres deploiement, sur le domaine reel, avec cache-bust.** La production reecrit le HTML servi
(cf. `DEPLOY_FRONTEND.md`, « Reglages cote hebergeur qui reecrivent le HTML servi ») : ce qui est
construit n'est pas mot pour mot ce qui est lu.

```bash
CB=$(date +%s)
for p in index accueil-public login signup reservation mes-rdv about telecharger \
         patient-profile patient-dashboard patient-ordonnances \
         doctor-profile doctor-dashboard medecin-profile \
         admin-dashboard secretaire-dashboard agenda-cabinet notifications messages dawini; do
  u="https://tabibi.doctor/$p?cb=$CB"; [ "$p" = "index" ] && u="https://tabibi.doctor/?cb=$CB"
  n=$(curl -sL "$u" | grep -o 'onclick="[^"]*\(alert\|confirm\)(' | wc -l | tr -d ' ')
  [ "$n" != "0" ] && printf "%-22s %s\n" "$p" "$n"
done
```

Attendu au 13/09/2026 apres le deploiement 4 : `patient-profile` 1, `doctor-dashboard` 3, zero
partout ailleurs. **Quatre au total, tous honnetes.**

### Le meme controle sur les copies mobiles

`ios/App/App/public/` et `android/app/src/main/assets/public/` ne sont pas versionnes
(`ios/.gitignore:4`, `android/.gitignore:96`) : ce sont des sorties de `scripts/build-mobile.sh`. Les
regenerer et mesurer, sinon le prochain APK repart avec les boutons corriges nulle part.

```bash
bash scripts/build-mobile.sh
```

Le total y est **plus petit** que sur `dist-web`, et c'est normal : `admin-*.html` et
`doctor-dashboard.html` sont exclus du bundle mobile par un garde-fou qui fait echouer le build s'ils
y reapparaissent (`scripts/build-mobile.sh:107`). Comparer sur le **perimetre commun** — les pages
presentes dans le bundle mobile — pas sur les totaux bruts.

### Le tri, bouton par bouton

Chaque resultat tombe dans une des trois cases. Il n'y a pas de quatrieme case.

| Case | Definition | Ce qu'on en fait |
|---|---|---|
| **Honnete** | affiche de vraies donnees, ou annonce franchement une absence (« Bientot disponible ») | rien |
| **Menteur** | affirme une action accomplie ou en cours qui n'a pas lieu — surtout au **passe compose** (« Backup cree », « Demande envoyee ») | desactiver avec un libelle vrai, ou supprimer |
| **Mort** | ne ment pas mais ne fait rien non plus (renvoie son propre libelle, popup vide) | supprimer |

Trois questions qui tranchent vite :

1. **Le verbe est-il au passe ?** « Cree », « envoyee », « copie » affirment un fait accompli. C'est
   la formulation la plus dangereuse : l'utilisateur cesse de chercher.
2. **Un droit legal est-il en jeu ?** Un faux « Demande envoyee — reponse sous 30 jours (RGPD) » fait
   croire au patient qu'il a exerce un droit. Le delai ne court pas, personne n'est saisi.
3. **Le repli est-il le cas normal ?** `navigator.share ? … : alert('Lien copie')` : sur ordinateur
   `navigator.share` n'existe pas, donc le repli **est** le comportement par defaut, pas un cas rare.

### Ce que la porte de sortie doit porter

Un bouton desactive n'est une correction que s'il indique **ou aller**. Sinon on n'a pas corrige le
defaut, on l'a rendu silencieux — et c'est pire. La note visible, sous le bouton et pas dans un
attribut `title` (survol seulement, invisible au doigt), doit donner :

- l'adresse de contact,
- **le telephone en clair** — `mailto:` est reecrit par l'hebergeur, cf. `DEPLOY_FRONTEND.md`,
  section « Reglages cote hebergeur qui reecrivent le HTML servi » ; sans JS le lecteur voit
  `[email protected]`,
- le renvoi vers `legal/rgpd-droits.html`, qui porte la procedure et les delais.

### Verdict

**No-go** s'il reste un seul bouton actif qui annonce une action accomplie. Le compte attendu, releve
le 13/09/2026 : onze `onclick` `alert`/`confirm` au total, dont **zero menteur actif**.

---

## Parcours 4 — LA FIXTURE SALE (permanent)

**A derouler a chaque vague.** Une base propre cache le defaut : c'est pour ca que « le rendez-vous
annule affiche comme honore et compte » a survecu a la recette de septembre. Un seul rendez-vous en
base, annule, et aucun ecran ne montrait le probleme.

La fixture contient donc ce qu'une vraie base finira par contenir :

| Ligne | Statut | Attendu |
|---|---|---|
| A. Honore | `completed` | **compte** dans « Consultations du mois », badge vert |
| B. Annule | `cancelled` | visible **comme annule**, hors de tous les totaux |
| C. Absent | `no_show` | compte dans « Absents » **seulement**, jamais en consultations |
| D. Invente | valeur hors enum | **neutre**, libelle « Statut inconnu », aucune action, hors de tous les totaux |

**Si l'annule ou l'invente ressort vert, c'est rate.**

### Comment la derouler

```bash
npx playwright test tests/e2e/parcours-4-fixture-sale.spec.js --project=desktop
```

Le test n'ecrit rien en base et ne cree aucun compte : il coupe le reseau vers Supabase, sert un
bouchon a la place de `js/auth.js` et injecte la fixture la ou arriveraient les vraies lignes.
Captures produites dans `docs/preuves/parcours4-*.png`.

### Ce qu'il faut regarder, et pas seulement asserter

Le 13/09/2026, les assertions sur les badges passaient **alors que la bordure gauche des quatre
cartes restait verte** : `.appt-card` avait `border-left:4px solid var(--green)` en base, donc
l'annule et l'inconnu en heritaient. Seule la capture l'a montre. Deux lecons :

1. **Regarder la capture, pas seulement le vert du test.** Un defaut de couleur par defaut ne se
   voit pas dans une assertion qui ne l'interroge pas.
2. **Mesurer la couleur CALCULEE**, pas la classe. Le test le fait desormais sur `borderLeftColor`.

Autre piege du meme jour : les assertions patient portaient sur `#rdv-list` de
`patient-dashboard.html`, **du DOM mort** — le panneau `#tab-rdv` est neutralise depuis la phase
5.2.5 et son onglet redirige vers `mes-rdv.html`. Verifier que l'ecran teste est bien l'ecran servi.

### La garde qui empeche la rechute

`appointment_status` est un ENUM Postgres. Le jour ou quelqu'un fait un `ALTER TYPE ... ADD VALUE`
sans declarer la valeur dans `js/tabibi-statut-rdv.js`, tous les ecrans retombent sur « Statut
inconnu » — repli sur, mais pas un etat acceptable.

```bash
npm run verifier:statuts              # structurel, aucun secret
node scripts/verifier-statuts.mjs --base   # contre l'enum reel (exige SUPABASE_ACCESS_TOKEN)
```

Le mode structurel ne voit PAS un `ALTER TYPE` fait en base : c'est le mode `--base` qui l'attrape.
Les deux doivent tourner, a des moments differents. Voir la decision de branchement au journal.

---

## Décision

- **Go** si les parcours 1 et 3 sont « cohérent » de bout en bout, et si le parcours 2 se comporte comme l'état connu
  (écriture honnête en 403), sans nouveau faux succès.
- **No-go** si un toast de succès n'a pas d'écriture en base, si un RDV se crée hors disponibilité, si un décalage horaire
  réapparaît, ou si la garde/EXCLUDE ne refuse plus les cas négatifs.

Après la recette : purger les comptes marqués `RECETTE-<date>` par le marqueur, comme pour `TEST-CONGRES-20260910`.
