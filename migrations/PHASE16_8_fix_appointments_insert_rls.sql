-- [FIX 2026-07-04] RLS 42501 : le with_check INSERT interrogeait doctor_profiles
-- sous la RLS du patient (invisible via la vue public_doctors) -> EXISTS=false.
-- Fix : contrôle via fonction SECURITY DEFINER, sans exposer de données.
CREATE OR REPLACE FUNCTION public.is_doctor_bookable(p_doctor_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.doctor_profiles dp
    WHERE dp.id = p_doctor_id AND dp.is_claimed = true
      AND dp.validation_status = 'approved');
$$;
GRANT EXECUTE ON FUNCTION public.is_doctor_bookable(uuid) TO authenticated, anon;
ALTER POLICY "Patients create own appointments" ON public.appointments
  WITH CHECK (auth.uid() = patient_id AND public.is_doctor_bookable(doctor_id));
