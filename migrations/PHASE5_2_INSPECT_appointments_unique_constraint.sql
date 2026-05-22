-- =====================================================================
-- TABIBI.DOCTOR — PHASE 5.2.1 review POINT 7 : INSPECT contraintes
-- EXCLUDE / UNIQUE sur table appointments (anti-double-booking)
-- =====================================================================
-- Fichier : migrations/PHASE5_2_INSPECT_appointments_unique_constraint.sql
-- Date    : 2026-05-22
-- Mode    : 100% READ-ONLY
-- Cible   : Supabase Pro EU
--
-- Objectif : déterminer si la table public.appointments a une contrainte
-- d'EXCLUSION (`contype = 'x'`) ou UNIQUE (`contype = 'u'`) qui empêche
-- 2 patients de réserver le MÊME créneau chez le MÊME médecin.
--
-- Conséquence si AUCUNE contrainte trouvée :
--   - 2 patients qui appellent createAppointment() simultanément pour
--     le même doctor_id + scheduled_at → les 2 INSERT réussissent !
--   - ERR_SLOT_TAKEN du frontend ne se déclenchera JAMAIS
--   - Hotfix DB nécessaire : EXCLUDE constraint avec btree_gist
--     (requiert extension btree_gist activée dans Supabase)
--
-- Conséquence si contrainte existe :
--   - 2e INSERT échoue avec code 23P01 (exclusion) ou 23505 (unique)
--   - Mapper _mapPostgrestError dans tabibi-booking.js le détecte déjà
--   - Pas de hotfix nécessaire
-- =====================================================================

SELECT
  con.conname        AS constraint_name,
  con.contype        AS type,         -- 'x'=EXCLUDE, 'u'=UNIQUE, 'p'=PK
  CASE con.contype
    WHEN 'x' THEN 'EXCLUDE (anti-overlap)'
    WHEN 'u' THEN 'UNIQUE (anti-duplicate)'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE        'OTHER'
  END                                  AS type_human,
  pg_get_constraintdef(con.oid)        AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname='appointments'
  AND con.contype IN ('x', 'u')
ORDER BY con.contype, con.conname;

-- ATTENDU :
--
--   Cas A — Contrainte présente :
--   ┌─────────────────────────────┬──────┬──────────────────────────┬──────────────┐
--   │ constraint_name             │ type │ type_human               │ definition   │
--   ├─────────────────────────────┼──────┼──────────────────────────┼──────────────┤
--   │ appointments_no_overlap     │ x    │ EXCLUDE (anti-overlap)   │ EXCLUDE USING gist (...)│
--   └─────────────────────────────┴──────┴──────────────────────────┴──────────────┘
--   → ERR_SLOT_TAKEN du frontend fonctionne. Pas de hotfix.
--
--   Cas B — AUCUNE ligne retournée :
--   → 🚨 Race condition active. Hotfix Phase 5.1bis-fix1 nécessaire :
--     ENABLE EXTENSION btree_gist;
--     ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
--       EXCLUDE USING gist (
--         doctor_id WITH =,
--         tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' min')::interval) WITH &&
--       ) WHERE (status IN ('pending'::appointment_status,
--                           'confirmed'::appointment_status));
--   → À tracer en TODO Phase 6 OU faire un hotfix DB avant Phase 5.2.3.
--
-- =====================================================================
-- BONUS — vérif que l'extension btree_gist est dispo dans Supabase
-- (requis pour EXCLUDE USING gist sur scalar + tstzrange)
-- =====================================================================
SELECT extname, extversion
  FROM pg_extension
 WHERE extname = 'btree_gist';
-- Si retour vide : extension non activée. À activer via :
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
-- (Supabase l'autorise sur le plan Pro)
