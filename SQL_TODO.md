# SQL TODO — Phase 5.2 (à exécuter en session SQL dédiée)

Liste des besoins SQL identifiés pendant Phase 5.2 frontend.
**NE PAS EXÉCUTER** depuis le frontend — tout sera regroupé en fin de mission.

---

## Phase 5.2.3-fix (2026-05-22) — affichage nom médecin

### TODO-SQL-001 : Vérifier que `public_doctors` view expose `entity_type`
**Contexte** : Le helper `js/tabibi-doctor-name.js` (Task 0) conditionne le préfixe "Dr." sur `entity_type` (Médecin → préfixe ; Clinique/Laboratoire/Cabinet → pas de préfixe). On lit cette colonne via `select=*` sur la vue `public_doctors`.

**À vérifier en SQL** :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='public_doctors'
  AND column_name='entity_type';
```
- Si présent : ✅ OK rien à faire.
- Si absent : ajouter `entity_type` au `CREATE VIEW public_doctors` (sans casser les autres consumers).

**Risque sans fix** : `entity_type` arrive undefined côté JS → fallback "Dr." appliqué à tous (y compris cliniques/labos). Régression cosmétique uniquement, pas bloquant.

### TODO-SQL-002 : Investiguer la source de "Dr. م .ي." / "Dr. – . a." dans `full_name`
**Contexte** : Symptôme rapporté Phase 5.2.3-fix : la liste publique affiche des noms garblés ("Dr. م .ي.", "Dr. – . a.") même pour des fiches dont le `full_name` est censé être propre côté DB (ex : "Ouanza Dental Clinic"). Le fix JS (suppression de `_anonymizeName`) affiche désormais `full_name` tel quel — si la VUE elle-même renvoie une string anonymisée, le bug persistera côté affichage.

**À vérifier en SQL** :
```sql
-- 1. Lire la def de la vue
SELECT pg_get_viewdef('public.public_doctors', true);

-- 2. Comparer raw vs view pour un doctor connu
SELECT id, full_name, full_name_ar, entity_type, is_claimed
FROM public.doctor_profiles
WHERE full_name ILIKE '%Ouanza%' OR full_name ILIKE '%Dental%';

SELECT id, full_name, full_name_ar, entity_type, is_claimed
FROM public.public_doctors
WHERE full_name ILIKE '%Ouanza%' OR full_name ILIKE '%Dental%';

-- 3. Échantillon des full_name de fiches non-claim (suspect anonymisation SQL)
SELECT full_name, COUNT(*)
FROM public.public_doctors
WHERE is_claimed = false
GROUP BY full_name
ORDER BY COUNT(*) DESC
LIMIT 20;
```
- Si la vue anonymise via `CASE WHEN is_claimed THEN full_name ELSE initials END` → décider :
  - (a) Désactiver l'anonymisation SQL pour la M0 (RGPD à valider par juriste séparément)
  - (b) Améliorer l'algo d'anonymisation côté SQL pour gérer correctement l'arabe et les noms non-personnels (cliniques/labos affichés tels quels)
- Si la vue retourne `full_name` brut et la donnée DB est mauvaise → cleanup des `doctor_profiles.full_name` (script séparé, scope hors mission).

---

## Phase 5.2.4 (2026-05-22) — mes-rdv.html

### TODO-SQL-003 : Vérifier le schéma exact de `my_upcoming_appointments`
**Contexte** : `mes-rdv.html` utilise `tabibiBooking.listMyAppointments()` qui appelle `select('*').from('my_upcoming_appointments')`. Le code de la page tente plusieurs noms de colonnes pour le nom du médecin (`doctor_full_name`, `full_name`, embedded `doctor.full_name`) et pour la localisation (`cabinet_address`, `consult_type`, etc.). Si le schéma réel ne match aucun de ces fallbacks → la page affichera "Praticien" et "Cabinet" générique pour tout.

**À vérifier en SQL** :
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='my_upcoming_appointments'
ORDER BY ordinal_position;
```
Si la vue n'expose ni `doctor_full_name` ni `full_name`, alimenter la vue avec un JOIN sur `doctor_profiles` exposant au minimum :
- `doctor_full_name` (text)
- `doctor_full_name_ar` (text)
- `doctor_entity_type` (enum, pour le préfixe "Dr.")
- `doctor_specialty_fr` (text)
- `cabinet_address` (text, peut être null)

