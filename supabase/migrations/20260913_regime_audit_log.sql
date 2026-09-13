-- =====================================================================
-- 20260913_regime_audit_log.sql
-- Le regime de chaque ecriture d'audit, decide au lieu d'herite
-- =====================================================================
-- ETAT : A APPLIQUER. Ecrite par Claude, lue et lancee par le stratege.
-- A APPLIQUER **APRES** 20260913_cabinet_members_tracabilite.sql, qui pose les
-- colonnes sans lesquelles `remove_cabinet_member` ne pourrait pas etre PREUVE.
--
-- Mesure et raisonnement complets : supabase/mesures/20260913_regime_audit_log.sql
--
-- ---------------------------------------------------------------------
-- LE CRITERE
-- ---------------------------------------------------------------------
--   > Une ecriture d'audit est CONSTITUTIVE quand executer l'acte SANS sa trace
--   > est PIRE que ne pas l'executer du tout. Sinon elle est PREUVE.
--
-- Il a un cout assume : une trace constitutive qui echoue BLOQUE l'utilisateur.
-- Tout rendre constitutif n'est pas « plus sur » — pour l'ACTIVATION d'une
-- protection, bloquer laisse l'utilisateur MOINS protege. C'est la raison
-- d'`enroll_two_factor` ci-dessous, et c'est le contre-exemple qui valide le
-- critere.
--
-- ---------------------------------------------------------------------
-- LE TABLEAU
-- ---------------------------------------------------------------------
-- +------------------------------+-------------+-------------+----------+
-- | fonction                     | avant       | apres       |          |
-- +------------------------------+-------------+-------------+----------+
-- | fn_audit_changes             | CONSTITUTIVE| CONSTITUTIVE| inchange |
-- | disable_two_factor           | CONSTITUTIVE| CONSTITUTIVE| inchange |
-- | set_video_recording_consent  | PREUVE      | CONSTITUTIVE| CHANGE   |
-- | transfer_cabinet_ownership   | PREUVE      | CONSTITUTIVE| CHANGE   |
-- +------------------------------+-------------+-------------+----------+
-- | enroll_two_factor            | CONSTITUTIVE| PREUVE      | CHANGE   |
-- | record_consent               | CONSTITUTIVE| PREUVE (*)  | CHANGE   |
-- | remove_cabinet_member        | PREUVE      | PREUVE (**) | inchange |
-- | accept_cabinet_invitation    | PREUVE      | PREUVE      | inchange |
-- | create_cabinet               | PREUVE      | PREUVE      | inchange |
-- | create_video_session         | PREUVE      | PREUVE      | inchange |
-- | invite_cabinet_member        | PREUVE      | PREUVE      | inchange |
-- +------------------------------+-------------+-------------+----------+
--   4 CONSTITUTIVES · 7 PREUVES · 4 changements de regime
--
--  (*)  PREUVE pour `audit_log` SEULEMENT. L'INSERT dans `consents_log` reste
--       NU et le restera : c'est LUI l'enregistrement legal.
--  (**) PREUVE parce que 20260913_cabinet_members_tracabilite.sql vient de
--       mettre QUI / QUAND / DEPUIS QUEL ROLE dans la table metier. Sans ces
--       colonnes, l'audit etait le seul exemplaire et il aurait fallu le rendre
--       constitutif — le palliatif au lieu du remede.
--
-- LES QUATRE CHANGEMENTS, UN PAR UN :
--
--   set_video_recording_consent -> CONSTITUTIVE
--     Consentement a l'ENREGISTREMENT d'un acte medical. La liceite de
--     l'enregistrement repose sur cette trace. Enregistrer une consultation
--     sans preuve du consentement est pire que ne pas pouvoir le recueillir.
--
--   transfer_cabinet_ownership -> CONSTITUTIVE
--     `cabinets.owner_user_id` garde le NOUVEAU proprietaire ; rien ne garde
--     QUI a transfere. Un litige de propriete de cabinet est previsible, et
--     bloquer est acceptable : on reessaie.
--
--   enroll_two_factor -> PREUVE
--     Si la trace echoue, bloquer l'activation laisse l'utilisateur SANS
--     deuxieme facteur. Une activation non tracee vaut mieux qu'une protection
--     absente. **L'asymetrie avec `disable_two_factor` est voulue et elle est
--     le coeur du critere : DESACTIVER une protection est le geste de
--     l'attaquant, l'ACTIVER ne l'est pas.** Le premier doit laisser une trace
--     ou ne pas avoir lieu ; le second doit avoir lieu.
--
--   record_consent -> PREUVE (pour audit_log)
--     L'enregistrement legal est `consents_log`, dont l'INSERT est NU. La ligne
--     `audit_log` est un DOUBLON pose pour quatre scopes sensibles. Un doublon
--     n'a pas a bloquer l'acte que l'original a deja enregistre.
--
-- ---------------------------------------------------------------------
-- CE QUE DEVIENT UNE « PREUVE » — et ce n'est pas RAISE WARNING seul
-- ---------------------------------------------------------------------
-- Une PREUVE a le droit d'echouer sans annuler l'acte. Elle N'A PAS le droit
-- d'echouer en silence, et `THEN NULL` est exactement ce silence.
--
-- Les sept PREUVES portent desormais, mot pour mot, le meme bloc :
--
--   EXCEPTION WHEN OTHERS THEN
--     <capture SQLSTATE / SQLERRM>
--     INSERT INTO public.audit_log_echecs(...)   -- le REBUT
--     RAISE WARNING '...'
--   EXCEPTION WHEN OTHERS THEN                   -- si le rebut echoue AUSSI
--     RAISE WARNING '... ET rebut en echec (...)'
--
-- Trois niveaux, et chacun a sa raison :
--   1. le REBUT (`audit_log_echecs`, creee ce matin POUR CA) garde la ligne
--      d'audit perdue, avec la cause. Une preuve qui echoue reste lisible.
--   2. `RAISE WARNING` remonte au client PostgREST ET dans le journal Postgres
--      sans annuler la transaction — le geste de `public.rls_auto_enable()`,
--      deja en base et deja documente comme le bon.
--   3. le handler IMBRIQUE : si l'audit a echoue pour une cause qui touche
--      AUSSI le rebut (disque plein, verrou global), le rebut echoue a son
--      tour. On rend alors les DEUX erreurs. Sans ce niveau, la panne la plus
--      grave serait la plus silencieuse.
--
-- ⚠️  SANS COMPTEUR, LE REBUT EST UN TIROIR. Le compteur admin
-- (« N ecritures d'audit en rebut ») est dans `admin-dashboard.html`, meme lot.
-- Une table de rebut que personne ne regarde ne vaut pas mieux qu'un
-- `THEN NULL` : elle deplace le silence, elle ne le supprime pas.
--
-- ---------------------------------------------------------------------
-- POURQUOI CE FICHIER EST SUR, ET OU EST LE RISQUE
-- ---------------------------------------------------------------------
-- Sur : les onze corps sont repris **mot pour mot** de `pg_get_functiondef()`
-- du 13/09/2026. Seul le bloc d'audit change. Aucune garde, aucun WHERE, aucune
-- signature n'est touche. `plpgsql_check` rend 0 defaut sur les onze AVANT.
--
-- Le risque : les onze sont des `CREATE OR REPLACE`. Si quelqu'un a modifie une
-- de ces fonctions en base entre l'ecriture de ce fichier et son application,
-- **ce fichier ecrase silencieusement sa modification.** Relire la section
-- VERIFICATION avant de lancer, et comparer les corps si un doute existe.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

-- ---------------------------------------------------------------------
-- CONSTITUTIVES — 2 changements. L'INSERT devient NU : si la trace echoue,
-- l'acte est annule avec elle.
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

  -- [13/09/2026] CONSTITUTIVE. Le handler `EXCEPTION WHEN OTHERS THEN NULL` a
  -- ete RETIRE. Consentement a l'enregistrement d'un acte medical : la liceite
  -- de l'enregistrement repose sur cette trace. Si elle ne peut pas s'ecrire,
  -- le consentement ne doit pas etre pose.
  INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
  VALUES (v_caller,
          CASE WHEN p_consent THEN 'video_session:consent_grant' ELSE 'video_session:consent_revoke' END,
          'video_session', p_session_id,
          jsonb_build_object('consent', p_consent));

  RETURN jsonb_build_object('ok', true, 'consent', p_consent);
END;
$function$;

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

  -- [13/09/2026] CONSTITUTIVE. Handler retire. `cabinets.owner_user_id` garde
  -- le NOUVEAU proprietaire ; RIEN ne garde qui a transfere. Cette ligne est le
  -- seul endroit ou l'acteur existe, et un litige de propriete est previsible.
  -- Bloquer est acceptable : on reessaie.
  INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
  VALUES (v_actor, 'cabinet:transfer_ownership', 'cabinet', p_cabinet_id,
          jsonb_build_object('previous_owner', v_actor, 'new_owner', p_new_owner_id));

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id,
                            'new_owner', p_new_owner_id);
