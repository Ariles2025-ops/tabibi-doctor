-- [FIX 2026-07-04] waiting_list : anon ne pouvait pas s'inscrire (RLS 42501).
-- La table a été recréée sans policy INSERT (l'ancienne wl_insert_anon du dump
-- 2026-06-07 a disparu) -> formulaire waiting-list.html mort même après les
-- fixes front (f7c8e4b). Payload front : {email, wilaya, source, lang, user_agent}.
-- Choix : policy contrôlée (vs RPC/edge service_role) — zéro pièce mobile en plus,
-- l'anti-bot reste Turnstile fail-closed côté front. WITH CHECK durci : format
-- email + caps de longueur (anti-junk si appel REST direct hors formulaire).
-- SELECT / UPDATE / DELETE restent fermés pour anon (aucune policy).
-- NB schéma : role est NOT NULL en prod (23502 sondé le 2026-07-05) — le
-- formulaire DOIT l'envoyer (waiting-list.html envoie role:'patient').
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can join waiting list" ON public.waiting_list;
CREATE POLICY "Anyone can join waiting list"
  ON public.waiting_list FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'   -- même regex que le front (waiting-list.html L845)
    AND length(email) <= 254                                     -- RFC 5321
    AND (wilaya     IS NULL OR length(wilaya)     <= 120)
    AND (source     IS NULL OR length(source)     <= 100)
    AND (lang       IS NULL OR length(lang)       <= 8)
    AND (user_agent IS NULL OR length(user_agent) <= 300)        -- le front tronque à 200
  );

-- OPTIONNEL 1 — compteur public pour les stats de la page.
-- waiting-list.html L793 lit waiting_list_count.total_count ; en prod seule
-- waiting_list_stats existe (non GRANTée à anon) -> le front retombe sur "500+".
-- Cette vue n'expose QUE l'agrégat (jamais les emails). Supprimer ce bloc si
-- le chiffre réel ne doit pas être public avant le lancement.
CREATE OR REPLACE VIEW public.waiting_list_count AS
  SELECT count(*)::int AS total_count FROM public.waiting_list;
GRANT SELECT ON public.waiting_list_count TO anon, authenticated;

-- OPTIONNEL 2 — dédoublonnage : le front traite 23505 comme "déjà inscrit"
-- (waiting-list.html L886). DÉJÀ ACTIF EN PROD (409/23505 constaté le
-- 2026-07-05 sur une réinscription) — décommenté pour que le repo reflète
-- la prod ; IF NOT EXISTS rend le rejeu sans effet.
CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_email_unique
  ON public.waiting_list (lower(email));
