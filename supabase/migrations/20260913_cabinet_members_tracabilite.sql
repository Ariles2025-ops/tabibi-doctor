-- =====================================================================
-- 20260913_cabinet_members_tracabilite.sql
-- QUI a retire un membre du cabinet, et QUAND — dans la table metier
-- =====================================================================
-- ETAT : APPLIQUEE le 13/09/2026, AVANT 20260913_regime_audit_log.sql.
--
-- VERIFICATION RELEVEE APRES APPLICATION :
--   public.cabinet_members porte removed_at, removed_by_user_id et
--   removed_from_role ; plpgsql_check rend 0 defaut sur
--   remove_cabinet_member, qui les reference.
--
-- ⚠️  NON EPROUVEE. `cabinet_members` est VIDE : aucun retrait n'a jamais eu
-- lieu, donc aucune de ces colonnes n'a jamais ete renseignee. La
-- verification 3 de la derniere section exige une fixture et reste A FAIRE.
--
-- ---------------------------------------------------------------------
-- LE DEFAUT
-- ---------------------------------------------------------------------
-- `remove_cabinet_member()` desactive un membre :
--     UPDATE public.cabinet_members SET active = false WHERE …
-- Apres cet appel, la base sait QUE la personne a ete retiree. Elle ne sait ni
-- QUI l'a retiree, ni QUAND, ni QUEL ROLE elle avait.
--
-- Ces trois faits n'existaient QUE dans la ligne d'`audit_log` — et cette
-- ligne etait posee dans un `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`,
-- donc **facultative**. Un retrait de membre pouvait donc etre execute sans
-- qu'aucune trace de l'acteur ne subsiste nulle part, en silence.
--
-- ---------------------------------------------------------------------
-- PALLIATIF CONTRE REMEDE — et pourquoi c'est le remede qui est ici
-- ---------------------------------------------------------------------
-- Le palliatif aurait ete de rendre l'ecriture d'audit CONSTITUTIVE : le
-- retrait echoue si sa trace echoue. Ca marche, et c'est mauvais :
--   • ca fait dependre un acte metier de la sante d'une table d'audit ;
--   • ca laisse le fait ABSENT de la table qui le porte ;
--   • ca rend la lecture couteuse — il faut joindre `audit_log` et analyser du
--     `jsonb` pour repondre a « qui a retire ce membre ? ».
--
-- **Un fait metier se range dans la table metier.** L'audit redevient alors ce
-- qu'il doit etre : une PREUVE a cote, pas le seul exemplaire.
--
-- ---------------------------------------------------------------------
-- VERIFIE AVANT D'ECRIRE : AUCUNE LECTURE DU FRONT NE CHANGE
-- ---------------------------------------------------------------------
-- Le front ne lit JAMAIS `cabinet_members` directement. Mesure du 13/09 :
-- `admin-cabinet.html:301`, `js/tabibi-agenda.js:164` et
-- `secretaire-dashboard.html:280` passent tous par
-- `public.cabinet_members_directory_view`.
--
-- Et cette vue **nomme ses colonnes une par une** (membership_id, cabinet_id,
-- user_id, first_name, last_name, full_name, specialty_fr, role, active,
-- accepted, created_at) avec `WHERE cm.active = true`. Ce n'est PAS un
-- `SELECT *` : ajouter deux colonnes a la table n'en ajoute aucune a la vue.
--
-- Les deux colonnes sont NULLABLE et sans valeur par defaut : aucune ligne
-- existante n'est reecrite, aucun verrou de reecriture de table.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

ALTER TABLE public.cabinet_members
  ADD COLUMN IF NOT EXISTS removed_by_user_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS removed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS removed_from_role  text;

COMMENT ON COLUMN public.cabinet_members.removed_by_user_id IS
  'Qui a retire ce membre. NULL tant que active = true. Pose par remove_cabinet_member() le 13/09/2026 : avant, ce fait n''existait que dans une ligne d''audit facultative.';
COMMENT ON COLUMN public.cabinet_members.removed_at IS
  'Quand. NULL tant que active = true.';
COMMENT ON COLUMN public.cabinet_members.removed_from_role IS
  'Le role qu''avait la personne au moment du retrait — `role` reste inchange pour ne pas perdre l''historique des RDV.';

