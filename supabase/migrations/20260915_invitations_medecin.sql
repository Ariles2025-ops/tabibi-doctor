-- =====================================================================
-- 20260915_invitations_medecin.sql — inviter UN medecin precis au pilote
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- ---------------------------------------------------------------------
-- ⚠️  LA CONSIGNE DISAIT « ACTIVER doctor_profiles.is_active ». CE N'EST PAS LE VERROU.
-- ---------------------------------------------------------------------
-- Mesure du 14/09/2026 :
--
--     doctor_profiles : 75 035 lignes, dont is_active = true ...... 75 035
--                       dont is_claimed = true ....................      1
--                       dont user_id IS NOT NULL .................      1
--     public.users, role medecin/doctor ...........................     30
--
-- **`is_active` est deja vrai partout** : c'est un drapeau d'annuaire, pas un
-- droit d'acces. Le basculer n'ouvrirait rien, et le « desactiver pour tout le
-- monde sauf les invites » retirerait 75 034 fiches de la recherche publique.
--
-- Le vrai verrou est ailleurs, et il est beant dans l'autre sens : **30 comptes
-- medecins existent et UN SEUL est rattache a une fiche.** Les 29 autres sont
-- des medecins connectes qui ne « sont » personne dans l'annuaire.
--
-- Ce que ce lot pose, c'est donc le **rattachement** : une invitation nominative
-- lie un compte a UNE fiche precise, et c'est ce lien qui fait exister le
-- medecin dans le produit.
--
-- ---------------------------------------------------------------------
-- CE QUI EXISTE DEJA, ET QU'ON NE REFAIT PAS
-- ---------------------------------------------------------------------
--   `claim_requests`          un medecin DEMANDE sa fiche, un humain tranche.
--   `claim_my_doctor_profile` la revendication libre, par legacy_id.
--
-- L'invitation est l'inverse : **c'est NOUS qui choisissons le medecin**, donc
-- il n'y a rien a arbitrer a l'arrivee. Les deux chemins coexistent ; celui-ci
-- ne remplace pas l'autre et ne le contourne pas non plus — il part d'un acte
-- d'administrateur, trace.
--
-- ---------------------------------------------------------------------
-- LE JETON N'EST JAMAIS STOCKE
-- ---------------------------------------------------------------------
-- La table ne garde que son **SHA-256**. Un jeton d'invitation est un
-- identifiant au porteur : qui le lit peut s'approprier la fiche. Si la table
-- fuite, des empreintes ne servent a rien ; des jetons en clair ouvriraient
-- toutes les invitations en cours.
--
-- La fonction qui cree l'invitation ne recoit donc **que l'empreinte** — le
-- jeton est fabrique par l'edge function et n'entre jamais en base. Celle qui
-- l'accepte recoit le jeton en clair, le hache, et compare : c'est le seul
-- instant ou il traverse la base, sans y rester.
--
-- ⚠️  ET L'ADRESSE COMPTE AUTANT QUE LE JETON. L'acceptation exige que
-- l'e-mail du compte connecte soit **celui de l'invitation**. Sans cette
-- verification, un lien transfere — capture d'ecran, message suivi — suffirait
-- a prendre la fiche d'un confrere.
--
-- =====================================================================
-- 1. LA TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.doctor_invitations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_profile_id  uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  -- Range en minuscules a l'insertion (pas de citext dans ce projet, verifie
  -- le 14/09 : l'extension n'est pas installee). La comparaison se fait donc
  -- toujours sur `lower()`, des deux cotes, sans exception.
  email              text NOT NULL,
  -- SHA-256 hexadecimal du jeton. JAMAIS le jeton.
  token_sha256       text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  invited_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  accepted_at        timestamptz,
  accepted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at         timestamptz,
  CONSTRAINT inv_email_minuscule CHECK (email = lower(email)),
  CONSTRAINT inv_expire_apres_creation CHECK (expires_at > created_at),
  -- Une invitation acceptee sait PAR QUI. Sans ca, « acceptee » ne dit rien.
  CONSTRAINT inv_acceptee_a_un_auteur CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);

COMMENT ON TABLE public.doctor_invitations IS
  'Invitations nominatives au pilote : un administrateur designe UNE fiche medecin et UNE adresse. Ne contient JAMAIS le jeton, seulement son SHA-256 — un jeton d''invitation est un identifiant au porteur. Aucun GRANT : tout passe par les deux RPC SECURITY DEFINER. Posee le 14/09/2026.';

COMMENT ON COLUMN public.doctor_invitations.token_sha256 IS
  'SHA-256 hexadecimal du jeton d''invitation. Le jeton en clair n''existe que dans l''e-mail envoye ; la base ne le voit qu''au moment de l''acceptation, le temps de le hacher.';

