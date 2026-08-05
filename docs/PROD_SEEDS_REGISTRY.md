# PROD SEEDS REGISTRY — Tabibi.doctor

Liste de tous les seeds SQL qui doivent être exécutés manuellement en prod
sur Supabase SQL Editor après chaque déploiement qui les introduit.

⚠️ ATTENTION : un commit Git ne lance PAS le SQL automatiquement.
Chaque seed listé ici doit être copié-collé dans Supabase SQL Editor
et exécuté à la main.

## Format

| Fichier | Date introduction | Commit | Date exécution prod | Opérateur | Vérif post-exec |
|---|---|---|---|---|---|
| migrations/PHASE4B_seed_claim_test_doctor.sql | 2026-05-21 | 87773c7 | 2026-05-22 (via UPDATE manuel équivalent) | Aghiles | ✅ section 3 du seed OK |
| fixtures/test_doctor_blocages.sql | 2026-05-22 | 881d236 | 2026-05-22 | Aghiles | ✅ 3 fixtures visibles |
| migrations/PHASE5_1bis_alter_appointments.sql | 2026-05-22 | 65cef02 | 2026-05-22 | Aghiles | ✅ Phase 5.1bis schema OK |
| migrations/PHASE5_1bis_get_available_slots_rpc.sql | 2026-05-22 | f7dc5e7 (puis 79a66a0 fix params) | 2026-05-22 | Aghiles | ✅ 10/10 tests RPC OK |
| migrations/PHASE5_1bis_FIX1_appointments_exclude_overlap.sql | 2026-05-22 | d18939b | 2026-05-22 | Aghiles | ✅ Trigger cabinet fixé + EXCLUDE testée (1er INSERT OK, 2e bloqué 23P01) |
| migrations/TEST_seed_medecin_desktop.sql | 2026-07-28 | df462d0 | **2026-07-28 18:08** (renseigné rétroactivement le 2026-08-05) | Aghiles | ⚠️ non vérifié à l'époque — présence constatée a posteriori en base |
| migrations/PURGE_comptes_test.sql | 2026-08-05 | — | **2026-08-05** | Aghiles | ✅ 5 comptes supprimés, fiche legacy 35807 libérée, 0 résiduel |

## Procédure standard

1. Ouvrir Supabase → projet Tabibi (PROD) → SQL Editor
2. Ouvrir le fichier seed depuis le repo local
3. Copier-coller le contenu dans SQL Editor
4. Lire les RAISE NOTICE pour confirmer succès
5. Lancer la requête de vérification (généralement section 3 du seed)
6. Mettre à jour ce REGISTRY avec la date d'exécution + opérateur

## ⚠️ Piège du SQL Editor Supabase — transactions

**Chaque clic sur `Run` ouvre une connexion neuve.** Un script qui commence par
`BEGIN;` sans `COMMIT;` dans le MÊME Run est annulé par ROLLBACK implicite à la
fermeture de la connexion. Un `COMMIT;` envoyé dans un Run suivant s'exécute sur
une autre connexion, ne trouve aucune transaction ouverte, et renvoie
« Success. No rows returned » — **succès trompeur, aucune donnée modifiée.**

Constaté en conditions réelles le 2026-08-05 sur la purge des comptes de test :
le bloc semblait avoir fonctionné, la vérification a montré que rien n'avait bougé.

Règle : **ne pas écrire `BEGIN` / `COMMIT` dans les scripts destinés au SQL Editor.**
Un Run est déjà atomique — si une instruction échoue, tout le Run est annulé.
Terminer chaque script par une requête de contrôle, et la relancer dans un Run
SÉPARÉ pour confirmer que l'écriture a bien été persistée.

## Historique des purges

### 2026-08-05 — purge des comptes de test en production

Contexte : le registre n'avait pas été tenu pour le seed du 2026-07-28, rendant
impossible de savoir depuis le repo si des comptes de test vivaient en prod.
Diagnostic en lecture seule puis purge.

Comptes supprimés (5) : `medecin.test@tabibi.doctor`,
`medecin.test.desktop@tabibi.doctor`, `patient.test.desktop@tabibi.doctor`,
`patient.confirme@tabibi.doctor`, `admin.test@tabibi.doctor`.

**Piège évité** : `medecin.test@tabibi.doctor` détenait la fiche
`55fc0295-b25f-457f-90c0-a28c11ac4eb7`, **`legacy_id = 35807`** — une VRAIE fiche
du fonds de 79k, dans un état incohérent (`is_claimed=false` mais `user_id` non nul).
Elle a été **dé-claimée** (`user_id=NULL`) avant la purge, jamais supprimée.
Les deux fiches soupçonnées dans la documentation (`023bbccc…`, `042f2917…`)
portaient `legacy_id` 1 et 2 : fiches synthétiques, sans valeur.

Deux contraintes en `RESTRICT` bloquaient la suppression et devaient être traitées
d'abord : `cabinets.owner_user_id` et `appointments.patient_id`. Les 37 autres
clés étrangères vers `users` sont en `CASCADE` ou `SET NULL` et se règlent seules.

État vérifié après purge : 41 comptes (contre 46), 0 rendez-vous, 0 cabinet,
0 fiche claimée, 0 fiche incohérente.

Également constaté : le mot de passe `TabibiTest#2026`, en clair dans l'historique
git (commit `df462d0`), portait sur un compte dont la dernière connexion datait du
2026-07-28 22:10 — soit 4 h après sa création, par l'opérateur lui-même. Aucune
connexion tierce. Le compte ayant été supprimé, la rotation est sans objet.
