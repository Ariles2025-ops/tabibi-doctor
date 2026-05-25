-- =====================================================================
-- PHASE 16.5 — Masquer les médecins non-claimés du front patient
-- =====================================================================
--
-- Décision produit (Option A++) :
--   Le front homepage (index.html) ne doit afficher QUE les médecins
--   ayant claimé leur fiche. Les ~79 746 médecins scrapés (is_claimed
--   = false) restent en base et restent réclamables via doctor-claim.html,
--   mais ne s'affichent plus côté patient anonyme.
--
-- Stratégie :
--   1. Renommer la vue actuelle `public_doctors` en `public_doctors_all`
--      (préserve la définition existante : masque déjà les rejected via
--      `validation_status != 'rejected'`, jointures, colonnes…).
--   2. Créer une NOUVELLE vue `public_doctors` qui wrap `public_doctors_all`
--      avec un filtre `is_claimed = true`. C'est ce que voit le patient.
--   3. Créer une vue `claimable_doctors` qui wrap `public_doctors_all`
--      avec `is_claimed = false AND legacy_id IS NOT NULL`. C'est ce que
--      voit `doctor-claim.html` Flow A (recherche dans les 79k pour claim).
--
-- ---------------------------------------------------------------------
-- DÉCISION SÉCURITÉ — Option SQL-2 (INVOKER, accès _all conservé)
-- ---------------------------------------------------------------------
-- Diagnostic préalable a confirmé que `public_doctors` est créée avec
-- `security_invoker = true` (la vue s'exécute avec les droits du caller,
-- pas du owner). Pour rester cohérent avec ce modèle et préserver les
-- RLS de la table sous-jacente, les 2 nouvelles vues sont créées avec
-- la MÊME option `security_invoker = true`.
--
-- Conséquence : la vue wrapper ne peut lire `_all` que si le caller a
-- lui-même les droits sur `_all`. Donc :
--    → On NE FAIT PAS de REVOKE sur `public_doctors_all`.
--    → anon et authenticated conservent SELECT sur `_all` (la GRANT
--      existante survit au RENAME, pas besoin de la rejouer).
--
-- Compromis assumé : `/rest/v1/public_doctors_all` reste accessible
-- directement. Ce n'est pas une fuite de données (les colonnes exposées
-- sont les mêmes que la vue publique d'avant 16.5) — juste une porte
-- d'entrée alternative qu'un user malin peut découvrir. La sécurité
-- réelle reste sur les RLS de la table sous-jacente, inchangées.
--
-- Option SQL-1 (DEFINER + REVOKE) a été ÉCARTÉE car elle bypasserait
-- les RLS futures qu'on pourrait poser sur `doctor_profiles`.
-- ---------------------------------------------------------------------
--
-- Rollback : section commentée à la fin du fichier.
--
-- Dépendances : diagnostic préalable a confirmé 0 dépendance externe
-- (RPC, autre vue, trigger) sur `public_doctors`. Le RENAME est sûr.
--
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Rename existante
--    Les GRANT existants (anon, authenticated → SELECT) suivent l'OID
--    et restent attachés à `public_doctors_all` après le rename.
-- ---------------------------------------------------------------------
ALTER VIEW public.public_doctors RENAME TO public_doctors_all;

-- ---------------------------------------------------------------------
-- 2. Nouvelle public_doctors : claimed only (= homepage patient)
--    security_invoker=true → cohérent avec la vue d'origine et préserve
--    le passage des RLS de la table sous-jacente au caller.
-- ---------------------------------------------------------------------
CREATE VIEW public.public_doctors
  WITH (security_invoker = true)
AS
SELECT *
FROM public.public_doctors_all
WHERE COALESCE(is_claimed, false) = true;

COMMENT ON VIEW public.public_doctors IS
  'Phase 16.5 — médecins visibles côté patient anonyme : claimés uniquement. ' ||
  'La logique "masquer rejected" reste dans public_doctors_all (wrappée). ' ||
  'security_invoker=true → RLS du caller appliquées.';

-- ---------------------------------------------------------------------
-- 3. Nouvelle claimable_doctors : scrapés non-claimés (= doctor-claim.html)
-- ---------------------------------------------------------------------
CREATE VIEW public.claimable_doctors
  WITH (security_invoker = true)
AS
SELECT *
FROM public.public_doctors_all
WHERE COALESCE(is_claimed, false) = false
  AND legacy_id IS NOT NULL;

COMMENT ON VIEW public.claimable_doctors IS
  'Phase 16.5 — fiches scrapées non-réclamées (~79k). Utilisée par ' ||
  'doctor-claim.html Flow A pour qu''un vrai médecin retrouve sa fiche ' ||
  'et la réclame. security_invoker=true.';

-- ---------------------------------------------------------------------
-- 4. Grants sur les nouvelles vues
--    Pas de REVOKE sur public_doctors_all : Option SQL-2 conserve l'accès
--    anon/authenticated sur la vue interne (cf. décision en tête de fichier).
-- ---------------------------------------------------------------------
GRANT SELECT ON public.public_doctors    TO anon, authenticated;
GRANT SELECT ON public.claimable_doctors TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Forcer PostgREST à recharger son schema cache
--    Sans ce NOTIFY, /rest/v1/claimable_doctors renverra 404 pendant
--    jusqu'à 10 minutes (PostgREST schema cache TTL).
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATIONS POST-MIGRATION (à exécuter manuellement après COMMIT)
-- =====================================================================
--
-- 1. Compter les médecins visibles côté patient (devrait être ~1 aujourd'hui) :
--      SELECT count(*) FROM public.public_doctors;
--
-- 2. Compter les fiches réclamables (devrait être ~79 745 aujourd'hui) :
--      SELECT count(*) FROM public.claimable_doctors;
--
-- 3. Sanity-check : _all reste lisible (Option SQL-2) et = somme des 2 :
--      SELECT count(*) FROM public.public_doctors_all;
--      -- doit être ≈ count(public_doctors) + count(claimable_doctors)
--      -- (+ éventuels rangs sans legacy_id ni is_claimed, masqués des 2 vues)
--
-- 4. Test API REST anon depuis terminal local :
--      curl -H "apikey: $ANON" \
--        "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/public_doctors?select=id"
--      → doit renvoyer ~1 row (claimed)
--
--      curl -H "apikey: $ANON" \
--        "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/claimable_doctors?select=id&limit=1"
--      → doit renvoyer 1 row (scrapé)
--
-- 5. Smoke test homepage staging : recharger silly-biscotti, vérifier que
--    seul "Ouanza Dental Clinic" apparaît dans les cards et que le compteur
--    "X médecins certifiés" passe à 1 (avant fix TÂCHE 3 du compteur).
--
-- =====================================================================
-- ROLLBACK (en cas de problème)
-- =====================================================================
-- BEGIN;
-- DROP VIEW IF EXISTS public.public_doctors;
-- DROP VIEW IF EXISTS public.claimable_doctors;
-- ALTER VIEW public.public_doctors_all RENAME TO public_doctors;
-- -- GRANT anon/authenticated survit au RENAME, pas besoin de la rejouer.
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
-- =====================================================================
