**Date** : 27 mai 2026
**Source** : analyse statique des `migrations/*.sql`
**⚠️ Limite** : pas d'accès direct à la prod Supabase pour cette campagne. Les findings ci-dessous sont basés sur les migrations versionnées + références côté front. Le **dump SQL prod est indispensable** pour finaliser.

---

# Rapport — Audit base de données

## 1. Synthèse

| Domaine | Statut |
|---|---|
| Tables RLS-confirmé dans migrations | 2 (`doctor_unavailable_slots`, `public_doctors_master`) |
| Tables référencées côté front | 13 |
| **Tables référencées sans RLS confirmé** | **~11** ⚠️ |
| Functions/RPC versionnées | 7 |
| RPC appelées par le front | 7 |
| Triggers versionnés | 3 |

> ⚠️ **Le delta entre tables référencées front (13) et tables RLS-confirmé migrations (2) est le plus gros risque** identifiable depuis le code seul. Sans dump prod, **on ne peut pas savoir si RLS est activé** sur `users`, `appointments`, `reviews`, etc.

## 2. Findings prioritaires

### CRIT-DB-1 — Confirmation RLS sur tables sensibles

Tables référencées côté front sans RLS visible dans les migrations :

- `users` — PII (email, téléphone)
- `appointments` — métadonnées de soins
- `doctor_profiles` — profil médecin
- `reviews` — avis patient
- `review_reports` — signalements
- `doctor_ratings_summary` — résumé (matview ?)
- `doctor_reviews_public` — vue publique
- `my_reviewable_appointments` — vue
- `my_upcoming_appointments` — vue
- `public_doctors` — vue publique
- `specialties`, `wilayas` — référentiels (probablement publics, OK)

**Action requise** : exécuter en prod :

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

et faire suivre toutes les `rowsecurity = false` d'une décision documentée.

### CRIT-DB-2 — Mass assignment via `update_my_doctor_profile`

Cette RPC prend des `params` jsonb. Auditer la whitelist côté serveur. Tester :

```sql
SELECT update_my_doctor_profile('{"role": "admin", "is_admin": true}'::jsonb);
```

Le médecin ne doit **pas** pouvoir s'élever en rôle.

### CRIT-DB-3 — Permissivité de `pdm_select_all`

Politique `pdm_select_all` sur `SELECT *` : si `pdm` contient des mappings patient/médecin (ou des messages), `SELECT all` est trop ouvert. Restreindre à `WHERE patient_id = auth.uid() OR doctor_user_id = auth.uid()`.

### MAJ-DB-4 — Index sur colonnes filtrées

Pages SEO (490) qui filtrent par `wilaya` + `specialty` doivent s'appuyer sur un index composite. Vérifier :

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('doctor_profiles','public_doctors','public_doctors_master');
```

Index recommandés :

```sql
CREATE INDEX IF NOT EXISTS idx_doctors_wilaya_spec
  ON public_doctors_master (wilaya_id, specialty_id)
  WHERE status = 'active';
```

### MAJ-DB-5 — Cohérence `users` vs `doctor_profiles`

Test demandé par la mission : « nombre de `doctor_profiles` avec `user_id IS NOT NULL` = nombre de `users` `role='medecin'` ».

```sql
SELECT
  (SELECT COUNT(*) FROM doctor_profiles WHERE user_id IS NOT NULL) AS dp_with_user,
  (SELECT COUNT(*) FROM users WHERE role = 'medecin') AS users_medecin;
```

Tout écart > 0 = bug d'intégrité référentielle. À investiguer.

### MIN-DB-6 — Vues matérialisées

`doctor_ratings_summary` semble être un résumé. À vérifier :
- est-ce une vue, une matview, ou une table ?
- si matview : fréquence de refresh, déclenchement
- si table : trigger sur `reviews` qui la maintient à jour ?

## 3. Stratégie de fix recommandée

### Phase 1 — Recensement (1 jour)

```bash
# Sur poste local connecté à la prod en lecture seule
pg_dump -Fc --schema-only --no-owner --no-privileges \
  -h db.xxx.supabase.co -U postgres > prod_schema_dump.sql
```

Commit dans `docs/audit/PROD_SCHEMA_SNAPSHOT.sql` (avec masquage des credentials).

### Phase 2 — Diff avec migrations (1/2 jour)

Identifier ce qui existe en prod mais pas en migration versionnée. Tous ces objets sont du **drift** à régulariser.

### Phase 3 — Audit RLS systématique (1 jour)

Pour chaque table publique, valider :

- [ ] RLS activé
- [ ] 1 policy SELECT minimum
- [ ] 1 policy INSERT/UPDATE/DELETE selon le besoin
- [ ] Pas de policy `USING (true)` sans justification

### Phase 4 — Tests intrusifs (1/2 jour)

Activer `RUN_INTRUSIVE=1 npx playwright test 03-security.spec.js` avec 2 comptes test, valider que A ne lit pas B.

## 4. Recommandations consolidées

| # | Action | Priorité | Effort |
|---|---|---|---|
| DB-1 | Dumper le schéma prod et le commit | **CRIT** | 1 h |
| DB-2 | Audit RLS de toutes les tables sensibles | **CRIT** | 1 j |
| DB-3 | Test mass-assignment sur `update_my_doctor_profile` | **CRIT** | 2 h |
| DB-4 | Restreindre `pdm_select_all` | **CRIT** | 2 h |
| DB-5 | Tests RLS intrusifs Playwright | **CRIT** | 1 j |
| DB-6 | Audit index sur colonnes filtrées | MAJ | 4 h |
| DB-7 | Documenter chaque RPC `SECURITY DEFINER` | MAJ | 4 h |
| DB-8 | Audit cohérence `users` vs `doctor_profiles` | MAJ | 1 h |
| DB-9 | Auditer trigger `auth.users → public.users` | MAJ | 2 h |
| DB-10 | Documenter politique de backup (RPO/RTO) | MAJ | 2 h |
