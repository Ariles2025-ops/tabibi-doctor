-- =====================================================================
-- C1-B — Fermeture de la lecture directe de public_doctors
-- =====================================================================
-- Fichier 2 sur 2. À NE JOUER QU'APRÈS, dans cet ordre :
--   1. 1A joué (les 6 RPC existent) ;
--   2. PR #57 mergée ;
--   3. front déployé EN PRODUCTION (Cloudflare : `wrangler pages deploy`),
--      vérifié : `curl -s https://tabibi.doctor/js/home-app.js | grep -c
--      "rpc/chercher_praticiens"` renvoie ≥ 1 et
--      `grep -c "rest/v1/public_doctors"` renvoie 0 ;
--   4. application mobile : la version publiée (APK 1.0.2 build 4) embarque
--      l'ANCIEN front → elle perdra la recherche jusqu'au build suivant.
--      Soit publier un APK reconstruit avant 1B, soit accepter la coupure
--      côté app pendant l'intervalle (décision d'Aghiles).
--
-- Tant que ces conditions ne sont pas réunies, jouer ce fichier casse la
-- recherche de praticiens sur tabibi.doctor.
--
-- Ce que fait ce script :
--   * security_invoker = true sur les deux vues : elles lisent
--     doctor_profiles avec les droits de l'appelant. Pour les RPC DEFINER
--     de 1A (propriétaire postgres, qui possède doctor_profiles et n'est
--     pas soumis à sa RLS), rien ne change ; pour anon / authenticated, la
--     vue devient illisible ;
--   * REVOKE ALL sur les deux vues pour anon et authenticated : la lecture
--     directe répond 401/403 au lieu de 200 ;
--   * postgres et service_role gardent leurs droits ; le trigger DEFINER
--     fn_update_doctor_rating (UPDATE sur la vue) n'est pas affecté.
--
-- À EXÉCUTER PAR AGHILES dans le SQL Editor. Rien n'est exécuté par l'agent.
-- =====================================================================

begin;

-- Garde-fou : refuse de s'exécuter si 1A n'a pas été joué.
do $$
begin
  if to_regprocedure('public.chercher_praticiens(text,text,text,text,integer,integer,boolean)') is null
     or to_regprocedure('public.praticien(uuid,integer)') is null
     or to_regprocedure('public.stats_publiques()') is null then
    raise exception 'C1-B refusé : les RPC de C1-A sont absentes. Jouer 20260909_c1a_rpc_praticiens.sql d''abord.';
  end if;
end $$;

alter view public.public_doctors        set (security_invoker = true);
alter view public.public_doctors_listed set (security_invoker = true);

revoke all on public.public_doctors        from anon, authenticated;
revoke all on public.public_doctors_listed from anon, authenticated;

commit;

-- =====================================================================
-- Vérification (après le COMMIT)
-- =====================================================================
-- a) plus aucun droit anon / authenticated sur les vues :
--    select table_name, grantee, privilege_type
--      from information_schema.role_table_grants
--     where table_name in ('public_doctors','public_doctors_listed')
--       and grantee in ('anon','authenticated');            -- attendu : 0 ligne
-- b) security_invoker posé :
--    select relname, reloptions from pg_class
--     where relname in ('public_doctors','public_doctors_listed');
--                                     -- attendu : {security_invoker=true}
-- c) les RPC lisent toujours :
--    select public.stats_publiques()->>'total';             -- attendu : inchangé
-- d) côté HTTP : node scripts/verifier-c1.mjs --live       -- attendu : 3 ✓
--    puis ouvrir https://tabibi.doctor, choisir une wilaya : la liste s'affiche.

-- =====================================================================
-- Retour arrière de 1B (rouvre la vue à l'identique d'avant ; les RPC de
-- 1A restent en place, elles ne donnent rien de plus que la vue)
-- =====================================================================
-- begin;
-- grant select on public.public_doctors, public.public_doctors_listed to anon, authenticated;
-- alter view public.public_doctors        reset (security_invoker);
-- alter view public.public_doctors_listed reset (security_invoker);
-- commit;
-- -- (les GRANT d'origine étaient ALL ; SELECT suffit au front, INSERT/UPDATE/
-- --  DELETE sur une vue de lecture n'ont jamais servi.)
