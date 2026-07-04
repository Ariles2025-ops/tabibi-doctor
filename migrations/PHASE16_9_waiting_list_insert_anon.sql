-- [FIX 2026-07-04] waiting_list : anon ne pouvait pas s'inscrire (RLS 42501). INSERT anon+auth, email requis, SELECT reste fermé.
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can join waiting list" ON public.waiting_list;
CREATE POLICY "Anyone can join waiting list"
  ON public.waiting_list FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(trim(email)) > 0);
