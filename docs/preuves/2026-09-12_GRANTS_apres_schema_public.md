# GRANTS — état APRÈS application de la liste blanche (12/09/2026, ~12:20 UTC)

Migration `supabase/migrations/20260912_grants_liste_blanche.sql` appliquée par l'API de gestion sur feu vert d'Aghiles
(décisions du 12/09 : cabinet_members SELECT accordé, audit_log sans droit, specialties/wilayas retirés à anon).
Réponse de l'API : `[]` (transaction unique, COMMIT). Avant application, aucune dérive depuis le point de restauration
(`2026-09-12_GRANTS_avant_schema_public.md`) : anon 282 privilèges / 42 relations, authenticated 366 / 64, identiques.

## Droits résiduels (information_schema.role_table_grants, schéma public)

| Relation | anon | authenticated |
|---|---|---|
| admin_actions | — | SELECT |
| api_keys_analytics | — | SELECT |
| appointments | — | INSERT, SELECT, UPDATE |
| cabinet_calendar_view · cabinet_members_directory_view · cabinet_stats_view | — | SELECT |
| cabinet_members | — | SELECT |
| cabinets | — | SELECT, UPDATE |
| conversations | — | SELECT |
| dawini_requests | — | SELECT, UPDATE |
| dawini_responses · pharmacies · medication_alerts · prescriptions | — | SELECT |
| device_tokens | — | INSERT, SELECT, UPDATE |
| doctor_patients_directory · my_upcoming_appointments · my_reviewable_appointments | — | SELECT |
| doctor_profiles | — | SELECT |
| doctor_ratings_summary · doctor_reviews_public · public_doctors | SELECT | SELECT |
| doctor_unavailable_slots | — | DELETE, INSERT, SELECT |
| messages | — | INSERT, SELECT, UPDATE |
| notifications | — | SELECT, UPDATE |
| review_reports | — | INSERT, SELECT |
| reviews | — | INSERT, SELECT, UPDATE |
| specialties · wilayas | — | SELECT |
| users | — | INSERT, SELECT, UPDATE |
| waiting_list | INSERT | INSERT, SELECT |

Totaux : anon 4 privilèges sur 4 relations (282 / 42 avant) ; authenticated 52 privilèges sur 36 relations (366 / 64 avant).

## Contrôles §7

- TRUNCATE / REFERENCES / TRIGGER pour anon ou authenticated : **0**.
- `has_schema_privilege` USAGE sur public : anon **true**, authenticated **true**.
- EXECUTE sur les fonctions de public : anon **289** (289 le 10/09), authenticated **310** — inchangé.
- Séquences : 0 privilège résiduel ; aucune table recevant un INSERT accordé n'utilise `nextval`.
- `appointments_set_cabinet_from_doctor` : `prosecdef = true`, `search_path=public, pg_temp`.
- Défauts (pg_default_acl) : rôle postgres → tables et séquences sans anon/authenticated. **Les défauts posés par supabase_admin
  accordent encore ALL** (`anon=arwdDxtm/supabase_admin`) : une table créée depuis l'éditeur du tableau de bord héritera de ALL,
  une table créée par migration (rôle postgres) n'héritera de rien. À revérifier après chaque nouvelle table.

## Les 39 RPC appelées par le front

- 35 existent, **toutes SECURITY DEFINER** : insensibles aux GRANT sur les tables, EXECUTE inchangé.
- 5 n'existent pas en base (appels morts, à traiter hors GRANT) : `validate_cabinet_invitation`, `mark_prescription_delivered`,
  `update_prescription_draft`, `request_prescription_signature`, `create_prescription_draft`.

## HTTP avec la clé publiable (rôle anon)

| Requête | Code | Corps |
|---|---|---|
| GET /rest/v1/public_doctors?select=id&limit=1 | 200 | 1 ligne |
| GET /rest/v1/doctor_ratings_summary?limit=1 | 200 | [] |
| POST /rest/v1/rpc/get_available_slots (fiche test, lundi 14/09) | 200 | 12 créneaux |
| POST /rest/v1/rpc/dawini_top_missing | 200 | [] |
| POST /rest/v1/waiting_list (colonnes du front : email, wilaya, source, role, lang) | 201 | — (ligne marquée `TEST-CONGRES-20260910`) |
| GET /rest/v1/waiting_list | 401 | 42501 |
| GET /rest/v1/users · specialties · wilayas · appointments · audit_log | 401 | 42501 |

## Parcours navigateur (Chrome, localhost:8080, build fix/medecin-1-faux-succes)

- `doctor-profile.html?id=<fiche test>` sans session : fiche affichée (nom, « Fiche revendiquée par le médecin », Certifié,
  téléconsultation), aucune erreur console. Lecture de `public_doctors` par anon : intacte.
- Recherche depuis l'accueil : voir capture du 12/09 (résultat ci-dessous dans le fil de la PR).
- Parcours connectés (patient : prise de RDV ; médecin : « Mes horaires », agenda, confirmation) : à rejouer après connexion
  d'Aghiles sur les comptes de test A / B / C — la preuve est le parcours.
