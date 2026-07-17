-- =====================================================================
-- TABIBI.DOCTOR — DAWINI RADAR · PACK 1
-- =====================================================================
-- Fichier : migrations/DAWINI_RADAR_pack1.sql
-- Date    : 2026-07-13
-- Cible   : Supabase SQL Editor (prod) — exécuté PAR AGHILES uniquement.
--
-- CONTENU
--   S0. Extension unaccent (schema extensions)
--   S1. Normalisation : dawini_norm_text / dawini_norm_arr (IMMUTABLE)
--       + colonne dérivée dawini_requests.medicaments_normalized (GENERATED)
--   S2. Table medication_alerts + RLS + index + RPC create/cancel
--   S3. CHECK notifications.type +'dawini_alert' (constaté en prod : le
--       trigger violait notifications_type_check sans lui) puis trigger
--       « redisponible » : réponse disponible → alertes notified
--       + ligne dans public.notifications (table EXISTANTE, pattern NOTIF_step1)
--   S4. Radar : RPC dawini_shortage_by_wilaya / dawini_top_missing
--       (agrégats anonymes uniquement — conforme 18-07)
--   S5. Vérifications read-only
--   S6. ROLLBACK complet (commenté)
--
-- ÉCART assumé vs brief : wilaya en INT (wilaya_code 1-58) et non TEXT,
-- pour coller à dawini_requests.wilaya_code / dawini_zones (jointures et
-- agrégats propres ; le front affiche le nom via DZ_WILAYAS). Idem : la
-- table de notifications N'EST PAS créée — public.notifications existe
-- déjà (user_id, type, title, message, data) et le push FCM la lira.
-- =====================================================================


-- ═════════════════════════════════════════════════════════════════════
-- S0 · EXTENSION unaccent — zéro étape manuelle
-- ═════════════════════════════════════════════════════════════════════
-- Sur Supabase, les extensions vivent dans « extensions » ; si unaccent
-- était déjà installée ailleurs (ex. public), IF NOT EXISTS ne la déplace
-- pas — le DO de S1 détecte donc son schéma RÉEL et génère le wrapper
-- avec la bonne qualification. Copier-coller unique, aucune édition.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;


-- ═════════════════════════════════════════════════════════════════════
-- S1 · NORMALISATION (prérequis de toute agrégation)
-- ═════════════════════════════════════════════════════════════════════
-- unaccent() est STABLE ; une colonne GENERATED exige de l'IMMUTABLE.
-- Wrapper canonique (dictionnaire qualifié = déterministe), généré avec
-- le schéma détecté automatiquement.
DO $do$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname INTO v_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'unaccent';
  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'extension unaccent introuvable (CREATE EXTENSION a échoué ?)';
  END IF;
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.dawini_norm_text(t text)
    RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $body$
      SELECT %I.unaccent(%L::regdictionary, lower(btrim(coalesce(t, ''))));
    $body$;
  $f$, v_schema, v_schema || '.unaccent');
  RAISE NOTICE '✅ dawini_norm_text générée (unaccent détectée dans « % »)', v_schema;
END $do$;

-- Version tableau (medicaments est text[]) — ordre préservé.
CREATE OR REPLACE FUNCTION public.dawini_norm_arr(a text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT array_agg(public.dawini_norm_text(x) ORDER BY ord)
    FROM unnest(a) WITH ORDINALITY AS u(x, ord);
$$;

-- Colonne dérivée : "Doliprane" / " doliprane " / "DOLIPRANE" / "doliprané"
-- → 'doliprane'. STORED = calculée à l'écriture, lisible par index GIN.
ALTER TABLE public.dawini_requests
  ADD COLUMN IF NOT EXISTS medicaments_normalized text[]
  GENERATED ALWAYS AS (public.dawini_norm_arr(medicaments)) STORED;

CREATE INDEX IF NOT EXISTS dawini_requests_meds_norm_gin
  ON public.dawini_requests USING gin (medicaments_normalized);


-- ═════════════════════════════════════════════════════════════════════
-- S2 · TABLE medication_alerts + RLS + RPC
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.medication_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication            text NOT NULL CHECK (length(btrim(medication)) BETWEEN 2 AND 120),
  medication_normalized text NOT NULL,
  wilaya_code           int  NOT NULL CHECK (wilaya_code BETWEEN 1 AND 58),
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','notified','cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  notified_at           timestamptz
);