**Également** : confirmer que la vue retourne TOUS les RDV du patient (pending, confirmed, cancelled, completed, no_show) — pas seulement les "upcoming". Sinon les sections "Passés" / "Annulés" de mes-rdv.html seront toujours vides. Si la vue est restrictive (futur seul), créer une 2e vue `my_all_appointments` ou utiliser `appointments` directement avec un JOIN dans le code.

**Risque sans fix** : sections Passés / Annulés vides + nom médecin = "Praticien" partout.

---

## Phase 5.5 (2026-05-23) — recherche server-side + cards data

### TODO-SQL-004 : ajouter `consultation_fee_dzd` à `public_doctors`
**Contexte** : `loadDoctorCards()` Phase 5.5 affiche "Tarif à confirmer" sur 100 % des cards car la vue n'expose pas la colonne. Filtre client `maxPrice` skippé.

**À vérifier puis ajouter** :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='doctor_profiles'
  AND column_name LIKE '%fee%' OR column_name LIKE '%price%';
-- Si la colonne existe en table source mais pas dans la vue : ALTER VIEW pour l'ajouter
-- Si elle n'existe pas du tout : ALTER TABLE doctor_profiles ADD COLUMN consultation_fee_dzd integer;
```

**Risque sans fix** : UX dégradée (pas de tarif visible avant booking), filtre prix inutilisable.

### TODO-SQL-005 : ajouter `rating` + `review_count` à `public_doctors`
**Contexte** : `loadDoctorCards()` affiche "Pas encore noté" sur 100 % des cards. Chip "4★+" inutilisable. Sort "Mieux notés" tombe sur `full_name.asc`.

**À vérifier puis** :
```sql
-- Probablement déjà calculé depuis la table reviews (Phase 9), à exposer dans la vue
ALTER VIEW public_doctors AS (
  SELECT ..., r.avg_rating AS rating, r.cnt AS review_count
  FROM doctor_profiles dp
  LEFT JOIN (SELECT doctor_id, AVG(rating) avg_rating, COUNT(*) cnt
             FROM reviews GROUP BY doctor_id) r ON r.doctor_id = dp.id
);
```

### TODO-SQL-009 : Paiements Stripe Test + Edge Function webhook (Phase 8.1/8.3)
**Contexte** : `payment.html` (Phase 8.2) affiche les 4 méthodes (espèces, carte, Edahabia, CIB) mais seules les espèces sont actives via feature flag `payments=false`. Quand backend Stripe Test prêt :

1. Créer compte Stripe Test (https://stripe.com)
2. Récupérer clé publique → ajouter à `js/config.js` ou window.TABIBI_CONFIG
3. Créer Edge Function `stripe-webhook` qui :
   - Vérifie signature Stripe-Signature
   - UPDATE `appointments.status` selon event (charge.succeeded → confirmed, charge.failed → cancelled, charge.refunded → cancelled+ refund flag)
4. SQL : ajouter colonnes `appointments.{stripe_session_id, stripe_payment_intent, paid_at, refunded_at}` (toutes nullable)
5. SQL : RLS confirmer que seul service_role (Edge Function) peut UPDATE ces colonnes

**Pour SATIM/Edahabia** : pas d'API sandbox stable disponible en Algérie. À documenter dans `DEPLOY_INSTRUCTIONS.md` pour intégration manuelle quand contrat partenariat signé.

**Après backend prêt** : passer `window.TABIBI_FEATURES.payments = true` + tester E2E.

### TODO-SQL-008 : RPCs téléconsultation Daily.co (Phase 7.1)
**Contexte** : `teleconsultation.html` est entièrement câblé côté front mais appelle 2 RPCs inexistantes en DB (PGRST202 vérifié 2026-05-23) :
- `get_video_session(appointment_id uuid)` — retourne `{room_url, token, session_id, consent_patient_recording, expires_at, ...}`
- `set_video_recording_consent(p_appt uuid, p_consent bool)` — UPDATE le consentement enregistrement

**Frontend bloqué proprement via feature flag** : `window.TABIBI_FEATURES.video = false` dans `js/tabibi-features.js` → la page redirige avec "Bientôt disponible" + CTA Trouver médecin. Aucun appel RPC tenté.

**À créer en SQL (Phase 7 backend session séparée)** :
```sql
-- 1. Colonne per-doctor video_enabled
ALTER TABLE doctor_profiles ADD COLUMN video_enabled boolean DEFAULT false;

