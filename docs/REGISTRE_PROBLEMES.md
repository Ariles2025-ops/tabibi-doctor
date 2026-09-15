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

## 69 wilayas — et deux divergences trouvées en chemin

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-52 | Décret présidentiel 26-206 du 25/05/2026 : **58 → 69 wilayas**. La liste vivait **en dur dans le front**, à **quatre endroits** | `_W`, `WILAYA_I18N`, `assets/dz-wilaya-centroids.js`, `<select id="sw">` de `signup.html` | les onze ajoutées aux quatre endroits, avec libellés AR/EN et chef-lieu | `tests/wilayas-69.test.mjs` — les quatre listes comptent 69, **et disent la même chose** | **réglé** |
| P-53 | **`WILAYA_I18N` s'arrêtait à 48.** Les dix wilayas de 2019 n'avaient **ni arabe ni anglais** | `El M'Ghair`, `El Meniaa`, `Ouled Djellal`, `Bordj Baji Mokhtar`, `Béni Abbès`, `Timimoun`, `Touggourt`, `Djanet`, `In Salah`, `In Guezzam` — `dcity()` retombait sur le français **sans rien signaler** | les dix ajoutées | même test : **chaque** wilaya doit avoir un libellé, et le libellé « arabe » doit contenir des caractères arabes | **réglé** |
| P-54 | `signup.html` écrivait **« Bordj Badji Mokhtar »**, `_W` et la base **« Bordj Baji Mokhtar »** | **une lettre**. Un médecin qui choisissait cette wilaya à l'inscription posait une valeur que la recherche ne retrouvait pas | menu régénéré **à partir de `_W`** | même test : `signup.html` doit dire **exactement** les noms de `_W` | **réglé** |

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


## Ouverts — aucune garde, et c'est le sujet

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-27 | `accueil-public.html` affiche **4 fiches de médecins écrites en dur** — « ✓ Vérifié · ★ 4,9 » | ces médecins n'existent pas ; `reviews` contient 0 ligne | — | **garde manquante** | **ouvert** |
| P-28 | Trois parcours affichent « Email envoyé » alors que **rien ne part** | `README_APP.md` : `RESEND_API_KEY` posé le 20/05, `send-email` jamais écrite | la brique d'envoi existe (`_partage/courriel.ts`) et sert **un** parcours | **garde manquante** pour les trois autres | **ouvert** |
| P-29 | Le sélecteur de langue **disparaît** de l'accueil construit quand un tiers est injoignable | sources hermétique : 3 boutons · `dist-web` hermétique : **0** · `dist-web` serveur nu : 3 | — (mécanisme non élucidé) | **garde manquante** | **ouvert** |
| P-31 | Aucun essai réel : vidéo à deux navigateurs, avis sur données réelles, un PDF arabe **regardé**, un SMS de rappel reçu | — | — | **garde manquante par nature** — un humain doit regarder | **ouvert** |

---

## Ce que ce registre ne fait pas

Il ne prouve pas qu'un problème est réglé : il dit **où regarder**. Une garde peut exister
et être fausse — c'est arrivé trois fois en écrivant le compteur d'`innerHTML`, qui
accusait sa propre documentation, puis ignorait deux échappeurs sur onze.

Il ne remplace pas non plus les essais réels (P-31). **Une porte verte dit qu'aucune faute
connue n'est revenue ; elle ne dit pas que le produit marche.**
