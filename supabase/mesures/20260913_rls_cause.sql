-- =====================================================================
-- DIAGNOSTIC — pourquoi audit_log_echecs a la RLS active
-- LECTURE SEULE. Un seul passage. Aucune ecriture, aucun ALTER.
-- =====================================================================
-- La migration ne contient aucun ENABLE ROW LEVEL SECURITY. L'etat dit le
-- contraire. On cherche QUI l'a active, pas on suppose.
--
-- Quatre hypotheses testees, dans cet ordre :
--   1. l'etat exact de la table (RLS active ? forcee ? combien de politiques ?)
--   2. un DECLENCHEUR D'EVENEMENT qui agit sur les CREATE TABLE
--   3. un caractere SYSTEMIQUE : les autres tables de public l'ont-elles aussi ?
--   4. le proprietaire et les roles, pour la suite (contournement par owner)
-- =====================================================================

WITH t AS (SELECT 'public.audit_log_echecs'::regclass AS oid)

SELECT '1. la table' AS bloc, 'relrowsecurity (RLS active)' AS cle,
       relrowsecurity::text AS valeur
  FROM pg_class, t WHERE pg_class.oid = t.oid
UNION ALL
SELECT '1. la table', 'relforcerowsecurity (forcee au proprietaire)',
       relforcerowsecurity::text
  FROM pg_class, t WHERE pg_class.oid = t.oid
UNION ALL
SELECT '1. la table', 'proprietaire', pg_get_userbyid(relowner)
  FROM pg_class, t WHERE pg_class.oid = t.oid
UNION ALL
SELECT '1. la table', 'nombre de politiques', count(*)::text
  FROM pg_policy, t WHERE polrelid = t.oid

-- 2. DECLENCHEURS D'EVENEMENT — la cause la plus probable d'un ENABLE
--    qu'aucun fichier ne contient.
UNION ALL
SELECT '2. declencheurs d''evenement',
       evtname || '  (' || evtevent || ', ' ||
       CASE evtenabled WHEN 'O' THEN 'actif' WHEN 'D' THEN 'desactive'
                       WHEN 'R' THEN 'actif replica' ELSE 'actif always' END || ')',
       'fonction ' || p.proname
  FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid
UNION ALL
SELECT '2. declencheurs d''evenement', 'TOTAL', count(*)::text
  FROM pg_event_trigger
UNION ALL
-- celles dont le corps parle de RLS : la preuve, pas l'indice
SELECT '2. declencheurs d''evenement',
       'corps mentionnant ROW LEVEL SECURITY -> ' || p.proname, 'SUSPECT'
  FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid
 WHERE pg_get_functiondef(p.oid) ILIKE '%row level security%'

-- 3. SYSTEMIQUE OU NON — si toutes les tables recentes l'ont, ce n'est pas
--    un accident de cette migration.
UNION ALL
SELECT '3. le schema public', 'tables avec RLS ACTIVE', count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
UNION ALL
SELECT '3. le schema public', 'tables avec RLS INACTIVE', count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
SELECT '3. le schema public', 'tables RLS active MAIS ZERO politique',
       count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
   AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = c.oid)

-- 4. LES 15 TABLES LES PLUS RECENTES (oid croissant = creation, approximation
--    fiable ici), avec leur etat. Si les dernieres creees sont toutes a TRUE,
--    la cause est en amont de nous.
UNION ALL
SELECT '4. les 15 dernieres tables creees',
       lpad(x.rang::text, 2, '0') || '. ' || x.nom,
       'RLS=' || x.rls || '  politiques=' || x.nb_pol
  FROM (
    SELECT row_number() OVER (ORDER BY c.oid DESC) AS rang,
           c.relname AS nom,
           c.relrowsecurity::text AS rls,
           (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid)::text AS nb_pol
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.oid DESC LIMIT 15
  ) x

-- 5. LE CONTEXTE D'EXECUTION — pour interpreter la suite (le proprietaire
--    contourne la RLS ; encore faut-il savoir qui est proprietaire de quoi).
UNION ALL
SELECT '5. contexte', 'current_user', current_user
UNION ALL
SELECT '5. contexte', 'session_user', session_user
UNION ALL
SELECT '5. contexte', 'current_user a BYPASSRLS',
       (SELECT rolbypassrls::text FROM pg_roles WHERE rolname = current_user)

ORDER BY 1, 2;
