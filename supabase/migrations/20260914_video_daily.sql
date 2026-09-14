-- =====================================================================
-- 20260914_video_daily.sql — la salle n'a plus d'URL inventee
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- ---------------------------------------------------------------------
-- LE DEFAUT : UNE URL QUI A L'AIR VRAIE
-- ---------------------------------------------------------------------
-- `public.create_video_session(uuid)` ecrit aujourd'hui, a la creation :
--
--     'https://placeholder.daily.co/' || v_room_name
--
-- Ce n'est pas un repli, c'est **une valeur fabriquee qui a la forme de la
-- vraie**. Elle est ensuite rendue telle quelle par `get_video_session` sous
-- le nom `daily_room_url`. N'importe quel lecteur — code ou humain — la prend
-- pour l'adresse de la salle.
--
-- C'est exactement la famille de defauts de la semaine : le « 500+ » de la
-- liste d'attente, le « e-mail envoye » du mot de passe oublie. **Un ecran, ou
-- une ligne de base, ne presente jamais comme mesuree une valeur qu'il n'a
-- pas mesuree.**
--
-- Elle ecrit donc **NULL**. `NULL` se lit « je ne sais pas encore », et c'est
-- la verite : l'URL n'existe qu'apres que l'edge function `create-video-room`
-- a cree la salle chez le fournisseur.
--
-- ---------------------------------------------------------------------
-- CE QUE CA NE CASSE PAS — verifie avant d'ecrire
-- ---------------------------------------------------------------------
-- `teleconsultation.html` ne rejoint PAS la salle avec `daily_room_url` : il
-- appelle `create-video-room` et utilise `roomInfo.room_url` (ligne 588).
-- `daily_room_url` n'est lu nulle part pour se connecter. Passer de
-- « remplacant » a NULL ne retire donc rien a personne — ca retire seulement
-- une affirmation fausse.
--
-- ⚠️  Si un ecran futur veut afficher l'URL, il devra gerer le NULL. C'est le
-- but : **on ne peut pas ignorer un NULL par distraction, on peut ignorer un
-- remplacant plausible pendant des mois.**
--
-- ---------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE FAIT PAS
-- ---------------------------------------------------------------------
-- Elle ne touche a aucune politique, aucun GRANT, aucune autre fonction.
--
-- A NOTER, sans y toucher : `public.video_sessions` n'accorde **aucun**
-- privilege a `anon` ni a `authenticated`. Sa politique
-- `video_sessions_select_participants` est donc **inatteignable** — la RLS ne
-- s'evalue qu'apres le controle de privilege. Tout passe par les RPC
-- `SECURITY DEFINER`, ce qui est le bon dispositif ; mais la politique, elle,
-- laisse croire qu'elle protege. C'est le troisieme cas apres `audit_log` et
-- `prescriptions`. **A traiter dans un lot qui parle de ca**, pas ici.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================
-- Reprise mot pour mot de la definition du 14/09, avec UNE seule difference,
-- signalee en place. Tout le reste — gardes, idempotence, journal d'audit et
-- son rebut — est inchange.

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
  IF v_appointment.status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'error', 'appointment_not_confirmed',
      'current_status', v_appointment.status
    );
  END IF;
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
  v_room_name := 'tabibi-rdv-' || replace(p_appointment_id::text, '-', '');
  v_room_name := substring(v_room_name from 1 for 64);
  INSERT INTO public.video_sessions (
    appointment_id, daily_room_name, daily_room_url,
    scheduled_at, status
  )
  VALUES (
    p_appointment_id, v_room_name,
    -- ⚠️ SEULE DIFFERENCE AVEC LA VERSION DU 14/09 :
    --    avant : 'https://placeholder.daily.co/' || v_room_name
    --    apres : NULL
    -- L'URL de salle n'existe qu'apres que `create-video-room` l'a creee chez
    -- le fournisseur. Avant, on ne sait pas — et NULL le dit.
    NULL,
    v_appointment.scheduled_at, 'scheduled'
  )
  RETURNING id INTO v_session_id;
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

COMMENT ON FUNCTION public.create_video_session(uuid) IS
  'Cree (ou retrouve) la session video d''un rendez-vous confirme. C''est ELLE qui autorise : patient, medecin ou admin, rendez-vous « confirmed ». Idempotente — une session par rendez-vous. Elle ne connait PAS le fournisseur video : depuis le 14/09/2026, elle laisse `daily_room_url` a NULL, et c''est l''edge function create-video-room qui pose l''URL reelle et les jetons en service_role. Avant, elle ecrivait « https://placeholder.daily.co/… » : une valeur fabriquee qui avait la forme de la vraie.';

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. Plus aucune URL fabriquee ne sera ecrite.
--
-- select prosrc like '%placeholder.daily.co%' as reste_un_remplacant
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'create_video_session';
--   Attendu : false
--
-- 2. Les lignes DEJA ecrites gardent leur remplacant — il y en a 0 aujourd'hui.
--
-- select count(*) from public.video_sessions where daily_room_url like 'https://placeholder.daily.co/%';
--   Attendu : 0 (mesure du 14/09 : la table est vide)
--   ⚠️ Si ce nombre n'est PAS zero, ne pas le corriger a l'aveugle : ces
--   lignes ont un rendez-vous derriere. Les traiter une par une.
--
-- 3. plpgsql_check sur la fonction, comme pour les autres — elle a ete
--    reecrite, et `CREATE OR REPLACE` ne valide rien de son corps.
--
-- select * from plpgsql_check_function('public.create_video_session(uuid)');
--   Attendu : aucune ligne.
--
-- 4. LA VERIFICATION QUI COMPTE, et elle n'est pas en SQL : un vrai appel,
--    avec la cle Daily posee, entre deux navigateurs. Tant qu'il n'a pas eu
--    lieu, le drapeau `video` reste ferme.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- Rejouer la definition du 14/09 en remplacant le `NULL` signale ci-dessus par
--   'https://placeholder.daily.co/' || v_room_name
-- Elle est conservee mot pour mot dans `20260913_regime_audit_log.sql:586`.
--
-- ⚠️ **Mais ne le fais pas pour « reparer ».** Si une URL manque, la reponse
-- est que la salle n'a pas ete creee — pas qu'il faut reecrire un remplacant.
