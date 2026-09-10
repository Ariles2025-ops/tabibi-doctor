-- =====================================================================
-- R2 — doctor_unavailable_slots : fin de la lecture anonyme
-- =====================================================================
-- CONSTAT (10/09/2026, SELECT + HTTP) : la policy dus_select_public
-- (USING true, rôles anon + authenticated) rend les absences de tout
-- médecin, avec le motif (`reason`), lisibles par n'importe quel visiteur :
-- GET /rest/v1/doctor_unavailable_slots avec la clé anon → 206, 3 lignes.
-- Le front n'a besoin d'aucune lecture anonyme : le patient obtient ses
-- créneaux par get_available_slots (SECURITY DEFINER, qui lit la table
-- elle-même) ; seuls le tableau de bord et l'agenda du médecin lisent la
-- table, connectés, sur leurs propres lignes (js/tabibi-doctor-dashboard.js:233,
-- js/tabibi-agenda.js:241).
--
-- CE QUE FAIT CE SCRIPT :
--   * remplace dus_select_public par deux policies de lecture :
--       - le médecin propriétaire (doctor_profiles.user_id = auth.uid()) ;
--       - l'admin (is_admin()) ;
--   * retire tous les droits de table à anon (le GRANT hérité valait ALL) ;
--   * ne touche ni à get_available_slots, ni aux policies INSERT / UPDATE /
--     DELETE existantes (déjà limitées au propriétaire).
--
-- À EXÉCUTER PAR AGHILES dans le SQL Editor. Rien n'est exécuté par l'agent.
-- =====================================================================

begin;

drop policy if exists dus_select_public on public.doctor_unavailable_slots;

create policy dus_select_owner on public.doctor_unavailable_slots
  for select to authenticated
  using (exists (select 1 from public.doctor_profiles dp
                  where dp.id = doctor_unavailable_slots.doctor_id
                    and dp.user_id = auth.uid()));

create policy dus_select_admin on public.doctor_unavailable_slots
  for select to authenticated
  using (public.is_admin());

revoke all on public.doctor_unavailable_slots from anon;

commit;

-- =====================================================================
-- PREUVE — trois cas + la RPC. Bloc à exécuter tel quel APRÈS le commit
-- ci-dessus : il crée des données d'essai, mesure, puis ANNULE TOUT par
-- ROLLBACK. Aucune trace ne subsiste. Pourquoi des données d'essai : les
-- 3 indisponibilités actuelles appartiennent à une fiche sans user_id et
-- sans working_hours (aucun des 28 comptes médecin n'est lié à une fiche
-- aujourd'hui), donc ni le cas « propriétaire » ni la RPC ne sont
-- observables sur les données réelles.
-- =====================================================================
-- begin;
--
-- -- Données d'essai : un médecin (compte existant, rôle medecin) relié à la
-- -- fiche qui porte les 3 absences, avec des horaires ; un patient existant.
-- create temp table essai as
--   select (select id from public.users where role = 'medecin' order by created_at limit 1) as medecin_uid,
--          (select id from public.users where role = 'patient' and is_test order by created_at limit 1) as patient_uid,
--          '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid as fiche_id;
-- update public.doctor_profiles
--    set user_id = (select medecin_uid from essai),
--        working_hours = '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],
--                          "wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],
--                          "fri":[{"open":"09:00","close":"12:00"}],"sat":[{"open":"09:00","close":"12:00"}]}'::jsonb
--  where id = (select fiche_id from essai);
-- -- Une absence d'un AUTRE médecin, pour prouver « seulement les siennes ».
-- insert into public.doctor_unavailable_slots (doctor_id, starts_at, ends_at, all_day, reason)
-- select id, now() + interval '10 days', now() + interval '11 days', true, 'essai autre medecin'
--   from public.doctor_profiles where id <> (select fiche_id from essai) limit 1;
--
-- -- Cas 1 — anon : plus aucun droit de table (HTTP renverra 401 / 42501).
-- select has_table_privilege('anon', 'public.doctor_unavailable_slots', 'select') as anon_peut_lire;   -- attendu : false
--
-- -- Cas 2 — patient authentifié, ni propriétaire ni admin.
-- set local role authenticated;
-- select set_config('request.jwt.claims', json_build_object('sub', (select patient_uid from essai), 'role', 'authenticated')::text, true);
-- select count(*) as lignes_patient from public.doctor_unavailable_slots;                              -- attendu : 0
-- reset role;
--
-- -- Cas 3 — médecin propriétaire : ses lignes, et seulement les siennes.
-- set local role authenticated;
-- select set_config('request.jwt.claims', json_build_object('sub', (select medecin_uid from essai), 'role', 'authenticated')::text, true);
-- select count(*) as lignes_medecin,
--        bool_and(doctor_id = (select fiche_id from essai)) as toutes_a_lui
--   from public.doctor_unavailable_slots;                                                              -- attendu : 3, true
-- reset role;
--
-- -- RPC inchangée : mêmes résultats en anon qu'avant (get_available_slots est
-- -- SECURITY DEFINER, elle lit la table malgré le REVOKE).
-- set local role anon;
-- select 'jour ouvré sans absence' as cas, count(*) as creneaux
--   from public.get_available_slots((select fiche_id from essai), (current_date + 14)::date, 30)
-- union all
-- select 'jour couvert par l''absence de l''autre médecin (doit être identique : pas sa fiche)', count(*)
--   from public.get_available_slots((select fiche_id from essai), (current_date + 10)::date, 30);
-- reset role;
--
-- rollback;   -- tout est annulé : données d'essai, liaison, horaires.

-- =====================================================================
-- Vérification HTTP (après le commit, clé anon) :
--   GET /rest/v1/doctor_unavailable_slots?select=id&limit=1   → 401 {"code":"42501"}
--   GET /rest/v1/public_doctors?select=id&limit=1              → 206 (inchangé)
-- =====================================================================

-- =====================================================================
-- Retour arrière
-- =====================================================================
-- begin;
-- drop policy if exists dus_select_owner on public.doctor_unavailable_slots;
-- drop policy if exists dus_select_admin on public.doctor_unavailable_slots;
-- create policy dus_select_public on public.doctor_unavailable_slots
--   for select to anon, authenticated using (true);
-- grant select on public.doctor_unavailable_slots to anon;
-- commit;
