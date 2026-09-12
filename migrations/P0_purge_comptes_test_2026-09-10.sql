-- ============================================================================
-- P0 — COMPTES DE TEST EN PRODUCTION : état au 10/09/2026 et purge
-- ============================================================================
-- Les deux comptes-sonde visés par P0_purge_comptes_sonde.sql (9d419394…, 9df8df4f…)
-- N'EXISTENT PLUS dans auth.users (SELECT du 10/09) : ce P0-là est soldé.
-- Restent 8 comptes dont l'adresse contient « test » ou est en @tabibi.doctor de
-- test. IDENTIFIER AVANT DE SUPPRIMER : l'un d'eux (…@gmail.com, medecin,
-- 23/05) est probablement un compte réel du fondateur ; il n'est PAS dans la
-- liste ci-dessous. Un autre (caafe826…, medecin, tél. renseigné, 4 documents
-- dans doctor-docs) est le seul compte à avoir déposé des pièces : ce sont des
-- pièces de test, sauvegardées le 10/09 (copie chiffrée).
--
-- ÉTAPE 1 — LECTURE SEULE : les 7 comptes candidats (e-mails masqués ici, en
-- clair dans ta sortie).
select u.id, u.email, u.created_at::date, u.last_sign_in_at::date, p.role, p.is_test,
       (select count(*) from public.appointments a where a.patient_id = u.id) rdv_patient,
       (select count(*) from public.doctor_profiles d where d.user_id = u.id) fiches_liees,
       (select count(*) from storage.objects o where o.owner = u.id) objets
  from auth.users u left join public.users p on p.id = u.id
 where u.id in ('8df687ca-1759-42e8-a937-ecd7fded5af2','059fffc9-0287-4e14-a01c-be7c9a4c6151',
                'ca3ebcd0-b2de-4f32-b69e-9bc4c2fcf977','1ab3f31f-d6b8-4019-9eeb-55275974df6d',
                'caafe826-a268-4942-a735-9650a5ae5ef0','5bd8950a-8a06-4455-8840-fc3a329807a4',
                '59658801-2d35-4aef-a765-88c44e70b92a')
 order by u.created_at;
-- Attendu : rdv_patient = 0 et fiches_liees = 0 partout (mesuré le 10/09). Si non : STOP.

-- ÉTAPE 2 — les 4 objets doctor-docs de caafe826… : à supprimer depuis le tableau de
-- bord Storage (pas par DELETE SQL), APRÈS confirmation que la copie chiffrée du
-- 10/09 se déchiffre (fait : 5/5).

-- ÉTAPE 3 — SUPPRESSION (retire de la liste tout compte que tu veux garder, par
-- exemple 8df687ca… si le patient is_test sert encore aux tests).
delete from auth.users
 where id in ('8df687ca-1759-42e8-a937-ecd7fded5af2','059fffc9-0287-4e14-a01c-be7c9a4c6151',
              'ca3ebcd0-b2de-4f32-b69e-9bc4c2fcf977','1ab3f31f-d6b8-4019-9eeb-55275974df6d',
              'caafe826-a268-4942-a735-9650a5ae5ef0','5bd8950a-8a06-4455-8840-fc3a329807a4',
              '59658801-2d35-4aef-a765-88c44e70b92a')
returning id, email, created_at;

-- ÉTAPE 4 — CONTRÔLE : la requête de l'étape 1 doit être vide, et celle-ci aussi :
select id, email from auth.users
 where email ilike '%@tabibi.test' or email ilike 'probe_%' or email ilike '%test%@tabibi.doctor';
-- ============================================================================
