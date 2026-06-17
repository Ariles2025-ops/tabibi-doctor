-- =====================================================================
-- MSG — STEP 1 : Messagerie patient <-> medecin (conversations + messages)
-- =====================================================================
-- Fichier : migrations/MSG_step1_messaging.sql
-- Cible   : Supabase Pro EU (Postgres 15+)
--
-- PERIMETRE :
--   • 1 conversation par paire (patient, medecin), creee a la demande.
--   • Messages texte, polling cote front (pas de realtime).
--   • Gating (option B) : une conversation n'est creable que s'il existe AU MOINS
--     UN RDV confirme/honore (status confirmed/completed) entre le patient
--     (auth.uid()) et le medecin (doctor_id). Anti-spam : pas de messagerie "a froid".
--   • Chaque nouveau message -> notification in-app type 'message' pour le
--     destinataire (reutilise public.notifications + la cloche existante).
--
-- DESIGN (calque sur NOTIF_step1) :
--   • patient_id      = auth.uid() du patient (direct).
--   • doctor_id       = doctor_profiles.id.
--   • doctor_user_id  = doctor_profiles.user_id DENORMALISE dans la conversation
--                       -> RLS SANS jointure : auth.uid() IN (patient_id, doctor_user_id).
--   • Creation conversation UNIQUEMENT via RPC ensure_conversation()
--     SECURITY DEFINER (resout doctor_user_id + verifie le RDV cote serveur)
--     -> aucune policy INSERT sur conversations -> impossible de forger l'autre
--     participant ni de contourner le gating.
--   • messages : INSERT direct gate par RLS (sender_id = auth.uid() + participant).
--     UPDATE limite a read_at (grant colonne) et aux messages RECUS (sender <> moi).
--     Pas de DELETE (immutabilite, contexte medical).
--   • read_at sur message = pose quand le DESTINATAIRE lit -> badge non-lus.
--   • Notif message via trigger AFTER INSERT SECURITY DEFINER (bypass RLS notif).
--
-- PREREQUIS (doivent exister AVANT d'executer ce fichier) :
--   • public.notifications        (migrations/NOTIF_step1_event_triggers.sql)
--   • public.doctor_profiles      (avec colonnes id, user_id)
--   • public.appointments         (avec colonnes patient_id, doctor_id)
--
-- IDEMPOTENT : CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE.
-- EXECUTION  : Supabase SQL Editor (role postgres). NON auto-run.
-- ROLLBACK   : section commentee en fin de fichier.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Table conversations (1 par paire patient/medecin)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  doctor_id       uuid        NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  doctor_user_id  uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

-- Unicite de la paire (patient, medecin) -> support de ON CONFLICT dans l'RPC.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_patient_doctor_uniq
  ON public.conversations (patient_id, doctor_id);

COMMENT ON TABLE public.conversations IS
  'Messagerie : 1 conversation par paire (patient_id, doctor_id). '
  'doctor_user_id denormalise (=doctor_profiles.user_id) pour RLS sans jointure. '
  'Creation via RPC ensure_conversation() uniquement (gating RDV).';

-- ---------------------------------------------------------------------
-- SECTION 2 — Table messages
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  body            text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);

-- Borne longueur corps (DROP+ADD = idempotent meme si la table preexistait).
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_len_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_len_check
  CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000);

COMMENT ON TABLE public.messages IS
  'Messagerie : messages d''une conversation. read_at pose quand le destinataire '
  'lit (badge non-lus). INSERT gate par RLS (sender=auth.uid()+participant). '
  'UPDATE limite a read_at et aux messages recus. Pas de DELETE.';

-- ---------------------------------------------------------------------
-- SECTION 3 — Index
-- ---------------------------------------------------------------------
-- Fil d'une conversation, ordre chronologique.
CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON public.messages (conversation_id, created_at);

-- Non-lus (badge) : messages d'une conversation non encore lus.
CREATE INDEX IF NOT EXISTS messages_conv_unread_idx
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;

-- Inbox patient : ses conversations triees par activite recente.
CREATE INDEX IF NOT EXISTS conversations_patient_idx
  ON public.conversations (patient_id, last_message_at DESC);

-- Inbox medecin : idem cote medecin (via uid denormalise).
CREATE INDEX IF NOT EXISTS conversations_doctor_idx
  ON public.conversations (doctor_user_id, last_message_at DESC);

-- ---------------------------------------------------------------------
-- SECTION 4 — Etendre le CHECK notifications.type pour 'message'
--             (prerequis : table public.notifications existante)
-- ---------------------------------------------------------------------
-- Additif : toutes les valeurs existantes restent valides.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('rdv_new','rdv_confirmed','rdv_cancelled','rdv_reminder',
                  'prescription','claim','system','message'));

