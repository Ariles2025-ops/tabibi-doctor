-- =====================================================================
-- PURGE des données de test TEST-CONGRES-20260910 — 12/09/2026
-- À EXÉCUTER PAR AGHILES. Transaction unique. Chaque DELETE est ciblé sur
-- le marqueur et renvoie ce qui part (RETURNING). Ordre enfants → parents.
-- Comptage à blanc préalable (marqués / autres) : voir le fil de conversation.
-- Attendu supprimé : notifications 3, appointments 2, doctor_unavailable_slots 0,
--   doctor_profiles 1, waiting_list 1, public.users 3, auth.users 3.
-- =====================================================================
begin;

-- 1. Notifications liées aux comptes de test ou aux RDV de test (avant de supprimer les RDV)
delete from public.notifications
 where user_id in (select id from public.users where first_name = 'TEST-CONGRES' and last_name = '20260910')
    or (data->>'appointment_id') in (select id::text from public.appointments where reason like 'TEST-CONGRES-20260910%')
returning id, user_id, type, (data->>'appointment_id') as appointment_id;   -- attendu : 3

-- 2. Rendez-vous de test (dont le RDV fantôme du dimanche, short_id b2ff0de1)
delete from public.appointments
 where reason like 'TEST-CONGRES-20260910%'
    or patient_id in (select id from public.users where first_name = 'TEST-CONGRES' and last_name = '20260910')
    or doctor_id  in (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910' or legacy_id = 9000001)
returning short_id, patient_id, doctor_id, starts_at, status, reason;         -- attendu : 2 (b2ff0de1 pending, 60dcdd2c cancelled)

-- 3. Absences liées à la fiche de test (aucune attendue, filet de sécurité)
delete from public.doctor_unavailable_slots
 where doctor_id in (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910' or legacy_id = 9000001)
returning id, doctor_id, starts_at, ends_at;                                  -- attendu : 0

-- 4. Fiche médecin de test
delete from public.doctor_profiles
 where source = 'TEST-CONGRES-20260910' or legacy_id = 9000001
returning id, legacy_id, full_name, user_id, source;                          -- attendu : 1 (legacy 9000001)

-- 5. Ligne de liste d'attente créée par le test HTTP anon
delete from public.waiting_list
 where source = 'TEST-CONGRES-20260910'
returning id, email, source;                                                  -- attendu : 1

-- 6. Lignes public.users des comptes de test (avant auth.users : FK users.id -> auth.users.id)
delete from public.users
 where first_name = 'TEST-CONGRES' and last_name = '20260910'
returning id, email, phone, role;                                             -- attendu : 3 (A, B, C)

-- 7. Comptes auth des comptes de test (racine)
delete from auth.users
 where email like 'test-congres-20260910%'
    or phone in ('213555000101','213555000102','213555000103')
returning id, email, phone;                                                   -- attendu : 3

commit;
