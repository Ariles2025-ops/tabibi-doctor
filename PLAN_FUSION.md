# Plan de fusion — arriver à « main est la vérité, déployée, rien en suspens »

> Écrit le 12 septembre 2026 à partir de l'état réel : dépôt (`git merge-tree`, `git rev-list`), pages
> GitHub des PR, empreintes des fichiers servis par `tabibi.doctor`, liste des déploiements Cloudflare.
> Aucune échéance. Aucun merge et aucun correctif nouveau dans ce document : c'est l'ordre des gestes.
> Règles : aucun merge sans accord explicite d'Aghiles ; une preuve par étape ; arrêt si quelque chose
> de plus grave apparaît.

## 1. Inventaire des PR ouvertes

20 PR ouvertes, 49 fermées. Le workflow de vérification ne se déclenche que sur les PR **vers `main`**
(`verification.yml`, `on.pull_request.branches: [main]`) : les PR empilées sur la branche d'intégration
n'ont **aucun run CI** ; leur seule vérification a été locale (lint, dette, i18n, Playwright 30/30).
Leur porte de contrôle réelle est le CI de #56, qui se relance à chaque merge dans sa branche.
Les statuts « failure » affichés par GitHub sur les 14 PR récentes viennent tous du bot Vercel
(déploiements bloqués : e-mail de commit non relié au compte Vercel), pas du code.

### Les 16 PR du chantier (#56 → #71)

| PR | Branche → base | Contenu | CI | Conflits | Dépend de | Migration liée |
|---|---|---|---|---|---|---|
| #56 | `fix/p0-securite-chaine-approvisionnement` → `main` | branche d'intégration, 28 commits, 177 fichiers : supabase-js vendorisé, Vite 8 (10 pages), ESLint + cliquet, Playwright, i18n par langue, gitleaks, README, v2 React, APK 1.0.2, `_headers`/`netlify.toml`, flags corrigés, batch a11y/sécurité | **vert** (Actions), Vercel bloqué | aucun avec `main` | rien | aucune |
| #57 | `fix/c1-enumeration` → #56 | C1 : 6 RPC bornées + front migré (9 appelants), `verifier-c1`, SQL scindé 1A (additif) / 1B (revoke) | pas de run (base ≠ main) ; local vert sauf le test accueil qui tombe tant que 1A n'est pas jouée | aucun | #56 mergée, **1A exécutée avant merge** | **1A avant merge (Aghiles)**, **1B après déploiement du front + décision APK** |
| #58 | `fix/rappels-cron-garde-fous` → `main` | cron des rappels : SQL Vault + `ops_heartbeat`/`ops_alertes`/`ops_sante` + garde outbox ; edge `RUN_MAX = 60`, RDV passés ignorés | Actions vert (4 checks), Vercel ×2 rouge | aucun avec `main` ni avec #56/#67 | rien en code ; touche `appointment-reminders/index.ts` comme #67 (lignes différentes) | bloc 0 Vault (Aghiles, valeur collée), edge déployée **avant** bloc 2, blocs 1–4 (Aghiles) |
| #59 | `docs/readme-app` → #56 | `README_APP.md` (état vérifié) + corrections successives | pas de run | aucun | #56 | aucune |
| #60 | `docs/architecture-cible` → #56 | `docs/ARCHITECTURE_CIBLE.md` (6 briques, §8 sauvegardes, staging) | pas de run | aucun | #56 | aucune |
| #61 | `fix/r1-gardes-pages` → #56 | R1 : `requireAuth` sur `mes-rdv`, `payment`, `admin-cabinet`, `secretaire-dashboard` ; tableau des 47 pages | pas de run ; local vert ; preuve : rejeu sans session | aucun | #56 | aucune |
| #62 | `fix/r2-indisponibilites-anon` → #56 | R2 : SQL présenté (policies propriétaire/admin, revoke anon) ; preuve avant/après en transaction annulée | pas de run (SQL seul) | aucun | rien | **à exécuter (Aghiles)**, indépendante, sans effet de bord |
| #63 | `docs/fiche-revendication` → #56 | fiche du claim : policies, simulation, tableau de bord sans fiche, récupération de mot de passe | pas de run | aucun | #56 | aucune |
| #64 | `fix/claim-revendication` → #56 | SQL présenté : trigger + `claim_my_doctor_profile` (prise de contrôle fermée), bloc TRUNCATE ; `docs/INVENTAIRE_PRIVILEGES` | pas de run (SQL + doc) | aucun | rien | **à exécuter (Aghiles)** avant tout test réel du claim |
| #65 | `docs/test-chaine-reelle` → #56 | procédure du test réel + `creation/verification/nettoyage.sql` + purge des 7 comptes de test | pas de run | aucun | #56 ; le test lui-même dépend de #58, #64, #67 | `nettoyage.sql` après le test (Aghiles) ; purge des comptes (Aghiles) |
| #66 | `docs/claude-regle-secrets` → #56 | règle 6 de CLAUDE.md (aucune sortie contenant un secret) | pas de run | aucun | #56 | aucune |
| #67 | `fix/rotation-cles` → #56 | rotation : clé publiable dans les 2 configs, 8 copies en dur retirées, `.bak`/`.comingsoon` supprimés, edge sur `TABIBI_SECRET_KEY`, `verifier:cles` en CI | pas de run ; local vert ; **edge déjà déployées (v17/v4/v7)** | aucun | #56 ; secret `TABIBI_SECRET_KEY` posé (fait) | aucune ; **révocation HS256 après déploiement du front + APK** |
| #68 | `docs/a-faire-facture-supabase` → #56 | en-tête d'`A_FAIRE_AGHILES.md` : factures impayées | pas de run | aucun | #56 | aucune |
| #69 | `fix/medecin-1-faux-succes` → #56 | « Mes horaires » écrit en base, « Ajouter créneaux »/`doctor-reservation` retirés ; revue à cinq axes : 3 « requis » à traiter avant merge | pas de run ; local vert ; **preuve d'interface en attente** | aucun | #56 ; les 3 points de la revue | aucune |
| #70 | `docs/plan-fusion` → #56 | ce plan | pas de run | aucun | #56 | aucune |
| #71 | `fix/grants-liste-blanche` → **`main`** (à recibler sur #56, ou à fusionner après l'étape 9) | GRANTS par liste blanche : migration **appliquée le 12/09**, `grants-liste-blanche.json`, `verifier:grants`, preuves avant/après | Actions vert (base main) ; Netlify preview 71 | aucun | #56 (arbre) | `20260912_grants_liste_blanche.sql` — **exécutée** |

