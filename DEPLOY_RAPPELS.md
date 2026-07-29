# Runbook — Déploiement des rappels RDV par SMS

**Branche** : `phase4/rappels-rdv` · **Projet Supabase** : `pudugodhiofqrctcdwfl` (EU)
**Composants** : table outbox `appointment_notifications` · trigger de confirmation ·
edge function `appointment-reminders` (3 passes : `j1`, `h2`, `confirmation`) · cron 15 min.

> **Règle d'or** : suivre les étapes **dans l'ordre**. Les envois réels ne se déclenchent
> qu'à l'étape **(k)** ; tout ce qui précède est réversible et sans coût.
> `dry_run` vaut **true par défaut** — il faut passer explicitement `false` pour envoyer.

---

## (a) Installer le CLI Supabase

```bash
brew install supabase/tap/supabase
```

<details>
<summary>Sans Homebrew — alternatives</summary>

```bash
# 1. Binaire direct (macOS Apple Silicon) — pas de dépendance
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz \
  | tar -xz -C /usr/local/bin supabase
supabase --version

# 2. Sans installation, à la demande (nécessite Node)
npx supabase --version
# → préfixer toutes les commandes du runbook par `npx `
```
Note : `npm i -g supabase` n'est **plus supporté** par Supabase.
</details>

## (b) Se connecter

```bash
supabase login
```

## (c) Lier le projet

```bash
supabase link --project-ref pudugodhiofqrctcdwfl
```

---

## (d) SQL Editor — migration 1/2 : table outbox

> Dashboard → SQL Editor → New query → coller → **Run**.
> On passe par le SQL Editor (et non `supabase db push`) : les 31 migrations
> historiques du projet sont dans `migrations/` à la racine, hors du champ du CLI,
> et ont toutes été appliquées manuellement. On garde une seule source de vérité.

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   uuid        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind             text        NOT NULL CHECK (kind IN ('confirmation','j1','h2')),
  channel          text        NOT NULL DEFAULT 'sms',
  to_phone         text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','sent','failed','skipped')),
  provider_msg_id  text,
  cost             text,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

-- Verrou anti-doublon : rend le double envoi physiquement impossible.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_notifications_uniq
  ON public.appointment_notifications (appointment_id, kind);

CREATE INDEX IF NOT EXISTS appointment_notifications_status_idx
  ON public.appointment_notifications (status, created_at DESC);

