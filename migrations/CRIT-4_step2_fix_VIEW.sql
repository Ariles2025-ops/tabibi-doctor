-- CRIT-4 fix réellement appliqué en prod le 29 mai 2026
-- Masque address/latitude/longitude des fiches non-claimed au niveau de la vue
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
    CASE WHEN COALESCE(dp.is_claimed, false) THEN dp.address ELSE NULL::text END AS address,
    CASE WHEN COALESCE(dp.is_claimed, false) THEN dp.latitude ELSE NULL::numeric(9,6) END AS latitude,
    CASE WHEN COALESCE(dp.is_claimed, false) THEN dp.longitude ELSE NULL::numeric(9,6) END AS longitude,
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
    NOT COALESCE(dp.is_claimed, false) AS show_claim_badge
   FROM doctor_profiles dp
     LEFT JOIN specialties s ON s.id = dp.specialty_id
     LEFT JOIN wilayas w ON w.code = dp.wilaya_code
  WHERE COALESCE(dp.is_active, true) = true AND dp.validation_status <> 'rejected'::doctor_validation_status;
