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

## Procédure standard

1. Ouvrir Supabase → projet Tabibi (PROD) → SQL Editor
2. Ouvrir le fichier seed depuis le repo local
3. Copier-coller le contenu dans SQL Editor
4. Lire les RAISE NOTICE pour confirmer succès
5. Lancer la requête de vérification (généralement section 3 du seed)
6. Mettre à jour ce REGISTRY avec la date d'exécution + opérateur