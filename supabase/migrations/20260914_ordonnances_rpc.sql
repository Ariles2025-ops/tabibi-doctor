-- =====================================================================
-- 20260914_ordonnances_rpc.sql — LES QUATRE RPC D'ORDONNANCE
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
--
-- Deux paires d'yeux, comme le regime d'audit : le stratege relit chaque point
-- metier, PUIS applique par MCP. Rien ici n'a touche la base.
--
-- Conception, mesures et questions ouvertes : supabase/mesures/DESIGN_ordonnances.md
-- Le lire AVANT ce fichier — il contient trois constats qui changent ce qu'on
-- peut promettre :
--   • la RLS de `prescriptions` s'annule elle-meme (6 politiques PERMISSIVE, les
--     `rx_*` laxistes effacent les `presc_*` strictes) ;
--   • AUCUNE RPC ne peut poser `status='signed'` : le CHECK exige trois champs de
--     PDF, et `generate-prescription-pdf` N'EST PAS DEPLOYEE ;
--   • `presc_cancelled_has_reason` ne verifie que `cancelled_at`, pas le motif.
--
-- LE DRAPEAU `prescriptions: false` N'EST PAS TOUCHE. Il ne s'ouvre qu'apres
-- application + plpgsql_check a 0 defaut + un e2e du parcours.
--
-- ---------------------------------------------------------------------
-- CE QUI CADRE LES SIGNATURES
-- ---------------------------------------------------------------------
-- Le front n'est PAS modifie dans ce lot : c'est lui qui fixe les noms et les
-- types des parametres. En particulier `create_prescription_draft` doit rendre
-- un **uuid nu** — `medecin-ordonnance.html:533` fait
-- `currentPrescriptionId = data`. Rendre un objet casserait la page.
--
-- Et les quatre LEVENT sur refus (`RAISE EXCEPTION`), parce que les trois sites
-- appelants font `if (error) throw`. Une RPC qui rendrait `{error:…}` sans lever
-- serait lue comme un succes — c'est la classe de defauts du 13/09.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. create_prescription_draft — le medecin cree son brouillon
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_prescription_draft(
  p_patient_id     uuid,
  p_appointment_id uuid    DEFAULT NULL,
  p_medications    jsonb   DEFAULT '[]'::jsonb,
  p_diagnosis      text    DEFAULT NULL,
  p_clinical_notes text    DEFAULT NULL,
  p_validity_days  integer DEFAULT 30
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor   uuid := auth.uid();
  v_role    text;
  v_id      uuid;
  v_cabinet uuid;
  v_n       int;
  v_etat text; v_msg text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('medecin', 'doctor') THEN
    RAISE EXCEPTION 'not_a_doctor' USING ERRCODE = '42501';
  END IF;

  -- Un medecin ne se prescrit pas a lui-meme : c'est aussi ce que dit la
  -- politique `presc_insert_doctor` — sauf qu'elle est annulee par `rx_*`.
  -- La regle vit donc ICI, ou elle s'applique vraiment.
  IF p_patient_id IS NULL OR p_patient_id = v_actor THEN
    RAISE EXCEPTION 'invalid_patient' USING ERRCODE = 'P0001';
  END IF;

  -- Le rendez-vous est OPTIONNEL (le front envoie null quand il n'y en a pas).
  -- Mais s'il est fourni, il doit etre celui de CE medecin ET de CE patient :
  -- sans ce controle, on rattacherait son ordonnance au RDV d'un confrere.
  IF p_appointment_id IS NOT NULL THEN
    SELECT a.cabinet_id INTO v_cabinet
      FROM public.appointments a
     WHERE a.id = p_appointment_id
       AND a.doctor_id  = v_actor
       AND a.patient_id = p_patient_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_mismatch' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public._presc_valider_medicaments(p_medications);

  IF p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'invalid_validity' USING ERRCODE = 'P0001';
  END IF;

  -- `expiry_date` est pose par le declencheur trg_prescriptions_set_expiry,
  -- `updated_at` par trg_prescriptions_updated_at : on ne les ecrit pas ici.
  INSERT INTO public.prescriptions (
    appointment_id, doctor_id, patient_id, prescription_number,
    validity_days, medications, diagnosis, clinical_notes, status, cabinet_id
  ) VALUES (
    p_appointment_id, v_actor, p_patient_id, public.next_prescription_number(),
    p_validity_days, p_medications, NULLIF(btrim(p_diagnosis), ''),
    NULLIF(btrim(p_clinical_notes), ''), 'draft', v_cabinet
  )
  RETURNING id INTO v_id;

  -- PREUVE. `after_data` ne porte NI medications, NI diagnosis, NI notes :
  -- ce sont des donnees de sante, et audit_log est lisible par les admins.
  -- Une trace n'a pas besoin du contenu du soin pour etre une trace.
  SELECT jsonb_array_length(p_medications) INTO v_n;
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'prescription:create', 'prescription', v_id,
            jsonb_build_object('patient_id', p_patient_id, 'nb_medicaments', v_n,
                               'validity_days', p_validity_days));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('create_prescription_draft', v_etat, v_msg, v_actor, 'prescription:create', 'prescription', v_id,
              jsonb_build_object('patient_id', p_patient_id, 'nb_medicaments', v_n));
      RAISE WARNING 'audit_log: prescription:create non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: prescription:create non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN v_id;   -- uuid NU : le front fait `currentPrescriptionId = data`
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. update_prescription_draft — modifier, tant que c'est un brouillon
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_prescription_draft(
  p_prescription_id uuid,
  p_medications     jsonb   DEFAULT '[]'::jsonb,
  p_diagnosis       text    DEFAULT NULL,
  p_clinical_notes  text    DEFAULT NULL,
  p_validity_days   integer DEFAULT 30
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor  uuid := auth.uid();
  v_statut text;
  v_n      int;
  v_etat text; v_msg text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- MEME CODE pour « introuvable » et « pas a vous », et c'est volontaire :
  -- les distinguer dirait a un medecin qu'une ordonnance existe chez un confrere.
  SELECT p.status INTO v_statut
    FROM public.prescriptions p
   WHERE p.id = p_prescription_id AND p.doctor_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_owner' USING ERRCODE = '42501';
  END IF;

  IF v_statut <> 'draft' THEN
    RAISE EXCEPTION 'not_a_draft' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._presc_valider_medicaments(p_medications);

  IF p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'invalid_validity' USING ERRCODE = 'P0001';
  END IF;

  -- Ne touche JAMAIS : prescription_number, doctor_id, patient_id, status,
  -- ni aucun champ de PDF. Une modification de brouillon reste une modification
  -- de contenu.
  UPDATE public.prescriptions p
     SET medications    = p_medications,
         diagnosis      = NULLIF(btrim(p_diagnosis), ''),
         clinical_notes = NULLIF(btrim(p_clinical_notes), ''),
         validity_days  = p_validity_days
   WHERE p.id = p_prescription_id;

  SELECT jsonb_array_length(p_medications) INTO v_n;
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'prescription:update', 'prescription', p_prescription_id,
            jsonb_build_object('nb_medicaments', v_n, 'validity_days', p_validity_days));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('update_prescription_draft', v_etat, v_msg, v_actor, 'prescription:update', 'prescription', p_prescription_id,
              jsonb_build_object('nb_medicaments', v_n));
      RAISE WARNING 'audit_log: prescription:update non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: prescription:update non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. request_prescription_signature — UN VERROU, PAS UNE TRANSITION
-- ---------------------------------------------------------------------
-- ⚠️  ELLE NE CHANGE AUCUN STATUT, et ce n'est pas un oubli.
--
--   CHECK presc_signed_has_pdf : status='signed' EXIGE pdf_sha256,
--   doctor_signature_hmac ET pdf_storage_path. Ces trois champs ne peuvent
--   venir que du PDF, et `generate-prescription-pdf` N'EST PAS DEPLOYEE
--   (mesure du 14/09 : 4 edge functions, aucune des deux du flux ordonnance).
--
-- Cette fonction VALIDE que l'ordonnance est signable et refuse sinon. Le
-- passage a `signed` appartiendra a l'edge function, sous service_role.
-- Poser `status='signed'` ici serait impossible (le CHECK le refuse) — et si on
-- contournait le CHECK, on fabriquerait une ordonnance « signee » sans PDF ni
-- signature. C'est-a-dire un document qui ment.
CREATE OR REPLACE FUNCTION public.request_prescription_signature(p_prescription_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_p     record;
  v_etat text; v_msg text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT p.status, p.medications, p.expiry_date INTO v_p
    FROM public.prescriptions p
   WHERE p.id = p_prescription_id AND p.doctor_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_owner' USING ERRCODE = '42501';
  END IF;

  IF v_p.status = 'signed' THEN
    RAISE EXCEPTION 'already_signed' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.status <> 'draft' THEN
    RAISE EXCEPTION 'not_signable' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._presc_valider_medicaments(v_p.medications);

  IF v_p.expiry_date IS NOT NULL AND v_p.expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'already_expired' USING ERRCODE = 'P0001';
  END IF;

  -- La trace dit que la signature a ete DEMANDEE. Si l'edge echoue ensuite,
  -- l'ecart entre la demande et l'absence de signature est lisible.
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'prescription:sign_request', 'prescription', p_prescription_id,
            jsonb_build_object('statut_avant', v_p.status));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('request_prescription_signature', v_etat, v_msg, v_actor, 'prescription:sign_request', 'prescription', p_prescription_id,
              jsonb_build_object('statut_avant', v_p.status));
      RAISE WARNING 'audit_log: prescription:sign_request non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: prescription:sign_request non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. mark_prescription_delivered — tracer la remise, sans mentir
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_prescription_delivered(
  p_prescription_id uuid,
  p_channel         text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor  uuid := auth.uid();
  v_statut text;
  v_etat text; v_msg text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Le PATIENT ou son medecin. Le front appelle depuis l'espace patient.
  SELECT p.status INTO v_statut
    FROM public.prescriptions p
   WHERE p.id = p_prescription_id
     AND (p.patient_id = v_actor OR p.doctor_id = v_actor);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_allowed' USING ERRCODE = '42501';
  END IF;

  -- Une ordonnance non signee n'est pas remise : elle n'existe pas comme
  -- document. `delivered` est admis pour l'idempotence (voir plus bas).
  IF v_statut NOT IN ('signed', 'delivered') THEN
    RAISE EXCEPTION 'not_delivered_state' USING ERRCODE = 'P0001';
  END IF;

  -- Liste FERMEE. `email` et `print` sont admis d'avance bien que le front
  -- n'envoie que `download` et `whatsapp` : la colonne existe pour ca, et une
  -- liste trop etroite obligerait a une migration pour un bouton. Toute autre
  -- valeur est refusee — on n'accepte pas une chaine libre dans une colonne qui
  -- sert de trace.
  IF p_channel IS NULL OR p_channel NOT IN ('download', 'whatsapp', 'email', 'print') THEN
    RAISE EXCEPTION 'invalid_channel' USING ERRCODE = 'P0001';
  END IF;

  -- IDEMPOTENTE, et c'est voulu : le front l'appelle a CHAQUE telechargement.
  -- `delivered_at` garde la PREMIERE remise ; `delivery_channels` accumule.
  UPDATE public.prescriptions p
     SET status            = 'delivered',
         delivered_at      = COALESCE(p.delivered_at, now()),
         delivery_channels = CASE
                               WHEN p_channel = ANY(p.delivery_channels) THEN p.delivery_channels
                               ELSE array_append(p.delivery_channels, p_channel)
                             END
   WHERE p.id = p_prescription_id;

  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'prescription:deliver', 'prescription', p_prescription_id,
            jsonb_build_object('canal', p_channel, 'statut_avant', v_statut));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('mark_prescription_delivered', v_etat, v_msg, v_actor, 'prescription:deliver', 'prescription', p_prescription_id,
              jsonb_build_object('canal', p_channel));
      RAISE WARNING 'audit_log: prescription:deliver non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: prescription:deliver non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. L'AIDE PARTAGEE — une seule definition de « medicaments valides »
-- ---------------------------------------------------------------------
-- Ecrite en DERNIER dans le fichier mais A CREER EN PREMIER a l'application :
-- les trois fonctions ci-dessus l'appellent. plpgsql ne resout les appels qu'a
-- l'execution, donc l'ordre de creation ne bloque pas — mais `plpgsql_check`
-- signalerait `42883` si elle manquait. **A creer avant de lancer le reste.**
--
-- Trois fonctions valident les memes medicaments. Trois copies auraient diverge
-- au premier changement de regle.
CREATE OR REPLACE FUNCTION public._presc_valider_medicaments(p_medications jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_m jsonb;
BEGIN
  IF p_medications IS NULL
     OR jsonb_typeof(p_medications) <> 'array'
     OR jsonb_array_length(p_medications) = 0
     OR jsonb_array_length(p_medications) > 30   -- le front plafonne a 30
  THEN
    RAISE EXCEPTION 'invalid_medications' USING ERRCODE = 'P0001';
  END IF;

  FOR v_m IN SELECT * FROM jsonb_array_elements(p_medications) LOOP
    IF jsonb_typeof(v_m) <> 'object'
       OR v_m->>'name' IS NULL
       OR btrim(v_m->>'name') = ''
       OR length(v_m->>'name') > 200              -- maxlength du champ
    THEN
      RAISE EXCEPTION 'invalid_medication_name' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. LES DROITS
-- ---------------------------------------------------------------------
-- `anon` n'a rien a faire ici : une ordonnance suppose une session.
-- L'aide de validation n'est appelable que par les trois RPC, pas depuis le web.
REVOKE EXECUTE ON FUNCTION public._presc_valider_medicaments(jsonb) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_prescription_draft(uuid, uuid, jsonb, text, text, integer)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_prescription_draft(uuid, jsonb, text, text, integer)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_prescription_signature(uuid)                                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_prescription_delivered(uuid, text)                             FROM PUBLIC, anon;

GRANT  EXECUTE ON FUNCTION public.create_prescription_draft(uuid, uuid, jsonb, text, text, integer)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.update_prescription_draft(uuid, jsonb, text, text, integer)         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.request_prescription_signature(uuid)                                TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_prescription_delivered(uuid, text)                             TO authenticated;

-- =====================================================================
-- VERIFICATION — a lancer APRES application, dans un passage separe
-- =====================================================================
-- 0. STATIQUE. Attendu : 5 lignes « aucun defaut ».
--    ⚠️  C'est ici qu'on verra si `_presc_valider_medicaments` a bien ete creee
--    avant les trois qui l'appellent : sinon `42883 function does not exist`.
--
-- with f as materialized (
--   select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.prokind='f'
--      and p.proname in ('create_prescription_draft','update_prescription_draft',
--        'request_prescription_signature','mark_prescription_delivered',
--        '_presc_valider_medicaments'))
-- select f.proname, coalesce(c.level||' '||c.sqlstate||' : '||c.message,'✓ aucun defaut')
--   from f left join lateral (select * from plpgsql_check_function_tb(f.oid)) c on true
--  order by (c.level is null), 1;
--
-- 1. LES DROITS. Attendu : anon=false partout ; authenticated=true sur les
--    quatre, et **false** sur `_presc_valider_medicaments`.
--
-- select p.proname,
--        has_function_privilege('anon',          p.oid,'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid,'EXECUTE') as auth
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname like '%prescription%' or p.proname = '_presc_valider_medicaments'
--  order by 1;
--
-- 2. LE CYCLE, dans une transaction ANNULEE. `public.prescriptions` est VIDE :
--    il faut une fixture (un medecin, un patient, une session). Tant que ce
--    passage n'est pas fait, ces fonctions sont ECRITES et RELUES, pas EPROUVEES.
--
--    begin;
--      -- … se placer en medecin …
--      select public.create_prescription_draft('<patient>', null,
--               '[{"name":"Doliprane 1000mg","dosage":"1cp","frequency":"3/j","duration":"5j","notes":null}]'::jsonb,
--               'Angine', null, 30);                          -- attendu : un uuid
--      select status, prescription_number, expiry_date, medications
--        from public.prescriptions where id = '<id>';         -- draft, RX-2026-…, +30j
--      select public.update_prescription_draft('<id>', '[]'::jsonb, null, null, 30);
--                                                             -- attendu : invalid_medications
--      select public.request_prescription_signature('<id>');  -- attendu : OK, statut INCHANGE
--      select status from public.prescriptions where id='<id>';  -- toujours 'draft'
--      select public.mark_prescription_delivered('<id>','download');
--                                                             -- attendu : not_delivered_state
--    rollback;
--
-- 3. LES REFUS QUI COMPTENT, meme dispositif :
--      • un medecin A modifie le brouillon d'un medecin B -> not_found_or_not_owner
--      • un medecin se prescrit a lui-meme                -> invalid_patient
--      • p_appointment_id d'un confrere                   -> appointment_mismatch
--      • p_channel = 'pigeon'                             -> invalid_channel
--      • 31 medicaments                                   -> invalid_medications
--
-- 4. LA REFERENCE : `npm run verifier:rpc -- --base --ecrire` (Aghiles), puis
--    retirer les quatre de ABSENCES_CONNUES et de
--    docs/FICHE_R3_APPELS_DANS_LE_VIDE.md. **La liste passera de 4 a 0.**
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.create_prescription_draft(uuid, uuid, jsonb, text, text, integer);
-- DROP FUNCTION IF EXISTS public.update_prescription_draft(uuid, jsonb, text, text, integer);
-- DROP FUNCTION IF EXISTS public.request_prescription_signature(uuid);
-- DROP FUNCTION IF EXISTS public.mark_prescription_delivered(uuid, text);
-- DROP FUNCTION IF EXISTS public._presc_valider_medicaments(jsonb);
--
-- Sans danger tant que `prescriptions: false` : le front ne les appelle pas.
-- Une fois le drapeau ouvert, les retirer rouvrirait les quatre appels dans le
-- vide — exactement ce que `verifier:rpc` existe pour attraper.
--
-- =====================================================================
-- CE QUI RESTE BLOQUE APRES CE FICHIER, ET QU'IL NE FAUT PAS OUBLIER
-- =====================================================================
-- 1. `generate-prescription-pdf` et `verify-prescription` NE SONT PAS DEPLOYEES.
--    Sans la premiere, aucune ordonnance ne peut passer a `signed`. Sans la
--    seconde, `verify-prescription.html` ne verifie rien.
-- 2. Les politiques `rx_insert_doctor` et `rx_update_doctor` ANNULENT les
--    `presc_*` strictes (6 politiques PERMISSIVE, combinees en OU). Tant
--    qu'elles sont la, ces RPC sont une porte bien gardee A COTE d'une porte
--    ouverte. A trancher AVANT d'ouvrir le drapeau.
-- 3. Le drapeau `prescriptions: false` reste ferme.
