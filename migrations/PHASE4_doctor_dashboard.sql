-- =====================================================================
-- ⚠️⚠️⚠️ FICHIER OBSOLÈTE — NE PAS EXÉCUTER ⚠️⚠️⚠️
-- =====================================================================
-- Ce fichier (v1) ciblait une table `public_doctors_master` HALLUCINÉE
-- qui n'existe pas dans la base réelle.
--
-- ➡️  UTILISE À LA PLACE : PHASE4_doctor_dashboard_v2.sql
--     (cible la vraie table doctor_profiles, vérifiée par discovery user)
--
-- Conservé dans le repo uniquement pour traçabilité historique.
-- =====================================================================
-- TABIBI.DOCTOR — PHASE 4.A : MIGRATIONS DASHBOARD MÉDECIN  [v1 OBSOLÈTE]
-- =====================================================================
-- Fichier : migrations/PHASE4_doctor_dashboard.sql  [OBSOLÈTE]
-- Date    : 2026-05-21
-- Auteur  : Phase 4.A du master prompt 13 phases (cf. PROGRESS.md)
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- ⚠️  CONSIGNES STRICTES
--   1. Exécute SECTION PAR SECTION dans le SQL Editor de Supabase
--      (ne pas tout coller d'un coup au premier passage)
--   2. Chaque section est IDEMPOTENTE : safe à re-run après correction
--   3. NE TOUCHE PAS à la vue `public_doctors` ni à la fonction
--      `claim_my_doctor_profile` (consigne user) — leur intégrité est
--      vérifiée en SECTION 10
--   4. Si une section échoue, colle l'erreur, on adapte avant la suivante
--   5. Aucune donnée n'est supprimée par ce script
--
-- 🗂️  PLAN
--   SECTION 0  : DISCOVERY (read-only — colle-moi les résultats)
--   SECTION 1  : COLONNES éditables sur public_doctors_master
--   SECTION 2  : TABLE doctor_unavailable_slots (NEW)
--   SECTION 3  : RLS sur public_doctors_master
--   SECTION 4  : RLS sur doctor_unavailable_slots
--   SECTION 5  : VUE public_doctor_full (additive — ne touche pas public_doctors)
--   SECTION 6  : BUCKET storage doctor-photos
--   SECTION 7  : RLS storage objects pour doctor-photos
--   SECTION 8  : TRIGGER auto-update updated_at
--   SECTION 9  : HELPER RPCs (get_my_doctor_profile, update_my_doctor_profile)
--   SECTION 10 : VÉRIFICATIONS (counts + policies + intégrité claim_my_doctor_profile)
--   SECTION 11 : ROLLBACK (commenté, à activer en cas de souci)
-- =====================================================================



-- =====================================================================
-- SECTION 0 : DISCOVERY (READ-ONLY)
-- =====================================================================
-- Exécute CES 5 REQUÊTES seulement (rien d'autre).
-- Colle-moi les résultats si tu veux que j'adapte les sections suivantes.

-- 0.1 — Toutes les tables qui contiennent 'doctor' ou 'public_doctors'
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND (table_name LIKE '%doctor%' OR table_name LIKE '%medecin%')
 ORDER BY table_name;

-- 0.2 — Colonnes existantes de public_doctors_master (table sous-jacente)
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'public_doctors_master'
 ORDER BY ordinal_position;

-- 0.3 — Définition actuelle de la vue public_doctors (pour info, ne pas modifier)
SELECT pg_get_viewdef('public.public_doctors'::regclass, true);

-- 0.4 — Policies RLS déjà présentes sur les tables doctor
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual::text, with_check::text
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (tablename LIKE '%doctor%' OR tablename LIKE '%medecin%')
 ORDER BY tablename, policyname;

-- 0.5 — Buckets de storage existants
SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
 ORDER BY id;



-- =====================================================================
-- SECTION 1 : COLONNES ÉDITABLES sur public_doctors_master
-- =====================================================================
-- Ajoute UNIQUEMENT les colonnes manquantes (IF NOT EXISTS).
-- Si certaines existent déjà avec un type différent, les ALTER échoueront
-- proprement et tu pourras me dire lesquelles.

ALTER TABLE public.public_doctors_master
  ADD COLUMN IF NOT EXISTS bio                 TEXT,
  ADD COLUMN IF NOT EXISTS languages           TEXT[]   DEFAULT ARRAY['FR','AR']::TEXT[],
  ADD COLUMN IF NOT EXISTS accepts_chifa       BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cb          BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cash        BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_schedule     JSONB    DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS telehealth_enabled  BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS telehealth_fee_dzd  INT,
  ADD COLUMN IF NOT EXISTS photo_url           TEXT,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Contrainte sanity check sur weekly_schedule (doit être un objet JSON)
-- Pattern attendu : { "mon": [{"open":"09:00","close":"17:00"}], "tue": [...], ... }
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
     WHERE constraint_schema = 'public'
       AND constraint_name   = 'public_doctors_master_weekly_schedule_is_object'
  ) THEN
    ALTER TABLE public.public_doctors_master
      ADD CONSTRAINT public_doctors_master_weekly_schedule_is_object
      CHECK (jsonb_typeof(weekly_schedule) = 'object');
  END IF;
END $$;

-- Commentaires pour documenter le schéma
COMMENT ON COLUMN public.public_doctors_master.bio                IS 'Présentation libre du médecin (markdown brut autorisé)';
COMMENT ON COLUMN public.public_doctors_master.languages          IS 'Langues parlées en consultation, p.ex. {FR,AR,EN}';
COMMENT ON COLUMN public.public_doctors_master.accepts_chifa      IS 'Tiers-payant CHIFA accepté (CNAS/CASNOS)';
COMMENT ON COLUMN public.public_doctors_master.accepts_cb         IS 'Paiement par carte bancaire CIB/Edahabia accepté';
COMMENT ON COLUMN public.public_doctors_master.accepts_cash       IS 'Paiement espèces accepté (par défaut true)';
COMMENT ON COLUMN public.public_doctors_master.weekly_schedule    IS 'Horaires hebdo JSONB : { "mon":[{"open":"09:00","close":"17:00"}], ... }';
COMMENT ON COLUMN public.public_doctors_master.telehealth_enabled IS 'Téléconsultation activée (Daily.co)';
COMMENT ON COLUMN public.public_doctors_master.telehealth_fee_dzd IS 'Tarif téléconsultation distinct (sinon = consultation_fee_dzd)';
COMMENT ON COLUMN public.public_doctors_master.photo_url          IS 'URL publique de la photo profil (bucket doctor-photos)';
COMMENT ON COLUMN public.public_doctors_master.updated_at         IS 'Auto-bumped par trigger trg_public_doctors_master_updated_at';



-- =====================================================================
-- SECTION 2 : TABLE doctor_unavailable_slots (NEW)
-- =====================================================================
-- Permet à un médecin de bloquer des créneaux exceptionnels (vacances,
-- formations, fermetures ponctuelles) en surcouche de weekly_schedule.

CREATE TABLE IF NOT EXISTS public.doctor_unavailable_slots (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID         NOT NULL,   -- FK vers public_doctors_master.id
  starts_at   TIMESTAMPTZ  NOT NULL,
  ends_at     TIMESTAMPTZ  NOT NULL,
  reason      TEXT,
  all_day     BOOLEAN      NOT NULL DEFAULT false,
  created_by  UUID         DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT  doctor_unavailable_slots_chrono CHECK (ends_at > starts_at)
);

-- FK séparée pour pouvoir survivre si la table master est renommée un jour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema = 'public'
       AND table_name        = 'doctor_unavailable_slots'
       AND constraint_name   = 'doctor_unavailable_slots_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.doctor_unavailable_slots
      ADD CONSTRAINT doctor_unavailable_slots_doctor_id_fkey
      FOREIGN KEY (doctor_id)
      REFERENCES public.public_doctors_master(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Index pour requêtes "donne-moi tous les blocages d'un médecin sur les 30 prochains jours"
CREATE INDEX IF NOT EXISTS idx_doctor_unavailable_slots_doctor_starts
  ON public.doctor_unavailable_slots (doctor_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_doctor_unavailable_slots_active
  ON public.doctor_unavailable_slots (starts_at)
  WHERE ends_at > NOW();

COMMENT ON TABLE  public.doctor_unavailable_slots IS 'Créneaux bloqués au cas par cas (vacances, formations). Override weekly_schedule.';
COMMENT ON COLUMN public.doctor_unavailable_slots.all_day IS 'Si true, ignore l''heure dans starts_at/ends_at (date entière bloquée)';



-- =====================================================================
-- SECTION 3 : RLS sur public_doctors_master
-- =====================================================================
-- Règle d'or : SEUL le médecin propriétaire (claimed_by_user_id = auth.uid())
-- peut UPDATE sa fiche. Lecture publique reste assurée par la vue
-- public_doctors (qui n'a PAS de RLS car les vues héritent de la table
-- sous-jacente mais avec le SECURITY INVOKER par défaut).

ALTER TABLE public.public_doctors_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_doctors_master FORCE ROW LEVEL SECURITY;

-- Drop policies obsoletes éventuelles (idempotent)
DROP POLICY IF EXISTS pdm_select_all                 ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_update_own                 ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_insert_admin               ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_delete_admin               ON public.public_doctors_master;

-- 3.1 SELECT public (les patients doivent pouvoir lire les fiches)
CREATE POLICY pdm_select_all
  ON public.public_doctors_master
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3.2 UPDATE : seul le médecin propriétaire de la fiche (validée par RPC claim) peut éditer
CREATE POLICY pdm_update_own
  ON public.public_doctors_master
  FOR UPDATE
  TO authenticated
  USING       (claimed_by_user_id = auth.uid())
  WITH CHECK  (claimed_by_user_id = auth.uid());

-- 3.3 INSERT bloqué côté client (création de fiches = via service_role admin uniquement)
CREATE POLICY pdm_insert_admin
  ON public.public_doctors_master
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 3.4 DELETE bloqué côté client
CREATE POLICY pdm_delete_admin
  ON public.public_doctors_master
  FOR DELETE
  TO authenticated
  USING (false);

-- Note : le rôle service_role bypass automatiquement toutes les RLS,
-- donc les opérations admin (création de fiches, suppression) restent
-- possibles via les Edge Functions ou le SQL Editor en mode owner.



-- =====================================================================
-- SECTION 4 : RLS sur doctor_unavailable_slots
-- =====================================================================

ALTER TABLE public.doctor_unavailable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_unavailable_slots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dus_select_public      ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_insert_owner       ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_update_owner       ON public.doctor_unavailable_slots;
DROP POLICY IF EXISTS dus_delete_owner       ON public.doctor_unavailable_slots;

-- 4.1 SELECT : public peut voir les blocages (nécessaire pour le booking)
CREATE POLICY dus_select_public
  ON public.doctor_unavailable_slots
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4.2 INSERT : seul le médecin propriétaire de la fiche concernée peut créer un blocage
CREATE POLICY dus_insert_owner
  ON public.doctor_unavailable_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.public_doctors_master m
       WHERE m.id = doctor_unavailable_slots.doctor_id
         AND m.claimed_by_user_id = auth.uid()
    )
  );

-- 4.3 UPDATE : même règle
CREATE POLICY dus_update_owner
  ON public.doctor_unavailable_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_doctors_master m
       WHERE m.id = doctor_unavailable_slots.doctor_id
         AND m.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.public_doctors_master m
       WHERE m.id = doctor_unavailable_slots.doctor_id
         AND m.claimed_by_user_id = auth.uid()
    )
  );

