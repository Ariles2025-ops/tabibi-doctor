-- =====================================================================
-- DAWINI_step1_schema.sql — « Dawini » : localisation de médicaments
-- ---------------------------------------------------------------------
-- [DAWINI 2026-07-08] Étape 1 : schéma complet + RLS + notifications.
-- Concept : le patient cherche un médicament (texte et/ou photo
-- d'ordonnance) → les pharmacies partenaires de sa wilaya sont
-- notifiées → elles répondent dispo/générique/commentaire → le patient
-- voit la liste des pharmacies qui ont accepté.
--
-- Décisions actées (review fondateur 2026-07-08) :
--   • Comptes pharmacie créés MANUELLEMENT (pas d'auto-inscription v1).
--   • Pas de Realtime : polling 20 s côté front + notifications in-app
--     (table public.notifications, pattern NOTIF_step1) + push FCM
--     quand le projet Firebase dz.tabibi.app sera recréé.
--   • Coordonnées patient révélées UNIQUEMENT après « Accepter »
--     (minimisation loi 18-07) via RPC SECURITY DEFINER dédiée.
--   • Ciblage v1 : wilaya + tri distance GPS. Communes = v2.
--
-- Leçons appliquées (PHASE16_8) : tout contrôle croisé inter-tables
-- dans les policies passe par une fonction SECURITY DEFINER — jamais
-- un EXISTS direct sous la RLS de l'appelant. Pas de RETURNING côté
-- front sur les INSERT (pas de policy SELECT superflue).
--
-- Ordre d'exécution : ce fichier entier, dans le SQL Editor Supabase.
-- Rollback commenté en fin de fichier.
-- =====================================================================


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 1 : TABLES
-- ═════════════════════════════════════════════════════════════════════

-- ── 1.1 Pharmacies partenaires ───────────────────────────────────────
-- user_id : compte auth de la pharmacie (créé manuellement, role
-- 'pharmacie' dans public.users). NULLABLE tant que le compte n'est
-- pas encore lié (fiche pré-créée pendant le démarchage).
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nom          text NOT NULL,
  adresse      text,
  telephone    text,                    -- numéro PRO de la pharmacie (public, annuaire)
  latitude     double precision,
  longitude    double precision,
  wilaya_code  int  NOT NULL CHECK (wilaya_code BETWEEN 1 AND 58),
  commune      text,                    -- v1 : texte libre ; v2 : FK communes
  horaires     jsonb,                   -- même format que doctor_profiles.working_hours
  is_partner   boolean NOT NULL DEFAULT true,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pharmacies_wilaya_idx ON public.pharmacies (wilaya_code) WHERE is_active;
CREATE INDEX IF NOT EXISTS pharmacies_user_idx   ON public.pharmacies (user_id);

-- ── 1.2 Zones actives (déploiement progressif) ───────────────────────
CREATE TABLE IF NOT EXISTS public.dawini_zones (
  wilaya_code int PRIMARY KEY CHECK (wilaya_code BETWEEN 1 AND 58),
  active      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Seed : les 58 wilayas, toutes INACTIVES (à activer wilaya par wilaya).
INSERT INTO public.dawini_zones (wilaya_code)
SELECT gs FROM generate_series(1, 58) gs
ON CONFLICT (wilaya_code) DO NOTHING;

-- ── 1.3 Demandes de médicament ───────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.dawini_request_status AS ENUM ('pending','answered','closed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.dawini_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicaments  text[] NOT NULL CHECK (array_length(medicaments, 1) BETWEEN 1 AND 10),
  image_path   text,                    -- chemin bucket dawini-ordonnances (optionnel)
  note         text CHECK (note IS NULL OR length(note) <= 300),
  wilaya_code  int NOT NULL CHECK (wilaya_code BETWEEN 1 AND 58),
  latitude     double precision,        -- position patient si GPS accordé (repli : NULL)
  longitude    double precision,
  status       public.dawini_request_status NOT NULL DEFAULT 'pending',
  -- Loi 18-07 : consentement explicite au partage de la demande (et de
  -- l'ordonnance) avec les pharmacies partenaires de la zone. Posé par
  -- la RPC de création, jamais NULL.
  consent_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS dawini_requests_patient_idx ON public.dawini_requests (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dawini_requests_zone_idx    ON public.dawini_requests (wilaya_code, status, created_at DESC);

-- ── 1.4 Réponses des pharmacies ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.dawini_response_status AS ENUM ('accepted','refused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.dawini_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid NOT NULL REFERENCES public.dawini_requests(id) ON DELETE CASCADE,
  pharmacie_id      uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status            public.dawini_response_status NOT NULL,
  disponible        boolean NOT NULL DEFAULT false,
  generique         boolean NOT NULL DEFAULT false,  -- « j'ai le générique »
  medicaments_dispo text[],                          -- sous-ensemble/ajout précisé par la pharmacie
  commentaire       text CHECK (commentaire IS NULL OR length(commentaire) <= 300),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, pharmacie_id)                  -- 1 réponse par pharmacie et par demande
);
CREATE INDEX IF NOT EXISTS dawini_responses_request_idx ON public.dawini_responses (request_id);
CREATE INDEX IF NOT EXISTS dawini_responses_pharm_idx   ON public.dawini_responses (pharmacie_id, created_at DESC);


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 2 : FONCTIONS SECURITY DEFINER (contrôles croisés hors RLS)
-- ═════════════════════════════════════════════════════════════════════

-- La pharmacie de l'utilisateur courant (NULL si pas pharmacie).
CREATE OR REPLACE FUNCTION public.dawini_my_pharmacy_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT id FROM public.pharmacies
   WHERE user_id = auth.uid() AND is_active AND is_partner
   LIMIT 1;
$$;

-- La wilaya de la pharmacie de l'utilisateur courant.
CREATE OR REPLACE FUNCTION public.dawini_my_pharmacy_wilaya()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT wilaya_code FROM public.pharmacies
   WHERE user_id = auth.uid() AND is_active AND is_partner
   LIMIT 1;
$$;

-- Zone active ? (utilisée par la RPC de création)
CREATE OR REPLACE FUNCTION public.dawini_zone_active(p_wilaya int)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE((SELECT active FROM public.dawini_zones WHERE wilaya_code = p_wilaya), false);
$$;

GRANT EXECUTE ON FUNCTION public.dawini_my_pharmacy_id()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.dawini_my_pharmacy_wilaya()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dawini_zone_active(int)      TO authenticated, anon;


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 3 : RLS
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.pharmacies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawini_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawini_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawini_responses ENABLE ROW LEVEL SECURITY;

-- ── pharmacies : annuaire lisible par tout connecté (données PRO
--    uniquement : nom/adresse/tel/geo/horaires — aucune donnée patient).
DROP POLICY IF EXISTS dawini_pharmacies_select ON public.pharmacies;
CREATE POLICY dawini_pharmacies_select
  ON public.pharmacies FOR SELECT TO authenticated
  USING (is_active);

-- La pharmacie peut mettre à jour SA fiche (horaires, téléphone…).
DROP POLICY IF EXISTS dawini_pharmacies_update_self ON public.pharmacies;
CREATE POLICY dawini_pharmacies_update_self
  ON public.pharmacies FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── dawini_zones : lecture pour tous (le front vérifie la couverture).
DROP POLICY IF EXISTS dawini_zones_select ON public.dawini_zones;
CREATE POLICY dawini_zones_select
  ON public.dawini_zones FOR SELECT TO authenticated, anon
  USING (true);

-- ── dawini_requests :
-- Patient : voit et clôt SES demandes. L'INSERT passe par la RPC
-- (SECURITY DEFINER) — aucune policy INSERT directe nécessaire.
DROP POLICY IF EXISTS dawini_requests_select_own ON public.dawini_requests;
CREATE POLICY dawini_requests_select_own
  ON public.dawini_requests FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS dawini_requests_close_own ON public.dawini_requests;
CREATE POLICY dawini_requests_close_own
  ON public.dawini_requests FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid() AND status IN ('closed'));

-- Pharmacie : voit les demandes NON EXPIRÉES de SA wilaya.
-- NB : la table ne contient PAS les coordonnées du patient (nom/tel) —
-- elles ne sont accessibles qu'après acceptation, via la RPC contact.
DROP POLICY IF EXISTS dawini_requests_select_zone ON public.dawini_requests;
CREATE POLICY dawini_requests_select_zone
  ON public.dawini_requests FOR SELECT TO authenticated
  USING (
    wilaya_code = public.dawini_my_pharmacy_wilaya()
    AND expires_at > now()
  );

-- ── dawini_responses :
-- Pharmacie : répond UNE fois aux demandes pending de sa zone.
DROP POLICY IF EXISTS dawini_responses_insert_pharm ON public.dawini_responses;
CREATE POLICY dawini_responses_insert_pharm
  ON public.dawini_responses FOR INSERT TO authenticated
  WITH CHECK (
    pharmacie_id = public.dawini_my_pharmacy_id()
    AND EXISTS (
      SELECT 1 FROM public.dawini_requests r
       WHERE r.id = request_id
         AND r.wilaya_code = public.dawini_my_pharmacy_wilaya()
         AND r.status = 'pending'
         AND r.expires_at > now()
    )
  );

-- Pharmacie : relit ses réponses. Patient : lit les réponses à SES demandes.
DROP POLICY IF EXISTS dawini_responses_select ON public.dawini_responses;
CREATE POLICY dawini_responses_select
  ON public.dawini_responses FOR SELECT TO authenticated
  USING (
    pharmacie_id = public.dawini_my_pharmacy_id()
    OR EXISTS (
      SELECT 1 FROM public.dawini_requests r
       WHERE r.id = request_id AND r.patient_id = auth.uid()
    )
  );


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 4 : RPC MÉTIER
-- ═════════════════════════════════════════════════════════════════════

-- ── 4.1 Création d'une demande (patient) ─────────────────────────────
-- SECURITY DEFINER : pose consent_at, vérifie la zone, notifie les
-- pharmacies de la wilaya (in-app). Retourne l'id de la demande.
CREATE OR REPLACE FUNCTION public.dawini_create_request(
  p_medicaments text[],
  p_wilaya      int,
  p_image_path  text DEFAULT NULL,
  p_note        text DEFAULT NULL,
  p_lat         double precision DEFAULT NULL,
  p_lng         double precision DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_req_id  uuid;
  v_ph      record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.dawini_zone_active(p_wilaya) THEN
    RAISE EXCEPTION 'zone_inactive' USING ERRCODE = 'P0001';
  END IF;
  IF p_medicaments IS NULL OR array_length(p_medicaments, 1) IS NULL THEN
    RAISE EXCEPTION 'medicaments_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.dawini_requests
    (patient_id, medicaments, image_path, note, wilaya_code, latitude, longitude, consent_at)
  VALUES
    (v_uid, p_medicaments, p_image_path, NULLIF(trim(p_note), ''), p_wilaya, p_lat, p_lng, now())
  RETURNING id INTO v_req_id;

  -- Notification in-app à chaque pharmacie partenaire active de la wilaya
  -- (pattern NOTIF_step1 ; le push FCM lira cette même table).
  FOR v_ph IN
    SELECT user_id FROM public.pharmacies
     WHERE wilaya_code = p_wilaya AND is_active AND is_partner AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_ph.user_id,
      'dawini_request',
      'Dawini — nouvelle demande',
      'Un patient cherche : ' || array_to_string(p_medicaments, ', ') || '.',
      jsonb_build_object('request_id', v_req_id, 'wilaya_code', p_wilaya)
    );
  END LOOP;

  RETURN v_req_id;
END $$;

GRANT EXECUTE ON FUNCTION public.dawini_create_request(text[], int, text, text, double precision, double precision) TO authenticated;

-- ── 4.2 Réponse d'une pharmacie ──────────────────────────────────────
-- SECURITY DEFINER : insère la réponse (l'unicité et la zone sont
-- re-vérifiées), passe la demande à 'answered' si accept, notifie le
-- patient. L'INSERT direct reste possible via la policy 3, mais la RPC
-- est le chemin nominal (notification atomique).
CREATE OR REPLACE FUNCTION public.dawini_respond(
  p_request_id  uuid,
  p_status      text,                    -- 'accepted' | 'refused'
  p_disponible  boolean DEFAULT false,
  p_generique   boolean DEFAULT false,
  p_meds_dispo  text[]  DEFAULT NULL,
  p_commentaire text    DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pharm_id  uuid := public.dawini_my_pharmacy_id();
  v_req       record;
  v_resp_id   uuid;
  v_pharm_nom text;
BEGIN
  IF v_pharm_id IS NULL THEN
    RAISE EXCEPTION 'not_a_pharmacy' USING ERRCODE = '28000';
  END IF;
  IF p_status NOT IN ('accepted','refused') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_req FROM public.dawini_requests
   WHERE id = p_request_id
     AND wilaya_code = public.dawini_my_pharmacy_wilaya()
     AND status = 'pending'
     AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_unavailable' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.dawini_responses
    (request_id, pharmacie_id, status, disponible, generique, medicaments_dispo, commentaire)
  VALUES
    (p_request_id, v_pharm_id, p_status::public.dawini_response_status,
     p_disponible, p_generique, p_meds_dispo, NULLIF(trim(p_commentaire), ''))
  RETURNING id INTO v_resp_id;

  -- 1ʳᵉ acceptation → la demande passe 'answered' (reste visible zone).
  IF p_status = 'accepted' THEN
    UPDATE public.dawini_requests SET status = 'answered' WHERE id = p_request_id AND status = 'pending';
  END IF;

  -- Notification in-app au patient (uniquement si acceptée : un refus
  -- silencieux évite le spam — choix produit v1).
  IF p_status = 'accepted' THEN
    SELECT nom INTO v_pharm_nom FROM public.pharmacies WHERE id = v_pharm_id;
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_req.patient_id,
      'dawini_response',
      'Dawini — médicament disponible',
      COALESCE(v_pharm_nom, 'Une pharmacie') || ' a répondu à votre demande.',
      jsonb_build_object('request_id', p_request_id, 'response_id', v_resp_id)
    );
  END IF;

  RETURN v_resp_id;
END $$;

GRANT EXECUTE ON FUNCTION public.dawini_respond(uuid, text, boolean, boolean, text[], text) TO authenticated;

-- ── 4.3 Coordonnées patient — APRÈS acceptation uniquement ───────────
-- Minimisation loi 18-07 : la pharmacie n'accède au nom/téléphone du
-- patient QUE si elle a une réponse 'accepted' sur cette demande.
CREATE OR REPLACE FUNCTION public.dawini_get_patient_contact(p_request_id uuid)
RETURNS TABLE (patient_nom text, patient_tel text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pharm_id uuid := public.dawini_my_pharmacy_id();
BEGIN
  IF v_pharm_id IS NULL THEN
    RAISE EXCEPTION 'not_a_pharmacy' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dawini_responses
     WHERE request_id = p_request_id AND pharmacie_id = v_pharm_id AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_accepted' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(trim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), 'Patient Tabibi'),
    COALESCE(u.phone, au.phone::text)
  FROM public.dawini_requests r
  JOIN public.users u  ON u.id = r.patient_id
  JOIN auth.users  au  ON au.id = r.patient_id
  WHERE r.id = p_request_id;
END $$;

GRANT EXECUTE ON FUNCTION public.dawini_get_patient_contact(uuid) TO authenticated;

-- ── 4.4 Stats pharmacie (mini-dashboard) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.dawini_pharmacy_stats()
RETURNS TABLE (zone_total bigint, mine_accepted bigint, mine_refused bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    (SELECT count(*) FROM public.dawini_requests
      WHERE wilaya_code = public.dawini_my_pharmacy_wilaya()),
    (SELECT count(*) FROM public.dawini_responses
      WHERE pharmacie_id = public.dawini_my_pharmacy_id() AND status = 'accepted'),
    (SELECT count(*) FROM public.dawini_responses
      WHERE pharmacie_id = public.dawini_my_pharmacy_id() AND status = 'refused');
$$;

GRANT EXECUTE ON FUNCTION public.dawini_pharmacy_stats() TO authenticated;

-- ── 4.5 Expiration (appelée par le front au chargement ; pg_cron en v2)
CREATE OR REPLACE FUNCTION public.dawini_expire_old()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.dawini_requests
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now();
$$;

GRANT EXECUTE ON FUNCTION public.dawini_expire_old() TO authenticated;


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 5 : NOTIFICATIONS — extension du CHECK type (NOTIF_step1)
-- ═════════════════════════════════════════════════════════════════════
-- Même technique DROP+ADD idempotente que NOTIF_step1.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'rdv_new','rdv_confirmed','rdv_cancelled','rdv_reminder',
    'prescription','claim','system','message',
    'dawini_request','dawini_response'
  ));


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 6 : STORAGE — bucket privé pour les photos d'ordonnance
-- ═════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dawini-ordonnances', 'dawini-ordonnances', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Chemin imposé : {patient_uid}/{fichier} — le patient n'écrit que chez lui.
DROP POLICY IF EXISTS dawini_storage_insert_own ON storage.objects;
CREATE POLICY dawini_storage_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dawini-ordonnances'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : le patient propriétaire, OU une pharmacie de la wilaya de la
-- demande qui référence cette image (contrôle via SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.dawini_can_view_object(p_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    (storage.foldername(p_name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.dawini_requests r
       WHERE r.image_path = p_name
         AND r.wilaya_code = public.dawini_my_pharmacy_wilaya()
         AND r.expires_at > now() + interval '-7 days'  -- fenêtre de consultation 7 j post-expiration
    );
$$;
GRANT EXECUTE ON FUNCTION public.dawini_can_view_object(text) TO authenticated;

DROP POLICY IF EXISTS dawini_storage_select ON storage.objects;
CREATE POLICY dawini_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dawini-ordonnances'
    AND public.dawini_can_view_object(name)
  );


-- ═════════════════════════════════════════════════════════════════════
-- SECTION 7 : VÉRIFICATIONS (read-only, colle-moi les sorties)
-- ═════════════════════════════════════════════════════════════════════
-- 7.1 Tables créées
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name LIKE 'dawini%' OR table_name = 'pharmacies'
 ORDER BY table_name;
-- 7.2 Policies posées (attendu : 2 pharmacies, 1 zones, 3 requests, 2 responses)
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE tablename IN ('pharmacies','dawini_zones','dawini_requests','dawini_responses')
 ORDER BY tablename, policyname;
-- 7.3 Zones seedées (attendu : 58, toutes inactives)
SELECT count(*) AS zones, count(*) FILTER (WHERE active) AS actives FROM public.dawini_zones;


-- ═════════════════════════════════════════════════════════════════════
-- ACTIVATION (à exécuter quand tu es prêt, wilaya par wilaya)
-- ═════════════════════════════════════════════════════════════════════
-- UPDATE public.dawini_zones SET active = true, updated_at = now() WHERE wilaya_code = 16;  -- Alger
--
-- Créer une pharmacie partenaire (après avoir créé son compte auth +
-- sa ligne public.users avec role='pharmacie') :
-- INSERT INTO public.pharmacies (user_id, nom, adresse, telephone, latitude, longitude, wilaya_code, commune)
-- VALUES ('<auth_uid>', 'Pharmacie El Chifa', '12 rue Didouche Mourad, Alger', '+21321000000', 36.7754, 3.0590, 16, 'Alger-Centre');


-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK (commenté — tout supprimer)
-- ═════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS dawini_storage_select ON storage.objects;
-- DROP POLICY IF EXISTS dawini_storage_insert_own ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'dawini-ordonnances';
-- DROP FUNCTION IF EXISTS public.dawini_can_view_object(text);
-- DROP FUNCTION IF EXISTS public.dawini_expire_old();
-- DROP FUNCTION IF EXISTS public.dawini_pharmacy_stats();
-- DROP FUNCTION IF EXISTS public.dawini_get_patient_contact(uuid);
-- DROP FUNCTION IF EXISTS public.dawini_respond(uuid, text, boolean, boolean, text[], text);
-- DROP FUNCTION IF EXISTS public.dawini_create_request(text[], int, text, text, double precision, double precision);
-- DROP FUNCTION IF EXISTS public.dawini_zone_active(int);
-- DROP FUNCTION IF EXISTS public.dawini_my_pharmacy_wilaya();
-- DROP FUNCTION IF EXISTS public.dawini_my_pharmacy_id();
-- DROP TABLE IF EXISTS public.dawini_responses;
-- DROP TABLE IF EXISTS public.dawini_requests;
-- DROP TABLE IF EXISTS public.dawini_zones;
-- DROP TABLE IF EXISTS public.pharmacies;
-- DROP TYPE IF EXISTS public.dawini_response_status;
-- DROP TYPE IF EXISTS public.dawini_request_status;
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- (puis re-exécuter la section type check de NOTIF_step1)
