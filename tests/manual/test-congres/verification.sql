-- TEST-CONGRES-20260910 — tout ce qui porte la marque. Attendu : 0 partout AVANT le test et APRÈS le nettoyage.
with fiche as (select id from public.doctor_profiles where source = 'TEST-CONGRES-20260910' or legacy_id = 9000001 or full_name like 'TEST-CONGRES-20260910%'),
     comptes as (select id from public.users where (first_name = 'TEST-CONGRES' and last_name = '20260910') or email like 'test-congres-20260910%'
                 union select id from auth.users where email like 'test-congres-20260910%'),
     rdv as (select id from public.appointments where reason like 'TEST-CONGRES-20260910%' or doctor_id in (select id from fiche) or patient_id in (select id from comptes))
select 'doctor_profiles' objet, count(*) n from fiche
union all select 'auth.users', count(*) from auth.users where id in (select id from comptes)
union all select 'public.users', count(*) from public.users where id in (select id from comptes)
union all select 'appointments', count(*) from rdv
union all select 'appointment_notifications', count(*) from public.appointment_notifications where appointment_id in (select id from rdv)
union all select 'notifications', count(*) from public.notifications where user_id in (select id from comptes) or (data->>'appointment_id')::uuid in (select id from rdv)
union all select 'doctor_unavailable_slots', count(*) from public.doctor_unavailable_slots where doctor_id in (select id from fiche)
union all select 'device_tokens', count(*) from public.device_tokens where user_id in (select id from comptes)
union all select 'consents_log', count(*) from public.consents_log where user_id in (select id from comptes)
union all select 'storage.objects (doctor-docs du compte test)', count(*) from storage.objects where owner in (select id from comptes)
union all select 'claim_requests', count(*) from public.claim_requests where doctor_id in (select id from fiche) or user_id in (select id from comptes)
union all select '(conservé) audit_log lié', count(*) from public.audit_log where record_id in (select id from fiche union select id from rdv) or user_id in (select id from comptes)
union all select '(à ton choix) sms_log du numéro de test', count(*) from public.sms_log where phone_e164 = '+213XXXXXXXXX'  -- remplace par ton numéro
order by 1;
