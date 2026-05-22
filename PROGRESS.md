# 📊 TABIBI.DOCTOR — PROGRESS V1 (master prompt 13 phases)

> **Démarré** : 2026-05-21
> **Repo** : `~/Downloads/tabibi-FINAL-v4-extracted/`
> **Site preview** : https://superb-manatee-a950c4.netlify.app
> **Domaine cible** : tabibi.doctor (Phase 13)
> **Méthode** : phase par phase, validation "OK go" entre chaque (choix A).

---

## Phase 1 — Patch bandeau claim + signup médecin (4-6h) — **✅ DONE 2026-05-21**

- [x] 1.0 Baseline `_mapSupabaseDoctor` + `_renderNotFound` (livré session précédente v3)
- [x] 1.1 `doctor-profile.html` : bandeau interactif câblé sur RPC `claim_my_doctor_profile`
  - [x] Mapper `legacy_id` dans `_mapSupabaseDoctor`
  - [x] Remplacer `<a href>` par `<button onclick>` avec routing 3 cas
  - [x] Inclure `js/tabibi-claim.js`
- [x] 1.2 `signup.html` : auto-claim post-signup si `?claim_legacy_id=` présent
  - [x] Lecture query string (`_getClaimLegacyIdFromUrl`)
  - [x] Appel RPC AVANT signOut médecin
  - [x] Fallback `localStorage.tabibi_pending_claim_legacy_id` si fail
  - [x] Auto-sélection rôle médecin + bandeau bleu info au chargement
- [x] 1.3 `js/tabibi-claim.js` (nouveau) : logique partagée 3 cas + handler erreurs + `consumePending()`
- [x] 1.4 `tests/manual/CLAIM_FLOW_TESTS.md` : 4 scénarios E2E à exécuter user-side
- [x] 1.5 Commit `phase1: bandeau claim + signup auto-claim`
- [x] 1.6 ZIP intermédiaire pour deploy preview Netlify

## Phase 2 — Audit prod & fix bugs (4-8h) — **✅ DONE 2026-05-21**
- [x] 2.1 Audit frontend : 24/24 hrefs OK, 3 TODOs documentés, 0 lien cassé
- [x] 2.2 Vérif requêtes Supabase : 0 occurrence de `doctor_profiles`, 24 tables + 22 RPCs inventoriées
- [ ] 2.3 Lighthouse ≥ 80 sur 5 pages clés (à exécuter user-side post-deploy preview — template dans AUDIT_REPORT.md)
- [x] 2.4 Fix bugs P0/P1 + `AUDIT_REPORT.md`
  - [x] P0 #1 : créé `robots.txt` (Disallow /seo/, /api/, espaces privés + Sitemap)
  - [x] P1 #2 : supprimé fallback dead code `from('profiles')` dans `index.html:1367`
  - [x] 5 P2 documentés pour phases 4/6/10/12/13

## Phase 3 — Pages légales `/legal/` + RGPD (2-3h) — **✅ DONE 2026-05-21**
- [x] 3.1 Déplacement `cgu.html` → `legal/cgu.html` (+ 4 autres : confidentialite, cookies, mentions-legales, rgpd-droits)
  - 5 fichiers déplacés à `/legal/`, asset paths réécrits avec `../` préfixe
  - Refs intra-legal conservées en relatif (résolvent OK depuis /legal/)
- [x] 3.2 Netlify rewrites 301 pour anciennes URLs (préservation SEO)
  - 5 redirects `/cgu.html` → `/legal/cgu.html` etc. (force=true)
  - 11 fichiers (HTML + JS) sed-edited pour pointer directement vers `/legal/*` (évite hop redirect)
  - `robots.txt` Allow ajustés vers nouveaux paths
- [x] 3.3 Footer global avec liens
  - Pages riches (index, about) déjà OK avec liens vers /legal/
  - Créé `js/tabibi-footer.js` (injecteur footer minimal idempotent)
  - Inclus dans login.html, signup.html, doctor-profile.html (3 pages publiques sans footer)
