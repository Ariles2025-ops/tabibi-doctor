-- =====================================================================
-- TABIBI.DOCTOR — SEED TEST : médecin connectable pour l'app desktop
-- =====================================================================
-- Fichier : migrations/TEST_seed_medecin_desktop.sql
-- Date    : 2026-07-29 · Phase 3 (validation app Tauri)
-- Cible   : Supabase EU pudugodhiofqrctcdwfl — SQL Editor (rôle postgres)
--
-- CE QUE ÇA CRÉE (100 % isolé, AUCUNE vraie donnée touchée) :
--   • auth.users  Dr TEST   téléphone +213555000000 · mdp <MDP_TEST>
--     (valeur réelle hors repo — voir gestionnaire de mots de passe)
--   • auth.users  patient TEST +213555000001 (cible des RDV, non connectable
--     depuis l'app : mdp aléatoire non communiqué)
--   • public.users (rôles medecin/patient — le trigger signup les crée,
--     on complète noms + statut)
--   • doctor_profiles « Dr TEST Desktop » : user_id lié, claimed,
--     validation_status approved, is_active=FALSE (⇒ INVISIBLE dans la
--     recherche publique), working_hours dim→jeu (semaine algérienne)
--   • 7 appointments cette semaine (statuts variés, heure d'Alger)
--   • 1 doctor_unavailable_slots (mercredi après-midi, hachuré à l'agenda)
--
-- GARANTIES :
--   • Abandon immédiat (EXCEPTION) si le téléphone test existe déjà
--   • Aucun UPDATE/DELETE sur des lignes existantes (hors public.users
--     des 2 comptes TEST créés ici même)
--   • Rollback complet fourni en fin de fichier (commenté)
-- =====================================================================

-- ── PRÉ-VOL (lecture seule) : le téléphone test est-il libre ? ────────
SELECT id, phone, email FROM auth.users
 WHERE phone IN ('213555000000','+213555000000','213555000001','+213555000001');
-- ATTENDU : 0 ligne. Sinon → exécuter d'abord le ROLLBACK en fin de fichier.


-- ── SEED (transactionnel, verbeux) ────────────────────────────────────
DO $$
DECLARE
  v_doc_uid   uuid := gen_random_uuid();
  v_pat_uid   uuid := gen_random_uuid();
  v_doc_phone text := '213555000000';          -- GoTrue stocke SANS le « + »
  v_pat_phone text := '213555000001';
  -- valeur réelle hors repo : remplacer <MDP_TEST> avant exécution (jamais commiter le mdp)
  v_doc_pass  text := '<MDP_TEST>';
  v_profile   uuid;
  -- Lundi de la semaine courante, heure d'Alger
  v_mon       date := (date_trunc('week', (now() AT TIME ZONE 'Africa/Algiers')))::date;
BEGIN
  -- Garde : jamais deux fois
  IF EXISTS (SELECT 1 FROM auth.users WHERE phone IN (v_doc_phone, '+'||v_doc_phone, v_pat_phone, '+'||v_pat_phone)) THEN
    RAISE EXCEPTION 'Comptes TEST déjà présents — exécute la section ROLLBACK d''abord.';
  END IF;

  -- ── 1. auth.users : Dr TEST (téléphone + mot de passe) ──────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, email_confirmed_at,
    phone, phone_confirmed_at,
    encrypted_password,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_doc_uid, 'authenticated', 'authenticated',
    'medecin.test.desktop@tabibi.doctor', now(),
    v_doc_phone, now(),
    extensions.crypt(v_doc_pass, extensions.gen_salt('bf')),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    jsonb_build_object('role','medecin','first_name','Test','last_name','Desktop'),
    now(), now(),
    '', '', '', '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_doc_uid,
          jsonb_build_object('sub', v_doc_uid::text, 'phone', v_doc_phone),
          'phone', v_doc_phone, now(), now(), now());
  RAISE NOTICE '✓ Dr TEST auth.users créé : %', v_doc_uid;

  -- ── 2. auth.users : patient TEST (cible des RDV, mdp aléatoire) ─────
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, email_confirmed_at,
    phone, phone_confirmed_at, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current, phone_change, phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_pat_uid, 'authenticated', 'authenticated',
    'patient.test.desktop@tabibi.doctor', now(),
    v_pat_phone, now(), extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    jsonb_build_object('role','patient','first_name','Amine','last_name','Testeur'),
    now(), now(), '', '', '', '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_pat_uid,
          jsonb_build_object('sub', v_pat_uid::text, 'phone', v_pat_phone),
          'phone', v_pat_phone, now(), now(), now());
  RAISE NOTICE '✓ Patient TEST auth.users créé : %', v_pat_uid;

  -- ── 3. public.users : le trigger handle_new_auth_user les a créés
  --       (id, phone, email, role) — on complète noms + statut ─────────
  UPDATE public.users SET first_name='Test',  last_name='Desktop', status='active' WHERE id = v_doc_uid;
  UPDATE public.users SET first_name='Amine', last_name='Testeur', status='active' WHERE id = v_pat_uid;
  -- Filet si le trigger n'a pas tourné :
  INSERT INTO public.users (id, phone, email, role)
    SELECT v_doc_uid, v_doc_phone, 'medecin.test.desktop@tabibi.doctor', 'medecin'::user_role
    WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_doc_uid);
  INSERT INTO public.users (id, phone, email, role)
    SELECT v_pat_uid, v_pat_phone, 'patient.test.desktop@tabibi.doctor', 'patient'::user_role
    WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_pat_uid);
  RAISE NOTICE '✓ public.users complétés (medecin actif + patient)';

  -- ── 4. doctor_profiles : fiche TEST neuve, liée, INVISIBLE en public ─
  INSERT INTO public.doctor_profiles (
    user_id, full_name, specialty_fr, wilaya_fr,
    is_claimed, claimed_at, is_active, validation_status,
    working_hours
  ) VALUES (
    v_doc_uid, 'Dr TEST Desktop — NE PAS RÉSERVER', 'Médecine générale', 'Alger',
    true, now(), false, 'approved',
    '{
      "sun":[{"open":"08:00","close":"12:00"},{"open":"14:00","close":"18:00"}],
      "mon":[{"open":"08:00","close":"12:00"},{"open":"14:00","close":"18:00"}],
      "tue":[{"open":"08:00","close":"12:00"},{"open":"14:00","close":"18:00"}],
      "wed":[{"open":"08:00","close":"12:30"}],
      "thu":[{"open":"08:00","close":"12:00"},{"open":"14:00","close":"17:00"}],
      "fri":[], "sat":[]
    }'::jsonb
  ) RETURNING id INTO v_profile;
  RAISE NOTICE '✓ doctor_profiles TEST : % (is_active=false → hors recherche publique)', v_profile;

  -- ── 5. Indisponibilité (hachurée dans l''agenda) : mercredi 14h→18h ──
  INSERT INTO public.doctor_unavailable_slots (doctor_id, starts_at, ends_at, reason)
  VALUES (v_profile,
          ((v_mon + 2)::timestamp + time '14:00') AT TIME ZONE 'Africa/Algiers',
          ((v_mon + 2)::timestamp + time '18:00') AT TIME ZONE 'Africa/Algiers',
          'TEST — Congrès');
  RAISE NOTICE '✓ 1 indisponibilité (mer 14:00–18:00)';

  -- ── 6. 7 RDV cette semaine (heure d''Alger, sans chevauchement).
  --    doctor_id = v_profile : FK réelle appointments.doctor_id → doctor_profiles.id ──
  INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_minutes, reason, status)
  VALUES
    (v_pat_uid, v_profile, ((v_mon + 0)::timestamp + time '09:00') AT TIME ZONE 'Africa/Algiers', 30, 'TEST Consultation',      'confirmed'),
    (v_pat_uid, v_profile, ((v_mon + 0)::timestamp + time '10:00') AT TIME ZONE 'Africa/Algiers', 45, 'TEST Première visite',   'pending'),
    (v_pat_uid, v_profile, ((v_mon + 1)::timestamp + time '08:30') AT TIME ZONE 'Africa/Algiers', 30, 'TEST Suivi tension',     'confirmed'),
    (v_pat_uid, v_profile, ((v_mon + 1)::timestamp + time '11:00') AT TIME ZONE 'Africa/Algiers', 30, 'TEST Annulé',            'cancelled'),
    (v_pat_uid, v_profile, ((v_mon + 2)::timestamp + time '09:30') AT TIME ZONE 'Africa/Algiers', 60, 'TEST ECG',               'confirmed'),
    (v_pat_uid, v_profile, ((v_mon + 3)::timestamp + time '14:30') AT TIME ZONE 'Africa/Algiers', 30, 'TEST Certificat',        'pending'),
    (v_pat_uid, v_profile, ((v_mon + 6)::timestamp + time '10:00') AT TIME ZONE 'Africa/Algiers', 30, 'TEST Dimanche matin',    'confirmed');
  RAISE NOTICE '✓ 7 appointments TEST posés (lun, mar, mer, jeu, dim)';

  RAISE NOTICE '════ SEED OK — connexion : +213555000000 / <MDP_TEST> (valeur réelle hors repo) ════';
