-- =====================================================================
-- 20260915_perf_rls.sql — la RLS evaluee une fois par requete,
--                          et une politique par (table, commande, role)
-- =====================================================================
-- ⚠️  ETAT : **PROPOSITION. NON APPLIQUEE.** Le stratege relit, puis applique
-- par MCP. Deux paires d'yeux, comme pour `20260915_revoke_rpc_anon.sql`.
--
-- ---------------------------------------------------------------------
-- LA REGLE QUI GOUVERNE CE FICHIER
-- ---------------------------------------------------------------------
-- **On n'change AUCUNE condition d'acces.** On change la maniere dont elles
-- sont evaluees. Qui peut lire quoi, apres, est exactement qui pouvait lire
-- quoi, avant. Si une seule ligne de ce fichier modifie une condition, c'est
-- un defaut, pas une optimisation.
--
-- ---------------------------------------------------------------------
-- POURQUOI AUCUNE POLITIQUE N'EST RECOPIEE A LA MAIN DANS CE FICHIER
-- ---------------------------------------------------------------------
-- La premiere idee etait d'ecrire ici les 70 `CREATE POLICY` en toutes
-- lettres. Je ne l'ai pas fait, pour deux raisons :
--
--   1. **Recopier 70 expressions, c'est 70 occasions de se tromper d'un
--      caractere** — et une faute de frappe dans un `WHERE` de politique RLS
--      ne se voit pas : elle ouvre ou ferme un acces en silence.
--   2. Une transcription fige l'etat de la base **au moment ou je l'ai lue**.
--      Si une politique change d'ici a l'application, le fichier la
--      REMETTRAIT dans son etat d'hier, sans que personne ne s'en aperçoive.
--
-- Ce fichier lit donc la definition **courante** dans `pg_policies` et n'y
-- applique qu'une reecriture mecanique. La semantique est preservee **par
-- construction**, pas par relecture.
--
-- Et il ne travaille pas en aveugle : chaque `DROP` / `CREATE` reellement
-- execute est imprime par `RAISE NOTICE`. Le journal d'application contient
-- donc le DDL litteral, politique par politique. C'est ce journal qu'il faut
-- lire apres coup — pas ce fichier.
--
-- La liste exacte des politiques concernees est en pied, en commentaire.
--
-- Inventaire complet : docs/PERF_RLS_2026-09-15.md
-- =====================================================================

-- Les expressions rendues par `pg_policies` ne sont pas qualifiees (`users`,
-- pas `public.users`) : on fixe le chemin pour que la recreation les resolve
-- comme la lecture les a rendues.
set search_path = public, extensions, pg_temp;


-- =====================================================================
-- PARTIE 1 — `auth.uid()` evalue UNE FOIS, pas une fois par ligne
-- =====================================================================
-- `auth.uid()` est STABLE, pas IMMUTABLE. Ecrit nu dans un `WHERE` de
-- politique, PostgreSQL le rappelle **pour chaque ligne examinee** : sur
-- `users` (75 035 fiches) c'est 75 035 appels pour une lecture.
--
-- Enveloppe dans `( SELECT auth.uid() )`, il devient un InitPlan : evalue une
-- seule fois, au debut de la requete, puis reutilise. **Le resultat est le
-- meme** — c'est la meme fonction, sur la meme session.
--
-- Advisor Supabase : `auth_rls_initplan`.
--
-- La reecriture est faite en deux temps, et le premier n'est pas decoratif :
--   1. on DEBALLE d'abord un eventuel `( SELECT auth.uid() )` deja present
--      (PostgreSQL le rend sous la forme `( SELECT auth.uid() AS uid )`) ;
--   2. puis on emballe TOUTES les occurrences.
-- Sans l'etape 1, une politique deja corrigee serait emballee une seconde
-- fois — `( SELECT ( SELECT auth.uid() ) )` — a chaque passage. C'est ce qui
-- rend ce fichier **rejouable sans effet cumulatif**.
-- ---------------------------------------------------------------------
-- ⚠️ ON FIGE LA LISTE AVANT DE LA MODIFIER.
--
-- Boucler directement sur `pg_policies` tout en y faisant des `DROP` / `CREATE`
-- revient a scier la branche : les catalogues systeme ne sont pas lus sous le
-- meme instantane qu'une table ordinaire, et un curseur ouvert dessus peut
-- sauter une ligne ou en revoir une. On copie donc d'abord, on modifie ensuite.
--
-- ⚠️ LE PREDICAT N'EST PAS « contient auth.uid() », C'EST « contient un
-- auth.uid() PAS ENCORE ENVELOPPE ». On retire d'abord toutes les occurrences
-- deja enveloppees, et on regarde s'il en reste.
--
-- Sans cette nuance, le fichier reecrirait a chaque passage : PostgreSQL rend
-- `( SELECT auth.uid() )` sous la forme `( SELECT auth.uid() AS uid )`, donc
-- le texte relu ne serait jamais egal au texte ecrit, et la comparaison
-- « a-t-on change quelque chose ? » repondrait toujours oui. Sans effet, mais
-- une migration qui refait son travail a chaque passage ne peut plus servir de
-- preuve.
--
-- Mesure du 15/09 : 70 politiques contiennent `auth.*()`, **69** en ont un a
-- nu. La 70e est deja dans la forme voulue et n'est pas touchee.
create temporary table _perf_rls_source as
  select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
   where schemaname = 'public'
     and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
           '\(\s*SELECT\s+auth\.(uid|role|jwt)\(\)(\s+AS\s+\w+)?\s*\)', '', 'gi')
         ~ 'auth\.(uid|role|jwt)\(\)';

