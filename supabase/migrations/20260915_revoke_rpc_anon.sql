-- =====================================================================
-- 20260915_revoke_rpc_anon.sql — retirer a `anon` ce dont il n'a pas besoin
-- =====================================================================
-- ⚠️  ETAT : PROPOSITION. **ECRITE ET NON APPLIQUEE.** Ne compte pas comme
-- migree. Le stratege relit, puis applique par MCP. Deux paires d'yeux.
--
-- Analyse complete : docs/AUDIT_RPC_ANON_2026-09-15.md
--
-- ---------------------------------------------------------------------
-- CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS
-- ---------------------------------------------------------------------
-- **Uniquement des REVOKE.** Aucun DROP, aucun GRANT, aucune modification de
-- corps de fonction, aucune politique touchee. Le retour arriere tient en un
-- GRANT par ligne, et il est ecrit en pied.
--
-- Sur 319 fonctions executables par `anon`, seules **57 sont SECURITY DEFINER**
-- — les seules qui franchissent la RLS. Les 262 autres s'executent avec les
-- droits de l'appelant : elles ne peuvent rien lire de plus que ce que la RLS
-- laisse deja passer. On n'y touche pas.
--
-- Sur ces 57 : **10 restent** (le parcours public reel), **47 sont revoquees**.
--
-- ---------------------------------------------------------------------
-- ⚠️ LE RISQUE QUI A ETE VERIFIE AVANT D'ECRIRE CE FICHIER
-- ---------------------------------------------------------------------
-- Une politique RLS s'evalue avec les droits du role qui interroge. Revoquer
-- `EXECUTE` a `anon` sur une fonction CITEE dans une politique qui vise `anon`
-- casserait la lecture publique — silencieusement, par une erreur de
-- permission au milieu d'un SELECT.
--
-- Huit des fonctions ci-dessous sont citees dans des politiques. Les 29
-- politiques concernees visent **toutes** `authenticated`, aucune ne vise
-- `anon` ni `public`. Verifie par :
--
--   select p.proname, pol.policyname, pol.roles
--     from pg_policies pol, pg_proc p ...
--    where pol.qual like '%'||p.proname||'(%';
--
-- **Sans cette verification, ce fichier n'aurait pas du etre ecrit.**
--
-- =====================================================================
-- 1. APPELABLES PAR POSTGREST — aucune n'a d'usage anonyme
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administration — `is_admin()` les refuse deja a `anon`, mais un droit
-- qui ne sert a rien est un droit qui traine.
-- ---------------------------------------------------------------------
-- Aucun appelant front. Reservee a l'administration.
REVOKE EXECUTE ON FUNCTION public._api_is_admin_safe() FROM anon;
-- Rend les CHEMINS des pieces d'identite d'un medecin. Appelee depuis `admin-doctor-validation.html`, derriere connexion.
REVOKE EXECUTE ON FUNCTION public.admin_doctor_doc_paths(p_doctor_id uuid) FROM anon;
-- Valide ou refuse un medecin. Ecriture d'administration.
REVOKE EXECUTE ON FUNCTION public.admin_validate_doctor(p_doctor_id uuid, p_action text, p_notes text) FROM anon;
-- Compteurs du tableau de validation.
REVOKE EXECUTE ON FUNCTION public.admin_validation_counts() FROM anon;
-- Rend `SETOF doctor_profiles` — la TABLE, pas la vue publique. `anon` n'a aucune raison d'y toucher.
REVOKE EXECUTE ON FUNCTION public.admin_validation_list(p_tab text, p_search text, p_wilaya text, p_limit integer, p_offset integer) FROM anon;
-- Total du meme tableau.
REVOKE EXECUTE ON FUNCTION public.admin_validation_total(p_tab text, p_search text, p_wilaya text) FROM anon;