END;
$function$;

-- ---------------------------------------------------------------------
-- PREUVES — 7 fonctions. `THEN NULL` -> rebut + RAISE WARNING, avec le
-- handler imbrique pour le cas ou le rebut echoue lui aussi.
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
  v_etat text; v_msg text;
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

  v_hash := extensions.digest(p_secret_b32 || v_pepper, 'sha256');
  v_codes_h := ARRAY[]::bytea[];
  FOREACH c IN ARRAY p_recovery_codes LOOP
    v_codes_h := array_append(v_codes_h, extensions.digest(c || v_pepper, 'sha256'));
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

  -- [13/09/2026] PREUVE, et l'asymetrie avec `disable_two_factor` est VOULUE :
  -- DESACTIVER une protection est le geste de l'attaquant, l'ACTIVER ne l'est
  -- pas. Bloquer l'activation parce que sa trace echoue laisserait
  -- l'utilisateur SANS deuxieme facteur — le contraire du but.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_user, 'two_factor:enroll', 'user', v_user,
            jsonb_build_object('algo','totp_sha1_30s'));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('enroll_two_factor', v_etat, v_msg, v_user, 'two_factor:enroll', 'user', v_user,
              jsonb_build_object('algo','totp_sha1_30s'));
      RAISE WARNING 'audit_log: two_factor:enroll non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: two_factor:enroll non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

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
  v_etat text; v_msg text;
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
    v_ip_h := encode(extensions.digest(p_ip || COALESCE(v_pepper,''), 'sha256'), 'hex');
  END IF;

  -- ⚠️  CET INSERT RESTE NU, ET IL DOIT LE RESTER. `consents_log` est
  -- l'enregistrement LEGAL du consentement (RGPD art. 7-1 : pouvoir demontrer).
  -- S'il ne peut pas s'ecrire, le consentement n'a pas ete recueilli, et l'acte
  -- doit echouer. C'est la seule ecriture CONSTITUTIVE de cette fonction.
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

  -- Trace dans audit_log uniquement pour les scopes sante / sensibles.
  -- [13/09/2026] PREUVE : c'est un DOUBLON de la ligne ci-dessus. Un doublon
  -- n'a pas a bloquer l'acte que l'original a deja enregistre.
  IF p_scope IN ('health_data_processing','telemedicine','data_deletion','third_party_sharing') THEN
    BEGIN
      INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
      VALUES (v_user, 'consent:' || (CASE WHEN p_granted THEN 'grant' ELSE 'revoke' END),
              'user', v_user,
              jsonb_build_object('scope', p_scope, 'version', p_version, 'source', p_source));
    EXCEPTION WHEN OTHERS THEN
      v_etat := SQLSTATE; v_msg := SQLERRM;
      BEGIN
        INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
        VALUES ('record_consent', v_etat, v_msg, v_user,
                'consent:' || (CASE WHEN p_granted THEN 'grant' ELSE 'revoke' END), 'user', v_user,
                jsonb_build_object('scope', p_scope, 'version', p_version, 'source', p_source));
        RAISE WARNING 'audit_log: consent:% non ecrit (% %) — mis au rebut. consents_log EST ecrit.',
                      p_scope, v_etat, v_msg;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'audit_log: consent:% non ecrit (% %) ET rebut en echec (% %). consents_log EST ecrit.',
                      p_scope, v_etat, v_msg, SQLSTATE, SQLERRM;
      END;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'scope', p_scope, 'version', p_version, 'granted', p_granted);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_cabinet_invitation(p_cabinet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_etat text; v_msg text;
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

  -- [13/09/2026] PREUVE : `cabinet_members.accepted_at` porte deja le fait.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_user, 'cabinet_member:accept', 'cabinet', p_cabinet_id,
            jsonb_build_object('role', v_role));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('accept_cabinet_invitation', v_etat, v_msg, v_user, 'cabinet_member:accept', 'cabinet', p_cabinet_id,
              jsonb_build_object('role', v_role));
      RAISE WARNING 'audit_log: cabinet_member:accept non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: cabinet_member:accept non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id, 'role', v_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_cabinet(p_name text, p_legal_form text DEFAULT 'Independant'::text, p_wilaya text DEFAULT NULL::text, p_commune text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_rc_number text DEFAULT NULL::text, p_nif text DEFAULT NULL::text, p_subscription_tier text DEFAULT 'solo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_id    uuid;
  v_etat text; v_msg text;
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

  -- [13/09/2026] PREUVE : `cabinets.owner_user_id` + `created_at` portent le fait.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'cabinet:create', 'cabinet', v_id,
            jsonb_build_object('name', p_name, 'tier', p_subscription_tier));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('create_cabinet', v_etat, v_msg, v_actor, 'cabinet:create', 'cabinet', v_id,
              jsonb_build_object('name', p_name, 'tier', p_subscription_tier));
      RAISE WARNING 'audit_log: cabinet:create non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: cabinet:create non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', v_id);