do $$
declare
  r record;
  q text;
  c text;
  stmt text;
  n int := 0;
  vus int := 0;
begin
  for r in
    select * from _perf_rls_source order by tablename, policyname
  loop
    vus := vus + 1;

    -- 1. deballer ce qui est deja enveloppe
    q := regexp_replace(coalesce(r.qual, ''),
           '\(\s*SELECT\s+(auth\.(uid|role|jwt)\(\))(\s+AS\s+\w+)?\s*\)', '\1', 'gi');
    c := regexp_replace(coalesce(r.with_check, ''),
           '\(\s*SELECT\s+(auth\.(uid|role|jwt)\(\))(\s+AS\s+\w+)?\s*\)', '\1', 'gi');
    -- 2. emballer toutes les occurrences
    q := regexp_replace(q, '(auth\.(uid|role|jwt)\(\))', '( SELECT \1 )', 'g');
    c := regexp_replace(c, '(auth\.(uid|role|jwt)\(\))', '( SELECT \1 )', 'g');

    -- Ceinture et bretelles : si la reecriture ne change rien, on ne touche
    -- pas a la politique. (Le predicat de `_perf_rls_source` l'a deja exclue ;
    -- ce test protege le jour ou quelqu'un elargit ce predicat.)
    if q = coalesce(r.qual, '') and c = coalesce(r.with_check, '') then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);

    stmt := format('create policy %I on public.%I as %s for %s to %s%s%s',
      r.policyname, r.tablename, r.permissive, r.cmd,
      (select string_agg(quote_ident(x), ', ') from unnest(r.roles) x),
      case when coalesce(r.qual, '')       <> '' then E'\n  using (' || q || ')' else '' end,
      case when coalesce(r.with_check, '') <> '' then E'\n  with check (' || c || ')' else '' end
    );

    raise notice E'-- %.% [%]\n%;', r.tablename, r.policyname, r.cmd, stmt;
    execute stmt;
    n := n + 1;
  end loop;

  raise notice 'PARTIE 1 : % politique(s) examinee(s), % reecrite(s).', vus, n;
  -- Premier passage attendu : 69 vues, 69 reecrites, sur 29 tables.
  -- Second passage attendu  :  0 vue,   0 reecrite.
  -- C'est ce zero qui prouve que le fichier est rejouable.
end $$;

drop table if exists _perf_rls_source;


