-- =====================================================================
-- CRIT-4 — STEP 3 : RPC match_doctor_for_claim
-- =====================================================================
-- Crée une fonction SECURITY DEFINER pour remplacer la lecture directe
-- de doctor_profiles.email dans js/tabibi-claim.js (ligne 140).
--
-- PRÉREQUIS :
--   1. step2 exécuté avec succès (email retiré du GRANT anon)
--   2. Tester sur staging avant production
--
-- Impact frontend :
--   Voir docs/security/CRIT-4_FRONTEND_IMPACT.md pour le plan de migration
--   du code JS (js/tabibi-claim.js → appel RPC au lieu de SELECT email)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Créer ou remplacer la fonction match_doctor_for_claim
-- ---------------------------------------------------------------------
-- Logique :
--   - Reçoit le legacy_id (clé de recherche) + l'email fourni par le claimant
--   - Cherche dans doctor_profiles (accès DEFINER = droits postgres, bypass anon)
--   - Retourne TRUE si l'email correspond, FALSE sinon
--   - Ne retourne JAMAIS l'email stocké → pas d'énumération possible
--
-- Sécurité :
--   - SECURITY DEFINER : s'exécute avec les droits du propriétaire de la fonction
--     (postgres), pas avec ceux de l'appelant (anon)
--   - SET search_path = public : protège contre les attaques de search_path
--   - Pas de RAISE contenant la valeur email → pas de fuite dans les erreurs
--   - Retourne NULL si legacy_id inexistant (identique à FALSE pour le caller)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_doctor_for_claim(
    p_legacy_id  BIGINT,
    p_email      TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.doctor_profiles
        WHERE legacy_id = p_legacy_id::TEXT
          AND lower(trim(email)) = lower(trim(p_email))
          AND is_active = true
    );
$$;

-- Note : legacy_id est stocké en TEXT dans doctor_profiles mais le
-- claim flow passe un entier. Le cast ::TEXT permet les deux.
-- Si legacy_id est un INT en base, remplacer p_legacy_id::TEXT par p_legacy_id.

-- ---------------------------------------------------------------------
-- Accorder EXECUTE à anon (appelé sans authentification depuis claim flow)
-- et à authenticated (doctor déjà connecté qui re-valide)
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- Documenter la fonction
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) IS
    'CRIT-4 fix — valide que l''email fourni correspond au médecin identifié par '
    'legacy_id, sans exposer la valeur stockée. Retourne BOOLEAN. '
    'Remplace la lecture directe de doctor_profiles.email par anon dans '
    'js/tabibi-claim.js:140. SECURITY DEFINER (droits postgres).';

-- ---------------------------------------------------------------------
-- Forcer PostgREST à enregistrer la nouvelle fonction
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATION POST-EXÉCUTION
-- =====================================================================
--
-- 1. Vérifier que la fonction existe et est DEFINER :
--    SELECT routine_name, security_type
--    FROM information_schema.routines
--    WHERE routine_schema = 'public' AND routine_name = 'match_doctor_for_claim';
--    → Attendu : 1 row, security_type = 'DEFINER'
--
-- 2. Test fonctionnel avec un legacy_id + email connu (remplacer les valeurs) :
--    SELECT public.match_doctor_for_claim(12345, 'docteur@example.com');
--    → Attendu : TRUE si email correct, FALSE sinon
--
-- 3. Test anti-énumération via REST :
--    curl -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--      -H "Content-Type: application/json" \
--      -d '{"p_legacy_id": 12345, "p_email": "wrong@test.com"}' \
--      "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/rpc/match_doctor_for_claim"
--    → Attendu : false  (sans exposer l'email réel)
--
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.match_doctor_for_claim(BIGINT, TEXT);
-- NOTIFY pgrst, 'reload schema';
-- =====================================================================
--
-- =====================================================================
-- MIGRATION FRONTEND REQUISE (PHASE 2)
-- =====================================================================
-- Après déploiement de cette RPC, modifier js/tabibi-claim.js :
--
-- AVANT (ligne 140-144) :
--   var _dpRes = await _sb2.from('doctor_profiles')
--     .select('email')
--     .eq('legacy_id', n)
--     .maybeSingle();
--   var _dpEmail = (_dpRes && !_dpRes.error && _dpRes.data && _dpRes.data.email) || null;
--
-- APRÈS :
--   // Étape 1 : demander l'email à l'utilisateur (input dans le formulaire)
--   // Étape 2 : valider via RPC (sans exposer l'email stocké)
--   var _matchRes = await _sb2.rpc('match_doctor_for_claim', {
--     p_legacy_id: parseInt(n),
--     p_email: emailFourniParLUtilisateur
--   });
--   var _emailMatch = _matchRes && !_matchRes.error && _matchRes.data === true;
--
-- Note : Le flux claim devra aussi collecter l'email du claimant AVANT
-- cet appel. Voir CRIT-4_FRONTEND_IMPACT.md section 3 pour le détail
-- du nouveau flux UX.
-- =====================================================================
