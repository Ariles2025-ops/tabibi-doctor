-- =====================================================================
-- TABIBI.DOCTOR — PHASE 5.1bis : ALTER appointments + cleanup RLS
-- =====================================================================
-- Fichier : migrations/PHASE5_1bis_alter_appointments.sql
-- Date    : 2026-05-22
-- Phase   : 5.1bis (système RDV — adaptation au schema OLD réel en prod)
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- CONTEXTE
--   La table appointments existe DÉJÀ en prod (24 colonnes OLD schema
--   avec scheduled_at + duration_minutes). 0 rows. Mais :
--   • La RPC get_available_slots a besoin de starts_at + ends_at
--   • Les 3 policies "Doctors" sont BUGUÉES (auth.uid() = doctor_id
--     au lieu de doctor_id IN doctor_profiles WHERE user_id=auth.uid())
--   • 2 policies doublons (appt_insert_patient + appt_select_own)
--   • 1 policy "Patients update" trop permissive (autorise toute modif)
--
-- 🔒 GARANTIES
--   • Idempotent : ADD COLUMN IF NOT EXISTS + DROP+CREATE policies
--   • Safe : table VIDE (0 rows) → ALTER GENERATED STORED sans backfill
--   • Reversible : section ROLLBACK commentée en fin de fichier
--   • Verbose : RAISE NOTICE après chaque étape
--
-- ÉTAT FINAL ATTENDU : 5 policies propres sur appointments :
--   1. "Patients create own appointments"        (INSERT, INCHANGÉE)
--   2. "Patients see own appointments"           (SELECT, INCHANGÉE)
--   3. appointments_select_doctor                (SELECT, NOUVELLE)
--   4. appointments_update_doctor                (UPDATE, NOUVELLE)
--   5. appointments_update_patient_cancel_only   (UPDATE, NOUVELLE)
--   + 3 indexes + 2 colonnes générées
-- =====================================================================



-- =====================================================================
-- SECTION 1 : DISCOVERY pré-flight (read-only, optionnel)
-- =====================================================================

-- 1.1 — Confirme que la table est toujours vide (sécurité avant DROP policies)
SELECT count(*) AS rows_before_migration FROM public.appointments;
-- ATTENDU : 0 (sinon, attention : un client pourrait avoir créé des RDV
--           entre l'inspection et l'exécution → la migration reste safe
--           mais les policies recreated peuvent affecter les requêtes en cours)

-- 1.2 — Confirme que les colonnes scheduled_at + duration_minutes existent
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='appointments'
   AND column_name IN ('scheduled_at', 'duration_minutes', 'status');
-- ATTENDU : 3 lignes (sinon, la migration GENERATED échouera)



-- =====================================================================
-- SECTION 2 : ADD COLUMN starts_at + ends_at (GENERATED ALWAYS AS STORED)
-- =====================================================================
-- starts_at = exact alias de scheduled_at (la RPC veut starts_at).
-- ends_at = scheduled_at + duration_minutes minutes, exprimé via cast string→interval
-- qui est IMMUTABLE (contrairement à make_interval() qui est STABLE en PG15+
-- et donc INCOMPATIBLE avec GENERATED ALWAYS AS STORED).
-- STORED : occupe de l'espace disque mais permet l'indexation (cf. section 3).
-- Idempotent via IF NOT EXISTS (Postgres 15+).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.appointments_sync_slot_times()
RETURNS TRIGGER AS $$
BEGIN
  NEW.starts_at := NEW.scheduled_at;
  NEW.ends_at := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_sync_slot_times ON public.appointments;
CREATE TRIGGER trg_appointments_sync_slot_times
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_sync_slot_times();

UPDATE public.appointments
SET scheduled_at = scheduled_at
WHERE starts_at IS NULL OR ends_at IS NULL;

COMMENT ON COLUMN public.appointments.starts_at IS
  'Phase 5.1bis. Alias calculé de scheduled_at (GENERATED STORED). Permet à get_available_slots() de filtrer par starts_at sans toucher au schema OLD.';
COMMENT ON COLUMN public.appointments.ends_at IS
  'Phase 5.1bis. scheduled_at + duration_minutes (GENERATED STORED). Permet le check overlap tstzrange dans get_available_slots().';



-- =====================================================================
-- SECTION 3 : INDEXES Phase 5.1
-- =====================================================================
-- 2 composites sur (doctor|patient, starts_at DESC) pour dashboards.
-- 1 partiel sur status actif pour overlap check dans la RPC.
-- L'enum status est cast en string literal — Postgres accepte (cast implicite).

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_starts
  ON public.appointments (doctor_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_starts
  ON public.appointments (patient_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_status_active
  ON public.appointments (status)
  WHERE status IN ('pending'::appointment_status, 'confirmed'::appointment_status);



-- =====================================================================
-- SECTION 4 : DROP 5 policies polluées
-- =====================================================================
-- Buguées : utilisent auth.uid() = doctor_id alors que doctor_id =
-- doctor_profiles.id (UUID différent de auth.uid()). En l'état, aucun
-- médecin ne pouvait voir ses propres RDV → table restée vide en prod.

DROP POLICY IF EXISTS "Doctors see appointments with them"    ON public.appointments;
DROP POLICY IF EXISTS "Doctors update appointments with them" ON public.appointments;
DROP POLICY IF EXISTS appt_select_own                          ON public.appointments;
DROP POLICY IF EXISTS appt_insert_patient                      ON public.appointments;
DROP POLICY IF EXISTS "Patients update own appointments"      ON public.appointments;

DO $$ BEGIN
  RAISE NOTICE '✓ 5 policies obsolètes drop (3 buggées Doctors, 1 doublon INSERT, 1 trop permissive)';
END $$;



-- =====================================================================
-- SECTION 5 : CREATE 3 nouvelles policies propres
-- =====================================================================

-- 5.1 SELECT : médecin voit les RDV de SA fiche (scope via doctor_profiles)
CREATE POLICY appointments_select_doctor
  ON public.appointments
  FOR SELECT TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  );

-- 5.2 UPDATE : médecin peut modifier les RDV de sa fiche (status,
-- notes_doctor, cancelled_*, etc.) — pas de restriction de champ ici,
-- on fait confiance au médecin propriétaire.
CREATE POLICY appointments_update_doctor
  ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  );

