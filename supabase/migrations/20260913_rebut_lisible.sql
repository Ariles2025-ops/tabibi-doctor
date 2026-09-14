-- =====================================================================
-- 20260913_rebut_lisible.sql
-- Sans compteur, le rebut est un tiroir. Or le tiroir est SOUDE.
-- =====================================================================
-- ETAT : APPLIQUEE le 13/09/2026, AVEC LA CORRECTION DU BLOC CI-DESSOUS.
--        Verifie apres application : les deux RPC existent,
--        anon = false / false, authenticated = true / true,
--        et `audit_log_echecs` compte 0 ligne (aucun echec d'audit depuis la
--        mise en place du regime).
--
-- ⚠️  LE COMPTEUR ADMIN DU FRONT N'EXISTE TOUJOURS PAS. Il vient au lot suivant,
-- apres `verifier:rpc --base --ecrire`. D'ici la, le rebut est un tiroir — dit,
-- pas masque.
--
-- ---------------------------------------------------------------------
-- UN DEFAUT DE CE FICHIER, TROUVE PAR plpgsql_check AVANT TOUT APPEL
-- ---------------------------------------------------------------------
-- La premiere version portait, dans LES DEUX fonctions :
--
--     IF (SELECT role FROM public.users WHERE id = auth.uid()) IS DISTINCT …
--
-- Dans `admin_audit_rebut_list`, c'est faux — et d'une facon que la CREATION NE
-- VOIT PAS. La fonction est `RETURNS TABLE (id bigint, …)` : **`id` y est une
-- VARIABLE plpgsql**, pas seulement une colonne. Le `WHERE id = auth.uid()`
-- devient donc ambigu, et Postgres leve `42702 column reference "id" is
-- ambiguous` — **a l'execution, pour tout admin qui appelle la liste.**
--
-- `CREATE OR REPLACE` a accepte la fonction sans broncher. `plpgsql_check` l'a
-- attrapee. C'est exactement la classe de defauts de la journee : **un
-- dispositif qui se cree sans erreur et qui echoue quand quelqu'un s'en sert.**
--
-- Corrige ci-dessous, dans les deux fonctions — `admin_audit_rebut_count` n'est
-- pas ambigue (pas de `RETURNS TABLE`), mais elle est qualifiee aussi, par
-- uniformite : une regle qui souffre une exception ne se retient pas.
--
--   LA REGLE, inscrite au journal : **toute fonction `RETURNS TABLE` qualifie
--   ses colonnes dans TOUTES ses requetes, y compris les sous-requetes de
--   controle qui n'ont rien a voir avec la table rendue.**
--
-- ---------------------------------------------------------------------
-- CE QUI A ETE TROUVE EN VOULANT ECRIRE LE COMPTEUR
-- ---------------------------------------------------------------------
-- Mesure du 13/09/2026 sur `information_schema.role_table_grants` :
--
--   audit_log         -> postgres, service_role. ET C'EST TOUT.
--   audit_log_echecs  -> postgres, service_role. ET C'EST TOUT.
--
-- **`anon` et `authenticated` n'ont AUCUN droit sur ces deux tables.**
--
-- Consequence directe, et elle depasse le compteur : `public.audit_log` porte
-- une politique RLS nommee « Only admins read audit » :
--
--   (SELECT users.role FROM users WHERE users.id = auth.uid()) = 'admin'
--
-- **Cette politique est INATTEIGNABLE.** La RLS ne s'evalue qu'APRES le
-- controle de privilege : sans `GRANT SELECT`, PostgREST ne peut pas lire la
-- table, quel que soit l'appelant. La politique promet un acces que le GRANT
-- interdit — personne, pas meme un admin, ne peut lire le journal d'audit
-- depuis l'application.
--
-- C'est la meme famille que tout le reste de la journee : **un dispositif
-- present qui ne fait pas ce que son nom annonce.** Ici la lecture est fermee,
-- donc le defaut est du bon cote — mais il est invisible, et quelqu'un a ecrit
-- cette politique en croyant ouvrir un acces.
--
-- ---------------------------------------------------------------------
-- POURQUOI DEUX RPC, ET PAS UN `GRANT SELECT`
-- ---------------------------------------------------------------------
-- Ouvrir `GRANT SELECT ON audit_log_echecs TO authenticated` rendrait la table
-- lisible par PostgREST, et il ne resterait que la RLS pour filtrer. Ca marche,
-- et c'est plus large que le besoin : le besoin est **un nombre**, et une liste
-- reservee aux admins.
--
-- Deux RPC SECURITY DEFINER, gardees par le role, n'exposent que ce qu'on
-- veut :
--   • le compteur ne peut rien fuiter, meme si sa garde etait fausse ;
--   • la liste est bornee et gardee au meme endroit ;
--   • aucun GRANT de table n'est ajoute — la surface reste fermee.
--
-- C'est le patron deja en place dans ce depot : `admin_validation_counts`,
-- `admin_validation_list`, `admin_validation_total`. On s'aligne dessus.
--
-- ⚠️  `after_data` PEUT CONTENIR DES DONNEES PERSONNELLES (c'est une copie de
-- la ligne qu'on n'a pas pu auditer). La liste est donc reservee aux admins,
-- bornee, et triee du plus recent. Ne pas l'elargir sans y repenser.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

