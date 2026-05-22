-- =====================================================================
-- TABIBI.DOCTOR — FIXTURE : 3 blocages exceptionnels démo (compte test)
-- =====================================================================
-- Fichier : fixtures/test_doctor_blocages.sql
-- Date    : 2026-05-22
-- Phase   : 4.B.4.1
-- Cible   : Supabase Pro EU (postgres 15+)
--
-- Objectif : remplir la table `doctor_unavailable_slots` avec 3 blocages
-- représentatifs sur la fiche du compte test medecin.test@tabibi.doctor
-- (doctor_id = 023bbccc-e2ba-45ad-8c9a-8fca85da18fa, Ouanza Dental Clinic
-- claim 2026-05-22) → permet de valider visuellement l'UI agenda dans
-- les cas réels du calendrier algérien (fermetures Aïd musulmanes + formation
-- continue). Adapté au contexte cabinet médical en Algérie (et non au
-- calendrier liturgique chrétien des fixtures v1).
--
-- 🔒 GARANTIES
--   • Idempotent : DELETE des slots existants pour ce doctor_id AVANT
--     les INSERT (relançable sans risque de doublon)
--   • Safe : guard EXISTS sur la fiche médecin avant toute mutation
--   • Reversible : section ROLLBACK commentée en fin de fichier
--   • Verbose : RAISE NOTICE après chaque étape (cohérent avec les
--     autres seeds Phase 4.B)
--
-- 🧭 TIMEZONE
--   Les timestamps sont écrits avec offset `+01:00` (Europe/Algiers,
--   pas de DST en Algérie → CET toute l'année). Cohérent avec ce que
--   produit `tabibiDoctor._buildLocalDate(date, time).getTime()` côté
--   frontend pour un cabinet local algérien.
--
-- ⚠️ RLS : à exécuter dans Supabase SQL Editor en mode owner (postgres),
--   qui bypass RLS. Sinon les INSERT seraient bloqués par dus_insert_owner
--   (qui exige que doctor_id matche une fiche dont user_id = auth.uid()).
--
-- ⚠️ ATTENTION : ce seed DELETE tous les blocages existants pour
--    doctor_id=023bbccc-e2ba-45ad-8c9a-8fca85da18fa avant de réinsérer
--    les 3 fixtures. Si des blocages de test ad-hoc existent (créés
--    via l'UI doctor-dashboard pendant validation Phase 4.B.3), ils
--    seront perdus. C'est intentionnel : ces fixtures remplacent les
--    tests ponctuels par des cas représentatifs reproductibles.
-- =====================================================================



-- =====================================================================
-- SECTION 1 : DISCOVERY (read-only, optionnel)
-- =====================================================================

-- 1.1 — Confirme que la fiche cible existe et est bien claim
SELECT id, legacy_id, full_name, is_claimed, user_id
  FROM public.doctor_profiles
 WHERE id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
-- ATTENDU : 1 ligne, is_claimed=true, user_id non null

-- 1.2 — Combien de blocages déjà présents ?
SELECT count(*) AS existing_slots
  FROM public.doctor_unavailable_slots
 WHERE doctor_id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
-- IDÉAL : 0 (sinon le seed les remplace en mode idempotent)



-- =====================================================================
-- SECTION 2 : SEED (DELETE idempotent + 3 INSERT atomiques)
-- =====================================================================

DO $$
DECLARE
  v_doctor_id UUID := '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
  v_deleted   INT;
  v_inserted  INT;
BEGIN
  -- Guard : la fiche doit exister (sinon ON DELETE CASCADE n'aurait rien
  -- à supprimer et les INSERT échoueraient sur FK)
  IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles WHERE id = v_doctor_id) THEN
    RAISE EXCEPTION
      'Fiche doctor_id=% introuvable. Adapter v_doctor_id ou exécuter d''abord PHASE4B_seed_claim_test_doctor.sql.',
      v_doctor_id;
  END IF;
  RAISE NOTICE '✓ Fiche cible existe : %', v_doctor_id;

  -- Idempotence : supprime tous les blocages existants pour ce doctor_id
  DELETE FROM public.doctor_unavailable_slots
   WHERE doctor_id = v_doctor_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '✓ % blocage(s) existant(s) supprimé(s) (idempotence)', v_deleted;

  -- INSERT 3 blocages représentatifs du calendrier algérien (Aïd musulmans + formation)
  INSERT INTO public.doctor_unavailable_slots
    (doctor_id, starts_at,                  ends_at,                    all_day, reason)
  VALUES
    (v_doctor_id, '2026-03-20 00:00:00+01', '2026-03-22 23:59:00+01', true,  'Fermeture Aïd el-Fitr'),
    (v_doctor_id, '2026-05-27 00:00:00+01', '2026-05-29 23:59:00+01', true,  'Fermeture Aïd el-Adha'),
    (v_doctor_id, '2026-06-10 09:00:00+01', '2026-06-10 17:00:00+01', false, 'Formation continue cardiologie');
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '✅ % blocage(s) insérés (3 attendus : Aïd el-Fitr all-day, Aïd el-Adha all-day, Formation timed)', v_inserted;
END $$;



-- =====================================================================
-- SECTION 3 : VÉRIFICATION POST-INSERT (affichage final)
-- =====================================================================

SELECT
  id,
  starts_at,
  ends_at,
  all_day,
  reason,
  created_at
FROM public.doctor_unavailable_slots
 WHERE doctor_id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'
 ORDER BY starts_at ASC;
-- ATTENDU : EXACTEMENT 3 lignes dans cet ordre :
--   1. 2026-03-20 → 2026-03-22 (all_day=true, "Fermeture Aïd el-Fitr")
--   2. 2026-05-27 → 2026-05-29 (all_day=true, "Fermeture Aïd el-Adha")
--   3. 2026-06-10 09:00 → 17:00 (all_day=false, "Formation continue cardiologie")



-- =====================================================================
-- SECTION 4 : ROLLBACK (commenté — décommenter en cas de besoin)
-- =====================================================================
-- ⚠️ Décommenter SEULEMENT si tu veux purger les 3 blocages démo,
-- par exemple pour repartir d'une fiche vierge ou tester le cas
-- "Aucun blocage. Vous êtes disponible..." dans l'UI.

/*
DELETE FROM public.doctor_unavailable_slots
 WHERE doctor_id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';

-- Vérif post-rollback
SELECT count(*) AS slots_restants
  FROM public.doctor_unavailable_slots
 WHERE doctor_id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
-- ATTENDU : 0
*/

-- =====================================================================
-- FIN FIXTURE
-- =====================================================================
-- ✅ Après exécution, l'UI doctor-dashboard.html onglet Agenda doit
--    afficher les 3 cards "Blocages exceptionnels" triées par
--    starts_at (la passée en haut, la futur formation en bas).
-- =====================================================================
