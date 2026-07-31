-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 16.7 — handle_new_auth_user : copie aussi first_name / last_name
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-07-31
--
-- FIX: le nom du patient n'atteignait jamais public.users lors d'une
--      inscription abandonnée — l'agenda du médecin affichait « Patient ».
--
-- PROBLEM : le front envoie déjà le nom à l'inscription, dans
--           signUp(options.data) → auth.users.raw_user_meta_data contient
--           {role, first_name, last_name}. Le trigger n'y lisait QUE le rôle
--           et insérait (id, phone, email, role). Le nom n'était écrit que
--           plus tard, par l'upsert front de signup.html (phase 2), lequel
--           ne peut s'exécuter qu'APRÈS vérification de l'OTP — la RLS de
--           public.users exige auth.uid() = id, donc aucune écriture n'est
--           possible avant l'ouverture de session.
--           Conséquence : tout compte créé puis abandonné avant l'OTP restait
--           sans nom. Constat prod au 2026-07-31 : 45 comptes dans
--           public.users, 10 prénoms seulement, 9 téléphones.
--           Côté produit, l'agenda médecin affichait « Patient » sur ces RDV,
--           symptôme longtemps confondu avec un défaut de la vue
--           doctor_patients_directory (elle, vérifiée fonctionnelle).
--
-- CHANGE  : lecture de first_name / last_name dans raw_user_meta_data et
--           ajout des deux colonnes à l'INSERT. Le trigger tourne en
--           SECURITY DEFINER, donc hors RLS — c'est le seul endroit où le nom
--           peut être posé dès la création du compte.
--           NULLIF(TRIM(...), '') : on écrit NULL plutôt qu'une chaîne vide,
--           pour que le repli d'affichage côté front reste déclenchable.
--           Tout le reste est INCHANGÉ par rapport à PHASE16_6 : whitelist du
--           rôle (jamais 'admin' depuis le client), cast _safe_role::user_role,
--           SECURITY DEFINER, search_path = public, ON CONFLICT (id) DO NOTHING
--           — ce dernier garantit qu'un profil déjà complété n'est pas écrasé.
--
-- PORTÉE  : corrige les inscriptions FUTURES uniquement. Les comptes déjà
--           créés restent sans nom ; leur rattrapage depuis
--           auth.users.raw_user_meta_data est un UPDATE de masse séparé,
--           non inclus ici (règle 3 de CLAUDE.md).
--
-- Idempotent : CREATE OR REPLACE — rejouable sans effet de bord.
-- Ce fichier TRACE la version déjà validée en prod le 2026-07-31
-- (test transactionnel : first_name/last_name/phone/role copiés, ROLLBACK).
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
  _fn        text;
  _ln        text;
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

  -- [PHASE 16.7] Nom : présent dans les métadonnées depuis l'inscription,
  -- jamais copié jusqu'ici. NULL plutôt que '' pour ne pas masquer l'absence.
  _fn := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  _ln := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name',  '')), '');

  INSERT INTO public.users (id, phone, email, role, first_name, last_name)
  VALUES (NEW.id, NEW.phone, NEW.email, _safe_role::user_role, _fn, _ln)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION (après exécution)
--   SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);
--   → l'INSERT doit lister first_name, last_name.
--
-- Le trigger lui-même (ON auth.users) est INCHANGÉ et n'est pas recréé ici :
-- CREATE OR REPLACE FUNCTION suffit, le trigger pointe sur le nom de fonction.
-- ─────────────────────────────────────────────────────────────────────────
