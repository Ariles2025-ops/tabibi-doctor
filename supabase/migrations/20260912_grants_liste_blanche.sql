-- =====================================================================
-- GRANTS — moindre privilège par LISTE BLANCHE (anon, authenticated)
-- =====================================================================
-- Principe : on remet à zéro les privilèges de anon et authenticated sur
-- TOUTES les relations du schéma public, puis on redonne exactement ce que
-- le code appelle (balayage du front et des scripts du 12/09/2026,
-- docs/preuves/2026-09-12_GRANTS_avant_schema_public.md pour l'état d'avant).
-- La RLS reste la barrière par ligne ; les GRANT deviennent la barrière par
-- verbe. Jamais TRUNCATE, REFERENCES ni TRIGGER.
--
-- Décisions d'Aghiles (12/09) intégrées :
--   * audit_log : AUCUN droit. Les seules écritures viennent de fonctions
--     SECURITY DEFINER (fn_audit_changes sur users/appointments, record_consent,
--     admin_validate_doctor, create_cabinet, …) qui s'exécutent en postgres ;
--     aucune page ne la lit ni ne l'écrit directement.
--   * admin_actions : écrite par des RPC SECURITY DEFINER (admin_validate_doctor…)
--     → pas d'INSERT ; lue par admin-doctor-validation.html (historique) →
--     SELECT pour authenticated (policy : admin seulement). Rien pour anon.
--   * doctor_profiles : pas d'UPDATE (le dépôt des pièces passera par une RPC,
--     cf. VERIF_NAVIGATEUR.md, troisième faux succès : tabibi-doc-upload.js:213).
--   * public_doctors pour anon : accordé ; REVOKE prêt en commentaire (§8),
--     à déclencher à la fusion de #57.
--   * specialties / wilayas pour anon : AUCUN appel public trouvé
--     (api.getWilayas / getSpecialties n'ont aucun appelant ; l'accueil lit
--     DZ_WILAYAS en dur et les spécialités via public_doctors) → pas de droit
--     anon ; SELECT pour authenticated (admin-doctor-validation.html:188-189).
--   * waiting_list INSERT pour anon : aucun trigger sur la table, aucun SMS,
--     aucune notification ; le front tente ensuite un e-mail via l'edge
--     send-email qui n'existe pas (waiting-list.html:917-931). Accordé.
--   * cabinet_members : voir §4, point à trancher — les deux vues
--     security_invoker du secrétariat la lisent avec les droits de l'appelant.
--   * appointments_set_cabinet_from_doctor : passe en SECURITY DEFINER (§5)
--     pour ne plus exiger de droits sur users/cabinet_members au patient.
--
-- Garde-fous : USAGE sur le schéma conservé explicitement (§1) ; aucun REVOKE
-- sur l'EXECUTE des fonctions ; séquences : aucune table recevant un INSERT
-- accordé n'a de colonne nextval (toutes en uuid), donc rien à redonner —
-- l'USAGE hérité sur 7 séquences est retiré car inutile (§2).
--
-- Idempotent : GRANT/REVOKE/ALTER FUNCTION rejouables.
-- À EXÉCUTER PAR AGHILES. Rien n'est exécuté par l'agent.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Le schéma reste utilisable (sans USAGE, plus rien ne répond)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Remise à zéro : toutes les tables, vues et séquences du schéma
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. anon — la vitrine et la liste d'attente, rien d'autre
-- ---------------------------------------------------------------------
grant select on public.public_doctors         to anon;  -- recherche, fiche, revendication, générateur SEO (jusqu'à #57)
grant select on public.doctor_ratings_summary to anon;  -- fiche publique : note moyenne
grant select on public.doctor_reviews_public  to anon;  -- fiche publique : avis publiés
grant insert on public.waiting_list           to anon;  -- waiting-list.html:899, landings patient/médecin

-- ---------------------------------------------------------------------
-- 4. authenticated — ce que les pages connectées appellent
-- ---------------------------------------------------------------------
grant select, insert, update on public.users                    to authenticated;  -- auth.js:52, signup.html:489 (upsert), profil, avatar
grant select, insert, update on public.appointments             to authenticated;  -- booking, tableau de bord, agenda, secrétariat
grant select                 on public.doctor_profiles          to authenticated;  -- tableau de bord, profil (pas d'UPDATE : décision)
grant select, insert, delete on public.doctor_unavailable_slots to authenticated;  -- tabibi-doctor-dashboard.js (aucun UPDATE dans le code)
grant select, update         on public.cabinets                 to authenticated;  -- admin-cabinet.html
grant select, insert, update on public.messages                 to authenticated;  -- tabibi-messaging.js
grant select                 on public.conversations            to authenticated;  -- création par ensure_conversation (DEFINER)
grant select, update         on public.notifications            to authenticated;  -- cloche, notifications.html
grant select, insert, update on public.reviews                  to authenticated;  -- tabibi-reviews.js, admin avis
grant select, insert         on public.review_reports           to authenticated;  -- tabibi-reviews.js
grant select, update         on public.dawini_requests          to authenticated;  -- tabibi-dawini.js
grant select                 on public.dawini_responses         to authenticated;
grant select                 on public.pharmacies               to authenticated;
grant select                 on public.medication_alerts        to authenticated;  -- dawini.html
grant select                 on public.prescriptions            to authenticated;  -- patient-ordonnances.html
grant select, insert, update on public.device_tokens            to authenticated;  -- capacitor-bridge.js (upsert)
grant select, insert         on public.waiting_list             to authenticated;  -- secrétariat + landings
grant select                 on public.specialties              to authenticated;  -- admin-doctor-validation.html:188
grant select                 on public.wilayas                  to authenticated;  -- admin-doctor-validation.html:189
grant select                 on public.admin_actions            to authenticated;  -- admin-doctor-validation.html:455 (lecture ; écriture par RPC DEFINER)
-- vues (lecture)
grant select on public.public_doctors, public.doctor_ratings_summary, public.doctor_reviews_public,
                public.my_upcoming_appointments, public.my_reviewable_appointments,
                public.doctor_patients_directory,
                public.cabinet_calendar_view, public.cabinet_members_directory_view, public.cabinet_stats_view,
                public.api_keys_analytics
  to authenticated;
-- POINT À TRANCHER — cabinet_members : les vues cabinet_members_directory_view et
-- cabinet_stats_view sont security_invoker : elles lisent cabinet_members avec les
-- droits de l'appelant. Sans la ligne ci-dessous, l'espace secrétariat et
-- admin-cabinet perdent ces deux vues. La policy cm_select_visible ne montre à un
-- patient que ses propres lignes : mesuré, 0 ligne. Retirer la ligne si tu
-- confirmes « n'accorde pas », en acceptant la perte des deux vues.
grant select on public.cabinet_members to authenticated;

-- ---------------------------------------------------------------------
-- 5. Le trigger de rattachement au cabinet n'emprunte plus les droits du patient
-- ---------------------------------------------------------------------
alter function public.appointments_set_cabinet_from_doctor() security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 6. Les tables futures n'héritent plus de ALL
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
-- (les défauts posés par supabase_admin ne peuvent être modifiés que par lui ; à
--  vérifier après coup avec la requête de §7 ; un nouveau CREATE TABLE devra être
--  suivi d'un GRANT explicite, ce qui est le comportement voulu.)

commit;

-- =====================================================================
-- 7. Vérification (après le COMMIT)
-- =====================================================================
-- a) droits résiduels : doit ne lister QUE la liste blanche ci-dessus
-- select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--  where table_schema='public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2;
-- b) jamais TRUNCATE/REFERENCES/TRIGGER : attendu 0
-- select count(*) from information_schema.role_table_grants where table_schema='public'
--   and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
-- c) USAGE schéma : attendu true, true
-- select has_schema_privilege('anon','public','USAGE'), has_schema_privilege('authenticated','public','USAGE');
-- d) EXECUTE intact : même compte qu'avant (289 fonctions exécutables par anon le 10/09)
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where has_function_privilege('anon', p.oid, 'EXECUTE');
-- e) HTTP, clé anon : GET /rest/v1/public_doctors?limit=1 → 206 ; POST /rest/v1/waiting_list → 201 ;
--    GET /rest/v1/users → 401 ; GET /rest/v1/specialties → 401 ;
--    puis parcours patient et médecin rejoués de bout en bout (la preuve, c'est le parcours).

-- =====================================================================
-- 8. Prêt pour la fusion de #57 (recherche par RPC) — NE PAS EXÉCUTER AVANT
-- =====================================================================
-- revoke select on public.public_doctors from anon;
-- (authenticated garde SELECT tant que tabibi-booking.js / tabibi-messaging.js hydratent
--  encore les noms de médecins par la vue ; à revoir avec 1B.)

-- =====================================================================
-- 9. Retour arrière
-- =====================================================================
-- Le bloc GRANT d'origine complet (état du 12/09, régénéré depuis la base) est dans
-- docs/preuves/2026-09-12_GRANTS_avant_schema_public.md, section « Regénération ».
-- Pour rétablir l'état antérieur : rejouer ce bloc, puis
--   alter function public.appointments_set_cabinet_from_doctor() security invoker;
--   alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
