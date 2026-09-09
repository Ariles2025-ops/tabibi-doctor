# Tabibi.doctor

Plateforme de prise de rendez-vous médical en Algérie. Site web, applications Android et iOS,
logiciel de cabinet — tous générés depuis le même code.

> **Audit du 9 septembre 2026, mis à jour le soir après huit commits de corrections.** Chaque chiffre de ce document vient d'une commande exécutée
> ou d'un fichier lu, pas d'une estimation. Le schéma de base est extrait des types générés
> depuis la production (`supabase gen types typescript --linked`). Les rares points invérifiables
> sont signalés comme tels.
>
> Les **règles de travail** sont dans `CLAUDE.md` et priment sur ce fichier, qui décrit le système.

---

## Sommaire

| | |
|---|---|
| [1. Le produit](#1--le-produit) | Ce que fait Tabibi, pour qui, et ce qui le différencie |
| [2. Démarrage rapide](#2--démarrage-rapide) | Servir, builder, tester |
| [3. Architecture](#3--architecture) | Le schéma d'ensemble et ses conséquences |
| [4. Arborescence](#4--arborescence-du-dépôt) | Où vit quoi |
| [5. Le front web](#5--le-front-web) | 45 pages, 47 modules, CSS, i18n, PWA |
| [6. Build, qualité, tests](#6--build-qualité-tests) | Vite 8, ESLint, cliquet de dette, Playwright, CI |
| [7. Le backend Supabase](#7--le-backend-supabase) | 55 tables, 14 vues, 70 fonctions, 6 edge functions |
| [8. Fonctionnalités](#8--fonctionnalités--état-réel) | État réel, flag par flag |
| [9. Les trois clients](#9--les-trois-clients) | Mobile Capacitor, desktop Tauri, v2 React |
| [10. SEO](#10--seo) | 576 pages locales et leur anonymisation |
| [11. Intégrations](#11--intégrations-tierces) | 13 services tiers et leur état |
| [12. Sécurité](#12--sécurité) | Auth, RLS, CRIT, CSP, secrets, mécanismes dormants |
| [13. Déploiement](#13--déploiement) | Cloudflare Pages et ses trois barrières |
| [14. Conventions](#14--conventions-de-travail) | Règles non négociables et nommage |
| [15. Dette technique](#15--dette-technique-mesurée) | Compteurs réels, triés |
| [16. Documentation](#16--documentation-du-projet) | Les 57 documents et à quoi ils servent |

---

## 1 — Le produit

**Tabibi.doctor** met en relation les patients algériens et les praticiens : recherche par
spécialité et par wilaya, fiche praticien, prise de rendez-vous, rappels SMS, espace patient,
espace médecin, espace secrétariat, espace pharmacie, console d'administration.

| | |
|---|---|
| **Phase** | Pré-lancement. Lancement au **congrès médical des 3-5 décembre 2026** (stand payé) |
| **Éditeur** | SARL de droit algérien. Gérant et DPO : Aghiles Haddadene |
| **Marché** | Algérie — 58 wilayas, fonds de **75 034 fiches praticiens** (chiffre vérifié en production le 09/09/2026) |
| **Langues** | Français (référence juridique), arabe (RTL complet), anglais |
| **Production** | https://tabibi.doctor · **Staging** : https://effulgent-kelpie-e48e81.netlify.app |
| **Dépôt** | `github.com/Ariles2025-ops/tabibi-doctor` — **privé** (vérifié via l'API GitHub le 09/09/2026 ; plusieurs documents disaient encore « public ») |

### Ce qui différencie le produit

- **Dawini** — localisation de médicaments en pénurie. Le patient déclare ce qu'il cherche,
  les pharmacies de sa zone répondent. Pensé pour un marché où la rupture de stock est
  quotidienne. Activation wilaya par wilaya via `dawini_zones`.
- **Le claim de fiche** — un praticien découvre sa fiche pré-existante et la revendique, au lieu
  de créer un compte dans le vide. **0 fiche revendiquée sur 75 034** : c'est tout l'enjeu du congrès.
- **SMS-only** — en Algérie l'e-mail n'est pas un canal fiable. Expéditeur alphanumérique
  « Tabibi » (mesuré le 31/07/2026 : 5/5 délivrés, contre 11/19 avec un numéro partagé).
- **Cas grave** — parcours d'orientation vérifiée pour les situations urgentes.

---

## 2 — Démarrage rapide

### Servir le site

Le site fonctionne **sans étape de build** — c'est ce qui est déployé aujourd'hui.

```bash
python3 -m http.server 8080     # origine déjà autorisée côté Turnstile
```

Avec la chaîne Vite (bundles minifiés) :

```bash
npm install
npm run dev            # serveur de développement
npm run build          # sortie dans dist-web/
```

### Vérifier

```bash
npm run lint           # ESLint 9
npm run lint:dette     # le cliquet : la dette ne doit pas remonter
npm run i18n:verifier  # les 3 dictionnaires ont les mêmes clés
npm run test:e2e       # 30 tests Playwright (le serveur démarre tout seul)
npm run test:e2e:build # les mêmes, contre la sortie de build
npm test               # lint + e2e
```

### Applications

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
bash scripts/build-mobile.sh          # génère www/ + npx cap sync
npx cap open android                  # ou : cd android && ./gradlew bundleRelease

cd desktop && sh build-dist.sh && cargo tauri build     # logiciel de cabinet

cd v2 && npm install && npm run dev   # application React
cd v2 && npm run typecheck && npm test && npm run build
```

### Prérequis

| Outil | Version | État sur la machine de développement (09/09/2026) |
|---|---|---|
| Node | 22 LTS | ✅ 22.20.0 · npm 10.9.3 |
| JDK | 17+ | ✅ Temurin 21.0.12 — `JAVA_HOME` à exporter, absent du shell |
| Android SDK | build-tools 36 | ✅ `~/Library/Android/sdk` |
| Xcode | 15+ | ❌ **absent** — seules les Command Line Tools sont installées |
| Supabase CLI | — | ✅ projet lié à `pudugodhiofqrctcdwfl` |
| Rust + Tauri CLI | — | non vérifié |

---

## 3 — Architecture

Il n'y a **aucun serveur applicatif**. Le navigateur parle directement à Supabase, et toute la
logique métier sensible vit dans des fonctions PostgreSQL et des policies RLS.

```
                    ┌──────────────────────────────────────────┐
                    │  Cloudflare Pages — projet tabibi-doctor │
                    │  site statique + 4 Pages Functions       │
                    │  ⚠ aucune connexion Git : deploy manuel  │
                    └────────────────┬─────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼────────┐         ┌─────────▼─────────┐        ┌─────────▼─────────┐
│  Navigateur    │         │  App mobile       │        │  Tabibi Pro       │
│  45 pages      │         │  Capacitor 8      │        │  Tauri 2          │
│  + 576 SEO     │         │  Android + iOS    │        │  macOS / Windows  │
│  HTML/JS       │         │  bundle www/      │        │  bundle desktop/  │
│  vanilla       │         │  27 pages public  │        │  17 pages pro     │
│                │         │                   │        │                   │
│  + v2/ React19 │         │                   │        │                   │
└───────┬────────┘         └─────────┬─────────┘        └─────────┬─────────┘
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     │ supabase-js 2.116.0 · JWT · RLS
                    ┌────────────────▼─────────────────────────┐
                    │  Supabase — EU Frankfurt                 │
                    │  projet pudugodhiofqrctcdwfl             │
                    │                                          │
                    │  PostgreSQL  · 55 tables · 14 vues       │
                    │              · 70 fonctions · 9 enums    │
                    │              · 94 policies RLS           │
                    │              · triggers de notification  │
                    │              · pg_cron (jobid 2, 15 min) │
                    │  Auth        · e-mail + téléphone (OTP)  │
                    │              · captcha Turnstile serveur │
                    │  Storage     · documents médecins, APK   │
                    │  Edge (Deno) · 6 fonctions               │
                    └────────────────┬─────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
        ┌─────▼─────┐         ┌──────▼──────┐        ┌──────▼──────┐
        │ BudgetSMS │         │  Turnstile  │        │ Meta Cloud  │
        │ OTP+rappel│         │  anti-bot   │        │ API (dort)  │
        └───────────┘         └─────────────┘        └─────────────┘
```

**La conséquence à retenir** : il n'existe aucun endroit où cacher de la logique. Tout ce que
le front peut appeler, un attaquant peut l'appeler. La sécurité repose **entièrement** sur les
policies RLS et sur les gardes internes des fonctions — voir [§12](#12--sécurité).

---

## 4 — Arborescence du dépôt

```
tabibi-doctor/
├── *.html                    45 pages applicatives (§5.1)
├── js/                       47 modules, communiquant par des globales (§5.2)
├── css/ · styles/            7 feuilles — design system v1 → v2
├── src/entries/              points d'entrée Vite, un par page convertie (§6)
├── assets/
│   ├── vendor/supabase/      SDK auto-hébergé, version dans le nom du fichier
│   ├── vendor/leaflet/       cartographie
│   └── dz-wilaya-centroids.js
├── images/ · brand/          logos, icônes PWA, tokens de marque JSON
├── legal/                    6 pages légales publiques
├── blog/                     6 articles + index
├── seo/                      576 pages locales générées (§10)
├── sitemaps/                 3 sitemaps thématiques
├── templates/emails/         10 gabarits transactionnels
├── api/                      openapi.yaml + collection Postman (API partenaires)
│
├── migrations/               41 fichiers SQL joués à la main — PAS le miroir de la prod
├── supabase/
│   ├── config.toml           dont verify_jwt par fonction
│   ├── migrations/           3 migrations versionnées
│   └── functions/            6 edge functions Deno (§7.5)
│
├── android/ · ios/           projets natifs générés par Capacitor
├── www/                      bundle mobile — GÉNÉRÉ, non versionné
├── capacitor.config.ts
│
├── desktop/                  Tabibi Pro (Tauri) : build-dist.sh + src-tauri/
├── v2/                       application React 19 (§9.3)
│   ├── src/domaine/          règles métier pures + 21 tests
│   ├── src/donnees/          TanStack Query
│   └── src/lib/database.types.ts   4 513 lignes générées depuis la prod
│
├── functions/                4 Pages Functions Cloudflare — barrières 404 (§13)
├── scripts/                  build-mobile · build-zip · deploy-web ·
│                             check-deleted-public-files · generate-seo-pages ·
│                             compter-dette · sauvegarder-keystore
├── tests/e2e/                30 tests Playwright
├── docs/                     57 documents (légal, contrats, guides, ops, mobile, sécurité)
│
├── vite.config.mjs           build multi-pages
├── eslint.config.mjs         3 règles, chacune adossée à un défaut compté
├── playwright.config.js      serveur autonome, 3 cibles
├── .github/workflows/        verification.yml · desktop-release.yml
├── sw.js                     service worker — CACHE_VERSION fait autorité
├── _headers · _redirects     en-têtes de sécurité, 404 explicites (Cloudflare)
├── netlify.toml              mêmes règles pour les previews de PR
├── .gitattributes            export-ignore : ce que git archive retire du bundle
└── CLAUDE.md                 règles de travail — priment sur tout
```

**Généré, jamais édité à la main** : `www/`, `dist-web/`, `dist/`, `desktop/dist/`, `v2/dist/`,
`seo/`, `v2/src/lib/database.types.ts`, `android/app/build/`, `node_modules/`.

---

## 5 — Le front web

### 5.1 Pages par parcours

**Public et acquisition** — `index.html` (accueil, JS extrait dans `js/home-app.js`) ·
`doctor-profile.html` (fiche **publique**) · `about.html` · `telecharger.html` ·
`cas-grave.html` · `waiting-list.html` · `patient-waitinglist.html` ·
`medecin-waitinglist.html` · `404.html` · `offline.html` · `success.html`

**Authentification** — `login.html` · `signup.html` · `forgot-password.html` ·
`reset-password.html` · `verify-email.html` · `email-verified.html`

> Le parcours principal est le **téléphone + code SMS**. Le champ e-mail de `login.html` vit dans
> `<div id="screen-admin" class="hidden">` : c'est l'écran de connexion administrateur, masqué
> par défaut. Deux tests Playwright affirmaient le contraire et ont été corrigés le 09/09/2026.

**Patient** — `patient-dashboard.html` · `patient-profile.html` · `mes-rdv.html` ·
`reservation.html` · `patient-ordonnances.html` · `notifications.html` · `messages.html` ·
`conversation.html` · `verify-prescription.html` · `payment.html` *(orpheline : 0 lien entrant)*

**Médecin et cabinet** — `doctor-dashboard.html` (92 Ko, la plus grosse page) ·
`medecin-profile.html` (édition **privée**) · `agenda-cabinet.html` · `doctor-reservation.html` ·
`medecin-ordonnance.html` · `doctor-analytics.html` *(factice, entrée masquée)* ·
`doctor-claim.html` · `onboarding-medecin.html` · `secretaire-dashboard.html` ·
`teleconsultation.html`

**Dawini** — `dawini.html` (patient) · `dawini-pharmacie.html` (pharmacie)

**Administration** — `admin-dashboard.html` · `admin-doctor-validation.html` ·
`admin-cabinet.html` · `admin-reviews.html` · `admin-api-keys.html` · `api-docs.html`

### 5.2 Modules JavaScript (47)

| Domaine | Modules |
|---|---|
| **Socle** | `config.js` · `supabase-client.js` · `auth.js` · `api.js` · `tabibi-network.js` · `tabibi-features.js` |
| **Chrome de page** | `tabibi-header.js` · `tabibi-nav.js` · `tabibi-footer.js` · `tabibi-pro-sidebar.js` · `tabibi-desktop-nav.js` · `tabibi-platform.js` |
| **i18n** | `tabibi-i18n.js` (runtime, 15 Ko) + `i18n/{fr,ar,en}.js` (**une seule langue chargée** : fr 72 Ko, ar 133, en 104 — 1 503 clés chacune) · `tabibi-lang.js` · `tabibi-langbar.js` · `tabibi-prelang.js` |
| **Rendez-vous** | `tabibi-booking.js` · `tabibi-agenda.js` · `doctors-display.js` · `tabibi-doctor-name.js` |
| **Médecin** | `tabibi-doctor-dashboard.js` · `tabibi-claim.js` · `tabibi-doc-upload.js` · `tabibi-avatar.js` |
| **Dawini** | `tabibi-dawini.js` · `tabibi-dawini-demo.js` |
| **Sécurité** | `tabibi-security.js` (escapeHtml) · `tabibi-turnstile.js` · `tabibi-captcha-visible.js` · `tabibi-2fa.js` · `tabibi-pii-migration.js` |
| **Communication** | `tabibi-sms.js` *(désactivé)* · `tabibi-brevo.js` *(appelle une edge inexistante)* · `tabibi-messaging.js` · `tabibi-reviews.js` |
| **Mesure** | `tabibi-sentry.js` · `tabibi-analytics.js` · `tabibi-pixel.js` · `tabibi-cookies.js` |
| **Natif / PWA** | `capacitor-bridge.js` (23 Ko) · `tabibi-push-init.js` (enregistrement du jeton, pages du bundle mobile) · `tabibi-bridge.js` · `tabibi-sw-register.js` |
| **Divers** | `home-app.js` (124 Ko) · `tabibi-beta.js` · `tabibi-legal-version.js` · `tabibi-seo-anonymize.js` · `payments.js` *(stub)* |

Ces modules communiquent par des **globales** (`window.TABIBI_CONFIG`, `window.tabibi`,
`window.supabase`, `window.TABIBI_FEATURES`). L'ordre de chargement est donc significatif :
c'est pourquoi les points d'entrée Vite (`src/entries/`) conservent l'ordre relevé sur la page.

### 5.3 Styles

`css/tabibi-ui.css` (historique) et `styles/` : `tokens-v2.css` + `components-v2.css`
(design system v2), `components.css`, `app.css`, `auth.css`, `auth-page.css`.

**Migration v2 à ~13 %** : 31 pages en v1 seul, 3 pages chargent les deux.

**Couleurs de marque, figées** : or `#d4a437` (accent) · vert `#0F7560` (natif, splash,
status bar) · gris `#556070` (texte). Tokens dans `brand/DESIGN_TOKENS_v2.json`.

Cible d'accessibilité **AA**, non atteinte : 179 boutons icône sans `aria-label`, 41 champs
sans label. Lighthouse : Performance 67, A11y 85, Best Practices 92-100, SEO 100.

### 5.4 Internationalisation

Trois langues : **fr** (référence juridique), **ar** (RTL complet), **en**. Depuis le 09/09/2026 les
dictionnaires sont **découpés par langue** dans `js/i18n/{fr,ar,en}.js` (source de vérité, 1 503 clés
chacun, parité vérifiée en CI par `scripts/i18n-verifier.mjs`). `js/tabibi-prelang.js` pré-charge la
langue courante ; `js/tabibi-i18n.js` (runtime) l'insère à sa propre position et charge à la demande
une autre langue lors d'un changement en place. Avant : 356 Ko avec les trois langues sur 47 pages.
Huit dictionnaires locaux subsistent (agenda, sidebar, nav, footer, cookies, beta, reviews, brevo) et
`home-app.js` porte le sien.

> ⚠️ Les clés `month_*` et la table `_AR_MONTHS` de `reservation.html` sont des **noms de mois**,
> pas des dates de lancement. Un `grep` sur « septembre » les remonte : les modifier afficherait
> un mauvais mois sur tous les rendez-vous.

### 5.5 PWA et service worker

`manifest.json` + `sw.js` : HTML en *network-first*, assets en *cache-first*, Supabase en bypass.
Version **v38** (09/09/2026), portée par `const CACHE_VERSION` — **l'en-tête du fichier ne fait pas autorité**
(il a annoncé « v18 » pendant dix-neuf incréments).

Deux limites : le service worker n'est enregistré que depuis `index.html` alors qu'une trentaine
de pages déclarent le manifeste ; et `tabibi-sw-register.js` se désactive sur `localhost`, qui est
justement l'origine des WebViews Capacitor et Tauri — d'où **0 % d'offline** dans les applications.

---

## 6 — Build, qualité, tests

Chaîne introduite le 09/09/2026. Le dépôt n'avait auparavant **ni bundler, ni linter, ni test exécuté**.

### 6.1 Vite 8 — build multi-pages

`vite.config.mjs`. Vite 8.2.2, bundler **Rolldown** (Rust). Chaque `.html` reste un point d'entrée
autonome : aucune page ne devient une application monopage, aucun framework n'est introduit.

**Migration progressive.** Une page n'est bundlée que lorsque ses `<script src>` classiques ont été
remplacés par **un** point d'entrée `type="module"` dans `src/entries/`. Les pages non converties
traversent le build sans dommage (`vite-plugin-static-copy`). `scripts/vite-convertir-page.mjs`
automatise la conversion d'une page dont aucun script inline ne dépend des globales ; **10 pages
converties** (accueil, 404, offline, about, cas-grave, blog/index, 4 pages légales), chunks partagés
entre pages (`tabibi-i18n`, `tabibi-cookies`, `tabibi-beta`).

| Page convertie | Avant | Après |
|---|---|---|
| `index.html` | 1001 Ko en 29 requêtes · Lighthouse mobile perf **47** (build) | **184 kB de bundle (58 gzip)** · perf **73**, FCP 2,3 s, LCP 4,7 s (titre), a11y 96 |

Ce qui a fait bouger le score, dans l'ordre mesuré : le SDK Supabase en `defer` premier dans `<head>`
(FCP 5,1 → 1,9 s), le bandeau cookies rendu dès l'exécution au lieu de `DOMContentLoaded` et sans son
délai de 800 ms (il était l'élément LCP à 6–7 s), Font Awesome local non bloquant, i18n d'une seule
langue. Mesures locales, serveur compressant, locale fr — la production sert encore « Bientôt disponible ».

**Restent en scripts classiques, volontairement** :

- `js/tabibi-prelang.js` — pose la langue et la direction RTL **avant** le rendu. Différé, la page
  clignoterait en LTR.
- le SDK Supabase — c'est un bundle **UMD**. Importé comme module ESM, il détecte un environnement
  de modules, s'exporte en CommonJS et **n'attache plus `window.supabase`**. Constaté le 09/09/2026 :
  le build passait, la page se chargeait, et le client Supabase était introuvable à l'exécution.

### 6.2 ESLint 9 et le cliquet de dette

`eslint.config.mjs`. Trois règles, chacune adossée à un défaut **compté**, pas à un style :

| Règle | Ce qu'elle ferme | Plafond |
|---|---|---|
| `no-empty` (catch) | 74 blocs `catch {}` dans `js/` le matin → **0** le soir (chacun signale via `window.tabibiErreur`) | 0 |
| `no-restricted-properties` | 58 usages d'`innerHTML` dans `js/` — les interpolations de données base/utilisateur sont échappées (`hEsc`, `window.esc`) | 58 |
| `no-console` | 28 `console.log` résiduels | 28 |
| `no-unused-vars` | 117 → **43** | 43 |
| `no-undef` | erreurs réelles — **bloquantes** | 0 |

`scripts/compter-dette.mjs` pose un **plafond par règle** : la CI échoue si un compteur **monte**.
Passer ces règles en `error` rendrait la CI rouge en permanence sur ~277 points et on prendrait
l'habitude de l'ignorer. Quand une dette baisse, on abaisse le plafond dans le même commit.

> Une première version de la règle `innerHTML` était écrite `object: '*'` — syntaxe invalide :
> **elle ne se déclenchait sur rien**. Vérifiée sur du vrai code (0 détection), corrigée, elle
> remonte les 58 usages réels. Une règle qui ment sur son propre effet est pire que pas de règle.

### 6.3 Tests

| Suite | Outil | Nombre | Durée |
|---|---|---|---|
| Parcours critiques | Playwright 1.63 | **30** (7 tests × 2 profils + pages vitales) | 7,1 s |
| Règles métier v2 | Vitest 3.2.7 | **21** | 0,2 s |

Les tests Playwright ne créent **aucune donnée en base**. Profils : Pixel 5 et Desktop Chrome.
La configuration démarre son propre serveur — auparavant elle exigeait deux terminaux, ce qui est
la raison mécanique pour laquelle ces tests n'avaient **jamais** tourné.

Trois cibles : les sources (défaut), `TABIBI_CIBLE=dist-web` (la sortie de build),
`TABIBI_BASE=https://…` (une production réelle).

### 6.4 Intégration continue

`.github/workflows/verification.yml` — sur chaque PR et sur `main` :

0. **gitleaks** sur tout l'historique — dépôt public, aucun secret ne doit entrer
1. `eslint --quiet` — seules les erreurs réelles bloquent
2. `npm run lint:dette` — la dette ne doit pas augmenter · `npm run i18n:verifier` — parité des dictionnaires
3. `npm run test:e2e` — 30 parcours sur les sources
4. `npm run build`
5. `npm run test:e2e:build` — **les mêmes tests sur la sortie de build**
6. Taille des bundles publiée dans le résumé du run

Job séparé `verifier-v2` : typage strict, tests, build de l'application React.

> L'étape 5 existe parce qu'un build peut casser ce que les sources font marcher — c'est
> exactement ce qui s'est produit le 09/09/2026 avec le SDK Supabase UMD.

`.github/workflows/desktop-release.yml` — sur un tag `desktop-v*`, produit `.dmg`, `.app`, `.exe`
et `.msi` en release **brouillon**, à publier à la main.

`.github/workflows/deploiement.yml` — **préparé, inactif** : il build (`dist-web`), rejoue les 30 tests sur
la sortie et déploie sur Cloudflare Pages à chaque merge sur `main`, **uniquement** si la variable
`DEPLOIEMENT_AUTO=oui` et les secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` sont posés.
Les poser est la décision humaine qui active le déploiement continu. `.github/dependabot.yml` groupe
les mises à jour hebdomadaires (Capacitor, outillage, React).

---

## 7 — Le backend Supabase

Projet `pudugodhiofqrctcdwfl`, région **EU Frankfurt** (choix RGPD).

> ⚠️ **`migrations/` n'est pas le miroir de la base.** Ce sont 41 fichiers SQL joués à la main dans
> le SQL Editor. La source de vérité est `v2/src/lib/database.types.ts`, régénéré par
> `supabase gen types typescript --linked`. `migrations/P1_dump_schema_prod.sql` existe pour
> produire enfin un miroir versionné — **il n'a pas encore été exécuté**.

### 7.1 Tables (55)

| Domaine | Tables |
|---|---|
| **Identité** | `users` · `doctor_profiles` (52 colonnes) · `patient_medical_data` · `two_factor_secrets` |
| **Rendez-vous** | `appointments` (26 colonnes) · `appointment_notifications` · `doctor_schedule` · `doctor_unavailable_slots` · `waiting_list` |
| **Cabinet** | `cabinets` · `cabinet_members` · `claim_requests` |
| **Soins** | `prescriptions` · `prescription_seq_year` · `medical_records` · `video_sessions` |
| **Dawini** | `dawini_requests` · `dawini_responses` · `dawini_zones` · `pharmacies` · `medication_alerts` |
| **Relation** | `conversations` · `messages` · `notifications` · `reviews` · `review_reports` · `favorites` |
| **Référentiel** | `wilayas` · `specialties` |
| **Paiement** | `payments` |
| **API partenaires** | `api_keys` · `api_usage_log` **+ 19 partitions journalières** `api_usage_log_2026MMDD` |
| **Traçabilité** | `audit_log` · `consents_log` · `admin_actions` · `sms_log` · `email_log` · `rate_limits` |
| **Mobile** | `device_tokens` |

### 7.2 Vues (14)

`public_doctors` · `public_doctors_listed` · `doctor_patients_directory` ·
`doctor_ratings_summary` · `doctor_reviews_public` · `cabinet_calendar_view` ·
`cabinet_members_directory_view` · `cabinet_stats_view` · `my_upcoming_appointments` ·
`my_reviewable_appointments` · `my_video_sessions` · `my_two_factor_status` ·
`api_keys_analytics` · `waiting_list_stats`

> **`public_doctors` est la vue publique de référence** : `doctor_profiles` est fermée à `anon`,
> tout listing passe par elle. Elle **ne masque pas les noms** des fiches non revendiquées —
> `COALESCE(NULLIF(TRIM(dp.full_name), ''), 'Praticien')`. Elle masque `address`, `latitude` et
> `longitude`, rien d'autre. Une note contraire de `PROGRESS.md` était fausse : c'est ce qui a
> imposé l'anonymisation au niveau du générateur SEO ([§10](#10--seo)).

### 7.3 Fonctions (70 dans le schéma exposé)

| Famille | Fonctions |
|---|---|
| **Rendez-vous** | `get_available_slots` · `is_doctor_bookable` |
| **Profil médecin** | `get_my_doctor_profile` · `update_my_doctor_profile` · `current_doctor_profile_id` · `doctor_set_ordre_number` · `check_doctor_account_exists` |
| **Cabinet** | `get_my_cabinets` *(critique : porte l'espace secrétariat)* · `create_cabinet` · `invite_cabinet_member` · `accept_cabinet_invitation` · `remove_cabinet_member` · `transfer_cabinet_ownership` · `is_cabinet_owner/admin/doctor/secretaire` · `is_member_of_cabinet` |
| **Administration** | `admin_validate_doctor` · `admin_validation_list/counts/total` · `admin_doctor_doc_paths` · `is_admin` · `current_user_role` |
| **Données médicales** | `get_patient_medical_data` · `upsert_patient_medical_data` |
| **Dawini** | 13 fonctions (`dawini_create_request`, `dawini_respond`, `dawini_shortage_by_wilaya`, `dawini_top_missing`, `dawini_zone_active`, normalisation…) |
| **Téléconsultation** | `create_video_session` · `get_video_session` · `mark_video_session_started/ended` · `set_video_recording_consent` |
| **API partenaires** | `generate_api_key_pair` · `rotate_api_key` · `revoke_api_key` · `verify_api_key` · `log_api_call` · `check_api_rate_limit` · `api_usage_log_ensure_partition` |
| **2FA** | `enroll_two_factor` · `disable_two_factor` |
| **PII** | `tabibi_pii_encrypt` · `tabibi_pii_decrypt` · `tabibi_pii_key` |
| **Ordonnances** | `next_prescription_number` |
| **Conformité** | `record_consent` |
| **Infra** | `fn_check_rate_limit` · `fn_cleanup_old_logs` · `unaccent` · `show_trgm` |

**Enums (9)** : `user_role` · `user_sex` · `user_locale` · `phone_type` ·
`doctor_validation_status` · `payment_method` · `payment_status` ·
`dawini_request_status` · `dawini_response_status`

### 7.4 RPC appelées par le front — 39, dont 6 à vérifier

Six RPC appelées par le code **n'apparaissent pas** dans le schéma exposé :

| RPC | Appelée par | État vérifié |
|---|---|---|
| `claim_my_doctor_profile` | `js/tabibi-claim.js` | ✅ **Existe** — testée en production le 09/09/2026 : renvoie `P0001 Non authentifié`, donc la fonction est bien là avec sa garde interne. Absente des types générés : tout code TypeScript qui l'appelle ne compilera pas |
| `create_prescription_draft` | `medecin-ordonnance.html` | 🔴 Absente (vérifié contre `pg_proc` le 29/07/2026) |
| `update_prescription_draft` | `medecin-ordonnance.html` | 🔴 Absente |
| `request_prescription_signature` | `medecin-ordonnance.html` | 🔴 Absente |
| `mark_prescription_delivered` | `patient-ordonnances.html` | 🔴 Absente |
| `validate_cabinet_invitation` | `signup.html` | ⚠️ **Indéterminé** — absente des types générés, mais la sonde sans argument n'est pas concluante |

> **Précaution de méthode.** Une sonde `POST /rest/v1/rpc/<fn>` avec un corps vide renvoie
> `PGRST202` dès qu'aucune surcharge ne correspond aux arguments fournis : `get_available_slots`,
> qui existe pourtant, répond exactement comme une fonction absente. **L'absence d'une fonction
> des types générés ne prouve pas son absence en base** — seul un contrôle sur `pg_proc` tranche.

Les 4 RPC d'ordonnances cassent deux pages. Elles sont neutralisées par le flag
`prescriptions: false`, qui masque les boutons plutôt que de laisser échouer un `PGRST202`
en erreur générique.

### 7.5 Edge Functions (Deno)

| Fonction | Déployée | `verify_jwt` | Rôle |
|---|:---:|:---:|---|
| `send-sms` | ✅ | `false` | **Hook Auth signé** — OTP via BudgetSMS. ⚠️ Le modifier casse le login de tout le monde |
| `appointment-reminders` | ✅ | défaut | Rappels SMS en 3 passes : `j1` [now+6 h, now+24 h], `h2` [now+90 min, now+150 min], `confirmation` (draine l'outbox). Anti-doublon par index unique `(appointment_id, kind)`. Kill-switch `REMINDERS_ENABLED=false` |
| `verify-turnstile` | ✅ | défaut | Captcha serveur du formulaire de liste d'attente. CORS en allowlist. *Fail-closed* |
| `sms-dlr` | ✅ | `false` | Accusés de livraison BudgetSMS. Depuis le 09/09 (code, **non déployé**) : met à jour `sms_log` par `provider_msg_id`, ne crée jamais de ligne depuis un DLR. Aucune authentification possible : BudgetSMS n'en offre pas |
| `send-whatsapp` | ❌ dort | défaut | Meta Cloud API, templates pré-approuvés. Attend la vérification du compte Business |
| `whatsapp-webhook` | ❌ dort | `false` | Statuts WhatsApp. Vérification `X-Hub-Signature-256` écrite mais désactivée tant que `WA_APP_SECRET` n'est pas posé |
| `send-email` | 🔴 **n'existe pas** | — | Appelée par `js/tabibi-brevo.js:619` → tout envoi e-mail échoue. Canal abandonné (décision SMS-only) |

### 7.6 Triggers et planification

- `tg_notify_appointment` — `AFTER INSERT/UPDATE` sur `appointments` : produit `rdv_new` (médecin),
  `rdv_confirmed` et `rdv_cancelled` (routées par `auth.uid()`).
- Trigger de confirmation — dépose une ligne `kind='confirmation'` dans l'outbox au passage
  `status → confirmed`.
- **`pg_cron` jobid 2**, toutes les 15 minutes → `appointment-reminders`.
- `api_usage_log_ensure_partition` — crée les partitions journalières de `api_usage_log`.

---

## 8 — Fonctionnalités — état réel

Source unique : `js/tabibi-features.js`. Le flag pilote l'affichage via `data-feature="…"`.
Override QA : `localStorage.setItem('tabibi_features_override', '{"video":true}')`.

| Fonctionnalité | Flag | Front | Backend | Verdict |
|---|:---:|:---:|:---:|---|
| Recherche + fiche praticien | — | ✅ | ✅ | **En service** |
| Prise de RDV bout-en-bout | — | ✅ | ✅ | **En service** — calendrier 90 j, TZ `Africa/Algiers`, anti-chevauchement en base |
| Rappels SMS J-1 / H-2 | — | — | ✅ | **En production**, envoi réel prouvé le 29/07/2026 |
| Notifications in-app | `notifications: true` | ✅ | ✅ | **En service** |
| Dawini | `dawini: true` | ✅ | ✅ | **En service** — activation par wilaya |
| Claim de fiche | — | ✅ | ✅ | **En service** — 0 fiche revendiquée à ce jour |
| Espace secrétariat / cabinet | — | ✅ | ✅ | **En service** |
| API partenaires | — | ✅ | ✅ | Clés, rotation, révocation, quotas, partitions de log |
| Sentry | `sentry: true` | ✅ | — | **Actif sur 27 pages** (mesuré le 09/09/2026 ; un commentaire de `tabibi-features.js` annonce 28). ⚠️ Le flag n'est lu par personne : `tabibi-sentry.js` s'active sur la seule présence d'un DSN |
| Ordonnances | `prescriptions: false` | ✅ | 🔴 4 RPC absentes | **Masquée** |
| Messagerie | `messaging: false` | ✅ | ✅ | **Masquée** — pages non testées |
| Avis | `reviews: false` | ✅ | partiel | **Masquée** |
| Téléconsultation | `video: false` | ✅ | ✅ **RPC présentes** | **Masquée — décision produit, plus un blocage technique** |
| Paiements | `payments: false` | stub | table `payments` seule | **Masquée** — `payment.html` orpheline, pas de sandbox SATIM stable |
| Statistiques médecin | `doctorStats: false` | factice | ❌ | **Masquée** — la page affichait des chiffres écrits en dur |
| Analytics Plausible | `analytics: false` | ✅ | ❌ | **Masquée** — compte non créé |

---

## 9 — Les trois clients

### 9.1 Application mobile — Capacitor 8

| | |
|---|---|
| `appId` / `appName` | `dz.tabibi.app` / **Tabibi** |
| Android | `versionCode 4` · `versionName 1.0.2` · `minSdk 26` (Android 8) · `compile/targetSdk 36` |
| iOS | `MARKETING_VERSION 1.0` · `CURRENT_PROJECT_VERSION 1` · **jamais compilé** |
| Binaires | APK 9,1 Mo + AAB 8,1 Mo signés, produits le 31/08/2026 |
| Distribution | **Téléchargement direct** d'un APK depuis Supabase Storage. Ni Play Store, ni App Store |
| Plugins | 16 : camera, geolocation, push, local-notifications, preferences, share, splash, status-bar, keyboard, browser, app-launcher… |

**Bundle en liste blanche stricte** (`scripts/build-mobile.sh`) : 27 pages grand public, 8 dossiers.
Des garde-fous font **échouer le build** si `seo/`, `scripts/`, `api/` ou une page pro/admin
réapparaît — l'APK de juillet embarquait la console d'administration.
**L'espace médecin n'est pas dans l'app : c'est un choix, il vit dans le desktop Tauri.**

Deep links : schéma `com.tabibi.doctor://` + App Links HTTPS sur `reset-password.html`,
`verify-email.html`, `email-verified.html`.

**Quatre points ouverts**

1. 🔴 **La clé de signature n'a aucune sauvegarde hors machine** — les deux copies sont sur le même
   disque. SHA-256 de la vraie clé : `1957fe12…` ; le fichier « BACKUP » de `COPIE-2-SECURITE`
   (`952590eb…`) **n'est pas** cette clé. Script prêt : `scripts/sauvegarder-keystore.sh`.
2. 🔴 **iOS** : pas de Xcode, aucun `DEVELOPMENT_TEAM`, pas de D-U-N-S (2 à 4 semaines), pas d'APNs.
3. ✅ *(corrigé le 09/09)* Le push n'enregistrait aucun jeton : le déclencheur était sur
   `doctor-dashboard.html`, page absente du bundle. `js/tabibi-push-init.js` est chargé par
   `patient-dashboard.html` et l'accueil, et câble `onPushNotification()`.
4. 🟠 **Captcha en WebView iOS** : `capacitor.config.ts` passe iOS en `scheme: 'https'` (origine
   `https://localhost`, comme Android). **À valider sur un vrai iPhone** — aucun build iOS n'existe.
5. ✅ *(corrigé le 09/09)* `allowBackup="false"` + règles d'extraction Android 12+ et < 12.

### 9.2 Tabibi Pro — logiciel de cabinet (Tauri)

`desktop/` produit **Tabibi Pro** (`doctor.tabibi.pro`, v0.1.0), fenêtre 1440×900, catégorie
Medical. `build-dist.sh` construit un bundle **pro** de 17 pages — l'inverse du bundle mobile.

Ouvert : **aucun auto-update** (pas de `tauri-plugin-updater`, pas de `latest.json`), builds
**non signés** (Gatekeeper et SmartScreen alertent), 6 pages en colonne mobile faute de media
query ≥ 1024 px.

### 9.3 v2 — application React

Refonte progressive qui **cohabite** avec la production : même projet Supabase, même domaine, donc
même `localStorage` et **même session**. Pas de page de login en v2 : en production elle renvoie
vers `login.html` de la v1.

| | |
|---|---|
| React | **19.2.8** |
| Vite | **8.2.2** (Rolldown) |
| Router | **react-router 7.18.3** |
| Données | **TanStack Query 5.102.8** |
| supabase-js | **2.116.0** — même version que le SDK auto-hébergé de la v1 |
| TypeScript | **5.9.3**, mode strict |
| Tests | **Vitest 3.2.7** — 21 tests |
| Build | 492 kB / **142 kB gzip** |

**Structure** — `src/domaine/` : règles métier **pures**, sans React ni réseau, entièrement
testées · `src/donnees/` : TanStack Query, **aucune erreur avalée** · `src/pages/` : les écrans ·
`src/lib/database.types.ts` : **4 513 lignes générées depuis la production**.

**Les types écrits à la main étaient faux.** Confrontés au schéma réel, le compilateur l'a dit
littéralement :

```
TS2352: SelectQueryError<"column 'nom' does not exist on 'doctor_profiles'.">
```

La v2 lisait `nom, prenom, specialite, wilaya` : **aucune de ces quatre colonnes n'existe**.
Les vraies sont `full_name`, `full_name_ar`, `specialty_raw`, `wilaya_code`.

**Ordre de migration** : agenda médecin *(fait)* → dashboard médecin → réservation patient.
**Les pages publiques et les 576 pages SEO ne seront pas migrées** : elles sont rapides et
ramènent du trafic gratuit.

---

## 10 — SEO

576 pages locales dans `seo/`, du type `alger-cardiologue.html`, générées par
`scripts/generate-seo-pages.mjs`. Plus 6 articles de blog, 3 sitemaps, `robots.txt`,
données structurées Schema.org.

**Anonymisation totale, imposée au générateur.** Les pages d'avant août 2026 affichaient
891 patronymes réels de praticiens qui n'avaient rien accepté. Le script n'écrit désormais
**aucun nom** — uniquement des agrégats (comptages, répartition par commune), qui ne sont pas
des données à caractère personnel. Deux affirmations fausses ont été retirées au passage
(« N praticiens certifiés », « Tous certifiés Tabibi ») : au 06/08/2026, `is_verified` = 0 et
`is_claimed` = 0 sur 75 034 fiches.

`functions/seo/[[path]].js` est une **barrière** : la couche d'assets de Cloudflare Pages a
continué de servir des pages supprimées, y compris depuis l'intérieur d'une Pages Function.

---

## 11 — Intégrations tierces

| Service | Usage | État |
|---|---|---|
| **Supabase** | Base, auth, stockage, edge functions, cron | ✅ production |
| **Cloudflare Pages** | Hébergement + Pages Functions | ✅ production |
| **Cloudflare Turnstile** | Captcha, vérifié côté serveur | ✅ site key `0x4AAAAAADR6IhCWO9RLIipE` |
| **BudgetSMS** | OTP + rappels de RDV | ✅ production, expéditeur `Tabibi` |
| **Sentry** | Erreurs front, région EU | ✅ actif sur 28 pages |
| **Meta Pixel** | Acquisition — **chargé après consentement seulement** | ✅ câblé |
| **Font Awesome 6.4.0** | Icônes — **auto-hébergé**, chargé en `preload` non bloquant (48 pages) | ✅ plus aucune dépendance cdnjs |
| **Leaflet + OpenStreetMap** | Cartographie, auto-hébergé | ✅ |
| **OpenRouteService** | Itinéraires | ✅ autorisé en CSP |
| **Meta WhatsApp Cloud API** | Canal WhatsApp | ⏸ code prêt, attend la vérification Business |
| **Firebase / FCM** | Push Android | ⏸ `google-services.json` absent |
| **Daily.co** | Téléconsultation | ⏸ front câblé, RPC présentes, flag `video: false` |
| **Brevo** | E-mails transactionnels | 🔴 l'edge `send-email` n'existe pas — canal abandonné |
| **Stripe / SATIM** | Paiement | ❌ table `payments` seule, aucun backend |
| **Plausible** | Analytics | ❌ compte non créé |

---

## 12 — Sécurité

### 12.1 Authentification et rôles

Supabase Auth, par **e-mail** ou par **téléphone (OTP SMS)**. Rôles et atterrissages
(`js/config.js`) : `patient` → `patient-dashboard.html` · `doctor`/`medecin` →
`doctor-dashboard.html` · `admin` → `admin-dashboard.html` · `pharmacie` → `dawini-pharmacie.html`.

Le secrétariat n'est pas un rôle d'authentification : c'est une appartenance à un cabinet,
résolue par `get_my_cabinets`.

Durcissement actif : mots de passe vérifiés contre **HIBP**, longueur minimale 8, **comptes
anonymes désactivés**, confirmation d'e-mail active, branche `main` protégée.

### 12.2 RLS

**94 policies**, toutes scopées par `auth.uid()`. `doctor_profiles` est **fermée à `anon`**
(`REVOKE SELECT`) : tout listing public passe par `public_doctors`.

> ⚠️ **Le piège qui vide un agenda sans lever d'erreur.** `appointments.doctor_id` référence
> `doctor_profiles.id`, **pas** `auth.uid()` — mais d'anciennes lignes utilisent quand même
> `auth.uid()`, et `prescriptions` comme `doctor_schedule` comparent `doctor_id = auth.uid()`.
> `js/tabibi-agenda.js` et `v2/src/domaine/agenda.ts` interrogent donc **les deux** espaces
> d'identifiants. Ne pas « simplifier » sans vérifier en base avec un vrai compte médecin.
> Contrôle prêt : `migrations/P1_test_coherence_doctor_id.sql`.

### 12.3 Les cinq vulnérabilités critiques — toutes fermées

| ID | Sujet | État | Preuve |
|---|---|---|---|
| **CRIT-1** | Isolation RLS entre utilisateurs | ✅ fermé | Aucune fuite. Test A↔B avec `service_role` **encore à faire** |
| **CRIT-2** | Pages accessibles sans session | ✅ fermé | 5 pages testées, aucune PII rendue |
| **CRIT-3** | Mass assignment `update_my_doctor_profile` | ✅ mitigé | RPC sans auth → 401 ; test post-auth médecin à faire |
| **CRIT-4** | `doctor_profiles` exposait e-mail, téléphone, chemins de documents à `anon` | ✅ fermé | `GET /rest/v1/doctor_profiles` → **HTTP 401** |
| **CRIT-5** | Inscription sans captcha par REST | ✅ fermé le 29/07/2026 | `POST /auth/v1/signup` sans `captcha_token` → **400 `captcha_failed`**, sur e-mail **et** téléphone |

### 12.4 Chaîne d'approvisionnement — fermée le 09/09/2026

38 pages chargeaient le SDK Supabase depuis un CDN via un tag **flottant** (`@supabase/supabase-js@2`).
Trois défauts mesurés le jour même :

1. **La version changeait sans commit.** Le tag `@2` servait **2.116.0** en production, pendant que
   `v2/package-lock.json` résolvait 2.115.0 et que `admin-api-keys.html` épinglait **2.39.0** —
   trois clients Supabase dans un même produit, dont un à 77 versions de retard.
2. **Aucune intégrité posable.** jsdelivr écrit en tête de ses fichiers auto-minifiés :
   *« Do NOT use SRI with dynamically generated files »*.
3. **Point de défaillance unique, hors d'Algérie.** Les bundles mobile et desktop copient `assets/`
   mais allaient chercher ce script **sur le réseau à chaque démarrage** : CDN injoignable =
   client Supabase impossible à créer = application morte, même sur un écran déjà en cache.

Le SDK est désormais auto-hébergé dans `assets/vendor/supabase/`, version dans le nom du fichier.
`cdn.jsdelivr.net` retiré de `script-src` dans `_headers` **et** `netlify.toml`.

> Au passage : **`admin-api-keys.html` n'avait jamais fonctionné en production**. Elle importait le
> SDK depuis `esm.sh`, hôte **absent** de la liste `script-src` → module bloqué par la CSP. Et même
> sans CSP, elle lisait `window.__SUPABASE_URL__`, une variable qu'aucun fichier du dépôt ne définit.

### 12.5 Fonctions `SECURITY DEFINER` exposées à `anon`

7 fonctions sensibles sont exécutables par `anon` — **toutes portent leur propre garde interne**
(`is_admin()` pour les 5 fonctions d'administration, `auth.uid()` + filtre sur `patient_id` pour
les 2 fonctions de données médicales). Verdict de l'audit : **safe**, aucun correctif urgent.

Rappel du modèle : dans Supabase, `anon` est le rôle de **toute** requête venant du navigateur,
y compris avant que le JWT d'une session valide ne soit appliqué. Un `GRANT` à `anon` n'est donc
pas en soi une faille — ce qui compte est la garde interne.

Recommandation ouverte (SQL prêt dans `docs/SECURITY_RPC_AUDIT.md`) : retirer `EXECUTE` à `anon`
pour ne plus dépendre d'une **seule** ligne de défense.

### 12.6 Mécanismes présents en base mais **inutilisés par le code**

Découverts le 09/09/2026 en croisant les types générés et le dépôt. Aucun de ces éléments n'est
référencé nulle part dans `js/`, les pages ou les migrations :

| Mécanisme | Ce qui existe en base | Constat |
|---|---|---|
| **Chiffrement PII** | `tabibi_pii_encrypt` · `tabibi_pii_decrypt` · `tabibi_pii_key` + colonnes `appointments.diagnostic_enc` et `notes_medecin_enc` | **0 référence** dans le dépôt. Les notes médicales et diagnostics ne sont donc pas chiffrés par le produit, alors que le mécanisme est prêt |
| **2FA serveur** | table `two_factor_secrets` · `enroll_two_factor` · `disable_two_factor` · vue `my_two_factor_status` | **0 référence.** `js/tabibi-2fa.js` implémente un TOTP RFC 6238 **maison**, sans utiliser ce dispositif : deux mécanismes concurrents, un seul utilisé |
| **Journal de consentement** | table `consents_log` · `record_consent` | **0 référence** — alors que 4 cases de consentement RGPD existent sur `signup.html` |
| **Limitation de débit** | table `rate_limits` · `check_api_rate_limit` · `fn_check_rate_limit` | **0 référence** hors API partenaires |
| **Journal d'audit** | table `audit_log` | **0 référence** |

> Ce n'est pas une faille, mais un **écart entre ce que la base sait faire et ce que le produit
> utilise**. Sur une plateforme de santé, le chiffrement des notes médicales et le journal de
> consentement sont les deux plus coûteux à laisser dormants — le premier pour la confidentialité,
> le second pour la preuve en cas de contrôle ANPDP.

### 12.7 En-têtes HTTP

Définis dans `_headers` (Cloudflare) **et** `netlify.toml` (previews) — toute évolution de CSP
doit être faite **dans les deux**.

`Strict-Transport-Security` (1 an, `preload`) · `X-Frame-Options: DENY` ·
`X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` ·
`Cross-Origin-Opener-Policy: same-origin` · `Cross-Origin-Resource-Policy: same-origin` ·
`Permissions-Policy` (géoloc, caméra, micro, paiement limités à `self` ; USB, Bluetooth et
capteurs coupés) · **CSP** avec `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `upgrade-insecure-requests`.

`img-src` est restreint aux 5 hôtes réellement référencés (Supabase Storage, tuiles OSM, QR, Unsplash,
Facebook) au lieu de `https:` ; `cdn.jsdelivr.net` et `cdnjs.cloudflare.com` ne figurent plus nulle part.

> ⚠️ La CSP contient encore **`script-src 'unsafe-inline'`**, et ne peut pas s'en passer : les
> pages contiennent 62 Ko (`patient-dashboard`), 58 Ko (`doctor-dashboard`) et 35 Ko
> (`medecin-profile`) de JavaScript **inline**. La faiblesse de la CSP est donc la conséquence
> directe d'un choix d'architecture, pas un oubli de configuration. La conversion Vite page par
> page est ce qui permettra de la retirer.

`_redirects` renvoie un **404 explicite** sur `/supabase/*`, `/migrations/*`, `/desktop/*` et
`/.git/*` : la purge au build les retire déjà, mais l'apex a continué de servir
`/supabase/functions/send-sms/index.ts` en 200 après un déploiement où le fichier était absent.

### 12.8 Secrets

- **Publiques, donc dans le dépôt sans risque** : URL Supabase, clé `anon` (protégée par la RLS),
  site key Turnstile, DSN Sentry.
- **Jamais dans le dépôt** : `service_role`, `TURNSTILE_SECRET_KEY`, identifiants BudgetSMS,
  `WA_TOKEN`, `WA_APP_SECRET`, `google-services.json`, `*.jks`, `keystore.properties`.
- Le `.gitignore` bloque aussi les **CSV de PII** (`medecins*.csv`, `prospects*.csv`,
  `data/private/**`), les dumps de base et les binaires mobiles (`*.apk`, `*.aab`).

### 12.9 Points ouverts

| Priorité | Point | Préparé |
|---|---|---|
| 🔴 P0 | Clé de signature Android sans sauvegarde hors machine | `scripts/sauvegarder-keystore.sh` |
| 🔴 P0 | Deux comptes-sonde toujours en production | `migrations/P0_purge_comptes_sonde.sql` |
| 🔴 P0 | Mot de passe d'un compte de test en clair dans l'historique git **public** | Devient sans objet si `PURGE_comptes_test.sql` est lancé — il supprime ce compte |
| 🔴 P0 | RPC `match_doctor_for_claim` exposée à `anon`, jamais appelée | `migrations/P0_revoke_match_doctor_for_claim.sql` |
| 🟠 P1 | `TURNSTILE_SECRET_KEY` pas à jour → liste d'attente en fail-closed | Procédure dans `A_FAIRE_AGHILES.md` |
| 🟠 P1 | Schéma de production non versionné | `migrations/P1_dump_schema_prod.sql` |
| 🟠 P1 | Notes médicales non chiffrées alors que le mécanisme existe | §12.6 |
| 🟠 P1 | `sms_log` jamais alimentée → code écrit dans `send-sms` et `sms-dlr` (09/09), **déploiement à valider** | `supabase functions deploy` |
| 🟠 P1 | API partenaires sans surface HTTP (404), partitions de log arrêtées le 02/06 | décision : servir ou retirer |
| ✅ | `?demo=1` — restreint aux hôtes de développement/preview le 09/09 | — |
| 🟡 P2 | `security_invoker` non vérifié sur `public_doctors` | — |
| 🟡 P2 | `sms-dlr` accepte de faux accusés de livraison | Sans gravité tant qu'il ne fait que journaliser |

---

## 13 — Déploiement

> ### ⚠️ Le projet Cloudflare Pages n'a AUCUNE connexion Git.
> **Merger une PR sur `main` ne déploie rien.** Chaque mise en production est un
> `wrangler pages deploy` lancé à la main. Erreur déjà commise le 03/09/2026 : une heure perdue
> à chercher un problème de cache inexistant. Procédure : `DEPLOY_FRONTEND.md`.

Netlify ne sert **que** les previews de PR. Ce n'est pas la production.

```bash
git archive …                              # 1. export du CONTENU VERSIONNÉ, filtré par .gitattributes
rm -rf <dossiers non-web>                  # 2. purge, chemins ANCRÉS obligatoires
bash scripts/check-deleted-public-files.sh # 3. sortie 2 = suppressions publiques à justifier
npx wrangler pages deploy …                # 4. déploiement
```

**Les trois barrières** : `.gitattributes export-ignore` · la purge au build ·
`functions/*/[[path]].js` + `_redirects` (404 au routage, indépendants de toute propagation).

**La règle qui en découle : remplacer, jamais supprimer.** La couche d'assets de Cloudflare Pages
a servi des fichiers supprimés du déploiement, pour l'URL exacte sans query string, y compris
depuis l'intérieur d'une Pages Function via `context.next()`. Ni le cache de zone, ni un Worker,
ni le service worker : « Purge Everything » n'y peut rien.

**Vérification après déploiement** — les 3 hôtes (apex, www, `*.pages.dev`) sur 5 colonnes.
Attendu : `send-sms=404`, `openapi=200`, `migrations=404`, `desktop=404`, `sw=` la version de `main`.

```bash
curl -s https://tabibi.doctor/sw.js | grep CACHE_VERSION
```

---

## 14 — Conventions de travail

Règles complètes dans `CLAUDE.md`. En résumé :

1. **Jamais de commit ou de push direct sur `main`** — branche protégée. Branche + PR.
2. **Jamais de merge en production sans validation humaine explicite.**
3. **Toute action destructive en base** (`DELETE`, `DROP`, `REVOKE`, `UPDATE` massif) → s'arrêter,
   proposer le SQL avec garde-fou (`WHERE` ciblé + `RETURNING`), ne pas l'exécuter seul.
4. **Aucun secret** loggé, écrit sur disque ou committé.
5. **Rien n'est validé sans preuve empirique** : sortie de base réelle, réponse HTTP, run
   navigateur, score mesuré. Jamais « ça devrait marcher ».

Branches `feat/` `fix/` `chore/` `docs/` `perf/` `hotfix/` · commits en français, sans accent dans
le titre · migrations préfixées par leur phase (`PHASE16_`, `CRIT-4_`, `P0_`, `P1_`, `DAWINI_`).

**Trois paires de noms à ne pas confondre** : `doctor-profile.html` (fiche **publique**) vs
`medecin-profile.html` (édition **privée**) · `send-sms` (hook OTP) vs `appointment-reminders`
(rappels) · `scheduled_at` (NOT NULL, fait autorité) vs `starts_at` (nullable).

---

## 15 — Dette technique mesurée

Compteurs relevés le 09/09/2026, reproductibles par `npm run lint:dette`.

| Compteur | Valeur | Effet |
|---|---:|---|
| Blocs `catch {}` dans `js/` | ~~74~~ **0** | Chaque `catch` signale via `window.tabibiErreur` (Sentry quand présent) |
| idem, JS inline des pages | **~99** | Restent dans les `<script>` inline des pages — chantier suivant |
| `innerHTML` dans `js/` | **58** usages, **0** interpolation de donnée non échappée | Les données base/utilisateur passent par `hEsc` / `window.esc` |
| `console.log` résiduels | **28** | |
| Boutons icône seuls sans `aria-label` | ~~179~~ **0** | 12 étiquetés ; les 167 autres avaient déjà un texte visible |
| Champs sans label ni `aria-label` | ~~41~~ **0** | 44 depuis le placeholder, 17 à la main |
| Pages non converties à Vite | ~~44~~ **35 / 45** | 10 converties (`scripts/vite-convertir-page.mjs`) ; les 35 restantes ont du JS inline dépendant des globales — lecture page par page |
| i18n chargé par page | ~~356 Ko~~ **72 Ko** (fr) | Une seule langue, préchargée |
| `onclick=` inline | **389** | Ce qui impose `'unsafe-inline'` |
| Migration CSS v2 | **13 %** | 31 pages en v1, 3 pages chargent les deux |
| Pages orphelines | **2** | `payment.html`, `verify-prescription.html` — 0 lien entrant |
| `TODO` / `FIXME` | **39** | |

**Chantiers restants, par valeur décroissante** : conversion des 44 pages restantes à Vite (méthode
validée) · migration des 389 `onclick` puis CSP sans `unsafe-inline` · les ~99 `catch` vides du JS inline ·
activer `deploiement.yml` (secrets) · déployer `send-sms`/`sms-dlr` · auto-update Tauri · chiffrement des
notes médicales (§12.6) · sprite SVG à la place de Font Awesome · décision API partenaires.

---

## 16 — Documentation du projet

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | **Règles de travail** — à lire avant toute intervention |
| `A_FAIRE_AGHILES.md` | Les 4 actions qui exigent une intervention humaine, préparées |
| `AUDIT_ET_MIGRATION_2026-09-09.md` | 26 problèmes chiffrés + plan de migration technologique |
| `AUDIT_PROFOND_2026-09-09.md` | Second passage : 12 découvertes (API fantôme, APK 1.0.1 servi, config CLI bloquante…), corrections, technologies révisées |
| `DOSSIER_TABIBI_2026-09-08.md` | État complet : disque, produit, mobile, plan ordonné |
| `DEPLOY_FRONTEND.md` | Runbook Cloudflare + post-mortem de la couche d'assets |
| `DEPLOY_RAPPELS.md` | Runbook des rappels SMS |
| `AUDIT_RESTANT_2026-07-29.md` | Registre de dette trié P0 → P3, avec preuves |
| `ETAT_DES_LIEUX.md` | Audit du 25/07 — **partiellement périmé** (la note CRIT-5 notamment) |
| `PROGRESS.md` | Journal des 13 phases depuis mai 2026 |
| `SQL_TODO.md` · `KNOWN_ISSUES.md` | Dette SQL · anomalies connues |
| `docs/INDEX.md` | Index des 35 documents recensés (légal, contrats, guides, ops, marketing) |
| `docs/RPC_INVENTORY.md` | Les RPC du front confrontées à `pg_proc` en production |
| `docs/SECURITY_RPC_AUDIT.md` | Audit des fonctions `SECURITY DEFINER` exposées à `anon` |
| `docs/PROD_SEEDS_REGISTRY.md` | Registre des seeds appliqués en production |
| `docs/mobile/` | 7 documents : setup, build, déploiement, Firebase, push, tests, anomalies |
| `docs/WHATSAPP_ACTIVATION.md` | Procédure d'activation du canal WhatsApp |
| `docs/NOTE_CADRAGE_AVOCAT.md` | Note de cadrage pour la validation juridique |
| `assets/vendor/supabase/README.md` | Pourquoi le SDK est auto-hébergé, et comment le mettre à jour |
| `v2/README.md` | Pourquoi la refonte React cohabite au lieu de remplacer |

> Les 11 documents de `docs/legal/` et `docs/contrats/` sont en **DRAFT**, en attente de validation
> par un avocat algérien. Aucun ne doit être utilisé contractuellement en l'état.

---

## Contacts

- **Gérant / DPO** — Aghiles Haddadene · aghiles@tabibi.doctor
- **Standard** — contact@tabibi.doctor
- **WhatsApp** — +213 777 169 074
- **Site** — https://tabibi.doctor
