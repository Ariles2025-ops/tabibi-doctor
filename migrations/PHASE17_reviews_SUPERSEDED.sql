-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ SUPERSEDED — NE PAS EXÉCUTER. Conservé comme archive de raisonnement.
-- ═══════════════════════════════════════════════════════════════════════════
-- Archivé le 2026-08-06, après vérification de l'état réel de la production
-- (requête en rôle postgres, résultats communiqués par Aghiles).
--
-- CE FICHIER PROPOSAIT de créer public.reviews. La table EXISTE DÉJÀ en prod
-- — c'est TODO-SQL-011, jamais versionnée — et son modèle est plus complet
-- que celui proposé ici. Le rejouer serait au mieux inutile
-- (CREATE TABLE IF NOT EXISTS), au pire nuisible : les policies ci-dessous
-- s'ajouteraient à un schéma différent de celui qu'elles supposent.
--
-- CE QUE LA PROD A EN PLUS :
--   • notation multi-critères — rating_overall, punctuality, listening,
--     expertise — là où ce fichier ne prévoyait qu'un `rating` unique ;
--   • workflow de modération complet : status, rejection_reason,
--     moderated_by, moderated_at, et une policy admin dédiée
--     (reviews_admin_moderates) ; ici il n'y avait qu'un booléen
--     is_published sans traçabilité de qui publie ni pourquoi ;
--   • signalement communautaire : report_count, last_reported_at — absent
--     de cette proposition ;
--   • fenêtre d'édition patient de 7 jours (reviews_patient_edits_within_7d)
--     au lieu des 48 h proposées ici.
--
-- SÉCURITÉ — vérifiée, aucune fuite :
--   RLS ACTIVE, 7 policies. La lecture anon est bornée par
--   reviews_anyone_reads_published (qual: status='published'), donc rien
--   n'est lisible avant modération. Les grants Supabase par défaut
--   (anon/authenticated/service_role) sont présents mais la RLS filtre —
--   c'est le modèle Supabase standard, pas un défaut.
--   Le REVOKE ALL ... FROM anon proposé plus bas est donc SANS OBJET, et
--   l'appliquer casserait la lecture publique des avis modérés.
--
-- CE QU'IL RESTE RÉELLEMENT À FAIRE, le jour de l'activation :
--   → créer la seule vue public.public_doctor_ratings (elle n'existe pas :
--     /rest/v1/public_doctor_ratings renvoie 404). Seuil de 3 avis conservé —
--     en dessous, une moyenne est statistiquement vide ET ré-identifiante :
--     un praticien ayant reçu un seul avis sait qui l'a laissé s'il n'a vu
--     qu'un patient ce jour-là.
--     Adapter la définition au schéma réel : agréger rating_overall et
--     filtrer sur status = 'published' (et non is_published).
--   → passer le flag `reviews` de js/tabibi-features.js à true.
--
-- ⚠️ AUCUN DES DEUX avant l'avis de l'avocat sur le décret 92-276 — point 4.4
--    de docs/NOTE_CADRAGE_AVOCAT.md : la publication d'avis sur un praticien
--    nommément désigné est-elle seulement admissible en droit algérien ?
--
-- Le contenu original est conservé ci-dessous sans modification, pour la
-- traçabilité du raisonnement de sécurité (seuil, isolation, modération).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 17 — table public.reviews (avis patients)
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Date    : 2026-08-05
--
-- ⛔ NON EXÉCUTÉ. Proposé pour relecture — règle 3 de CLAUDE.md : toute
--    création de table et de policy RLS est validée avant application.
--    LIRE LA SECTION « MODÈLE DE SÉCURITÉ » AVANT D'EXÉCUTER.
--
-- CONTEXTE : doctor-analytics.html affiche « Note moyenne » comme
--    « Bientôt disponible » faute de table reviews. Le flag `reviews` de
--    js/tabibi-features.js vaut false pour la même raison.
--
-- ⚠️ DÉPENDANCE JURIDIQUE NON LEVÉE : le point 4.4 de
--    docs/NOTE_CADRAGE_AVOCAT.md demande à l'avocat si « la publication d'avis
--    de patients sur un praticien nommément désigné est admissible » au regard
--    du décret 92-276, et quel régime de responsabilité pèse sur la plateforme.
--    Cette migration prépare le schéma ; elle ne préjuge pas de la réponse.
--    NE PAS activer le flag `reviews` avant l'avis du conseil.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- MODÈLE DE SÉCURITÉ — à valider explicitement
--
-- Trois principes, dans cet ordre de priorité :
--
--   1. AUCUNE donnée patient n'est exposée publiquement. La table porte
--      patient_id, mais la lecture publique passe EXCLUSIVEMENT par la vue
--      agrégée public_doctor_ratings, qui ne renvoie que (doctor_id, moyenne,
--      nombre). Ni identité, ni commentaire nominatif, ni date individuelle.
--      `anon` n'a AUCUN droit sur la table elle-même.
--
--   2. Un patient ne peut noter QUE ses propres rendez-vous, et seulement
--      PASSÉS. La policy INSERT vérifie les deux dans un WHERE EXISTS sur
--      appointments : a.patient_id = auth.uid() AND a.starts_at < now() AND
--      a.status = 'completed'. Un RDV annulé ou no_show ne donne pas droit à
--      un avis — sinon un patient absent pourrait sanctionner le praticien.
--
--   3. UNIQUE(appointment_id) : un rendez-vous = un avis. Empêche le
--      bourrage par répétition sur la même consultation.
--
-- ⛔ RAPPEL — public.doctor_patients_directory ne doit JAMAIS passer en
--    security_invoker (cf. PHASE16_8). Cette migration ne la touche pas.
--    La vue publique créée ici est un objet DISTINCT, agrégé, sans donnée
--    patient : ne pas confondre les deux.
--
-- CE QUE CE SCHÉMA NE FAIT PAS, délibérément :
--   • aucune modération : un commentaire est publié tel quel dès l'insertion.
--     Sur un site de santé, avec un praticien nommément désigné, c'est un
--     risque de diffamation. La colonne `is_published` par défaut à false est
--     là pour ça — RIEN n'est visible avant passage à true.
--   • aucun droit de réponse du praticien. À prévoir si l'avocat valide le
--     principe des avis.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  doctor_id      uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text NULL CHECK (comment IS NULL OR length(btrim(comment)) BETWEEN 1 AND 1000),
  is_published   boolean NOT NULL DEFAULT false,   -- modération : rien n'est visible par défaut
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_one_per_appointment UNIQUE (appointment_id)
);

