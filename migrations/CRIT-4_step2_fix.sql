-- =====================================================================
-- CRIT-4 — STEP 2 : FIX (REVOKE + GRANT column-level)
-- =====================================================================
-- Sécurité maximale : retire phone, email, address ET toutes les
-- colonnes internes de l'accès anon sur doctor_profiles.
--
-- PRÉREQUIS :
--   1. Avoir exécuté step1 et vérifié que les 3 policies RLS existent
--   2. Avoir confirmé la définition des vues (voir note VIEW RECREATION ci-dessous)
--   3. Faire un snapshot Supabase avant exécution
--
-- ⚠️  NOTE CRITIQUE — VUES security_invoker
-- =====================================================================
-- Les vues public_doctors_all, public_doctors, claimable_doctors sont
-- définies avec SELECT * FROM public_doctors_all (ou équivalent).
-- Elles utilisent security_invoker = true → elles s'exécutent avec les
-- droits du CALLER (anon).
--
-- Conséquence : si on retire `address` et `email` du GRANT anon sur
-- doctor_profiles, ces colonnes disparaissent aussi des vues pour les
-- appels anon (PostgREST renverra les colonnes sans erreur, juste absentes
-- si la définition de la vue est SELECT *).
--
-- SI les vues ont SELECT * : PostgREST va retourner les rows SANS les
-- colonnes non-grantées — c'est le comportement correct (column-level
-- grants sont respectés même avec SELECT *).
--
-- SI les vues ont une liste explicite de colonnes incluant `address` :
-- PostgreSQL lancera "permission denied for column address" et cassera
-- la vue pour anon.
--
-- → VÉRIFIER step1 requête #4 (définition des vues) avant d'exécuter.
-- → Si les vues ont `address` en colonne explicite : décommenter la
--   section SECTION_VIEW_RECREATION ci-dessous AVANT d'exécuter le fix.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Vérification préliminaire (dans la transaction)
-- Assure que les 3 policies RLS attendues existent.
-- Si ce SELECT retourne < 3 rows : ROLLBACK et investiguer.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'doctor_profiles';

    IF v_count < 3 THEN
        RAISE EXCEPTION
            'CRIT-4 step2 aborted: expected ≥3 RLS policies on doctor_profiles, found %.',
            v_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 2 — REVOKE table-level SELECT pour anon
--             (remplacé par column-level grants ci-dessous)
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.doctor_profiles FROM anon;

-- ---------------------------------------------------------------------
-- SECTION 3 — GRANT column-level pour anon
--             Colonnes publiques UNIQUEMENT.
--             Exclues : phone, email, address, user_id,
--             claimed_by_user_id, claimed_at,
--             validation_docs_uploaded_at, search_vector
-- ---------------------------------------------------------------------
GRANT SELECT (
    id,
    legacy_id,
    full_name,
    entity_type,
    specialty_id,
    wilaya_code,
    photo_url,
    rating,
    review_count,
    consultation_fee_dzd,
    bio,
    languages,
    accepts_chifa,
    accepts_card,
    accepts_cash,
    telehealth_enabled,
    telehealth_fee_dzd,
    working_hours,
    is_claimed,
    is_active,
    is_verified,
    validation_status,
    source,
    updated_at,
    created_at
) ON public.doctor_profiles TO anon;

-- Note sur authenticated (non-médecin) :
-- Les colonnes phone/email restent accessibles à authenticated via le
-- GRANT table-level existant. Phase 3 évaluera si authenticated doit
-- aussi être restreint (hors scope CRIT-4).

