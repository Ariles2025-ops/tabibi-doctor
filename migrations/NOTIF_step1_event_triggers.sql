-- =====================================================================
-- NOTIF — STEP 1 : Notifications in-app événementielles (4 notifs RDV)
-- =====================================================================
-- Fichier : migrations/NOTIF_step1_event_triggers.sql
-- Cible   : Supabase Pro EU (Postgres 15+)
--
-- PÉRIMÈTRE (ÉTAPE 1 — événementiel par trigger) :
--   • (médecin) nouveau RDV demandé      → INSERT status='pending'
--   • (patient) RDV confirmé             → UPDATE status →'confirmed'
--   • (patient) RDV annulé par le médecin→ UPDATE →'cancelled' (auteur ≠ patient)
--   • (médecin) RDV annulé par le patient→ UPDATE →'cancelled' (auteur = patient)
--   Le rappel veille (pg_cron J-1) = ÉTAPE 2, fichier séparé.
--
-- DESIGN :
--   • Tous les changements de statut passent par UPDATE REST direct (pas de RPC),
--     donc on intercepte au niveau DB via triggers AFTER INSERT/UPDATE.
--   • patient_id = auth.uid() du patient (direct).
--   • doctor_id  = doctor_profiles.id → l'auth.uid() du médecin se résout via
--     doctor_profiles.user_id (NULL si fiche non claimed → on skip la notif médecin).
--   • Auteur d'une annulation : auth.uid() (JWT de l'appelant, accessible en
--     SECURITY DEFINER). cancelled_by_user_id n'est PAS fiable (le cancel médecin
--     ne le pose pas).
--   • Idempotence anti-double-notif : WHEN (NEW.status IS DISTINCT FROM OLD.status).
--   • INSERT des notifs UNIQUEMENT via cette fonction SECURITY DEFINER (owner
--     postgres → bypass RLS). Aucune policy INSERT → les clients ne peuvent pas
--     forger de notifs.
--
-- IDEMPOTENT : CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE.
-- EXÉCUTION  : Supabase SQL Editor (rôle postgres). NON auto-run.
-- ROLLBACK   : section commentée en fin de fichier.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Table notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  title       text,
  message     text,
  data        jsonb       DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

-- CHECK sur type (DROP+ADD pour rester idempotent même si la table préexistait
-- sans 'rdv_new').
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('rdv_new','rdv_confirmed','rdv_cancelled','rdv_reminder','prescription','claim','system'));

COMMENT ON TABLE public.notifications IS
  'Notifications in-app. Insérées UNIQUEMENT par triggers SECURITY DEFINER. '
  'RLS : chaque user ne lit/màj que ses propres notifs (user_id=auth.uid()).';

-- ---------------------------------------------------------------------
-- SECTION 2 — Index
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- SECTION 3 — RLS + grants
-- ---------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT : un user ne voit que ses notifs
DROP POLICY IF EXISTS notif_self_select ON public.notifications;
CREATE POLICY notif_self_select
  ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- UPDATE : un user ne touche que ses notifs (utilisé pour marquer lu).
-- RLS ne fait pas de restriction colonne → la limite à read_at est imposée
-- par le GRANT column-level ci-dessous.
DROP POLICY IF EXISTS notif_self_update_read ON public.notifications;
CREATE POLICY notif_self_update_read
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- AUCUNE policy INSERT / DELETE : seuls les triggers DEFINER écrivent.