-- 2. RPC get_video_session (sécurité : patient_id=auth.uid() ou doctor=auth.uid())
CREATE OR REPLACE FUNCTION public.get_video_session(appointment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
-- ... contracter avec Daily.co côté Edge Function pour générer room+token éphémère
$$;

-- 3. RPC set_video_recording_consent (patient self-update)
CREATE OR REPLACE FUNCTION public.set_video_recording_consent(p_appt uuid, p_consent bool)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
-- UPDATE appointments SET consent_recording=p_consent WHERE id=p_appt AND patient_id=auth.uid();
$$;
```

**Après création SQL** : passer `window.TABIBI_FEATURES.video = true` dans `js/tabibi-features.js` + tester E2E.

### TODO-SQL-007 : Vérifier colonnes profil patient dans table `users` + RLS self-update
**Contexte** : Phase 6.2 sync `patient-profile.html saveAll()` envoie un UPDATE
sur `users` avec ces colonnes — best-effort, fallback si KO :
- `first_name`, `last_name`, `full_name` (✅ vérifiés OK depuis signup index.html L1355)
- `phone`, `birth_date`, `gender`, `lang`, `wilaya_fr`, `address` (❓ non vérifiés)

**À vérifier en SQL** :
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='users'
  AND column_name IN ('phone','birth_date','gender','lang','wilaya_fr','address')
ORDER BY column_name;
```
Si colonne manquante, soit ALTER TABLE pour l'ajouter, soit accepter le
fallback minimal `{first_name, last_name, full_name}` + auth.user_metadata
(qui marche déjà pour le reste).

**RLS** : vérifier que `users` autorise `auth.uid() = id` pour UPDATE
self-profil :
```sql
SELECT polname, polcmd, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename='users';
```
Si pas de policy "users_self_update", l'UPDATE sera silencieusement filtré.
Le fallback `auth.updateUser({data})` (user_metadata) reste actif quoi qu'il arrive.

**Risque sans fix** : les modifications profil patient (téléphone, wilaya, langue)
ne persistent que dans `user_metadata` Supabase Auth, pas dans la table `users`
— certaines requêtes JOIN risquent de ne pas voir les valeurs à jour.

### TODO-SQL-006 : ajouter `entity_type`, `is_urgent`, `gender` à `public_doctors`
**Contexte** :
- `entity_type` ABSENT → préfixe "Dr." appliqué partout (workaround Phase 5.5 : inférence depuis `specialty_slug`)
- `is_urgent` ABSENT → chip "Urgences" inutilisable
- `gender` ABSENT → chip "Femmes" inutilisable

**À vérifier en SQL** :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='doctor_profiles'
  AND column_name IN ('entity_type','is_urgent','gender','sexe');
```
Ajouter les colonnes manquantes à la table source si besoin, puis recréer la vue avec ces colonnes.

**Risque sans fix** : "Dr. Nadia Kidari" pour une pharmacie ; 2 chips de filtre non fonctionnels.

---

## Phase 12 (déjà tracé dans PROGRESS.md, recopié ici pour vue d'ensemble)
- DB hygiène : nettoyer doublon `claim_my_doctor_profile()` sans args
- DB sécurité : aligner `public_doctors`, `public_doctor_full` sur `security_invoker=true`
- Storage : durcir `doctor_photos_select_public` anti-énumération
- Audit log : tracer changements `phone`/`address` via `update_my_doctor_profile`

## Format pour nouveaux ajouts
Numéroter `TODO-SQL-NNN`. Inclure : contexte (quelle Phase a découvert le besoin), commande SQL de vérif, action recommandée, risque si non-traité.