-- ---------------------------------------------------------------------
-- Gardes internes — citees par des politiques RLS visant `authenticated`,
-- jamais appelees depuis le front.
-- ---------------------------------------------------------------------
-- Garde citee par 17 politiques RLS, toutes sur `authenticated` — verifie : AUCUNE ne vise `anon` ni `public`. La revoquer ne casse donc aucune lecture anonyme.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
-- Lit le role de l'appelant. Sans session : NULL. Aucun appelant front.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
-- Citee par 3 politiques (`medical_records`, `payments`), toutes sur `authenticated`.
REVOKE EXECUTE ON FUNCTION public.current_doctor_profile_id() FROM anon;
-- Citee par une politique de `storage.objects` visant `authenticated`.
REVOKE EXECUTE ON FUNCTION public.dawini_can_view_object(p_name text) FROM anon;
-- Citee par `presc_pdf_select`, sur `authenticated`. Pour `anon`, `auth.uid()` est NULL : elle ne peut rendre que `false` — mais la posseder n'a aucun sens.
REVOKE EXECUTE ON FUNCTION public.presc_can_read_pdf(p_name text) FROM anon;
-- Identifie la pharmacie de l'appelant. NULL sans session.
REVOKE EXECUTE ON FUNCTION public.dawini_my_pharmacy_id() FROM anon;
-- Idem, pour la wilaya.
REVOKE EXECUTE ON FUNCTION public.dawini_my_pharmacy_wilaya() FROM anon;
-- Citee par une politique de `appointments` sur `authenticated`. Aucun appelant front.
REVOKE EXECUTE ON FUNCTION public.is_doctor_bookable(p_doctor_id uuid) FROM anon;
-- Aucun appelant front : le parcours public passe par `get_available_slots`.
REVOKE EXECUTE ON FUNCTION public.appointment_slot_is_available(p_doctor_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone) FROM anon;

-- ---------------------------------------------------------------------
-- Exigent une session — elles lisent `auth.uid()`, qui vaut NULL sans
-- compte. Closes en pratique, ouvertes sur le papier.
-- ---------------------------------------------------------------------
-- Dit si l'appelant peut noter ce medecin. Lit `auth.uid()` : sans session, la reponse est toujours non.
REVOKE EXECUTE ON FUNCTION public.can_review_doctor(p_doctor_id uuid) FROM anon;
-- Revendication de fiche. Le code le dit lui-meme : « l'auto-claim post-signup (RPC ..., authentifie) » — elle est appelee APRES creation du compte.
REVOKE EXECUTE ON FUNCTION public.claim_my_doctor_profile() FROM anon;
-- Meme fonction, surcharge par identifiant historique.
REVOKE EXECUTE ON FUNCTION public.claim_my_doctor_profile(legacy_id_input integer) FROM anon;
-- Profil du medecin CONNECTE. Appelee depuis `signup.html` une fois la session ouverte — le commentaire du code precise « scope auth.uid() ».
REVOKE EXECUTE ON FUNCTION public.get_my_doctor_profile() FROM anon;
-- Ecriture sur son propre profil.
REVOKE EXECUTE ON FUNCTION public.update_my_doctor_profile(p_bio text, p_languages text[], p_consultation_fee integer, p_accepts_chifa boolean, p_accepts_card boolean, p_accepts_cash boolean, p_working_hours jsonb, p_telehealth_enabled boolean, p_telehealth_fee integer, p_photo_url text, p_phone text, p_address text) FROM anon;
-- Donnees medicales du patient connecte — groupe sanguin, allergies, antecedents.
REVOKE EXECUTE ON FUNCTION public.get_patient_medical_data() FROM anon;
-- Ecriture des memes donnees.
REVOKE EXECUTE ON FUNCTION public.upsert_patient_medical_data(p_blood_type text, p_height_cm integer, p_weight_kg numeric, p_allergies text, p_medical_history text, p_current_medications text, p_family_history text, p_vaccinations text, p_smoker boolean, p_drinker boolean, p_insurance text, p_mutual text, p_matricule text, p_chifa_card text, p_emergency_name text, p_emergency_relation text, p_emergency_phone text) FROM anon;
-- Depose une demande Dawini. Lit `auth.uid()` : echoue sans session.
REVOKE EXECUTE ON FUNCTION public.dawini_create_request(p_medicaments text[], p_wilaya integer, p_image_path text, p_note text, p_lat double precision, p_lng double precision) FROM anon;
-- Cree une alerte de disponibilite. Idem.
REVOKE EXECUTE ON FUNCTION public.dawini_create_alert(p_medication text, p_wilaya integer) FROM anon;
-- Annule sa propre alerte. Idem.
REVOKE EXECUTE ON FUNCTION public.dawini_cancel_alert(p_alert_id uuid) FROM anon;
-- Reponse d'une PHARMACIE a une demande.
REVOKE EXECUTE ON FUNCTION public.dawini_respond(p_request_id uuid, p_status text, p_disponible boolean, p_generique boolean, p_meds_dispo text[], p_commentaire text) FROM anon;
-- ATTENTION : Rend le NOM et le TELEPHONE d'un patient. Gardee par `dawini_my_pharmacy_id()` (NULL sans session -> `not_a_pharmacy`), donc close aujourd'hui. Mais c'est la fonction la plus sensible de la liste : elle n'a rien a faire dans les droits d'`anon`.
REVOKE EXECUTE ON FUNCTION public.dawini_get_patient_contact(p_request_id uuid) FROM anon;
-- Statistiques de LA pharmacie connectee.
REVOKE EXECUTE ON FUNCTION public.dawini_pharmacy_stats() FROM anon;