-- Grants : SELECT + UPDATE(read_at) UNIQUEMENT pour authenticated.
REVOKE ALL ON public.notifications FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
-- (pas de grant INSERT/DELETE → clients ne peuvent ni créer ni supprimer de notif.
--  service_role conserve son accès total natif pour d'éventuels jobs serveur.)

-- ---------------------------------------------------------------------
-- SECTION 4 — Fonction trigger (SECURITY DEFINER, owner postgres)
-- ---------------------------------------------------------------------
-- Branche selon TG_OP + NEW.status. auth.uid() = appelant (JWT) même en DEFINER.
CREATE OR REPLACE FUNCTION public.tg_notify_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medecin_uid uuid;
  v_when        text;
BEGIN
  -- Date FR courte, fuseau Algérie. Aucune PII médicale.
  -- COALESCE scheduled_at (OLD) / starts_at (Phase 5.1bis) : jamais de date nulle
  -- quel que soit le chemin de création.
  v_when := COALESCE(
    to_char(COALESCE(NEW.scheduled_at, NEW.starts_at) AT TIME ZONE 'Africa/Algiers', 'DD/MM/YYYY à HH24:MI'),
    'à une date à préciser'
  );

  -- ---- INSERT : nouveau RDV demandé (status pending) → notifier le médecin ----
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO v_medecin_uid
    FROM public.doctor_profiles
    WHERE id = NEW.doctor_id;

    IF v_medecin_uid IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        v_medecin_uid,
        'rdv_new',
        'Nouvelle demande de rendez-vous',
        'Un patient a demandé un rendez-vous le ' || v_when || '.',
        jsonb_build_object(
          'appointment_id', NEW.id,
          'scheduled_at',   COALESCE(NEW.scheduled_at, NEW.starts_at),
          'patient_id',     NEW.patient_id
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  -- ---- UPDATE : changement de statut (garanti distinct par le WHEN du trigger) ----
  IF NEW.status::text = 'confirmed' THEN
    -- RDV confirmé → notifier le patient
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.patient_id,
      'rdv_confirmed',
      'Rendez-vous confirmé',
      'Votre rendez-vous du ' || v_when || ' a été confirmé.',
      jsonb_build_object('appointment_id', NEW.id, 'scheduled_at', COALESCE(NEW.scheduled_at, NEW.starts_at))
    );

  ELSIF NEW.status::text = 'cancelled' THEN
    IF auth.uid() = NEW.patient_id THEN
      -- Annulé PAR le patient → notifier le médecin
      SELECT user_id INTO v_medecin_uid
      FROM public.doctor_profiles
      WHERE id = NEW.doctor_id;

      IF v_medecin_uid IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
          v_medecin_uid,
          'rdv_cancelled',
          'Rendez-vous annulé',
          'Un patient a annulé son rendez-vous du ' || v_when || '.',
          jsonb_build_object('appointment_id', NEW.id, 'scheduled_at', COALESCE(NEW.scheduled_at, NEW.starts_at))
        );
      END IF;
    ELSE
      -- Annulé côté praticien (médecin / secrétaire / admin) → notifier le patient
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.patient_id,
        'rdv_cancelled',
        'Rendez-vous annulé',
        'Votre rendez-vous du ' || v_when || ' a été annulé.',
        jsonb_build_object('appointment_id', NEW.id, 'scheduled_at', COALESCE(NEW.scheduled_at, NEW.starts_at))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_notify_appointment() IS
  'NOTIF step1. Génère les notifications in-app sur INSERT(pending)/UPDATE(status) '
  'des appointments. SECURITY DEFINER (owner postgres) pour insérer pour un user_id '
  'tiers en bypassant la RLS. auth.uid() distingue l''auteur d''une annulation.';

-- ---------------------------------------------------------------------
-- SECTION 5 — Triggers (drop avant create = idempotent)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_appointment_insert ON public.appointments;
CREATE TRIGGER trg_notify_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'pending'::appointment_status)
  EXECUTE FUNCTION public.tg_notify_appointment();

DROP TRIGGER IF EXISTS trg_notify_appointment_update ON public.appointments;
CREATE TRIGGER trg_notify_appointment_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.tg_notify_appointment();

-- ---------------------------------------------------------------------
-- SECTION 6 — Recharger le schéma PostgREST
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATION POST-EXÉCUTION (après COMMIT)
-- =====================================================================
-- 1. Table + RLS :
--    SELECT relrowsecurity FROM pg_class WHERE relname='notifications';   -- t
--
-- 2. Policies (doit lister 2 : select + update, aucune insert) :
--    SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='notifications' ORDER BY cmd;
--
-- 3. Grants (authenticated : SELECT + UPDATE ; PAS d'INSERT) :
--    SELECT privilege_type, column_name FROM information_schema.role_column_grants
--    WHERE table_schema='public' AND table_name='notifications' AND grantee='authenticated';
--    -- attendu : SELECT (toutes colonnes) + UPDATE (read_at uniquement)
--
-- 4. Triggers présents :
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid='public.appointments'::regclass AND tgname LIKE 'trg_notify_%';
--
-- 5. Test fonctionnel (sur staging idéalement) :
--    - INSERT un RDV pending → 1 notif rdv_new pour le médecin (si fiche claimed).
--    - UPDATE status→confirmed → 1 notif rdv_confirmed pour le patient.
--    - UPDATE status→cancelled par le patient → 1 notif rdv_cancelled pour le médecin.
--    - UPDATE status→cancelled par le médecin → 1 notif rdv_cancelled pour le patient.
--    - UPDATE sans changer status → AUCUNE notif (WHEN distinct).
--
-- 6. Activer le flag front une fois validé :
--    js/tabibi-features.js → notifications: true
--
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP TRIGGER IF EXISTS trg_notify_appointment_update ON public.appointments;
-- DROP TRIGGER IF EXISTS trg_notify_appointment_insert ON public.appointments;
-- DROP FUNCTION IF EXISTS public.tg_notify_appointment();
-- DROP TABLE IF EXISTS public.notifications;   -- ⚠️ supprime toutes les notifs
-- NOTIFY pgrst, 'reload schema';
-- =====================================================================
