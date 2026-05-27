**Version** : 1.0
**Date** : 27 mai 2026
**Cible** : Supabase project `pudugodhiofqrctcdwfl.supabase.co`
**Méthode** : appels REST authentifiés via la clé `anon` publique extraite du bundle
**Mode** : `RUN_INTRUSIVE=1` partiel (anon-probe complet, cross-user A↔B impossible — voir §5)

---

# Rapport — RLS Intrusive

## 1. Verdict

🟡 **CRIT-1 MAJORITAIREMENT LEVÉ + une découverte CRIT additionnelle**.

- **Toutes les tables sensibles probées** retournent soit `[]` soit `401` à un client anonyme → ✅ RLS opérationnel.
- **MAIS** : `doctor_profiles` expose en lecture anon des **champs PII / opérationnels** qui devraient être masqués. Aujourd'hui les valeurs sont quasi-nulles, mais dès que les médecins claimeront → fuite généralisée.

## 2. Probes anonymes sur les 9 tables sensibles

| Table | HTTP | Body | Verdict |
|---|---|---|---|
| `users` | 200 | `[]` | ✅ RLS filtre tout |
| `appointments` | 200 | `[]` | ✅ RLS filtre tout |
| `reviews` | 200 | `[]` | ✅ RLS filtre tout |
| `review_reports` | 200 | `[]` | ✅ RLS filtre tout |
| `claim_requests` | 200 | `[]` | ✅ RLS filtre tout |
| `notifications` | **401** | `permission denied for table` (code 42501) | ✅ Très strict — anon n'a même pas SELECT GRANT |
| `patient_medical_data` | **401** | `permission denied for table` | ✅ Très strict (données chiffrées en plus) |
| `doctor_profiles` | 200 | **données réelles** (79 746 lignes accessibles) | ⚠️ Voir §4 |
| `public_doctors` (vue) | 200 | données filtrées propres | ✅ Vue clean |

## 3. INSERT-probes (mass assignment direct)

| Action | HTTP | Body | Verdict |
|---|---|---|---|
| `INSERT INTO public.users {email,role:admin,is_admin:true}` | **400** | « column `is_admin` does not exist » | ✅ Pas de colonne → mass-assignment impossible côté `users` |
| `INSERT INTO public.appointments {doctor_id,patient_id,scheduled_at}` | **401** | « permission denied for table `cabinet_members` » | ✅ Bloqué par RLS / GRANT |
| `RPC claim_my_doctor_profile(241)` sans token | 200 | `{"ok":false,"error":"not_authenticated"}` | ✅ Fonction vérifie auth |
| `RPC update_my_doctor_profile({params})` | 404 | « function ... with params not found » | ⚠️ Signature à confirmer — la fonction existe mais avec d'autres paramètres |

## 4. ⚠️ NOUVELLE DÉCOUVERTE CRIT : `doctor_profiles` expose des champs sensibles à anon

### Champs exposés à un client anonyme (lecture directe sur la table) :

```
✅ Légitimes pour annuaire public :
  accepts_card, accepts_cash, accepts_chifa, address, bio, city,
  consultation_fee_dzd, entity_type, full_name, full_name_ar,
  id, is_active, is_claimed, is_verified, languages, latitude, longitude,
  legacy_id, photo_url, rating, review_count, specialty_id, specialty_raw,
  status, telehealth_enabled, telehealth_fee_dzd, wilaya_code, working_hours

❌ NE DEVRAIENT PAS être visibles à anon :
  email                        ← PII médecin
  phone, phone_raw, phone_type ← PII médecin
  user_id                      ← Lien interne vers auth.users
  id_card_path                 ← Path Storage du CNI ⚠️⚠️
  ordre_card_path              ← Path Storage de la carte CNOM ⚠️⚠️
  validation_status            ← Workflow interne
  validation_pending_since
  validation_approved_at
  validation_approved_by_id    ← UUID admin
  validation_rejected_at
  validation_rejected_by_id    ← UUID admin
  validation_rejected_reason   ← Peut être diffamatoire si fuité
  validation_docs_uploaded_at
  claimed_at
  search_vector                ← tsvector (volumineux, pas dangereux mais inutile)
  source                       ← provenance scrape
  created_at, updated_at       ← acceptable mais surface inutile
```

