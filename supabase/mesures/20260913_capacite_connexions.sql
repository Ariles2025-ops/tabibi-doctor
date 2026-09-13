-- =====================================================================
-- MESURE DE CAPACITE — connexions Postgres
-- 20260913, ne dans l'incident 53300 « too many clients already »
-- ETAT : BROUILLON — n'a jamais ete execute au moment de sa remise.
-- =====================================================================
-- LECTURE SEULE. Aucune ecriture, aucun pg_terminate_backend, aucun reglage
-- modifie. Un seul passage : le resultat est une table etiquetee.
--
-- CE QUE CETTE REQUETE NE PEUT PAS DIRE : si Supavisor (le pooler Supabase) est
-- actif et dans quel mode. Ca ne se lit pas depuis Postgres — c'est un fait de
-- tableau de bord. Le bloc 5 donne des INDICES, pas la reponse. La reponse se
-- lit dans Dashboard > Project Settings > Database > Connection pooling
-- (mode + Pool Size), et dans les chaines de connexion : port 6543 = pooler en
-- mode transaction, port 5432 = connexion directe ou pooler en mode session.
-- =====================================================================

WITH act AS (
  SELECT * FROM pg_stat_activity
), moi AS (
  SELECT * FROM act WHERE datname = current_database()
)
SELECT '1. plafond' AS bloc, name AS cle, setting AS valeur
  FROM pg_settings
 WHERE name IN ('max_connections',
                'superuser_reserved_connections',
                'reserved_connections',
                'idle_in_transaction_session_timeout',
                'statement_timeout')

UNION ALL SELECT '2. occupation', 'ouvertes, toutes bases', count(*)::text FROM act
UNION ALL SELECT '2. occupation', 'ouvertes, cette base',   count(*)::text FROM moi
UNION ALL SELECT '2. occupation',
                 'marge restante (plafond - ouvertes)',
                 (current_setting('max_connections')::int - (SELECT count(*) FROM act))::text

UNION ALL SELECT '3. etat', coalesce(state, '(null — backend interne)'), count(*)::text
            FROM act GROUP BY state

UNION ALL SELECT '4. qui',
                 usename || '  /  ' || coalesce(nullif(application_name, ''), '(sans nom)'),
                 count(*)::text
            FROM act GROUP BY usename, application_name

UNION ALL SELECT '5. pooler (indice, PAS preuve)',
                 'connexions dont application_name evoque Supavisor',
                 count(*)::text
            FROM act WHERE application_name ILIKE '%supavisor%'
UNION ALL SELECT '5. pooler (indice, PAS preuve)',
                 'adresses clientes distinctes',
                 count(DISTINCT client_addr)::text
            FROM act
UNION ALL SELECT '5. pooler (indice, PAS preuve)',
                 'connexions PostgREST (application_name)',
                 count(*)::text
            FROM act WHERE application_name ILIKE '%postgrest%'

UNION ALL SELECT '6. dormantes les plus vieilles',
                 coalesce(nullif(p.application_name, ''), '(sans nom)')
                   || '  —  ' || p.usename,
                 'inactive depuis ' || justify_interval(now() - p.state_change)::text
            FROM (SELECT * FROM act
                   WHERE state = 'idle'
                   ORDER BY state_change
                   LIMIT 10) p

UNION ALL SELECT '7. en transaction ouverte (le vrai danger)',
                 coalesce(nullif(p.application_name, ''), '(sans nom)')
                   || '  —  ' || p.usename,
                 'depuis ' || justify_interval(now() - p.xact_start)::text
            FROM (SELECT * FROM act
                   WHERE state = 'idle in transaction'
                   ORDER BY xact_start
                   LIMIT 10) p

ORDER BY 1, 2;
