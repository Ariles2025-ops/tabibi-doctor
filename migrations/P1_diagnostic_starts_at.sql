-- ============================================================================
-- P1 — DIAGNOSTIC : combien de rendez-vous l'agenda masque-t-il ?
-- ============================================================================
-- Projet   : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Nature   : LECTURE SEULE. Aucun UPDATE, aucun DELETE, aucun DDL.
-- Origine  : constat du 09/09/2026 en croisant le schéma généré et le code v1.
--
-- LE PROBLÈME
-- Le schéma réel de `appointments` contient DEUX colonnes de temps :
--     scheduled_at  timestamptz  NOT NULL
--     starts_at     timestamptz  NULLABLE
--
-- js/tabibi-agenda.js FILTRE et TRIE sur `starts_at` (lignes 198-199)
--        c.from('appointments').select('*')
--         .gte('starts_at', d0.toISOString()).lt('starts_at', d7.toISOString())
--         .order('starts_at', ...)
-- mais AFFICHE `scheduled_at` (lignes 111 et 133)
--        return { id: a.id, start: new Date(a.scheduled_at), ... }
--
-- Conséquence : tout rendez-vous dont `starts_at` est NULL est ABSENT de
-- l'agenda du médecin. Pas d'erreur, pas de message : une case vide. C'est le
-- même mode de panne silencieuse que les « noms patients = Patient ».
--
-- Ce script mesure l'ampleur réelle. La v2 React filtre déjà sur
-- `scheduled_at` (v2/src/domaine/agenda.ts, COLONNE_TEMPS).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Combien de rendez-vous sont invisibles dans l'agenda ?
-- Si `masques_par_l_agenda` vaut 0, le problème est théorique et la correction
-- v2 n'est qu'une mise en cohérence. S'il est > 0, chacun est un rendez-vous
-- qu'un médecin n'a jamais vu.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                    AS total_rdv,
       count(*) FILTER (WHERE starts_at IS NULL)   AS masques_par_l_agenda,
       round(100.0 * count(*) FILTER (WHERE starts_at IS NULL)
             / nullif(count(*), 0), 2)             AS pourcentage,
       min(scheduled_at)                           AS premier_rdv,
       max(scheduled_at)                           AS dernier_rdv
  FROM public.appointments;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Les deux colonnes divergent-elles quand elles sont TOUTES DEUX remplies ?
-- Un écart signifierait que l'agenda affiche une heure et en filtre une autre :
-- un rendez-vous pourrait apparaître le mauvais jour.
-- Attendu : ecarts = 0.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                                        AS deux_colonnes_remplies,
       count(*) FILTER (WHERE scheduled_at <> starts_at)               AS ecarts,
       max(abs(extract(epoch FROM (scheduled_at - starts_at))))         AS ecart_max_secondes
  FROM public.appointments
 WHERE starts_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Le problème est-il ancien ou actif ?
-- Si les NULL sont récents, quelque chose écrit encore des rendez-vous sans
-- `starts_at` — il faut corriger la source, pas seulement la lecture.
-- ────────────────────────────────────────────────────────────────────────────
SELECT date_trunc('month', created_at)             AS mois,
       count(*)                                    AS crees,
       count(*) FILTER (WHERE starts_at IS NULL)   AS sans_starts_at
  FROM public.appointments
 GROUP BY 1
 ORDER BY 1 DESC
 LIMIT 12;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Quels médecins sont concernés ?
-- Sert à prévenir nommément si des rendez-vous réels ont été manqués.
-- ────────────────────────────────────────────────────────────────────────────
SELECT a.doctor_id,
       d.full_name,
       count(*)                                    AS rdv_invisibles,
       min(a.scheduled_at)                         AS du,
       max(a.scheduled_at)                         AS au
  FROM public.appointments a
  LEFT JOIN public.doctor_profiles d ON d.id = a.doctor_id
 WHERE a.starts_at IS NULL
 GROUP BY a.doctor_id, d.full_name
 ORDER BY rdv_invisibles DESC
 LIMIT 20;


-- ============================================================================
-- CE QU'IL FAUT DÉCIDER APRÈS LECTURE
--
-- Si masques_par_l_agenda = 0
--   -> Rien d'urgent. Aligner quand même la v1 sur `scheduled_at`, pour que la
--      colonne qui filtre et celle qui s'affiche soient la même.
--
-- Si masques_par_l_agenda > 0
--   -> 1. Corriger la LECTURE : js/tabibi-agenda.js:198-199 doit filtrer et
--         trier sur `scheduled_at`, comme le fait déjà la v2.
--      2. Vérifier la requête 3 : si des NULL apparaissent encore ce mois-ci,
--         trouver ce qui insère sans `starts_at` et corriger l'ÉCRITURE.
--      3. Décider du sort de `starts_at` : la remplir depuis `scheduled_at`,
--         ou la supprimer. Deux colonnes pour un même fait finissent toujours
--         par diverger — c'est exactement ce qui s'est produit ici.
--         Toute écriture de ce type passe par une validation humaine.
-- ============================================================================