COMMENT ON TABLE public.reviews IS
  'Avis patients. Lecture publique UNIQUEMENT via la vue agrégée '
  'public_doctor_ratings — anon n''a aucun droit sur cette table. '
  'is_published=false par défaut : aucun commentaire n''est visible sans '
  'modération explicite.';

CREATE INDEX IF NOT EXISTS reviews_doctor_published_idx
  ON public.reviews (doctor_id) WHERE is_published;
CREATE INDEX IF NOT EXISTS reviews_patient_idx ON public.reviews (patient_id);


-- ── 2. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 2.a — INSERT : un patient note SON rendez-vous, PASSÉ et HONORÉ.
--       `status = 'completed'` exclut volontairement cancelled et no_show :
--       un patient qui ne s'est pas présenté ne peut pas noter le praticien.
CREATE POLICY reviews_insert_own_past_appointment
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.appointments a
       WHERE a.id         = appointment_id
         AND a.patient_id = auth.uid()
         AND a.doctor_id  = doctor_id
         AND a.starts_at  < now()
         AND a.status     = 'completed'
    )
  );

-- 2.b — SELECT : le patient relit SES propres avis, publiés ou non.
CREATE POLICY reviews_select_own
  ON public.reviews FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- 2.c — SELECT : le médecin lit les avis PUBLIÉS le concernant.
--       Il ne voit pas les avis en attente de modération — sinon il pourrait
--       agir sur un patient avant publication.
--       Le patient_id reste dans la ligne : à ne PAS exposer côté front.
CREATE POLICY reviews_select_doctor_published
  ON public.reviews FOR SELECT TO authenticated
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
       WHERE dp.id = doctor_id AND dp.user_id = auth.uid()
    )
  );

-- 2.d — UPDATE : le patient corrige son avis pendant 48 h, tant qu'il n'est
--       pas publié. Au-delà, l'avis est figé.
CREATE POLICY reviews_update_own_recent
  ON public.reviews FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() AND NOT is_published AND created_at > now() - interval '48 hours')
  WITH CHECK (patient_id = auth.uid() AND NOT is_published);

-- 2.e — DELETE : le patient retire son avis tant qu'il n'est pas publié.
CREATE POLICY reviews_delete_own_unpublished
  ON public.reviews FOR DELETE TO authenticated
  USING (patient_id = auth.uid() AND NOT is_published);

-- AUCUNE policy pour `anon` : la table lui est totalement fermée.
REVOKE ALL ON public.reviews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;


-- ── 3. Vue publique AGRÉGÉE — seule surface lisible par anon ───────────────
-- Ne renvoie ni patient_id, ni commentaire, ni date individuelle : impossible
-- de remonter à un patient ou à une consultation depuis cette vue.
-- Seuil de 3 avis : en dessous, une moyenne est à la fois statistiquement
-- vide et ré-identifiante (un praticien avec un seul avis sait qui l'a laissé
-- s'il n'a vu qu'un patient ce jour-là).
CREATE OR REPLACE VIEW public.public_doctor_ratings AS
SELECT r.doctor_id,
       round(avg(r.rating)::numeric, 1) AS note_moyenne,
       count(*)                         AS nb_avis
  FROM public.reviews r
 WHERE r.is_published
 GROUP BY r.doctor_id
HAVING count(*) >= 3;

COMMENT ON VIEW public.public_doctor_ratings IS
  'Notes agrégées par médecin, publiées uniquement, minimum 3 avis. Aucune '
  'donnée patient. Seule surface de la table reviews exposée à anon.';

REVOKE ALL    ON public.public_doctor_ratings FROM anon, authenticated;
GRANT  SELECT ON public.public_doctor_ratings TO   anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION (après exécution)
--
--   -- 1. anon n'a aucun droit sur la table :
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name = 'reviews';
--   -- → `authenticated` uniquement. `anon` ne doit pas apparaître.
--
--   -- 2. RLS active et policies en place :
--   SELECT policyname, cmd, roles FROM pg_policies
--    WHERE tablename = 'reviews' ORDER BY cmd;
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'reviews';  -- → true
--
--   -- 3. La vue agrégée n'expose aucune colonne patient :
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'public_doctor_ratings';
--   -- → doctor_id, note_moyenne, nb_avis. RIEN d'autre.
--
--   -- 4. Test d'isolation : un patient ne peut pas noter le RDV d'un autre.
--   BEGIN;
--     SELECT set_config('request.jwt.claims',
--            json_build_object('sub','<uuid_patient_A>')::text, true);
--     SELECT set_config('role', 'authenticated', true);
--     -- INSERT sur un appointment_id appartenant au patient B → doit ÉCHOUER
--     -- (violation de la policy WITH CHECK).
--   ROLLBACK;
-- ─────────────────────────────────────────────────────────────────────────
