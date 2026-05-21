-- =====================================================================
-- TABIBI.DOCTOR — PHASE 4.A v2 : MIGRATIONS DASHBOARD MÉDECIN
-- =====================================================================
-- Fichier   : migrations/PHASE4_doctor_dashboard_v2.sql
-- Date      : 2026-05-21
-- Cible     : Supabase Pro EU (postgres 15+)
-- Révision  : v2
--   - v1 utilisait un nom de table halluciné `public_doctors_master`
--   - v2 cible la vraie table `doctor_profiles` (35 colonnes existantes)
--   - v2 NE TOUCHE PAS aux 3 RLS existantes sur doctor_profiles
--   - v2 vue public_doctor_full = JOIN sur public_doctors (heritage anon)
--
-- ⚠️  CONSIGNES STRICTES
--   1. Exécute SECTION PAR SECTION dans le SQL Editor de Supabase
--   2. NE TOUCHE PAS aux 3 RLS existantes sur doctor_profiles
--      ("Admins do anything", "Anyone can read active", "Doctors can update own")
--   3. NE TOUCHE PAS à la vue public_doctors ni à claim_my_doctor_profile
--   4. Idempotent : safe à re-run
--
-- 🗂️  PLAN
--   SECTION 0  : DISCOVERY pré-flight (3 vérifs rapides)
--   SECTION 1  : Ajouter 3 colonnes (telehealth_enabled, telehealth_fee_dzd, accepts_cash)
--   SECTION 2  : Table doctor_unavailable_slots NEW
--   SECTION 3  : RLS doctor_unavailable_slots (4 policies, n'affecte pas doctor_profiles)
--   SECTION 4  : Vue public_doctor_full (additive, JOIN sur public_doctors)
--   SECTION 5  : Bucket storage doctor-photos
--   SECTION 6  : RLS storage.objects pour doctor-photos
--   SECTION 7  : Trigger updated_at (à exécuter SEULEMENT si discovery confirme)
--   SECTION 8  : 2 RPCs (get_my_doctor_profile, update_my_doctor_profile)
--   SECTION 9  : Vérifications post-migration (10 checks dont 2 critiques)
--   SECTION 10 : Rollback (commenté)
-- =====================================================================



-- =====================================================================
-- SECTION 0 : DISCOVERY PRÉ-FLIGHT (READ-ONLY, 3 vérifs)
-- =====================================================================

-- 0.1 — Confirme que les 3 colonnes Phase 4 sont bien ABSENTES
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='doctor_profiles'
   AND column_name IN ('telehealth_enabled','telehealth_fee_dzd','accepts_cash');
-- ATTENDU : 0 ligne (sinon, on adapte la section 1)

-- 0.2 — Confirme qu'aucun trigger ne gère déjà updated_at
SELECT tgname
  FROM pg_trigger
 WHERE tgrelid = 'public.doctor_profiles'::regclass
   AND NOT tgisinternal;
-- Si vide → exécuter SECTION 7
-- Si un trigger nommé "*updated_at*" ou "*bump*" → SKIP SECTION 7

-- 0.3 — Confirme l'absence du bucket doctor-photos
SELECT id FROM storage.buckets WHERE id='doctor-photos';
-- ATTENDU : 0 ligne



-- =====================================================================
-- SECTION 1 : COLONNES MANQUANTES (3 seulement)
-- =====================================================================
-- Vérifié contre les 35 cols existantes : bio, languages, accepts_card,
-- accepts_chifa, working_hours, photo_url, consultation_fee_dzd, rating,
-- review_count → DÉJÀ PRÉSENTES, on ne touche pas.

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS telehealth_enabled  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS telehealth_fee_dzd  INTEGER,
  ADD COLUMN IF NOT EXISTS accepts_cash        BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.doctor_profiles.telehealth_enabled IS
  'Téléconsultation Daily.co activée par le médecin';
COMMENT ON COLUMN public.doctor_profiles.telehealth_fee_dzd IS
  'Tarif téléconsultation distinct (si NULL, on retombe sur consultation_fee_dzd)';
COMMENT ON COLUMN public.doctor_profiles.accepts_cash IS
  'Paiement espèces accepté (complète accepts_card et accepts_chifa). Signal explicite utile (certains cabinets refusent le cash)';



-- =====================================================================
-- SECTION 2 : TABLE doctor_unavailable_slots NEW
-- =====================================================================
-- Blocages exceptionnels en surcouche du working_hours hebdo.

CREATE TABLE IF NOT EXISTS public.doctor_unavailable_slots (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID         NOT NULL,
  starts_at   TIMESTAMPTZ  NOT NULL,
  ends_at     TIMESTAMPTZ  NOT NULL,
  reason      TEXT,
  all_day     BOOLEAN      NOT NULL DEFAULT false,
  created_by  UUID         DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT  doctor_unavailable_slots_chrono CHECK (ends_at > starts_at)
);

-- FK séparée pour résilience
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema='public'
       AND table_name='doctor_unavailable_slots'
       AND constraint_name='doctor_unavailable_slots_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.doctor_unavailable_slots
      ADD CONSTRAINT doctor_unavailable_slots_doctor_id_fkey
      FOREIGN KEY (doctor_id)
      REFERENCES public.doctor_profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dus_doctor_starts
  ON public.doctor_unavailable_slots (doctor_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_dus_active
  ON public.doctor_unavailable_slots (starts_at)
  WHERE ends_at > NOW();

COMMENT ON TABLE public.doctor_unavailable_slots IS
  'Créneaux bloqués au cas par cas (vacances, formations). Override working_hours.';
COMMENT ON COLUMN public.doctor_unavailable_slots.all_day IS
  'Si true, ignore l''heure dans starts_at/ends_at (date entière bloquée)';



-- =====================================================================
-- SECTION 3 : RLS doctor_unavailable_slots
-- =====================================================================
-- ⚠️ Ces policies sont sur la NOUVELLE table. Les 3 policies existantes
--    sur doctor_profiles restent INTACTES.
-- ⚠️ Le scoping passe par JOIN doctor_profiles WHERE user_id = auth.uid()
--    (cohérent avec la policy "Doctors can update their own profile").

ALTER TABLE public.doctor_unavailable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_unavailable_slots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dus_select_public ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_insert_owner  ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_update_owner  ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_delete_owner  ON public.doctor_unavailable_slots;

-- 3.1 SELECT public (nécessaire pour le booking : patient doit voir les blocages)
CREATE POLICY dus_select_public
  ON public.doctor_unavailable_slots
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3.2 INSERT : owner = médecin lié à la fiche (user_id = auth.uid())
CREATE POLICY dus_insert_owner
  ON public.doctor_unavailable_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
       WHERE dp.id = doctor_unavailable_slots.doctor_id
         AND dp.user_id = auth.uid()
    )
  );

