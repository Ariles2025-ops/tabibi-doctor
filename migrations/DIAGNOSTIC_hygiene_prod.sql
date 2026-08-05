-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC — état réel de la prod avant les actions d'hygiène
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-08-05
--
-- ⛔ LECTURE SEULE. Ce fichier ne contient QUE des SELECT.
--    Aucun UPDATE, aucun DELETE, aucun REVOKE, aucun DROP, aucun ALTER.
--    Il est conçu pour être lancé d'un bloc au SQL Editor sans aucun risque.
--    Les actions qui découleront des résultats sont listées en fin de fichier,
--    en commentaire, délibérément NON exécutables.
--
-- POURQUOI : trois actions base attendent une décision, et le repo ne permet
--    pas de trancher — le schéma prod n'est pas versionné (P1 de
--    AUDIT_RESTANT_2026-07-29.md) et docs/PROD_SEEDS_REGISTRY.md s'arrête au
--    2026-05-22, en violation de sa propre procédure. On regarde avant d'agir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Droits de la RPC exposée à anon
--
-- CE QU'ON CHERCHE : la présence de 'anon=X/postgres' dans proacl. `X` est le
--   privilège EXECUTE. S'il y est, n'importe quel visiteur non authentifié peut
--   appeler match_doctor_for_claim(p_legacy_id BIGINT, p_email TEXT) — une RPC
--   qui répond « ce médecin existe / n'existe pas » sur un couple id/email,
--   donc un oracle d'énumération sur le fonds de 79 700 fiches.
--
-- CE QU'ON EN FERA : si 'anon=X' est présent, appliquer le REVOKE proposé dans
--   AUDIT_RESTANT_2026-07-29.md:89-101 (fichier sur la branche hygiene/p0).
--   Si absent, l'item est déjà clos et l'audit doit être mis à jour.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT proname,
       pg_get_function_identity_arguments(oid) AS args,
       proacl
  FROM pg_proc
 WHERE proname = 'match_doctor_for_claim';

-- Lecture plus explicite du même ACL, ligne par rôle :
SELECT p.proname,
       a.grantee_role,
       a.privilege
  FROM pg_proc p
  CROSS JOIN LATERAL aclexplode(p.proacl) ae
  CROSS JOIN LATERAL (
        SELECT pg_get_userbyid(ae.grantee) AS grantee_role,
               ae.privilege_type            AS privilege
  ) a
 WHERE p.proname = 'match_doctor_for_claim'
 ORDER BY a.grantee_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Comptes de test présents en base
--
-- CE QU'ON CHERCHE : quels comptes de test survivent en production, et surtout
--   leur last_sign_in_at. Le mot de passe du compte médecin de test a fuité en
--   clair dans un repo alors PUBLIC (migrations/TEST_seed_medecin_desktop.sql,
--   item P0 de AUDIT_RESTANT). Il a été tourné depuis, mais personne n'a jamais
--   vérifié si quelqu'un s'en était servi entre-temps. C'est la question qu'on
--   ne s'était pas posée : last_sign_in_at y répond.
--
-- CE QU'ON EN FERA :
--   • last_sign_in_at postérieur à la publication du seed et non expliqué par
--     nos propres tests → incident de sécurité, à traiter comme tel (revue des
--     accès, notification si des données réelles ont été touchées).
--   • comptes orphelins confirmés → suppression, mais SEULEMENT après la
--     section 4 : l'un d'eux a claimé une vraie fiche du fonds.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT id,
       email,
       phone,
       created_at,
       last_sign_in_at,
       CASE
         WHEN last_sign_in_at IS NULL THEN 'jamais connecté'
         ELSE 'connecté — vérifier la date'
       END AS lecture
  FROM auth.users
 WHERE id IN (
         '9d419394-0a16-452f-9517-aa01406fae66',  -- probe_1785003856@tabibi.test, créé involontairement le 25/07
         '9df8df4f-a5b3-4d68-85cf-32ee08a32190'   -- ancien compte de test, audit de mai
       )
    OR email = 'medecin.test@tabibi.doctor'
    OR phone IN ('213555000000', '213555000001')  -- seed desktop : médecin + patient
 ORDER BY created_at;

-- Filet : d'autres comptes de test auraient-ils échappé à la liste ci-dessus ?
SELECT id, email, phone, created_at, last_sign_in_at
  FROM auth.users
 WHERE email ILIKE '%test%'
    OR email ILIKE '%probe%'
    OR email ILIKE '%@tabibi.test'
    OR phone LIKE '21355500%'
 ORDER BY created_at;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — Le seed desktop a-t-il été exécuté en prod ?
