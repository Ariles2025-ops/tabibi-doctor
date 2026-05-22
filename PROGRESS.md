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

## Phase 4 — Dashboard médecin complet (8-12h) — **✅ DONE 2026-05-22**

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
  - **Hotfix fix3 (2026-05-22)** : anti-hang sur await Supabase. Pattern observé après fix2-hotpatch : "Chargement..." figé + bouton "Enregistrement..." figé sans toast. Cause : un `await` Supabase peut rester pending indéfiniment (token expiré silencieusement, CORS Safari muet, réseau coupé sans FIN) — aucun try/catch ne peut attraper un await qui ne resolve jamais. Fix : helper `_withTimeout(promise, ms, label)` via `Promise.race` qui rejette avec `Error('timeout:<label>')` au bout de N ms. Wraps appliqués : `getMyProfile` 5s, `listUnavailableSlots` 8s, `addUnavailableSlot` 10s, `deleteUnavailableSlot` 8s. Code erreur `timeout` mappé en messages FR explicites. **finally{}** ajoutés sur `saveUnavailSlot` (restaure bouton TOUJOURS) et `loadUnavailSlots` (sentinelle `_renderedSomething` détecte si l'UI est restée sur "Chargement..." et force un message d'erreur avec bouton Réessayer). sw.js bump v14 → **v15-2026-05-22b**.
  - `js/tabibi-doctor-dashboard.js` : +3 helpers (`listUnavailableSlots`, `addUnavailableSlot`, `deleteUnavailableSlot`) + cache `getMyDoctorId`
  - Section insérée sous l'onglet Agenda (avant `</div>` ligne 140), 100 % additive — pattern card `.appt-card.pending`
  - Modal "Bloquer un créneau" réutilise le pattern visuel de `#schedule-modal` (bottom-sheet 520px max-width)
  - Checkbox **"Toute la journée"** (mappée sur col `all_day`) : cache les inputs heure + force 00:00→23:59 au submit
  - Validation client : `ends_at > starts_at` instant + 5 codes erreur RLS mappés en messages FR (rls_denied, check_violation_chrono, doctor_not_found, profile_not_found_or_not_claimed, invalid_range)
  - Mini-bandeau "Réclamez votre fiche d'abord" affiché si médecin pas claim (lien vers `medecin-profile.html`)
  - Hook sur `sw('agenda')` : reload des slots à chaque entrée d'onglet
  - Format date : `_fmtSlotDate()` utilise `window.tabibiFormatDate` si dispo, fallback `toLocaleString('fr-FR')` — affichage "Lun 15 juin 09:00 → Jeu 18 juin 18:00"
  - sw.js : CACHE_VERSION v10 → **v11-2026-05-21**