`git merge-tree` : **aucun conflit** entre aucune paire de ces branches, ni avec `main`.

### Les 6 PR anciennes encore ouvertes

| PR | Contenu | Écart avec `main` | Décision proposée |
|---|---|---|---|
| #2 | audit Playwright + rapports (mai 2026), 46 fichiers, base vieille de 4 mois | 4 commits, base `b7a809b` | **fermer** : dépassé par #56 (Playwright installé et câblé en CI) et par `README_APP` |
| #13 | vue semaine planning cabinet (desktop), 1 fichier, juillet | 1 commit | **fermer** : `agenda-cabinet.html` existe sur `main` avec une grille semaine ; à rouvrir sur la base actuelle si le besoin revient |
| #49 | doc : correction de l'audit keystore | 1 commit, 2 fichiers | **fermer** : la vérité keystore est dans `README_APP` et l'inventaire du 10/09 |
| #50 | page « Coming Soon » | 1 commit | **fermer** : livrée par #51 puis remplacée par #55 (accueil réactivé) ; contenu mort |
| #53 | liens de parrainage médecins `/a/<CODE>` | fonctionnalité | **fermer avec note « à reprendre après stabilisation »** : une fonctionnalité nouvelle n'a pas sa place tant que le parcours médecin de base casse |
| #54 | outil local de personnalisation des messages de démarchage | fonctionnalité | **fermer avec la même note** |

## 1 bis. Addendum du 12/09 — PR créées après le plan, et fusion de #73 hors séquence

Trois PR sont nées après l'écriture de ce plan, et une a été fusionnée hors de la séquence de l'étape 7.

| PR | Branche → base | Contenu | Statut |
|---|---|---|---|
| #72 | `fix/rgpd-suppression-compte` → `main` | suppression de compte par canal humain réel, retrait des faux succès (`legal/rgpd-droits.html`, `medecin-profile.html`, note avocat) | ouverte, indépendante, off `main` |
| **#73** | `fix/garde-disponibilite-base` → `main` | **garde de disponibilité en base** (trigger `enforce_appointment_availability` **v2** : n'enforce que l'auto-réservation patient) + migration `20260912_garde_disponibilite_rdv.sql` | **FUSIONNÉE dans `main` le 12/09, HORS séquence** |
| #74 | `fix/home-quickbook-vers-reservation` → #56 | l'accueil réserve via `reservation.html` (get_available_slots), plus de grille codée en dur ni de décalage horaire | ouverte, base #56 |

