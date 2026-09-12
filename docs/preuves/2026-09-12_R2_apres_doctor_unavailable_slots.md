# État APRÈS R2 — doctor_unavailable_slots — 2026-09-12T11:36:21Z

## pg_policies
```json
[{"policyname":"dus_delete_owner","cmd":"DELETE","roles":"{authenticated}","qual":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))","with_check":""},{"policyname":"dus_insert_owner","cmd":"INSERT","roles":"{authenticated}","qual":"","with_check":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))"},{"policyname":"dus_select_admin","cmd":"SELECT","roles":"{authenticated}","qual":"is_admin()","with_check":""},{"policyname":"dus_select_owner","cmd":"SELECT","roles":"{authenticated}","qual":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))","with_check":""},{"policyname":"dus_update_owner","cmd":"UPDATE","roles":"{authenticated}","qual":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))","with_check":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))"}]
```

## role_table_grants
```json
[{"grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"grantee":"postgres","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"grantee":"service_role","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"}]
```
