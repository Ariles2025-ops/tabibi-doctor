-- =====================================================================
-- MESURE — l'outbox des confirmations de rendez-vous est-il VIDE ou MUET ?
-- =====================================================================
-- ETAT : MESURE — a tourne le 13/09/2026 en production, DU PREMIER COUP, sans
--        aucune correction. Premier fichier de la journee dans ce cas : les
--        precedents avaient soit echoue avant le point observe, soit demande
--        deux corrections pour demarrer.
--        VERDICT V1 — le piege n'existe pas. La transition vers `confirmed`
--        fait ARRIVER la ligne (outbox 0 -> 1). Declencheur, WHEN, INSERT et
--        table sont sains. Le vide venait de l'absence d'usage : la base
--        entiere contient UN rendez-vous, cree le 13/09, statut cancelled.
--
-- ECRITURE, MAIS TRANSACTION ANNULEE D'OFFICE : le bloc leve toujours.
-- NE JAMAIS EXTRAIRE UNE PARTIE DE CE FICHIER. C'est le RAISE final qui
-- garantit l'annulation ; un morceau copie seul ECRIRAIT en production.
--
-- LA QUESTION. public.appointment_notifications : un seul ecrivain (le
-- declencheur trg_appointment_confirmed_outbox sur appointments, fonction
-- tg_appointment_confirmed_outbox, SECURITY DEFINER, qui fait un INSERT),
-- ZERO ligne, et un handler NU — `WHEN OTHERS THEN NULL`.
--
-- On ne peut donc pas distinguer :
--     « aucun rendez-vous n'a jamais ete confirme »
--   de
--     « chaque confirmation a echoue en silence depuis le premier jour ».
--
-- Gravite superieure au rebut de ce matin : un rebut qui ne recoit rien, personne
-- ne le remarque. Un outbox qui ne recoit rien, ce sont des patients qui ne sont
-- pas prevenus.
--
-- CE QUI EST DEJA ECARTE, et n'a pas a etre remesure :
--   - la RLS n'est pas le coupable : postgres a BYPASSRLS, prouve par D1 avec
--     FORCE actif sur audit_log_echecs ;
--   - l'INSERT est statiquement valide : plpgsql_check a balaye les declencheurs
--     le 13/09 au matin sans rien remonter sur celui-ci.
-- Restent les echecs qui ne se voient qu'a l'execution : contrainte, NOT NULL,
-- cle etrangere, une clause WHEN jamais vraie, un statut attendu par le
-- declencheur que le code n'ecrit jamais.
--
-- TROIS VERDICTS, ECRITS D'AVANCE :
--   V1  une transition fait arriver la ligne      -> le vide vient de l'USAGE
--   V2  la transition a lieu, la ligne n'arrive pas -> PIEGE CONFIRME
--   V3  aucune transition ne declenche             -> le WHEN ne correspond pas
--                                                     a ce que le code ecrit
--
-- AVERTISSEMENT. L'experience fait passer UN rendez-vous existant par TOUS les
-- statuts de l'enum. D'autres declencheurs d'`appointments` se declencheront
-- aussi — le bloc 0 les liste AVANT, pour qu'on sache ce qu'on remue. Tout est
-- annule ; les effets de bord transactionnels (y compris une mise en file pg_net)
-- le sont aussi.
-- =====================================================================

DO $mesure$
DECLARE
  v_msg text := '';
  v_app uuid; v_statut_origine text;
  v_avant int; v_apres int; v_total int;
  v_when text; v_def text;
  r record; v_val text;