-- =====================================================================
-- PARTIE 2 — une seule politique PERMISSIVE par (table, commande, role)
-- =====================================================================
-- Quand plusieurs politiques permissives couvrent la meme commande pour le
-- meme role, PostgreSQL les evalue TOUTES et fait le OU. Quatre politiques de
-- lecture sur `reviews` = quatre expressions evaluees a chaque ligne.
--
-- Advisor Supabase : `multiple_permissive_policies`.
--
-- ---------------------------------------------------------------------
-- POURQUOI LE OU SEPARE `USING` ET `WITH CHECK` EST EXACT
-- ---------------------------------------------------------------------
-- C'est le point a verifier avant de fusionner quoi que ce soit, et il n'est
-- pas evident : PostgreSQL **ne graphe pas** le `USING` d'une politique avec
-- le `WITH CHECK` de la meme politique. Pour une commande donnee, il combine
-- d'un cote tous les `USING` permissifs par OU, de l'autre tous les
-- `WITH CHECK` permissifs par OU, et les applique independamment.
--
-- Fusionner en `USING (a1 OR a2 OR a3)` + `WITH CHECK (b1 OR b2 OR b3)` rend
-- donc EXACTEMENT ce que la base calculait deja. Ce n'est pas une
-- approximation.
--
-- Une precaution : pour un `UPDATE` sans `WITH CHECK`, PostgreSQL reutilise
-- le `USING` comme controle de la nouvelle ligne. La fusion fait de meme
-- (`coalesce(with_check, qual)`), sinon elle relacherait le controle.
--
-- ---------------------------------------------------------------------
-- CE QU'ON NE FUSIONNE PAS, ET POURQUOI
-- ---------------------------------------------------------------------
-- L'advisor compte 21 lignes (table x action x role). Dix groupes sont
-- fusionnes ici, ce qui en resout 13. Les 8 restantes ne sont pas oubliees,
-- elles sont REFUSEES :
--
--   • Groupes dont un membre est `FOR ALL` (`review_reports`, `specialties`,
--     `wilayas`). Fusionner obligerait a eclater le `ALL` en quatre
--     politiques, donc a REECRIRE la logique. Hors mandat.
--   • Groupes dont les membres n'ont pas le meme `TO` (`appointments` SELECT,
--     `waiting_list` INSERT). La fusion imposerait
--     l'union des roles, donc soumettrait `anon` a une condition qu'il ne
--     voyait pas. En pratique cette condition rendrait `false` pour lui —
--     mais « en pratique » n'est pas « par construction », et la regle de ce
--     fichier est de ne rien elargir.
--
-- Les huit sont listees dans `docs/PERF_RLS_2026-09-15.md`.
-- ---------------------------------------------------------------------
do $$
declare
  v_i        int;
  v_t        text;
  v_cmd      text;
  v_nom      text;
  v_ex       int;
  v_roles    text;
  v_using    text;
  v_check    text;
  v_anciens  text[];
  v_un       text;
  v_stmt     text;
  v_n        int := 0;
  -- Les dix groupes homogenes : meme table, meme commande, MEMES roles.
  -- Les onze autres sont refuses, et la raison est ecrite plus haut.
  v_groupes constant text[][] := array[
    -- table                     | commande | nouveau nom
    ['appointments',              'UPDATE', 'appointments_update_fusion'],
    ['dawini_requests',           'SELECT', 'dawini_requests_select_fusion'],
    ['doctor_unavailable_slots',  'SELECT', 'dus_select_fusion'],
    ['medical_records',           'INSERT', 'medical_records_insert_fusion'],
    ['medical_records',           'SELECT', 'medical_records_select_fusion'],
    ['payments',                  'SELECT', 'payments_select_fusion'],
    ['prescriptions',             'SELECT', 'prescriptions_select_fusion'],
    ['reviews',                   'SELECT', 'reviews_select_fusion'],
    ['reviews',                   'UPDATE', 'reviews_update_fusion'],
    ['users',                     'SELECT', 'users_select_fusion']
  ];
