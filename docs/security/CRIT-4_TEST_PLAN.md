# CRIT-4 — Plan de test post-fix
**Date** : 2026-05-29 (v2 — sécurité maximale)  
**À exécuter après** : `migrations/CRIT-4_step2_fix.sql` et `CRIT-4_step3_rpc_claim.sql`

---

## 1. Tests fonctionnels

### Test F-1 — Fiche médecin Ouanza Dental Clinic (#241)

**Objectif** : La page de fiche médecin s'affiche normalement après le fix.

**Étapes** :
1. Ouvrir `https://tabibi.doctor/doctor.html?id=241`
2. Vérifier que le nom, la spécialité, la wilaya, les horaires s'affichent
3. Vérifier que le bouton WhatsApp / téléphone est présent

**Attendu** : Page complète, aucune erreur JS dans la console

**Régression** : Si la page affiche "Médecin introuvable" ou une erreur Supabase

---

### Test F-2 — Recherche médecin par spécialité

**Objectif** : La recherche sur `index.html` fonctionne normalement.

**Étapes** :
1. Ouvrir `https://tabibi.doctor/`
2. Chercher "Cardiologue" dans la barre de recherche
3. Vérifier que des résultats s'affichent avec photo, spécialité, wilaya

**Attendu** : Liste de médecins, aucun champ vide inattendu

**Note** : L'adresse affichée peut désormais venir du fallback `wilaya_fr` si
`address` disparaît des vues (comportement attendu, pas une régression).

**Régression** : Aucun résultat, erreur "permission denied"

---

### Test F-3 — Compteur "79 746 médecins"

**Objectif** : Le compteur visible sur la homepage affiche le bon nombre.

**Étapes** :
1. Ouvrir `https://tabibi.doctor/`
2. Observer le badge "X médecins certifiés en Algérie"

**Attendu** : Nombre ≥ 79 746 (ou la valeur actuelle en base)

**Implémentation** : Ce compteur utilise `public_doctors` (count) — la vue doit
fonctionner avec les column-level grants.

---

### Test F-4 — Patient connecté voit les fiches

**Objectif** : Un patient authentifié voit les fiches normalement.

**Étapes** :
1. Se connecter avec un compte patient (`test@tabibi.doctor / TestPassword123!`)
2. Chercher un médecin, ouvrir une fiche
3. Réserver un RDV (si disponible)

**Attendu** : Même expérience qu'avant le fix — aucune restriction pour les patients

---

### Test F-5 — Médecin connecté voit sa propre fiche complète

**Objectif** : Un médecin ayant réclamé sa fiche voit toutes ses informations
dans son dashboard (y compris `phone`, `email`, `address` via les RPCs SECURITY DEFINER).

**Étapes** :
1. Se connecter avec un compte médecin claimé
2. Ouvrir le dashboard médecin
3. Vérifier que `bio`, `phone`, `address`, `horaires`, `photo` s'affichent

**Attendu** : Dashboard complet — les RPCs `get_my_doctor_profile()` et
`update_my_doctor_profile()` sont SECURITY DEFINER, elles contournent
les column-level grants pour le médecin connecté.

**Régression** : Si le téléphone ou l'adresse n'est plus affiché dans le dashboard,
c'est une régression sur les RPCs (non attendue par ce fix).

---

### Test F-6 — Claim flow email lookup (⚠️ cassé après step2, restauré après Phase 2)

**Objectif** : Documenter l'état du claim flow entre step2 et la migration JS.

**État attendu AVANT migration JS (Phase 2)** :
- `doctor-claim.html` : la recherche par nom fonctionne toujours
  (via `claimable_doctors` — aucun email requis)
- Le bouton "Réclamer" peut échouer silencieusement si le JS lit encore `email`
  directement (ligne 140 de `tabibi-claim.js`)
- **Action** : déployer step3 et migrer JS en Phase 2 pour restaurer complètement

**État attendu APRÈS migration JS (Phase 2)** :
- Le claimant saisit son email dans le formulaire
- RPC `match_doctor_for_claim()` valide (BOOLEAN)
- Redirection login.html ou signup.html selon le cas

---

## 2. Tests sécurité — après step2

### Test S-1 — Bloc direct phone via REST (critique)

```bash
export ANON_KEY="<votre_clé_anon_publique>"
export PROJECT="pudugodhiofqrctcdwfl"

curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,phone&limit=1"
```

**Attendu APRÈS fix** :
```json
{"code":"42501","details":null,"hint":null,"message":"permission denied for table doctor_profiles"}
```
OU résultat avec `phone` absent.

**Si retourne `phone`** : le fix n'a pas été appliqué correctement.

---

### Test S-2 — Bloc email via REST (critique — nouveau en v2)

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,email&limit=1"
```

**Attendu** : Erreur 403 ou `email` absent du résultat.

**Si retourne `email`** : le fix v2 n'a pas été appliqué correctement.

---

### Test S-3 — Bloc address via REST (critique — nouveau en v2)

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,address&limit=1"
```

