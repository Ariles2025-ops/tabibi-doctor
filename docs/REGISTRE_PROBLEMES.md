# Registre des problèmes

**Un problème réglé sans garde est un problème qui reviendra sans prévenir.**

Ce fichier existe pour qu'aucun défaut déjà payé ne se repaye. Une ligne par problème :
ce qu'on a **vu**, ce qui l'a **prouvé**, ce qui l'a **corrigé**, et surtout **ce qui
rougit s'il revient**.

> **Règle** (`CLAUDE.md`) : aucun correctif fusionné sans sa garde. Chaque bug corrigé
> ajoute — ou pointe — un test/porte qui échoue si le problème réapparaît, plus une ligne
> ici.

Créé le **15/09/2026**. Les gardes citées ont été **vérifiées présentes dans le dépôt**,
pas supposées. Quand il n'y en a pas, la colonne dit **« garde manquante »** : c'est une
information, pas un oubli de rédaction.

**Comment lire la colonne garde** :

| | |
|---|---|
| `npm run …` | une porte de `verifier:toutes` — elle bloque **avant** la fusion |
| `tests/…` | un essai, lancé par la porte `e2e` ou `unites` |
| *en base* | une garde côté PostgreSQL — **aucune porte CI ne la surveille** |
| **garde manquante** | rien ne détecte le retour du problème |

---

