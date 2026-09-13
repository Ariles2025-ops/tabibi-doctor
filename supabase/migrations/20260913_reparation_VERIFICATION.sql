-- =====================================================================
-- VERIFICATION de 20260913_reparation_plpgsql_check.sql
-- =====================================================================
-- A LANCER SEULE, DANS UN PASSAGE SEPARE, APRES la migration.
--
-- Pourquoi un fichier a part : l'editeur SQL de Supabase enveloppe tout le
-- script dans UNE transaction. Le 13/09/2026, une verification placee dans le
-- meme fichier que `CREATE EXTENSION plpgsql_check` a echoue et a annule
-- l'extension avec elle — on l'a crue installee sans qu'elle le soit.
-- L'absence d'erreur n'est pas une preuve de succes.
-- =====================================================================

-- 1. Le balayage doit desormais rendre ZERO ligne.
with plpg as (
  select p.oid, p.proname, p.prorettype
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
)
select f.proname, c.lineno, c.sqlstate, c.message, c.level
  from plpg f
  cross join lateral public.plpgsql_check_function_tb(f.oid) c
 where f.prorettype <> 'trigger'::regtype
union all
select f.proname, c.lineno, c.sqlstate, c.message, c.level
  from plpg f
  join pg_trigger t on t.tgfoid = f.oid and not t.tgisinternal
  cross join lateral public.plpgsql_check_function_tb(f.oid, t.tgrelid) c
 where f.prorettype = 'trigger'::regtype
order by 3, 1, 2;
