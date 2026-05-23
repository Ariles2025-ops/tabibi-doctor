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
- [ ] **UX ERR_RATE_LIMIT** : toast dédié couleur `warning` ("Demande déjà en cours, patientez quelques secondes") au lieu du fallback `error` générique dans `reservation.html confirmRDV()` (5.2.3). Affecte la perception : ERR_RATE_LIMIT = transient retry-able, pas une vraie erreur.
- [ ] **Booking duration dynamique** : `reservation.html confirmRDV()` hardcode `durationMinutes:30` (5.2.3) — à lire depuis `doctor_profiles.default_appointment_duration_min` quand la colonne sera ajoutée (5.3+). Idem `getAvailableSlots(doctorId, dateIso, 30)` côté Step 1.
- [ ] **signup.html `?next=`** : actuellement non supporté → si user clique "Pas de compte ?" depuis `login.html?next=reservation.html` perdu. Ajouter helper `_safeNext()` identique à login.html dans signup.html + lire `next` côté `<a href="signup.html">` de login.html pour le propager.

## Phase 5 — Système de RDV bout-en-bout (10-15h)

### Phase 5.1bis — Schema + RPC (DONE 2026-05-22, tag `phase5-1bis-done`, commit `79a66a0`)
- [x] Schema appointments aligné prod : colonnes `starts_at`/`ends_at` via trigger `trg_appointments_sync_slot_times`
- [x] 6 policies RLS propres (cleanup 5 polluées dont 3 buggées `auth.uid()=doctor_id`)
- [x] RPC `public.get_available_slots(doctor_id UUID, target_date DATE, slot_duration INT)` testée 10/10 (T1-T4 fonctionnels + G1-G6 garde-fous incluant anti-énumération `is_claimed=true`)
- [x] Fixture `working_hours` pour medecin.test (pattern Alger : dim-mer 09-13+14-18, jeu 9-13, ven-sam fermé)