begin
  for v_i in 1 .. array_length(v_groupes, 1) loop
    v_t   := v_groupes[v_i][1];
    v_cmd := v_groupes[v_i][2];
    v_nom := v_groupes[v_i][3];

    -- Les membres du groupe, tels qu'ils existent MAINTENANT.
    select count(*),
           string_agg('(' || p.qual || ')', E'\n    or ' order by p.policyname)
             filter (where p.qual is not null),
           string_agg('(' || coalesce(p.with_check, p.qual) || ')', E'\n    or ' order by p.policyname)
             filter (where p.with_check is not null
                        or (v_cmd = 'UPDATE' and p.qual is not null)),
           array_agg(p.policyname order by p.policyname)
      into v_ex, v_using, v_check, v_anciens
      from pg_policies p
     where p.schemaname = 'public'
       and p.tablename  = v_t
       and p.cmd        = v_cmd
       and p.permissive = 'PERMISSIVE'
       and p.policyname <> v_nom;

    -- Moins de deux membres : soit la fusion est deja faite, soit le groupe a
    -- change depuis la lecture. On ne devine pas : on passe, et on le dit.
    if coalesce(v_ex, 0) < 2 then
      raise notice 'FUSION IGNOREE : % [%] — % politique(s), il en faut au moins 2.',
        v_t, v_cmd, coalesce(v_ex, 0);
      continue;
    end if;

    -- Tous les membres doivent viser le MEME ensemble de roles. Sinon la
    -- fusion soumettrait un role a une condition qu'il ne voyait pas : on
    -- refuse. Voir « CE QU'ON NE FUSIONNE PAS ».
    if (select count(distinct p.roles::text)
          from pg_policies p
         where p.schemaname = 'public' and p.tablename = v_t
           and p.cmd = v_cmd and p.permissive = 'PERMISSIVE'
           and p.policyname <> v_nom) > 1
    then
      raise notice 'FUSION REFUSEE : % [%] — les membres ne visent pas les memes roles.',
        v_t, v_cmd;
      continue;
    end if;

    select string_agg(distinct quote_ident(x), ', ')
      into v_roles
      from pg_policies p, unnest(p.roles) x
     where p.schemaname = 'public' and p.tablename = v_t
       and p.cmd = v_cmd and p.permissive = 'PERMISSIVE'
       and p.policyname <> v_nom;

    foreach v_un in array v_anciens loop
      execute format('drop policy if exists %I on public.%I', v_un, v_t);
    end loop;

    v_stmt := format('create policy %I on public.%I as PERMISSIVE for %s to %s%s%s',
      v_nom, v_t, v_cmd, v_roles,
      case when v_using is not null then E'\n  using (\n    ' || v_using || E'\n  )' else '' end,
      case when v_check is not null then E'\n  with check (\n    ' || v_check || E'\n  )' else '' end
    );

    raise notice E'-- % [%] : % politiques fusionnees (%)\n%;',
      v_t, v_cmd, v_ex, array_to_string(v_anciens, ', '), v_stmt;
    execute v_stmt;
    v_n := v_n + 1;
  end loop;

  raise notice 'PARTIE 2 : % groupe(s) fusionne(s) sur 10.', v_n;
end $$;


