-- =====================================================================
-- 20260913_audit_log_echecs_politique.sql
-- Declarer la permissivite du rebut, au lieu de la subir. SEULE.
-- =====================================================================
-- A LANCER PAR AGHILES, SEULE, UN SEUL PASSAGE.
-- A NE LANCER QU'APRES la mesure 20260913_politique_sans_bypassrls.sql :
-- si E1 n'est pas refuse et E2 abouti, cette politique est cosmetique et ce
-- fichier ne doit pas partir.
--
-- POURQUOI. La table est creee avec la RLS active — pas par nous, par la
-- plateforme, en dessous du SQL (mesure : un CREATE TABLE nu sort deja a true).
-- La desactiver serait un combat contre la plateforme, perdu d'avance et perdu
-- en silence le jour ou elle la rallume.
--
-- Elle a ZERO politique, donc refus par defaut. Les ecritures de rebut passent
-- quand meme — mesure faite — mais elles passent grace a l'attribut de role
-- BYPASSRLS de `postgres`. C'est une propriete AMBIANTE : rien dans le schema
-- ne dit que cette table accepte les ecritures, et personne ne peut le lire.
--
--   CE QUI DEPEND DE L'AMBIANCE N'EST PAS DECIDE, IL EST SUBI.
--
-- Cette politique ne change pas ce qui se passe aujourd'hui. Elle ECRIT dans le
-- schema ce qui n'y etait que devine.
--
-- CE QU'ELLE N'OUVRE PAS. Une politique permissive n'accorde aucun droit : le
-- controle de privileges tranche AVANT la RLS. Mesure du 13/09 (D3) : politique
-- posee, un role `authenticated` en direct reste refuse `42501 permission
-- denied for table`. Les REVOKE de la migration precedente restent la porte ;
-- la politique ne fait que declarer qu'une fois la porte franchie, aucune ligne
-- n'est filtree.
--
-- POURQUOI `TO PUBLIC` ET PAS UN ROLE NOMME. La table de rebut doit accepter
-- l'ecriture de QUICONQUE a deja le droit d'y ecrire — c'est-a-dire le
-- proprietaire des fonctions d'audit, quel qu'il devienne. Nommer un role ici
-- reintroduirait exactement la dependance qu'on retire : il faudrait que ce
-- role-la soit celui qui se trouve la, le jour venu.
--
-- POURQUOI SEULEMENT `FOR INSERT`. Le rebut ne fait qu'inserer. Une lecture ou
-- une purge se fait a la main, par un role qui a BYPASSRLS ; si un jour elles
-- se font autrement, ca se declarera a ce moment-la, explicitement.
-- =====================================================================

CREATE POLICY audit_log_echecs_insert_permissif
    ON public.audit_log_echecs
    FOR INSERT
    TO PUBLIC
    WITH CHECK (true);

COMMENT ON POLICY audit_log_echecs_insert_permissif ON public.audit_log_echecs IS
  'Declare que le rebut n''oppose aucun filtre a l''insertion. N''accorde aucun '
  'droit : les privileges tranchent avant la RLS, et ils sont revoques pour anon '
  'et authenticated. Existe pour que la permissivite soit LISIBLE dans le schema '
  'au lieu de dependre de l''attribut BYPASSRLS du role proprietaire.';

-- =====================================================================
-- VERIFICATION — passage SEPARE. Trois lignes, valeurs attendues exactes.
--
--   SELECT 'politique_existe' AS controle, count(*)::text AS valeur, '1' AS attendu
--     FROM pg_policy WHERE polrelid = 'public.audit_log_echecs'::regclass
--   UNION ALL
--   SELECT 'commande', CASE polcmd WHEN 'a' THEN 'INSERT' ELSE polcmd::text END, 'INSERT'
--     FROM pg_policy WHERE polrelid = 'public.audit_log_echecs'::regclass
--   UNION ALL
--   SELECT 'droits_anon_authenticated',
--          coalesce(string_agg(privilege_type, ','), 'AUCUN'), 'AUCUN'
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'audit_log_echecs'
--      AND grantee IN ('anon','authenticated','PUBLIC');
--
-- Le troisieme controle est le plus important : il prouve que poser une
-- politique permissive n'a RIEN ouvert.
-- =====================================================================