--
-- CE QU'ON CHERCHE : la trace des enregistrements que
--   migrations/TEST_seed_medecin_desktop.sql aurait créés. Le registre
--   docs/PROD_SEEDS_REGISTRY.md devait consigner toute exécution ; il s'arrête
--   au 2026-05-22 et ne mentionne pas ce seed. Sa propre procédure n'a donc pas
--   été suivie, et le repo ne permet pas de trancher.
--
-- CE QU'ON EN FERA :
--   • 0 partout → le seed n'a jamais tourné en prod, rien à nettoyer, et le
--     registre est simplement incomplet (à corriger, sans urgence).
--   • enregistrements présents → nettoyage à planifier ET registre à mettre à
--     jour rétroactivement, en notant que la traçabilité a été perdue.
-- ═══════════════════════════════════════════════════════════════════════════

-- 3.a — La fiche médecin de test
SELECT id, full_name, specialty_fr, user_id, is_claimed, is_active, created_at
  FROM public.doctor_profiles
 WHERE full_name ILIKE '%TEST%Desktop%'
    OR full_name ILIKE 'Dr TEST%'
 ORDER BY created_at;

-- 3.b — Les 7 rendez-vous préfixés 'TEST '
SELECT count(*)                    AS nb_appointments_test,
       min(starts_at)              AS premier,
       max(starts_at)              AS dernier
  FROM public.appointments
 WHERE reason_short LIKE 'TEST %'
    OR reason       LIKE 'TEST %';

-- Détail, pour savoir à quelle fiche ils sont rattachés :
SELECT a.id, a.doctor_id, a.patient_id, a.starts_at, a.status,
       COALESCE(a.reason_short, a.reason) AS motif
  FROM public.appointments a
 WHERE a.reason_short LIKE 'TEST %'
    OR a.reason       LIKE 'TEST %'
 ORDER BY a.starts_at;

-- 3.c — Le créneau d'indisponibilité du seed
SELECT id, doctor_id, starts_at, ends_at, reason
  FROM public.doctor_unavailable_slots
 WHERE reason ILIKE '%TEST%'
 ORDER BY starts_at;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Le piège « Ouanza Dental Clinic »
--
-- ⚠️⚠️ AVERTISSEMENT — À LIRE AVANT TOUTE ACTION SUR CES DEUX LIGNES ⚠️⚠️
--
--   « Ouanza Dental Clinic » est une VRAIE fiche du fonds de 79 700 praticiens.
--   Elle n'a pas été créée pour les tests : elle a été REVENDIQUÉE par un compte
--   de test, ce qui n'est pas la même chose.
--
--   Le nettoyage correct est une DÉ-REVENDICATION :
--       user_id = NULL, is_claimed = false
--   JAMAIS un DELETE. Supprimer la ligne détruirait une donnée du fonds, qu'on
--   ne saurait pas reconstituer — le scraping d'origine n'est pas rejouable à
--   l'identique.
--
--   Corollaire pour la section 2 : ne pas supprimer le compte de test qui la
--   détient avant d'avoir dé-revendiqué la fiche, sous peine de laisser un
--   user_id pointant vers un compte inexistant.
--
-- CE QU'ON CHERCHE : deux uuid DIFFÉRENTS sont documentés comme « la fiche
--   claimée par medecin.test ». L'un des deux documents a tort, ou les deux
--   fiches existent et une seule est concernée.
--     023bbccc-e2ba-45ad-8c9a-8fca85da18fa  tests/manual/PHASE5_1bis_RPC_TESTS.md:10,17
--     042f2917-4356-4859-91b9-64ffdde1e292  migrations/TEST_booking_e2e_parcours.sql:33
--
-- CE QU'ON EN FERA : identifier laquelle est réellement revendiquée par un
--   compte de test, la dé-revendiquer, et corriger le document fautif pour que
--   la prochaine personne ne se trompe pas de ligne.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT dp.id,
       dp.full_name,
       dp.legacy_id,
       dp.is_claimed,
       dp.user_id,
       dp.is_active,
       (SELECT count(*) FROM public.appointments a WHERE a.doctor_id = dp.id) AS nb_appointments,
       au.email  AS email_du_detenteur,
       au.phone  AS phone_du_detenteur
  FROM public.doctor_profiles dp
  LEFT JOIN auth.users au ON au.id = dp.user_id
 WHERE dp.id IN (
         '023bbccc-e2ba-45ad-8c9a-8fca85da18fa',
         '042f2917-4356-4859-91b9-64ffdde1e292'
       );

-- Filet : la fiche est-elle identifiable par son nom, si aucun des deux uuid
-- ne correspond ?
SELECT id, full_name, legacy_id, is_claimed, user_id, is_active
  FROM public.doctor_profiles
 WHERE full_name ILIKE '%Ouanza%';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — Comptage du rattrapage des noms
--
-- CE QU'ON CHERCHE : combien de lignes seraient réellement modifiées par
--   migrations/RATTRAPAGE_noms_patients.sql. Requête reprise à l'identique de
--   sa section 1.b, pour que ce diagnostic soit lançable d'un seul bloc.
--   Comptes antérieurs au correctif du trigger, sans nom en base, ET dont les
--   métadonnées auth en contiennent effectivement un.
--
-- CE QU'ON EN FERA : ce chiffre est celui à confronter au RETURNING de
--   l'UPDATE. S'ils divergent, ROLLBACK et comprendre avant de recommencer.
-- ═══════════════════════════════════════════════════════════════════════════

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