-- Index de matching du trigger (le hot path) + brief (med, wilaya, status)
CREATE INDEX IF NOT EXISTS medication_alerts_match_idx
  ON public.medication_alerts (medication_normalized, wilaya_code, status);
-- Une seule alerte ACTIVE par (patient, médicament, wilaya) — idempotence dure
CREATE UNIQUE INDEX IF NOT EXISTS medication_alerts_uniq_active
  ON public.medication_alerts (patient_id, medication_normalized, wilaya_code)
  WHERE status = 'active';
-- Liste « Mes alertes » du patient
CREATE INDEX IF NOT EXISTS medication_alerts_patient_idx
  ON public.medication_alerts (patient_id, created_at DESC);

ALTER TABLE public.medication_alerts ENABLE ROW LEVEL SECURITY;

-- Le patient ne VOIT que ses alertes. AUCUNE policy INSERT/UPDATE/DELETE :
-- toutes les écritures passent par les RPC SECURITY DEFINER ci-dessous.
DROP POLICY IF EXISTS medication_alerts_select_own ON public.medication_alerts;
CREATE POLICY medication_alerts_select_own
  ON public.medication_alerts FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- ── RPC : créer une alerte ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dawini_create_alert(p_medication text, p_wilaya int)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_norm   text;
  v_id     uuid;
  v_active int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_wilaya IS NULL OR p_wilaya NOT BETWEEN 1 AND 58 THEN
    RAISE EXCEPTION 'invalid_wilaya' USING ERRCODE = 'P0001';
  END IF;
  IF p_medication IS NULL OR length(btrim(p_medication)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_medication' USING ERRCODE = 'P0001';
  END IF;

  v_norm := public.dawini_norm_text(p_medication);

  -- Idempotent : une alerte active identique existe → on renvoie son id
  -- (le front peut afficher « déjà en place » sans faux succès ni doublon).
  SELECT id INTO v_id
    FROM public.medication_alerts
   WHERE patient_id = v_uid AND medication_normalized = v_norm
     AND wilaya_code = p_wilaya AND status = 'active';
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Anti-abus : 10 alertes actives max par patient
  SELECT count(*) INTO v_active
    FROM public.medication_alerts
   WHERE patient_id = v_uid AND status = 'active';
  IF v_active >= 10 THEN
    RAISE EXCEPTION 'too_many_alerts' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.medication_alerts
      (patient_id, medication, medication_normalized, wilaya_code)
    VALUES (v_uid, btrim(p_medication), v_norm, p_wilaya)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- course entre deux clics : l'alerte vient d'être créée → on la renvoie
    SELECT id INTO v_id
      FROM public.medication_alerts
     WHERE patient_id = v_uid AND medication_normalized = v_norm
       AND wilaya_code = p_wilaya AND status = 'active';
  END;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.dawini_create_alert(text, int) TO authenticated;

-- ── RPC : annuler une alerte ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dawini_cancel_alert(p_alert_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.medication_alerts
     SET status = 'cancelled'
   WHERE id = p_alert_id AND patient_id = auth.uid() AND status <> 'cancelled';
  RETURN FOUND;   -- false = alerte inconnue / pas à lui / déjà annulée
END $$;

GRANT EXECUTE ON FUNCTION public.dawini_cancel_alert(uuid) TO authenticated;


-- ═════════════════════════════════════════════════════════════════════
-- S3 · DÉCLENCHEUR « c'est redisponible »
-- ═════════════════════════════════════════════════════════════════════
-- S3.0 — CHECK notifications.type : + 'dawini_alert'. [FIX 2026-07-17]
-- Constaté au premier E2E prod : l'INSERT du trigger violait
-- notifications_type_check (liste DAWINI_step1 sans 'dawini_alert').
-- Même technique DROP+ADD idempotente que NOTIF_step1/MSG_step1/DAWINI_step1 —
-- liste COMPLÈTE reprise pour ne régresser aucun type existant.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'rdv_new','rdv_confirmed','rdv_cancelled','rdv_reminder',
    'prescription','claim','system','message',
    'dawini_request','dawini_response',
    'dawini_alert'
  ));