END;
$function$;

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
  v_etat text; v_msg text;
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

  -- [13/09/2026] PREUVE : la ligne `video_sessions` porte deja tout le fait.
  -- Le commentaire d'origine disait « si la table audit_log existe » : elle
  -- existe, la condition est levee, et le handler ne protegeait plus de rien.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_caller, 'video_session:create', 'video_session', v_session_id,
            jsonb_build_object('appointment_id', p_appointment_id));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('create_video_session', v_etat, v_msg, v_caller, 'video_session:create', 'video_session', v_session_id,
              jsonb_build_object('appointment_id', p_appointment_id));
      RAISE WARNING 'audit_log: video_session:create non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: video_session:create non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object(
    'ok',              true,
    'session_id',      v_session_id,
    'daily_room_name', v_room_name,
    'created',         true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_cabinet_member(p_cabinet_id uuid, p_target_user_id uuid, p_role text, p_permissions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_etat text; v_msg text;
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

  -- [13/09/2026] PREUVE : `cabinet_members.invited_by_user_id` + `invited_at`
  -- portent deja l'acteur et la date. L'audit est genuinement redondant ici.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'cabinet_member:invite', 'cabinet_member', p_target_user_id,
            jsonb_build_object('cabinet_id', p_cabinet_id, 'role', p_role));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('invite_cabinet_member', v_etat, v_msg, v_actor, 'cabinet_member:invite', 'cabinet_member', p_target_user_id,
              jsonb_build_object('cabinet_id', p_cabinet_id, 'role', p_role));
      RAISE WARNING 'audit_log: cabinet_member:invite non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: cabinet_member:invite non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true, 'cabinet_id', p_cabinet_id,
                            'user_id', p_target_user_id, 'role', p_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_cabinet_member(p_cabinet_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target_role text;
  v_etat text; v_msg text;
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

  UPDATE public.cabinet_members
     SET active             = false,
         removed_by_user_id = v_actor,
         removed_at         = now(),
         removed_from_role  = v_target_role
   WHERE cabinet_id = p_cabinet_id AND user_id = p_user_id;

  -- [13/09/2026] PREUVE — et elle ne l'est QUE grace aux trois colonnes posees
  -- juste avant par 20260913_cabinet_members_tracabilite.sql. Sans elles,
  -- cette ligne etait le seul endroit ou « qui a retire » existait, et il
  -- aurait fallu la rendre CONSTITUTIVE : le palliatif au lieu du remede.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'cabinet_member:remove', 'cabinet_member', p_user_id,
            jsonb_build_object('cabinet_id', p_cabinet_id, 'previous_role', v_target_role));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('remove_cabinet_member', v_etat, v_msg, v_actor, 'cabinet_member:remove', 'cabinet_member', p_user_id,
              jsonb_build_object('cabinet_id', p_cabinet_id, 'previous_role', v_target_role));
      RAISE WARNING 'audit_log: cabinet_member:remove non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: cabinet_member:remove non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------------------------------------------------------------------
