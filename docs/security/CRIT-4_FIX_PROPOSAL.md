# CRIT-4 — Fix Proposal : doctor_profiles RLS Exposure
**Date** : 2026-05-28  
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
# → Retourne un row complet dont phone, email, user_id
```

**Volume exposé** : 79 746 fiches médecins

### 1.2 Colonnes de doctor_profiles

La table comporte 38+ colonnes. Classification :

| Colonne | Type | Sensibilité |
|---|---|---|
| `id` | UUID | Public |
| `legacy_id` | TEXT/INT | Public |
| `full_name` | TEXT | Public |
| `entity_type` | TEXT | Public |
| `specialty_id` | UUID | Public |
| `wilaya_code` | TEXT | Public |
| `address` | TEXT | Public (adresse cabinet) |
| `photo_url` | TEXT | Public |
| `rating` | NUMERIC | Public |
| `review_count` | INT | Public |
| `consultation_fee_dzd` | INT | Public |
| `bio` | TEXT | Public |
| `languages` | TEXT[] | Public |
| `accepts_chifa` | BOOL | Public |
| `accepts_card` | BOOL | Public |
| `accepts_cash` | BOOL | Public |
| `telehealth_enabled` | BOOL | Public |
| `telehealth_fee_dzd` | INT | Public |
| `working_hours` | JSONB | Public |
| `is_claimed` | BOOL | Public |
| `is_active` | BOOL | Public |
| `is_verified` | BOOL | Public |
| `validation_status` | TEXT | Public |
| `source` | TEXT | Public |
| `updated_at` | TIMESTAMPTZ | Public |
| `created_at` | TIMESTAMPTZ | Public |
| **`email`** | **TEXT** | **⚠️ Sensible** (email personnel scrappé) |
| **`phone`** | **TEXT** | **🔴 Sensible** (téléphone personnel scrappé) |
| **`user_id`** | **UUID** | **🔴 Critique** (FK vers auth.users — permet corrélation d'identité) |
| **`claimed_by_user_id`** | **UUID** | **🔴 Critique** (idem) |
| **`claimed_at`** | **TIMESTAMPTZ** | **⚠️ Sensible** (timestamp interne) |
| **`validation_docs_uploaded_at`** | **TIMESTAMPTZ** | **⚠️ Sensible** (flux interne) |
| **`search_vector`** | **TSVECTOR** | **⚠️ Inutile pour anon** (données internes d'indexation) |

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

**Modèle de sécurité des vues** : `security_invoker = true` signifie que la vue
s'exécute avec les droits du *caller* (anon), pas ceux du propriétaire.
→ Les vues appliquent les RLS de doctor_profiles au profit de l'anonymisation.
→ **Conséquence critique** : si on `REVOKE SELECT FROM anon` sur doctor_profiles,
  les vues cassent également (elles dépendent de ce SELECT pour fonctionner).
  C'est ce qui s'est passé lors de la tentative précédente.

### 1.4 Politiques RLS existantes sur doctor_profiles

Trois policies créées avant les migrations documentées :

| Nom | Opération | Roles | Condition |
|---|---|---|---|
| `Anyone can read active` | SELECT | anon, authenticated | `is_active = true` |
| `Doctors can update own` | UPDATE | authenticated | `user_id = auth.uid()` |
| `Admins do anything` | ALL | authenticated | `is_admin = true` (ou équivalent) |

**La policy `Anyone can read active` est correcte pour les vues** — elle filtre les
lignes inactives. Le problème n'est PAS la policy (filtre de lignes), c'est l'absence
de restriction sur les *colonnes* accessibles à `anon`.

### 1.5 Cas particulier : claim flow

`js/tabibi-claim.js` (ligne 140) exécute :
```javascript
await sb.from('doctor_profiles').select('email').eq('legacy_id', n).maybeSingle();
```
Ce code tourne **sans authentification** (anon) pour pré-remplir l'email lors
de la réclamation d'une fiche. C'est un usage légitme *fonctionnellement*
mais il est **incompatible avec un REVOKE total** sur doctor_profiles.

---

## 2. Options de fix

### Option A — Column-Level GRANT (recommandé)

**Principe** : remplacer le `GRANT SELECT ON TABLE` (accès à toutes les colonnes)
par un `GRANT SELECT (col1, col2, ...)` sur les seules colonnes publiques.

```sql
REVOKE SELECT ON public.doctor_profiles FROM anon;
GRANT SELECT (
  id, legacy_id, full_name, entity_type, specialty_id, wilaya_code, address,
  photo_url, rating, review_count, consultation_fee_dzd, bio, languages,
  accepts_chifa, accepts_card, accepts_cash, telehealth_enabled, telehealth_fee_dzd,
  working_hours, is_claimed, is_active, is_verified, validation_status,
  updated_at, created_at, source,
  email  -- conservé pour le claim flow (Phase 2 : remplacer par RPC)
) ON public.doctor_profiles TO anon;
```

**Colonnes bloquées pour anon** : `phone`, `user_id`, `claimed_by_user_id`,
`claimed_at`, `validation_docs_uploaded_at`, `search_vector`.

**Pros** :
- ✅ Chirurgical — zéro changement sur les vues existantes
- ✅ Les vues `security_invoker` continuent de fonctionner (elles n'utilisent pas les colonnes sensibles)
- ✅ `tabibi-claim.js` continue de fonctionner (email conservé)
- ✅ Réversible en une ligne (`GRANT SELECT ON TABLE`)
- ✅ Pas de refactoring de vues ni de code JS

**Cons** :
- ⚠️ `email` reste accessible à anon (fix partiel — à compléter en Phase 2)
- ⚠️ Nécessite d'énumérer toutes les colonnes publiques (risque d'oubli si nouvelle colonne ajoutée)
- ⚠️ Ne bloque pas `authenticated` non-médecin de lire `phone` d'un autre médecin via REST direct

**Résidu de risque** : `email` encore accessible. Les 79 746 emails de médecins
restent extractibles via `curl`. Mais `phone` (plus sensible, non attendu dans le contexte web)
et `user_id` (corrélation d'identité) sont bloqués.

---

### Option B — Vues en SECURITY DEFINER

**Principe** : convertir `public_doctors_all` (et ses dérivées) en `security_definer`.
La vue tourne avec les droits du propriétaire (postgres), pas du caller. Ensuite,
`REVOKE SELECT ON doctor_profiles FROM anon` ne casse plus les vues.

```sql
-- Recréer public_doctors_all avec security_definer
CREATE OR REPLACE VIEW public.public_doctors_all
  WITH (security_definer = true)
