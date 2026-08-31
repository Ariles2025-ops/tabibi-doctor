-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 18 — Page publique ambassadeur.html : table ambassadors + RLS + compteur
-- Project : pudugodhiofqrctcdwfl
-- Date    : 2026-08-31
--
-- ⚠️  STATUT : PROPOSITION — À RELIRE PUIS APPLIQUER MANUELLEMENT (règle 3 CLAUDE.md).
--     Contient RLS + GRANT/REVOKE. NE PAS exécuter sans validation humaine.
--
-- ⚠️  COLLISION DE NOMS RÉSOLUE : ce fichier définit `ambassadors` comme table
--     UNIFIÉE = { candidature ambassadeur (ambassadeur.html) } ∪ { code de
--     parrainage (liens /a/<CODE>, PHASE17) }. Il REMPLACE la définition
--     `ambassadors` de PHASE17. → N'appliquez PAS PHASE17 §1-2/§5 ; appliquez
--     CE fichier à la place (referral_clicks + trigger de PHASE17 restent valides
--     et sont rappelés ici pour un déploiement complet en un seul passage).
--
--     Sécurité clé : anon ne peut écrire QUE les colonnes de candidature
--     (GRANT INSERT au niveau colonne). code / is_active / status / doctor_id
--     ne sont JAMAIS posables par anon → aucune injection dans public_ambassadors.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Table unifiée ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ambassadors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Candidature (saisie publique via ambassadeur.html)
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  specialty       text,
  order_number    text,
  phone           text,
  email           text,
  wilaya          text,
  commune         text,
  cabinet_address text,
  -- Cycle de vie (posé par l'admin uniquement)
  status          text NOT NULL DEFAULT 'pending',   -- pending | validated | rejected
  -- Parrainage (posé par l'admin à la validation ; consommé par /a/<CODE>)
  code            text UNIQUE,
  display_name    text,
  doctor_id       uuid REFERENCES public.doctor_profiles(id),
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassadors_code_format CHECK (code IS NULL OR code ~ '^[A-Z0-9]{3,20}$')
);

-- ── RLS : INSERT anon (colonnes de candidature only), SELECT admin only ─────
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

-- anon ne lit jamais la table ; on révoque tout puis on ne rend QUE l'INSERT
-- sur les colonnes de candidature (impossible de poser status/code/is_active).
REVOKE ALL ON public.ambassadors FROM anon;
GRANT INSERT (first_name, last_name, specialty, order_number, phone, email,
              wilaya, commune, cabinet_address) ON public.ambassadors TO anon;

DROP POLICY IF EXISTS ambassadors_insert_anon ON public.ambassadors;
CREATE POLICY ambassadors_insert_anon ON public.ambassadors
  FOR INSERT TO anon WITH CHECK (true);

-- SELECT réservé aux admins (jamais anon).
DROP POLICY IF EXISTS ambassadors_select_admin ON public.ambassadors;
CREATE POLICY ambassadors_select_admin ON public.ambassadors
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
-- (admin gère validation/rejet/code via service_role ou dashboard : hors policy anon)

-- ── Vue publique parrainage (/a/<CODE>) — code + display_name des actifs ────
CREATE OR REPLACE VIEW public.public_ambassadors AS
  SELECT code, display_name FROM public.ambassadors
  WHERE is_active = true AND code IS NOT NULL;
GRANT SELECT ON public.public_ambassadors TO anon, authenticated;

-- ── Compteur places restantes /50 — RPC anon (aucune lecture de lignes) ─────
CREATE OR REPLACE FUNCTION public.get_ambassador_slots()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT GREATEST(0, 50 - (
    SELECT count(*)::int FROM public.ambassadors WHERE status <> 'rejected'
  ))
$$;
REVOKE ALL   ON FUNCTION public.get_ambassador_slots() FROM public;
GRANT EXECUTE ON FUNCTION public.get_ambassador_slots() TO anon, authenticated;

-- ── (Rappel PHASE17) referral_clicks + trigger — inclus pour un déploiement
--     complet en un passage. Sûrs à rejouer.
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL, user_agent text, referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_clicks_code_idx ON public.referral_clicks (code);
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.referral_clicks TO anon;
DROP POLICY IF EXISTS referral_clicks_insert_anon ON public.referral_clicks;
CREATE POLICY referral_clicks_insert_anon ON public.referral_clicks
  FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE public.users           ADD COLUMN IF NOT EXISTS referred_by_code text;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS referred_by_code text;

-- trigger handle_new_auth_user : version PHASE16_7 (prod) + une seule ligne
-- (referred_by_code). Tout le reste est INCHANGÉ ; ON CONFLICT (id) DO NOTHING
-- conservé → aucune inscription existante affectée.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _raw_role text; _safe_role text; _fn text; _ln text; _ref text;
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
  _ref := UPPER(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), ''));
  IF _ref IS NOT NULL AND _ref !~ '^[A-Z0-9]{3,20}$' THEN _ref := NULL; END IF;

  INSERT INTO public.users (id, phone, email, role, first_name, last_name, referred_by_code)
  VALUES (NEW.id, NEW.phone, NEW.email, _safe_role::user_role, _fn, _ln, _ref)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS (anon, après application)
--   SELECT public.get_ambassador_slots();                       -- 50 (base vide)
--   -- insert candidature (doit réussir) :
--   -- POST /rest/v1/ambassadors {first_name,last_name,...}      -- 201
--   -- SET ROLE anon; SELECT * FROM public.ambassadors;          -- doit ÉCHOUER
--   -- SET ROLE anon; INSERT ... (is_active=true) ...            -- doit ÉCHOUER (colonne non accordée)
--
-- NOTE Turnstile + email : voir docs/security ou l'Edge Function proposée.
--   L'INSERT anon direct N'A PAS de vérification Turnstile server-side (PostgREST
--   ne valide pas le captcha). ambassadeur.html pose un garde CLIENT (jeton exigé
--   avant envoi). Pour une vraie protection + email contact@tabibi.doctor, router
--   la soumission via une Edge Function `ambassador-submit` : vérifie le token
--   Turnstile (secret côté serveur) → INSERT service_role → envoi email Brevo.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.get_ambassador_slots();
--   DROP VIEW     IF EXISTS public.public_ambassadors;
--   DROP TABLE    IF EXISTS public.ambassadors;
-- ═══════════════════════════════════════════════════════════════════════════
