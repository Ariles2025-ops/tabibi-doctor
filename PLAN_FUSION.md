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

### Les 14 PR du chantier (#56 → #69)

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

## 2. Topologie

| Repère | Commit | Date |
|---|---|---|
| `main` | `0db742b` — accueil public réactivé (#55) | 3 septembre |
| `fix/p0-securite-chaine-approvisionnement` (intégration, #56) | `2f7af2c`, **28 commits devant `main`, 0 derrière**, base commune = `main` | 9 septembre |
| **Production Cloudflare** (`tabibi.doctor`) | fichiers identiques à **`dc50776`** (26 août : « Coming Soon » + exclusion des `.bak`) ; `sw.js` en `v37-2026-08-06` ; déploiement `59b36480` sans commit source | ≈ 27 août |
| Netlify (`effulgent-kelpie`) | `main` (`0db742b`) + previews des PR vers `main` | 3 septembre |
| Vercel | construit toutes les branches, déploiements bloqués depuis le 9 septembre (e-mail de commit) ; les déploiements antérieurs restent en ligne avec l'ancienne clé | — |

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
| 7 | moi, sur accord | 6 | **Merge dans la branche d'intégration**, une PR à la fois, dans cet ordre : #66, #68, #59, #60, #63, #65 (docs), puis #61, #67, #69, #64, #62 (code et SQL présentés). Merge commit, pas de squash, pour garder les preuves dans l'historique | après chaque merge, le CI de #56 se relance : **vert** obligatoire avant le suivant |
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
