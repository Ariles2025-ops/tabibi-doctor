-- =====================================================================
-- Rappels RDV — remise en service du cron, garde-fous, heartbeat (C4)
-- =====================================================================
-- CONSTAT du 09/09/2026 (SELECT sur cron.job, cron.job_run_details,
-- net._http_response, empreintes SHA-256 des secrets) :
--   * le job pg_cron n° 2 « appointment-reminders » EXISTE et tourne toutes
--     les 15 minutes (le fichier 20260729120100_reminders_cron.sql.DISABLED
--     n'a jamais été la source : le job a été créé à part, sous un autre nom) ;
--   * chaque exécution reçoit HTTP 401 {"error":"unauthorized"} de l'edge
--     function : 24/24 sur les 6 h d'historique pg_net disponibles ;
--   * cause : la valeur de l'en-tête x-reminders-secret écrite EN CLAIR dans
--     cron.job.command (6 caractères) n'a pas la même empreinte SHA-256 que
--     le secret edge REMINDERS_CRON_SECRET (posé le 29/07 09:59). Le job
--     n'a donc jamais pu déclencher un envoi ; aucun rappel n'est parti par
--     ce chemin. appointments et l'outbox sont vides : rien n'a été perdu.
--
-- Ce que fait ce script (À EXÉCUTER PAR AGHILES, en 4 blocs, dans l'ordre) :
--   0. Aghiles crée le secret dans Vault (valeur = REMINDERS_CRON_SECRET,
--      lue dans Dashboard → Edge Functions → Secrets) — la valeur ne passe
--      ni par ce fichier ni par l'agent ;
--   1. table ops_heartbeat + ops_alertes (RLS sans policy : service_role /
--      postgres seulement) ;
--   2. le job n° 2 est réécrit : secret lu dans Vault (plus rien en clair
--      dans cron.job), identifiant de requête pg_net enregistré dans
--      ops_heartbeat à chaque tir ;
--   3. job « ops-heartbeat » toutes les 5 min : relève le code HTTP de la
--      dernière requête, pose une alerte si aucun 200 depuis 45 min ;
--   4. garde-fou outbox : marque « skipped » les confirmations en attente
--      dont le RDV est passé, annulé, ou vieilles de plus de 24 h
--      (0 ligne aujourd'hui — protège une réactivation future).
-- Le plafond par exécution (RUN_MAX = 60 envois, toutes passes confondues)
-- et l'exclusion des RDV passés sont dans le code de l'edge function
-- (même PR) : à déployer AVANT le bloc 2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. VAULT — à faire dans le SQL Editor par Aghiles, valeur collée par lui
-- ---------------------------------------------------------------------
-- select vault.create_secret('<COLLER_ICI_REMINDERS_CRON_SECRET>',
--                            'reminders_cron_secret',
--                            'En-tête x-reminders-secret du cron appointment-reminders');
-- Vérification (ne montre pas la valeur) :
-- select name, created_at from vault.decrypted_secrets where name = 'reminders_cron_secret';
-- Cohérence avec l'edge (empreinte à comparer à celle de `supabase secrets list`) :
-- select left(encode(extensions.digest(decrypted_secret,'sha256'),'hex'),8)
--   from vault.decrypted_secrets where name = 'reminders_cron_secret';
--                       -- attendu : 0d6c75b7 (empreinte de REMINDERS_CRON_SECRET le 09/09)

begin;

-- ---------------------------------------------------------------------
-- 1. Heartbeat et alertes
-- ---------------------------------------------------------------------
create table if not exists public.ops_heartbeat (
  job               text primary key,
  last_request_id   bigint,
  last_requested_at timestamptz,
  last_status       integer,
  last_ok_at        timestamptz,
  last_body         jsonb,
  updated_at        timestamptz not null default now()
);
comment on table public.ops_heartbeat is
  'C4 — dernier tir et dernière réponse HTTP de chaque job pg_cron → edge. Lecture : service_role / dashboard.';

create table if not exists public.ops_alertes (
  id           bigserial primary key,
  job          text not null,
  niveau       text not null check (niveau in ('info','avertissement','critique')),
  message      text not null,
  detail       jsonb,
  created_at   timestamptz not null default now(),
  acquittee_at timestamptz
);
comment on table public.ops_alertes is
  'C4 — alertes d''exploitation (heartbeat manquant, réponses non-200). Acquitter = remplir acquittee_at.';

alter table public.ops_heartbeat enable row level security;
alter table public.ops_alertes   enable row level security;
revoke all on public.ops_heartbeat, public.ops_alertes from anon, authenticated;
revoke all on sequence public.ops_alertes_id_seq from anon, authenticated;

-- Relevé : lit la réponse pg_net de la dernière requête et pose l'alerte.
create or replace function public.ops_relever_heartbeat()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ops_heartbeat h
     set last_status = r.status_code,
         last_body   = case
                         when r.content is null then null
                         when left(ltrim(r.content), 1) in ('{','[') then r.content::jsonb
                         else jsonb_build_object('raw', left(r.content, 500))
                       end,
         last_ok_at  = case when r.status_code = 200 then r.created else h.last_ok_at end,
         updated_at  = now()
    from net._http_response r
   where r.id = h.last_request_id;

  -- Aucun 200 depuis 45 min (3 tirs manqués) → une alerte, pas une par relevé.
  insert into public.ops_alertes (job, niveau, message, detail)
  select h.job, 'critique',
         'appointment-reminders : aucune réponse HTTP 200 depuis 45 minutes',
         jsonb_build_object('last_status', h.last_status, 'last_ok_at', h.last_ok_at,
                            'last_requested_at', h.last_requested_at, 'last_body', h.last_body)
    from public.ops_heartbeat h
   where h.job = 'appointment-reminders'
     and coalesce(h.last_ok_at, 'epoch'::timestamptz) < now() - interval '45 minutes'
     and not exists (select 1 from public.ops_alertes a
                      where a.job = h.job and a.acquittee_at is null
                        and a.created_at > now() - interval '6 hours');
end;
$$;
revoke execute on function public.ops_relever_heartbeat() from public, anon, authenticated;

-- Vue de santé lisible d'un coup d'œil (dashboard / verifier --live futur)
create or replace view public.ops_sante as
  select h.job, h.last_requested_at, h.last_status, h.last_ok_at,
         now() - h.last_ok_at as depuis_dernier_ok,
         h.last_body -> 'j1'  as j1,
         h.last_body -> 'h2'  as h2,
         h.last_body -> 'confirmation' as confirmation,
         (select count(*) from public.ops_alertes a where a.job = h.job and a.acquittee_at is null) as alertes_ouvertes
    from public.ops_heartbeat h;
revoke all on public.ops_sante from anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- 2. Le job n° 2 : secret depuis Vault, requête tracée
--    (cron.alter_job ne crée pas de doublon ; le nom et l'horaire restent)
-- ---------------------------------------------------------------------
-- PRÉREQUIS : bloc 0 fait, edge function redéployée avec RUN_MAX.
select cron.alter_job(
  job_id  := 2,
  command := $cmd$
    with tir as (
      select net.http_post(
        url     := 'https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-reminders-secret',
                       (select decrypted_secret from vault.decrypted_secrets
                         where name = 'reminders_cron_secret')),
        body    := jsonb_build_object('dry_run', false)
      ) as request_id
    )
    insert into public.ops_heartbeat (job, last_request_id, last_requested_at)
    select 'appointment-reminders', request_id, now() from tir
    on conflict (job) do update
      set last_request_id   = excluded.last_request_id,
          last_requested_at = excluded.last_requested_at,
          updated_at        = now();
  $cmd$
);

-- ---------------------------------------------------------------------
-- 3. Relevé toutes les 5 minutes (décalé du tir, qui tombe à :00/:15/:30/:45)
-- ---------------------------------------------------------------------
select cron.schedule('ops-heartbeat', '2-59/5 * * * *', $$ select public.ops_relever_heartbeat(); $$);

-- ---------------------------------------------------------------------
-- 4. Garde-fou outbox : rien d'ancien ne part à la réactivation
--    (aujourd'hui : 0 ligne dans appointment_notifications — à rejouer
--     juste avant toute réactivation future, avec RETURNING sous les yeux)
-- ---------------------------------------------------------------------
update public.appointment_notifications n
   set status = 'skipped',
       error  = 'stale_before_reactivation'
  from public.appointments a
 where a.id = n.appointment_id
   and n.kind = 'confirmation'
   and n.status = 'pending'
   and (a.starts_at < now() or a.status <> 'confirmed'
        or n.created_at < now() - interval '24 hours')
returning n.id, n.appointment_id, a.starts_at, a.status;

-- =====================================================================
-- Vérification (après les 4 blocs, attendre un quart d'heure)
-- =====================================================================
-- select jobid, jobname, schedule, active, position('x-reminders-secret'',' in command) > 0 as secret_en_clair
--   from cron.job;                                  -- attendu : secret_en_clair = false pour le job 2
-- select * from public.ops_sante;                   -- attendu : last_status = 200, j1/h2/confirmation = {candidates:0,...}
-- select * from public.ops_alertes where acquittee_at is null;   -- attendu : 0 ligne
-- select status_code, count(*) from net._http_response where created > now() - interval '1 hour' group by 1;
--                                                   -- attendu : 200 uniquement

-- =====================================================================
-- Retour arrière
-- =====================================================================
-- select cron.unschedule('ops-heartbeat');
-- -- job 2 : remettre l'ancienne commande n'a aucun intérêt (elle répondait 401) ;
-- -- pour couper les envois sans toucher au cron : secret REMINDERS_ENABLED = "false",
-- -- ou update cron.job set active = false where jobid = 2;
-- drop view if exists public.ops_sante;
-- drop function if exists public.ops_relever_heartbeat();
-- drop table if exists public.ops_alertes, public.ops_heartbeat;
-- -- select vault.delete_secret(...) : à ne faire que si le cron ne l'utilise plus.
