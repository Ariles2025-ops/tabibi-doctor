# État AVANT R2 — doctor_unavailable_slots — 2026-09-12T11:35:23Z

Source : API de gestion Supabase, requêtes SELECT sur pg_policies et information_schema.role_table_grants. Aucun secret.

## pg_policies
```json
[{"policyname":"dus_delete_owner","cmd":"DELETE","roles":"{authenticated}","permissive":"PERMISSIVE","qual":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))","with_check":""},{"policyname":"dus_insert_owner","cmd":"INSERT","roles":"{authenticated}","permissive":"PERMISSIVE","qual":"","with_check":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))"},{"policyname":"dus_select_public","cmd":"SELECT","roles":"{anon,authenticated}","permissive":"PERMISSIVE","qual":"true","with_check":""},{"policyname":"dus_update_owner","cmd":"UPDATE","roles":"{authenticated}","permissive":"PERMISSIVE","qual":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))","with_check":"(EXISTS ( SELECT 1\n   FROM doctor_profiles dp\n  WHERE ((dp.id = doctor_unavailable_slots.doctor_id) AND (dp.user_id = auth.uid()))))"}]
```

## role_table_grants
```json
[{"grantee":"anon","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"grantee":"authenticated","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"grantee":"postgres","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"},{"grantee":"service_role","privileges":"DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"}]
```

## reloptions / RLS
```json
[{"relrowsecurity":true,"relforcerowsecurity":true,"reloptions":"","lignes":3}]
```

## Retour arrière
```sql
begin;
drop policy if exists dus_select_owner on public.doctor_unavailable_slots;
drop policy if exists dus_select_admin on public.doctor_unavailable_slots;
create policy dus_select_public on public.doctor_unavailable_slots for select to anon, authenticated using (true);
grant select, insert, update, delete, truncate, references, trigger on public.doctor_unavailable_slots to anon;  -- privilèges d'origine (ALL) ; select suffit fonctionnellement
commit;
```
