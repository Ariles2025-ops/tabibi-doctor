**Version** : 1.0
**Date** : 27 mai 2026
**Auteur** : Audit Playwright — Tabibi.doctor

---

# Inventaire exhaustif — Tabibi.doctor

## Méthodologie

- Analyse **statique** (find / grep) du dépôt sur la branche `audit/full-quality-sept2026`.
- Aucune action contre la production. Tests dynamiques contre staging `effulgent-kelpie-e48e81.netlify.app`.

## A. Pages HTML

### Pages applicatives (racine — 38)

| Page | Catégorie | Boutons/onclick (statique) |
|---|---|---|
| `index.html` | Vitrine + recherche | 42 |
| `about.html` | Info | n/a |
| `signup.html` | Auth | 7 |
| `login.html` | Auth | (modale principale) |
| `forgot-password.html` | Auth | — |
| `reset-password.html` | Auth | — |
| `verify-email.html`, `email-verified.html` | Auth | — |
| `patient-dashboard.html` | Patient | 71 ⚠️ |
| `patient-profile.html` | Patient | 28 |
| `patient-ordonnances.html` | Patient | 11 |
| `patient-waitinglist.html` | Patient | — |
| `mes-rdv.html` | Patient | 7 |
| `reservation.html` | Patient | 12 |
| `appointment.html` | Patient | 4 |
| `payment.html` | Patient | — |
| `notifications.html` | Patient | — |
| `doctor-dashboard.html` | Médecin | 37 |
| `doctor-profile.html` | Médecin (lecture) | 7 |
| `doctor-claim.html` | Médecin | 4 |
| `doctor-analytics.html` | Médecin | 4 |
| `doctor-reservation.html` | Médecin | 14 |
| `medecin-profile.html` | Médecin (édition) | 32 |
| `medecin-ordonnance.html` | Médecin | 7 |
| `medecin-waitinglist.html` | Médecin | — |
| `onboarding-medecin.html` | Médecin | 10 |
| `verify-prescription.html` | Médecin | — |
| `admin-dashboard.html` | Admin | 27 |
| `admin-doctor-validation.html` | Admin | 24 |
| `admin-reviews.html` | Admin | 7 |
| `admin-cabinet.html` | Admin | 6 |
| `admin-api-keys.html` | Admin | 9 |
| `secretaire-dashboard.html` | Secrétaire | 9 |
| `teleconsultation.html` | Téléconsult | 3 |
| `waiting-list.html` | Marketing | 6 |
| `api-docs.html` | Docs | 4 |
| `404.html`, `offline.html` | Erreur | — |
| `blog/index.html` | Contenu | — |
| `legal/*.html` (6 docs) | Légal | — |

### Pages SEO programmatiques

- **490 pages** SEO générées (wilaya × spécialité) dans `seo/`.

---

## B. Fichiers JavaScript (`js/` — 33 fichiers)

| Fichier | Rôle inféré |
|---|---|
| `api.js` | Façade endpoint custom |
| `auth.js` | Auth Supabase (session, getUser) |
| `config.js` | Constantes (URL Supabase, anon key) |
| `doctors-display.js` | Affichage cartes médecins |
| `login-handler.js` | Handler form login |
| `supabase-client.js` | Initialisation client Supabase |
| `tabibi-2fa.js` | Double authentification |
| `tabibi-analytics.js` | Tracking événements |
| `tabibi-avatar.js` | Avatar utilisateur |
| `tabibi-beta.js` | Flags feature beta |
| `tabibi-booking.js` | Prise de RDV (RPC `get_available_slots`) |
| `tabibi-brevo.js` | Emails transactionnels Brevo |
| `tabibi-bridge.js` | Pont compatibilité |
| `tabibi-claim.js` | Claim médecin (RPC `claim_my_doctor_profile`) |
| `tabibi-cookies.js` | Bannière cookies |
| `tabibi-doc-upload.js` | Upload documents |
| `tabibi-doctor-dashboard.js` | Dashboard médecin (RPC `get_my_doctor_profile`, `update_my_doctor_profile`) |
| `tabibi-doctor-name.js` | Composant nom médecin |
| `tabibi-features.js` | Feature flags |
| `tabibi-footer.js` | Footer global |
| `tabibi-i18n.js` | Internationalisation |
| `tabibi-lang.js` | Sélecteur langue |
| `tabibi-legal-version.js` | Versioning docs légaux |
| `tabibi-network.js` | Wrapper fetch (timeout, retry) |
| `tabibi-pii-migration.js` | PII chiffrement (`upsert_patient_medical_data`) |
| `tabibi-prelang.js` | Pré-chargement i18n |
| `tabibi-reviews.js` | Reviews (RPC `can_review_doctor`) |
| `tabibi-security.js` | Headers et anti-XSS côté client |
| `tabibi-sentry.js` | Sentry error tracking |
| `tabibi-seo-anonymize.js` | Anonymisation pages SEO |
| `tabibi-sms.js` | SMS (envoi) |
| `tabibi-sw-register.js` | Service Worker register |
| `tabibi-turnstile.js` | Captcha Cloudflare Turnstile |

