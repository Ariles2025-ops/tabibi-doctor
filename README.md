# Tabibi.doctor

Plateforme de prise de rendez-vous médical pour l'Algérie. Site statique, backend Supabase, applications Android / iOS / desktop générées depuis le même code.

**État au 8 septembre 2026 : phase pré-lancement.** Lancement visé au congrès médical des 3–5 décembre 2026. La production est en ligne mais l'accueil public est masqué derrière une page « Bientôt disponible ».

| | |
|---|---|
| **Production** | https://tabibi.doctor — DNS pointé, HTTPS actif |
| **Staging** | https://effulgent-kelpie-e48e81.netlify.app (previews de PR uniquement) |
| **Dépôt** | `Ariles2025-ops/tabibi-doctor` (privé) |
| **Backend** | Supabase EU Francfort, projet `pudugodhiofqrctcdwfl` |
| **Hébergement** | Cloudflare Pages, projet `tabibi-doctor` — **sans connexion Git** |
| **Contact** | contact@tabibi.doctor (Zimbra OVH) |

> ⚠️ **Avant tout déploiement, lire [`DEPLOY_FRONTEND.md`](DEPLOY_FRONTEND.md) et [`CLAUDE.md`](CLAUDE.md).**
> Merger une PR sur `main` ne déploie **rien**. La mise en production est un `wrangler pages deploy` lancé à la main.

---

## Sommaire