-- ---------------------------------------------------------------------
-- SECTION 5 — RLS conversations
-- ---------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- SELECT : seuls les 2 participants voient la conversation.
DROP POLICY IF EXISTS conv_participant_select ON public.conversations;
CREATE POLICY conv_participant_select
  ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() IN (patient_id, doctor_user_id));

-- AUCUNE policy INSERT/UPDATE/DELETE : creation via RPC SECURITY DEFINER seulement.

-- ---------------------------------------------------------------------
-- SECTION 6 — RLS messages
-- ---------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT : participant de la conversation du message.
DROP POLICY IF EXISTS msg_participant_select ON public.messages;
CREATE POLICY msg_participant_select
  ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND auth.uid() IN (c.patient_id, c.doctor_user_id)
  ));

-- INSERT : on poste EN SON NOM (sender_id=auth.uid()) dans SA conversation.
DROP POLICY IF EXISTS msg_participant_insert ON public.messages;
CREATE POLICY msg_participant_insert
  ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.patient_id, c.doctor_user_id)
    )
  );

-- UPDATE : marquer LU uniquement les messages RECUS (sender <> moi).
-- La limite a la colonne read_at est imposee par le GRANT colonne (section 7).
DROP POLICY IF EXISTS msg_recipient_mark_read ON public.messages;
CREATE POLICY msg_recipient_mark_read
  ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.patient_id, c.doctor_user_id)
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.patient_id, c.doctor_user_id)
    )
  );

-- PAS de policy DELETE : messages immuables.

-- ---------------------------------------------------------------------
-- SECTION 7 — Grants (anon = AUCUN acces)
-- ---------------------------------------------------------------------
-- conversations : lecture seule cote client ; ecriture via RPC DEFINER.
REVOKE ALL ON public.conversations FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.conversations TO authenticated;