---

## C. Tables Supabase référencées (côté front)

```
appointments
doctor_profiles
doctor_ratings_summary
doctor_reviews_public
doctor_unavailable_slots
my_reviewable_appointments
my_upcoming_appointments
public_doctors
review_reports
reviews
specialties
users
wilayas
```

Détecté **13 tables/vues** côté front. À cross-checker avec dump SQL pour les vues matérialisées et tables non visibles côté front (`claim_requests`, `audit_log`, etc.).

---

## D. RPC Supabase appelées

| RPC | Fichier appelant | Usage |
|---|---|---|
| `claim_my_doctor_profile(legacy_id_input)` | `tabibi-claim.js:96` | Réclamation d'une fiche |
| `can_review_doctor(p_doctor_id)` | `tabibi-reviews.js:125` | Vérif éligibilité avis |
| `get_available_slots(...)` | `tabibi-booking.js:251` | Créneaux disponibles |
| `get_my_doctor_profile()` | `tabibi-doctor-dashboard.js:75` | Récup profil médecin |
| `update_my_doctor_profile(params)` | `tabibi-doctor-dashboard.js:96` | MAJ profil médecin |
| `upsert_patient_medical_data(payload)` | `tabibi-pii-migration.js:125,172` | PII chiffrées |
| `get_patient_medical_data()` | `tabibi-pii-migration.js:155` | Lecture PII |

---

## E. Auth Supabase — méthodes utilisées

| Méthode | Occurrences |
|---|---|
| `auth.getSession` | 14 |
| `auth.getUser` | 3 |
| `auth.signUp` | 2 |
| `auth.signOut` | 1 |
| `auth.signInWithPassword` | 1 |

> ⚠️ Très peu d'occurrences d'`auth.signInWithPassword` (1) — probablement centralisé dans `login-handler.js`.

---

## F. Migrations SQL (`migrations/` — `n` fichiers)

```
PHASE4 — doctor_dashboard
PHASE4B — claim RPC + working hours + seed
PHASE5_1bis — appointments overlap exclusion, get_available_slots RPC, alter appointments
PHASE5_2 — appointments unique constraint
PHASE16_5 — fix signup role, hide unclaimed, rollback, upload docs
```

Plus de migrations à dénombrer manuellement (voir `migrations/` complet).

---

## G. Patterns d'interaction frontend

- **Formulaires onsubmit** : `doLogin`, `doSignup`, `handleLogin`, `handleSignup`, `goSearch`, `submitCreate`, `submitPartnerRequest`, `saveCabinetInfo`.
- **Modales** : `modal-bg`, `modal-sheet`, `modal-create`, `book-modal`, `add-modal`, `modal-create`.
- **Wrapper fetch** : `tabibiFetch` (`js/tabibi-network.js`).
- **i18n** : `tabibiT(key, fallback)` — système custom.

---

## H. Limites de l'inventaire

- ❌ Les RLS policies / triggers Supabase ne sont pas tous dans les migrations versionnées (à confirmer via dump prod).
- ❌ Les endpoints custom Netlify Functions (s'ils existent) n'ont pas été inventoriés (chercher `netlify/functions/`).
- ❌ Le code JS minifié dans `dist/` (s'il existe) n'a pas été parcouru.

---

## I. Priorités test (basé sur cet inventaire)

### Critiques (à couvrir en priorité)

1. **patient-dashboard.html** — 71 interactions, page critique post-login patient
2. **doctor-dashboard.html** — 37 interactions, page critique post-login médecin
3. **medecin-profile.html** — 32 interactions, profil médecin éditable
4. **index.html** — 42 interactions, point d'entrée principal
5. **admin-dashboard.html** — 27 interactions, surface admin

### Flows critiques (E2E)

| Flow | Surface couverte |
|---|---|
| Signup patient | `signup.html` + `auth.signUp` + insertion `users` |
| Login patient | `login.html` + `auth.signInWithPassword` |
| Recherche médecin | `index.html` + tables `public_doctors`, `specialties`, `wilayas` |
| Prise RDV | `reservation.html` + RPC `get_available_slots` + insertion `appointments` |
| Claim WhatsApp | `doctor-profile.html` + lien `wa.me/213777169074` |
| Dashboard médecin | RPC `get_my_doctor_profile`, `update_my_doctor_profile` |
| Dashboard admin | `admin-dashboard.html` |
