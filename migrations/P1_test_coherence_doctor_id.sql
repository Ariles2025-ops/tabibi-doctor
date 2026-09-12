-- ============================================================================
-- P1 — INCOHÉRENCE doctor_id : auth.uid() ou doctor_profiles.id ?
-- ============================================================================
-- Projet : pudugodhiofqrctcdwfl (Tabibi, PRODUCTION)
-- Origine : CLAUDE.md, § Base de données —
--   « prescriptions et doctor_schedule comparent doctor_id = auth.uid()
--     (user id), alors que les autres tables utilisent doctor_profiles.id.
--     À vérifier au 1er onboarding médecin réel. »
--
-- ENJEU : si les deux identifiants diffèrent, le premier médecin qui signe ne
-- verra NI ses créneaux NI ses ordonnances, et personne ne comprendra pourquoi
-- (les RLS ne renvoient pas d'erreur, elles renvoient zéro ligne). C'est le
-- genre de bug qui coûte un ambassadeur.
--
-- Ce fichier est en LECTURE SEULE. Il ne corrige rien : il tranche.
-- ============================================================================


-- ############################################################################
-- RUN 1 — Que comparent réellement les policies ?
-- ############################################################################
-- On lit les policies des 2 tables suspectes et de 2 tables témoins.
-- Chercher dans using_clause : « auth.uid() » directement comparé à doctor_id
-- (suspect) vs une sous-requête sur doctor_profiles (correct).
SELECT tablename, policyname, cmd, qual AS using_clause, with_check AS with_check_clause
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('prescriptions','doctor_schedule','appointments','doctor_profiles')
 ORDER BY tablename, policyname;


-- ############################################################################
-- RUN 2 — Les deux identifiants coïncident-ils, en vrai ?
-- ############################################################################
-- Sur les fiches réellement revendiquées : est-ce que doctor_profiles.id
-- vaut la même chose que doctor_profiles.user_id ?
SELECT count(*)                                        AS fiches_revendiquees,
       count(*) FILTER (WHERE id::text = user_id::text) AS id_egal_user_id,
       count(*) FILTER (WHERE id::text <> user_id::text) AS id_different_de_user_id
  FROM public.doctor_profiles
 WHERE user_id IS NOT NULL;

-- LECTURE DU RÉSULTAT
--   id_different_de_user_id = 0  -> les deux écritures sont équivalentes,
--                                   rien à corriger, on documente et on ferme.
--   id_different_de_user_id > 0  -> BUG CONFIRMÉ : prescriptions et
--                                   doctor_schedule sont invisibles pour leur
--                                   propriétaire. À corriger AVANT le premier
--                                   onboarding médecin.


-- ############################################################################
-- RUN 3 — Y a-t-il déjà des lignes orphelines ?
-- ############################################################################
-- Des créneaux / ordonnances dont le doctor_id ne correspond à aucun user_id
-- de doctor_profiles : autant de lignes que personne ne peut plus lire.
SELECT 'doctor_schedule' AS table_testee,
       count(*)          AS lignes_totales,
       count(*) FILTER (
         WHERE doctor_id::text NOT IN (
           SELECT user_id::text FROM public.doctor_profiles WHERE user_id IS NOT NULL)
       ) AS lignes_sans_proprietaire_par_user_id
  FROM public.doctor_schedule
UNION ALL
SELECT 'prescriptions',
       count(*),
       count(*) FILTER (
         WHERE doctor_id::text NOT IN (
           SELECT user_id::text FROM public.doctor_profiles WHERE user_id IS NOT NULL)
       )
  FROM public.prescriptions;

-- Si une de ces deux tables n'existe pas encore en prod, le Run échoue sur son
-- nom : c'est en soi une réponse (cf. les 4 RPC ordonnances absentes).
