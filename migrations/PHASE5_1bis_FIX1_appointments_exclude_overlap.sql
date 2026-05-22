-- ====================================================================
-- PHASE 5.1bis-fix1 : Hotfix race condition + trigger cabinet
-- ====================================================================
-- Date : 2026-05-22
-- Contexte : audit Phase 5.2 a révélé 2 bugs critiques en prod :
--   1) Trigger appointments_set_cabinet_from_doctor utilise max(uuid)
--      qui n'existe pas → tout INSERT plante
--   2) Aucune contrainte anti-overlap → 2 patients peuvent réserver
--      le même créneau (testé manuellement, race condition confirmée)
-- ====================================================================

-- FIX 1 : Trigger cabinet — remplacer max(cabinet_id) par count + LIMIT 1
CREATE OR REPLACE FUNCTION public.appointments_set_cabinet_from_doctor()
RETURNS TRIGGER AS $$
DECLARE
  v_count integer;
  v_id    uuid;
BEGIN
  IF NEW.cabinet_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT current_cabinet_id INTO v_id FROM public.users WHERE id = NEW.doctor_id;
  EXCEPTION WHEN OTHERS THEN v_id := NULL; END;

  IF v_id IS NOT NULL THEN
    NEW.cabinet_id := v_id;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cabinet_members
  WHERE user_id = NEW.doctor_id
    AND role IN ('doctor','owner')
    AND active = true
    AND accepted_at IS NOT NULL;

  IF v_count = 1 THEN
    SELECT cabinet_id INTO v_id
    FROM public.cabinet_members
    WHERE user_id = NEW.doctor_id
      AND role IN ('doctor','owner')
      AND active = true
      AND accepted_at IS NOT NULL
    LIMIT 1;
    NEW.cabinet_id := v_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FIX 2 : Contrainte EXCLUDE anti-overlap par médecin
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_doctor
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));

-- Vérif
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.appointments'::regclass
  AND contype = 'x';
