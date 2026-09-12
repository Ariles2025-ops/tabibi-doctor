# Point de restauration — GRANTS de anon et authenticated sur le schéma public — 2026-09-12T11:49:01Z

Source : information_schema.role_table_grants (tables et vues), role_usage_grants (séquences). Aucun secret. Sert au bloc de retour arrière de la migration « liste blanche ».

## Tables et vues
```json
[{"table_name":"admin_actions","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"admin_actions","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_keys_analytics","grantee":"authenticated","privileges":"SELECT"},{"table_name":"api_usage_log_20260518","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260518","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260519","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260519","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260520","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260520","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260521","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260521","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260522","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260522","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260523","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260523","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260524","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260524","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260525","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260525","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260526","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260526","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260527","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260527","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260528","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260528","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260529","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260529","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260530","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260530","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260531","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260531","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260601","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260601","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260602","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"api_usage_log_20260602","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"appointments","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"appointments","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"audit_log","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"audit_log","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"cabinet_calendar_view","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"cabinet_members","grantee":"authenticated","privileges":"SELECT"},{"table_name":"cabinet_members_directory_view","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"cabinet_stats_view","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"cabinets","grantee":"authenticated","privileges":"INSERT,SELECT,UPDATE"},{"table_name":"claim_requests","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"claim_requests","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"consents_log","grantee":"authenticated","privileges":"SELECT"},{"table_name":"conversations","grantee":"authenticated","privileges":"SELECT"},{"table_name":"dawini_requests","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"dawini_requests","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"dawini_responses","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"dawini_responses","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"dawini_zones","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"dawini_zones","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"device_tokens","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"doctor_patients_directory","grantee":"authenticated","privileges":"SELECT"},{"table_name":"doctor_profiles","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE"},{"table_name":"doctor_ratings_summary","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"doctor_ratings_summary","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"doctor_reviews_public","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"doctor_reviews_public","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"doctor_schedule","grantee":"anon","privileges":"SELECT"},{"table_name":"doctor_schedule","grantee":"authenticated","privileges":"DELETE,INSERT,SELECT,UPDATE"},{"table_name":"doctor_unavailable_slots","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"email_log","grantee":"authenticated","privileges":"SELECT"},{"table_name":"favorites","grantee":"authenticated","privileges":"DELETE,INSERT,SELECT"},{"table_name":"medical_records","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"medical_records","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"medication_alerts","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"medication_alerts","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"messages","grantee":"authenticated","privileges":"SELECT"},{"table_name":"my_reviewable_appointments","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"my_reviewable_appointments","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"my_two_factor_status","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"my_upcoming_appointments","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"my_upcoming_appointments","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"my_video_sessions","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"notifications","grantee":"authenticated","privileges":"SELECT"},{"table_name":"payments","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"payments","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"pharmacies","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"pharmacies","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"prescription_seq_year","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"prescription_seq_year","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"prescriptions","grantee":"authenticated","privileges":"INSERT,SELECT,UPDATE"},{"table_name":"public_doctors","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"public_doctors","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"public_doctors_listed","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"public_doctors_listed","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"rate_limits","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"rate_limits","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"review_reports","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"review_reports","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"reviews","grantee":"anon","privileges":"SELECT"},{"table_name":"reviews","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"sms_log","grantee":"authenticated","privileges":"SELECT"},{"table_name":"specialties","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"specialties","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"two_factor_secrets","grantee":"authenticated","privileges":"SELECT"},{"table_name":"users","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"users","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"video_sessions","grantee":"authenticated","privileges":"SELECT"},{"table_name":"waiting_list","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"waiting_list","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"wilayas","grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"table_name":"wilayas","grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"}]
```

## Séquences (USAGE/SELECT/UPDATE)
```json
[{"object_name":"api_usage_log_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"api_usage_log_id_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"audit_log_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"audit_log_id_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"consents_log_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"consents_log_id_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"email_log_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"email_log_id_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"prescription_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"prescription_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"sms_log_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"sms_log_id_seq","grantee":"authenticated","privileges":"USAGE"},{"object_name":"specialties_id_seq","grantee":"anon","privileges":"USAGE"},{"object_name":"specialties_id_seq","grantee":"authenticated","privileges":"USAGE"}]
```

## Privilèges par défaut (pg_default_acl, schéma public)
```json
[{"pour_role":"postgres","type":"r","acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"},{"pour_role":"postgres","type":"f","acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"pour_role":"postgres","type":"S","acl":"{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}"},{"pour_role":"supabase_admin","type":"S","acl":"{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}"},{"pour_role":"supabase_admin","type":"r","acl":"{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}"},{"pour_role":"supabase_admin","type":"f","acl":"{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}"}]
```

## Regénération du bloc GRANT d'origine (retour arrière)
```sql
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on admin_actions to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on admin_actions to authenticated;
grant SELECT on api_keys_analytics to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260518 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260518 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260519 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260519 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260520 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260520 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260521 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260521 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260522 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260522 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260523 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260523 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260524 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260524 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260525 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260525 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260526 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260526 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260527 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260527 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260528 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260528 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260529 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260529 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260530 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260530 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260531 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260531 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260601 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260601 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260602 to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on api_usage_log_20260602 to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on appointments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on appointments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on audit_log to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on audit_log to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on cabinet_calendar_view to authenticated;
grant SELECT on cabinet_members to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on cabinet_members_directory_view to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on cabinet_stats_view to authenticated;
grant INSERT, SELECT, UPDATE on cabinets to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on claim_requests to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on claim_requests to authenticated;
grant SELECT on consents_log to authenticated;
grant SELECT on conversations to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_requests to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_requests to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_responses to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_responses to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_zones to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on dawini_zones to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on device_tokens to authenticated;
grant SELECT on doctor_patients_directory to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE on doctor_profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on doctor_ratings_summary to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on doctor_ratings_summary to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on doctor_reviews_public to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on doctor_reviews_public to authenticated;
grant SELECT on doctor_schedule to anon;
grant DELETE, INSERT, SELECT, UPDATE on doctor_schedule to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on doctor_unavailable_slots to authenticated;
grant SELECT on email_log to authenticated;
grant DELETE, INSERT, SELECT on favorites to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on medical_records to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on medical_records to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on medication_alerts to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on medication_alerts to authenticated;
grant SELECT on messages to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_reviewable_appointments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_reviewable_appointments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_two_factor_status to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_upcoming_appointments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_upcoming_appointments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on my_video_sessions to authenticated;
grant SELECT on notifications to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on payments to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on payments to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on pharmacies to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on pharmacies to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on prescription_seq_year to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on prescription_seq_year to authenticated;
grant INSERT, SELECT, UPDATE on prescriptions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public_doctors to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public_doctors to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public_doctors_listed to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public_doctors_listed to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on rate_limits to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on rate_limits to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on review_reports to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on review_reports to authenticated;
grant SELECT on reviews to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on reviews to authenticated;
grant SELECT on sms_log to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on specialties to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on specialties to authenticated;
grant SELECT on two_factor_secrets to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on users to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on users to authenticated;
grant SELECT on video_sessions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on waiting_list to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on waiting_list to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on wilayas to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on wilayas to authenticated;
```
