-- =====================================================================
-- LOT 0 — Socle rappels RDV : journal/outbox des envois
-- =====================================================================
-- Fichier : supabase/migrations/20260729120000_appointment_notifications.sql
-- Date    : 2026-07-29 · Phase 4 (rappels RDV)
-- Cible   : Supabase EU (Postgres 15+) — SQL Editor, rôle postgres
--
-- RÔLE : une ligne = une tentative d'envoi pour un (RDV, type de message).
--   • Journal d'audit (qui, quand, combien ça a coûté, quelle erreur)
--   • Verrou anti-doublon : l'index UNIQUE (appointment_id, kind) rend
--     physiquement impossible le double envoi, même si deux exécutions du
--     cron se chevauchent ou si la fonction est rejouée.
--
-- ACCÈS : RLS activée, AUCUNE policy → seul `service_role` (qui contourne
--   la RLS par design) peut lire/écrire. Les clients anon/authenticated
--   ne voient rien, y compris le numéro de téléphone stocké.
--
-- IDEMPOTENT : CREATE ... IF NOT EXISTS partout.
-- ROLLBACK : section commentée en fin de fichier.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   uuid        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind             text        NOT NULL CHECK (kind IN ('confirmation','j1','h2')),
  channel          text        NOT NULL DEFAULT 'sms',
  to_phone         text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','sent','failed','skipped')),
  provider_msg_id  text,
  cost             text,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

-- ── Verrou anti-doublon (le garde-fou central du dispositif) ──────────
CREATE UNIQUE INDEX IF NOT EXISTS appointment_notifications_uniq
  ON public.appointment_notifications (appointment_id, kind);

-- ── Index de service : balayage du journal par état / date ────────────
CREATE INDEX IF NOT EXISTS appointment_notifications_status_idx
  ON public.appointment_notifications (status, created_at DESC);

-- ---------------------------------------------------------------------
-- RLS : activée SANS policy = service_role uniquement.
-- (Une table RLS sans policy rejette tout accès anon/authenticated ;
--  service_role contourne la RLS, c'est le rôle de l'edge function.)
-- ---------------------------------------------------------------------
ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_notifications FORCE ROW LEVEL SECURITY;

-- Ceinture + bretelles : retirer tout droit hérité des rôles clients.
REVOKE ALL ON public.appointment_notifications FROM anon, authenticated;

COMMENT ON TABLE public.appointment_notifications IS
  'Journal/outbox des notifications RDV (SMS). Écrit UNIQUEMENT par '
  'l''edge function appointment-reminders (service_role). RLS activée '
  'sans policy : aucun accès client. UNIQUE(appointment_id, kind) = '
  'garantie anti-double-envoi.';

COMMENT ON COLUMN public.appointment_notifications.kind IS
  'confirmation = passage status→confirmed · j1 = rappel J-1 · h2 = rappel H-2';
COMMENT ON COLUMN public.appointment_notifications.status IS
  'pending = ligne réservée, envoi en cours · sent = accepté par BudgetSMS · '
  'failed = refus fournisseur/erreur réseau · skipped = dry_run ou heure calme';
COMMENT ON COLUMN public.appointment_notifications.cost IS
  'Coût brut retourné par BudgetSMS (texte, ex. "0.0450") — non converti.';

COMMIT;

-- ── VÉRIFICATION (lecture seule) ─────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename = 'appointment_notifications';           -- rowsecurity = true
-- SELECT count(*) AS policies FROM pg_policies
--  WHERE tablename = 'appointment_notifications';           -- attendu : 0

-- =====================================================================
-- ROLLBACK (décommenter pour annuler)
-- =====================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.appointment_notifications;
-- COMMIT;
