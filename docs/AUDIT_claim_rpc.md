# Audit RPC `claim_my_doctor_profile`

Date : 2026-05-22
Mode : 100% read-only

## 1. Signature

2 surcharges :
- `claim_my_doctor_profile()` → boolean (vestige Phase 0, non utilisée)
- `claim_my_doctor_profile(legacy_id_input integer)` → json (utilisée par le frontend)

Toutes deux SECURITY DEFINER, plpgsql, search_path=public, owner=postgres.

## 2. Body

```sql
CREATE OR REPLACE FUNCTION public.claim_my_doctor_profile(legacy_id_input integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid        uuid := auth.uid();
  v_user_role       text;
  v_profile_id      uuid;
  v_already_claimed boolean;
BEGIN
  -- Auth
  IF v_auth_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Rôle
  SELECT role::text INTO v_user_role 
  FROM public.users 
  WHERE id = v_auth_uid;
  IF v_user_role IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;
  IF v_user_role NOT IN ('medecin', 'doctor') THEN
    RETURN json_build_object('ok', false, 'error', 'not_a_doctor_account');
  END IF;

  -- Ne pas autoriser un médecin à réclamer plusieurs fiches
  IF EXISTS (
    SELECT 1 FROM public.doctor_profiles 
    WHERE user_id = v_auth_uid AND is_claimed = true
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed_another_profile');
  END IF;

  -- Trouver la fiche par legacy_id
  SELECT id, COALESCE(is_claimed, false) 
    INTO v_profile_id, v_already_claimed
  FROM public.doctor_profiles 
  WHERE legacy_id = legacy_id_input;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'profile_not_found');
  END IF;
  IF v_already_claimed THEN
    RETURN json_build_object('ok', false, 'error', 'profile_already_claimed');
  END IF;

  -- Réclamer
  UPDATE public.doctor_profiles
  SET user_id    = v_auth_uid,
      is_claimed = true,
      claimed_at = now(),
      updated_at = now()
  WHERE id = v_profile_id;

  RETURN json_build_object(
    'ok',         true,
    'profile_id', v_profile_id,
    'legacy_id',  legacy_id_input,
    'claimed_at', now()
  );
END;
$function$


## 3. Permissions

authenticated/anon/PUBLIC : EXECUTE ✅
Frontend connecté peut appeler la RPC.

## 4. Verdict RPC

✅ Correcte. UPDATE complet : user_id + is_claimed + claimed_at + updated_at.

## 5. Verdict seed PHASE4B_seed_claim_test_doctor.sql

✅ Correct. UPDATE direct, idempotent, safe.

## 6. Root cause bug 4.B.3 (user_id NULL)

Seed commité (87773c7) mais jamais exécuté en prod sur Supabase.
UPDATE manuel du 2026-05-22 a fait ce que le seed aurait fait.

État prod confirmé 2026-05-22 14:40 : medecin.test claim Ouanza Dental Clinic.

## 7. Recommandations Phase 5

- Garder RPC telle quelle
- Garder seed tel quel
- Créer docs/PROD_SEEDS_REGISTRY.md
- Ajouter section "Seeds prod appliqués" dans PROGRESS.md