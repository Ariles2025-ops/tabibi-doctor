**Date** : 27 mai 2026
**Source** : analyse statique des `migrations/*.sql` + appels `js/*.rpc(...)`
**⚠️ Limite** : limité aux migrations versionnées. Dump complet `pg_proc` à obtenir.

---

# Inventaire des fonctions / RPC Supabase

## 1. Functions identifiées dans les migrations

| Fonction | Type | Migration source |
|---|---|---|
| `public.handle_new_auth_user()` | TRIGGER fn | (signup hook) |
| `public.tg_bump_updated_at()` | TRIGGER fn | (mise à jour `updated_at`) |
| `public.get_my_doctor_profile()` | RPC SECURITY DEFINER (présumée) | PHASE4 / PHASE4B |
| `public.update_my_doctor_profile(...)` | RPC SECURITY DEFINER (présumée) | PHASE4 / PHASE4B |
| `public.appointments_set_cabinet_from_doctor()` | TRIGGER fn | PHASE5_1bis_alter_appointments |
| `public.appointments_sync_slot_times()` | TRIGGER fn | PHASE5_1bis_alter_appointments |
| `public.get_available_slots(...)` | RPC | PHASE5_1bis_get_available_slots_rpc |

## 2. RPC appelées depuis le frontend

| RPC | Fichier appelant | Paramètres |
|---|---|---|
| `claim_my_doctor_profile(legacy_id_input)` | `js/tabibi-claim.js:96` | `legacy_id_input: number` |
| `can_review_doctor(p_doctor_id)` | `js/tabibi-reviews.js:125` | `p_doctor_id: uuid` |
| `get_available_slots(...)` | `js/tabibi-booking.js:251` | (à documenter — doctor_id, date_from, date_to) |
| `get_my_doctor_profile()` | `js/tabibi-doctor-dashboard.js:75` | (aucun — auth.uid()) |
| `update_my_doctor_profile(params)` | `js/tabibi-doctor-dashboard.js:96` | jsonb params |
| `upsert_patient_medical_data(payload)` | `js/tabibi-pii-migration.js:125,172` | jsonb encrypted |
| `get_patient_medical_data()` | `js/tabibi-pii-migration.js:155` | (aucun — auth.uid()) |

## 3. Audit des paramètres et risques

### `claim_my_doctor_profile(legacy_id_input number)`

- **Risque** : si la RPC accepte un `legacy_id` arbitraire sans vérification supplémentaire, un attaquant pourrait revendiquer des fiches qui ne lui appartiennent pas.
- **Mitigation attendue** : la RPC doit vérifier un **secret de claim** transmis par WhatsApp, ou exiger validation manuelle.
- **À tester** : tentatives de claim avec ID de fiche connu mais non possédé.

### `get_available_slots(doctor_id, date_from, date_to)`

- **Risque** : DoS via plage temporelle trop large.
- **Mitigation attendue** : la fonction borne la plage côté serveur (max 30 jours).
- **À tester** : appel avec `date_from = 1900-01-01, date_to = 2099-01-01` doit échouer ou borner.

### `update_my_doctor_profile(params jsonb)`

- **Risque** : mass assignment — passer un champ inattendu (`role = 'admin'`, `verified = true`).
- **Mitigation attendue** : whitelist serveur des champs autorisés.
- **À tester** : appeler avec un champ `role` ou `is_admin` dans le jsonb → ignoré ou erreur.

### `upsert_patient_medical_data(payload jsonb)`

- **Risque** : injection de payload non chiffré → fuite.
- **Mitigation attendue** : la donnée doit être déjà chiffrée côté client (E2E avec clé dérivée de l'utilisateur).
- **À auditer** : algorithme de chiffrement, gestion de clé, rotation.

## 4. Functions absentes du repo mais nécessaires

| Fonction soupçonnée | Indices |
|---|---|
| `is_admin()` | utilisée probablement dans les policies |
| `create_appointment(...)` | car pas de `appointments_insert_patient` policy → RPC dédiée probable |
| `cancel_appointment(...)` | flux patient annulation |
| `confirm_appointment(...)` | flux médecin confirmation |
| `mark_no_show(...)` | logique no-show |
| `submit_review(...)` | post-RDV |
| `report_review(...)` | modération |
| Hook `signup` post-confirm | création row `patients` ou `doctor_profiles` |

## 5. Requête à exécuter en prod

```sql
-- Toutes les fonctions custom (schéma public)
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
  pg_catalog.pg_get_function_result(p.oid) AS return_type,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

## 6. Recommandations

| # | Action | Priorité |
|---|---|---|
| F1 | Dumper toutes les fonctions custom et les versionner dans `migrations/` | **CRIT** |
| F2 | Tester `claim_my_doctor_profile` avec ID arbitraire et vérifier rejet | **CRIT** |
| F3 | Auditer les `SECURITY DEFINER` — confirmer qu'aucune ne contourne RLS trop largement | **CRIT** |
| F4 | Vérifier que les RPC qui prennent du `jsonb` whitelistent les champs | **CRIT** |
| F5 | Auditer le chiffrement PII (`upsert_patient_medical_data`) | **CRIT** |
| F6 | Borner les paramètres temporels (`get_available_slots`) | MAJ |