-- Une pharmacie répond disponible=true → toutes les alertes ACTIVES qui
-- matchent (même médicament normalisé + même wilaya que la demande)
-- passent à 'notified' + 1 ligne dans public.notifications par alerte.
-- Précision : si la pharmacie a précisé medicaments_dispo (sous-ensemble),
-- seuls CES médicaments réveillent des alertes — pas toute la demande.
CREATE OR REPLACE FUNCTION public.dawini_alerts_on_available()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wilaya int;
  v_meds   text[];
  v_al     record;
BEGIN
  IF NOT NEW.disponible THEN
    RETURN NEW;
  END IF;

  SELECT r.wilaya_code,
         COALESCE(public.dawini_norm_arr(NEW.medicaments_dispo), r.medicaments_normalized)
    INTO v_wilaya, v_meds
    FROM public.dawini_requests r
   WHERE r.id = NEW.request_id;

  IF v_wilaya IS NULL OR v_meds IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_al IN
    UPDATE public.medication_alerts
       SET status = 'notified', notified_at = now()
     WHERE status = 'active'
       AND wilaya_code = v_wilaya
       AND medication_normalized = ANY (v_meds)
    RETURNING id, patient_id, medication
  LOOP
    -- Formulation conforme 18-07 / doctrine honnêteté : « indiquée par la
    -- pharmacie, à confirmer » — jamais de stock affirmé, jamais de prix.
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_al.patient_id,
      'dawini_alert',
      'Dawini — médicament signalé disponible',
      'Une pharmacie de votre wilaya indique avoir « ' || v_al.medication
        || ' ». Disponibilité indiquée par la pharmacie — à confirmer avant de vous déplacer.',
      jsonb_build_object('alert_id', v_al.id,
                         'request_id', NEW.request_id,
                         'pharmacie_id', NEW.pharmacie_id)
    );
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dawini_alerts_available ON public.dawini_responses;
CREATE TRIGGER trg_dawini_alerts_available
  AFTER INSERT OR UPDATE OF disponible ON public.dawini_responses
  FOR EACH ROW WHEN (NEW.disponible)
  EXECUTE FUNCTION public.dawini_alerts_on_available();


-- ═════════════════════════════════════════════════════════════════════
-- S4 · RADAR — agrégats anonymes (lecture seule)
-- ═════════════════════════════════════════════════════════════════════
-- Aucune donnée personnelle : uniquement wilaya + compteurs + noms de
-- médicaments normalisés. Fenêtre bornée 1..90 jours.

-- Par wilaya : demandes, demandes sans AUCUNE réponse disponible, taux.
CREATE OR REPLACE FUNCTION public.dawini_shortage_by_wilaya(p_days int DEFAULT 30)
RETURNS TABLE (wilaya_code int, demandes bigint, sans_dispo bigint, taux numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.wilaya_code,
         count(*)::bigint AS demandes,
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.dawini_responses x
            WHERE x.request_id = r.id AND x.disponible
         ))::bigint AS sans_dispo,
         round(
           count(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM public.dawini_responses x
              WHERE x.request_id = r.id AND x.disponible
           ))::numeric / count(*), 2
         ) AS taux
    FROM public.dawini_requests r
   WHERE r.created_at >= now() - make_interval(days => LEAST(GREATEST(coalesce(p_days, 30), 1), 90))
   GROUP BY r.wilaya_code
   ORDER BY sans_dispo DESC, demandes DESC;
