# CRIT-4 — Impact Frontend & Plan de Migration
**Date** : 2026-05-29  
**Branche** : security/fix-doctor-profiles-rls  
**Scope** : Colonnes retirées du GRANT anon — `email`, `address`, `phone`,
`user_id`, `claimed_by_user_id`, `claimed_at`, `validation_docs_uploaded_at`,
`search_vector`

---

## 1. Résumé exécutif

Le fix step2 bloque l'accès anon aux colonnes sensibles de `doctor_profiles`.
Deux colonnes ont un impact frontend concret :

| Colonne | Impact | Sévérité | Phase |
|---|---|---|---|
| `email` | `tabibi-claim.js:140` lit email directement | 🔴 Bloquant claim flow | Phase 2 |
| `address` | `doctors-display.js`, `doctor-profile.html` lisent via vue | 🟡 Potentiel (dépend de la définition des vues) | Vérifier post-step2 |
| `phone` | Uniquement via RPC DEFINER côté médecin connecté | ✅ Aucun impact anon | — |

---

## 2. Fichiers impactés — analyse détaillée

### 2.1 `js/tabibi-claim.js` — CRITIQUE (Phase 2 obligatoire)

**Ligne 140-144** :
```javascript
var _dpRes = await _sb2.from('doctor_profiles')
  .select('email')
  .eq('legacy_id', n)
  .maybeSingle();
var _dpEmail = (_dpRes && !_dpRes.error && _dpRes.data && _dpRes.data.email) || null;
```

**Contexte** : Ce code s'exécute en contexte **anon** (avant authentification).
Il lit `doctor_profiles.email` pour pré-remplir l'email dans le formulaire de
réclamation de fiche (claim flow Flow A).

**Problème** : Après step2, `email` n'est plus dans le GRANT anon.
Ce SELECT retournera une erreur PostgREST ou un résultat vide.

**Solution (Phase 2 — step3)** :
Remplacer par un appel à `match_doctor_for_claim(p_legacy_id, p_email)` :
1. Le claimant saisit son email dans un nouveau champ du formulaire
2. L'appel RPC valide la correspondance (BOOLEAN) sans exposer l'email stocké
3. Si `true` → continuer le claim flow ; si `false` → "email incorrect"

**UX avant / après** :

| | Avant | Après |
|---|---|---|
| Flow | Chercher médecin → email pré-rempli automatiquement → clic Réclamer | Chercher médecin → saisir son email → validation invisible → clic Réclamer |
| Données exposées | Email stocké visible dans le formulaire | Aucun email exposé |
| Sécurité | Email extractible en masse via API | Enumeration impossible |

**Effort estimé** : 2h dev, 1h test — modification localisée à `tabibi-claim.js`
et ajout d'un champ email dans `doctor-claim.html`.

---

### 2.2 `js/doctors-display.js` — Faible impact (fallback robuste)

**Ligne 71** :
```javascript
addr: doc.address || doc.wilaya_fr || 'Algérie'
```

**Contexte** : `doc` vient de la vue `public_doctors` (pas de `doctor_profiles`
directement). La vue utilise `security_invoker = true`.

**Analyse** :
- Si la définition de `public_doctors_all` contient `SELECT *` : après step2,
  `address` sera simplement absent des rows retournés → le fallback `doc.wilaya_fr`
  s'active automatiquement. **Aucune erreur, aucun crash.**
- Si la définition contient `address` en colonne explicite : PostgreSQL lèvera
  "permission denied for column address" → la vue cassera pour anon.
  Solution : décommenter SECTION_VIEW_RECREATION dans step2.

**Action** : Vérifier la définition des vues avec step1 requête #4.
Si SELECT * → aucune action requise. Si colonnes explicites → step2 section view recreation.

---

### 2.3 `doctor-profile.html` — Faible impact (fallback robuste)

**Ligne 221** :
```javascript
const addr = row.address || row.ville || cityStr || '';
```

**Ligne 242** :
```javascript
if (addr) { ... } // affichage conditionnel
```

**Contexte** : `row` vient de `sb.from('public_doctors')` (vue sécurisée, ligne 274).
Même logique que 2.2 — address viendra de la vue, pas de `doctor_profiles` directement.

**Analyse** : Le fallback `row.ville` + `cityStr` est robuste. Si `address` disparaît
de la vue (SELECT *), l'affichage dégradé gracieusement vers la wilaya/ville.

**Action** : Aucune si les vues font SELECT *.

---

### 2.4 `medecin-profile.html` — Aucun impact (contexte authenticated uniquement)

**Lignes 607, 867-868** : Lit `phone` et `address` via `get_my_doctor_profile()`
(RPC SECURITY DEFINER existante). Ce code ne tourne qu'après login médecin —
hors scope du fix anon.

**Action** : Aucune.

---

## 3. Nouveau flux UX — Claim flow après migration

```
[doctor-claim.html]

1. Saisir nom ou numéro de fiche  →  résultats via claimable_doctors (OK, pas email)
2. Cliquer "Réclamer cette fiche"
3. ⬆️ NOUVEAU : saisir votre email médecin dans le formulaire
4. JS : appel RPC match_doctor_for_claim(legacy_id, email_saisi)
   → true  : email correspond → continuer
   → false : "L'email ne correspond pas à cette fiche" → le claimant essaie un autre email
5. Redirection login.html ou signup.html selon le cas

Avantage : un attaquant ne peut pas savoir quel email est associé à une fiche
(il ne reçoit que true/false, pas l'email stocké).
```

---

## 4. Checklist Phase 2 (migration frontend)

- [ ] Exécuter step3 (créer RPC match_doctor_for_claim)
- [ ] Modifier `js/tabibi-claim.js` ligne 140-144 : remplacer SELECT email par appel RPC
- [ ] Ajouter champ email input dans `doctor-claim.html` (avant le bouton Réclamer)
- [ ] Tester le claim flow end-to-end sur staging avec un vrai legacy_id + email connu
- [ ] Tester le rejet : email incorrect → message d'erreur clair
- [ ] Retirer `email` du GRANT column-level dans step2 si Phase 2 est déployée
  (dans step2 actuel, email est déjà absent du GRANT — Phase 2 = migration du code JS uniquement)
- [ ] Ouvrir ticket pour Phase 3 : restreindre `authenticated` non-médecin sur phone/email

---

## 5. Colonnes non exposées aux vues publiques (aucun impact frontend)

Ces colonnes sont retirées du GRANT anon mais ne sont jamais utilisées côté frontend anon :

| Colonne | Raison d'exclusion |
|---|---|
| `user_id` | FK interne vers auth.users — jamais affiché |
| `claimed_by_user_id` | FK interne — jamais affiché |
| `claimed_at` | Timestamp interne — jamais affiché |
| `validation_docs_uploaded_at` | Flux admin — jamais affiché |
| `search_vector` | Index FTS — jamais affiché |

**Impact** : Zéro.
