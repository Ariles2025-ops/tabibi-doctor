-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 16.8 — public.doctor_patients_directory : mise sous contrôle de version
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-08-05
--
-- POURQUOI CE FICHIER : la vue existe en production depuis le 2026-07-29 mais
--           n'a JAMAIS été versionnée. Elle a été créée à la main au SQL Editor.
--           Conséquence : une modification côté base — y compris destructrice —
--           serait invisible en revue de code. Ce fichier fait de la définition
--           prod une référence opposable, diffable, relisible en PR.
--           Il TRACE l'existant : rien de nouveau n'est introduit ici.
--
-- RÔLE    : résoudre nom + téléphone des patients dans les trois surfaces
--           médecin — agenda (js/tabibi-agenda.js), tableau de bord
--           (doctor-dashboard.html) et messagerie (js/tabibi-messaging.js).
--           Avant elle, ces surfaces lisaient public.users, dont la RLS scope
--           par auth.uid() : un médecin n'y voit que SA propre ligne. L'échec
--           était silencieux et tous les RDV affichaient « Patient ».
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ RÈGLE ABSOLUE — JAMAIS `security_invoker = true` SUR CETTE VUE
-- ═══════════════════════════════════════════════════════════════════════════
-- En security_invoker, la RLS de public.users s'appliquerait à l'appelant : la
-- vue renverrait 0 ligne, et le front retomberait sur « Patient » SANS erreur.
-- La régression serait donc totalement invisible — ni exception, ni log, ni
-- ticket. C'est exactement le bug qu'on a mis deux sessions à diagnostiquer.
--
-- L'item d'hygiène Phase 12 « aligner les vues sur security_invoker=true »
-- (SQL_TODO.md) porte une exception explicite pour cette vue. Si quelqu'un
-- automatise un jour cet alignement, cette vue DOIT être exclue de la boucle.
--
-- POURQUOI C'EST SÛR MALGRÉ TOUT :
--   • le filtre WHERE EXISTS (… dp.user_id = auth.uid()) est DANS la vue et
--     s'évalue avec le JWT de l'appelant — auth.uid() est une variable de
--     session, pas un privilège ; un médecin ne voit que les patients ayant
--     au moins un RDV avec lui ;
--   • aucune donnée médicale : matricule, chifa, antécédents et allergies
--     vivent dans patient_medical_data, derrière ses propres RPC ;
--   • email volontairement exclu des colonnes (énumération / phishing) ;
--   • GRANT SELECT à `authenticated` seulement, REVOKE explicite pour `anon` ;
--   • divulgation marginale nulle : le médecin lit déjà appointments, il
--     détient donc déjà les patient_id — la vue ne fait que traduire des UUID
--     qu'il possède.
--
-- Idempotent : CREATE OR REPLACE + REVOKE/GRANT rejouables sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.doctor_patients_directory AS
SELECT DISTINCT u.id, u.first_name, u.last_name, u.phone
  FROM public.users u
 WHERE EXISTS (
         SELECT 1
           FROM public.appointments a
           JOIN public.doctor_profiles dp ON dp.id = a.doctor_id
          WHERE a.patient_id = u.id
            AND dp.user_id = auth.uid()
       );

REVOKE ALL    ON public.doctor_patients_directory FROM anon, authenticated;
GRANT  SELECT ON public.doctor_patients_directory TO   authenticated;

COMMENT ON VIEW public.doctor_patients_directory IS
  'Identité minimale (nom, téléphone) des patients ayant au moins un RDV avec le '
  'médecin connecté. Filtrage par auth.uid() DANS la vue. '
  '⛔ NE JAMAIS passer en security_invoker=true : la RLS de public.users '
  's''appliquerait à l''appelant, la vue renverrait 0 ligne et la régression '
  'serait invisible (le front retombe silencieusement sur « Patient »). '
  'Voir migrations/PHASE16_8_view_doctor_patients_directory.sql';

-- ─────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION (après exécution)
--
--   -- 1. La vue n'est PAS en security_invoker :
--   SELECT c.relname,
--          COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
--                     WHERE option_name = 'security_invoker'), 'false') AS security_invoker
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relname = 'doctor_patients_directory';
--   -- → security_invoker doit valoir 'false' (ou être absent).
--
--   -- 2. Les droits sont corrects :
--   SELECT grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_name = 'doctor_patients_directory';
--   -- → `authenticated` / SELECT uniquement. `anon` ne doit pas apparaître.
--
--   -- 3. Isolation cross-médecin (à relancer après toute modification de la
--   --    RLS de public.users ou de cette vue). Deux user_id de doctor_profiles
--   --    DISTINCTS ; l'intersection des id renvoyés doit être vide alors que
--   --    chacun voit bien ses propres patients :
--   BEGIN;
--     SELECT set_config('request.jwt.claims',
--            json_build_object('sub','<uuid_medecin_A>')::text, true);
--     SELECT set_config('role', 'authenticated', true);
--     SELECT id FROM public.doctor_patients_directory ORDER BY id;
--
--     SELECT set_config('request.jwt.claims',
--            json_build_object('sub','<uuid_medecin_B>')::text, true);
--     SELECT id FROM public.doctor_patients_directory ORDER BY id;
--   ROLLBACK;
-- ─────────────────────────────────────────────────────────────────────────
