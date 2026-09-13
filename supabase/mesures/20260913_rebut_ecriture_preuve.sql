-- =====================================================================
-- PREUVE — une ligne ecrite depuis un contexte SECURITY DEFINER ARRIVE-T-ELLE
-- dans public.audit_log_echecs, la RLS etant active et sans aucune politique ?
-- =====================================================================
-- A LANCER APRES le diagnostic, dans un passage SEPARE.
--
-- Le bloc LEVE TOUJOURS a la fin : la transaction est annulee d'office. La
-- fonction temoin creee ici disparait avec elle. Rien ne persiste.
--
-- POURQUOI CETTE MESURE EXISTE. « Le proprietaire contourne la RLS, donc une
-- ecriture SECURITY DEFINER passe sans doute. » « Sans doute » n'a pas sa place
-- dans une table dont la specification est « elle ne peut echouer que sur
-- disque plein ». Si l'ecriture n'arrive pas, la table de rebut est elle-meme un
-- point de panne silencieux — on aurait construit le piege qu'on voulait
-- supprimer.
--
-- LA MESURE EST A DEUX FACES, et les deux comptent :
--   FACE 1  un role `authenticated` ecrivant EN DIRECT doit ECHOUER.
--           C'est la preuve que les REVOKE ferment bien la porte.
--   FACE 2  le MEME role, passant par une fonction SECURITY DEFINER comme les
--           sept, doit REUSSIR, et la ligne doit etre RELUE.
-- Une seule des deux ne prouve rien : si tout echoue, la table est inutile ;
-- si tout passe, elle est ouverte a tous.
-- =====================================================================

DO $mesure$
DECLARE
  v_msg text := '';
  v_avant int; v_apres int; v_relu text;
  v_rls text; v_prop text;
BEGIN
  SELECT relrowsecurity::text, pg_get_userbyid(relowner)
    INTO v_rls, v_prop
    FROM pg_class WHERE oid = 'public.audit_log_echecs'::regclass;
  SELECT count(*) INTO v_avant FROM public.audit_log_echecs;

  v_msg := v_msg || E'\n  etat : RLS=' || v_rls || '  proprietaire=' || v_prop
                 || '  politiques=' || (SELECT count(*) FROM pg_policy
                                         WHERE polrelid = 'public.audit_log_echecs'::regclass)
                 || E'\n  role courant=' || current_user
                 || E'\n  lignes avant = ' || v_avant;

  -- La fonction temoin : meme regime que les sept (SECURITY DEFINER,
  -- search_path resserre, proprietaire = role courant).
  EXECUTE $fn$
    CREATE FUNCTION public.temoin_rebut_13092026(p_txt text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER
      SET search_path TO 'public', 'pg_temp'
    AS $corps$
    BEGIN
      INSERT INTO public.audit_log_echecs
        (fonction, sqlstate, sqlerrm, user_id, action, table_name, record_id, after_data)
      VALUES
        ('temoin_rebut_13092026', 'P0001', p_txt, NULL,
         'temoin:ecriture', 'audit_log', NULL, jsonb_build_object('temoin', p_txt));
    END
    $corps$;
  $fn$;
  v_msg := v_msg || E'\n  fonction temoin creee (SECURITY DEFINER, proprietaire '
                 || current_user || ')';

  -- ------------------------------------------------------------------
  -- FACE 1 — ecriture DIRECTE par `authenticated` : doit ECHOUER
  -- ------------------------------------------------------------------
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      EXECUTE 'INSERT INTO public.audit_log_echecs(fonction) VALUES (''intrusion_directe'')';
      v_msg := v_msg || E'\n\n  FACE 1  authenticated en DIRECT -> A REUSSI'
                     || E'\n          << LA TABLE EST OUVERTE, les REVOKE ne ferment rien';
    EXCEPTION WHEN OTHERS THEN
      v_msg := v_msg || E'\n\n  FACE 1  authenticated en DIRECT -> REFUSE ' || SQLSTATE
                     || ' (' || left(SQLERRM, 70) || ')'
                     || E'\n          attendu : la porte est fermee';
    END;
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_msg := v_msg || E'\n\n  FACE 1  impossible de prendre le role authenticated : '
                   || SQLSTATE || ' — mesure NON CONCLUANTE de ce cote';
  END;

  -- ------------------------------------------------------------------
  -- FACE 2 — le MEME role, par la fonction SECURITY DEFINER : doit REUSSIR
  -- ------------------------------------------------------------------
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      EXECUTE 'SELECT public.temoin_rebut_13092026(''ligne-temoin-13-09-2026'')';
      v_msg := v_msg || E'\n\n  FACE 2  authenticated via SECURITY DEFINER -> ABOUTI';
    EXCEPTION WHEN OTHERS THEN
      v_msg := v_msg || E'\n\n  FACE 2  authenticated via SECURITY DEFINER -> ' || SQLSTATE
                     || ' : ' || left(SQLERRM, 90)
                     || E'\n          << LE REBUT NE PEUT PAS ECRIRE. Piege reconstruit.';
    END;
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_msg := v_msg || E'\n\n  FACE 2  role authenticated inaccessible : ' || SQLSTATE;
  END;

  -- ------------------------------------------------------------------
  -- LA LIGNE EST-ELLE VRAIMENT LA ? Aboutir n'est pas arriver.
  -- ------------------------------------------------------------------
  SELECT count(*) INTO v_apres FROM public.audit_log_echecs;
  SELECT sqlerrm INTO v_relu
    FROM public.audit_log_echecs
   WHERE fonction = 'temoin_rebut_13092026'
   ORDER BY id DESC LIMIT 1;

  v_msg := v_msg || E'\n\n  lignes apres = ' || v_apres
                 || '  (avant ' || v_avant || ')'
                 || E'\n  ligne relue  = ' || coalesce(quote_literal(v_relu), 'AUCUNE')
                 || E'\n\n  VERDICT : ' || CASE
                      WHEN v_apres = v_avant + 1 AND v_relu = 'ligne-temoin-13-09-2026'
                        THEN 'LE REBUT ECRIT ET SE RELIT — la RLS active ne le bloque pas'
                      WHEN v_apres = v_avant
                        THEN 'RIEN N''EST ARRIVE — le rebut est un point de panne'
                      ELSE 'ETAT INATTENDU, ne pas conclure' END;

  RAISE EXCEPTION 'MESURE%', v_msg;
END
$mesure$;
