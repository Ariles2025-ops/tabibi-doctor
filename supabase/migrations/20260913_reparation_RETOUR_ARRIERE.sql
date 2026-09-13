-- =====================================================================
-- 20260913_reparation_RETOUR_ARRIERE.sql
-- Les QUINZE definitions telles qu'elles sont en base AVANT la reparation
-- =====================================================================
-- Capture : pg_get_functiondef(), 2026-09-13T16:22:21 (heure locale).
--
-- CE FICHIER NE SE LANCE PAS AUJOURD'HUI. Il existe pour qu'il y ait quelque
-- chose a quoi revenir. CREATE OR REPLACE FUNCTION ecrase sans laisser de
-- trace : Postgres ne garde aucune version precedente d'un corps de fonction.
-- Non capture maintenant, l'etat d'avant n'existe plus nulle part.
-- C'est l'equivalent, pour la base, du deploiement 66da5afc pour Cloudflare.
--
-- CE QU'IL RESTAURE EST CASSE, ET C'EST VOULU. Ces quinze corps sont ceux que
-- plpgsql_check a signales : le declencheur qui ecrit dans une vue, les six
-- appels pgcrypto non qualifies, les huit INSERT d'audit vers des colonnes
-- inexistantes. Un retour arriere ne repare pas, il remet l'etat connu. Le
-- lancer reouvre sciemment les quinze defauts — on ne le fait que si la
-- migration a produit pire que ce qu'elle corrigeait.
--
-- A LANCER SEUL. Aucune autre requete dans ce fichier : l'editeur SQL de
-- Supabase enveloppe tout le script dans UNE transaction.
--
-- ---------------------------------------------------------------------
-- AVANT DE S'Y FIER : PROUVER QUE LA CAPTURE EST ENCORE FIDELE
-- ---------------------------------------------------------------------
-- La capture date du 2026-09-13T16:22:21. Si une fonction a bouge en base
-- depuis, ce fichier ferait revenir a un etat qui n'a jamais existe.
--
-- Requete a lancer DANS UN PASSAGE SEPARE, AVANT la migration.
-- Elle doit rendre ZERO ligne. Toute ligne rendue = capture perimee, on
-- recapture avant de lancer quoi que ce soit.
--
--   WITH capture(proname, empreinte) AS (VALUES
--       ('fn_update_doctor_rating','2dd134ab97f332ecbb59c713c6fcee36'),
--       ('tabibi_pii_encrypt','2a8aee0b5ac53da0c8f2e4affec53870'),
--       ('tabibi_pii_decrypt','ebb2d5540d6d0d55770b9e0030f99757'),
--       ('generate_api_key_pair','cf0d0d09b597ac6ba9c5be6e044f536d'),
--       ('verify_api_key','a009c7b0c32233748a3bb675b9721945'),
--       ('accept_cabinet_invitation','fad62e087fe1d2ac4e3a75885ad1311a'),
--       ('create_cabinet','bc8b458fc211bab090a5e96806c4de0a'),
--       ('create_video_session','929f8f92c392d2ba3219cd56275d26cd'),
--       ('disable_two_factor','bc657cd8db63558ed1bad0ab1dfdc3f3'),
--       ('invite_cabinet_member','2c2ab0443a849b039fbc7ad34fc86594'),
--       ('remove_cabinet_member','1fba985c8c795beb5a7d78c5b841c90b'),
--       ('set_video_recording_consent','f664f8a26132cebac2089e7fc5521e17'),
--       ('transfer_cabinet_ownership','81df72646b10af6763a4f6db8a902536'),
--       ('record_consent','d7ae2ce3174dc79819f6c3ae7218f285'),
--       ('enroll_two_factor','3823a2b9b97e60e291c49ee74169ca2f')
--   )
--   SELECT c.proname,
--          CASE WHEN p.oid IS NULL THEN 'ABSENTE EN BASE'
--               ELSE 'MODIFIEE DEPUIS LA CAPTURE' END AS ecart
--   FROM capture c
--   LEFT JOIN pg_proc p
--     ON p.pronamespace = 'public'::regnamespace
--    AND p.proname = c.proname
--   WHERE p.oid IS NULL
--      OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM c.empreinte;
--
-- (Les memes quinze empreintes servent apres un retour arriere : la requete
-- doit alors rendre zero ligne a nouveau, ce qui prouve que le retour a bien
-- restaure l'etat capture, et pas approximativement.)
-- =====================================================================

-- ---------------------------------------------------------------------
--  1/15 — public.fn_update_doctor_rating
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_doctor_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doctor_id UUID;
  v_avg NUMERIC(3,2);
  v_count INTEGER;
BEGIN
  v_doctor_id := COALESCE(NEW.doctor_id, OLD.doctor_id);

  SELECT
    ROUND(AVG(rev.rating_overall)::NUMERIC, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM public.reviews rev
  WHERE rev.doctor_id = v_doctor_id
    AND rev.status = 'published';

  BEGIN
    UPDATE public.public_doctors
    SET rating       = COALESCE(v_avg, 0),
        review_count = v_count
    WHERE id = v_doctor_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END $function$;

-- ---------------------------------------------------------------------
--  2/15 — public.tabibi_pii_encrypt
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tabibi_pii_encrypt(plain text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF plain IS NULL OR plain = '' THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(plain, public.tabibi_pii_key());
END;
$function$;

-- ---------------------------------------------------------------------
--  3/15 — public.tabibi_pii_decrypt
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tabibi_pii_decrypt(cipher bytea)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF cipher IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(cipher, public.tabibi_pii_key());
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------
--  4/15 — public.generate_api_key_pair
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_api_key_pair(p_environment text DEFAULT 'sandbox'::text)
 RETURNS TABLE(key_id text, secret_plain text, secret_hash text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prefix_id     text;
  v_prefix_secret text;
  v_id_rand       text;
  v_sec_rand      text;
BEGIN
  IF p_environment NOT IN ('sandbox','production') THEN
    RAISE EXCEPTION 'environment doit être sandbox ou production';
  END IF;

  v_prefix_id     := CASE WHEN p_environment = 'production' THEN 'tbk_live_' ELSE 'tbk_sand_' END;
  v_prefix_secret := CASE WHEN p_environment = 'production' THEN 'tbs_live_' ELSE 'tbs_sand_' END;

  -- 16 octets aléatoires => 32 hex
  v_id_rand  := encode(gen_random_bytes(16), 'hex');
  -- 48 octets aléatoires => 96 hex (haute entropie)
  v_sec_rand := encode(gen_random_bytes(48), 'hex');

  key_id       := v_prefix_id || v_id_rand;
  secret_plain := v_prefix_secret || v_sec_rand;

  -- Hash : SHA-256 du secret (rapide, suffisant pour secret aléatoire à haute entropie).
  -- NOTE : pour des secrets dérivés d'humain on utiliserait bcrypt/argon2,
  -- mais ici le secret est cryptographiquement aléatoire (>=384 bits).
  secret_hash := encode(digest(secret_plain, 'sha256'), 'hex');

  RETURN NEXT;
END;
$function$;

-- ---------------------------------------------------------------------
--  5/15 — public.verify_api_key
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_api_key(p_key_id text, p_key_secret text, p_client_ip text DEFAULT NULL::text)
 RETURNS api_keys
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row         public.api_keys%ROWTYPE;
  v_expected    text;
  v_ip_ok       boolean;
BEGIN
  IF p_key_id IS NULL OR p_key_secret IS NULL THEN
    RAISE EXCEPTION 'Identifiants API manquants' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_row
  FROM public.api_keys
  WHERE key_id = p_key_id
    AND active = true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clé API invalide ou révoquée' USING ERRCODE = '28000';
  END IF;

  v_expected := encode(digest(p_key_secret, 'sha256'), 'hex');

  -- Comparaison constante (anti timing attack côté SQL : on évite branch sur IF...)
  IF v_row.key_secret_hash IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Clé API invalide' USING ERRCODE = '28000';
  END IF;

  -- Vérification IP whitelist
  IF array_length(v_row.ip_whitelist, 1) IS NOT NULL THEN
    IF p_client_ip IS NULL THEN
      RAISE EXCEPTION 'IP cliente requise pour cette clé' USING ERRCODE = '28000';
    END IF;
    v_ip_ok := EXISTS (
      SELECT 1 FROM unnest(v_row.ip_whitelist) AS cidr
      WHERE p_client_ip::inet <<= cidr::inet
    );
    IF NOT v_ip_ok THEN
      RAISE EXCEPTION 'IP cliente non autorisée' USING ERRCODE = '28000';
    END IF;
  END IF;

  -- Mise à jour last_used (fire & forget, non bloquant en cas d'erreur)
  UPDATE public.api_keys
     SET last_used_at = now(),
         last_used_ip = COALESCE(p_client_ip, last_used_ip),
         total_calls  = total_calls + 1
   WHERE id = v_row.id;

  RETURN v_row;
END;
$function$;

-- ---------------------------------------------------------------------
--  6/15 — public.accept_cabinet_invitation
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_cabinet_invitation(p_cabinet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  UPDATE public.cabinet_members
     SET accepted_at = COALESCE(accepted_at, now()),
         active      = true
   WHERE cabinet_id  = p_cabinet_id
     AND user_id     = v_user
     AND accepted_at IS NULL
  RETURNING role INTO v_role;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'no_pending_invitation');
  END IF;

  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_user, 'cabinet_member:accept', 'cabinet', p_cabinet_id,
            jsonb_build_object('role', v_role));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id, 'role', v_role);
END;
$function$;

-- ---------------------------------------------------------------------
--  7/15 — public.create_cabinet
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_cabinet(p_name text, p_legal_form text DEFAULT 'Independant'::text, p_wilaya text DEFAULT NULL::text, p_commune text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_rc_number text DEFAULT NULL::text, p_nif text DEFAULT NULL::text, p_subscription_tier text DEFAULT 'solo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_id    uuid;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_subscription_tier NOT IN ('solo','pro','cabinet','enterprise') THEN
    p_subscription_tier := 'solo';
  END IF;

  INSERT INTO public.cabinets (
    name, legal_form, wilaya, commune, address, phone, email,
    rc_number, nif, subscription_tier, owner_user_id
  ) VALUES (
    p_name, p_legal_form, p_wilaya, p_commune, p_address, p_phone, p_email,
    p_rc_number, p_nif, p_subscription_tier, v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.cabinet_members (
    cabinet_id, user_id, role, accepted_at, active, invited_by_user_id
  ) VALUES (
    v_id, v_actor, 'owner', now(), true, v_actor
  );

  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_actor, 'cabinet:create', 'cabinet', v_id,
            jsonb_build_object('name', p_name, 'tier', p_subscription_tier));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', v_id);
END;
$function$;

-- ---------------------------------------------------------------------
--  8/15 — public.create_video_session
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_video_session(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_appointment  record;
  v_existing     record;
  v_room_name    text;
  v_session_id   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 1. Verifier le RDV existe et que le caller est patient OU medecin
  SELECT id, patient_id, doctor_id, scheduled_at, status, duration_minutes
    INTO v_appointment
    FROM public.appointments
   WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'appointment_not_found');
  END IF;

  IF v_appointment.patient_id <> v_caller
     AND v_appointment.doctor_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- 2. Le RDV doit etre confirmed (sinon: refuse)
  IF v_appointment.status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'error', 'appointment_not_confirmed',
      'current_status', v_appointment.status
    );
  END IF;

  -- 3. Idempotence: si une session existe deja, on la renvoie telle quelle
  SELECT id, daily_room_name, daily_room_url, status, scheduled_at
    INTO v_existing
    FROM public.video_sessions
   WHERE appointment_id = p_appointment_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',              true,
      'session_id',      v_existing.id,
      'daily_room_name', v_existing.daily_room_name,
      'daily_room_url',  v_existing.daily_room_url,
      'status',          v_existing.status,
      'created',         false
    );
  END IF;

  -- 4. Generer le room name (tabibi-rdv-<8 premiers chars du uuid appointment>)
  v_room_name := 'tabibi-rdv-' || replace(p_appointment_id::text, '-', '');
  v_room_name := substring(v_room_name from 1 for 64);

  -- 5. INSERT avec URL placeholder. L'Edge Function la mettra a jour via
  --    le service_role (qui contourne le trigger de protection).
  INSERT INTO public.video_sessions (
    appointment_id, daily_room_name, daily_room_url,
    scheduled_at, status
  )
  VALUES (
    p_appointment_id, v_room_name,
    'https://placeholder.daily.co/' || v_room_name,
    v_appointment.scheduled_at, 'scheduled'
  )
  RETURNING id INTO v_session_id;

  -- 6. Audit trail (si la table audit_log existe -- creee par MIGRATION_rls_hardening)
  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_caller, 'video_session:create', 'video_session', v_session_id,
            jsonb_build_object('appointment_id', p_appointment_id));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit_log absente: on continue
  END;

  RETURN jsonb_build_object(
    'ok',              true,
    'session_id',      v_session_id,
    'daily_room_name', v_room_name,
    'created',         true
  );
END;
$function$;

-- ---------------------------------------------------------------------
--  9/15 — public.disable_two_factor
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.disable_two_factor()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  UPDATE public.two_factor_secrets
     SET enabled = false,
         disabled_at = now(),
         secret_hash = '\x00'::bytea,
         recovery_codes_hashes = ARRAY[]::bytea[],
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = now()
   WHERE user_id = v_user;

  INSERT INTO public.audit_log(actor_id, action, target_type, target_id)
  VALUES (v_user, 'two_factor:disable', 'user', v_user);

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------------------------------------------------------------------
-- 10/15 — public.invite_cabinet_member
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invite_cabinet_member(p_cabinet_id uuid, p_target_user_id uuid, p_role text, p_permissions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF NOT public.is_cabinet_admin(p_cabinet_id) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;
  IF p_role NOT IN ('doctor','secretaire','admin_cabinet') THEN
    RETURN jsonb_build_object('error', 'invalid_role');
    -- owner uniquement via transfer_cabinet_ownership
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'target_user_not_found');
  END IF;

  INSERT INTO public.cabinet_members (
    cabinet_id, user_id, role, permissions,
    invited_at, invited_by_user_id, accepted_at, active
  ) VALUES (
    p_cabinet_id, p_target_user_id, p_role, COALESCE(p_permissions,'{}'::jsonb),
    now(), v_actor, NULL, true
  )
  ON CONFLICT (cabinet_id, user_id) DO UPDATE SET
    role               = EXCLUDED.role,
    permissions        = EXCLUDED.permissions,
    invited_at         = EXCLUDED.invited_at,
    invited_by_user_id = EXCLUDED.invited_by_user_id,
    active             = true;

  -- audit (si table audit_log existe -- cf hardening)
  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_actor, 'cabinet_member:invite', 'cabinet_member', p_target_user_id,
            jsonb_build_object('cabinet_id', p_cabinet_id, 'role', p_role));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- audit_log facultatif
  END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id,
                            'user_id', p_target_user_id, 'role', p_role);