-- 4.4 DELETE : même règle
CREATE POLICY dus_delete_owner
  ON public.doctor_unavailable_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_doctors_master m
       WHERE m.id = doctor_unavailable_slots.doctor_id
         AND m.claimed_by_user_id = auth.uid()
    )
  );



-- =====================================================================
-- SECTION 5 : VUE public_doctor_full (ADDITIVE — ne touche pas public_doctors)
-- =====================================================================
-- Vue COMPLÉMENTAIRE qui expose les nouveaux champs éditables côté public.
-- N'altère PAS la vue public_doctors existante (consigne user).
-- Le frontend peut consommer indifféremment l'une ou l'autre selon besoin.
--
-- Anonymisation : on REUTILISE la même logique que public_doctors
-- (full_name affiché seulement si is_claimed=true).

CREATE OR REPLACE VIEW public.public_doctor_full
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.legacy_id,
  m.is_claimed,
  CASE WHEN m.is_claimed THEN m.full_name      ELSE NULL END AS full_name,
  CASE WHEN m.is_claimed THEN m.address        ELSE NULL END AS address,
  CASE WHEN m.is_claimed THEN m.phone          ELSE NULL END AS phone,
  m.specialty_fr,
  m.specialty_slug,
  m.wilaya_fr,
  m.wilaya,
  m.consultation_fee_dzd,
  m.is_verified,
  -- Nouveaux champs éditables (Phase 4)
  m.bio,
  m.languages,
  m.accepts_chifa,
  m.accepts_cb,
  m.accepts_cash,
  m.weekly_schedule,
  m.telehealth_enabled,
  m.telehealth_fee_dzd,
  m.photo_url,
  m.updated_at,
  m.claimed_at