**Pourquoi la fusion de #73 hors séquence ne perturbe pas la pile.** #73 partait de `main` (pas de #56), et ne touche que
du SQL et de la doc : la migration `supabase/migrations/20260912_garde_disponibilite_rdv.sql` et rien d'autre. Aucun fichier
partagé avec #56 ni avec les branches de la pile. `git merge-tree` : aucun conflit. La séquence de merges de l'étape 7 (les
PR du chantier vers #56, puis #56 vers `main`) reste valable telle quelle.

**Deux précisions qui doivent rester vraies dans le plan :**
1. **Fusionner n'applique rien en base.** La migration de #73 est dans l'historique de `main`, mais le trigger n'existe pas
   encore dans la base (vérifié le 12/09 : `pg_trigger` ne contient pas `trg_appointments_zz_enforce_availability`).
   L'application est un `begin … commit` à coller par Aghiles dans l'éditeur Supabase, à part.
2. **La version sur `main` est la v2** (`auth.uid() is distinct from new.patient_id → return new`), pas la v1 qui bloquait
   aussi le médecin. À l'application, le contrôle est : trigger présent (1), fonctions `enforce_appointment_availability` et
   `appointment_slot_is_available` présentes (2). Le cas « médecin cale une urgence » n'est pas testable en conditions réelles
   tant que le parcours médecin n'existe pas en RLS (aucune policy d'INSERT n'autorise `patient_id <> auth.uid()` — trou
   produit noté dans `VERIF_NAVIGATEUR.md`).
3. **La garde est en base depuis le 12/09 au soir — appliquée par Aghiles dans l'éditeur SQL.**
   Mesure de contrôle : `appointment_slot_is_available(uuid, timestamptz, timestamptz)` = 1,
   `enforce_appointment_availability()` = 1 en `SECURITY DEFINER`, trigger
   `trg_appointments_zz_enforce_availability` posé et **actif**, et la ligne v2
   `auth.uid() is distinct from new.patient_id` bien présente dans le corps de la fonction.
   L'ordre de déclenchement est correct : sur les dix triggers de `public.appointments`, le suffixe `zz`
   place la garde **après** `trg_appointments_sync_slot_times`, donc elle voit les heures déjà synchronisées.
   L'étape 3b de `docs/RECETTE_VAGUE_2026-09.md` (cas négatifs) est donc jouable.
   *Correction d'une mesure antérieure : à 18:41 le même contrôle rendait 0 partout et j'en avais conclu que
   la migration n'avait pas pris. Elle a été appliquée après cette mesure. La leçon du §1 ter tient quand même :
   c'est le catalogue qui fait foi, et il faut le relire au moment où on s'en sert, pas se fier à une lecture ancienne.*

## 1 ter. Règle du 12/09 — le SQL d'une PR s'applique **avant ou avec** son front, jamais après

**La règle.** Une PR qui contient à la fois du SQL et du front n'est pas « fusionnée » quand sa branche est fusionnée.
Elle est fusionnée quand sa migration est appliquée en base **et** que son front est en ligne, dans cet ordre.
Fusionner le front seul met le produit dans un état où l'écran appelle un objet qui n'existe pas.

**Le cas qui l'a enseignée : #57.** Sa branche portait `20260909_c1a_rpc_praticiens.sql` (six RPC :
`chercher_praticiens`, `praticien`, `praticiens_par_ids`, `praticiens_carte`, `stats_publiques`, `seo_couples`)
et le front qui les appelle. La branche a été fusionnée dans #56 le 12/09 ; la migration, elle, ne l'était pas.
Résultat mesuré sur `localhost:8080` servant #56 : `POST /rest/v1/rpc/chercher_praticiens` → **404 PGRST202**,
la recherche publique de praticiens ne rendait plus rien. La production n'était pas touchée : elle servait
encore l'ancien code, qui lisait la vue `public_doctors` directement. Le défaut n'existait que sur la vague.
1A a été appliquée le 12/09 ; après application, `stats_publiques` rend 200 et `chercher_praticiens`
avec un filtre wilaya rend des lignes réelles.

