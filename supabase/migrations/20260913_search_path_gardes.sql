-- =====================================================================
-- 20260913_search_path_gardes.sql
-- Les trois SECURITY DEFINER dont le `search_path` n'est pas fige
-- =====================================================================
-- ETAT : A APPLIQUER. Ecrite par Claude, lue et lancee par le stratege.
--
-- ---------------------------------------------------------------------
-- CE QUE C'EST, ET CE QUE CE N'EST PAS
-- ---------------------------------------------------------------------
-- **Ce n'est PAS une porte ouverte aujourd'hui.** Je le dis en premier parce
-- que la suite ressemble a une alerte et n'en est pas une.
--
-- Une fonction SECURITY DEFINER s'execute avec les droits de son PROPRIETAIRE
-- (ici `postgres`). Si elle nomme ses tables SANS les qualifier, la resolution
-- du nom depend du `search_path` de l'appelant. Un appelant capable de faire
-- precedes `public` par un schema a lui — typiquement `pg_temp`, implicitement
-- cherche EN PREMIER quand il n'est pas liste explicitement — ferait executer
-- SA table par une fonction qui a les droits de `postgres`.
--
-- POURQUOI CE N'EST PAS EXPLOITABLE PAR LE WEB AUJOURD'HUI : il faut pouvoir
-- CREER cet objet. PostgREST n'expose que des tables, des vues et les RPC
-- declarees ; aucune d'elles ne fait de SQL dynamique, et aucune ne permet un
-- `CREATE TEMP TABLE`. La cle `anon` publique ne donne donc aucun chemin vers
-- l'etape qui compte.
--
-- POURQUOI ON LE CORRIGE QUAND MEME, ET MAINTENANT :
--   1. **C'est la garde de la RLS des dossiers medicaux.** Mesure du 13/09 :
--      `public.current_doctor_profile_id()` est lue par TROIS politiques —
--        public.medical_records / « Doctors see records of their patients »
--        public.medical_records / « Doctors create records for their patients »
--        public.payments        / « Doctors see payments for them »
--      Une garde qui depend de quelque chose d'exterieur a elle-meme n'est pas
--      une garde : c'est une garde SOUS CONDITION. Les 86 autres SECURITY
--      DEFINER du depot n'ont pas cette condition.
--   2. Le cout est d'une ligne par fonction.
--   3. C'est l'avis `function_search_path_mutable` de Supabase lui-meme.
--
-- ---------------------------------------------------------------------
-- LE COMPTE EXACT, ET POURQUOI IL N'EST PAS 19
-- ---------------------------------------------------------------------
-- L'avis Supabase compte **19** fonctions. Il ne distingue pas le regime
-- d'execution, et c'est le regime qui fait le risque. Mesure sur `pg_proc` :
--
--   A — SECURITY DEFINER appelable en RPC ............ 3
--       admin_validate_doctor, current_doctor_profile_id, current_user_role
--   B — SECURITY DEFINER declencheur ................. 1
--       refresh_doctor_rating
--   C — SECURITY INVOKER (droits de l'APPELANT) ...... 15
--
-- Les 15 de la classe C s'executent avec les droits de celui qui appelle :
-- detourner leur resolution de nom ne donne rien de plus que ce qu'il a deja.
-- Elles restent a corriger un jour, par hygiene ; elles ne sont PAS dans ce
-- fichier. **Rapporter « 19 fonctions vulnerables » serait faux.**
--
-- Ce fichier traite les classes A et B : **4 fonctions**.
--
-- ---------------------------------------------------------------------
-- POURQUOI `'public', 'pg_temp'` ET PAS `'public'` SEUL
-- ---------------------------------------------------------------------
-- `pg_temp` non liste est cherche IMPLICITEMENT EN PREMIER. Le lister
-- explicitement EN DERNIER le remet a sa place. C'est la forme que porte deja
-- `claim_my_doctor_profile` dans cette base ; on s'aligne dessus.
--
-- Les corps sont en plus QUALIFIES `public.` — ceinture et bretelles : meme si
-- quelqu'un retire le `SET` un jour, les noms restent resolus.
--
-- ⚠️  `admin_validate_doctor` N'EST PAS DANS CE FICHIER bien qu'elle soit de la
-- classe A. Son corps fait 59 lignes, touche `doctor_profiles`, `users` et
-- `admin_actions`, et c'est la fonction qui a envoye un e-mail de validation
-- pour rien ce matin. La toucher dans le meme passage melangerait deux
-- chantiers. Elle a son propre fichier a ecrire, avec sa propre relecture.
--
-- =====================================================================
-- CE QU'IL FAUT FAIRE
-- =====================================================================

-- 1. La garde de la RLS des dossiers medicaux. La plus importante des trois.
CREATE OR REPLACE FUNCTION public.current_doctor_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid();
$function$;

-- 2. Meme forme. Mesure du 13/09 : AUCUNE fonction et AUCUNE politique RLS ne
--    l'appelle — ni `pg_get_functiondef`, ni `pg_policies.qual/with_check`.
--    C'est du code mort avec un defaut. On le corrige plutot que de le
--    supprimer : une suppression est l'operation dangereuse de ce depot, et
--    « personne ne l'appelle » se mesure sur ce qui est ECRIT, pas sur ce qui
--    est APPELE a l'execution. Sa suppression est une decision a part.
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS public.user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.users WHERE id = auth.uid();
$function$;

-- 3. Declencheur : jamais appelable en RPC (PostgREST n'expose pas les
--    fonctions dont le retour est `trigger`), mais SECURITY DEFINER et
--    il ECRIT dans doctor_profiles. Corps inchange, `public.` ajoute.
CREATE OR REPLACE FUNCTION public.refresh_doctor_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  target_doctor UUID;
BEGIN
  target_doctor := COALESCE(NEW.doctor_id, OLD.doctor_id);

  UPDATE public.doctor_profiles dp
  SET rating = sub.avg_rating,
      review_count = sub.cnt
  FROM (
    SELECT
      AVG(rating)::NUMERIC(3,2) AS avg_rating,
      COUNT(*) AS cnt
    FROM public.reviews
    WHERE doctor_id = target_doctor AND is_published
  ) sub
  WHERE dp.id = target_doctor;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. LE `SET` EST LA. Attendu : les trois avec `search_path=public, pg_temp`.
--
-- select p.proname, array_to_string(p.proconfig, ' | ') as config, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('current_doctor_profile_id','current_user_role','refresh_doctor_rating')
--  order by 1;
--
-- 2. IL NE RESTE QUE `admin_validate_doctor` EN CLASSE A. Attendu : 1 ligne.
--
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prosecdef and p.proconfig is null
--    and p.prorettype::regtype::text <> 'trigger';
--
-- 3. LA NON-REGRESSION, et c'est elle qui compte — les trois politiques RLS
--    qui lisent `current_doctor_profile_id()` doivent continuer de laisser
--    passer le medecin et de bloquer les autres :
--      public.medical_records / Doctors see records of their patients
--      public.medical_records / Doctors create records for their patients
--      public.payments        / Doctors see payments for them
--
--    Avec une session MEDECIN reelle, la fonction doit rendre l'`id` de sa
--    fiche (et NULL pour un patient) :
--      select public.current_doctor_profile_id();
--
--    ⚠️  A LIRE AU NAVIGATEUR, PAS DEDUIT. Le corps est identique a un
--    `public.` pres ; le risque de regression est faible, il n'est pas nul, et
--    ce qu'on casserait c'est l'acces d'un medecin au dossier de son patient.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- Rejouer les trois CREATE OR REPLACE sans la ligne `SET search_path` et sans
-- les prefixes `public.` — les corps d'origine sont reproduits ci-dessous
-- MOT POUR MOT, tels que `pg_get_functiondef()` les a rendus le 13/09/2026 :
--
--   current_doctor_profile_id : SELECT id FROM doctor_profiles WHERE user_id = auth.uid();
--   current_user_role         : SELECT role FROM users WHERE id = auth.uid();
--   refresh_doctor_rating     : corps identique, sans `public.` devant
--                               doctor_profiles et reviews.
--
-- Ce que vous rouvrez en le faisant : la garde de la RLS des dossiers medicaux
-- redevient dependante du `search_path` de l'appelant.