-- RLS activée SANS policy = service_role uniquement (l'edge function).
ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_notifications FROM anon, authenticated;

COMMENT ON TABLE public.appointment_notifications IS
  'Journal/outbox des notifications RDV (SMS). Écrit UNIQUEMENT par l''edge function appointment-reminders (service_role). RLS activée sans policy : aucun accès client. UNIQUE(appointment_id, kind) = garantie anti-double-envoi.';

COMMIT;
```

**Vérification** (doit renvoyer `true` puis `0`) :

```sql
SELECT rowsecurity FROM pg_tables WHERE tablename = 'appointment_notifications';
SELECT count(*) AS policies FROM pg_policies WHERE tablename = 'appointment_notifications';
```

---

## (e) SQL Editor — migration 2/2 : trigger de confirmation

> ⚠️ À exécuter **après (d)** : ce bloc modifie la contrainte créée juste avant.

```sql
BEGIN;

-- 'sending' = verrou de la passe confirmation (la ligne préexiste,
-- l'INSERT ne peut donc pas servir de verrou comme pour j1/h2).
ALTER TABLE public.appointment_notifications
  DROP CONSTRAINT IF EXISTS appointment_notifications_status_check;
ALTER TABLE public.appointment_notifications
  ADD CONSTRAINT appointment_notifications_status_check
  CHECK (status IN ('pending','sending','sent','failed','skipped'));

CREATE OR REPLACE FUNCTION public.tg_appointment_confirmed_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Résolution best-effort du téléphone (SECURITY DEFINER → lit users
  -- malgré la RLS). NULL toléré : l'edge function re-résout à l'envoi.
  BEGIN
    SELECT u.phone INTO v_phone FROM public.users u WHERE u.id = NEW.patient_id;
  EXCEPTION WHEN OTHERS THEN
    v_phone := NULL;
  END;

  BEGIN
    INSERT INTO public.appointment_notifications
      (appointment_id, kind, channel, to_phone, status)
    VALUES (NEW.id, 'confirmation', 'sms', v_phone, 'pending')
    ON CONFLICT (appointment_id, kind) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Un incident sur l'outbox ne doit JAMAIS empêcher un médecin de
    -- confirmer un rendez-vous.
    RAISE WARNING '[tg_appointment_confirmed_outbox] RDV % : %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_confirmed_outbox ON public.appointments;
CREATE TRIGGER trg_appointment_confirmed_outbox
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'confirmed' AND NEW.status = 'confirmed')
  EXECUTE FUNCTION public.tg_appointment_confirmed_outbox();

COMMIT;
```

**Vérification** :

```sql
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal;
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname = 'appointment_notifications_status_check';
```

---

## (f) SQL Editor — extensions du cron

```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net');
```

Si l'une des deux manque :

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

*(Équivalent dashboard : Database → Extensions → activer `pg_cron` et `pg_net`.)*

---

## (g) Créer les secrets

```bash
supabase secrets set REMINDERS_CRON_SECRET="$(openssl rand -hex 32)"
supabase secrets set REMINDERS_ENABLED=true
```

📌 **Note la valeur du secret** — elle sera nécessaire en (j), (k) et (l) :

```bash
openssl rand -hex 32   # à générer AVANT si tu veux la conserver, puis la passer en clair
```

## (h) Vérifier les identifiants SMS

```bash
supabase secrets list
```

Attendu : `BSMS_USER`, `BSMS_USERID`, `BSMS_HANDLE`, `BSMS_FROM` déjà présents
(utilisés par la fonction `send-sms` en production).

⚠️ **`BSMS_FROM` doit être NUMÉRIQUE** (ex. `12345`) : sur le réseau algérien, un
sender alphanumérique est filtré par les opérateurs et le SMS n'est **jamais livré**.
C'est pourquoi le mot « Tabibi » est placé dans le corps des messages.

## (i) Déployer la fonction

```bash
supabase functions deploy appointment-reminders --no-verify-jwt
```

`--no-verify-jwt` : l'authentification se fait par notre propre en-tête
`x-reminders-secret`, pas par un JWT Supabase (le cron n'en a pas).

---

## (j) Dry-run — aucun SMS, aucune écriture

```bash
curl -s -X POST "https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders" \
  -H "Content-Type: application/json" \
  -H "x-reminders-secret: <REMINDERS_CRON_SECRET>" \
  -d '{"dry_run": true}' | python3 -m json.tool
```

Réponse attendue :

```json
{
  "ok": true, "dry_run": true, "quiet_hours": false, "hour_algiers": 14,
  "j1":           { "candidates": 3, "sample": [ { "appointment_id": "…", "to_phone": "213555…", "starts_at": "…", "lang": "fr" } ] },
  "h2":           { "candidates": 0, "sample": [] },
  "confirmation": { "candidates": 1, "sample": [ … ] }
}
```

**À vérifier dans l'échantillon** : les bons RDV sont ciblés, les numéros sont
normalisés en `213XXXXXXXXX`, `starts_at` correspond bien à la fenêtre attendue.
Le dry-run **n'écrit rien** : il est rejouable autant de fois que voulu et ne
« consomme » aucun rappel.

**Lecture SQL de contrôle** (aucune ligne ne doit encore exister à ce stade,
sauf des `confirmation` déposées par le trigger) :

```sql
-- Vue d'ensemble
SELECT kind, status, count(*) FROM public.appointment_notifications
 GROUP BY kind, status ORDER BY kind, status;

-- Détail
SELECT an.kind, an.status, an.to_phone, an.provider_msg_id, an.cost, an.error,
       a.starts_at, an.created_at, an.sent_at
  FROM public.appointment_notifications an
  JOIN public.appointments a ON a.id = an.appointment_id
 ORDER BY an.created_at DESC LIMIT 50;

-- Confirmations en attente de drainage
SELECT * FROM public.appointment_notifications
 WHERE kind = 'confirmation' AND status IN ('pending','sending')
 ORDER BY created_at;
```

---

## (k) Test réel maîtrisé — 1 seul SMS, sur ton numéro

> Première dépense réelle. On la contient à **un** message, vers **ton** téléphone.

1. **Créer un RDV de test** dans ~1h30 (fenêtre `h2` = [now+90min, now+150min]),
   avec **ton numéro perso** comme patient, sur le compte test :

```sql
-- Remplacer <TON_TEL> par ton numéro au format 213XXXXXXXXX
UPDATE public.users SET phone = '<TON_TEL>'
 WHERE email = 'patient.test.desktop@tabibi.doctor'
 RETURNING id, phone;

-- Créer le RDV (doctor_id = id de FICHE doctor_profiles, pas auth.uid)
INSERT INTO public.appointments (patient_id, doctor_id, scheduled_at, duration_minutes, reason, status)
SELECT u.id, dp.id, now() + interval '100 minutes', 30, 'TEST rappel H-2', 'confirmed'
  FROM public.users u, public.doctor_profiles dp
 WHERE u.email = 'patient.test.desktop@tabibi.doctor'
   AND dp.full_name LIKE 'Dr TEST Desktop%'
 RETURNING id, starts_at, status;
```

2. **Vérifier en dry-run** que ce RDV apparaît bien dans `h2.sample` (commande (j)).

3. **Envoi réel** :

```bash
curl -s -X POST "https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders" \
  -H "Content-Type: application/json" \
  -H "x-reminders-secret: <REMINDERS_CRON_SECRET>" \
  -d '{"dry_run": false}' | python3 -m json.tool
```

4. **Contrôler** : SMS reçu sur ton téléphone, puis :

```sql
SELECT kind, status, to_phone, provider_msg_id, cost, error, sent_at
  FROM public.appointment_notifications
 ORDER BY created_at DESC LIMIT 5;
```

Attendu : une ligne `kind='h2'`, `status='sent'`, `provider_msg_id` et `cost` renseignés.
Si `status='failed'` → la colonne `error` contient la réponse brute de BudgetSMS
(`ERR <code>` : consulter la table des codes BudgetSMS ; les plus fréquents sont
un crédit épuisé ou un numéro refusé).

5. **Tester la confirmation** (optionnel, 1 SMS de plus) : repasser le RDV en
   `pending` puis en `confirmed` → le trigger dépose une ligne `confirmation`,
   relancer `{"dry_run": false}`.

---

## (l) Activer le cron (toutes les 15 min)

Une fois (k) validé : renommer
`supabase/migrations/20260729120100_reminders_cron.sql.DISABLED` en `.sql`,
puis coller ce bloc au SQL Editor **après avoir remplacé le secret** :

```sql
SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
                 'Content-Type',       'application/json',
                 'x-reminders-secret', '<REMINDERS_CRON_SECRET>'
               ),
    body    := jsonb_build_object('dry_run', false)
  );
  $$
);
```

### Comment le cron transmet le secret — compromis assumé

**Option retenue (simple) : secret en dur dans le job.**
Il est alors stocké en clair dans la table `cron.job`, lisible uniquement par
les rôles à privilèges (`postgres`/superuser) — c'est-à-dire toi. Acceptable ici.
⚠️ **Ne jamais committer le fichier une fois la valeur remplie** : garder la version
`<REMINDERS_CRON_SECRET>` dans git.

<details>
<summary>Option durcie — Supabase Vault (recommandée si plusieurs personnes ont accès à la DB)</summary>

```sql
-- 1. Stocker le secret chiffré (une seule fois)
SELECT vault.create_secret('<REMINDERS_CRON_SECRET>', 'reminders_cron_secret');

