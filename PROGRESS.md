# 📊 TABIBI.DOCTOR — PROGRESS V1 (master prompt 13 phases)

> **Démarré** : 2026-05-21
> **Repo** : `~/Downloads/tabibi-FINAL-v4-extracted/`
> **Site preview** : https://superb-manatee-a950c4.netlify.app
> **Domaine cible** : tabibi.doctor (Phase 13)
> **Méthode** : phase par phase, validation "OK go" entre chaque (choix A).

---

## Phase 1 — Patch bandeau claim + signup médecin (4-6h) — **EN COURS**

- [x] 1.0 Baseline `_mapSupabaseDoctor` + `_renderNotFound` (livré session précédente v3)
- [ ] 1.1 `doctor-profile.html` : bandeau interactif câblé sur RPC `claim_my_doctor_profile`
  - [ ] Mapper `legacy_id` dans `_mapSupabaseDoctor`
  - [ ] Remplacer `<a href>` par `<button onclick>` avec routing 3 cas
  - [ ] Inclure `js/tabibi-claim.js`
- [ ] 1.2 `signup.html` : auto-claim post-signup si `?claim_legacy_id=` présent
  - [ ] Lecture query string
  - [ ] Appel RPC AVANT signOut médecin
  - [ ] Fallback `localStorage.tabibi_pending_claim_legacy_id` si fail
- [ ] 1.3 `js/tabibi-claim.js` (nouveau) : logique partagée 3 cas + handler erreurs
- [ ] 1.4 `tests/manual/CLAIM_FLOW_TESTS.md` : 4 scénarios E2E à exécuter user-side
- [ ] 1.5 Commit `phase1: bandeau claim + signup auto-claim`
- [ ] 1.6 ZIP intermédiaire pour deploy preview Netlify

## Phase 2 — Audit prod & fix bugs (4-8h)
- [ ] 2.1 Audit frontend : liens cassés, console errors, requêtes échouées
- [ ] 2.2 Vérif requêtes Supabase → `public_doctors` only (jamais `doctor_profiles`)
- [ ] 2.3 Lighthouse ≥ 80 sur 5 pages clés (Perf, A11y, SEO, Best Practices)
- [ ] 2.4 Fix bugs P0/P1 + `AUDIT_REPORT.md`

## Phase 3 — Pages légales `/legal/` + RGPD (2-3h)
- [ ] 3.1 Déplacement `cgu.html` → `legal/cgu.html` (+ 4 autres)
- [ ] 3.2 Netlify rewrites 301 pour anciennes URLs (préservation SEO)
- [ ] 3.3 Footer global avec liens
- [ ] 3.4 Bandeau cookies minimaliste (essentiels only)
- [ ] 3.5 Nouvelle page `legal/dpa.html` (Data Processing Agreement médecins)

## Phase 4 — Dashboard médecin complet (8-12h)
- [ ] 4.1 Vue d'ensemble (prochains RDV, demandes, stats)
- [ ] 4.2 Édition fiche complète (photo, bio, langues, tarif, chifa/cb, horaires JSONB)
- [ ] 4.3 Gestion disponibilités (slots libres/bloqués 30 jours)
- [ ] 4.4 Liste RDV (à venir / passés / annulés)
- [ ] 4.5 Téléconsultation toggle + paramètres
- [ ] 4.6 Upload photo via Supabase Storage `doctor-photos` (RLS strict)
- [ ] 4.7 RLS policies : médecin édite QUE sa fiche

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
