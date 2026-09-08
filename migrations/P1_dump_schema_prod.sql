-- ============================================================================
-- P1 — DUMP DU SCHÉMA DE PRODUCTION (lecture seule, 6 Run)
-- ============================================================================
-- Projet : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Origine : AUDIT_RESTANT_2026-07-29.md — « Schéma prod non versionné ».
--           La branche chore/schema-dump a été supprimée sans jamais produire
--           le fichier. Sans lui, migrations/ n'est PAS le miroir de la base :
--           25 RPC appelées par le front n'ont aucune définition dans le dépôt.
--
-- MODE D'EMPLOI
--   Le SQL Editor Supabase n'exécute pas pg_dump. On reconstitue donc le
--   schéma par introspection : 6 requêtes en LECTURE SEULE, à lancer une par
--   une. Pour chacune : Run, puis « Download CSV » (bouton en haut à droite du
--   panneau de résultats), et on colle le contenu sous la section
--   correspondante de migrations/PROD_SCHEMA_DUMP.sql.
--
--   AUCUNE de ces requêtes n'écrit quoi que ce soit. Elles sont rejouables.
-- ============================================================================


-- ############################################################################
-- RUN 1 — TABLES ET COLONNES
-- ############################################################################
SELECT c.relname                                   AS table_name,
       a.attnum                                    AS ordre,
       a.attname                                   AS colonne,
       format_type(a.atttypid, a.atttypmod)        AS type,
       NOT a.attnotnull                            AS nullable,
       pg_get_expr(d.adbin, d.adrelid)             AS defaut,
       c.relrowsecurity                            AS rls_active
  FROM pg_class c
  JOIN pg_namespace n     ON n.oid = c.relnamespace
  JOIN pg_attribute a     ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d  ON d.adrelid = c.oid AND d.adnum = a.attnum
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY c.relname, a.attnum;


-- ############################################################################
-- RUN 2 — POLICIES RLS (les 94 annoncées dans CLAUDE.md)
-- ############################################################################
-- Ferme le résiduel de CRIT-1 : on voit enfin, écrit, ce que chaque rôle peut
-- faire sur chaque table.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual        AS using_clause,
       with_check  AS with_check_clause
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;


-- ############################################################################
-- RUN 3 — FONCTIONS / RPC AVEC LEUR CORPS COMPLET
-- ############################################################################
-- C'est la requête décisive : elle sort la définition des 25 RPC qui vivent en
-- prod sans exister dans le dépôt, et prouve l'absence des 4 RPC ordonnances.
SELECT p.proname                                     AS fonction,
       pg_get_function_identity_arguments(p.oid)     AS arguments,
       pg_get_functiondef(p.oid)                     AS definition,
       p.prosecdef                                   AS security_definer,
       p.proacl                                      AS droits
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
 ORDER BY p.proname;


-- ############################################################################
-- RUN 4 — VUES (dont public_doctors, qui a déjà menti une fois)
-- ############################################################################
-- Rappel PROGRESS.md 10.1 : la vue expose le NOM RÉEL, toujours.
-- L'anonymisation SEO est faite par le script, pas par la vue. À re-vérifier
-- ici avant toute régénération de pages publiques.
SELECT c.relname AS vue,
       pg_get_viewdef(c.oid, true) AS definition,
       c.reloptions AS options
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
 ORDER BY c.relname;


-- ############################################################################
-- RUN 5 — CONTRAINTES, INDEX, TRIGGERS
-- ############################################################################
SELECT 'contrainte' AS objet, conrelid::regclass::text AS sur,
       conname AS nom, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
UNION ALL
SELECT 'index', tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'trigger', c.relname, t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname = 'public'
 ORDER BY 1, 2, 3;


-- ############################################################################
-- RUN 6 — DROITS PAR TABLE ET PAR RÔLE
-- ############################################################################
-- Contrôle de CRIT-4 : anon ne doit avoir AUCUN droit sur doctor_profiles.
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS droits
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ('anon','authenticated','service_role')
 GROUP BY table_name, grantee
 ORDER BY table_name, grantee;

-- Attendu : aucune ligne « doctor_profiles / anon ».
