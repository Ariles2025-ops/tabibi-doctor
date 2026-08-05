-- ═══════════════════════════════════════════════════════════════════════════
-- RATTRAPAGE — noms des comptes créés avant le correctif du trigger
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-08-05
--
-- ⛔ NE PAS EXÉCUTER TEL QUEL. Lire les sections 1 et 2 d'abord.
--    UPDATE de masse sur public.users → règle 3 de CLAUDE.md : proposé, jamais
--    exécuté par l'assistant. C'est TOI qui lances, au SQL Editor.
--
-- CONTEXTE : jusqu'au 2026-07-31, le trigger handle_new_auth_user n'insérait
--   que (id, phone, email, role) — il lisait raw_user_meta_data pour le seul
--   rôle et ignorait first_name / last_name, pourtant envoyés par signUp().
--   Le nom n'était écrit que par l'upsert front de signup.html, qui ne peut
--   tourner qu'APRÈS vérification de l'OTP (la RLS de public.users exige
--   auth.uid() = id). Tout compte abandonné avant l'OTP est donc resté anonyme.
--   Corrigé pour les inscriptions FUTURES par PHASE16_7_trigger_copy_names.sql.
--   Ce fichier traite le stock existant.
--
-- SOURCE : auth.users.raw_user_meta_data, alimenté par signUp(options.data).
--   Aucune donnée n'est inventée : on recopie ce que l'utilisateur a lui-même
--   saisi à l'inscription et qui n'a jamais été transféré.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1 — COMPTAGE (lecture seule, à lancer EN PREMIER)
-- Combien de lignes seraient touchées, et par quoi ?
-- ───────────────────────────────────────────────────────────────────────────

-- 1.a — Vue d'ensemble : où en est le stock ?
SELECT
  count(*)                                                        AS comptes_total,
  count(*) FILTER (WHERE u.first_name IS NOT NULL
                     AND btrim(u.first_name) <> '')               AS avec_prenom_deja,
  count(*) FILTER (WHERE u.phone IS NOT NULL
                     AND btrim(u.phone) <> '')                    AS avec_telephone_deja,
  count(*) FILTER (WHERE u.created_at < DATE '2026-07-31')        AS crees_avant_correctif
FROM public.users u;

-- 1.b — LE CHIFFRE QUI COMPTE : lignes réellement modifiées par l'UPDATE.
--       Compte uniquement les comptes antérieurs au correctif, sans nom en
--       base, ET dont les métadonnées auth contiennent effectivement un nom.
SELECT count(*) AS lignes_qui_seraient_modifiees
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.created_at < DATE '2026-07-31'
  AND (u.first_name IS NULL OR btrim(u.first_name) = '')
  AND (u.last_name  IS NULL OR btrim(u.last_name)  = '')
  AND (
        NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'first_name','')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'last_name' ,'')), '') IS NOT NULL
      );

-- 1.c — Détail nominatif (à relire AVANT d'écrire). Aucune donnée sensible :
--       uniquement ce que l'utilisateur a saisi lui-même à l'inscription.
SELECT u.id,
       u.role,
       u.created_at,
       u.first_name                                        AS prenom_actuel,
       u.last_name                                         AS nom_actuel,
       NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'first_name','')), '') AS prenom_source,
       NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'last_name' ,'')), '') AS nom_source
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.created_at < DATE '2026-07-31'
  AND (u.first_name IS NULL OR btrim(u.first_name) = '')
  AND (u.last_name  IS NULL OR btrim(u.last_name)  = '')
  AND (
        NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'first_name','')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'last_name' ,'')), '') IS NOT NULL
      )
ORDER BY u.created_at;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2 — L'UPDATE (à lancer SEULEMENT après relecture de la section 1)
--
-- Garde-fous en place :
--   • WHERE created_at < 2026-07-31  → n'effleure aucun compte postérieur au
--     correctif du trigger, qui alimente déjà les noms correctement ;
--   • WHERE first_name/last_name vides → N'ÉCRASE JAMAIS un nom existant.
--     Un profil complété par son propriétaire est prioritaire sur les
--     métadonnées d'inscription, qui peuvent être plus anciennes ;
--   • COALESCE(NULLIF(...), colonne) → si une seule des deux métadonnées est
--     présente, l'autre colonne garde sa valeur au lieu d'être écrasée par NULL ;
--   • RETURNING → la sortie liste exactement ce qui a été écrit.
--
-- ⚠️ Lancer d'abord DANS UNE TRANSACTION pour vérifier le RETURNING, puis
--    COMMIT si le compte de lignes correspond à celui de la requête 1.b.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.users u
   SET first_name = COALESCE(
                      NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'first_name','')), ''),
                      u.first_name),
       last_name  = COALESCE(
                      NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'last_name' ,'')), ''),
                      u.last_name)
  FROM auth.users au
 WHERE au.id = u.id
   AND u.created_at < DATE '2026-07-31'
   AND (u.first_name IS NULL OR btrim(u.first_name) = '')
   AND (u.last_name  IS NULL OR btrim(u.last_name)  = '')
   AND (
         NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'first_name','')), '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'last_name' ,'')), '') IS NOT NULL
       )
RETURNING u.id, u.role, u.created_at, u.first_name, u.last_name;

-- Vérifier que le nombre de lignes retournées == résultat de la requête 1.b.
--   correspond   → COMMIT;
--   diverge      → ROLLBACK; et comprendre pourquoi avant de recommencer.

-- COMMIT;
-- ROLLBACK;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3 — APRÈS COUP
--
-- Ce rattrapage ne peut pas tout réparer. Les comptes dont les métadonnées
-- auth sont elles-mêmes vides — inscriptions antérieures à l'envoi de
-- first_name/last_name dans signUp(), ou créés par un autre chemin — resteront
-- sans nom. Aucune source ne les contient, et rien ne doit être inventé.
-- Pour ceux-là, l'agenda affichera le téléphone quand il est connu (chaîne de
-- repli de js/tabibi-agenda.js), sinon « Patient ».
--
-- Contrôle du résultat :
--   SELECT count(*) FILTER (WHERE first_name IS NOT NULL
--                             AND btrim(first_name) <> '') AS avec_prenom,
--          count(*)                                        AS total
--     FROM public.users;
-- ───────────────────────────────────────────────────────────────────────────
