-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 16.7 — public_doctors : gate RGPD adresse/lat/lng durci
-- Project : pudugodhiofqrctcdwfl (eu-central-1)
-- Author  : Tabibi / Claude
-- Date    : 2026-07-02
--
-- FIX RGPD: gate adresse/lat/lng = is_claimed AND validation_status='approved'
--           (avant: is_claimed seul) — borne ANPDP, appliqué en prod le 2026-07-02.
--
-- PROBLEM : depuis CRIT-4 (29/05), les 3 CASE de la vue ne testaient que
--           is_claimed → un médecin claimé mais encore 'pending' (docs non
--           validés) exposait déjà address + latitude + longitude.
--
-- CHANGE  : les 3 CASE testent désormais
--             COALESCE(dp.is_claimed, false)
--             AND dp.validation_status = 'approved'::doctor_validation_status
--           Le reste de la vue est identique à la version prod (WHERE
--           is_active + <> rejected inchangé ; téléphone jamais exposé).
--
-- NOTE colonne name_sort_key : ajoutée à la vue après CRIT-4 ; CREATE OR
--   REPLACE VIEW n'autorisant l'ajout de colonnes qu'en FIN de liste, elle
--   est en dernière position. En cas d'écart au replay, comparer avec :
--     SELECT pg_get_viewdef('public.public_doctors'::regclass, true);
--
-- Idempotent : CREATE OR REPLACE — rejouable sans effet de bord.
-- Ce fichier TRACE la version déjà déployée en prod le 2026-07-02
-- (contrôle fuites = 0 exécuté en prod, cf. requête de contrôle en pied).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.public_doctors AS
SELECT dp.id,
    dp.legacy_id,
    COALESCE(NULLIF(TRIM(BOTH FROM dp.full_name), ''::text), 'Praticien'::text) AS full_name,
    dp.full_name_ar,
    dp.entity_type::text AS entity_type,
    s.slug AS specialty_slug,
    s.name_fr AS specialty_fr,
    s.name_ar AS specialty_ar,
    s.name_en AS specialty_en,
    dp.wilaya_code,
    w.name_fr AS wilaya_fr,
    dp.city,
    CASE WHEN COALESCE(dp.is_claimed, false)
              AND dp.validation_status = 'approved'::doctor_validation_status
         THEN dp.address   ELSE NULL::text         END AS address,
    CASE WHEN COALESCE(dp.is_claimed, false)
              AND dp.validation_status = 'approved'::doctor_validation_status
         THEN dp.latitude  ELSE NULL::numeric(9,6) END AS latitude,
    CASE WHEN COALESCE(dp.is_claimed, false)
              AND dp.validation_status = 'approved'::doctor_validation_status
         THEN dp.longitude ELSE NULL::numeric(9,6) END AS longitude,
    dp.photo_url,
    dp.bio,
    dp.languages,
    dp.consultation_fee_dzd,
    dp.accepts_card,
    dp.accepts_chifa,
    dp.accepts_cash,
    dp.telehealth_enabled,
    dp.telehealth_fee_dzd,
    dp.rating,
    dp.review_count,
    dp.working_hours,
    COALESCE(dp.is_verified, false) AS is_verified,
    COALESCE(dp.is_claimed, false) AS is_claimed,
    dp.claimed_at,
    dp.validation_status,
        CASE
            WHEN COALESCE(dp.is_active, true) THEN 'active'::text
            ELSE 'inactive'::text
        END AS status,
    dp.created_at,
    NOT COALESCE(dp.is_claimed, false) AS show_claim_badge,
    dp.name_sort_key
   FROM doctor_profiles dp
     LEFT JOIN specialties s ON s.id = dp.specialty_id
     LEFT JOIN wilayas w ON w.code = dp.wilaya_code
  WHERE COALESCE(dp.is_active, true) = true
    AND dp.validation_status <> 'rejected'::doctor_validation_status;

-- ─────────────────────────────────────────────────────────────────────────
-- CONTRÔLE (après exécution) — fuites RGPD, doit retourner 0 :
--   SELECT count(*) AS fuites
--   FROM public.public_doctors
--   WHERE validation_status <> 'approved'
--     AND (address IS NOT NULL OR latitude IS NOT NULL OR longitude IS NOT NULL);
--   -- doit être 0
-- ─────────────────────────────────────────────────────────────────────────
