# AUDIT — Ce qui reste à coder (29 juillet 2026)

Audit du code réel (pas de suppositions) : chaque ligne porte une preuve `fichier:ligne`.
Référentiels : `CLAUDE.md`, `PROGRESS.md` (36 cases ouvertes), `SQL_TODO.md`, `ETAT_DES_LIEUX.md`.
Base : `main` après merge des PR **#16** et **#17** (Phase 3 desktop intégrée).

> ⚠️ **Caveat méthodologique** — `migrations/` n'est PAS un miroir de la base de production
> (32 fichiers SQL manuels marqués « non auto-run », cf. `migrations/PUSH_step1_device_tokens.sql:9`).
> Les points marqués ⚠️ ne peuvent être tranchés qu'en base live.

---

## Corrections apportées à l'audit initial

| Point | Ancienne conclusion | Constat vérifié le 29/07 |
|---|---|---|
| Desktop non poussé | « 18 commits bloqués en local » | **FAIT** — PR #16 (`7f7d22e`) et #17 (`5a03f35`) mergées ; `js/tabibi-header.js`, `js/tabibi-nav.js`, `js/tabibi-agenda.js`, `js/tabibi-platform.js`, `js/tabibi-pro-sidebar.js`, `agenda-cabinet.html`, `desktop/src-tauri/`, `.github/workflows/desktop-release.yml` présents dans `main` |
| Rappels RDV | « 0 % — aucun mécanisme d'envoi ni de planification » | **FAIT le 29/07** — J-1, H-2 et confirmation en production (cron `appointment-reminders`, jobid 2, envoi BudgetSMS prouvé). Voir la ligne P1 du tableau |
| CRIT-5 | « rouvert et aggravé » (`ETAT_DES_LIEUX.md:53`) | **FERMÉ** — test REST prod du 29/07 : signup sans `captcha_token` → `400 captcha_failed`. La note d'ETAT_DES_LIEUX est **périmée** (antérieure à l'activation du captcha serveur). Voir §Preuve CRIT-5 |

### Preuve CRIT-5 (test réel, 29/07/2026)

```
POST https://pudugodhiofqrctcdwfl.supabase.co/auth/v1/signup
apikey: <ANON>   body: {"phone":"+213555000199","password":"***"}   (sans captcha_token)

→ HTTP 400
{"code":400,"error_code":"captcha_failed",
 "msg":"captcha protection: request disallowed (no captcha_token found)"}
```

`access_token` retourné immédiatement : **NON**. Aucun compte créé.
La protection CAPTCHA serveur de Supabase Auth bloque le vecteur **avant** toute création de compte.

**Reste non vérifié** (2ᵉ ordre, nécessite un vrai captcha + création de compte en prod → à faire sur
staging avec ton accord) : avec un token valide, le compte est-il auto-confirmé (`phone_confirmed_at`
pré-rempli) et une session est-elle rendue sans vérification OTP ? C'est la moitié restante de la
note `ETAT_DES_LIEUX.md:53`.

---

## Tableau — tout ce qui reste, trié par priorité

Légende état : ✅ FAIT · 🔧 en cours sur `hygiene/p0` · ⬜ à faire · ⚠️ à trancher en base live

