# Architecture cible — document de décision

> Rédigé le 10 septembre 2026 à partir du dépôt (branche d'intégration `fix/p0-securite-chaine-approvisionnement`),
> de la base de production (requêtes `SELECT`) et de mesures locales. Aucune échéance. Ce document juge
> chaque brique sur un seul critère, énoncé ci-dessous ; il donne pour chacune l'existant, la proposition,
> un verdict argumenté et un coût de migration en jours de travail (une personne outillée, tests et
> documentation compris). Les chiffres mesurés sont signalés ; les chiffres de référence non mesurés
> sont marqués « valeur publique ».

## 0. Le critère, et ce qu'il implique vraiment

**Critère** : une brique n'est retenue que si elle est excellente **et** peut tourner sur un serveur loué
à Alger **sans réécriture** du code applicatif. La loi n° 25-11 du 24 juillet 2025 peut imposer
l'hébergement en Algérie des données de santé ; Supabase n'a aucune région en Afrique ; la question
n'est pas tranchée. L'architecture doit donc être **portable par construction**, pas portée le jour où
la réponse tombe.

Ce que « tourner à Alger » veut dire couche par couche :

| Couche | Ce qui doit pouvoir être déplacé | Ce qui peut rester à l'extérieur sans toucher aux données | Conséquence pour les choix |
|---|---|---|---|
| Données au repos (Postgres, Storage) | oui, intégralement | rien | Postgres + Supabase auto-hébergé (acquis). **Attention à R2** : Cloudflare R2 n'a pas de localisation algérienne ; il ne peut porter que des objets sans donnée personnelle (APK, images publiques). Les pièces d'identité des médecins, les ordonnances et les photos de profil doivent pouvoir aller vers le Storage Supabase auto-hébergé (backend S3 local, MinIO ou disque). |
| Traitement (API, tâches de fond) | oui : le même code doit démarrer dans un conteneur | l'exécution en bordure (Workers) tant que le traitement ne conserve rien | Tout code serveur doit avoir **deux cibles dès le premier commit** : Workers et Node/Docker. Les services liés à Cloudflare (bindings, KV, Analytics Engine) ne sont admis que derrière une interface avec une implémentation portable. |
| Réseau devant | non : Cloudflare reste devant (décision prise) | DNS, WAF, cache, TLS | Le trafic transite par Cloudflare dans tous les cas ; le critère porte sur la persistance, pas sur le transit. |
| Front statique | trivial : des fichiers | CDN | Tout générateur qui produit des fichiers statiques passe le critère. |
| Observabilité | les traces contenant des données personnelles doivent pouvoir être auto-hébergées ou expurgées | l'uptime (aucune donnée) | PostHog et Sentry s'auto-hébergent ; Better Stack non, mais ne voit aucune donnée. |
| Sync locale (local-first) | le service de synchronisation touche toutes les données : il doit s'auto-héberger | rien | PowerSync, ElectricSQL et Zero s'auto-hébergent ; le client garde une copie des données sur l'appareil, ce qui est un sujet 25-11 en soi. |

**Réalité de l'auto-hébergement Supabase** (à connaître avant de décider) : la pile Docker officielle
fournit Postgres avec les extensions utilisées ici (`pg_cron`, `pg_net`, `pgcrypto`, `pg_trgm`, `unaccent`,
`supabase_vault`), GoTrue (le hook SMS et Turnstile fonctionnent), PostgREST, Storage (backend S3
configurable), Realtime, Kong, Studio, et le runtime des edge functions. Ne sont **pas** fournis :
sauvegardes gérées et PITR (à monter soi-même avec `pgBackRest` ou `wal-g`), API de gestion,
branching, secrets d'edge functions gérés (fichier `.env`), journaux centralisés. Le coût d'exploitation
d'un tel serveur est réel : mises à jour, sauvegardes testées, supervision. Il n'a pas à être payé
aujourd'hui, mais chaque brique ci-dessous est jugée en supposant qu'il le sera peut-être.

**Ce que le dépôt impose comme contraintes** (mesuré dans `README_APP.md`) : 47 pages HTML sans
framework dont 10 sous Vite, 51 modules communiquant par globales, 576 pages SEO générées, un client
Android qui embarque le même HTML, un desktop Tauri qui embarque 17 pages pro, une v2 React de
laboratoire (agenda, 21 tests, types générés), 55 tables et 81 fonctions `SECURITY DEFINER`, 41 comptes,
0 rendez-vous, une seule personne pour tout faire.

---

## 1. Couche API en Hono (Workers + conteneur)

**Aujourd'hui.** Le navigateur parle directement à PostgREST avec la clé `anon`. Les lectures publiques
(`public_doctors`, 75 034 lignes) sont énumérables à 1 000 lignes par requête ; la seule limitation de
débit est celle de GoTrue ; Turnstile ne protège que la connexion ; il n'existe aucun journal d'accès
applicatif. La PR #57 ferme l'énumération avec des RPC bornées **dans la base** (`chercher_praticiens`
limité à 50, filtre obligatoire), ce qui est la version « sans serveur » de cette brique. Les edge
functions Supabase (Deno) portent le hook SMS, les rappels, le DLR et Turnstile.