-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. Plus aucune politique n'appelle `auth.*()` a nu.
--
--    select tablename, policyname
--      from pg_policies
--     where schemaname = 'public'
--       and regexp_replace(coalesce(qual,'')||' '||coalesce(with_check,''),
--             '\(\s*SELECT\s+auth\.(uid|role|jwt)\(\)(\s+AS\s+\w+)?\s*\)', '', 'gi')
--           ~ 'auth\.(uid|role|jwt)\(\)';
--    Attendu : 0 ligne.
--
-- 2. Les groupes fusionnes n'ont plus qu'une politique permissive.
--
--    select tablename, cmd, count(*) from pg_policies
--     where schemaname='public' and permissive='PERMISSIVE'
--     group by 1,2 having count(*) > 1 order by 1,2;
--    Attendu : 8 lignes, exactement celles listees comme REFUSEES dans
--    `docs/PERF_RLS_2026-09-15.md`. Une de plus = une fusion a rate.
--
-- 3. Les advisors `auth_rls_initplan` et `multiple_permissive_policies`
--    doivent BAISSER. C'est la garde de P-39.
--
-- 4. ⚠️ ET LA SEULE QUI COMPTE VRAIMENT : au navigateur, avec cache-bust.
--    Un patient voit ses rendez-vous et pas ceux d'un autre ; un medecin voit
--    son agenda ; l'accueil public affiche toujours des medecins. **Un
--    advisor vert ne prouve pas qu'un acces n'a pas bouge.**
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- Partie 1 : rejouer le meme DO en remplacant l'emballage par le deballage
-- (l'etape 1 seule). Aucune condition n'a change, le retour est mecanique.
--
-- Partie 2 : recreer les politiques d'origine. **Leur seule trace apres coup
-- est le journal d'application** (`RAISE NOTICE`), qui contient le nom de
-- chaque politique supprimee et le DDL de la fusionnee. **Capturer ce journal.**
-- Les conditions elles-memes se relisent dans la politique fusionnee : chaque
-- branche du `OR` etait une politique. Ce sont les NOMS qui se perdent, pas
-- les conditions.
--
-- =====================================================================
-- CE QUI EST HORS PERIMETRE : `storage.objects`
-- =====================================================================
-- Dix politiques de `storage.objects` portent le meme `auth.uid()` nu. Elles
-- ne sont PAS dans ce fichier : la table appartient a `supabase_storage_admin`
-- et la migration s'applique en `postgres`. Un `DROP POLICY` peut y etre
-- refuse — et un refus au milieu d'une migration annule tout le reste.
-- C'est au stratege de trancher, en connaissance de cause, dans un lot a part.
--
-- =====================================================================
-- LES POLITIQUES CITANT `auth.*()` — relevees le 15/09/2026
-- (70 au total ; 69 en ont une occurrence A NU, donc reecrite. La 70e est
--  deja dans la forme voulue : le predicat l'ecarte, elle n'est pas touchee.)
-- =====================================================================
--   admin_actions            admin_actions_admin_insert, admin_actions_admin_read
--   appointments             Patients create own appointments, Patients see own appointments,
--                            appointments_select_doctor, appointments_update_doctor,
--                            appointments_update_patient_cancel_only, appt_update_participants
--   audit_log                Only admins read audit
--   cabinet_members          cm_select_visible
--   cabinets                 cabinets_insert_self
--   claim_requests           Admins manage claim requests
--   consents_log             consents_select_own
--   conversations            conv_participant_select
--   dawini_requests          dawini_requests_close_own, dawini_requests_select_own
--   dawini_responses         dawini_responses_select
--   device_tokens            device_tokens_delete_own, device_tokens_insert_own,
--                            device_tokens_select_own, device_tokens_update_own
--   doctor_profiles          Doctors can update their own profile,
--                            doctor_profiles_select_owner_or_admin
--   doctor_schedule          ds_delete_doctor, ds_insert_doctor, ds_select_authenticated,
--                            ds_update_doctor
--   doctor_unavailable_slots dus_delete_owner, dus_insert_owner, dus_select_owner,
--                            dus_update_owner
--   favorites                fav_delete_own, fav_insert_own, fav_select_own
--   medical_records          Patients create their own records,
--                            Patients see their shared medical records
--   medication_alerts        medication_alerts_select_own
--   messages                 msg_participant_insert, msg_participant_select,
--                            msg_recipient_mark_read
--   notifications            notif_self_select, notif_self_update_read
--   patient_medical_data     pmd_delete_own, pmd_insert_own, pmd_select_own, pmd_update_own
--   payments                 Patients see their payments
--   pharmacies               dawini_pharmacies_update_self
--   prescriptions            presc_insert_doctor, presc_select, presc_update, rx_select_visible
--   review_reports           reports_admin_all, reports_authenticated_create,
--                            reports_user_reads_own
--   reviews                  reviews_admin_moderates, reviews_admin_reads_all,
--                            reviews_doctor_reads_own_published, reviews_patient_creates_verified,
--                            reviews_patient_edits_within_7d, reviews_patient_reads_own
--   two_factor_secrets       tfs_select_self
--   users                    Doctors readable for own appointments,
--                            Patients readable for own appointments, Users can insert own profile,
--                            Users can read own profile, Users can update own profile
--   video_sessions           video_sessions_select_participants
--   waiting_list             wl_admin_select, wl_admin_update
--
-- 70 politiques citant `auth.*()`, 29 tables. 69 reecrites.