FROM public.public_doctors_master m;

COMMENT ON VIEW public.public_doctor_full IS
  'Vue publique complète (Phase 4). Complète public_doctors avec les champs éditables (bio, photo, horaires, paiements, télémédecine). Anonymisation préservée (full_name=NULL si is_claimed=false).';

-- Grant lecture publique
GRANT SELECT ON public.public_doctor_full TO anon, authenticated;



-- =====================================================================
-- SECTION 6 : BUCKET storage doctor-photos
-- =====================================================================
-- Bucket public (les photos profil s'affichent sur les fiches publiques).
-- Limites : 2 MB par fichier, JPEG/PNG/WebP seulement.

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
-- SECTION 7 : RLS storage.objects pour doctor-photos
-- =====================================================================
-- Convention de chemin : <auth.uid()>/<filename>
-- Exemple : 8c2f4a9b-...-/photo.jpg
--
-- Chaque médecin n'a accès qu'à son propre dossier.

DROP POLICY IF EXISTS doctor_photos_select_public  ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_insert_owner   ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_update_owner   ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_delete_owner   ON storage.objects;

-- 7.1 SELECT public (bucket public = photos visibles sur fiches médecin)
CREATE POLICY doctor_photos_select_public
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'doctor-photos');

-- 7.2 INSERT : authentifié, dans son propre dossier <uid>/...
CREATE POLICY doctor_photos_insert_owner
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7.3 UPDATE : même règle (uniquement ses propres fichiers)
CREATE POLICY doctor_photos_update_owner
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7.4 DELETE : même règle
CREATE POLICY doctor_photos_delete_owner
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );



-- =====================================================================
-- SECTION 8 : TRIGGER auto-bump updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tg_bump_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_doctors_master_updated_at ON public.public_doctors_master;
CREATE TRIGGER trg_public_doctors_master_updated_at
  BEFORE UPDATE ON public.public_doctors_master
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_bump_updated_at();



-- =====================================================================
-- SECTION 9 : HELPER RPCs (lecture + update sécurisée)
-- =====================================================================

-- 9.1 get_my_doctor_profile() — retourne la fiche de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_my_doctor_profile()
RETURNS public.public_doctors_master
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
    FROM public.public_doctors_master
   WHERE claimed_by_user_id = auth.uid()
   LIMIT 1;
$$;

REVOKE ALL    ON FUNCTION public.get_my_doctor_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_doctor_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_doctor_profile() IS
  'Retourne la fiche médecin (public_doctors_master) liée à l''utilisateur courant via claimed_by_user_id. NULL si l''utilisateur n''a pas réclamé de fiche.';


-- 9.2 update_my_doctor_profile(...) — update partiel sécurisé
--     Tous les paramètres sont optionnels (NULL = on garde la valeur actuelle)
CREATE OR REPLACE FUNCTION public.update_my_doctor_profile(
  p_bio                 TEXT      DEFAULT NULL,
  p_languages           TEXT[]    DEFAULT NULL,
  p_consultation_fee    INT       DEFAULT NULL,
  p_accepts_chifa       BOOLEAN   DEFAULT NULL,
  p_accepts_cb          BOOLEAN   DEFAULT NULL,
  p_accepts_cash        BOOLEAN   DEFAULT NULL,
  p_weekly_schedule     JSONB     DEFAULT NULL,
  p_telehealth_enabled  BOOLEAN   DEFAULT NULL,
  p_telehealth_fee      INT       DEFAULT NULL,
  p_photo_url           TEXT      DEFAULT NULL,
  p_phone               TEXT      DEFAULT NULL,
  p_address             TEXT      DEFAULT NULL
)
RETURNS public.public_doctors_master
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor public.public_doctors_master;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Sanity check : valeurs numériques positives
  IF p_consultation_fee IS NOT NULL AND p_consultation_fee < 0 THEN
    RAISE EXCEPTION 'invalid_fee' USING ERRCODE = '22023';
  END IF;
  IF p_telehealth_fee IS NOT NULL AND p_telehealth_fee < 0 THEN
    RAISE EXCEPTION 'invalid_telehealth_fee' USING ERRCODE = '22023';
  END IF;
  IF p_bio IS NOT NULL AND length(p_bio) > 2000 THEN
    RAISE EXCEPTION 'bio_too_long' USING ERRCODE = '22023';
  END IF;
  IF p_weekly_schedule IS NOT NULL AND jsonb_typeof(p_weekly_schedule) <> 'object' THEN
    RAISE EXCEPTION 'weekly_schedule_not_object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.public_doctors_master m
     SET bio                 = COALESCE(p_bio,                m.bio),
         languages           = COALESCE(p_languages,          m.languages),
         consultation_fee_dzd= COALESCE(p_consultation_fee,   m.consultation_fee_dzd),
         accepts_chifa       = COALESCE(p_accepts_chifa,      m.accepts_chifa),
         accepts_cb          = COALESCE(p_accepts_cb,         m.accepts_cb),
         accepts_cash        = COALESCE(p_accepts_cash,       m.accepts_cash),
         weekly_schedule     = COALESCE(p_weekly_schedule,    m.weekly_schedule),
         telehealth_enabled  = COALESCE(p_telehealth_enabled, m.telehealth_enabled),
         telehealth_fee_dzd  = COALESCE(p_telehealth_fee,     m.telehealth_fee_dzd),
         photo_url           = COALESCE(p_photo_url,          m.photo_url),
         phone               = COALESCE(p_phone,              m.phone),
         address             = COALESCE(p_address,            m.address)
   WHERE m.claimed_by_user_id = auth.uid()
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
  'Update partiel sécurisé de la fiche médecin courante (Phase 4). Tous les paramètres NULL = inchangés. Erreurs possibles : not_authenticated, invalid_fee, bio_too_long, weekly_schedule_not_object, profile_not_found_or_not_claimed.';