**Proposition.** Une API Hono en TypeScript strict, déployée sur Cloudflare Workers, avec une cible
conteneur identique. Elle porte le cache, la limitation de débit, Turnstile sur requêtes anormales, la
pagination bornée et le journal d'accès. Les endpoints publics cessent de parler à PostgREST ; les
requêtes authentifiées continuent en direct.

**Verdict : oui, c'est la brique fondatrice, à deux conditions.**

- *Pourquoi oui.* Hono tourne sans changement sur Workers, Node, Bun et Deno (donc aussi dans une edge
  function Supabase auto-hébergée) : c'est le seul cadre de cette liste dont la portabilité est native
  et non promise. Il donne un point unique où mettre ce que PostgREST ne sait pas faire : cache par
  requête, quotas par IP et par clé, Turnstile conditionnel, journal, schéma de réponse stable pour le
  front, le mobile, le desktop et l'Astro à venir. Il retire à `anon` tout accès direct aux vues, ce que
  la PR #57 ne fait qu'à moitié (les RPC restent appelables sans quota).
- *Condition 1 : deux cibles dès le premier commit, testées ensemble.* Les bindings Workers ne sont pas
  portables : Rate Limiting binding, Cache API, KV, Analytics Engine. Chacun doit être derrière une
  interface (`Limiteur`, `Cache`, `Journal`) avec une implémentation Workers **et** une implémentation
  portable. Pour la limitation de débit, l'implémentation portable existe déjà dans la base : la table
  `rate_limits` et la fonction `fn_check_rate_limit(p_key, p_max, p_window)` sont présentes et
  **jamais utilisées**. Pour le cache : mémoire du processus en conteneur, Cache API sur Workers. Pour le
  journal : table `api_access_log` (partitionnée par jour, comme `api_usage_log` l'est déjà) écrite par
  lots, sur les deux cibles ; Analytics Engine en plus sur Workers si l'on veut. Le test de parité
  (même suite lancée contre `wrangler dev` et contre le conteneur, réponses comparées octet à octet
  hors en-têtes de date) fait partie du livrable.
- *Condition 2 : l'API accède aux données avec un rôle dédié et minimal, pas avec `service_role`.* Créer
  un rôle Postgres `api_public` (lecture seule sur `public_doctors`, `wilayas`, `specialties`,
  exécution des RPC d'agrégats) et le faire porter par un JWT signé avec la clé du projet, ou par une
  connexion Postgres directe en conteneur. Ainsi une fuite de la configuration de l'API n'expose pas la
  base entière. Les RPC de la PR #57 deviennent l'accès interne de l'API (bornes en base, bornes dans
  l'API : deux ceintures).
- *Ce qui ne passe pas par l'API.* Les requêtes authentifiées (agenda, dossier, cabinet) restent en
  direct : la RLS est déjà la bonne autorité, et interposer un serveur y ajouterait de la latence sans
  gain. Exception à prévoir : les écritures qui doivent être idempotentes ou facturées (prise de
  rendez-vous avec Chargily) passeront par l'API.
- *Point de vigilance Alger.* Un Worker s'exécute en bordure, jamais en Algérie. Tant que l'API ne
  persiste rien (elle lit, met en cache des réponses publiques anonymisées, écrit un journal d'accès
  contenant une IP hachée), c'est du transit, déjà accepté avec Cloudflare devant. Le jour où la
  résidence stricte est exigée, la cible conteneur prend le relais derrière le même DNS : c'est pour
  cela que la parité est non négociable.

**Coût estimé.**

| Étape | Jours |
|---|---|
| Spike : workspace `api/`, un endpoint recherche, limiteur, cache, Turnstile conditionnel, journal, Docker, test de parité, tests | 4 à 5 |
| Endpoints publics restants : fiche, agrégats SEO, carte, compteurs, liste d'attente (insert), stats | 5 à 6 |
| Bascule du front (les 9 appelants de `public_doctors` + générateur SEO), retrait des droits `anon` sur les vues | 3 |
| Rôle `api_public`, journal partitionné, tableau de bord minimal des accès | 2 |
| **Total** | **14 à 16** |

---

## 2. Local-first (PowerSync, ElectricSQL, Zero)

**Aujourd'hui.** Aucune capacité hors ligne au-delà d'un service worker qui ne met en cache que les
assets et n'est enregistré que depuis l'accueil. L'agenda médecin (`js/tabibi-agenda.js`,
`js/tabibi-doctor-dashboard.js`, `v2/src/pages/Agenda.tsx`) lit `appointments`,
`doctor_unavailable_slots`, `doctor_patients_directory`, `cabinet_calendar_view` en direct. L'unicité
des créneaux est garantie par la base (`validate_appointment_time`, index d'exclusion). 0 rendez-vous à
ce jour.

**Proposition.** PowerSync : la base vit dans l'appareil, l'agenda fonctionne sans réseau et se
resynchronise. Comparer à ElectricSQL et Zero.

**Verdict : pas maintenant, et pas avec le front actuel. Brique de dernier rang, à reprendre quand le
front pro sera en React. Le modèle de données s'y prête partiellement, avec deux points durs.**

| | PowerSync | ElectricSQL | Zero (Rocicorp) |
|---|---|---|---|
| Principe | réplication logique Postgres → « buckets » définis par des règles de sync → SQLite sur l'appareil ; écritures renvoyées à votre backend | réplication logique → « shapes » (table + `where`) servies en HTTP, cache CDN ; écritures à votre charge (API) ; s'intègre à TanStack DB | réplication → `zero-cache` ; requêtes ZQL côté client ; permissions déclarées dans le schéma ; écritures via mutateurs |
| Auto-hébergement | oui (édition ouverte, Docker ; stockage des buckets en Postgres ou MongoDB) | oui (un service Elixir en Docker) | oui (`zero-cache`, Docker, Postgres avec réplication) |
| Clients | web (SQLite en WASM/OPFS), Capacitor, React Native, Flutter | web via TanStack DB, tout client HTTP | React d'abord ; web |
| Maturité (valeur publique, à revérifier au moment de décider) | production depuis 2023, intégration Supabase documentée | moteur réécrit en 2024, stable sur la lecture, écritures encore à la charge de l'application | en bêta en 2025, API en mouvement |
| Nos RLS | **ne s'appliquent pas** à la réplication : il faut réécrire les règles d'accès en règles de sync, paramétrées par le JWT ; PowerSync sait dériver des paramètres par requête (ex. `select cabinet_id from cabinet_members where user_id = token.sub`), donc les cabinets multi-membres sont exprimables | shapes filtrés par un `where` ; pour l'appartenance à un cabinet il faut un proxy (« gatekeeper ») qui signe les shapes autorisés | permissions ZQL par ligne, expressives, mais liées au schéma Zero |
| Nos créneaux | **point dur** : deux appareils hors ligne peuvent prendre le même créneau ; la base rejette la seconde écriture au retour du réseau, l'application doit afficher le conflit et réparer. PowerSync le gère par sa file d'upload et vos gestionnaires d'erreur | idem : l'écriture passe par votre API, qui répond 409 | idem, mutateurs serveur |
| Données de santé sur l'appareil | copie locale de `doctor_patients_directory` (noms, téléphones) et de l'agenda : chiffrement du stockage local à traiter, périmètre de sync strictement réduit au médecin connecté | idem | idem |

Ce que le modèle permet : l'agenda d'un médecin (ses rendez-vous, ses indisponibilités, ses patients)
est un périmètre fermé, borné, qui se synchronise bien. Ce qu'il ne permet pas : la prise de rendez-vous
par le patient hors ligne (autorité serveur indispensable), le secrétariat multi-cabinets sans
proxy d'autorisation, et rien tant que 0 rendez-vous n'existe pour valider le besoin.

Si la brique est reprise plus tard : **ElectricSQL** est le meilleur ajustement à notre architecture
cible (lecture synchronisée, écritures par l'API Hono, TanStack DB côté React, un seul conteneur) ;
**PowerSync** est le choix si le mobile Capacitor hors ligne devient central (SQLite natif) ;
**Zero** n'est pas retenu (maturité, couplage React, schéma propre).

**Coût estimé** (agenda médecin seul, après la brique 5) : ElectricSQL 8 à 12 jours ; PowerSync 12 à
15 jours ; plus l'exploitation d'un service supplémentaire. Aujourd'hui : 0, ne rien engager.

---

## 3. Trigger.dev pour les tâches de fond

**Aujourd'hui.** Deux jobs `pg_cron` : nettoyage quotidien des journaux, et rappels toutes les 15 min
qui appellent une edge function par `pg_net` avec un secret écrit en clair dans `cron.job` et qui
reçoivent HTTP 401 à chaque tir sans que rien ne le signale. La PR #58 propose Vault, un heartbeat en
base, une alerte si aucun 200 en 45 min, et un plafond d'envois par exécution.

**Proposition.** Trigger.dev à la place de `pg_cron` + `pg_net` : exécutions visibles, reprises,
alertes natives, auto-hébergeable.

**Verdict : non pour l'instant. Le diagnostic est juste, le remède est surdimensionné. Le 401 muet se
corrige par l'observabilité et par le déplacement des tâches dans l'API, pas par un orchestrateur.**

- Trigger.dev auto-hébergé, c'est une application web, une base Postgres dédiée, Redis, une base
  d'événements (ClickHouse dans la version 4), un superviseur et des exécuteurs : cinq à six conteneurs à
  maintenir **pour deux tâches**, dont l'une est un `DELETE` nocturne. Le rapport valeur/charge est
  mauvais pour une personne seule, et chaque conteneur est une surface de panne de plus sur un serveur
  à Alger.
- Ce que l'on veut vraiment (voir l'exécution, être alerté, rejouer) s'obtient avec trois choses :
  une table `ops_runs` (début, fin, statut, compteurs, erreur) écrite par la tâche elle-même ; un
  déclencheur fiable et journalisé ; un signal de vie externe. Une fois la brique 1 en place, la tâche
  « rappels » devient un endpoint `POST /taches/rappels` de l'API (même code sur Workers et en
  conteneur), déclenché par un Cron Trigger Workers **ou** par `pg_cron` avec le secret dans Vault, et
  surveillé par un heartbeat Better Stack qui appelle si la tâche ne pointe pas. Les reprises sont
  triviales : la tâche est idempotente par construction (outbox + index unique).
- Trigger.dev redevient pertinent le jour où existent plus de cinq flux avec attentes longues,
  étapes humaines ou enchaînements (relances multi-canaux, facturation Chargily avec retours
  différés, génération de PDF en lot). Ce jour-là, la brique 1 ayant isolé les tâches derrière des
  endpoints, la migration est un déplacement de déclencheurs, pas une réécriture.

**Coût estimé.** Heartbeat + Vault (PR #58) : 0,5 jour. Tâches dans l'API + `ops_runs` + heartbeat
externe : 2 jours. Trigger.dev auto-hébergé, si jamais : 3 à 4 jours de mise en place, puis
exploitation permanente.

---

## 4. Astro pour le front public

**Aujourd'hui.** Le front public, c'est `index.html` (recherche, carte, 126 Ko de `home-app.js`),
`about`, `cas-grave`, `telecharger`, `waiting-list`, `doctor-profile` (fiche publique), 6 pages légales,
un blog de 6 articles, `404`, `offline`, et 576 pages SEO générées par `scripts/generate-seo-pages.mjs`
(HTML autonome, français seulement, sans JS). L'i18n est exécutée dans le navigateur : un dictionnaire
de 74 à 137 Ko par langue, appliqué au chargement, sur toutes les pages. Lighthouse mesuré le 10/09 :
accueil complet 65, LCP 8,1 s simulé ; en Slow 3G, titre visible à 6,7 s.

**Proposition.** Astro pour le front public, migration page par page, i18n à la compilation,
génération des 576 pages SEO.

**Verdict : oui, sans réserve sur le critère, avec une règle de coexistence.**

- Astro produit des fichiers statiques : Cloudflare Pages aujourd'hui, Nginx à Alger demain, aucun
  code serveur. C'est la brique la plus portable de toutes.
- L'i18n à la compilation règle le problème mesuré : trois arbres `/fr/`, `/ar/`, `/en/` (avec
  `hreflang`, `dir="rtl"` posé dans le HTML), plus aucun dictionnaire de 137 Ko à charger, plus de
  texte qui change après le rendu. Le dictionnaire actuel `js/i18n/*.js` (1 503 clés, parité vérifiée
  en CI) se réutilise tel quel comme source des traductions.
- Les pages SEO deviennent des routes générées à partir de l'endpoint d'agrégats de l'API (brique 1)
  ou de la RPC `seo_couples()` : 576 pages × 3 langues, construites en CI, sans qu'aucun nom de
  praticien ne transite (la règle d'anonymisation du script actuel se transpose telle quelle). Le
  filtre de sortie `functions/seo/[[path]].js` peut alors disparaître.
- La recherche interactive de l'accueil devient un îlot (Preact ou vanilla) qui appelle l'API ; la
  carte Leaflet reste un îlot chargé à la demande.
- **Règle de coexistence** : un seul artefact déployé (sortie Astro fusionnée avec le reste du site,
  mêmes `_headers`), migration par route ; les pages non migrées restent servies telles quelles. Le
  service worker est réenregistré depuis le layout Astro, donc sur toutes les pages publiques, ce qui
  corrige la limite actuelle (1 page sur 54).
- Ce qui ne va pas dans Astro : les pages authentifiées (patient, médecin, admin). Elles relèvent de
  la brique 5.

**Coût estimé.**

| Étape | Jours |
|---|---|
| Socle : projet Astro, tokens du design system v2, layout, i18n compilée, en-têtes, service worker, intégration au build unique | 3 |
| Pages publiques simples (about, cas-grave, telecharger, légal ×6, blog ×7, 404, offline) | 4 |
| Accueil : îlot recherche sur l'API, carte à la demande, compteurs | 4 |
| Fiche praticien publique et liste d'attente | 2 |
| Générateur SEO porté (routes dynamiques, 3 langues, sitemaps) | 2 |
| **Total** | **15** |

---

## 5. Un seul front pro : React + Vite + TanStack

**Aujourd'hui.** Dix-sept pages pro et admin en HTML/JS sans framework (tableau de bord médecin, agenda,
profil, ordonnances, liste d'attente, statistiques, revendication, secrétariat, agenda cabinet, cinq
pages admin, pharmacie Dawini, téléconsultation), communiquant par globales, 1 786 attributs `style=`
sur l'ensemble du site, trois pages sans garde de rôle. Le desktop Tauri embarque ces 17 pages ; le
mobile Capacitor n'embarque que les pages patient/public. La v2 React (`v2/`) a un agenda, une page de
connexion, 21 tests de règles métier et des types générés depuis la base.

**Proposition.** Un seul front pro en React + Vite + TanStack Router + TanStack Query, servant le web,
le desktop (Tauri) et le mobile (Capacitor). Comparer à SvelteKit sur le poids réel des bundles.

**Verdict : oui pour React + TanStack, et le poids n'est pas l'argument qui départage.**

*Chiffres mesurés le 10/09 (`gzip -9`, build local) :*

| | Octets compressés |
|---|---|
| Page pro actuelle `doctor-dashboard.html` : HTML + 22 scripts + 5 CSS | **198 025** (HTML 25 771 · JS 117 131 · CSS 55 123), **hors** dictionnaire i18n (fr 24 779, ar 40 403) |
| `v2/` React 19 + react-router 7 + TanStack Query 5 + supabase-js, build Vite | **140 883** (JS) + 379 (CSS) |

*Valeurs publiques, non mesurées ici :* plancher d'exécution React 19 + react-dom ≈ 45 Ko gz ;
TanStack Router ≈ 15 Ko ; TanStack Query ≈ 12 Ko ; supabase-js ≈ 50 Ko (commun aux deux options) ;
Svelte 5 + SvelteKit : plancher client ≈ 20 à 25 Ko gz. Sur une application pro complète, l'écart
attendu entre les deux est de l'ordre de 50 Ko compressés par premier chargement, ensuite mis en cache.

*Pourquoi cet écart ne décide pas :* le front pro est utilisé connecté, sur le poste du cabinet ou le
téléphone du médecin, plusieurs fois par jour ; 50 Ko une fois par version ne changent rien à
l'expérience, alors que l'accueil public, lui, est traité par Astro. Ce qui décide : la v2 existe déjà
en React avec des tests et des types générés depuis la base réelle ; l'écosystème Capacitor et Tauri
est indifférent au framework ; TanStack Query est le meilleur modèle de cache pour une API Supabase
(invalidations, requêtes dépendantes, hors-ligne « stale-while-revalidate ») ; et l'assistant qui
écrit la majeure partie du code est plus fiable sur React + TanStack que sur Svelte 5 en runes,
plus récent. SvelteKit serait un très bon choix pour une équipe qui repart de zéro ; ici ce serait
jeter la seule brique moderne déjà posée.

*Comment servir trois cibles avec un code :* un seul projet Vite, sortie statique (`index.html` +
assets), routeur TanStack en mode hash ou avec base configurable, `@capacitor/*` et `@tauri-apps/api`
chargés dynamiquement derrière une détection de plateforme (le module `js/tabibi-platform.js`
existe déjà). Le bundle mobile et le bundle desktop sont **le même artefact** ; seules les listes
blanches de pages de `scripts/build-mobile.sh` et `desktop/build-dist.sh` disparaissent au profit de
routes protégées par rôle. Le desktop garde `tauri-plugin-localhost` tant que Turnstile l'exige.

*Ce qui doit changer dans la base avant :* rien d'obligatoire ; la RLS est l'autorité. Mais les
lacunes relevées (rôle `secretaire` sans redirection, `admin_validate_doctor` appelée avec un argument
inconnu, RPC d'ordonnances absentes) doivent être tranchées page par page pendant la migration, sinon
on recopie des appels dans le vide.

**Coût estimé.**

| Étape | Jours |
|---|---|
| Socle : routeur, session partagée, garde par rôle, layout pro, tokens v2, i18n (mêmes clés), TanStack Query, erreurs Sentry | 5 |
| Agenda et tableau de bord médecin (reprend `v2/`), profil, indisponibilités | 6 |
| Secrétariat et agenda cabinet, revendication, liste d'attente médecin | 5 |
| Admin ×5 (validation, cabinet, avis, clés API, tableau de bord) | 5 |
| Pharmacie Dawini, statistiques, téléconsultation (si conservées) | 3 |
| Packaging Capacitor + Tauri sur le même artefact, listes blanches retirées | 3 |
| Tests Playwright des parcours pro, retrait des 17 pages HTML | 3 |
| **Total** | **30** |

---

## 6. PostHog, Sentry, Better Stack

**Aujourd'hui.** Aucune analyse d'usage (Plausible câblé mais inactif, Meta Pixel après consentement).
Les drapeaux vivent dans `js/tabibi-features.js`, objet gelé au chargement, modifiable seulement par
déploiement ; deux drapeaux ont des motifs faux et un n'est lu nulle part. Sentry est actif dans le
navigateur (SDK 8.45.0 avec SRI), absent des edge functions. Aucune surveillance d'uptime, aucun
heartbeat.

**Proposition.** PostHog pour les entonnoirs, le replay et les drapeaux pilotables sans déploiement ;
Sentry et Better Stack pour l'erreur et l'uptime.

**Verdict : oui pour les drapeaux, les événements et les entonnoirs ; replay seulement sous conditions
strictes ; Sentry étendu à l'API ; Better Stack oui.**

- *PostHog passe le critère* : PostHog Cloud a une région EU (Francfort) et la version auto-hébergée
  (« hobby », Docker Compose) tourne sur un serveur à Alger pour nos volumes (une application à
  quelques milliers d'événements par jour). Elle demande environ 4 Go de mémoire et une dizaine de
  conteneurs : à ne déployer que si la résidence l'exige.
- *Drapeaux* : remplacer `tabibi-features.js` par des drapeaux PostHog évalués **côté API** (brique 1)
  et injectés dans la page (« bootstrap ») pour éviter le scintillement et la dépendance au réseau au
  chargement ; conserver une valeur par défaut dans le code pour chaque drapeau, afin qu'une panne de
  PostHog ne change pas le comportement du site. Les drapeaux par rôle, par cabinet ou par pourcentage
  deviennent possibles sans déploiement ; les motifs périmés disparaissent avec le fichier.
- *Événements et entonnoirs* : un plan d'événements court (recherche lancée, fiche ouverte, créneau
  choisi, OTP demandé, OTP réussi, rendez-vous confirmé, revendication commencée/terminée) suffit à
  mesurer ce que le congrès doit produire. Sans cookie tiers, sous le consentement déjà géré par
  `tabibi-cookies.js`.
- *Replay* : sur une application de santé, le replay capture des noms de patients, des motifs de
  consultation, des numéros. À n'activer que sur les pages pro, avec masquage de toutes les entrées et
  de tout texte par défaut, sous consentement explicite du médecin, et de préférence auto-hébergé.
  Jamais sur le parcours patient.
- *Sentry* : garder le front, ajouter le SDK à l'API (brique 1) et aux edge functions restantes ;
  activer l'expurgation des données personnelles ; Sentry s'auto-héberge mais c'est lourd (une
  vingtaine de conteneurs) : rester sur le SaaS EU tant que la loi ne l'interdit pas, en n'y envoyant
  aucune donnée personnelle.
- *Better Stack* : uptime des hôtes, heartbeats des tâches (`rappels`, `nettoyage`), page de statut,
  alerte téléphone. Il ne reçoit aucune donnée personnelle, donc le critère ne s'applique pas. Si un
  jour tout doit être interne, Uptime Kuma fait l'essentiel.

**Coût estimé.** PostHog (SDK, consentement, plan d'événements, drapeaux avec bootstrap par l'API,
retrait de `tabibi-features.js`) : 3 jours. Sentry API et edge : 1 jour. Better Stack (moniteurs,
heartbeats, alertes) : 0,5 jour.

---

## 7. Ordre de migration recommandé

Le fil directeur : **d'abord la couche qui rend tout le reste portable et mesurable (l'API), puis la
visibilité, puis les deux fronts, jamais le local-first avant d'avoir des utilisateurs.**