-- 3.3 UPDATE owner
CREATE POLICY dus_update_owner
  ON public.doctor_unavailable_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
       WHERE dp.id = doctor_unavailable_slots.doctor_id
         AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
       WHERE dp.id = doctor_unavailable_slots.doctor_id
         AND dp.user_id = auth.uid()
    )
  );

-- 3.4 DELETE owner
CREATE POLICY dus_delete_owner
  ON public.doctor_unavailable_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
       WHERE dp.id = doctor_unavailable_slots.doctor_id
         AND dp.user_id = auth.uid()
    )
  );



-- =====================================================================
-- SECTION 4 : VUE public_doctor_full (additive, ne touche pas public_doctors)
-- =====================================================================
-- Stratégie : JOIN sur public_doctors (qui porte déjà l'anonymisation
-- Phase 0) + ajout des champs éditables additionnels. Si public_doctors
-- évolue (regen Phase 10), public_doctor_full bénéficie automatiquement.
--
-- [AJ1 — décision user] : PAS de security_invoker=true pour rester aligné
-- sur public_doctors (qui n'a pas cet attribut en Phase 0).
-- → TODO Phase 12 (monitoring & sécurité) : aligner les 2 vues sur
--   security_invoker=true (recommandation sécurité Postgres 15+).

CREATE OR REPLACE VIEW public.public_doctor_full AS
SELECT
  -- Tous les champs déjà anonymisés de public_doctors
  pd.*,
  -- Champs additionnels lus directement depuis doctor_profiles
  -- (ces champs ne sont PAS de la PII : tarifs, langues, équipements)
  dp.bio,
  dp.languages,
  dp.consultation_fee_dzd,
  dp.accepts_chifa,
  dp.accepts_card,
  dp.accepts_cash,
  dp.working_hours,
  dp.telehealth_enabled,
  dp.telehealth_fee_dzd,
  dp.photo_url,
  dp.rating,
  dp.review_count,
  dp.updated_at
FROM public.public_doctors pd
JOIN public.doctor_profiles dp ON dp.id = pd.id;

COMMENT ON VIEW public.public_doctor_full IS
  'Vue publique enrichie (Phase 4). public_doctors + champs editables (bio, photo, horaires, paiements, telehealth). Anonymisation heritee de public_doctors via JOIN.';

GRANT SELECT ON public.public_doctor_full TO anon, authenticated;



-- =====================================================================
-- SECTION 5 : BUCKET storage doctor-photos
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doctor-photos',
  'doctor-photos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;



-- =====================================================================
-- SECTION 6 : RLS storage.objects pour doctor-photos
-- =====================================================================
-- Convention path : <auth.uid()>/<filename>

DROP POLICY IF EXISTS doctor_photos_select_public ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_insert_owner  ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_update_owner  ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_delete_owner  ON storage.objects;

-- [AJ2 — décision user] : SELECT public OK pour V1 (bucket déclaré public,
-- photos profils visibles sur fiches). TODO Phase 12 : durcir si on veut
-- empêcher l'énumération anonyme des paths (p.ex. policy basée sur un
-- referer header ou signature courte URL côté API).
CREATE POLICY doctor_photos_select_public
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'doctor-photos');

