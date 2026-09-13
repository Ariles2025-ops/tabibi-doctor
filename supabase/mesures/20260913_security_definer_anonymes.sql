-- =====================================================================
-- 20260913_security_definer_anonymes.sql — MESURE, lecture seule
-- =====================================================================
-- EXECUTEE le 13/09/2026 par le MCP Supabase, en lecture.
-- SORTIE : docs/CARTE_SECURITY_DEFINER_ANONYMES.md, section « Les trois listes ».
--
-- Versionnee parce qu'une mesure qui a tourne et qui n'est pas dans le depot ne
-- pourra pas etre rejouee — et qu'on ne saura plus comment le chiffre a ete
-- obtenu, seulement quel il etait.
--
-- ---------------------------------------------------------------------
-- DEUX PIEGES QUE CETTE REQUETE EVITE, ET QU'UN BALAYAGE NAIF MANQUE
-- ---------------------------------------------------------------------
-- 1. LES DECLENCHEURS. PostgREST n'expose pas les fonctions dont le retour est
--    `trigger` : un visiteur anonyme ne peut pas les appeler. Les compter comme
--    des portes fait passer la liste « a fermer » de 2 a 10. On les isole.
--
-- 2. LA GARDE INDIRECTE. `dawini_respond` ne contient pas `auth.uid()` et
--    serait classee « sans garde ». Son corps commence pourtant par
--    `dawini_my_pharmacy_id()` suivi d'un `RAISE EXCEPTION 'not_a_pharmacy'`.
--    La CTE `gd` resout donc UN niveau d'indirection : une fonction est gardee
--    si elle lit une garde, ou si elle appelle une fonction publique qui en lit
--    une.
--
--    ⚠️  UN SEUL niveau. Une garde a deux fonctions de distance echapperait
--    encore. Le balayage dit par ou commencer, il ne conclut pas.
--
-- 3. NE PAS AGREGER AVEC `distinct proname`. `claim_my_doctor_profile` a deux
--    surcharges : `distinct` les fond en une, et le `count(*)` cesse de
--    correspondre a la liste nommee. C'est l'erreur commise le 13/09 (9 comptees,
--    8 nommees). Agreger sur (proname, args), ou ne pas agreger.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LES QUATRE LISTES, avec leur compte
-- ---------------------------------------------------------------------
with pub as (
  select p.oid, p.proname,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_functiondef(p.oid) as def,
         (p.prorettype::regtype::text = 'trigger') as est_trigger,
         p.prosecdef,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ok
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
), gd as (
  select proname,
         (def ~* 'auth\.uid\s*\(|auth\.jwt\s*\(|auth\.role\s*\(|is_admin|is_super_admin|current_user_role') as g
    from pub
), r as (
  select a.proname, a.args, a.est_trigger,
         (a.def ~* '\minsert\s+into\s|\mupdate\s|\mdelete\s+from\s') as ecrit,
         ( (a.def ~* 'auth\.uid\s*\(|auth\.jwt\s*\(|auth\.role\s*\(|is_admin|is_super_admin|current_user_role')
           or coalesce((select bool_or(g.g) from gd g
                         where g.g and a.def ~ ('\m' || g.proname || '\s*\(')), false)
         ) as garde
    from pub a
   where a.prosecdef and a.anon_ok
)
select case when est_trigger              then 'D_DECLENCHEUR (non appelable en RPC)'
            when ecrit and not garde      then 'A_ECRIT_SANS_GARDE'
            when ecrit and garde          then 'B_ECRIT_AVEC_GARDE'
            else                               'C_LECTURE_SEULE' end as liste,
       count(*) as n,
       string_agg(proname || '(' || args || ')', E'\n  ' order by proname, args) as fonctions
  from r
 group by 1
 order by 1;

-- Sortie du 13/09/2026 :
--   A_ECRIT_SANS_GARDE                     2
--   B_ECRIT_AVEC_GARDE                     9
--   C_LECTURE_SEULE                       29
--   D_DECLENCHEUR (non appelable en RPC)  17
--                                    total 57   (59 avant les deux REVOKE)

-- ---------------------------------------------------------------------
-- 2. LE DETAIL DE LA LISTE A — a lire corps par corps, pas a resumer
-- ---------------------------------------------------------------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('dawini_expire_old', 'fn_check_rate_limit')
 order by 1;

-- ---------------------------------------------------------------------
-- 3. LES DROITS, avant et apres un REVOKE
-- ---------------------------------------------------------------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('postgres',      p.oid, 'EXECUTE') as postgres
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef
 order by anon desc, 1;
