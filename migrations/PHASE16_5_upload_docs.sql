-- =====================================================================
-- PHASE 16.5 — Upload docs flow claim
-- =====================================================================
-- Ajoute la colonne `validation_docs_uploaded_at` à `doctor_profiles`
-- pour tracker quand le médecin a soumis ses justificatifs (carte de
-- l'Ordre + pièce d'identité).
--
-- Sémantique distincte de `validation_pending_since` :
--   - `validation_pending_since` = quand la fiche est entrée en queue
--     de validation (positionné par le RPC `claim_my_doctor_profile`).
--   - `validation_docs_uploaded_at` = quand les docs ont été soumis.
--
-- Cas d'usage typique :
--   - Médecin claim → pending_since = now, docs_uploaded_at = now
--     (flow nominal doctor-claim.html, atomique).
--   - Médecin claim mais ferme modal avant upload → pending_since = now,
--     docs_uploaded_at = NULL. Banner "Documents manquants" sur
--     medecin-profile.html. Médecin revient plus tard → docs_uploaded_at
--     se met à jour, pending_since inchangé.
--
-- Utilité admin : tri de la queue de validation par "docs prêts depuis
-- le plus longtemps" — sans cette colonne, on confond avec les claims
-- abandonnés sans docs.
-- =====================================================================

BEGIN;

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS validation_docs_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.doctor_profiles.validation_docs_uploaded_at IS
  'Phase 16.5 — timestamp du dernier upload de docs validation (ordre + identité). NULL = aucun upload encore.';

-- Reload schema cache pour que PostgREST expose la colonne via REST.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- =====================================================================
-- 1. Colonne existe :
--      SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='doctor_profiles'
--        AND column_name='validation_docs_uploaded_at';
--      → 1 ligne, timestamp with time zone, YES
--
-- 2. Via REST anon :
--      curl -H "apikey: $ANON" \
--        "https://pudugodhiofqrctcdwfl.supabase.co/rest/v1/doctor_profiles?select=validation_docs_uploaded_at&limit=1"
--      → HTTP 200, [{"validation_docs_uploaded_at":null}]
--
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS validation_docs_uploaded_at;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
-- =====================================================================
