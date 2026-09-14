-- =====================================================================
-- 20260914_rappels_sms_reels.sql — que les rappels partent, et qu'on le sache
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- ⚠️  UN PREALABLE HUMAIN : cette migration ECHOUE VOLONTAIREMENT tant
-- qu'Aghiles n'a pas pose le secret du cron dans le Vault (section 0).
-- C'est le coeur du correctif, pas un desagrement.
--
-- ---------------------------------------------------------------------
-- LE DEFAUT : 47 JOURS DE VERT POUR UN DISPOSITIF QUI NE FAISAIT RIEN
-- ---------------------------------------------------------------------
-- Mesure du 14/09/2026.
--
--   cron.job n° 2 « appointment-reminders » — ACTIF depuis le 29/07,
--   toutes les 15 minutes, `dry_run: false` :
--
--     headers := jsonb_build_object('Content-Type','application/json',
--                                   'x-reminders-secret','TA_CLE')
--                                                        ^^^^^^^^
--   un espace reserve, jamais remplace.
--
--   cron.job_run_details, jobid 2  ->  4 531 executions « succeeded »
--   net._http_response             ->  401, 24 reponses sur 24,
--                                      contenu {"error":"unauthorized"}
--
-- Les deux sont vrais en meme temps. `pg_net` est ASYNCHRONE : le SQL reussit
-- en DEPOSANT la requete, il n'attend pas la reponse. **Le journal du cron ne
-- dit donc rien de ce que la fonction a repondu**, et il a affiche vert
-- pendant sept semaines.
--
-- A DECHARGE : meme avec le bon secret, aucun SMS ne serait parti — il y a
-- 1 rendez-vous en base, `cancelled`, 0 `confirmed`. Le 401 est reel ; ce
-- n'est pas lui, seul, qui a prive un patient d'un rappel.
--
-- ---------------------------------------------------------------------
-- CE QU'ON CORRIGE, ET DANS QUEL ORDRE D'IMPORTANCE
-- ---------------------------------------------------------------------
--   1. LE SILENCE (section 3) — une sentinelle horaire. **Le defaut n'etait
--      pas le 401, c'etait les 47 jours.** Un secret peut redevenir faux ;
--      sept semaines sans que personne ne l'apprenne, non.
--   2. LE SECRET (section 2) — il vient du Vault, plus d'un litteral a
--      remplacer a la main. On ne remplace pas un espace reserve par un
--      autre espace reserve.
--   3. LE REFUS (section 1) — `notifications_sms` : aujourd'hui, un patient
--      ne PEUT PAS refuser un SMS, la colonne n'existe pas.
--
-- =====================================================================
-- 0. LE PREALABLE — Aghiles pose le secret, une fois
-- =====================================================================
-- Console SQL, une seule fois, avec la valeur de REMINDERS_CRON_SECRET
-- (la meme que le secret de la fonction, cote Edge Functions) :
--
--   select vault.create_secret('<la valeur>', 'reminders_cron_secret',
--                              'Secret du cron appointment-reminders');
--
-- ⚠️  **Je ne pose ni ne lis ce secret** (regles 4 et 6). Cette ligne est ici
-- pour qu'elle ne s'oublie pas, avec un nom exact et une seule facon de faire.
--
-- Pour le remplacer plus tard : `select vault.update_secret(id, '<valeur>')`.

-- Garde d'entree : sans le secret, on ne touche a RIEN.
-- **Une migration qui recreerait le cron avec un secret absent recreerait le
-- defaut qu'elle corrige.** Elle refuse.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'reminders_cron_secret') THEN
    RAISE EXCEPTION
      'Secret « reminders_cron_secret » absent du Vault. Le poser AVANT (voir section 0) : sans lui, le cron repartirait en 401 comme il l''a fait 47 jours.'
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- =====================================================================
-- 1. LE PATIENT PEUT REFUSER LES SMS
-- =====================================================================
-- `public.users` porte `notifications_push`, `notifications_whatsapp` et
-- `notifications_marketing`. **Pas de `notifications_sms`** : un refus etait
-- litteralement inexprimable.
--
-- Defaut `true`, assume : un rappel de rendez-vous est TRANSACTIONNEL — le
-- patient a pris ce RDV et attend qu'on le lui rappelle. Ce n'est pas de la
-- prospection (`notifications_marketing` reste, lui, a l'oppose). Mais
-- « transactionnel » ne veut pas dire « impossible a refuser ».
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notifications_sms boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.notifications_sms IS
  'Le patient accepte-t-il les SMS transactionnels (rappel de RDV, confirmation) ? Defaut true : il a pris le rendez-vous, il attend le rappel. A NE PAS confondre avec notifications_marketing, qui couvre la prospection et vaut false par defaut. Lue par l''edge function appointment-reminders. Posee le 14/09/2026 : jusque-la, un refus de SMS etait inexprimable.';

-- =====================================================================
-- 2. LE CRON LIT SON SECRET DANS LE VAULT
-- =====================================================================
-- L'ancienne commande portait `'TA_CLE'` en clair. Le correctif n'est pas d'y
-- ecrire la vraie valeur — ce serait **un secret dans une definition de cron,
-- lisible par tout ce qui lit `cron.job`**, et un fichier de migration qui ne
-- peut plus etre versionne (regle 4).
--
-- Le cron lit donc le Vault au moment de tirer. Consequences voulues :
--   - aucun secret dans ce fichier, ni dans `cron.job` ;
--   - une rotation ne demande plus de toucher au cron ;
--   - si le secret disparait, l'en-tete devient NULL -> 401 -> **et la
--     sentinelle de la section 3 le dit dans l'heure.**
SELECT cron.unschedule('appointment-reminders');

SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-reminders-secret',
                 (SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'reminders_cron_secret')),
    body    := jsonb_build_object('dry_run', false)
  );
  $cron$
);

