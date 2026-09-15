-- =====================================================================
-- 20260915_acces_pilote_numero.sql — la liste blanche des medecins testeurs
-- =====================================================================
-- ⚠️  ETAT : **PROPOSITION. NON APPLIQUEE.** Le stratege relit, puis applique.
--
-- =====================================================================
-- ⚠️⚠️  LIS CECI AVANT TOUT LE RESTE  ⚠️⚠️
-- =====================================================================
-- Ce lot installe un acces SANS MOT DE PASSE, SANS CODE SMS, SANS LIEN : un
-- medecin tape son numero de telephone et il est dans l'application.
--
-- **UN NUMERO DE TELEPHONE N'EST PAS UN SECRET.** Il s'affiche sur une plaque,
-- une ordonnance, un annuaire, une page Facebook. Quiconque connait le numero
-- d'un medecin de la liste peut ouvrir sa session — et voir ce qu'il voit.
--
-- Ce n'est donc PAS un mecanisme d'authentification. C'est un raccourci de
-- demonstration, et il n'est defendable que sous TROIS conditions, toutes les
-- trois presentes ici :
--
--   1. **Liste blanche.** Seuls les numeros qu'un administrateur a inscrits
--      un par un peuvent entrer. Il n'y a pas d'inscription libre.
--   2. **Interrupteur.** `ACCES_PILOTE_NUMERO_ENABLED` cote fonction : a
--      `false`, rien ne passe. **Il doit rester a `false` en production.**
--   3. **Donnees de test.** Les fiches de la liste doivent etre des comptes de
--      demonstration. Un medecin de la liste qui aurait de VRAIS patients
--      expose ces patients.
--
-- ⚠️ **DETTE DE SECURITE ASSUMEE — registre P-40.** Ce mode doit etre remplace
-- par un code SMS (OTP) avant qu'un seul vrai patient n'existe. Ce n'est pas
-- une intention : c'est la condition sous laquelle ce fichier a ete ecrit.
--
-- =====================================================================
-- CE QUE CE FICHIER NE FAIT PAS
-- =====================================================================
-- Il ne cree AUCUN compte et n'ouvre AUCUNE session. Il pose seulement la
-- liste blanche et ses deux portes d'administration. La session est mintee
-- par la fonction `acces-pilote`, avec la cle de service, hors de la base.
--
-- Il ne supprime pas non plus `doctor_invitations` (le modele par e-mail) :
-- le stratege tranchera. Les deux peuvent coexister — l'un invite, l'autre
-- laisse entrer.
-- =====================================================================

