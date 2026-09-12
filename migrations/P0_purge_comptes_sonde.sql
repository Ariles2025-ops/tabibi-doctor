-- ============================================================================
-- P0 — PURGE DES DEUX COMPTES-SONDE CRÉÉS PENDANT LES AUDITS DE SÉCURITÉ
-- ============================================================================
-- Projet   : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Origine  : ETAT_DES_LIEUX.md:83-85 — action n°2 des « Top 5 », jamais faite.
-- Effet    : supprime 2 comptes non maîtrisés d'une base de santé.
--
-- ⚠️ POURQUOI CE FICHIER EXISTE EN PLUS DE PURGE_comptes_test.sql
-- PURGE_comptes_test.sql supprime les comptes par ADRESSE E-MAIL, sur une liste
-- fixe de 5 adresses en @tabibi.doctor. Les deux comptes ci-dessous n'y sont
-- PAS : ils ont été créés par des sondes d'audit, pas par un seed, et l'un
-- porte une adresse en @tabibi.test. Lancer l'autre fichier les laisserait
-- tous les deux en base. Vérifié le 09/09/2026.
--
--   9d419394-0a16-452f-9517-aa01406fae66  probe_1785003856@tabibi.test
--     -> créé involontairement le 25/07/2026 pendant le test de CRIT-5,
--        AVANT l'activation du captcha serveur. C'est la preuve vivante de la
--        faille : un compte que personne n'a voulu créer.
--   9df8df4f-a5b3-4d68-85cf-32ee08a32190  (audit de mai 2026)
--
-- ⚠️ PIÈGE DU SQL EDITOR SUPABASE
-- Chaque clic sur `Run` ouvre une connexion neuve : pas de BEGIN, pas de
-- COMMIT qui traversent deux exécutions. Lancer les étapes UNE PAR UNE, dans
-- l'ordre, et LIRE la sortie de chacune avant de passer à la suivante.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — LECTURE SEULE. Que contient réellement la base ?
-- Ne rien supprimer tant que cette sortie n'a pas été lue.
-- Attendu : 0, 1 ou 2 lignes. Zéro ligne = déjà purgé, s'arrêter là.
-- ────────────────────────────────────────────────────────────────────────────
SELECT id,
       email,
       phone,
       created_at,
       last_sign_in_at,
       CASE WHEN last_sign_in_at IS NULL
            THEN 'jamais connecte'
            ELSE 'S EST CONNECTE — investiguer avant de supprimer'
       END AS signal
  FROM auth.users
 WHERE id IN ('9d419394-0a16-452f-9517-aa01406fae66',
              '9df8df4f-a5b3-4d68-85cf-32ee08a32190');


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — LECTURE SEULE. Ces comptes ont-ils laissé des données derrière eux ?
-- Un compte-sonde ne devrait avoir produit AUCUNE ligne applicative.
-- Si un compte a des rendez-vous, c'est qu'il n'est pas ce qu'on croit : STOP.
-- ────────────────────────────────────────────────────────────────────────────
WITH sondes AS (
  SELECT id FROM auth.users
   WHERE id IN ('9d419394-0a16-452f-9517-aa01406fae66',
                '9df8df4f-a5b3-4d68-85cf-32ee08a32190')
)
SELECT 'public.users'           AS table_visee, count(*) AS lignes FROM public.users           WHERE id         IN (SELECT id FROM sondes)
UNION ALL
SELECT 'public.doctor_profiles',                count(*)           FROM public.doctor_profiles WHERE user_id    IN (SELECT id FROM sondes)
UNION ALL
SELECT 'appointments (patient)',                count(*)           FROM public.appointments    WHERE patient_id IN (SELECT id FROM sondes)
UNION ALL
SELECT 'device_tokens',                         count(*)           FROM public.device_tokens   WHERE user_id    IN (SELECT id FROM sondes);


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — SUPPRESSION. À ne lancer QUE si l'étape 2 ne renvoie que des zéros.
--
-- La clause WHERE cible deux UUID nommément : aucun risque de déborder.
-- RETURNING affiche ce qui a réellement été supprimé — c'est la preuve à
-- conserver. Si RETURNING ne renvoie rien, rien n'a été supprimé.
--
-- auth.users porte des ON DELETE CASCADE vers les tables applicatives : la
-- suppression du compte emporte ses lignes liées. C'est pour cela que l'étape 2
-- doit avoir montré des zéros AVANT.
-- ────────────────────────────────────────────────────────────────────────────
DELETE FROM auth.users
 WHERE id IN ('9d419394-0a16-452f-9517-aa01406fae66',
              '9df8df4f-a5b3-4d68-85cf-32ee08a32190')
RETURNING id, email, phone, created_at;


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 — LECTURE SEULE. Contrôle final : la sortie doit être VIDE.
-- ────────────────────────────────────────────────────────────────────────────
SELECT id, email FROM auth.users
 WHERE id IN ('9d419394-0a16-452f-9517-aa01406fae66',
              '9df8df4f-a5b3-4d68-85cf-32ee08a32190');


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 — LECTURE SEULE. Reste-t-il d'AUTRES comptes de test en production ?
-- Le fonds compte 75 034 fiches : un compte @tabibi.test ou probe_* n'a rien
-- à y faire. À relancer avant le lancement de décembre.
-- ────────────────────────────────────────────────────────────────────────────
SELECT id, email, phone, created_at
  FROM auth.users
 WHERE email ILIKE '%@tabibi.test'
    OR email ILIKE 'probe_%'
    OR email ILIKE '%test%@tabibi.doctor'
 ORDER BY created_at;


-- ============================================================================
-- PAS DE ROLLBACK POSSIBLE
-- ----------------------------------------------------------------------------
-- Une suppression dans auth.users est définitive. C'est pour cela que les
-- étapes 1 et 2 sont en lecture seule et doivent être lues, pas survolées.
--
-- NOTE SUR LA « ROTATION DU MOT DE PASSE FUITÉ »
-- Le mot de passe passé en clair dans l'historique git public appartient au
-- compte medecin.test.desktop@tabibi.doctor (migrations/TEST_seed_medecin_desktop.sql).
-- Ce compte figure dans la liste de PURGE_comptes_test.sql, qui le SUPPRIME.
-- Supprimer vaut mieux que faire tourner : si tu lances cette purge-là, la
-- rotation devient sans objet. Deux actions de la liste P0 n'en font qu'une.
-- Ne conserver ce compte que s'il sert encore aux tests du logiciel desktop —
-- auquel cas il faut alors changer son mot de passe, pas seulement l'ignorer.
-- ============================================================================