1. [Ce que fait le produit](#1--ce-que-fait-le-produit)
2. [Stack technique](#2--stack-technique)
3. [Architecture](#3--architecture)
4. [Arborescence du dépôt](#4--arborescence-du-dépôt)
5. [Frontend — pages](#5--frontend--pages)
6. [Frontend — modules JavaScript](#6--frontend--modules-javascript)
7. [Styles, design system, i18n](#7--styles-design-system-i18n)
8. [Backend Supabase](#8--backend-supabase)
9. [Fonctionnalités et feature flags](#9--fonctionnalités-et-feature-flags)
10. [SEO](#10--seo)
11. [Applications mobiles et desktop](#11--applications-mobiles-et-desktop)
12. [Sécurité](#12--sécurité)
13. [Conformité et documents](#13--conformité-et-documents)
14. [Déploiement](#14--déploiement)
15. [Développement local](#15--développement-local)
16. [Dette technique connue](#16--dette-technique-connue)
17. [Conventions de contribution](#17--conventions-de-contribution)

---

## 1 — Ce que fait le produit

Un patient cherche un praticien en Algérie par spécialité et par wilaya, consulte sa fiche, et réserve un créneau. Le praticien gère son agenda, ses patients, ses documents, et reçoit ses rendez-vous. Autour de ce noyau :

- **Dawini** — localisation de médicaments en rupture : un patient signale une recherche, les pharmacies inscrites répondent. Feature différenciante sur le marché algérien.
- **Cas grave** — parcours de conciergerie pour les situations lourdes.
- **Liste d'attente** — capture d'intérêt patient et médecin avant le lancement.
- **Téléconsultation** (Daily.co) — front câblé, backend absent.
- **Ordonnances numériques** — front câblé, RPC absentes de la production.
- **Messagerie** patient ↔ médecin — code présent, désactivée.

Le fonds de données compte **79 746 fiches praticiens** importées (Google Places puis OpenStreetMap), dont **14 508 réclamables** par leur titulaire (celles qui portent un `legacy_id`). Au 6 août 2026, `is_claimed` et `is_verified` valaient 0 sur 75 034 fiches : **aucune fiche n'est encore revendiquée ni vérifiée.** Ces chiffres sont à re-vérifier en base avant tout usage commercial.

---

## 2 — Stack technique

| Couche | Technologie | Notes |
|---|---|---|
| Frontend | HTML / CSS / **JavaScript vanilla** | Aucun framework, aucun bundler, aucune étape de build pour le web |
| Backend | **Supabase** (PostgreSQL 15 + PostgREST + GoTrue + Storage + Edge Functions) | Région EU Francfort |
| Edge Functions | **Deno** (TypeScript) | 6 fonctions, cf. §8 |
| Hébergement web | **Cloudflare Pages** + Pages Functions | Déploiement manuel `wrangler` |
| Previews de PR | Netlify | `netlify.toml` — **pas la prod** |
| DNS / domaine / mail | **OVH** (domaine + zone DNS + Zimbra) | Passe ensuite par Cloudflare |
| Captcha | **Cloudflare Turnstile** | Site key publique dans `js/config.js` |
| Monitoring | **Sentry** (SDK 8.45.0, chargé par CDN avec SRI) | DSN dans `js/config.js` |
| Analytics | Plausible | Câblé, compte non créé — flag `analytics: false` |
| SMS | **BudgetSMS** via Edge Function | Rappels J-1 / H-2 en production |
| WhatsApp | Cloud API Meta | Edge Functions `send-whatsapp` + `whatsapp-webhook` |
| Mobile | **Capacitor 8** (`dz.tabibi.app`) | Android livré en APK, iOS non soumis |
| Desktop | **Tauri** (Rust) | `desktop/src-tauri`, release par GitHub Actions |
| Tests | **Playwright** | 4 parcours critiques, ajoutés en septembre 2026 |
| Cartographie | OpenStreetMap tiles + OpenRouteService | Autorisés dans la CSP |

---

## 3 — Architecture

```
                    ┌───────────────────────────────────────────┐
   Navigateur       │  Cloudflare (DNS → Pages)                 │
   Android (WebView)│  ├── assets statiques : *.html, js/, css/ │
   iOS (WKWebView)  │  ├── Pages Functions : barrières 404      │
   Desktop (Tauri)  │  │     /supabase/* /migrations/*          │
        │           │  │     /desktop/*  /seo/*                 │
        │           │  └── _headers : CSP, HSTS, X-Frame…       │
        ▼           └───────────────────────────────────────────┘
   js/config.js  ─────────────────┐
   js/supabase-client.js          │  HTTPS + JWT anon puis JWT utilisateur
        │                         ▼
        │        ┌──────────────────────────────────────────────┐
        └───────▶│  Supabase — projet pudugodhiofqrctcdwfl      │
                 │  ├── PostgREST : tables + vues, filtrées RLS │
                 │  ├── RPC SECURITY DEFINER (32 appelées)      │
                 │  ├── GoTrue : auth email / téléphone         │
                 │  │     + Turnstile serveur + HIBP            │
                 │  ├── Storage : documents médecin, APK        │
                 │  ├── Edge Functions (Deno) × 6               │
                 │  └── pg_cron : rappels toutes les 15 min     │
                 └──────────────────────────────────────────────┘
                                  │
                                  ▼
                    BudgetSMS · WhatsApp Cloud API · Sentry
```

**Principes structurants**

- **Aucune étape de build pour le web.** Ce qui est dans le dépôt est ce qui est servi. `dist/` et `www/` sont des sorties de build mobile, non versionnées.
- **Le client ne parle qu'à Supabase.** Aucun serveur applicatif intermédiaire. Toute la logique de sécurité est dans la base : RLS, `SECURITY DEFINER`, `GRANT`/`REVOKE`.
- **Aucun secret côté client.** Seule la clé `anon` (JWT public par conception) est exposée. Vérifié : 0 occurrence de `service_role`, `sk_live`, `sk_test`, `sb_secret`, `private_key` dans le dépôt.
- **Le même HTML sert les 4 plateformes.** Capacitor et Tauri embarquent une copie filtrée des pages publiques.

---

## 4 — Arborescence du dépôt

```
tabibi-doctor/
├── *.html                    ~45 pages applicatives (cf. §5)
├── js/                       47 modules, chargés par <script src> (cf. §6)
├── css/tabibi-ui.css         feuille historique (v1)
├── styles/                   design system v2 + feuilles d'auth
├── assets/                   logo, og-image, centroïdes wilayas, vendor
├── brand/                    DESIGN_TOKENS_v2.json (+ archive v1)
├── images/                   illustrations, icônes PWA
├── legal/                    6 pages légales publiques (CGU, RGPD…)
├── blog/                     index + articles
├── seo/                      576 pages générées — NE PAS ÉDITER À LA MAIN
├── sitemaps/                 sitemap-static / -blog / -seo-local
├── functions/                Pages Functions Cloudflare (barrières 404)
├── api/                      openapi.yaml + collection Postman + environnements
├── migrations/               38 scripts SQL manuels — cf. §8, caveat important
├── supabase/
│   ├── functions/            6 Edge Functions Deno
│   ├── migrations/           3 migrations versionnées (dont 1 .DISABLED)
│   └── config.toml
├── android/                  projet Capacitor Android (versionCode 4 / 1.0.2)
├── ios/                      projet Capacitor iOS (dz.tabibi.app)
├── desktop/src-tauri/        application desktop Rust/Tauri
├── scripts/                  build mobile, build zip, deploy web, génération SEO
├── tests/
│   ├── e2e/                  4 parcours Playwright
│   ├── manual/               4 procédures de test écrites
│   └── reports/              rapports Lighthouse
├── docs/                     écosystème documentaire (cf. §13)
├── templates/emails/         gabarits transactionnels
├── fixtures/                 jeux de données de test
├── v2/                       ⚠️ scaffold React/Vite — chantier gelé, hors prod
├── _headers / _redirects     en-têtes et routage Cloudflare Pages
├── netlify.toml              previews de PR uniquement
├── capacitor.config.ts       appId dz.tabibi.app, webDir www
├── manifest.json / sw.js     PWA (CACHE_VERSION fait autorité dans sw.js)
├── CLAUDE.md                 règles projet — à lire avant toute contribution
├── DEPLOY_FRONTEND.md        runbook de déploiement
├── DEPLOY_RAPPELS.md         runbook des rappels SMS
├── PROGRESS.md               journal de bord, 13 phases
├── SQL_TODO.md               dette SQL numérotée
├── AUDIT_*.md                audits successifs
└── KNOWN_ISSUES.md           anomalies actives
```

---

## 5 — Frontend — pages

**Public**

| Page | Rôle |
|---|---|
| `index.html` | Accueil : recherche, cartes praticiens, CTA claim. 116 Ko depuis l'extraction du JS |
| `about.html` | Présentation |
| `doctor-profile.html` | Fiche publique d'un praticien (lecture seule) |
| `reservation.html` · `doctor-reservation.html` | Tunnel de réservation, calendrier FR/AR |
| `waiting-list.html` | Liste d'attente pré-lancement (protégée par Turnstile) |
| `cas-grave.html` | Parcours conciergerie |
| `telecharger.html` | Téléchargement de l'APK |
| `blog/`, `legal/`, `api-docs.html`, `404.html`, `offline.html` | Contenus et pages système |

**Authentification** — `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html`, `verify-email.html`, `email-verified.html`

**Espace patient** — `patient-dashboard.html`, `patient-profile.html`, `mes-rdv.html`, `patient-ordonnances.html`, `patient-waitinglist.html`, `messages.html`, `conversation.html`, `notifications.html`, `payment.html` *(orpheline)*, `success.html`

**Espace médecin** — `doctor-dashboard.html` (94 Ko), `medecin-profile.html` (édition privée), `doctor-claim.html`, `onboarding-medecin.html`, `agenda-cabinet.html`, `medecin-ordonnance.html`, `medecin-waitinglist.html`, `doctor-analytics.html` *(factice, masquée)*, `teleconsultation.html`, `verify-prescription.html`

> ⚠️ `doctor-profile.html` = fiche **publique**. `medecin-profile.html` = édition **privée**. Ce n'est pas un doublon.

**Secrétariat / cabinet** — `secretaire-dashboard.html`, `admin-cabinet.html`

**Administration** — `admin-dashboard.html`, `admin-doctor-validation.html`, `admin-reviews.html`, `admin-api-keys.html`

**Dawini** — `dawini.html` (patient), `dawini-pharmacie.html` (pharmacie)

---

## 6 — Frontend — modules JavaScript

Aucun bundler : chaque page charge ses modules par `<script src>`. `js/config.js` doit toujours être chargé en premier.

**Noyau** — `config.js` (toutes les clés publiques) · `supabase-client.js` · `auth.js` · `api.js` · `tabibi-features.js` (feature flags) · `tabibi-security.js` · `tabibi-network.js`

**Métier** — `tabibi-booking.js` · `tabibi-agenda.js` · `doctors-display.js` · `tabibi-claim.js` (claim de fiche) · `tabibi-doctor-dashboard.js` · `tabibi-doctor-name.js` (normalisation des titres) · `tabibi-reviews.js` · `tabibi-messaging.js` · `tabibi-dawini.js` + `tabibi-dawini-demo.js` · `tabibi-doc-upload.js` · `tabibi-avatar.js` · `payments.js` *(stub)*

**Interface** — `tabibi-header.js` · `tabibi-nav.js` · `tabibi-footer.js` · `tabibi-pro-sidebar.js` · `tabibi-desktop-nav.js` · `tabibi-beta.js` · `tabibi-langbar.js`

**Internationalisation** — `tabibi-i18n.js` (dictionnaire principal, ~360 Ko) · `tabibi-lang.js` · `tabibi-prelang.js` (anti-FOUC)

**Plateforme** — `tabibi-platform.js` · `capacitor-bridge.js` (push, caméra, géoloc) · `tabibi-bridge.js` · `tabibi-sw-register.js`

**Sécurité / conformité** — `tabibi-turnstile.js` · `tabibi-captcha-visible.js` · `tabibi-2fa.js` · `tabibi-cookies.js` · `tabibi-legal-version.js` · `tabibi-pii-migration.js` · `tabibi-seo-anonymize.js`

**Observabilité et marketing** — `tabibi-sentry.js` · `tabibi-analytics.js` (Plausible) · `tabibi-pixel.js` (Meta) · `tabibi-brevo.js` · `tabibi-sms.js`

**Accueil** — `home-app.js` : 2 042 lignes extraites d'`index.html` en septembre 2026 pour rendre la page cacheable.

---

## 7 — Styles, design system, i18n

**Deux générations de CSS cohabitent.** `css/tabibi-ui.css` est la feuille historique ; `styles/tokens-v2.css` + `styles/components-v2.css` sont la v2. La migration est à ~13 % : 31 pages en v1 seul, 3 pages qui chargent les deux. `styles/auth.css` et `styles/auth-page.css` couvrent les mêmes 7 pages et sont fusionnables.

**Couleurs de marque — ne pas modifier sans demande explicite** : or `#d4a437` (accent), gris neutre foncé `#556070` (texte). Le PWA `manifest.json` utilise `#0F7560` comme thème. Les tokens sont versionnés dans `brand/DESIGN_TOKENS_v2.json`.

**Trois langues : français (défaut), arabe (RTL complet), anglais.** Le dictionnaire principal est `js/tabibi-i18n.js` ; huit modules embarquent en plus leur propre dictionnaire local (agenda, sidebar, nav, footer, cookies, beta, reviews, brevo). Les noms de mois arabes de `reservation.html` sont des données, jamais des dates de lancement — cf. le tableau d'exclusions de `CLAUDE.md`.

**PWA** — `manifest.json` : 9 icônes, mode standalone, 2 raccourcis. `sw.js` : `CACHE_VERSION` fait autorité (actuellement `tabibi-v37-2026-08-06`), précache d'`offline.html`, enregistrement par `tabibi-sw-register.js`, désactivé sur `localhost`.

---

## 8 — Backend Supabase

### Tables et vues appelées par le front

`users` · `doctor_profiles` · `public_doctors` *(vue publique)* · `appointments` · `doctor_schedule` · `doctor_unavailable_slots` · `reviews` · `review_reports` · `doctor_reviews_public` · `doctor_ratings_summary` · `prescriptions` · `conversations` · `messages` · `notifications` · `waiting_list` · `waiting_list_count` · `wilayas` · `specialties` · `pharmacies` · `dawini_requests` · `dawini_responses` · `medication_alerts` · `device_tokens` · `user_preferences` · `claim_requests` · `admin_actions` · `patient_medical_data` · `cabinets` · `cabinet_members` · vues `my_upcoming_appointments`, `my_reviewable_appointments`, `my_prescriptions`, `doctor_patients_directory`, `cabinet_calendar_view`, `cabinet_members_directory_view`

> **`public_doctors` expose le nom réel, toujours.** Seuls `address`, `latitude` et `longitude` sont masqués pour les fiches non revendiquées. L'anonymisation des pages SEO est faite par le script de génération, **pas par la vue**. Une note contraire a failli provoquer une fuite le 6 août 2026.

### RPC appelées par le frontend (32)

*Profil et claim* — `claim_my_doctor_profile`, `get_my_doctor_profile`, `update_my_doctor_profile`, `doctor_set_ordre_number`, `match_doctor_for_claim` *(exposée mais jamais appelée — cf. §12)*

*Rendez-vous* — `get_available_slots`

*Avis* — `can_review_doctor`

*Ordonnances* — `create_prescription_draft`, `update_prescription_draft`, `request_prescription_signature`, `mark_prescription_delivered` — **les 4 sont absentes de la production** (vérifié contre `pg_proc` le 29/07/2026)

*Téléconsultation* — `get_video_session`, `set_video_recording_consent`, `mark_video_session_started`, `mark_video_session_ended`

*Messagerie* — `ensure_conversation`

*Dossier patient* — `get_patient_medical_data`, `upsert_patient_medical_data`

*Cabinets* — `get_my_cabinets`

*Dawini* — `dawini_create_request`, `dawini_respond`, `dawini_create_alert`, `dawini_cancel_alert`, `dawini_expire_old`, `dawini_get_patient_contact`, `dawini_pharmacy_stats`, `dawini_shortage_by_wilaya`, `dawini_top_missing`

*Administration* — `admin_validate_doctor`, `admin_validation_list`, `admin_validation_counts`, `admin_validation_total`, `admin_doctor_doc_paths`

Inventaire détaillé : [`docs/RPC_INVENTORY.md`](docs/RPC_INVENTORY.md) et [`docs/SECURITY_RPC_AUDIT.md`](docs/SECURITY_RPC_AUDIT.md).

### Edge Functions (Deno)

| Fonction | Rôle |
|---|---|
| `appointment-reminders` | 3 passes — `j1` [now+6h, now+24h], `h2` [now+90min, now+150min], `confirmation` drainée depuis un trigger SQL. Kill-switch `REMINDERS_ENABLED=false` |
| `send-sms` | Envoi BudgetSMS |
| `sms-dlr` | Accusés de réception SMS |
| `send-whatsapp` | Envoi WhatsApp Cloud API |
| `whatsapp-webhook` | Réception WhatsApp |
| `verify-turnstile` | Validation captcha serveur — utilisée **uniquement** par le formulaire de liste d'attente |

**Automatisation** — `pg_cron` toutes les 15 minutes (jobid 2, actif) pilote `appointment-reminders`. Anti-doublon par index unique `(appointment_id, kind)` ; les fenêtres `j1` et `h2` ont été rendues disjointes après un bug réel (2 SMS pour 1 rendez-vous). Un trigger `AFTER UPDATE OF status ON appointments` alimente l'outbox SMS à la confirmation. Runbook : [`DEPLOY_RAPPELS.md`](DEPLOY_RAPPELS.md).

**Canal email : non retenu.** Le marché algérien passe par SMS. L'edge `send-email` appelée par `js/tabibi-brevo.js:619` n'existe pas.

### ⚠️ `migrations/` n'est pas le miroir de la production

38 scripts SQL manuels, exécutés à la main dans le SQL Editor, jamais rejoués automatiquement. **25 RPC vivent en production sans définition dans le dépôt**, et il n'existe aucun dump du schéma. Trois scripts de diagnostic sont fournis pour y remédier :

- `migrations/P1_dump_schema_prod.sql` — 6 Run d'introspection (tables, policies, fonctions avec corps, vues, contraintes, droits) à recoller dans `PROD_SCHEMA_DUMP.sql`
- `migrations/P1_test_coherence_doctor_id.sql` — tranche l'incohérence `doctor_id` (voir §12)
- `migrations/P0_revoke_match_doctor_for_claim.sql` — retrait d'un droit `anon` inutile

**Piège du SQL Editor Supabase** : chaque clic sur *Run* ouvre une connexion neuve. Un script qui commence par `BEGIN;` sans `COMMIT;` dans le **même** Run est annulé par rollback implicite, avec un « Success » trompeur. **Ne jamais écrire `BEGIN`/`COMMIT`** — un Run est déjà atomique, et la vérification se fait dans un Run séparé.

---

## 9 — Fonctionnalités et feature flags

`js/tabibi-features.js` expose `window.TABIBI_FEATURES`. Une entrée de menu ou un élément `data-feature="x"` disparaît si le flag `x` vaut `false`. Un flag **inconnu** laisse l'élément visible — on ne masque jamais sur une faute de frappe.

| Flag | Valeur | Ce que ça veut dire |
|---|---|---|
| `dawini` | `true` | Localisation de médicaments active |
| `notifications` | `true` | Notifications in-app actives (table + triggers en prod) |
| `sentry` | `true` | **Ce flag n'est lu par personne** : `tabibi-sentry.js` s'active sur la seule présence d'un DSN. Sentry tourne déjà sur les 28 pages qui incluent le script |
| `prescriptions` | `false` | Les 4 RPC sont absentes de la prod. Sans ce flag, chaque action renvoyait un `PGRST202` en erreur générique |
| `messaging` | `false` | Pages et tables prêtes, parcours non testé |
| `reviews` | `false` | Table `reviews` non créée (TODO-SQL-011) |
| `video` | `false` | RPC téléconsultation absentes (TODO-SQL-008) |
| `payments` | `false` | Aucun backend Stripe ni SATIM |
| `analytics` | `false` | Compte Plausible non créé |
| `doctorStats` | `false` | `doctor-analytics.html` est 100 % factice — entrée retirée de la sidebar |

**Paiements — le point dur.** Le marché algérien impose SATIM (CIB / Edahabia), sans sandbox stable, et l'intégration exige une entité commerciale locale enregistrée. `payment.html` existe mais n'a aucun lien entrant ; `js/payments.js` est un stub. Rien ne sera encaissable avant l'immatriculation en Algérie.

**Override de debug** : `localStorage.tabibi_features_override` accepte un JSON de flags, pour le QA uniquement.

---

## 10 — SEO

**576 pages** dans `seo/`, générées par `scripts/generate-seo-pages.mjs` (Node, lecture de `public_doctors` par lots de 1 000). Couverture : 32 890 praticiens, 48 wilayas, 26 spécialités, et les couples wilaya × spécialité comptant au moins 10 praticiens.

- **Les URL sont déclarées sans `.html`.** Cloudflare Pages sert `/seo/x.html` en 308 vers `/seo/x` : canonical, `og:url`, sitemaps et maillage interne pointent tous vers l'adresse réellement servie.
- **L'anonymisation est faite par le script**, jamais par la vue. Ne jamais régénérer « depuis `public_doctors` » sans repasser par le script.
- Deux affirmations commerciales fausses ont été retirées en août 2026 : « praticiens certifiés » (alors que `is_verified` = 0 partout) et un bouton « Prendre RDV » menant à une impasse.
- 3 sitemaps (`sitemap-static`, `sitemap-blog`, `sitemap-seo-local`) déclarés dans `robots.txt`.
- `index.html` porte 4 blocs JSON-LD (Organization, WebSite, FAQPage, LocalBusiness) et un jeu complet Open Graph / Twitter Cards avec alternates `fr_DZ` / `ar_DZ` / `en_US`.

**Ne jamais éditer `seo/` à la main** — tout est régénéré.

---

## 11 — Applications mobiles et desktop

### Android / iOS — Capacitor 8

`appId` **`dz.tabibi.app`**, `appName` Tabibi, `webDir` `www` (généré par `scripts/build-mobile.sh`). `androidScheme: 'https'` pour éviter les restrictions CORS. Le scheme de deep link reste `com.tabibi.doctor`, partagé entre `AndroidManifest.xml` et `js/capacitor-bridge.js`.

Plugins : App, App Launcher, Browser, Camera, Geolocation, Keyboard, Local Notifications, Preferences, Push Notifications, Share, Splash Screen, Status Bar.

**`build-mobile.sh` fonctionne en liste blanche** — 27 pages grand public, 8 dossiers — avec des garde-fous qui font **échouer** le build si `seo/`, `scripts/`, `api/` ou une page pro/admin réapparaît dans le bundle. C'est la correction d'un incident : des scripts internes étaient packagés dans un APK public.

État : **versionCode 4 / versionName 1.0.2**. Distribution par téléchargement direct depuis Supabase Storage (`telecharger.html`), pas encore par le Play Store. Les `.apk` et `.aab` sont ignorés par git ; les binaires passent par les GitHub Releases.

**Keystore** : `tabibi-release-CLE-OFFICIELLE.jks`, hors dépôt, sauvegardé dans `~/Desktop/TABIBI-KEYSTORE-SAUVEGARDE`. Sa perte signifie l'impossibilité définitive de mettre l'application à jour. Le mot de passe doit être stocké séparément des copies du fichier.

**iOS** : bundle unifié sur `dz.tabibi.app`, mais aucun `DEVELOPMENT_TEAM` n'est renseigné — bloquant pour toute soumission App Store. Le captcha en WebView iOS (`capacitor://localhost`, schéma non-http) reste à valider sur appareil réel.

### Desktop — Tauri

`desktop/src-tauri`, fenêtre 1440×900, publication par le workflow `.github/workflows/desktop-release.yml` (`tauri-apps/tauri-action`, matrice multi-OS, cache Rust). Version `0.1.0`.

Limites connues : pas de `tauri-plugin-updater` (chaque correctif impose une réinstallation manuelle), builds non signés, `sw.js` non copié dans le bundle, et 6 pages s'affichent en colonne mobile faute de media query ≥ 1024 px.

---

## 12 — Sécurité

### Les 5 CRIT — état

| ID | Sujet | État | Preuve |
|---|---|---|---|
| **CRIT-1** | Isolation RLS entre utilisateurs | 🟢 Prouvée | Les 94 policies scopent par `auth.uid()` ; aucune fuite cross-user constatée |
| **CRIT-2** | Gating des pages applicatives | 🟢 Fermé | 5 pages testées, aucune PII rendue sans session |
| **CRIT-3** | Mass assignment sur `update_my_doctor_profile` | 🟢 Mitigé | INSERT avec `is_admin` → 400 ; RPC sans auth → 401. Test post-auth médecin restant |
| **CRIT-4** | `doctor_profiles` exposait email / téléphone / chemins de documents à `anon` | 🟢 Fermé en prod | `REVOKE SELECT FROM anon` appliqué. `GET /rest/v1/doctor_profiles` → **401**. Les listings publics passent par la vue `public_doctors`. Table `doctor_profiles_backup_*` supprimée |
| **CRIT-5** | Signup contournant le captcha par REST | 🟢 Fermé (29/07/2026) | `POST /auth/v1/signup` sans `captcha_token` → **400 `captcha_failed`**, aucun compte créé, aucun `access_token` |

### Authentification

Supabase GoTrue, identifiants email **ou** téléphone. Captcha **Turnstile appliqué côté serveur** (Attack Protection), confirmation d'email active, vérification HIBP des mots de passe fuités activée, longueur minimale 8, comptes anonymes désactivés. Le widget Turnstile actif est `0x4AAAAAADR6IhCWO9RLIipE` ; la Secret Key ne vit que dans les secrets Supabase.

Redirections post-login par rôle dans `js/config.js` : patient, médecin, admin, pharmacie.

### En-têtes HTTP (`_headers`, dupliqués dans `netlify.toml`)

CSP stricte — `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` — avec une liste blanche explicite : Turnstile, Supabase (`https:` + `wss:`), Sentry (CDN + ingest), Plausible, tuiles OpenStreetMap, OpenRouteService, Meta. S'y ajoutent HSTS avec preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` et une `Permissions-Policy` restrictive.

### Barrières de routage (`_redirects` + `functions/`)

`/supabase/*`, `/migrations/*`, `/desktop/*` et `/.git/*` renvoient un 404 explicite. Ce n'est pas une précaution théorique : l'apex a continué à servir `supabase/functions/send-sms/index.ts` en **200** après un déploiement où le fichier était absent, sans qu'aucune purge de cache n'y change quoi que ce soit. Les Pages Functions de `functions/` doublent ces règles pour `/seo/*` — et la leçon documentée est qu'une Function qui renvoie un 404 sec **sans jamais appeler `context.next()`** est la seule forme qui fonctionne.

### Règles de secrets

Aucun secret n'est écrit sur disque, loggué ou commité. Variables d'environnement et secrets Supabase uniquement. Seule la clé `anon` est publique — c'est sa raison d'être.

### Points ouverts

- **RPC `match_doctor_for_claim` exposée à `anon` et jamais appelée** — surface d'attaque gratuite. Script de fermeture fourni : `migrations/P0_revoke_match_doctor_for_claim.sql`.
- **Mot de passe d'un compte de test** ayant circulé en clair dans le dépôt : le masquage ne suffit pas, l'historique git le conserve → **rotation en base obligatoire**. La purge des comptes de test, elle, a été faite et vérifiée le 5 août 2026.
- **Secret Turnstile de l'edge `verify-turnstile`** non mis à jour depuis le changement de widget → toute soumission de la liste d'attente échoue en fail-closed. Cf. [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).
- **Incohérence `doctor_id`** : `prescriptions` et `doctor_schedule` comparent `doctor_id = auth.uid()` là où les autres tables utilisent `doctor_profiles.id`. Si les deux identifiants diffèrent, un médecin ne verra ni ses créneaux ni ses ordonnances — **sans message d'erreur**. À trancher avec `migrations/P1_test_coherence_doctor_id.sql` avant le premier onboarding réel.
- **`?demo=1`** reste ouvert en production web sans authentification (`js/tabibi-agenda.js`), bannière visible, verrouillé côté desktop.
- **165 `innerHTML` non assainis** relevés lors d'un audit de code — risque XSS à traiter page par page.
- **2FA GitHub** exigée sur le compte propriétaire du dépôt.

### Actions destructives

Toute opération `DELETE`, `DROP`, `REVOKE` ou `UPDATE` massif sur la base **doit être proposée, jamais exécutée seule**, avec un `WHERE` ciblé et un `RETURNING`, et validée par un humain.

---

## 13 — Conformité et documents

Cadre applicable : **loi algérienne 18-07** (protection des données personnelles, autorité ANPDP) et **RGPD** pour l'hébergement européen.

`docs/` regroupe 45+ documents indexés dans [`docs/INDEX.md`](docs/INDEX.md) :

| Dossier | Contenu | Statut |
|---|---|---|
| `docs/legal/` | CGU, confidentialité, cookies, mentions légales, chartes patient et médecin, politique de remboursement | 🟡 **DRAFT — validation avocat DZ requise** |
| `docs/contrats/` | Partenariat médecin, NDA équipe, prestataire, consentement de claim | 🟡 **DRAFT — validation avocat DZ requise** |
| `docs/operations/` | KPI, onboarding équipe, playbook de crise, incident technique, modération, RGPD | 🟢 En vigueur |
| `docs/marketing/` | Plan de lancement, pitch médecin, stratégie de contenu | 🟢 En vigueur |
| `docs/guides-medecin/` · `docs/guides-patient/` | Guides de démarrage, gestion des RDV, téléconsultation, FAQ | 🟢 En vigueur |
| `docs/templates-emails/` | 8 gabarits (bienvenue, confirmation, rappel, annulation, no-show, suspension) | 🟢 En vigueur |
| `docs/mobile/` · `docs/security/` | Build Capacitor, déploiement, Firebase, push, tests ; documents CRIT-4 | 🟢 En vigueur |

Les pages légales publiques vivent dans `legal/` (`cgu`, `confidentialite`, `cookies`, `dpa`, `mentions-legales`, `rgpd-droits`), avec des redirections 301 depuis les anciennes URL racine. Le bandeau cookies (`js/tabibi-cookies.js`) place « Refuser » au même niveau visuel que « Accepter », n'active rien par défaut, et expire au bout de 6 mois.

**Sans validation par un avocat algérien, aucun contrat médecin signé n'a de valeur.** Le délai de retour est de 2 à 3 semaines : à lancer bien avant décembre. Note de cadrage : [`docs/NOTE_CADRAGE_AVOCAT.md`](docs/NOTE_CADRAGE_AVOCAT.md).

---

## 14 — Déploiement

### La règle à ne jamais oublier

> **Le projet Cloudflare Pages n'a aucune connexion Git.**
> Merger une PR sur `main` ne déploie **rien**. Chaque mise en production est un `wrangler pages deploy` lancé à la main.
> Erreur déjà commise le 3 septembre 2026 : un merge fait en croyant déployer, une heure perdue à chercher un problème de cache inexistant.

Procédure complète, avec ses pièges (dont un `rm -rf` sans `./` qui vide `functions/`) : [`DEPLOY_FRONTEND.md`](DEPLOY_FRONTEND.md). `scripts/deploy-web.sh` amorce la séquence ; `scripts/check-deleted-public-files.sh` est le garde-fou contre les suppressions accidentelles de fichiers publics.

**Après chaque déploiement, vérifier par `curl` — jamais depuis le navigateur seul :** la couche d'assets de Cloudflare Pages a déjà servi des fichiers supprimés du déploiement, pour l'URL exacte sans query string, insensible à toute purge.

**Netlify ne sert que les previews de PR.** `netlify.toml` duplique les en-têtes de sécurité pour que les previews soient représentatives.

**Desktop** : `.github/workflows/desktop-release.yml` construit et publie les binaires Tauri.

**Mobile** : `scripts/build-mobile.sh` (liste blanche) puis `npx cap sync` et build Android Studio / Xcode. Incrémenter `versionCode` à chaque distribution, sinon l'installation est refusée, et répercuter la version dans `telecharger.html`.

---

## 15 — Développement local

```bash
git clone https://github.com/Ariles2025-ops/tabibi-doctor.git
cd tabibi-doctor

# Le web n'a aucune dépendance à installer : un serveur statique suffit.
python3 -m http.server 8000     # puis http://localhost:8000
```

`js/tabibi-sw-register.js` neutralise le service worker sur `localhost` : le cache ne pollue pas le développement.

```bash
npm install                 # dépendances Capacitor uniquement
npm run sync                # npx cap sync
npm run open:android        # ouvre Android Studio
npm run open:ios            # ouvre Xcode

npx playwright test         # 4 parcours critiques
node scripts/generate-seo-pages.mjs   # régénère seo/ (nécessite l'accès Supabase)
```

Le SQL se joue **à la main** dans le SQL Editor Supabase, script par script, en respectant la règle « pas de `BEGIN`/`COMMIT` » et la vérification en Run séparé.

---

## 16 — Dette technique connue

**Bloquant avant le lancement**

- Schéma de production non versionné — `migrations/` n'est pas le miroir de la base.
- 4 RPC ordonnances absentes de la production.
- Secret Turnstile de la liste d'attente non mis à jour.
- Rotation du mot de passe du compte de test.
- Incohérence `doctor_id` non tranchée.
- Déploiement manuel sans automatisation ni vérification systématique.

**Confort et qualité**

- Aucun bundler, aucune minification — `js/tabibi-i18n.js` fait 360 Ko bruts sur 43 pages.
- Lighthouse : performance 67/100, accessibilité 85/100 (mesures de mai 2026, à refaire après l'allègement de l'accueil).
- Service worker enregistré sur `index.html` seulement ; ~30 pages déclarent le manifest sans jamais l'enregistrer.
- Migration CSS v2 à 13 % ; 15 pages avec un `<header class="app-bar">` en dur.
- 8 dictionnaires i18n locaux hors du dictionnaire principal.
- Console : 404 orphelin sur `/scripts/app.js`.
- Push Firebase partiel : table et collecte en place, **zéro envoi serveur**, pas de `google-services.json`.
- Versioning éclaté : `package.json` 1.0.0, Tauri 0.1.0, Android 1.0.2/vc4, `sw.js` v37 — et aucune version affichée dans l'application.
- `v2/` : scaffold React/Vite créé en septembre 2026, **chantier gelé**. Il ne remplace pas la production et n'est pas déployé.

**Dette SQL numérotée** — TODO-SQL-008 (RPC téléconsultation Daily.co), 009 (paiements), 010 (triggers de notification), 011 (table `reviews` + RLS). Détail : [`SQL_TODO.md`](SQL_TODO.md).

---

## 17 — Conventions de contribution

Les règles complètes sont dans [`CLAUDE.md`](CLAUDE.md), lu automatiquement par les agents. En résumé :

1. **Jamais de commit ni de push direct sur `main`.** La branche est protégée (ruleset `protect-main`). Toujours une branche + une PR.
2. **Jamais de merge en production sans validation humaine explicite.**
3. **Toute action destructive sur la base s'arrête et demande confirmation**, avec garde-fou.
4. **Jamais de secret loggué, écrit sur disque ou commité.**
5. **Rien n'est validé sans preuve empirique** — sortie de base réelle, réponse HTTP, run navigateur, score mesuré. Jamais « ça devrait marcher ».
6. **Ne pas toucher au layout, aux fonctionnalités ni à la logique Supabase** lors d'une tâche d'optimisation.
7. **Ne pas modifier les couleurs de marque** sans demande explicite.
8. Rapport attendu : concis, factuel, avec les preuves, l'URL de PR, et ce qui reste à décider.

**Nommage des branches** : `feat/`, `fix/`, `chore/`, `docs/`, `perf/`.

---

*Ce README décrit l'état du 8 septembre 2026. Les chiffres de base de données sont ceux des derniers audits documentés et doivent être re-vérifiés en base avant tout usage commercial. Journal de bord : [`PROGRESS.md`](PROGRESS.md). Anomalies actives : [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).*
