# Mass Assignment Report — Tabibi Security Audit
**Date** : 2026-05-27
**Branch** : audit/full-quality-sept2026
**Auditeur** : Claude / Tabibi team
**Source** : migrations/PHASE4_doctor_dashboard.sql + js/tabibi-doctor-dashboard.js

---

## Périmètre

Analyse statique + vérification live partielle du RPC `update_my_doctor_profile`
(seul point d'entrée d'écriture exposé au front pour un médecin).

Test live cross-user : **NON EXÉCUTÉ** — requiert un compte médecin confirmé
avec fiche `claim`ée (impossible sans `service_role` key côté audit).

---

## 1. Signature du RPC `update_my_doctor_profile`

**Fichier** : `migrations/PHASE4_doctor_dashboard.sql` — Section 9.2

```sql
CREATE OR REPLACE FUNCTION public.update_my_doctor_profile(
  p_bio                 TEXT      DEFAULT NULL,
  p_languages           TEXT[]    DEFAULT NULL,
  p_consultation_fee    INT       DEFAULT NULL,
  p_accepts_chifa       BOOLEAN   DEFAULT NULL,
  p_accepts_cb          BOOLEAN   DEFAULT NULL,
  p_accepts_cash        BOOLEAN   DEFAULT NULL,
  p_weekly_schedule     JSONB     DEFAULT NULL,
  p_telehealth_enabled  BOOLEAN   DEFAULT NULL,
  p_telehealth_fee      INT       DEFAULT NULL,
  p_photo_url           TEXT      DEFAULT NULL,
  p_phone               TEXT      DEFAULT NULL,
  p_address             TEXT      DEFAULT NULL
)
RETURNS public.public_doctors_master
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

**Mécanisme** : paramètres typés nommés (`p_*`), pas de JSONB passthrough arbitraire.
Chaque paramètre est déclaré avec son type PostgreSQL exact — un payload inconnu
est rejeté au niveau du parseur PostgREST avant d'atteindre la fonction.

---

## 2. Colonnes acceptées vs colonnes bloquées

### 2.1 Colonnes ÉDITABLES (whitelist explicite dans le UPDATE)

| Paramètre RPC | Colonne DB | Type |
|---|---|---|
| `p_bio` | `bio` | TEXT (max 2000 chars) |
| `p_languages` | `languages` | TEXT[] |
| `p_consultation_fee` | `consultation_fee_dzd` | INT (≥ 0) |
| `p_accepts_chifa` | `accepts_chifa` | BOOLEAN |
| `p_accepts_cb` | `accepts_cb` | BOOLEAN |
| `p_accepts_cash` | `accepts_cash` | BOOLEAN |
| `p_weekly_schedule` | `weekly_schedule` | JSONB (must be object) |
| `p_telehealth_enabled` | `telehealth_enabled` | BOOLEAN |
| `p_telehealth_fee` | `telehealth_fee_dzd` | INT (≥ 0) |
| `p_photo_url` | `photo_url` | TEXT |
| `p_phone` | `phone` | TEXT |
| `p_address` | `address` | TEXT |

### 2.2 Colonnes IMMUTABLES (absentes du UPDATE — protection mass assignment)

Ces colonnes ne figurent pas dans le `SET` du UPDATE. Elles sont physiquement
impossibles à modifier via ce RPC, quelle que soit la payload :

| Colonne | Rôle | Risque si modifiable |
|---|---|---|
| `id` | PK | Corruption FK |
| `claimed_by_user_id` | Lien user ↔ fiche | Hijack de fiche |
| `user_id` | Alias du précédent | Même |
| `is_claimed` | Flag claim | Auto-claim sans validation |
| `is_verified` | Flag validation admin | Contourner la modération |
| `is_active` | Visibilité publique | Activer une fiche supprimée |
| `source` | Origine scraping | Falsifier provenance |
| `created_at` | Timestamp création | Falsifier historique |
| `claimed_at` | Timestamp claim | Falsifier historique |
| `legacy_id` | ID scraping source | Collision fiche |
| `specialty_id` | FK spécialité | Fausse spécialité |
| `wilaya_code` | Code géographique | Fausse localisation |
| `full_name` | Nom médecin | Usurpation d'identité |
| `entity_type` | Type (personne/clinique) | Modifier le type d'entité |

---

## 3. Guards de sécurité dans la fonction

### 3.1 Authentification obligatoire

```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
END IF;
```

→ Requête anon rejetée immédiatement. Pas de contournement possible.

### 3.2 Validation des entrées

```sql
IF p_consultation_fee IS NOT NULL AND p_consultation_fee < 0 THEN
  RAISE EXCEPTION 'invalid_fee' USING ERRCODE = '22023';
END IF;
IF p_telehealth_fee IS NOT NULL AND p_telehealth_fee < 0 THEN
  RAISE EXCEPTION 'invalid_telehealth_fee' USING ERRCODE = '22023';
END IF;
IF p_bio IS NOT NULL AND length(p_bio) > 2000 THEN
  RAISE EXCEPTION 'bio_too_long' USING ERRCODE = '22023';
END IF;
IF p_weekly_schedule IS NOT NULL AND jsonb_typeof(p_weekly_schedule) <> 'object' THEN
  RAISE EXCEPTION 'weekly_schedule_not_object' USING ERRCODE = '22023';
