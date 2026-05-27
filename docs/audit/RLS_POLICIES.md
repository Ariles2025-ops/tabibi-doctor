**Date** : 27 mai 2026
**Source** : analyse statique des fichiers `migrations/*.sql` versionnés dans ce dépôt
**⚠️ Limite** : seules les migrations versionnées sont auditées. Le **dump complet de la prod Supabase** doit être obtenu et croisé avec ce fichier pour exhaustivité.

---

# Inventaire des RLS Policies — Tabibi.doctor

## 1. Tables avec RLS confirmé `ENABLE` dans les migrations

| Table | Statut RLS |
|---|---|
| `public.doctor_unavailable_slots` | ✅ ENABLED |
| `public.public_doctors_master` | ✅ ENABLED |

> ⚠️ **D'autres tables existent** (référencées côté front) qui doivent avoir RLS activé : `users`, `appointments`, `doctor_profiles`, `reviews`, `review_reports`, etc. À **confirmer via un dump production**.

## 2. Policies déclarées dans les migrations

### Table : `doctor_unavailable_slots` (alias `dus`)

| Policy | Action | Cible logique |
|---|---|---|
| `dus_select_public` | SELECT | Public (visible par tout user authentifié) |
| `dus_insert_owner` | INSERT | Owner uniquement |
| `dus_update_owner` | UPDATE | Owner uniquement |
| `dus_delete_owner` | DELETE | Owner uniquement |

### Table : `doctor_photos` (présumée)

| Policy | Action | Cible logique |
|---|---|---|
| `doctor_photos_select_public` | SELECT | Public |
| `doctor_photos_insert_owner` | INSERT | Owner |
| `doctor_photos_update_owner` | UPDATE | Owner |
| `doctor_photos_delete_owner` | DELETE | Owner |

### Table : `patient_doctor_messages` / `patient_doctor_mapping` (alias `pdm`)

| Policy | Action | Cible logique |
|---|---|---|
| `pdm_select_all` | SELECT | Tous (à vérifier : trop ouvert ?) |
| `pdm_update_own` | UPDATE | Owner |
| `pdm_insert_admin` | INSERT | Admin uniquement |
| `pdm_delete_admin` | DELETE | Admin uniquement |

> ⚠️ **À investiguer** : `pdm_select_all` semble très permissif. Si « pdm » concerne des correspondances patient↔médecin, l'accès doit être restreint au patient ou au médecin concerné, pas « all ».

### Table : `appointments`

| Policy | Action | Cible logique |
|---|---|---|
| `appointments_select_doctor` | SELECT | Le médecin lié au RDV |
| `appointments_update_doctor` | UPDATE | Le médecin lié au RDV |
| `appointments_update_patient_cancel_only` | UPDATE | Patient pour cancel uniquement (champ status restreint ?) |

> ⚠️ **Manque visible** : pas de `appointments_select_patient` listée — le patient peut-il lister ses RDV ? À confirmer.
> ⚠️ Pas de `appointments_insert_*` : qui peut créer un RDV ? RPC dédiée ?

## 3. Patterns RLS recommandés (à vérifier en prod)

Pour chaque table sensible, les 4 policies minimales :

```sql
-- SELECT : self ou rôle approprié
CREATE POLICY {table}_select_self ON public.{table}
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- INSERT : seulement pour soi
CREATE POLICY {table}_insert_self ON public.{table}
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE : seulement ses propres données
CREATE POLICY {table}_update_self ON public.{table}
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DELETE : seulement ses propres données + role admin
CREATE POLICY {table}_delete_self ON public.{table}
  FOR DELETE USING (user_id = auth.uid() OR is_admin());
```

## 4. Tables sensibles à RLS-auditer en priorité

| Priorité | Table | Raison |
|---|---|---|
| **CRIT** | `users` | PII (email, téléphone) |
| **CRIT** | `appointments` | Métadonnées de soin |
| **CRIT** | `patient_medical_data` (table PII chiffrée — `tabibi-pii-migration.js`) | Données de santé chiffrées |
| **MAJ** | `doctor_profiles` | Profil médecin (info pro) |
| **MAJ** | `claim_requests` | Demandes de revendication |
| **MAJ** | `reviews` | Avis patient |
| **MAJ** | `review_reports` | Signalements |
| **MIN** | `specialties`, `wilayas` | Référentiels publics |

## 5. Actions à compléter

| # | Action | Priorité |
|---|---|---|
| RLS-1 | Obtenir le dump complet des policies prod via `pg_policies` et le commit sous `docs/audit/RLS_POLICIES_PROD.sql` | **CRIT** |
| RLS-2 | Compléter ce fichier pour chaque table sensible | **CRIT** |
| RLS-3 | Probes Playwright intrusifs (cf. `03-security.spec.js` + `RUN_INTRUSIVE=1`) | **CRIT** |
| RLS-4 | Documenter le rôle `is_admin()` (existe-t-il ? défini comment ?) | MAJ |
| RLS-5 | Confirmer `pdm_select_all` (clarifier la portée) | MAJ |

## 6. Requête SQL à exécuter en prod pour dump

```sql
-- Liste toutes les policies actives sur le schéma public
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Liste toutes les tables avec RLS activé
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```
