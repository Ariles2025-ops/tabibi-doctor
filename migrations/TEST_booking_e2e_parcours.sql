-- =====================================================================
-- TABIBI.DOCTOR — E2E RÉSERVATION : rendre « Dr Parcours Test » bookable
-- =====================================================================
-- Fichier : migrations/TEST_booking_e2e_parcours.sql
-- Date    : 2026-07-09
-- Cible   : Supabase SQL Editor (prod) — exécuté PAR AGHILES uniquement.
--
-- CONTEXTE (constaté par appels REST anon le 09/07) :
--   • L'approbation faite via admin-doctor-validation.html n'a PAS persisté :
--     is_doctor_bookable('1b0957b9-…') = false, la fiche est toujours
--     'pending' dans doctor_profiles (la Section 1 le re-confirme).
--   • Pour être réservable il faut LES TROIS champs :
--       validation_status='approved'  (gate RLS INSERT appointments, PHASE16_8)
--       is_claimed=true               (guard anti-énumération de get_available_slots)
--       working_hours non NULL        (source des créneaux, format Phase 4.B.1)
--     « Dr Parcours Test » n'en a aucun ; c'est la fiche idéale pour l'E2E
--     (nom explicitement test, aucun risque de confusion avec un vrai cabinet).
--
-- ⚠️ Pendant la fenêtre de test, cette fiche devient PUBLIQUEMENT réservable
--    en prod. La Section 3 (revert) la remet à l'état neutre juste après.
-- =====================================================================


-- =====================================================================
-- SECTION 1 : DIAGNOSTIC (read-only — comprendre pourquoi ça n'a pas pris)
-- =====================================================================

-- 1.1 État RÉEL des deux fiches dans la table (pas la vue)
SELECT id, full_name, is_claimed, validation_status,
       (working_hours IS NOT NULL) AS has_hours
  FROM public.doctor_profiles
 WHERE id IN ('1b0957b9-d951-4c63-88c5-116980217090',   -- Dr Parcours Test
              '042f2917-4356-4859-91b9-64ffdde1e292');  -- fiche claimée medecin.test

-- 1.2 Dernières actions admin (l'appel admin_validate_doctor a-t-il laissé une trace ?)
SELECT * FROM public.admin_actions ORDER BY created_at DESC LIMIT 5;

-- 1.3 Source PROD de get_available_slots (le fichier de migration renverrait
--     des créneaux pour la fiche claimée+horaires ; la prod renvoie [] →
--     la version déployée a probablement un gate 'approved' en plus)
SELECT pg_get_functiondef(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'get_available_slots';


-- =====================================================================
-- SECTION 2 : DÉBLOCAGE E2E — Dr Parcours Test bookable (idempotent)
-- =====================================================================

UPDATE public.doctor_profiles
   SET is_claimed        = true,
       validation_status = 'approved',
       working_hours     = '{
         "sun":[{"open":"09:00","close":"13:00"},{"open":"14:00","close":"18:00"}],
         "mon":[{"open":"09:00","close":"13:00"},{"open":"14:00","close":"18:00"}],
         "tue":[{"open":"09:00","close":"13:00"},{"open":"14:00","close":"18:00"}],
         "wed":[{"open":"09:00","close":"13:00"},{"open":"14:00","close":"18:00"}],
         "thu":[{"open":"09:00","close":"13:00"}],
         "fri":[],
         "sat":[]
       }'::jsonb
 WHERE id = '1b0957b9-d951-4c63-88c5-116980217090';

-- Contrôles immédiats — ATTENDU : true, puis un nombre > 0
SELECT public.is_doctor_bookable('1b0957b9-d951-4c63-88c5-116980217090') AS bookable;
SELECT count(*) AS creneaux_lundi_13
  FROM public.get_available_slots('1b0957b9-d951-4c63-88c5-116980217090',
                                  DATE '2026-07-13', 30);
-- Si bookable=true mais creneaux=0 → colle-moi la sortie du 1.3 (gate prod).


-- =====================================================================
-- SECTION 3 : REVERT (à exécuter APRÈS validation de l'E2E — décommenter)
-- =====================================================================

-- UPDATE public.doctor_profiles
--    SET is_claimed        = false,
--        validation_status = 'pending',
--        working_hours     = NULL
--  WHERE id = '1b0957b9-d951-4c63-88c5-116980217090';
--
-- -- Nettoyage des RDV de test restants (l'E2E annule le sien, ceci est une ceinture)
-- -- DELETE FROM public.appointments
-- --  WHERE doctor_id = '1b0957b9-d951-4c63-88c5-116980217090'
-- --    AND patient_id = (SELECT id FROM auth.users WHERE email = 'patient.e2e@tabibi.doctor');