CREATE POLICY doctor_photos_insert_owner
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY doctor_photos_update_owner
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY doctor_photos_delete_owner
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );



-- =====================================================================
-- SECTION 7 : TRIGGER updated_at (CONDITIONNEL)
-- =====================================================================
-- ⚠️ N'EXÉCUTER QUE SI section 0.2 a retourné 0 ligne.
-- Si un trigger gère déjà updated_at, SKIP cette section.

CREATE OR REPLACE FUNCTION public.tg_bump_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doctor_profiles_bump_updated_at
  ON public.doctor_profiles;

CREATE TRIGGER trg_doctor_profiles_bump_updated_at
  BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_bump_updated_at();



-- =====================================================================
-- SECTION 8 : 2 RPCs (lecture + update sécurisé)
-- =====================================================================

-- 8.1 get_my_doctor_profile() — retourne le row complet du médecin connecté
CREATE OR REPLACE FUNCTION public.get_my_doctor_profile()
RETURNS public.doctor_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
    FROM public.doctor_profiles
   WHERE user_id = auth.uid()
   LIMIT 1;
$$;

REVOKE ALL    ON FUNCTION public.get_my_doctor_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_doctor_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_doctor_profile() IS
  'Retourne le row doctor_profiles lié à auth.uid(). NULL si l''utilisateur n''a pas (encore) réclamé de fiche.';