| Rang | Brique | Dépend de | Doit être vrai avant de commencer |
|---|---|---|---|
| 0 | Assainissement, hors programme mais préalable | — | Les défauts déjà constatés fermés : gardes de pages (R1), lecture anonyme des indisponibilités (R2), appels dans le vide retirés ou gardés (R3), chaîne de construction unique (R5), cron des rappels réparé (PR #58), production redéployée depuis `main`. Une réponse d'avocat sur 25-11 : elle ne change pas l'architecture, elle fixe la date à laquelle la cible conteneur devient la cible principale. |
| 1 | **API Hono** (spike puis endpoints publics) | 0 | Un rôle Postgres dédié à l'API ; la décision sur ce qui reste en accès direct (tout l'authentifié) ; le test de parité Workers/conteneur dans la CI ; le journal d'accès dessiné (colonnes, rétention, IP hachée avec le poivre déjà utilisé par `record_consent`). |
| 2 | **Observabilité** : `ops_runs`, tâches dans l'API, Better Stack, Sentry sur l'API | 1 | Les rappels rejoués en `dry_run` depuis l'API et comparés au comportement de l'edge function actuelle ; kill-switch conservé. |
| 3 | **PostHog** : drapeaux avec bootstrap, événements, entonnoirs | 1 | Le plan d'événements écrit et validé au regard de 25-11 ; le consentement existant relu ; chaque drapeau doté d'une valeur par défaut en code. Se fait avant les fronts pour mesurer avant/après. |
| 4 | **Astro** public, page par page | 1, 3 | L'endpoint de recherche et l'endpoint d'agrégats SEO stables ; les tokens v2 comme unique source de style ; la décision sur la carte (garder Leaflet en îlot) ; les 576 pages recompilées et comparées à l'existant (mêmes URL, mêmes titres) avant bascule. |
| 5 | **React + TanStack** pro, un artefact pour web, desktop, mobile | 1, 3 | Les fonctionnalités mortes tranchées (ordonnances, téléconsultation, avis) pour ne pas les recopier ; le rôle `secretaire` défini de bout en bout ; la v2 promue de laboratoire à socle ; les listes blanches mobile et desktop remplacées par des routes gardées. |
| 6 | **Local-first** (ElectricSQL ou PowerSync), agenda médecin seulement | 5 | Des rendez-vous réels en base ; une décision sur le chiffrement local et le périmètre de données synchronisées ; un service de sync auto-hébergé provisionné là où la base vit. |
| — | Trigger.dev | 2 | Plus de cinq flux de fond ou des étapes humaines ; pas avant. |

