# RLS Intrusive Report — Tabibi Security Audit
**Date** : 2026-05-27
**Branch** : audit/full-quality-sept2026
**Auditeur** : Claude / Tabibi team

---

## Périmètre

Probe RLS depuis la clé `anon` publique (depuis le bundle JS staging).
Cross-user test (patient A vs patient B) : **NON EXÉCUTABLE** sans `service_role` key —
la clé anon ne permet pas de créer des comptes confirmés (email confirmation obligatoire).
Voir §5 pour le script à exécuter manuellement.

---

## 1. Résultats par table — accès anon (non authentifié)

| Table | HTTP | Body | Verdict |
|---|---|---|---|
| `users` | 200 | `[]` (vide, RLS OK) | ✅ PASS |
| `appointments` | 200 | `[]` (vide, RLS OK) | ✅ PASS |
| `reviews` | 200 | `[]` (vide, RLS OK) | ✅ PASS |
| `claim_requests` | 200 | `[]` (vide, RLS OK) | ✅ PASS |
| `patient_medical_data` | 401 | `permission denied` | ✅ PASS (strict) |
| `notifications` | 401 | `permission denied` | ✅ PASS (strict) |
| `doctor_profiles` | 200 | **79 746 lignes exposées** | ⚠️ CRIT-4 (voir §3) |
| `public_doctors` (vue) | 200 | données publiques attendues | ✅ PASS (vue propre) |

---

## 2. Probe champs sensibles sur `doctor_profiles` (anon)

Query exécutée :
```
GET /rest/v1/doctor_profiles?select=legacy_id,email,phone&email=not.is.null&limit=5
```

Résultat réel :
- 5 lignes avec `phone` populé (ex: `+213777822974`, `+213771930783`)
- `email` contient des URLs sociales (YouTube, TikTok, Google Maps) — pas d'emails réels
- `id_card_path`, `ordre_card_path` : toutes `null` (aucun document uploadé à ce jour)
- `user_id` : toutes `null` (aucun compte lié à ce jour)

**Situation actuelle** : données partiellement exposées (téléphones réels visibles).
**Situation post-launch** : tout médecin claimed exposera email/phone/paths documents.

---

## 3. CRIT-4 — doctor_profiles expose PII à anon

**Verdict : 🔴 FAIL — fix obligatoire avant launch**

Schéma exposé à `anon` sans restriction :
- `phone`, `phone_raw` → numéros réels scrapés
- `email` → données brutes scraping
- `id_card_path`, `ordre_card_path` → paths Storage (vides maintenant, dangereux post-launch)
- `user_id`, `validation_*`, `validation_rejected_reason` → données opérationnelles internes

**Fix SQL (à exécuter dans Supabase Studio avant launch) :**
```sql
-- Révoquer l'accès direct à la table brute pour anon et authenticated
-- Le front utilise public_doctors (vue filtrée) — aucun impact UI
REVOKE SELECT ON public.doctor_profiles FROM anon;
REVOKE SELECT ON public.doctor_profiles FROM authenticated;

-- Vérifier qu'aucune RPC SECURITY DEFINER ne réexpose ces champs par erreur
-- (get_my_doctor_profile et update_my_doctor_profile sont SECURITY DEFINER → OK)
```

**Vérification avant fix :**
```bash
grep -rn "from('doctor_profiles')" js/
# Attendu : 0 résultat (le front appelle public_doctors ou les RPCs)
```
Résultat réel (vérifié) : **0 appel direct** dans le JS front.

---

## 4. CRIT-5 — Signup endpoint sans captcha

**Verdict : 🟡 MEDIUM — accepté pour launch MVP, à fixer sprint 2**

`POST /auth/v1/signup` répond 200 sans token Turnstile côté serveur.
Turnstile n'est validé que côté UI (frontend JS) → contournable via API directe.

Impact actuel : création de comptes non-confirmés (inutilisables sans email confirmation).
Impact post-launch avec confirmation désactivée : compte spam illimité.

**Fix recommandé post-launch :**
Edge function `signup-with-captcha` (Supabase Edge Functions) vérifiant le token
Turnstile avant de déléguer à `auth.admin.createUser`.

---

## 5. Script cross-user — À exécuter manuellement avec service_role

Le test suivant requiert la `service_role` key (jamais exposée côté client par design).

```javascript
// test-rls-cross-user.js — Node.js, à lancer avec SUPABASE_SERVICE_KEY=<key>
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://pudugodhiofqrctcdwfl.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { autoRefreshToken: false } })

// 1. Créer user A (patient)
const { data: uA } = await admin.auth.admin.createUser({
  email: 'patient_test_A@tabibi.test', password: 'TestPass123!',
  email_confirm: true, user_metadata: { role: 'patient' }
})

// 2. Créer user B (patient)
const { data: uB } = await admin.auth.admin.createUser({
  email: 'patient_test_B@tabibi.test', password: 'TestPass123!',
  email_confirm: true, user_metadata: { role: 'patient' }
})

// 3. Signer comme A
const { data: sessA } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: 'patient_test_A@tabibi.test'
})
const clientA = createClient(SB_URL, '<ANON_KEY>')
// ... se connecter avec sessA.access_token

// 4. Tenter de lire les appointments de B depuis la session A
const { data, error } = await clientA
  .from('appointments')
  .select('*')
  .eq('patient_id', uB.user.id)

console.assert(data?.length === 0, 'FAIL: A peut lire les RDV de B')
console.log(error ? 'PASS: blocked' : data?.length === 0 ? 'PASS: empty' : 'FAIL')

// 5. Cleanup
await admin.auth.admin.deleteUser(uA.user.id)
await admin.auth.admin.deleteUser(uB.user.id)
```

---

## 6. Compte test non nettoyé (session précédente)

UUID à supprimer :
```sql
-- Supabase Studio → SQL Editor
DELETE FROM auth.users WHERE id = '9df8df4f-a5b3-4d68-85cf-32ee08a32190';
```

---

## Verdict global RLS

| Test | Résultat |
|---|---|
| Anon → users | ✅ PASS |
| Anon → appointments | ✅ PASS |
| Anon → notifications | ✅ PASS (401) |
| Anon → patient_medical_data | ✅ PASS (401) |
| Anon → doctor_profiles PII | 🔴 FAIL (CRIT-4) |
| Cross-user A↔B | ⏳ PENDING (service_role requis) |