-- =====================================================================
-- SECTION 10 : VÉRIFICATIONS POST-MIGRATION (à exécuter à la fin)
-- =====================================================================

-- 10.1 Vérifie que les nouvelles colonnes sont bien là
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'public_doctors_master'
   AND column_name IN ('bio','languages','accepts_chifa','accepts_cb','accepts_cash',
                       'weekly_schedule','telehealth_enabled','telehealth_fee_dzd',
                       'photo_url','updated_at')
 ORDER BY column_name;
-- ATTENDU : 10 lignes

-- 10.2 Vérifie les policies créées
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('public_doctors_master', 'doctor_unavailable_slots')
 ORDER BY tablename, policyname;
-- ATTENDU : 8 lignes (4 sur chaque table)

-- 10.3 Vérifie la nouvelle table et son FK
SELECT
  c.relname        AS table_name,
  con.conname      AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
JOIN pg_class c       ON c.oid = con.conrelid
JOIN pg_namespace n   ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'doctor_unavailable_slots';
-- ATTENDU : ~3 lignes (PK + FK + CHECK chrono)

-- 10.4 Vérifie le bucket
SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
 WHERE id = 'doctor-photos';
-- ATTENDU : 1 ligne, public=true, file_size_limit=2097152

-- 10.5 Vérifie les policies storage
SELECT policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'storage'
   AND tablename  = 'objects'
   AND policyname LIKE 'doctor_photos_%'
 ORDER BY policyname;
