-- =====================================================================
-- TABIBI.DOCTOR — PHASE 4.B.3 SEED : claim une fiche pour le compte test
-- =====================================================================
-- Fichier : migrations/PHASE4B_seed_claim_test_doctor.sql
-- Date    : 2026-05-21
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- Objectif : rendre le compte test medecin.test@tabibi.doctor pleinement
-- utilisable pour valider le CRUD `doctor_unavailable_slots` de Phase 4.B.3.
-- Sans une fiche claimed, le compte ne peut tester que le mini-bandeau
-- "Réclamez votre fiche d'abord".
--
-- 🔒 GARANTIES
--   • Idempotent : si une fiche est DÉJÀ claimed par ce compte → no-op
--     (juste affichage de l'état actuel)
--   • Safe : ne réécrit JAMAIS une fiche déjà claimed par un autre user
--     (vérifie user_id IS NULL avant claim)
--   • Reversible : section UNCLAIM commentée en fin de fichier
--   • Atomique : tout dans un DO block, transactionnel implicite
--   • Verbose : RAISE NOTICE pour chaque étape (visible dans SQL Editor)
--
-- ⚙️  PARAMÈTRES MODIFIABLES (en haut du DO block) :
--   • v_test_email       : email du compte test (par défaut medecin.test@…)
--   • v_target_legacy_id : legacy_id de la fiche à claim (par défaut 1)
--     → si la fiche est déjà claim ou n'existe pas, le script EXPLIQUE et
--       te demande de changer la valeur, jamais d'effet de bord
-- =====================================================================



-- =====================================================================
-- SECTION 1 : DISCOVERY PRÉ-FLIGHT (optionnelle, read-only)
-- =====================================================================

-- 1.1 — Confirme que le compte test existe bien en auth.users
SELECT id AS auth_user_id, email, created_at
  FROM auth.users
 WHERE email = 'medecin.test@tabibi.doctor';
-- ATTENDU : 1 ligne (sinon, signup d'abord via login.html)

-- 1.2 — Inspecte la fiche cible (legacy_id=1)
SELECT id, legacy_id, full_name, is_claimed, claimed_at, user_id
  FROM public.doctor_profiles
 WHERE legacy_id = 1;
-- IDÉAL : user_id IS NULL, claimed_at IS NULL, is_claimed = false



-- =====================================================================
-- SECTION 2 : CLAIM (DO block idempotent + safe)
-- =====================================================================

DO $$
DECLARE
  -- ┌── Paramètres modifiables ─────────────────────────────────────────
  v_test_email        TEXT := 'medecin.test@tabibi.doctor';
  v_target_legacy_id  INT  := 1;
  -- └────────────────────────────────────────────────────────────────────

  v_user_id              UUID;
  v_existing_profile_id  UUID;
  v_existing_profile_name TEXT;
  v_target_profile_id    UUID;
  v_target_profile_name  TEXT;
  v_target_claimed_by    UUID;
BEGIN
  -- ─── Étape 1 : trouver l'auth.users.id du compte test ────────────────
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = v_test_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'Compte auth "%" introuvable dans auth.users. Crée-le d''abord via signup.html (rôle médecin), confirme l''email, puis re-exécute ce script.',
      v_test_email;
  END IF;
  RAISE NOTICE '✓ Étape 1 — auth.users.id du compte test : %', v_user_id;

  -- ─── Étape 2 : idempotence — vérifier si une fiche est déjà claim ───
  SELECT id, full_name
    INTO v_existing_profile_id, v_existing_profile_name
    FROM public.doctor_profiles
   WHERE user_id = v_user_id
   LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    RAISE NOTICE '✅ NO-OP IDEMPOTENT : le compte test "%" est déjà lié à la fiche % ("%"). Aucune modification.',
      v_test_email, v_existing_profile_id, v_existing_profile_name;
    RETURN;
  END IF;
  RAISE NOTICE '✓ Étape 2 — aucune fiche déjà claim pour ce compte, on peut proceder';

  -- ─── Étape 3 : vérifier l'état de la fiche cible ────────────────────
  SELECT id, full_name, user_id
    INTO v_target_profile_id, v_target_profile_name, v_target_claimed_by
    FROM public.doctor_profiles
   WHERE legacy_id = v_target_legacy_id;

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION
      'Aucune fiche en base avec legacy_id=%. Adapte la variable v_target_legacy_id (essaie 2, 3, ... ou n''importe quel ID parmi les 14 508 fiches).',
      v_target_legacy_id;
  END IF;

  IF v_target_claimed_by IS NOT NULL THEN
    RAISE EXCEPTION
      'SAFETY ABORT : la fiche legacy_id=% ("%" — id=%) est DÉJÀ claim par user_id=%. Refuse d''écraser. Choisis une autre legacy_id ou unclaim cette fiche d''abord (section ROLLBACK en bas de ce fichier, adaptée).',
      v_target_legacy_id, v_target_profile_name, v_target_profile_id, v_target_claimed_by;
  END IF;
  RAISE NOTICE '✓ Étape 3 — fiche cible legacy_id=% ("% " — id=%) est libre, on claim',
    v_target_legacy_id, v_target_profile_name, v_target_profile_id;

  -- ─── Étape 4 : CLAIM effectif (3 colonnes mises à jour atomiquement) ─
  UPDATE public.doctor_profiles
     SET user_id    = v_user_id,
         claimed_at = NOW(),
         is_claimed = true
   WHERE id = v_target_profile_id;

  RAISE NOTICE '✅ CLAIMED : fiche legacy_id=% ("% " — id=%) maintenant liée au compte test (auth.uid=%). Le médecin peut désormais éditer sa fiche ET gérer ses blocages exceptionnels.',
    v_target_legacy_id, v_target_profile_name, v_target_profile_id, v_user_id;
END $$;



-- =====================================================================
-- SECTION 3 : VÉRIFICATION POST-CLAIM (affichage final)
-- =====================================================================

SELECT
  dp.id                     AS profile_id,
  dp.legacy_id              AS legacy_id,
  dp.full_name              AS full_name,
  dp.specialty_raw          AS specialty,
  dp.wilaya_code            AS wilaya_code,
  dp.is_claimed             AS is_claimed,
  dp.claimed_at             AS claimed_at,
  dp.user_id                AS user_id,
  u.email                   AS linked_email
  FROM public.doctor_profiles dp
  LEFT JOIN auth.users u ON u.id = dp.user_id
 WHERE u.email = 'medecin.test@tabibi.doctor';
-- ATTENDU : 1 ligne, is_claimed=true, claimed_at récent, linked_email = compte test



-- =====================================================================
-- SECTION 4 : ROLLBACK / UNCLAIM (commenté — décommenter si besoin)
-- =====================================================================
-- ⚠️ Décommenter SEULEMENT si :
--   • Tu veux libérer la fiche pour la tester sur un autre compte
--   • Tu veux re-tester le flow "pas claim" (bandeau jaune) en frontend
--   • Tu as commit une erreur de claim et veux revenir en arrière
--
-- Effet : libère la fiche actuellement liée au compte test
-- (user_id = NULL, claimed_at = NULL, is_claimed = false).
-- La fiche redevient anonyme dans la vue public_doctors. La table
-- doctor_unavailable_slots associée est CASCADE-supprimée par la FK
-- ON DELETE CASCADE — mais ici on ne supprime PAS la fiche, juste on
-- la délie. Les slots associés survivront avec un doctor_id orphelin.
-- Pour les nettoyer aussi : décommenter la 2e requête.

/*
-- Unclaim la fiche
UPDATE public.doctor_profiles
   SET user_id    = NULL,
       claimed_at = NULL,
       is_claimed = false
 WHERE user_id IN (
   SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor'
 );

-- (Optionnel) Nettoyer les blocages exceptionnels créés pendant les tests
DELETE FROM public.doctor_unavailable_slots
 WHERE doctor_id IN (
   SELECT dp.id FROM public.doctor_profiles dp
     JOIN auth.users u ON u.id = dp.user_id
    WHERE u.email = 'medecin.test@tabibi.doctor'
 );
*/

-- =====================================================================
-- FIN PHASE 4.B.3 SEED
-- =====================================================================
-- ✅ Si la SECTION 3 retourne 1 ligne avec is_claimed=true → on peut
--    déployer Phase 4.B.3 et tester le CRUD blocages en prod.
-- =====================================================================