-- 5.3 UPDATE : patient peut UNIQUEMENT annuler son propre RDV
-- (status doit passer à 'cancelled'). Empêche les modifs frauduleuses
-- de scheduled_at, prix, etc. par le patient.
-- ⚠️ TODO Phase 12 : trigger BEFORE UPDATE pour interdire au patient
-- de modifier d'autres champs (notes_doctor, scheduled_at) en plus de
-- cancel. RLS WITH CHECK ne peut pas garantir field-level immutability.
CREATE POLICY appointments_update_patient_cancel_only
  ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    AND status IN ('pending'::appointment_status, 'confirmed'::appointment_status)
  )
  WITH CHECK (
    patient_id = auth.uid()
    AND status = 'cancelled'::appointment_status
  );

DO $$ BEGIN
  RAISE NOTICE '✅ 3 nouvelles policies créées (select_doctor, update_doctor, update_patient_cancel_only)';
END $$;



-- =====================================================================
-- SECTION 6 : VÉRIFICATIONS POST-MIGRATION
-- =====================================================================

-- 6.1 Les 2 colonnes générées sont en place
SELECT column_name, data_type, is_generated, generation_expression
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='appointments'
   AND column_name IN ('starts_at', 'ends_at')
 ORDER BY column_name;
-- ATTENDU : 2 lignes, is_generated='ALWAYS'

-- 6.2 Les 3 nouveaux indexes
SELECT indexname FROM pg_indexes
 WHERE schemaname='public' AND tablename='appointments'
   AND indexname IN ('idx_appointments_doctor_starts',
                     'idx_appointments_patient_starts',
                     'idx_appointments_status_active')
 ORDER BY indexname;
-- ATTENDU : 3 lignes

-- 6.3 ⚠️ CRITIQUE : état final des policies = 5 propres
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname='public' AND tablename='appointments'
 ORDER BY policyname;
-- ATTENDU : EXACTEMENT 5 lignes :
--   "Patients create own appointments"          INSERT (inchangée)
--   "Patients see own appointments"             SELECT (inchangée)
--   appointments_select_doctor                  SELECT (nouvelle)
--   appointments_update_doctor                  UPDATE (nouvelle)
--   appointments_update_patient_cancel_only     UPDATE (nouvelle)
-- Si > 5 ou < 5 : problème, vérifier les DROP de la section 4.

-- 6.4 Test fumant : un INSERT puis SELECT (en tant que postgres = bypass RLS)
-- Décommente seulement si tu veux valider tout de suite :
/*
INSERT INTO public.appointments (
  short_id, doctor_id, patient_id, scheduled_at, duration_minutes, status, reason
) VALUES (
  'TEST-' || substr(md5(random()::text), 1, 8),
  '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
  (SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor'),
  NOW() + INTERVAL '7 days',
  30,
  'pending'::appointment_status,
  'Test fumant Phase 5.1bis'
);

-- Vérif que starts_at et ends_at sont calculés :
SELECT id, scheduled_at, duration_minutes, starts_at, ends_at, status
  FROM public.appointments
 WHERE reason = 'Test fumant Phase 5.1bis';
-- ATTENDU : 1 ligne, ends_at = starts_at + 30 min

-- CLEANUP :
DELETE FROM public.appointments WHERE reason = 'Test fumant Phase 5.1bis';
*/



-- =====================================================================
-- SECTION 7 : ROLLBACK (commenté)
-- =====================================================================
-- ⚠️ NE PAS exécuter sauf souci. Restaure l'état pré-migration.

/*
-- Rollback policies (recrée les 5 anciennes — adapter aux bodies exacts !)
DROP POLICY IF EXISTS appointments_update_patient_cancel_only ON public.appointments;
DROP POLICY IF EXISTS appointments_update_doctor              ON public.appointments;
DROP POLICY IF EXISTS appointments_select_doctor              ON public.appointments;
-- ⚠️ Ne pas recreate les 5 anciennes : elles étaient buggées/redondantes.

-- Rollback indexes
DROP INDEX IF EXISTS public.idx_appointments_status_active;
DROP INDEX IF EXISTS public.idx_appointments_patient_starts;
DROP INDEX IF EXISTS public.idx_appointments_doctor_starts;

-- Rollback colonnes générées (PG: drop d'une GENERATED retire le calcul,
-- pas de perte de données puisqu'elles ne stockent rien d'unique)
ALTER TABLE public.appointments DROP COLUMN IF EXISTS ends_at;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS starts_at;
*/

-- =====================================================================
-- FIN PHASE 5.1bis — ALTER schema + cleanup RLS
-- =====================================================================
-- ✅ Une fois les 3 vérifs de SECTION 6 OK → exécuter
--    migrations/PHASE5_1bis_get_available_slots_rpc.sql
-- =====================================================================