-- 8.2 update_my_doctor_profile(...) — update partiel sécurisé
--     NE peut PAS modifier : id, user_id, entity_type, full_name, is_claimed,
--     is_verified, is_active, source, created_at, claimed_at, legacy_id,
--     specialty_id, wilaya_code, search_vector
--
-- [D5 — décision user] : phone et address modifiables côté médecin.
-- → TODO Phase 12 (monitoring & sécurité) : ajouter un audit log spécifique
--   sur les changements de phone et address (changements à risque fraude :
--   un attaquant qui prend le compte pourrait rediriger les patients).
CREATE OR REPLACE FUNCTION public.update_my_doctor_profile(
  p_bio                 TEXT      DEFAULT NULL,
  p_languages           TEXT[]    DEFAULT NULL,
  p_consultation_fee    INT       DEFAULT NULL,
  p_accepts_chifa       BOOLEAN   DEFAULT NULL,
  p_accepts_card        BOOLEAN   DEFAULT NULL,
  p_accepts_cash        BOOLEAN   DEFAULT NULL,
  p_working_hours       JSONB     DEFAULT NULL,
  p_telehealth_enabled  BOOLEAN   DEFAULT NULL,
  p_telehealth_fee      INT       DEFAULT NULL,
  p_photo_url           TEXT      DEFAULT NULL,
  p_phone               TEXT      DEFAULT NULL,
  p_address             TEXT      DEFAULT NULL
)
RETURNS public.doctor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor public.doctor_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Validations
  IF p_consultation_fee IS NOT NULL AND p_consultation_fee < 0 THEN
    RAISE EXCEPTION 'invalid_fee' USING ERRCODE = '22023';
  END IF;
  IF p_telehealth_fee IS NOT NULL AND p_telehealth_fee < 0 THEN
    RAISE EXCEPTION 'invalid_telehealth_fee' USING ERRCODE = '22023';
  END IF;
  IF p_bio IS NOT NULL AND length(p_bio) > 2000 THEN
    RAISE EXCEPTION 'bio_too_long' USING ERRCODE = '22023';
  END IF;
  IF p_working_hours IS NOT NULL AND jsonb_typeof(p_working_hours) <> 'object' THEN
    RAISE EXCEPTION 'working_hours_not_object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.doctor_profiles d
     SET bio                  = COALESCE(p_bio,                d.bio),
         languages            = COALESCE(p_languages,          d.languages),
         consultation_fee_dzd = COALESCE(p_consultation_fee,   d.consultation_fee_dzd),
         accepts_chifa        = COALESCE(p_accepts_chifa,      d.accepts_chifa),
         accepts_card         = COALESCE(p_accepts_card,       d.accepts_card),
         accepts_cash         = COALESCE(p_accepts_cash,       d.accepts_cash),
         working_hours        = COALESCE(p_working_hours,      d.working_hours),
         telehealth_enabled   = COALESCE(p_telehealth_enabled, d.telehealth_enabled),
         telehealth_fee_dzd   = COALESCE(p_telehealth_fee,     d.telehealth_fee_dzd),
         photo_url            = COALESCE(p_photo_url,          d.photo_url),
         phone                = COALESCE(p_phone,              d.phone),
         address              = COALESCE(p_address,            d.address)
   WHERE d.user_id = auth.uid()
   RETURNING * INTO v_doctor;

  IF v_doctor.id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found_or_not_claimed' USING ERRCODE = '42501';
  END IF;

  RETURN v_doctor;
END;
$$;