-- ATTENDU : 4 lignes (select_public, insert_owner, update_owner, delete_owner)

-- 10.6 Vérifie les nouvelles RPCs
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('get_my_doctor_profile', 'update_my_doctor_profile', 'tg_bump_updated_at')
 ORDER BY proname;
-- ATTENDU : 3 lignes

-- 10.7 ⚠️ VÉRIFIE QUE LE RPC INTOUCHABLE EST INTACT
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'claim_my_doctor_profile';
-- ATTENDU : 1 ligne, args = "legacy_id_input integer"
-- Si vide ou args différents → STOP et nous prévenir IMMÉDIATEMENT

-- 10.8 ⚠️ VÉRIFIE QUE LA VUE INTOUCHABLE EST INTACTE
SELECT count(*) AS nb_doctors_in_view FROM public.public_doctors;
-- ATTENDU : ~14 508 lignes (ou ton volume actuel, identique à AVANT migration)

-- 10.9 Test fumant : essaie de récupérer ton propre profil (à exécuter
-- connecté avec un compte médecin qui a déjà réclamé une fiche)
-- SELECT * FROM public.get_my_doctor_profile();
-- ATTENDU : 1 ligne (ta fiche) ou 0 ligne si tu n'as pas encore claim



-- =====================================================================
-- SECTION 11 : ROLLBACK (commenté — décommenter ligne par ligne en cas de souci)
-- =====================================================================
-- ⚠️ NE PAS EXÉCUTER si la migration s'est bien passée
-- ⚠️ Le rollback NE TOUCHE PAS aux données existantes, seulement aux objets créés

/*
-- Rollback RPCs Phase 4
DROP FUNCTION IF EXISTS public.update_my_doctor_profile(TEXT, TEXT[], INT, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, BOOLEAN, INT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_doctor_profile();

-- Rollback trigger
DROP TRIGGER IF EXISTS trg_public_doctors_master_updated_at ON public.public_doctors_master;
DROP FUNCTION IF EXISTS public.tg_bump_updated_at();

-- Rollback storage policies
DROP POLICY IF EXISTS doctor_photos_delete_owner ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_update_owner ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_insert_owner ON storage.objects;
DROP POLICY IF EXISTS doctor_photos_select_public ON storage.objects;

-- Rollback bucket (⚠️ supprime les fichiers !)
-- DELETE FROM storage.objects WHERE bucket_id = 'doctor-photos';
-- DELETE FROM storage.buckets WHERE id = 'doctor-photos';

-- Rollback vue Phase 4
DROP VIEW IF EXISTS public.public_doctor_full;

-- Rollback table dispos
DROP TABLE IF EXISTS public.doctor_unavailable_slots;

-- Rollback policies master (rétablit l'état d'avant)
DROP POLICY IF EXISTS pdm_delete_admin ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_insert_admin ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_update_own   ON public.public_doctors_master;
DROP POLICY IF EXISTS pdm_select_all   ON public.public_doctors_master;
-- ALTER TABLE public.public_doctors_master DISABLE ROW LEVEL SECURITY;

-- Rollback colonnes (⚠️ supprime les données saisies dans ces colonnes !)
-- ALTER TABLE public.public_doctors_master
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS photo_url,
--   DROP COLUMN IF EXISTS telehealth_fee_dzd,
--   DROP COLUMN IF EXISTS telehealth_enabled,
--   DROP COLUMN IF EXISTS weekly_schedule,
--   DROP COLUMN IF EXISTS accepts_cash,
--   DROP COLUMN IF EXISTS accepts_cb,
--   DROP COLUMN IF EXISTS accepts_chifa,
--   DROP COLUMN IF EXISTS languages,
--   DROP COLUMN IF EXISTS bio;
-- ALTER TABLE public.public_doctors_master
--   DROP CONSTRAINT IF EXISTS public_doctors_master_weekly_schedule_is_object;
*/

-- =====================================================================
-- FIN PHASE 4.A
-- =====================================================================
-- ✅ Si toutes les vérifs SECTION 10 passent → réponds "OK go Phase 4.B"
--    et je livre le frontend dashboard + fixtures de test
-- =====================================================================