END;
$function$;

-- ---------------------------------------------------------------------
-- 11/15 — public.remove_cabinet_member
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_cabinet_member(p_cabinet_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target_role text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF v_actor = p_user_id THEN
    RETURN jsonb_build_object('error', 'cannot_remove_self');
  END IF;
  IF NOT public.is_cabinet_admin(p_cabinet_id) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT role INTO v_target_role FROM public.cabinet_members
   WHERE cabinet_id = p_cabinet_id AND user_id = p_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'cannot_remove_owner_use_transfer');
  END IF;

  -- desactiver plutot que supprimer (preserve historique RDV / audit)
  UPDATE public.cabinet_members
     SET active = false
   WHERE cabinet_id = p_cabinet_id AND user_id = p_user_id;

  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_actor, 'cabinet_member:remove', 'cabinet_member', p_user_id,
            jsonb_build_object('cabinet_id', p_cabinet_id, 'previous_role', v_target_role));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------------------------------------------------------------------
-- 12/15 — public.set_video_recording_consent
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_video_recording_consent(p_session_id uuid, p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller  uuid := auth.uid();
  v_session record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT vs.id, vs.status, a.patient_id
    INTO v_session
    FROM public.video_sessions vs
    JOIN public.appointments a ON a.id = vs.appointment_id
   WHERE vs.id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;

  -- SEUL le patient peut donner son consentement
  IF v_session.patient_id <> v_caller THEN
    RETURN jsonb_build_object('error', 'patient_only');
  END IF;

  IF v_session.status NOT IN ('scheduled') THEN
    RETURN jsonb_build_object('error', 'session_already_started');
  END IF;

  UPDATE public.video_sessions
     SET consent_patient_recording    = p_consent,
         consent_patient_recording_at = CASE WHEN p_consent THEN now() ELSE NULL END,
         recording_enabled            = CASE WHEN p_consent THEN recording_enabled ELSE false END,
         updated_at                   = now()
   WHERE id = p_session_id;

  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_caller,
            CASE WHEN p_consent THEN 'video_session:consent_grant' ELSE 'video_session:consent_revoke' END,
            'video_session', p_session_id,
            jsonb_build_object('consent', p_consent));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'consent', p_consent);
