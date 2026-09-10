# Tabibi.doctor — description technique de l'application

> Ce document décrit l'application **telle qu'elle est** au 10 septembre 2026, sur la branche
> d'intégration `fix/p0-securite-chaine-approvisionnement` (commit `2f7af2c`), qui contient `main`
> plus 28 commits non encore fusionnés. Chaque affirmation vient d'un fichier lu, d'une requête
> `SELECT` exécutée sur la base de production, ou d'une réponse HTTP mesurée. Ce qui n'a pas pu être
> établi est écrit **non vérifié**, jamais présenté comme un fait. Ce n'est pas une feuille de
> route : aucune priorité, aucune échéance.

## Table des matières

1. [Le produit](#1-le-produit)
2. [Architecture d'ensemble](#2-architecture-densemble)
3. [Arborescence du dépôt](#3-arborescence-du-dépôt)
4. [Le front](#4-le-front)
5. [Le backend](#5-le-backend)
6. [Sécurité](#6-sécurité)
7. [Fluidité et performance](#7-fluidité-et-performance)
8. [Données et conformité](#8-données-et-conformité)
9. [Les clients](#9-les-clients)
10. [Déploiement](#10-déploiement)
11. [Intégrations tierces](#11-intégrations-tierces)
12. [Conventions et règles de travail](#12-conventions-et-règles-de-travail)
13. [Dette technique](#13-dette-technique)
14. [Ce qui n'a pas pu être vérifié](#14-ce-qui-na-pas-pu-être-vérifié)

Conventions de lecture : `fichier:ligne` renvoie au dépôt ; « SELECT » signifie une requête exécutée
le 09 ou le 10 septembre 2026 sur le projet Supabase `pudugodhiofqrctcdwfl` via l'API de gestion ;
« HTTP » signifie une réponse mesurée avec `curl` ou Playwright.

---

## 1. Le produit

### 1.1 Ce que c'est

Tabibi.doctor est un annuaire de praticiens algériens couplé à une prise de rendez-vous en ligne.
Le site est statique (HTML, CSS, JavaScript sans framework) et parle directement à un projet
Supabase hébergé à Francfort. Il n'y a pas de serveur applicatif.

| Élément | Constat | Preuve |
|---|---|---|
| Marché | Algérie, 58 wilayas, 44 spécialités actives | SELECT `wilayas` = 58, `specialties` = 44 |
| Fonds de praticiens | **75 034 fiches** dans `doctor_profiles`, toutes importées (`source` = `import_2026_05_23` : 60 593 ; `imported_csv` : 14 441) | SELECT |
| Fiches revendiquées par un médecin | **0** (`is_claimed`), 0 approuvées, 75 034 en `pending`, 0 liées à un compte (`user_id`) | SELECT |
| Comptes | 41 comptes `auth.users` = 41 lignes `users` : 28 `medecin`, 11 `patient` (dont 1 `is_test`), 2 `admin`. 22 e-mails confirmés, 2 téléphones confirmés. **0 connexion dans les 30 derniers jours** | SELECT |
| Rendez-vous | **0** ligne dans `appointments`, depuis la création du projet (7 mai 2026) | SELECT |
| Langues | français, arabe (RTL), anglais — 1 503 clés par langue | `js/i18n/{fr,ar,en}.js`, `scripts/i18n-verifier.mjs` |
| Ce que sert `tabibi.doctor` aujourd'hui | **Toute l'application** : les 45 pages répondent 200 sous leur URL sans `.html` (connexion, inscription, espace patient, espace médecin complet avec agenda, agenda cabinet, profil, ordonnances, téléconsultation, espace secrétariat, cinq pages admin, Dawini, fiche praticien, pages légales). **Seule la racine `/` est remplacée par la page « Bientôt disponible »** (4 919 o) : l'accueil public avec la recherche n'est en ligne que sur Netlify et Vercel. Le déploiement en ligne est antérieur au 08/09 (`js/home-app.js` → 404) | HTTP du 10/09, relevé des 45 URL (§7.4) |

Ce qui la différencie, d'après le code et non d'après un argumentaire : la base de 75 034 fiches
importées couvre l'ensemble du territoire avant toute inscription ; la connexion se fait par
téléphone et code SMS (expéditeur `Tabibi`, opérateurs algériens via BudgetSMS) ; la fiche
publique ne montre ni téléphone, ni e-mail, ni adresse tant que le médecin n'a pas revendiqué sa
fiche (colonnes `address`, `latitude`, `longitude` mises à `NULL` par la vue `public_doctors` si
`is_claimed` est faux) ; un module de recherche de médicaments en pharmacie (« Dawini ») et un
espace secrétariat multi-cabinets existent dans le schéma.

### 1.2 État réel de chaque fonctionnalité

Les drapeaux viennent de `js/tabibi-features.js` (objet gelé `window.TABIBI_FEATURES`). « Données »
est le contenu réel de la base au 10 septembre 2026. « État » ne reprend aucune déclaration de la
documentation antérieure.

| Fonctionnalité | Drapeau | Objets en base | Données | État constaté | Preuve |
|---|---|---|---|---|---|
| Recherche et fiche praticien | — | vue `public_doctors` (lisible par `anon`), `public_doctors_listed` | 75 034 fiches | **En service.** Sur `tabibi.doctor`, la page de recherche (racine `/`) est remplacée par « Bientôt disponible » ; la fiche `/doctor-profile` et toutes les autres pages répondent ; la recherche complète est visible sur Netlify et Vercel. C'est la seule donnée métier qu'un visiteur non connecté peut lire | HTTP `GET /rest/v1/public_doctors?limit=1` → 206, `content-range 0-0/75034` |
| Connexion par SMS (OTP) | — | hook Auth `send-sms` (v15, `verify_jwt=false`), table `sms_log` | `sms_log` = 0 ligne (la journalisation date du 09/09) ; 28 SMS envoyés depuis juin d'après le tableau de bord BudgetSMS, tous livrés | **En service.** Captcha Turnstile obligatoire côté GoTrue | API `config/auth` : `hook_send_sms_enabled=true`, `security_captcha_provider=turnstile` ; BudgetSMS « Last 100 Sent SMS » |
| Connexion e-mail + mot de passe | — | GoTrue, SMTP `smtp-relay.brevo.com` | 22 e-mails confirmés | **En service** | API `config/auth` |
| Prise de rendez-vous | — | `appointments` (6 policies, 10 triggers), RPC `get_available_slots`, `doctor_unavailable_slots` | **0 rendez-vous**, 3 indisponibilités | **En service techniquement, jamais utilisée.** Aucun praticien n'ayant revendiqué sa fiche, aucun n'est réservable (`is_doctor_bookable`) | SELECT ; `js/tabibi-booking.js:255,347` |
| Rappels SMS J-1 / H-2 / confirmation | — | edge `appointment-reminders` (v5), job pg_cron n° 2 toutes les 15 min, outbox `appointment_notifications` | outbox = 0 ; **chaque tir du cron reçoit HTTP 401** (24/24 sur 6 h d'historique `net._http_response`) | **Hors service.** Le secret inscrit dans `cron.job` (6 caractères) n'a pas l'empreinte SHA-256 du secret edge `REMINDERS_CRON_SECRET`. Correctif proposé, non appliqué (PR #58) | SELECT `cron.job_run_details`, `net._http_response` ; `supabase/migrations/20260909_rappels_cron_vault_heartbeat.sql` |
| Revendication de fiche (claim) | — | RPC `claim_my_doctor_profile` (2 surcharges), `check_doctor_account_exists`, `doctor_set_ordre_number`, `claim_requests` | 0 revendication, 0 demande | **En service, jamais aboutie** | SELECT ; `js/tabibi-claim.js:96,129` |
| Validation des médecins (admin) | — | RPC `admin_validation_list/total/counts`, `admin_validate_doctor`, `admin_doctor_doc_paths`, bucket privé `doctor-docs` | 4 documents dans `doctor-docs` (1,7 Mo), 1 `admin_actions`, 0 approuvé | **En service.** `admin-dashboard.html:399` passe un argument `p_reason` que la fonction n'a pas (signature `p_doctor_id, p_action, p_notes`) : cet appel échoue | SELECT `pg_proc` ; `admin-dashboard.html:399` |
| Notifications in-app | `notifications: true` | table `notifications` (2 policies) | 12 lignes | **En service** | SELECT ; `notifications.html:150` |
| Messagerie patient–médecin | `messaging: false` | `conversations`, `messages`, RPC `ensure_conversation` | 0 | **Masquée** (entrée de menu non rendue, pages court-circuitées) | `js/tabibi-pro-sidebar.js:37`, `messages.html:94` |
| Avis et notes | `reviews: false` | `reviews` (7 policies), `review_reports`, vues `doctor_reviews_public`, `doctor_ratings_summary`, `my_reviewable_appointments`, RPC `can_review_doctor` | 0 | **Présente en base, drapeau inerte** : aucun code ne lit `TABIBI_FEATURES.reviews` ; `js/tabibi-reviews.js` interroge les tables sans garde. Le commentaire du drapeau (« tables non créées ») est faux | SELECT ; `js/tabibi-features.js:69-71` |
| Ordonnances | `prescriptions: false` | table `prescriptions` (6 policies), `prescription_seq_year`, RPC `next_prescription_number` | 0 | **Absente.** Les 4 RPC appelées (`create_prescription_draft`, `update_prescription_draft`, `request_prescription_signature`, `mark_prescription_delivered`), l'edge `generate-prescription-pdf`, l'edge `verify-prescription`, la vue `my_prescriptions` et le bucket `prescriptions` **n'existent pas** | SELECT `pg_proc`, `to_regclass`, `storage.buckets` ; liste des edge functions déployées |
| Téléconsultation | `video: false` | `video_sessions`, RPC `create_video_session`, `get_video_session`, `set_video_recording_consent`, `mark_video_session_started/ended` | 0 | **Masquée.** Les RPC existent, contrairement au motif du drapeau ; l'edge `create-video-room` appelée par `teleconsultation.html:419` **n'existe pas** ; SDK Daily.co chargé depuis `unpkg.com` sans SRI | SELECT ; `teleconsultation.html:301-306,419` |
| Paiement en ligne | `payments: false` | `payments` (2 policies) | 0 | **Masqué**, espèces seulement (`payment.html:163`) | `js/tabibi-features.js:53` |
| Dawini (médicaments en pharmacie) | `dawini: true` | 13 RPC `dawini_*`, `dawini_requests/responses/zones`, `pharmacies`, `medication_alerts`, bucket privé `dawini-ordonnances` | 194 pharmacies, **1 zone active sur 58**, 0 demande, 0 réponse | **En service sur une wilaya, jamais utilisé** | SELECT |
| Liste d'attente (landing) | — | `waiting_list` (insert `anon`), vue `waiting_list_stats` | 0 inscription | **En panne** : le compteur lit une vue `waiting_list_count` qui n'existe pas (`waiting-list.html:816`) et `KNOWN_ISSUES.md` documente que le secret Turnstile de `verify-turnstile` est périmé, ce qui bloque la soumission (fail-closed) | SELECT `to_regclass` ; `KNOWN_ISSUES.md` |
| Cas grave | — | aucun objet | — | **En service** : ouvre WhatsApp avec un message pré-rempli, sans backend | `cas-grave.html:95-118` |
| Cabinet et secrétariat | — | `cabinets`, `cabinet_members`, 11 fonctions cabinet (`create_cabinet`, `get_my_cabinets`, `invite/remove_cabinet_member`, `accept_cabinet_invitation`, `transfer_cabinet_ownership`, 5 prédicats `is_*`), 3 vues `cabinet_*_view` | 0 cabinet | **En service techniquement, jamais utilisé.** `signup.html:498` appelle `validate_cabinet_invitation`, qui **n'existe pas** | SELECT |
| API partenaires | — | `api_keys`, `api_usage_log` (+ 16 partitions journalières vides), 7 RPC `*_api_key*`, vue `api_keys_analytics` | 0 clé | **Dormante.** Page `admin-api-keys.html` sans `requireAuth` (repose sur les RPC) | SELECT ; `admin-api-keys.html:334` |
| Double authentification médecin | — | colonnes `users.totp_*`, table `two_factor_secrets`, RPC `enroll_two_factor`, `disable_two_factor`, MFA TOTP GoTrue activée | 0 secret, 0 `totp_enabled` | **Présente dans l'interface, jamais activée par personne.** L'implémentation est un TOTP maison (`js/tabibi-2fa.js`), la MFA GoTrue n'est pas appelée | SELECT ; `medecin-profile.html:825` |
| Consentement et journal RGPD | — | `consents_log` (append-only par triggers), RPC `record_consent` | **0 ligne** | **Absent en pratique** : 4 cases à cocher à l'inscription, aucun appel à `record_consent` dans le front | SELECT ; `grep -rn record_consent js *.html` → 0 |
| Journal d'audit | — | `audit_log`, 2 triggers (`users`, `appointments`) | 148 lignes, colonne `ip_address` jamais remplie | **Partiel** | SELECT |
| Statistiques médecin | `doctorStats: false` | — | — | **Masquée du menu, atteignable par URL** ; chiffres codés en dur | `js/tabibi-pro-sidebar.js:35` |
| Analytics (Plausible) | `analytics: false` | — | — | **Inactif** | `js/tabibi-analytics.js:55` |
| Meta Pixel | — | — | — | Câblé (`1054246673971695`), chargé seulement après consentement marketing | `js/tabibi-pixel.js:59,77` |
| Suivi d'erreurs (Sentry) | `sentry: true` (inerte) | — | — | **Actif** sur les 28 pages qui chargent `js/tabibi-sentry.js` (DSN réel dans `js/config.js:32`) ; aucun SDK côté edge | `js/tabibi-features.js:105-113` |
| PWA hors ligne | — | `sw.js` v38 | — | **Partielle** : le service worker n'est enregistré que depuis `index.html` (voir §4.6) | `src/entries/index.js:50` |
| WhatsApp (canal serveur) | — | edge `send-whatsapp`, `whatsapp-webhook` dans le dépôt | — | **Non déployées, non branchées** ; aucun compte WhatsApp Business dans le portefeuille Meta au 09/09 | liste des fonctions déployées ; Meta Business Suite (lecture) |

---

## 2. Architecture d'ensemble

### 2.1 Schéma

```
                 ┌──────────────────────── CLIENTS ─────────────────────────┐
                 │ Navigateur (site)   Android dz.tabibi.app 1.0.2 (vc 4)   │
                 │ Tauri « Tabibi Pro » 0.1.0 (macOS, local)   v2 React      │
                 │   Capacitor 8 : WebView + même HTML/JS, 27 pages          │
                 └───────────────┬───────────────────────────┬──────────────┘
                                 │ HTTPS                     │ HTTPS (clé anon publique
                                 │                           │  + JWT de session)
   ┌─────────────────────────────▼───────────────┐   ┌───────▼──────────────────────────────┐
   │ HÉBERGEMENT DU STATIQUE (aucun code serveur)│   │ SUPABASE  pudugodhiofqrctcdwfl        │
   │                                             │   │ eu-central-1 (Francfort), Pro, Micro  │
   │ 1. Cloudflare Pages  tabibi.doctor  (prod)  │   │ PostgreSQL 17.6 · 102 Mo               │
   │    DNS → 188.114.96/97.2, déploiement       │   │  55 tables · 14 vues · 94 policies RLS │
   │    manuel `wrangler pages deploy`           │   │  97 fonctions SQL (34 DEFINER anon)    │
   │    + 4 Pages Functions = barrières 404      │   │ GoTrue : e-mail+mdp, SMS OTP, Turnstile│
   │ 2. Netlify  effulgent-kelpie…  (previews PR)│   │ PostgREST : /rest/v1 (RLS)             │
   │ 3. Vercel   tabibi-doctor.vercel.app        │   │ Storage : 5 buckets (3 publics)        │
   │    (GitHub App, copie de prod, sans CSP)    │   │ Edge (Deno) : 4 fonctions déployées    │
   └─────────────────────────────────────────────┘   │ pg_cron : 2 jobs · pg_net · Vault       │
                                                     └───┬───────────┬──────────┬────────────┘
                                                         │           │          │
                                            hook signé   │   GET     │ SMTP     │ (jamais : 401)
                                            standardweb. │           │          │
                                       ┌─────────────────▼──┐  ┌─────▼──────┐  ┌▼──────────────────┐
                                       │ BudgetSMS          │  │ Brevo SMTP │  │ appointment-      │
                                       │ OTP → DLR → sms-dlr│  │ e-mails    │  │ reminders (cron)  │
                                       └────────────────────┘  │ GoTrue     │  └───────────────────┘
                                                               └────────────┘
   Tiers chargés par le navigateur : Cloudflare Turnstile (captcha), Sentry (erreurs, SRI),
   tuiles OpenStreetMap (carte), Google Fonts (4 pages), Meta Pixel (après consentement),
   Daily.co (page masquée), Redoc (api-docs.html).
```

### 2.2 Surfaces de déploiement réelles

| Surface | Rôle réel | Comment on le sait |
|---|---|---|
| **Cloudflare Pages**, projet `tabibi-doctor`, domaine `tabibi.doctor` | Production. Aucune connexion Git : chaque mise en production est un `wrangler pages deploy` manuel depuis une archive `git archive main`. **Le déploiement en ligne le 10/09 sert la page « Bientôt disponible » à la racine, une CSP antérieure au `_headers` de la branche, et ne contient pas les fichiers créés le 08/09** ; URL sans `.html` (308) | `DEPLOY_FRONTEND.md:31-63`, `CLAUDE.md` § Déploiement ; DNS `dig tabibi.doctor` → 188.114.97.2 / 188.114.96.2, NS `*.ns.cloudflare.com` |
| **Netlify**, site `effulgent-kelpie-e48e81` | Deploy previews des PR (application GitHub Netlify installée sur le dépôt) | `netlify.toml`, liste des applications GitHub du dépôt (09/09) |
| **Vercel**, projets `tabibi-doctor` et `tabibi-dz` | Application GitHub Vercel installée sur le dépôt : `tabibi-doctor.vercel.app` servait le 09/09 **une copie complète de l'application de production** branchée sur la même base, sans en-têtes de sécurité, avec 105 fichiers de `supabase/`, `migrations/`, `desktop/` en HTTP 200. Non indexée par Google, Bing, Wayback, Common Crawl. Aucun `vercel.json` dans le dépôt | mesures HTTP du 09/09 (`VERIF_NAVIGATEUR.md`, B0/V4) ; commentaire du bot Vercel sur la PR #57 (10/09) |
| **GitHub Releases** | Distribution prévue des APK (`.gitignore:114`) ; l'APK 1.0.2 est en réalité servi depuis le bucket Supabase public `Downloads` | `telecharger.html`, `storage.buckets` |
| **Bucket Storage `Downloads`** (public) | 3 objets, 27 Mo : APK 1.0.2 build 4 (9 554 674 o) et deux objets plus anciens | SELECT `storage.objects` |

### 2.3 Qui parle à quoi, avec quelle authentification

| Flux | Authentification | Détail |
|---|---|---|
| Navigateur → PostgREST | En-tête `apikey` = clé `anon` (publique, dans `js/config.js:17`) ; `Authorization: Bearer <JWT de session>` après connexion | Toute l'autorisation repose sur la RLS et les fonctions `SECURITY DEFINER` (§6). Le client est `supabase-js 2.116.0` vendorisé (`assets/vendor/supabase/`) avec `detectSessionInUrl: false` |
| Navigateur → GoTrue | Clé `anon` + jeton Turnstile obligatoire (`security_captcha_enabled=true`) | OTP SMS 6 chiffres, 10 min, 30 SMS/h par projet, 30 OTP/5 min par IP, JWT 1 h, rotation des refresh tokens |
| Navigateur → Edge `verify-turnstile` | `functions.invoke` (clé anon ou JWT), `verify_jwt=true`, CORS limité à `tabibi.doctor`, `www.tabibi.doctor`, `localhost:8080` | Utilisée par la liste d'attente seulement |
| GoTrue → Edge `send-sms` | Webhook signé `standardwebhooks` (secret `SEND_SMS_HOOK_SECRETS`), `verify_jwt=false` | Unique chemin d'envoi d'OTP |
| BudgetSMS → Edge `sms-dlr` | **Aucune** (BudgetSMS n'offre ni secret ni signature), `verify_jwt=false` | Met à jour `sms_log` ; assumé dans le code (`sms-dlr/index.ts:26-31`) |
| pg_cron → Edge `appointment-reminders` | En-tête `x-reminders-secret` comparé à `REMINDERS_CRON_SECRET`, `verify_jwt=false` | **Échoue en 401** depuis au moins le 09/09 (historique pg_net de 6 h) ; le secret est écrit en clair dans `cron.job.command` |
| Edge → base | `SUPABASE_SERVICE_ROLE_KEY` (secret edge), contourne la RLS | `appointment-reminders`, `send-sms`, `sms-dlr` |
| Application Android → Supabase | Identique au navigateur (même HTML/JS embarqué) | `capacitor.config.ts`, `scripts/build-mobile.sh` |

### 2.4 Conséquences de l'absence de serveur applicatif

- **Toute règle métier qui doit être imposée l'est en base** : RLS, triggers (`validate_appointment_time`, `appointments_secretaire_limit`, `lock_doctor_protected_columns`…) et RPC `SECURITY DEFINER`. Le JavaScript du navigateur est modifiable par l'utilisateur et ne protège rien.
- **Les secrets ne peuvent vivre que dans les edge functions et Vault** : le front ne contient que des clés publiques par conception (clé `anon`, site key Turnstile, DSN Sentry, identifiant Meta Pixel).
- **Pas de limitation de débit applicative** : seules les limites de GoTrue s'appliquent (30 SMS/h au niveau du projet, ce qui plafonne à environ 720 SMS/jour, soit 64 € au tarif BudgetSMS, l'exposition maximale d'un abus). PostgREST n'a aucune limite par IP : la vue `public_doctors` se lit à 1 000 lignes par requête en 0,35 s (mesure du 09/09), d'où la PR #57.
- **Pas de rendu serveur** : le SEO repose sur 576 pages HTML statiques régénérées par script ; le contenu dynamique (annuaire) n'est pas indexable.
- **Pas de journal applicatif** côté front : les seules traces sont Sentry (navigateur), les journaux Cloudflare et ceux de Supabase (GoTrue, PostgREST, edge). Le tableau de bord d'exploitation n'existe pas.
- **Un secret compromis (clé `service_role`) donnerait tout** : il n'apparaît nulle part dans le dépôt (gitleaks en CI, allowlist limitée à la clé `anon`).

---

## 3. Arborescence du dépôt

Dépôt GitHub `Ariles2025-ops/tabibi-doctor`, **privé** (`gh repo view` → `isPrivate: true`), 387 commits sur
`main` du 21 mai au 3 septembre 2026, 1 130 fichiers versionnés, 43 branches distantes non fusionnées.

| Chemin | Contenu | Versionné | Généré | Retiré du build / de l'archive |
|---|---|---|---|---|
| `*.html` (racine) | 47 pages applicatives (§4.1) | oui | non | 10 passent par Vite, 37 sont copiées telles quelles |
| `js/` | 51 modules (591 Ko) + `js/i18n/` (3 dictionnaires, 318 Ko) | oui | non | copié tel quel dans `dist-web/` |
| `src/entries/` | 10 points d'entrée Vite (40 Ko) | oui | générés par `scripts/vite-convertir-page.mjs` sauf `index.js` | `export-ignore`, 404 Netlify |
| `styles/`, `css/` | 6 + 1 feuilles (99 Ko) ; `styles/tokens-v2.css` = 181 variables | oui | non | copié |
| `assets/` | Font Awesome, Leaflet, supabase-js vendorisés, centroïdes des wilayas, images OG | oui | non | copié |
| `seo/` | **576 pages** HTML autonomes (8,8 Mo), sans JS ni CSS externe | **oui** | oui, `scripts/generate-seo-pages.mjs` | copié ; filtrées à la sortie par `functions/seo/[[path]].js` |
| `sitemaps/`, `sitemap.xml`, `robots.txt` | 3 sitemaps (le local fait 102 Ko) | oui | oui | copié |
| `legal/` (6), `blog/` (1 + 6 articles) | pages légales et blog | oui | non | 4 pages légales sous Vite |
| `supabase/` | `config.toml`, 6 edge functions (`send-sms`, `sms-dlr`, `verify-turnstile`, `appointment-reminders`, `send-whatsapp`, `whatsapp-webhook`), 3 migrations horodatées + 2 fichiers `20260909_*` proposés | oui | non | `_redirects` 404, Netlify 404, `functions/supabase/[[path]].js` |
| `migrations/` | 41 scripts SQL manuels, non horodatés (`CRIT-4_step1_diagnostic.sql`, `PHASE16_5_hide_unclaimed.sql`…) | oui | non | idem |
| `functions/` | 4 Cloudflare Pages Functions (`supabase`, `migrations`, `desktop`, `seo`) | oui | non | **pas copié dans `dist-web/`** par `viteStaticCopy` |
| `android/` (80 fichiers), `ios/` (26) | projets natifs Capacitor ; `assets/public` et `App/public` non versionnés (copies de `www/`) | partiel | partiel | `export-ignore`, 404 Netlify |
| `desktop/` | Tauri v2 `Tabibi Pro` ; `src-tauri/target/` (1,4 Go) et `dist/` ignorés | 59 fichiers | partiel | `_redirects` 404, `functions/desktop/[[path]].js` |
| `v2/` | application React 19 séparée (23 fichiers versionnés, 156 Mo avec `node_modules`) | oui | non | `export-ignore`, 404 Netlify, hors build racine |
| `scripts/` | 10 outils (build mobile, dette ESLint, SEO, i18n, keystore, conversion Vite, déploiement) | oui | non | `export-ignore` |
| `tests/` | `e2e/parcours-critiques.spec.js` (Playwright) + 4 procédures manuelles | oui | non | `export-ignore` |
| `docs/` (58 fichiers), 21 `*.md` à la racine | documentation, audits de mai à septembre | oui | non | `export-ignore` ; les `README*.md` sont en 404 Netlify |
| `api/` | `openapi.yaml`, collection Postman, environnements — documentation servie par `api-docs.html` | oui | non | ni copié par Vite, ni exclu |
| `templates/` (10 e-mails), `fixtures/` (1 SQL), `resources/` (icônes Capacitor), `icons/` (7 webp non référencés) | divers | oui | non | `templates/`, `fixtures/` en `export-ignore` |
| `dist-web/` | sortie de `vite build` (628 HTML, 14 Mo) | non | oui | — |
| `dist/` (548 HTML, 11 Mo), `www/` (40 HTML), `desktop/dist/` (17 HTML) | sorties de builds antérieurs ou mobiles | non | oui | — |
| `index.html.bak`, `index.html.comingsoon` (240 Ko chacun) | copies de l'ancienne page « Coming Soon » | **oui** | non | `*.bak` en `export-ignore` ; `.comingsoon` n'a aucune règle |
| `index-baseline.html`, `index.html.avant-extraction`, `CHANTIER_MOBILE_2026-09-08.html`, `_to_delete/`, `AUDIT_ET_MIGRATION_2026-09-09.md`, `DOSSIER_TABIBI_2026-09-08.md`, `VERIF_NAVIGATEUR.md` | fichiers de travail locaux | **non** (non suivis) | — | exclus de Vite (`EXCLUES`) ou jamais commités |

Ce que la construction retire réellement : `vite build` produit `dist-web/` à partir des pages HTML
(sauf les trois `EXCLUES`) et copie `js/`, `styles/`, `css/`, `assets/`, `images/`, `brand/`,
`seo/`, `sitemaps/`, `legal/`, `blog/`, `manifest.json`, `sw.js`, `_headers`, `_redirects`,
`robots.txt`, `sitemap.xml`, `favicon.ico`. Le déploiement manuel en vigueur n'utilise **pas**
`dist-web/` : il part de `git archive main` (donc des `export-ignore`) et purge `./desktop` et
`./supabase` à la main (`DEPLOY_FRONTEND.md:31-63`). Les deux chemins ne produisent pas le même
site : le premier contient les pages Vite optimisées mais pas `functions/` ; le second contient
`functions/` mais aucune page Vite.

---

## 4. Le front

### 4.1 Pages par parcours

47 pages HTML à la racine, 6 dans `legal/`, 1 + 6 dans `blog/`, 576 dans `seo/`. « Vite » indique
un point d'entrée dans `src/entries/`. « Garde » est la protection d'accès trouvée dans la page.

| Parcours | Pages | Vite | Garde |
|---|---|---|---|
| Public | `index.html` (accueil, recherche, carte), `about.html`, `cas-grave.html`, `telecharger.html`, `waiting-list.html`, `api-docs.html`, `404.html`, `offline.html`, `blog/index.html` | 7 sur 9 (`telecharger`, `waiting-list` non) | aucune |
| Authentification | `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html`, `verify-email.html`, `email-verified.html`, `onboarding-medecin.html` | 0 | aucune |
| Patient | `patient-dashboard.html`, `patient-profile.html`, `mes-rdv.html`, `reservation.html`, `doctor-reservation.html`, `messages.html`, `conversation.html`, `notifications.html`, `payment.html`, `success.html`, `teleconsultation.html`, `patient-ordonnances.html`, `patient-waitinglist.html` | 0 | `requireAuth` sur dashboard, profil, messages ; `reservation.html` volontairement sans garde (`:618`) |
| Médecin | `doctor-dashboard.html`, `doctor-profile.html` (fiche publique), `doctor-analytics.html`, `doctor-claim.html`, `medecin-profile.html`, `medecin-ordonnance.html`, `medecin-waitinglist.html`, `verify-prescription.html` | 0 | `requireAuth('medecin')` sur dashboard et profil ; gardes manuelles ailleurs |
| Secrétariat | `secretaire-dashboard.html`, `agenda-cabinet.html` | 0 | `getSession` seulement, **pas de `requireAuth`** |
| Admin | `admin-dashboard.html`, `admin-doctor-validation.html`, `admin-reviews.html`, `admin-cabinet.html`, `admin-api-keys.html` | 0 | `requireAuth('admin')` sur 3 pages ; `admin-cabinet` et `admin-api-keys` sans |
| Dawini | `dawini.html`, `dawini-pharmacie.html` | 0 | garde d'interface `#dwp-guard` |
| Légal | `legal/{cgu,confidentialite,dpa,mentions-legales,cookies,rgpd-droits}.html` | 4 sur 6 | aucune |

Pages sans lien entrant trouvé (ni HTML ni JS) : `admin-doctor-validation.html`, `payment.html`,
`success.html`, `verify-prescription.html` (cette dernière est atteinte par QR code depuis un
gabarit d'e-mail). Le rôle `secretaire` n'a pas d'entrée dans `TABIBI_CONFIG.REDIRECTS`
(`js/config.js:40-50`) : après connexion, une secrétaire est redirigée comme un patient.

### 4.2 Modules JavaScript

51 fichiers dans `js/` pour 591 563 octets, plus 318 Ko de dictionnaires. Les modules communiquent
par globales (`window.tabibi`, `window.TABIBI_CONFIG`, `window.supabase`), ce qui impose l'ordre de
chargement. Principaux modules :

| Module | Octets | Rôle | Pages |
|---|---|---|---|
| `home-app.js` | 126 329 | toute la logique de l'accueil : recherche, filtres, carte Leaflet, compteurs, pagination | 1 (`index.html`) |
| `tabibi-brevo.js` | 36 723 | gabarits d'e-mail FR/AR/EN ; appelle une edge `send-email` **qui n'existe pas** | 6 |
| `tabibi-agenda.js` | 31 527 | agenda hebdomadaire cabinet | 2 |
| `tabibi-reviews.js` | 29 902 | avis (sans garde de drapeau) | 3 |
| `tabibi-booking.js` | 25 134 | réservation : créneaux (`get_available_slots`), insertion, annulation, hydratation des noms | 4 |
| `capacitor-bridge.js` | 23 735 | pont natif (push, deep links, préférences) | 5 |
| `tabibi-dawini.js` | 21 271 | Dawini côté patient et pharmacie | 2 |
| `tabibi-doctor-dashboard.js` | 16 767 | profil médecin, photo, indisponibilités | 2 |
| `tabibi-i18n.js` | 16 743 | moteur de traduction (`data-i18n` + dictionnaire AUTO) | 48 |
| `tabibi-beta.js` | 14 717 | mode bêta privée | 25 |
| `doctors-display.js` | 13 107 | `window.tabibiDoctors` : lecture filtrée de `public_doctors` | 4 |
| `tabibi-turnstile.js`, `tabibi-captcha-visible.js` | 16 303 | captcha, fail-closed | 5 + 3 |
| `auth.js` | 6 616 | `requireAuth`, résolution du rôle depuis `users.role`, cache `localStorage.tabibi_user` ; **repli `role: 'patient'` si la lecture échoue** (`:53`) | 26 |
| `tabibi-security.js` | 10 098 | échappement, assainissement | 25 |
| `tabibi-sentry.js` | 6 376 | chargement Sentry 8.45.0 avec SRI, `window.tabibiErreur` | 28 |
| `tabibi-prelang.js` | 2 686 | pose `lang`/`dir` avant le rendu, préchargement du dictionnaire | 49 |
| `tabibi-sw-register.js`, `tabibi-analytics.js` | 5 208 | service worker, Plausible | 1 chacun (`index`) |
| `tabibi-seo-anonymize.js` | 5 920 | **mort** : chargé par aucune page | 0 |
| `payments.js` | 1 377 | stub espèces | 1 |

Le client Supabase est instancié une fois dans `js/supabase-client.js` (38 pages).

### 4.3 Ce qui est sous Vite et ce qui ne l'est pas

`vite.config.mjs` (Vite 8, cible `es2020`, `sourcemap: true`, sortie `dist-web/`) traite en
multi-pages toutes les `*.html` de la racine, de `legal/` et de `blog/`. Mais seules **10 pages**
ont un point d'entrée ES module : `index`, `about`, `cas-grave`, `404`, `offline`, `blog/index`,
`legal/cgu`, `legal/confidentialite`, `legal/dpa`, `legal/mentions-legales`. Les 44 autres pages
passent dans `dist-web/` avec leurs balises `<script src>` classiques (jusqu'à 24 sur `login.html`),
et `js/` est copié tel quel. Taux de conversion : **10 / 54 = 18,5 %**. Trois fichiers restent
volontairement hors bundle même sur les pages converties : `tabibi-prelang.js` (doit s'exécuter dans
le `<head>`), `tabibi-i18n.js` et `tabibi-cookies.js` (placés après le hero), et le SDK Supabase
UMD (importé en ESM, il n'attache plus `window.supabase`) — `src/entries/index.js`.

### 4.4 CSS et design system

| Feuille | Octets | Pages qui la lient (sur 54) |
|---|---|---|
| `css/tabibi-ui.css` | 8 826 | 46 |
| `styles/app.css` (v1) | 31 637 | 41 |
| `styles/components.css` (v1) | 2 530 | 35 |
| `styles/tokens-v2.css` (**181 variables**, source de vérité déclarée) | 15 783 | 12 |
| `styles/components-v2.css` | 34 037 | 6 |
| `styles/auth-page.css`, `styles/auth.css` | 6 676 | 7 |

Taux de migration réel vers le design system v2 : **12 pages sur 54 lient les tokens (22 %), 6
lient le duo tokens + composants (11 %)**. Les 12 sont les pages cabinet, ordonnances,
téléconsultation, `verify-prescription` et les 5 pages légales. `tokens-v2.css` redéfinit les
anciennes variables (`--blue`, `--green`) vers les nouvelles teintes, ce qui évite la casse des
pages non migrées. Style inline : 47 blocs `<style>` et **1 786 attributs `style="`** sur les 47
pages racine (261 sur `patient-dashboard.html`, 200 sur `doctor-dashboard.html`). Les tokens
existent aussi en JSON (`brand/DESIGN_TOKENS_v2.json`) et en CSS pour v2 (`v2/src/styles/tokens.css`).

### 4.5 Internationalisation

| Langue | Fichier | Octets | Clés | Traductions automatiques (en-tête du fichier) |
|---|---|---|---|---|
| fr | `js/i18n/fr.js` | 74 390 | 1 503 | 0 |
| ar | `js/i18n/ar.js` | 136 825 | 1 503 | 796 |
| en | `js/i18n/en.js` | 106 627 | 1 503 | 796 |

Une seule langue est chargée par page : `tabibi-prelang.js` lit `localStorage.tabibi_lang` (sinon
`navigator.language`, sinon `fr`), pose `lang` et `dir="rtl"` pour l'arabe sur `<html>`, et
précharge le dictionnaire ; `tabibi-i18n.js` l'insère ensuite et applique les clés `data-i18n` puis
un dictionnaire de correspondance des textes français. `scripts/i18n-verifier.mjs` (CI) échoue si
une clé de `fr` manque dans `ar` ou `en` ou si les dictionnaires automatiques divergent. Six fichiers
vivants gardent des dictionnaires locaux hors de ce contrôle : `home-app.js`, `tabibi-beta.js`,
`tabibi-agenda.js`, `tabibi-cookies.js`, `tabibi-pro-sidebar.js`, `waiting-list.html`. Les pages
`seo/` ne sont qu'en français.

### 4.6 PWA et service worker

`manifest.json` : `name` « Tabibi — طبيبي », `start_url` `/index.html?pwa=1`, `display` `standalone`,
`lang` `fr-DZ`, 9 icônes dans `images/` (le dossier `icons/` de 7 webp n'est référencé nulle part),
2 raccourcis. `sw.js` : `CACHE_VERSION = 'tabibi-v38-2026-09-09'` ; navigation en *network-first*
avec repli `/offline.html` ; *cache-first* revalidé pour les assets ; `supabase.co` et `/api/*`
jamais interceptés ; précache de 20 URL (`login`, `signup`, `reservation`, `mes-rdv`, `payment`,
`notifications`, deux CSS v1, six modules) mais **ni les dictionnaires `js/i18n/*`, ni
`tokens-v2.css`, ni `tabibi-ui.css`, ni Font Awesome** (dont `offline.html` dépend).

**Enregistrement : une seule page.** `navigator.serviceWorker.register('/sw.js')` n'existe que
dans `js/tabibi-sw-register.js`, importé uniquement par `src/entries/index.js:50`. Les 53 autres
pages, les 576 pages SEO et le blog n'enregistrent rien : un visiteur qui arrive par une page SEO
ou par `login.html` n'a pas de PWA, et les pages précachées ne le sont que s'il est passé par
l'accueil.

---

## 5. Le backend

Projet Supabase `pudugodhiofqrctcdwfl`, région `eu-central-1`, plan Pro, instance Micro,
PostgreSQL 17.6, base de 102 Mo, créé le 7 mai 2026. Extensions : `pg_cron 1.6.4`, `pg_net 0.20.0`,
`pgcrypto`, `pg_trgm`, `unaccent`, `btree_gist`, `uuid-ossp`, `pg_stat_statements`,
`supabase_vault 0.3.1`. Aucune table n'est publiée en Realtime. Sauvegardes : physiques,
quotidiennes vers 03h35 UTC, 8 disponibles, **sans PITR** ; le Storage n'en fait pas partie ; aucune
restauration n'a été testée.

### 5.1 Tables réellement présentes (55, toutes avec RLS activée)

| Domaine | Tables | Lignes | Policies |
|---|---|---|---|
| Comptes | `users` (41), `device_tokens` (1), `two_factor_secrets` (0), `favorites` (0) | | 5 · 4 · 1 · 3 |
| Praticiens | `doctor_profiles` (**75 034**), `doctor_schedule` (0, dormante), `doctor_unavailable_slots` (3), `claim_requests` (0), `specialties` (44), `wilayas` (58) | | 2 · 5 · 4 · 1 · 2 · 2 |
| Rendez-vous | `appointments` (0), `appointment_notifications` (0), `waiting_list` (0), `payments` (0), `video_sessions` (0) | | 6 · 0 · 4 · 2 · 1 |
| Dossier et ordonnances | `patient_medical_data` (0), `medical_records` (0), `prescriptions` (0), `prescription_seq_year` (0) | | 4 · 4 · 6 · 0 |
| Messagerie, avis, notifications | `conversations` (0), `messages` (0), `reviews` (0), `review_reports` (0), `notifications` (12) | | 1 · 3 · 7 · 3 · 2 |
| Cabinets | `cabinets` (0), `cabinet_members` (0) | | 3 · 1 |
| Dawini | `dawini_zones` (58, 1 active), `dawini_requests` (0), `dawini_responses` (0), `pharmacies` (194), `medication_alerts` (0) | | 1 · 3 · 2 · 2 · 1 |
| API partenaires | `api_keys` (0), `api_usage_log` (0) + **16 partitions journalières** `api_usage_log_20260518…0602` (0, sans policy) | | 1 · 1 · 0 |
| Traçabilité | `audit_log` (148), `admin_actions` (1), `consents_log` (0), `sms_log` (0), `email_log` (0), `rate_limits` (0) | | 2 · 2 · 1 · 1 · 1 · 0 |

Total : **94 policies** (SELECT `pg_policies`). Les tables sans aucune policy (`appointment_notifications`,
`prescription_seq_year`, `rate_limits`, les 16 partitions) sont inaccessibles hors `service_role`,
ce qui est le comportement voulu pour les trois premières.

### 5.2 Vues réellement présentes (14)

| Vue | Mode | Lisible par `anon` (droit) | Ce qu'un anonyme obtient réellement (HTTP) |
|---|---|---|---|
| `public_doctors` | definer (défaut) | oui | **75 034 lignes**, 35 colonnes sans téléphone ni e-mail |
| `public_doctors_listed` | definer | oui | 0 ligne (filtre `is_claimed AND approved`) |
| `doctor_ratings_summary`, `doctor_reviews_public`, `my_reviewable_appointments`, `my_upcoming_appointments` | definer | oui | 0 ligne (tables vides ou filtre `auth.uid()`) |
| `doctor_patients_directory` | definer | non | 401 |
| `api_keys_analytics`, `cabinet_calendar_view`, `cabinet_members_directory_view`, `cabinet_stats_view`, `my_two_factor_status`, `my_video_sessions` | `security_invoker=true` | non | 401 |
| `waiting_list_stats` | definer | non (ni `authenticated`) | 401 |

Vues **appelées par le front et absentes** : `waiting_list_count` (`waiting-list.html:816`),
`my_prescriptions` (`patient-ordonnances.html:394`). Tables appelées et absentes : `user_preferences`
et `account_deletion_requests` (`legal/rgpd-droits.html:267,305`). Les vues `public_doctor_full`
et `public_doctors_all` citées dans d'anciens documents n'existent pas.

### 5.3 Fonctions SQL (97 dans `public`, hors extensions, dont 81 `SECURITY DEFINER`)

| Catégorie | Fonctions | Constat |
|---|---|---|
| Appelées par le front et présentes (34) | `get_my_doctor_profile`, `update_my_doctor_profile`, `claim_my_doctor_profile`, `doctor_set_ordre_number`, `get_available_slots`, 4 fonctions cabinet, 5 fonctions admin, 3 fonctions API, `can_review_doctor`, `ensure_conversation`, 4 fonctions vidéo, 9 fonctions Dawini, `get_patient_medical_data`, `upsert_patient_medical_data` | signatures vérifiées dans `pg_proc` |
| Appelées par le front et **absentes** (5) | `validate_cabinet_invitation`, `create_prescription_draft`, `update_prescription_draft`, `request_prescription_signature`, `mark_prescription_delivered` | l'appel renvoie `PGRST202` |
| Appelée avec une mauvaise signature (1) | `admin_validate_doctor(p_doctor_id, p_action, p_notes)` reçoit aussi `p_reason` depuis `admin-dashboard.html:399` | échec de résolution |
| Présentes et appelées par personne | `record_consent`, `enroll_two_factor`, `disable_two_factor`, `check_doctor_account_exists`, `create_video_session`, `transfer_cabinet_ownership`, `next_prescription_number`, `tabibi_pii_encrypt/decrypt`, `verify_api_key`, `log_api_call`, `check_api_rate_limit`, `fn_check_rate_limit`, `fn_cleanup_old_logs` (cron) | |
| Triggers (30 fonctions, 33 triggers) | audit (`fn_audit_changes` sur `users` et `appointments`), validation des créneaux, synchronisation `starts_at/ends_at`, plafond secrétaire, verrouillage des colonnes protégées de `doctor_profiles`, outbox de confirmation, notation, append-only de `consents_log`, protection de `two_factor_secrets` et `video_sessions` | SELECT `information_schema.triggers` |

Les 34 fonctions `SECURITY DEFINER` exécutables par `anon` sont listées en §6.4.

### 5.4 Jobs planifiés

| Job | Planification | État réel |
|---|---|---|
| n° 1 `cleanup_old_logs` → `fn_cleanup_old_logs()` | `0 3 * * *` | actif ; effet non mesuré |
| n° 2 `appointment-reminders` → `net.http_post` vers l'edge | `*/15 * * * *` | actif, `succeeded` à chaque tir côté pg_cron (ce qui ne mesure que l'envoi de la requête), **HTTP 401 à chaque réponse** dans `net._http_response` (24 sur 24) ; le secret figure en clair dans `cron.job.command` |

Le fichier `supabase/migrations/20260729120100_reminders_cron.sql.DISABLED` n'est pas la source du
job n° 2 (nom différent, `tabibi-rappels-j1`) : le job a été créé hors dépôt.

### 5.5 Edge functions

| Fonction | Déployée | Version | `verify_jwt` | Auth dans le code | Dernier déploiement |
|---|---|---|---|---|---|
| `send-sms` | oui | v15 | false | signature `standardwebhooks` | 09/09/2026 |
| `sms-dlr` | oui | v2 | false | aucune (assumé) | 09/09/2026 |
| `appointment-reminders` | oui | v5 | false | en-tête secret | 03/08/2026 |
| `verify-turnstile` | oui | v6 | true | CORS + fail-closed | 05/07/2026 |
| `send-whatsapp`, `whatsapp-webhook` | **non** | — | — | HMAC désactivé si `WA_APP_SECRET` absent | — |
| `send-email`, `generate-prescription-pdf`, `create-video-room`, `verify-prescription`, `request-account-deletion` | **n'existent ni dans le dépôt ni en production**, mais sont appelées par le front | | | | |

Secrets edge présents (noms seulement, 20) : `BSMS_FROM/HANDLE/USER/USERID`, `DAILY_API_KEY`,
`DAILY_DOMAIN`, `REMINDERS_CRON_SECRET`, `REMINDERS_ENABLED`, `RESEND_API_KEY`,
`SEND_SMS_HOOK_SECRETS`, `SENTRY_DSN`, `TABIBI_PII_KEY`, `TURNSTILE_SECRET_KEY` et les 7 variables
`SUPABASE_*` gérées par la plateforme. `RESEND_API_KEY` (posé le 20/05) et `DAILY_API_KEY`/`DAILY_DOMAIN` (19–20/05) sont présents mais
ne sont lus par aucune fonction déployée : il manque les edge functions `send-email` et
`create-video-room` qui devaient les consommer.

### 5.6 Authentification (configuration GoTrue mesurée)

E-mail + mot de passe (8 caractères minimum, contrôle HIBP), téléphone + OTP (6 chiffres, 600 s,
5 s entre deux envois, 30 SMS/h, 30 OTP par 5 min et par IP, 100 vérifications), captcha Turnstile
obligatoire, JWT 3 600 s, rotation des refresh tokens (réutilisation tolérée 10 s), MFA TOTP GoTrue
activée mais non utilisée par le front, `site_url` `https://tabibi.doctor`, redirections autorisées
vers le site Netlify de preview, `tabibi.doctor/**` et `com.tabibi.doctor://reset-password`,
`sms_provider=twilio` sans identifiants (le hook `send-sms` prend la main), SMTP Brevo.

---

## 6. Sécurité

### 6.1 Authentification et rôles

Le rôle est lu dans `public.users.role` (`js/auth.js:49-55`), mis en cache dans `localStorage`, et
sert à rediriger et à garder les pages (`requireAuth`). Il n'a aucune valeur de sécurité : la base
n'en tient compte qu'à travers les policies qui relisent `users.role` et `is_admin()`. Trois pages
sensibles n'appellent pas `requireAuth` (`secretaire-dashboard`, `admin-cabinet`,
`admin-api-keys`) et reposent donc entièrement sur la RLS et les RPC. Le repli
`role: 'patient'` de `js/auth.js:53` en cas d'échec de lecture échoue « fermé » (redirection vers le
tableau de bord patient).

### 6.2 RLS : ce qu'un anonyme voit réellement

**Inventaire complet du 10/09/2026** (`docs/INVENTAIRE_PRIVILEGES_2026-09-10.md`) : **les 55 tables du schéma `public` ont la RLS activée**, 3 forcée ; aucune table ouverte par un simple privilège ; hors `public`, une seule table sans RLS lisible par `anon` (`realtime.subscription`, vide, schéma non exposé). Les privilèges par défaut restent trop larges (TRUNCATE, INSERT/UPDATE/DELETE de `anon` là où seule la RLS l'arrête) : c'est de l'hygiène, pas une ouverture.

94 policies ; 28 s'appliquent au rôle `anon` (dont 17 en lecture). Mesure HTTP avec la clé `anon`
seule, le 10/09 :

| Réponse | Objets |
|---|---|
| Données renvoyées | `public_doctors` (75 034), `wilayas` (58), `specialties` (44), `dawini_zones` (58), **`doctor_unavailable_slots` (3 lignes : `doctor_id`, `starts_at`, `ends_at`, `reason`, policy `dus_select_public = true`)** |
| 200 avec 0 ligne (RLS filtrante ou table vide) | `users`, `appointments`, `audit_log`, `admin_actions`, `reviews`, `review_reports`, `pharmacies` (194 lignes, invisibles), `payments`, `medical_records`, `waiting_list`, `claim_requests`, `dawini_requests/responses`, `doctor_schedule`, `medication_alerts`, `rate_limits`, `prescription_seq_year`, les 4 vues `doctor_ratings_summary`, `doctor_reviews_public`, `my_*` |
| 401 (`42501`, aucun droit) | `doctor_profiles`, `consents_log`, `sms_log`, `messages`, `prescriptions`, `doctor_patients_directory`, les 6 vues `security_invoker` |
| 404 (`PGRST205`, hors schéma exposé) | partitions `api_usage_log_*` |

Le droit `SELECT` reste accordé à `anon` sur 37 tables et 6 vues (héritage des privilèges par
défaut `anon=arwdDxtm`) ; c'est la RLS, pas le `GRANT`, qui ferme l'accès. `dawini_zones` expose
la liste des wilayas actives, ce qui est voulu. `doctor_unavailable_slots` expose à tout visiteur
les absences de tout médecin, avec le motif.

### 6.3 Ce qui a été fermé, et comment on le sait

| Mesure | Preuve |
|---|---|
| `doctor_profiles` retirée à `anon` (CRIT-4) | HTTP 401 `42501` sur `GET /rest/v1/doctor_profiles` avec la clé `anon` |
| Captcha vérifié côté serveur (CRIT-5) | `security_captcha_enabled=true`, `provider=turnstile` dans la configuration GoTrue ; edge `verify-turnstile` fail-closed |
| Colonnes protégées de `doctor_profiles` | trigger `trg_lock_doctor_protected_columns` |
| `consents_log` non modifiable | triggers `trg_consents_no_update`, `trg_consents_no_delete` |
| Secrets hors dépôt | gitleaks en CI sur tout l'historique ; allowlist limitée au JWT `anon` du projet ; `supabase secrets list` ne montre que des empreintes |
| Chemins de code bloqués sur l'hébergeur | Cloudflare : 4 Pages Functions ; Netlify : 14 règles `404 force` ; **Vercel : aucune** (105 fichiers servis le 09/09) |
| Enumération de `public_doctors` | **ouverte** : 1 000 lignes par requête, 75 034 au total ; fermeture proposée (RPC bornées, PR #57) non appliquée |

### 6.4 Fonctions `SECURITY DEFINER` exposées à `anon` (34) et leurs gardes

| Groupe | Fonctions | Garde interne (lue dans le code SQL ou testée) |
|---|---|---|
| Admin (5) | `admin_validation_list/total/counts`, `admin_validate_doctor`, `admin_doctor_doc_paths` | `is_admin()` interne ; `_api_is_admin_safe` |
| Médecin (6) | `get_my_doctor_profile`, `update_my_doctor_profile`, `claim_my_doctor_profile` (×2), `current_doctor_profile_id`, `check_doctor_account_exists` | `auth.uid()` requis ; `update_my_doctor_profile` sans session → 401 (test du 09/09 cité par l'ancien dossier, **non refait**) |
| Patient (3) | `get_patient_medical_data`, `upsert_patient_medical_data`, `get_available_slots` | `auth.uid()` |
| Dawini (13) | `dawini_*` | `auth.uid()` et appartenance pharmacie (`dawini_my_pharmacy_id`) — **lecture partielle**, voir §14 |
| Divers (7) | `is_admin`, `current_user_role`, `is_doctor_bookable`, `can_review_doctor`, `fn_check_rate_limit`, `api_usage_log_ensure_partition`, `_api_is_admin_safe` | `api_usage_log_ensure_partition(p_day)` crée une partition à la demande : exécutable par `anon`, aucune garde lue |

La plupart des fonctions DEFINER les plus anciennes figent `search_path=public` sans `pg_temp`
(les 13 Dawini, `admin_validation_list/total/counts`, `admin_doctor_doc_paths`,
`get_my_doctor_profile`, `update_my_doctor_profile`, `get_available_slots`, `can_review_doctor`,
`is_admin`, `is_doctor_bookable`…) ; quatre n'ont aucun `search_path` figé :
`admin_validate_doctor`, `current_doctor_profile_id`, `current_user_role`, `refresh_doctor_rating`.

### 6.5 En-têtes HTTP par hôte

Voir le tableau de mesures en §7.4 ; la configuration source est `_headers` (Cloudflare) et
`netlify.toml` (Netlify), qui portent la même CSP (`script-src 'self'` + Turnstile, Sentry,
Meta, Google Fonts, `unpkg.com`, `redocly` ; `frame-ancestors 'none'`), HSTS `preload`,
`X-Frame-Options DENY`, `nosniff`, `Referrer-Policy strict-origin-when-cross-origin`,
`Permissions-Policy` restrictive, COOP/CORP `same-origin`. Vercel ne reçoit aucune de ces règles.

### 6.6 Secrets : où ils vivent

| Secret | Emplacement | Public par conception |
|---|---|---|
| Clé `anon` Supabase, site key Turnstile, DSN Sentry, identifiant Meta Pixel | `js/config.js` | oui |
| Clé `service_role`, identifiants BudgetSMS, secret Turnstile, secret du hook, secret du cron, clé PII | secrets des edge functions (20 entrées, empreintes visibles seulement) | non |
| Clé de chiffrement PII | Vault (`tabibi_pii_key`, 20/05/2026) | non |
| Secret du cron des rappels | **en clair dans `cron.job.command`** (lisible par tout rôle ayant accès à `cron.job`) | non, et c'est le défaut constaté |
| Keystore Android `tabibi-release.jks` | disque local, ignoré par git, deux copies sur le même disque | non |
| Jetons Cloudflare, Netlify, Vercel, BudgetSMS, Brevo | tableaux de bord respectifs ; aucun dans le dépôt | non |
| Jeton GitHub Actions | `GITHUB_TOKEN` avec `contents: read`, `pull-requests: read` | — |

---

## 7. Fluidité et performance

Mesures du 10 septembre 2026 (Playwright 1.63 / Chromium 153, Lighthouse 12.8.2 mobile avec
throttling simulé, un passage par mesure sauf mention). **Fait structurant** : `https://tabibi.doctor/`
sert la page « Tabibi — Bientôt disponible » (4 919 octets, 1 requête). L'accueil complet n'est en
ligne que sur Netlify (`effulgent-kelpie-e48e81.netlify.app`) et Vercel ; les mesures « accueil
complet » viennent donc de Netlify. La production redirige `/login.html` vers `/login` (308).

### 7.1 Chargement réel

| Page | Requêtes | Octets transférés | Appels Supabase | LCP mobile | LCP desktop | LCP Slow 3G (2 000 ms, 50 Ko/s) | CLS |
|---|---|---|---|---|---|---|---|
| `tabibi.doctor/` (Bientôt disponible) | 1 | 3 638 | 0 | 804 ms (à froid) | 248 ms | 2 928 ms | 0 |
| `tabibi.doctor/login` | 54 | **1 200 844** | 1 | 1 252 ms | — | — | 0,001 |
| `tabibi.doctor/doctor-profile?id=<inconnu>` | 34 | 509 143 | 2 | 740 ms | — | — | 0 |
| Accueil complet (Netlify) | 73 | 1 078 349 | 3 | 848 ms | 968 ms | **6 732 – 6 904 ms** ; `load` à 22,3 s | 0,000 fibre, **0,214 Slow 3G** |

Répartition de l'accueil complet (mobile) : 7 polices pour **390 Ko** (Font Awesome depuis cdnjs
259 Ko, Cairo depuis Google Fonts), 29 scripts pour 261 Ko, 5 images pour 133 Ko (photos Unsplash
de démonstration), 27 « fetch » pour 179 Ko dont 22 URL de précache du service worker (≈ 180 Ko
téléchargés dès la première visite) et 3 requêtes `rest/v1/public_doctors`. Le dictionnaire
`tabibi-i18n.js` déployé pèse 100 893 octets (version antérieure au découpage par langue).
Sur `/login`, **Turnstile pèse 589 Ko** (dont un XHR de 421 716 octets), soit la moitié de la page.

### 7.2 Lighthouse

| URL | Perf | A11y | Bonnes pratiques | SEO | FCP | LCP | CLS | TBT | Requêtes / transfert | Défauts a11y |
|---|---|---|---|---|---|---|---|---|---|---|
| `tabibi.doctor/` (Bientôt disponible) | 99 | 100 | 100 | 92 | 0,8 s | 1,0 s | 0 | 140 ms | 2 / 5 Ko | aucun |
| `tabibi.doctor/login` | **55** | 91 | 100 | 92 | 5,9 s | **7,7 s** | 0,146 | 0 ms | 59 / 1 177 Ko | `color-contrast` (1), `target-size` (1) |
| Accueil complet (Netlify) | **65** | 96 | 100 | 100 | 2,4 s | **8,1 s** | 0,156 | 20 ms | 51 / 755 Ko | `color-contrast` (16 éléments) |

Historique conservé dans git (`70cc0f6`, 27/05/2026, Netlify, mobile) : accueil 67/85/100/100,
LCP 4,6 s, CLS 0,254 ; inscription 79/92 ; fiche praticien 79/90. Le 26/07 en local : accueil
a11y 83 → 96 après correctifs. Le dossier `tests/reports/` a été retiré de la branche le 09/09
(`d450492`) et n'existe plus que sur `main`.

### 7.3 Ce qui coûte cher au chargement, et pourquoi

- **Ressources bloquantes** : Lighthouse impute 4 227 ms de blocage sur `/login` (24 balises
  `<script src>` classiques, 3 feuilles CSS) et 988 ms sur l'accueil ; le 308 `/login.html → /login`
  ajoute 858 ms.
- **Polices** : Font Awesome complet (deux graisses woff2, 259 Ko) est chargé pour quelques icônes ;
  la production le prend encore sur cdnjs alors que la branche l'a vendorisé.
- **Service worker** : le précache de 20 URL se déclenche à la première visite de l'accueil et
  double le téléchargement d'`index.html`.
- **Turnstile** : 589 Ko incompressibles sur toute page de connexion ou d'inscription.
- **Fichiers non minifiés** : `js/` est copié tel quel (591 Ko) ; seules 11 pages passent par le
  bundler (bundle de l'accueil : 161 Ko).
- **Build** : `vite build` en 0,77 s ; `dist-web/` = 14 Mo dont 8,8 Mo de pages SEO copiées et
  513 Ko de sourcemaps publiés dans `assets/build/`.

Comportement sur réseau dégradé : en Slow 3G, l'accueil complet affiche son titre au bout de
6,7 à 6,9 s et finit de charger après 22 s, avec un décalage de mise en page de 0,21 (polices et
images sans dimensions réservées). La page « Bientôt disponible » tient en 2,9 s. Le mode hors
ligne du service worker ne concerne que les visiteurs passés par l'accueil.

### 7.4 En-têtes HTTP mesurés par hôte

| En-tête | `tabibi.doctor`, `www`, `tabibi-doctor.pages.dev` | Netlify | Vercel |
|---|---|---|---|
| Content-Security-Policy | présente ; `script-src` autorise encore jsdelivr, cdnjs, unpkg, googletagmanager ; `img-src` contient le joker `https:` (la branche les a retirés : **la production n'a pas reçu le `_headers` courant**) | identique | **absente** |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | idem | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy | DENY / nosniff / strict-origin-when-cross-origin / restrictive | idem | **absents** |
| `/supabase/migrations/`, `/.git/HEAD`, `/v2/package.json`, `/src/entries/` | 404 | 404 | 404 (le 09/09, `/supabase/functions/send-sms/index.ts` et 104 autres fichiers répondaient 200 sur Vercel : la copie a été régénérée depuis) |
| `/js/home-app.js` | **404** : le fichier créé le 08/09 (extraction du JS inline) n'est déployé nulle part | 404 | 404 |
| Les 45 pages (`/login`, `/signup`, `/doctor-dashboard`, `/agenda-cabinet`, `/medecin-profile`, `/admin-*`, `/dawini`, `/patient-*`, `/mes-rdv`, `/reservation`, `/teleconsultation`, pages légales…) | **200 partout** (relevé du 10/09, titres conformes) ; seule `/` est « Bientôt disponible » | 200 | 200 |
| Cache | HTML `max-age=0, must-revalidate` ; `/login` `no-store` | idem | HTML `max-age=0` |

### 7.5 Accessibilité

Niveau visé : `CLAUDE.md` demande « AA » ; aucun document du dépôt ne cite WCAG ni RGAA (le seul
« WCAG AA » est un message de commit). Mesuré : `lang="fr"` sur les 45 pages racine (l'arabe
bascule `lang`/`dir` à l'exécution), 0 image sans `alt` (12 images), un lien d'évitement sur 6 pages
(accueil, connexion, inscription, tableau de bord patient, agenda cabinet, ordonnance), 16 éléments
en défaut de contraste sur l'accueil complet et 1 sur la connexion d'après Lighthouse, aucun
`button-name` ni `link-name` en échec sur les trois pages testées.

---

## 8. Données et conformité

### 8.1 Données personnelles traitées

| Catégorie | Où | Colonnes notables | Volume réel |
|---|---|---|---|
| Identité et contact des comptes | `users`, `auth.users` | `first_name`, `last_name`, `date_of_birth`, `sex`, `phone`, `email`, `wilaya_code`, `photo_url`, `push_tokens`, `last_app_open_at` | 41 comptes |
| Données de santé déclarées par le patient | `patient_medical_data` | `blood_type`, `allergies`, `medical_history`, `current_medications`, `family_history`, `smoker`, `drinker` en clair ; `matricule_enc`, `chifa_card_enc` chiffrés (`tabibi_pii_encrypt`, clé Vault) ; `users.antecedents_enc`, `users.allergies_enc` | 0 ligne |
| Données médicales produites | `medical_records`, `prescriptions` (`diagnosis`, `clinical_notes`, `medications`), `appointments.notes_medecin_enc`, `diagnostic_enc` | | 0 ligne |
| Praticiens importés | `doctor_profiles` | `full_name`, `phone`, `phone_raw`, `email`, `address`, coordonnées, `ordre_number`, chemins de pièces d'identité (`id_card_path`, `ordre_card_path`) | **75 034 personnes physiques, sans consentement recueilli** (import) ; téléphone/e-mail/adresse jamais servis à `anon` |
| Justificatifs médecins | bucket privé `doctor-docs` | scan de carte d'identité et de carte de l'Ordre | 4 fichiers, 1,7 Mo |
| Journaux | `audit_log` (`before_data`/`after_data` en JSON, `ip_address` jamais rempli), `sms_log` (`phone_e164`, `body`, `ip_hash`), `consents_log` (`ip_hash`, `user_agent`), `waiting_list` (`ip_hash`) | | 148 · 0 · 0 · 0 |
| Traces tierces | Sentry (erreurs navigateur, DSN `de.sentry.io`), BudgetSMS (numéros et corps des SMS dans son tableau de bord), Brevo (adresses e-mail), Cloudflare (journaux d'accès) | hors de l'infrastructure Tabibi | |

Hébergement : base, Auth, Storage et edge functions à Francfort (`eu-central-1`) ; statique servi par
le réseau Cloudflare (et, tant que l'application GitHub est installée, par Vercel). Qui y accède :
2 comptes `admin`, le propriétaire du projet Supabase (tableau de bord, jeton CLI), les edge
functions via `service_role`. Il n'existe pas de registre des accès au tableau de bord dans le dépôt.

### 8.2 Journalisation et consentement : état réel des tables

| Mécanisme | Existe | Alimenté | Constat |
|---|---|---|---|
| `consents_log` + `record_consent(scope, version, granted, source, locale, ip, user_agent, evidence)` | oui, append-only, `ip_hash` poivré par `app.tabibi_ip_pepper` | **jamais** : 0 ligne, aucun appel dans le front | Les 4 cases de `signup.html` ne laissent qu'un horodatage dans `users.consent_*_at` |
| Bandeau cookies (`js/tabibi-cookies.js`, 17 pages) | oui | choix stocké dans `localStorage` seulement | Meta Pixel conditionné au consentement marketing ; Plausible inactif |
| `audit_log` | oui | par triggers sur `users` (UPDATE, DELETE) et `appointments` | 148 lignes, dernière le 05/08 ; `ip_address` et `user_agent` jamais renseignés (le trigger ne les connaît pas) |
| `admin_actions` | oui | par les RPC admin | 1 ligne |
| `sms_log` | oui (depuis le 09/09) | par `send-sms` et `sms-dlr` | 0 ligne ; les 28 SMS antérieurs ne sont visibles que chez BudgetSMS |
| Export et suppression (`legal/rgpd-droits.html`) | page présente | l'export lit `appointments`, `reviews`, `get_patient_medical_data` ; la demande de suppression écrit dans `account_deletion_requests` **(table absente)** puis appelle `request-account-deletion` **(edge absente)** | la demande de suppression ne peut pas aboutir |
| Anonymisation des pages SEO | `scripts/generate-seo-pages.mjs` | 576 pages sans nom de praticien (`grep` « Dr » → 0) | `robots.txt` autorise `/seo/` depuis le 06/08 |
| Chiffrement PII | `tabibi_pii_encrypt/decrypt`, clé dans Vault | fonctions présentes, tables vides | |

### 8.3 Loi 25-11 : ce qu'elle exige, ce qui existe

Constat sans conclusion juridique. La loi n° 25-11 du 24 juillet 2025 modifie et complète la loi
n° 18-07 du 10 juin 2018 (protection des personnes physiques dans le traitement des données à
caractère personnel) ; le texte lui-même n'a pas été lu, seules des synthèses publiques l'ont été
(voir §14). Les obligations qui en ressortent, mises en face du dépôt et de la base :

| Obligation (d'après les synthèses lues) | Ce qui existe aujourd'hui |
|---|---|
| Désigner un délégué à la protection des données | Adresse `dpo@tabibi.doctor` citée dans `api-docs.html` et les pages légales ; aucune désignation documentée dans le dépôt |
| Tenir un registre des traitements | Aucun registre dans le dépôt (`docs/` n'en contient pas) |
| Analyse d'impact pour les traitements sensibles (données de santé) | Aucune dans le dépôt |
| Notifier l'ANPDP d'une violation dans les 5 jours | Aucune procédure écrite ; aucune alerte automatique (le heartbeat proposé en PR #58 ne couvre que le cron) |
| Base légale et consentement pour les données de santé | Cases de consentement à l'inscription, horodatées dans `users` ; journal de preuve `consents_log` vide |
| Déclaration ou autorisation préalable auprès de l'ANPDP pour les traitements de données de santé | Rien dans le dépôt ne l'atteste |
| Information des personnes | `legal/confidentialite.html`, `legal/rgpd-droits.html`, `legal/cookies.html` présents et versionnés (`js/tabibi-legal-version.js`) |
| Transferts hors d'Algérie | Toutes les données sont hébergées dans l'Union européenne (Supabase Francfort, Cloudflare, Sentry Allemagne, Brevo, BudgetSMS Pays-Bas) ; le `legal/dpa.html` existe ; aucune autorisation de transfert n'est documentée |
| Droits d'accès, rectification, effacement | Export partiel fonctionnel ; effacement non fonctionnel (§8.2) |
| Sécurité et confidentialité | RLS sur 55 tables, chiffrement de quelques colonnes, HTTPS, HSTS ; pas de PITR, pas de test de restauration |
| Les 75 034 fiches importées | Personnes physiques traitées sans consentement ni information individuelle ; la fiche publique ne montre que nom, spécialité, wilaya, commune ; la base complète (téléphones, e-mails, adresses) est dans `doctor_profiles`, protégée par RLS |

---

## 9. Les clients

| Client | État réel | Détail |
|---|---|---|
| **Site web** | `tabibi.doctor` sert un déploiement antérieur au 08/09 : **les 45 pages applicatives sont en ligne et fonctionnelles** (un médecin connecté voit son tableau de bord complet), seule la racine est « Bientôt disponible », CSP ancienne ; l'accueil complet est sur Netlify et Vercel | 47 pages + 576 SEO dans le dépôt ; version applicative `1.0.2` (`js/config.js:13`) |
| **Android** (Capacitor 8.3.4) | APK signé, distribué hors store | `dz.tabibi.app`, `versionName 1.0.2`, `versionCode 4`, `minSdk 26`, `targetSdk 36` ; `namespace com.tabibi.doctor` (différent de l'`applicationId`) ; APK de 9 554 674 o construit le 09/09 et publié dans le bucket public `Downloads` ; embarque 27 pages patient/public listées en liste blanche par `scripts/build-mobile.sh` (jamais les pages admin, médecin, secrétaire, ni `sw.js`) ; **la copie embarquée est celle du 09/09 09:17**, donc antérieure aux correctifs des PR #56 à #58 ; signature par `android/tabibi-release.jks` (hors dépôt) ; plugins : App, Browser, Camera, Geolocation, Keyboard, LocalNotifications, Preferences, PushNotifications, Share, SplashScreen, StatusBar |
| **iOS** | projet Xcode généré, **jamais compilé** | `ios/App/App.xcodeproj` versionné (26 fichiers), dépendances par SPM, aucun `DerivedData`, aucun compte développeur Apple documenté ; commentaire de `capacitor.config.ts:66-68` : « Aucune installation iOS n'existe encore » |
| **Desktop « Tabibi Pro »** (Tauri 2) | compilé localement le 28/07, distribution **non vérifiée** | `desktop/src-tauri/tauri.conf.json` : `doctor.tabibi.pro` 0.1.0, `csp: null`, `tauri-plugin-localhost` (Turnstile ne fonctionne pas sous `tauri://`) ; binaire et `.dmg` aarch64 présents dans `desktop/src-tauri/target/release/` (ignorés) ; embarque 17 pages pro (`desktop/build-dist.sh`) ; workflow `desktop-release.yml` sur tag `desktop-v*`, builds non signés, brouillons de release |
| **v2 (React 19.2, Vite 8, TanStack Query 5, TypeScript strict)** | code de laboratoire, **jamais déployé** | 14 fichiers dans `v2/src` : pages `Agenda` et `Connexion`, domaine `agenda.ts` avec 21 tests Vitest, types `database.types.ts` générés depuis la base réelle le 09/09 (4 538 lignes) ; partage la session Supabase du site ; exclu de l'archive et en 404 sur Netlify ; vérifié en CI (`verifier-v2`) sans étape de déploiement |

Les trois copies `www/`, `ios/App/App/public/`, `android/app/src/main/assets/public/` (40 pages,
3,4 Mo chacune) sont des sorties de `cap sync`, non versionnées.

---

## 10. Déploiement

### 10.1 Hôte par hôte

| Hôte | Comment il est mis à jour | Automatique |
|---|---|---|
| Cloudflare Pages (`tabibi.doctor`) | À la main : `git archive main \| tar -x` dans un dossier temporaire, purge de `./desktop` et `./supabase`, contrôles, `npx wrangler pages deploy … --project-name=tabibi-doctor --branch=main` (`DEPLOY_FRONTEND.md`). Attendu : environ 12 Mo, 740 fichiers. **Le dernier déploiement est antérieur au 08/09** (`/js/home-app.js` → 404, CSP ancienne, accueil « Bientôt disponible » alors que `main` a rétabli l'accueil public le 03/09, PR #55) | **non**. Le workflow `deploiement.yml` existe (`push` sur `main`), mais ne s'exécute que si la variable GitHub `DEPLOIEMENT_AUTO` vaut `oui` et que `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` sont posés ; il est déclaré « préparé, pas actif » dans son en-tête |
| Netlify (previews) | Application GitHub : chaque PR reçoit un preview ; `publish = "."` (racine du dépôt telle quelle) | oui, sur PR |
| Vercel (`tabibi-doctor.vercel.app`) | Application GitHub : construit les branches (le bot a commenté la PR #57) et servait le 09/09 une copie de production | oui, tant que l'application reste installée |
| Edge functions Supabase | `supabase functions deploy <nom> --use-api` à la main | non |
| Schéma de base | scripts SQL exécutés à la main dans le SQL Editor (`migrations/`), aucun outil de migration | non |
| Android | `bash scripts/build-mobile.sh` puis Gradle, puis dépôt de l'APK dans le bucket `Downloads` et mise à jour de `telecharger.html` | non |
| Desktop | `cargo tauri build` local ou tag `desktop-v*` | partiel |

### 10.2 CI (GitHub Actions)

`verification.yml` sur chaque PR et `push` sur `main` : gitleaks (historique complet), `npm ci`,
ESLint, plafonds de dette (`scripts/compter-dette.mjs` : `no-empty 0`, `no-unused-vars 43`,
`no-console 28`, `no-restricted-properties 58`, `no-undef 0`), parité i18n, Playwright sur les
sources puis sur `dist-web/`, `vite build`, résumé des tailles. Job `verifier-v2` : typecheck,
tests, build de `v2/`. Permissions `contents: read`, `pull-requests: read` (le job v2 n'a pas de
bloc `permissions`). Dependabot : npm racine, npm `v2/`, actions GitHub. Les dernières exécutions
n'ont pas pu être listées (jeton local sans droit `actions`).

### 10.3 Les barrières et ce qu'elles bloquent réellement

| Barrière | Où | Vérification |
|---|---|---|
| `functions/{supabase,migrations,desktop}/[[path]].js` → 404 sec | Cloudflare Pages | mesures HTTP en §7.4 ; ces fonctions ne sont pas copiées dans `dist-web/`, donc un déploiement depuis `dist-web/` les perdrait |
| `functions/seo/[[path]].js` | Cloudflare Pages | filtre de sortie : toute page `seo/` contenant `schema.org/Physician` ou `<h3 itemprop="name">` est convertie en 404 (anciennes fiches nominatives que la couche d'assets continuait de servir 7 jours) |
| `_redirects` `404!` | Netlify seulement (Cloudflare ignore les statuts de ce fichier) | mesuré le 09/09 sur le preview de la PR #56 après ajout du `!` |
| `netlify.toml` : 14 règles `404 force` + 11 règles fichiers (`*.sql`, `.env*`, `README*.md`) | Netlify | `/v2/src/App.tsx` répondait 200 avant le `force` |
| `.gitattributes` `export-ignore` (`v2/**`, `src/**`, `migrations/`, `docs/`, `scripts/`, `tests/`, `templates/`, `fixtures/`, `android/`, `ios/`, `*.bak`) | `git archive`, donc le déploiement manuel | non simulé (§14) |
| Ruleset `protect-main` | GitHub | force push et suppression bloqués ; merge direct interdit par convention (`CLAUDE.md`) ; non relu via l'API (jeton insuffisant) |
| Aucune | Vercel | 105 fichiers de `supabase/`, `migrations/`, `desktop/` servis en 200 le 09/09 |

---

## 11. Intégrations tierces

| Service | Rôle | État réel | S'il tombe |
|---|---|---|---|
| **BudgetSMS** (`api.budgetsms.net/sendsms/`) | OTP de connexion (hook `send-sms`), rappels (edge, hors service), accusés de livraison (`sms-dlr`) | Compte actif, crédit **22,51 €** le 09/09, tarif facturé **0,089 €/SMS** vers l'Algérie (MCCMNC 60302), 28 SMS envoyés depuis juin, tous livrés, expéditeur `Tabibi` depuis le 31/07, callback DLR pointé sur `…/functions/v1/sms-dlr`, alerte de crédit à 15 € activée le 09/09, liste blanche d'IP désactivée | `send-sms` renvoie 500 : **plus aucune connexion par téléphone** ; aucun repli (Twilio configuré comme fournisseur mais sans identifiants) |
| **Cloudflare Turnstile** | captcha sur connexion, inscription, liste d'attente | site key `0x4AAAAAADR6IhCWO9RLIipE` ; secret GoTrue à jour ; secret de l'edge `verify-turnstile` périmé (`KNOWN_ISSUES.md`) | fail-closed : connexion et inscription impossibles |
| **Cloudflare** (DNS, Pages, WAF) | hébergement de production | DNS chez Cloudflare (`surina`/`julio.ns.cloudflare.com`) ; état du WAF **non vérifié** (connexion au tableau de bord refusée le 09/09) | site indisponible |
| **Supabase** | base, auth, storage, edge, cron | plan Pro, instance Micro, sauvegardes quotidiennes 7 jours, pas de PITR | tout est indisponible ; l'application Android aussi |
| **Brevo** | SMTP de GoTrue (`smtp-relay.brevo.com`, expéditeur `Tabibi`) ; gabarits d'e-mail applicatifs dans `js/tabibi-brevo.js` | SMTP configuré ; la chaîne applicative (`send-email`) **n'existe pas** | plus de confirmation d'e-mail ni de réinitialisation de mot de passe |
| **Sentry** | erreurs navigateur | actif (DSN réel), SDK 8.45.0 avec SRI, dégradation silencieuse si le CDN échoue ; pas de SDK edge | perte de visibilité seulement |
| **OpenStreetMap** (tuiles) + Leaflet local | carte de l'accueil | Leaflet vendorisé ; tuiles depuis `tile.openstreetmap.org` | carte grise, liste inchangée |
| **Google Fonts** | 4 pages (`404`, `about`, `dawini`, `onboarding-medecin`) | `display=swap` | police système |
| **Meta Pixel** | mesure d'acquisition | identifiant réel, chargé après consentement marketing | rien de visible |
| **Meta WhatsApp Cloud API** | canal prévu pour confirmations et OTP | code préparatoire non déployé ; **aucun compte WhatsApp Business** dans le portefeuille Meta « tabibidzapp » ; vérification d'entreprise non commencée | — |
| **Daily.co** | téléconsultation | SDK chargé depuis `unpkg.com` sans SRI sur une page masquée ; secrets `DAILY_API_KEY`/`DAILY_DOMAIN` présents depuis mai, **l'edge `create-video-room` qui doit les utiliser n'existe pas** | — |
| **Plausible** | analytics | inactif (`analytics: false`) | — |
| **Netlify**, **Vercel** | previews (Netlify) ; copie non voulue (Vercel) | applications GitHub installées | — |
| **GitHub** | dépôt privé, CI, Dependabot, gitleaks | 2FA obligatoire avant le 13/09/2026 sur le compte propriétaire | — |
| **Resend** | e-mails applicatifs prévus | secret `RESEND_API_KEY` présent depuis le 20/05 ; **l'edge `send-email` qui doit l'utiliser n'existe pas** ; les trois parcours qui l'appellent affichent « Email envoyé » à tort | — |
| **Twilio**, **Google Analytics** | aucun usage dans le code ; bloc Twilio du `config.toml` par défaut ; GTM seulement autorisé par la CSP | — | — |

---

## 12. Conventions et règles de travail

Résumé de `CLAUDE.md` (branche d'intégration) :

1. Jamais de commit ni de push direct sur `main` (ruleset `protect-main`) : branche puis PR.
2. Jamais de merge en production sans validation humaine explicite.
3. Toute action destructive en base (`DELETE`, `DROP`, `REVOKE`, `UPDATE` massif) est proposée avec
   `WHERE` ciblé et `RETURNING`, jamais exécutée par l'agent.
4. Aucun secret journalisé, écrit sur disque ou commité ; variables d'environnement uniquement.
5. Rien n'est déclaré fait sans preuve empirique (sortie de base, réponse HTTP, exécution navigateur).
6. Le projet Cloudflare Pages n'a pas de connexion Git : fusionner ne déploie rien ; chaque mise en
   production est un `wrangler pages deploy` manuel.
7. Les correctifs CRIT-1 (RLS), CRIT-4 (`doctor_profiles`), CRIT-5 (Turnstile serveur) sont considérés
   réglés et prouvés : ne pas les re-proposer.
8. Front : ne pas toucher au layout ni à la logique Supabase lors de retouches rapides ; conserver
   l'or `#d4a437` et le gris `#556070` ; cible d'accessibilité AA, Lighthouse ≥ 85.
9. Aucune modification de policy RLS ou de permission sans explication d'impact et validation.
10. Trois emplacements de noms de mois ne doivent pas être modifiés lors d'un changement de date de
    lancement ; les rapports sont courts, factuels, avec preuves et URL de PR.

Outillage associé : ESLint 9 avec plafonds de dette qui ne remontent jamais, parité i18n en CI,
Playwright sur sources et build, gitleaks, Dependabot, Node `>=22 <23` (`.nvmrc`).

---

## 13. Dette technique

Inventaire, sans ordre.

**Appels vers des objets qui n'existent pas**
- 5 edge functions appelées et absentes : `send-email` (`js/tabibi-brevo.js:619`),
  `generate-prescription-pdf` (`medecin-ordonnance.html:568`), `create-video-room`
  (`teleconsultation.html:419`), `verify-prescription` (`verify-prescription.html:234`),
  `request-account-deletion` (`legal/rgpd-droits.html:314`).
- 5 RPC appelées et absentes : `validate_cabinet_invitation` et les 4 RPC d'ordonnances.
- 4 relations appelées et absentes : `waiting_list_count`, `my_prescriptions`, `user_preferences`,
  `account_deletion_requests`.
- 1 RPC appelée avec un argument inconnu : `admin_validate_doctor(…, p_reason)`.
- Bucket `prescriptions` référencé (`patient-ordonnances.html:251,267`) mais absent du Storage.

**Motifs de drapeaux périmés**
- `video: false` justifié par des RPC « inexistantes » qui existent.
- `reviews: false` justifié par des tables « non créées » qui existent ; le drapeau n'est lu nulle part.
- `prescriptions: false` : motif exact (RPC absentes), toujours vrai.

**Dupliqué**
- `users` porte des colonnes de praticien (`specialty_fr/ar/en`, `specialty_slug`, `full_name`,
  `wilaya_fr`, `address`, `legacy_id`, `is_claimed`, `claimed_at`) qui doublonnent `doctor_profiles`.
- Deux fonctions `claim_my_doctor_profile` (avec et sans argument).
- Deux dossiers de SQL (`migrations/` 41 fichiers non horodatés, `supabase/migrations/` 3) ; aucun ne
  reconstruit le schéma ; la seule image du schéma est `v2/src/lib/database.types.ts`.
- Deux chemins de construction du site qui ne produisent pas le même contenu (§3).
- `index.html.bak` et `index.html.comingsoon` (240 Ko chacun, identiques) versionnés ; deux autres
  copies non suivies à la racine.
- `index.html:209-210` charge deux fois la même feuille Font Awesome.
- 16 partitions journalières `api_usage_log_2026…` vides (18 mai au 2 juin).
- Quatre copies du site mobile sur le disque (`www/`, `ios/…/public`, `android/…/public`,
  `desktop/dist`) et deux sorties de build (`dist/`, `dist-web/`).

**Mort ou dormant**
- `js/tabibi-seo-anonymize.js` (aucune page), `js/payments.js` (stub), `js/tabibi-sms.js` (appelle
  `send-sms` avec un contrat que la fonction refuse en 401), `js/tabibi-brevo.js` (edge absente).
- `doctor_schedule` (0 ligne, 5 policies, 1 trigger) doublée par `doctor_unavailable_slots` et
  `get_available_slots`.
- `two_factor_secrets`, `enroll_two_factor`, `disable_two_factor`, colonnes `users.totp_*` : 0 usage.
- `record_consent`, `tabibi_pii_encrypt/decrypt`, `next_prescription_number`,
  `create_video_session`, `check_doctor_account_exists` : présents, jamais appelés.
- Secrets edge en attente de leur fonction : `RESEND_API_KEY` (attend `send-email`), `DAILY_API_KEY` et `DAILY_DOMAIN` (attendent `create-video-room`).
- `icons/` (7 webp), `resources/` : non référencés par le manifest.
- `supabase/functions/send-whatsapp`, `whatsapp-webhook` : non déployées.
- 43 branches distantes non fusionnées ; 7 documents d'audit de mai 2026 jamais mis à jour ;
  `PROGRESS.md` (41 Ko) arrêté au 06/08.
- `_to_delete/` (5,5 Mo) et les fichiers de travail non suivis à la racine.

**Incomplet**
- Vite : 10 pages sur 54 ; design system v2 : 12 pages sur 54 ; service worker : 1 page sur 54.
- 1 786 attributs `style=` inline ; 6 dictionnaires i18n locaux hors contrôle de parité.
- Rôle `secretaire` : absent de l'enum `users.role` (`patient, doctor, admin, medecin`) alors que `signup.html:510` écrit `role: "secretaire"` dans le cache local et que `signup.html:498` appelle une RPC inexistante ; le rôle réel vient de `cabinet_members.role`. Trois pages pro/admin sans `requireAuth` (corrigé par la PR #61).
- `admin_validate_doctor` sans `search_path` figé ; 7 fonctions DEFINER sans `pg_temp`.
- `doctor_unavailable_slots` lisible par tout visiteur, motif compris.
- Sentry absent des edge functions ; aucun heartbeat d'exploitation.
- `audit_log` sans IP ; `consents_log` jamais alimenté ; suppression de compte non fonctionnelle.
- `namespace` Android `com.tabibi.doctor` ≠ `applicationId` `dz.tabibi.app` ; deep link
  `com.tabibi.doctor://reset-password` dans les redirections GoTrue.
- Cron des rappels en 401 ; secret en clair dans `cron.job`.
- Application Vercel installée et servant une copie sans en-têtes.
- 13 `TODO` dans le code (`js/tabibi-features.js`, `js/home-app.js`, `js/tabibi-booking.js`,
  `js/tabibi-reviews.js`, `js/tabibi-doctor-dashboard.js`).
- `KNOWN_ISSUES.md` : secret Turnstile de `verify-turnstile` périmé (liste d'attente bloquée).

---

## 14. Ce qui n'a pas pu être vérifié

- **Le texte de la loi n° 25-11** : seules des synthèses publiques ont été lues (PwC Algérie, Legal
  Doctrine, TSA, Intervalle Technologies, Octodet). Les obligations listées en §8.3 en proviennent.
- **La valeur effective de `DEPLOIEMENT_AUTO` et la présence des secrets Cloudflare** sur GitHub, ainsi
  que les dernières exécutions des workflows et le contenu du ruleset `protect-main` : le jeton local
  n'a pas les droits (`403`).
- **L'état du WAF et des règles Cloudflare**, le propriétaire exact des projets Vercel, et la
  configuration du projet Cloudflare Pages : connexions aux tableaux de bord non disponibles lors des
  vérifications.
- **Le contenu exact servi par `tabibi.doctor` au moment de la lecture** par rapport au dépôt : le
  déploiement manuel n'est pas horodaté dans le dépôt ; seules les mesures HTTP de §7 font foi.
- **La version des trois APK de `~/Downloads`** (29 juillet) et la signature effective de l'APK publié :
  `aapt` absent ; seul `output-metadata.json` du build du 09/09 a été lu.
- **La distribution du client desktop** : binaire et `.dmg` présents localement, aucune release
  consultée.
- **L'effet réel des `export-ignore`** : `git archive` n'a pas été simulé.
- **Les gardes internes des 13 fonctions Dawini et de `api_usage_log_ensure_partition`** : corps SQL
  non relus intégralement ; leur exposition à `anon` est établie, leur innocuité ne l'est pas.
- **Le comportement de `update_my_doctor_profile` sans session** : test du 09/09 cité par l'ancien
  dossier, non refait.
- **L'effet de `fn_cleanup_old_logs`** (job n° 1) : non mesuré.
- **Le 2FA médecin** : `medecin-profile.html:825` laisse penser que le secret TOTP n'est jamais
  persisté ; 0 secret en base ; le flux n'a pas été exécuté.
- **Depuis quand le cron des rappels répond 401** : `net._http_response` ne conserve que 6 heures.
- **Les comptes de l'ancien dossier** (« 45 pages », « 47 modules ») : les comptes mesurés sont 47
  pages racine (54 avec `legal/` et `blog/`) et 51 fichiers dans `js/` ; la base de comptage
  antérieure n'est pas connue.
- **Le nombre de traductions automatiques** (796 en `ar` et `en`) provient des en-têtes des
  dictionnaires, pas d'un comptage.
- **La restauration d'une sauvegarde Supabase** : jamais testée, donc la valeur réelle des sauvegardes
  quotidiennes est inconnue.
