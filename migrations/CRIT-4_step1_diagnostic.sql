-- =====================================================================
-- CRIT-4 — STEP 1 : DIAGNOSTIC (lecture seule)
-- =====================================================================
-- Exécuter AVANT step2 pour valider l'état actuel de la base.
-- Ce fichier ne mute RIEN. 100% SELECT / information_schema.
--
-- Objectif : confirmer que les conditions attendues sont réunies
-- avant d'appliquer le fix step2.
--
-- À exécuter dans Supabase Studio → SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Grants actuels pour anon sur doctor_profiles
--    Attendu AVANT fix : une seule ligne "SELECT" table-level (pas de column)
--    Attendu APRÈS fix : liste de colonnes individuelles (column-level grants)
-- ---------------------------------------------------------------------
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type,
    column_name,
    is_grantable
FROM information_schema.role_column_grants
WHERE table_schema = 'public'
  AND table_name   = 'doctor_profiles'
  AND grantee      = 'anon'
ORDER BY column_name;

-- Si ce résultat est VIDE, c'est que le grant est table-level (SELECT *).
-- Vérifier le grant table-level :
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name   = 'doctor_profiles'
  AND grantee      IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- ---------------------------------------------------------------------
-- 2. Policies RLS actives sur doctor_profiles
--    Attendu : 3 policies (Anyone can read active, Doctors can update own, Admins)
-- ---------------------------------------------------------------------
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'doctor_profiles'
ORDER BY policyname;

-- ---------------------------------------------------------------------
-- 3. RLS activé sur la table ?
--    Attendu : relrowsecurity = true
-- ---------------------------------------------------------------------
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname = 'doctor_profiles';

-- ---------------------------------------------------------------------
-- 4. Définition des vues public_doctors_all, public_doctors, claimable_doctors
--    CRITIQUE : voir si address, email apparaissent dans la définition SELECT *
--    Une vue avec SELECT * héritera du grant column-level côté sécurité.
--    Une vue avec colonnes explicites ne sera pas impactée par le REVOKE.
-- ---------------------------------------------------------------------
SELECT
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('public_doctors_all', 'public_doctors', 'claimable_doctors')
ORDER BY viewname;

-- ---------------------------------------------------------------------
-- 5. Option security_invoker sur les vues
--    Attendu : relrowsecurity = true (= security_invoker) sur les 3 vues
-- ---------------------------------------------------------------------
SELECT
    c.relname      AS viewname,
    c.relrowsecurity AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('public_doctors_all', 'public_doctors', 'claimable_doctors')
  AND c.relkind = 'v';

-- ---------------------------------------------------------------------
-- 6. Colonnes de doctor_profiles (liste complète avec types)
--    Pour valider qu'aucune colonne sensible ne manque dans la liste step2
-- ---------------------------------------------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'doctor_profiles'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------
-- 7. Vérifier si la RPC match_doctor_for_claim existe déjà
--    Attendu AVANT step3 : 0 rows
-- ---------------------------------------------------------------------
SELECT
    routine_name,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'match_doctor_for_claim';

-- ---------------------------------------------------------------------
-- 8. Vérifier si get_my_doctor_profile et update_my_doctor_profile
--    sont bien SECURITY DEFINER (ne pas les casser)
-- ---------------------------------------------------------------------
SELECT
    routine_name,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_doctor_profile', 'update_my_doctor_profile')
ORDER BY routine_name;

-- =====================================================================
-- FIN DIAGNOSTIC
-- Si tout est conforme, passer à CRIT-4_step2_fix.sql
-- =====================================================================