BEGIN
  -- ------------------------------------------------------------------
  -- 0. CE QU'ON VA REMUER — tous les declencheurs d'appointments
  -- ------------------------------------------------------------------
  v_msg := v_msg || E'\n  0. DECLENCHEURS SUR public.appointments';
  FOR r IN SELECT t.tgname, p.proname, t.tgenabled
             FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE t.tgrelid = 'public.appointments'::regclass
              AND NOT t.tgisinternal
            ORDER BY t.tgname
  LOOP
    v_msg := v_msg || E'\n     ' || r.tgname || ' -> ' || r.proname
                   || CASE WHEN r.tgenabled = 'D' THEN '  [DESACTIVE]' ELSE '' END;
  END LOOP;

  -- ------------------------------------------------------------------
  -- 1. LA DEFINITION DU DECLENCHEUR — le WHEN, tel que Postgres le rend
  -- ------------------------------------------------------------------
  SELECT pg_get_triggerdef(t.oid) INTO v_when
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.appointments'::regclass
     AND t.tgname = 'trg_appointment_confirmed_outbox';
  v_msg := v_msg || E'\n\n  1. DEFINITION\n     ' || coalesce(v_when, 'DECLENCHEUR INTROUVABLE');

  -- Les lignes du corps qui comptent, sans deverser 200 lignes dans un message
  SELECT string_agg('       ' || ligne, E'\n')
    INTO v_def
    FROM (SELECT unnest(string_to_array(
                   pg_get_functiondef('public.tg_appointment_confirmed_outbox()'::regprocedure),
                   E'\n')) AS ligne) x
   WHERE ligne ILIKE '%appointment_notifications%'
      OR ligne ILIKE '%insert%'
      OR ligne ILIKE '%exception%'
      OR ligne ILIKE '%if %'
      OR ligne ILIKE '%return%';
  v_msg := v_msg || E'\n\n  2. LIGNES DECISIVES DU CORPS\n' || coalesce(v_def, '       (aucune)');

  -- ------------------------------------------------------------------
  -- 3. LA POPULATION — combien de rendez-vous dans chaque statut, et depuis
  --    quand. Si le statut declencheur est a zero, la question se deplace.
  -- ------------------------------------------------------------------
  v_msg := v_msg || E'\n\n  3. POPULATION DE appointments PAR STATUT';
  FOR r IN SELECT status::text AS st, count(*) AS n,
                  min(updated_at) AS mn, max(updated_at) AS mx
             FROM public.appointments GROUP BY status ORDER BY 2 DESC
  LOOP
    v_msg := v_msg || E'\n     ' || rpad(r.st, 12) || lpad(r.n::text, 7)
                   || '   du ' || coalesce(to_char(r.mn, 'YYYY-MM-DD'), '?')
                   || ' au ' || coalesce(to_char(r.mx, 'YYYY-MM-DD'), '?');
  END LOOP;
  SELECT count(*) INTO v_total FROM public.appointment_notifications;
  v_msg := v_msg || E'\n     appointment_notifications : ' || v_total || ' ligne(s)';

  -- ------------------------------------------------------------------
  -- 4. L'EXPERIENCE — un rendez-vous reel, passe par tous les statuts.
  --    Les transitions sont CHAINEES, pas isolees : le statut de depart de
  --    chaque essai est l'arrivee du precedent. C'est assume, et c'est ce qui
  --    permet d'atteindre la transition cherchee quel qu'en soit le point de
  --    depart.
  -- ------------------------------------------------------------------
  SELECT id, status::text INTO v_app, v_statut_origine
    FROM public.appointments ORDER BY created_at DESC LIMIT 1;
  IF v_app IS NULL THEN
    v_msg := v_msg || E'\n\n  4. AUCUN RENDEZ-VOUS EN BASE — experience impossible,'
                   || E'\n     et c''est deja une reponse : rien n''a pu declencher l''outbox.';
    RAISE EXCEPTION 'MESURE%', v_msg;
  END IF;
  v_msg := v_msg || E'\n\n  4. EXPERIENCE sur le rendez-vous ' || v_app
                 || E'\n     statut de depart : ' || v_statut_origine;

  FOR v_val IN SELECT e.enumlabel FROM pg_enum e
                WHERE e.enumtypid = 'public.appointment_status'::regtype
                ORDER BY e.enumsortorder
  LOOP
    SELECT count(*) INTO v_avant FROM public.appointment_notifications;
    BEGIN
      EXECUTE format('UPDATE public.appointments SET status = %L::public.appointment_status '
                     'WHERE id = %L', v_val, v_app);
      SELECT count(*) INTO v_apres FROM public.appointment_notifications;
      v_msg := v_msg || E'\n     -> ' || rpad(v_val, 12)
                     || 'UPDATE ok   outbox ' || v_avant || ' -> ' || v_apres
                     || CASE WHEN v_apres > v_avant THEN '   *** LA LIGNE ARRIVE ***' ELSE '' END;
    EXCEPTION WHEN OTHERS THEN
      v_msg := v_msg || E'\n     -> ' || rpad(v_val, 12)
                     || 'UPDATE ' || SQLSTATE || ' : ' || left(SQLERRM, 60);
    END;
  END LOOP;

  SELECT count(*) INTO v_apres FROM public.appointment_notifications;
  v_msg := v_msg || E'\n\n  VERDICT : ' || CASE
    WHEN v_apres > v_total THEN
      'V1 — une transition fait ARRIVER la ligne. Le vide vient de l''USAGE : '
      'aucun rendez-vous n''a jamais ete confirme en production.'
    ELSE
      'V2 ou V3 — AUCUNE transition n''a rien mis dans l''outbox. '
      'Soit l''INSERT echoue et le handler nu l''avale (V2), soit le WHEN ne '
      'correspond a aucun statut de l''enum (V3). Le bloc 1 tranche entre les deux : '
      'si le WHEN nomme un statut present dans l''enum, c''est V2.'
    END
    || E'\n  (outbox : ' || v_total || ' avant, ' || v_apres || ' apres — tout est annule)';

  RAISE EXCEPTION 'MESURE%', v_msg;
END
$mesure$;
