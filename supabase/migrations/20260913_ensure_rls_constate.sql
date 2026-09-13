-- =====================================================================
-- 20260913_ensure_rls_constate.sql
-- CONSTAT : le declencheur qui allume la RLS, et que personne n'a ecrit
-- =====================================================================
-- ⚠️  NE PAS APPLIQUER. Il existe deja en base.
--
-- Ce fichier n'est pas une migration : c'est un CONSTAT. Il existe pour que le
-- depot dise ce que la base contient. Le declencheur `ensure_rls` et sa
-- fonction `public.rls_auto_enable()` sont presents en production, actifs, et
-- **absents du depot comme de l'historique git** : installes hors fichier, a la
-- main dans l'editeur SQL ou par un modele Supabase. Origine inconnue.
--
-- Rendu par `pg_get_functiondef()` et `pg_event_trigger`, MOT POUR MOT, le
-- 13/09/2026.
--
-- ---------------------------------------------------------------------
-- POURQUOI ON LE GARDE (tranche le 13/09)
-- ---------------------------------------------------------------------
-- Il fait le travail : 55 tables sur 55 sont sous RLS grace a lui. Le retirer
-- rouvrirait une classe de defauts qu'on vient de fermer — chaque nouvelle
-- table naitrait sans RLS, en silence, et il faudrait s'en souvenir a chaque
-- `CREATE TABLE`.
--
-- Mais un mecanisme que personne n'a ecrit dans le depot doit y etre ecrit.
-- C'est la regle qu'il illustre : **un artefact qui vit en production et nulle
-- part ailleurs est une bombe a retardement** — la meme lecon que la page
-- « bientot disponible » servie par Cloudflare et absente de `main`.
--
-- ---------------------------------------------------------------------
-- CE QUI EST EN BASE, TEL QUEL
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- Reconstruit depuis pg_event_trigger : evtevent = 'ddl_command_end',
-- evttags = {CREATE TABLE, CREATE TABLE AS, SELECT INTO}, evtfoid ->
-- public.rls_auto_enable, proprietaire `postgres`, evtenabled = 'O' (actif).
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- Applique le 13/09/2026 AVANT ce fichier, consigne dans
-- 20260913_revoke_ddl_anonyme.sql : la fonction etait executable par `anon`
-- alors qu'elle n'est jamais censee etre appelee a la main.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- UNE NUANCE A NE PAS RATER DANS CE CORPS
-- ---------------------------------------------------------------------
-- Le `EXCEPTION WHEN OTHERS` de la ligne 22 n'est PAS un handler muet : il fait
-- `RAISE LOG 'rls_auto_enable: failed to enable RLS on %'`. Un echec laisse donc
-- une trace dans les journaux Postgres. C'est l'exception dans la famille
-- inventoriee par docs/FICHE_CATCH_SILENCIEUX.md — et la preuve qu'un
-- `EXCEPTION WHEN OTHERS` n'est pas fautif en soi : c'est `THEN NULL` qui l'est.
--
-- En revanche, une table creee pendant que ce handler se declenche naitrait
-- SANS RLS, et seul le journal Postgres le dirait. Personne ne le lit.
--
-- =====================================================================
-- VERIFICATION — ce fichier decrit-il toujours la base ?
-- =====================================================================
-- select e.evtname, e.evtevent, e.evtenabled, e.evttags, p.proname
--   from pg_event_trigger e
--   join pg_proc p on p.oid = e.evtfoid
--  where e.evtname = 'ensure_rls';
--
-- Attendu :  ensure_rls | ddl_command_end | O | {CREATE TABLE,CREATE TABLE AS,SELECT INTO} | rls_auto_enable
--
-- Et la preuve de bout en bout, dans une transaction ANNULEE :
--   begin;
--     create table public.temoin_rls (id int);
--     select relrowsecurity from pg_class where relname = 'temoin_rls';  -- attendu : true
--   rollback;
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- DROP EVENT TRIGGER IF EXISTS ensure_rls;
-- DROP FUNCTION IF EXISTS public.rls_auto_enable();
--
-- ⚠️  SI VOUS FAITES CA, CHAQUE NOUVELLE TABLE NAITRA SANS RLS.
-- Silencieusement. Aucune erreur, aucun avertissement — juste une table lisible
-- par `anon` des que le `GRANT` par defaut s'applique. C'est exactement le
-- scenario que ce declencheur empeche depuis une date inconnue.
