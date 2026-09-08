-- ============================================================================
-- P0 — RETRAIT DE L'ACCÈS ANONYME À public.match_doctor_for_claim
-- ============================================================================
-- Projet   : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Origine  : AUDIT_RESTANT_2026-07-29.md, ligne P0 « RPC exposée à anon et
--            jamais appelée » — 0 occurrence dans js/ et *.html au 08/09/2026.
-- Effet    : supprime une surface d'attaque non utilisée. Aucune donnée touchée.
-- Risque   : nul si la fonction reste bien inutilisée par le front (vérifié).
--            Rollback fourni en fin de fichier.
--
-- ⚠️ PIÈGE DU SQL EDITOR SUPABASE (rappel de PURGE_comptes_test.sql)
-- Chaque clic sur `Run` ouvre une connexion neuve : pas de BEGIN, pas de COMMIT.
-- Un Run est déjà atomique. La vérification se fait dans un Run SÉPARÉ.
-- ============================================================================


-- ############################################################################
-- ÉTAPE 1 — DIAGNOSTIC (lecture seule). Run séparé.
-- ############################################################################
-- Attendu : une ligne, avec 'anon=X/postgres' présent dans proacl.
-- Si la fonction n'existe pas (0 ligne), il n'y a rien à faire : STOP.

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef                                AS security_definer,
       p.proacl                                   AS droits
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'match_doctor_for_claim';


-- ############################################################################
-- ÉTAPE 2 — RETRAIT DU DROIT. Un seul Run.
-- ############################################################################
-- Signature lue dans migrations/CRIT-4_step3_rpc_claim.sql:34-37.
-- Si l'étape 1 affiche une signature différente, adapter avant d'exécuter.

REVOKE EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) FROM anon;

-- `authenticated` est conservé volontairement : un médecin déjà connecté peut
-- re-valider sa correspondance. Décommenter la ligne suivante seulement si on
-- veut fermer la fonction complètement (elle n'est appelée nulle part).
-- REVOKE EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) FROM authenticated;


-- ############################################################################
-- ÉTAPE 3 — VÉRIFICATION. Run SÉPARÉ, obligatoire.
-- ############################################################################
-- Attendu : 'anon=X/postgres' a disparu de la colonne droits.
-- Ne jamais conclure depuis le « Success » de l'étape 2.

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.proacl                                  AS droits,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_peut_encore_executer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'match_doctor_for_claim';

-- Attendu : anon_peut_encore_executer = false.


-- ############################################################################
-- ROLLBACK — seulement si un usage caché de la RPC apparaît.
-- ############################################################################
-- GRANT EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) TO anon;
