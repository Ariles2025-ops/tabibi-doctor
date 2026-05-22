-- =====================================================================
-- TABIBI.DOCTOR — PHASE 4.B.4.0a : AUDIT claim_my_doctor_profile
-- =====================================================================
-- Fichier  : migrations/PHASE4B_AUDIT_claim_rpc.sql
-- Date     : 2026-05-22
-- Mode     : 100% READ-ONLY (zéro modification)
-- Cible    : Supabase Pro EU
--
-- Objectif : extraire le source ET les métadonnées de la fonction
-- `claim_my_doctor_profile` créée en Phase 0, pour documenter ce qu'elle
-- fait réellement et identifier d'éventuels gaps (notamment : est-ce
-- qu'elle écrit bien user_id, is_claimed, claimed_at sur doctor_profiles ?).
--
-- ⚠️ NE TOUCHE PAS À LA RPC. Lecture seule.
--
-- Procédure : exécute les 3 requêtes ci-dessous dans le SQL Editor de
-- Supabase, copie-colle TOUS les résultats dans docs/AUDIT_claim_rpc.md
-- aux emplacements indiqués (voir template).
-- =====================================================================



-- =====================================================================
-- REQUÊTE 1 — Signature complète + propriétés de sécurité
-- =====================================================================
-- → Colle le résultat dans la section "## 1. Signature actuelle" du
--   template docs/AUDIT_claim_rpc.md

SELECT
  p.proname                                  AS function_name,
  pg_get_function_identity_arguments(p.oid)  AS arguments,
  pg_get_function_result(p.oid)              AS return_type,
  CASE p.prokind
    WHEN 'f' THEN 'FUNCTION'
    WHEN 'p' THEN 'PROCEDURE'
    WHEN 'a' THEN 'AGGREGATE'
    WHEN 'w' THEN 'WINDOW'
  END                                         AS kind,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END  AS security,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END                                         AS volatility,
  l.lanname                                   AS language,
  pg_get_userbyid(p.proowner)                 AS owner,
  obj_description(p.oid, 'pg_proc')           AS comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'claim_my_doctor_profile'
ORDER BY arguments;
-- ATTENDU : 1 ou 2 lignes (cf. note bonus user en 4.A.9 : il existait
-- une 2e signature sans args, vestige antérieur).



-- =====================================================================
-- REQUÊTE 2 — Body SQL complet (CREATE FUNCTION reconstruit)
-- =====================================================================
-- → Colle le résultat dans la section "## 2. Body SQL réel" du template

SELECT pg_get_functiondef(p.oid) AS create_function_statement
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_my_doctor_profile'
  AND pg_get_function_identity_arguments(p.oid) = 'legacy_id_input integer';
-- ATTENDU : 1 ligne contenant le CREATE OR REPLACE FUNCTION ... AS $$...$$
-- complet, telle qu'on pourrait la re-coller pour recréer la fonction.



-- =====================================================================
-- REQUÊTE 3 — Permissions GRANT sur la RPC
-- =====================================================================
-- → Colle le résultat dans la section "## 3. Permissions" du template

SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name    = 'claim_my_doctor_profile'
ORDER BY grantee, privilege_type;
-- ATTENDU : ≥ 1 ligne avec grantee='authenticated' et privilege_type='EXECUTE'
-- (sinon le frontend ne pourrait pas appeler la RPC).



-- =====================================================================
-- REQUÊTE 4 (bonus diagnostic) — Test fumant sur une fiche libre
-- =====================================================================
-- ⚠️ COMMENTÉE — NE PAS EXÉCUTER tant que tu n'as pas d'environnement
-- de test isolé. Décommenter UNIQUEMENT pour vérifier le comportement
-- réel de la RPC sur une fiche libre (par exemple legacy_id=99).
--
-- Procédure si tu veux exécuter (recommandé seulement en preview/staging) :
-- 1. Identifie une fiche libre : SELECT id, legacy_id, user_id, is_claimed
--      FROM doctor_profiles WHERE user_id IS NULL ORDER BY legacy_id LIMIT 5;
-- 2. Note les valeurs AVANT de la fiche choisie.
-- 3. Connecte-toi en tant que medecin.test@tabibi.doctor (auth en place).
-- 4. Décommente + exécute le bloc ci-dessous.
-- 5. Compare les valeurs APRÈS.
-- 6. Colle l'avant/après dans la section "## 4. Test fumant" du template.

/*
-- ÉTAT AVANT
SELECT id, legacy_id, user_id, is_claimed, claimed_at
  FROM public.doctor_profiles
 WHERE legacy_id = 99;

-- APPEL RPC (modifie potentiellement la DB)
SELECT public.claim_my_doctor_profile(99);

-- ÉTAT APRÈS
SELECT id, legacy_id, user_id, is_claimed, claimed_at
  FROM public.doctor_profiles
 WHERE legacy_id = 99;

-- ROLLBACK si la RPC a fait quelque chose qu'on ne voulait pas garder
-- UPDATE public.doctor_profiles
--    SET user_id = NULL, is_claimed = false, claimed_at = NULL
--  WHERE legacy_id = 99;
*/

-- =====================================================================
-- FIN AUDIT
-- =====================================================================
-- ✅ Une fois les 3 (ou 4) requêtes exécutées et le template rempli,
--    transmets-moi docs/AUDIT_claim_rpc.md complété. Je valide l'analyse
--    et on enchaîne sur 4.B.4.0b (audit + fix seed).
-- =====================================================================
