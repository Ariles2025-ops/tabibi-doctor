-- =====================================================================
-- TABIBI.DOCTOR — PHASE 5.1bis : INSPECTION v2 (policies full + enum status)
-- =====================================================================
-- Fichier : migrations/PHASE5_1bis_INSPECT_v2_policies_and_enum.sql
-- Date    : 2026-05-22
-- Mode    : 100% READ-ONLY
-- Cible   : Supabase Pro EU
--
-- Suite de PHASE5_1bis_INSPECT_old_appointments.sql qui avait tronqué
-- certaines policies. Ici on récupère le FULL body via 2 méthodes :
-- A) une ligne par policy (évite la troncature multi-lignes)
-- B) valeurs de l'enum status (pour adapter le WHERE de la RPC)
-- =====================================================================



-- =====================================================================
-- REQUÊTE A — Policies appointments, FULL (1 par 1 pour éviter troncature)
-- =====================================================================
-- Si ton UI Supabase tronque encore le qual/with_check, exécute UNE SEULE
-- POLICY à la fois en filtrant par policyname (en bas de ce fichier).

SELECT policyname,
       cmd,
       roles::text     AS roles,
       qual::text      AS using_full,
       with_check::text AS with_check_full
  FROM pg_policies
 WHERE schemaname='public' AND tablename='appointments'
 ORDER BY policyname;
-- ATTENDU : 8 lignes. Colle-moi TOUT.
-- Si tronqué côté Supabase UI : exécute les 8 SELECT individuels ci-dessous
-- (un par policy, query par query, et colle ligne par ligne dans le chat).



-- =====================================================================
-- REQUÊTE B — Valeurs de l'enum status (méthode déterministe via colonne)
-- =====================================================================
-- Trouve l'enum derrière la colonne `appointments.status`, peu importe son nom.

SELECT
  t.typname        AS enum_type_name,
  e.enumlabel      AS valid_value,
  e.enumsortorder  AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.oid = (
  SELECT atttypid FROM pg_attribute
   WHERE attrelid = 'public.appointments'::regclass
     AND attname = 'status'
)
ORDER BY e.enumsortorder;
-- ATTENDU : N lignes (ex: pending, confirmed, cancelled, …)
-- Colle TOUTE la sortie + l'enum_type_name (utile pour DROP TYPE si jamais).



-- =====================================================================
-- REQUÊTES DE SECOURS — Si REQUÊTE A est encore tronquée, exécute ces 8 :
-- =====================================================================
/*
-- Adapte le WHERE selon les policyname réels vus dans l'output A :

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'Doctors see appointments with them';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'Doctors update appointments with them';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'Patients create own appointments';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'Patients see own appointments';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'Patients update own appointments';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'appt_insert_patient';

SELECT policyname, cmd, qual::text AS using_full, with_check::text AS with_check_full
FROM pg_policies WHERE schemaname='public' AND tablename='appointments'
  AND policyname = 'appt_select_own';

-- Pour la 8ème (nom inconnu, tronqué dans ton 1er screen) :
SELECT policyname FROM pg_policies
 WHERE schemaname='public' AND tablename='appointments'
 ORDER BY policyname;
-- → identifie la 8ème policy, puis relance le SELECT ci-dessus avec son nom.
*/