**Attendu** : Erreur 403 ou `address` absent du résultat.

---

### Test S-4 — Bloc user_id via REST (critique)

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,user_id&limit=1"
```

**Attendu** : Erreur 403 ou `user_id` absent du résultat.

---

### Test S-5 — Vue public_doctors toujours accessible

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/public_doctors?select=id,full_name&limit=3"
```

**Attendu** : Array de 3 médecins — code 200.

**Si erreur 403 ou tableau vide** : régression sur les vues → rollback immédiat.

---

### Test S-6 — Vue claimable_doctors toujours accessible

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/claimable_doctors?select=id,full_name&limit=1"
```

**Attendu** : 1 fiche non-claimée — code 200.

---

### Test S-7 — SELECT * bloqué sur doctor_profiles

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=*&limit=1"
```

**Attendu** : Erreur 403 "permission denied for table doctor_profiles".

---

### Test S-8 — Colonnes publiques de doctor_profiles encore lisibles

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,full_name,specialty_id&limit=1"
```

**Attendu** : 1 row avec les 3 colonnes — code 200.

---

### Test S-9 — Vérification grants dans Supabase Studio

Dans le SQL Editor Supabase, exécuter :

```sql
SELECT grantee, column_name, privilege_type
  FROM information_schema.role_column_grants
 WHERE table_schema = 'public'
   AND table_name   = 'doctor_profiles'
   AND grantee      = 'anon'
 ORDER BY column_name;
```

**Attendu** : 25 colonnes accordées, SANS `phone`, `email`, `address`,
`user_id`, `claimed_by_user_id`, `claimed_at`, `validation_docs_uploaded_at`,
`search_vector`.

---

## 3. Tests RPC — après step3

### Test T-1 — RPC retourne TRUE pour email correct

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_legacy_id": <LEGACY_ID_REEL>, "p_email": "<EMAIL_REEL_DE_CE_MEDECIN>"}' \
  "https://${PROJECT}.supabase.co/rest/v1/rpc/match_doctor_for_claim"
```

**Attendu** : `true`

---

### Test T-2 — RPC retourne FALSE pour email incorrect (anti-énumération)

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_legacy_id": <LEGACY_ID_REEL>, "p_email": "attaquant@evil.com"}' \
  "https://${PROJECT}.supabase.co/rest/v1/rpc/match_doctor_for_claim"
```

**Attendu** : `false` — sans révéler l'email stocké dans le message d'erreur.

---

### Test T-3 — RPC retourne FALSE pour legacy_id inexistant

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_legacy_id": 999999999, "p_email": "test@test.com"}' \
  "https://${PROJECT}.supabase.co/rest/v1/rpc/match_doctor_for_claim"
```

**Attendu** : `false`

---

## 4. Plan de rollback

**Trigger** : Si Test F-1, F-2 ou F-3 échouent après le fix.

**Procédure** (< 30 secondes) :

1. Ouvrir Supabase Studio → SQL Editor
2. Exécuter le bloc ROLLBACK de `CRIT-4_step2_fix.sql` :

```sql
BEGIN;

REVOKE SELECT (
    id, legacy_id, full_name, entity_type, specialty_id, wilaya_code,
    photo_url, rating, review_count, consultation_fee_dzd, bio, languages,
    accepts_chifa, accepts_card, accepts_cash, telehealth_enabled,
    telehealth_fee_dzd, working_hours, is_claimed, is_active, is_verified,
    validation_status, source, updated_at, created_at
) ON public.doctor_profiles FROM anon;

GRANT SELECT ON public.doctor_profiles TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

3. Vérifier que `https://tabibi.doctor/` affiche le compteur de médecins
4. Ouvrir un incident GitHub avec le log d'erreur exact observé

**Note** : Ce rollback restaure la faille CRIT-4. Ne pas laisser en état rollback
plus de 24h — identifier la cause de régression et proposer un fix alternatif.

---

## 5. Checklist pré-déploiement

- [ ] Snapshot / backup Supabase avant exécution
- [ ] Exécuter step1 — vérifier définitions des vues (SELECT * ou colonnes explicites ?)
- [ ] Exécuter step2 — si vues SELECT * : tel quel ; si colonnes explicites : décommenter SECTION_VIEW_RECREATION
- [ ] Exécuter tests S-1 à S-9 (sécurité)
- [ ] Exécuter tests F-1 à F-5 (fonctionnel — F-6 cassé, attendu)
- [ ] Exécuter step3 (RPC)
- [ ] Exécuter tests T-1 à T-3 (RPC)
- [ ] Si tout vert : fermer PR #4 et marquer CRIT-4 Phase 1 comme résolu
- [ ] Ouvrir ticket Phase 2 : migrer `tabibi-claim.js` pour utiliser la RPC