### Phase 5.2 — Frontend booking patient (en cours)
- [x] **5.2.1** `js/tabibi-booking.js` (NEW) — helpers `window.tabibiBooking.{getAvailableSlots, createAppointment, listMyAppointments, cancelMyAppointment, errorMessage, CODES}` avec pattern Phase 4.B.3-fix3 (timeouts 8s/10s + try/catch + always-return `{ok, data?, error?}`). 14 codes erreur typés ERR_* + mapping FR. Validation client pré-flight (UUID, date range J+90, slot duration [5,240]). Tests doc `tests/manual/PHASE5_2_1_BOOKING_HELPERS_TESTS.md` (12 scénarios). **Non inclus dans aucun HTML en 5.2.1** (inclusion 5.2.3).
- [x] 5.2.2 `doctor-profile.html` : bouton "Prendre RDV" sticky câblé (commit 2026-05-22) — Option A : refactor `reserve()` pour link `reservation.html?doctor_id=...&doctor_name=...&prix=...&spec=...`. Helper `_refreshReserveBtnState()` appelé depuis `loadDoc()` : (a) fiche non-claim → bouton disabled + mention "Ce médecin n'a pas encore activé les RDV en ligne", (b) fiche claim + user loggé → mention vide, (c) fiche claim + anon → mention "Connexion requise pour confirmer le RDV" (signup-wall arrive dans reservation.html en 5.2.3). sw.js bump v15 → v16.
- [x] 5.2.3 `reservation.html` refactor 4 steps (Date+Slot → Détails → Paiement → Confirmation) — calendrier 90 jours, utilise `tabibiBooking`. **+ patch login.html** : helper `_safeNext()` + intercept redirect post-auth pour supporter `?next=` (whitelist anti open-redirect : refuse `://`, `//evil`, backslash, `javascript:/data:/vbscript:`).
- [x] **5.2.3-fix** Affichage nom médecin — supprime fonction obsolète `_anonymizeName()` qui découpait char-par-char (`"Ouanza Dental Clinic"` → `"Dr O. D. C."`) et produisait des affichages garblés (`"Dr. م .ي."`, `"Dr. – . a."`). NEW `js/tabibi-doctor-name.js` exposant `window.tabibiDoctorName.{format, formatForLang, rawName, initials}` : préfixe `"Dr."` conditionné par `entity_type` (Médecin → préfixe, Clinique/Laboratoire/Cabinet/Pharmacie/Hôpital → pas de préfixe), fallback `full_name` → `full_name_ar` → `"Praticien"`, Unicode-safe via `Array.from()` pour les initiales arabes. Patchés : `doctor-profile.html` (`_mapSupabaseDoctor`), `js/doctors-display.js` (`convertDoctor`), `index.html` (`loadRealDoctors` ligne 2422). sw.js v17 → v18 + précache helper. `SQL_TODO.md` créé avec 2 entrées de vérif backend (TODO-SQL-001 entity_type dans vue, TODO-SQL-002 investiguer source des full_name garblés). : (a) URL params snake_case `doctor_id/doctor_name/prix/spec` alignés sur commit 0673f25, (b) Step 1 calendrier mois-par-mois avec nav bornée [mois courant, mois de J+90], grille Lun-Dim, jours grisés/disabled si hors range, (c) cache client `Map<dateISO, slots[]>` + fetch on-demand au clic via `tabibiBooking.getAvailableSlots()`, (d) jours sans slot grisés APRÈS fetch (compromis vs "no pre-fetch 90 jours"), (e) TZ Africa/Algiers via `Intl.DateTimeFormat('en-CA')` pour dates + `'fr-FR'` hour12=false pour heures, (f) INSERT via `tabibiBooking.createAppointment()` avec mapping `errorMessage(code)`, (g) ERR_SLOT_TAKEN → invalide cache + refresh auto + toast "Ce créneau vient d'être pris" + retour Step 1, (h) ERR_AUTH_REQUIRED → auth-wall inline Step 3 avec link `login.html?next=<current>`. Suppression mock `DOCTORS.find()` + suppression `requireAuth()` upfront (anon peut naviguer Steps 1-3). Suppression POST fetch direct + suppression `localStorage tabibi_rdv` (source unique = Supabase). Suppression block SMS (texte modifié "vous recevrez confirmation prochainement"). sw.js bump v16 → v17 + précache `js/tabibi-booking.js`.
- [x] 5.2.4 `mes-rdv.html` (NEW) — liste RDV patient + annulation. 3 sections tabbées (À venir / Passés / Annulés) avec compteurs. Cards avec nom médecin (via `tabibiDoctorName.format()`), spécialité, date/heure FR Algiers, badge lieu (cabinet/téléconsultation) + badge status. Bouton "Annuler" visible sur "À venir" uniquement, désactivé si <24h avant le RDV (re-check serveur via RLS). Empty state CTA "Trouver un médecin" → index.html. Skeleton loading. Auth-wall si anon (redirect `login.html?next=/mes-rdv.html`). XSS-safe via `_escapeHtml()` sur tous les champs textuels (nom, motif, address, raison annulation). Code spécifique `ERR_MESRDV_TOO_LATE_TO_CANCEL`, fallback sur `tabibiBooking.errorMessage()` pour les autres. `SQL_TODO.md` TODO-SQL-003 : vérifier schéma exact `my_upcoming_appointments` (la page tente plusieurs noms de colonnes en fallback).
- [x] 5.2.5 Neutraliser booking legacy `patient-dashboard.html` + sw.js bump + ZIP. (a) `patient-dashboard.html` : marker `<!-- LEGACY-BOOKING-NEUTRALIZED phase5.2.5 -->` sur les 2 panneaux legacy `#tab-book` et `#tab-rdv` + modal `#book-modal`, tabs "Réserver"/"Mes RDV" redirigent vers `index.html`/`mes-rdv.html`, `openBooking()` redirige vers `doctor-profile.html?id=...`, default tab passé de `#tab-book` → `#tab-overview`. Tous les `onclick="goTab(0)"` (CTA Réserver dans overview + dans empty state RDV) → `location.href='index.html'`. (b) `sw.js` : précache `/reservation.html` + `/mes-rdv.html` (v18 reste — déjà bumpé en 5.2.3-fix). (c) `tabibi-FINAL-v4-phase5.2.zip` créé via `git archive HEAD` à `~/Downloads/`. Tests E2E à exécuter par l'user sur staging.