-- INCHANGEES — reproduites ici pour que ce fichier decrive les ONZE.
--   fn_audit_changes    : c'est le mecanisme d'audit lui-meme. CONSTITUTIVE
--                         par construction, INSERT nu, rien a changer.
--   disable_two_factor  : CONSTITUTIVE, INSERT deja nu. Desactiver une
--                         protection sans trace est le scenario de la prise de
--                         compte : ca doit echouer plutot que passer muet.
-- Aucun `CREATE OR REPLACE` pour elles : on ne reecrit pas ce qui est correct.
-- ---------------------------------------------------------------------

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 0. AUCUNE REGRESSION STATIQUE. Attendu : 11 lignes « aucun defaut ».
--
-- with fns as materialized (
--   select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.prokind='f'
--      and p.proname in ('accept_cabinet_invitation','create_cabinet','create_video_session',
--        'disable_two_factor','enroll_two_factor','fn_audit_changes','invite_cabinet_member',
--        'record_consent','remove_cabinet_member','set_video_recording_consent',
--        'transfer_cabinet_ownership'))
-- select f.proname, coalesce(c.level||' '||c.sqlstate||' : '||c.message,'✓ aucun defaut')
--   from fns f left join lateral (select * from plpgsql_check_function_tb(f.oid,
--     coalesce((select t.tgrelid from pg_trigger t where t.tgfoid=f.oid limit 1),0)::regclass)) c on true
--  order by (c.level is null), 1;
--
-- 1. LE REGIME EST BIEN CELUI DU TABLEAU. Attendu : 4 sans handler d'audit,
--    7 avec. (Le booleen oriente, il ne conclut pas : relire en cas de doute.)
--
-- with fns as materialized (
--   select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.prokind='f'), d as materialized (
--   select proname, pg_get_functiondef(oid) as def from fns)
-- select proname,
--        case when def ~* 'audit_log_echecs' then 'PREUVE (rebut)'
--             when def ~* 'EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s*\n?\s*NULL' then '⚠ THEN NULL RESTANT'
--             else 'CONSTITUTIVE' end as regime
--   from d where def ~* 'INSERT\s+INTO\s+(public\.)?audit_log\b' order by 2, 1;
--
--    Attendu : CONSTITUTIVE x4 (disable_two_factor, fn_audit_changes,
--    set_video_recording_consent, transfer_cabinet_ownership)
--              PREUVE (rebut) x7 — et ZERO « THEN NULL RESTANT ».
--
-- 2. UNE CONSTITUTIVE ECHOUE AVEC SA TRACE. Dans une transaction ANNULEE :
--
--    begin;
--      alter table public.audit_log add constraint tmp_casse check (false) not valid;
--      alter table public.audit_log validate constraint tmp_casse;  -- force l'echec
--      -- … se placer en patient d'une session 'scheduled' …
--      select public.set_video_recording_consent('<session>', true);  -- doit LEVER
--      select consent_patient_recording from public.video_sessions where id='<session>';
--      -- attendu : l'UPDATE est annule avec la trace
--    rollback;
--
-- 3. UNE PREUVE ABOUTIT ET LAISSE SA LIGNE AU REBUT. Meme dispositif :
--
--    begin;
--      alter table public.audit_log add constraint tmp_casse check (false) not valid;
--      alter table public.audit_log validate constraint tmp_casse;
--      select public.create_cabinet('Cabinet temoin');       -- doit rendre ok:true
--      select count(*) from public.cabinets where name='Cabinet temoin';   -- 1
--      select fonction, sqlstate, action from public.audit_log_echecs
--       where fonction='create_cabinet';                     -- 1 ligne
--      -- et un WARNING dans la sortie du client
--    rollback;
--
--    ⚠️  `cabinets`, `video_sessions`, `two_factor_secrets`, `cabinet_members` et
--    `consents_log` sont TOUTES VIDES en production (mesure du 13/09). Ces deux
--    verifications exigent donc une FIXTURE. Tant qu'elles ne sont pas faites,
--    ce fichier est ECRIT et RELU, pas EPROUVE. Il faut le dire comme ca.
--
-- 4. LE COMPTEUR ADMIN existe et pointe vers la liste :
--    `admin-dashboard.html` — « N ecritures d'audit en rebut ».
--    **Sans lui, le rebut est un tiroir**, et on aura deplace le silence au
--    lieu de le supprimer.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- Rejouer `20260913_reparation_plpgsql_check.sql`, qui porte les onze corps
-- dans leur etat du 13/09 au matin (apres la correction des 42703 / 42883,
-- avant ce fichier).
--
-- Ce que vous rouvrez en le faisant :
--   • les 7 PREUVES redeviennent muettes (`THEN NULL`) — un audit perdu ne
--     laisse plus rien, ni au rebut ni au journal ;
--   • `set_video_recording_consent` et `transfer_cabinet_ownership`
--     redeviennent capables de s'executer SANS trace ;
--   • `enroll_two_factor` redevient bloquant — une panne d'audit empeche
--     d'activer un deuxieme facteur.