-- 2. Le job le lit au moment de l'exécution — plus rien en clair dans cron.job
SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
                 'Content-Type',       'application/json',
                 'x-reminders-secret',
                 (SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'reminders_cron_secret')
               ),
    body    := jsonb_build_object('dry_run', false)
  );
  $$
);
```
</details>

**Suivi du cron** :

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
SELECT jobid, status, return_message, start_time
  FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 🚨 Rollback / arrêt d'urgence

| Situation | Action | Effet |
|---|---|---|
| **Stopper les envois TOUT DE SUITE** | `supabase secrets set REMINDERS_ENABLED=false` | Kill-switch : la fonction sort immédiatement, **sans redéploiement**. Le cron continue de tourner à vide. |
| Désactiver la planification | `SELECT cron.unschedule('appointment-reminders');` | Le job est supprimé. |
| Suspendre sans supprimer | `UPDATE cron.job SET active = false WHERE jobname = 'appointment-reminders';` | Réactivable avec `active = true`. |
| Revenir en arrière complètement | `DROP TRIGGER IF EXISTS trg_appointment_confirmed_outbox ON public.appointments;`<br>`DROP FUNCTION IF EXISTS public.tg_appointment_confirmed_outbox();`<br>`DROP TABLE IF EXISTS public.appointment_notifications;` | ⚠️ Détruit l'historique des envois. |

**Réflexe en cas de doute : `REMINDERS_ENABLED=false` d'abord**, diagnostic ensuite.

---

## Aide-mémoire — comportement de la fonction

| Passe | Fenêtre | Heures calmes 21h-08h | Verrou anti-doublon |
|---|---|---|---|
| `j1` | RDV confirmés dans **[now+1h, now+24h]** sans ligne `j1` | **suspendue** (rattrapée au run de 08h grâce à la fenêtre large) | INSERT `pending` → conflit 23505 = déjà pris |
| `h2` | RDV confirmés dans **[now+90min, now+150min]** sans ligne `h2` | jamais suspendue | idem |
| `confirmation` | lignes outbox `pending` déposées par le trigger | jamais suspendue (transactionnel) | UPDATE conditionnel `pending`→`sending` |

Autres garde-fous : batch plafonné à **200 par passe**, `status='confirmed'` requis
(exclut `cancelled`), numéro invalide → aucune écriture (le RDV reste éligible si le
patient corrige son numéro), `dry_run=true` par défaut.