-- La fonction les renseigne. Corps identique par ailleurs, y compris ses
-- gardes : `is_cabinet_admin`, pas-soi-meme, pas-le-proprietaire.
-- L'ecriture d'audit devient une PREUVE : sa forme definitive (rebut +
-- RAISE WARNING) est posee par 20260913_regime_audit_log.sql, appliquee juste
-- apres. Ici on garde le handler d'origine pour ne faire qu'une chose a la fois.
CREATE OR REPLACE FUNCTION public.remove_cabinet_member(p_cabinet_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target_role text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF v_actor = p_user_id THEN
    RETURN jsonb_build_object('error', 'cannot_remove_self');
  END IF;
  IF NOT public.is_cabinet_admin(p_cabinet_id) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT role INTO v_target_role FROM public.cabinet_members
   WHERE cabinet_id = p_cabinet_id AND user_id = p_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'cannot_remove_owner_use_transfer');
  END IF;

  -- desactiver plutot que supprimer (preserve historique RDV / audit)
  -- [13/09/2026] + QUI, QUAND, DEPUIS QUEL ROLE. Meme UPDATE, meme WHERE :
  -- le fait entre dans la table metier, pas seulement dans l'audit.
  UPDATE public.cabinet_members
     SET active             = false,
         removed_by_user_id = v_actor,
         removed_at         = now(),
         removed_from_role  = v_target_role
   WHERE cabinet_id = p_cabinet_id AND user_id = p_user_id;

  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'cabinet_member:remove', 'cabinet_member', p_user_id,
            jsonb_build_object('cabinet_id', p_cabinet_id, 'previous_role', v_target_role));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. LES COLONNES EXISTENT ET SONT NULLABLE. Attendu : 3 lignes, not_null = f.
--
-- select a.attname, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull
--   from pg_attribute a
--  where a.attrelid = 'public.cabinet_members'::regclass
--    and a.attname in ('removed_by_user_id','removed_at','removed_from_role')
--  order by a.attname;
--
-- 2. LA VUE N'A PAS BOUGE — c'est la verification qui compte pour le front.
--    Attendu : exactement 11 colonnes, les memes qu'avant.
--
-- select count(*) as n_colonnes,
--        string_agg(attname, ', ' order by attnum) as colonnes
--   from pg_attribute
--  where attrelid = 'public.cabinet_members_directory_view'::regclass
--    and attnum > 0 and not attisdropped;
--
--    Attendu : 11 | membership_id, cabinet_id, user_id, first_name, last_name,
--                   full_name, specialty_fr, role, active, accepted, created_at
--
-- 3. LA FONCTION RENSEIGNE, ET SES GARDES TIENNENT — dans une transaction
--    ANNULEE, jamais en production telle quelle :
--
--    begin;
--      -- … creer un cabinet, un owner, un membre, se placer en admin …
--      select public.remove_cabinet_member('<cabinet>', '<membre>');
--      select active, removed_by_user_id, removed_at, removed_from_role
--        from public.cabinet_members
--       where cabinet_id = '<cabinet>' and user_id = '<membre>';
--       -- attendu : f | <l'acteur> | <maintenant> | <le role d'avant>
--    rollback;
--
--    ⚠️  `public.cabinet_members` est VIDE en production (mesure du 13/09) :
--    cette verification ne peut pas se faire sur des donnees existantes. Elle
--    exige une fixture. Tant qu'elle n'est pas faite, ce fichier est ECRIT et
--    RELU, pas EPROUVE — et il faut le dire comme ca.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- ALTER TABLE public.cabinet_members
--   DROP COLUMN IF EXISTS removed_by_user_id,
--   DROP COLUMN IF EXISTS removed_at,
--   DROP COLUMN IF EXISTS removed_from_role;
--
-- puis restaurer le corps de `remove_cabinet_member` depuis
-- 20260913_reparation_plpgsql_check.sql.
--
-- ⚠️  LE DROP DETRUIT LES DONNEES DE TRACABILITE DEJA ECRITES. Sur une base ou
-- des retraits ont eu lieu, c'est une perte definitive : le fait redevient
-- introuvable. A ne faire que si la colonne n'a jamais servi.
