-- =====================================================================
-- CRIT-4 FIX — Column-level privileges on public.doctor_profiles
-- =====================================================================
-- Fichier   : migrations/CRIT-4_fix_doctor_profiles_rls.sql
-- Date      : 2026-05-28
-- Branche   : security/fix-doctor-profiles-rls
-- Auteur    : Audit sécurité Tabibi
--
-- PROBLÈME
-- --------
-- La table public.doctor_profiles est lisible intégralement par le rôle
-- `anon` via l'API REST Supabase. Les 79 746 fiches exposent des colonnes
-- sensibles : phone, user_id, claimed_by_user_id, validation_docs_uploaded_at.
--
-- CAUSE RACINE
-- ------------
-- La policy RLS "Anyone can read active" accorde SELECT sur TOUTES les
-- colonnes pour `anon` (filtre de lignes, pas de colonnes). PostgreSQL ne
-- fournit pas de restriction par colonne via RLS — il faut les privilèges
-- colonne-par-colonne (column-level GRANT).
--
-- APPROCHE RETENUE (Option A)
-- ---------------------------
-- 1. REVOKE le SELECT table-level sur doctor_profiles pour anon
-- 2. GRANT SELECT colonne par colonne sur les seules colonnes publiques
-- 3. Conserver `email` temporairement (utilisé par claim flow — Phase 2 : RPC)
--
-- IMPACT
-- ------
-- Colonnes bloquées pour anon : phone, user_id, claimed_by_user_id,
-- claimed_at, validation_docs_uploaded_at, search_vector
--
-- Aucun impact sur :
-- - public_doctors, public_doctors_all, claimable_doctors (security_invoker,
--   n'exposent que les colonnes publiques)
-- - public_doctor_full (JOIN sur public_doctors + colonnes publiques uniquement)
-- - get_my_doctor_profile() (SECURITY DEFINER — bypass column grants pour médecin)
-- - update_my_doctor_profile() (SECURITY DEFINER — idem)
-- - tabibi-claim.js (email conservé dans le grant anon)
--
-- IDEMPOTENCE
-- -----------
-- Safe à re-exécuter. Les REVOKE/GRANT sont idempotents sur les privilèges
-- (pas d'erreur si le privilège est déjà dans l'état cible).
--
-- PRÉREQUIS
-- ---------
-- Exécuter dans le SQL Editor de Supabase Studio (pas via psql anonyme).
-- Requiert les droits postgres (superuser ou rôle owner de la table).
--
-- =====================================================================

BEGIN;

-- =====================================================================
-- SECTION 1 : VÉRIFICATIONS PRÉ-FIX (READ-ONLY — à lire avant d'appliquer)
-- =====================================================================

-- 1.1 Vérifier les colonnes actuelles de doctor_profiles
-- (renvoie les colonnes sensibles qui seront bloquées après fix)
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'doctor_profiles'
   AND column_name  IN ('phone', 'user_id', 'claimed_by_user_id',
                        'claimed_at', 'validation_docs_uploaded_at',
                        'search_vector', 'email')
 ORDER BY column_name;
-- ATTENDU : 7 lignes (les colonnes qui seront bloquées/restreintes)

-- 1.2 Vérifier les RLS policies existantes
SELECT policyname, cmd, roles, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename  = 'doctor_profiles';
-- ATTENDU : 3 policies (Anyone can read active, Doctors can update own, Admins do anything)

-- 1.3 Vérifier les privilèges actuels sur doctor_profiles
SELECT grantee, privilege_type, is_grantable
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name   = 'doctor_profiles'
   AND grantee      IN ('anon', 'authenticated')
 ORDER BY grantee, privilege_type;
-- ATTENDU : anon=SELECT (table-level), authenticated=SELECT+UPDATE...



-- =====================================================================
-- SECTION 2 : APPLICATION DU FIX
-- =====================================================================

-- 2.1 Retirer le SELECT table-level de anon sur doctor_profiles
--     (supprime l'accès aux colonnes sensibles via REST direct)
--     Note : ne touche PAS à `authenticated` ni `service_role`
REVOKE SELECT ON public.doctor_profiles FROM anon;


-- 2.2 Accorder le SELECT uniquement sur les colonnes publiques à anon
--     Colonnes INCLUSES = données déjà exposées par les vues public_doctors* :
GRANT SELECT (
  -- Identifiants publics
  id,
  legacy_id,
  -- Informations de base (profil visible)
  full_name,
  entity_type,
  specialty_id,
  wilaya_code,
  address,                    -- adresse du cabinet (professionnelle, pas personnelle)
  -- Métriques publiques
  photo_url,
  rating,
  review_count,
  -- Infos consultation
  consultation_fee_dzd,
  bio,
  languages,
  accepts_chifa,
  accepts_card,
  accepts_cash,
  telehealth_enabled,
  telehealth_fee_dzd,
  working_hours,
  -- Statuts
  is_claimed,
  is_active,
  is_verified,
  validation_status,
  source,
  -- Horodatages publics
  updated_at,
  created_at,
  -- email : CONSERVÉ pour compatibilité claim flow (tabibi-claim.js:140)
  -- TODO Phase 2 : créer RPC get_doctor_email_for_claim() puis retirer email de ce GRANT
  email
) ON public.doctor_profiles TO anon;

-- Colonnes NON accordées à anon (bloquées) :
--   phone                        → téléphone personnel scrappé (CRIT)
--   user_id                      → FK vers auth.users (CRIT — corrélation identité)
--   claimed_by_user_id           → idem (CRIT)
--   claimed_at                   → timestamp interne
--   validation_docs_uploaded_at  → colonne interne admin
--   search_vector                → tsvector interne (inutile pour anon)



-- =====================================================================
-- SECTION 3 : VÉRIFICATIONS POST-FIX
-- =====================================================================

-- 3.1 Confirmer que phone n'est plus dans les grants anon
SELECT grantee, column_name, privilege_type
  FROM information_schema.role_column_grants
 WHERE table_schema = 'public'
   AND table_name   = 'doctor_profiles'
   AND grantee      = 'anon'
 ORDER BY column_name;
-- ATTENDU : liste de colonnes sans phone, user_id, claimed_by_user_id,
--           claimed_at, validation_docs_uploaded_at, search_vector

-- 3.2 Test fonctionnel — la vue public_doctors doit toujours fonctionner
SELECT id, full_name FROM public.public_doctors LIMIT 1;
-- ATTENDU : 1 row (Ouanza Dental Clinic ou équivalent)

-- 3.3 Test fonctionnel — la vue claimable_doctors doit toujours fonctionner
SELECT id, full_name FROM public.claimable_doctors LIMIT 1;
-- ATTENDU : 1 row

-- 3.4 Test sécurité — phone ne doit plus être sélectionnable en anon direct
-- (à tester depuis un client avec la clé anon uniquement)
-- SELECT phone FROM public.doctor_profiles LIMIT 1;
-- ATTENDU : ERROR: permission denied for table doctor_profiles
-- (ou column "phone" does not exist in permission context)

-- 3.5 Recharger le cache schema PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;



-- =====================================================================
-- ROLLBACK (à exécuter si régression observée)
-- =====================================================================
-- IMPORTANT : ce rollback restaure la faille. À n'utiliser que le temps
-- d'investiguer la régression, puis re-appliquer le fix.
--
-- BEGIN;
--
-- REVOKE SELECT (id, legacy_id, full_name, entity_type, specialty_id,
--   wilaya_code, address, photo_url, rating, review_count,
--   consultation_fee_dzd, bio, languages, accepts_chifa, accepts_card,
--   accepts_cash, telehealth_enabled, telehealth_fee_dzd, working_hours,
--   is_claimed, is_active, is_verified, validation_status, source,
--   updated_at, created_at, email)
-- ON public.doctor_profiles FROM anon;
--
-- GRANT SELECT ON public.doctor_profiles TO anon;
--
-- NOTIFY pgrst, 'reload schema';
--
-- COMMIT;
--
-- =====================================================================
-- PHASE 2 — Complétion du fix (après validation de Phase 1)
-- =====================================================================
-- Quand tabibi-claim.js sera migré pour utiliser un RPC :
--
-- 1. Créer la RPC get_doctor_email_for_claim() :
--
--    CREATE OR REPLACE FUNCTION public.get_doctor_email_for_claim(p_legacy_id TEXT)
--    RETURNS TEXT
--    LANGUAGE sql
--    SECURITY DEFINER
--    SET search_path = public
--    AS $$
--      SELECT email FROM public.doctor_profiles
--       WHERE legacy_id = p_legacy_id LIMIT 1;
--    $$;
--    REVOKE ALL ON FUNCTION public.get_doctor_email_for_claim(TEXT) FROM PUBLIC;
--    GRANT EXECUTE ON FUNCTION public.get_doctor_email_for_claim(TEXT) TO anon;
--
-- 2. Retirer `email` du GRANT column-level anon :
--
--    REVOKE SELECT (email) ON public.doctor_profiles FROM anon;
--
-- 3. Mettre à jour tabibi-claim.js ligne ~140 :
--    Avant : await sb.from('doctor_profiles').select('email').eq('legacy_id', n)
--    Après : await sb.rpc('get_doctor_email_for_claim', { p_legacy_id: String(n) })
--
-- =====================================================================
