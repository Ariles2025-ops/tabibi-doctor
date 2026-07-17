-- =====================================================================
-- TABIBI.DOCTOR — N° D'ORDRE MÉDECIN · PERSISTANCE SERVEUR (B4/T5)
-- =====================================================================
-- Date  : 2026-07-17 — SQL Editor prod, exécuté PAR AGHILES uniquement.
-- Posé en prod le 17/07, E2E validé : scoping (no_claimed_profile en
-- patient), format (invalid_format sur '@@' / 'AB'), anti-fuite (anon 401,
-- patient 0 ligne, colonne absente de public_doctors : 42703).
--
-- Avant : n° d'ordre uniquement en localStorage (doctor-claim.html), jamais
-- en base. Après : source de vérité = doctor_profiles, écriture par RPC.
--
-- ANTI-FUITE (vérifié statiquement AVANT la pose) : aucun chemin anon ne
-- fait SELECT * / to_jsonb(dp) / row_to_json(dp) de doctor_profiles.
--   - public_doctors / public_doctors_all / public_doctor_full : listes de
--     colonnes EXPLICITES (ou * d'une vue à colonnes figées) → ordre_number
--     n'y apparaît pas, et une vue fige ses colonnes à la création.
--   - get_my_doctor_profile / update_my_doctor_profile : RETURNS
--     doctor_profiles (type composite → incluent la colonne) MAIS
--     WHERE user_id=auth.uid(), authenticated-only, REVOKE PUBLIC → le
--     médecin lit SA propre ligne (lecteur légitime), jamais anon/autrui.
--   - table doctor_profiles : aucun GRANT anon (401) ; RLS owner-only.
-- =====================================================================

-- ═════════════════════════════════════════════════════════════════════
-- S1 · COLONNES + FORMAT (défense en profondeur au niveau table)
-- ═════════════════════════════════════════════════════════════════════
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS ordre_number text;
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS ordre_submitted_at timestamptz;

-- Format : 3-30 caractères, alphanumérique + espace . / -, borné alnum.
-- (ex. « CO-2025-1234 »). CHECK au niveau table : même un UPDATE direct via
-- la policy owner existante (chemin upload docs) ne peut pas le violer.
ALTER TABLE public.doctor_profiles
  DROP CONSTRAINT IF EXISTS doctor_profiles_ordre_number_format;
ALTER TABLE public.doctor_profiles
  ADD CONSTRAINT doctor_profiles_ordre_number_format
  CHECK (ordre_number IS NULL
         OR (length(ordre_number) BETWEEN 3 AND 30
             AND ordre_number ~ '^[A-Za-z0-9][A-Za-z0-9 ./-]*[A-Za-z0-9]$'));

-- ═════════════════════════════════════════════════════════════════════
-- S2 · RPC D'ÉCRITURE — le médecin écrit SON n° sur SA fiche réclamée
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.doctor_set_ordre_number(p_ordre text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_ordre  text := btrim(coalesce(p_ordre, ''));
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;

  -- Validation métier AVANT écriture (miroir du CHECK, erreur lisible)
  IF length(v_ordre) NOT BETWEEN 3 AND 30
     OR v_ordre !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]*[A-Za-z0-9]$' THEN
    RETURN 'invalid_format';
  END IF;

  -- Écrit UNIQUEMENT sa propre fiche réclamée, tant qu'elle n'est pas
  -- approuvée (après approbation, la donnée d'identification est figée —
  -- toute correction passe par l'admin).
  UPDATE public.doctor_profiles
     SET ordre_number       = v_ordre,
         ordre_submitted_at = now()
   WHERE user_id = v_uid
     AND is_claimed = true
     AND validation_status IS DISTINCT FROM 'approved';

  IF FOUND THEN
    RETURN 'ok';
  END IF;

  -- Distinguer « pas de fiche réclamée » de « fiche verrouillée (approved) »
  SELECT validation_status::text INTO v_status
    FROM public.doctor_profiles
   WHERE user_id = v_uid AND is_claimed = true
   LIMIT 1;

  IF v_status IS NULL THEN
    RETURN 'no_claimed_profile';
  END IF;
  RETURN 'locked_approved';
END $$;

-- Jamais anon : donnée d'identification, session requise.
REVOKE ALL ON FUNCTION public.doctor_set_ordre_number(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.doctor_set_ordre_number(text) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════
-- S3 · LECTURE — rien à ajouter (modèle existant vérifié par sondes)
-- ═════════════════════════════════════════════════════════════════════
-- anon : aucun GRANT SELECT sur la table (401 « permission denied »).
-- authenticated non-propriétaire : RLS owner-only → 0 ligne.
-- médecin : lit sa propre ligne (medecin-profile/doctor-dashboard /
--           get_my_doctor_profile) → verra ordre_number automatiquement.
-- admin/validation : console Supabase (service_role, bypass RLS).
-- public_doctors / public_doctor_full : colonnes explicites, jamais ordre_number.

-- ═════════════════════════════════════════════════════════════════════
-- S4 · VÉRIFICATIONS (read-only)
-- ═════════════════════════════════════════════════════════════════════
-- 4.1 Colonnes en place
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='doctor_profiles'
   AND column_name IN ('ordre_number','ordre_submitted_at');
-- 4.2 La view publique n'expose PAS la colonne (attendu : 0 ligne)
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='public_doctors'
   AND column_name = 'ordre_number';

-- ═════════════════════════════════════════════════════════════════════
-- S5 · ROLLBACK (décommenter pour retirer)
-- ═════════════════════════════════════════════════════════════════════
-- DROP FUNCTION IF EXISTS public.doctor_set_ordre_number(text);
-- ALTER TABLE public.doctor_profiles DROP CONSTRAINT IF EXISTS doctor_profiles_ordre_number_format;
-- ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS ordre_submitted_at;
-- ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS ordre_number;