-- Contexte : où en est le stock global ?
SELECT count(*)                                                   AS comptes_total,
       count(*) FILTER (WHERE first_name IS NOT NULL
                          AND btrim(first_name) <> '')            AS avec_prenom,
       count(*) FILTER (WHERE phone IS NOT NULL
                          AND btrim(phone) <> '')                 AS avec_telephone
  FROM public.users;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — Policies RLS réellement en place
--
-- CE QU'ON CHERCHE : la définition exacte des policies sur les trois tables
--   qui portent des données personnelles. AUCUNE n'est versionnée dans le repo
--   — c'est le P1 « schéma prod non versionné » de
--   AUDIT_RESTANT_2026-07-29.md:54. Tant que ce dump n'existe pas, une
--   modification de RLS en prod est indétectable en revue, et l'affirmation
--   « les 94 policies scopent par auth.uid() » (CLAUDE.md) n'est vérifiable
--   par personne.
--
-- CE QU'ON EN FERA : la sortie de cette section devient
--   migrations/PROD_RLS_DUMP.sql, versionné. Première brique pour fermer le P1.
--   Ensuite seulement, le test cross-user A↔B pourra être considéré comme
--   reproductible.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual        AS condition_using,
       with_check  AS condition_with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('users', 'doctor_profiles', 'appointments')
 ORDER BY tablename, cmd, policyname;

-- La RLS est-elle seulement ACTIVE sur ces tables ? Une policy sur une table
-- dont la RLS est désactivée ne protège rien.
SELECT c.relname                AS table_name,
       c.relrowsecurity         AS rls_active,
       c.relforcerowsecurity    AS rls_forcee,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS nb_policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('users', 'doctor_profiles', 'appointments')
 ORDER BY c.relname;

-- Vue d'ensemble : quelles tables publiques n'ont AUCUNE policy ?
SELECT c.relname AS table_sans_policy, c.relrowsecurity AS rls_active
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND NOT EXISTS (SELECT 1 FROM pg_policies p
                    WHERE p.schemaname = 'public' AND p.tablename = c.relname)
 ORDER BY c.relname;


-- ═══════════════════════════════════════════════════════════════════════════
-- ACTIONS QUI DÉCOULERONT DES RÉSULTATS
--
-- Aucune n'est écrite en SQL exécutable dans ce fichier — c'est délibéré.
-- Chacune fera l'objet d'un script dédié, relu en PR, exécuté par l'humain.
--
--   § 1  RPC anon
--        'anon=X/postgres' présent  → REVOKE EXECUTE ... FROM anon
--                                     (script AUDIT_RESTANT:89-101), puis
--                                     re-test du parcours de claim, qui passe
--                                     par un utilisateur authentifié.
--        absent                     → item déjà clos ; mettre à jour l'audit,
--                                     qui l'annonce encore comme ouvert.
--
--   § 2  Comptes de test
--        last_sign_in_at non expliqué par nos tests → incident de sécurité :
--                                     revue des accès sur la période, et
--                                     évaluation de ce qui a pu être lu.
--        comptes orphelins confirmés → suppression, MAIS après le § 4.
--        aucune connexion            → suppression simple, sans autre suite.
--
--   § 3  Seed desktop
--        0 enregistrement           → rien à nettoyer ; compléter
--                                     PROD_SEEDS_REGISTRY.md pour acter que le
--                                     seed n'a jamais tourné en prod.
--        enregistrements présents   → script de nettoyage dédié + mise à jour
--                                     rétroactive du registre, en notant que la
--                                     traçabilité a été perdue entre le 22/05
--                                     et aujourd'hui.
--
--   § 4  Ouanza Dental Clinic
--        DÉ-REVENDICATION uniquement : user_id = NULL, is_claimed = false.
--        JAMAIS de DELETE — c'est une vraie fiche du fonds de 79 700.
--        Ordre imposé : dé-revendiquer AVANT de supprimer le compte de test
--        du § 2, sinon user_id pointe vers un compte inexistant.
--        Corriger ensuite le document qui cite le mauvais uuid.
--
--   § 5  Rattrapage des noms
--        Le chiffre obtenu est la référence à confronter au RETURNING de
--        migrations/RATTRAPAGE_noms_patients.sql. Divergence → ROLLBACK.
--
--   § 6  Policies RLS
--        La sortie devient migrations/PROD_RLS_DUMP.sql, versionné.
--        Toute table publique sans policy remontée par la dernière requête est
--        à examiner immédiatement : c'est une table lisible par tout porteur de
--        la clé anon, laquelle est publique par conception.
-- ═══════════════════════════════════════════════════════════════════════════