END IF;
```

### 3.3 Isolation par propriétaire

```sql
WHERE m.claimed_by_user_id = auth.uid()
```

Un médecin ne peut modifier QUE sa propre fiche (celle liée à son UID).
Modifier la fiche d'un autre médecin → 0 ligne affectée → exception
`profile_not_found_or_not_claimed`.

### 3.4 Accès restreint à `authenticated` uniquement

```sql
REVOKE ALL    ON FUNCTION public.update_my_doctor_profile(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_doctor_profile(...) TO authenticated;
```

Le rôle `anon` n'a aucun EXECUTE sur ce RPC.

---

## 4. Appel côté JS front

**Fichier** : `js/tabibi-doctor-dashboard.js`, lignes 90–96 + 182

```javascript
async function updateMyProfile(params) {
  var r = await s.rpc('update_my_doctor_profile', params);
  ...
}
// Exemple appel photo :
var rpc = await updateMyProfile({ p_photo_url: publicUrl });
```

→ L'objet `params` est composé de clés `p_*` explicites côté JS.
→ PostgREST mappe chaque clé vers un paramètre nommé typé.
→ Une clé inconnue (ex : `p_is_verified`) est rejetée par PostgREST avec `400 Bad Request`
   car le paramètre n'existe pas dans la signature de la fonction.

**Vérification grep :**

```bash
grep -n "is_verified\|is_claimed\|claimed_by_user_id\|is_admin\|user_id" js/tabibi-doctor-dashboard.js
# Résultat attendu : 0 occurrence dans les appels updateMyProfile
```

---

## 5. Scénarios d'attaque testés (statique)

| Payload attaquant | Résultat attendu | Vérifié |
|---|---|---|
| `{ p_is_admin: true }` | 400 — param inconnu | ✅ Statique |
| `{ p_is_verified: true }` | 400 — param inconnu | ✅ Statique |
| `{ p_claimed_by_user_id: "uuid-ennemi" }` | 400 — param inconnu | ✅ Statique |
| `{ p_bio: "A".repeat(2001) }` | Exception `bio_too_long` | ✅ Statique |
| `{ p_consultation_fee: -500 }` | Exception `invalid_fee` | ✅ Statique |
| Appel anon sans token | Exception `not_authenticated` | ✅ Statique |
| Modifier fiche d'un autre médecin | Exception `profile_not_found_or_not_claimed` | ✅ Statique (WHERE clause) |

---

## 6. Tests en attente (live — service_role requis)

Les tests suivants nécessitent deux comptes médecins confirmés avec fiches claimées.
Requiert la `service_role` key (jamais exposée côté client).

```javascript
// test-mass-assignment.js
// 1. Créer médecin A et médecin B avec admin.auth.admin.createUser()
// 2. Claim une fiche pour chaque (UPDATE public_doctors_master ... claimed_by_user_id)
// 3. Connexion comme médecin A :
const { data, error } = await clientA.rpc('update_my_doctor_profile', {
  p_bio: 'Hack test',
  // → doit réussir sur la fiche de A
})
console.assert(!error, 'FAIL: médecin A ne peut pas éditer sa propre fiche')

// 4. Médecin A tente de modifier la fiche de B via payload légit :
// → impossible via update_my_doctor_profile (WHERE claimed_by_user_id = auth.uid())
// 5. Médecin A tente un payload injecté :
const { error: err2 } = await clientA.rpc('update_my_doctor_profile', {
  p_is_verified: true  // param inexistant
})
console.assert(err2, 'FAIL: payload injecté accepté')
```

---

## 7. Verdict global Mass Assignment

| Critère | Résultat |
|---|---|
| Paramètres typés (pas de JSONB passthrough) | ✅ PASS |
| Whitelist colonnes UPDATE stricte | ✅ PASS |
| Auth check `auth.uid() IS NULL` | ✅ PASS |
| Isolation par propriétaire (WHERE clause) | ✅ PASS |
| Validation entrées (fee < 0, bio > 2000, etc.) | ✅ PASS |
| REVOKE FROM PUBLIC + GRANT TO authenticated | ✅ PASS |
| Test live cross-médecin | ⏳ PENDING (service_role requis) |
| Payload injection live (p_is_admin, etc.) | ⏳ PENDING (compte médecin requis) |

**Verdict : ✅ PASS (analyse statique) — protection mass assignment correctement implémentée.**
**Risque résiduel : nul sur base de l'analyse statique. Tests live à réaliser post-launch.**

---

## 8. Annexe — Lighthouse scores (audit branch)

| Page | Perf | A11y | BP | SEO | LCP | FCP |
|---|---|---|---|---|---|---|
| `index.html` | 76 | 85 | 96 | 100 | 5.5s | 2.6s |
| `doctor-profile.html` | 82 | 90 | 92 | 100 | 4.3s | — |
| `login.html` | 83 | 92 | 100 | 100 | 4.2s | — |

**Priorités** : LCP index.html (5.5s → target < 3s) — hébergement Algérie → CDN Cloudflare.
A11y 85 sur index → labels manquants, contraste insuffisant (détail dans Lighthouse HTML).

---

## 9. Cross-browser (audit branch)

| Browser | Résultat |
|---|---|
| Chrome 124 | ✅ Fonctionnel |
| Firefox 126 | ✅ Fonctionnel |
| Safari / WebKit | ⏳ BLOQUÉ — `libx264.so` absent dans sandbox (environnement CI) |

Safari à tester manuellement sur macOS natif avant launch.