**Ce que ce programme change au dépôt en fin de course** : un monorepo avec `api/` (Hono), `public/`
(Astro), `pro/` (React), `supabase/` (schéma, migrations horodatées, fonctions), plus aucune page HTML
à la racine, un seul artefact de déploiement par cible, et la possibilité de faire tourner
`api/`, `supabase/` et les deux fronts sur un serveur unique à Alger avec Cloudflare devant.

**Ce que je recommande de ne pas faire** : commencer par le front pro (30 jours sans effet sur la
sécurité ni sur la portabilité), adopter Trigger.dev ou le local-first maintenant, ou déployer PostHog
en replay sur le parcours patient.

---

## 8. Ce qui n'a pas été mesuré

- Les tailles de bundle SvelteKit et le plancher React 19 : valeurs publiques, non compilées ici.
- La maturité exacte de PowerSync, ElectricSQL et Zero à la date de décision : à revérifier le jour où
  la brique 6 est ouverte, elle est lointaine.
- Les besoins réels en mémoire et disque de Supabase, PostHog et d'un service de sync auto-hébergés
  ensemble sur un serveur algérien, et l'offre d'hébergement disponible à Alger (fournisseurs, bande
  passante, sauvegardes hors site) : à instruire avec l'avocat et un devis.
- Le comportement du Rate Limiting binding de Workers sous charge : à mesurer pendant le spike.
