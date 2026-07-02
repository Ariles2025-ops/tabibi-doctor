-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 16.6 — handle_new_auth_user : cast explicite role::user_role
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-07-02
--
-- FIX: cast text->user_role sur role (42804) — signup téléphone-only cassé,
--      appliqué en prod le 2026-07-02.
--
-- PROBLEM : public.users.role est de type enum user_role. L'INSERT du trigger
--           passait la variable plpgsql _safe_role (text) sans cast → erreur
--           42804 (datatype mismatch) → GoTrue répondait 500
--           "Database error saving new user" sur CHAQUE signup téléphone-only.
--
-- CHANGE  : _safe_role::user_role dans l'INSERT. Aucun autre changement par
--           rapport à PHASE16_5 (whitelist rôle, SECURITY DEFINER,
--           ON CONFLICT (id) DO NOTHING conservés).
--
-- Idempotent : CREATE OR REPLACE — rejouable sans effet de bord.
-- Ce fichier TRACE la version déjà déployée en prod le 2026-07-02
-- (vérifiée via pg_get_functiondef ; signup re-testé OK en prod : 200 + OTP).
-- ═══════════════════════════════════════════════════════════════════════════

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
  VALUES (NEW.id, NEW.phone, NEW.email, _safe_role::user_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION (après exécution)
--   SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);
--   → l'INSERT doit contenir « _safe_role::user_role ».
-- ─────────────────────────────────────────────────────────────────────────