-- ---------------------------------------------------------------------
-- SECTION_VIEW_RECREATION (DÉCOMMENTER si les vues ont colonnes explicites)
-- =====================================================================
-- À utiliser UNIQUEMENT si step1 requête #4 révèle que public_doctors_all
-- a une liste explicite incluant `address` ou `email`.
--
-- Exécuter d'abord step1 et vérifier la définition des vues.
-- Si les vues font SELECT dp.address, dp.email, dp.phone... → décommenter.
-- Si les vues font SELECT * → NE PAS décommenter (non nécessaire).
-- =====================================================================
--
-- -- Recréer public_doctors_all sans address ni email
-- CREATE OR REPLACE VIEW public.public_doctors_all
--   WITH (security_invoker = true)
-- AS
-- SELECT
--     dp.id,
--     dp.legacy_id,
--     dp.full_name,
--     dp.entity_type,
--     dp.specialty_id,
--     dp.wilaya_code,
--     dp.photo_url,
--     dp.rating,
--     dp.review_count,
--     dp.consultation_fee_dzd,
--     dp.bio,
--     dp.languages,
--     dp.accepts_chifa,
--     dp.accepts_card,
--     dp.accepts_cash,
--     dp.telehealth_enabled,
--     dp.telehealth_fee_dzd,
--     dp.working_hours,
--     dp.is_claimed,
--     dp.is_active,
--     dp.is_verified,
--     dp.validation_status,
--     dp.source,
--     dp.updated_at,
--     dp.created_at
--     -- Colonnes exclues : address, email, phone, user_id,
--     --                    claimed_by_user_id, claimed_at,
--     --                    validation_docs_uploaded_at, search_vector
-- FROM public.doctor_profiles dp
-- WHERE dp.validation_status != 'rejected';
--
-- -- Regrant après remplacement (CREATE OR REPLACE ne touche pas les grants existants)
-- GRANT SELECT ON public.public_doctors_all TO anon, authenticated;
--
-- -- Les vues public_doctors et claimable_doctors wrappent public_doctors_all
-- -- avec SELECT * → elles héritent automatiquement des colonnes disponibles.
-- -- Pas de modification nécessaire sur ces deux vues.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 4 — Forcer PostgREST à recharger le schema
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATION POST-EXÉCUTION (à lancer après COMMIT)
-- =====================================================================
--
-- 1. Confirmer les column-level grants (doit lister les 25 colonnes accordées) :
--    SELECT column_name FROM information_schema.role_column_grants
--    WHERE table_schema = 'public' AND table_name = 'doctor_profiles'
--      AND grantee = 'anon' ORDER BY column_name;
--
-- 2. Confirmer que phone, email, address sont ABSENTS de la liste ci-dessus.
--
-- 3. Test curl (voir CRIT-4_TEST_PLAN.md Tests S-1 à S-7) :
--    curl -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--      "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/doctor_profiles?select=id,phone&limit=1"
--    → Attendu : erreur 403 ou résultat sans colonne phone
--
-- 4. Vérifier que public_doctors reste accessible :
--    curl -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--      "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/public_doctors?select=id,full_name&limit=1"
--    → Attendu : 200 OK avec données
--
-- =====================================================================
-- ROLLBACK D'URGENCE (si régression fonctionnelle)
-- =====================================================================
-- Trigger : Test F-1, F-2 ou F-3 échouent (site cassé).
-- Délai max : < 30 secondes.
--
-- BEGIN;
--
-- -- Retirer les column-level grants
-- REVOKE SELECT (
--     id, legacy_id, full_name, entity_type, specialty_id, wilaya_code,
--     photo_url, rating, review_count, consultation_fee_dzd, bio, languages,
--     accepts_chifa, accepts_card, accepts_cash, telehealth_enabled,
--     telehealth_fee_dzd, working_hours, is_claimed, is_active, is_verified,
--     validation_status, source, updated_at, created_at
-- ) ON public.doctor_profiles FROM anon;
--
-- -- Restaurer l'accès table-level (restaure la faille CRIT-4)
-- GRANT SELECT ON public.doctor_profiles TO anon;
--
-- NOTIFY pgrst, 'reload schema';
--
-- COMMIT;
--
-- ⚠️  NE PAS laisser en état ROLLBACK plus de 24h.
--     Ouvrir un incident GitHub avec le log d'erreur exact.
-- =====================================================================
