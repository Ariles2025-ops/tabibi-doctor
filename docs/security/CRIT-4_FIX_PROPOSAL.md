# CRIT-4 — Fix Proposal : doctor_profiles RLS Exposure
**Date** : 2026-05-29 (révision v2 — sécurité maximale)
**Branche** : security/fix-doctor-profiles-rls  
**Auteur** : Audit sécurité Tabibi  
**Criticité** : 🔴 CRIT — Données personnelles exposées à `anon`

---

## 1. Diagnostic complet

### 1.1 La faille

La table `public.doctor_profiles` est accessible directement via l'API REST Supabase
(`/rest/v1/doctor_profiles`) par n'importe qui sans authentification (rôle `anon`).

```bash
# Preuve : curl sans token renvoie des données
curl "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/doctor_profiles?select=*&limit=1" \
  -H "apikey: <ANON_KEY>"
# → Retourne un row complet dont phone, email, address, user_id
```

**Volume exposé** : 79 746 fiches médecins

### 1.2 Colonnes de doctor_profiles

La table comporte 38+ colonnes. Classification (version v2 — maximale) :

| Colonne | Type | Sensibilité | GRANT anon v2 |
|---|---|---|---|
| `id` | UUID | Public | ✅ Accordé |
| `legacy_id` | TEXT/INT | Public | ✅ Accordé |
| `full_name` | TEXT | Public | ✅ Accordé |
| `entity_type` | TEXT | Public | ✅ Accordé |
| `specialty_id` | UUID | Public | ✅ Accordé |
| `wilaya_code` | TEXT | Public | ✅ Accordé |
| `photo_url` | TEXT | Public | ✅ Accordé |
| `rating` | NUMERIC | Public | ✅ Accordé |
| `review_count` | INT | Public | ✅ Accordé |
| `consultation_fee_dzd` | INT | Public | ✅ Accordé |
| `bio` | TEXT | Public | ✅ Accordé |
| `languages` | TEXT[] | Public | ✅ Accordé |
| `accepts_chifa` | BOOL | Public | ✅ Accordé |
| `accepts_card` | BOOL | Public | ✅ Accordé |
| `accepts_cash` | BOOL | Public | ✅ Accordé |
| `telehealth_enabled` | BOOL | Public | ✅ Accordé |
| `telehealth_fee_dzd` | INT | Public | ✅ Accordé |
| `working_hours` | JSONB | Public | ✅ Accordé |
| `is_claimed` | BOOL | Public | ✅ Accordé |
| `is_active` | BOOL | Public | ✅ Accordé |
| `is_verified` | BOOL | Public | ✅ Accordé |
| `validation_status` | TEXT | Public | ✅ Accordé |
| `source` | TEXT | Public | ✅ Accordé |
| `updated_at` | TIMESTAMPTZ | Public | ✅ Accordé |
| `created_at` | TIMESTAMPTZ | Public | ✅ Accordé |
| **`address`** | **TEXT** | **🔴 Sensible** (peut être domicile médecin solo) | **🚫 Bloqué** |
| **`email`** | **TEXT** | **🔴 Sensible** (PII, extractible en masse) | **🚫 Bloqué** |
| **`phone`** | **TEXT** | **🔴 Sensible** (téléphone personnel) | **🚫 Bloqué** |
| **`user_id`** | **UUID** | **🔴 Critique** (FK vers auth.users — corrélation d'identité) | **🚫 Bloqué** |
| **`claimed_by_user_id`** | **UUID** | **🔴 Critique** (idem) | **🚫 Bloqué** |
| **`claimed_at`** | **TIMESTAMPTZ** | **⚠️ Sensible** (timestamp interne) | **🚫 Bloqué** |
| **`validation_docs_uploaded_at`** | **TIMESTAMPTZ** | **⚠️ Sensible** (flux interne) | **🚫 Bloqué** |
| **`search_vector`** | **TSVECTOR** | **⚠️ Inutile pour anon** (index FTS interne) | **🚫 Bloqué** |

### 1.3 Architecture des vues (chaîne d'accès publique)

```
anon
 │
 ├─ REST /rest/v1/doctor_profiles        ← 🔴 FAILLE (accès direct, TOUTES les colonnes)
 │
 ├─ REST /rest/v1/public_doctors         ← ✅ Vue sécurisée (security_invoker=true)
 │        └─ public_doctors_all          ← ✅ Vue anonymisée (colonnes publiques uniquement)
 │                └─ doctor_profiles     ← passe par RLS anon (is_active = true)
 │
 └─ REST /rest/v1/claimable_doctors      ← ✅ Vue sécurisée (security_invoker=true)
          └─ public_doctors_all
                  └─ doctor_profiles
```

**Point de vigilance** : `security_invoker = true` signifie que la vue s'exécute
avec les droits du *caller* (anon). Si la vue définit `address` en colonne explicite,
PostgreSQL lèvera "permission denied" après le REVOKE → décommenter la section
SECTION_VIEW_RECREATION dans step2.

Si les vues font `SELECT *` → le column-level grant est appliqué silencieusement
(address/email absentes du résultat, aucune erreur).

### 1.4 Politiques RLS existantes sur doctor_profiles

Trois policies créées avant les migrations documentées :

| Nom | Opération | Roles | Condition |
|---|---|---|---|
| `Anyone can read active` | SELECT | anon, authenticated | `is_active = true` |
| `Doctors can update own` | UPDATE | authenticated | `user_id = auth.uid()` |
| `Admins do anything` | ALL | authenticated | `is_admin = true` (ou équivalent) |

Le problème n'est PAS la policy (filtre de lignes), c'est l'absence de restriction
sur les *colonnes* accessibles à `anon`.

### 1.5 Cas particulier : claim flow

`js/tabibi-claim.js` (ligne 140) exécute :
```javascript
await sb.from('doctor_profiles').select('email').eq('legacy_id', n).maybeSingle();
```

Ce code tourne **sans authentification** (anon). Après le fix step2, `email` n'est
plus dans le GRANT anon → cette requête échouera.

**Solution** : RPC `match_doctor_for_claim()` créée en step3.
**Migration frontend** : Phase 2 — voir `CRIT-4_FRONTEND_IMPACT.md`.

---

## 2. Solution retenue — Approche 3 étapes

### Principe

Column-Level GRANTs PostgreSQL (même approche que v1) mais appliqués à la liste
maximalement restrictive : **email et address sont EXCLUS** du GRANT anon, au même
titre que phone, user_id et les colonnes internes.

Une RPC `match_doctor_for_claim` SECURITY DEFINER remplace l'accès email anon
pour le claim flow, sans exposer la valeur stockée.

### Fichiers de migration

| Fichier | Contenu | Exécution |
|---|---|---|
| `CRIT-4_step1_diagnostic.sql` | SELECT only — audit état actuel | Avant tout |
| `CRIT-4_step2_fix.sql` | REVOKE + GRANT column-level | Après step1 validé |
| `CRIT-4_step3_rpc_claim.sql` | Création RPC match_doctor_for_claim | Après step2 validé |

### Ordre d'exécution

```
1. snapshot Supabase
2. step1 → lire les résultats, valider définitions des vues
3. step2 → si vues SELECT * : exécuter tel quel
          si vues colonnes explicites : décommenter SECTION_VIEW_RECREATION
4. Tests S-1 à S-7 + F-1 à F-6 (voir TEST_PLAN)
5. step3 → créer RPC
6. Test T-1, T-2 (RPC)
7. Si tout vert : fermer PR + marquer CRIT-4 résolu en Phase 1
8. Phase 2 : migrer tabibi-claim.js pour utiliser la RPC
```

---

## 3. Impact résiduel après step2 + step3

| Colonne | Avant fix | Après step2 | Après Phase 2 |
|---|---|---|---|
| `phone` | 🔴 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| `email` | 🔴 Accessible anon | ✅ Bloqué | ✅ Bloqué (RPC uniquement) |
| `address` | 🔴 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| `user_id` | 🔴 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| `claimed_by_user_id` | 🔴 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| `validation_docs_uploaded_at` | 🟡 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| `search_vector` | 🟡 Accessible anon | ✅ Bloqué | ✅ Bloqué |
| Vues publiques | ✅ Fonctionnelles | ✅ Inchangées (si SELECT *) | ✅ Inchangées |
| Claim flow | ✅ Fonctionnel | ⚠️ Cassé (email bloqué) | ✅ Restauré via RPC |

**Résidu de risque après Phase 1 (step2 seul, avant Phase 2)** :
Le claim flow (`tabibi-claim.js:140`) sera cassé temporairement.
**Plan** : déployer step2 et step3 dans la même fenêtre de maintenance,
puis migrer le JS en Phase 2 pour fermer la boucle.

---

## 4. Options écartées (mémoire architecturale)

### Option B — Vues SECURITY DEFINER
🔴 **Rejeté** — PHASE16_5_hide_unclaimed.sql documente explicitement ce rejet :
> "Option SQL-1 (DEFINER + REVOKE) a été ÉCARTÉE car elle bypasserait les RLS futures
> qu'on pourrait poser sur doctor_profiles"

### Option C — Vue doctor_profiles_public + REVOKE total
Valide architecturalement mais requiert de connaître la définition exacte de toutes
les vues pour les recréer. Trop risqué comme première intervention sans accès direct
au schéma Supabase. Planifié pour Phase 3 si nécessaire.
