-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 17 — Système de parrainage médecins (ambassadeurs) · liens /a/<CODE>
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Date    : 2026-08-30
--
-- ⚠️  STATUT : PROPOSITION — À RELIRE PUIS APPLIQUER MANUELLEMENT.
--     Contient RLS + REVOKE + modification du trigger d'auth (règle 3 CLAUDE.md).
--     NE PAS exécuter sans validation humaine explicite. Testé en transaction
--     (BEGIN/ROLLBACK) avant tout COMMIT en prod. Rollback fourni en fin de fichier.
--
-- ⚠️  POINTS À CONFIRMER AVANT APPLICATION (marqués « TODO-CONFIRM ») :
--     1. Valeurs réelles de doctor_profiles.status considérées « validé ».
--     2. Présence de la valeur 'admin' dans l'enum user_role (guard §17).
--     3. Propriétaire de la vue/fonctions = propriétaire des tables (postgres)
--        pour que la vue contourne la RLS (§5). En SQL editor Supabase : OK.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 + 2. Table ambassadors + CHECK format du code ────────────────────────
CREATE TABLE IF NOT EXISTS public.ambassadors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  display_name text NOT NULL,
  doctor_id    uuid NULL REFERENCES public.doctor_profiles(id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassadors_code_format CHECK (code ~ '^[A-Z0-9]{3,20}$')
);

-- ── 3. Table referral_clicks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  user_agent text,
  referrer   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_clicks_code_idx ON public.referral_clicks (code);

-- ── 4. Colonnes referred_by_code ───────────────────────────────────────────
ALTER TABLE public.users           ADD COLUMN IF NOT EXISTS referred_by_code text;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS referred_by_code text;

-- ── 5. Vue publique + accès anon limité (code + display_name) ───────────────
-- La vue N'EST PAS security_invoker → elle s'exécute avec les privilèges de son
-- propriétaire (postgres = propriétaire des tables), qui contourne la RLS.
-- anon lit UNIQUEMENT ces 2 colonnes via la vue ; jamais la table en direct.
CREATE OR REPLACE VIEW public.public_ambassadors AS
  SELECT code, display_name FROM public.ambassadors WHERE is_active = true;

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
-- Révocation EXPLICITE de tout SELECT direct anon sur la table (fix priorité 1).
REVOKE SELECT ON public.ambassadors FROM anon;
-- Aucune policy SELECT sur la table → anon/authenticated ne la lisent pas en direct
-- (RLS refuse par défaut). Seule la vue est exposée :
GRANT SELECT ON public.public_ambassadors TO anon;
GRANT SELECT ON public.public_ambassadors TO authenticated;

-- ── 6. RLS referral_clicks : INSERT anon, aucun SELECT anon ─────────────────
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.referral_clicks TO anon;
DROP POLICY IF EXISTS referral_clicks_insert_anon ON public.referral_clicks;
CREATE POLICY referral_clicks_insert_anon ON public.referral_clicks
  FOR INSERT TO anon WITH CHECK (true);
-- (pas de policy SELECT → aucune lecture anon ; seule admin_referral_stats agrège)

-- ── 13. Trigger handle_new_auth_user : recopie referred_by_code ─────────────
-- Basé À L'IDENTIQUE sur PHASE16_7 ; SEUL ajout : lecture + INSERT de
-- referred_by_code. Whitelist rôle, cast user_role, SECURITY DEFINER,
-- search_path, ON CONFLICT (id) DO NOTHING : tout est CONSERVÉ.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _raw_role  text;
  _safe_role text;
  _fn        text;
  _ln        text;
  _ref       text;
