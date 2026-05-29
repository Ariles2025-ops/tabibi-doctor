-- =====================================================================
-- PUSH — STEP 1 : Table device_tokens
-- =====================================================================
-- Stocke les tokens FCM (Android) et APNs (iOS) des utilisateurs
-- connectés pour l'envoi de notifications push ciblées.
--
-- PRÉREQUIS : aucun (table standalone, référence auth.users)
--
-- EXÉCUTION : Supabase SQL Editor ou CLI (migration non auto-run)
-- ROLLBACK   : voir section en fin de fichier
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Création de la table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL,
    platform    TEXT        NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Un même token ne peut apparaître deux fois pour le même user.
    -- Permet un UPSERT propre sans créer de doublons.
    CONSTRAINT device_tokens_user_token_unique UNIQUE (user_id, token)
);

COMMENT ON TABLE public.device_tokens IS
    'Tokens FCM/APNs des appareils enregistrés pour les notifications push. '
    'Un utilisateur peut avoir plusieurs tokens (multi-device). '
    'RLS stricte : chaque user ne voit et ne modifie que ses propres tokens.';

COMMENT ON COLUMN public.device_tokens.token    IS 'Token FCM (Android) ou APNs (iOS) brut retourné par @capacitor/push-notifications.';
COMMENT ON COLUMN public.device_tokens.platform IS 'android | ios | web';

-- ---------------------------------------------------------------------
-- SECTION 2 — Index
-- ---------------------------------------------------------------------
-- Lookup rapide par user_id (requête la plus fréquente : "quels tokens
-- pour cet utilisateur ?").
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
    ON public.device_tokens (user_id);

-- ---------------------------------------------------------------------
-- SECTION 3 — Trigger updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_device_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_device_tokens_updated_at
    BEFORE UPDATE ON public.device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.set_device_tokens_updated_at();

-- ---------------------------------------------------------------------
-- SECTION 4 — Activer RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Forcer RLS même pour le propriétaire de la table (postgres / service_role
-- passant par PostgREST). Les appels backend via service_role key contournent
-- RLS nativement ; ne pas bypasser ici pour l'accès utilisateur.
ALTER TABLE public.device_tokens FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- SECTION 5 — Policies RLS (authenticated uniquement)
-- ---------------------------------------------------------------------

-- SELECT : un user ne lit que ses propres tokens
CREATE POLICY "device_tokens_select_own"
    ON public.device_tokens
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- INSERT : un user n'insère que pour lui-même
CREATE POLICY "device_tokens_insert_own"
    ON public.device_tokens
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE : un user ne met à jour que ses propres tokens
CREATE POLICY "device_tokens_update_own"
    ON public.device_tokens
    FOR UPDATE
    TO authenticated
    USING     (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE : un user ne supprime que ses propres tokens
CREATE POLICY "device_tokens_delete_own"
    ON public.device_tokens
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Pas de policy pour anon → RLS bloque tout accès anon par défaut.

-- ---------------------------------------------------------------------
-- SECTION 6 — Grants
-- ---------------------------------------------------------------------
-- Retirer tout accès anon existant ou futur (grant public par défaut
-- accordé automatiquement dans certaines configs Supabase).
REVOKE ALL ON public.device_tokens FROM anon;
REVOKE ALL ON public.device_tokens FROM PUBLIC;

-- Accorder les 4 opérations à authenticated (RLS s'applique par-dessus).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;

-- service_role conserve son accès total (bypass RLS) pour les Edge Functions
-- et les jobs serveur d'envoi de push. Pas de REVOKE sur service_role.

-- ---------------------------------------------------------------------
-- SECTION 7 — Recharger le schéma PostgREST
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- VÉRIFICATION POST-EXÉCUTION (à lancer après COMMIT)
-- =====================================================================
--
-- 1. Table créée :
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name = 'device_tokens';
--    → 1 row
--
-- 2. RLS activée :
--    SELECT relrowsecurity, relforcerowsecurity
--    FROM pg_class WHERE relname = 'device_tokens';
--    → t | t
--
-- 3. Policies présentes (doit retourner 4 rows) :
--    SELECT policyname, cmd, roles
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'device_tokens'
--    ORDER BY cmd;
--
-- 4. Grants authenticated (doit lister SELECT/INSERT/UPDATE/DELETE) :
--    SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'device_tokens'
--      AND grantee = 'authenticated'
--    ORDER BY privilege_type;
--
-- 5. Confirmer AUCUN grant pour anon :
--    SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'device_tokens'
--      AND grantee = 'anon';
--    → 0 rows
--
-- =====================================================================
-- ROLLBACK D'URGENCE
-- =====================================================================
-- DROP TABLE IF EXISTS public.device_tokens CASCADE;
-- DROP FUNCTION IF EXISTS public.set_device_tokens_updated_at() CASCADE;
-- NOTIFY pgrst, 'reload schema';
-- =====================================================================
