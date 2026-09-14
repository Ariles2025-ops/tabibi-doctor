-- =====================================================================
-- 20260914_waiting_list_count.sql — le compteur public de la liste d'attente
-- =====================================================================
-- ⚠️  ETAT : BROUILLON. **ECRIT ET NON APPLIQUE.** Ne compte pas comme migre.
-- Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- ---------------------------------------------------------------------
-- LE DEFAUT QU'ELLE FERME (B-1 de docs/AUDIT_BOUT_EN_BOUT.md)
-- ---------------------------------------------------------------------
-- `waiting-list.html` — page PUBLIQUE — annonce « 500+ inscrits ».
-- Il y en a ZERO. Trois mesures du 14/09/2026 :
--
--   1. reseau : 404 sur …/rest/v1/waiting_list_count?select=total_count
--   2. base   : l'objet `waiting_list_count` N'EXISTE PAS. Il y a la table
--               `waiting_list` et la vue `waiting_list_stats`, rien d'autre.
--   3. base   : select count(*) from public.waiting_list  ->  0
--
-- Le front, faute de reponse, affiche `'500+'` EN DUR. Ce n'est pas un repli :
-- il se declenche a CHAQUE chargement, et il n'affiche pas « — » mais **un
-- nombre plausible**. Le defaut ne ressemble pas a un defaut.
--
-- ---------------------------------------------------------------------
-- POURQUOI UNE RPC, ET PAS UN GRANT SELECT
-- ---------------------------------------------------------------------
-- `public.waiting_list` contient **email, phone, ip_hash, user_agent, utm_*** —
-- des donnees personnelles. Aujourd'hui `anon` n'a que `INSERT` dessus, et
-- c'est **correct** : un visiteur peut s'inscrire, il ne peut pas lire la liste.
--
-- Ouvrir `SELECT` a `anon`, meme derriere une politique RLS, elargirait la
-- surface pour obtenir **un seul entier**. Et `waiting_list_stats` n'est pas une
-- option non plus : elle detaille par role ET par wilaya, donc elle dit combien
-- de medecins sont inscrits a Bejaia — une information commerciale qu'on ne
-- publie pas.
--
-- Cette fonction rend **un entier, et rien d'autre**. Meme si sa garde etait
-- fausse, il n'y a rien a fuiter.
--
-- STABLE : elle ne peut pas ecrire, et `provolatile` le PROUVE — un filtre sur
-- lequel une relecture future peut se fier, contrairement a une regex.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

CREATE OR REPLACE FUNCTION public.waiting_list_count()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::integer FROM public.waiting_list;
$function$;

COMMENT ON FUNCTION public.waiting_list_count() IS
  'Nombre total d''inscrits a la liste d''attente, et RIEN d''autre. Publique (anon) a dessein : waiting-list.html l''affiche. Ne jamais l''elargir a un detail par role ou par wilaya — ce serait une information commerciale. La table contient des e-mails : c''est pour ca qu''on passe par une fonction et non par un GRANT SELECT. Posee le 14/09/2026 pour remplacer un « 500+ » ecrit en dur qui s''affichait alors que la table etait vide.';

-- Publique a dessein : c'est le seul point de ce depot ou `anon` doit pouvoir
-- executer une fonction. Elle ne rend qu'un entier.
GRANT EXECUTE ON FUNCTION public.waiting_list_count() TO anon, authenticated;

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. ELLE EXISTE, EST STABLE, ET anon PEUT L'EXECUTER.
--
-- select p.proname, p.provolatile, p.prosecdef,
--        array_to_string(p.proconfig, ' | ') as config,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'waiting_list_count';
--
--   Attendu : waiting_list_count | s | t | search_path=public, pg_temp | t
--
-- 2. ELLE REND LE VRAI NOMBRE — et il vaut 0 aujourd'hui.
--    C'est le point : **0 est la bonne reponse**, et l'ecran doit savoir
--    l'afficher sans mentir.
--
-- select public.waiting_list_count();      -- attendu aujourd'hui : 0
-- select count(*) from public.waiting_list; -- doit donner le meme
--
-- 3. LA CONTRE-EPREUVE QUI COMPTE : elle ne fuit rien d'autre.
--    Depuis l'exterieur, avec la cle anon publique :
--      POST /rest/v1/rpc/waiting_list_count  {}        -> 200, un entier
--      GET  /rest/v1/waiting_list?select=email         -> doit rester REFUSE
--      GET  /rest/v1/waiting_list_stats?select=*       -> doit rester REFUSE
--
--    ⚠️  Si l'un des deux GET repond, ce n'est pas cette migration qui a
--    ouvert la porte — mais il faut le savoir tout de suite.
--
-- 4. LA REFERENCE : `verifier:rpc -- --base --ecrire` (Aghiles), puis le front
--    peut l'appeler sans faire echouer la porte.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.waiting_list_count();
--
-- ⚠️  A NE FAIRE QU'APRES avoir retire l'appel du front, sinon PostgREST rend
-- 404 — et on retombe exactement dans le defaut que cette migration ferme.
-- **Mais le front corrige au meme lot n'affichera plus de nombre fabrique** :
-- il montrera « Inscriptions ouvertes », sans chiffre. Le retour arriere est
-- donc silencieux pour le visiteur, et c'est le comportement qu'on veut.