-- Une seule invitation VIVANTE par fiche : sinon deux liens circulent et le
-- second vol la fiche au premier. Les invitations mortes (acceptees, revoquees,
-- perimees) ne genent pas — on doit pouvoir re-inviter.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_invitations_une_vivante
  ON public.doctor_invitations (doctor_profile_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS doctor_invitations_email_idx
  ON public.doctor_invitations (email);

-- RLS active, et AUCUNE politique : la table est inatteignable depuis
-- PostgREST. C'est voulu — et, contrairement a `audit_log` ou `prescriptions`,
-- c'est ECRIT ici pour que personne ne croie qu'une politique manque.
ALTER TABLE public.doctor_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doctor_invitations FROM anon, authenticated;

-- =====================================================================
-- 2. CREER — administrateur seulement
-- =====================================================================
-- Elle ne recoit QUE l'empreinte : l'appelant (l'edge function) fabrique le
-- jeton, l'envoie par e-mail, et ne le confie a personne d'autre.
CREATE OR REPLACE FUNCTION public.admin_creer_invitation_medecin(
  p_doctor_profile_id uuid,
  p_email             text,
  p_token_sha256      text,
  p_jours             integer DEFAULT 14
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_acteur uuid := auth.uid();
  v_email  text := lower(btrim(p_email));
  v_id     uuid;
  v_nom    text;
  v_etat text; v_msg text;
BEGIN
  IF v_acteur IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_email');
  END IF;
  IF p_token_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('error', 'invalid_token_hash');
  END IF;
  IF p_jours IS NULL OR p_jours < 1 OR p_jours > 60 THEN
    RETURN jsonb_build_object('error', 'invalid_duration');
  END IF;

  SELECT full_name INTO v_nom FROM public.doctor_profiles WHERE id = p_doctor_profile_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'doctor_not_found'); END IF;

  -- Une fiche deja rattachee n'est pas a prendre. On le dit au lieu de creer
  -- une invitation qui echouerait a l'acceptation, plus tard, chez le medecin.
  IF EXISTS (SELECT 1 FROM public.doctor_profiles
              WHERE id = p_doctor_profile_id AND user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'already_claimed');
  END IF;

  BEGIN
    INSERT INTO public.doctor_invitations
      (doctor_profile_id, email, token_sha256, invited_by, expires_at)
    VALUES
      (p_doctor_profile_id, v_email, p_token_sha256, v_acteur, now() + make_interval(days => p_jours))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- L'index partiel a parle : une invitation vivante existe deja.
    RETURN jsonb_build_object('error', 'invitation_already_pending');
  END;

  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_acteur, 'doctor_invitation:create', 'doctor_invitation', v_id,
            jsonb_build_object('doctor_profile_id', p_doctor_profile_id, 'email', v_email));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('admin_creer_invitation_medecin', v_etat, v_msg, v_acteur, 'doctor_invitation:create',
              'doctor_invitation', v_id, jsonb_build_object('doctor_profile_id', p_doctor_profile_id));
      RAISE WARNING 'audit_log: doctor_invitation:create non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: doctor_invitation:create non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  -- On ne rend NI le jeton (on ne l'a pas) NI l'empreinte (elle ne sert a rien
  -- a l'appelant). Juste de quoi composer l'e-mail.
  RETURN jsonb_build_object('ok', true, 'invitation_id', v_id,
                            'doctor_name', v_nom, 'email', v_email,
                            'expires_at', (now() + make_interval(days => p_jours)));
END;
$function$;

COMMENT ON FUNCTION public.admin_creer_invitation_medecin(uuid, text, text, integer) IS
  'Cree une invitation nominative. ADMIN seulement. Ne recoit que le SHA-256 du jeton : le jeton en clair est fabrique par l''edge function invite-doctor et n''entre jamais en base. Refuse une fiche deja rattachee, et une seconde invitation vivante sur la meme fiche (index partiel). Posee le 14/09/2026.';

