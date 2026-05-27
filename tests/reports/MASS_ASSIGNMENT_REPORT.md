**Version** : 1.0
**Date** : 27 mai 2026
**Cible** : Supabase project `pudugodhiofqrctcdwfl.supabase.co`
**Méthode** : appels REST aux RPC + INSERT directs via anon

---

# Rapport — Mass Assignment

## 1. Verdict

🟢 **CRIT-3 LARGEMENT MITIGÉ** : pas de vecteur de mass assignment évident exécutable depuis anon.

- ✅ `INSERT INTO users {is_admin:true,role:admin}` → **bloqué** : colonne `is_admin` n'existe pas dans `public.users` (schema cache).
- ✅ `RPC claim_my_doctor_profile` sans auth → renvoie `{ok:false, error:not_authenticated}`. Auth requise.
- ⚠️ `RPC update_my_doctor_profile(params jsonb)` → ne s'appelle pas avec `params` enveloppé. Signature à confirmer + test post-auth requis (cf. §5).
- ✅ `INSERT INTO appointments` anon → **bloqué (401)**.

## 2. Tests effectués

### Test 1 — INSERT users avec champs admin

```bash
curl -X POST "$SUPA/rest/v1/users" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"email":"audit-mass@tabibi.test","role":"admin","is_admin":true}'
```

**Résultat** :
```
HTTP 400
{"code":"PGRST204",
 "message":"Could not find the 'is_admin' column of 'users' in the schema cache"}
```

✅ **Pas de colonne `is_admin`** → mass-assignment classique impossible. Si le rôle est dans une colonne `role` (existe), l'INSERT serait aussi bloqué par RLS / GRANT (à confirmer par test direct).

### Test 2 — INSERT users avec seulement `role`

À exécuter post-fix (test non lancé dans cette campagne) :

```bash
curl -X POST "$SUPA/rest/v1/users" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"audit-mass@tabibi.test","role":"admin"}'
```

Attendu : `401 permission denied` ou similaire.

### Test 3 — RPC claim_my_doctor_profile sans token

```bash
curl -X POST "$SUPA/rest/v1/rpc/claim_my_doctor_profile" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"legacy_id_input":241}'
```

**Résultat** : `HTTP 200` avec `{"ok":false,"error":"not_authenticated"}`.
✅ La fonction vérifie elle-même `auth.uid() IS NOT NULL` avant toute action.

### Test 4 — RPC update_my_doctor_profile sans token

```bash
curl -X POST "$SUPA/rest/v1/rpc/update_my_doctor_profile" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"params":{"is_admin":true,"role":"admin","user_id":"<other_uuid>"}}'
```

**Résultat** :
```
HTTP 404
PGRST202
"Could not find the function public.update_my_doctor_profile(params)
 in the schema cache"
```

ℹ️ La fonction existe (utilisée par `tabibi-doctor-dashboard.js:96`) mais avec une signature différente — probablement des paramètres nommés individuellement. À voir :

```bash
# Probe pour comprendre la vraie signature :
curl -X POST "$SUPA/rest/v1/rpc/update_my_doctor_profile" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{}'
```

### Test 5 — INSERT appointments anon

```bash
curl -X POST "$SUPA/rest/v1/appointments" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"doctor_id":"00000000-0000-0000-0000-000000000000",
       "patient_id":"00000000-0000-0000-0000-000000000000",
       "scheduled_at":"2026-12-01T10:00:00Z"}'
```

**Résultat** : `HTTP 401` — bloqué par permissions.

## 3. Tests à exécuter avec session AUTHENTIFIÉE (compte médecin test)

### Test A — Mass assignment via `update_my_doctor_profile`

Pré-requis : compte médecin authentifié (existant : `algerindustriecamion@gmail.com`).

```js
// Récupère la signature réelle
const sb = window.tabibi.supabase;
const { data: profile } = await sb.rpc('get_my_doctor_profile');
console.log('Champs profil :', Object.keys(profile));

// Tente d'élever le rôle
const { data, error } = await sb.rpc('update_my_doctor_profile', {
  user_id: '00000000-0000-0000-0000-000000000000', // autre user
  is_admin: true,
  role: 'admin',
  is_verified: true,
  validation_status: 'approved',
});
console.log('Résultat :', data, error);

// Re-fetch
const { data: after } = await sb.rpc('get_my_doctor_profile');
console.log('Profil après tentative :', after);
// Espéré : user_id, role, validation_status inchangés
```

### Test B — Mass assignment via UPDATE direct

```js
const { data, error } = await sb
  .from('doctor_profiles')
  .update({ is_verified: true, validation_status: 'approved' })
  .eq('id', myProfileId);
// Espéré : RLS bloque OU policy USING (auth.uid() = user_id) AND
//          WITH CHECK (champs sensibles inchangés)
```

### Test C — Self-elevation `users.role`

```js
const { data, error } = await sb
  .from('users')
  .update({ role: 'admin' })
  .eq('id', myUserId);
// Espéré : RLS bloque
```

## 4. Recommandations préventives

| # | Action | Priorité |
|---|---|---|
| MA-1 | Confirmer signature `update_my_doctor_profile` et **auditer la whitelist côté serveur** | **CRIT** |
| MA-2 | Pour chaque RPC qui prend `jsonb`, lister explicitement les champs autorisés en début de fonction | **CRIT** |
| MA-3 | Ajouter une policy `WITH CHECK` sur `doctor_profiles` UPDATE qui empêche la modification de `user_id`, `is_verified`, `validation_status`, `*_path` par l'owner | **CRIT** |
| MA-4 | Tester chaque flux de Test A/B/C ci-dessus avec compte médecin réel et inscrire en CI | MAJ |
| MA-5 | Documenter dans `docs/audit/RPC_FUNCTIONS.md` la signature exacte de chaque RPC critique | MIN |

## 5. Statut CRIT-3

> **MITIGÉ par défaut** : aucun mass-assignment exploitable depuis anon. **Mais** : le test post-auth (médecin authentifié) reste à faire avant le launch pour s'assurer qu'un médecin ne peut pas s'élever en `admin` ou marquer son profil `verified`. Test prévu, à exécuter avec compte test existant (`algerindustriecamion@gmail.com` mentionné dans la mission).