END;
$function$;

-- ---------------------------------------------------------------------
-- 13/15 — public.transfer_cabinet_ownership
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transfer_cabinet_ownership(p_cabinet_id uuid, p_new_owner_id uuid, p_confirm text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_confirm IS DISTINCT FROM 'CONFIRM_TRANSFER' THEN
    RETURN jsonb_build_object('error', 'confirmation_required');
  END IF;
  IF NOT public.is_cabinet_owner(p_cabinet_id) THEN
    RETURN jsonb_build_object('error', 'only_owner_can_transfer');
  END IF;
  IF v_actor = p_new_owner_id THEN
    RETURN jsonb_build_object('error', 'new_owner_must_differ');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cabinet_members
     WHERE cabinet_id = p_cabinet_id
       AND user_id    = p_new_owner_id
       AND active     = true
       AND accepted_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'new_owner_must_be_active_member');
  END IF;

  -- ancien owner devient doctor (par defaut, peut etre change ensuite)
  UPDATE public.cabinet_members
     SET role = 'doctor'
   WHERE cabinet_id = p_cabinet_id AND user_id = v_actor;

  UPDATE public.cabinet_members
     SET role = 'owner'
   WHERE cabinet_id = p_cabinet_id AND user_id = p_new_owner_id;

  UPDATE public.cabinets
     SET owner_user_id = p_new_owner_id,
         updated_at    = now()
   WHERE id = p_cabinet_id;

  BEGIN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_actor, 'cabinet:transfer_ownership', 'cabinet', p_cabinet_id,
            jsonb_build_object('previous_owner', v_actor, 'new_owner', p_new_owner_id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id,
                            'new_owner', p_new_owner_id);
