-- =====================================================================
-- 20260914_bucket_prescriptions.sql — ou vivent les PDF d'ordonnance
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- ---------------------------------------------------------------------
-- CE QUE CE BUCKET CONTIENT
-- ---------------------------------------------------------------------
-- Des ordonnances signees, en PDF : **le nom du patient, le diagnostic et le
-- traitement, en clair, dans un fichier.** C'est la donnee la plus sensible
-- du produit. Un bucket public ici serait une fuite de dossiers medicaux,
-- indexable, definitive.
--
-- D'ou : `public = false`, et **aucune politique d'ecriture pour personne**.
--
-- ---------------------------------------------------------------------
-- QUI PEUT QUOI
-- ---------------------------------------------------------------------
--   ECRIRE   `service_role` seul — c'est-a-dire l'edge function
--            `generate-prescription-pdf`, et rien d'autre. `service_role`
--            contourne la RLS : **on ne lui ecrit donc aucune politique**.
--            En ecrire une laisserait croire qu'elle le contraint.
--   LIRE     le patient et le medecin prescripteur de CETTE ordonnance.
--   LE RESTE personne. Pas d'UPDATE, pas de DELETE : une ordonnance signee
--            est immuable, son PDF aussi. Sans politique, les deux sont
--            refuses — on ne « ferme » pas une porte qui n'existe pas.
--
-- ⚠️  Un PDF ne s'efface donc jamais par l'application. C'est deliberé : la
-- suppression d'une ordonnance signee est une decision, pas une operation
-- courante, et elle se fera a la main avec une trace. Le jour ou une
-- obligation de conservation (ou d'effacement RGPD) sera tranchee avec
-- l'avocat, elle aura sa propre migration.
--
-- ---------------------------------------------------------------------
-- POURQUOI UNE FONCTION PLUTOT QU'UN SOUS-SELECT DANS LA POLITIQUE
-- ---------------------------------------------------------------------
-- Une sous-requete ecrite directement dans une politique de `storage.objects`
-- s'execute avec les droits de l'appelant : elle subirait la RLS de
-- `public.prescriptions`, et la lisibilite du PDF dependrait alors de deux
-- jeux de regles au lieu d'un.
--
-- `public.presc_can_read_pdf(text)` est `SECURITY DEFINER` et pose la question
-- une seule fois, au meme endroit. C'est le patron deja retenu dans ce depot
-- pour `dawini_can_view_object(text)` — on ne l'invente pas ici.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le bucket, prive
-- ---------------------------------------------------------------------
-- 10 Mo : la meme borne que la contrainte `prescriptions_pdf_size_bytes_check`
-- (0 .. 10485760). Deux limites qui disent la meme chose doivent dire le meme
-- nombre, sinon l'une des deux ment.
-- Type MIME unique : ce bucket ne recoit que des PDF produits par nous. Une
-- image ou un HTML deposes ici seraient, au mieux, une erreur.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prescriptions', 'prescriptions', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
   SET public             = EXCLUDED.public,
       file_size_limit    = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. Qui a le droit de lire CE fichier
-- ---------------------------------------------------------------------
-- Le chemin est `{doctor_id}/{prescription_id}.pdf` — pose par
-- `generate-prescription-pdf`. On ne se fie PAS au seul dossier : un medecin
-- proprietaire du dossier reste medecin de l'ordonnance, mais le patient, lui,
-- n'est nulle part dans le chemin. C'est la LIGNE qui tranche, pas le chemin.
CREATE OR REPLACE FUNCTION public.presc_can_read_pdf(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.prescriptions p
     WHERE p.pdf_storage_path = p_name
       AND (p.patient_id = auth.uid() OR p.doctor_id = auth.uid())
  );
$function$;

COMMENT ON FUNCTION public.presc_can_read_pdf(text) IS
  'Vrai si l''utilisateur courant est le patient ou le medecin prescripteur de l''ordonnance dont le PDF porte ce chemin. Utilisee par la politique de lecture du bucket « prescriptions ». SECURITY DEFINER a dessein : la question se pose UNE fois, ici, et ne depend pas de la RLS de public.prescriptions — sinon la lisibilite d''un PDF dependrait de deux jeux de regles. Meme patron que dawini_can_view_object(). Ne rend qu''un booleen : meme fausse, elle ne fuit rien.';

REVOKE ALL ON FUNCTION public.presc_can_read_pdf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.presc_can_read_pdf(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. La seule politique du bucket : lire, et c'est tout
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS presc_pdf_select ON storage.objects;
CREATE POLICY presc_pdf_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND public.presc_can_read_pdf(name));

COMMENT ON POLICY presc_pdf_select ON storage.objects IS
  'Bucket « prescriptions » : seuls le patient et le medecin prescripteur lisent le PDF de LEUR ordonnance. Aucune politique INSERT/UPDATE/DELETE n''existe pour ce bucket, a dessein : seul service_role ecrit (il contourne la RLS), et une ordonnance signee est immuable. Posee le 14/09/2026 avec l''edge function generate-prescription-pdf.';

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. Le bucket est PRIVE. C'est le point qui compte.
--
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'prescriptions';
--   Attendu : prescriptions | false | 10485760 | {application/pdf}
--
--   ⚠️  `public = true` ici signifierait que n'importe qui, sans compte, peut
--   telecharger n'importe quelle ordonnance en connaissant son chemin.
--
-- 2. Une seule politique, en lecture, et aucune autre.
--
-- select policyname, cmd, roles::text from pg_policies
--  where schemaname='storage' and tablename='objects'
--    and policyname like 'presc_%';
--   Attendu : presc_pdf_select | SELECT | {authenticated}   — une seule ligne
--
-- 3. LA CONTRE-EPREUVE, et elle vaut plus que les deux precedentes :
--    depuis un compte patient TIERS (ni patient ni medecin de l'ordonnance),
--    au navigateur, une demande de lien signe sur le chemin d'une ordonnance
--    d'autrui doit ECHOUER.
--      supabase.storage.from('prescriptions').createSignedUrl('<doctor_id>/<id>.pdf', 60)
--    Attendu : erreur. **A lire au navigateur, ca ne se deduit pas.**
--
-- 4. Et le chemin nominal fonctionne : le patient de l'ordonnance obtient son
--    lien, le medecin aussi.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- DROP POLICY IF EXISTS presc_pdf_select ON storage.objects;
-- DROP FUNCTION IF EXISTS public.presc_can_read_pdf(text);
--
-- ⚠️  **Ne PAS supprimer le bucket.** `DELETE FROM storage.buckets` echoue
-- s'il contient des objets, et forcer reviendrait a detruire des ordonnances
-- signees. Retirer la politique suffit : le bucket devient illisible pour
-- tout le monde sauf `service_role`, ce qui est l'etat sur.