END $$;


-- ── VÉRIFICATION (lecture seule) ──────────────────────────────────────
SELECT u.phone, pu.role, pu.status, dp.full_name, dp.validation_status,
       dp.is_active, (dp.working_hours IS NOT NULL) AS wh_ok,
       (SELECT count(*) FROM appointments a WHERE a.doctor_id = dp.id) AS nb_rdv
  FROM auth.users u
  JOIN public.users pu ON pu.id = u.id
  LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
 WHERE u.phone = '213555000000';
-- ATTENDU : role=medecin · status=active · validation_status=approved ·
--           is_active=f · wh_ok=t · nb_rdv=7


-- =====================================================================
-- ROLLBACK COMPLET (commenté — décommenter pour purger les comptes TEST)
-- Ciblé exclusivement par les téléphones TEST. RIEN d'autre.
-- =====================================================================
-- DO $$
-- DECLARE v_ids uuid[];
-- BEGIN
--   SELECT array_agg(id) INTO v_ids FROM auth.users
--    WHERE phone IN ('213555000000','+213555000000','213555000001','+213555000001');
--   IF v_ids IS NULL THEN RAISE NOTICE 'Rien à purger.'; RETURN; END IF;
--   DELETE FROM public.appointments              WHERE doctor_id = ANY(v_ids) OR patient_id = ANY(v_ids);
--   DELETE FROM public.doctor_unavailable_slots  WHERE doctor_id IN (SELECT id FROM doctor_profiles WHERE user_id = ANY(v_ids));
--   DELETE FROM public.doctor_profiles           WHERE user_id = ANY(v_ids);
--   DELETE FROM public.users                     WHERE id = ANY(v_ids);
--   DELETE FROM auth.identities                  WHERE user_id = ANY(v_ids);
--   DELETE FROM auth.users                       WHERE id = ANY(v_ids);
--   RAISE NOTICE 'Comptes TEST purgés (%).', array_length(v_ids, 1);
-- END $$;
