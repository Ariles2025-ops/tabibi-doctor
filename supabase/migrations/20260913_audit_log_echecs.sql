-- =====================================================================
-- 20260913_audit_log_echecs.sql
-- La table de rebut des ecritures d'audit. SEULE.
-- =====================================================================
-- A LANCER PAR AGHILES, SEULE, UN SEUL PASSAGE.
-- Verification par requete separee (en bas de ce fichier, en commentaire).
--
-- POURQUOI ELLE EXISTE. Huit des onze ecritures d'audit sont des traces de
-- PREUVE : l'acte existe sans elles (le cabinet est cree, l'acces est retire,
-- le 2FA est desactive). Leur echec ne doit pas annuler l'acte — mais il ne
-- doit pas disparaitre non plus. Aujourd'hui il disparait : sept handlers
-- `EXCEPTION WHEN OTHERS THEN NULL`.
--
-- LA PLUS BETE POSSIBLE, et c'est une specification, pas une paresse :
--   - AUCUNE cle etrangere. Un utilisateur supprime ne doit pas faire echouer
--     le rebut de sa propre trace.
--   - AUCUN declencheur. Rien qui puisse lever pendant l'ecriture de secours.
--   - AUCUNE RLS. Aucune politique a evaluer, donc aucune politique a refuser.
--   - AUCUNE colonne NOT NULL au-dela de l'identite et de l'horodatage. Une
--     contrainte non satisfaite est un mode de panne de plus.
--   - AUCUN compteur, nulle part. Un nombre qui monte dit qu'il s'est passe
--     quelque chose, jamais quoi ni pour qui.
-- Objectif : qu'elle ne puisse echouer que sur disque plein. Et si elle echoue
-- quand meme, l'operation LEVE — un seul etage de repli, apres on crie.
--
-- UN AJOUT A LA DECISION DU 13/09, QUE JE SIGNALE PARCE QU'IL N'EN FAISAIT PAS
-- PARTIE : les REVOKE ci-dessous. « Aucune RLS » ferme l'evaluation de
-- politiques ; ca ne ferme pas l'acces. Supabase accorde par defaut
-- SELECT/INSERT/UPDATE/DELETE a `anon` et `authenticated` sur les nouvelles
-- tables de `public`, et PostgREST expose `public`. Sans les REVOKE, cette
-- table — qui contiendra des identifiants d'utilisateurs et des charges utiles
-- d'audit — serait lisible par n'importe quel visiteur non authentifie.
-- Les REVOKE ne peuvent pas faire echouer une ecriture : ils ne s'appliquent
-- pas au proprietaire, et les fonctions qui ecriront ici sont SECURITY DEFINER.
-- RLS et GRANT sont deux mecanismes differents ; on retire le second sans
-- reintroduire le premier.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_log_echecs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survenu_le   timestamptz NOT NULL DEFAULT now(),

  -- d'ou vient l'echec
  fonction     text,          -- nom de la fonction qui n'a pas pu tracer
  sqlstate     text,          -- le SQLSTATE de l'echec d'audit
  sqlerrm      text,          -- son message

  -- ce qui aurait du etre ecrit dans audit_log, colonne pour colonne
  user_id      uuid,
  action       text,
  table_name   text,
  record_id    uuid,
  after_data   jsonb
);

COMMENT ON TABLE public.audit_log_echecs IS
  'Rebut des ecritures d''audit de PREUVE qui ont echoue. Volontairement sans '
  'cle etrangere, sans declencheur et sans RLS : elle ne doit pouvoir echouer '
  'que sur disque plein. Si elle echoue malgre tout, l''operation appelante '
  'LEVE. Une ligne ici est un incident a traiter, jamais une statistique.';

COMMENT ON COLUMN public.audit_log_echecs.after_data IS
  'La charge utile perdue, telle qu''elle aurait ete inseree dans audit_log.';

-- Fermeture des acces par defaut de Supabase (cf. en-tete).
REVOKE ALL ON public.audit_log_echecs FROM PUBLIC;
REVOKE ALL ON public.audit_log_echecs FROM anon;
REVOKE ALL ON public.audit_log_echecs FROM authenticated;

-- =====================================================================
-- VERIFICATION — passage SEPARE, apres. Trois lignes attendues, exactement
-- celles-ci. Toute autre valeur = on s'arrete.
--
--   SELECT 'existe'      AS controle, count(*)::text AS valeur, '1'    AS attendu
--     FROM pg_class WHERE oid = 'public.audit_log_echecs'::regclass
--   UNION ALL
--   SELECT 'rls_active',  relrowsecurity::text,                  'false'
--     FROM pg_class WHERE oid = 'public.audit_log_echecs'::regclass
--   UNION ALL
--   SELECT 'droits_anon_authenticated',
--          coalesce(string_agg(privilege_type, ','), 'AUCUN'),   'AUCUN'
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name   = 'audit_log_echecs'
--      AND grantee IN ('anon','authenticated','PUBLIC');
--
-- Et les trois proprietes qui font la table « bete » — ZERO ligne attendue :
--
--   SELECT 'cle etrangere' AS defaut, conname AS objet
--     FROM pg_constraint
--    WHERE conrelid = 'public.audit_log_echecs'::regclass AND contype = 'f'
--   UNION ALL
--   SELECT 'declencheur', tgname
--     FROM pg_trigger
--    WHERE tgrelid = 'public.audit_log_echecs'::regclass AND NOT tgisinternal
--   UNION ALL
--   SELECT 'politique RLS', polname
--     FROM pg_policy
--    WHERE polrelid = 'public.audit_log_echecs'::regclass;
-- =====================================================================