### Échelle aujourd'hui (mesurée) :

| Métrique | Valeur |
|---|---|
| Total lignes `doctor_profiles` lisibles anon | **79 746** |
| Lignes avec `email IS NOT NULL` | **10** |
| Lignes avec `phone IS NOT NULL` | (non recomptée — probablement faible) |
| Lignes avec `ordre_card_path IS NOT NULL` | **0** |
| Lignes avec `id_card_path IS NOT NULL` | **0** (probable) |

**Verdict** : aujourd'hui le risque réel est limité (10 emails exposés). Mais c'est une **bombe à retardement** : dès qu'un médecin claimera et uploadera ses documents, toutes ces PII et chemins documents deviendront publics.

### Fix recommandé

#### Option 1 — Vue restrictive + révocation GRANT (recommandé)

```sql
-- 1. Révoquer le SELECT direct sur la table pour anon et authenticated
REVOKE SELECT ON public.doctor_profiles FROM anon, authenticated;

-- 2. La vue public_doctors existe déjà et est propre — la conserver
GRANT SELECT ON public.public_doctors TO anon, authenticated;

-- 3. Pour les médecins eux-mêmes, RPC dédiée get_my_doctor_profile (déjà en place)
-- 4. Pour les admins, table accessible via le rôle service ou is_admin()
```

Tester impact frontend (peut casser une page qui requête directement `doctor_profiles` au lieu de `public_doctors`).

#### Option 2 — RLS plus fine (USING clause)

```sql
-- Si REVOKE est trop intrusif :
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_profiles_select_public ON public.doctor_profiles
  FOR SELECT TO anon, authenticated
  USING (true);  -- toutes les lignes visibles

-- Mais masquer les colonnes via une vue + grants colonnes :
GRANT SELECT (id, full_name, full_name_ar, photo_url, specialty_id, wilaya_code,
              city, address, bio, languages, rating, review_count,
              consultation_fee_dzd, accepts_card, accepts_cash, accepts_chifa,
              telehealth_enabled, telehealth_fee_dzd, working_hours,
              is_claimed, is_verified, latitude, longitude, entity_type)
       ON public.doctor_profiles TO anon, authenticated;
-- (pas de GRANT sur email, phone, *_path, validation_*)
```

PostgreSQL applique le GRANT colonne avant la RLS, donc `SELECT *` retournera erreur ou seules les colonnes whitelistées.

## 5. ⏸️ Cross-user A vs B — NON exécuté (blocage technique)

### Blocage rencontré

1. ✅ Anon signup endpoint accessible (sans captcha — voir §6) — création de compte testé OK.
2. ❌ **Email confirmation activée** → l'utilisateur créé `9df8df4f-a5b3-4d68-85cf-32ee08a32190` (email `audit_rls_a_1779905978@tabibi.test`) ne peut pas se logger sans confirmer l'email. Réponse au login : `{"code":400,"error_code":"email_not_confirmed","msg":"Email not confirmed"}`.
3. ❌ Pas de `service_role` key disponible pour confirmer manuellement, ni pour `auth.admin.deleteUser`.

### Compte test à supprimer manuellement (via Supabase Studio)

```
UUID  : 9df8df4f-a5b3-4d68-85cf-32ee08a32190
Email : audit_rls_a_1779905978@tabibi.test
Status: unconfirmed
Created at : 2026-05-27T18:19:39Z
```

Commande de suppression manuelle (à exécuter en Supabase Studio SQL Editor, **service_role implicite**) :

```sql
DELETE FROM auth.users WHERE id = '9df8df4f-a5b3-4d68-85cf-32ee08a32190';
-- ou via API admin :
-- curl -X DELETE \
--   -H "apikey: SERVICE_ROLE_KEY" \
--   -H "Authorization: Bearer SERVICE_ROLE_KEY" \
--   "https://pudugodhiofqrctcdwfl.supabase.co/auth/v1/admin/users/9df8df4f-a5b3-4d68-85cf-32ee08a32190"
```