- [x] 4.B.4 Audit + hygiène + fixtures + tests E2E (livré 2026-05-22, 6 sous-tâches)
  - [x] **4.B.4.0a** Audit RPC `claim_my_doctor_profile` (read-only) — commit `0bec15a` — verdict : ✅ RPC OK (UPDATE complet user_id + is_claimed + claimed_at + updated_at). Doublon vestige `claim_my_doctor_profile()` sans args flag pour Phase 12. Livrables : `migrations/PHASE4B_AUDIT_claim_rpc.sql` (4 requêtes discovery) + `docs/AUDIT_claim_rpc.md` (7 sections remplies).
  - [x] **4.B.4.0b** Documenter process exécution seeds prod — commit `a55e375` — root cause bug data 4.B.3 identifié : seed commité mais jamais exécuté en prod (gap process, pas code). Livrables : `docs/PROD_SEEDS_REGISTRY.md` (NEW, source de vérité 4 seeds Phase 4) + section "🌱 Seeds prod appliqués" dans ce PROGRESS.md.
  - [x] **4.B.4.0c** Pipeline `scripts/build-zip.sh` anti-régression syntaxe JS — commit `4107a7f` — refuse de générer le .zip si `node --check` détecte ≥1 SyntaxError. Couvre 28 fichiers `.js` + inline JS de `doctor-dashboard.html` (829 lignes) et `medecin-profile.html` (474 lignes). Motivé par perte d'1 itération en 4.B.3-fix2 (apostrophe FR mal échappée). Livrables : `scripts/build-zip.sh` (exécutable) + `scripts/README.md`.
  - [x] **4.B.4.1** Fixtures démo blocages — commit `881d236` — 3 cas représentatifs sur la fiche test (a) passé all_day "Vacances de Pâques" 2026-04-15→04-22, (b) futur timed "Formation cardiologie" 2026-06-10 09:00→17:00, (c) weekend all_day "Indisponible weekend" 2026-05-30→05-31. Idempotent (DELETE+INSERT). Livrable : `fixtures/test_doctor_blocages.sql` + entrée registry.
  - [x] **4.B.4.2** Checklist E2E manuelle doctor-dashboard — commit `3f016b2` — 7 scénarios reproductibles (T1 login, T2 agenda+3 fixtures, T3 create timed, T4 create all_day, T5 delete, T6 error invalide, T7 non-claim bandeau) avec résultats KO connus référençant les hotfixes Phase 4.B.3 (fix1/fix2/fix3). ~10-15 min de validation. Livrable : `tests/manual/DOCTOR_DASHBOARD_TESTS.md` (309 lignes).
  - [x] **4.B.4.3** Clôture Phase 4 — ce commit — ZIP cumulatif final `dist/tabibi-deploy-FINAL-v6-phase4B-complete.zip` généré via `scripts/build-zip.sh` (donc auto-validé syntaxe JS) + tag git annoté `phase4-done` + cette section PROGRESS.md mise à jour.

---

### 🏁 Phase 4 close

**Date clôture** : 2026-05-22
**Périmètre livré** : migrations SQL doctor_profiles + dashboard édition fiche médecin (medecin-profile.html) + télémédecine toggle + upload photo bucket doctor-photos + CRUD blocages exceptionnels (doctor-dashboard.html) + 4 hotfixes Phase 4.B.3 (fix1 cache+logs, fix2 timezone Date, fix2-hotpatch syntax, fix3 anti-hang timeouts) + audit RPC + pipeline anti-régression + fixtures + checklist E2E.

**Prochaine phase** : **Phase 5 — Système de RDV bout-en-bout** (estimé 10-15h de travail).

---

### 🌱 Seeds prod appliqués

Liste résumée des migrations/seeds qui doivent être exécutés **manuellement** côté Supabase prod (un commit Git ne lance pas le SQL automatiquement). Source de vérité détaillée : [`docs/PROD_SEEDS_REGISTRY.md`](docs/PROD_SEEDS_REGISTRY.md).

| Fichier | Commit | Date exec prod | Status |
|---|---|---|---|
| `migrations/PHASE4_doctor_dashboard_v2.sql` | `05c69c1` | 2026-05-21 | ✅ Aghiles |
| `migrations/PHASE4B_doc_working_hours_comment.sql` | `912b9be` | 2026-05-21 | ✅ Aghiles |
| `migrations/PHASE4B_seed_claim_test_doctor.sql` | `87773c7` | 2026-05-22 (équivalent UPDATE manuel) | ✅ Aghiles |
| `migrations/PHASE4B_AUDIT_claim_rpc.sql` | `0bec15a` | 2026-05-22 | ✅ Aghiles (read-only) |

→ Procédure complète d'exécution + format d'entrée dans `docs/PROD_SEEDS_REGISTRY.md`.

