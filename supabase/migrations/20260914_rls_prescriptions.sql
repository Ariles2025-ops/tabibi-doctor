-- =====================================================================
-- 20260914_rls_prescriptions.sql — une seule regle par commande d'ecriture
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP, puis relit AU NAVIGATEUR qu'un
-- medecin voit toujours ses ordonnances et un patient les siennes.
-- Deux paires d'yeux. Je n'applique rien.
--
-- Decisions prises par le stratege le 14/09/2026 sur
-- `supabase/mesures/PROPOSITION_rls_prescriptions.md` : option B + §3.
--
-- ---------------------------------------------------------------------
-- CECI N'EST PAS UNE CORRECTION DE TROU. C'EST DE LA PROFONDEUR DE DEFENSE.
-- ---------------------------------------------------------------------
-- **Aucune ecriture n'est ouverte sur cette table aujourd'hui.** Mesure du
-- 14/09/2026, `information_schema.role_table_grants`, `public.prescriptions` :
--
--     authenticated  ->  SELECT                                   ← et c'est tout
--     anon           ->  (aucune ligne : aucun droit)
--     postgres       ->  DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     service_role   ->  idem
--
-- Et **la RLS ne s'evalue qu'APRES le controle de privilege** : sans
-- `GRANT INSERT`/`UPDATE` a `authenticated`, PostgREST ne peut rien ecrire dans
-- cette table, quelles que soient les politiques. Les quatre politiques
-- d'ecriture sont donc **inatteignables**.
--
-- ⚠️  J'avais ecrit l'inverse dans `DESIGN_ordonnances.md` §0.1 (« le chemin
-- direct par la table reste ouvert »). C'ETAIT FAUX : j'avais lu
-- « authenticated est dans la liste des grants » et conclu « il peut ecrire »,
-- sans regarder QUELS privileges. Exactement la faute que j'avais moi-meme
-- relevee sur `audit_log` deux sequences plus tot, refaite dans l'autre sens.
-- La correction est dans la proposition §0 ; elle est rappelee ici parce que
-- c'est ICI que le prochain lecteur viendra.
--
-- Alors pourquoi le faire ? Parce que **les regles s'annulent entre elles**.
-- Les politiques PERMISSIVE se combinent en OU : la plus laxiste gagne.
--
--     INSERT :  presc_insert_doctor (stricte)  OU  rx_insert_doctor (doctor_id=uid)
--               ->  rx_insert_doctor absorbe l'autre. La stricte ne decrit qu'une intention.
--     UPDATE :  presc_update (stricte)         OU  rx_update_doctor (doctor_id=uid OR is_admin)
--               ->  idem.
--
-- Le jour ou quelqu'un ajoute `GRANT INSERT, UPDATE ... TO authenticated` — pour
-- un ecran, pour un essai — **la regle laxiste gagnera en silence**, et l'ecran
-- semblera protege par la stricte dont le nom rassure. Un piege arme qui attend
-- un GRANT est precisement ce qui se declenche un vendredi soir.
--
-- ---------------------------------------------------------------------
-- CE QUE FAIT CETTE MIGRATION
-- ---------------------------------------------------------------------
--   1. Supprime les deux politiques laxistes d'ecriture (`rx_insert_doctor`,
--      `rx_update_doctor`). Il reste UNE politique par commande d'ecriture,
--      celle dont le nom dit ce qu'elle fait.
--   2. Retire du `USING` de `presc_update` la branche qui laissait le PATIENT
--      modifier une ordonnance `signed` ou `delivered`.
--   3. Pose un `COMMENT ON POLICY` sur les quatre politiques restantes, disant
--      qu'elles sont inatteignables en ecriture sans GRANT.
--
-- Elle ne touche **AUCUN** `GRANT` : `authenticated` garde `SELECT` seul, avant
-- comme apres. Elle ne touche aucune politique SELECT.
--
-- ---------------------------------------------------------------------
-- CE QU'ELLE NE CASSE PAS — mesure, pas deduction
-- ---------------------------------------------------------------------
-- Retirer la branche patient de `presc_update` n'enleve au patient **aucune
-- action legitime**. Ce qu'il fait — marquer une remise — passe par
-- `public.mark_prescription_delivered(uuid, text)`, verifiee le 14/09 :
--
--     prosecdef = true (SECURITY DEFINER) · proprietaire = postgres
--     has_function_privilege('authenticated', …, 'EXECUTE') = true
--     garde interne : WHERE p.id = … AND (p.patient_id = v_actor OR p.doctor_id = v_actor)
--     puis           IF v_statut NOT IN ('signed','delivered') THEN RAISE …
--
-- et `public.prescriptions` a `relrowsecurity = true`, `relforcerowsecurity = FALSE` :
-- le proprietaire n'est donc pas soumis a la RLS. La fonction ecrit **sans jamais
-- dependre de cette politique**, et refait elle-meme le controle de propriete.
-- **Le chemin du patient reste entier.**
--
-- A noter aussi : il n'existe **aucune politique DELETE** sur cette table. Un
-- DELETE par `authenticated` est refuse deux fois — pas de GRANT, pas de
-- politique. On n'en ajoute pas.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les deux laxistes d'ecriture s'en vont
-- ---------------------------------------------------------------------
-- `rx_insert_doctor` : WITH CHECK (doctor_id = auth.uid()) — n'exigeait ni
-- `status='draft'`, ni `patient_id <> doctor_id`, ni l'absence de signature.
-- Elle rendait `presc_insert_doctor` decorative.
DROP POLICY IF EXISTS rx_insert_doctor ON public.prescriptions;