- [x] 3.4 Bandeau cookies minimaliste (essentiels only)
  - `js/tabibi-cookies.js` existant audité : 3 boutons (Refuser au même niveau visuel ✅), TTL 6 mois, 3 langues, défaut = rien activé
  - 2 fixes : path `cookies.html` → `legal/cookies.html` + texte lien `policy_link` ajouté au dict I18N
- [x] 3.5 Nouvelle page `legal/dpa.html` (Data Processing Agreement médecins)
  - 11 sections : préambule, objet/durée, données, obligations, mesures sécurité, sous-traitants ultérieurs, transferts internationaux, violations, droit d'audit, durées de conservation, droit applicable, contacts
  - Article 28 RGPD + loi DZ 18-07 + ANPDP référencés

## Phase 4 — Dashboard médecin complet (8-12h) — **4.A DONE, 4.B en attente validation user**

### Phase 4.A — Migrations SQL (livrées 2026-05-21)
- [~] 4.A.1 v1 `migrations/PHASE4_doctor_dashboard.sql` — **OBSOLÈTE** (ciblait `public_doctors_master` halluciné). Conservée pour traçabilité avec en-tête OBSOLETE explicite.
- [x] 4.A.2 v2 `migrations/PHASE4_doctor_dashboard_v2.sql` (10 sections, idempotent, en attente d'exécution user-side)
  - Section 0 : DISCOVERY pré-flight (3 vérifs rapides)
  - Section 1 : **3 colonnes seulement** (`telehealth_enabled`, `telehealth_fee_dzd`, `accepts_cash`) — vérifié contre les 35 cols existantes
  - Section 2 : table `doctor_unavailable_slots` NEW (FK sur `doctor_profiles(id)` ON DELETE CASCADE)
  - Section 3 : 4 policies RLS sur `doctor_unavailable_slots` UNIQUEMENT (les 3 RLS existantes sur `doctor_profiles` INTACTES)
  - Section 4 : vue `public_doctor_full` NEW additive — **JOIN sur `public_doctors`** (hérite l'anonymisation existante, pas de duplication). AJ1 : pas de `security_invoker=true` (alignement v1 Phase 0, à durcir Phase 12)
  - Section 5 : bucket storage `doctor-photos` (public, 2 MB, JPEG/PNG/WebP)
  - Section 6 : 4 policies RLS sur `storage.objects` (AJ2 : TODO Phase 12 durcir énumération anonyme)
  - Section 7 : trigger auto-bump `updated_at` **conditionnel** (à exécuter si section 0.2 retourne vide)
  - Section 8 : 2 RPCs (`get_my_doctor_profile`, `update_my_doctor_profile` 12 params — scope via `user_id = auth.uid()`, cohérent avec policy existante). TODO Phase 12 : audit log sur changements phone/address (D5)
  - Section 9 : 10 vérifications dont 2 critiques (`claim_my_doctor_profile` + `public_doctors` intacts) + 1 critique (policies `doctor_profiles` inchangées)
  - Section 10 : rollback commenté
- [x] 4.A.3 Cleanup cohérence : `tests/manual/CLAIM_FLOW_TESTS.md` corrigé (`public_doctors_master` → `doctor_profiles`, `claimed_by_user_id` → `user_id`, suppression mention `public.users.claimed_legacy_id` non vérifié)

### Phase 4.B — Frontend dashboard
- [x] 4.B.1 Wire `medecin-profile.html` → RPCs Phase 4 + télémédecine + upload photo (commit unique fusionné, 2026-05-21)
  - Mini-migration SQL `migrations/PHASE4B_doc_working_hours_comment.sql` : COMMENT ON COLUMN documente le format JSONB
  - Bandeau "Réclamer ma fiche" affiché si `get_my_doctor_profile()` retourne null OU si update renvoie `profile_not_found_or_not_claimed`
  - Section "Téléconsultation" : toggle `telehealth_enabled` + input `telehealth_fee_dzd` (visible si toggle ON)
  - Upload photo bucket `doctor-photos` : commit-then-purge (upload nouveau → update RPC → delete ancien best-effort), MIME-derived ext, 2 MB max, preview optimiste
  - Sérialiseur `working_hours` : tabibiDoctor.serializeSchedule (UI Lundi/Mardi tuple → DB mon/tue array d'objets {open,close}) + parseSchedule inverse
  - Compteur 2000 chars sur bio (UI + validation RPC)
  - Mode dégradé localStorage préservé si pas de session Supabase
  - sw.js : CACHE_VERSION bumpée v7 → v8-2026-05-21
- [x] 4.B.2 Extraire helpers `tabibiDoctor` inline → `js/tabibi-doctor-dashboard.js` partagé (commit 2026-05-21)
  - Fichier NEW `js/tabibi-doctor-dashboard.js` (193 lignes) — IIFE idempotente avec garde `window.tabibiDoctor && typeof === 'function'`
  - Suppression de l'IIFE inline (~166 lignes) dans `medecin-profile.html` → remplacée par 5 lignes de commentaire
  - Inclusion `<script src="js/tabibi-doctor-dashboard.js"></script>` après `tabibi-bridge.js` dans `medecin-profile.html` ET `doctor-dashboard.html` (juste include, pas wire)
  - sw.js : CACHE_VERSION v8 → **v9-2026-05-21** + ajout `/js/tabibi-doctor-dashboard.js` au `PRECACHE_URLS`
  - Aucune régression : API publique identique, page-specific (loadProfile/saveAll/handlers DOM) inchangées
  - **Hotfix appliqué** : `getMyProfile()` normalise les row composites vides à null — bug PostgREST latent corrigé. Garde `!r.data.id` ajoutée (PK NOT NULL → l'absence d'id signale forcément absence de row). Sans ce fix, le bandeau "Réclamer ma fiche" ne se déclenchait pas quand PostgREST renvoyait `{id:null, user_id:null, ...}` au lieu de `null` pur. sw.js bump v9 → **v10-2026-05-21**.
- [x] 4.B.3 `doctor-dashboard.html` : ajout section "Blocages exceptionnels" + CRUD `doctor_unavailable_slots` (commit 2026-05-21)
  - **Hotfix fix1 (2026-05-22)** : robustesse + diagnostic — `getMyDoctorId(forceRefresh)` + `invalidateDoctorIdCache()` exportée, garde `r.data null` après `.insert().select().single()` (edge case PostgREST), retry 1.5s dans `loadUnavailSlots` si session pas prête, try/catch englobant dans `saveUnavailSlot`/`deleteUnavail` + toast d'erreur visible, console.info à chaque étape (payload, response, errors). sw.js bump v11 → **v12-2026-05-22**.
  - **Hotfix fix1-review (2026-05-22)** : dédupe affichage erreur (toast court "Erreur de création du blocage — voir détail dans la modal" + détail dans #un-error) suite à review pré-deploy 4 points.
  - **Hotfix fix2 (2026-05-22)** : 3 bugs de validation dates corrigés. (1) `new Date("YYYY-MM-DDTHH:mm")` était parsé localement sur Chrome mais comme UTC sur Safari → remplacé par `_buildLocalDate(yyyymmdd, hhmm)` qui utilise `new Date(year, month-1, day, hour, minute)` (toujours local, garanti par spec). (2) allDay coché : forçage 00:00→23:59 du jour début/fin avec validation séparée par comparaison string YYYY-MM-DD (tri lexicographique = chronologique) → permet de bloquer un jour entier même start_date = end_date. (3) Pré-fill "demain" utilisait `toISOString().split('T')[0]` qui shift en UTC (bug minuit en Algérie UTC+1) → remplacé par `_tomorrowLocalIso()` avec composantes locales. Helper `addUnavailableSlot` : comparaison directe via `.getTime()` ms au lieu de re-parser toISOString. Logs `[unavail-validate]` ajoutés. sw.js bump v12 → **v13-2026-05-22**.
  - **Hotfix fix2-hotpatch (2026-05-22)** : SyntaxError introduite par fix2 ligne 277 `tabibi-doctor-dashboard.js` — apostrophe française dans `pas d'erreur` mal échappée en style SQL `''` au lieu de `\'` ou string double-quote → tout le JS file échouait au parse → `window.tabibiDoctor` undefined → exception "Erreur inattendue" sur toute tentative d'add/list/delete. Fix : string passée en double-quotes `"pas d'erreur"`. Confirmé par `node --check`. sw.js bump v13 → **v14-2026-05-22**.
  - `js/tabibi-doctor-dashboard.js` : +3 helpers (`listUnavailableSlots`, `addUnavailableSlot`, `deleteUnavailableSlot`) + cache `getMyDoctorId`
  - Section insérée sous l'onglet Agenda (avant `</div>` ligne 140), 100 % additive — pattern card `.appt-card.pending`
  - Modal "Bloquer un créneau" réutilise le pattern visuel de `#schedule-modal` (bottom-sheet 520px max-width)
  - Checkbox **"Toute la journée"** (mappée sur col `all_day`) : cache les inputs heure + force 00:00→23:59 au submit
  - Validation client : `ends_at > starts_at` instant + 5 codes erreur RLS mappés en messages FR (rls_denied, check_violation_chrono, doctor_not_found, profile_not_found_or_not_claimed, invalid_range)
  - Mini-bandeau "Réclamez votre fiche d'abord" affiché si médecin pas claim (lien vers `medecin-profile.html`)
  - Hook sur `sw('agenda')` : reload des slots à chaque entrée d'onglet
  - Format date : `_fmtSlotDate()` utilise `window.tabibiFormatDate` si dispo, fallback `toLocaleString('fr-FR')` — affichage "Lun 15 juin 09:00 → Jeu 18 juin 18:00"
  - sw.js : CACHE_VERSION v10 → **v11-2026-05-21**
- [ ] 4.B.4 Fixtures `fixtures/test_doctor.sql` + `tests/manual/DOCTOR_DASHBOARD_TESTS.md` + ZIP intermédiaire

### 🔖 TODOs ouverts pour Phase 12 (monitoring & sécurité)
- [ ] **DB hygiène** : nettoyer le doublon `claim_my_doctor_profile()` sans arguments (vestige antérieur détecté par user en validation 4.A.9 — 2 rows au lieu de 1)
- [ ] **Storage** : cron purge des photos orphan dans `doctor-photos` (cas où la suppression post-update échoue silencieusement dans le pattern commit-then-purge de tabibiDoctor.uploadPhoto)
- [ ] **DB sécurité** : aligner `public_doctors` et `public_doctor_full` sur `security_invoker=true` (AJ1 Phase 4.A v2)
- [ ] **Storage** : durcir `doctor_photos_select_public` pour empêcher l'énumération anonyme des paths (AJ2 Phase 4.A v2)
- [ ] **Audit log** : tracer les changements de `phone` et `address` via `update_my_doctor_profile` (risque fraude, D5 Phase 4.A v2)

## Phase 5 — Système de RDV bout-en-bout (10-15h)
- [ ] 5.1 Page `recherche.html` (filtres : spé, wilaya, chifa, dispo, paiement)
- [ ] 5.2 Fiche médecin publique + calendrier 7 jours + bouton RDV
- [ ] 5.3 Flow booking 3 étapes (créneau → coordonnées → confirmation)
- [ ] 5.4 SQL : table `appointments` (créer si absent) + RLS strict patient/médecin
- [ ] 5.5 Annulation RDV (patient/médecin) + raison + templates email
- [ ] 5.6 Rappels J-1 (code Edge Function ou pg_cron, désactivé par défaut)

## Phase 6 — Dashboard patient + historique (4-6h)
- [ ] 6.1 Page `patient-dashboard.html` (prochains RDV, historique, ordonnances, favoris)
- [ ] 6.2 Édition profil patient (nom, DDN, téléphone, wilaya, langue)

## Phase 7 — Téléconsultation (préparation, non-prod) (4-6h)
- [ ] 7.1 Vérif RPCs vidéo Supabase (`get_video_session`, etc.) existantes
- [ ] 7.2 Frontend `teleconsultation.html` Daily.co (déjà câblé v10.28)
- [ ] 7.3 Bandeau RGPD consentement enregistrement
- [ ] 7.4 Feature flag OFF par défaut, activable médecin par médecin

## Phase 8 — Paiements sandbox (4-6h)
- [ ] 8.1 Stripe Test mode + structure SATIM/Edahabia documentée
- [ ] 8.2 Page `payment.html` post-booking
- [ ] 8.3 Edge Function webhook handler → `appointments.status`
- [ ] 8.4 Credentials prod NON activés

## Phase 9 — Notifications & avis (4-6h)
- [ ] 9.1 Table `notifications` + page `notifications.html` (in-app only V1)
- [ ] 9.2 Triggers : RDV confirmé/annulé, rappel J-1, ordonnance, fiche réclamée
- [ ] 9.3 Table `reviews` (rating 1-5, comment, verified flag)
- [ ] 9.4 RLS : patient review uniquement si appointment.status='completed'
- [ ] 9.5 Affichage moyenne + 5 derniers avis sur fiche

## Phase 10 — SEO & analytics (3-5h)
- [ ] 10.1 Régen 490 pages SEO avec noms anonymisés depuis `public_doctors`
- [ ] 10.2 `robots.txt` + `sitemap.xml` cohérents
- [ ] 10.3 Schema.org Physician/MedicalBusiness JSON-LD
- [ ] 10.4 Open Graph + Twitter Cards complets
- [ ] 10.5 Plausible analytics (feature flag OFF)

## Phase 11 — Mobile & PWA (3-4h)
- [ ] 11.1 Audit responsive (320/375/414/768px)
- [ ] 11.2 `manifest.json` complet (icons multi-sizes, theme/bg color, standalone)
- [ ] 11.3 Service Worker : network-first API, cache-first assets
- [ ] 11.4 Bouton "Installer l'app" Android (beforeinstallprompt)
- [ ] 11.5 Page offline si pas de réseau

## Phase 12 — Monitoring & sécurité (3-4h)
- [ ] 12.1 Sentry frontend errors (DSN feature flag)
- [ ] 12.2 Audit `window.*` : aucun secret exposé client
- [ ] 12.3 RLS audit avec rôle `anon` (read `public_doctors`, write `appointments` only)
- [ ] 12.4 Rate limiting RPCs sensibles (claim, signup, reset)
- [ ] 12.5 Headers sécurité strict dans `netlify.toml` (CSP, HSTS, X-Frame DENY)

## Phase 13 — Domaine + déploiement final (1-2h)
- [ ] 13.1 Instructions DNS pour `tabibi.doctor` (A/AAAA/CNAME)
- [ ] 13.2 SSL Let's Encrypt auto
- [ ] 13.3 Redirect www ↔ apex
- [ ] 13.4 URLs absolues → `https://tabibi.doctor`
- [ ] 13.5 ZIP final `tabibi-deploy-PROD-v1.zip`

---

## 📦 Livrables finaux attendus

- [ ] `tabibi-deploy-PROD-v1.zip` dans `~/Downloads/`
- [x] `PROGRESS.md` (ce fichier)
- [ ] `AUDIT_REPORT.md` à la racine
- [ ] `DEPLOY_INSTRUCTIONS.md` à la racine
- [ ] Dossier `migrations/` à jour
- [ ] Historique Git propre (1 commit par phase)

---

## 🚧 Décisions techniques prises

| Décision | Choix | Raison |
|---|---|---|
| Périmètre session | Phase par phase | Validation entre chaque (choix A) |
| Pages légales | `/legal/cgu.html` + redirects 301 | SEO préservé (choix D) |
| Git | `git init` + commits par phase | Rollback possible (choix G) |
| Sentry | DSN placeholder | Aghiles crée projet sentry.io plus tard |
| Téléconsult | Daily.co | Déjà câblé en v10.28 |
| Paiements | Stripe Test + doc SATIM | Pas d'API sandbox stable Algérie |
| Analytics | Plausible | Privacy-friendly + mature |
| i18n | FR par défaut, dict JSON | Extension AR/EN en sprint dédié |
