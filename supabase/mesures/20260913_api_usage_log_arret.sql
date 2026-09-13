-- =====================================================================
-- MESURE — pourquoi les tables api_usage_log_* s'arretent-elles au 2 juin ?
-- LECTURE SEULE. Un seul passage.
-- =====================================================================
-- ETAT : BROUILLON — n'a jamais ete execute au moment de sa remise.
--
-- LE CONSTAT. Seize tables `api_usage_log_20260518` ... `api_usage_log_20260602`,
-- une par jour, du 18 mai au 2 juin. Puis PLUS RIEN depuis trois mois.
--
-- DEUX HYPOTHESES, et elles n'appellent pas la meme suite :
--   H1  la fonctionnalite a ete retiree -> ces 16 tables sont des restes a purger
--   H2  un pg_cron est mort en silence  -> le partitionnement ne se fait plus,
--       et tout ce qui ecrit dans ces tables ecrit peut-etre dans le vide
-- Un cron mort est le meme defaut que tout le reste de la journee : quelque
-- chose qui a cesse, et dont l'arret ne s'annonce nulle part.
--
-- La lecture des dates de creation ne suffirait pas : une table peut exister
-- sans que rien n'y ecrive. On regarde donc les TACHES et leurs PASSAGES.
-- =====================================================================

SELECT '1. les taches pg_cron' AS bloc,
       jobname || '  (' || schedule || ')' AS cle,
       CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END
         || '  —  ' || left(command, 80) AS valeur
  FROM cron.job

UNION ALL SELECT '1. les taches pg_cron', 'TOTAL', count(*)::text FROM cron.job
UNION ALL SELECT '1. les taches pg_cron', 'dont INACTIVES', count(*)::text
            FROM cron.job WHERE NOT active

-- 2. LE DERNIER PASSAGE DE CHAQUE TACHE. Une tache active qui n'a plus tourne
--    depuis juin est la reponse a H2.
UNION ALL SELECT '2. dernier passage par tache',
                 j.jobname,
                 coalesce(to_char(max(d.end_time), 'YYYY-MM-DD HH24:MI'), 'JAMAIS')
                   || '  (' || coalesce(max(d.status), '-') || ')'
            FROM cron.job j
            LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
           GROUP BY j.jobname

-- 3. LES ECHECS RECENTS, s'il y en a. Un cron qui echoue a chaque passage est
--    different d'un cron qui ne passe plus.
UNION ALL SELECT '3. passages en echec (20 derniers)',
                 to_char(d.end_time, 'YYYY-MM-DD HH24:MI') || '  ' || coalesce(j.jobname, '?'),
                 left(coalesce(d.return_message, d.status), 90)
            FROM (SELECT * FROM cron.job_run_details
                   WHERE status IS DISTINCT FROM 'succeeded'
                   ORDER BY end_time DESC NULLS LAST LIMIT 20) d
            LEFT JOIN cron.job j ON j.jobid = d.jobid

-- 4. QUI PARLE DE api_usage_log DANS LE CODE SQL. Si une fonction cree encore
--    ces tables, H1 est faux : la fonctionnalite n'a pas ete retiree.
UNION ALL SELECT '4. fonctions nommant api_usage_log',
                 n.nspname || '.' || p.proname,
                 CASE WHEN pg_get_functiondef(p.oid) ILIKE '%create table%'
                      THEN 'CREE des tables' ELSE 'y ecrit ou la lit' END
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
             AND pg_get_functiondef(p.oid) ILIKE '%api_usage_log%'

-- 5. LE CONTENU. Seize tables vides seraient un reste ; seize tables pleines
--    qui s'arretent net sont un arret de service.
UNION ALL SELECT '5. les tables elles-memes',
                 c.relname,
                 'lignes estimees ' || c.reltuples::bigint::text
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
             AND c.relname LIKE 'api\_usage\_log\_%'

ORDER BY 1, 2;
