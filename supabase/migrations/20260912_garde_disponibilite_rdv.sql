-- =====================================================================
-- Garde de disponibilité des rendez-vous — AU NIVEAU DE LA BASE
-- =====================================================================
-- Un rendez-vous ne peut plus être créé (ni déplacé) sur un créneau qui
-- n'est pas réellement disponible chez le médecin : jour fermé dans
-- working_hours, hors des plages horaires, couvert par une absence
-- (all_day ou partielle), ou déjà pris. La règle métier de disponibilité
-- vit à UN SEUL endroit — la fonction `get_available_slots` — et cette
-- garde la RÉUTILISE. Elle ne la réécrit pas.
--
-- Contexte : le 12/09/2026, le chemin « Prendre RDV » de l'accueil
-- (js/home-app.js, grille codée en dur) a créé un RDV le dimanche 13/09,
-- jour où la fiche est fermée — get_available_slots renvoyait 0 pour ce
-- jour. Le trigger existant `validate_appointment_time` ne vérifie que
-- « au moins 30 minutes dans le futur ». Cette garde ferme le trou côté
-- base, quel que soit le front (web, mobile, secrétariat, API).
--
-- [v2 12/09] La garde ne s'applique qu'à l'auto-réservation patient (auth.uid() = patient_id).
-- Médecin/secrétaire/admin qui cale un RDV sur un tiers n'est pas bloqué (urgence à 13h15 possible).
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- À EXÉCUTER PAR AGHILES. Rien n'est appliqué par l'agent.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Le créneau (doctor, starts_at, ends_at) est-il réellement offert ?
--    Réutilise get_available_slots : un créneau est valide s'il figure
--    EXACTEMENT dans la liste des créneaux disponibles du jour.
-- ---------------------------------------------------------------------
create or replace function public.appointment_slot_is_available(
  p_doctor_id  uuid,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz
) returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.get_available_slots(
             p_doctor_id,
             (p_starts_at at time zone 'Africa/Algiers')::date,
             greatest(5, least(240, (extract(epoch from (p_ends_at - p_starts_at)) / 60)::int))
           ) s
     where s.slot_start = p_starts_at
       and s.slot_end   = p_ends_at
  );
$$;

comment on function public.appointment_slot_is_available(uuid, timestamptz, timestamptz)
  is 'Vrai si (starts_at, ends_at) correspond exactement à un créneau rendu par get_available_slots pour ce médecin ce jour-là. Source unique de la règle de disponibilité. La durée est déduite de ends_at - starts_at (bornée 5..240 min).';

-- ---------------------------------------------------------------------
-- 2. Trigger : refuse à l'écriture tout créneau hors disponibilité
--    - ne valide qu'à la création, ou lors d'un DÉPLACEMENT effectif ;
--    - n'entrave ni une annulation, ni un passage completed/no_show ;
--    - s'exécute APRÈS `appointments_sync_slot_times` (nom trié après),
--      donc NEW.starts_at / NEW.ends_at sont déjà dérivés de scheduled_at.
-- ---------------------------------------------------------------------
create or replace function public.enforce_appointment_availability()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  -- UPDATE sans changement d'horaire (ex. changement de statut) : on laisse passer.
  if tg_op = 'UPDATE'
     and new.starts_at is not distinct from old.starts_at
     and new.ends_at   is not distinct from old.ends_at then
    return new;
  end if;

  -- Ne pas bloquer une annulation / clôture (le créneau se libère, il n'a pas à être « disponible »).
  if new.status in ('cancelled'::appointment_status,
                    'completed'::appointment_status,
                    'no_show'::appointment_status) then
    return new;
  end if;

  if new.starts_at is null or new.ends_at is null or new.doctor_id is null then
    raise exception 'appointment_time_missing: horaire ou médecin manquant'
      using errcode = '23514';
  end if;

  -- [v2] La garde ne s'applique qu'à l'AUTO-RÉSERVATION par le patient (le chemin non
  -- fiable, celui du bug du dimanche). Quand quelqu'un d'autre pose le RDV — médecin ou
  -- secrétaire qui cale une urgence dans son propre agenda, admin, tâche backend en
  -- service_role — auth.uid() n'est pas le patient : on laisse passer, il prend la
  -- responsabilité du créneau. La policy d'INSERT « Patients create own appointments »
  -- impose déjà auth.uid() = patient_id au patient, donc il ne peut pas contourner en
  -- se faisant passer pour un tiers.
  if auth.uid() is distinct from new.patient_id then
    return new;
  end if;

  if not public.appointment_slot_is_available(new.doctor_id, new.starts_at, new.ends_at) then
    raise exception 'slot_unavailable: créneau hors disponibilité du médecin (jour fermé, hors plage, absence, ou déjà pris)'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Nom volontairement trié APRÈS trg_appointments_sync_slot_times (…_sync… < …_zz…)
-- pour que la garde voie starts_at / ends_at déjà synchronisés.
drop trigger if exists trg_appointments_zz_enforce_availability on public.appointments;
create trigger trg_appointments_zz_enforce_availability
  before insert or update on public.appointments
  for each row
  execute function public.enforce_appointment_availability();

commit;

-- =====================================================================
-- 3. Retour arrière (NE PAS EXÉCUTER sauf rollback voulu)
-- =====================================================================
-- begin;
--   drop trigger if exists trg_appointments_zz_enforce_availability on public.appointments;
--   drop function if exists public.enforce_appointment_availability();
--   drop function if exists public.appointment_slot_is_available(uuid, timestamptz, timestamptz);
-- commit;