AS
  [définition actuelle];

-- Idem public_doctors, claimable_doctors
-- ...

-- Bloquer l'accès direct
REVOKE SELECT ON public.doctor_profiles FROM anon;
```

**Pros** :
- ✅ Fix complet — `anon` ne peut plus lire directement doctor_profiles
- ✅ Les vues continuent de fonctionner (droits postgres, pas d'anon)
- ✅ Conceptuellement simple

**Cons** :
- 🔴 **Explicitement rejeté** dans PHASE16_5_hide_unclaimed.sql :
  > "Option SQL-1 (DEFINER + REVOKE) a été ÉCARTÉE car elle bypasserait les RLS futures
  > qu'on pourrait poser sur doctor_profiles"
- 🔴 Bypass des RLS de `doctor_profiles` — toute future policy de row-level filtering
  serait ignorée quand l'accès passe par les vues (risque architectural majeur)
- 🔴 Nécessite de connaître la définition exacte de `public_doctors_all` pour la recréer
  (non disponible dans les migrations — dans Supabase uniquement)
- ⚠️ Casse le claim flow (email non accessible directement)

---

### Option C — Vue minimale doctor_profiles_public + RPC

**Principe** : créer une vue `doctor_profiles_public` avec UNIQUEMENT les colonnes
publiques, avec `security_definer = true`. Puis `REVOKE SELECT ON doctor_profiles FROM anon`.
Créer aussi une RPC `get_doctor_email_for_claim()` pour le claim flow.

```sql
-- Nouvelle vue minimale SECURITY DEFINER
CREATE VIEW public.doctor_profiles_public
  WITH (security_definer = true)
