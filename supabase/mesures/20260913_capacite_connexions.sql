-- =====================================================================
-- MESURE DE CAPACITE — connexions Postgres
-- 20260913, ne dans l'incident 53300 « too many clients already »
-- ETAT : MESURE — EXECUTEE le 13/09/2026 par le stratege.
--        Blocs 1 a 5 et 7. Le bloc 6 (dormantes les plus vieilles) a ete omis :
--        il ne change pas la conclusion, et on le dit plutot que de laisser
--        croire que la sortie ci-dessous est complete.
--
-- ---------------------------------------------------------------------
-- LE RELEVE, TEL QUEL
-- ---------------------------------------------------------------------
--   1. plafond
--        max_connections                      60
--        superuser_reserved_connections        3
--        reserved_connections                  0
--        statement_timeout                120000 ms
--        idle_in_transaction_session_timeout   0   <- jamais de coupure
--
--   2. occupation
--        ouvertes, toutes bases               13
--        ouvertes, cette base                  7
--        marge restante                       47
--
--   3. etats        interne 8 · active 1 · idle 4
--
--   4. qui          authenticator / PostgREST 14.5 ....... 2
--                   postgres / mgmt-api .................. 1
--                   postgres / pg_net .................... 1
--                   supabase_admin / (sans nom) .......... 2
--                   pg_cron scheduler .................... 1
--                   postgres_exporter .................... 1
--
--   5. pooler       Supavisor 0 · PostgREST 2 · adresses clientes distinctes 2
--   7. transactions ouvertes : AUCUNE
--
-- ---------------------------------------------------------------------
-- CE QUE LE RELEVE ETABLIT
-- ---------------------------------------------------------------------
-- **La limite n'est pas les connexions.** 47 de marge au calme, aucune
-- transaction restee ouverte, un pool PostgREST de 2 a vide.
--
-- Ce qu'il etablit vraiment, c'est le GABARIT : `max_connections = 60` est la
-- valeur du plus petit gabarit de calcul Supabase (Micro). Et `Supavisor 0`
-- avec `adresses clientes distinctes 2` dit que **personne n'est branche par le
-- pooler**. Deux reglages de console, zero ligne de code.
--
-- ⚠️  ET LE RELEVE NE DIT RIEN DU CONGRES. Il est pris au calme, sur une base
-- dont presque toutes les tables metier sont vides. Un chiffre au repos ne
-- predit pas une charge. La ligne « rejouer la mesure sous charge avant
-- decembre » reste entiere.
--
-- ---------------------------------------------------------------------
-- L'INCIDENT DU JOUR N'EST PAS EXPLIQUE PAR CE RELEVE — ET C'EST NORMAL
-- ---------------------------------------------------------------------
-- `53300 too many clients already` s'est produit le matin, avec une dizaine
-- d'onglets d'editeur SQL ouverts. Le releve est pris APRES leur fermeture :
-- il montre l'etat sain, pas l'etat sature. Il confirme le mecanisme (60 places,
-- une dizaine d'onglets + 13 connexions de service en consomment une bonne
-- part) sans le reproduire.
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