-- =====================================================================
-- 1. LA NORMALISATION DU NUMERO — une seule definition, ici
-- =====================================================================
-- Elle reproduit `normalizePhoneDZ` de `_partage/sms-rappels.ts`. Deux
-- implementations, donc un risque de derive : il est **assume et sans danger**,
-- parce qu'une derive fait ECHOUER LA CORRESPONDANCE, donc refuse l'acces.
-- Le sens de l'erreur compte : ici, se tromper ferme la porte.
--
-- Forme retenue : `213XXXXXXXXX`, sans `+`. C'est la forme que `auth.users`
-- utilise pour le champ `phone` et celle que le reste du depot manipule.
CREATE OR REPLACE FUNCTION public.normaliser_numero_dz(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  p text;
BEGIN
  IF p_phone IS NULL THEN RETURN NULL; END IF;
  p := regexp_replace(p_phone, '[\s\-\(\)\.\+]', '', 'g');
  IF left(p, 2) = '00' THEN p := substr(p, 3); END IF;
  IF left(p, 1) = '0'  THEN p := '213' || substr(p, 2); END IF;
  IF left(p, 3) <> '213' THEN
    IF p ~ '^[567]\d{8}$' THEN p := '213' || p; ELSE RETURN NULL; END IF;
  END IF;
  IF p !~ '^213[567]\d{8}$' THEN RETURN NULL; END IF;
  RETURN p;
END;
$function$;

COMMENT ON FUNCTION public.normaliser_numero_dz(text) IS
  'Numero algerien mobile -> forme 213XXXXXXXXX, ou NULL si la forme est refusee. Ne REPARE jamais un numero douteux : elle rend NULL. Miroir SQL de normalizePhoneDZ (supabase/functions/_partage/sms-rappels.ts).';


-- =====================================================================
-- 2. LA LISTE BLANCHE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pilote_acces_numero (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Forme normalisee, et la contrainte le dit : rien d'autre n'entre.
  phone             text NOT NULL UNIQUE CHECK (phone ~ '^213[567][0-9]{8}$'),
  doctor_profile_id uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  actif             boolean NOT NULL DEFAULT true,
  invited_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  derniere_entree   timestamptz,
  nb_entrees        integer NOT NULL DEFAULT 0,
  -- Revoque et actif sont la meme information, dite deux fois. On interdit
  -- qu'elles se contredisent : sans cette contrainte, un `actif = true` avec
  -- une date de revocation laisserait la porte ouverte par inadvertance.
  CONSTRAINT pan_revoque_donc_inactif CHECK (revoked_at IS NULL OR actif = false)
);

COMMENT ON TABLE public.pilote_acces_numero IS
  'LISTE BLANCHE du pilote : les numeros autorises a entrer sans mot de passe. ⚠️ Un numero n''est pas un secret — voir l''en-tete de 20260915_acces_pilote_numero.sql et P-40 au registre. Aucun GRANT a anon/authenticated : tout passe par les RPC administrateur et par la cle de service.';

COMMENT ON COLUMN public.pilote_acces_numero.derniere_entree IS
  'Derniere ouverture de session par ce numero. Sert a reperer un acces qui ne devrait plus servir — un pilote qui dure est un pilote qu''on a oublie de fermer.';

CREATE INDEX IF NOT EXISTS pilote_acces_numero_actif_idx
  ON public.pilote_acces_numero (phone) WHERE actif;

-- RLS active et AUCUNE politique : la table est inatteignable depuis
-- PostgREST pour `anon` et `authenticated`. C'est voulu, et c'est ecrit — une
-- politique absente sans explication finit par etre prise pour un oubli.
ALTER TABLE public.pilote_acces_numero ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pilote_acces_numero FROM anon, authenticated;


-- =====================================================================
-- 3. LE COMPTEUR DE TENTATIVES — pour limiter, sans stocker de numero
-- =====================================================================
-- La limitation par IP et par numero a besoin d'une memoire PARTAGEE : un
-- compteur dans la fonction ne tiendrait pas, chaque isolat Deno ayant le
-- sien. Elle vit donc en base.
--
-- ⚠️ Elle ne stocke NI le numero NI l'adresse IP, seulement leur SHA-256.
-- Une table de limitation n'a pas besoin de savoir QUI : elle a besoin de
-- savoir COMBIEN. Ce qu'on ne stocke pas ne fuit pas.
CREATE TABLE IF NOT EXISTS public.pilote_acces_tentatives (
  id           bigserial PRIMARY KEY,
  cle_sha256   text NOT NULL CHECK (cle_sha256 ~ '^[0-9a-f]{64}$'),
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilote_acces_tentatives_idx
  ON public.pilote_acces_tentatives (cle_sha256, at DESC);

ALTER TABLE public.pilote_acces_tentatives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pilote_acces_tentatives FROM anon, authenticated;

COMMENT ON TABLE public.pilote_acces_tentatives IS
  'Compteur de tentatives d''acces pilote, par empreinte SHA-256 (numero ou IP). Ne contient ni numero ni IP en clair. Purge : voir pilote_purger_tentatives().';


-- =====================================================================
-- 4. LA PORTE DE LIMITATION — compte ET enregistre, en un seul appel
-- =====================================================================
-- Compter d'un cote et enregistrer de l'autre laisse une fenetre : deux
-- requetes simultanees lisent 4, ecrivent 5 chacune, et 6 passent. On fait
-- les deux dans la meme transaction, et on rend ce qui reste.
CREATE OR REPLACE FUNCTION public.pilote_compter_tentative(
  p_cle_sha256 text,
  p_max        integer DEFAULT 5,
  p_fenetre    interval DEFAULT interval '1 minute'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF p_cle_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('error', 'invalid_key');
  END IF;

  INSERT INTO public.pilote_acces_tentatives (cle_sha256) VALUES (p_cle_sha256);

  SELECT count(*) INTO v_n
    FROM public.pilote_acces_tentatives
   WHERE cle_sha256 = p_cle_sha256
     AND at > now() - p_fenetre;

  RETURN jsonb_build_object('ok', v_n <= p_max, 'compte', v_n, 'max', p_max);
END;
$function$;

-- Purge : une table de limitation qui grossit indefiniment devient elle-meme
-- le probleme. A brancher sur pg_cron, ou a appeler a la main.
CREATE OR REPLACE FUNCTION public.pilote_purger_tentatives(p_age interval DEFAULT interval '1 day')
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.pilote_acces_tentatives WHERE at < now() - p_age;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;


-- =====================================================================
-- 5. ADMINISTRATION — ajouter, revoquer, lister
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_ajouter_medecin_pilote(
  p_phone             text,
  p_doctor_profile_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_acteur uuid := auth.uid();
  v_phone  text;
  v_nom    text;
  v_id     uuid;
BEGIN
  IF v_acteur IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  v_phone := public.normaliser_numero_dz(p_phone);
  IF v_phone IS NULL THEN RETURN jsonb_build_object('error', 'invalid_phone'); END IF;

  SELECT full_name INTO v_nom FROM public.doctor_profiles WHERE id = p_doctor_profile_id;
  IF v_nom IS NULL THEN RETURN jsonb_build_object('error', 'doctor_not_found'); END IF;

  INSERT INTO public.pilote_acces_numero (phone, doctor_profile_id, invited_by)
       VALUES (v_phone, p_doctor_profile_id, v_acteur)
  ON CONFLICT (phone) DO UPDATE
     SET doctor_profile_id = EXCLUDED.doctor_profile_id,
         actif             = true,
         revoked_at        = NULL,
         invited_by        = EXCLUDED.invited_by
   RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'phone', v_phone, 'doctor_name', v_nom);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoquer_medecin_pilote(p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_n     integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  v_phone := public.normaliser_numero_dz(p_phone);
  IF v_phone IS NULL THEN RETURN jsonb_build_object('error', 'invalid_phone'); END IF;

  UPDATE public.pilote_acces_numero
     SET actif = false, revoked_at = now()
   WHERE phone = v_phone AND actif;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Revoquer un numero absent n'est pas une erreur : l'etat voulu est atteint.
  -- On dit seulement s'il y avait quelque chose a fermer.
  RETURN jsonb_build_object('ok', true, 'phone', v_phone, 'revoques', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_lister_medecins_pilote()
 RETURNS TABLE (
   phone text, doctor_profile_id uuid, doctor_name text,
   actif boolean, created_at timestamptz, revoked_at timestamptz,
   derniere_entree timestamptz, nb_entrees integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    -- Aucune ligne : un non-administrateur n'apprend meme pas que la liste existe.
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.phone, p.doctor_profile_id, d.full_name, p.actif, p.created_at,
           p.revoked_at, p.derniere_entree, p.nb_entrees
      FROM public.pilote_acces_numero p
      LEFT JOIN public.doctor_profiles d ON d.id = p.doctor_profile_id
     ORDER BY p.created_at DESC;
END;
$function$;


-- =====================================================================
-- 6. LE JOURNAL D'ENTREE — appele par la fonction, avec la cle de service
-- =====================================================================
-- Elle ne DECIDE rien : la fonction a deja verifie la liste. Elle note.
CREATE OR REPLACE FUNCTION public.pilote_noter_entree(p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.pilote_acces_numero
     SET derniere_entree = now(), nb_entrees = nb_entrees + 1
   WHERE phone = p_phone AND actif;
END;
$function$;


-- =====================================================================
-- 7. LES DROITS — qui peut appeler quoi
-- =====================================================================
-- Meme discipline que `20260915_revoke_rpc_anon.sql` : on RETIRE d'abord a
-- PUBLIC, sinon le `GRANT` par defaut laisse tout le monde entrer. Un REVOKE
-- qui reussit n'est pas un REVOKE qui revoque.
REVOKE EXECUTE ON FUNCTION public.admin_ajouter_medecin_pilote(text, uuid)  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoquer_medecin_pilote(text)       FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_lister_medecins_pilote()            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.pilote_compter_tentative(text, integer, interval) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pilote_noter_entree(text)                 FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pilote_purger_tentatives(interval)        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normaliser_numero_dz(text)                FROM public, anon;

-- Les trois portes d'administration : reservees aux connectes. `is_admin()`
-- fait le reste — le droit d'appeler n'est pas le droit d'obtenir.
GRANT EXECUTE ON FUNCTION public.admin_ajouter_medecin_pilote(text, uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoquer_medecin_pilote(text)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_lister_medecins_pilote()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normaliser_numero_dz(text)                TO authenticated, service_role;

-- Ces trois-la ne sont appelees QUE par la fonction `acces-pilote`, avec la
-- cle de service. Personne d'autre n'a a les atteindre.
GRANT EXECUTE ON FUNCTION public.pilote_compter_tentative(text, integer, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.pilote_noter_entree(text)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.pilote_purger_tentatives(interval)        TO service_role;


-- =====================================================================
-- VERIFICATION — apres application
-- =====================================================================
-- 1. La liste est vide, et inatteignable depuis le front.
--
--    select count(*) from public.pilote_acces_numero;                 -- 0
--    select has_table_privilege('anon','public.pilote_acces_numero','select');  -- false
--    select has_table_privilege('authenticated','public.pilote_acces_numero','select'); -- false
--
-- 2. Le compte des RPC executables par `anon` n'a PAS bouge (P-26).
--
--    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.prokind='f' and p.prosecdef
--       and has_function_privilege('anon', p.oid, 'EXECUTE');
--    -- attendu : 10, comme avant. Ce fichier cree six fonctions SECURITY
--    -- DEFINER : si le compte monte, un REVOKE a manque sa cible.
--
-- 3. La normalisation rend bien NULL sur ce qui n'est pas un mobile algerien.
--
--    select public.normaliser_numero_dz('0555 12 34 56');  -- 213555123456
--    select public.normaliser_numero_dz('+213555123456');  -- 213555123456
--    select public.normaliser_numero_dz('021123456');      -- NULL (fixe)
--    select public.normaliser_numero_dz('33612345678');    -- NULL (etranger)
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
--   drop function if exists public.pilote_noter_entree(text);
--   drop function if exists public.pilote_purger_tentatives(interval);
--   drop function if exists public.pilote_compter_tentative(text, integer, interval);
--   drop function if exists public.admin_lister_medecins_pilote();
--   drop function if exists public.admin_revoquer_medecin_pilote(text);
--   drop function if exists public.admin_ajouter_medecin_pilote(text, uuid);
--   drop table    if exists public.pilote_acces_tentatives;
--   drop table    if exists public.pilote_acces_numero;
--   drop function if exists public.normaliser_numero_dz(text);
--
-- ⚠️ Et couper l'interrupteur AVANT de defaire quoi que ce soit :
--    ACCES_PILOTE_NUMERO_ENABLED = false.
