-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 16.5 — Fix trigger handle_new_auth_user + backfill broken signups
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-05-26
--
-- PROBLEM : trigger hardcodes role='patient' for ALL signups, ignoring
--           raw_user_meta_data->>'role' sent by the frontend.
--           Doctors who signed up via signup.html landed in public.users
--           with role='patient' instead of 'medecin'.
--
-- CHANGES :
--   1. Redefine handle_new_auth_user() — read role from raw_user_meta_data,
--      whitelist to {'patient','medecin'} only, coerce 'doctor' → 'medecin'.
--      SECURITY DEFINER + ON CONFLICT (id) DO NOTHING preserved.
--   2. Backfill existing public.users rows where role was wrongly set to
--      'patient' but auth metadata says 'medecin' / 'doctor'.
--   3. Add CHECK constraint on public.users.role if not already present.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 : Redefine trigger function
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _raw_role  text;
  _safe_role text;
BEGIN
  -- Read role from Supabase Auth metadata (set by frontend signUp options.data.role)
  _raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  -- Whitelist: only 'patient' and 'medecin' accepted from client metadata.
  -- Coerce English 'doctor' → 'medecin' for backward compatibility.
  -- NEVER allow 'admin', 'secretary', or any other value from client.
  _safe_role := CASE
    WHEN _raw_role = 'medecin' THEN 'medecin'
    WHEN _raw_role = 'doctor'  THEN 'medecin'   -- backward compat
    WHEN _raw_role = 'patient' THEN 'patient'
    ELSE                            'patient'   -- safe fallback for anything else
  END;

  INSERT INTO public.users (id, phone, email, role)
  VALUES (NEW.id, NEW.phone, NEW.email, _safe_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 : Backfill broken rows
-- Find public.users with role='patient' where auth metadata says 'medecin'
-- or 'doctor'. Update them and report count via RAISE NOTICE.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.users u
  SET    role = 'medecin'
  FROM   auth.users a
  WHERE  u.id = a.id
    AND  u.role = 'patient'
    AND  LOWER(TRIM(COALESCE(a.raw_user_meta_data->>'role', ''))) IN ('medecin', 'doctor');

  GET DIAGNOSTICS _count = ROW_COUNT;
  RAISE NOTICE '[PHASE16_5] Backfill complete: % row(s) updated to role=medecin', _count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3 : Add CHECK constraint on public.users.role (idempotent)
-- Only adds if a constraint named 'users_role_check' does not already exist.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'users'
      AND  constraint_name = 'users_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('patient', 'medecin', 'admin', 'secretary'));

    RAISE NOTICE '[PHASE16_5] CHECK constraint users_role_check added.';
  ELSE
    RAISE NOTICE '[PHASE16_5] CHECK constraint users_role_check already exists — skipped.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run after COMMIT to check results)
-- ─────────────────────────────────────────────────────────────────────────
-- 1. All users whose auth metadata says 'medecin' must have role='medecin':
--    SELECT u.id, u.email, u.role
--    FROM   public.users u
--    JOIN   auth.users a ON a.id = u.id
--    WHERE  LOWER(a.raw_user_meta_data->>'role') IN ('medecin','doctor');
--
-- 2. Confirm new trigger body:
--    SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);
--
-- 3. Confirm constraint:
--    SELECT constraint_name FROM information_schema.table_constraints
--    WHERE  table_schema='public' AND table_name='users' AND constraint_type='CHECK';
-- ─────────────────────────────────────────────────────────────────────────

COMMIT;
