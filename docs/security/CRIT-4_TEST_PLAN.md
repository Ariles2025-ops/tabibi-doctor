# CRIT-4 — Plan de test post-fix
**Date** : 2026-05-28  
**À exécuter après** : `migrations/CRIT-4_fix_doctor_profiles_rls.sql`

---

## 1. Tests fonctionnels

### Test F-1 — Fiche médecin Ouanza Dental Clinic (#241)

**Objectif** : La page de fiche médecin s'affiche normalement après le fix.

**Étapes** :
1. Ouvrir `https://tabibi.doctor/doctor.html?id=241` (ou l'URL équivalente)
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
dans son dashboard (y compris `phone`, `email` via la RPC SECURITY DEFINER).

**Étapes** :
1. Se connecter avec un compte médecin claimé
2. Ouvrir le dashboard médecin
3. Vérifier que `bio`, `phone`, `horaires`, `photo` s'affichent correctement

**Attendu** : Dashboard complet — les RPCs `get_my_doctor_profile()` et
`update_my_doctor_profile()` sont SECURITY DEFINER, elles contournent
les column-level grants pour le médecin connecté.

**Note** : Si le téléphone n'est plus affiché dans le dashboard, c'est une régression
sur `authenticated` (non attendue par ce fix qui ne touche que `anon`).

---

### Test F-6 — Claim flow email lookup

**Objectif** : Le flow de réclamation de fiche fonctionne (email lookup).

**Étapes** :
1. Ouvrir `https://tabibi.doctor/doctor-claim.html`
2. Rechercher un médecin par nom/legacy_id
3. Cliquer "Réclamer cette fiche"
4. Vérifier que le système détecte si un compte existe pour l'email

**Attendu** : Redirection vers login.html ou signup.html selon le cas
(`tabibi-claim.js:140` lit encore `doctor_profiles.email` — `email` est conservé
dans le GRANT anon, donc cette opération doit fonctionner)

---

## 2. Tests sécurité

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
OU (si column-level grant interprété différemment par PostgREST) :
```json
[{"id":"<uuid>"}]
```
avec `phone` absent du résultat (colonne ignorée silencieusement).

**Si retourne `phone`** : le fix n'a pas été appliqué correctement.

---

### Test S-2 — Bloc user_id via REST (critique)

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,user_id&limit=1"
```

**Attendu** : Erreur 403 ou `user_id` absent du résultat.

---

### Test S-3 — Vue public_doctors toujours accessible

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/public_doctors?select=id,full_name&limit=3"
```

**Attendu** : Array de 3 médecins avec `id` et `full_name` — code 200.

**Si retourne erreur 403 ou tableau vide** : régression sur les vues, appliquer le rollback.

---

### Test S-4 — Vue claimable_doctors toujours accessible

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/claimable_doctors?select=id,full_name&limit=1"
```

**Attendu** : 1 fiche non-claimée — code 200.

---

### Test S-5 — SELECT * bloqué sur doctor_profiles

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=*&limit=1"
```

**Attendu** : Erreur 403 "permission denied for table doctor_profiles".
PostgREST interprète `select=*` comme SELECT sur la table entière, ce qui
nécessite un SELECT table-level (que nous avons révoqué).

---

### Test S-6 — Colonnes publiques de doctor_profiles encore lisibles

```bash
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://${PROJECT}.supabase.co/rest/v1/doctor_profiles?select=id,full_name,specialty_id&limit=1"
```

**Attendu** : 1 row avec les 3 colonnes — code 200.
(Ces colonnes sont dans le GRANT column-level anon)

---

### Test S-7 — Supabase Studio (vérification des grants)

Dans le SQL Editor Supabase, exécuter :

```sql
SELECT grantee, column_name, privilege_type
  FROM information_schema.role_column_grants
 WHERE table_schema = 'public'
   AND table_name   = 'doctor_profiles'
   AND grantee      = 'anon'
 ORDER BY column_name;
```

**Attendu** : Liste de colonnes sans `phone`, `user_id`, `claimed_by_user_id`,
`claimed_at`, `validation_docs_uploaded_at`, `search_vector`.

---

## 3. Plan de rollback

**Trigger** : Si Test F-1, F-2 ou F-3 échouent après le fix.

**Procédure** (< 30 secondes) :

1. Ouvrir Supabase Studio → SQL Editor
2. Exécuter la section ROLLBACK du fichier `migrations/CRIT-4_fix_doctor_profiles_rls.sql` :

```sql
BEGIN;

REVOKE SELECT (id, legacy_id, full_name, entity_type, specialty_id,
  wilaya_code, address, photo_url, rating, review_count,
  consultation_fee_dzd, bio, languages, accepts_chifa, accepts_card,
  accepts_cash, telehealth_enabled, telehealth_fee_dzd, working_hours,
  is_claimed, is_active, is_verified, validation_status, source,
  updated_at, created_at, email)
ON public.doctor_profiles FROM anon;

GRANT SELECT ON public.doctor_profiles TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

3. Vérifier que `https://tabibi.doctor/` affiche le compteur de médecins
4. Ouvrir un incident sur GitHub avec le log d'erreur exact observé

**Note** : Ce rollback restaure la faille CRIT-4. Ne pas laisser en état rollback
plus de 24h — identifier la cause de régression et proposer un fix alternatif.

---

## 4. Checklist pré-déploiement

- [ ] Backup / snapshot de la base Supabase avant exécution
- [ ] Exécuter SECTION 1 (vérifications) et vérifier que les 3 policies existent
- [ ] Exécuter SECTION 2 (fix) dans une transaction
- [ ] Exécuter les 7 tests sécurité (S-1 à S-7)
- [ ] Exécuter les 6 tests fonctionnels (F-1 à F-6) sur staging/production
- [ ] Si tout vert : fermer la PR et marquer CRIT-4 comme résolu
- [ ] Ouvrir un ticket Phase 2 pour : créer RPC + retirer `email` du grant anon