-- ---------------------------------------------------------------------
-- Oracle sans contrepartie.
-- ---------------------------------------------------------------------
-- Rend vrai/faux sur « ce medecin a-t-il deja un compte ? ». **Aucun appelant front.** Pour `anon`, c'est un oracle d'enumeration sur 75 035 fiches, sans contrepartie.
REVOKE EXECUTE ON FUNCTION public.check_doctor_account_exists(p_legacy_id integer) FROM anon;

-- ---------------------------------------------------------------------
-- Aucun appelant, ni front ni script.
-- ---------------------------------------------------------------------
-- Couples specialite/wilaya pour les pages SEO. Aucun appelant front ni script : les 490 pages sont generees hors ligne.
REVOKE EXECUTE ON FUNCTION public.seo_couples() FROM anon;

-- =====================================================================
-- 2. FONCTIONS DE DECLENCHEUR — 17
-- =====================================================================
-- Elles rendent `trigger` : **PostgREST refuse de les exposer**, et un appel
-- direct echouerait faute de contexte. Les revoquer ne change RIEN au
-- comportement — c'est de l'hygiene.
--
-- Sa valeur : la prochaine personne qui listera les droits d'`anon` ne perdra
-- pas son temps sur dix-sept fausses pistes.
REVOKE EXECUTE ON FUNCTION public.appointments_secretaire_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.appointments_set_cabinet_from_doctor() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dawini_alerts_on_available() FROM anon;
REVOKE EXECUTE ON FUNCTION public.doctor_schedule_protect() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_appointment_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_audit_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_handle_review_report() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_update_doctor_rating() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_verify_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lock_doctor_protected_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notifications_protect() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_doctor_rating() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_appointment_confirmed_outbox() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_message_after_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_notify_appointment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.video_sessions_protect_columns() FROM anon;

-- =====================================================================
-- CE QUI RESTE VOLONTAIREMENT A `anon` — 10
-- =====================================================================
-- Le parcours public reel. **Ne pas les revoquer** : chercher un medecin, voir
-- sa fiche et ses creneaux, consulter Dawini, s'inscrire a la liste d'attente.
--
--   chercher_praticiens                Recherche de l'annuaire.
--   praticien                          Fiche d'un praticien.
--   praticiens_carte                   Points de la carte publique.
--   praticiens_par_ids                 Fiches par lot (favoris, resultats).
--   stats_publiques                    Compteurs affiches sur l'accueil public.
--   waiting_list_count                 Nombre d'inscrits, affiche sur `waiting-list.
--   get_available_slots                Creneaux libres d'un medecin.
--   dawini_zone_active                 Dit si Dawini est ouvert dans une wilaya.
--   dawini_shortage_by_wilaya          Statistiques publiques de penurie, affichees sur `dawini.
--   dawini_top_missing                 Medicaments les plus demandes — meme page publique.

-- =====================================================================
-- VERIFICATION — a lancer APRES, dans un passage separe
-- =====================================================================
-- 1. Le compte.
--
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
--    and has_function_privilege('anon', p.oid, 'EXECUTE');
--   Attendu : 10   (57 avant)
--
-- 2. Ce sont bien LES DIX qu'on voulait garder.
--
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.prokind='f' and p.prosecdef
--    and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1;
--
-- 3. ⚠️ ET LA SEULE VERIFICATION QUI COMPTE VRAIMENT, au navigateur, en
--    navigation privee, avec cache-bust :
--      - l'accueil affiche des medecins          (chercher_praticiens)
--      - une fiche s'ouvre                        (praticien)
--      - la carte se remplit                      (praticiens_carte)
--      - les creneaux d'un medecin s'affichent    (get_available_slots)
--      - Dawini montre ses statistiques           (dawini_top_missing, ...)
--      - la liste d'attente montre son compteur   (waiting_list_count)
--
--    Un compte de fonctions ne prouve pas qu'une page marche. Si l'une de ces
--    six lectures casse, c'est une revocation de trop — et le retour arriere
--    ci-dessous la rend en une ligne.
--
-- =====================================================================
-- RETOUR ARRIERE
-- =====================================================================
-- Un GRANT par fonction revoquee, meme signature :
--
--   GRANT EXECUTE ON FUNCTION public.<signature> TO anon;
--
-- Rien d'autre n'a ete touche : ni corps de fonction, ni politique, ni GRANT
-- a `authenticated` ou `service_role`. Le retour arriere est donc total et
-- sans effet de bord.