REVOKE ALL    ON FUNCTION public.update_my_doctor_profile(TEXT, TEXT[], INT, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_doctor_profile(TEXT, TEXT[], INT, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, INT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_my_doctor_profile IS
  'Update partiel securise du doctor_profiles courant (Phase 4). Tous params NULL = inchanges. Erreurs : not_authenticated, invalid_fee, bio_too_long, working_hours_not_object, profile_not_found_or_not_claimed.';



-- =====================================================================
-- SECTION 9 : VÉRIFICATIONS POST-MIGRATION (10 checks)
-- =====================================================================

-- 9.1 Les 3 nouvelles colonnes sont en place
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='doctor_profiles'
   AND column_name IN ('telehealth_enabled','telehealth_fee_dzd','accepts_cash')
 ORDER BY column_name;
-- ATTENDU : 3 lignes

-- 9.2 Table doctor_unavailable_slots + son FK
SELECT con.conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
 WHERE c.relname = 'doctor_unavailable_slots';
-- ATTENDU : 3 lignes (PK, FK ON DELETE CASCADE, CHECK chrono)

-- 9.3 Policies sur doctor_unavailable_slots
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname='public' AND tablename='doctor_unavailable_slots'
 ORDER BY policyname;
-- ATTENDU : 4 lignes

-- 9.4 ⚠️ CRITIQUE : policies doctor_profiles INCHANGÉES
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname='public' AND tablename='doctor_profiles'
 ORDER BY policyname;
-- ATTENDU : EXACTEMENT les 3 mêmes qu'avant :
--   "Admins do anything on doctor_profiles"
--   "Anyone can read active doctor profiles"
--   "Doctors can update their own profile"

-- 9.5 Vue public_doctor_full créée
SELECT count(*) AS rows_in_full_view FROM public.public_doctor_full;
-- ATTENDU : ~14 508 (= count public_doctors, sans perte de ligne via le JOIN)

-- 9.6 Bucket doctor-photos
SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id='doctor-photos';
-- ATTENDU : 1 ligne, public=true, file_size_limit=2097152

-- 9.7 Policies storage doctor-photos
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects'
   AND policyname LIKE 'doctor_photos_%'
 ORDER BY policyname;
-- ATTENDU : 4 lignes

-- 9.8 RPCs Phase 4
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace='public'::regnamespace
   AND proname IN ('get_my_doctor_profile','update_my_doctor_profile','tg_bump_updated_at')
 ORDER BY proname;
-- ATTENDU : 3 lignes (ou 2 si trigger skip en section 0.2)

-- 9.9 ⚠️ CRITIQUE : RPC intouchable INTACTE
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace='public'::regnamespace
   AND proname='claim_my_doctor_profile';
-- ATTENDU : 1 ligne, args = "legacy_id_input integer"

-- 9.10 ⚠️ CRITIQUE : vue intouchable INTACTE
SELECT count(*) AS doctors_in_public_view FROM public.public_doctors;
-- ATTENDU : ~14 508 (identique à avant migration)



-- =====================================================================
-- SECTION 10 : ROLLBACK (commenté)
-- =====================================================================
-- ⚠️ NE PAS exécuter si tout est OK

/*
DROP FUNCTION IF EXISTS public.update_my_doctor_profile(TEXT, TEXT[], INT, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, INT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_doctor_profile();
DROP TRIGGER  IF EXISTS trg_doctor_profiles_bump_updated_at ON public.doctor_profiles;
DROP FUNCTION IF EXISTS public.tg_bump_updated_at();
DROP POLICY   IF EXISTS doctor_photos_delete_owner ON storage.objects;
DROP POLICY   IF EXISTS doctor_photos_update_owner ON storage.objects;
DROP POLICY   IF EXISTS doctor_photos_insert_owner ON storage.objects;
DROP POLICY   IF EXISTS doctor_photos_select_public ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id='doctor-photos';  -- ⚠️ supprime les fichiers
-- DELETE FROM storage.buckets WHERE id='doctor-photos';
DROP VIEW     IF EXISTS public.public_doctor_full;
DROP TABLE    IF EXISTS public.doctor_unavailable_slots;
-- ALTER TABLE public.doctor_profiles
--   DROP COLUMN IF EXISTS accepts_cash,
--   DROP COLUMN IF EXISTS telehealth_fee_dzd,
--   DROP COLUMN IF EXISTS telehealth_enabled;
*/

-- =====================================================================
-- FIN PHASE 4.A v2
-- =====================================================================
-- ✅ Si toutes les vérifs SECTION 9 passent → réponds "OK go Phase 4.B"
--    et je livre le frontend dashboard + fixtures de test
-- =====================================================================