### Phase 5.3-5.6 (à venir)
- [ ] 5.3 Page `recherche.html` (filtres : spé, wilaya, chifa, dispo, paiement)
- [ ] 5.4 Annulation médecin (UPDATE dashboard agenda Phase 4.B.3)
- [ ] 5.5 Templates email (Brevo) confirmation/annulation/rappel
- [ ] 5.6 Rappels J-1 (Edge Function ou pg_cron, feature flag OFF par défaut)

## Phase 6 — Dashboard patient + historique (4-6h)
- [x] **6.1** `patient-dashboard.html` overview wire à la vraie data Supabase via `tabibiBooking.listMyAppointments()` : stats #ov-up/c/f/d hydratés + #next-rdv card chronologique (ou empty state CTA "Trouver un médecin"). Favoris depuis localStorage. Total dépensé = `—` tant que `appointments.prix` n'est pas systématiquement renseigné. Idempotent : `window.refreshDashboardOverview` exposé pour re-trigger après cancel.
- [x] **6.2** Édition profil patient (nom, DDN, téléphone, wilaya, langue) — `patient-profile.html saveAll()` ajoute sync best-effort vers Supabase : (a) `auth.updateUser({data: user_metadata})` toujours OK + (b) UPDATE `users` table avec fallback minimal si colonne manquante. localStorage save inchangé (cache local UX). TODO-SQL-007 pour confirmer schéma colonnes `users.{phone, birth_date, gender, lang, wilaya_fr, address}` + RLS self-update.

## Phase 7 — Téléconsultation (préparation, non-prod) (4-6h)
- [x] **7.1** Vérif RPCs vidéo Supabase — **non existantes** (PGRST202 confirmé live). `get_video_session` + `set_video_recording_consent` à créer côté SQL → **TODO-SQL-008**.
- [x] **7.2** Frontend `teleconsultation.html` Daily.co — déjà câblé v10.28 (25 KB), 4 écrans : loading / error / prejoin avec consent / iframe Daily. Pas de modification nécessaire côté code, juste wire feature flag.
- [x] **7.3** Bandeau RGPD consentement enregistrement — déjà présent (visible patient uniquement, texte conforme RGPD art. 9 + loi DZ 18-07, conservation 30 j puis suppression auto). Pas de modification.
- [x] **7.4** Feature flag `window.TABIBI_FEATURES.video = false` (NEW `js/tabibi-features.js`) → teleconsultation.html intercepte early et affiche "Bientôt disponible" + CTA Trouver médecin. Activation per-doctor restera côté SQL (`doctor_profiles.video_enabled` à ajouter, TODO-SQL-008).

## Phase 8 — Paiements sandbox (4-6h)
- [ ] 8.1 Stripe Test mode — **bloquant compte tiers** (création compte Stripe nécessaire). Documenté **TODO-SQL-009**.
- [x] **8.2** Page `payment.html` créée — placeholder M0 avec 4 méthodes affichées (espèces actif, Stripe+Edahabia+CIB grisés "BIENTÔT" via `data-feature="payments"`). CTA "Confirmer mode" → redirect mes-rdv. Lit `?doctor_name=&date=&amount=` query string (passé depuis reservation.html confirm). Disclaimer RGPD + loi DZ 18-07. Empty state propre si feature OFF.
- [ ] 8.3 Edge Function webhook handler → **TODO-SQL-009** (backend Stripe + colonnes appointments).
- [x] **8.4** Credentials prod NON activés — confirmé via `window.TABIBI_FEATURES.payments = false` (Phase 7.4).

