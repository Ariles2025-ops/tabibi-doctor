-- =====================================================================
-- PHASE 16.5 — ROLLBACK
-- =====================================================================
-- Annule la migration PHASE16_5_hide_unclaimed.sql.
-- Restaure l'état pré-16.5 :
--   - public_doctors redevient la vue unique (= public_doctors_all renommée
--     en arrière)
--   - claimable_doctors disparaît
--   - les GRANT anon/authenticated survivent au RENAME (pas besoin de
--     rejouer un GRANT)
--
-- Pré-requis : doctor-claim.html doit avoir été rollback côté front avant
-- de lancer ce SQL, sinon ses fetchs vers /rest/v1/claimable_doctors
-- renverront 404 jusqu'au prochain deploy front.
-- =====================================================================

BEGIN;

-- 1. Supprimer les 2 vues wrappers créées par phase16.5
DROP VIEW IF EXISTS public.public_doctors;
DROP VIEW IF EXISTS public.claimable_doctors;

-- 2. Restaurer la vue d'origine sous son nom historique
ALTER VIEW public.public_doctors_all RENAME TO public_doctors;

-- 3. Forcer PostgREST à recharger son schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATIONS POST-ROLLBACK
-- =====================================================================
-- 1. count(public_doctors) devrait remonter à ~79 746 :
--      SELECT count(*) FROM public.public_doctors;
--
-- 2. claimable_doctors ne doit plus exister :
--      SELECT count(*) FROM public.claimable_doctors;
--      -- doit échouer avec : relation "public.claimable_doctors" does not exist
--
-- 3. Test API REST anon :
--      curl -H "apikey: $ANON" \
--        "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/public_doctors?select=id&limit=1"
--      → doit renvoyer 1 row
-- =====================================================================
