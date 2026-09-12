-- TEST-CONGRES-20260910 — NETTOYAGE, écrit avant le test. À EXÉCUTER PAR AGHILES, une étape à la fois, en lisant chaque RETURNING.
-- Le SQL Editor ouvre une connexion par clic : pas de transaction entre deux étapes. Ordre imposé par les clés étrangères.
-- Chaque WHERE cible la marque ; aucune clause ne peut déborder sur les 75 034 fiches réelles.

-- Étape 1 — LECTURE : ce qui va partir (même requête que verification.sql). Lire avant de continuer.
--   \i verification.sql

-- Étape 2 — outbox des rappels liée aux RDV de test
delete from public.appointment_notifications
 where appointment_id in (select id from public.appointments where reason like 'TEST-CONGRES-20260910%'
                            or doctor_id in (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910'))
returning id, kind, status;

-- Étape 3 — notifications des comptes de test et des RDV de test
delete from public.notifications
 where user_id in (select id from public.users where first_name = 'TEST-CONGRES' and last_name = '20260910')
    or (data->>'appointment_id')::uuid in (select id from public.appointments where reason like 'TEST-CONGRES-20260910%')
returning id, type;

-- Étape 4 — rendez-vous de test
delete from public.appointments
 where reason like 'TEST-CONGRES-20260910%'
    or doctor_id in (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910')
returning id, status, scheduled_at;

-- Étape 5 — absences éventuelles posées pendant le test
delete from public.doctor_unavailable_slots
 where doctor_id in (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910')
returning id;

-- Étape 6 — documents déposés par le médecin de test dans doctor-docs :
--   les supprimer depuis le tableau de bord Storage (ou l'API), PAS par DELETE sur storage.objects
--   (une suppression SQL directe laisse le fichier orphelin dans le stockage). Vérifier ensuite :
select bucket_id, name from storage.objects
 where owner in (select id from public.users where first_name = 'TEST-CONGRES' and last_name = '20260910');   -- attendu : 0 ligne

-- Étape 7 — la fiche de test (après les RDV : FK appointments.doctor_id ON DELETE RESTRICT)
delete from public.doctor_profiles
 where source = 'TEST-CONGRES-20260910' and legacy_id = 9000001
returning id, legacy_id, full_name, user_id;

-- Étape 8 — les deux comptes de test (auth.users → public.users, device_tokens, consents_log en CASCADE)
delete from auth.users
 where id in (select id from public.users where first_name = 'TEST-CONGRES' and last_name = '20260910' and is_test)
    or email like 'test-congres-20260910%'
returning id, email, phone;

-- Étape 9 — (à ton choix) les SMS du numéro de test
-- delete from public.sms_log where phone_e164 = '+213XXXXXXXXX' returning id, status;

-- Étape 10 — CONTRÔLE : verification.sql → 0 partout (hors audit_log conservé).

-- [12/09] Ajouts : comptes A/B/C créés par l'API admin (téléphones de test 213555000101/102/103) et ligne de liste d'attente
delete from public.waiting_list where source = 'TEST-CONGRES-20260910' returning id, email;                 -- attendu : 1 ligne (test HTTP anon du 12/09)
delete from auth.users where phone in ('213555000101','213555000102','213555000103')
   and email like 'test-congres-20260910%' returning id, email, phone;                                        -- attendu : 2 ou 3 lignes
