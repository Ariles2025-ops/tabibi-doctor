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

## Procédure standard

1. Ouvrir Supabase → projet Tabibi (PROD) → SQL Editor
2. Ouvrir le fichier seed depuis le repo local
3. Copier-coller le contenu dans SQL Editor
4. Lire les RAISE NOTICE pour confirmer succès
5. Lancer la requête de vérification (généralement section 3 du seed)
6. Mettre à jour ce REGISTRY avec la date d'exécution + opérateur