REVOKE ALL ON FUNCTION public.admin_creer_invitation_medecin(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_creer_invitation_medecin(uuid, text, text, integer) TO authenticated;

-- =====================================================================
-- 3. ACCEPTER — le medecin invite, et lui seul
-- =====================================================================
CREATE OR REPLACE FUNCTION public.accepter_invitation_medecin(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_acteur     uuid := auth.uid();
  v_empreinte  text;
  v_inv        record;
  v_mon_email  text;
  v_etat text; v_msg text;
BEGIN
  IF v_acteur IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  v_empreinte := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv FROM public.doctor_invitations WHERE token_sha256 = v_empreinte;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invalid_token'); END IF;

  IF v_inv.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'revoked'); END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    -- Deja acceptee PAR CETTE PERSONNE : ce n'est pas une erreur, c'est un
    -- second clic sur le meme lien. On le dit sans rien changer.
    IF v_inv.accepted_by = v_acteur THEN
      RETURN jsonb_build_object('ok', true, 'already_accepted', true,
                                'doctor_profile_id', v_inv.doctor_profile_id);
    END IF;
    RETURN jsonb_build_object('error', 'already_accepted');
  END IF;
  IF v_inv.expires_at <= now() THEN RETURN jsonb_build_object('error', 'expired'); END IF;

  -- ⚠️ L'ADRESSE, PAS SEULEMENT LE JETON. Un lien transfere ne doit pas
  -- suffire a prendre la fiche d'un confrere.
  SELECT lower(email) INTO v_mon_email FROM public.users WHERE id = v_acteur;
  IF v_mon_email IS DISTINCT FROM v_inv.email THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  -- Le rattachement, conditionnel : si la fiche a ete prise entre-temps, on ne
  -- l'arrache pas a son proprietaire.
  UPDATE public.doctor_profiles
     SET user_id = v_acteur, is_claimed = true, claimed_at = now()
   WHERE id = v_inv.doctor_profile_id AND user_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'already_claimed'); END IF;

  UPDATE public.doctor_invitations
     SET accepted_at = now(), accepted_by = v_acteur
   WHERE id = v_inv.id AND accepted_at IS NULL;

  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_acteur, 'doctor_invitation:accept', 'doctor_profile', v_inv.doctor_profile_id,
            jsonb_build_object('invitation_id', v_inv.id));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES ('accepter_invitation_medecin', v_etat, v_msg, v_acteur, 'doctor_invitation:accept',
              'doctor_profile', v_inv.doctor_profile_id, jsonb_build_object('invitation_id', v_inv.id));
      RAISE WARNING 'audit_log: doctor_invitation:accept non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: doctor_invitation:accept non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;

  RETURN jsonb_build_object('ok', true, 'doctor_profile_id', v_inv.doctor_profile_id);
END;
$function$;

COMMENT ON FUNCTION public.accepter_invitation_medecin(text) IS
  'Le medecin invite rattache SON compte a SA fiche. Exige un jeton valide ET que l''e-mail du compte connecte soit celui de l''invitation — un lien transfere ne suffit pas. Le rattachement est conditionnel (user_id IS NULL) : une fiche prise entre-temps n''est jamais arrachee. Un second clic rend ok+already_accepted sans rien changer. Posee le 14/09/2026.';

REVOKE ALL ON FUNCTION public.accepter_invitation_medecin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_invitation_medecin(text) TO authenticated;

-- =====================================================================
-- 4. REVOQUER — pour qu'une invitation partie par erreur puisse etre reprise
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_revoquer_invitation_medecin(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_acteur uuid := auth.uid();
BEGIN
  IF v_acteur IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  UPDATE public.doctor_invitations
     SET revoked_at = now()
   WHERE id = p_invitation_id AND accepted_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_revocable'); END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_revoquer_invitation_medecin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoquer_invitation_medecin(uuid) TO authenticated;

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. La table est inatteignable depuis PostgREST (c'est le point).
--
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='doctor_invitations';
--   Attendu : AUCUNE ligne pour anon ni authenticated.
--
-- 2. Les trois fonctions existent, SECURITY DEFINER, search_path fige.
--
-- select proname, prosecdef, array_to_string(proconfig,' | ')
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and proname like '%invitation_medecin%';
--
-- 3. plpgsql_check sur les trois — `CREATE OR REPLACE` ne valide aucun corps.
--
-- select * from plpgsql_check_function('public.accepter_invitation_medecin(text)');
--   Attendu : aucune ligne. (Idem pour les deux autres.)
--
-- 4. ⚠️ LA CONTRE-EPREUVE QUI COMPTE, et elle se fait a deux comptes :
--    un compte medecin dont l'e-mail N'EST PAS celui de l'invitation doit
--    recevoir `email_mismatch` avec un jeton pourtant valide. Si ce cas
--    passait, un lien transfere suffirait a prendre la fiche d'un confrere.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- drop function if exists public.admin_revoquer_invitation_medecin(uuid);
-- drop function if exists public.accepter_invitation_medecin(text);
-- drop function if exists public.admin_creer_invitation_medecin(uuid, text, text, integer);
-- drop table if exists public.doctor_invitations;
--
-- ⚠️ Le retour arriere ne DEFAIT PAS les rattachements deja effectues :
-- `doctor_profiles.user_id` reste pose. C'est voulu — un medecin qui a pris sa
-- fiche ne la perd pas parce qu'on retire le mecanisme qui la lui a donnee.
