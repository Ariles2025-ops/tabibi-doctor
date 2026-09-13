-- =====================================================================
-- MESURE — d'ou vient l'unique rendez-vous de la base ?
-- LECTURE SEULE. Un seul passage.
-- =====================================================================
-- ETAT : BROUILLON — n'a jamais ete execute au moment de sa remise.
--
-- LE CONSTAT. `appointments` contient UNE ligne, creee le 13/09/2026, statut
-- `cancelled`. Toutes nos mesures du jour ont ete annulees : elle ne vient pas
-- de nous.
--
-- DEUX ORIGINES POSSIBLES, et une seule est un defaut :
--   O1  un test manuel d'Aghiles dans l'interface -> rien a corriger
--   O2  un test e2e qui ecrit EN PRODUCTION au lieu d'un environnement dedie
--       -> defaut serieux : chaque passage de la CI laisse des donnees reelles
--          dans la base de production, et le jour du congres elles se
--          melangeront a de vrais rendez-vous.
--
-- CE QUI LES DISTINGUE, et ce que la requete cherche :
--   - l'heure exacte de creation, a comparer aux passages de CI du 13/09 ;
--   - le patient et le medecin : un compte marque RECETTE-<date> ou un e-mail
--     de test (`@example.`, `+test`, `e2e`, `playwright`) designe O2 ;
--   - la trace laissee par le declencheur d'audit `fn_audit_changes`, qui est
--     en regime BLOQUANT (sa trace est constitutive) : elle doit exister, et
--     elle porte l'identite de l'auteur.
-- =====================================================================

SELECT '1. le rendez-vous' AS bloc, 'id' AS cle, a.id::text AS valeur
  FROM public.appointments a
UNION ALL SELECT '1. le rendez-vous', 'created_at',
                 to_char(a.created_at, 'YYYY-MM-DD HH24:MI:SS.MS TZ') FROM public.appointments a
UNION ALL SELECT '1. le rendez-vous', 'updated_at',
                 to_char(a.updated_at, 'YYYY-MM-DD HH24:MI:SS.MS TZ') FROM public.appointments a
UNION ALL SELECT '1. le rendez-vous', 'status', a.status::text FROM public.appointments a
UNION ALL SELECT '1. le rendez-vous', 'patient_id', coalesce(a.patient_id::text, 'NULL')
            FROM public.appointments a
UNION ALL SELECT '1. le rendez-vous', 'doctor_id', coalesce(a.doctor_id::text, 'NULL')
            FROM public.appointments a

-- 2. QUI SONT CES DEUX COMPTES. Un e-mail de test designe O2.
UNION ALL SELECT '2. le patient',
                 'email / cree le',
                 coalesce(u.email, '(introuvable)') || '  —  '
                   || coalesce(to_char(u.created_at, 'YYYY-MM-DD HH24:MI'), '?')
            FROM public.appointments a LEFT JOIN public.users u ON u.id = a.patient_id
UNION ALL SELECT '2. le patient', 'forme de test ?',
                 CASE WHEN u.email ILIKE '%example.%' OR u.email ILIKE '%+test%'
                        OR u.email ILIKE '%e2e%'      OR u.email ILIKE '%playwright%'
                        OR u.email ILIKE '%RECETTE%'  OR u.email ILIKE '%test%'
                      THEN 'OUI — indice fort pour O2'
                      ELSE 'non — plutot O1' END
            FROM public.appointments a LEFT JOIN public.users u ON u.id = a.patient_id

-- 3. LA TRACE D'AUDIT. fn_audit_changes est en regime BLOQUANT : si le
--    rendez-vous existe, sa trace existe. Son absence serait elle-meme un fait.
UNION ALL SELECT '3. trace audit',
                 to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') || '  ' || coalesce(l.action, '?'),
                 'par ' || coalesce(l.user_id::text, 'NULL')
            FROM public.audit_log l
           WHERE l.table_name = 'appointments'
           ORDER BY 1, 2

-- (requete volontairement sans LIMIT : il y a une seule ligne d'appointments)
