-- =====================================================================
-- TABIBI.DOCTOR — PHASE 4.B.1 : Documentation du format working_hours
-- =====================================================================
-- Fichier : migrations/PHASE4B_doc_working_hours_comment.sql
-- Date    : 2026-05-21
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- Objectif : COMMENT ON COLUMN auto-documenté pour que la Phase 5
-- (système de RDV) puisse parser `doctor_profiles.working_hours` sans
-- deviner la forme.
--
-- Idempotent : COMMENT ON ... écrase silencieusement le précédent.
-- =====================================================================

COMMENT ON COLUMN public.doctor_profiles.working_hours IS
$$Format JSONB documenté Phase 4.B.1 (2026-05-21) :

  {
    "mon": [{"open":"HH:MM","close":"HH:MM"}, ...],
    "tue": [{"open":"HH:MM","close":"HH:MM"}, ...],
    "wed": [...], "thu": [...], "fri": [...],
    "sat": [...], "sun": [...]
  }

Règles :
- Keys courtes anglaises : mon, tue, wed, thu, fri, sat, sun (i18n côté UI)
- Valeur = ARRAY d'objets {open, close} (jamais tuple, jamais flag enabled)
- Tableau VIDE [] = jour fermé (pas besoin d'un champ "enabled")
- Plusieurs entrées dans le tableau = créneaux multiples par jour
  (cas DZ très fréquent : pause midi 12-14h → 2 entrées)
- Format heure : "HH:MM" 24h (zero-padded), pas de timezone (heure locale cabinet)
- close DOIT être > open dans chaque objet (validation côté frontend)
- Entrées d'un même jour DOIVENT être triées par open ascendant (convention UI)

Exemple complet (cardiologue avec pause midi sauf vendredi) :
  {
    "mon": [{"open":"09:00","close":"12:00"},{"open":"14:00","close":"17:00"}],
    "tue": [{"open":"09:00","close":"12:00"},{"open":"14:00","close":"17:00"}],
    "wed": [{"open":"09:00","close":"12:00"},{"open":"14:00","close":"17:00"}],
    "thu": [{"open":"09:00","close":"12:00"},{"open":"14:00","close":"17:00"}],
    "fri": [{"open":"09:00","close":"13:00"}],
    "sat": [],
    "sun": []
  }

Validation au RPC : update_my_doctor_profile() refuse tout JSON dont
jsonb_typeof != 'object' (cf. PHASE4_doctor_dashboard_v2.sql section 8).
La validation fine (ARRAY par jour, format HH:MM, ordre) est déléguée
au frontend (`window.tabibiDoctor.serializeSchedule()` Phase 4.B.1).
$$;

-- Vérification
SELECT col_description('public.doctor_profiles'::regclass,
        (SELECT ordinal_position::int FROM information_schema.columns
          WHERE table_schema='public' AND table_name='doctor_profiles'
            AND column_name='working_hours'))
  AS working_hours_doc;
-- ATTENDU : la longue chaîne ci-dessus (pas NULL)
