-- =====================================================================
-- MESURE — les 20 tables en REFUS PAR DEFAUT, et appointment_notifications
-- LECTURE SEULE. Un seul passage. Mesure, PAS correction.
-- ETAT : BROUILLON — n'a jamais ete execute au moment de sa remise.
-- =====================================================================
-- Constat du 13/09 : `public` compte 55 tables, 55 avec RLS active, 0 sans.
-- Vingt d'entre elles ont ZERO politique — donc refus par defaut. Tout ce qui
-- y ecrit aujourd'hui ne passe que par le proprietaire ou par BYPASSRLS.
--
-- `appointment_notifications` est le cas extreme : RLS=true, FORCE=true,
-- politiques=0. FORCE retire l'exemption du proprietaire : sur cette table,
-- meme postgres serait refuse s'il n'avait pas BYPASSRLS. Rien n'y ecrit que
-- par cet attribut de role.
--
-- QUATRE QUESTIONS, dans cet ordre :
--   1. lesquelles sont ces vingt tables, et sont-elles atteignables par l'API ?
--   2. qui ecrit dans appointment_notifications — fonctions, declencheurs ?
--   3. combien de lignes y a-t-il, et depuis quand ?
--   4. ces ecrivains sont-ils sous un handler silencieux ?
-- =====================================================================

WITH sans_pol AS (
  SELECT c.oid, c.relname, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = c.oid)
),
-- toute fonction plpgsql de public dont le corps nomme la table
ecrivains AS (
  SELECT p.oid, p.proname, p.prosecdef, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
     AND pg_get_functiondef(p.oid) ILIKE '%appointment_notifications%'
)

SELECT '1. les 20 en refus par defaut' AS bloc,
       s.relname || CASE WHEN s.relforcerowsecurity THEN '  [FORCE]' ELSE '' END AS cle,
       'droits anon/authenticated : ' ||
       coalesce((SELECT string_agg(DISTINCT privilege_type, ',')
                   FROM information_schema.role_table_grants g
                  WHERE g.table_schema = 'public' AND g.table_name = s.relname
                    AND g.grantee IN ('anon','authenticated')), 'AUCUN') AS valeur
  FROM sans_pol s

UNION ALL SELECT '1. les 20 en refus par defaut', 'TOTAL', count(*)::text FROM sans_pol

UNION ALL SELECT '2. qui ecrit dans appointment_notifications',
                 proname || CASE WHEN prosecdef THEN '  [SECURITY DEFINER]'
                                 ELSE '  [security invoker]' END,
                 CASE WHEN def ILIKE '%insert into public.appointment_notifications%'
                        OR def ILIKE '%insert into appointment_notifications%'
                      THEN 'INSERT' ELSE 'mentionne seulement' END
            FROM ecrivains

UNION ALL SELECT '2. qui ecrit dans appointment_notifications',
                 'TOTAL fonctions la nommant', count(*)::text FROM ecrivains

UNION ALL SELECT '2. qui ecrit dans appointment_notifications',
                 'declencheur ' || t.tgname || ' sur ' || c.relname,
                 p.proname
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_proc  p ON p.oid = t.tgfoid
           WHERE NOT t.tgisinternal
             AND pg_get_functiondef(p.oid) ILIKE '%appointment_notifications%'

-- 3. LE CONTENU. Une table vide sur une fonctionnalite livree est un soupcon,
--    jamais une donnee — regle du 13/09.
UNION ALL SELECT '3. contenu', 'lignes', count(*)::text
            FROM public.appointment_notifications

-- 4. LE REGIME D'ERREUR DES ECRIVAINS. Un INSERT refuse sous un handler nu
--    disparait sans trace : c'est la question « a-t-il deja echoue en silence ».
UNION ALL SELECT '4. regime d''erreur',
                 proname,
                 CASE WHEN def ILIKE '%when others then%null%'
                      THEN 'HANDLER NU — un refus RLS y disparaitrait en silence'
                      WHEN def ILIKE '%exception%'
                      THEN 'a un EXCEPTION (a lire)'
                      ELSE 'aucun handler — un refus LEVE' END
            FROM ecrivains

UNION ALL SELECT '5. la table elle-meme', 'relrowsecurity',
                 relrowsecurity::text FROM pg_class
           WHERE oid = 'public.appointment_notifications'::regclass
UNION ALL SELECT '5. la table elle-meme', 'relforcerowsecurity',
                 relforcerowsecurity::text FROM pg_class
           WHERE oid = 'public.appointment_notifications'::regclass
UNION ALL SELECT '5. la table elle-meme', 'proprietaire',
                 pg_get_userbyid(relowner) FROM pg_class
           WHERE oid = 'public.appointment_notifications'::regclass

ORDER BY 1, 2;
