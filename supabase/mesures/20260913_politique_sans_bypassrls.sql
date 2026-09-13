-- =====================================================================
-- PREUVE MANQUANTE — la POLITIQUE porte-t-elle l'ecriture, ou est-ce BYPASSRLS ?
-- LECTURE/ECRITURE, MAIS TRANSACTION ANNULEE D'OFFICE (le bloc leve toujours).
-- ETAT : MESURE — a tourne le 13/09/2026 en production, apres deux corrections
--        d'Aghiles (voir plus bas). Verdict : C EST DEMONTRE.
--        E1 sans politique -> REFUSE 42501 « new row violates row-level security
--        policy » ; E2 avec politique -> ABOUTI. Premiere fois de la journee que la
--        RLS est REELLEMENT exercee sur cette table : les refus precedents etaient
--        des refus de PRIVILEGE (« permission denied for table »), qui tranchent
--        avant elle.
-- =====================================================================
-- CE QUE D1/D2 ONT MONTRE, ET LEUR LIMITE. D1 (FORCE, zero politique) a ecrit.
-- D2 (FORCE + politique) a ecrit. Les deux parce que `postgres` porte
-- l'attribut de role BYPASSRLS. L'experience ne dit donc RIEN sur ce que fait
-- la politique : elle n'a jamais eu l'occasion d'agir.
--
-- Sans cette mesure, l'option C declare une permissivite qu'on n'a jamais vue
-- produire d'effet. On ecrirait CREATE POLICY en esperant qu'elle serve.
--
-- LE DISPOSITIF. Un role temoin NOLOGIN, sans BYPASSRLS, non proprietaire de la
-- table : pour lui, la RLS s'applique, FORCE ou pas. Une fonction SECURITY
-- DEFINER qui LUI appartient — donc qui s'execute avec ses droits a lui, pas
-- ceux de postgres. C'est la reproduction fidele du cas « le proprietaire des
-- sept fonctions n'a pas BYPASSRLS ».
--
--   E1  role temoin, SANS politique  -> attendu REFUSE (violates row-level security)
--   E2  role temoin, AVEC politique  -> attendu ABOUTI
--
-- Si E1 refuse et E2 aboutit, la politique porte l'ecriture : C est DEMONTRE.
-- Si E1 aboutit, la politique ne sert a rien ici et C est cosmetique.
-- Si E2 refuse, C ne marche pas — et il faut autre chose.
--
-- CREATE ROLE est transactionnel dans Postgres : le role temoin disparait avec
-- l'annulation, comme la fonction et les lignes.
-- =====================================================================

DO $mesure$
DECLARE
  v_msg text := ''; v_avant int; v_apres int;