**Ce qu'on fait à chaque fusion, désormais.**
1. Avant de fusionner une branche, lister ses fichiers sous `supabase/migrations/`.
2. Pour chaque migration, vérifier en base que ses objets existent (fonction, trigger, policy, privilège) —
   la présence du fichier dans le dépôt ne prouve rien, seule la base fait foi.
3. Si un objet manque : appliquer la migration **d'abord**, prouver l'objet, puis fusionner le front.
4. Une migration qui *retire* un accès (comme 1B, qui ferme `public_doctors` à `anon`) suit la règle inverse :
   elle s'applique **après** que tous ses appelants soient passés au nouveau chemin, jamais avant.
5. Avant une recette de vague, refaire le tour complet des migrations de la branche d'intégration.
   Découvrir un objet manquant pendant un parcours coûte le parcours entier.

**Corollaire.** « La migration a été lancée » n'est pas une preuve. Le contrôle est une requête sur les catalogues
(`pg_proc`, `pg_trigger`, `pg_policies`, `information_schema.role_table_grants`) qui rend l'objet.
Un script de preuve enveloppé dans `begin … rollback` affiche un succès et ne laisse rien derrière lui.


## 1 quater. Correction du 12/09 — GitHub lit le workflow depuis la branche SOURCE, pas depuis la base

**Ce que je croyais, et qui est faux.** J'avais écrit qu'un événement `pull_request` exécute le workflow tel qu'il
existe sur la **branche de base**. C'est l'inverse pour ce déclencheur : GitHub lit le fichier côté **source**
(la référence de fusion de la PR, qui contient les modifications de la branche source). `pull_request_target`,
lui, lit bien la base — mais ce n'est pas ce que nous utilisons.

**La preuve.** `origin/main` ne contient aucun `.github/workflows/verification.yml` : il n'a que
`desktop-release.yml`. Pourtant #56, dont la base est `main`, exécute bien le workflow `verification` et affiche
`verifier` rouge et `verifier-v2` vert. Si la base faisait foi, rien ne tournerait.

**Conséquence pour les PR ouvertes.** #58 et #72 n'ont aucune vérification, seulement Netlify et Vercel. Ce n'est
pas un réglage ni une exemption : leurs branches sont **antérieures à la vague** et ne contiennent tout simplement
pas le fichier.