### Test cross-user à exécuter avec `service_role`

```js
// Procédure côté admin :
// 1. supabaseAdmin.auth.admin.createUser({email:'a@tabibi.test', email_confirm:true, password:'…'})
// 2. supabaseAdmin.auth.admin.createUser({email:'b@tabibi.test', email_confirm:true, password:'…'})
// 3. signIn(a) → sessionA
// 4. signIn(b) → sessionB
// 5. Avec sessionB : créer 1 RDV, 1 notification
// 6. Avec sessionA : SELECT FROM appointments → doit être empty
//                    SELECT FROM notifications → doit être 401 ou empty
//                    SELECT FROM users WHERE id = B.id → doit être empty ou 401
// 7. Nettoyer : auth.admin.deleteUser(a), auth.admin.deleteUser(b)
```

Spec déjà placée dans `tests/audit/03-security.spec.js` (skip par défaut).

## 6. 🔴 Découverte sécurité additionnelle : SignUp sans captcha

Le bouton signup UI utilise Turnstile (visible dans `config.js`), mais l'endpoint **REST `POST /auth/v1/signup` accepte les requêtes sans token Turnstile**.

```bash
# Reproduisible
curl -X POST "https://pudugodhiofqrctcdwfl.supabase.co/auth/v1/signup" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"any@example.com","password":"X#12345678"}'
# → 200 OK, user créé (unconfirmed)
```

### Risque

- **Bot DoS** : créer ~10k utilisateurs unconfirmed/heure.
- **Pollution `auth.users`** : table grossit.
- **Email enumeration** sur autres endpoints.
- **Coûts** : Supabase facture par MAU même pour des unconfirmed dans certains plans.

### Mitigation recommandée

1. Activer la validation **côté serveur Supabase** du token Turnstile via une fonction Edge `signup-with-captcha`, puis désactiver le signup public direct.
2. Ou rate-limiter par IP (Supabase Pro propose des règles).
3. Politique de purge automatique des utilisateurs unconfirmed > 7 jours (CRON).

## 7. Tableau récap par table

| Table | Anon SELECT | Anon INSERT | Verdict |
|---|---|---|---|
| `users` | ✅ filtré `[]` | ❌ bloqué | ✅ PASS |
| `appointments` | ✅ filtré `[]` | ❌ bloqué (401) | ✅ PASS |
| `reviews` | ✅ filtré `[]` | (non testé) | ✅ probable PASS |
| `review_reports` | ✅ filtré `[]` | (non testé) | ✅ probable PASS |
| `claim_requests` | ✅ filtré `[]` | (non testé) | ✅ probable PASS |
| `notifications` | ✅ 401 strict | n/a (401) | ✅ PASS |
| `patient_medical_data` | ✅ 401 strict | n/a (401) | ✅ PASS |
| `doctor_profiles` | ⚠️ exposition champs sensibles | ❌ probable bloqué | 🔴 **FAIL** |
| `public_doctors` (vue) | ✅ champs propres | n/a | ✅ PASS |

## 8. Recommandations consolidées

| # | Action | Priorité |
|---|---|---|
| **R1** | **Restreindre l'exposition anon de `doctor_profiles`** (revoke colonnes sensibles ou pousser le front sur `public_doctors`) | **CRIT** |
| **R2** | Activer la validation Turnstile sur l'endpoint signup serveur | **CRIT** |
| R3 | Cleanup manuel du compte test créé pendant cet audit (UUID en §5) | MAJ |
| R4 | Exécuter le test cross-user A↔B avec service_role (script fourni) | MAJ |
| R5 | Purge CRON des utilisateurs unconfirmed > 7 jours | MAJ |
| R6 | Documenter le delta entre la vue `public_doctors` et la table `doctor_profiles` | MIN |