## Phase 9 — Notifications & avis (4-6h)
- [x] **9.1** Page `notifications.html` créée (frontend ready) — empty state + disclaimer M0 + early empty si `notifications=false`. Lit `sb.from('notifications').select(...)` quand backend prêt (cf TODO-SQL-010). markAllRead + format date relatif FR.
- [ ] 9.2 Triggers PostgreSQL : **TODO-SQL-010** (RDV confirmé/annulé, rappel J-1 via pg_cron, ordonnance, claim fiche).
- [ ] 9.3 Table `reviews` : **TODO-SQL-011** (schéma + RLS strict appointment.status='completed').
- [ ] 9.4 RLS post-completed : **TODO-SQL-011** (CHECK policy patient_create).
- [ ] 9.5 Affichage moyenne + 5 derniers avis : `js/tabibi-reviews.js` existe déjà côté front. Activable une fois TODO-SQL-011 exécuté + `window.TABIBI_FEATURES.reviews = true`.

## Phase 10 — SEO & analytics (3-5h)
- [ ] 10.1 Régen 490 pages SEO depuis `public_doctors` — **script outil hors live frontend**. À écrire en session séparée (Node.js + fetch public_doctors par batches + template HTML par {wilaya}/{specialty}). Tracked SQL_TODO-002 confirme déjà que la vue retourne noms anonymisés si is_claimed=false → safe pour SEO. Robots.txt désactive déjà `/seo/` jusqu'à régénération propre.
- [x] **10.2** `robots.txt` + `sitemap.xml` — déjà présents et cohérents (Phase 2). 3 sitemaps : static, blog, seo-local. Pas de modification.
- [x] **10.3** Schema.org JSON-LD — **4 blocs déjà présents** dans index.html (Organization, WebSite, FAQPage, LocalBusiness). Pas de modification.
- [x] **10.4** Open Graph + Twitter Cards — **déjà complets** dans index.html (lignes 14-31) : og:type/url/title/description/image (1200x630) + og:locale fr_DZ + alternates ar_DZ/en_US + twitter:card summary_large_image. Pas de modification.
- [x] **10.5** Plausible analytics feature flag — NEW `js/tabibi-analytics.js` qui charge le script Plausible UNIQUEMENT si `TABIBI_FEATURES.analytics=true` ET consent cookies analytics OK. Activation post-création compte Plausible. Cookieless par défaut = RGPD-safe.

## Phase 11 — Mobile & PWA (3-4h)
- [ ] 11.1 Audit responsive (320/375/414/768px) — pas d'outil headless dispo, à faire manuellement via Chrome DevTools Device Toolbar. PROGRESS_AUDIT_PHASE11.md à créer en session future.
- [x] **11.2** `manifest.json` **déjà complet** : 9 icons (72/96/128/144/152/192/384/512 + SVG any), theme/bg `#0F7560`, standalone, scope `/`, start_url `/?pwa=1`, 2 shortcuts (Trouver médecin + Mes RDV). Pas de modification.
- [x] **11.3** Service Worker — **NEW `js/tabibi-sw-register.js`** + inclusion dans index.html. **Fix bug majeur audit P5.4 #5** : sw.js existait depuis Phase 1 mais n'était JAMAIS enregistré nulle part. Toutes les bumps v15→v18 du CACHE_VERSION étaient sans effet runtime. C'est le PREMIER déploiement (v19) où le SW est réellement actif côté client. Skip localhost dev pour ne pas polluer cache pendant développement.
- [x] **11.4** Bouton "Installer l'app" Android — **déjà fait Phase 5.4** (beforeinstallprompt + matchMedia standalone + auto-hide 12s + X visible).
- [x] **11.5** Page offline — **déjà existe** (`offline.html` 2.5 KB, précachée dans sw.js).

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