-- `rx_update_doctor` : (doctor_id = auth.uid() OR is_admin()) des deux cotes —
-- sans contrainte de statut, donc une ordonnance `signed` restait modifiable
-- par son medecin quel que soit son etat.
DROP POLICY IF EXISTS rx_update_doctor ON public.prescriptions;

-- ---------------------------------------------------------------------
-- 2. `presc_update` perd la branche patient
-- ---------------------------------------------------------------------
-- AVANT (releve le 14/09) — le patient pouvait modifier une ordonnance SIGNEE :
--   USING  ((doctor_id = uid AND status IN ('draft','signed','delivered'))
--           OR (patient_id = uid AND status IN ('signed','delivered'))    ← celle-ci
--           OR is_admin())
--   CHECK  (doctor_id = uid OR patient_id = uid OR is_admin())
--
-- Le `WITH CHECK` n'interdisait que de changer de proprietaire : rien n'empechait
-- de reecrire `medications`. C'est la politique dite « stricte » qui le permettait,
-- pas la laxiste — supprimer `rx_update_doctor` ne l'aurait donc PAS ferme.
--
-- ⚠️  ECART ASSUME PAR RAPPORT A LA CONSIGNE (« recree ») : j'utilise
-- `ALTER POLICY` et non `DROP` + `CREATE`. Meme resultat exactement, et deux
-- risques en moins : aucun instant sans politique UPDATE sur la table, et
-- impossible de se tromper en retapant `FOR UPDATE TO authenticated`.
-- La forme DROP + CREATE, si tu la preferes, est en pied de fichier.
ALTER POLICY presc_update ON public.prescriptions
  USING      (
    (doctor_id = auth.uid() AND status = ANY (ARRAY['draft'::text, 'signed'::text, 'delivered'::text]))
    OR is_admin()
  )
  WITH CHECK (
    doctor_id = auth.uid()
    OR is_admin()
  );

-- ---------------------------------------------------------------------
-- 3. Les quatre restantes DISENT qu'elles ne s'appliquent pas
-- ---------------------------------------------------------------------
-- Meme geste que pour « Only admins read audit » : une politique qui ne peut
-- jamais s'appliquer doit le dire, sinon le prochain lecteur conclura qu'elle
-- protege — et c'est la lecture qui coute cher, pas la politique.
COMMENT ON POLICY presc_insert_doctor ON public.prescriptions IS
  'INATTEIGNABLE AUJOURD''HUI : `authenticated` n''a que SELECT sur cette table, et la RLS ne s''evalue qu''APRES le controle de privilege. Cette regle ne protege donc rien tant qu''aucun GRANT INSERT n''est pose — elle DECRIT ce qui serait permis si on en posait un. Depuis le 14/09/2026 elle est la seule politique INSERT (rx_insert_doctor, plus laxiste, supprimee) : la creation ne peut donc se faire qu''en brouillon, non signee, et par un medecin qui n''est pas le patient. Le vrai chemin de creation reste la RPC.';

COMMENT ON POLICY presc_update ON public.prescriptions IS
  'INATTEIGNABLE AUJOURD''HUI : `authenticated` n''a que SELECT sur cette table (la RLS ne s''evalue qu''APRES le controle de privilege). Seule politique UPDATE depuis le 14/09/2026 (rx_update_doctor supprimee). La branche qui laissait le PATIENT modifier une ordonnance signed/delivered a ete retiree le meme jour : un patient n''ecrit JAMAIS dans une ordonnance. Sa seule action legitime — marquer une remise — passe par mark_prescription_delivered(), SECURITY DEFINER, qui refait elle-meme le controle de propriete et ne depend pas de cette politique. Le passage a `signed` n''appartient qu''a l''edge function generate-prescription-pdf.';