BEGIN
  _raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  _safe_role := CASE
    WHEN _raw_role = 'medecin' THEN 'medecin'
    WHEN _raw_role = 'doctor'  THEN 'medecin'
    WHEN _raw_role = 'patient' THEN 'patient'
    ELSE                            'patient'
  END;
  _fn := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  _ln := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name',  '')), '');

  -- [PHASE 17] Code parrain depuis les métadonnées. Validé au format attendu,
  -- sinon NULL — on n'écrit jamais une valeur arbitraire venue du client.
  _ref := UPPER(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), ''));
  IF _ref IS NOT NULL AND _ref !~ '^[A-Z0-9]{3,20}$' THEN
    _ref := NULL;
  END IF;

  INSERT INTO public.users (id, phone, email, role, first_name, last_name, referred_by_code)
  VALUES (NEW.id, NEW.phone, NEW.email, _safe_role::user_role, _fn, _ln, _ref)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
-- Le trigger sur auth.users pointe sur le nom de fonction → CREATE OR REPLACE suffit.

-- ── 14. Propagation vers doctor_profiles ───────────────────────────────────
-- La fiche médecin n'est PAS créée par un INSERT client : elle est CLAIMée via
-- la RPC update_my_doctor_profile (SECURITY DEFINER). La propagation propre se
-- fait donc DANS cette RPC (copier users.referred_by_code → doctor_profiles au
-- moment du claim). NON inclus ici tant que la définition courante de
-- update_my_doctor_profile n'a pas été relue — l'écraser à l'aveugle casserait
-- le claim existant. La colonne (§4) est prête ; le câblage RPC sera un patch
-- ciblé une fois la def récupérée (SELECT pg_get_functiondef('public.update_my_doctor_profile'::regproc)).
-- Repli possible sans toucher la RPC : trigger AFTER INSERT/UPDATE sur
-- doctor_profiles qui copie referred_by_code depuis users quand le lien
-- user↔profil est posé (nécessite de confirmer la colonne de liaison).

-- ── 17. Stats admin (SECURITY DEFINER, auto-gardée admin) ───────────────────
CREATE OR REPLACE FUNCTION public.admin_referral_stats()
RETURNS TABLE (code text, clicks bigint, signups bigint, validated_doctors bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- TODO-CONFIRM : 'admin' présent dans l'enum user_role.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT a.code,
         (SELECT count(*) FROM public.referral_clicks c WHERE c.code = a.code)::bigint,
         (SELECT count(*) FROM public.users u WHERE u.referred_by_code = a.code)::bigint,
         (SELECT count(*) FROM public.doctor_profiles d
            WHERE d.referred_by_code = a.code
              -- TODO-CONFIRM : valeurs « validé » réelles de doctor_profiles.status
              AND COALESCE(d.status::text, '') IN ('active','validated','approved'))::bigint
  FROM public.ambassadors a
  ORDER BY a.code;
END;
$fn$;
REVOKE ALL   ON FUNCTION public.admin_referral_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_stats() TO authenticated;

-- ── 18. Seed de test ───────────────────────────────────────────────────────
INSERT INTO public.ambassadors (code, display_name) VALUES
  ('TEST01', 'Dr Kaci'),
  ('TEST02', 'Dr Benali'),
  ('TEST03', 'Dr Haddad')
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS (après application)
--   SELECT * FROM public.public_ambassadors;                       -- 3 lignes actives
--   SET ROLE anon; SELECT * FROM public.ambassadors;               -- doit ÉCHOUER (permission denied)
--   SET ROLE anon; SELECT * FROM public.public_ambassadors;        -- doit renvoyer code+display_name
--   RESET ROLE;
--   SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);  -- INSERT liste referred_by_code
--
-- ROLLBACK (si besoin de revenir en arrière)
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.admin_referral_stats();
--   DROP VIEW     IF EXISTS public.public_ambassadors;
--   DROP POLICY   IF EXISTS referral_clicks_insert_anon ON public.referral_clicks;
--   DROP TABLE    IF EXISTS public.referral_clicks;
--   DROP TABLE    IF EXISTS public.ambassadors;
--   ALTER TABLE public.users           DROP COLUMN IF EXISTS referred_by_code;
--   ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS referred_by_code;
--   -- restaurer le trigger : réappliquer migrations/PHASE16_7_trigger_copy_names.sql
--   COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