BEGIN
  SELECT count(*) INTO v_avant FROM public.audit_log_echecs;
  v_msg := v_msg || E'\n  lignes avant = ' || v_avant
                 || E'\n  proprietaire table = '
                 || (SELECT pg_get_userbyid(relowner) FROM pg_class
                      WHERE oid = 'public.audit_log_echecs'::regclass);

  -- Le role temoin : NOLOGIN, et surtout NOBYPASSRLS (defaut).
  EXECUTE 'CREATE ROLE temoin_sans_bypass_13092026 NOLOGIN';
  -- MESURE DU 13/09 : sans cette ligne, la mesure ne demarre pas. `postgres`
  -- n'est PAS membre implicite du role qu'il vient de creer : le transfert de
  -- propriete plus bas leve alors 42501 « must be able to SET ROLE ». Ce GRANT
  -- donne l'appartenance, il ne donne PAS BYPASSRLS — le role temoin reste
  -- NOBYPASSRLS, la mesure garde son sens.
  EXECUTE 'GRANT temoin_sans_bypass_13092026 TO ' || quote_ident(current_user);
  -- Deuxieme condition du transfert de propriete : Postgres exige que le
  -- NOUVEAU proprietaire d'une fonction ait CREATE sur le schema qui la
  -- contient. Sans ce GRANT : 42501 « permission denied for schema public ».
  -- CREATE sur un schema n'est ni BYPASSRLS ni une exemption de politique :
  -- le role temoin reste soumis a la RLS, ce que la mesure veut eprouver.
  EXECUTE 'GRANT CREATE ON SCHEMA public TO temoin_sans_bypass_13092026';
  EXECUTE 'GRANT INSERT ON public.audit_log_echecs TO temoin_sans_bypass_13092026';
  v_msg := v_msg || E'\n  role temoin cree : BYPASSRLS='
                 || (SELECT rolbypassrls::text FROM pg_roles
                      WHERE rolname = 'temoin_sans_bypass_13092026')
                 || '  (doit etre false)';

  -- La fonction SECURITY DEFINER, transferee au role temoin : elle s'executera
  -- donc avec les droits du temoin, pas ceux de postgres.
  EXECUTE $fn$
    CREATE FUNCTION public.temoin_politique_13092026(p_txt text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER
      SET search_path TO 'public', 'pg_temp'
    AS $corps$
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlerrm, action)
      VALUES ('temoin_politique_13092026', p_txt, 'temoin:politique');
    END
    $corps$;
  $fn$;
  EXECUTE 'ALTER FUNCTION public.temoin_politique_13092026(text) '
          'OWNER TO temoin_sans_bypass_13092026';
  v_msg := v_msg || E'\n  fonction SECURITY DEFINER, proprietaire = '
                 || (SELECT pg_get_userbyid(proowner) FROM pg_proc
                      WHERE oid = 'public.temoin_politique_13092026(text)'::regprocedure);

  -- FORCE, pour se placer dans le cas le plus defavorable.
  EXECUTE 'ALTER TABLE public.audit_log_echecs FORCE ROW LEVEL SECURITY';
  v_msg := v_msg || E'\n  FORCE ROW LEVEL SECURITY active pour la mesure';

  -- ------------------------------------------------------------------
  -- E1 — SANS politique. Attendu : REFUSE.
  -- ------------------------------------------------------------------
  BEGIN
    PERFORM public.temoin_politique_13092026('E1-sans-politique');
    v_msg := v_msg || E'\n\n  E1  sans politique -> A ECRIT'
                   || E'\n      << la RLS ne filtre rien pour ce role, C serait cosmetique';
  EXCEPTION WHEN OTHERS THEN
    v_msg := v_msg || E'\n\n  E1  sans politique -> REFUSE ' || SQLSTATE
                   || ' (' || left(SQLERRM, 70) || ')'
                   || E'\n      attendu : la RLS agit vraiment sur un role sans BYPASSRLS';
  END;

  -- ------------------------------------------------------------------
  -- E2 — AVEC la politique de l'option C. Attendu : ABOUTI.
  -- ------------------------------------------------------------------
  EXECUTE 'CREATE POLICY temoin_insert_13092026 ON public.audit_log_echecs '
          'FOR INSERT TO PUBLIC WITH CHECK (true)';
  BEGIN
    PERFORM public.temoin_politique_13092026('E2-avec-politique');
    v_msg := v_msg || E'\n  E2  avec politique -> ABOUTI'
                   || E'\n      la POLITIQUE porte l''ecriture, pas BYPASSRLS';
  EXCEPTION WHEN OTHERS THEN
    v_msg := v_msg || E'\n  E2  avec politique -> REFUSE ' || SQLSTATE
                   || ' (' || left(SQLERRM, 70) || ')'
                   || E'\n      << l''option C NE MARCHE PAS, il faut autre chose';
  END;

  SELECT count(*) INTO v_apres FROM public.audit_log_echecs;
  v_msg := v_msg || E'\n\n  lignes apres = ' || v_apres || '  (avant ' || v_avant || ')'
                 || E'\n  VERDICT : ' || CASE
                      WHEN v_apres = v_avant + 1 THEN 'C EST DEMONTRE — E1 refuse, E2 ecrit'
                      WHEN v_apres = v_avant + 2 THEN 'C EST COSMETIQUE — les deux ont ecrit'
                      WHEN v_apres = v_avant     THEN 'C NE MARCHE PAS — aucune n''a ecrit'
                      ELSE 'ETAT INATTENDU, ne pas conclure' END;

  RAISE EXCEPTION 'MESURE%', v_msg;
END
$mesure$;
