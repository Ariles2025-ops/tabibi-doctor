**Date** : 27 mai 2026
**Source** : analyse statique `migrations/*.sql`

---

# Inventaire des triggers Supabase

## 1. Triggers identifiés dans les migrations

| Trigger | Table | Fonction associée | Migration |
|---|---|---|---|
| `trg_public_doctors_master_updated_at` | `public_doctors_master` | `tg_bump_updated_at()` | PHASE16_5 / PHASE4 |
| `trg_doctor_profiles_bump_updated_at` | `doctor_profiles` | `tg_bump_updated_at()` | PHASE4 |
| `trg_appointments_sync_slot_times` | `appointments` | `appointments_sync_slot_times()` | PHASE5_1bis |

## 2. Fonctions trigger référencées

- `tg_bump_updated_at()` — pattern standard de bump auto du champ `updated_at`. ✅
- `appointments_set_cabinet_from_doctor()` — copie automatique du cabinet depuis le médecin sur insert. À vérifier que c'est attaché.
- `appointments_sync_slot_times()` — synchronise les horaires du slot avec l'appointment.
- `handle_new_auth_user()` — vraisemblablement attaché à `auth.users` pour créer automatiquement le profil applicatif post-signup.

## 3. Triggers attendus mais non documentés dans le repo

À vérifier en prod :

| Trigger soupçonné | Hypothèse |
|---|---|
| `auth.users → public.users` | Hook signup auto |
| `appointments → notifications` | Création notif après confirmation |
| `claim_requests → workflow` | Notification équipe sur claim |
| `reviews → doctor_ratings_summary` | Rafraîchissement matview / résumé |
| `appointments → no_show_counter` | Incrément compteur no-show patient |

## 4. Risques liés aux triggers

| Risque | Mitigation |
|---|---|
| Trigger `BEFORE INSERT` qui modifie silencieusement les données | Documenter clairement, tester par cas-limites |
| Cycle de triggers (A→B→A) | Audit du graphe de triggers |
| Triggers avec `SECURITY DEFINER` qui contournent les vérifs côté policy | Lister tous les `SECURITY DEFINER` |
| Triggers qui logent en clair des données sensibles | Auditer `tg_*` qui écrivent dans des tables d'audit |

## 5. Requête à exécuter en prod

```sql
-- Liste tous les triggers du schéma public
SELECT
  event_object_schema AS schema,
  event_object_table AS table,
  trigger_name,
  event_manipulation AS event,
  action_timing AS timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY event_object_table, trigger_name;
```

## 6. Recommandations

| # | Action | Priorité |
|---|---|---|
| T1 | Dumper tous les triggers prod et les versionner | **CRIT** |
| T2 | Vérifier le hook `auth.users → public.users` (rôle, valeur par défaut) | **CRIT** |
| T3 | Vérifier qu'il n'existe **aucun trigger** qui désactive RLS pour son exécution | **CRIT** |
| T4 | Documenter chaque trigger : but, table, conditions, effets | MAJ |