-- =====================================================================
-- 3. LA SENTINELLE — c'est ELLE, la vraie correction
-- =====================================================================
-- Un secret peut redevenir faux, la fonction peut tomber, le projet peut etre
-- suspendu pour impaye. Ce qui n'est pas acceptable, c'est de l'apprendre sept
-- semaines plus tard parce qu'un tableau affichait « succeeded ».
--
-- Elle regarde la seule chose qui compte : **la derniere REPONSE**, pas la
-- derniere execution.
--
-- ⚠️  `net._http_response` est purge par pg_net (quelques heures de retention).
-- La sentinelle ne fait donc pas d'histoire : elle juge sur ce qui reste. Une
-- table vide n'est PAS une alerte — c'est soit un projet au repos, soit une
-- purge. On n'alarme que sur une reponse REELLEMENT non-2xx.
CREATE OR REPLACE FUNCTION public.rappels_sentinelle()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'pg_temp'
AS $function$
DECLARE
  v_code integer;
  v_quand timestamptz;
  v_contenu text;
BEGIN
  SELECT r.status_code, r.created, left(COALESCE(r.content, ''), 200)
    INTO v_code, v_quand, v_contenu
    FROM net._http_response r
   ORDER BY r.created DESC
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;          -- purge, ou rien n'est parti
  IF v_code BETWEEN 200 AND 299 THEN RETURN; END IF;

  -- Une ligne par heure au maximum : la sentinelle ne doit pas noyer le
  -- journal qu'elle sert a rendre lisible.
  IF EXISTS (
    SELECT 1 FROM public.audit_log_echecs e
     WHERE e.fonction = 'rappels_sentinelle'
       AND e.survenu_le > now() - interval '1 hour'
  ) THEN RETURN; END IF;

  INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, action, table_name, after_data)
  VALUES ('rappels_sentinelle', 'HTTP' || v_code,
          'Le cron des rappels recoit ' || v_code || ' : aucun rappel ne part.',
          'rappels:reponse_non_2xx', 'cron.job',
          jsonb_build_object('status_code', v_code, 'quand', v_quand, 'contenu', v_contenu));

  RAISE WARNING 'rappels: derniere reponse HTTP % (%) — aucun rappel ne part', v_code, v_quand;
END;
$function$;

COMMENT ON FUNCTION public.rappels_sentinelle() IS
  'Regarde la DERNIERE reponse HTTP recue par pg_net et ecrit dans audit_log_echecs si elle n''est pas 2xx. Ecrite le 14/09/2026 apres 47 jours pendant lesquels le cron des rappels a recu 401 a chaque tir tandis que cron.job_run_details affichait « succeeded » : pg_net est asynchrone, le SQL reussit en DEPOSANT la requete. Ce n''est donc pas le journal du cron qui dit si un rappel est parti. Silencieuse quand tout va bien, et au plus une ligne par heure.';

REVOKE ALL ON FUNCTION public.rappels_sentinelle() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rappels_sentinelle() FROM anon, authenticated;

SELECT cron.schedule('rappels-sentinelle', '7 * * * *',
                     $cron$ SELECT public.rappels_sentinelle(); $cron$);

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. LE POINT QUI COMPTE : la reponse, pas l'execution.
--    Attendre un quart d'heure, puis :
--
-- select status_code, created, left(content, 120)
--   from net._http_response order by created desc limit 5;
--   Attendu : **200**, avec un corps {"ok":true,"dry_run":false,…}
--   Avant la migration : 401, {"error":"unauthorized"}, 24 fois sur 24.
--
-- 2. Le cron ne contient plus de secret, et sait ou le chercher.
--
-- select jobname, schedule, command from cron.job where jobname like 'rappels%' or jobname = 'appointment-reminders';
--   Attendu : la commande cite `vault.decrypted_secrets`, et AUCUNE valeur.
--
-- 3. La sentinelle se declenche — contre-epreuve VOLONTAIRE, a faire une fois :
--    renommer temporairement le secret du Vault, attendre un tir, verifier
--    qu'une ligne apparait, puis le remettre.
--
-- select survenu_le, sqlstate, sqlerrm, after_data
--   from public.audit_log_echecs where fonction = 'rappels_sentinelle'
--  order by survenu_le desc limit 5;
--
--   ⚠️  **Une sentinelle jamais declenchee est une sentinelle non verifiee.**
--   C'est toute la lecon de ce lot : le dispositif precedent n'avait jamais
--   ete vu echouer, donc personne ne savait qu'il echouait.
--
-- 4. La colonne de refus existe et vaut true partout.
--
-- select notifications_sms, count(*) from public.users group by 1;
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- select cron.unschedule('rappels-sentinelle');
-- drop function if exists public.rappels_sentinelle();
--
-- -- remet le cron des rappels dans son etat du 14/09 (celui qui rendait 401) :
-- select cron.unschedule('appointment-reminders');
-- select cron.schedule('appointment-reminders', '*/15 * * * *', $cron$
--   SELECT net.http_post(
--     url     := 'https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders',
--     headers := jsonb_build_object('Content-Type','application/json','x-reminders-secret','TA_CLE'),
--     body    := jsonb_build_object('dry_run', false)
--   );
-- $cron$);
--
-- ⚠️  **Ne joue ce retour arriere que pour revenir a un etat CONNU, pas pour
-- « reparer ».** Il restaure un cron qui ne peut pas s'authentifier.
--
-- La colonne `notifications_sms`, elle, ne se retire pas : un patient qui
-- aurait dit non verrait son refus efface. Si elle genait, la laisser.