-- messages : SELECT + INSERT(colonnes choisies) + UPDATE(read_at).
REVOKE ALL ON public.messages FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.messages TO authenticated;
GRANT INSERT (conversation_id, sender_id, body) ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;
-- (pas d'INSERT sur id/created_at/read_at -> defaults ; pas de DELETE.
--  service_role conserve son acces total natif pour d'eventuels jobs serveur.)

-- ---------------------------------------------------------------------
-- SECTION 8 — RPC ensure_conversation (gating RDV) : SECURITY DEFINER
-- ---------------------------------------------------------------------
-- Appelee par le PATIENT pour ouvrir/recuperer sa conversation avec un medecin.
-- Verifie l'existence d'au moins un RDV (passe ou present) entre eux.
CREATE OR REPLACE FUNCTION public.ensure_conversation(p_doctor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id     uuid := auth.uid();
  v_doctor_user_id uuid;
  v_conv_id        uuid;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifie' USING errcode = '28000';
  END IF;

  -- Resoudre l'uid du medecin (la fiche doit etre claimed : user_id non NULL).
  SELECT user_id INTO v_doctor_user_id
  FROM public.doctor_profiles
  WHERE id = p_doctor_id;

  IF v_doctor_user_id IS NULL THEN
    RAISE EXCEPTION 'Medecin introuvable ou fiche non revendiquee'
      USING errcode = 'P0002';
  END IF;

  -- Garde-fou : pas de conversation avec soi-meme.
  IF v_doctor_user_id = v_patient_id THEN
    RAISE EXCEPTION 'Conversation invalide (meme utilisateur)'
      USING errcode = '22023';
  END IF;

  -- GATING (B) : exiger au moins un RDV CONFIRME (ou HONORE) entre eux.
  -- Comparaison via ::text -> ne plante JAMAIS, meme si 'completed' n'est pas une
  -- valeur de l'enum appointment_status (dans ce cas seuls les 'confirmed' gatent).
  -- 'pending' / 'cancelled' / 'rejected' ne suffisent pas (anti-spam).
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = v_patient_id
      AND a.doctor_id  = p_doctor_id
      AND a.status::text IN ('confirmed','completed')
  ) THEN
    RAISE EXCEPTION 'Aucun rendez-vous confirme avec ce medecin : messagerie indisponible'
      USING errcode = '42501';
  END IF;

  -- Upsert idempotent : 1 conversation par paire. DO UPDATE pour RETURNING l'id
  -- existant ET re-synchroniser doctor_user_id si la fiche a ete (re)claimed.
  INSERT INTO public.conversations (patient_id, doctor_id, doctor_user_id)
  VALUES (v_patient_id, p_doctor_id, v_doctor_user_id)
  ON CONFLICT (patient_id, doctor_id) DO UPDATE
    SET doctor_user_id = EXCLUDED.doctor_user_id
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_conversation(uuid) IS
  'MSG step1. Ouvre/recupere la conversation du patient (auth.uid()) avec un '
  'medecin. SECURITY DEFINER : resout doctor_user_id + impose le gating RDV '
  '(confirmed/completed). Erreur 42501 si aucun RDV confirme entre eux.';

-- Seuls les utilisateurs authentifies peuvent appeler l'RPC.
REVOKE ALL ON FUNCTION public.ensure_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_conversation(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- SECTION 9 — Trigger AFTER INSERT message : last_message_at + notif
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_message_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id     uuid;
  v_doctor_user_id uuid;
  v_recipient_id   uuid;
  v_preview        text;
BEGIN
  -- Participants de la conversation.
  SELECT patient_id, doctor_user_id
    INTO v_patient_id, v_doctor_user_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Tri inbox : remonter la conversation.
  UPDATE public.conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;

  -- Destinataire = l'autre participant.
  v_recipient_id := CASE
    WHEN NEW.sender_id = v_patient_id THEN v_doctor_user_id
    ELSE v_patient_id
  END;

  -- Notif in-app pour le destinataire (reutilise public.notifications).
  IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.sender_id THEN
    v_preview := left(btrim(NEW.body), 80);
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_recipient_id,
      'message',
      'Nouveau message',
      v_preview,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id',      NEW.id,
        'sender_id',       NEW.sender_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_message_after_insert() IS
  'MSG step1. Sur INSERT message : maj conversations.last_message_at + insere une '
  'notification type=message pour le destinataire (bypass RLS via DEFINER).';

DROP TRIGGER IF EXISTS trg_message_after_insert ON public.messages;
CREATE TRIGGER trg_message_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_message_after_insert();

-- ---------------------------------------------------------------------
-- SECTION 10 — Recharger le schema PostgREST (expose tables + RPC)
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VERIFICATION POST-EXECUTION (apres COMMIT)
-- =====================================================================
-- 1. Tables + RLS active :
--    SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('conversations','messages');            -- les 2 = t
--
-- 2. Policies (conversations : 1 select ; messages : select+insert+update) :
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename IN ('conversations','messages')
--    ORDER BY tablename, cmd;
--
-- 3. Grants authenticated (anon = rien) :
--    SELECT table_name, privilege_type, column_name
--    FROM information_schema.role_column_grants
--    WHERE table_schema='public' AND table_name IN ('conversations','messages')
--      AND grantee='authenticated' ORDER BY table_name, privilege_type;
--    -- attendu : conversations SELECT ; messages SELECT, INSERT(conversation_id,
--    --           sender_id, body), UPDATE(read_at)
--
-- 4. RPC + trigger presents :
--    SELECT proname FROM pg_proc WHERE proname IN ('ensure_conversation','tg_message_after_insert');
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.messages'::regclass AND NOT tgisinternal;
--
-- 5. CHECK notifications.type inclut 'message' :
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='notifications_type_check';
--
-- 6. Test fonctionnel (staging) :
--    a) anon : SELECT sur conversations/messages -> 0 ligne / refus (verrouille).
--    b) patient SANS RDV avec medecin X : SELECT ensure_conversation('<X>')
--         -> ERREUR 42501 (gating OK).
--    c) patient AVEC RDV : SELECT ensure_conversation('<doctor_id>')
--         -> renvoie un uuid ; 2e appel -> meme uuid (idempotent).
--    d) INSERT message (sender_id=auth.uid(), conversation a soi) -> OK ;
--       + 1 notif type=message pour l'autre participant ; conversations.last_message_at maj.
--    e) INSERT message avec sender_id <> auth.uid() -> refus RLS.
--    f) UPDATE read_at sur message recu -> OK ; sur son propre message -> refus.
--
-- 7. Activer le flag front une fois valide :
--    js/tabibi-features.js -> messaging: true
--
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP TRIGGER IF EXISTS trg_message_after_insert ON public.messages;
-- DROP FUNCTION IF EXISTS public.tg_message_after_insert();
-- DROP FUNCTION IF EXISTS public.ensure_conversation(uuid);
-- DROP TABLE IF EXISTS public.messages;        -- supprime tous les messages
-- DROP TABLE IF EXISTS public.conversations;   -- supprime toutes les conversations
-- -- (optionnel) retirer 'message' du CHECK notifications.type :
-- -- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- -- ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
-- --   CHECK (type IN ('rdv_new','rdv_confirmed','rdv_cancelled','rdv_reminder',
-- --                   'prescription','claim','system'));
-- NOTIFY pgrst, 'reload schema';
-- =====================================================================