AS
SELECT id, legacy_id, full_name, entity_type, specialty_id, wilaya_code,
       address, photo_url, rating, review_count, consultation_fee_dzd,
       bio, languages, accepts_chifa, accepts_card, accepts_cash,
       telehealth_enabled, telehealth_fee_dzd, working_hours,
       is_claimed, is_active, is_verified, validation_status, updated_at, created_at
FROM public.doctor_profiles
WHERE is_active = true;

GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;

-- RPC pour le claim flow (remplace la lecture directe de email)
CREATE OR REPLACE FUNCTION public.get_doctor_email_for_claim(p_legacy_id TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.doctor_profiles WHERE legacy_id = p_legacy_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_doctor_email_for_claim(TEXT) TO anon;

-- Bloquer l'accès direct
REVOKE SELECT ON public.doctor_profiles FROM anon;
```

**Pros** :
- ✅ Fix complet — aucune colonne sensible accessible à `anon`
- ✅ Zéro bypass des RLS existantes (la vue publique est additive, pas remplaçante)
- ✅ RPC claim flow propre et auditée
- ✅ Solution la plus défensive et pérenne

**Cons** :
- 🔴 **Requiert une modification de `js/tabibi-claim.js`** (appel RPC vs lecture table)
- ⚠️ Les vues `public_doctors_all` et dérivées dépendent encore de `doctor_profiles`
  avec `security_invoker` → le REVOKE cassera ces vues si elles accèdent
  à des colonnes non présentes dans la vue public (ou si elles ont `SELECT *`)
  → Nécessite de vérifier/recréer ces vues en DEFINER aussi
- ⚠️ Complexité d'opérations atomiques : plusieurs vues à recréer, risque de casse

---

## 3. Recommandation

### ➡️ Appliquer Option A immédiatement, planifier Option C pour Phase 2

**Pourquoi A maintenant ?**

1. **Zéro risque de régression** : les vues ne changent pas, le claim flow ne change pas
2. **Bloque l'essentiel** : `phone` (le plus sensible, cité dans l'audit) et `user_id`
   (corrélation d'identité) sont immédiatement bloqués pour `anon`
3. **Réversible en 5 secondes** : un seul `GRANT SELECT ON TABLE` pour rollback
4. **Pas de connaissance requise** de la définition interne de `public_doctors_all`

**Pourquoi pas B ?** Rejeté architecturalement (bypass RLS futur). Ne jamais convertir
des vues en DEFINER sans nécessité absolue — ça masque les erreurs de sécurité futures.

**Pourquoi pas C tout de suite ?** Requiert de modifier du code JS ET de connaître
la définition exacte de toutes les vues pour les recréer correctement. Trop risqué
comme première intervention.

**Phase 2 — après validation de A** :
1. Remplacer `tabibi-claim.js:140` par l'appel à `get_doctor_email_for_claim()`
2. Enlever `email` de la liste des colonnes accordées à `anon` dans Option A
3. Évaluer si `authenticated` non-médecin doit aussi être restreint sur `phone`

---

## 4. Impact résiduel après Option A

| Colonne | Avant fix | Après Option A |
|---|---|---|
| `phone` | 🔴 Accessible anon | ✅ Bloqué |
| `user_id` | 🔴 Accessible anon | ✅ Bloqué |
| `claimed_by_user_id` | 🔴 Accessible anon | ✅ Bloqué |
| `email` | 🔴 Accessible anon | ⚠️ Encore accessible (Phase 2) |
| `validation_docs_uploaded_at` | 🟡 Accessible anon | ✅ Bloqué |
| `search_vector` | 🟡 Accessible anon | ✅ Bloqué |
| Vues publiques | ✅ Fonctionnelles | ✅ Inchangées |
| Claim flow | ✅ Fonctionnel | ✅ Inchangé |
