-- =====================================================================
-- TABIBI.DOCTOR — PHASE 5.1bis : RPC get_available_slots + fixture
-- =====================================================================
-- Fichier : migrations/PHASE5_1bis_get_available_slots_rpc.sql
-- Date    : 2026-05-22
-- Phase   : 5.1bis (système RDV — RPC adaptée au schema OLD réel)
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- Pré-requis :
--   ✅ migrations/PHASE5_1bis_alter_appointments.sql exécutée
--      (appointments.starts_at + ends_at GENERATED, 5 policies propres)
--   ✅ doctor_profiles.working_hours JSONB existe (Phase 4)
--   ✅ doctor_unavailable_slots table existe (Phase 4.A v2)
--   ✅ enum appointment_status existe (valeurs : pending, confirmed,
--      completed, cancelled, no_show)
--
-- Format working_hours consommé (existant Phase 4.B.1) :
--   {"mon":[{"open":"HH:MM","close":"HH:MM"}], ..., "sun":[]}
--
-- 🌍 TIMEZONE : Africa/Algiers (UTC+1, pas de DST).
-- =====================================================================



-- =====================================================================
-- SECTION 1 : RPC get_available_slots
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id          UUID,
  p_date               DATE,
  p_slot_duration_min  INT DEFAULT 30
)
RETURNS TABLE (
  slot_start  TIMESTAMPTZ,
  slot_end    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_dz     TIMESTAMPTZ := NOW();
  v_today_dz   DATE        := (v_now_dz AT TIME ZONE 'Africa/Algiers')::DATE;
  v_dow        INT;
  v_day_key    TEXT;
  v_working    JSONB;
  v_day_slots  JSONB;
  v_slot       JSONB;
  v_open       TIME;
  v_close      TIME;
  v_cursor     TIMESTAMPTZ;
  v_end_cursor TIMESTAMPTZ;
  v_close_tz   TIMESTAMPTZ;
BEGIN
  -- ─── Garde-fous ─────────────────────────────────────────────────────
  IF p_slot_duration_min IS NULL OR p_slot_duration_min < 5 OR p_slot_duration_min > 240 THEN
    RAISE EXCEPTION 'invalid_slot_duration' USING ERRCODE = '22023';
  END IF;
  IF p_doctor_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;

  -- [Phase 5.1bis] Guard "médecin doit être claimed" — anti-énumération anonyme
  IF NOT EXISTS (
    SELECT 1 FROM public.doctor_profiles
     WHERE id = p_doctor_id AND is_claimed = true
  ) THEN
    RETURN;
  END IF;

  -- Date dans le passé OU > J+90 → vide silencieux
  IF p_date < v_today_dz THEN RETURN; END IF;
  IF p_date > v_today_dz + INTERVAL '90 days' THEN RETURN; END IF;

  -- ─── Récupère working_hours du médecin ──────────────────────────────
  SELECT working_hours INTO v_working
    FROM public.doctor_profiles
   WHERE id = p_doctor_id;
  IF v_working IS NULL OR jsonb_typeof(v_working) <> 'object' THEN
    RETURN;
  END IF;

  -- ─── Map DOW Postgres → clé JSONB ──────────────────────────────────
  -- EXTRACT(DOW) : 0=dimanche, 1=lundi, ..., 6=samedi
  v_dow := EXTRACT(DOW FROM p_date)::INT;
  v_day_key := CASE v_dow
    WHEN 0 THEN 'sun'
    WHEN 1 THEN 'mon'
    WHEN 2 THEN 'tue'
    WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu'
    WHEN 5 THEN 'fri'
    WHEN 6 THEN 'sat'
  END;
  v_day_slots := v_working -> v_day_key;
  IF v_day_slots IS NULL
     OR jsonb_typeof(v_day_slots) <> 'array'
     OR jsonb_array_length(v_day_slots) = 0 THEN
    RETURN;
  END IF;

  -- ─── Blocage all_day couvrant p_date → vide ─────────────────────────
  IF EXISTS (
    SELECT 1
      FROM public.doctor_unavailable_slots dus
     WHERE dus.doctor_id = p_doctor_id
       AND dus.all_day = true
       AND p_date BETWEEN (dus.starts_at AT TIME ZONE 'Africa/Algiers')::DATE
                      AND (dus.ends_at   AT TIME ZONE 'Africa/Algiers')::DATE
  ) THEN
    RETURN;
  END IF;

  -- ─── Boucle sur les plages du jour (matin / pause / après-midi) ─────
  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_day_slots) LOOP
    BEGIN
      v_open  := (v_slot ->> 'open')::TIME;
      v_close := (v_slot ->> 'close')::TIME;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
    IF v_open IS NULL OR v_close IS NULL OR v_close <= v_open THEN
      CONTINUE;
    END IF;

    v_cursor   := (p_date + v_open)  AT TIME ZONE 'Africa/Algiers';
    v_close_tz := (p_date + v_close) AT TIME ZONE 'Africa/Algiers';

    WHILE v_cursor + make_interval(mins => p_slot_duration_min) <= v_close_tz LOOP
      v_end_cursor := v_cursor + make_interval(mins => p_slot_duration_min);

      -- Skip si le créneau est dans le passé (cas p_date = today)
      IF p_date = v_today_dz AND v_cursor <= v_now_dz THEN
        v_cursor := v_end_cursor;
        CONTINUE;
      END IF;

      -- Skip si overlap avec un blocage TIMED (all_day=false)
      IF EXISTS (
        SELECT 1 FROM public.doctor_unavailable_slots dus
         WHERE dus.doctor_id = p_doctor_id
           AND dus.all_day = false
           AND tstzrange(dus.starts_at, dus.ends_at, '[)') &&
               tstzrange(v_cursor, v_end_cursor, '[)')
      ) THEN
        v_cursor := v_end_cursor;
        CONTINUE;
      END IF;

      -- Skip si overlap avec un RDV existant (pending OU confirmed)
      -- starts_at/ends_at sont les colonnes GENERATED ajoutées en 5.1bis.
      -- Le cast :: appointment_status évite les comparaisons enum/text
      -- ambiguës et garantit l'usage de l'index partiel.
      IF EXISTS (
        SELECT 1 FROM public.appointments a
         WHERE a.doctor_id = p_doctor_id
           AND a.status IN ('pending'::appointment_status,
                            'confirmed'::appointment_status)
           AND tstzrange(a.starts_at, a.ends_at, '[)') &&
               tstzrange(v_cursor, v_end_cursor, '[)')
      ) THEN
        v_cursor := v_end_cursor;
        CONTINUE;
      END IF;

      -- Slot libre → on l'émet
      slot_start := v_cursor;
      slot_end   := v_end_cursor;
      RETURN NEXT;

      v_cursor := v_end_cursor;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- Permissions : anon (UX patient avant signup) + authenticated