END;
$function$;

-- ---------------------------------------------------------------------
-- 14/15 — public.record_consent
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_consent(p_scope text, p_version text, p_granted boolean, p_source text DEFAULT 'settings'::text, p_locale text DEFAULT 'fr'::text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_evidence jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pepper text;
  v_ip_h text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Hash IP avec pepper (RGPD art 25)
  IF p_ip IS NOT NULL AND length(p_ip) > 0 THEN
    BEGIN
      v_pepper := current_setting('app.tabibi_ip_pepper', true);
    EXCEPTION WHEN OTHERS THEN
      v_pepper := '';
    END;
    v_ip_h := encode(digest(p_ip || COALESCE(v_pepper,''), 'sha256'), 'hex');
  END IF;

  INSERT INTO public.consents_log(
    user_id, consent_scope, consent_version, granted, granted_at,
    revoked_at, source, locale, ip_hash, user_agent, evidence
  )
  VALUES (
    v_user, p_scope, p_version, p_granted,
    now(),
    CASE WHEN p_granted = false THEN now() ELSE NULL END,
    p_source, p_locale, v_ip_h, p_user_agent, p_evidence
  );

  -- Trace dans audit_log uniquement pour les scopes sante / sensibles
  IF p_scope IN ('health_data_processing','telemedicine','data_deletion','third_party_sharing') THEN
    INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
    VALUES (v_user, 'consent:' || (CASE WHEN p_granted THEN 'grant' ELSE 'revoke' END),
            'user', v_user,
            jsonb_build_object('scope', p_scope, 'version', p_version, 'source', p_source));
  END IF;

  RETURN jsonb_build_object('ok', true, 'scope', p_scope, 'version', p_version, 'granted', p_granted);
END;
$function$;

-- ---------------------------------------------------------------------
-- 15/15 — public.enroll_two_factor
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enroll_two_factor(p_secret_b32 text, p_recovery_codes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user   uuid := auth.uid();
  v_pepper text;
  v_hash   bytea;
  v_codes_h bytea[];
  c text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_secret_b32 IS NULL OR length(p_secret_b32) < 16 THEN
    RETURN jsonb_build_object('error', 'invalid_secret');
  END IF;
  IF p_recovery_codes IS NULL OR array_length(p_recovery_codes, 1) NOT BETWEEN 6 AND 12 THEN
    RETURN jsonb_build_object('error', 'invalid_recovery_codes_count');
  END IF;

  -- Pepper depuis la config GUC (defini cote infra: ALTER DATABASE ... SET app.tabibi_2fa_pepper = '...')
  BEGIN
    v_pepper := current_setting('app.tabibi_2fa_pepper', true);
  EXCEPTION WHEN OTHERS THEN
    v_pepper := NULL;
  END;
  IF v_pepper IS NULL OR length(v_pepper) < 32 THEN
    RAISE EXCEPTION 'app.tabibi_2fa_pepper non configure (>= 32 chars). Voir SECRETS_ROTATION_PROCEDURE.md.';
  END IF;

  v_hash := digest(p_secret_b32 || v_pepper, 'sha256');
  v_codes_h := ARRAY[]::bytea[];
  FOREACH c IN ARRAY p_recovery_codes LOOP
    v_codes_h := array_append(v_codes_h, digest(c || v_pepper, 'sha256'));
  END LOOP;

  INSERT INTO public.two_factor_secrets(
    user_id, secret_hash, recovery_codes_hashes, enabled, enabled_at
  )
  VALUES (v_user, v_hash, v_codes_h, true, now())
  ON CONFLICT (user_id) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash,
        recovery_codes_hashes = EXCLUDED.recovery_codes_hashes,
        enabled = true,
        enabled_at = now(),
        disabled_at = NULL,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now();

  INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
  VALUES (v_user, 'two_factor:enroll', 'user', v_user,
          jsonb_build_object('algo','totp_sha1_30s'));

  RETURN jsonb_build_object('ok', true);
END;
$function$;