## Réglés, avec garde

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-01 | La liste d'attente annonçait « 500+ inscrits » | table `waiting_list` : **0 ligne** ; 404 réseau sur l'objet appelé | RPC `waiting_list_count()` + l'écran affiche « — » s'il ne sait pas | `tests/e2e/audit-corrections.spec.js` | réglé |
| P-02 | « E-mail envoyé » affiché même quand l'envoi échouait | rejeu avec un 429 `over_email_send_rate_limit` : l'écran disait quand même « envoyé » | succès affiché seulement après lecture de `r.error` | `tests/e2e/audit-corrections.spec.js` | réglé |
| P-03 | 80 des 106 éléments de l'accueil affichaient leur **clé i18n brute** | relevé horodaté : 0 brute à `DOMContentLoaded`, **80 à `load`** ; piège sur `textContent` → `js/home-app.js:389` | `T()` consulte le dictionnaire partagé ; on n'écrit jamais quand la valeur vaut la clé | `tests/e2e/i18n-cles-brutes.spec.js` (31 cas, 3 langues) | réglé |
| P-04 | Le cron des rappels recevait **401 depuis 47 jours** | `cron.job` envoyait `'TA_CLE'` ; `net._http_response` : 401 sur 24 réponses sur 24, alors que `cron.job_run_details` affichait 4 531 « succeeded » | secret lu dans le Vault ; la migration **refuse de s'appliquer** si le secret manque | `rappels_sentinelle()` *en base* (horaire → `audit_log_echecs`) — **aucune porte CI** | réglé |
| P-05 | `verify_jwt` de `appointment-reminders` non déclaré : un déploiement l'aurait remis à `true` et cassé le cron une 2ᵉ fois | le corps des 401 était `{"error":"unauthorized"}`, écrit par **la fonction** — donc elle était atteinte | entrée `[functions.appointment-reminders]` dans `supabase/config.toml` | **garde manquante** — aucune porte ne lit `config.toml` | réglé |
| P-06 | Les politiques d'écriture de `prescriptions` s'annulaient (permissives en OU) | `pg_policies` : INSERT 2 · UPDATE 2, la laxiste absorbant la stricte | une seule politique par commande d'écriture | requêtes de contrôle dans `20260914_rls_prescriptions.sql` — **aucune porte CI** | réglé |
| P-07 | La page publique de vérification d'ordonnance pouvait exposer un traitement | — (défaut de conception, évité avant mise en ligne) | réponse construite champ par champ **puis relue** avant envoi ; refus si un contenu médical s'y trouve | `tests/e2e/ordonnance-verification.spec.js` (sert une réponse fautive, vérifie que rien ne s'affiche) | réglé |
| P-08 | Une rotation de clé aurait invalidé toutes les ordonnances signées | — | identifiant de version **dans** la signature (`v1:…`) dès la première | `tests/signature-ordonnance.test.mjs` — vecteur figé + essai de rotation | réglé |
| P-09 | Le PDF d'ordonnance ne savait pas imprimer l'arabe, et la signature était **refusée** | `fontkit.layout` → 9 glyphes contextuels ; mapping naïf → 5 formes isolées | police Noto Naskh embarquée ; pdf-lib façonne via fontkit | `tests/pdf-arabe.test.mjs` — **compte les 9 glyphes** ; 5 = lettres détachées | réglé |
| P-10 | Un RDV recevait **deux** SMS (fenêtres j1/h2 qui se recouvraient) | constaté en essai réel | plancher j1 porté à 6 h, très au-dessus du plafond h2 | `tests/rappels-sms.test.mjs` — recouvrement vérifié **minute par minute sur 24 h** | réglé |
| P-11 | Un numéro de téléphone « réparé » aurait envoyé un rappel médical à un inconnu | — | `normalizePhoneDZ` rend `null` plutôt que de corriger | `tests/rappels-sms.test.mjs` — 9 formes acceptées, 10 refusées | réglé |
| P-12 | Le drapeau `video` ouvert sans que l'écran « bientôt disponible » disparaisse | — | drapeau + suppression de l'écran, la branche coming-soon **reste** dans le code | `tests/e2e/teleconsultation-salle.spec.js` + `npm run verifier:video` | réglé |
| P-13 | La CSP ne contenait **aucune** mention de `daily.co` : l'iframe aurait été bloquée | relevé sur `_headers` et `netlify.toml` | `frame-src`/`connect-src`/`media-src` + délégation caméra à l'origine exacte | `npm run verifier:video` — échoue si le drapeau s'ouvre avec un espace réservé | réglé |
| P-14 | Le drapeau `reviews` **n'était lu par personne** ; un `return []` caché fermait vraiment les avis | 0 occurrence de `TABIBI_FEATURES.reviews` dans le produit | court-circuit retiré **et** drapeau rendu lisible par le module | `tests/e2e/avis-patients.spec.js` (12 cas, drapeau ouvert **et** fermé) | réglé |
| P-15 | Un écran de succès atteignable **sans** succès (invitation médecin) | `tabibiRpc` rend `ok:true` dès qu'il n'y a pas d'`error` | la page exige `r.data.ok === true` | `tests/e2e/invitation-medecin.spec.js` — sert une réponse inattendue, exige l'absence d'écran de succès | réglé |
| P-16 | Un jeton d'invitation stocké en clair aurait ouvert toutes les invitations en cas de fuite | — | la base ne garde que le **SHA-256** ; l'adresse est vérifiée en plus du jeton | `tests/e2e/invitation-medecin.spec.js` + `tests/courriel-invitation.test.mjs` | réglé |
| P-17 | Un message d'erreur **serveur** rendu comme du HTML sur la page de réservation | `_bkServerError` concaténé puis passé à `innerHTML` | le message devient du **texte** ; l'icône est un nœud construit à part | `tests/e2e/xss-toast.spec.js` — 4 charges réellement injectées | réglé |
| P-18 | Le dépôt pollué : un `git add -A` a emporté 23 fichiers étrangers, dont 5,6 Mo d'archives | `git show --stat` : 31 fichiers au lieu de 7 | `.gitignore` + règle 9 de `CLAUDE.md` (ajout **par chemin**) | `npm run verifier:proprete` | réglé |
| P-19 | 173 `catch {}` muets sur 189 : Sentry ne recevait presque rien | recensement AST | catchs morts supprimés, les autres parlent | `npm run verifier:catch` | réglé |
| P-20 | Le front appelait des RPC **absentes** de la base | comparaison `pg_proc` ↔ appels du dépôt | référence versionnée + liste d'absences connues qui doit **maigrir** | `npm run verifier:rpc` | réglé |
| P-21 | CI rouge / local vert : les essais dépendaient de CDN tiers | CDN simulé à 20 s : `load` = 20,1 s/navigation contre 0,1 s en `domcontentloaded` | suite **hermétique** : aucune requête ne sort de localhost | `tests/e2e/hermeticite.spec.js` — `response.serverAddr()` prouve qu'aucun paquet ne part | réglé |
| P-22 | Pages publiques et parcours sous le niveau AA | axe : 19 violations publiques, puis 27 champs **sans étiquette programmatique** sur le profil patient | contrastes, `for` sur les labels, modale fermée rendue inerte au clavier | `tests/e2e/accessibilite.spec.js` | réglé |
| P-23 | `innerHTML` recevant une donnée non constante : 46 sites | compteur dédié, après trois corrections du compteur lui-même | 4 puits bouchés (3 toasts + `<option>` construit en DOM) | `npm run verifier:innerhtml` — **le compteur ne peut que baisser** | réglé, **46 restants** |

---

## Appliqués par le stratège, hors dépôt

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-24 | `search_path` non figé sur 16 fonctions ; 20 clés étrangères sans index | advisors Supabase | appliqué en prod via MCP | **garde manquante** côté CI — seul l'advisor Supabase le reverrait | réglé |
| P-25 | `video_sessions.daily_room_url` portait une URL **fabriquée** (`placeholder.daily.co`) | lecture de `create_video_session` | écrit `NULL` — « je ne sais pas encore » | requêtes de contrôle dans `20260914_video_daily.sql` — **aucune porte CI** | réglé |

---

## Appliqués et vérifiés après coup

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-26 | 57 RPC `SECURITY DEFINER` exécutables par `anon` | `has_function_privilege('anon', …)` ; 319 au total, dont 262 `SECURITY INVOKER` sans effet | `20260915_revoke_rpc_anon.sql` — `REVOKE … FROM PUBLIC` **et** `FROM anon`, puis `GRANT` aux connectés. Appliqué en prod le 15/09 | **requête de comptage** (ci-dessous) + advisor Supabase — *en base*, **aucune porte CI** | **réglé — vérifié 57 → 10** |
| P-30 | `presc_can_read_pdf` restait exécutable par `anon` | ACL relue après application : `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — **`anon` n'y est plus** | réglé par P-26 | même requête de comptage — *en base* | **réglé** |
| P-32 | `REVOKE … FROM anon` **ne révoquait rien** : PUBLIC détenait `EXECUTE` | après le `REVOKE FROM anon` seul, **~47** des 57 fonctions restaient exécutables par `anon` — le compte n'avait pas bougé | `REVOKE … FROM PUBLIC` ajouté, plus `GRANT authenticated, service_role` pour ne pas fermer aux connectés | **la même requête de comptage** — c'est elle qui a attrapé le piège | **réglé** |

### La requête de garde, celle qui a attrapé P-32

Une migration qui s'applique ne prouve rien. **C'est ce compte qui le prouve** — à
relancer après toute migration qui crée une fonction :

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE');
-- attendu : 10.  Au-dessus : une fonction est née avec EXECUTE accordé à PUBLIC.
```

Relu en base le 15/09 après application : **10**, et ce sont exactement les dix du
parcours public. `authenticated` et `service_role` : **30/30 conservées, 0 perdue**.

> **P-32 est la vraie leçon de ce lot.** Un `REVOKE` qui réussit n'est pas un `REVOKE` qui
> révoque — comme le cron des rappels (P-04) disait « succeeded » en envoyant le mot
> `TA_CLE`. Deux fois le même piège : **la commande passe, l'effet n'existe pas.** Ce qui
> les a attrapés tous les deux, c'est d'être allé relire l'état après coup.

---

## Instrumenté — la cause n'est pas trouvée, mais le prochain échec se nommera

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-33 | La porte `e2e` sort en **1 sur le runner GitHub** (441 s) alors que le local rend **304/304**, sources ET `dist-web` — et **rien ne dit quel test** | 5 reproductions locales toutes vertes : sources · dist-web · arbre **propre** de `ccbc996` (worktree détaché) · `TZ=UTC` · charge 37 sur 10 cœurs avec `--repeat-each=3` sur les 7 specs à `waitForTimeout` | deux aveuglements levés : rapporteurs `github`+`html`+`json` en CI, et `verifier-toutes.mjs` ne coupe plus à la 25ᵉ ligne | **prouvées rouges toutes les deux** : un test volontairement instable sort `::error file=…,title=…,line=…` puis « 1 flaky » ; un test volontairement faux fait imprimer son **nom** par la porte | **instrumenté — cause inconnue** |

**Ce qui a été corrigé n'est pas le flake : c'est l'aveuglement.** Il y en avait deux, et
ils se cachaient l'un l'autre :

1. **Aucun fichier de rapport.** Le seul rapporteur était `list`, qui écrit sur la sortie
   standard et ne produit rien sur disque — l'étape « Rapport de test si échec » du workflow
   téléversait un `playwright-report/` qui n'avait **jamais été écrit**.
2. **La porte coupait le diagnostic.** `verifier-toutes.mjs` imprimait les **25 dernières
   lignes** de la sortie. Playwright démarre un serveur statique dont chaque requête
   s'imprime : mesuré sur un échec e2e réel, **22 de ces 25 lignes étaient des lignes
   d'accès HTTP**, et aucune ne nommait le test tombé. Le diagnostic était là, à quatre
   cents lignes de la fin.

« Les 25 dernières lignes », c'est le `tail -1` de la boucle shell du 13/09 en un peu plus
long : **on regarde une position, pas un contenu.** Désormais le bruit d'accès est retiré,
les lignes qui parlent d'un échec passent devant, et la sortie complète part dans
`test-results/porte-<nom>.log` dont le chemin est imprimé (mesure : **389 lignes utiles sur
6 179**).

⚠️ **`retries: 2` n'est pas un correctif, et un test marqué « flaky » n'est pas un test
réparé.** Aucune assertion n'a été touchée. Le but est qu'un échec isolé ressorte **nommé**
au lieu de « exit 1 ». Si le label flaky réapparaît, il faut chasser le test, pas s'habituer
au label — c'est exactement comme ça qu'une porte meurt.

La seule différence non reproduite ici : **ubuntu-latest contre macOS** (pas de Docker sur
la machine). Les 28 `waitForTimeout` des 9 specs restent le suspect le plus probable ; je ne
les ai **pas** réécrits à l'aveugle — 28 modifications sans reproduction, c'est du bruit qui
casse plus qu'il ne répare.


---

## Le plafond XSS, cran par cran

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-34 | **17 puits `innerHTML` réels** recevaient une donnée non constante : saisie (`prompt`), profil (`localStorage`), réponse RPC, paramètre d'URL | `npm run verifier:innerhtml` — 46 → 34 → **12** | échappement au point d'écriture (`esc` / `_esc` / `hEsc` / `escapeHtml`), nœuds DOM quand le gabarit n'apportait rien, `new Option()` pour les `<option>` | **plafond abaissé à 12** — la porte interdit toute remontée | **réglé** |
| P-35 | `(window.esc || String)(…)` sur **trois** pages : quand `tabibi-security.js` n'est pas chargé, le repli est `String`, **qui n'échappe rien** | `admin-api-keys.html:354`, `patient-dashboard.html:586`, `signup.html:760` | repli **local** qui échappe vraiment, dans chaque fichier | même porte | **réglé** |
| P-36 | `esc()` employé pour une **chaîne JS dans `onclick="…"`** : le parseur HTML décode `&#39;` **avant** que le JS ne soit lu — la quote revient et ferme la chaîne | `doctor-dashboard.html:703`, nom de patient et motif passés à `alert(…)` | `_eJs()` (quote échappée pour JS, `"` en `&quot;`) remonté au niveau du fichier ; `encodeURIComponent` pour les identifiants | même porte | **réglé** |
| P-37 | Le compteur se trompait **encore trois fois** : un `+` écrit dans une phrase, `tabibiT` absent de la liste des dictionnaires, une chaîne écrite **dans** une interpolation | `<div>Cliquez sur "+ Nouvelle clé"</div>` comptait ; `${tabibiT('x',"diplôme + Conseil de l'Ordre")}` comptait | on ne lit une expression **que là où il y en a une** : squelette à pile, et les branches d'un ternaire évaluées une à une | **contre-épreuve** : 9 cas, 4 doivent compter, 5 non — dont `${ok ? row.nom : 'rien'}`, qui DOIT compter | **réglé** |

### Les 12 restants — revus un par un, aucun n'est un puits

`activeSection` · `rows` · `reasons` · `docsBlock` · `footerCta` (du HTML déjà échappé,
assemblé dans une variable — le compteur ne suit pas une variable) · `val`, `i`, `b.time`,
`a.time` (des nombres, ou le comparateur d'un `sort` qui ne va jamais dans le DOM) ·
`S.doctors.map(…)`, `[1,2,3,4,5].map(…)` (échappés à l'intérieur) · les dictionnaires de
`tabibi-lang.js` et `tabibi-reviews.js`.

> ⚠️ **Le compteur ne voit pas une variable.** `wrap.innerHTML = html`, où `html` a été
> assemblé plus haut, n'est **pas** compté — et peut très bien être un puits. Douze est un
> plancher de ce qu'on sait voir, pas une preuve d'innocuité. C'est écrit en tête du
> script depuis le premier jour ; ça reste vrai.


---

## Le compteur XSS v2 — voir ce qu'on ne voyait pas

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-38 | Le compteur **ne voyait pas** `el.innerHTML = html` quand `html` est assemblé ailleurs. Un puits réel passait pour sûr : `admin-api-keys.html` posait du HTML construit depuis la base | v1 comptait **12** sites ; v2 en compte **135** — **123 valeurs opaques** que la v1 déclarait sûres sans rien savoir d'elles | la question est **retournée** : chaque valeur écrite doit être *prouvablement* sûre (littéral, gabarit dont toutes les interpolations le sont, échappeur, libellé, nombre). Tout le reste est compté | **contre-épreuve à 17 cas**, 8 doivent compter, 9 non — dont `el.innerHTML = html`, qui DOIT compter | **réglé** |

### ⚠️ 12 → 135 ne veut pas dire que le code a empiré

**Les deux chiffres ne mesurent pas la même chose.** La v1 regardait ce qui *avait l'air*
dangereux dans l'expression écrite sur place. La v2 exige une preuve pour chaque valeur.
Douze était un plancher de ce qu'on savait voir — c'était déjà écrit au registre la veille
(P-34). Le plafond `v2` est marqué comme tel dans `innerhtml-plafond.json` : personne ne
doit comparer les deux.

### Ce qui a été corrigé, pas seulement compté

- **`admin-api-keys.html`** — le puits connu. Nom et e-mail du partenaire, `key_id`,
  environnement, scopes, compteurs, date : **tout est échappé** morceau par morceau. Les
  trois `onclick` reçoivent du **JS échappé**, pas du HTML échappé : `&#39;` y redeviendrait
  une quote, et refermerait la chaîne du handler.
- **`dawini.html`** — les compteurs du radar (`sans_dispo`, `demandes`, `taux`) passent par
  `_esc` / `Number`.

### Deux angles morts levés au passage

- `M.esc(…)`, `window.tabibiSec.escapeHtml(…)` : un **préfixe d'objet** faisait échouer la
  reconnaissance. `conversation.html` échappe chaque message par `M.esc()` — la page des
  messages entière passait pour non protégée.
- `ECHAPPEUR` n'était **pas ancré** : il suffisait qu'un `esc(` apparaisse *quelque part*
  pour que toute l'expression soit déclarée sûre. Ce qui compte est l'appel **du dessus**.

### Les 135 restants — ce qu'ils sont

**123 valeurs opaques** (une variable, un appel dont on ne voit pas l'intérieur) et **12
gabarits** dont une interpolation n'est pas prouvée. Les opaques dominent : `origText` de
`login.html` (16 fois — le libellé d'un bouton sauvegardé puis restauré), `errHtml`,
`loading`, `opts.join('')`…

> **Compter une valeur opaque n'est pas l'accuser.** C'est refuser de la déclarer sûre sans
> preuve. Le travail restant est de les rendre lisibles une par une — pas de croire le
> chiffre.

⚠️ Reste au moins un point de conception à trancher : `js/home-app.js:544`, le toast avec
`{html:true}`, réservé par commentaire aux libellés du dictionnaire. **Un commentaire n'est
pas une garde.**


---

## ⚠️ Dette de sécurité assumée — à lever avant le premier vrai patient

| ID | ce que c'est | pourquoi c'est une dette | ce qui la tient | garde | statut |
|---|---|---|---|---|---|
| P-40 | **Accès médecin par numéro de téléphone** : le médecin tape son numéro, il est dans l'app. Pas de mot de passe, pas de code SMS, pas de lien | **Un numéro de téléphone n'est pas un secret.** Il est sur une plaque, une ordonnance, un annuaire, une page Facebook. Quiconque connaît le numéro d'un médecin de la liste peut ouvrir **sa** session | (1) liste blanche remplie à la main par un admin · (2) interrupteur `ACCES_PILOTE_NUMERO_ENABLED`, **absent = fermé** · (3) Turnstile obligatoire, vérifié **avant** le numéro · (4) 5 tentatives/minute par IP **et** par numéro | `tests/acces-pilote.test.mjs` (16 essais : les 4 gardes, l'énumération, le secret) + `tests/e2e/acces-pilote.spec.js` (9 parcours × 2 profils) | **dette assumée — pilote fermé uniquement** |

### Les trois conditions sous lesquelles ce code a été écrit

1. **Liste blanche.** Aucune inscription libre : un administrateur ajoute les numéros un par un
   (`admin_ajouter_medecin_pilote`).
2. **Interrupteur.** `ACCES_PILOTE_NUMERO_ENABLED` doit rester à `false` en production.
   Le code lit `!== 'true'` : une variable absente, vide ou mal orthographiée **ferme**.
3. **Données de test.** Les fiches de la liste doivent être des comptes de démonstration.
   ⚠️ **Un médecin de la liste qui aurait de vrais patients expose ces patients.**

### À lever comment

Par un **code SMS (OTP)** — la brique d'envoi existe déjà (`send-sms`, `_partage/sms-rappels.ts`)
et les rappels s'en servent en production. Ce n'est pas un chantier neuf : c'est un chantier
**pas fait**.

### Ce qui a quand même été fait correctement

- **Aucune énumération** : un seul code de refus, quelle que soit la raison (inconnu, mal formé,
  révoqué), et un **plancher de durée** — sinon l'horloge dirait ce que le message tait.
- **Le mot de passe éphémère ne sort pas.** La session est mintée en posant un mot de passe
  aléatoire de 32 octets, en s'en servant côté serveur, puis **en le remplaçant par un autre —
  que la connexion réussisse ou non**. Il n'est ni journalisé ni renvoyé.
- **Le compteur de tentatives ne stocke ni numéro ni IP**, seulement leur SHA-256. Ce qu'on ne
  stocke pas ne fuit pas.
- **`verify_jwt = false` est déclaré dans `config.toml`** — la leçon de P-05, où le réglage non
  écrit a fait taire le cron des rappels 47 jours.
- **La page n'est liée depuis nulle part** et porte `noindex`. Ce n'est pas une protection ;
  c'est une façon de ne pas mettre l'échelle contre le mur.

> **Aucun de ces soins ne rend le modèle sûr.** Ils réduisent ce qui est réductible autour d'un
> choix qui, lui, reste un raccourci. C'est écrit dans la fonction, dans la migration, dans
> `config.toml`, dans les essais, et ici — cinq fois, parce qu'une dette qu'on ne relit qu'une
> fois est une dette qu'on oublie.


---

## P-29 — résolu : l'import qui disparaissait au build

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-29 | **Aucun bouton de langue** sur l'accueil en ligne. Ouvert depuis le 14/09, « mécanisme non élucidé » | mesuré le 15/09 : `accueil-public.html` **construit** charge 3 morceaux — **pas** `tabibi-langbar-*.js`. Le placeholder `[data-langbar]`, posé par `tabibi-header.js` à l'exécution, n'était **jamais rempli** | le module pose `window.tabibiLangbar` **au premier niveau** (effet de bord que le bundler ne peut plus ignorer) et les trois entrées appellent `init()` explicitement | `tests/e2e/selecteur-langue.spec.js` — **3 boutons, sur les sources ET sur `dist-web`** ; `tests/langbar-non-elidable.test.mjs` — le mécanisme | **réglé** |
| P-56 | Le switcher **flottant** était masqué **sans condition** — y compris quand aucun pill n'avait pu être injecté | sur l'accueil construit, le pill ne venait jamais **et** le flottant était caché : **aucun sélecteur de langue, nulle part** | il n'est masqué **qu'après** avoir constaté un pill | même essai : `cas-grave.html`, qui n'a pas de barre, **garde son flottant visible** | **réglé** |

### Le mécanisme, enfin

```
src/entries/index.js :  import '../../js/tabibi-langbar.js';
```

Un import à **effet de bord seul**. Le module n'exporte rien : Rollup ne voyait aucune valeur
consommée et **éliminait l'import**. Le morceau était bien construit — vingt-six pages le
chargent par `<script src>` — mais l'accueil construit ne le chargeait plus.

```
avant : accueil-public.html charge 3 morceaux, pas le langbar
après : il en charge 4, dont tabibi-langbar-*.js
```

⚠️ **Ma première mesure était trop étroite** et m'a fait conclure trop vite : j'ai cherché la
chaîne dans `accueil-public-*.js` seulement, et j'ai lu « le module a disparu ». Il n'avait
pas disparu — **c'est le lien vers lui qui avait disparu**, pour cette page. La différence
change le correctif.

### ⚠️ Pourquoi `export` était le bon réflexe et la mauvaise réponse

La correction naturelle — exporter une fonction et l'appeler — aurait cassé **vingt-six
pages** qui chargent ce fichier en `<script>` classique : `Unexpected token 'export'`.

> Réparer trois pages construites en cassant vingt-six pages servies, c'est le genre de
> correctif dont le diff a l'air impeccable. **Un test l'interdit désormais** : le fichier
> doit rester chargeable en script classique.

### P-56 était plus grave que P-29

`syncLangBtns()` masquait le flottant **sans condition**. Le flottant est le **filet** : on
ne retire un filet qu'après avoir constaté que l'autre chemin fonctionne. Ici, **le filet
était retiré avant que le trapèze arrive**.

### Et le timing

Le placeholder est posé **à l'exécution** par l'en-tête : `inject()` pouvait arriver avant
lui, ne rien trouver, et ne jamais repasser. Un `MutationObserver` rattrape — **borné à 8 s,
parce qu'une attente sans fin est une fuite, pas un filet**.

## 69 wilayas — et deux divergences trouvées en chemin

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-52 | Décret présidentiel 26-206 du 25/05/2026 : **58 → 69 wilayas**. La liste vivait **en dur dans le front**, à **quatre endroits** | `_W`, `WILAYA_I18N`, `assets/dz-wilaya-centroids.js`, `<select id="sw">` de `signup.html` | les onze ajoutées aux quatre endroits, avec libellés AR/EN et chef-lieu | `tests/wilayas-69.test.mjs` — les quatre listes comptent 69, **et disent la même chose** | **réglé** |
| P-53 | **`WILAYA_I18N` s'arrêtait à 48.** Les dix wilayas de 2019 n'avaient **ni arabe ni anglais** | `El M'Ghair`, `El Meniaa`, `Ouled Djellal`, `Bordj Baji Mokhtar`, `Béni Abbès`, `Timimoun`, `Touggourt`, `Djanet`, `In Salah`, `In Guezzam` — `dcity()` retombait sur le français **sans rien signaler** | les dix ajoutées | même test : **chaque** wilaya doit avoir un libellé, et le libellé « arabe » doit contenir des caractères arabes | **réglé** |
| P-54 | `signup.html` écrivait **« Bordj Badji Mokhtar »**, `_W` et la base **« Bordj Baji Mokhtar »** | **une lettre**. Un médecin qui choisissait cette wilaya à l'inscription posait une valeur que la recherche ne retrouvait pas | menu régénéré **à partir de `_W`** | même test : `signup.html` doit dire **exactement** les noms de `_W` | **réglé** |

| P-55 | **La liste était à 69, la phrase disait toujours « 58 wilayas ».** Et le bloc de statistiques affichait **58** | signalé par Aghiles **sur la page en ligne**, après le lot précédent : 14 mentions dans 7 fichiers (FR, EN, **et AR**), plus deux nombres écrits en dur | les 14 phrases corrigées ; le compteur **dérivé de `_W`** au lieu d'être recopié | même test : **aucune** phrase visible ne dit « 58 wilayas », le compteur est dérivé, **et le HTML servi vaut déjà 69** | **réglé** |

### ⚠️ Corriger la donnée ne corrige pas la phrase

Le lot précédent a mis les quatre **listes** à 69. Le titre de l'accueil disait toujours
« … partout en Algérie — 58 wilayas ».

> **Une donnée corrigée et une phrase qui la contredit, c'est pire qu'avant :** la page se
> contredit elle-même, et le lecteur croit la phrase. Aghiles l'a vu en une seconde sur la
> page en ligne — aucune de nos portes ne regardait le texte.

Quatorze mentions, sept fichiers, **trois langues** — l'arabe compte autant que le français :
c'est la même promesse, faite à quelqu'un d'autre.

### Le compteur est maintenant DÉRIVÉ, et c'est le vrai correctif

Le « 58 » du bloc de statistiques était **écrit en dur**, à deux endroits de
`accueil-public.html`. Le découpage a changé **deux fois** — 48 → 58 en 2019, 58 → 69 en
2026 — et ce nombre est resté faux **les deux fois**, sur la page d'accueil, à côté d'une
liste déjà corrigée.

> **Un chiffre recopié ne se met jamais à jour.** Il vient désormais de `Object.keys(_W)`,
> la même source que la liste : le prochain découpage ne demandera qu'un endroit.

Le HTML servi porte quand même `69` en dur **avant** que le script tourne — pour le lecteur
sans JavaScript, le robot d'indexation et la capture d'écran. **C'est testé aussi.**

### ⚠️ Quatre copies d'une même liste, c'est quatre occasions de diverger

Les deux défauts ci-dessus **existaient déjà**. Personne ne les cherchait : ils ont été
heurtés en ajoutant les onze nouvelles.

> **Une relecture n'attrape pas « Badji » contre « Baji ». Une comparaison l'attrape
> toujours.** C'est pour ça que la garde ne vérifie pas seulement le *compte* — elle exige
> que les quatre listes disent **la même chose**, nom par nom, code par code.

### Le grep de contrôle — ce qui a été cherché, et ce qui a été trouvé

| | |
|---|---|
| listes complètes de wilayas | **trois** : `_W` + `WILAYA_I18N` (`js/home-app.js`), `assets/dz-wilaya-centroids.js`, `signup.html`. **Les trois sont à 69.** |
| `patient-waitinglist.html` | **13 wilayas + « Autre wilaya »** — une liste courte *délibérée*, pas une liste tronquée. **Non touchée** |
| `scripts/generate-seo-pages.mjs` | aucune liste en dur : les couples viennent de la RPC `seo_couples()` |
| `seo/` (576 pages) | générées, hors périmètre ; elles suivront la prochaine génération |

⚠️ **Ce que ce lot ne fait pas** : le **re-routage des fiches médecins** vers les nouveaux
codes. C'est l'étape du stratège, après validation d'Aghiles. Tant qu'elle n'a pas eu lieu,
**les onze nouvelles wilayas sont sélectionnables et ne rendront aucun médecin** — c'est
attendu, et ce n'est pas un bug.

## 🔴 P-51 — la barre de recherche ne cherchait plus, depuis six jours

| | |
|---|---|
| **symptôme** | taper « cardiologue », « cardiologue béjaïa » ou un nom dans `#name-search` **sans choisir de menu** affichait « Choisissez une wilaya ou une spécialité » — et **n'appelait même pas le serveur** |
| **signalé par** | Aghiles, 15/09. **Six jours** après la régression |
| **cause** | durcissement C1 (`b878ff8`, 09/09) : `js/home-app.js` court-circuitait sur `if(!opts.ville && !opts.spec)`. Avant, le front filtrait le texte en mémoire |
| **côté base** | déjà corrigé en prod par le stratège : `chercher_praticiens` accepte `p_q` seul (index GIN). Mesuré en direct : `p_q='cardiologue'` → 1 526, `'cardiologue béjaïa'` → 14, `'benali'` → 131 ; menus inchangés → 23 |
| **correctif front** | `!opts.search` ajouté au court-circuit, **et** une analyse du texte libre qui pose `p_wilaya`/`p_specialite` quand un jeton correspond franchement à une valeur de la base |
| **garde** | `tests/recherche-texte-libre.test.mjs` (10 essais sur la fonction réelle, extraite du fichier) **et** `tests/e2e/recherche-texte-libre.spec.js` (5 parcours × 2 profils, qui **lisent ce qui part sur le réseau**) | 
| **statut** | **réglé** |

### ⚠️ Ce que cette régression apprend — et ce n'est pas « il manquait un `&&` »

> **Le garde-fou avait RAISON le 09/09.** La RPC refusait alors une recherche sans filtre :
> court-circuiter évitait un 400 garanti. Il a eu **tort** à la seconde où la RPC a accepté
> `p_q` seul.
>
> **Une garde correcte devient fausse quand ce qu'elle protège change, et rien ne le lui
> dit.** Ici, la contrainte vivait à deux endroits — une condition dans le front, une
> exigence dans la RPC — et seule la seconde a été mise à jour.

C'est le même motif que P-50 (une référence périmée) et P-41 (un captcha vérifié au mauvais
moment) : **ce n'était pas le *quoi* qui était faux, c'était le *quand*.** Trois fois en deux
jours.

### Pourquoi une analyse du texte, et pas seulement `p_q`

Le `&&` seul suffisait à réparer la panne. L'analyse ajoute que « cardiologue bejaia » — **sans
accent, comme on tape** — retrouve `Cardiologue` + `Béjaïa` au lieu de chercher les deux mots
en texte brut. La normalisation (minuscules, accents retirés) sert les deux côtés de la
comparaison.

⚠️ **Elle ne devine jamais à moitié** : un jeton doit correspondre **exactement** à une valeur
de la base. Un préfixe suffirait à faire d'un nom de médecin une spécialité — « Dr Cardin »
deviendrait « Cardiologue », et la recherche rendrait 1 500 fiches au lieu d'une. **C'est
testé, dans les deux sens.**

Et un menu choisi **prime toujours** : si l'utilisateur a rempli `f-ville` ou `f-spec`, rien
n'est deviné contre lui.

### La contre-épreuve qui manquait au correctif d'origine

Le cinquième essai de bout en bout vérifie qu'un **champ vide** ne déclenche **aucune**
recherche. Sans lui, supprimer le court-circuit — la correction la plus directe — aurait
envoyé une requête sans critère à chaque chargement de l'accueil, et personne ne l'aurait vu
passer.


---

## L'accueil montre enfin de vrais médecins

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-57 | L'accueil **annonçait « 75 000+ médecins » et n'en montrait aucun** : la liste affichait « Choisissez une wilaya ou une spécialité » | le court-circuit `if(!ville && !spec && !search)` datait du durcissement C1 : sans filtre, **aucune requête n'était envoyée** | `praticiens_vitrine(page, limite)` par défaut — de vrais praticiens, paginés ; dès qu'un filtre ou du texte arrive, on repasse à `chercher_praticiens` | `tests/e2e/accueil-vitrine.spec.js` — 8 parcours × 2 profils : cartes au chargement, **zéro état vide**, pagination qui avance, retour à la recherche | **réglé** |
| P-27 | La carte du héros montrait **« Dr. Amine · 09:30 »** — un médecin **inventé**, affiché comme un rendez-vous réel | même famille que les six articles de blog qui n'existaient pas (P-47) | l'identité inventée est retirée ; le reste de la carte est une illustration d'interface, pas une affirmation sur quelqu'un | même essai : aucun « Dr. Amine » dans le héros | **réglé** |
| P-58 | La bande **téléconsultation** disait « Bientôt » et renvoyait vers la **liste d'attente** — alors que le drapeau `video` est **ouvert en production** | P-12 et P-13 : la salle est en service, la CSP laisse passer | « Disponible », et le bouton mène à la réservation | même essai : le badge dit « disponible », **aucun lien vers `waiting-list`** | **réglé** |

### ⚠️ Ce qu'on ne promet toujours pas

**La vitrine ne compte pas.** `praticiens_vitrine` ne rend aucun total : compter 75 000 lignes
à chaque chargement d'accueil se paie. La pagination est donc « précédent / suivant », et
**« suivant » n'existe que si la page reçue était pleine**.

> On n'affiche pas « page 3 sur 3 750 » : ce serait un chiffre qu'on n'a pas mesuré. Le
> compteur dit **ce qu'on montre**, pas ce qu'on suppose. C'est la leçon du « 500+ inscrits »,
> appliquée là où elle coûte quelque chose.

⚠️ Et pour la téléconsultation : la bande annonce ce qui est **livré**, pas ce qui est
**éprouvé**. **Un appel réel entre deux navigateurs n'a toujours pas eu lieu** — c'est P-31,
qui reste ouvert.

### Une garde a changé de forme le jour même

L'essai de P-51 vérifiait la ligne exacte `if(!opts.ville && !opts.spec && !opts.search){ … }`.
Ce lot **supprime ce court-circuit entièrement** — la vitrine va plus loin que ce que la garde
protégeait.

> La vérifier telle quelle aurait fait échouer un lot qui améliore la chose. La supprimer
> aurait laissé un trou. **C'est l'intention qu'on garde** : un terme seul doit atteindre le
> serveur, et aucun retour anticipé ne doit s'intercaler avant la requête.

Et elle lit désormais **le code sans ses commentaires** : le commentaire qui *explique* la
suppression de `_renderChooseFilter` contenait son nom, et le test a conclu que la fonction
était revenue. **C'est la cinquième fois** qu'une garde de ce dépôt se fait avoir par sa
propre documentation.


## P-59 — le HTML disait vrai, le dictionnaire disait faux

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-59 | Le badge affichait **« Disponible »** et, juste dessous, le bouton disait toujours **« Être prévenu »** — sur la même carte, en ligne | `git grep "Être prévenu"` ne rend **rien** dans le dépôt, et `accueil-public.html` sert « Disponible » + « Prendre rendez-vous » depuis `b49f916` (P-58, fusionné). Le HTML est en `no-cache` (`_headers`) ; **`js/i18n/*.js` ne l'est pas partout** — `netlify.toml` pose `/js/* max-age=3600` | clés **renommées** (`v4_tes`→`v4_tes_live`, `v4_tec`→`v4_tec_book`) et libellé « Réserver une téléconsultation » (FR/EN/AR) ; les deux clés orphelines sont retirées des trois dictionnaires | `tests/teleconsultation-annonce.test.mjs` (5 essais) + 2 essais e2e. Contre-épreuves faites : un dictionnaire FR périmé et un bouton revenu à « Être prévenu » font **échouer 2 essais chacun** | **réglé** |

### Pourquoi les deux constats étaient vrais en même temps

Aghiles voyait un bouton faux ; moi je voyais un dépôt juste. Ni l'un ni l'autre ne se
trompait. `setLang()` **réécrit le HTML avec le dictionnaire** :

```js
const v = T(cle);
if (!v || v === cle) return;     // rien de mieux a mettre : on ne touche pas
el.textContent = v;              // js/home-app.js
```

Un vieux `v4_tec = "Être prévenu"`, servi depuis un cache d'une heure, gagnait contre un
HTML neuf. **Ce n'était pas le *quoi* qui était faux, c'était le *quand*** — troisième fois
en deux jours (P-41 captcha vérifié trop tôt, P-42 mot de passe changé trop tard, P-51 garde
correcte le 09/09 et fausse le 15/09).

### La parade, et pourquoi c'est un renommage et pas une correction de texte

Corriger la valeur n'aurait rien réglé : le cache aurait continué à servir l'ancienne
pendant une heure, et **la prochaine fois on ne l'aurait pas vue passer**. Une clé **neuve**,
un dictionnaire périmé ne la connaît pas : `v === cle`, et la ligne ci-dessus **ne touche
pas au HTML**. C'est la règle P-03 utilisée comme filet au lieu d'être subie.

> **Une clé neuve ne peut pas être servie périmée.**

La garde centrale, elle, ne vise pas le cache — elle vise l'**écart** : le texte écrit dans
le HTML et la valeur FR du dictionnaire doivent dire la **même phrase**. Tant qu'ils sont
d'accord, la version servie n'a plus d'importance. Le défaut n'était visible ni dans le HTML
seul (juste), ni dans le dictionnaire seul (cohérent avec lui-même) : **il était entre les
deux, et aucun des deux fichiers ne pouvait le voir.**

Et le fichier d'essai **lit le code sans ses commentaires** : le commentaire qui explique ce
problème cite « Être prévenu ». Sixième fois qu'une garde de ce dépôt manque de s'accuser
elle-même.

## P-61 — une porte qui rougissait une heure par nuit, et qui avait tort

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-61 | `verifier:toutes` ROUGE sur `parcours-4-fixture-sale` : le tableau de bord médecin affichait **« Aucun RDV aujourd'hui »** au lieu des quatre RDV de la fixture | l'essai datait sa fixture en **UTC** (`new Date().toISOString().split('T')[0]`), la page lit `window.tabibiTemps.aujourdhui()` — le jour du **cabinet**. Mesuré le 16/09 à 01 h 10 (Alger) : UTC `2026-09-15`, cabinet `2026-09-16` | la fixture se date dans le fuseau du cabinet, comme la page | `tests/fuseau-des-essais.test.mjs` — aucun essai ne fabrique un jour avec `toISOString()`, **plus la contre-épreuve** qui montre la divergence à 23 h 10 UTC et l'accord à midi | **réglé** |

### Ce que ce défaut avait de méchant

Il n'était faux **qu'une heure sur vingt-quatre**. Les KPI du même écran passaient — ils
filtrent par **mois**, identique des deux côtés ; seule la liste du **jour** tombait. Vingt-trois
heures par jour, la porte était verte et disait vrai.

> **Une porte verte à 14 h ne dit rien de ce qu'elle vaut à 00 h 10.** C'est la quatrième fois
> en deux jours que le défaut n'est pas dans le *quoi* mais dans le *quand* (P-41, P-42, P-51).

Et l'essai faisait exactement la faute que `js/tabibi-temps.js` existe pour supprimer — sa
docstring dit mot pour mot : « Remplace `new Date().toISOString().split('T')[0]`, qui rendait
le jour UTC ». `scripts/verifier-fuseau.mjs` ne regarde pas `tests/` : **le module et sa porte
couvraient le produit, pas ce qui le mesure.**

### La garde s'est accusée elle-même — septième fois

Au premier passage, elle échouait sur **sa propre contre-épreuve**, qui fabrique exprès un
jour UTC pour prouver la divergence. L'exemption est **nominative**, un seul fichier écrit en
toutes lettres : une règle large (« ignorer les fichiers qui parlent de fuseau ») aurait
rouvert le trou pour tous les autres. La contre-épreuve l'a attrapée ; la relecture, non.

## P-62 — ce qu'on demande ne s'affichait pas là où on l'a demandé

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-62 | Aghiles tape « ben » dans la barre du héros : les fiches trouvées sortent **tout en bas** de l'accueil, derrière cinq blocs de présentation | écart mesuré entre le bas du champ et le haut de `#sec-docs` : **2 921 px** sur mobile, **2 332 px** sur ordinateur — trois écrans de défilement pour voir ce qu'on vient de demander | les blocs qui s'intercalent portent `data-replier-recherche` et se replient tant qu'un filtre est actif. Après : **372 px** (mobile), **322 px** (ordinateur) | `tests/e2e/resultats-sous-la-barre.spec.js`, 7 essais × 2 profils. Contre-épreuve : sans la bascule, **4 essais sur 7 échouent** | **réglé** |

### On replie, on ne déplace pas

Remonter `#sec-docs` dans le DOM aurait corrigé la position **en cassant tout ce qui la vise** :
`scrollTo$('sec-docs')`, « Voir tout », la pagination — et un lecteur d'écran suit l'ordre du
DOM, pas l'ordre à l'écran. Un essai garde explicitement cet ordre (`compareDocumentPosition`).

Et on ne replie que la **présentation** : la barre, les deux menus, le tri, le curseur et les
puces restent à l'écran. Un utilisateur doit pouvoir corriger son terme sans remonter chercher
le champ.

### Deux notions de « est-ce qu'on cherche ? », dont une fausse

En posant la bascule, il en fallait une deuxième — `_updateResCount` en avait déjà une, écrite
à la main, pour choisir le message « Aucun médecin avec ces filtres ». **On l'a extraite
(`_filtresActifs`) au lieu de la recopier** : deux réponses à la même question finissent
toujours par diverger.

Et l'ancienne était **fausse** : elle lisait `opts.maxPrice != null`, or le curseur de prix
**démarre à 5 000 DA**. Elle répondait donc « oui, il filtre » dès le premier rendu, avant que
personne n'ait rien touché — la page se repliait toute seule au chargement. Le commentaire
d'origine disait pourtant l'intention, mot pour mot : « null si user n'a pas bougé le slider ».
La condition ne la tenait pas. `prixModifie` compare désormais à `defaultValue`.

> **C'est l'essai qui l'a trouvé, pas la relecture** — il mesurait un écart de 372 px là où il
> en attendait 2 900.

## P-65 — un appel à une fonction qui n'existe pas, avalé par un `catch`

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-65 | **Le changement de mot de passe échouait à tous les coups**, et l'écran répondait « Échec du changement — **réessayez** » | `getSupabase()` n'est défini **ni dans la page, ni dans aucun script qu'elle charge**. Essai e2e sur l'état d'avant : `updateUser` appelé **0 fois** — « Expected length: 1, Received length: 0 ». La demande ne quittait jamais le navigateur | le client vient de `window.tabibi.supabase`, posé par `js/supabase-client.js` — ce que faisait déjà `saveAll()` dans le même fichier. Et client absent ⇒ « Service d'authentification indisponible », plus « réessayez » | `tests/client-supabase-defini.test.mjs` (3 essais de source) + `tests/e2e/changer-mot-de-passe.spec.js` (4 essais × 2 pages) | **réglé** |

### La SEQ en signalait UNE page. Il y en avait DEUX.

`patient-profile.html:474` **et** `medecin-profile.html:971` — le même bloc, copié. Le nom
vient de `admin-cabinet.html` et `secretaire-dashboard.html`, où la fonction est bel et bien
**définie**, page par page (l. 201 et 218). Elle a voyagé **sans sa définition**.

> Chercher le défaut signalé et s'arrêter là aurait laissé la moitié du problème en place,
> avec sa garde à côté qui dit « réglé ».

### Ce que le `catch` a coûté

```js
}catch(e){
  console.warn('[changePassword]', e);
  toastM(tabibiT('toast_password_change_failed', "Échec du changement — réessayez."), "error");
}
```

Un `ReferenceError` — une faute de programmation, pas un incident réseau — était traité comme
un échec passager. Le message **invitait à recommencer une chose qui ne pouvait pas marcher**,
et c'est précisément ce qui l'a rendu invisible : un utilisateur qui réessaie et échoue encore
se croit fautif. Le `console.warn` disait la vérité ; personne ne lit la console d'un patient.

C'est la famille du cron des rappels qui affichait 4 531 exécutions « succeeded » en envoyant
le mot `TA_CLE` : **l'écran de contrôle disait autre chose que ce qui se passait.**

### Pourquoi deux gardes et pas une

La garde de **source** vérifie la référence : aucune page n'appelle `getSupabase()` sans la
définir, et `changePassword` tient un client qui existe. Elle ne peut pas dire si la fonction
**demande vraiment** le changement — une fonction peut être syntaxiquement juste et n'appeler
personne. La garde **e2e** appelle la fonction avec un client bouchonné et lit ce qu'elle lui
demande. Contre-épreuve faite dans les deux sens : sur l'état d'avant, **4 essais e2e sur 8**
et **2 essais de source sur 3** échouent.

Et la garde de source **lit le code sans ses commentaires** : le commentaire qui explique ce
défaut cite `getSupabase`. **Huitième fois** que ce piège se présente dans ce dépôt.

## P-66 — « Dr. -- » : le nom était là, à un champ de distance

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-66 | Le **médecin pilote** voyait **« Dr. -- »** sur son propre tableau de bord, à trois endroits (`med-name`, `prof-name`, `menu-name`) | le nom venait UNIQUEMENT de `users` : `(fn+' '+ln).trim() \|\| (a.email\|\|'').split('@')[0]`. Un pilote entre par son **numéro** — ni prénom, ni nom, **ni e-mail** : `''.split('@')[0]` vaut `''`. Essai e2e sur l'état d'avant : `Received string: "Dr. --"` | `completerDepuisLaFiche()` remplit `tabibi_user` depuis `doctor_profiles.full_name` **avant** les écritures DOM ; `js/tabibi-doctor-name.js` est enfin chargé par la page | `tests/e2e/nom-medecin-entete.spec.js` — 5 essais × 2 profils | **réglé** |

### La donnée était déjà chargée

`getMyProfile()` rend la **ligne entière** — `RETURNS doctor_profiles`, vérifié en base le
16/09 — et la page l'appelait déjà. Elle n'en lisait que `working_hours`.

> Ce n'était pas une donnée manquante, ni une requête à écrire : **c'était un champ qu'on
> n'avait pas regardé dans un objet qu'on tenait en main.**

### On corrige la SOURCE, pas les trois écrans

Repeindre `med-name`, `prof-name` et `menu-name` après coup aurait marché — jusqu'au
quatrième élément, ajouté un jour sans sa réparation. Et `renderProfile()` relit
`localStorage`, donc l'aurait écrasé au rendu suivant. On complète `tabibi_user` **avant** la
première écriture : tout ce qui lit `u.name` en hérite, y compris la salutation.

### Trois refus explicites

- **On ne prend pas la main sur un `users` qui a un nom.** Ce lot comble un trou ; il ne
  renomme pas les comptes qui vont bien. Un essai le garde.
- **On n'invente pas.** `tabibiDoctorName.format()` ne rend jamais vide : sans nom, il rend
  « Praticien ». Utile sur une liste publique, ce serait ici **fabriquer une identité** pour
  le médecin connecté et l'écrire dans son cache. On exige un `full_name` réel avant de
  formater. Sans fiche réclamée, le tiret reste — c'est la réponse honnête (P-27, P-47).
- **On ne redemande pas deux fois la même ligne.** L'agenda relit la fiche déjà chargée.

## P-67 — « Demande envoyée ! » : elle ne l'était pas, et le mot de passe restait

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-67 | `onboarding-medecin.html` faisait remplir **cinq écrans** à un médecin puis affichait « Demande envoyée ! … vous contactera **sous 48 heures ouvrées** ». **Rien ne partait.** | `submitAll()` poussait le dossier dans `localStorage.tabibi_doctor_applications` sous un commentaire « TODO : envoyer à Supabase ». La page ne charge **aucun** client Supabase, et **aucun code du dépôt ne lit cette clé** (mesuré). Le dossier contenait `password` **en clair** | (a) le mot de passe ne quitte plus le champ ; la clé locale est supprimée ; l'écran de succès est **retiré**, remplacé par ce qui s'est réellement passé, avec le chemin qui enregistre vraiment (`medecin-waitinglist.html` → `waiting_list`) | `tests/e2e/onboarding-medecin-honnete.spec.js` — 5 essais × 2 profils. Contre-épreuve sur la page d'avant : **4 sur 5** échouent | **partiel — (b) ouvert** |

### Ce défaut-là faisait ATTENDRE quelqu'un

C'est la famille de « 500+ inscrits » (P-01) et de « e-mail envoyé » (P-28) : un écran de
succès sur une opération qui n'a pas eu lieu. Celui-ci va plus loin — il donne un **délai**.
Un médecin qui a saisi son n° au Conseil de l'Ordre, son cabinet et ses tarifs attendait
48 heures un appel qui ne pouvait pas venir, et n'avait aucune raison de relancer.

### Le mot de passe

`password` était lu, mis dans l'objet, et écrit en clair dans `localStorage` — sur la machine
du médecin, sans limite de durée — **alors qu'aucun compte n'était créé**. Un mot de passe qui
ne sert à rien et qui traîne est un mot de passe qu'on a pris sans raison. Le champ reste : il
servira quand il y aura un compte à créer.

### Pourquoi l'écran de succès est SUPPRIMÉ, pas masqué

Un bloc de succès qui dort dans le DOM est une invitation à le rebrancher sans sa persistance.
Il reviendra **avec** elle. Un essai garde son absence.

Et on ne remplace pas un mensonge par un cul-de-sac : après cinq formulaires, l'écran dit ce
qui s'est passé **et** donne le seul chemin médecin qui persiste aujourd'hui.

### (b) reste ouvert — voir la table des ouverts (P-68)

Aucun chemin serveur n'existe pour une candidature : ni table `doctor_applications`, ni RPC,
ni fonction edge. `waiting_list` existe et accepte `role='medecin'`, mais elle ne porte
qu'un contact (e-mail, téléphone, wilaya, spécialité) : y déverser une candidature perdrait
le n° d'ordre, l'adresse, le cabinet, les tarifs, le plan et les consentements horodatés.
**Rien n'a été créé en base** — la proposition est dans le RETOUR de la SEQ 55.

## P-68 (b) — la candidature part enfin quelque part

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-68 b | Une candidature de médecin **n'avait aucun endroit où aller** : la page ne chargeait aucun client Supabase | la destination existe désormais — `public.soumettre_candidature_medecin(p jsonb) returns uuid`, lue en base le 16/09 : `security_definer = true`, `EXECUTE` pour `anon` et `authenticated`, et les 20 clés qu'elle extrait de `p` correspondent une à une au formulaire | la page charge le SDK + `config.js` + `supabase-client.js` + **`tabibi-rpc.js`**, et `submitAll()` appelle la RPC **par la passerelle**. L'écran de succès ne s'affiche que sur un **uuid rendu** | `tests/e2e/onboarding-medecin-honnete.spec.js` — 12 essais × 2 profils | **réglé (b1)** |

### « Ça n'a pas levé » n'est pas « c'est enregistré »

Le succès est conditionné à un **identifiant**, vérifié par forme, pas à l'absence d'erreur.
Quatre façons de ne pas en avoir sont gardées une par une, parce que chacune a déjà été prise
pour un succès quelque part dans ce dépôt :

| la passerelle rend | ce qu'on affiche |
|---|---|
| `{ok:false, erreur:'rls_denied'}` | échec |
| `{ok:true, data:null}` | échec |
| `{ok:true, data:''}` | échec |
| `{ok:true, data:'ok'}` | échec |
| `{ok:true, data:'<uuid>'}` | **succès, avec la référence affichée** |

### Ce que l'écran ne dit plus

L'ancien promettait un rappel « **sous 48 heures ouvrées** ». Tenir un délai suppose que
quelqu'un relise les dossiers ; rien ne le garantit encore (voir P-69). Le nouvel écran
n'annonce **aucun délai** : il donne la référence, et un essai vérifie que « 48 heures » n'est
pas revenu.

### Deux choses ajoutées parce que l'envoi est devenu réel

- **Un verrou d'envoi.** Tant que `submitAll()` n'écrivait que dans `localStorage`, un
  double-clic était sans conséquence. Il déposerait maintenant **deux lignes** — et l'index
  unique sur le n° d'ordre ferait échouer la seconde, donc afficher un échec **après** un
  succès. Le second clic est rendu impossible, pas seulement inutile ; le bouton revient si
  l'envoi échoue, sinon une coupure réseau condamnerait la page.
- **Un message propre au refus de débit.** La RPC limite à 3 dépôts par heure. « Réessayez »
  n'y est vrai qu'au bout d'une heure — c'est exactement la leçon de P-65, où un « réessayez »
  invitait à recommencer une chose qui ne pouvait pas aboutir.

### Le mot de passe, toujours pas

Ni la table ni la RPC n'ont de champ pour lui : le compte se créera après vérification. Un
essai vérifie qu'il n'apparaît **ni dans le payload, ni dans le stockage local**. Un mot de
passe transporté « pour plus tard » est un mot de passe stocké quelque part.

### ⚠️ Le bouchon ne prouve pas que la page charge la passerelle

Onze des douze essais **remplacent** `tabibiRpc`. Si la page ne la chargeait pas, ils
resteraient verts et la vraie page n'enverrait rien — c'est exactement ce qui est arrivé au
sélecteur de langue (P-29), vert sur les sources et absent du build. Le douzième essai va donc
lire `typeof window.tabibiRpc` et le client sur la page **réellement chargée**.

## P-70 — le cœur des favoris ne faisait rien à l'écran

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-70 | Le patient clique sur le **cœur** d'un favori : **rien ne bouge**. Il reclique, le favori revient. Il faut recharger pour voir l'état vrai | `toggFav()` appelait `renderDocs()`, définie **uniquement** dans `js/home-app.js`, que `patient-dashboard.html` ne charge pas. Mesuré au navigateur : `{"renderDocs":"undefined"}` et `APPEL toggFav -> LANCE: renderDocs is not defined` | l'appel devient optionnel — la forme déjà utilisée dans ce fichier pour `_legacyOpenReview` | `tests/e2e/favoris-patient.spec.js` — 4 essais × 2 profils | **réglé** |

### L'ordre des instructions décidait de tout

```js
localStorage.setItem("tabibi_favs", …);   // passe
renderDocs();                             // LÈVE
renderFavs();                             // jamais atteint
toastM(…);                                // jamais atteint
```

L'état changeait en mémoire, l'écran non. **Le défaut était donc invisible dans le stockage**
— un essai qui aurait seulement vérifié `tabibi_favs` serait resté vert. C'est pourquoi la
garde regarde aussi le **toast**, dernière instruction de la fonction, et les erreurs de page.

Même famille que P-65 (`getSupabase` appelé sans exister) : un nom absent, une exception, une
moitié de fonction qui ne s'exécute pas. Ici il n'y avait même pas de `catch` pour l'avaler —
juste personne pour lire la console d'un patient.

### La garde vérifie d'abord sa propre condition

Le premier essai affirme que cette page **n'a pas** `renderDocs`. Sans lui, le jour où
quelqu'un chargerait `js/home-app.js` ici, la suite passerait toute seule et les trois autres
essais resteraient verts **sans rien prouver** : ils garderaient une page qui n'a plus le
problème, pas un correctif.

### Trouvé en construisant la garde d'un autre défaut

Ce bug n'a été cherché par personne. Il est sorti d'un prototype de détection des fonctions
appelées mais jamais définies, écrit pour P-65. Ce prototype rendait **105 noms non résolus**,
presque tous faux (mots français dans des chaînes, `var(` de CSS, paramètres de callbacks) :
trop bruyant pour devenir une porte. Les quatre pistes plausibles ont été vérifiées **une par
une** — `loadUser`, `renderUserUI`, `hideLoading`, `tabibiT` sont tous protégés par
`typeof X === 'function'`, appels optionnels délibérés. Une seule était réelle.

> **Un outil trop bruyant pour être une porte peut rester un bon outil de fouille** — à
> condition de vérifier chaque touche avant d'y croire.

## Lot 360 — P-71 à P-81

> ⚠️ **La numérotation saute volontairement de P-70 à P-71.** Pendant l'écriture de ce lot,
> P-69 et P-70 vivaient sur `lot/onboarding-rpc-favoris`, pas encore fusionné : numéroter
> par-dessus aurait donné **deux problèmes différents sous le même identifiant** le jour de la
> fusion. Ce jour est arrivé (#144, 16/09) — les deux sections sont juste au-dessus, et rien
> n'est entré en collision. Le saut était le prix à payer, et il valait moins cher que la
> collision.

## P-71 — deux puces ne pouvaient rien trouver, jamais

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-71 | Les puces **« Urgences »** et **« Femmes »** rendaient **toujours zéro résultat**, et l'écran répondait « Aucun médecin avec ces filtres » | elles filtrent sur `d.urgent` et `d.g === 'F'`, deux champs **fabriqués à l'hydratation** : `urgent: false` et `g: 'H'`, en dur, pour les 75 035 praticiens. Lecture en base le 16/09 : **aucune colonne de genre ni d'urgence**, ni dans `doctor_profiles`, ni dans `public_doctors` | les deux puces ne sont plus rendues (`PUCES_SANS_DONNEE`) ; l'hydratation cesse d'affirmer une valeur qu'elle n'a pas (`!!d.is_urgent`, `d.gender \|\| null`) | `tests/e2e/puces-recherche.spec.js` — 3 essais × 2 profils | **réglé** |

### Un message qui accuse la recherche

« Aucun médecin avec ces filtres » invite à élargir sa recherche. Ici, aucun élargissement
n'aurait marché : la faute n'était pas dans la demande, elle était dans la donnée. L'utilisateur
ne pouvait pas le deviner, et rien ne le lui disait.

### On masque, on ne supprime pas — et on garde les deux filtres

Les deux branches de filtrage sont **justes** ; c'est la donnée qui manquait. Elles restent, et
`PUCES_SANS_DONNEE` est la seule ligne à modifier le jour où la colonne arrive. Supprimer
aurait obligé à tout réécrire, donc à réinventer le même filtre — et peut-être moins bien.

### La garde ne compte pas les puces, elle les essaie

Elle prend celles que la page **rend**, les clique une par une, et vérifie qu'aucune ne vide la
liste alors que le lot reçu devrait passer. Une puce ajoutée demain sur une colonne absente
échouera ici sans que personne n'ait à y penser.

> ⚠️ **Et elle a d'abord été fausse.** Écrite sans attente, elle vérifiait « il y a 7 fiches »
> juste après le clic — donc **avant** que `doFilter()` (débounce 300 ms) ait filtré. Elle était
> vraie immédiatement, et **verte même avec les puces mortes remises**. La contre-épreuve l'a
> montrée ; la relecture, non. On laisse passer la fenêtre, puis on mesure.

## P-72 — un filtre que personne n'avait posé, un reset qui ne remettait rien

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-72 | Le post-filtre de **prix s'exécutait au chargement** : tout praticien à plus de 5 000 DA disparaissait de l'accueil sans qu'aucun filtre ait été posé. Et après **« réinitialiser »**, la page restait **repliée** | la condition était `opts.maxPrice != null`, or le curseur **démarre à 5 000**. Et `resetFilters()` posait **10 000** alors que la valeur d'origine est 5 000 : `prixModifie` valait donc `true` après un reset | le post-filtre suit `prixModifie` (le curseur a-t-il **bougé**), et le reset revient à `fp.defaultValue` — ce que le HTML déclare | `tests/e2e/filtre-prix.spec.js` — 5 essais × 2 profils. Contre-épreuve : les deux défauts remis, **5 sur 5** échouent | **réglé** |

### Une seule cause, deux symptômes

> **« Une valeur est posée » n'est pas « quelqu'un a choisi ».**

C'est la même distinction que celle extraite la veille pour `_filtresActifs` (P-62), au même
endroit du code, et elle avait été corrigée **là** sans l'être **ici** : la notion de « filtre
actif » lisait déjà `prixModifie`, le post-filtre lisait encore `maxPrice != null`. Deux
lectures du même curseur, dans le même fichier, qui ne disaient pas la même chose.

### Latent n'est pas inoffensif

Mesuré le 16/09 : **75 035 / 75 035** fiches n'ont aucun tarif, et un tarif absent passe le
filtre. Personne ne disparaissait donc — **aujourd'hui**. Le premier médecin qui saisit 6 000 DA
disparaissait de l'accueil sans explication. La garde fabrique exprès ce praticien : un essai
sur des fiches sans tarif serait vert dans les deux sens et ne prouverait rien.

### Le reset et la valeur d'origine

`fp.defaultValue`, c'est exactement ce que l'attribut `value` du HTML déclare. Une seule source :
le jour où le curseur démarrera ailleurs, le reset suivra tout seul. Recopier `10000` était la
même faute que les « 58 wilayas » recopiées (P-50) — **un chiffre recopié ne se met jamais à
jour**.

## P-73 — un nom de membre allait brut dans la page qui peut retirer des membres

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-73 | `admin-cabinet.html` (liste des membres) et `secretaire-dashboard.html` (menu des médecins) injectaient `full_name`, `specialty_fr`, `role` et `user_id` **sans échappement** dans `innerHTML` | la donnée vient de `cabinet_members_directory_view`, donc de ce qu'un membre a saisi. Essai : un nom `<img src=x onerror=…>` **marquait `window.__xss`** sur les deux pages | échappement par `window.esc` / `window.escAttr` (`js/tabibi-security.js`, chargé ligne 5 des deux pages) | `tests/e2e/xss-membres-cabinet.spec.js` — 3 essais × 2 profils | **réglé** |

### La protection existait à côté du trou

`admin-cabinet.html` portait déjà un `_escAttr` **local** — une quatrième copie de l'échappeur
du dépôt — qui protégeait les attributs `data-*` du bouton « retirer ». Pendant ce temps, le
**texte** juste au-dessus partait brut. La copie locale est remplacée par `window.escAttr` : une
copie de moins, et le texte protégé.

### Pourquoi celui-ci compte plus que la moyenne

La charge s'exécutait dans **la page d'administration du cabinet** — celle qui liste les membres
et peut les retirer. Son lecteur est, par construction, celui qui a le plus de droits.

### La garde ne cherche pas `&lt;`

Chercher l'entité échappée dans le HTML serait garder une **orthographe**. La charge écrit une
marque globale si elle s'exécute ; on regarde la marque. Et un troisième essai vérifie que
**cette charge est bien exécutable** dans ce contexte — sans lui, les deux premiers seraient
verts sur une page non protégée si `onerror` ne se déclenchait pas (CSP, image jamais chargée).

Enfin, un contrôle que l'échappement n'a pas **effacé** le membre : un écran vide passerait le
test de sécurité sans protéger personne.

## P-74 — le filtre PII de Sentry était posé sur le seul champ que presque rien n'emprunte

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-74 | `beforeSend` n'anonymisait que `event.message`. Une exception **levée** — le cas courant — partait chez Sentry avec l'e-mail et le téléphone en clair | `event.message` n'est renseigné que par `captureMessage()`. Le texte d'une exception vit dans `event.exception.values[].value` ; le reste dans `event.breadcrumbs[].message` / `.data` et `event.request.url` | passe **récursive bornée** sur l'événement entier (profondeur 8, 400 nœuds, cycles coupés), plus une rédaction des query-strings **par nom de paramètre** | `tests/sentry-anonymisation.test.mjs` — 10 essais | **réglé** |

### Le filtre existait, il regardait ailleurs

Ce n'est pas un oubli de protection : c'est une protection posée au mauvais endroit. **Une garde
qui couvre un cas rare et affiche vert rassure sur ce qu'elle ignore** — le motif du compteur
`innerHTML` qui voyait 29 cas sur 134, et celui de `verifier:fuseau` qui ne lisait pas `tests/`.

### La query-string se rédige par NOM, pas par motif

`?token=…` n'a la forme ni d'un e-mail ni d'un numéro, et c'est pourtant ce qu'on veut le moins
voir partir chez un tiers. On rédige donc par nom de paramètre (`token`, `key`, `secret`,
`password`, `email`, `phone`…), puis on passe les motifs sur ce qui reste. Et **on ne détruit
pas ce qui sert à déboguer** : le chemin et les paramètres anodins survivent — un essai le garde.

### ⚠️ La garde a d'abord prouvé la mauvaise chose

Écrite d'un trait, elle appelait la fonction de nettoyage **prise à part**. Contre-épreuve :
`beforeSend` ramené à `event.message` — **les 8 essais sont restés verts**. Ils prouvaient qu'un
nettoyeur juste existe, pas qu'il soit **branché**.

> C'est le défaut réparé ici, reproduit dans sa propre garde : une fonction peut être juste et
> n'être jamais appelée.

Deux essais passent désormais par la configuration **réellement remise à `Sentry.init`** — le
faux SDK est posé par `document.head.appendChild`, qui déclenche `onload`. La contre-épreuve
les fait échouer.

### Et une borne, pas par élégance

Un `beforeSend` coûteux ralentit **chaque** erreur de la page, donc finit par être retiré — ce
qui serait pire que pas de filtre. Un événement cyclique ferait geler l'onglet : les cycles sont
coupés. Les deux cas ont leur essai.

## P-75 — « Un SMS et un email de confirmation vous ont été envoyés »

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-75 | `success.html` annonçait, après **chaque** réservation, deux envois. **Aucun des deux n'existe** | SMS : `js/tabibi-sms.js` porte `enabled: false` et `window.tabibiSMS` **n'est appelé nulle part**. E-mail : ni `reservation.html` ni `js/tabibi-booking.js` n'appellent `sendEmail` — et la boîte d'envoi prévue en base, `appointment_notifications` (déclencheur `trg_appointment_confirmed_outbox`), contient **0 ligne dont 0 envoyée** au 16/09 | la phrase dit ce qui est vrai : le rendez-vous est enregistré et retrouvable. Une seconde ligne prévient qu'aucun SMS ni e-mail ne partira | `tests/canaux-annonces.test.mjs` — 5 essais | **réglé** |

### Ce défaut-là fait ATTENDRE

Le patient ne relance pas : on lui a dit que c'était parti. C'est la famille de P-28
(« e-mail envoyé » sur trois parcours) et du cron des rappels qui affichait 4 531 exécutions
« succeeded » en envoyant le mot `TA_CLE`.

### Ce qui est vrai, et qui a été vérifié avant d'être écrit

Le rendez-vous **est** enregistré, il apparaît dans « Mes rendez-vous », et la cloche de
notification fonctionne — `public.notifications` : 17 lignes, 5 lues. On ne remplace pas une
promesse par du vide : on dit où retrouver le rendez-vous, et on conseille de garder le
récapitulatif imprimable qui existait déjà.

### La garde ne interdit pas un mot, elle exige un émetteur

Garder « la phrase ne doit pas dire SMS » aurait bloqué le jour où le SMS marchera. La règle
est : **un canal ne s'annonce que s'il a un émetteur.** Le fichier mesure d'abord s'il en
existe un — module activé **et** appelé — et n'exige le silence que dans le cas contraire. Le
jour où quelqu'un branche l'envoi, le premier essai échoue avec le message
« `success.html` PEUT et DOIT l'annoncer de nouveau ». **Une garde qui se périme toute seule
est une garde qu'on désactive ; celle-ci change d'exigence au lieu de se périmer.**

## P-76 — trois vaccins écrits en dur, affichés à tous les patients

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-76 | `patient-profile.html` affichait à **chaque** patient « COVID-19 (rappel) · Pfizer · 12 mars 2024 », « Tétanos / Diphtérie · 8 juin 2022 », « Grippe saisonnière », pastilles vertes **« À jour »** comprises | les trois blocs sont écrits en dur dans le HTML. À côté, la **carte santé** (`#hc-blood`, `#hc-imc`, `#hc-age`, `#hc-allergies`) n'était **jamais remplie**, et « membre depuis **2025** » était figé | tout est alimenté par `patient_medical_data` (déjà chargé dans le formulaire) ; « — » quand la base ne rend rien ; la pastille « membre depuis » disparaît faute de date | `tests/e2e/profil-patient-vraies-donnees.spec.js` — 9 essais × 2 profils. Contre-épreuve sur la page d'avant : **7 sur 9** échouent | **réglé** |

### Ce n'était pas du décor

Le reste de la page — la carte de réservation d'exemple, les portraits de la vitrine — est
assumé comme vendeur. **Celui-ci était une affirmation médicale sur quelqu'un, sur la page de
son propre dossier.** Un patient pouvait y lire qu'il était à jour du tétanos sans l'avoir
jamais été, et le croire : c'est sa fiche, pas une brochure.

### « On ne sait pas » et « zéro » ne se valent pas

Les compteurs de rendez-vous lisaient `tabibi_rdv`. **Ce n'est pas une clé morte** — contrairement
à ce que l'audit supposait : `patient-dashboard.html` y écrit ce qu'il a lu du serveur. Mais tant
que le patient n'a pas ouvert son tableau de bord, elle n'existe pas, et « 0 RDV total » était
alors une **affirmation**, pas un compte. Un patient qui a trois rendez-vous lisait zéro.

Tiret tant qu'on n'a rien lu, chiffre dès qu'on a lu. Les favoris, eux, sont écrits par la page
elle-même : absent y signifie vraiment zéro, et ils restent à `0`.

### Un IMC ne se calcule pas sur une saisie aberrante

3 cm et 900 kg sont des fautes de frappe. Un IMC calculé dessus serait un nombre **affirmé
faux**, et pire qu'un tiret : il a l'air d'un calcul. Bornes de plausibilité, sinon « — ».

### Construit en DOM, et c'est mesuré

La première version assemblait des chaînes : le cliquet `verifier:innerhtml` est monté de **135
à 136**. Réécrit en nœuds DOM (`textContent`) — le compteur est revenu à 135, et il n'y a plus
aucune liste de caractères à penser à interdire. Un essai vérifie qu'un nom de vaccin piégé ne
s'exécute pas.

## P-77 — deux copies du nombre de wilayas dormaient ailleurs

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-77 | `js/tabibi-dawini.js` refusait toute demande venant d'une wilaya **au-dessus de 58** — les onze nouvelles étaient rejetées par un contrôle de saisie, **silencieusement**. `js/tabibi-brevo.js` promettait « **48 wilayas** » dans l'e-mail de bienvenue | le lot P-49/P-50 avait aligné les quatre listes et les phrases de l'accueil ; ces deux-là vivaient dans des modules que personne n'avait ouverts | Dawini : `NB_WILAYAS`, **comparé à `_W` par un essai**. Brevo : la phrase se passe du nombre | `tests/wilayas-69.test.mjs` (+2 essais, 13 au total) | **réglé** |

### Le second ne dit plus de nombre du tout

Le découpage a changé **deux fois** (48 → 58 en 2019, 58 → 69 en 2026) et cette copie est restée
fausse les deux fois. Et elle part **par e-mail** : une fois expédié, on ne le corrige plus.
Écrire 69 serait la troisième copie à périmer ; ce module n'a pas accès à la liste. **Une phrase
sans chiffre ne se périme pas.**

### Le premier garde son nombre, mais avec un témoin

Dawini ne peut pas lire `_W`. Le nombre reste écrit — et un essai le **compare** à `_W` : le
jour où l'un bouge sans l'autre, la porte rougit. L'essai ne vérifie pas « c'est 69 », ce serait
recopier le chiffre une cinquième fois, dans la garde.

> Un contrôle de saisie qui refuse sans rien dire est le pire endroit où laisser un nombre
> périmé : personne ne voit d'erreur, la demande disparaît simplement.

## P-78 — une candidature persistait, et personne ne la lisait

> ⚠️ **Cette fiche ferme la moitié « aucun écran ne la lit » de P-69**, ouverte la veille par
> le lot d'à côté. L'autre moitié — personne n'est prévenu à l'arrivée d'un dossier — reste
> ouverte sous **P-79**.

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-78 | L'inscription médecin **enregistre** depuis la veille, et **aucun écran ne lisait** `doctor_applications`. L'écran de dépôt disait « Nous vous écrirons » | la table et la RPC sont en place ; la RLS réserve la lecture aux admins ; aucune page ne l'interrogeait. La candidature partait dans une table que personne n'ouvrait | `admin-candidatures.html` — liste **en lecture seule**, filtres par statut, construite en DOM, plus un bouton « Candidatures » au tableau de bord admin | `tests/e2e/admin-candidatures.spec.js` — 9 essais × 2 profils | **réglé** |

### La forme douce du tableau de bord vert

Le système marchait, et personne ne regardait. C'est exactement le cron des rappels qui
affichait 4 531 exécutions « succeeded » en envoyant le mot `TA_CLE` — sauf qu'ici rien
n'affichait de faux succès : il n'y avait **aucun écran du tout**, ce qui est la même
information, en silence.

### L'essai qui compte est celui qui parle d'une AUTRE page

Une liste que personne ne sait ouvrir laisse le défaut intact. Un essai vérifie donc que le
**tableau de bord admin mène à cette page** — sur la page **servie**, pas sur le fichier du
dépôt, parce que la suite tourne aussi sur `dist-web` et que c'est le build que le visiteur
reçoit (P-29). Sans ce lien, les huit autres essais gardent une page que personne n'atteint.

### Une erreur de lecture doit SE VOIR

Une liste vide sur une RLS qui refuse se lit « personne ne s'inscrit » — et on en conclurait
que le formulaire est cassé, ou pire, qu'il n'intéresse personne. L'échec est affiché comme un
échec ; un essai le garde.

### Lecture seule, et construite en DOM

Changer un statut serait une **écriture en base**, hors du périmètre de ce lot. La page montre
ce qui est arrivé ; décider vient après (voir P-79 pour ce qui manque encore).

Les champs viennent d'un formulaire **public** : la page est construite en nœuds DOM
(`textContent`), il n'y a donc rien à échapper — donc rien à oublier d'échapper. C'est la leçon
de P-73, appliquée **avant** d'avoir le défaut.

## P-80 — une file qui pouvait doubler un rendez-vous et écrire un jeton sur le disque

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-80 | `tabibi_pending_writes` rejouait des `POST`/`PATCH` **sans idempotence**, et rangeait `opts` **tel quel** dans `localStorage` — en-têtes compris, donc `Authorization: Bearer …` | **latent** : mesuré le 16/09, `tabibiFetch` n'a **aucun appelant** dans le dépôt. Rien ne remplissait cette file | les identifiants ne sont jamais rangés ; une écriture n'entre en file que **déclarée rejouable et munie d'une clé d'idempotence**, renvoyée en en-tête `Idempotency-Key` | `tests/file-ecritures-hors-ligne.test.mjs` — 6 essais. Contre-épreuve : ancienne mise en file, **5 sur 6** échouent | **réglé côté client — serveur ouvert** |

### Un `POST` qui expire n'a pas échoué

Son résultat est **inconnu** : le serveur l'a peut-être enregistré avant que le délai tombe. Le
rejouer, c'est risquer un second rendez-vous sur le même créneau — et le patient ne verrait
qu'un message de succès.

> **Perdre une écriture est réparable** — l'utilisateur recommence. **En créer deux ne l'est
> pas** : personne ne sait qu'il y a un doublon.

### Latent n'est pas acceptable

L'absence d'appelant est ce qui rend la correction **sans risque**, pas ce qui rendait le défaut
tolérable. Un défaut latent attend un appelant — c'est exactement l'histoire du curseur de prix
(P-72), inoffensif tant qu'aucun tarif n'est saisi.

Un essai garde ce constat : le jour où quelqu'un appelle `tabibiFetch`, il échoue en disant de
relire cette fiche. Ce n'est pas une règle, c'est un **réveil**.

### ⚠️ Ce qui reste, et pourquoi la file est de fait fermée

**Aucun serveur ne lit `Idempotency-Key` aujourd'hui.** Tant que ce n'est pas le cas, aucune
écriture ne devrait être déclarée rejouable — et aucune ne l'est. Mieux vaut une file vide
qu'une file qui double des rendez-vous.

À décider (écriture en base : validation requise) : une table `idempotence(cle, reponse,
cree_le)` et un contrôle en tête des RPC d'écriture, ou l'équivalent dans une fonction edge.

## P-81 — une ordonnance au nom de « 3f2504e0... »

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-81 | `medecin-ordonnance.html` affichait **les huit premiers caractères d'un identifiant technique** à la place du nom du patient | le nom était lu dans `public.users`, dont la RLS **scope par `auth.uid()`** : un médecin n'y voit que sa propre ligne. La requête ne levait pas, elle rendait **rien**, et le code tombait dans son `else` : `pid.slice(0, 8) + '...'` | lecture par `doctor_patients_directory` — vérifié en base le 16/09 : `authenticated: SELECT`, filtre `auth.uid()`, passe par `appointments`. Même périmètre, sans la RLS qui bloque | `tests/e2e/ordonnance-nom-patient.spec.js` — 4 essais × 2 profils. Contre-épreuve : **4 sur 4** échouent, sur `"3f2504e0..."` | **réglé** |

### La même correction avait déjà été faite, ailleurs

`js/tabibi-messaging.js:71` porte **le même commentaire**, daté du **05/08/2026**, pour le même
motif. Le correctif avait été appliqué à un appelant et pas à l'autre.

> C'est la faute de P-65 — `getSupabase` copié sans sa définition — dans l'autre sens : une
> **correction** qui n'a pas voyagé jusqu'à tous ses sites.

### Un identifiant ne sert jamais de nom

Sur un document médical, « 3f2504e0... » ressemble à un nom tronqué : le médecin ne se dit pas
que c'est une panne. On préfère écrire « Patient non identifié » — un message est une
information, un identifiant déguisé n'en est pas une. Trois essais couvrent les trois façons de
ne pas avoir de nom : refus de lecture, ligne absente, ligne aux deux champs vides.

### Au passage

`verifier:rpc-passage` réclamait depuis un moment l'abaissement du plafond de
`patient-ordonnances.html` (0 appel direct, plafond 1). Fait. **Un cliquet qu'on n'abaisse pas
laisse revenir ce qu'il vient de faire disparaître.**

## P-82 — la porte tuait ce qu'elle mesurait, puis l'accusait

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-82 | CI **rouge sur `e2e`** dans `verifier:toutes`, sans qu'aucun test ne soit nommé — pendant que la suite passait | `spawnSync` capture en **mémoire**, plafonné à 1 MiB. Mesuré : `status: null`, `signal: SIGTERM`, `error: ENOBUFS`, stdout 82 942 o + stderr **960 887 o**. Le script faisait `r.status === null ? 1 : r.status` → **1** | la sortie part **directement dans un fichier** (aucun plafond), et un enfant **tué** est rapporté comme tel, pas comme un essai en échec | `tests/porte-sortie-volumineuse.test.mjs` — 4 essais. Contre-épreuve : ancien lancement remis, **2 sur 4** échouent | **réglé** |

### Le mesureur fabriquait le rouge

`npm run verifier:toutes` sortait rouge à la seconde où `npx playwright test`, sur la même
machine et le même serveur neuf, rendait **502 passed**. La porte tuait la suite à quelques
essais de la fin, puis rapportait qu'elle avait échoué.

> C'est le symétrique exact du **faux vert** que ce dépôt traque depuis le début : ici le
> tableau de bord est rouge, et il a tort. Le coût est le même — on cherche le défaut là où
> il n'est pas.

Et le signe qui aurait dû alerter était **dans le message** : l'extrait ne nommait aucun test
tombé. Il n'en nommait aucun parce qu'aucun n'était tombé.

### Pourquoi ce jour-là, et pas avant

Le serveur statique de Playwright imprime **une ligne d'accès par requête**, sur stderr. La
suite est passée à 502 essais, stderr a franchi le mégaoctet, et le plafond est tombé au milieu
d'un lot qui n'y était pour rien — d'où trois heures passées à soupçonner les six nouveaux
essais, puis à les durcir.

> **Un plafond qu'on ne voit pas monter est un plafond qu'on franchit sans le savoir.**
> Famille du `tail -1` de la boucle shell (13/09) et des « 25 dernières lignes » (P-53) : le
> mesureur regarde une position, pas un contenu.

### Ce que la garde vérifie, et pourquoi en deux moitiés

Le **mécanisme** d'abord — une capture mémoire meurt au-delà du plafond, un descripteur de
fichier n'a pas de plafond. Sans cette moitié, la règle du dessous serait une convention que
personne ne saurait justifier, et qu'on « simplifierait » un jour.

⚠️ Et l'essai du mécanisme a lui-même été **faux au premier jet** : l'enfant appelait
`process.exit(0)`, or les écritures sur un tube sont asynchrones — la sortie était tronquée à
un seul morceau, le plafond n'était jamais atteint, et l'essai concluait que le mécanisme
n'existait pas. Il existait ; c'était l'enfant qui trichait.

### Dixième fois : une garde avalée par des commentaires

Le lecteur de source de cette garde retirait les blocs `/* … */` **avant** les lignes `//`.
Or le script contient, dans un commentaire de ligne, `tests/*.test.mjs` — dont le `/*` ouvrait
un faux bloc qui avalait **8 331 caractères**, deux cents lignes de code comprises. L'essai
concluait que le correctif n'était pas là.

On retire désormais les commentaires de **ligne d'abord** : ils emportent leur faux `/*` avec
eux.

## P-83 — « Email envoyé. » : la fonction d'envoi n'est déployée nulle part

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-83 | Quatre écrans appelaient `tabibiBrevo.sendEmail()` et annonçaient **« Email envoyé. »** sans lire le résultat | **lu sur le projet Supabase le 17/09 : `send-email` n'existe pas.** Treize fonctions edge en production — `send-sms`, `verify-turnstile`, `acces-pilote`… — pas celle-là. Chaque appel part en **404** et rend `{ success: false }` | `envoyerEtDire()` rend une **phrase vraie** ; les écrans d'admin l'affichent. `doctor-claim` ne fait plus attendre un e-mail ; `signup` n'annonce plus de notification automatique | `tests/canaux-annonces.test.mjs` (+5 essais). Contre-épreuve : état d'avant remis, **4 essais** échouent | **réglé côté écran — envoi ouvert (P-28)** |

### Le `try/catch` ne servait à rien

```js
try { await window.tabibiBrevo.sendEmail('medecin_validated', email, …); }
catch (e) { console.warn('[admin] Email validation failed'); }
toastM(`✓ ${name} validé. Email envoyé.`, "success");
```

`sendEmail` **ne lève pas** : elle **rend** `{ success: false }`. Le `catch` n'était donc jamais
atteint, et le résultat partait à la poubelle une ligne plus bas. L'admin lisait « Email
envoyé », ne prévenait pas le médecin à la main, et le médecin attendait.

> C'est le cron des rappels, en plus petit : **l'écran de contrôle dit autre chose que ce qui se
> passe.** Et ici il le dit à la personne dont dépend le rattrapage.

### Deuxième face : un « succès » qui n'envoyait rien

`sendEmail` rendait `{ success: true, disabled: true }` quand le module est éteint. Un appelant
qui lit `success` — ce que le nom invite à faire — annonçait un envoi sur un module qui
n'envoie rien. `success` vaut désormais `false` : le drapeau reste, le mensonge part.

### La règle gardée ne se périme pas

On n'interdit pas le mot « e-mail » : on exige qu'un écran qui annonce un envoi **lise le
résultat**. Le jour où `send-email` est déployée, rien à changer — la phrase devient vraie toute
seule, parce qu'elle vient du résultat et non d'un littéral.

⚠️ Et la règle **ne vise pas les promesses d'avenir** : ma première version accusait
`waiting-list.html` (« Vous recevrez un email dès le lancement »), qui est un engagement pour
décembre sur une liste réellement enregistrée. Ce qui rendait `doctor-claim` fautif n'était pas
le futur, c'était la **dépendance** : on disait au médecin d'attendre un e-mail pour connaître
une décision, par un canal muet.

⚠️ Et la garde est restée **verte sur « Email envoyé. »** au premier jet : le `é` du fichier
était décomposé (e + U+0301), celui du motif composé (U+00E9). Deux chaînes identiques à l'œil,
jamais égales. Lecture normalisée en NFC, motifs sur des **radicaux** — un accent dans une
expression régulière est un piège qu'on ne voit pas.

## P-84 — la seule porte vers du HTML était ouverte pour une étiquette qui n'en avait pas besoin

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-84 | `toast()` portait une option `{html:true}` rendant le message par `innerHTML` | **un seul appelant** l'empruntait, pour `fav_add` et `fav_rm` — et `fav_rm` ne contient aucun balisage. `sms_ok`, le troisième libellé cité par le commentaire, n'avait **aucun appelant** et annonçait « Confirmation SMS envoyée » alors qu'aucun SMS ne part (P-75) | la porte est **fermée** ; l'icône se demande par un **nom** choisi dans une table interne (`ICONES_SUP`) | `tests/e2e/xss-toast.spec.js` — 4 essais réécrits, dont un nom d'icône piégé | **réglé** |

Le commentaire de cette même fonction disait, quinze lignes plus haut : « on cesse de
l'interpréter […] il n'y a rien à oublier ». **La porte contredisait cette phrase dans la
fonction qui la porte.**

> Une exception gardée reste une exception : c'est la seule chose qu'on aura à vérifier à chaque
> relecture, pour toujours.

`sms_ok` est retiré des trois dictionnaires internes : orphelin **et** faux.

## P-85 — « Docteur Benali » ne trouvait personne

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-85 | Écrire la civilité devant le nom — la façon la plus naturelle de nommer un médecin — **vidait** la recherche | mesuré sur la base de production, même RPC, même jour : `benali` → **131** praticiens, `dr benali` → **46**, `docteur benali` → **0** | `_sansCivilite()` retire les civilités du texte libre, sur les **deux** chemins (texte brut et reste d'analyse) | `tests/e2e/recherche-texte-libre.spec.js` (+6 essais). Contre-épreuve : **4 essais** échouent sans le correctif | **réglé** |

### Ce n'était pas le défaut soupçonné

L'audit supposait qu'un « Dr » pouvait transformer un nom en spécialité (« Dr Cardin » →
cardio). **Faux** : `_analyserTexteLibre` fait de l'égalité **stricte** sur les listes de la
base, et aucune civilité ne ressemble à une spécialité. Le défaut était **en aval**, dans ce qui
part au serveur — et il était plus grave que le soupçon : pas un mauvais résultat, **aucun**.

Deux refus explicites, chacun gardé :
- on ne mange pas un nom propre — seuls les **mots entiers** de la liste sautent, « Drissi »
  survit intact ;
- une saisie faite **que** de civilités part quand même — rendre une recherche vide à quelqu'un
  qui a tapé quelque chose, c'est lui montrer la vitrine sans lui dire pourquoi.

## P-86 — la loupe emmenait vers les filtres, pas vers la barre

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-86 | Sur l'accueil, toucher la **loupe** de la barre d'onglets faisait défiler la page jusqu'aux **menus déroulants** — wilaya, spécialité, tri, prix — en laissant la barre de saisie trois écrans plus haut | `js/tabibi-nav.js` déclarait `href: 'index.html#sec-search'`, et `tabClick()` traite toute ancre pareil : `getElementById(anchor)` puis `scrollIntoView`. Or `#sec-search` **existe** sur l'accueil — c'est le bloc des filtres | la loupe vise `#name-search` et y met le **focus** (`preventScroll`, puis défilement doux) | `tests/e2e/loupe-recherche.spec.js` — 8 essais. Contre-épreuve : ancien code remis, **6** échouent | **réglé** |

### La page faisait exactement ce qu'on lui demandait

Il n'y avait ni bogue de défilement ni ancre cassée : `#sec-search` est un identifiant valide,
présent, et `scrollIntoView` l'a trouvé. **On lui demandait la mauvaise chose.** Ce sont les
défauts les plus longs à voir — rien n'échoue, rien ne s'affiche en rouge, l'utilisateur se
contente de ne pas trouver la barre.

### Défiler ne suffisait pas : il fallait le curseur

Sur un téléphone, la différence entre « le clavier s'ouvre » et « il ne se passe rien » est
exactement là. Le traitement d'ancre générique s'arrête au défilement ; la loupe a donc son
propre cas, comme la carte et le calendrier en avaient déjà un.

`preventScroll` **puis** `scrollIntoView` : le focus seul ferait sauter la page d'un coup, sans
transition, et parfois au mauvais endroit quand un en-tête colle.

### Ce que la garde a dû apprendre en chemin

- **La barre du bas est un élément de téléphone.** `@media(min-width:768px){ nav.tab-bar{display:none} }` :
  sur ordinateur, ce bouton n'existe pas. Les essais qui le cliquent sont donc `skip` ailleurs —
  plutôt que de relâcher leurs assertions jusqu'à ce qu'ils passent partout. Un essai à part
  vérifie ce masquage, sinon un lecteur croirait la loupe du bas universelle.
- **Sur ordinateur, la seule loupe est celle DANS le champ**, et elle porte `pointer-events:none`.
  Playwright refuse de « cliquer » un élément qui ne peut pas recevoir l'événement — et il a
  raison, personne ne le clique jamais. On clique donc **aux coordonnées** : ce qui est mesuré,
  c'est ce qui arrive quand un doigt se pose là.

### ⚠️ Trouvé en écrivant l'essai, et ça dépasse la loupe

Sur téléphone, **`#tabibi-cookie-banner` recouvre toute la barre d'onglets** :
`document.elementFromPoint()` au centre de la loupe rend le bandeau, pas le bouton. Les **six**
onglets sont inatteignables tant qu'on n'a pas répondu au bandeau — pas seulement la loupe.
Voir P-87.

## P-88 — une égalité de spécificité est une dépendance à l'ordre des fichiers

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-88 | Sur le **site construit**, la barre d'onglets du bas — un élément de téléphone — s'affichait **sur ordinateur**, en grand, par-dessus la page | `accueil-public.html` masque `nav.tab-bar` au-dessus de 768 px ; `css/tabibi-ui.css` porte `nav.tab-bar{display:flex}`, **exactement la même spécificité** (0,0,1,1). À égalité, c'est l'**ordre** qui tranche — et il s'inverse au build. Mesuré sur `dist-web`, largeur 1280 : `display: flex` | la règle passe par l'**ID** (`nav#tab-bar.tab-bar`, 0,1,1,1) : elle gagne quel que soit l'ordre | `tests/e2e/loupe-recherche.spec.js` — l'essai « la barre du bas est masquée » **tournait déjà sur les deux cibles** et c'est lui qui l'a trouvé | **réglé** |

### Le commentaire disait « spécificité alignée ». C'était le problème.

`/* [UI v2] specificite alignee sur nav.tab-bar du design system */` — aligner une spécificité,
c'est décider que **l'ordre d'inclusion** tranchera. Tant que les deux fichiers arrivent dans
le bon ordre, tout va bien ; le jour où un empaqueteur les réorganise, la page change d'avis
sans que rien n'ait été modifié.

> **Sources vertes, build faux** : c'est exactement P-29, où l'import du sélecteur de langue
> disparaissait à la construction. La suite tourne sur les deux cibles depuis — et c'est cette
> décision-là, prise il y a des jours, qui a attrapé celui-ci.

### Trouvé par une garde écrite pour autre chose

L'essai vérifiait que la barre du bas est masquée sur ordinateur — une précaution de lecture,
pour qu'on ne croie pas la loupe du bas universelle. Il est sorti **rouge sur `dist-web` et vert
sur les sources**, ce qui ne laissait qu'une explication.

## P-89 — la liste des candidatures peut enfin décider

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-89 | `admin-candidatures.html` était en **lecture seule** : on voyait les dossiers, on ne pouvait rien en faire (P-78/P-79) | la RPC existe désormais — lue en base le 17/09 : `maj_statut_candidature(p_id uuid, p_statut text) -> doctor_applications`, SECURITY DEFINER, corps verrouillé par `is_admin()` | boutons **Contacter / Approuver / Rejeter / Remettre à vérifier**, appelés **par la passerelle**, l'écran ne bougeant que sur la **ligne rendue** | `tests/e2e/admin-candidatures.spec.js` (+7 essais, 16 au total). Contre-épreuves : succès sans lire la ligne → 1 rouge ; verrou retiré → 1 rouge | **réglé** |

### Trois règles, trois défauts déjà payés ici

1. **Par la passerelle**, jamais `supabase.rpc` en direct — une réponse PostgREST a deux
   moitiés, et `tabibiRpc` lit les deux.
2. **On exige la LIGNE**, pas l'absence d'erreur. `ok:true` avec `data:null` est déjà arrivé
   dans ce dépôt : sans ce contrôle, l'écran annoncerait un changement qui n'a pas eu lieu
   (P-68 b, P-83). Et c'est la ligne du **serveur** qui remplace la locale — `reviewed_at` et
   `reviewed_by` viennent de lui, on ne les devine pas.
3. **Les boutons se désactivent pendant l'appel.** Deux clics feraient deux écritures, et la
   seconde écraserait la première sans que personne le sache. Appliqué **avant** d'avoir le
   défaut, cette fois.

Et un quatrième, plus discret : une carte ne propose **pas** le statut qu'elle porte déjà — une
écriture qui ne change rien est du bruit, et une occasion de se tromper.

### ⚠️ Un écart de droits, constaté à la lecture — non corrigé

La consigne disait `GRANT … TO authenticated`. Lu en base : l'`EXECUTE` porte sur
**`authenticated` ET `anon`**. Le corps refuse quand même (`is_admin()`), donc ce n'est **pas**
une élévation de privilège — c'est une surface plus large que voulue, et un `anon` peut
déclencher l'exécution de la fonction. **Je ne corrige pas un GRANT moi-même** : c'est une
écriture en base. Signalé au RETOUR.

## P-90 — le tunnel de revendication n'avait pas de porte d'entrée

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-90 | La fiche publique d'un médecin non revendiqué ne menait **pas** au tunnel de revendication : elle ne proposait que « Par WhatsApp » | mesuré en base le 17/09 : `doctor_profiles` → **75 035** fiches, **1** revendiquée, **75 035** avec `legacy_id`. Le tunnel (`doctor-claim.html`, RPC `claim_my_doctor_profile`) existe depuis des semaines et **rien de public n'y menait** | le bloc de `doctor-profile.html` est reconstruit : appel principal vers `doctor-claim.html?legacy_id=N` (**fiche pré-remplie**), WhatsApp conservé en second | `tests/e2e/revendication-fiche.spec.js` — 11 essais × 2 cibles. Contre-épreuves : CTA retiré → **6 rouges** ; appel montré sur une fiche déjà revendiquée → **6 rouges** ; téléphone glissé dans le bloc → **2 rouges** ; `noindex` remis sur le tunnel → **2 rouges** ; clé anglaise retirée → **2 rouges** | **réglé** |

### Ce n'est pas une réparation, c'est une brique qui manquait

Rien n'était cassé : le tunnel marche, la RPC marche, la fiche s'affiche. Ce qui manquait,
c'est le chemin **de l'une vers l'autre** — et un chemin absent ne déclenche aucune erreur,
ne remplit aucun journal, n'échoue à aucun essai. **1 fiche revendiquée sur 75 035** est le
seul endroit où ça se voyait, et ce n'est pas un endroit que quelqu'un regarde.

### Partie B — une porte d'entrée qu'on interdit d'indexer est une porte fermée de l'intérieur

`doctor-claim.html` portait `noindex,nofollow`. Un médecin qui cherche « revendiquer ma fiche »
ne pouvait pas la trouver ; le seul chemin passait par une fiche… qui ne pointait pas dessus.
Elle est repassée en `index,follow`. **La contre-épreuve est dans la garde** : les cinq pages de
compte (`patient-dashboard`, `doctor-dashboard`, `medecin-profile`, `patient-profile`,
`admin-candidatures`) sont vérifiées `noindex,nofollow` dans le **même** essai — ouvrir une
porte ne doit rien ouvrir d'autre.

### Deux détails qui auraient rendu la garde verte pour rien

1. **Le lien du CTA.** Tout le bloc est déjà sous `if (d.legacy_id)` ; le `? :` que j'avais
   écrit pour le cas « pas de `legacy_id` » était **du code mort**, et l'essai qui l'éprouvait
   aurait été vert sans jamais entrer dedans. Ternaire retiré, essai remplacé par celui qui dit
   la vérité : **sans `legacy_id`, il n'y a pas de bloc du tout**.
2. **L'i18n.** `_t(cle, defaut)` retombe sur le français quand une clé manque : un encart
   « traduit » reste donc parfaitement vert en anglais tout en affichant du français. La garde
   lit le **texte rendu** dans chaque langue et **refuse le repli français** — c'est elle qui
   sort rouge quand on retire `dp_claim_cta` de `en.js`.

### Ce que la garde de confidentialité éprouve vraiment

Lu en base : `public_doctors` n'expose **ni `phone` ni `email`**, et **aucune** des 75 034
fiches non revendiquées ne porte d'`address`. La ligne bouchonnée est donc **plus sale que la
réalité** — volontairement. L'essai ne prouve pas que la vue soit propre (elle l'est, c'est
mesuré) : il prouve que **le front ne laisserait pas fuiter** un champ que la vue laisserait
passer un jour. Sans ce choix, l'essai n'éprouverait que ce qui ne peut pas arriver.

### Aucune écriture en base

Aucune proposition de migration n'était nécessaire : la vue expose déjà `is_claimed`, et même
`show_claim_badge` = `NOT COALESCE(dp.is_claimed, false)` — une colonne écrite exprès pour cet
encart, et jamais lue jusqu'ici. **Le signal existait ; c'est l'entrée qui manquait.**

## P-91 — la barre du bas renvoyait l'utilisateur dehors

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-91 | Depuis une sous-page (mes RDV, réservation, dawini…), **Accueil**, **Spécialités**, **Carte** et la **loupe** menaient à `index.html` — la page « Bientôt disponible ». Un utilisateur déjà **dans** l'application se retrouvait devant la porte close | `js/tabibi-nav.js` : trois items et deux replis de `tabClick` visaient `index.html`, alors que l'inversion du 13/09 en a fait la **porte fermée** et que l'application vit dans `accueil-public.html` | les items et les replis visent `accueil-public.html` ; `#carte` ouvre réellement la carte à l'arrivée ; `accueil-public.html` ajoutée au remappage desktop | `tests/e2e/nav-barre-bas.spec.js` — 9 essais × 2 cibles. Contre-épreuves : cibles `index.html` remises → **16 rouges** ; ouverture de la carte retirée → **2 rouges** ; remappage desktop retiré → **2 rouges** | **réglé** |

### Deux fautes qui se cachaient l'une l'autre

`#sec-spec` et `#name-search` n'existent **que** sur `accueil-public.html`. La cible portait donc
à la fois la mauvaise page **et** une ancre introuvable sur cette page : corriger l'une sans
l'autre n'aurait rien donné, et aurait donné l'impression d'avoir corrigé.

### ⚠️ Pourquoi la garde de P-86 n'a pas vu celui-ci

Elle s'ouvre sur l'accueil, où le cas spécial `id === 'search'` trouve le champ et met le focus
**sans jamais naviguer**. Le repli `go(href)` — la ligne qui partait sur la porte fermée — n'était
sur aucun de ses chemins. Pire : c'est **ce lot-là** qui a écrit `index.html#name-search`, en
corrigeant l'ancre sans regarder la page.

**Une garde ne couvre que le chemin qu'elle emprunte.** Celle-ci part donc d'une **sous-page**, là
où le repli est le seul chemin possible.

### Deux culs-de-sac évités, mesurés en écrivant le correctif

1. **`#carte` n'existe nulle part.** Vérifié : aucun `id="carte"` dans le dépôt. La carte est une
   surcouche `hidden` qu'on **ouvre** (`openMapOverlay`, dans `js/home-app.js`). Pointer l'onglet
   sur `accueil-public.html#carte` sans rien à l'arrivée aurait affiché l'accueil et pas la carte.
   `js/home-app.js` lit donc ce hash à l'arrivée — `#carte` est une **consigne**, pas une ancre.
2. **Le bundle desktop rendait le bouton mort.** `js/tabibi-desktop-nav.js` renvoie `null` pour
   toute page hors bundle sans équivalent, et `go()` s'arrête net sur `null`. Sans ajouter
   `accueil-public.html` au remappage, Accueil / Spécialités / loupe seraient devenus des boutons
   qui ne font **rien** sur le desktop — une mauvaise destination remplacée par aucune.

### ⚠️ Ce que ce lot NE ferme PAS — voir P-92

Les onglets sont propres ; **22 autres liens** vers `index.html` subsistent dans 18 pages, dont
des boutons « Trouver un médecin » qui mènent à la porte close. Hors périmètre de ce lot, listés
en P-92.

### Les huit pages à barre du bas sont derrière la connexion

Mesuré en écrivant la garde : sauf l'accueil, **toutes** exigent une session. Ma première version
partait de `dawini.html` en la croyant publique et sortait rouge avec un correctif bon. Ce n'est
pas une gêne d'essai, c'est la portée du défaut : **il ne frappait que des gens connectés**, déjà
à l'intérieur, à qui la barre du bas proposait la sortie.

## ~~P-92~~ — 22 liens vers la porte fermée, hors barre du bas — **réglé le 18/09 par [P-100](#p-100--54-chemins-menaient-encore-a-la-porte-close-et-les-pires-netaient-pas-des-liens)**

> L'inventaire ci-dessous est **juste et incomplet** : il cherchait des `href`. P-100 a trouvé
> **onze** emplacements de plus — `afterLogout`, les défauts de l'en-tête, les gardes d'accès —
> qui ne sont pas des liens et qui décident pourtant d'où l'on atterrit. Conservé tel quel : c'est
> ce que sa méthode pouvait voir.


| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-92 | Hors barre du bas, **22 liens** dans **18 pages** mènent à `index.html` — la porte fermée. Dont des boutons d'action : « Trouver un médecin » (`mes-rdv.html:403`, `patient-dashboard.html:810`, `about.html:162`), « Retour à l'accueil » (`reservation.html:195`, `success.html:66`, `verify-email.html:92`, `dawini-pharmacie.html:138`), le lien du pied de `accueil-public.html:1435`, et trois `location.href="index.html"` après déconnexion (`patient-dashboard.html:256`, `doctor-dashboard.html:387`, `medecin-profile.html:1007`, `patient-profile.html:658`) | `git grep -n 'href="index.html'` — liste complète relevée le 17/09 | **à trancher, et ce n'est pas mécanique** : après `porte.mjs ouverte`, `index.html` redevient l'accueil et ces liens redeviennent justes. Soit on les pointe tous sur `accueil-public.html` (juste dans les deux états), soit on décide qu'ils restent `index.html` et que la porte fermée est un état transitoire assumé | **garde manquante** : P-91 ne couvre que `js/tabibi-nav.js` | **ouvert** |

## P-93 — on ne pouvait créer un compte qu'avec un numéro algérien

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-93 | **Aucun moyen de s'inscrire sans SMS.** `signup.html` n'offrait que `signUp({phone,password})` + OTP. Un SMS qui n'arrive pas, un numéro étranger, un test rapide : aucune issue | `js/auth.js` exposait `signUp(email,password,role)` et `signIn(email,password)` **depuis toujours** — aucune page ne les appelait pour créer un compte | sélecteur **Numéro / E-mail** sur `signup.html` (le chemin SMS reste le défaut et ne change pas d'une ligne) ; création du profil **extraite** et partagée par les deux chemins ; les deux issues de `signUp` par e-mail traitées séparément | `tests/e2e/auth-email.spec.js` — 12 essais × 2 cibles. Contre-épreuves : « pas de session » traité en succès → **2 rouges** ; `role` retiré des métadonnées → **2 rouges** ; `required` ne suit plus le mode → **12 rouges** ; message « ce numéro » sur le chemin e-mail → **2 rouges** ; « Connexion admin » remis → **2 rouges** | **réglé** |

### ⚠️ La connexion par e-mail EXISTAIT — elle s'appelait « Connexion admin »

`login.html` portait déjà `doLogin()`, complet et fonctionnel, appelant
`signInWithPassword({email})` par `window.tabibi.auth.signIn`. Il était derrière **un lien gris de
12 px** nommé « Connexion admin », en bas de page. Quelqu'un qui a un compte e-mail et n'est pas
administrateur n'avait **aucune raison de cliquer dessus**.

Il n'y avait donc presque rien à écrire : il y avait à **montrer**. Le correctif est un sélecteur ;
`doLogin()` n'est pas modifié.

### La création du profil est EXTRAITE, pas recopiée

Le bloc qui horodate les consentements, complète `public.users`, journalise dans `consents_log` et
aiguille selon le rôle vivait **dans** `verifyOtpAndCreateProfile`, soudé au SMS. Il est désormais
`creerProfilEtRediriger(sessUser, P, btn, origText)`, appelé par les deux chemins.

**Recopier aurait fait deux versions de l'écriture des consentements** — et le jour où l'une
change, l'autre ment. Trois valeurs seulement dépendent du chemin : `email` (de la session),
`phone` (NULL quand on s'inscrit par e-mail), et le contact affiché dans la modale du médecin.

### ⚠️ Les deux issues de `signUp` par e-mail, et pourquoi elles ne se ressemblent pas

Selon le réglage « Confirm email » du projet Supabase — **que le front ne connaît pas** :

| retour | ce que ça veut dire | ce qu'on fait |
|---|---|---|
| `session` non nulle | le compte est utilisable tout de suite | profil créé par le chemin commun, entrée dans l'application |
| `session: null` | le compte existe, **personne n'est connecté**, un lien est parti | écran « Vérifiez votre boîte mail » — **aucune redirection, aucun « Compte créé ! »** |

Traiter le second comme le premier poserait un tableau de bord vide devant quelqu'un que la
première requête déconnecterait. C'est la faute de **P-67** (succès annoncé sans persistance) et de
**P-83** (« Email envoyé » sans expéditeur), et elle ne se refait pas.

### Trois pièges d'interface, mesurés

1. **`required` doit suivre le mode.** Laissé sur le champ caché, le formulaire devient impossible
   à soumettre et le navigateur tente de mettre le focus sur un champ invisible : Chrome jette
   « An invalid form control is not focusable » et **le bouton ne fait plus rien, sans un mot**.
2. **`type="email"` accepte `a@b`** — un domaine sans point. Sans le contrôle JS, l'inscription
   partirait avec une adresse qui ne recevra jamais rien. Le navigateur ne suffit pas, et la garde
   tient précisément cet écart.
3. **« Ce numéro a déjà un compte » sur une inscription par e-mail** est un mensonge poli : la
   personne n'a saisi aucun numéro et relit le sien trois fois. Les messages suivent le chemin
   emprunté, en FR/AR/EN.

### Deux essais que j'ai dû corriger avant de les croire

- **Le bouchon ne prenait pas.** J'avais posé un accesseur sur `window.tabibi` ; or
  `js/supabase-client.js` fait `window.tabibi = window.tabibi || {}` **puis** assigne `.supabase`
  directement sur l'objet. L'espion n'était jamais branché, les pages parlaient au vrai client, et
  cinq essais sortaient rouges avec un correctif bon. On intercepte désormais `createClient`.
  **Un bouchon qui ne prend pas ne rate pas bruyamment — il laisse le vrai code tourner.**
- **L'ordre des routes Playwright n'est pas un détail.** Le bouchon de la page d'arrivée, posé
  *avant* `hermetiser`, ne servait jamais : la route `**` d'`hermetiser` est plus récente, et son
  `route.continue()` envoie la requête **au serveur** au lieu de rendre la main aux routes plus
  anciennes. Le vrai tableau de bord se chargeait et effaçait `tabibi_user` — essai instable une
  fois sur deux, pour une raison qui n'avait rien à voir avec le code mesuré.

### Ce que ce lot NE fait PAS

Aucune migration, aucun DDL : Supabase Auth gère les comptes, et le profil passe par le **même**
chemin applicatif qu'avant. Le réglage « Confirm email » du projet **n'est pas touché** — le front
gère les deux cas sans le connaître, et c'est volontaire.

## P-94 — la porte e2e efface le journal qu'elle vient d'ecrire

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-94 | Quand la porte `e2e` sort en rouge, `verifier-toutes.mjs` affiche « Sortie partielle : `test-results/porte-e2e.log` » — **et ce fichier n'existe plus**. On apprend qu'on est rouge, pas pourquoi | constaté le 17/09 en écrivant P-93 : gate rouge, `ls test-results/*.log` → aucun fichier. Playwright **vide son `outputDir`** (`test-results/`) au démarrage, or c'est là que le lanceur ouvre son journal (`scripts/verifier-toutes.mjs:207`). L'enfant efface donc le journal de son propre parent | écrire les journaux **hors** de `test-results/`, dans un répertoire que Playwright ne gère pas. Une ligne | **garde manquante** — à écrire avec le correctif : une porte rouge doit laisser sa sortie lisible | **ouvert** |

### C'est la deuxième fois que la porte elle-même ment

**P-82** : le lanceur tuait l'enfant qu'il mesurait (`maxBuffer` dépassé, SIGTERM, `status: null`
lu comme un échec). Le correctif — écrire dans un descripteur de fichier plutôt qu'en mémoire — a
posé le journal **dans le seul répertoire que Playwright efface**.

**L'outil de mesure fait partie de ce qu'il faut mesurer.** Ici le coût est modeste — on relance
`npx playwright test` à la main, c'est ce que j'ai fait — mais le message désigne un fichier comme
s'il existait, et c'est exactement ce qu'une porte ne doit jamais faire.

## P-95 — « Profil sauvegardé ! » en vert, juste après « Sauvegarde échouée »

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-95 | Dans `saveAll()` (`medecin-profile.html`), un échec réseau affichait le message d'erreur **puis** le toast vert « Profil sauvegardé ! ». Le médecin retient le vert, ferme la page, et croit ses horaires enregistrés | les branches d'erreur **métier** font `return` ; la branche « réseau / inconnue » et le `catch` retombaient dans la suite du code, qui affiche le vert. Le `catch` ne faisait même qu'un `console.warn` : l'écran n'affichait **que** le vert | un troisième état, `dbEchouee` : réussie → vert « (Tabibi DB) » · **échouée → rouge seul** · non tentée → vert | `tests/e2e/profil-medecin-faux-succes.spec.js` — 5 essais × 2 cibles. Contre-épreuves : vert inconditionnel → **4 rouges** ; `return` sec → **2 rouges** | **réglé** |

### Pourquoi ni un `return`, ni `if (!didDbSave) → erreur`

**Le `return` que suggérait la consigne aurait fait perdre la saisie.** La retombée sur
`localStorage` est voulue — le message d'erreur promet « copie locale gardée ». Sortir avant
l'écriture locale aurait remplacé un mensonge par une **perte de données**. La garde le prouve :
un `return` à cet endroit sort **2 rouges**, dont l'essai « la saisie locale est CONSERVÉE ».

**Et `if (!didDbSave) → erreur` aurait inventé une panne.** Sans session, aucune sauvegarde
distante n'est **tentée** : le mode local est le comportement attendu. Trois états, pas deux.

## P-96 — le bouton figé sur « Validation… »

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-96 | `admin-doctor-validation.html` : `doValidate()` et `doReject()` désactivaient le bouton et posaient le tourniquet **avant** de vérifier le client base. Sans client, le `return` partait sans rien remettre — bouton mort qui tourne, modale à fermer à la main | le toast rouge disparaît en 3 s ; **le bouton figé reste**, et c'est lui qu'on regarde | `_rendreLeBouton()` : le geste est sorti dans une fonction, et les **quatre** chemins de sortie passent par elle | `tests/e2e/admin-validation-bouton-fige.spec.js` — 4 essais × 2 cibles. Contre-épreuve : `return` sans remise en état → **6 rouges** | **réglé** |

### Les `catch` le faisaient déjà

La remise en état existait, écrite à la main dans chaque `catch`. Le défaut n'était pas
l'ignorance du geste : **c'est une sortie anticipée qui l'oubliait.** D'où la fonction commune
plutôt qu'une troisième copie — le prochain `return` ajouté la trouvera.

Le bouton de rejet revient **actif**, pas « comme avant » : son état normal est *désactivé* tant
que le motif fait moins de 20 caractères, et on n'arrive là qu'avec un motif valide. Le remettre
désactivé aurait remplacé un bouton figé par un bouton inerte.

### ⚠️ Le cliquet `innerhtml` a attrapé ma première version

`_rendreLeBouton(b, html)` posait `b.innerHTML = html`. Le compteur est monté **134 → 135**, et il
avait raison : `html` est un **paramètre**. Les quatre appels lui passent des libellés constants,
mais la signature accepte n'importe quoi — le jour où l'un d'eux y met le nom d'un médecin, plus
rien ne l'arrête. La fonction construit désormais les nœuds (`createElement` + `textContent`), et
le compteur est revenu à **134**.

**Une garde qui n'accuse que ce qui est déjà exploitable arrive trop tard.** Celle-ci compte les
formes, pas les dégâts.

## P-97 — le salut du tableau de bord médecin : diagnostic reçu, défaut absent

| ID | symptôme annoncé | ce qui a été mesuré | correctif | garde | statut |
|---|---|---|---|---|---|
| P-97 | « L'en-tête affiche `hello`, `good_morning` etc. car ces clés sont absentes des dictionnaires » | **les quatre clés sont présentes dans les trois dictionnaires**, avec de vraies traductions (arrivées avec `1409c27`), et **l'écran n'affiche aucune clé brute** — mesuré en FR/AR/EN, sur les sources **et** sur `dist-web` | **aucun** : rien à corriger. En ajouter aurait cassé la parité i18n sans rien réparer | `tests/e2e/salut-medecin-i18n.spec.js` — 5 essais × 2 cibles, ajoutés quand même | **sans objet — garde posée** |

### Le risque est réel, même si le défaut ne l'est pas

`tabibiI18n.T(key)` rend `TR[lang][key]`, sinon `TR.fr[key]`, **sinon la clé elle-même**
(`js/tabibi-i18n.js:98`). Le salut dépend donc du **moment**, pas du vocabulaire : dictionnaire
pas encore chargé → « hello » à l'écran. Et `document.write`, qui l'insère de façon synchrone sur
les sources, est **inopérant en module ES** (build Vite) où `chargerLangue()` prend le relais de
façon asynchrone — la famille de P-29, sources vertes et build faux. La garde tourne donc sur les
deux cibles.

**Une consigne n'est pas une mesure.** Trois lots de suite ont commencé par une vérification qui a
corrigé le diagnostic reçu : la page visée n'était pas la bonne (P-90), la moitié du correctif
manquait (P-91), et ici le défaut n'existait pas.


## P-98 — « ce médecin n'a pas activé les RDV », et deux boutons pour réserver

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-98 | Dans la modale d'aperçu de l'accueil, une fiche **non réservable** affichait « Ce médecin n'a pas encore activé les RDV en ligne » **dans la zone des créneaux**, et juste en dessous **« Confirmer ce créneau »**, puis tout en bas **« Prendre RDV »** | `js/home-app.js:1343` et `:1357` : les deux boutons étaient rendus **sans condition**. Les gestionnaires refusaient bien — mais **après le clic**, par un toast qui disparaît en 3 s | les deux appels suivent la réservabilité, calculée **une fois** en haut de `showDoctorModal()`. Non réservable → un bouton **désactivé** qui dit pourquoi, et pour une fiche non revendiquée un lien vers sa fiche publique, qui porte le tunnel pré-rempli (P-90) | `tests/e2e/fiche-cta-reservation.spec.js` — 6 essais × 2 cibles. Contre-épreuves : CTA inconditionnels → **8 rouges** ; CTA masqués pour tous → **2 rouges** ; bouton désactivé rendu actif → **6 rouges** | **réglé** |

### La condition était déjà écrite trois fois

`claimed && validationStatus === 'approved'` — dans `bookDoc()` (l.1306), `renderProfileSlots()`
(l.1381) et `confirmFromProfile()` (l.1413). Elle vient de `public_doctors` (`is_claimed`,
`validation_status`, mappées l.2238-2239). **Rien à inventer : il fallait la lire avant de dessiner
le bouton, au lieu de la lire après le clic.** Le correctif la calcule une fois plutôt que d'ajouter
une quatrième lecture qui pourrait dériver.

### Trois états, parce que « pas réservable » recouvre deux situations

| état | ce que voit la personne |
|---|---|
| réservable | les deux appels à l'action, **inchangés** |
| revendiquée, **en validation** | bouton désactivé « Validation en cours — bientôt disponible ». **Pas** de proposition de revendication : la fiche l'est déjà |
| **non revendiquée** | bouton désactivé « Réservation en ligne pas encore disponible » **+** « Vous êtes ce médecin ? Revendiquez cette fiche » → sa fiche publique |

Dire l'un pour l'autre enverrait un médecin revendiquer une fiche qu'il a déjà revendiquée.

### `doctor-profile.html` n'était PAS concernée

Vérifié avant d'y toucher : `_refreshReserveBtnState()` (l.672) désactive déjà le bouton et affiche
une mention explicite, avec les mêmes trois états. **Aucune ligne modifiée là-bas** — et un essai
l'a rejoint, pour que personne ne « corrige » ce qui marche.

### ⚠️ Un essai qui mesurait l'inverse de ce qu'il croyait

Ma première version reconnaissait les appels à l'action **par leur texte** (`/réserver/i`). Elle en
trouvait **un seul** sur une fiche réservable — parce que le bouton du bas dit « Prendre RDV » et
celui des créneaux « Confirmer ce créneau ». Elle lit désormais le `onclick` : `bookDoc(`,
`confirmFromProfile(`. **Un essai accroché aux libellés casse au premier changement de formulation**,
et en attendant il raconte n'importe quoi.

## P-99 — le rejet d'un médecin appelait une fonction qui n'existe pas

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-99 | **Rejeter un médecin depuis `admin-dashboard.html` n'aboutissait jamais.** L'admin saisissait un motif, voyait « Erreur : … » et recommençait | l'appel passait `p_reason` **et** `p_notes` (`admin-dashboard.html:544`). Signature lue en base le 17/09, **la seule** : `admin_validate_doctor(p_doctor_id uuid, p_action text, p_notes text DEFAULT NULL) -> jsonb`. **PostgREST apparie par noms d'arguments** : un nom inconnu, aucune surcharge trouvée | `p_reason` retiré ; le **motif réel** part dans `p_notes` | `tests/e2e/rejet-admin-signature.spec.js` — 4 essais × 2 cibles. Contre-épreuves : `p_reason` remis → **4 rouges** ; bonne signature mais motif constant → **2 rouges** | **réglé** |

### `p_notes` EST le motif — lu dans le corps de la fonction

```sql
IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
  RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
UPDATE doctor_profiles SET … validation_rejected_reason = p_notes
```

La constante « Rejeté via admin dashboard » aurait donc, **une fois l'appel réparé**, remplacé le
motif écrit par l'admin — et c'est ce motif que le médecin reçoit par courriel. **Réparer la
signature sans réparer le contenu aurait donné un rejet qui marche et qui ne dit rien.** La garde
tient les deux moitiés séparément : la seconde contre-épreuve n'échoue que sur le contenu.

### Pourquoi personne ne l'avait vu

L'écran **échouait proprement** : le `catch` affichait « Erreur : … ». Rien ne brûlait, aucun
journal ne criait, et la fonction voisine — la validation — marchait. **Un bouton qui échoue
poliment se confond avec un bouton qu'on utilise mal.**

`admin-doctor-validation.html` (l.417 et l.486) était **déjà correct** : vérifié avant d'y toucher,
**aucune ligne modifiée**. La garde vérifie désormais **les deux écrans** — c'est précisément le
fait qu'ils aient divergé qui a produit ce défaut.

### Trouvé par une lecture de la base, pas par un essai

Ce défaut est sorti de l'audit source du 17/09 (`.claude/AUDIT-CC.md`), en comparant **ce que le
front envoie** à **ce que la base déclare**. Aucun essai e2e ne pouvait l'attraper : ils bouchonnent
la passerelle, donc ils acceptent n'importe quel nom d'argument. **La garde posée ici a la même
limite** — elle recopie la signature réelle en tête de fichier et vérifie que le front s'y tient.
Le jour où la fonction change en base, c'est cette constante qu'il faudra mettre à jour.

## P-100 — 54 chemins menaient encore à la porte close, et les pires n'étaient pas des liens

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-100 | Boutons « Trouver un médecin », « Retour à l'accueil », logos, **et surtout la redirection après déconnexion** menaient à `index.html` — la page « Bientôt disponible » | inventaire du 18/09 : **43** liens et `location.*` (dont `legal/`, qui exige `../`), **plus 11** dans l'épine dorsale que le premier grep ne voyait pas | tout repointé sur `accueil-public.html`, avec `#name-search` quand l'intention est « trouver / réserver » | `tests/porte-fermee-liens.test.mjs` (3 essais, **parcourt le dépôt**) + `tests/e2e/porte-fermee-navigation.spec.js` (5 essais × 2 cibles). Contre-épreuves : `afterLogout` remis → **2 + 2 rouges** ; un bouton repointé → **1 rouge** ; `../` retiré aux pages légales → **2 rouges** | **réglé** |

### ⚠️ Les onze qui comptaient le plus n'étaient pas des `href`

P-92 avait inventorié **22 liens**. Un second passage, sur les formes que le premier grep ne
cherchait pas, en a trouvé onze autres — et ce sont eux la vraie colonne vertébrale :

| emplacement | portée |
|---|---|
| `js/config.js:48` — `afterLogout` | **tous les rôles, à chaque déconnexion**. La redirection la plus centrale du dépôt |
| `js/tabibi-header.js:124,129` | les **défauts** de l'en-tête partagé : ils s'appliquent à toute page qui oublie son attribut |
| `data-home` / `data-back` × **10 pages** | l'en-tête de chaque espace connecté |
| `js/home-app.js:448,453` | `requireAuth` / `requireRole` — où l'on renvoie quelqu'un qui n'a pas le droit d'être là |
| `404.html:124` · `conversation.html` · `messages.html` · `teleconsultation.html:27` | replis de rôle et recherche |

**Un inventaire par `href` ne voit pas une redirection.** Celui de P-92 était juste et incomplet :
il avait cherché la forme qu'on remarque, pas celle qui décide.

### Deux gardes, parce qu'une seule ne suffit pas

- **`tests/porte-fermee-liens.test.mjs`** parcourt **tout le dépôt**. Une page ajoutée demain avec
  un « Retour à l'accueil » vers `index.html` y sera attrapée **sans que personne l'inscrive nulle
  part**. C'est la différence entre une liste et un filet — et c'est exactement ce qui manquait à
  P-92, qui listait.
- **`tests/e2e/porte-fermee-navigation.spec.js`** vérifie que **la cible répond**. Interdire
  `index.html` sans regarder où l'on arrive remplacerait une mauvaise destination par aucune ; un
  lien vers une page absente ne lève pas d'erreur non plus, il affiche un 404 que personne ne
  surveille.

Les deux vérifient aussi que **la porte close le reste** : sans ça, elles seraient vertes le jour où
quelqu'un défait l'inversion du 13/09, et les 54 liens repointés deviendraient un détour inutile.

### ⚠️ Deux fois où ma garde se trompait de critère

1. Elle cherchait un marqueur **`tabibi-porte` dans le source** pour reconnaître la porte close. Il
   n'y est pas : `scripts/porte.mjs` le pose dans `dist-web`. **Rouge sur un dépôt parfaitement
   sain** — et une garde qui accuse le code juste finit désactivée.
2. Elle lisait `[data-tabibi-header] a`. Or `render()` fait
   `ph.parentNode.replaceChild(header, ph)` : l'attribut **n'existe plus** une fois l'en-tête
   construit. Zéro lien trouvé, donc **rouge avec ou sans le correctif** — le pire genre d'essai.

### Le cas qu'il ne fallait pas repointer

`js/tabibi-desktop-nav.js` garde `'index.html': 'agenda-cabinet.html'` dans son remappage. Ce n'est
pas une cible, c'est un **filet** : sur le bundle desktop, tout lien oublié vers `index.html` est
renvoyé sur la page pro au lieu de mourir. Le retirer rendrait muets précisément les liens qu'on
n'aurait pas vus.

## P-101 — le second chemin WhatsApp de la revendication, retiré

| ID | symptôme | décision | correctif | garde | statut |
|---|---|---|---|---|---|
| P-101 | Le bloc de revendication de `doctor-profile.html` proposait **deux** appels : « Revendiquer ma fiche » (le tunnel) **et** « Par WhatsApp » | **décision d'Aghiles, 18/09** : un médecin parti sur WhatsApp **ne crée pas de compte** — il écrit à une équipe, quelqu'un répond à la main, et la plateforme n'a gagné ni utilisateur ni fiche revendiquée | le chemin WhatsApp est retiré (`doctor-profile.html:573-588`), il ne reste que le tunnel | `tests/e2e/revendication-fiche.spec.js` — l'essai qui **exigeait** WhatsApp est **retourné** en essai qui l'interdit. Contre-épreuves : bouton remis → **2 rouges** ; WhatsApp des cas urgents coupé → **2 rouges** | **réglé** |

### ⚠️ Cette décision revient sur la mienne, et elle a raison

En posant ce bloc (**P-90**) j'avais gardé WhatsApp à côté du tunnel : *« on ajoute une porte, on
n'en ferme pas une »* — c'est un chemin qui aboutit, avec un humain au bout.

L'argument tenait **côté parcours** et ratait ce qui compte ici. **Le chemin le plus court pour la
personne n'est pas toujours celui qui construit le produit**, et cet arbitrage-là appartient au
propriétaire du produit, pas à moi.

L'essai n'a pas été supprimé mais **retourné**, au même endroit, avec la raison écrite dedans : la
trace de la décision reste lisible là où elle s'applique.

### Ce qui n'a PAS été touché — et c'est gardé

« Retirer WhatsApp » pris au pied de la lettre aurait coupé des canaux qui n'ont rien à voir avec
l'inscription :

| usage | pourquoi il reste |
|---|---|
| `cas-grave.html` | formulaire d'urgence → WhatsApp de l'équipe. Quelqu'un attend une réponse au bout |
| `waiting-list.html` · `patient-waitinglist` · `medecin-waitinglist` | boutons de **partage** |
| `patient-ordonnances.html` | partage d'une ordonnance par le patient |
| `js/capacitor-bridge.js` | ouvre les liens `wa.me` nativement dans l'app mobile |

Un essai les garde explicitement : ce qui est retiré, c'est le chemin qui **remplace une
inscription**, pas la messagerie.

### ⚠️ Ma contre-épreuve est passée au vert sur du code cassé

En coupant pour de vrai le lien de `cas-grave.html`, l'essai est **resté vert** : il lisait le HTML
brut, et **un commentaire du fichier contient « wa.me »**. La garde se rassurait sur sa propre
documentation — **douzième fois** que ce dépôt paie cet ordre-là. Les commentaires sont désormais
retirés avant comparaison, et la contre-épreuve sort **2 rouges**.

### Deux essais rattrapés au passage

- L'essai **XSS** lisait l'URL WhatsApp pour vérifier qu'un nom piégé ne se recolle pas en HTML.
  Cette URL n'existe plus : le nom **n'entre plus du tout** dans le bloc. L'essai vise désormais
  l'endroit où le nom est réellement rendu (`#d-name`) — et vérifie **aussi** qu'il s'affiche, car
  un essai vert parce que la donnée a disparu ne prouve rien.
- Il comparait au caractère près : la page applique un `text-transform: capitalize`, et `innerText`
  rend le texte **transformé**. Comparaison rendue insensible à la casse — sinon l'essai accusait
  une feuille de style.

Les clés `dp_claim_wa` et `dp_claim_wa_msg` sont retirées des trois dictionnaires (parité tenue :
**1580 clés par langue, 0 manquante**), et `rawName`, qui ne servait qu'au texte WhatsApp, avec.

## P-102 — « Mes ordonnances » interrogeait une table qui n'existe pas

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-102 | La page patient « Mes ordonnances » affichait, **à chaque ouverture**, « Erreur de chargement — Could not find the table `public.my_prescriptions` in the schema cache ». **Un patient n'avait aucun moyen de voir ses ordonnances** | trouvé en live par Aghiles. `patient-ordonnances.html:412` lisait `my_prescriptions` ; cette table **n'existe pas** en base | la page lit `prescriptions` (RLS `patient_id = auth.uid()`), et les noms de médecin en **seconde lecture** sur `public.users` | `tests/e2e/patient-ordonnances.spec.js` — 6 essais × 2 cibles. Contre-épreuves : `my_prescriptions` remis → **8 rouges** ; liste rendue dépendante de la seconde lecture → **2 rouges** | **réglé** |

### ⚠️ AUCUNE MIGRATION N'ÉTAIT NÉCESSAIRE — vérifié en base avant d'écrire

Le SEQ autorisait à **proposer** une vue `my_prescriptions` si aucune source lisible n'existait.
Il en existait une :

| ce qu'il fallait | ce que la base dit déjà |
|---|---|
| lire ses ordonnances | `prescriptions_select_fusion` : `patient_id = auth.uid()` — **déjà ouvert** |
| lire le nom du prescripteur | `users_select_fusion` autorise le patient sur les médecins **avec qui il a un rendez-vous** : `role = 'medecin' AND id IN (select doctor_id from appointments where patient_id = auth.uid())` |

**Deux lectures et non une jointure**, pour une raison mesurée : les clés étrangères de
`prescriptions` pointent vers **`auth.users`**, que PostgREST n'expose pas. L'imbrication
`select('*, doctor:users(…)')` ne peut donc pas fonctionner — ce n'est pas un choix de style.

### La seconde lecture ne peut pas faire tomber la première

Si les noms sont refusés, **la liste s'affiche quand même**. Une ordonnance sans le nom de son
prescripteur garde son numéro, sa date, ses médicaments et son PDF — l'essentiel. Faire dépendre
toute la liste de cette requête ramènerait l'écran vide qu'on vient de retirer, pour une ordonnance
parfaitement lisible. La contre-épreuve l'éprouve : **2 rouges**.

Et on n'écrit pas « **Dr** » tout seul quand le nom manque : c'est « Médecin prescripteur »
(FR/AR/EN). Un préfixe sans nom n'est pas un nom.

### ⚠️ Ma première contre-épreuve est passée au vert sans rien prouver

J'ai remis `my_prescriptions` par un remplacement… qui a touché **le premier des trois**
`supa.from('prescriptions')` du fichier — celui du téléchargement de PDF, pas celui de la liste.
Les 12 essais sont restés verts, et j'ai failli conclure que la garde ne valait rien.

**Une contre-épreuve qui casse autre chose que ce qu'on mesure ne dit rien du tout.** Refaite sur
la bonne ligne : **8 rouges**.

### Deux autres lectures, déjà correctes

`patient-ordonnances.html:267` et `:283` lisaient **déjà** `prescriptions` (chemins du PDF). Le
défaut ne concernait que `load()` — vérifié, et **aucune ligne modifiée** ailleurs.

## P-103 — « Vous êtes ce médecin ? » proposé à un patient connecté

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-103 | Sur la fiche publique **et** dans la modale de l'accueil, l'appel « Vous êtes ce médecin ? Revendiquez cette fiche » s'affichait à **n'importe qui**, patient connecté compris — sur la fiche du praticien qu'il venait peut-être de consulter | trouvé en live par Aghiles. Aucune condition de rôle n'existait : `doctor-profile.html` ne lisait la session que pour le bouton de réservation (l.705), la modale pas du tout | l'appel n'est montré qu'au **visiteur non connecté** et au **médecin** ; `doctor-profile.html:253` + `:637`, `js/home-app.js:449` + `:1405` | `tests/e2e/revendication-role.spec.js` — 10 essais × 2 cibles. Contre-épreuves : condition retirée → **4 rouges** ; normalisation du rôle retirée → **4 rouges** ; bloc entier masqué au patient → **2 rouges** | **réglé** |

### La condition est celle que les pages lisent déjà

`tabibi_user` dans `localStorage` — comme `_refreshReserveBtnState` (`doctor-profile.html`) et
`loadUser()` (`js/home-app.js`). **On ne branche pas une seconde source de vérité pour une question
d'affichage** : `reservation.html` reste l'endroit où la vraie session est vérifiée, au moment
d'agir.

### ⚠️ Les trois écritures du rôle

`js/auth.js` normalise `doctor`, `médecin` et `medecin` vers la même valeur. Comparer à la seule
chaîne « medecin » masquerait l'appel à un médecin dont le profil dit « **doctor** » —
**exactement la personne qu'on veut atteindre**. La garde éprouve les trois : retirer la
normalisation sort **4 rouges**.

### ⚠️ Ce qui reste visible pour tout le monde — et pourquoi j'ai dû le corriger

Ma première version conditionnait **tout le bloc**. Elle mentait : un patient sur une fiche **non
revendiquée** serait tombé dans la branche `else`, celle du badge **vert** « Fiche revendiquée par
le médecin ».

**On aurait masqué une proposition absurde en la remplaçant par une information fausse** — et qui
contredit le bouton de réservation désactivé juste à côté. Nettement pire que le défaut d'origine.

Le badge « Fiche non revendiquée » reste donc pour tout le monde : c'est vrai, et ça explique au
patient pourquoi il ne peut pas réserver. Seule la **carte d'appel** est réservée. Un essai garde
cette moitié-là ; masquer le bloc entier sort **2 rouges**.

## P-104 — les espaces connectés tenaient dans un couloir de 760 px

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-104 | Sur un écran de bureau, les tableaux de bord (patient, médecin, mes RDV, notifications, ordonnances…) s'affichaient dans une colonne étroite, avec du vide de part et d'autre | `styles/app.css:415`, `@media (min-width:1024px)` : `.page { max-width: 760px }`, alors que le shell `.app-root` fait déjà **1100 px** (1240 au-delà de 1440). Signalé en live par Aghiles | **opt-in** `class="page page-large"` sur 12 pages espace + `.page.page-large { max-width: none }` ; `patient-ordonnances.html` ouvre son propre `.wrap` (880 → 1100) | `tests/e2e/largeur-espaces.spec.js` — 10 essais × 2 cibles, **largeurs mesurées** à 1280 px et 390 px. Contre-épreuves : règle retirée → **8 rouges** ; `.page` élargi pour tous → **2 rouges** | **réglé** |

### La règle de 760 px est VOLONTAIRE — on ne l'a pas supprimée

Elle date du 08/07 : « fin du mobile étiré, colonne de lecture centrée ». Elle a **raison** pour de
la prose — une confirmation, une page légale, un tunnel de réservation. Elle a **tort** pour un
tableau de bord.

D'où un **opt-in** plutôt qu'un élargissement global : `success.html`, `verify-email.html` et les
pages légales gardent leur colonne. Un essai le vérifie explicitement — élargir `.page` pour tout
le monde sort **2 rouges**.

Et `max-width: none` plutôt qu'une valeur en dur : la largeur reste bornée par `.app-root`.
**Deux caps qui se suivent, c'est un cap qui finit par diverger de l'autre.**

### ⚠️ Ma contre-épreuve a trouvé du code mort dans mon propre correctif

`messages.html` et `notifications.html` posent leur propre `max-width: 480px`. J'avais donc ajouté
une surcharge `@media (min-width:1024px)` dans chacune… et **la contre-épreuve l'a retirée sans
qu'aucun essai ne tombe**.

Explication, vérifiée par la mesure : `.page.page-large` (**0,2,0**) bat `.notif-shell` (**0,1,0**)
sur le **même élément**, quel que soit l'ordre des feuilles. Mes deux surcharges ne servaient à
rien — **du code mort qui avait l'air d'une garde**. Retirées. Le 480 px reste utile en dessous de
1024, où `page-large` ne s'applique pas.

C'est le cousin exact de P-88 (spécificité égale, ordre qui tranche), pris par le bon bout cette
fois : ici la spécificité **n'est pas** égale, et c'est ce qui rend la surcharge inutile.

### Trois pages n'avaient pas la même structure — vérifié, pas supposé

| page | conteneur | traitement |
|---|---|---|
| 12 pages espace | `.page` | classe `page-large` |
| `messages` · `notifications` | `.page` **+** `.msg-shell` / `.notif-shell` | la classe suffit (spécificité) |
| `patient-ordonnances` | **`.wrap` seul, aucun `.page`** | surcharge propre, 880 → 1100 |

Une garde qui n'aurait mesuré que `patient-dashboard` aurait laissé les trois dernières dans le
couloir.

### Ce que la garde ne mesure pas, et pourquoi

`messages.html` est derrière un **drapeau éteint** (`tabibi-features.js:93`, `messaging: false`) :
la page se redirige avant de se dessiner, aucune largeur n'y est mesurable. Son cap est donc
vérifié **à la source**, et l'essai le dit. Le jour où le drapeau s'allume, la ligne se déplace
dans la liste mesurée.

## P-105 — « Profil » renvoyait un utilisateur CONNECTÉ vers l'écran de connexion

| ID | symptôme annoncé | ce qui a été mesuré | correctif | garde | statut |
|---|---|---|---|---|---|
| P-105 | « les entrées `rdv` et `profile` de la barre du bas ont `href:'#'` → **boutons morts** » | **à moitié faux, et le vrai défaut est pire.** `tabClick` a une branche dédiée qui n'utilise jamais leur `href` : « Mes RDV » marchait. Mais le repli envoyait vers `login.html` **sans regarder la session** — un patient **déjà connecté** atterrissait sur l'écran de connexion, **partout sauf sur l'accueil** | `_espaceDeLUtilisateur()` lit `tabibi_user` et **`TABIBI_CONFIG.REDIRECTS`** ; les deux entrées déclarent enfin une cible (`js/tabibi-nav.js:92`, `:99`, `:129`) | `tests/e2e/nav-rdv-profil.spec.js` — 6 essais × 2 cibles. Contre-épreuves : repli d'origine → **4 rouges** ; table recopiée en dur → **4 rouges** ; `href:'#'` remis → **4 rouges** | **réglé** |

### Pourquoi ça ne se voyait que hors de l'accueil

```js
if (typeof window.isLogged === 'function') { … }   // n'existe QUE sur l'accueil
go((id === 'rdv') ? 'mes-rdv.html' : 'login.html');
```

`window.isLogged` et `window.goDash` viennent de **`js/home-app.js`**, chargé par l'accueil **et par
lui seul**. Sur l'accueil, le bon écran s'ouvrait ; sur mes-rdv, réservation, dawini ou
notifications, **le repli s'appliquait et ignorait la session**.

**Un défaut qui ne se produit pas là où on le teste survit longtemps.** C'est le même mécanisme que
P-91 : la garde de la loupe s'ouvrait sur l'accueil, donc ne traversait jamais le repli.

### On lit la table des espaces, on ne la recopie pas

`TABIBI_CONFIG.REDIRECTS` associe déjà chaque rôle à son espace — c'est la table qu'`auth.js`
utilise après une connexion. Écrire « patient → tableau de bord, sinon connexion » aurait laissé un
**médecin connecté** devant l'écran de connexion, et aurait divergé au premier rôle ajouté. Un essai
interdit explicitement de recopier un `*-dashboard.html` dans la barre : le faire sort **4 rouges**.

### Les `href: '#'` sont quand même corrigés

Ils n'étaient pas la cause, mais ils ne disaient rien — ni à qui lit le fichier, ni au remappage du
bundle desktop (`safeHref`), qui travaille sur des **chemins**. `rdv` déclare `mes-rdv.html`,
`profile` déclare `login.html` (la destination d'un visiteur ; un connecté est aiguillé à
l'exécution, un `href` statique ne peut pas connaître le rôle).

### ⚠️ Un essai qui échouait pour une raison étrangère à son sujet

Mon essai « médecin » ouvrait `mes-rdv.html` — qui appelle `requireAuth('patient')` (l.658) et
redirige un médecin **avant** que la barre du bas existe. Il échouait à l'ouverture, sans rien dire
du câblage qu'il garde. Les cas « médecin » et « visiteur » passent désormais par
`notifications.html`, qui accepte tout rôle connecté.

## P-106 — 75 035 épingles sans coordonnées, et une carte qui casse à la première

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-106 | La couche « épingles par médecin » de la carte construisait `L.marker([null, null])`. Leaflet jette (« Invalid LatLng object ») **depuis un `forEach`** : le rendu entier s'interrompt, le compteur n'est jamais mis à jour, et sur un clic de filtre (`_tbMapFilter`) rien ne rattrape le jet | lu en base le 18/09 : `doctor_profiles` → **75 035 lignes, 0 avec GPS, 75 035 sans**. Pas « presque aucune » : **aucune** | `_tbEstCoord()` + un `.filter()` avant `L.marker` (`js/home-app.js:868` et `:875`) | `tests/e2e/carte-wilaya.spec.js` — 7 essais × 2 cibles. Contre-épreuves : garde retirée → **4 rouges** ; médecins sans GPS posés au centre du pays → **6 rouges** ; bulles coupées → **12 rouges** | **réglé** |

### ⚠️ On IGNORE, on ne REMPLACE pas

Poser ces médecins au centre de leur wilaya — ou du pays — **inventerait une adresse**. La carte
dirait « ce médecin est **ici** » alors que personne ne le sait. C'est la famille de P-64 (quatre
praticiens inventés en vitrine), en plus difficile à repérer : un point sur une carte ne ressemble
pas à un mensonge.

La contre-épreuve l'éprouve explicitement : « réparer » en posant les sans-GPS à `[28.4, 2.8]` sort
**6 rouges**.

### La vue voulue ne dépend d'aucun GPS

Les **bulles par wilaya** (`_tbRenderBubbles`, `DZ_WILAYAS` + `stats_publiques.par_wilaya`) disent
une chose vraie — « environ N médecins dans cette région » — et **n'ont jamais eu besoin de
coordonnées individuelles**. Ce lot n'y touche pas ; les couper sort **12 rouges**.

### `Number.isFinite`, et pas `!= null`

`Number.isFinite('36.75')` est **faux**, et c'est voulu : on n'accepte pas une coordonnée dont il
faudrait deviner le type. Le jour où la base renverra des chaînes, la carte n'affichera **aucune**
épingle — au lieu d'en inventer ou de jeter. Un essai couvre ce cas.

### Ce que ce lot NE fait PAS

Aucun géocodage, aucune écriture en base. **Les 75 035 fiches restent sans coordonnées** : la carte
par épingles est vide **parce que la donnée n'existe pas**, et c'est ce qu'elle doit montrer. Le
jour où des coordonnées arrivent, les épingles reviennent sans qu'on retouche le code — un essai
avec un médecin géolocalisé le vérifie déjà.

## P-107 — « Contacter par e-mail » ouvrait un mail sans destinataire

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-107 | Sur le tableau de bord médecin, « Email » ouvrait le client mail avec le champ **« À » vide** (`doctor-dashboard.html:870`, `mailto:?subject=…`). Le commentaire d'origine disait « le médecin complétera le destinataire » — **il ne le peut pas** | lu en base le 18/09 : `doctor_patients_directory` — la **seule** source de patients accessible à un médecin, la RLS de `public.users` ne lui montrant que sa propre ligne — expose `id · first_name · last_name · phone`. **Pas d'e-mail** | le bouton suit la donnée, comme « Appeler » suit `r.patientPhone` ; et la fonction refuse d'ouvrir un `mailto:` sans destinataire | `tests/e2e/mailto-sans-destinataire.spec.js` — 5 essais × 2 cibles. Contre-épreuves : bouton inconditionnel + mailto vide → **4 rouges** ; bouton « Appeler » masqué aussi → **2 rouges** | **réglé** |

### Ce n'est pas « pas encore chargé » : ce n'est pas exposé

La distinction décide du correctif. Une donnée absente **du chargement** se corrige en la
chargeant ; une donnée absente **de la vue** ne se corrige pas côté front — c'est une question de
droits, donc **supervisée**, et hors de ce lot. Le bouton est masqué, pas contourné.

### La forme du correctif existait déjà dans le fichier

Le bouton « Appeler » est rendu **conditionnellement** sur `r.patientPhone`. « Email » suit
désormais la même règle sur `r.patientEmail`. **Le jour où la vue exposera l'adresse, le bouton
revient sans qu'on retouche le code** — un essai le vérifie en posant un rendez-vous avec e-mail.

⚠️ Et le bouton « Appeler » est **gardé explicitement** : le téléphone, lui, **est** exposé. Un
« masquons les boutons de contact » l'aurait emporté — la contre-épreuve sort **2 rouges**.

### ⚠️ Deux fois où mon essai mesurait autre chose que son sujet

1. **La date.** `renderToday()` filtre sur `r.date === tabibiTemps.aujourdhui()` (fuseau du
   cabinet). Mon rendez-vous était daté « dans deux jours » : il ne s'affichait nulle part, et
   l'essai cherchait un bouton dans une liste vide — **rouge avec ou sans le correctif**.
2. **L'interception de `mailto:`.** J'ai essayé de capturer la navigation en redéfinissant
   `location.href` : « Cannot redefine property: href ». `mailto:` ne produit par ailleurs aucune
   requête réseau. **Il n'y a aucun moyen honnête d'observer cette navigation depuis la page.**
   L'essai vérifie donc ce qu'il peut — le bouton revient quand l'adresse existe — et le
   **destinataire réel est vérifié à la source**, dans un second essai. Deux moitiés, deux essais,
   plutôt qu'un seul qui prétendrait mesurer ce qu'il ne voit pas.

## P-108 — « Nouvelle clé : undefined », et l'admin la transmet au partenaire

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-108 | `admin-api-keys.html:548-553` lisait `row.new_secret` **sans vérifier qu'une ligne existe**. Sur une réponse vide : `TypeError` muet, ou le mot « **undefined** » affiché dans la boîte de dialogue — que l'admin copie et envoie au partenaire | corps de `rotate_api_key` lu en base le 18/09 (voir ci-dessous) | on exige la ligne **et** un `new_secret` non vide avant d'afficher ; message clair sinon, et `loadKeys()` pour montrer l'état **réel** | `tests/e2e/apikey-rotation.spec.js` — 6 essais × 2 cibles. Contre-épreuves : lecture sans garde → **8 rouges** ; garde qui refuse tout → **6 rouges** | **réglé** |

### ⚠️ Le défaut n'est pas celui qu'annonçait la consigne

La consigne décrivait « **0 row** ». Lu en base, le corps de la fonction :

```sql
IF NOT FOUND THEN RAISE EXCEPTION 'Clé % introuvable', p_key_id;   -- → error, déjà traité
…
RETURN NEXT;                                                        -- toujours atteint
```

**Le cas « zéro ligne » n'est pas atteignable aujourd'hui.** Ce qui l'est :

```sql
SELECT * INTO v_pair FROM public.generate_api_key_pair(...);
new_secret := v_pair.key_id || ':' || v_pair.secret_plain;
```

`SELECT INTO` **ne lève pas** quand rien ne vient : `v_pair` reste NULL, la concaténation rend
**NULL**. **La ligne existe, et son secret est vide.** C'est un chemin du code, pas une hypothèse.

Le correctif couvre **les deux** — celui qui peut arriver et celui qui ne peut pas encore : un
`RETURN QUERY` ajouté demain rendrait le second réel, et la garde serait déjà là.

### Pas de `data.error` — et c'est écrit dans le code

Ce retour est une `TABLE`, **sans enveloppe métier**. Tester `data.error` aurait ajouté du code mort
qui a l'air d'une garde — la faute relevée par l'audit du 17/09 sur trois lots de la file (N8, N9,
N13). On juge sur la **présence** de la ligne et du champ.

### ⚠️ Ma garde de source sortait ROUGE sur le build — et elle avait tort

Le premier jet mettait l'assertion de **forme** (`if (!secret)` présent, `${row.new_secret}` absent)
dans l'essai e2e. Celui-ci lit le fichier **servi** : sur `dist-web`, Vite **minifie** le script en
ligne, `if (!secret)` devient `if(!o)`, et l'essai accusait **un code parfaitement correct**.

Famille de **P-29** (sources vertes, build faux), dans l'autre sens. **Une assertion sur la forme du
source appartient à un essai qui lit le DÉPÔT**, pas la sortie de build : elle vit désormais dans
`tests/apikey-rotation-source.test.mjs`. Les essais de **comportement** restent en e2e et passent
sur les deux cibles.

⚠️ Et je l'ai failli manquer : mon filtre de lecture du rapport tronquait la ligne « 2 failed » et
n'affichait que « 762 passed ». **Un résumé qui ne montre que le vert n'est pas une preuve.**

### Deux détails qui évitent un second « undefined »

- `expires_old_at` manquant affiche « date inconnue », pas `undefined` ;
- après un refus, `loadKeys()` est **quand même** appelé : l'ancienne clé a pu être marquée à
  expirer **avant** l'échec, et l'écran doit montrer l'état réel, pas celui d'avant l'appel.

## P-109 — « Email ou mot de passe incorrect » sur un mot de passe JUSTE (Safari)

| ID | symptôme | cause | correctif | garde | statut |
|---|---|---|---|---|---|
| P-109 | Sur `/login` onglet « E-mail », **Safari** refusait des identifiants **corrects** avec le message « Email ou mot de passe incorrect ». Remonté en prod par un testeur réel | le captcha **visible** n'était rendu que pour trois écrans (`login` téléphone, `reset`, `otp`). L'écran e-mail n'avait **aucun widget** : son jeton retombait sur le chemin **invisible** (`getCaptchaToken`), que WebKit **ne complète jamais** (PAT 401 + ITP, déjà documenté `login.html:121`). Supabase exige le captcha → refus | un quatrième widget `loginEmail`, rendu **à la bascule d'écran**, et `doLogin` passe **son** jeton à `signInWithPassword` | `tests/e2e/captcha-email-visible.spec.js` — 6 essais × 2 cibles. Contre-épreuves : slot retiré → **2 rouges** ; retour à `auth.signIn` → **2 rouges** ; rendu au chargement → **2 rouges** | **réglé** |

### Le message accusait l'utilisateur d'une faute qu'il n'avait pas commise

Le refus du captcha remonte comme un échec d'authentification, et `doLogin` affiche — **par
prudence, pour ne pas révéler quel champ est faux** — « Email ou mot de passe incorrect ».

Cette prudence est juste. **Mais appliquée à un refus qui n'a rien à voir avec les identifiants,
elle envoie quelqu'un vérifier son mot de passe pendant que le vrai problème est ailleurs.** Un
message générique protège ; il ne doit pas couvrir toutes les causes.

### Rendu à la bascule, pas au chargement

Dans un conteneur `display:none`, **Turnstile calcule une taille nulle** — c'est pourquoi `reset` et
`otp` étaient déjà rendus à l'affichage de leur écran. Rendre `loginEmail` au `DOMContentLoaded`
aurait produit un widget de 0 px : **un correctif qui ne corrige rien**, et une contre-épreuve le
montre (**2 rouges**).

### ⚠️ `signup.html` n'a PAS le même défaut — vérifié

Son captcha `form` est rendu au chargement sur un formulaire **visible**, et le chemin e-mail
(P-93) utilise déjà `_captchaTokenFor("form")`. Rien à corriger ; signalé au RETOUR pour que
personne n'ouvre un lot inutile.

### Ce que la garde NE prouve pas

Que **Safari** accepte. Les essais tournent sur Chromium, et `_hermetique` coupe le réseau vers
Cloudflare : le vrai widget ne se charge jamais. Ce qui est vérifié, c'est **le câblage** — le slot
existe, il est demandé au bon moment, le jeton part par le bon chemin, et la requête
d'authentification l'emporte réellement (mesuré sur le corps de la requête).

**La recette Safari reste à faire à la main** (P-31). Une garde hermétique ne peut pas prouver
qu'un tiers, coupé par construction, se comporte bien.

## P-110 — une modale VIDE, collée à gauche, et un chargement qui ne finissait jamais

| ID | symptôme | cause | correctif | garde | statut |
|---|---|---|---|---|---|
| P-110 | Sur `patient-ordonnances.html`, patient connecté **sans aucune ordonnance**, une modale « Détail de l'ordonnance » **vide** (titre + Fermer, rien d'autre) s'affichait **collée à gauche**, pendant que la liste disait « Aucune ordonnance active ». Remonté en live | `styles/components-v2.css:707` définit un `.modal` **global** qui est un **PANNEAU** (`width:100%; max-width:480px; display:flex; flex-direction:column; animation`), alors que cette page appelle `.modal` sa **surcouche** (`position:fixed; inset:0; display:none`). **Même spécificité (0,1,0)** → l'**ordre** tranche, et **il s'inverse au build** | la surcouche passe par l'**ID** — `#modal.modal` (1,0,0), qui gagne quel que soit l'ordre — et **neutralise explicitement** ce que le panneau imposait (`max-width`, `flex-direction`, `animation`, `border-radius`, `box-shadow`, `overflow`). Plus deux lignes de défense : `openDetail` refuse un `p` nul, et le squelette est retiré sur les sorties anticipées de `load()` | `tests/e2e/ordonnances-modale-vide.spec.js` (5 essais × 2 cibles) + `tests/ordonnances-modale-source.test.mjs` (3 essais) | **réglé** |

### La mesure, pas l'hypothèse : l'ordre s'inverse au build

Le SEQ supposait une modale ouverte par erreur au chargement. **Mesure du 18/09, même page,
même navigateur, sur les deux cibles :**

```
sources    #modal → display: none   max-width: 480px
dist-web   #modal → display: FLEX   max-width: 480px
```

Personne n'ouvrait rien. **Sur le site déployé, la surcouche était visible en permanence**, large
de 480 px — d'où « collée à gauche » — et vide, puisqu'aucun détail n'avait été demandé.

**C'est [P-88](#p-88--une-égalité-de-spécificité-est-une-dépendance-à-lordre-des-fichiers) à la
lettre** (`nav.tab-bar`, 13/09), et c'est la seconde fois. Une égalité de spécificité n'est pas un
style : c'est une **dépendance à l'ordre de concaténation**, et Vite ne le garantit pas.

### Le `max-width` seul aurait suffi à laisser le défaut visible

Redéclarer `display` sans toucher `max-width` aurait fermé la modale — et laissé une surcouche
de 480 px le jour où elle s'ouvre. **Un correctif qui répare le symptôme le plus bruyant et laisse
le reste est un correctif à moitié.** D'où la neutralisation explicite des six propriétés que le
panneau imposait et que la page ne déclarait pas.

### Un écran qui charge indéfiniment ment autant qu'un faux succès

`applyFilter()` retire bien le squelette — mais il n'est atteint **que si `load()` va au bout**.
Sans client base, la fonction sortait sur un `return` après un simple toast : **les trois barres
grises tournaient pour toujours**, et l'écran n'a plus jamais rien dit. Mesuré : `skeletons = 3`
sur ce chemin, `0` sur le chemin normal. Même famille que
[P-95](#p-95--profil-sauvegardé--en-vert-juste-après-sauvegarde-échouée) : **l'écran promet que
quelque chose arrive.**

### Les contre-épreuves — mesurées, pas annoncées

| ce qu'on retire | sources | dist-web | unités |
|---|---|---|---|
| l'**ID** du sélecteur (`#modal.modal` → `.modal`) | **10 verts** ⚠️ | **8 rouges** / 2 verts | **1 rouge** |
| l'arrêt du squelette dans `load()` | **2 rouges** / 8 verts | — | — |
| la garde `if (!p || !p.id)` de `openDetail` | — | — | **1 rouge** |

**La première ligne est la leçon du lot.** Sans l'ID, la garde est **verte sur les sources** et
rouge sur le build : elle n'a de valeur que parce qu'elle tourne **sur les deux cibles**. Une garde
qui n'aurait tourné que sur les sources aurait certifié un produit cassé.

### ⚠️ Et `dist-web` périmé m'a fait conclure l'inverse

Première mesure après correctif : rouge. J'ai cru le correctif faux. **`dist-web` datait d'avant
les corrections** — je mesurais le passé. Après `npm run build` : 10/10.
**Mesurer un build sans le reconstruire, c'est mesurer hier** (famille de la règle 8 : le
cache-bust vaut aussi pour le build lui-même).

### Une assertion de FORME appartient à un essai qui lit le dépôt

La garde de `openDetail` (`p` nul) n'est pas atteignable depuis la page : la fonction est locale au
module. Elle est tenue **à la source**, dans `tests/ordonnances-modale-source.test.mjs` — leçon de
[P-108](#p-108--nouvelle-clé--undefined-et-ladmin-la-transmet-au-partenaire), où Vite minifiait
`if (!secret)` en `if(!o)` et rendait un essai rouge sur du code juste.

Ce même fichier garde **une troisième assertion** : que le `.modal` global de `components-v2.css`
**existe toujours**. Le jour où il disparaît, la garde le dit — au lieu de continuer à protéger
contre un conflit qui n'existe plus.
## P-111 — « Se déconnecter » au milieu de l'écran, et une classe « large » défaite en ligne

| ID | symptôme | cause | correctif | garde | statut |
|---|---|---|---|---|---|
| P-111 | Sur PC, dans l'espace connecté, le bouton « Se déconnecter » s'affichait **au milieu de la page**. Signalé en live par Aghiles | `patient-profile.html` et `medecin-profile.html` sont **les deux seules pages espace sans bouton de déconnexion dans la barre du haut**. Leur unique sortie était un `btn-full` posé dans le corps de la page : dans un conteneur élargi par [P-104](#p-104--les-espaces-connectés-tenaient-dans-un-couloir-de-760-px), un `btn-full` **est** un bouton centré au milieu de l'écran | bouton de déconnexion **à droite dans `header.app-bar`** sur les deux pages ; le bouton de page prend la classe `.logout-en-page`, masquée **au-delà de 1024 px seulement** | `tests/e2e/logout-barre-pc.spec.js` — 10 essais × 2 cibles | **réglé** |
| P-111 b | `admin-cabinet.html` se déclarait `page page-large` et restait plafonnée à **960 px** sur un écran de 1280 | `style="…max-width:960px…"` **en ligne** sur le `<main>` : un style en ligne bat toute feuille, y compris `.page.page-large { max-width:none }` | le cap en ligne est retiré ; la page suit le shell `.app-root` (1100 px, 1240 au-delà de 1440) comme les autres espaces | même fichier | **réglé** |

### Le relevé qui a désigné les coupables

Toutes les pages « espace » ouvertes une à une, fenêtre de 1280 px, position du bouton mesurée :

```
patient-profile.html    PAGE   x=106  w=1068  centre = 640   ← le milieu EXACT
medecin-profile.html    PAGE   x=614  w=638   centre = 933
patient-dashboard.html  BARRE  x=1002 w=36    centre = 1020  ✓
doctor-dashboard.html   BARRE  x=1220 w=40    centre = 1240  ✓
agenda-cabinet.html     BARRE  x=1220 w=40    centre = 1240  ✓
secretaire-dashboard    BARRE  x=1102 w=40    centre = 1122  ✓
admin-dashboard.html    BARRE  x=1106 w=36    centre = 1124  ✓
```

**Le défaut n'était pas « un bouton mal placé » : c'était une barre incomplète.** Les cinq pages
correctes ont toutes leur sortie dans la barre ; les deux fautives n'en avaient pas, donc le corps
de page faisait l'appoint. Corriger le bouton sans ajouter la barre aurait supprimé la sortie.

### ⚠️ On ne coupe pas la sortie du téléphone pour ranger celle du PC

Le bouton de page **reste** : sur mobile, la barre du haut n'a pas la place d'un libellé, et c'est
la seule sortie. Il est masqué **à partir de 1024 px**, là où la barre prend le relais — jamais en
dessous. La contre-épreuve mobile est dans la garde, et elle est là précisément pour interdire ce
raccourci.

### Une classe qui dit « large », un `style=` qui dit 960

`admin-cabinet.html` portait les deux. **Le style en ligne gagne, en silence, et la classe reste
là pour faire croire que c'est réglé.** Même famille que P-110 (l'ordre des feuilles) et
[P-88](#p-88--une-égalité-de-spécificité-est-une-dépendance-à-lordre-des-fichiers) : le sélecteur
qu'on lit n'est pas toujours celui qui s'applique. **Un cap en dur qui double un cap de shell est
un cap qui finira par diverger de l'autre.**

### ⚠️ `agenda-cabinet` mesure 732 px, ET C'EST VOULU — la garde l'écrit

Poste de travail à trois colonnes : rail fixe de 224 px, panneau fixe de 324 px, agenda au centre.
`1280 − 224 − 324 − marges ≈ 732`. **Une garde qui exigerait « plus de 1000 px partout » ferait
« corriger » une mise en page juste** — la faute que ce dépôt documente depuis P-82. Un essai
dédié vérifie donc que le rail et le panneau sont **toujours là**, et dit pourquoi le chiffre est
petit.

### Deux fois où ma propre garde s'est trompée — corrigées, pas contournées

1. **Le fourre-tout de routes avalait `users`.** Playwright essaie les routes de la **plus récente
   à la plus ancienne** : `**/rest/v1/**` posé en dernier gagnait sur `**/rest/v1/users*`, toutes
   les pages admin se croyaient ouvertes à un patient et **redirigeaient**. Mon premier relevé
   « mesurait » `patient-dashboard` cinq fois de suite sans que rien ne le signale.
2. **La garde accusait un rail de navigation.** Elle ne connaissait que `.ag-sidebar` ; les autres
   pages pro reçoivent `.tbi-pro-sidebar` (`js/tabibi-pro-sidebar.js`). `medecin-profile` sortait
   rouge pour un bouton parfaitement à sa place. **Une garde calibrée sur un seul relevé ne garde
   qu'un seul cas** — la première version ne refusait d'ailleurs qu'un bouton à moins de 20 % du
   centre, ce qui attrapait `patient-profile` (640) et laissait passer `medecin-profile` (933).

### Les contre-épreuves — mesurées

| ce qu'on retire ou remet | résultat |
|---|---|
| la règle `.logout-en-page` (≥ 1024 px) | **2 rouges** |
| le bouton de barre de `patient-profile` | **2 rouges** |
| le cap `max-width:960px` en ligne de `admin-cabinet` | **1 rouge** |
| le masquage rendu **global** au lieu de ≥ 1024 px | **1 rouge** — la sortie mobile |

## Ouverts — aucune garde, et c'est le sujet

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-28 | Trois parcours affichent « Email envoyé » alors que **rien ne part** | `README_APP.md` : `RESEND_API_KEY` posé le 20/05, `send-email` jamais écrite | la brique d'envoi existe (`_partage/courriel.ts`) et sert **un** parcours | **garde manquante** pour les trois autres | **ouvert** |
| P-60 | La carte annonce **« Téléconsultation · Disponible »** et **aucun médecin ne la propose** | mesuré en base le 16/09 : `count(*) filter (where telehealth_enabled)` = **0** sur **75 035** `doctor_profiles` (et 1 seul `is_verified`) | aucun — c'est une décision produit, pas un correctif de code : ouvrir le drapeau sur de vrais médecins, ou retirer l'annonce | **garde manquante par nature** : un essai hermétique ne voit pas la base. La mesure est à refaire avant chaque annonce | **ouvert** |
| ~~P-63~~ | Le curseur « Prix max » filtrait dès 5 000 DA sans que personne ne l'ait demandé | — | **réglé le 16/09 par [P-72](#p-72--un-filtre-que-personne-navait-posé-un-reset-qui-ne-remettait-rien)** : le post-filtre suit `prixModifie`, et le reset revient à `defaultValue` | `tests/e2e/filtre-prix.spec.js` | **réglé — ligne conservée pour qui cherche P-63** |
| P-64 | La section « Nos praticiens — Des médecins de confiance » montre **quatre médecins inventés** (« Dr. Nadia K. », « Dr. Yacine B. »…) avec badge **« Vérifié »** et notes **★ 4.9 / 5.0** | `accueil-public.html`, `#sec-vitrine` : noms, spécialités, wilayas et notes écrits en dur ; photos Unsplash. Un commentaire signale les photos comme provisoires — **pas les identités ni les notes** | aucun : même famille que « Dr. Amine · 09:30 » (P-27) et les six articles de blog qui n'existaient pas (P-47) | **garde manquante** — à trancher : vrais praticiens, ou section explicitement présentée comme une illustration | **ouvert** |
| P-69 | Une candidature **persiste, et personne n'est prévenu** | la table et la RPC sont en place (P-68 b) ; la RLS autorise la lecture admin. **La moitié « aucun écran ne la lit » est fermée le 16/09 par P-78** — `admin-candidatures.html` existe et le tableau de bord admin y mène. Reste la moitié qui n'a pas d'écran : **rien ne prévient à l'arrivée d'un dossier** | voir **P-79** pour ce qu'il reste à décider | **garde manquante** : un essai ne peut pas vérifier qu'un humain regarde | **partiellement réglé** |
| P-79 | **Ce qu'il reste à décider sur P-69**, et qui demande une écriture en base | rien ne prévient à l'arrivée d'un dossier, et la liste admin est en **lecture seule** — changer un statut serait une écriture | à trancher : notification à l'insertion (déclencheur → `send-email`, ou ligne dans `notifications`) **et** RPC admin de changement de statut. **Validation d'Aghiles requise** (règle 3) | **garde manquante par nature** | **ouvert** |
| ~~P-92~~ | **22 liens** vers `index.html` — la porte fermée — dans 18 pages, hors barre du bas | `git grep -n 'href="index.html'`, relevé le 17/09 | **réglé le 18/09 par [P-100](#p-100--54-chemins-menaient-encore-a-la-porte-close-et-les-pires-netaient-pas-des-liens)** : 54 emplacements repointés, dont l'épine dorsale (`afterLogout`, défauts de l'en-tête, gardes d'accès) | `tests/porte-fermee-liens.test.mjs` + `tests/e2e/porte-fermee-navigation.spec.js` | **réglé — ligne conservée pour qui cherche P-92** |
| P-94 | La porte `e2e` rouge renvoie vers un journal **qui n'existe plus** : Playwright vide `test-results/`, où le lanceur écrit | constaté le 17/09 : gate rouge, aucun `.log` sur le disque. `scripts/verifier-toutes.mjs:207` | écrire les journaux hors du répertoire que Playwright gère | **garde manquante** — à écrire avec le correctif | **ouvert** |
| P-87 | Sur téléphone, **le bandeau cookies recouvre la barre d'onglets** : les six onglets du bas sont inatteignables tant qu'on n'a pas répondu | mesuré le 17/09 en écrivant la garde de P-86 : `document.elementFromPoint()` au centre du bouton loupe rend `#tabibi-cookie-banner`. Hauteur de vue 727 px, bandeau à partir de 727, bouton centré à 696 | à trancher : remonter le bandeau au-dessus de la barre, ou décaler la barre tant que le bandeau est là. **Arbitrage d'affichage, pas un correctif évident** — le bandeau doit rester lisible | **garde manquante** : l'essai de P-86 se place volontairement APRÈS la réponse au bandeau | **ouvert** |

---

## Ce que ce registre ne fait pas

Il ne prouve pas qu'un problème est réglé : il dit **où regarder**. Une garde peut exister
et être fausse — c'est arrivé trois fois en écrivant le compteur d'`innerHTML`, qui
accusait sa propre documentation, puis ignorait deux échappeurs sur onze.

Il ne remplace pas non plus les essais réels (P-31). **Une porte verte dit qu'aucune faute
connue n'est revenue ; elle ne dit pas que le produit marche.**