-- 1. LE COMPTEUR. STABLE : il ne peut pas ecrire, et `provolatile` le prouve —
--    c'est un filtre sur par lequel une relecture future peut se fier.
CREATE OR REPLACE FUNCTION public.admin_audit_rebut_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF (SELECT u.role FROM public.users u WHERE u.id = auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_n FROM public.audit_log_echecs;
  RETURN v_n;
END;
$function$;

-- 2. LA LISTE. Bornee, la plus recente d'abord. `after_data` n'est PAS rendu :
--    le tableau admin a besoin de savoir QUOI a echoue et POURQUOI, pas de
--    relire la donnee. Qui en a besoin la lira en base, tracé.
CREATE OR REPLACE FUNCTION public.admin_audit_rebut_list(p_limit integer DEFAULT 50)
 RETURNS TABLE (
   id          bigint,
   survenu_le  timestamptz,
   fonction    text,
   sqlstate    text,
   sqlerrm     text,
   action      text,
   table_name  text
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (SELECT u.role FROM public.users u WHERE u.id = auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.survenu_le, e.fonction, e.sqlstate, e.sqlerrm, e.action, e.table_name
      FROM public.audit_log_echecs e
     ORDER BY e.survenu_le DESC
     LIMIT greatest(1, least(coalesce(p_limit, 50), 200));
END;
$function$;

-- 3. LES DROITS. `anon` n'a rien a faire ici : le rebut est une affaire
--    d'administration, et un visiteur anonyme n'est jamais admin.
REVOKE EXECUTE ON FUNCTION public.admin_audit_rebut_count()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_audit_rebut_list(integer)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_audit_rebut_count()          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_audit_rebut_list(integer)    TO authenticated;

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. LES DROITS. Attendu : anon=false, authenticated=true, sur les deux.
--
-- select p.proname,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'admin_audit_rebut%'
--  order by 1;
--
-- 2. LA GARDE MORD. Depuis une session NON-admin, les deux doivent lever
--    `42501 not_admin`. Depuis une session admin, rendre un nombre et une liste.
--
--    ⚠️  A LIRE AU NAVIGATEUR, PAS DEDUIT. Le corps lit `users.role` ; si la
--    RLS de `public.users` empechait la fonction de voir sa propre ligne, la
--    garde refuserait TOUT LE MONDE et le compteur afficherait une erreur pour
--    l'admin aussi. SECURITY DEFINER sous `postgres` devrait l'eviter — mais
--    « devrait » n'est pas une mesure.
--
-- 3. LA CONTRE-EPREUVE DE L'EXTERIEUR, cle anon publique. Attendu : 401 et
--    `42501 permission denied for function` sur les deux.
--      POST /rest/v1/rpc/admin_audit_rebut_count {}
--      POST /rest/v1/rpc/admin_audit_rebut_list  {"p_limit":1}
--
-- 4. `verifier:rpc --base --ecrire` pour regenerer `supabase/rpc/existantes.txt`,
--    SANS QUOI le front ne peut pas les appeler sans faire echouer la porte.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.admin_audit_rebut_count();
-- DROP FUNCTION IF EXISTS public.admin_audit_rebut_list(integer);
--
-- ⚠️  A NE FAIRE QU'APRES avoir retire l'appel du front : sinon PostgREST rend
-- 404, et on retombe exactement dans la classe que `verifier:rpc` existe pour
-- attraper — l'appel dans le vide.
--
-- =====================================================================
-- LIGNE OUVERTE, QUI N'EST PAS DANS CE FICHIER
-- =====================================================================
-- La politique « Only admins read audit » de `public.audit_log` reste
-- INATTEIGNABLE : aucun `GRANT SELECT` a `authenticated`. Deux issues, et c'est
-- une decision, pas une correction :
--
--   a) l'ASSUMER — le journal d'audit ne se lit qu'en base, par une personne
--      qui a les droits. Alors la politique doit etre SUPPRIMEE ou commentee :
--      une politique qui ne s'applique jamais fait croire a un acces.
--   b) l'OUVRIR — `GRANT SELECT ON public.audit_log TO authenticated`, et la
--      politique devient vraie. Mais le journal contient `before_data` et
--      `after_data`, donc des donnees de sante : a peser avec l'avocat.
--
-- **Je ne tranche pas.** Ce qu'il ne faut pas, c'est laisser en l'etat : un
-- dispositif qui annonce un acces qu'il n'accorde pas.
