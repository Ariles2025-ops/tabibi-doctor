-- ============================================================================
-- PURGE DES COMPTES DE TEST EN PRODUCTION
-- ============================================================================
-- Projet   : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Exécuté  : 2026-08-05 par Aghiles — voir docs/PROD_SEEDS_REGISTRY.md
-- Statut   : ARCHIVE. Conservé comme référence de procédure, pas à rejouer tel quel.
--
-- ⚠️ PIÈGE DU SQL EDITOR SUPABASE — lire avant toute modification
--
-- Chaque clic sur `Run` ouvre une CONNEXION NEUVE. Un script commençant par
-- `BEGIN;` sans `COMMIT;` dans le MÊME Run est annulé par ROLLBACK implicite
-- à la fermeture de la connexion. Le `COMMIT;` envoyé dans un Run suivant
-- s'exécute sur une autre connexion, ne trouve aucune transaction ouverte, et
-- renvoie « Success. No rows returned » — SUCCÈS TROMPEUR, rien n'a bougé.
--
-- C'est arrivé le 2026-08-05 : la première version de ce script utilisait
-- BEGIN/COMMIT, tout semblait passer, la vérification a montré 5 comptes intacts.
--
-- RÈGLE : pas de BEGIN ni de COMMIT ici. Un Run est déjà atomique — si une
-- instruction échoue, tout le Run est annulé. Vérifier dans un Run SÉPARÉ.
-- ============================================================================


-- ############################################################################
-- ÉTAPE 1 — DIAGNOSTIC (lecture seule). Run séparé, à relire avant l'étape 2.
-- ############################################################################

-- 1.a — Les comptes ciblés et ce qui y est rattaché.
--       `legacy_id_max` est la colonne décisive : au-delà de 1000, la fiche vient
--       du fonds réel de 79k et doit être DÉ-CLAIMÉE, jamais supprimée.
WITH candidats AS (
  SELECT au.id, au.email, au.created_at, au.last_sign_in_at
    FROM auth.users au
   WHERE au.email IN (
           'medecin.test@tabibi.doctor',
           'medecin.test.desktop@tabibi.doctor',
           'patient.test.desktop@tabibi.doctor',
           'patient.confirme@tabibi.doctor',
           'admin.test@tabibi.doctor'
         )
)
SELECT c.email,
       COALESCE(to_char(c.last_sign_in_at,'YYYY-MM-DD'),'JAMAIS') AS derniere_connexion,
       (SELECT count(*) FROM public.doctor_profiles dp WHERE dp.user_id = c.id) AS fiches,
       (SELECT count(*) FROM public.appointments a     WHERE a.patient_id = c.id) AS rdv_patient,
       (SELECT count(*) FROM public.cabinets cb        WHERE cb.owner_user_id = c.id) AS cabinets,
       (SELECT COALESCE(max(dp.legacy_id),0) FROM public.doctor_profiles dp WHERE dp.user_id = c.id) AS legacy_id_max
  FROM candidats c
 ORDER BY c.created_at;

-- 1.b — Cartographie des dépendances : quelles tables référencent ces comptes,
--       et lesquelles bloquent en RESTRICT. Le 2026-08-05, sur 39 clés étrangères
--       vers users, seules DEUX bloquaient : cabinets.owner_user_id et
--       appointments.patient_id. Les 37 autres sont CASCADE ou SET NULL.
--       Relancer cette requête si le schéma a changé — elle est auto-adaptative.
WITH fks AS (
  SELECT c.conrelid::regclass::text AS t, a.attname::text AS col,
         CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                            WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
                            WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.contype='f'
     AND c.confrelid IN ('auth.users'::regclass,'public.users'::regclass)
)
SELECT t AS table_dependante, col AS colonne, on_delete,
       (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %s where %I in (select id from auth.users where email = any(array[''medecin.test@tabibi.doctor'',''medecin.test.desktop@tabibi.doctor'',''patient.test.desktop@tabibi.doctor'',''patient.confirme@tabibi.doctor'',''admin.test@tabibi.doctor'']))', t, col),
          false, true, '')))[1]::text::int AS lignes
  FROM fks
 ORDER BY 4 DESC, 1;


-- ############################################################################
-- ÉTAPE 2 — PURGE. Un seul Run. Pas de BEGIN, pas de COMMIT.
-- ############################################################################
-- N'exécuter qu'après avoir relu l'étape 1. L'ordre compte : les deux RESTRICT
-- doivent être levés avant la suppression des comptes.

-- 2.a — Libérer les fiches du fonds réel (legacy_id > 1000) AVANT tout.
--       Les rendre au fonds, jamais les supprimer : la donnée est irremplaçable.
UPDATE public.doctor_profiles
   SET user_id = NULL, is_claimed = false
 WHERE COALESCE(legacy_id,0) > 1000
   AND user_id IN (SELECT id FROM auth.users WHERE email IN (
         'medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
         'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
         'admin.test@tabibi.doctor'));

-- 2.b — Supprimer les fiches SYNTHÉTIQUES (legacy_id petit ou nul).
DELETE FROM public.doctor_profiles
 WHERE COALESCE(legacy_id,0) <= 1000
   AND user_id IN (SELECT id FROM auth.users WHERE email IN (
         'medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
         'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
         'admin.test@tabibi.doctor'));

-- 2.c — Lever le RESTRICT sur appointments.patient_id.
DELETE FROM public.appointments
 WHERE patient_id IN (SELECT id FROM auth.users WHERE email IN (
         'medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
         'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
         'admin.test@tabibi.doctor'));

-- 2.d — Lever le RESTRICT sur cabinets.owner_user_id.
--       ⚠️ Vérifier à l'étape 1 qu'aucun cabinet RÉEL n'appartient à ces comptes.
DELETE FROM public.cabinets
 WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email IN (
         'medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
         'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
         'admin.test@tabibi.doctor'));

-- 2.e — Supprimer les comptes. Tout le reste part en CASCADE :
--       public.users, auth.identities, auth.sessions, notifications,
--       messages, conversations, cabinet_members, device_tokens.
DELETE FROM auth.users
 WHERE email IN ('medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
                 'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
                 'admin.test@tabibi.doctor');


-- ############################################################################
-- ÉTAPE 3 — VÉRIFICATION. Run SÉPARÉ, obligatoire.
-- ############################################################################
-- Ne jamais conclure depuis le « Success » de l'étape 2 : c'est exactement ce
-- message qui a masqué le ROLLBACK implicite le 2026-08-05.

SELECT 'comptes test restants' AS controle, count(*)::text AS valeur
  FROM auth.users
 WHERE email IN ('medecin.test@tabibi.doctor','medecin.test.desktop@tabibi.doctor',
                 'patient.test.desktop@tabibi.doctor','patient.confirme@tabibi.doctor',
                 'admin.test@tabibi.doctor')
UNION ALL
SELECT 'fiches incoherentes (user_id sans claim)', count(*)::text
  FROM public.doctor_profiles WHERE NOT is_claimed AND user_id IS NOT NULL
UNION ALL
SELECT 'fiches orphelines (claim sans user_id)', count(*)::text
  FROM public.doctor_profiles WHERE is_claimed AND user_id IS NULL
UNION ALL
SELECT 'total auth.users', count(*)::text FROM auth.users;

-- Attendu : 0, 0, 0, et un total diminué du nombre exact de comptes purgés.
-- Résultat constaté le 2026-08-05 : 0 / 0 / 0 / 41 (contre 46 avant purge).
