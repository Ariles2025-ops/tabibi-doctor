-- =====================================================================
-- LOT C — SMS de confirmation : dépôt en outbox au passage → 'confirmed'
-- =====================================================================
-- Fichier : supabase/migrations/20260729130000_appointment_confirm_trigger.sql
-- Date    : 2026-07-29 · Phase 4 (rappels RDV)
-- Cible   : Supabase EU (Postgres 15+) — SQL Editor, rôle postgres
-- Pré-requis : 20260729120000_appointment_notifications.sql
--
-- PRINCIPE : le trigger n'ENVOIE RIEN. Il dépose une ligne dans l'outbox
--   (kind='confirmation', status='pending') que l'edge function
--   `appointment-reminders` draine au run suivant (≤15 min). Aucune I/O
--   réseau dans une transaction Postgres : un SMS lent ou en échec ne
--   peut ni ralentir ni faire échouer la confirmation d'un RDV.
--
-- DÉCLENCHEMENT : UNIQUEMENT sur transition vers 'confirmed'
--   (OLD.status IS DISTINCT FROM 'confirmed' AND NEW.status = 'confirmed').
--   Un RDV créé directement en 'confirmed' par INSERT n'est pas couvert
--   ici — c'est voulu : décision produit « un seul SMS, au passage
--   confirmé », et le parcours patient passe toujours par 'pending'.
--
-- TÉLÉPHONE : résolu ici en SECURITY DEFINER (le trigger s'exécute avec
--   les droits du propriétaire, il lit donc public.users malgré la RLS).
--   Si la résolution échoue, on insère to_phone = NULL : l'edge function
--   re-résout le numéro en service_role au moment de l'envoi. Le champ
--   n'est donc qu'un confort de lecture/debug, jamais un point de rupture.
--
-- IDEMPOTENT : ON CONFLICT (appointment_id, kind) DO NOTHING + CREATE OR
--   REPLACE + DROP TRIGGER IF EXISTS. Rejouable sans risque.
-- ROLLBACK : section commentée en fin de fichier.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Statut 'sending' (verrou de la passe confirmation)
-- ---------------------------------------------------------------------
-- La ligne 'confirmation' existe AVANT l'envoi (posée par ce trigger) :
-- le verrou anti-doublon ne peut donc pas être l'INSERT. L'edge function
-- revendique la ligne par un UPDATE conditionnel 'pending' → 'sending'
-- qui ne peut réussir qu'une fois. Il faut que ce statut soit accepté.
ALTER TABLE public.appointment_notifications
  DROP CONSTRAINT IF EXISTS appointment_notifications_status_check;
ALTER TABLE public.appointment_notifications
  ADD CONSTRAINT appointment_notifications_status_check
  CHECK (status IN ('pending','sending','sent','failed','skipped'));

COMMENT ON COLUMN public.appointment_notifications.status IS
  'pending = en attente d''envoi · sending = revendiquée par un run (verrou) · '
  'sent = acceptée par BudgetSMS · failed = refus fournisseur/réseau · '
  'skipped = réservé (non utilisé actuellement)';

-- ---------------------------------------------------------------------
-- SECTION 2 — Fonction trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_appointment_confirmed_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Résolution best-effort du téléphone patient (SECURITY DEFINER →
  -- lecture autorisée malgré la RLS). NULL toléré : l'edge function
  -- re-résout au moment de l'envoi.
  BEGIN
    SELECT u.phone INTO v_phone
      FROM public.users u
     WHERE u.id = NEW.patient_id;
  EXCEPTION WHEN OTHERS THEN
    v_phone := NULL;
  END;

  -- Dépôt en outbox. ON CONFLICT : si une ligne 'confirmation' existe
  -- déjà pour ce RDV (re-confirmation après annulation, rejeu), on ne
  -- crée pas de doublon et on n'envoie donc pas un second SMS.
  BEGIN
    INSERT INTO public.appointment_notifications
      (appointment_id, kind, channel, to_phone, status)
    VALUES
      (NEW.id, 'confirmation', 'sms', v_phone, 'pending')
    ON CONFLICT (appointment_id, kind) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Un incident sur l'outbox ne doit JAMAIS empêcher un médecin de
    -- confirmer un rendez-vous : on journalise et on laisse passer.
    RAISE WARNING '[tg_appointment_confirmed_outbox] RDV % : %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_appointment_confirmed_outbox() IS
  'Dépose une ligne outbox kind=confirmation quand un RDV passe à '
  '''confirmed''. N''envoie rien : l''edge function appointment-reminders '
  'draine l''outbox. Ne peut pas faire échouer l''UPDATE d''origine.';

-- ---------------------------------------------------------------------
-- SECTION 3 — Trigger (uniquement sur transition vers 'confirmed')
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_appointment_confirmed_outbox ON public.appointments;
CREATE TRIGGER trg_appointment_confirmed_outbox
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'confirmed' AND NEW.status = 'confirmed')
  EXECUTE FUNCTION public.tg_appointment_confirmed_outbox();

COMMIT;

-- ── VÉRIFICATION (lecture seule) ─────────────────────────────────────
-- Trigger en place :
--   SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal;
-- Contrainte de statut à jour :
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'appointment_notifications_status_check';
-- Test à blanc sur UN RDV de test (⚠️ écrit en base — compte test only) :
--   UPDATE public.appointments SET status='confirmed'
--    WHERE id='<uuid_rdv_test>' AND status <> 'confirmed';
--   SELECT * FROM public.appointment_notifications
--    WHERE appointment_id='<uuid_rdv_test>' AND kind='confirmation';

-- =====================================================================
-- ROLLBACK (décommenter pour annuler)
-- =====================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_appointment_confirmed_outbox ON public.appointments;
-- DROP FUNCTION IF EXISTS public.tg_appointment_confirmed_outbox();
-- -- (facultatif) revenir à la contrainte de statut d'origine :
-- -- ALTER TABLE public.appointment_notifications
-- --   DROP CONSTRAINT IF EXISTS appointment_notifications_status_check;
-- -- ALTER TABLE public.appointment_notifications
-- --   ADD CONSTRAINT appointment_notifications_status_check
-- --   CHECK (status IN ('pending','sent','failed','skipped'));
-- COMMIT;