REVOKE ALL    ON FUNCTION public.get_available_slots(UUID, DATE, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_available_slots(UUID, DATE, INT) IS
  'Phase 5.1bis. Retourne les slots libres (durée p_slot_duration_min) pour p_doctor_id le p_date, calcul en TZ Africa/Algiers. Utilise les colonnes appointments.starts_at/ends_at GENERATED depuis scheduled_at+duration_minutes. Filtre : working_hours, blocages all_day, blocages timed, RDV pending/confirmed (enum appointment_status), créneaux passés. Garde-fous : médecin doit être is_claimed=true (anti-énumération), date passée→vide, date>J+90→vide, slot_duration hors [5,240]→exception. Accessible à anon.';



-- =====================================================================
-- SECTION 2 : FIXTURE working_hours pour medecin.test
-- =====================================================================
-- Pattern cabinet Alger : dim-mer pleins avec pause midi, jeu demi-journée,
-- ven-sam fermés (weekend officiel Algérie).
-- Idempotent : UPDATE écrase, peut être relancé.

DO $$
DECLARE
  v_doctor_id UUID := '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
  v_hours JSONB := jsonb_build_object(
    'sun', jsonb_build_array(
      jsonb_build_object('open','09:00','close','13:00'),
      jsonb_build_object('open','14:00','close','18:00')
    ),
    'mon', jsonb_build_array(
      jsonb_build_object('open','09:00','close','13:00'),
      jsonb_build_object('open','14:00','close','18:00')
    ),
    'tue', jsonb_build_array(
      jsonb_build_object('open','09:00','close','13:00'),
      jsonb_build_object('open','14:00','close','18:00')
    ),
    'wed', jsonb_build_array(
      jsonb_build_object('open','09:00','close','13:00'),
      jsonb_build_object('open','14:00','close','18:00')
    ),
    'thu', jsonb_build_array(
      jsonb_build_object('open','09:00','close','13:00')
    ),
    'fri', jsonb_build_array(),
    'sat', jsonb_build_array()
  );
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles WHERE id = v_doctor_id) THEN
    RAISE EXCEPTION 'Fiche % introuvable (lancer d''abord PHASE4B_seed_claim_test_doctor.sql)', v_doctor_id;
  END IF;
  UPDATE public.doctor_profiles
     SET working_hours = v_hours,
         updated_at    = NOW()
   WHERE id = v_doctor_id;
  RAISE NOTICE '✅ working_hours seedée pour medecin.test (dim-mer 9-13+14-18, jeu 9-13, ven-sam fermé)';
END $$;



-- =====================================================================
-- SECTION 3 : VÉRIFICATIONS POST-DEPLOY
-- =====================================================================

-- 3.1 La RPC existe avec la bonne signature
SELECT proname,
       pg_get_function_identity_arguments(oid) AS args,
       pg_get_function_result(oid)             AS returns,
       CASE WHEN prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security
  FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='get_available_slots';
-- ATTENDU : 1 ligne, args="p_doctor_id uuid, p_date date, p_slot_duration_min integer"

-- 3.2 Permissions GRANT
SELECT grantee, privilege_type FROM information_schema.routine_privileges
 WHERE specific_schema='public' AND routine_name='get_available_slots'
 ORDER BY grantee;
-- ATTENDU : ≥ 2 lignes : authenticated EXECUTE, anon EXECUTE

-- 3.3 Fixture working_hours posée
SELECT id, jsonb_object_keys(working_hours) AS day_key
  FROM public.doctor_profiles
 WHERE id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'
 ORDER BY day_key;
-- ATTENDU : 7 lignes (mon, tue, wed, thu, fri, sat, sun)

-- 3.4 Test fumant : appel RPC sur prochain dimanche
-- Décommenter après 3.1-3.3 OK :
/*
WITH next_sunday AS (
  SELECT (CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7 + 7) % 7)::DATE AS d
)
SELECT slot_start, slot_end
  FROM next_sunday, public.get_available_slots(
    '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid, next_sunday.d, 30
  )
 ORDER BY slot_start;
-- ATTENDU : ~16 slots (matin 8 + après-midi 8)
*/



-- =====================================================================
-- SECTION 4 : ROLLBACK (commenté)
-- =====================================================================

/*
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, DATE, INT);
-- Rollback fixture (remet à NULL) :
-- UPDATE public.doctor_profiles SET working_hours = NULL
--  WHERE id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
*/

-- =====================================================================
-- FIN PHASE 5.1bis — RPC + fixture
-- =====================================================================