| Branche | `verification.yml` | Vérification à la PR |
|---|---|---|
| `main` | absent | — |
| `fix/rappels-cron-garde-fous` (#58) | absent | non |
| `fix/rgpd-suppression-compte` (#72) | absent | non |
| `fix/p0-securite-chaine-approvisionnement` (#56) | présent | oui |
| `fix/blocages-retour-onglet-agenda` (#76) | présent | oui |

Elles seront contrôlées dès qu'on les rebasera sur une branche qui porte le fichier, ou automatiquement une fois
#56 fusionnée dans `main`, puisque `main` héritera alors du workflow. **Ne pas fusionner #58 ni #72 avant l'un
des deux**, sinon elles entrent sans avoir jamais été vérifiées — c'est exactement le trou que la vague est censée
fermer.

**Leçon de méthode.** C'est la deuxième fois dans la même session qu'une conclusion tirée d'un raisonnement
plausible s'est révélée fausse à la mesure (la première : « la garde n'est pas en base »). Les deux fois, la
mesure a tranché en trente secondes. On mesure, on ne déduit pas.


## 2. Topologie

| Repère | Commit | Date |
|---|---|---|
| `main` | `0db742b` — accueil public réactivé (#55) | 3 septembre |
| `fix/p0-securite-chaine-approvisionnement` (intégration, #56) | `2f7af2c`, **28 commits devant `main`, 0 derrière**, base commune = `main` | 9 septembre |
| **Production Cloudflare** (`tabibi.doctor`) | fichiers identiques à **`dc50776`** (26 août : « Coming Soon » + exclusion des `.bak`) ; `sw.js` en `v37-2026-08-06` ; déploiement `59b36480` sans commit source | ≈ 27 août |
| Netlify (`effulgent-kelpie`) | `main` (`0db742b`) + previews des PR vers `main` | 3 septembre |
| Vercel | construit toutes les branches, déploiements bloqués depuis le 9 septembre (e-mail de commit) ; les déploiements antérieurs restent en ligne avec l'ancienne clé | — |

### Topologie réelle des branches ouvertes (mesurée le 12/09, `git rev-list` / `merge-base`)

Toutes les branches du chantier partent du **même commit** : `2f7af2c`, sommet de #56. Aucune ne contient une autre.
Chacune porte donc les 28 commits de #56 **plus** ses commits propres — c'est pourquoi GitHub affiche « 29 à 35 commits »
sur des PR d'un ou deux fichiers, et « 33 commits » sur #71 dont la base déclarée est `main`.

| Branche (PR) | Commits propres (hors #56) | Base réelle | Base déclarée |
|---|---|---|---|
| `fix/p0-securite-chaine-approvisionnement` (#56) | 28 sur `main` | `main` `0db742b` | `main` |
| `fix/rappels-cron-garde-fous` (#58) | 1 | `main` `0db742b` | `main` |
| `fix/c1-enumeration` (#57) | 3 | `2f7af2c` (#56) | #56 |
| `docs/readme-app` (#59) | 5 | `2f7af2c` | #56 |
| `docs/architecture-cible` (#60) | 6 | `2f7af2c` | #56 |
| `fix/r1-gardes-pages` (#61) | 1 | `2f7af2c` | #56 |
| `fix/r2-indisponibilites-anon` (#62, SQL exécuté le 12/09) | 4 | `2f7af2c` | #56 |
| `docs/fiche-revendication` (#63) | 7 | `2f7af2c` | #56 |
| `fix/claim-revendication` (#64) | 3 | `2f7af2c` | #56 |
| `docs/test-chaine-reelle` (#65) | 2 | `2f7af2c` | #56 |
| `docs/claude-regle-secrets` (#66) | 2 | `2f7af2c` | #56 |
| `fix/rotation-cles` (#67) | 2 | `2f7af2c` | #56 |
| `docs/a-faire-facture-supabase` (#68) | 1 | `2f7af2c` | #56 |
| `fix/medecin-1-faux-succes` (#69) | 1 | `2f7af2c` | #56 |
| `docs/plan-fusion` (#70) | 1 | `2f7af2c` | #56 |
| `fix/grants-liste-blanche` (#71, SQL exécuté le 12/09) | 4 | `2f7af2c` | **`main`** |

`main` n'a pas avancé depuis le 3 septembre (0 commit de `main` absent de #56). Les 6 PR anciennes (#2, #13, #49, #50, #53, #54)
ont des bases vieilles de 8 à 293 commits derrière `main` : elles ne se rebasent pas, elles se ferment (§4).

**Qui doit être rebasé sur `main` avant fusion : personne, à une condition.** Tant que #56 entre dans `main` par un
**merge commit** (étape 9, déjà prévu ainsi), `2f7af2c` devient un ancêtre de `main` et chaque branche ci-dessus ne
présente plus que ses commits propres : fusion directe, sans rebase. Si #56 était **squashée**, les 28 commits n'existeraient
plus sous la même identité et **toutes** les branches devraient être rebasées (`git rebase --onto main 2f7af2c <branche>`),
16 fois, avec les mêmes fichiers touchés. Décision : merge commit pour #56, interdiction du squash sur cette PR.
Deux gestes de rangement, sans rebase : recibler #71 sur #56 (ou la laisser sur `main` et la fusionner après l'étape 9,
son preview Netlify sert aux preuves d'interface) ; #58 reste sur `main` (1 commit, indépendant).

**Retard exact** : la production a **1 commit de retard sur `main`** (#55, l'accueil) et **29 commits sur
ce qui est écrit** (#55 + les 28 de #56), sans compter les 13 PR empilées. Rien de ce qui a été fait
depuis le 26 août n'est en ligne. `sw.js` passera de v37 à v38 au prochain déploiement, ce qui
forcera le rafraîchissement des clients.

## 3. L'ordre

Trois blocages sautent en premier, dans cet ordre, parce que tout le reste passe derrière eux :
**la 2FA GitHub** (échéance **13 septembre** : sans elle le compte est restreint et plus rien ne se
merge), **la facture Supabase** (une suspension serait irrécupérable), **l'application GitHub Vercel**
(tant qu'elle est installée, un merge sur `main` redéploie une copie complète du site chez un tiers,
et après rotation elle porterait la nouvelle clé).

| # | Qui | Doit être vrai avant | Ce qui se passe | Preuve |
|---|---|---|---|---|
| 1 | Aghiles | — | Activer la **2FA GitHub** (bandeau « Enable 2FA ») | bandeau disparu ; `gh auth status` inchangé |
| 2 | Aghiles | — | **Régler la facture Supabase** (Organisation → Billing → Invoices) | bandeau « Outstanding invoices » disparu ; projet `ACTIVE_HEALTHY` (je relis l'API) |
| 3 | Aghiles | 1 (le mode sudo exige le code e-mail) | **Désinstaller l'application GitHub Vercel** (`Settings → Installations → Vercel → Uninstall`) | plus d'entrée Vercel dans les installations ; plus de commentaire du bot sur le prochain push |
| 4 | Aghiles puis moi | — | Clé de sauvegarde v2 collée dans `/private/tmp/claude-501/verif-cle/verif-cle.txt` | empreinte `a80e6112…` identique, copie iCloud déchiffrée 5/5, fichier de vérif et clé locale effacés |
| 5 | Aghiles puis moi | — | **Exécuter le SQL R2** (#62) | anon → 401 ; patient simulé → 0 ; RPC inchangée (mesures réelles) |
| 6 | Aghiles (localhost) puis moi | serveur local sur `localhost:8080` (en place) | **Preuve d'interface de #69** : connexion OTP, « Mes horaires », message honnête sans fiche | captures + requête RPC ; puis les 3 « requis » de la revue appliqués dans #69 (helpers partagés, `textContent`, tests `node:test`) |
| 7 | moi, sur accord | 6 | **Merge dans la branche d'intégration**, une PR à la fois, dans cet ordre : #66, #68, #59, #60, #63, #65, #70 (docs), puis #61, #67, #69, #64, #62, #71 (code et SQL — #62 et #71 déjà exécutés en base le 12/09). Merge commit, pas de squash, pour garder les preuves dans l'historique | après chaque merge, le CI de #56 se relance : **vert** obligatoire avant le suivant |
| 8 | Aghiles puis moi | 7 | **Exécuter le SQL du claim** (#64) : correctif + bloc TRUNCATE | `pg_proc` relu (drapeau présent, `for update` présent) ; TRUNCATE = 0 table ; bloc de simulation rejoué sans les `CREATE` |
| 9 | Aghiles, puis moi | 1, 3, 7 verts | **Merge de #56 dans `main`** (merge commit) | CI de `main` vert ; Netlify `main` reconstruit ; aucun bot Vercel |
| 10 | moi, sur accord | 9 | **Déploiement Cloudflare** par la procédure en vigueur (`git archive main` → purge → `wrangler pages deploy`) ; R5 (chaîne unique) viendra après, hors de ce plan | `tabibi.doctor/` sert l'accueil complet ; `sw.js` v38 ; `js/config.js` porte la clé publiable ; `/js/home-app.js` 200 ; `/supabase/migrations/` 404 ; 30 tests Playwright rejoués contre la production |
| 11 | moi, sur accord | 10 | **APK 1.0.3 (versionCode 5)** reconstruit avec la nouvelle clé, publié dans `Downloads`, page de téléchargement mise à jour (petite PR) | APK vérifié (`output-metadata.json`), objet en ligne, page pointe dessus |
| 12 | Aghiles puis moi | 10, 11 | **Fin de rotation** : désactiver les clés historiques `anon`/`service_role`, révoquer la clé de signature HS256, supprimer `sitemap_generator_v3` | ancienne clé → 401 « Invalid API key » ; nouvelle → 200 ; HS256 « révoquée » dans la liste ; OTP réel passe |
| 13 | moi puis Aghiles | 9 | **#58** : rebasée sur `main`, edge redéployée (`RUN_MAX`), puis bloc 0 Vault (Aghiles colle), blocs 1–4 | `ops_sante.last_status = 200` au quart d'heure suivant ; plus de 401 dans `net._http_response` |
| 14 | Aghiles puis moi | 9 | **1A exécutée** (#57), puis #57 reciblée sur `main`, CI vert, merge, déploiement (étape 10 rejouée) | `verifier-c1 --live` : 3 ✓ après déploiement ; recherche fonctionnelle sur `tabibi.doctor` |
| 15 | Aghiles | 14 déployée, décision APK | **1B exécutée** : la vue `public_doctors` cesse d'être lisible | `GET /rest/v1/public_doctors` → 401 ; la recherche marche toujours |
| 16 | Aghiles + moi | 8, 12, 13 | **Test réel de la chaîne** (#65) : claim → validation → RDV → confirmation → **SMS reçu** ; nettoyage ; purge des 7 comptes de test | `verification.sql` à 0 avant et après ; SMS reçu ; `sms_log` + DLR |
| 17 | moi | 16 | Fermer les 6 PR anciennes, supprimer les 11 branches déjà fusionnées, taguer puis supprimer les branches mortes (§4) ; mettre à jour `A_FAIRE_AGHILES.md` | `git branch -r` ne liste plus que `main` et les chantiers vivants |

Après 17, et seulement après : les correctifs médecin 2 à 5 et 1 bis / 1 ter, R3, R5, la suppression
des projets Vercel (tableau de bord Vercel), le projet Supabase de staging (§7 de l'architecture cible).

## 3 bis. Ordre arrêté le 12/09 au soir — trois PR empilées, puis la vague

La recette à trois parcours **est passée** (`docs/preuves/RECETTE-P1…`, `-P2…`, `-P3…`). Elle a produit
trois correctifs, qui se débloquent en cascade : chacun laisse la CI rouge tant que le précédent n'est pas
fusionné, et aucun n'ajoute d'échec.

| Ordre | PR | Ce qu'elle règle | Pourquoi à cette place |
|---|---|---|---|
| 1 | **#76** | la section des blocages revient dans l'onglet Agenda ; retrait de `getTakenSlots`, morte depuis #74 | c'est elle qui **verdit le cliquet de dette** (44 → 43). Sans elle, les deux autres restent rouges sur `lint:dette` |
| 2 | **#77** | la clé publiable est lue à l'appel, plus à l'évaluation du module | c'est elle qui **verdit les parcours Playwright** : sans elle, `stats_publiques` rend 401 et le test du hero échoue |
| 3 | **#78** | le tableau de bord médecin lit les RDV par l'identifiant de fiche | elle n'a aucun échec propre : elle attend simplement que les deux portes soient vertes |

Puis **#56 → `main`**, et la recette rejouée une dernière fois sur l'arbre complet, les trois parcours,
écran contre base. C'est cette dernière exécution qui vaut go de déploiement, pas les exécutions
intermédiaires faites branche par branche.

Rappel de mécanique, mesuré le 12/09 (§1 quater) : `main` ne porte aucun `verification.yml`. Une fois #56
fusionnée, `main` en hérite, et **#58 et #72 seront alors contrôlées pour la première fois**. Ne pas les
fusionner avant.

## 3 ter. Dette d'espaces d'identifiants — deux décisions du 12/09

Le parcours 3 a montré que `appointments.doctor_id` porte `doctor_profiles.id`, jamais l'identifiant de
compte, et que **la politique RLS est écrite sur cet identifiant de fiche** :

```sql
appointments_select_doctor : doctor_id IN (select id from doctor_profiles where user_id = auth.uid())
```

L'ancien code du tableau de bord ne demandait donc pas seulement les mauvaises lignes : il demandait des
lignes que la politique n'aurait de toute façon jamais rendues. Ce n'était pas un filtre maladroit, c'était
une requête qui ne pouvait pas aboutir. #78 le corrige. Restent deux endroits, décidés mais non traités :

1. **`doctor-analytics.html` interroge avec les deux identifiants à la fois** — `[identifiant de fiche,
   identifiant de compte]` dans un `in.(…)`. **À trancher, pas à garder.** C'est pire qu'un défaut : le
   symptôme disparaît et l'ambiguïté reste. Quiconque lit ce code en conclut que les deux identifiants sont
   interchangeables, ce qui est faux, et le prochain écrira l'un pour l'autre en toute confiance.
   Correctif : ne garder que l'identifiant de fiche, comme la politique RLS.

2. **`medecin-ordonnance.html` range un identifiant de compte dans un champ nommé `id`**
   (`currentDoctor = { id: user.id, … }`). Piège dormant : aucune requête ne le filtre aujourd'hui, il ne
   sert qu'à afficher une spécialité. C'est exactement le genre de piège qui ressuscite un défaut six mois
   plus tard sans que personne ne comprenne pourquoi. Correctif : renommer le champ, ou y mettre
   l'identifiant de fiche.

Aucune des deux n'entre dans la vague. Elles vont dans un chantier « un identifiant, un espace, un nom ».


## 4. Ce qu'on abandonne

- **PR à fermer sans fusion** : #2, #13, #49, #50 (dépassées), #53 et #54 (fonctionnalités, à reprendre
  après stabilisation, sur la base actuelle).
- **11 branches déjà fusionnées dans `main`, à supprimer** : `feat/agenda-patient-names`,
  `feat/sentry-dsn`, `feat/sms-dlr`, `fix/agenda-noms`, `fix/captcha-safari`, `fix/ordonnances-flag`,
  `hotfix/turnstile-sitekey`, `mobile/capacitor-setup`, `phase3/desktop-tauri`, `phase4/rappels-rdv`,
  `security/fix-doctor-profiles-rls`.
- **40 branches non fusionnées sans PR**, toutes antérieures au 4 septembre (la plus récente :
  `chore/verite-deploiement-et-version`, 2 commits ; la plus lourde : `audit/full-quality-sept2026`,
  46 fichiers de mai). Proposition : un tag `archive/<branche>` sur chacune, puis suppression ; rien
  n'est perdu, rien ne pollue plus la liste. Les seules à relire avant archivage : `mobile/finalization`
  (31 août, 10 fichiers) et `claude/doctor-outreach-tool-ib8otj` (30 août), qui peuvent contenir un
  travail non repris ailleurs.
- **Ce qu'on ne fait pas** : un squash de #56 (28 commits de preuves à garder), une bascule vers
  `dist-web` avant R5, un merge de #57 avant 1A.

## 5. Liste Trello (une ligne = une carte, à coller telle quelle)

```
A faire | 01 | Aghiles | Activer la 2FA GitHub (échéance 13/09)
A faire | 02 | Aghiles | Régler la facture Supabase et vérifier ACTIVE_HEALTHY
A faire | 03 | Aghiles | Désinstaller l'application GitHub Vercel (sudo par e-mail)
A faire | 04 | Aghiles | Coller la clé de sauvegarde v2 dans /private/tmp pour vérification
En attente de moi | 04b | Claude | Vérifier la clé v2, déchiffrer iCloud, effacer la clé locale
A faire | 05 | Aghiles | Exécuter le SQL R2 (#62)
En attente de moi | 05b | Claude | Mesurer R2 en réel : anon 401, patient 0, RPC inchangée
A faire | 06 | Aghiles | Se connecter sur localhost:8080 (OTP) pour la preuve de « Mes horaires » (#69)
En attente de moi | 06b | Claude | Preuve d'interface #69 + les 3 requis de la revue (helpers, textContent, tests)
En attente de moi | 07 | Claude | Merger dans l'intégration, un par un, CI de #56 vert entre chaque : #66 #68 #59 #60 #63 #65 #61 #67 #69 #64 #62
A faire | 08 | Aghiles | Exécuter le SQL du claim (#64), correctif + TRUNCATE
En attente de moi | 08b | Claude | Relire pg_proc, rejouer la simulation sans les CREATE
A faire | 09 | Aghiles | Accord puis merge de #56 dans main
En attente de moi | 10 | Claude | Déployer main sur Cloudflare (procédure archive) et prouver : accueil, sw v38, clé publiable, 404 sur /supabase
En attente de moi | 11 | Claude | APK 1.0.3 (vc 5) avec la nouvelle clé, publié, page de téléchargement à jour
A faire | 12 | Aghiles | Fin de rotation : désactiver anon/service_role historiques, révoquer HS256, supprimer sitemap_generator_v3
En attente de moi | 12b | Claude | Preuves de rotation : ancienne clé 401, nouvelle 200, HS256 révoquée
En attente de moi | 13 | Claude | Rebaser #58 sur main, redéployer l'edge des rappels avec RUN_MAX
A faire | 13b | Aghiles | #58 : bloc 0 Vault (coller le secret), puis blocs 1 à 4
En attente de moi | 13c | Claude | Vérifier ops_sante = 200 et plus aucun 401 dans net._http_response
A faire | 14 | Aghiles | Exécuter 1A (#57)
En attente de moi | 14b | Claude | Recibler #57 sur main, CI vert, merge, déploiement, verifier-c1 --live 3 ✓
A faire | 15 | Aghiles | Exécuter 1B après déploiement du front (décision APK prise)
A faire | 16 | Aghiles + Claude | Test réel de la chaîne (#65) : claim, validation, RDV, confirmation, SMS reçu, puis nettoyage
A faire | 16b | Aghiles | Purge des 7 comptes de test (script de #65)
En attente de moi | 17 | Claude | Fermer #2 #13 #49 #50 #53 #54 ; supprimer 11 branches fusionnées ; archiver et supprimer les 40 branches mortes
Fait | — | — | Secret edge TABIBI_SECRET_KEY posé ; 3 edge functions redéployées (v17/v4/v7) ; FileVault activé ; copie chiffrée du Storage sur iCloud ; plan écrit
```