$$;

-- Top des médicaments demandés SANS réponse disponible (précision : si une
-- pharmacie a répondu dispo sur un sous-ensemble medicaments_dispo, seuls
-- les médicaments COUVERTS sont considérés trouvés).
CREATE OR REPLACE FUNCTION public.dawini_top_missing(p_days int DEFAULT 30, p_wilaya int DEFAULT NULL)
RETURNS TABLE (medication text, demandes bigint, wilayas_touchees bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.med AS medication,
         count(*)::bigint AS demandes,
         count(DISTINCT r.wilaya_code)::bigint AS wilayas_touchees
    FROM public.dawini_requests r
    CROSS JOIN LATERAL unnest(r.medicaments_normalized) AS m(med)
   WHERE r.created_at >= now() - make_interval(days => LEAST(GREATEST(coalesce(p_days, 30), 1), 90))
     AND (p_wilaya IS NULL OR r.wilaya_code = p_wilaya)
     AND m.med <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.dawini_responses x
        WHERE x.request_id = r.id
          AND x.disponible
          AND (x.medicaments_dispo IS NULL
               OR m.med = ANY (public.dawini_norm_arr(x.medicaments_dispo)))
     )
   GROUP BY m.med
   ORDER BY demandes DESC, medication
   LIMIT 20;
$$;

-- Radar = section publique (agrégats anonymes) → anon + authenticated.
GRANT EXECUTE ON FUNCTION public.dawini_shortage_by_wilaya(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawini_top_missing(int, int)   TO anon, authenticated;


-- ═════════════════════════════════════════════════════════════════════
-- S5 · VÉRIFICATIONS (read-only)
-- ═════════════════════════════════════════════════════════════════════
-- 5.1 La normalisation fait son travail (attendu : 'doliprane' ×4)
SELECT public.dawini_norm_text(x) FROM unnest(ARRAY[
  'Doliprane', ' doliprane ', 'DOLIPRANE', 'Doliprané'
]) AS x;

-- 5.2 La colonne dérivée est remplie sur l'existant
SELECT id, medicaments, medicaments_normalized
  FROM public.dawini_requests ORDER BY created_at DESC LIMIT 5;

-- 5.3 Les RPC radar répondent (vides ou pas — jamais d'erreur)
SELECT * FROM public.dawini_shortage_by_wilaya(30);
SELECT * FROM public.dawini_top_missing(30, NULL);

-- 5.4 RLS : la table n'expose rien à anon
--     (dans l'API : select sur medication_alerts avec la clé anon → 0 ligne)


-- ═════════════════════════════════════════════════════════════════════
-- S6 · ROLLBACK COMPLET (décommenter pour tout retirer)
-- ═════════════════════════════════════════════════════════════════════
-- DROP TRIGGER  IF EXISTS trg_dawini_alerts_available ON public.dawini_responses;
-- -- (optionnel) retirer 'dawini_alert' du CHECK : rejouer le DROP+ADD de
-- -- DAWINI_step1 SECTION 5 (liste sans 'dawini_alert').
-- DROP FUNCTION IF EXISTS public.dawini_alerts_on_available();
-- DROP FUNCTION IF EXISTS public.dawini_top_missing(int, int);
-- DROP FUNCTION IF EXISTS public.dawini_shortage_by_wilaya(int);
-- DROP FUNCTION IF EXISTS public.dawini_cancel_alert(uuid);
-- DROP FUNCTION IF EXISTS public.dawini_create_alert(text, int);
-- DROP TABLE    IF EXISTS public.medication_alerts;
-- ALTER TABLE public.dawini_requests DROP COLUMN IF EXISTS medicaments_normalized;
-- DROP FUNCTION IF EXISTS public.dawini_norm_arr(text[]);
-- DROP FUNCTION IF EXISTS public.dawini_norm_text(text);
-- -- (l'extension unaccent peut rester : inoffensive et réutilisable)