### 🔖 TODOs ouverts pour Phase 12 (monitoring & sécurité)
- [ ] **DB hygiène** : nettoyer le doublon `claim_my_doctor_profile()` sans arguments (vestige antérieur détecté par user en validation 4.A.9 — 2 rows au lieu de 1)
- [ ] **Storage** : cron purge des photos orphan dans `doctor-photos` (cas où la suppression post-update échoue silencieusement dans le pattern commit-then-purge de tabibiDoctor.uploadPhoto)
- [ ] **DB sécurité** : aligner `public_doctors` et `public_doctor_full` sur `security_invoker=true` (AJ1 Phase 4.A v2)
- [ ] **Storage** : durcir `doctor_photos_select_public` pour empêcher l'énumération anonyme des paths (AJ2 Phase 4.A v2)
- [ ] **Audit log** : tracer les changements de `phone` et `address` via `update_my_doctor_profile` (risque fraude, D5 Phase 4.A v2)
- [ ] **Convention codes erreur** : aligner Phase 4.B.3-fix3 (`'timeout'`, `'rls_denied'`, `'profile_not_found_or_not_claimed'` lowercase_snake) sur le format Phase 5.2.1 (`ERR_*` UPPER_SNAKE, plus standard industrie type Stripe/AWS)
- [ ] **i18n booking** : migrer `ERR_MSG_FR` de `js/tabibi-booking.js` vers `js/tabibi-i18n.js` pour préparer support `ar`/`en` (actuellement FR-only, hardcodé inline)

## Phase 5 — Système de RDV bout-en-bout (10-15h)

### Phase 5.1bis — Schema + RPC (DONE 2026-05-22, tag `phase5-1bis-done`, commit `79a66a0`)
- [x] Schema appointments aligné prod : colonnes `starts_at`/`ends_at` via trigger `trg_appointments_sync_slot_times`
- [x] 6 policies RLS propres (cleanup 5 polluées dont 3 buggées `auth.uid()=doctor_id`)
- [x] RPC `public.get_available_slots(doctor_id UUID, target_date DATE, slot_duration INT)` testée 10/10 (T1-T4 fonctionnels + G1-G6 garde-fous incluant anti-énumération `is_claimed=true`)
- [x] Fixture `working_hours` pour medecin.test (pattern Alger : dim-mer 09-13+14-18, jeu 9-13, ven-sam fermé)

### Phase 5.2 — Frontend booking patient (en cours)
- [x] **5.2.1** `js/tabibi-booking.js` (NEW) — helpers `window.tabibiBooking.{getAvailableSlots, createAppointment, listMyAppointments, cancelMyAppointment, errorMessage, CODES}` avec pattern Phase 4.B.3-fix3 (timeouts 8s/10s + try/catch + always-return `{ok, data?, error?}`). 14 codes erreur typés ERR_* + mapping FR. Validation client pré-flight (UUID, date range J+90, slot duration [5,240]). Tests doc `tests/manual/PHASE5_2_1_BOOKING_HELPERS_TESTS.md` (12 scénarios). **Non inclus dans aucun HTML en 5.2.1** (inclusion 5.2.3).
- [x] 5.2.2 `doctor-profile.html` : bouton "Prendre RDV" sticky câblé (commit 2026-05-22) — Option A : refactor `reserve()` pour link `reservation.html?doctor_id=...&doctor_name=...&prix=...&spec=...`. Helper `_refreshReserveBtnState()` appelé depuis `loadDoc()` : (a) fiche non-claim → bouton disabled + mention "Ce médecin n'a pas encore activé les RDV en ligne", (b) fiche claim + user loggé → mention vide, (c) fiche claim + anon → mention "Connexion requise pour confirmer le RDV" (signup-wall arrive dans reservation.html en 5.2.3). sw.js bump v15 → v16.
- [ ] 5.2.3 `reservation.html` refactor 4 steps (Date+Slot → Détails → Paiement → Confirmation) — calendrier 90 jours, utilise `tabibiBooking`
- [ ] 5.2.4 `mes-rdv.html` (NEW) — liste RDV patient + annulation
- [ ] 5.2.5 Neutraliser booking legacy `patient-dashboard.html` + sw.js bump + tests E2E + ZIP

### Phase 5.3-5.6 (à venir)
- [ ] 5.3 Page `recherche.html` (filtres : spé, wilaya, chifa, dispo, paiement)
- [ ] 5.4 Annulation médecin (UPDATE dashboard agenda Phase 4.B.3)
- [ ] 5.5 Templates email (Brevo) confirmation/annulation/rappel
- [ ] 5.6 Rappels J-1 (Edge Function ou pg_cron, feature flag OFF par défaut)

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