COMMENT ON POLICY presc_select ON public.prescriptions IS
  'REDONDANTE : rx_select_visible est un sur-ensemble strict (memes trois branches + les medecins du cabinet). Conservee a dessein le 14/09/2026 — elle ne gene pas, et supprimer est l''operation dangereuse de ce depot. Ne pas la prendre pour la regle de lecture effective : c''est rx_select_visible qui la porte.';

COMMENT ON POLICY rx_select_visible ON public.prescriptions IS
  'LA regle de lecture effective (PERMISSIVE : les politiques SELECT se combinent en OU, celle-ci absorbe presc_select). Lisent : le patient, le medecin prescripteur, un admin, et un medecin du meme cabinet quand cabinet_id est renseigne. Inchangee le 14/09/2026 — la migration de ce jour ne touche QUE l''ecriture. Si un patient cesse un jour de voir son ordonnance, ce n''est pas ici qu''on a casse quelque chose : regarder les GRANT.';

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. Il ne reste qu'une politique par commande d'ecriture.
--
-- select cmd, count(*), string_agg(policyname, ', ' order by policyname)
--   from pg_policies where schemaname='public' and tablename='prescriptions'
--  group by cmd order by cmd;
--
--   Attendu : INSERT 1 (presc_insert_doctor)
--             SELECT 2 (presc_select, rx_select_visible)
--             UPDATE 1 (presc_update)
--   Avant   : INSERT 2 · SELECT 2 · UPDATE 2
--
-- 2. LE POINT QUI COMPTE, et il doit etre INCHANGE : aucune ecriture ouverte.
--
-- select grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--  where table_schema='public' and table_name='prescriptions' group by grantee;
--
--   Attendu, INCHANGE : authenticated -> SELECT seul
--   ⚠️  Si `authenticated` y gagne INSERT ou UPDATE, ce n'est pas cette migration
--   qui l'a fait — mais il faut le savoir le jour meme, parce que c'est le jour
--   ou les politiques ci-dessus cessent d'etre decoratives.
--
-- 3. La branche patient a bien disparu du USING (contre-epreuve textuelle) :
--
-- select policyname, qual, with_check from pg_policies
--  where schemaname='public' and tablename='prescriptions' and cmd='UPDATE';
--   Attendu : `patient_id` n'apparait NI dans qual NI dans with_check.
--
-- 4. ⚠️  LA NON-REGRESSION SE LIT AU NAVIGATEUR, ELLE NE SE DEDUIT PAS.
--    Un medecin doit toujours voir ses ordonnances, un patient les siennes. On
--    ne touche a aucune politique SELECT, donc le risque est faible — **il n'est
--    pas nul**, et ce qu'on casserait serait l'acces d'un patient a SON
--    ordonnance. C'est le stratege qui le relit apres application.
--
-- =====================================================================
-- RETOUR ARRIERE — mot pour mot, releve le 14/09/2026 AVANT la migration
-- =====================================================================
-- Les trois definitions ci-dessous sont l'etat exact de la base avant ce
-- fichier (`pg_policies`, 14/09/2026). Les rejouer telles quelles remet la
-- table dans son etat d'origine.
--
-- -- annule le §2 (ALTER POLICY) :
-- DROP POLICY presc_update ON public.prescriptions;
-- CREATE POLICY presc_update ON public.prescriptions FOR UPDATE TO authenticated
--   USING      (((doctor_id = auth.uid()) AND (status = ANY (ARRAY['draft'::text, 'signed'::text, 'delivered'::text])))
--               OR ((patient_id = auth.uid()) AND (status = ANY (ARRAY['signed'::text, 'delivered'::text])))
--               OR is_admin())
--   WITH CHECK ((doctor_id = auth.uid()) OR (patient_id = auth.uid()) OR is_admin());
--
-- -- annule le §1 :
-- CREATE POLICY rx_insert_doctor ON public.prescriptions FOR INSERT TO authenticated
--   WITH CHECK (doctor_id = auth.uid());
--
-- CREATE POLICY rx_update_doctor ON public.prescriptions FOR UPDATE TO authenticated
--   USING      ((doctor_id = auth.uid()) OR is_admin())
--   WITH CHECK ((doctor_id = auth.uid()) OR is_admin());
--
-- Les COMMENT ON POLICY du §3 n'ont pas besoin d'etre annules : ils ne changent
-- aucun comportement. S'ils devenaient faux, les corriger vaut mieux que les
-- retirer — c'est leur absence qui a coute cher sur `audit_log`.
--
-- ⚠️  Le retour arriere ne REOUVRE rien : il remet des politiques qui, sans
-- GRANT, restent inatteignables. Il n'y a donc pas d'urgence a le jouer.
