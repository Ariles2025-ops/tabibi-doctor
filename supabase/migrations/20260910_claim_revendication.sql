-- =====================================================================
-- Revendication d'une fiche par un médecin — correctif
-- =====================================================================
-- CONSTAT (docs/FICHE_REVENDICATION_MEDECIN.md, PR #63, simulation du 10/09) :
-- claim_my_doctor_profile() répond ok:true mais le trigger
-- lock_doctor_protected_columns remet is_claimed à false pour tout appelant
-- non admin (auth.uid() reste celui du médecin, même en SECURITY DEFINER).
-- Conséquences : jamais dans la file de validation admin, n° d'Ordre jamais
-- enregistré, non réservable, fiche toujours revendicable par un autre médecin
-- (remplacement silencieux de user_id = prise de contrôle), second claim en 23505.
--
-- CE QUE FAIT CE SCRIPT :
--   1. lock_doctor_protected_columns() : n'accepte la transition
--      user_id NULL → auth.uid() avec is_claimed = true QUE si le drapeau
--      transactionnel tabibi.revendication vaut '1' (posé par la fonction de
--      revendication dans la même transaction). Tout autre appelant non admin
--      voit figées : is_verified, is_claimed, user_id, claimed_at,
--      validation_status et les colonnes validation_*. Le trigger est donc
--      renforcé (validation_status et user_id n'étaient pas protégés), pas
--      affaibli.
--   2. claim_my_doctor_profile(integer) : un compte = une fiche (test sur
--      user_id, pas sur is_claimed) ; une fiche déjà liée n'est plus
--      revendicable par personne (refus tracé dans audit_log) ; verrou
--      SELECT … FOR UPDATE contre deux revendications simultanées ;
--      unique_violation attrapée → message lisible ; trace audit_log
--      « doctor_profile_claimed » (qui, quand, quelle fiche).
--   Ni get_available_slots, ni les policies de R2, ni admin_validate_doctor
--   ne sont touchées.
--
-- À EXÉCUTER PAR AGHILES dans le SQL Editor. Rien n'est exécuté par l'agent.
-- =====================================================================

begin;

create or replace function public.lock_doctor_protected_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_admin boolean;
  v_flag  text;
begin
  v_admin := exists (select 1 from public.users where id = auth.uid() and role = 'admin');
  if v_admin then
    return new;
  end if;
  v_flag := current_setting('tabibi.revendication', true);
  -- Chemin « revendication » : posé par claim_my_doctor_profile() dans la même
  -- transaction, et seulement pour la transition user_id NULL → auth.uid() avec
  -- is_claimed = true sur cette ligne. Tout le reste reste figé.
  if v_flag = '1' and old.user_id is null and new.user_id = auth.uid() and new.is_claimed = true then
    new.is_verified            := old.is_verified;
    new.validation_status      := old.validation_status;
    new.validation_approved_at := old.validation_approved_at;
    new.validation_approved_by_id := old.validation_approved_by_id;
    return new;
  end if;
  -- Tout autre appelant non admin : les colonnes de confiance ne bougent pas.
  new.is_verified            := old.is_verified;
  new.is_claimed             := old.is_claimed;
  new.user_id                := old.user_id;
  new.claimed_at             := old.claimed_at;
  new.validation_status      := old.validation_status;
  new.validation_approved_at := old.validation_approved_at;
  new.validation_approved_by_id := old.validation_approved_by_id;
  new.validation_rejected_at := old.validation_rejected_at;
  new.validation_rejected_by_id := old.validation_rejected_by_id;
  return new;
end $$;

create or replace function public.claim_my_doctor_profile(legacy_id_input integer)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_role     text;
  v_email    text;
  v_existing uuid;
  v_profile  public.doctor_profiles%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select role::text, email into v_role, v_email from public.users where id = v_uid;
  if v_role is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;
  if v_role not in ('medecin', 'doctor') then
    return json_build_object('ok', false, 'error', 'not_a_doctor_account');
  end if;
  -- Un compte, une fiche : on regarde user_id, pas is_claimed.
  select id into v_existing from public.doctor_profiles where user_id = v_uid limit 1;
  if v_existing is not null then
    return json_build_object('ok', false, 'error', 'already_claimed_another_profile', 'profile_id', v_existing);
  end if;
  -- Verrou de ligne : deux revendications simultanées de la même fiche se sérialisent.
  select * into v_profile from public.doctor_profiles where legacy_id = legacy_id_input for update;
  if not found then
    return json_build_object('ok', false, 'error', 'profile_not_found');
  end if;
  -- Une fiche déjà liée à un compte n'est plus revendicable par personne : refus tracé.
  if v_profile.user_id is not null or coalesce(v_profile.is_claimed, false) then
    insert into public.audit_log (user_id, user_email, user_role, action, table_name, record_id, after_data, success, error_msg)
    values (v_uid, v_email, v_role, 'doctor_profile_claim_refused', 'doctor_profiles', v_profile.id,
            jsonb_build_object('legacy_id', legacy_id_input), false, 'profile_already_claimed');
    return json_build_object('ok', false, 'error', 'profile_already_claimed');
  end if;
  perform set_config('tabibi.revendication', '1', true);
  begin
    update public.doctor_profiles
       set user_id = v_uid, is_claimed = true, claimed_at = now(), updated_at = now()
     where id = v_profile.id;
  exception when unique_violation then
    perform set_config('tabibi.revendication', '0', true);
    return json_build_object('ok', false, 'error', 'already_claimed_another_profile');
  end;
  perform set_config('tabibi.revendication', '0', true);
  insert into public.audit_log (user_id, user_email, user_role, action, table_name, record_id, before_data, after_data, success)
  values (v_uid, v_email, v_role, 'doctor_profile_claimed', 'doctor_profiles', v_profile.id,
          jsonb_build_object('user_id', null, 'is_claimed', coalesce(v_profile.is_claimed, false)),
          jsonb_build_object('user_id', v_uid, 'is_claimed', true, 'legacy_id', legacy_id_input), true);
  return json_build_object('ok', true, 'profile_id', v_profile.id, 'legacy_id', legacy_id_input, 'claimed_at', now());
end $$;

commit;

-- =====================================================================
-- PREUVE — « simulation du congrès », exécutée le 10/09/2026 dans UNE
-- transaction ANNULÉE (correctif + parcours), base vérifiée intacte ensuite
-- (0 fiche liée, 0 RDV, audit_log 148, notifications 12, outbox 0, trigger
-- d'origine en place). Script complet : scratchpad congres.sql, résumé :
--
--  1. Médecin A revendique la fiche 1
--     claim → ok ; VÉRITÉ : user_id = A, is_claimed = TRUE, claimed_at posé ;
--     audit_log « doctor_profile_claimed » (user A, fiche 1) ;
--     admin_validation_list('pending') contient la fiche ; doctor_set_ordre_number
--     → 'ok' et ordre_number écrit ; la fiche n'est plus listée is_claimed=false ;
--     is_doctor_bookable = false tant que l'admin n'a pas validé.
--  T. Le trigger n'est pas affaibli
--     UPDATE direct par A ou B (rôle authenticated) : « permission denied »
--     (authenticated n'a pas le privilège UPDATE sur doctor_profiles) ;
--     UPDATE sans drapeau avec les claims de A (contexte DEFINER) :
--     is_claimed reste false, user_id reste NULL, validation_status reste
--     pending (T.3 ci-dessous).
--  2. Médecin B tente la MÊME fiche 1
--     claim → {"ok": false, "error": "profile_already_claimed"} ;
--     UPDATE direct user_id = B → permission denied ; VÉRITÉ : user_id = A ;
--     audit_log « doctor_profile_claim_refused » (user B) = 1.
--  3. A tente une seconde fiche
--     → {"ok": false, "error": "already_claimed_another_profile", "profile_id": …} ;
--     une seule fiche liée à A.
--  4. L'admin valide A
--     admin_validate_doctor → ok ; approved / is_verified true / is_claimed true ;
--     is_doctor_bookable = true ; présent dans public_doctors_listed (anon) ;
--     adresse visible ; 6 créneaux J+14 (09-12, 30 min).
--  5. Le patient P prend un RDV chez A (charge utile exacte du front)
--     INSERT ok ; my_upcoming_appointments = 1 ; starts_at/ends_at synchronisés ;
--     cabinet_id NULL ; notification rdv_new pour A ; audit_log ;
--     A voit le RDV (1), doctor_patients_directory (1), cabinet_calendar_view 0
--     (pas de cabinet) ; A confirme (UPDATE status=confirmed → 1 ligne) ;
--     outbox confirmation = 1 ; notification rdv_confirmed pour P = 1 ;
--     créneaux J+14 : 6 → 5.
--     RDV chez un médecin non validé → 42501 (RLS is_doctor_bookable) ;
--     second RDV sur le même créneau → 23P01 (contrainte d'exclusion).
--
-- À rejouer après exécution : le même script sans les CREATE OR REPLACE.
-- =====================================================================

-- =====================================================================
-- Vérification rapide (après le COMMIT)
-- =====================================================================
-- select prosrc ilike '%tabibi.revendication%' from pg_proc where proname = 'lock_doctor_protected_columns';  -- true
-- select prosrc ilike '%for update%' from pg_proc where proname = 'claim_my_doctor_profile' and pronargs = 1;   -- true

-- =====================================================================
-- Retour arrière : corps d'origine des deux fonctions (relevés le 10/09/2026)
-- =====================================================================
-- create or replace function public.lock_doctor_protected_columns() returns trigger
-- language plpgsql security definer set search_path to 'public' as $$
-- begin
--   if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
--     new.is_verified := old.is_verified;
--     new.is_claimed  := old.is_claimed;
--   end if;
--   return new;
-- end $$;
-- -- claim_my_doctor_profile(integer) d'origine : voir docs/FICHE_REVENDICATION_MEDECIN.md §3
-- -- (mêmes contrôles, sans FOR UPDATE, test « déjà revendiqué » sur is_claimed,
-- --  UPDATE user_id/is_claimed/claimed_at/updated_at, pas de trace audit_log).

-- =====================================================================
-- HYGIÈNE — privilège TRUNCATE hérité des privilèges par défaut
-- =====================================================================
-- Constat (10/09) : anon et authenticated détiennent TRUNCATE sur les tables
-- du schéma public (héritage `anon=arwdDxtm`). TRUNCATE ignore la RLS ; il
-- est injoignable via PostgREST, mais aucun front n'en a besoin et aucune
-- fonction du schéma ne l'utilise. On le retire partout, et on corrige les
-- privilèges par défaut pour que les tables futures ne l'héritent plus.
-- À exécuter dans la même session que le correctif, ou séparément.
begin;
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
commit;
-- Vérification :
-- select grantee, count(*) from information_schema.role_table_grants
--  where table_schema='public' and privilege_type='TRUNCATE' and grantee in ('anon','authenticated') group by 1;  -- 0 ligne
-- Retour arrière (sans intérêt fonctionnel) :
-- grant truncate on all tables in schema public to anon, authenticated;
