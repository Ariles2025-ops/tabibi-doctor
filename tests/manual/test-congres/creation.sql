-- TEST-CONGRES-20260910 — création de la fiche de test (À EXÉCUTER PAR AGHILES, après verification.sql à zéro)
-- Une seule ligne, marquée trois fois (source, full_name, legacy_id hors plage : max réel = 75 103).
insert into public.doctor_profiles
  (legacy_id, full_name, wilaya_code, specialty_id, city, address, working_hours, is_active, validation_status, source)
values
  (9000001,
   'TEST-CONGRES-20260910 Dr Test',
   16,
   (select id from public.specialties where slug = 'medecin-generaliste'),
   'Alger',
   'Adresse de test — TEST-CONGRES-20260910',
   '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],"fri":[{"open":"09:00","close":"12:00"}],"sat":[{"open":"09:00","close":"12:00"}]}'::jsonb,
   true, 'pending', 'TEST-CONGRES-20260910')
returning id, legacy_id, full_name;