| P | État | Domaine | Constat (preuve) | Effort |
|---|---|---|---|---|
| **P0** | 🔧 | Hygiène | Mot de passe du compte test en clair dans un repo **public** (`migrations/TEST_seed_medecin_desktop.sql:9,40,151` ; GitHub → HTTP 200). Masqué en `<MDP_TEST>` sur cette branche — **l'historique git conserve la valeur → rotation en base obligatoire** | S |
| **P0** | ⬜ | Hygiène | Comptes test présents **en production** (`docs/AUDIT_claim_rpc.md:101`) ; action n°2 d'`ETAT_DES_LIEUX.md:161` jamais faite | S |
| **P0** | ⬜ | Backend | RPC `match_doctor_for_claim(BIGINT, TEXT)` **exposée à `anon` et jamais appelée** (`migrations/CRIT-4_step3_rpc_claim.sql:34,60` ; 0 occurrence dans `js/`+`*.html`). Surface d'attaque gratuite — SQL de REVOKE fourni §Actions | S |
| **P0** | ✅ | Sécurité | CRIT-5 — **fermé, prouvé** (voir ci-dessus) | — |
| **P0** | ⬜ | Mobile | **Scripts internes packagés dans l'APK public** : `scripts/build-mobile.sh:29` copie `scripts/` (dont `deploy-web.sh`, `otp-spike.sh`), les 490 pages `seo/` et les pages `admin-*` dans `www/` → 653 fichiers embarqués | S |
| **P1** | ✅ | Desktop | Push + PR Phase 3 — **FAIT** (PR #16 + #17 mergées dans `main`) | — |
| **P1** | ⬜ | Backend | ⚠️ **Schéma prod non versionné** : 25 RPC appelées par le front sans définition dans le repo (`admin_*`, `*_prescription_*`, `*_cabinet_*`, `*_api_key*`, `get/upsert_patient_medical_data`) ; aucun `CREATE TABLE patient_medical_data` alors que `patient-profile.html:314-393` lit/écrit dessus | M |
| **P1** | ✅ | Backend | **Rappels SMS — FAIT, en production le 2026-07-29** (branche `phase4/rappels-rdv`). Edge function `appointment-reminders` (3 passes : `j1` [now+6h,now+24h], `h2` [now+90min,now+150min], `confirmation` drainée depuis un trigger SQL) + `pg_cron` 15 min (jobid 2, active) + BudgetSMS. Envoi réel prouvé. Anti-doublon par index UNIQUE `(appointment_id, kind)` ; fenêtres j1/h2 rendues disjointes après un bug réel (2 SMS pour 1 RDV). Kill-switch `REMINDERS_ENABLED=false`. Runbook : `DEPLOY_RAPPELS.md`. **Non retenu** : canal email (SMS-only en DZ) — l'edge `send-email` appelée par `js/tabibi-brevo.js:619` reste inexistante | L |
| **P1** | ⬜ | Mobile | **Keystore Android hors repo, sans sauvegarde documentée** + chemin contradictoire : `android/app/build.gradle:5` lit `android/keystore.properties`, la doc dit `android/app/` (`docs/mobile/DEPLOYMENT_CHECKLIST.md:141`) → signature silencieusement ignorée. Perte de clé = perte du canal de MAJ Play | S |
| **P1** | ⬜ | Mobile | **Bundle id iOS incohérent** : `com.tabibi.doctor` (`ios/App/App.xcodeproj/project.pbxproj:308`) ≠ `dz.tabibi.app` (`capacitor.config.ts:5`) ≠ Android ; `Info.plist` a 2 clés dupliquées (l.7/109, l.35/113) ; aucun `DEVELOPMENT_TEAM` | S |
| **P1** | ⬜ | Site | `telecharger.html` : aucune détection OS (lien APK unique servi à tous, `:49`), **version affichée 1.0.0 vs APK 1.0.1/vc3** (`:46`), bouton « Disponible sur Google Play » **mensonger** (`index.html:1049`), aucun lien `.dmg`/`.exe` | M |
| **P1** | ⬜ | Desktop | **Auto-update Tauri : 0 %** — pas de `tauri-plugin-updater` (`desktop/src-tauri/Cargo.toml:14-21`), pas de `latest.json` en CI, builds non signés (`.github/workflows/desktop-release.yml:10-13`) → chaque correctif = réinstallation manuelle chez chaque médecin | M/L |
| **P1** | ⬜ | Desktop | **6 pages du bundle en colonne mobile** (0 `@media (min-width:1024)`) : `medecin-ordonnance`, `messages` (480px), `conversation` (640px), `notifications` (480px), `medecin-waitinglist`, `doctor-reservation` — sur une fenêtre 1440×900 (`desktop/src-tauri/src/main.rs:31`) | M |
| **P1** | ⬜ | Desktop | Sidebar : **2 entrées mortes** — « Statistiques » 100 % factice sans bannière (`doctor-analytics.html:199,291` ; 0 appel Supabase) et « Messages » qui redirige aussitôt (flag `messaging:false`, `js/tabibi-features.js:66` ; `messages.html:114`) | S (masquer) / L (brancher) |
| **P1** | ⬜ | Desktop | **Noms patients = « Patient »** dans l'agenda — RLS `users` bloque et l'échec est **avalé sans log** (`js/tabibi-agenda.js:188-194`) | M |
| **P1** | ⬜ | Transverse | **Sentry inactif** — DSN placeholder (`js/config.js:25`) + flag off (`js/tabibi-features.js:91`) → zéro remontée d'erreur web ET desktop | S |
| **P1** | ⬜ | Transverse | **Versioning éclaté** : `1.0.0` (`package.json:3`), `0.1.0` (`tauri.conf.json:4`), `1.0.1`/vc3 (APK), `tabibi-v32` (`sw.js:33`) — et **aucune version affichée in-app** | S |
| **P1** | ⬜ | Déploiement | **Netlify non connecté à GitHub** (déploiement manuel par zip — dette tracée `ETAT_DES_LIEUX.md`) → pas de hotfix rapide possible | S |
| **P2** | ⬜ | Backend | **Push Firebase partiel** : table + collecte OK (`migrations/PUSH_step1_device_tokens.sql` ; `js/capacitor-bridge.js:390-464`) mais un seul point d'init (médecins natifs, `doctor-dashboard.html:1383`), **0 envoi serveur**, pas de `google-services.json` | L |
| **P2** | 🔧 | Hygiène | Outillage debug résiduel — `js/tabibi-desktop-diag.js` (auto-marqué « à retirer ») + commande Rust `diag_log` : **retirés sur cette branche** ; `?debug=1` conservé (gate stricte, `login.html:224-232`) | S |
| **P2** | ⬜ | Transverse | **0 test automatisé** — `tests/` = 4 procédures Markdown, pas de script `test` (`package.json:6-12`), CI sans vérification | M |
| **P2** | ⬜ | Transverse | **Aucun bundler ni minification** — `js/tabibi-i18n.js` = 360 Ko bruts × 43 pages ; cohérent avec Lighthouse Perf 67/100 | M |
| **P2** | ⬜ | Desktop | **Offline : 0 %** — `sw.js` jamais copié dans le bundle (`desktop/build-dist.sh`) ET auto-désactivé sur `localhost` (`js/tabibi-sw-register.js:36`), qui est justement l'origine Tauri (`main.rs:16`) | L |
| **P2** | ⬜ | Site/PWA | SW enregistré **sur `index.html` uniquement** — ~30 pages déclarent le manifest sans jamais enregistrer le service worker | S |
| **P2** | ⬜ | Transverse | `?demo=1` **ouvert en prod web sans authentification** (`js/tabibi-agenda.js:124` — bannière visible, verrouillé desktop) | S |
| **P2** | ⬜ | Hygiène | **`tabibi.apk` 10 Mo tracké** dans le repo public, hors `.gitignore` — chaque rebuild ajoute ~10 Mo à l'historique | S |
| **P3** | ⬜ | Dette P0 | **Migration CSS v2 à 13 %** — 31 pages v1 seul, 3 pages chargent v1+v2, `verify-prescription.html` a `tokens-v2` sans `components-v2` ; `auth.css`+`auth-page.css` fusionnables (mêmes 7 pages) | L |
| **P3** | ⬜ | Dette P0 | **15 pages avec `<header class="app-bar">` en dur** vs 12 migrées sur le composant (headers de page spécifiques, identifiés en Phase 0) | M |
| **P3** | ⬜ | Transverse | **8 dictionnaires i18n locaux** hors `js/tabibi-i18n.js` (agenda, sidebar, nav, footer, cookies, beta, reviews, brevo) — fr/ar/en couverts mais wording éclaté | M |
| **P3** | ⬜ | Backend | **Paiements absents** — flag off (`js/tabibi-features.js:53`), `js/payments.js` stub, `payment.html` **orpheline** (0 lien entrant), 0 backend Stripe/SATIM (`SQL_TODO.md:63` : pas de sandbox SATIM stable) | L |
| **P3** | ⬜ | Dette SQL | Items ouverts : TODO-SQL-008 (RPC téléconsultation), 009 (Stripe), 010 étape 2 (cron J-1), 011 (reviews) + 4 items hygiène (`SQL_TODO.md:153-158`) + ID fantôme 012 cité dans `js/tabibi-features.js:70` mais absent du fichier | M/L |
| **P3** | ⬜ | Dette | Divers : doublon `claim_my_doctor_profile()` sans args, `security_invoker=true` sur les vues, 404 `scripts/app.js`, `index.html.bak_*` untracked, nommage `doctor-profile` (fiche publique) vs `medecin-profile` (édition privée) — **pas un doublon**, mais source de confusion | S/M |

---

## Actions à exécuter par un humain (non appliquées ici)

### 1. REVOKE de la RPC orpheline

Signature lue dans `migrations/CRIT-4_step3_rpc_claim.sql:34-37` — `(p_legacy_id BIGINT, p_email TEXT)` :

```sql
-- Vérifier d'abord les droits actuels
SELECT proname, pg_get_function_identity_arguments(oid) AS args, proacl
  FROM pg_proc
 WHERE proname = 'match_doctor_for_claim';

-- Retirer l'accès anonyme (fonction jamais appelée par le front : 0 occurrence
-- dans js/ et *.html ; le flux de claim utilise claim_my_doctor_profile)
REVOKE EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) FROM anon;

-- Vérification post-exécution : 'anon=X/postgres' doit avoir disparu de proacl
SELECT proname, proacl FROM pg_proc WHERE proname = 'match_doctor_for_claim';
```

Rollback si un usage caché apparaît :
`GRANT EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) TO anon;`

### 2. Rotation du mot de passe du compte test

L'historique git conserve l'ancienne valeur — le masquage seul ne suffit pas.
Dashboard Supabase → Authentication → Users → compte `+213555000000` → *Reset password*.

### 3. Purge des comptes test avant launch

Section ROLLBACK commentée en fin de `migrations/TEST_seed_medecin_desktop.sql` (ciblée par téléphone).

---

## Les 5 gestes recommandés cette semaine

1. REVOKE `match_doctor_for_claim` + rotation du mot de passe test (30 min).
2. Dump du schéma + policies prod → `migrations/PROD_SCHEMA_DUMP.sql` : le repo redevient source de vérité et on saura si ordonnances / cabinets / admin tiennent debout en prod.
3. Rebuild APK propre (sans `scripts/`, `seo/`, `admin-*`) + sauvegarde du keystore hors machine.
4. `telecharger.html` : détection OS, versions exactes, liens vers les installateurs desktop.
5. ~~Lancer le chantier **rappels J-1**~~ → ✅ **FAIT le 2026-07-29** (J-1 + H-2 + confirmation en production, cron actif).
