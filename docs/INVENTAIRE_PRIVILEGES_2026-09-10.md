# Inventaire des privilèges et de la RLS — schéma `public` et schémas voisins

> Relevé le 10 septembre 2026 sur la base de production (`information_schema.role_table_grants`, `pg_class`, `pg_policies`, `has_schema_privilege`, configuration PostgREST). Lettres : S select, I insert, U update, D delete, T truncate, R references, G trigger ; `-` = aucun privilège.

## Réponse à la question posée

- **Aucune table du schéma `public` n'a la RLS désactivée** : 55 tables, RLS activée sur les 55, forcée sur 3 (`consents_log`, `two_factor_secrets`, `video_sessions` — propriétaire compris).
- 18 tables ont la RLS activée **sans aucune policy** tout en portant des privilèges pour `anon`/`authenticated` : les 16 partitions `api_usage_log_2026MMDD`, `prescription_seq_year`, `rate_limits`. RLS sans policy = tout refusé ; mesuré : `GET` anon → 200 avec 0 ligne. Fermées, mais par la seule absence de policy ; les privilèges sont inutiles.
- Hors `public`, une seule table **sans RLS et lisible par `anon`** : `realtime.subscription` (métadonnées internes du service Realtime, 0 ligne). Le schéma `realtime` n'est pas exposé par PostgREST (`db_schema = public, graphql_public`) et aucune fonction publique ne le lit : injoignable depuis l'extérieur. Les tables `net._http_response` et `net.http_request_queue` sont sans RLS mais sans privilège pour `anon`.
- `anon` et `authenticated` peuvent **exécuter `net.http_post`, `net.http_get`, `net.http_delete`** (privilège par défaut de l'extension, schéma `net` en USAGE). Injoignable via PostgREST tant qu'aucune fonction exposée ne les appelle ; à retirer par hygiène.
- Privilèges trop larges hérités des `ALTER DEFAULT PRIVILEGES` (`anon=arwdDxtm`) : TRUNCATE sur 41 tables (anon) et 49 (authenticated) ; INSERT/UPDATE/DELETE accordés à `anon` sur 20 tables où seule la RLS l'arrête ; USAGE sur 7 séquences pour `anon`. Aucune de ces lignes n'est une table ouverte : la RLS est partout la barrière, ce qui est le fonctionnement voulu de Supabase, mais le principe du moindre privilège n'est pas appliqué.

## Tableau complet (schéma `public`)

| Table | RLS | Forcée | Policies | anon | authenticated | Lecture anon mesurée (HTTP, 10/09) |
|---|---|---|---|---|---|---|
| `admin_actions` | oui |  | 2 | DIRSGTU | DIRSGTU | 200, 0 ligne |
| `api_keys` | oui |  | 1 | - | - |  |
| `api_usage_log` | oui |  | 1 | - | - |  |
| `appointment_notifications` | oui | oui | 0 | - | - |  |
| `appointments` | oui |  | 6 | DIRSGTU | DIRSGTU | 200, 0 |
| `audit_log` | oui |  | 2 | DIRSGTU | DIRSGTU | 200, 0 |
| `cabinet_members` | oui |  | 1 | - | S |  |
| `cabinets` | oui |  | 3 | - | ISU |  |
| `claim_requests` | oui |  | 1 | DIRSGTU | DIRSGTU | 200, 0 |
| `consents_log` | oui |  | 1 | - | S | 401 |
| `conversations` | oui |  | 1 | - | S |  |
| `dawini_requests` | oui |  | 3 | DIRSGTU | DIRSGTU | 200, 0 |
| `dawini_responses` | oui |  | 2 | DIRSGTU | DIRSGTU | 200, 0 |
| `dawini_zones` | oui |  | 1 | DIRSGTU | DIRSGTU | 206, 58 lignes |
| `device_tokens` | oui | oui | 4 | - | DIRSGTU |  |
| `doctor_profiles` | oui |  | 2 | - | DIRSGT | 401 |
| `doctor_schedule` | oui |  | 5 | S | DISU | 200, 0 |
| `doctor_unavailable_slots` | oui | oui | 4 | DIRSGTU | DIRSGTU | 206, 3 lignes (R2) |
| `email_log` | oui |  | 1 | - | S |  |
| `favorites` | oui |  | 3 | - | DIS |  |
| `medical_records` | oui |  | 4 | DIRSGTU | DIRSGTU | 200, 0 |
| `medication_alerts` | oui |  | 1 | DIRSGTU | DIRSGTU | 200, 0 |
| `messages` | oui |  | 3 | - | S | 401 |
| `notifications` | oui |  | 2 | - | S |  |
| `patient_medical_data` | oui |  | 4 | - | - |  |
| `payments` | oui |  | 2 | DIRSGTU | DIRSGTU | 200, 0 |
| `pharmacies` | oui |  | 2 | DIRSGTU | DIRSGTU | 200, 0 (194 lignes invisibles) |
| `prescription_seq_year` | oui |  | 0 | DIRSGTU | DIRSGTU | 200, 0 |
| `prescriptions` | oui |  | 6 | - | ISU | 401 |
| `rate_limits` | oui |  | 0 | DIRSGTU | DIRSGTU | 200, 0 |
| `review_reports` | oui |  | 3 | DIRSGTU | DIRSGTU | 200, 0 |
| `reviews` | oui |  | 7 | S | DIRSGTU | 200, 0 |
| `sms_log` | oui |  | 1 | - | S | 401 |
| `specialties` | oui |  | 2 | DIRSGTU | DIRSGTU | 206, 44 |
| `two_factor_secrets` | oui |  | 1 | - | S |  |
| `users` | oui |  | 5 | DIRSGTU | DIRSGTU | 200, 0 |
| `video_sessions` | oui |  | 1 | - | S |  |
| `waiting_list` | oui |  | 4 | DIRSGTU | DIRSGTU | 200, 0 |
| `wilayas` | oui |  | 2 | DIRSGTU | DIRSGTU | 206, 58 |
| `api_usage_log_2026MMDD` ×16 | oui | | 0 | DIRSGTU | DIRSGTU | 404 (hors cache PostgREST) |

## Schémas voisins

| Schéma | USAGE anon | Tables lisibles par anon | Sans RLS parmi elles |
|---|---|---|---|
| `storage` | oui | `buckets`, `objects` (ALL, 13 policies), `buckets_analytics`, `buckets_vectors`, `s3_multipart_uploads`(+parts), `vector_indexes` | 0 |
| `realtime` | oui | `messages` (RLS), `subscription` (**sans RLS**, SELECT) | 1 |
| `net` | oui (fonctions `http_*` exécutables) | aucune table | 2 tables sans RLS mais sans privilège |
| `cron` | non | — | — |
| `vault` | non | — | — |

## Ce que le bloc « hygiène » de cette PR retire, et ce qu'il laisse

Retiré : TRUNCATE sur toutes les tables `public` pour `anon` et `authenticated`, et dans les privilèges par défaut. Laissé volontairement, à traiter dans une migration d'hygiène séparée après revue table par table : INSERT/UPDATE/DELETE de `anon` sur les 20 tables où seule la RLS l'arrête (retirer ce qu'aucun front n'utilise, par exemple DELETE partout pour `anon`), USAGE sur les 7 séquences, EXECUTE sur `net.http_*`, SELECT sur `realtime.subscription`. Chaque retrait doit être rejoué contre les 45 pages et les 30 tests Playwright avant d'être présenté.
