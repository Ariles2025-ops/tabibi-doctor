/**
 * Tabibi — i18n universel v2 (mode pro)
 * ────────────────────────────────────────────────────────
 * Auto-traduction de TOUS les éléments visibles, par DEUX mécanismes :
 *
 * 1. Si l'élément a `data-i18n="clé"` → utilise la clé
 * 2. Sinon, le texte FR de l'élément est cherché dans le dictionnaire AUTO
 *    et remplacé par sa traduction si trouvée.
 *
 * Inclure APRÈS tabibi-lang.js :
 *   <script src="js/tabibi-lang.js"></script>
 *   <script src="js/tabibi-i18n.js"></script>
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // ═══════════════════════════════════════════════════════════════════
  // DICTIONNAIRE PAR CLÉ (data-i18n="clé")
  // ═══════════════════════════════════════════════════════════════════
  const TR = {
    fr: {
      // Header / Navigation
      logout: 'Se déconnecter', my_account: 'Mon compte', dashboard: 'Tableau de bord',
      profile: 'Profil', settings: 'Paramètres', notifications: 'Notifications',
      help: 'Aide', back: 'Retour', save: 'Enregistrer', cancel: 'Annuler',
      confirm: 'Confirmer', edit: 'Modifier', delete: 'Supprimer', search: 'Rechercher',
      loading: 'Chargement...', close: 'Fermer', continue: 'Continuer', send: 'Envoyer',

      // Patient
      my_space: 'Mon espace', patient: 'Patient',
      tab_book: 'Réserver', tab_rdv: 'Mes RDV', tab_view: 'Vue', tab_docs: 'Documents',
      tab_favs: 'Favoris', tab_profile: 'Profil',
      find_doctor: 'Trouvez votre médecin', search_placeholder: 'Spécialité, nom, ville...',

      // Médecin
      doctor: 'Médecin', dr: 'Dr.',
      tab_today: "Aujourd'hui", tab_agenda: 'Agenda', tab_patients: 'Patients',
      tab_stats: 'Stats', tab_messages: 'Messages',

      // Login / Signup
      sign_in: 'Se connecter', sign_up: "S'inscrire",
      email: 'Email', password: 'Mot de passe', forgot_password: 'Mot de passe oublié ?',

      // Salutations
      hello: 'Bonjour', good_morning: 'Bonjour, Dr.',
      good_afternoon: 'Bon après-midi, Dr.', good_evening: 'Bonsoir, Dr.',

      // [I18N-UNIFY-2026] Salutations génériques (greet_*)
      greet_morning: 'Bonjour', greet_afternoon: 'Bon après-midi', greet_evening: 'Bonsoir',

      // Statuts (versions courtes)
      active: 'Actif', pending: 'En attente', confirmed: 'Confirmé',
      cancelled: 'Annulé', completed: 'Terminé',

      // [I18N-UNIFY-2026] Statuts RDV (préfixe status_)
      status_pending: 'En attente', status_confirmed: 'Confirmé',
      status_completed: 'Terminé', status_cancelled: 'Annulé',
      status_no_show: 'Non présenté', status_rescheduled: 'Reprogrammé',

      // [I18N-UNIFY-2026] Jours (versions courtes 3 lettres)
      day_mon: 'Lun', day_tue: 'Mar', day_wed: 'Mer', day_thu: 'Jeu',
      day_fri: 'Ven', day_sat: 'Sam', day_sun: 'Dim',
      // Versions longues
      day_monday: 'Lundi', day_tuesday: 'Mardi', day_wednesday: 'Mercredi',
      day_thursday: 'Jeudi', day_friday: 'Vendredi', day_saturday: 'Samedi', day_sunday: 'Dimanche',

      // [I18N-UNIFY-2026] Mois (versions courtes 3 lettres)
      month_jan: 'Jan', month_feb: 'Fév', month_mar: 'Mar', month_apr: 'Avr',
      month_may: 'Mai', month_jun: 'Juin', month_jul: 'Juil', month_aug: 'Août',
      month_sep: 'Sep', month_oct: 'Oct', month_nov: 'Nov', month_dec: 'Déc',
      // Versions longues
      month_january: 'Janvier', month_february: 'Février', month_march: 'Mars',
      month_april: 'Avril', month_may_long: 'Mai', month_june: 'Juin',
      month_july: 'Juillet', month_august: 'Août', month_september: 'Septembre',
      month_october: 'Octobre', month_november: 'Novembre', month_december: 'Décembre',

      // [I18N-UNIFY-2026] Toasts génériques
      toast_password_changed: 'Mot de passe changé !',
      toast_document_added: 'Document ajouté',
      toast_doctor_not_found: 'Médecin introuvable',
      toast_review_thanks: 'Merci pour votre avis !',
      toast_health_consent_required: 'Le consentement au traitement des données de santé est obligatoire',
      toast_password_too_short: 'Mot de passe trop court (8 caractères minimum)',
      toast_email_invalid: 'Email invalide',
      toast_member_added: 'Membre ajouté',
      toast_diploma_added: 'Diplôme ajouté',
      toast_card_added: 'Carte ajoutée',
      toast_slots_added: 'Créneaux ajoutés !',
      toast_passwords_mismatch: 'Ne correspondent pas',
      toast_select_rating: 'Sélectionnez une note',
      toast_fill_all_fields: 'Veuillez remplir tous les champs',
      toast_login_failed: 'Email ou mot de passe incorrect',
      toast_login_success: 'Connexion réussie',
      toast_signup_success: 'Compte créé avec succès',
      toast_logout_success: 'Déconnexion réussie',
      toast_generic_error: 'Une erreur est survenue',
      toast_saved: 'Enregistré',
      toast_deleted: 'Supprimé',
      toast_copied: 'Copié',

      // [I18N-UNIFY-2026] Titres de pages (préfixe title_)
      title_home: 'Tabibi — Trouvez votre médecin en Algérie',
      title_login: 'Connexion | Tabibi',
      title_signup: 'Inscription | Tabibi',
      title_patient_dashboard: 'Mon espace patient | Tabibi',
      title_doctor_dashboard: 'Espace médecin | Tabibi',
      title_admin_dashboard: 'Administration | Tabibi',
      title_doctor_profile: 'Profil médecin | Tabibi',
      title_doctor_reservation: 'Réservation | Tabibi',
      title_appointment: 'Mon rendez-vous | Tabibi',
      title_analytics: 'Analytics — Tabibi Médecin',
      title_about: 'À propos | Tabibi',
      title_cgu: 'CGU | Tabibi',
      title_privacy: 'Confidentialité | Tabibi',
      title_cookies: 'Cookies | Tabibi',
      title_legal: 'Mentions légales | Tabibi',
      title_404: 'Page introuvable | Tabibi',
      title_offline: 'Hors ligne | Tabibi',
      title_onboarding: 'Devenir médecin partenaire | Tabibi',
      title_patient_profile: 'Mon profil | Tabibi',
      title_reservation: 'Réservation | Tabibi',
      title_success: 'Confirmation | Tabibi',
      title_waiting_list: 'Liste d\'attente | Tabibi',

      // [I18N-UNIFY-2026] Placeholders communs (suffixe _ph)
      first_name_ph: 'Prénom', last_name_ph: 'Nom',
      email_ph: 'votre@email.com', password_ph: 'Mot de passe',
      phone_ph: '+213 ...', city_ph: 'Ville',
      address_ph: 'Adresse complète',
      search_doctor_ph: 'Spécialité, nom, ville...',
      reason_ph: 'Décrivez brièvement le motif de votre visite...',
      message_ph: 'Votre message...',

      // [I18N-REFACTOR-2026-05-19] Placeholders étendus
      ph_email_generic: 'votre@email.com',
      ph_email_tabibi: 'vous@tabibi.dz',
      ph_password_6_min: '6 caractères min.',
      ph_password_8_min: 'Minimum 8 caractères',
      ph_password_8_min_short: 'Min. 8 caractères',
      ph_hero_search: 'Dr. Benali, Cardiologie, Alger...',
      ph_symptoms_short: 'Décrivez vos symptômes...',
      ph_symptoms_long: 'Décrivez vos symptômes, le motif de votre visite...',
      ph_visit_reason: 'Décrivez brièvement vos symptômes ou le motif de votre visite...',
      ph_medical_notes: 'Allergies connues, médicaments en cours, antécédents importants...',

      // [I18N-RES 2026-06-18] reservation.html — chemin critique (pilote P0 #3)
      confirm_rdv: 'Confirmer le RDV', pay_title: 'Mode de paiement',
      rdv_ok: 'RDV confirmé !', rdv_ok_body: 'Votre RDV a été enregistré. Vous recevrez une confirmation par SMS prochainement.',
      payment_secure: 'Paiement 100% sécurisé · Données chiffrées SSL/TLS',
      reason_req: 'Indiquez un motif de consultation.',
      step1_date: '1 · Date', step2_details: '2 · Détails', step3_payment: '3 · Paiement', step4_ok: '4 · OK',
      pick_slot: 'Choisissez un créneau', pick_day_slot: 'Choisissez un jour et un créneau',
      cal_hint: 'Disponibilité chargée à la sélection · 90 jours max',
      click_day_hint: 'Cliquez sur un jour ci-dessus pour voir les créneaux.',
      loading_slots: 'Chargement des créneaux…', no_slots_day: 'Aucun créneau disponible ce jour. Choisissez un autre jour.',
      slots_unit: 'créneau(x)',
      err_booking_module: 'Module de réservation indisponible. Rechargez la page.',
      err_slot_missing: "Créneau manquant. Revenez à l'étape 1.",
      err_slot_taken: "Ce créneau vient d'être pris. Voici les créneaux mis à jour.",
      err_invalid_link: 'Lien invalide : médecin manquant.',
      reason_label: 'Motif de consultation', consult_type_label: 'Type de consultation', notes_label: 'Notes supplémentaires',
      consult_first: 'Première consultation', consult_followup: 'Consultation de suivi', consult_urgent: 'Urgence', consult_checkresults: 'Contrôle résultats',
      auth_required_title: 'Connexion requise pour confirmer', auth_required_body: 'Créez un compte ou connectez-vous — vos choix de RDV seront conservés.', login_or_signup: "Se connecter / S'inscrire",
      see_my_appointments: 'Voir mes rendez-vous', back_home: "Retour à l'accueil", saving: 'Enregistrement…',
      sum_specialty: 'Spécialité', sum_date: 'Date', sum_time: 'Heure', sum_reason: 'Motif', sum_payment: 'Paiement', sum_amount: 'Montant',
      dow_mon: 'Lun', dow_tue: 'Mar', dow_wed: 'Mer', dow_thu: 'Jeu', dow_fri: 'Ven', dow_sat: 'Sam', dow_sun: 'Dim',

      // [I18N-RES 2026-06-18] doctor-profile.html — fiche médecin (P0 #3)
      doctor_not_found: 'Médecin introuvable',
      doctor_not_found_body: "La fiche demandée n'est pas disponible pour le moment. Elle a peut-être été retirée ou le lien est obsolète.",
      price_tbd: 'Tarif à confirmer', teleconsult_available: 'Téléconsultation disponible', secure_video_consult: 'Consultation vidéo sécurisée',
      badge_cash: 'Espèces', badge_card: 'Carte', badge_chifa: 'Chifa', payment_methods_accepted: 'Moyens de paiement acceptés', closed: 'Fermé', reviews_word: 'avis',
      not_rated_yet: 'Pas encore noté',
      booking_not_active: "Ce médecin n'a pas encore activé les RDV en ligne.",
      validation_pending_doctor: 'Validation en cours — ce médecin sera bientôt disponible.',
      login_required_booking: 'Connexion requise pour confirmer le RDV.',
      badge_certified: 'Certifié', badge_urgent: 'Urgences', badge_teleconsult: 'Téléconsultation',
      consult_price_label: 'PRIX CONSULTATION', cnas_casnos_chifa: 'Conventionné CNAS / CASNOS / CHIFA',
      presentation: 'Présentation', diplomas_training: 'Diplômes & formations', cabinet_address_label: 'Adresse du cabinet',
      directions: 'Itinéraire', call: 'Appeler', opening_hours: "Horaires d'ouverture",
      patient_reviews: 'Avis patients', see_more_reviews: "Voir plus d'avis", consulted_this_doctor: 'Vous avez consulté ce médecin ?', give_my_review: 'Donner mon avis',
      book_appointment: 'Réserver un RDV', back_to_directory: "Retour à l'annuaire",

      // [I18N-RES 2026-06-18] signup.html — inscription (P0 #3)
      phone: 'Téléphone', join_tabibi: 'Rejoindre Tabibi', first_name: 'Prénom', last_name: 'Nom',
      // [AUTH i18n 2026] clés héro + labels manquants (login/signup)
      wilaya: 'Wilaya', i_am: 'Je suis :',
      phone_number: 'Numéro de téléphone', sms_code: 'Code reçu par SMS', new_password_label: 'Nouveau mot de passe',
      auth_header_sub: 'طبيبي · Médecins Algérie',
      auth_login_title: 'Connexion à <em>votre espace santé</em>',
      auth_login_sub: 'Gérez vos rendez-vous médicaux partout en Algérie — 58 wilayas, 24h/24.',
      auth_login_p1: 'Patients, médecins et secrétariats',
      auth_login_p2: 'Gratuit pour les patients',
      auth_login_p3: 'Prise de rendez-vous en ligne, 24h/24',
      auth_signup_title: 'Créez votre <em>compte gratuit</em>',
      auth_signup_sub: 'Rejoignez Tabibi en quelques secondes — patients, médecins et secrétariats, partout en Algérie.',
      auth_signup_p1: '100% gratuit, sans engagement',
      auth_signup_p2: 'Compte patient, médecin ou secrétariat',
      auth_signup_p3: 'Vos données protégées (loi 18-07)',
      role_patient: 'Patient', role_doctor: 'Médecin', role_secretaire: 'Secrétariat',
      generalist: 'Généraliste', create_account: 'Créer un compte',
      cabinet_invite_code: 'Code invitation cabinet *',
      cabinet_invite_help: "Demandez ce code à l'administrateur du cabinet qui vous a invité.",
      // [PILOTE i18n 2026] verify-email + messages
      verify_email_header: 'Confirmation email',
      vm_title: 'Vérifiez votre email',
      vm_sub: "Nous venons d'envoyer un lien de confirmation à :",
      vm_step1: 'Ouvrez votre boîte de réception (et vérifiez vos <strong>spams</strong> / courriers indésirables)',
      vm_step2: "Cliquez sur le lien <strong>\"Confirmer mon compte\"</strong> dans l'email de Tabibi",
      vm_step3: 'Vous serez automatiquement connecté et redirigé vers votre tableau de bord',
      vm_spam_tip: "<strong>Pas d'email reçu ?</strong> Vérifiez vos spams. L'email peut mettre jusqu'à 5 minutes à arriver. Si rien dans 10 minutes, écrivez-nous : <a href=\"mailto:contact@tabibi.doctor\" style=\"color:#78350f;text-decoration:underline;font-weight:700\">contact@tabibi.doctor</a>",
      vm_medecin_extra: '<strong>Compte médecin :</strong> après confirmation de votre email, notre équipe validera manuellement votre profil sous 48h (vérification N° Ordre + identité). Vous recevrez un second email dès activation.',
      vm_login_hint: "Le clic sur le lien dans l'email vous connectera automatiquement. Ce bouton n'est utile que si le lien ne fonctionne pas.",
      vm_confirmed_login: "J'ai confirmé, me connecter",
      resend_confirm_email: "Renvoyer l'email de confirmation",
      messages_title: 'Messages',
      msg_disclaimer: '<strong>Messagerie bientôt disponible.</strong> Vous pourrez échanger avec un médecin après un rendez-vous confirmé.',
      upcoming_rdv: 'RDV à venir', past_rdv: 'RDV passés', my_prescriptions: 'Ordonnances',
      // [GABARIT AUTH 2026] forgot-password + reset-password
      back_login: 'Retour connexion',
      fp_title: 'Mot de passe oublié ?',
      fp_subtitle: 'Saisissez votre email — nous vous enverrons un lien de réinitialisation.',
      email_label: 'Email', send_btn: 'Envoyer le lien',
      fp_msg_ok: 'Si un compte existe avec cet email, vous recevrez un lien dans quelques minutes. Pensez à vérifier vos spams.',
      no_account: 'Pas encore de compte ?', signup_link: 'Inscription',
      rp_title: 'Nouveau mot de passe',
      rp_subtitle: 'Choisissez un mot de passe robuste (min. 8 caractères, lettres + chiffres).',
      rp_checking_link: 'Vérification du lien...',
      rp_pwd_ph: '8 caractères minimum',
      rp_pwd_hint: 'Au moins 8 caractères, une lettre, un chiffre.',
      pwd_label: 'Nouveau mot de passe', pwd_confirm_label: 'Confirmer le mot de passe',
      save_btn: 'Définir le mot de passe',
      // [CONFORMITE 2026] teleconsultation (ex data-i18n-key morts)
      tc_loading: 'Chargement de votre téléconsultation...',
      tc_error_title: 'Impossible de démarrer la consultation',
      tc_btn_retry: 'Réessayer', tc_btn_back: 'Retour au tableau de bord',
      tc_hero_title: 'Téléconsultation', tc_meta_secure: 'Connexion chiffrée',
      tc_label_reason: 'Motif',
      tc_consent_title: "J'accepte l'enregistrement de ma consultation",
      tc_consent_detail: "Optionnel. Vous pouvez refuser sans impacter la consultation. L'enregistrement est conservé 30 jours puis supprimé. Vous pouvez demander sa suppression à tout moment via votre tableau de bord. Conforme RGPD art. 9 (données de santé) et loi DZ 18-07.",
      tc_btn_join: 'Rejoindre la consultation',
      tc_btn_join_hint: "Le bouton s'active 15 minutes avant l'heure du rendez-vous.",
      tc_btn_leave: 'Quitter la consultation',
      tc_ended_title: 'Consultation terminée',
      tc_ended_sub: "Merci d'avoir utilisé Tabibi. Vous pouvez retourner à votre tableau de bord.",
      tc_btn_dashboard: 'Tableau de bord',
      tc_footer_brand: 'Tabibi — Santé. Confiance. Algérie.', tc_footer_privacy: 'Confidentialité',
      // [CONFORMITE 2026] verify-prescription (ex-dico local FR/AR migré + EN)
      vp_pagetitle: "Vérification d'ordonnance",
      vp_loading: 'Vérification en cours...', vp_loading_sub: 'Veuillez patienter.',
      vp_valid: 'Ordonnance authentique', vp_valid_sub: 'Cette ordonnance a bien été émise par un médecin vérifié sur Tabibi.',
      vp_expired: 'Ordonnance EXPIRÉE', vp_expired_sub: 'Authentique, mais sa durée de validité est dépassée.',
      vp_cancelled: 'Ordonnance ANNULÉE', vp_cancelled_sub: 'Cette ordonnance a été révoquée par le médecin prescripteur.',
      vp_invalid: 'Ordonnance INVALIDE', vp_invalid_sub: 'La signature ne correspond pas. Possible fraude ou altération.',
      vp_not_found: 'Ordonnance INTROUVABLE', vp_not_found_sub: 'Aucune ordonnance avec cet identifiant.',
      vp_params_required: 'Lien incomplet', vp_params_required_sub: 'Le QR code ou le lien semble incomplet (id et signature requis).',
      vp_server_err: 'Erreur serveur', vp_server_err_sub: 'Réessayez dans quelques instants.',
      vp_lab_doctor: 'Médecin', vp_lab_specialty: 'Spécialité', vp_lab_patient: 'Patient', vp_lab_number: 'N° ordonnance',
      vp_lab_issue: "Date d'émission", vp_lab_expiry: 'Validité', vp_lab_status: 'Statut',
      vp_exp_warn: "Cette ordonnance n'est plus valable. Vérifiez avec le patient s'il en possède une plus récente.",
      vp_cancel_info: 'Le médecin a annulé cette prescription. Ne pas délivrer.',
      vp_help: "Outil de vérification pour les pharmacies et les patients. Saisissez le QR code ou le lien depuis l'ordonnance.<br><a href=\"https://tabibi.doctor\">tabibi.doctor</a>",
      vp_footer: 'Tabibi — La santé plus simple en Algérie. <a href="https://tabibi.doctor/mentions-legales.html">Mentions légales</a>.',
      // [CONFORMITE 2026] patient-ordonnances (ex-dico local FR/AR migré + EN)
      po_pagetitle: 'Mes ordonnances',
      po_title: 'Mes ordonnances numériques',
      po_sub: 'Toutes vos ordonnances signées électroniquement, accessibles à tout moment.',
      po_tab_active: 'Actives', po_tab_expired: 'Expirées', po_tab_cancelled: 'Annulées', po_tab_all: 'Toutes',
      po_status_active: 'Active', po_status_expired: 'Expirée', po_status_cancelled: 'Annulée',
      po_status_delivered: 'Reçue', po_status_draft: 'Brouillon',
      po_issued: 'Émise :', po_valid_until: "Valide jusqu'au :",
      po_detail: 'Détail', po_pdf: 'PDF', po_share: 'Partager', po_doctor_fallback: 'Médecin',
      po_empty_active: 'Aucune ordonnance active', po_empty_expired: 'Aucune ordonnance expirée',
      po_empty_cancelled: 'Aucune ordonnance annulée', po_empty_all: 'Aucune ordonnance',
      po_empty_sub: 'Vos ordonnances signées apparaîtront ici.',
      po_load_error: 'Erreur de chargement',
      po_modal_title: "Détail de l'ordonnance", po_close: 'Fermer',
      po_issued_on: 'émise le', po_by: 'par', po_integrity_hash: "Hash d'intégrité :",
      po_pdf_unavailable: 'PDF indisponible', po_download_error: 'Erreur de téléchargement',
      po_share_error: 'Erreur de partage', po_service_unavailable: 'Service indisponible',
      // [CONFORMITE 2026] medecin-ordonnance (ex-dico local FR/AR migré + EN)
      mo_pagetitle: 'Nouvelle ordonnance médicale',
      mo_patient: 'Patient', mo_patient_uuid_label: 'UUID Patient (provisoire — picker à venir)',
      mo_appt_label: "UUID Rendez-vous (optionnel — lie l'ordonnance à un RDV)",
      mo_appt_ph: 'laisser vide si ordonnance hors-RDV',
      mo_meds: 'Médicaments',
      mo_meds_help: 'Saisissez chaque médicament avec sa posologie. Maximum 30 médicaments. Les stupéfiants et psychotropes doivent être prescrits sur le carnet à souches conforme (cadre légal séparé DZ).',
      mo_add_med: 'Ajouter un médicament',
      mo_diag_title: 'Diagnostic et notes', mo_diag_label: 'Diagnostic (optionnel)',
      mo_diag_ph: 'ex : Angine bactérienne, otite moyenne aiguë droite...',
      mo_notes_label: 'Notes cliniques (optionnel)',
      mo_notes_ph: 'Conseils, recommandations, instructions complémentaires...',
      mo_validity_label: 'Validité (jours)',
      mo_save: 'Sauvegarder brouillon', mo_sign: 'Signer et générer le PDF', mo_cancel: 'Annuler',
      mo_signed: 'Ordonnance signée !', mo_download_pdf: 'Télécharger le PDF', mo_verify_link: 'Lien de vérification',
      mo_preview_live: 'Aperçu en temps réel', mo_doctype: 'ORDONNANCE MÉDICALE',
      mo_lab_doctor: 'Médecin', mo_lab_patient: 'Patient', mo_rx_title: 'Traitement prescrit',
      mo_lab_diag: 'Diagnostic', mo_lab_notes: 'Notes cliniques',
      mo_num_prefix: 'N°', mo_delete: 'Supprimer',
      mo_med_name: 'Nom du médicament *', mo_med_dosage: 'Posologie', mo_med_freq: 'Fréquence',
      mo_med_duration: 'Durée', mo_med_note: 'Note (optionnel)',
      mo_med_name_ph: 'ex : Doliprane 1000mg', mo_med_dosage_ph: 'ex : 1 comprimé',
      mo_med_freq_ph: 'ex : 3 fois par jour', mo_med_duration_ph: 'ex : 7 jours',
      mo_med_note_ph: 'ex : à prendre après repas',
      mo_no_meds: 'Aucun médicament saisi',
      mo_foot_prefix: 'Document généré électroniquement par Tabibi le',
      mo_doctor_fallback: 'Médecin',
      mo_login_required: 'Connexion requise', mo_doctor_required: 'Accès médecin requis',
      mo_not_verified: 'Compte non vérifié : impossible de prescrire',
      mo_service_unavailable: 'Service indisponible',
      mo_patient_required: 'Patient requis', mo_med_required: 'Au moins un médicament requis',
      mo_draft_updated: 'Brouillon mis à jour', mo_draft_saved: 'Brouillon enregistré',
      mo_save_error: 'Erreur lors de la sauvegarde', mo_max_meds: 'Maximum 30 médicaments',
      mo_confirm_sign: 'Après signature, cette ordonnance sera IMMUABLE.\n\nConfirmer la signature électronique ?',
      mo_signing: 'Signature en cours...', mo_pdf_error: 'Erreur de génération du PDF',
      mo_number: 'Numéro', mo_signed_toast: 'Ordonnance signée et PDF généré',
      mo_sign_error: 'Erreur lors de la signature',
      specialty: 'Spécialité', select_placeholder: '— Sélectionnez —',
      spec_cardio: 'Cardiologue', spec_dermato: 'Dermatologue', spec_pediatre: 'Pédiatre', spec_gyneco: 'Gynécologue',
      spec_dentiste: 'Dentiste', spec_ophtalmo: 'Ophtalmologue', spec_orl: 'ORL',
      order_council_number: "N° Conseil de l'Ordre",
      create_my_account: 'Créer mon compte', already_registered: 'Déjà inscrit ?',
      consent_cgu: 'J\'accepte les <a href="legal/cgu.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">Conditions Générales d\'Utilisation</a> de Tabibi.',
      consent_privacy: 'Je consens au traitement de mes données personnelles selon la <a href="legal/confidentialite.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">Politique de confidentialité</a>, conforme à la loi algérienne 18-07.',
      consent_health: '<b>Consentement données de santé :</b> J\'autorise expressément le traitement de mes données médicales sensibles aux seules fins de la prise de rendez-vous (art. 18 loi 18-07).',
      consent_marketing: '(Optionnel) J\'accepte de recevoir des conseils santé et offres Tabibi par email. Désabonnement en 1 clic.',
      signup_err_empty_response: 'Réponse Supabase vide. Ouvrez la console (F12) puis contactez support@tabibi.doctor avec la capture.',
      signup_err_unexpected: 'Erreur inattendue. Réessayez ou contactez support@tabibi.doctor',
      signup_err_profile: "Compte créé, mais l'enregistrement de votre profil a échoué. Vous pourrez le compléter depuis votre espace.",
      // [I18N-RES] signup.html — modale "médecin en attente" (showMedecinPendingModal)
      welcome_doctor: 'Bienvenue Dr', signup_recorded: 'Votre inscription a bien été enregistrée.',
      med_pending_verify: "Notre équipe va vérifier vos qualifications (diplôme + Conseil de l'Ordre) sous <strong>48h ouvrées maximum</strong>.",
      med_pending_email_1: 'Vous recevrez un email à ', med_pending_email_2: ' dès que votre compte sera activé.',
      next_step: 'Prochaine étape :', med_pending_docs: 'Préparez vos documents (diplôme + attestation Ordre) pour les envoyer à <strong>contact@tabibi.doctor</strong>',

      // [I18N-RES 2026-06-23] doctor-claim.html — réclamation de fiche (P0 #3)
      claim_my_profile: 'Réclamer ma fiche', you_are_doctor: 'Vous êtes médecin ?',
      claim_find_1: 'Trouvez votre fiche parmi', claim_find_2: 'praticiens référencés en Algérie. Réclamez-la en 2 minutes pour gérer vos rendez-vous, vos tarifs et votre disponibilité.',
      all_wilayas: 'Toutes wilayas', all_specialties: 'Toutes spécialités', ph_family_name: 'Votre nom de famille…',
      claim_search_prompt: 'Saisissez votre nom puis sélectionnez la fiche qui correspond.',
      claim_not_found: 'Vous ne trouvez pas votre fiche ?', claim_write_us: "Écrivez-nous pour qu'on l'ajoute",
      claim_this_profile: 'Réclamer cette fiche', claim_you_will_claim: 'Vous allez réclamer la fiche de :',
      order_council_number_full: "N° Conseil de l'Ordre des Médecins", entered_for_tracking: 'Saisi pour traçabilité.',
      claim_docs_later_note: "Vos pièces justificatives (carte du Conseil de l'Ordre + pièce d'identité) devront être ajoutées depuis votre espace médecin, juste après la création de votre compte.",
      claim_searching: 'Recherche…', claim_no_profile: 'Aucune fiche disponible',
      claim_refine_or_write: 'Affinez votre recherche ou écrivez-nous si votre fiche manque.',
      claim_zero_found: '0 fiche trouvée', claim_shown_of: 'affichées sur', claim_refine: 'affinez par wilaya/spécialité', claim_profiles_found: 'fiche(s) trouvée(s)',
      claim_certify: "<strong>Je certifie sur l'honneur</strong> être le médecin de cette fiche. Toute fausse déclaration peut entraîner la suppression de mon compte et des poursuites (loi DZ 18-07 + art. 226-15 du Code pénal).",
      ph_subspecialties: 'Ex : Rythmologie, Échocardiographie',
      ph_ordre_number: 'CO-2025-XXXX',
      ph_doctor_bio: 'Cardiologue avec 15 ans d\'expérience au CHU Mustapha Pacha...',
      ph_cabinet_name: 'Cabinet Dr. Hadj',
      ph_cabinet_name_alt: 'Cabinet Dr. Benali',
      ph_cabinet_address: '12 Rue Didouche Mourad, Alger Centre',
      ph_phone_dz: '0661 234 567',
      ph_phone_dz_alt: '0555 123 456',
      ph_phone_dz_example: '+213 555 12 34 56',
      ph_404_search: 'Cardiologue Alger, dermatologue Oran...',
      ph_search_short: 'Rechercher...',
      ph_name_email_search: 'Nom, email...',
      ph_address_full: 'Rue, quartier, code postal...',
      ph_allergies: 'Pénicilline, arachides, lactose...',
      ph_medical_history: 'Hypertension, diabète, opérations chirurgicales...',
      ph_current_meds: 'Aspirine 100mg/j, Metformine 500mg...',
      ph_family_history: 'Diabète (père), cancer (mère)...',
      ph_vaccinations: 'COVID-19 (rappel 2024), Tétanos (2022)...',
      ph_chifa_card: 'Numéro de carte CHIFA',
      ph_mutual_name: 'Nom de la mutuelle',
      ph_first_name_example: 'Ahmed',
      ph_last_name_example: 'Benali',
      ph_email_pro_example: 'dr.benali@gmail.com',
      ph_review_share: 'Partagez votre expérience...',

      // [I18N-REFACTOR-2026-05-19] Titres de pages étendus
      title_home_long: 'Tabibi — Trouvez votre médecin en ligne en Algérie | RDV 24/7',
      title_login_long: 'Connexion à Tabibi | Espace patient et médecin',
      title_signup_long: 'Inscription Tabibi | Créer un compte patient ou médecin',
      title_about_long: 'À propos | Tabibi — Plateforme médicale algérienne',
      title_privacy_long: 'Politique de confidentialité | Tabibi',
      title_cookies_long: 'Politique de cookies | Tabibi',
      title_cgu_long: 'Conditions Générales d\'Utilisation | Tabibi',
      title_waiting_list_long: 'Liste d\'attente Tabibi — Santé Algérie',
      title_doctor_profile_self: 'Profil médecin | Tabibi',
      title_doctor_profile_long: 'Profil médecin | Tabibi — RDV en ligne en Algérie',
      title_doctor_reservation_self: 'Réservation médecin | Tabibi',
      title_reservation_ongoing: 'Réservation en cours | Tabibi',
      title_admin_reviews: 'Modération des avis | Tabibi Admin',
      title_onboarding_long: 'Devenir médecin Tabibi — Inscription',

      // [I18N-REFACTOR-2026-05-19] Toasts étendus
      toast_email_format_invalid: 'Format d\'email invalide',
      toast_password_invalid: 'Mot de passe invalide',
      toast_auth_unavailable: 'Service d\'authentification indisponible. Réessayez.',
      toast_profile_not_found: 'Profil introuvable, contactez le support',
      toast_doctor_pending: 'Votre compte médecin est en cours de vérification (48h max). Vous serez notifié par email.',
      toast_account_suspended: 'Compte suspendu. Contactez contact@tabibi.doctor',
      toast_signup_rejected: 'Inscription rejetée. Contactez contact@tabibi.doctor',
      toast_firstname_lastname_required: 'Prénom et nom obligatoires',
      toast_cgu_required: 'Vous devez accepter les CGU pour créer un compte',
      toast_privacy_required: 'Vous devez consentir à la politique de confidentialité',
      toast_spec_ordre_required: 'Spécialité et N° d\'Ordre obligatoires',
      toast_role_invalid: 'Rôle invalide',
      toast_email_already_used: 'Cet email est déjà utilisé. Connectez-vous.',
      toast_supabase_unavailable: 'Erreur: Supabase indisponible',
      toast_reason_too_short: 'Raison trop courte (min 5 caractères)',
      toast_2fa_module_not_loaded: 'Module 2FA non chargé',
      toast_codes_copied: 'Codes copiés',
      toast_2fa_enabled: '2FA activée ✓',
      toast_2fa_disabled: '2FA désactivée',
      toast_profile_saved: 'Profil sauvegardé !',
      toast_too_short: 'Trop court',
      toast_medical_save_failed: 'Échec sauvegarde données médicales',
      toast_pii_module_missing: 'Module PII non chargé — données médicales non sauvegardées',
      toast_cancelled_short: 'Annulé',
      toast_card_number_invalid: 'Numéro invalide',
      toast_all_read: 'Tout marqué comme lu',
      toast_reason_required: 'Veuillez saisir le motif de consultation',
      toast_rdv_cancelled: 'RDV annulé',
      toast_rdv_confirmed: 'RDV confirmé',
      toast_rdv_refused: 'RDV refusé',
      toast_rdv_completed: 'RDV terminé',
      toast_receipt_downloaded: 'Reçu téléchargé',
      toast_fav_removed: 'Retiré des favoris',
      toast_fav_added: 'Ajouté aux favoris',
      toast_schedule_saved: 'Horaires enregistrés',
      toast_fill_all_fields_short: 'Remplissez tous les champs',

      // [I18N-REFACTOR-2026-05-19] Confirms/Alerts/Prompts
      confirm_logout: 'Voulez-vous vous déconnecter ?',
      confirm_logout_short: 'Se déconnecter ?',
      confirm_delete_doctor_account: 'Supprimer définitivement votre compte médecin ?',
      confirm_disable_2fa: 'Désactiver la 2FA réduit la sécurité de votre compte. Continuer ?',
      confirm_suspend_account: 'Suspendre votre compte temporairement ?',
      confirm_delete_account_warning: '⚠️ Supprimer DÉFINITIVEMENT votre compte ?\nTous vos RDV, favoris et données médicales seront effacés.\nCette action est IRRÉVERSIBLE.',
      confirm_delete_slot: 'Supprimer ce créneau ?',
      alert_account_deleted: 'Compte supprimé',
      alert_account_deleted_bye: 'Compte supprimé. Au revoir.',
      alert_account_suspended: 'Compte suspendu — réactivez via support',
      alert_module_measures_soon: 'Module mesures · Bientôt disponible',
      alert_rgpd_request_sent: 'Demande envoyée — réponse sous 30 jours (RGPD)',
      alert_active_sessions_demo: 'Sessions actives :\n• Cet appareil (Mac · Chrome) — actuel\n• iPhone 15 (Safari) — il y a 2 jours\n\nDéconnectez-vous des autres sessions depuis l\'admin.',
      alert_change_avatar_demo: 'Choisissez une image (à brancher avec un input file dans la version production)',
      alert_admin_notif_demo: '3 alertes admin · 7 médecins en attente · 5 signalements',
      alert_export_csv_pending: 'Export CSV en cours...',
      alert_backup_created: 'Backup créé',
      alert_link_copied: 'Lien copié',
      alert_login_required_booking: 'Connectez-vous pour réserver',
      alert_visio_starting: 'Démarrage de la visioconsultation — Fonctionnalité en bêta',
      alert_login_required_rating: 'Connectez-vous pour noter ce médecin',
      alert_password_min_8: 'Mot de passe : minimum 8 caractères',
      alert_diploma_required: 'Le diplôme est obligatoire',
      alert_ordre_required: 'Numéro d\'inscription au Conseil de l\'Ordre obligatoire',
      alert_spec_required: 'Spécialité obligatoire',
      alert_privacy_consent_required: 'Consentez à la politique de confidentialité',
      alert_ethics_required: 'Engagez-vous sur le code de déontologie',
      prompt_diploma_input: 'Diplôme (ex: Doctorat en Médecine — Université d\'Alger (2008))',
      prompt_old_password: 'Ancien mot de passe :',
      prompt_new_password: 'Nouveau (min 8) :',
      prompt_new_password_long: 'Nouveau mot de passe (min. 8 car.) :',
      prompt_confirm_short: 'Confirmer :',
      prompt_document_name: 'Nom du document (ex: Ordonnance.pdf) :',
      prompt_document_type: 'Type (ordonnance / résultat / certificat / reçu) :',
      prompt_card_number: 'Numéro de carte (16 chiffres) :',
      alert_download_prefix: 'Téléchargement de ',
      confirm_delete_document: 'Supprimer ce document ?',
      alert_support_24h: 'Support : contact@tabibi.doctor — réponse sous 24h',
      toast_error_prefix: 'Erreur : ',
      toast_validation_failed: 'validation échouée',
      toast_rejection_failed: 'rejet échoué',
      alert_doctor_only: 'Accès réservé aux médecins. Connectez-vous.',
      alert_cookies_all_accepted: '✅ Toutes les préférences acceptées',
      alert_cookies_essentials_only: '✅ Cookies non-essentiels refusés',
      alert_cookies_preferences_saved: '✅ Préférences enregistrées',
      alert_select_reason: 'Sélectionnez un motif',
      label_patient_colon: 'Patient : ',
      label_reason_colon: 'Motif : ',
      label_duration_colon: 'Durée : ',
      label_min_unit: 'min',
      label_patient_file_colon: 'Dossier patient : ',
      label_consultations: 'consultation(s)',
      label_last_colon: 'Dernière : '
    },
    ar: {
      logout: 'تسجيل الخروج', my_account: 'حسابي', dashboard: 'لوحة التحكم',
      profile: 'الملف الشخصي', settings: 'الإعدادات', notifications: 'الإشعارات',
      help: 'المساعدة', back: 'رجوع', save: 'حفظ', cancel: 'إلغاء',
      confirm: 'تأكيد', edit: 'تعديل', delete: 'حذف', search: 'بحث',
      loading: 'جارٍ التحميل...', close: 'إغلاق', continue: 'متابعة', send: 'إرسال',
      my_space: 'مساحتي', patient: 'مريض',
      tab_book: 'حجز', tab_rdv: 'مواعيدي', tab_view: 'عرض', tab_docs: 'الوثائق',
      tab_favs: 'المفضلة', tab_profile: 'الملف',
      find_doctor: 'ابحث عن طبيبك', search_placeholder: 'التخصص، الاسم، المدينة...',
      doctor: 'طبيب', dr: 'د.',
      tab_today: 'اليوم', tab_agenda: 'الأجندة', tab_patients: 'المرضى',
      tab_stats: 'الإحصائيات', tab_messages: 'الرسائل',
      sign_in: 'تسجيل الدخول', sign_up: 'إنشاء حساب',
      email: 'البريد الإلكتروني', password: 'كلمة المرور', forgot_password: 'نسيت كلمة المرور؟',

      hello: 'مرحبًا', good_morning: 'صباح الخير، د.',
      good_afternoon: 'مساء الخير، د.', good_evening: 'مساء الخير، د.',

      // [I18N-UNIFY-2026] Salutations génériques
      greet_morning: 'صباح الخير', greet_afternoon: 'مساء الخير', greet_evening: 'مساء الخير',

      active: 'نشط', pending: 'في الانتظار', confirmed: 'مؤكد',
      cancelled: 'ملغى', completed: 'منتهي',

      // [I18N-UNIFY-2026] Statuts RDV
      status_pending: 'في الانتظار', status_confirmed: 'مؤكد',
      status_completed: 'منتهي', status_cancelled: 'ملغى',
      status_no_show: 'لم يحضر', status_rescheduled: 'أُعيد جدولته',

      // [I18N-UNIFY-2026] Jours courts
      day_mon: 'إث', day_tue: 'ثل', day_wed: 'أر', day_thu: 'خم',
      day_fri: 'جم', day_sat: 'سب', day_sun: 'أح',
      // Versions longues
      day_monday: 'الإثنين', day_tuesday: 'الثلاثاء', day_wednesday: 'الأربعاء',
      day_thursday: 'الخميس', day_friday: 'الجمعة', day_saturday: 'السبت', day_sunday: 'الأحد',

      // [I18N-UNIFY-2026] Mois courts
      month_jan: 'جانفي', month_feb: 'فيفري', month_mar: 'مارس', month_apr: 'أفريل',
      month_may: 'ماي', month_jun: 'جوان', month_jul: 'جويلية', month_aug: 'أوت',
      month_sep: 'سبتمبر', month_oct: 'أكتوبر', month_nov: 'نوفمبر', month_dec: 'ديسمبر',
      // Versions longues (identiques en AR-DZ)
      month_january: 'جانفي', month_february: 'فيفري', month_march: 'مارس',
      month_april: 'أفريل', month_may_long: 'ماي', month_june: 'جوان',
      month_july: 'جويلية', month_august: 'أوت', month_september: 'سبتمبر',
      month_october: 'أكتوبر', month_november: 'نوفمبر', month_december: 'ديسمبر',

      // [I18N-UNIFY-2026] Toasts
      toast_password_changed: 'تم تغيير كلمة المرور!',
      toast_document_added: 'تمت إضافة الوثيقة',
      toast_doctor_not_found: 'الطبيب غير موجود',
      toast_review_thanks: 'شكرًا على تقييمك!',
      toast_health_consent_required: 'الموافقة على معالجة البيانات الصحية إلزامية',
      toast_password_too_short: 'كلمة المرور قصيرة جدًا (8 أحرف على الأقل)',
      toast_email_invalid: 'البريد الإلكتروني غير صالح',
      toast_member_added: 'تمت إضافة العضو',
      toast_diploma_added: 'تمت إضافة الشهادة',
      toast_card_added: 'تمت إضافة البطاقة',
      toast_slots_added: 'تمت إضافة الفترات!',
      toast_passwords_mismatch: 'غير متطابقتين',
      toast_select_rating: 'اختر تقييمًا',
      toast_fill_all_fields: 'يرجى ملء جميع الحقول',
      toast_login_failed: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      toast_login_success: 'تم تسجيل الدخول بنجاح',
      toast_signup_success: 'تم إنشاء الحساب بنجاح',
      toast_logout_success: 'تم تسجيل الخروج',
      toast_generic_error: 'حدث خطأ',
      toast_saved: 'تم الحفظ',
      toast_deleted: 'تم الحذف',
      toast_copied: 'تم النسخ',

      // [I18N-UNIFY-2026] Titres de pages
      title_home: 'طبيبي — احجز طبيبك في الجزائر',
      title_login: 'تسجيل الدخول | طبيبي',
      title_signup: 'التسجيل | طبيبي',
      title_patient_dashboard: 'مساحتي كمريض | طبيبي',
      title_doctor_dashboard: 'مساحة الطبيب | طبيبي',
      title_admin_dashboard: 'الإدارة | طبيبي',
      title_doctor_profile: 'ملف الطبيب | طبيبي',
      title_doctor_reservation: 'حجز | طبيبي',
      title_appointment: 'موعدي | طبيبي',
      title_analytics: 'التحليلات — طبيبي',
      title_about: 'حول | طبيبي',
      title_cgu: 'الشروط العامة | طبيبي',
      title_privacy: 'الخصوصية | طبيبي',
      title_cookies: 'ملفات تعريف الارتباط | طبيبي',
      title_legal: 'إشعار قانوني | طبيبي',
      title_404: 'الصفحة غير موجودة | طبيبي',
      title_offline: 'غير متصل | طبيبي',
      title_onboarding: 'انضم كطبيب شريك | طبيبي',
      title_patient_profile: 'ملفي | طبيبي',
      title_reservation: 'حجز | طبيبي',
      title_success: 'تأكيد | طبيبي',
      title_waiting_list: 'قائمة الانتظار | طبيبي',

      // [I18N-UNIFY-2026] Placeholders
      first_name_ph: 'الاسم', last_name_ph: 'اللقب',
      email_ph: 'your@email.com', password_ph: 'كلمة المرور',
      phone_ph: '+213 ...', city_ph: 'المدينة',
      address_ph: 'العنوان الكامل',
      search_doctor_ph: 'التخصص، الاسم، المدينة...',
      reason_ph: 'صف بإيجاز سبب زيارتك...',
      message_ph: 'رسالتك...',

      // [I18N-REFACTOR-2026-05-19] Placeholders étendus
      ph_email_generic: 'your@email.com',
      ph_email_tabibi: 'you@tabibi.dz',
      ph_password_6_min: '6 أحرف على الأقل',
      ph_password_8_min: '8 أحرف على الأقل',
      ph_password_8_min_short: '8 أحرف على الأقل',
      ph_hero_search: 'د. بن علي، أمراض القلب، الجزائر...',
      ph_symptoms_short: 'صف أعراضك...',
      ph_symptoms_long: 'صف أعراضك وسبب زيارتك...',
      ph_visit_reason: 'صف بإيجاز أعراضك أو سبب زيارتك...',
      ph_medical_notes: 'الحساسية المعروفة، الأدوية الحالية، السوابق المهمة...',

      // [I18N-RES 2026-06-18] reservation.html — chemin critique (pilote P0 #3)
      confirm_rdv: 'تأكيد الموعد', pay_title: 'طريقة الدفع',
      rdv_ok: 'تم تأكيد الموعد !', rdv_ok_body: 'تم تسجيل موعدك. ستصلك رسالة تأكيد قريبًا عبر SMS.',
      payment_secure: 'دفع آمن 100% · بيانات مشفّرة SSL/TLS',
      reason_req: 'يرجى إدخال سبب الاستشارة.',
      step1_date: '1 · التاريخ', step2_details: '2 · التفاصيل', step3_payment: '3 · الدفع', step4_ok: '4 · تم',
      pick_slot: 'اختر موعدًا', pick_day_slot: 'اختر يومًا وموعدًا',
      cal_hint: 'تُحمَّل المواعيد عند الاختيار · 90 يومًا كحد أقصى',
      click_day_hint: 'انقر على يوم أعلاه لعرض المواعيد.',
      loading_slots: 'جارٍ تحميل المواعيد…', no_slots_day: 'لا توجد مواعيد متاحة في هذا اليوم. اختر يومًا آخر.',
      slots_unit: 'موعد',
      err_booking_module: 'وحدة الحجز غير متوفرة. أعد تحميل الصفحة.',
      err_slot_missing: 'الموعد مفقود. ارجع إلى الخطوة 1.',
      err_slot_taken: 'تم حجز هذا الموعد للتو. إليك المواعيد المحدّثة.',
      err_invalid_link: 'رابط غير صالح: الطبيب مفقود.',
      reason_label: 'سبب الاستشارة', consult_type_label: 'نوع الاستشارة', notes_label: 'ملاحظات إضافية',
      consult_first: 'استشارة أولى', consult_followup: 'استشارة متابعة', consult_urgent: 'حالة طارئة', consult_checkresults: 'مراجعة النتائج',
      auth_required_title: 'تسجيل الدخول مطلوب للتأكيد', auth_required_body: 'أنشئ حسابًا أو سجّل الدخول — سيتم حفظ اختياراتك للموعد.', login_or_signup: 'تسجيل الدخول / إنشاء حساب',
      see_my_appointments: 'عرض مواعيدي', back_home: 'العودة إلى الرئيسية', saving: 'جارٍ الحفظ…',
      sum_specialty: 'التخصص', sum_date: 'التاريخ', sum_time: 'الوقت', sum_reason: 'السبب', sum_payment: 'الدفع', sum_amount: 'المبلغ',
      dow_mon: 'الاثنين', dow_tue: 'الثلاثاء', dow_wed: 'الأربعاء', dow_thu: 'الخميس', dow_fri: 'الجمعة', dow_sat: 'السبت', dow_sun: 'الأحد',

      // [I18N-RES 2026-06-18] doctor-profile.html — fiche médecin (P0 #3)
      doctor_not_found: 'الطبيب غير موجود',
      doctor_not_found_body: 'الملف المطلوب غير متاح حاليًا. ربما تم حذفه أو أن الرابط لم يعد صالحًا.',
      price_tbd: 'السعر قيد التأكيد', teleconsult_available: 'الاستشارة عن بُعد متاحة', secure_video_consult: 'استشارة فيديو آمنة',
      badge_cash: 'نقدًا', badge_card: 'بطاقة', badge_chifa: 'شيفا', payment_methods_accepted: 'وسائل الدفع المقبولة', closed: 'مغلق', reviews_word: 'تقييم',
      not_rated_yet: 'لم يُقيَّم بعد',
      booking_not_active: 'لم يُفعّل هذا الطبيب الحجز عبر الإنترنت بعد.',
      validation_pending_doctor: 'قيد التحقق — سيكون هذا الطبيب متاحًا قريبًا.',
      login_required_booking: 'تسجيل الدخول مطلوب لتأكيد الموعد.',
      badge_certified: 'معتمد', badge_urgent: 'حالات طارئة', badge_teleconsult: 'استشارة عن بُعد',
      consult_price_label: 'سعر الاستشارة', cnas_casnos_chifa: 'متعاقد CNAS / CASNOS / CHIFA',
      presentation: 'نبذة تعريفية', diplomas_training: 'الشهادات والتكوين', cabinet_address_label: 'عنوان العيادة',
      directions: 'الاتجاهات', call: 'اتصال', opening_hours: 'ساعات العمل',
      patient_reviews: 'آراء المرضى', see_more_reviews: 'عرض المزيد من الآراء', consulted_this_doctor: 'هل استشرت هذا الطبيب؟', give_my_review: 'أضف رأيي',
      book_appointment: 'حجز موعد', back_to_directory: 'العودة إلى الدليل',

      // [I18N-RES 2026-06-18] signup.html — inscription (P0 #3)
      phone: 'الهاتف', join_tabibi: 'انضم إلى طبيبي', first_name: 'الاسم', last_name: 'اللقب',
      // [AUTH i18n 2026] clés héro + labels manquants (login/signup)
      wilaya: 'الولاية', i_am: 'أنا :',
      phone_number: 'رقم الهاتف', sms_code: 'الرمز المستلَم عبر الرسائل القصيرة', new_password_label: 'كلمة المرور الجديدة',
      auth_header_sub: 'طبيبي · أطباء الجزائر',
      auth_login_title: 'تسجيل الدخول إلى <em>مساحتك الصحية</em>',
      auth_login_sub: 'أدِر مواعيدك الطبية في كل أنحاء الجزائر — 58 ولاية، على مدار الساعة.',
      auth_login_p1: 'مرضى وأطباء وأمانات',
      auth_login_p2: 'مجاني للمرضى',
      auth_login_p3: 'حجز المواعيد عبر الإنترنت، على مدار الساعة',
      auth_signup_title: 'أنشئ <em>حسابك المجاني</em>',
      auth_signup_sub: 'انضم إلى طبيبي في ثوانٍ — مرضى وأطباء وأمانات، في كل أنحاء الجزائر.',
      auth_signup_p1: 'مجاني 100%، دون أي التزام',
      auth_signup_p2: 'حساب مريض أو طبيب أو أمانة',
      auth_signup_p3: 'بياناتك محمية (القانون 18-07)',
      role_patient: 'مريض', role_doctor: 'طبيب', role_secretaire: 'سكرتارية',
      generalist: 'طبيب عام', create_account: 'إنشاء حساب',
      cabinet_invite_code: 'رمز دعوة العيادة *',
      cabinet_invite_help: 'اطلب هذا الرمز من مسؤول العيادة الذي دعاك.',
      // [PILOTE i18n 2026] verify-email + messages
      verify_email_header: 'تأكيد البريد الإلكتروني',
      vm_title: 'تحقّق من بريدك الإلكتروني',
      vm_sub: 'لقد أرسلنا للتوّ رابط تأكيد إلى:',
      vm_step1: 'افتح صندوق الوارد (وتحقّق من <strong>الرسائل غير المرغوب فيها</strong> / السبام)',
      vm_step2: 'انقر على رابط <strong>"تأكيد حسابي"</strong> في رسالة Tabibi',
      vm_step3: 'سيتمّ تسجيل دخولك تلقائيًا وتحويلك إلى لوحة التحكّم',
      vm_spam_tip: '<strong>لم تصلك أيّ رسالة؟</strong> تحقّق من مجلد الرسائل غير المرغوب فيها. قد يستغرق وصول الرسالة حتى 5 دقائق. إن لم يصلك شيء خلال 10 دقائق، راسلنا: <a href="mailto:contact@tabibi.doctor" style="color:#78350f;text-decoration:underline;font-weight:700">contact@tabibi.doctor</a>',
      vm_medecin_extra: '<strong>حساب طبيب:</strong> بعد تأكيد بريدك الإلكتروني، سيتحقّق فريقنا يدويًا من ملفّك خلال 48 ساعة (التحقّق من رقم القيد في النقابة + الهوية). ستصلك رسالة ثانية بمجرّد التفعيل.',
      vm_login_hint: 'النقر على الرابط في الرسالة سيسجّل دخولك تلقائيًا. هذا الزر مفيد فقط إذا لم يعمل الرابط.',
      vm_confirmed_login: 'لقد أكّدت، تسجيل الدخول',
      resend_confirm_email: 'إعادة إرسال رسالة التأكيد',
      messages_title: 'الرسائل',
      msg_disclaimer: '<strong>المراسلة متاحة قريبًا.</strong> ستتمكّن من التواصل مع طبيب بعد موعد مؤكَّد.',
      upcoming_rdv: 'مواعيد قادمة', past_rdv: 'مواعيد سابقة', my_prescriptions: 'الوصفات الطبية',
      // [GABARIT AUTH 2026] forgot-password + reset-password
      back_login: 'العودة إلى تسجيل الدخول',
      fp_title: 'نسيت كلمة المرور؟',
      fp_subtitle: 'أدخل بريدك الإلكتروني — سنرسل لك رابط إعادة التعيين.',
      email_label: 'البريد الإلكتروني', send_btn: 'إرسال الرابط',
      fp_msg_ok: 'إذا كان هناك حساب بهذا البريد الإلكتروني، ستتلقى رابطًا خلال دقائق. تذكّر التحقّق من السبام.',
      no_account: 'ليس لديك حساب بعد؟', signup_link: 'التسجيل',
      rp_title: 'كلمة مرور جديدة',
      rp_subtitle: 'اختر كلمة مرور قوية (8 أحرف على الأقل، حروف + أرقام).',
      rp_checking_link: 'جارٍ التحقّق من الرابط...',
      rp_pwd_ph: '8 أحرف على الأقل',
      rp_pwd_hint: 'على الأقل 8 أحرف، حرف واحد ورقم واحد.',
      pwd_label: 'كلمة المرور الجديدة', pwd_confirm_label: 'تأكيد كلمة المرور',
      save_btn: 'تعيين كلمة المرور',
      // [CONFORMITE 2026] teleconsultation (ex data-i18n-key morts)
      tc_loading: 'جارٍ تحميل استشارتك عن بُعد...',
      tc_error_title: 'تعذّر بدء الاستشارة',
      tc_btn_retry: 'إعادة المحاولة', tc_btn_back: 'العودة إلى لوحة التحكّم',
      tc_hero_title: 'الاستشارة عن بُعد', tc_meta_secure: 'اتصال مشفَّر',
      tc_label_reason: 'السبب',
      tc_consent_title: 'أوافق على تسجيل استشارتي',
      tc_consent_detail: 'اختياري. يمكنك الرفض دون التأثير على الاستشارة. يُحفظ التسجيل 30 يومًا ثم يُحذف. يمكنك طلب حذفه في أي وقت من لوحة التحكّم. متوافق مع اللائحة الأوروبية RGPD المادة 9 (البيانات الصحية) والقانون الجزائري 18-07.',
      tc_btn_join: 'الانضمام إلى الاستشارة',
      tc_btn_join_hint: 'يُفعَّل الزر قبل 15 دقيقة من موعد الاستشارة.',
      tc_btn_leave: 'مغادرة الاستشارة',
      tc_ended_title: 'انتهت الاستشارة',
      tc_ended_sub: 'شكرًا لاستخدامك طبيبي. يمكنك العودة إلى لوحة التحكّم.',
      tc_btn_dashboard: 'لوحة التحكّم',
      tc_footer_brand: 'طبيبي — صحة. ثقة. الجزائر.', tc_footer_privacy: 'الخصوصية',
      // [CONFORMITE 2026] verify-prescription (ex-dico local FR/AR migré + EN)
      vp_pagetitle: 'التحقق من الوصفة الطبية',
      vp_loading: 'جاري التحقق...', vp_loading_sub: 'يرجى الانتظار.',
      vp_valid: 'وصفة طبية موثقة', vp_valid_sub: 'هذه الوصفة صادرة عن طبيب موثق على منصة طبيبي.',
      vp_expired: 'وصفة منتهية الصلاحية', vp_expired_sub: 'موثقة، لكن مدة صلاحيتها انتهت.',
      vp_cancelled: 'وصفة ملغاة', vp_cancelled_sub: 'تم إلغاء هذه الوصفة من قبل الطبيب.',
      vp_invalid: 'وصفة غير صالحة', vp_invalid_sub: 'التوقيع غير مطابق. احتمال تزوير أو تعديل.',
      vp_not_found: 'الوصفة غير موجودة', vp_not_found_sub: 'لا توجد وصفة بهذا المعرف.',
      vp_params_required: 'رابط غير مكتمل', vp_params_required_sub: 'يبدو أن رمز QR أو الرابط غير مكتمل.',
      vp_server_err: 'خطأ في الخادم', vp_server_err_sub: 'يرجى المحاولة لاحقاً.',
      vp_lab_doctor: 'الطبيب', vp_lab_specialty: 'التخصص', vp_lab_patient: 'المريض', vp_lab_number: 'رقم الوصفة',
      vp_lab_issue: 'تاريخ الإصدار', vp_lab_expiry: 'الصلاحية حتى', vp_lab_status: 'الحالة',
      vp_exp_warn: 'هذه الوصفة لم تعد سارية. تحقق مع المريض من وجود وصفة أحدث.',
      vp_cancel_info: 'ألغى الطبيب هذه الوصفة. لا تصرف الدواء.',
      vp_help: 'أداة تحقق للصيدليات والمرضى. أدخل رمز QR أو الرابط من الوصفة.<br><a href="https://tabibi.doctor">tabibi.doctor</a>',
      vp_footer: 'طبيبي — الصحة أبسط في الجزائر. <a href="https://tabibi.doctor/mentions-legales.html">إشعار قانوني</a>.',
      // [CONFORMITE 2026] patient-ordonnances (ex-dico local FR/AR migré + EN)
      po_pagetitle: 'وصفاتي الطبية',
      po_title: 'وصفاتي الطبية الرقمية',
      po_sub: 'جميع وصفاتك الموقعة إلكترونياً، متاحة في أي وقت.',
      po_tab_active: 'سارية', po_tab_expired: 'منتهية', po_tab_cancelled: 'ملغاة', po_tab_all: 'الكل',
      po_status_active: 'سارية', po_status_expired: 'منتهية', po_status_cancelled: 'ملغاة',
      po_status_delivered: 'مستلمة', po_status_draft: 'مسودة',
      po_issued: 'أُصدرت:', po_valid_until: 'سارية حتى:',
      po_detail: 'التفاصيل', po_pdf: 'PDF', po_share: 'مشاركة', po_doctor_fallback: 'طبيب',
      po_empty_active: 'لا توجد وصفة سارية', po_empty_expired: 'لا توجد وصفة منتهية',
      po_empty_cancelled: 'لا توجد وصفة ملغاة', po_empty_all: 'لا توجد وصفات',
      po_empty_sub: 'ستظهر وصفاتك الموقعة هنا.',
      po_load_error: 'خطأ في التحميل',
      po_modal_title: 'تفاصيل الوصفة', po_close: 'إغلاق',
      po_issued_on: 'أُصدرت في', po_by: 'من طرف', po_integrity_hash: 'بصمة السلامة:',
      po_pdf_unavailable: 'ملف PDF غير متاح', po_download_error: 'خطأ في التنزيل',
      po_share_error: 'خطأ في المشاركة', po_service_unavailable: 'الخدمة غير متاحة',
      // [CONFORMITE 2026] medecin-ordonnance (ex-dico local FR/AR migré + EN)
      mo_pagetitle: 'وصفة طبية جديدة',
      mo_patient: 'المريض', mo_patient_uuid_label: 'معرّف المريض UUID (مؤقت — أداة الاختيار قادمة)',
      mo_appt_label: 'معرّف الموعد UUID (اختياري — يربط الوصفة بموعد)',
      mo_appt_ph: 'اتركه فارغًا إذا كانت الوصفة خارج موعد',
      mo_meds: 'الأدوية',
      mo_meds_help: 'أدخل كل دواء مع جرعته. 30 دواءً كحد أقصى. المخدرات والمؤثرات العقلية تُوصف على الدفتر القانوني المخصص (إطار قانوني جزائري منفصل).',
      mo_add_med: 'إضافة دواء',
      mo_diag_title: 'التشخيص والملاحظات', mo_diag_label: 'التشخيص (اختياري)',
      mo_diag_ph: 'مثال: التهاب اللوزتين البكتيري، التهاب الأذن الوسطى الحاد الأيمن...',
      mo_notes_label: 'ملاحظات سريرية (اختياري)',
      mo_notes_ph: 'نصائح، توصيات، تعليمات إضافية...',
      mo_validity_label: 'الصلاحية (أيام)',
      mo_save: 'حفظ مسودة', mo_sign: 'توقيع وإنشاء PDF', mo_cancel: 'إلغاء',
      mo_signed: 'تم توقيع الوصفة!', mo_download_pdf: 'تحميل PDF', mo_verify_link: 'رابط التحقق',
      mo_preview_live: 'معاينة فورية', mo_doctype: 'وصفة طبية',
      mo_lab_doctor: 'الطبيب', mo_lab_patient: 'المريض', mo_rx_title: 'العلاج الموصوف',
      mo_lab_diag: 'التشخيص', mo_lab_notes: 'ملاحظات سريرية',
      mo_num_prefix: 'رقم', mo_delete: 'حذف',
      mo_med_name: 'اسم الدواء *', mo_med_dosage: 'الجرعة', mo_med_freq: 'التكرار',
      mo_med_duration: 'المدة', mo_med_note: 'ملاحظة (اختياري)',
      mo_med_name_ph: 'مثال: Doliprane 1000mg', mo_med_dosage_ph: 'مثال: قرص واحد',
      mo_med_freq_ph: 'مثال: 3 مرات في اليوم', mo_med_duration_ph: 'مثال: 7 أيام',
      mo_med_note_ph: 'مثال: يؤخذ بعد الأكل',
      mo_no_meds: 'لم يُدخل أي دواء',
      mo_foot_prefix: 'وثيقة أُنشئت إلكترونيًا عبر طبيبي بتاريخ',
      mo_doctor_fallback: 'طبيب',
      mo_login_required: 'تسجيل الدخول مطلوب', mo_doctor_required: 'الوصول مخصص للأطباء',
      mo_not_verified: 'حساب غير موثق: لا يمكن وصف الأدوية',
      mo_service_unavailable: 'الخدمة غير متاحة',
      mo_patient_required: 'المريض مطلوب', mo_med_required: 'دواء واحد على الأقل مطلوب',
      mo_draft_updated: 'تم تحديث المسودة', mo_draft_saved: 'تم حفظ المسودة',
      mo_save_error: 'خطأ أثناء الحفظ', mo_max_meds: '30 دواءً كحد أقصى',
      mo_confirm_sign: 'بعد التوقيع، ستصبح هذه الوصفة غير قابلة للتعديل.\n\nتأكيد التوقيع الإلكتروني؟',
      mo_signing: 'جارٍ التوقيع...', mo_pdf_error: 'خطأ في إنشاء PDF',
      mo_number: 'الرقم', mo_signed_toast: 'تم توقيع الوصفة وإنشاء PDF',
      mo_sign_error: 'خطأ أثناء التوقيع',
      specialty: 'التخصص', select_placeholder: '— اختر —',
      spec_cardio: 'طبيب قلب', spec_dermato: 'طبيب جلدية', spec_pediatre: 'طبيب أطفال', spec_gyneco: 'طبيب نساء وتوليد',
      spec_dentiste: 'طبيب أسنان', spec_ophtalmo: 'طبيب عيون', spec_orl: 'أنف وأذن وحنجرة',
      order_council_number: 'رقم مجلس نقابة الأطباء',
      create_my_account: 'إنشاء حسابي', already_registered: 'مسجّل بالفعل؟',
      consent_cgu: 'أوافق على <a href="legal/cgu.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">الشروط العامة للاستخدام</a> الخاصة بطبيبي.',
      consent_privacy: 'أوافق على معالجة معطياتي ذات الطابع الشخصي وفقًا لـ<a href="legal/confidentialite.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">سياسة الخصوصية</a>، طبقًا للقانون الجزائري 18-07.',
      consent_health: '<b>الموافقة على المعطيات الصحية:</b> أوافق صراحةً على معالجة معطياتي الصحية الحساسة لغرض حجز المواعيد فقط (المادة 18 من القانون 18-07).',
      consent_marketing: '(اختياري) أوافق على تلقّي نصائح صحية وعروض طبيبي عبر البريد الإلكتروني. إلغاء الاشتراك بنقرة واحدة.',
      signup_err_empty_response: 'استجابة Supabase فارغة. افتح وحدة التحكم (F12) ثم تواصل مع support@tabibi.doctor مع لقطة الشاشة.',
      signup_err_unexpected: 'خطأ غير متوقع. أعد المحاولة أو تواصل مع support@tabibi.doctor',
      signup_err_profile: 'تم إنشاء الحساب، لكن تعذّر حفظ ملفك الشخصي. يمكنك إكماله من مساحتك الخاصة.',
      // [I18N-RES] signup.html — modale "médecin en attente"
      welcome_doctor: 'مرحبًا د.', signup_recorded: 'تم تسجيل طلبك بنجاح.',
      med_pending_verify: 'سيتحقّق فريقنا من مؤهّلاتك (الشهادة + مجلس النقابة) خلال <strong>48 ساعة عمل كحد أقصى</strong>.',
      med_pending_email_1: 'ستصلك رسالة إلى ', med_pending_email_2: ' بمجرد تفعيل حسابك.',
      next_step: 'الخطوة التالية:', med_pending_docs: 'جهّز وثائقك (الشهادة + شهادة النقابة) لإرسالها إلى <strong>contact@tabibi.doctor</strong>',

      // [I18N-RES 2026-06-23] doctor-claim.html — réclamation de fiche (P0 #3)
      claim_my_profile: 'المطالبة بملفي', you_are_doctor: 'هل أنت طبيب؟',
      claim_find_1: 'اعثر على ملفك من بين', claim_find_2: 'ممارس مُدرَج في الجزائر. طالِب به في دقيقتين لإدارة مواعيدك وأسعارك وتوفّرك.',
      all_wilayas: 'كل الولايات', all_specialties: 'كل التخصصات', ph_family_name: 'اسم عائلتك…',
      claim_search_prompt: 'أدخل اسمك ثم اختر الملف المطابق.',
      claim_not_found: 'لا تجد ملفك؟', claim_write_us: 'راسلنا لإضافته',
      claim_this_profile: 'المطالبة بهذا الملف', claim_you_will_claim: 'أنت على وشك المطالبة بملف:',
      order_council_number_full: 'رقم مجلس نقابة الأطباء', entered_for_tracking: 'يُسجَّل لأغراض التتبّع.',
      claim_docs_later_note: 'سيتعيّن إضافة وثائقك المُثبِتة (بطاقة مجلس النقابة + وثيقة الهوية) من مساحتك كطبيب، بعد إنشاء حسابك مباشرةً.',
      claim_searching: 'جارٍ البحث…', claim_no_profile: 'لا يوجد ملف متاح',
      claim_refine_or_write: 'حسّن بحثك أو راسلنا إن كان ملفك مفقودًا.',
      claim_zero_found: '0 ملف موجود', claim_shown_of: 'معروضة من أصل', claim_refine: 'حسّن حسب الولاية/التخصص', claim_profiles_found: 'ملف/ملفات موجودة',
      claim_certify: '<strong>أُقرّ على سبيل التصريح الشرفي</strong> بأنني الطبيب صاحب هذا الملف. كل تصريح كاذب قد يؤدّي إلى حذف حسابي وإلى ملاحقات قضائية (القانون الجزائري 18-07 + المادة 226-15 من قانون العقوبات).',
      ph_subspecialties: 'مثال: اضطراب نظم القلب، تخطيط صدى القلب',
      ph_ordre_number: 'CO-2025-XXXX',
      ph_doctor_bio: 'طبيب قلب بخبرة 15 سنة في المستشفى الجامعي مصطفى باشا...',
      ph_cabinet_name: 'عيادة د. حاج',
      ph_cabinet_name_alt: 'عيادة د. بن علي',
      ph_cabinet_address: '12 شارع ديدوش مراد، الجزائر العاصمة',
      ph_phone_dz: '0661 234 567',
      ph_phone_dz_alt: '0555 123 456',
      ph_phone_dz_example: '+213 555 12 34 56',
      ph_404_search: 'طبيب قلب الجزائر، طبيب جلد وهران...',
      ph_search_short: 'بحث...',
      ph_name_email_search: 'الاسم، البريد الإلكتروني...',
      ph_address_full: 'الشارع، الحي، الرمز البريدي...',
      ph_allergies: 'البنسلين، الفول السوداني، اللاكتوز...',
      ph_medical_history: 'ارتفاع ضغط الدم، السكري، العمليات الجراحية...',
      ph_current_meds: 'أسبيرين 100mg/يوم، ميتفورمين 500mg...',
      ph_family_history: 'سكري (الأب)، سرطان (الأم)...',
      ph_vaccinations: 'كوفيد-19 (جرعة معززة 2024)، الكزاز (2022)...',
      ph_chifa_card: 'رقم بطاقة الشفاء',
      ph_mutual_name: 'اسم التأمين التكميلي',
      ph_first_name_example: 'أحمد',
      ph_last_name_example: 'بن علي',
      ph_email_pro_example: 'dr.benali@gmail.com',
      ph_review_share: 'شارك تجربتك...',

      // [I18N-REFACTOR-2026-05-19] Titres de pages étendus
      title_home_long: 'طبيبي — احجز طبيبك أونلاين في الجزائر | مواعيد 24/7',
      title_login_long: 'تسجيل الدخول إلى طبيبي | فضاء المريض والطبيب',
      title_signup_long: 'التسجيل في طبيبي | إنشاء حساب مريض أو طبيب',
      title_about_long: 'حول طبيبي — المنصة الطبية الجزائرية',
      title_privacy_long: 'سياسة الخصوصية | طبيبي',
      title_cookies_long: 'سياسة ملفات تعريف الارتباط | طبيبي',
      title_cgu_long: 'الشروط العامة للاستخدام | طبيبي',
      title_waiting_list_long: 'قائمة انتظار طبيبي — صحة الجزائر',
      title_doctor_profile_self: 'ملف الطبيب | طبيبي',
      title_doctor_profile_long: 'ملف الطبيب | طبيبي — حجز مواعيد أونلاين في الجزائر',
      title_doctor_reservation_self: 'حجز موعد مع الطبيب | طبيبي',
      title_reservation_ongoing: 'حجز جارٍ | طبيبي',
      title_admin_reviews: 'الإشراف على التقييمات | طبيبي إدارة',
      title_onboarding_long: 'انضم كطبيب على طبيبي — التسجيل',

      // [I18N-REFACTOR-2026-05-19] Toasts étendus
      toast_email_format_invalid: 'صيغة البريد الإلكتروني غير صحيحة',
      toast_password_invalid: 'كلمة المرور غير صالحة',
      toast_auth_unavailable: 'خدمة المصادقة غير متوفرة. أعد المحاولة.',
      toast_profile_not_found: 'الملف الشخصي غير موجود، اتصل بالدعم',
      toast_doctor_pending: 'حساب الطبيب قيد التحقق (48 ساعة كحد أقصى). ستتلقى إشعارًا بالبريد الإلكتروني.',
      toast_account_suspended: 'الحساب موقوف. اتصل بـ contact@tabibi.doctor',
      toast_signup_rejected: 'تم رفض التسجيل. اتصل بـ contact@tabibi.doctor',
      toast_firstname_lastname_required: 'الاسم واللقب إلزاميان',
      toast_cgu_required: 'يجب قبول الشروط العامة لإنشاء حساب',
      toast_privacy_required: 'يجب الموافقة على سياسة الخصوصية',
      toast_spec_ordre_required: 'التخصص ورقم القيد إلزاميان',
      toast_role_invalid: 'الدور غير صالح',
      toast_email_already_used: 'هذا البريد الإلكتروني مستخدم بالفعل. سجل دخولك.',
      toast_supabase_unavailable: 'خطأ: Supabase غير متوفر',
      toast_reason_too_short: 'السبب قصير جدًا (5 أحرف على الأقل)',
      toast_2fa_module_not_loaded: 'وحدة 2FA غير محملة',
      toast_codes_copied: 'تم نسخ الرموز',
      toast_2fa_enabled: 'تم تفعيل 2FA ✓',
      toast_2fa_disabled: 'تم تعطيل 2FA',
      toast_profile_saved: 'تم حفظ الملف الشخصي!',
      toast_too_short: 'قصير جدًا',
      toast_medical_save_failed: 'فشل حفظ البيانات الطبية',
      toast_pii_module_missing: 'وحدة PII غير محملة — البيانات الطبية لم تُحفظ',
      toast_cancelled_short: 'ملغى',
      toast_card_number_invalid: 'الرقم غير صالح',
      toast_all_read: 'تم تعليم الكل كمقروء',
      toast_reason_required: 'يرجى إدخال سبب الاستشارة',
      toast_rdv_cancelled: 'تم إلغاء الموعد',
      toast_rdv_confirmed: 'تم تأكيد الموعد',
      toast_rdv_refused: 'تم رفض الموعد',
      toast_rdv_completed: 'تم إنهاء الموعد',
      toast_receipt_downloaded: 'تم تحميل الإيصال',
      toast_fav_removed: 'تمت إزالته من المفضلة',
      toast_fav_added: 'تمت إضافته إلى المفضلة',
      toast_schedule_saved: 'تم حفظ المواعيد',
      toast_fill_all_fields_short: 'املأ جميع الحقول',

      // [I18N-REFACTOR-2026-05-19] Confirms/Alerts/Prompts
      confirm_logout: 'هل تريد تسجيل الخروج؟',
      confirm_logout_short: 'تسجيل الخروج؟',
      confirm_delete_doctor_account: 'حذف حساب الطبيب نهائيًا؟',
      confirm_disable_2fa: 'تعطيل 2FA يقلل من أمان حسابك. هل تريد المتابعة؟',
      confirm_suspend_account: 'إيقاف حسابك مؤقتًا؟',
      confirm_delete_account_warning: '⚠️ حذف حسابك نهائيًا؟\nسيتم محو جميع مواعيدك ومفضلتك وبياناتك الطبية.\nهذا الإجراء لا رجعة فيه.',
      confirm_delete_slot: 'حذف هذا الموعد؟',
      alert_account_deleted: 'تم حذف الحساب',
      alert_account_deleted_bye: 'تم حذف الحساب. إلى اللقاء.',
      alert_account_suspended: 'الحساب موقوف — أعد التفعيل عبر الدعم',
      alert_module_measures_soon: 'وحدة القياسات · قريبًا',
      alert_rgpd_request_sent: 'تم إرسال الطلب — رد خلال 30 يومًا (RGPD)',
      alert_active_sessions_demo: 'الجلسات النشطة:\n• هذا الجهاز (ماك · كروم) — الحالي\n• آيفون 15 (سفاري) — منذ يومين\n\nسجل خروجك من الجلسات الأخرى من الإدارة.',
      alert_change_avatar_demo: 'اختر صورة (سيتم ربطها بحقل ملف في النسخة الإنتاجية)',
      alert_admin_notif_demo: '3 تنبيهات إدارية · 7 أطباء في الانتظار · 5 إبلاغات',
      alert_export_csv_pending: 'تصدير CSV جارٍ...',
      alert_backup_created: 'تم إنشاء النسخة الاحتياطية',
      alert_link_copied: 'تم نسخ الرابط',
      alert_login_required_booking: 'سجل دخولك للحجز',
      alert_visio_starting: 'بدء الاستشارة المرئية — ميزة تجريبية',
      alert_login_required_rating: 'سجل دخولك لتقييم هذا الطبيب',
      alert_password_min_8: 'كلمة المرور: 8 أحرف على الأقل',
      alert_diploma_required: 'الشهادة إلزامية',
      alert_ordre_required: 'رقم القيد في المجلس الوطني للأخلاقيات إلزامي',
      alert_spec_required: 'التخصص إلزامي',
      alert_privacy_consent_required: 'وافق على سياسة الخصوصية',
      alert_ethics_required: 'التزم بميثاق الأخلاقيات',
      prompt_diploma_input: 'الشهادة (مثال: دكتوراه في الطب — جامعة الجزائر (2008))',
      prompt_old_password: 'كلمة المرور القديمة:',
      prompt_new_password: 'الجديدة (8 أحرف على الأقل):',
      prompt_new_password_long: 'كلمة المرور الجديدة (8 أحرف على الأقل):',
      prompt_confirm_short: 'تأكيد:',
      prompt_document_name: 'اسم الوثيقة (مثال: وصفة طبية.pdf):',
      prompt_document_type: 'النوع (وصفة / نتيجة / شهادة / إيصال):',
      prompt_card_number: 'رقم البطاقة (16 رقمًا):',
      alert_download_prefix: 'تحميل ',
      confirm_delete_document: 'حذف هذه الوثيقة؟',
      alert_support_24h: 'الدعم: contact@tabibi.doctor — رد خلال 24 ساعة',
      toast_error_prefix: 'خطأ: ',
      toast_validation_failed: 'فشل التحقق',
      toast_rejection_failed: 'فشل الرفض',
      alert_doctor_only: 'الوصول مخصص للأطباء. سجل دخولك.',
      alert_cookies_all_accepted: '✅ تم قبول جميع التفضيلات',
      alert_cookies_essentials_only: '✅ تم رفض ملفات تعريف الارتباط غير الأساسية',
      alert_cookies_preferences_saved: '✅ تم حفظ التفضيلات',
      alert_select_reason: 'اختر سببًا',
      label_patient_colon: 'المريض: ',
      label_reason_colon: 'السبب: ',
      label_duration_colon: 'المدة: ',
      label_min_unit: 'دقيقة',
      label_patient_file_colon: 'ملف المريض: ',
      label_consultations: 'استشارة',
      label_last_colon: 'الأخيرة: '
    },
    en: {
      logout: 'Sign out', my_account: 'My account', dashboard: 'Dashboard',
      profile: 'Profile', settings: 'Settings', notifications: 'Notifications',
      help: 'Help', back: 'Back', save: 'Save', cancel: 'Cancel',
      confirm: 'Confirm', edit: 'Edit', delete: 'Delete', search: 'Search',
      loading: 'Loading...', close: 'Close', continue: 'Continue', send: 'Send',
      my_space: 'My space', patient: 'Patient',
      tab_book: 'Book', tab_rdv: 'My appointments', tab_view: 'View', tab_docs: 'Documents',
      tab_favs: 'Favorites', tab_profile: 'Profile',
      find_doctor: 'Find your doctor', search_placeholder: 'Specialty, name, city...',
      doctor: 'Doctor', dr: 'Dr.',
      tab_today: 'Today', tab_agenda: 'Agenda', tab_patients: 'Patients',
      tab_stats: 'Stats', tab_messages: 'Messages',
      sign_in: 'Sign in', sign_up: 'Sign up',
      email: 'Email', password: 'Password', forgot_password: 'Forgot password?',

      hello: 'Hello', good_morning: 'Good morning, Dr.',
      good_afternoon: 'Good afternoon, Dr.', good_evening: 'Good evening, Dr.',

      // [I18N-UNIFY-2026] Salutations génériques
      greet_morning: 'Good morning', greet_afternoon: 'Good afternoon', greet_evening: 'Good evening',

      active: 'Active', pending: 'Pending', confirmed: 'Confirmed',
      cancelled: 'Cancelled', completed: 'Completed',

      // [I18N-UNIFY-2026] Statuts RDV
      status_pending: 'Pending', status_confirmed: 'Confirmed',
      status_completed: 'Completed', status_cancelled: 'Cancelled',
      status_no_show: 'No show', status_rescheduled: 'Rescheduled',

      // [I18N-UNIFY-2026] Jours courts
      day_mon: 'Mon', day_tue: 'Tue', day_wed: 'Wed', day_thu: 'Thu',
      day_fri: 'Fri', day_sat: 'Sat', day_sun: 'Sun',
      day_monday: 'Monday', day_tuesday: 'Tuesday', day_wednesday: 'Wednesday',
      day_thursday: 'Thursday', day_friday: 'Friday', day_saturday: 'Saturday', day_sunday: 'Sunday',

      // [I18N-UNIFY-2026] Mois courts
      month_jan: 'Jan', month_feb: 'Feb', month_mar: 'Mar', month_apr: 'Apr',
      month_may: 'May', month_jun: 'Jun', month_jul: 'Jul', month_aug: 'Aug',
      month_sep: 'Sep', month_oct: 'Oct', month_nov: 'Nov', month_dec: 'Dec',
      month_january: 'January', month_february: 'February', month_march: 'March',
      month_april: 'April', month_may_long: 'May', month_june: 'June',
      month_july: 'July', month_august: 'August', month_september: 'September',
      month_october: 'October', month_november: 'November', month_december: 'December',

      // [I18N-UNIFY-2026] Toasts
      toast_password_changed: 'Password changed!',
      toast_document_added: 'Document added',
      toast_doctor_not_found: 'Doctor not found',
      toast_review_thanks: 'Thanks for your review!',
      toast_health_consent_required: 'Health data consent is mandatory',
      toast_password_too_short: 'Password too short (8 characters minimum)',
      toast_email_invalid: 'Invalid email',
      toast_member_added: 'Member added',
      toast_diploma_added: 'Diploma added',
      toast_card_added: 'Card added',
      toast_slots_added: 'Slots added!',
      toast_passwords_mismatch: 'Do not match',
      toast_select_rating: 'Select a rating',
      toast_fill_all_fields: 'Please fill in all fields',
      toast_login_failed: 'Wrong email or password',
      toast_login_success: 'Logged in',
      toast_signup_success: 'Account created',
      toast_logout_success: 'Logged out',
      toast_generic_error: 'An error occurred',
      toast_saved: 'Saved',
      toast_deleted: 'Deleted',
      toast_copied: 'Copied',

      // [I18N-UNIFY-2026] Titres de pages
      title_home: 'Tabibi — Find your doctor in Algeria',
      title_login: 'Login | Tabibi',
      title_signup: 'Sign up | Tabibi',
      title_patient_dashboard: 'My patient space | Tabibi',
      title_doctor_dashboard: 'Doctor space | Tabibi',
      title_admin_dashboard: 'Administration | Tabibi',
      title_doctor_profile: 'Doctor profile | Tabibi',
      title_doctor_reservation: 'Booking | Tabibi',
      title_appointment: 'My appointment | Tabibi',
      title_analytics: 'Analytics — Tabibi Doctor',
      title_about: 'About | Tabibi',
      title_cgu: 'Terms | Tabibi',
      title_privacy: 'Privacy | Tabibi',
      title_cookies: 'Cookies | Tabibi',
      title_legal: 'Legal notice | Tabibi',
      title_404: 'Page not found | Tabibi',
      title_offline: 'Offline | Tabibi',
      title_onboarding: 'Become a partner doctor | Tabibi',
      title_patient_profile: 'My profile | Tabibi',
      title_reservation: 'Booking | Tabibi',
      title_success: 'Confirmation | Tabibi',
      title_waiting_list: 'Waiting list | Tabibi',

      // [I18N-UNIFY-2026] Placeholders
      first_name_ph: 'First name', last_name_ph: 'Last name',
      email_ph: 'your@email.com', password_ph: 'Password',
      phone_ph: '+213 ...', city_ph: 'City',
      address_ph: 'Full address',
      search_doctor_ph: 'Specialty, name, city...',
      reason_ph: 'Briefly describe the reason for your visit...',
      message_ph: 'Your message...',

      // [I18N-REFACTOR-2026-05-19] Extended placeholders
      ph_email_generic: 'your@email.com',
      ph_email_tabibi: 'you@tabibi.dz',
      ph_password_6_min: '6 characters min.',
      ph_password_8_min: 'Minimum 8 characters',
      ph_password_8_min_short: 'Min. 8 characters',
      ph_hero_search: 'Dr. Benali, Cardiology, Algiers...',
      ph_symptoms_short: 'Describe your symptoms...',
      ph_symptoms_long: 'Describe your symptoms, the reason for your visit...',
      ph_visit_reason: 'Briefly describe your symptoms or the reason for your visit...',
      ph_medical_notes: 'Known allergies, current medication, important history...',

      // [I18N-RES 2026-06-18] reservation.html — chemin critique (pilote P0 #3)
      confirm_rdv: 'Confirm appointment', pay_title: 'Payment method',
      rdv_ok: 'Appointment confirmed!', rdv_ok_body: 'Your appointment has been saved. You will receive an SMS confirmation soon.',
      payment_secure: '100% secure payment · SSL/TLS encrypted data',
      reason_req: 'Please enter a reason for the consultation.',
      step1_date: '1 · Date', step2_details: '2 · Details', step3_payment: '3 · Payment', step4_ok: '4 · OK',
      pick_slot: 'Choose a time slot', pick_day_slot: 'Choose a day and a time slot',
      cal_hint: 'Availability loaded on selection · 90 days max',
      click_day_hint: 'Tap a day above to see available slots.',
      loading_slots: 'Loading slots…', no_slots_day: 'No slots available that day. Choose another day.',
      slots_unit: 'slot(s)',
      err_booking_module: 'Booking module unavailable. Reload the page.',
      err_slot_missing: 'Slot missing. Go back to step 1.',
      err_slot_taken: 'This slot was just taken. Here are the updated slots.',
      err_invalid_link: 'Invalid link: doctor missing.',
      reason_label: 'Reason for consultation', consult_type_label: 'Consultation type', notes_label: 'Additional notes',
      consult_first: 'First consultation', consult_followup: 'Follow-up consultation', consult_urgent: 'Emergency', consult_checkresults: 'Results review',
      auth_required_title: 'Login required to confirm', auth_required_body: 'Create an account or log in — your appointment choices will be kept.', login_or_signup: 'Log in / Sign up',
      see_my_appointments: 'View my appointments', back_home: 'Back to home', saving: 'Saving…',
      sum_specialty: 'Specialty', sum_date: 'Date', sum_time: 'Time', sum_reason: 'Reason', sum_payment: 'Payment', sum_amount: 'Amount',
      dow_mon: 'Mon', dow_tue: 'Tue', dow_wed: 'Wed', dow_thu: 'Thu', dow_fri: 'Fri', dow_sat: 'Sat', dow_sun: 'Sun',

      // [I18N-RES 2026-06-18] doctor-profile.html — doctor profile (P0 #3)
      doctor_not_found: 'Doctor not found',
      doctor_not_found_body: "The requested profile isn't available right now. It may have been removed or the link is outdated.",
      price_tbd: 'Price to confirm', teleconsult_available: 'Teleconsultation available', secure_video_consult: 'Secure video consultation',
      badge_cash: 'Cash', badge_card: 'Card', badge_chifa: 'Chifa', payment_methods_accepted: 'Accepted payment methods', closed: 'Closed', reviews_word: 'reviews',
      not_rated_yet: 'Not rated yet',
      booking_not_active: "This doctor hasn't enabled online booking yet.",
      validation_pending_doctor: 'Validation in progress — this doctor will be available soon.',
      login_required_booking: 'Login required to confirm the appointment.',
      badge_certified: 'Certified', badge_urgent: 'Emergencies', badge_teleconsult: 'Teleconsultation',
      consult_price_label: 'CONSULTATION PRICE', cnas_casnos_chifa: 'Covered: CNAS / CASNOS / CHIFA',
      presentation: 'Presentation', diplomas_training: 'Degrees & training', cabinet_address_label: 'Practice address',
      directions: 'Directions', call: 'Call', opening_hours: 'Opening hours',
      patient_reviews: 'Patient reviews', see_more_reviews: 'See more reviews', consulted_this_doctor: 'Have you consulted this doctor?', give_my_review: 'Leave my review',
      book_appointment: 'Book an appointment', back_to_directory: 'Back to directory',

      // [I18N-RES 2026-06-18] signup.html — sign up (P0 #3)
      phone: 'Phone', join_tabibi: 'Join Tabibi', first_name: 'First name', last_name: 'Last name',
      // [AUTH i18n 2026] clés héro + labels manquants (login/signup)
      wilaya: 'Wilaya', i_am: 'I am:',
      phone_number: 'Phone number', sms_code: 'Code received by SMS', new_password_label: 'New password',
      auth_header_sub: 'طبيبي · Doctors Algeria',
      auth_login_title: 'Sign in to <em>your health space</em>',
      auth_login_sub: 'Manage your medical appointments anywhere in Algeria — 58 wilayas, 24/7.',
      auth_login_p1: 'Patients, doctors and secretariats',
      auth_login_p2: 'Free for patients',
      auth_login_p3: 'Online appointment booking, 24/7',
      auth_signup_title: 'Create your <em>free account</em>',
      auth_signup_sub: 'Join Tabibi in seconds — patients, doctors and secretariats, everywhere in Algeria.',
      auth_signup_p1: '100% free, no commitment',
      auth_signup_p2: 'Patient, doctor or secretariat account',
      auth_signup_p3: 'Your data protected (law 18-07)',
      role_patient: 'Patient', role_doctor: 'Doctor', role_secretaire: 'Secretariat',
      generalist: 'General practitioner', create_account: 'Create an account',
      cabinet_invite_code: 'Clinic invitation code *',
      cabinet_invite_help: 'Ask the clinic administrator who invited you for this code.',
      // [PILOTE i18n 2026] verify-email + messages
      verify_email_header: 'Email confirmation',
      vm_title: 'Verify your email',
      vm_sub: 'We just sent a confirmation link to:',
      vm_step1: 'Open your inbox (and check your <strong>spam</strong> / junk folder)',
      vm_step2: 'Click the <strong>"Confirm my account"</strong> link in the email from Tabibi',
      vm_step3: 'You will be logged in automatically and redirected to your dashboard',
      vm_spam_tip: '<strong>No email received?</strong> Check your spam folder. The email can take up to 5 minutes to arrive. If nothing after 10 minutes, write to us: <a href="mailto:contact@tabibi.doctor" style="color:#78350f;text-decoration:underline;font-weight:700">contact@tabibi.doctor</a>',
      vm_medecin_extra: '<strong>Doctor account:</strong> after confirming your email, our team will manually review your profile within 48h (Medical Council number + identity check). You will receive a second email once activated.',
      vm_login_hint: 'Clicking the link in the email will log you in automatically. This button is only useful if the link does not work.',
      vm_confirmed_login: "I've confirmed, log me in",
      resend_confirm_email: 'Resend confirmation email',
      messages_title: 'Messages',
      msg_disclaimer: '<strong>Messaging coming soon.</strong> You will be able to chat with a doctor after a confirmed appointment.',
      upcoming_rdv: 'Upcoming appointments', past_rdv: 'Past appointments', my_prescriptions: 'Prescriptions',
      // [GABARIT AUTH 2026] forgot-password + reset-password
      back_login: 'Back to login',
      fp_title: 'Forgot your password?',
      fp_subtitle: 'Enter your email — we will send you a reset link.',
      email_label: 'Email', send_btn: 'Send the link',
      fp_msg_ok: 'If an account exists with this email, you will receive a link within a few minutes. Remember to check your spam.',
      no_account: 'No account yet?', signup_link: 'Sign up',
      rp_title: 'New password',
      rp_subtitle: 'Choose a strong password (min. 8 characters, letters + numbers).',
      rp_checking_link: 'Checking the link...',
      rp_pwd_ph: '8 characters minimum',
      rp_pwd_hint: 'At least 8 characters, one letter, one number.',
      pwd_label: 'New password', pwd_confirm_label: 'Confirm password',
      save_btn: 'Set the password',
      // [CONFORMITE 2026] teleconsultation (ex data-i18n-key morts)
      tc_loading: 'Loading your teleconsultation...',
      tc_error_title: 'Unable to start the consultation',
      tc_btn_retry: 'Try again', tc_btn_back: 'Back to dashboard',
      tc_hero_title: 'Teleconsultation', tc_meta_secure: 'Encrypted connection',
      tc_label_reason: 'Reason',
      tc_consent_title: 'I consent to my consultation being recorded',
      tc_consent_detail: 'Optional. You can refuse without affecting the consultation. The recording is kept for 30 days then deleted. You can request its deletion at any time from your dashboard. Compliant with GDPR art. 9 (health data) and DZ law 18-07.',
      tc_btn_join: 'Join the consultation',
      tc_btn_join_hint: 'The button activates 15 minutes before the appointment time.',
      tc_btn_leave: 'Leave the consultation',
      tc_ended_title: 'Consultation ended',
      tc_ended_sub: 'Thank you for using Tabibi. You can return to your dashboard.',
      tc_btn_dashboard: 'Dashboard',
      tc_footer_brand: 'Tabibi — Health. Trust. Algeria.', tc_footer_privacy: 'Privacy',
      // [CONFORMITE 2026] verify-prescription (ex-dico local FR/AR migré + EN)
      vp_pagetitle: 'Prescription verification',
      vp_loading: 'Verifying...', vp_loading_sub: 'Please wait.',
      vp_valid: 'Authentic prescription', vp_valid_sub: 'This prescription was issued by a verified doctor on Tabibi.',
      vp_expired: 'EXPIRED prescription', vp_expired_sub: 'Authentic, but its validity period has passed.',
      vp_cancelled: 'CANCELLED prescription', vp_cancelled_sub: 'This prescription was revoked by the prescribing doctor.',
      vp_invalid: 'INVALID prescription', vp_invalid_sub: 'The signature does not match. Possible fraud or alteration.',
      vp_not_found: 'Prescription NOT FOUND', vp_not_found_sub: 'No prescription with this identifier.',
      vp_params_required: 'Incomplete link', vp_params_required_sub: 'The QR code or link seems incomplete (id and signature required).',
      vp_server_err: 'Server error', vp_server_err_sub: 'Try again in a few moments.',
      vp_lab_doctor: 'Doctor', vp_lab_specialty: 'Specialty', vp_lab_patient: 'Patient', vp_lab_number: 'Prescription no.',
      vp_lab_issue: 'Issue date', vp_lab_expiry: 'Valid until', vp_lab_status: 'Status',
      vp_exp_warn: 'This prescription is no longer valid. Check with the patient for a more recent one.',
      vp_cancel_info: 'The doctor cancelled this prescription. Do not dispense.',
      vp_help: 'Verification tool for pharmacies and patients. Enter the QR code or link from the prescription.<br><a href="https://tabibi.doctor">tabibi.doctor</a>',
      vp_footer: 'Tabibi — Healthcare made simpler in Algeria. <a href="https://tabibi.doctor/mentions-legales.html">Legal notice</a>.',
      // [CONFORMITE 2026] patient-ordonnances (ex-dico local FR/AR migré + EN)
      po_pagetitle: 'My prescriptions',
      po_title: 'My digital prescriptions',
      po_sub: 'All your electronically signed prescriptions, available at any time.',
      po_tab_active: 'Active', po_tab_expired: 'Expired', po_tab_cancelled: 'Cancelled', po_tab_all: 'All',
      po_status_active: 'Active', po_status_expired: 'Expired', po_status_cancelled: 'Cancelled',
      po_status_delivered: 'Received', po_status_draft: 'Draft',
      po_issued: 'Issued:', po_valid_until: 'Valid until:',
      po_detail: 'Details', po_pdf: 'PDF', po_share: 'Share', po_doctor_fallback: 'Doctor',
      po_empty_active: 'No active prescription', po_empty_expired: 'No expired prescription',
      po_empty_cancelled: 'No cancelled prescription', po_empty_all: 'No prescriptions',
      po_empty_sub: 'Your signed prescriptions will appear here.',
      po_load_error: 'Loading error',
      po_modal_title: 'Prescription details', po_close: 'Close',
      po_issued_on: 'issued on', po_by: 'by', po_integrity_hash: 'Integrity hash:',
      po_pdf_unavailable: 'PDF unavailable', po_download_error: 'Download error',
      po_share_error: 'Share error', po_service_unavailable: 'Service unavailable',
      // [CONFORMITE 2026] medecin-ordonnance (ex-dico local FR/AR migré + EN)
      mo_pagetitle: 'New medical prescription',
      mo_patient: 'Patient', mo_patient_uuid_label: 'Patient UUID (temporary — picker coming)',
      mo_appt_label: 'Appointment UUID (optional — links the prescription to an appointment)',
      mo_appt_ph: 'leave empty for an off-appointment prescription',
      mo_meds: 'Medications',
      mo_meds_help: 'Enter each medication with its dosage. Maximum 30 medications. Narcotics and psychotropics must be prescribed on the compliant counterfoil book (separate DZ legal framework).',
      mo_add_med: 'Add a medication',
      mo_diag_title: 'Diagnosis and notes', mo_diag_label: 'Diagnosis (optional)',
      mo_diag_ph: 'e.g.: Bacterial tonsillitis, acute right otitis media...',
      mo_notes_label: 'Clinical notes (optional)',
      mo_notes_ph: 'Advice, recommendations, additional instructions...',
      mo_validity_label: 'Validity (days)',
      mo_save: 'Save draft', mo_sign: 'Sign and generate PDF', mo_cancel: 'Cancel',
      mo_signed: 'Prescription signed!', mo_download_pdf: 'Download PDF', mo_verify_link: 'Verification link',
      mo_preview_live: 'Live preview', mo_doctype: 'MEDICAL PRESCRIPTION',
      mo_lab_doctor: 'Doctor', mo_lab_patient: 'Patient', mo_rx_title: 'Prescribed treatment',
      mo_lab_diag: 'Diagnosis', mo_lab_notes: 'Clinical notes',
      mo_num_prefix: 'No.', mo_delete: 'Remove',
      mo_med_name: 'Medication name *', mo_med_dosage: 'Dosage', mo_med_freq: 'Frequency',
      mo_med_duration: 'Duration', mo_med_note: 'Note (optional)',
      mo_med_name_ph: 'e.g.: Doliprane 1000mg', mo_med_dosage_ph: 'e.g.: 1 tablet',
      mo_med_freq_ph: 'e.g.: 3 times a day', mo_med_duration_ph: 'e.g.: 7 days',
      mo_med_note_ph: 'e.g.: take after meals',
      mo_no_meds: 'No medication entered',
      mo_foot_prefix: 'Document generated electronically by Tabibi on',
      mo_doctor_fallback: 'Doctor',
      mo_login_required: 'Login required', mo_doctor_required: 'Doctor access required',
      mo_not_verified: 'Unverified account: prescribing unavailable',
      mo_service_unavailable: 'Service unavailable',
      mo_patient_required: 'Patient required', mo_med_required: 'At least one medication required',
      mo_draft_updated: 'Draft updated', mo_draft_saved: 'Draft saved',
      mo_save_error: 'Error while saving', mo_max_meds: 'Maximum 30 medications',
      mo_confirm_sign: 'After signing, this prescription will be IMMUTABLE.\n\nConfirm electronic signature?',
      mo_signing: 'Signing...', mo_pdf_error: 'PDF generation error',
      mo_number: 'Number', mo_signed_toast: 'Prescription signed and PDF generated',
      mo_sign_error: 'Error while signing',
      specialty: 'Specialty', select_placeholder: '— Select —',
      spec_cardio: 'Cardiologist', spec_dermato: 'Dermatologist', spec_pediatre: 'Pediatrician', spec_gyneco: 'Gynecologist',
      spec_dentiste: 'Dentist', spec_ophtalmo: 'Ophthalmologist', spec_orl: 'ENT',
      order_council_number: 'Medical council No.',
      create_my_account: 'Create my account', already_registered: 'Already registered?',
      consent_cgu: 'I accept Tabibi\'s <a href="legal/cgu.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">Terms of Use</a>.',
      consent_privacy: 'I consent to the processing of my personal data per the <a href="legal/confidentialite.html" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:600">Privacy Policy</a>, in compliance with Algerian law 18-07.',
      consent_health: '<b>Health data consent:</b> I expressly authorize the processing of my sensitive medical data solely for booking appointments (art. 18, law 18-07).',
      consent_marketing: '(Optional) I agree to receive health tips and Tabibi offers by email. Unsubscribe in 1 click.',
      signup_err_empty_response: 'Empty Supabase response. Open the console (F12) then contact support@tabibi.doctor with the screenshot.',
      signup_err_unexpected: 'Unexpected error. Try again or contact support@tabibi.doctor',
      signup_err_profile: "Account created, but saving your profile failed. You can complete it from your account.",
      // [I18N-RES] signup.html — "doctor pending" modal
      welcome_doctor: 'Welcome Dr', signup_recorded: 'Your registration has been recorded.',
      med_pending_verify: 'Our team will verify your credentials (degree + Medical Council) within <strong>48 business hours max</strong>.',
      med_pending_email_1: 'You will receive an email at ', med_pending_email_2: ' as soon as your account is activated.',
      next_step: 'Next step:', med_pending_docs: 'Prepare your documents (degree + Council certificate) to send to <strong>contact@tabibi.doctor</strong>',

      // [I18N-RES 2026-06-23] doctor-claim.html — profile claim (P0 #3)
      claim_my_profile: 'Claim my profile', you_are_doctor: 'Are you a doctor?',
      claim_find_1: 'Find your profile among', claim_find_2: 'practitioners listed in Algeria. Claim it in 2 minutes to manage your appointments, fees and availability.',
      all_wilayas: 'All wilayas', all_specialties: 'All specialties', ph_family_name: 'Your family name…',
      claim_search_prompt: 'Enter your name then select the matching profile.',
      claim_not_found: "Can't find your profile?", claim_write_us: 'Write to us to add it',
      claim_this_profile: 'Claim this profile', claim_you_will_claim: 'You are about to claim the profile of:',
      order_council_number_full: 'Medical Council registration No.', entered_for_tracking: 'Recorded for traceability.',
      claim_docs_later_note: 'Your supporting documents (Medical Council card + ID) will need to be added from your doctor area, right after creating your account.',
      claim_searching: 'Searching…', claim_no_profile: 'No profile available',
      claim_refine_or_write: 'Refine your search or write to us if your profile is missing.',
      claim_zero_found: '0 profiles found', claim_shown_of: 'shown of', claim_refine: 'refine by wilaya/specialty', claim_profiles_found: 'profile(s) found',
      claim_certify: '<strong>I certify on my honor</strong> that I am the doctor of this profile. Any false declaration may lead to the deletion of my account and to legal proceedings (Algerian law 18-07 + art. 226-15 of the Penal Code).',
      ph_subspecialties: 'E.g.: Rhythmology, Echocardiography',
      ph_ordre_number: 'CO-2025-XXXX',
      ph_doctor_bio: 'Cardiologist with 15 years of experience at CHU Mustapha Pacha...',
      ph_cabinet_name: 'Dr. Hadj Office',
      ph_cabinet_name_alt: 'Dr. Benali Office',
      ph_cabinet_address: '12 Didouche Mourad Street, Algiers Center',
      ph_phone_dz: '0661 234 567',
      ph_phone_dz_alt: '0555 123 456',
      ph_phone_dz_example: '+213 555 12 34 56',
      ph_404_search: 'Cardiologist Algiers, dermatologist Oran...',
      ph_search_short: 'Search...',
      ph_name_email_search: 'Name, email...',
      ph_address_full: 'Street, neighborhood, ZIP code...',
      ph_allergies: 'Penicillin, peanuts, lactose...',
      ph_medical_history: 'Hypertension, diabetes, surgeries...',
      ph_current_meds: 'Aspirin 100mg/day, Metformin 500mg...',
      ph_family_history: 'Diabetes (father), cancer (mother)...',
      ph_vaccinations: 'COVID-19 (booster 2024), Tetanus (2022)...',
      ph_chifa_card: 'CHIFA card number',
      ph_mutual_name: 'Mutual insurance name',
      ph_first_name_example: 'Ahmed',
      ph_last_name_example: 'Benali',
      ph_email_pro_example: 'dr.benali@gmail.com',
      ph_review_share: 'Share your experience...',

      // [I18N-REFACTOR-2026-05-19] Extended page titles
      title_home_long: 'Tabibi — Find your doctor online in Algeria | 24/7 Booking',
      title_login_long: 'Login to Tabibi | Patient and doctor space',
      title_signup_long: 'Sign up to Tabibi | Create patient or doctor account',
      title_about_long: 'About | Tabibi — Algerian medical platform',
      title_privacy_long: 'Privacy policy | Tabibi',
      title_cookies_long: 'Cookie policy | Tabibi',
      title_cgu_long: 'Terms and Conditions | Tabibi',
      title_waiting_list_long: 'Tabibi Waiting list — Algeria Health',
      title_doctor_profile_self: 'Doctor profile | Tabibi',
      title_doctor_profile_long: 'Doctor profile | Tabibi — Online booking in Algeria',
      title_doctor_reservation_self: 'Doctor booking | Tabibi',
      title_reservation_ongoing: 'Booking in progress | Tabibi',
      title_admin_reviews: 'Review moderation | Tabibi Admin',
      title_onboarding_long: 'Become a Tabibi doctor — Sign up',

      // [I18N-REFACTOR-2026-05-19] Extended toasts
      toast_email_format_invalid: 'Invalid email format',
      toast_password_invalid: 'Invalid password',
      toast_auth_unavailable: 'Authentication service unavailable. Try again.',
      toast_profile_not_found: 'Profile not found, contact support',
      toast_doctor_pending: 'Your doctor account is being verified (48h max). You will be notified by email.',
      toast_account_suspended: 'Account suspended. Contact contact@tabibi.doctor',
      toast_signup_rejected: 'Sign-up rejected. Contact contact@tabibi.doctor',
      toast_firstname_lastname_required: 'First and last name required',
      toast_cgu_required: 'You must accept the Terms to create an account',
      toast_privacy_required: 'You must consent to the privacy policy',
      toast_spec_ordre_required: 'Specialty and Council number required',
      toast_role_invalid: 'Invalid role',
      toast_email_already_used: 'This email is already used. Sign in.',
      toast_supabase_unavailable: 'Error: Supabase unavailable',
      toast_reason_too_short: 'Reason too short (5 characters min)',
      toast_2fa_module_not_loaded: '2FA module not loaded',
      toast_codes_copied: 'Codes copied',
      toast_2fa_enabled: '2FA enabled ✓',
      toast_2fa_disabled: '2FA disabled',
      toast_profile_saved: 'Profile saved!',
      toast_too_short: 'Too short',
      toast_medical_save_failed: 'Failed to save medical data',
      toast_pii_module_missing: 'PII module not loaded — medical data not saved',
      toast_cancelled_short: 'Cancelled',
      toast_card_number_invalid: 'Invalid number',
      toast_all_read: 'All marked as read',
      toast_reason_required: 'Please enter the reason for consultation',
      toast_rdv_cancelled: 'Appointment cancelled',
      toast_rdv_confirmed: 'Appointment confirmed',
      toast_rdv_refused: 'Appointment refused',
      toast_rdv_completed: 'Appointment completed',
      toast_receipt_downloaded: 'Receipt downloaded',
      toast_fav_removed: 'Removed from favorites',
      toast_fav_added: 'Added to favorites',
      toast_schedule_saved: 'Schedule saved',
      toast_fill_all_fields_short: 'Fill in all fields',

      // [I18N-REFACTOR-2026-05-19] Confirms/Alerts/Prompts
      confirm_logout: 'Do you want to sign out?',
      confirm_logout_short: 'Sign out?',
      confirm_delete_doctor_account: 'Permanently delete your doctor account?',
      confirm_disable_2fa: 'Disabling 2FA reduces your account security. Continue?',
      confirm_suspend_account: 'Temporarily suspend your account?',
      confirm_delete_account_warning: '⚠️ PERMANENTLY delete your account?\nAll your appointments, favorites and medical data will be erased.\nThis action is IRREVERSIBLE.',
      confirm_delete_slot: 'Delete this slot?',
      alert_account_deleted: 'Account deleted',
      alert_account_deleted_bye: 'Account deleted. Goodbye.',
      alert_account_suspended: 'Account suspended — reactivate via support',
      alert_module_measures_soon: 'Measurements module · Coming soon',
      alert_rgpd_request_sent: 'Request sent — response within 30 days (GDPR)',
      alert_active_sessions_demo: 'Active sessions:\n• This device (Mac · Chrome) — current\n• iPhone 15 (Safari) — 2 days ago\n\nSign out of other sessions from admin.',
      alert_change_avatar_demo: 'Choose an image (to be wired with a file input in production)',
      alert_admin_notif_demo: '3 admin alerts · 7 doctors pending · 5 reports',
      alert_export_csv_pending: 'CSV export in progress...',
      alert_backup_created: 'Backup created',
      alert_link_copied: 'Link copied',
      alert_login_required_booking: 'Sign in to book',
      alert_visio_starting: 'Starting video consultation — Beta feature',
      alert_login_required_rating: 'Sign in to rate this doctor',
      alert_password_min_8: 'Password: minimum 8 characters',
      alert_diploma_required: 'Diploma is required',
      alert_ordre_required: 'Council registration number required',
      alert_spec_required: 'Specialty required',
      alert_privacy_consent_required: 'Consent to the privacy policy',
      alert_ethics_required: 'Commit to the code of ethics',
      prompt_diploma_input: 'Diploma (e.g.: Doctorate in Medicine — University of Algiers (2008))',
      prompt_old_password: 'Old password:',
      prompt_new_password: 'New (min 8):',
      prompt_new_password_long: 'New password (min 8 chars.):',
      prompt_confirm_short: 'Confirm:',
      prompt_document_name: 'Document name (e.g.: Prescription.pdf):',
      prompt_document_type: 'Type (prescription / result / certificate / receipt):',
      prompt_card_number: 'Card number (16 digits):',
      alert_download_prefix: 'Downloading ',
      confirm_delete_document: 'Delete this document?',
      alert_support_24h: 'Support: contact@tabibi.doctor — reply within 24h',
      toast_error_prefix: 'Error: ',
      toast_validation_failed: 'validation failed',
      toast_rejection_failed: 'rejection failed',
      alert_doctor_only: 'Doctor-only access. Please sign in.',
      alert_cookies_all_accepted: '✅ All preferences accepted',
      alert_cookies_essentials_only: '✅ Non-essential cookies refused',
      alert_cookies_preferences_saved: '✅ Preferences saved',
      alert_select_reason: 'Select a reason',
      label_patient_colon: 'Patient: ',
      label_reason_colon: 'Reason: ',
      label_duration_colon: 'Duration: ',
      label_min_unit: 'min',
      label_patient_file_colon: 'Patient file: ',
      label_consultations: 'consultation(s)',
      label_last_colon: 'Last: '
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // DICTIONNAIRE AUTO-TRANSLATION (texte FR → AR/EN)
  // Tout texte FR trouvé dans la page sera traduit s'il est dans cette map.
  // ═══════════════════════════════════════════════════════════════════
  const AUTO = {
    // ─── Sections / Titres généraux ───
    'Mon espace': { ar: 'مساحتي', en: 'My space' },
    'Espace médecin': { ar: 'مساحة الطبيب', en: 'Doctor space' },
    'Tableau de bord': { ar: 'لوحة التحكم', en: 'Dashboard' },
    'Mon compte': { ar: 'حسابي', en: 'My account' },
    'Mon profil': { ar: 'ملفي الشخصي', en: 'My profile' },
    'Profil': { ar: 'الملف الشخصي', en: 'Profile' },
    'Paramètres': { ar: 'الإعدادات', en: 'Settings' },
    'Notifications': { ar: 'الإشعارات', en: 'Notifications' },
    'Documents': { ar: 'الوثائق', en: 'Documents' },
    'Favoris': { ar: 'المفضلة', en: 'Favorites' },
    'Patients': { ar: 'المرضى', en: 'Patients' },
    'Agenda': { ar: 'الأجندة', en: 'Agenda' },
    'Statistiques': { ar: 'الإحصائيات', en: 'Statistics' },
    'Messagerie': { ar: 'الرسائل', en: 'Messaging' },
    'Aujourd\'hui': { ar: 'اليوم', en: 'Today' },
    'Demain': { ar: 'غدًا', en: 'Tomorrow' },
    'Hier': { ar: 'أمس', en: 'Yesterday' },
    'Cette semaine': { ar: 'هذا الأسبوع', en: 'This week' },
    'Ce mois': { ar: 'هذا الشهر', en: 'This month' },

    // ─── Actions / Boutons ───
    'Se connecter': { ar: 'تسجيل الدخول', en: 'Sign in' },
    'S\'inscrire': { ar: 'إنشاء حساب', en: 'Sign up' },
    'Se déconnecter': { ar: 'تسجيل الخروج', en: 'Sign out' },
    'Déconnexion': { ar: 'تسجيل الخروج', en: 'Sign out' },
    'Inscription': { ar: 'التسجيل', en: 'Sign up' },
    'Connexion': { ar: 'تسجيل الدخول', en: 'Login' },
    'Réserver': { ar: 'حجز', en: 'Book' },
    'Réserver maintenant': { ar: 'احجز الآن', en: 'Book now' },
    'Annuler': { ar: 'إلغاء', en: 'Cancel' },
    'Confirmer': { ar: 'تأكيد', en: 'Confirm' },
    'Valider': { ar: 'تأكيد', en: 'Validate' },
    'Enregistrer': { ar: 'حفظ', en: 'Save' },
    'Sauvegarder': { ar: 'حفظ', en: 'Save' },
    'Modifier': { ar: 'تعديل', en: 'Edit' },
    'Supprimer': { ar: 'حذف', en: 'Delete' },
    'Rechercher': { ar: 'بحث', en: 'Search' },
    'Fermer': { ar: 'إغلاق', en: 'Close' },
    'Retour': { ar: 'رجوع', en: 'Back' },
    'Continuer': { ar: 'متابعة', en: 'Continue' },
    'Suivant': { ar: 'التالي', en: 'Next' },
    'Précédent': { ar: 'السابق', en: 'Previous' },
    'Envoyer': { ar: 'إرسال', en: 'Send' },
    'Voir tout': { ar: 'عرض الكل', en: 'See all' },
    'Voir plus': { ar: 'عرض المزيد', en: 'See more' },
    'Voir détails': { ar: 'عرض التفاصيل', en: 'See details' },
    'Télécharger': { ar: 'تحميل', en: 'Download' },
    'Partager': { ar: 'مشاركة', en: 'Share' },
    'Copier': { ar: 'نسخ', en: 'Copy' },
    'Imprimer': { ar: 'طباعة', en: 'Print' },
    'Exporter': { ar: 'تصدير', en: 'Export' },

    // ─── Champs formulaire ───
    'Email': { ar: 'البريد الإلكتروني', en: 'Email' },
    'Mot de passe': { ar: 'كلمة المرور', en: 'Password' },
    'Confirmer mot de passe': { ar: 'تأكيد كلمة المرور', en: 'Confirm password' },
    'Mot de passe oublié ?': { ar: 'نسيت كلمة المرور؟', en: 'Forgot password?' },
    'Prénom': { ar: 'الاسم', en: 'First name' },
    'Nom': { ar: 'اللقب', en: 'Last name' },
    'Nom complet': { ar: 'الاسم الكامل', en: 'Full name' },
    'Téléphone': { ar: 'الهاتف', en: 'Phone' },
    'Adresse': { ar: 'العنوان', en: 'Address' },
    'Ville': { ar: 'المدينة', en: 'City' },
    'Wilaya': { ar: 'الولاية', en: 'Wilaya' },
    'Date de naissance': { ar: 'تاريخ الميلاد', en: 'Date of birth' },
    'Sexe': { ar: 'الجنس', en: 'Gender' },
    'Homme': { ar: 'ذكر', en: 'Male' },
    'Femme': { ar: 'أنثى', en: 'Female' },
    'Profession': { ar: 'المهنة', en: 'Profession' },
    'Spécialité': { ar: 'التخصص', en: 'Specialty' },
    'Description': { ar: 'الوصف', en: 'Description' },
    'Présentation': { ar: 'النبذة', en: 'Bio' },
    'Expérience': { ar: 'الخبرة', en: 'Experience' },
    'Langues': { ar: 'اللغات', en: 'Languages' },
    'Diplômes': { ar: 'الشهادات', en: 'Diplomas' },
    'N° Ordre': { ar: 'رقم القيد', en: 'License N°' },
    'Tarif': { ar: 'السعر', en: 'Price' },
    'Tarif consultation': { ar: 'سعر الاستشارة', en: 'Consultation fee' },
    'Horaires': { ar: 'المواعيد', en: 'Schedule' },
    'Assurance': { ar: 'التأمين', en: 'Insurance' },

    // ─── États / Messages ───
    'Bienvenue': { ar: 'مرحبًا', en: 'Welcome' },
    'Bonjour': { ar: 'مرحبًا', en: 'Hello' },
    'Bonsoir': { ar: 'مساء الخير', en: 'Good evening' },
    'Chargement...': { ar: 'جارٍ التحميل...', en: 'Loading...' },
    'Chargement': { ar: 'جارٍ التحميل', en: 'Loading' },
    'Aucun résultat': { ar: 'لا توجد نتائج', en: 'No results' },
    'Aucun rendez-vous': { ar: 'لا توجد مواعيد', en: 'No appointments' },
    'Aucun document': { ar: 'لا توجد وثائق', en: 'No documents' },
    'Aucun favori': { ar: 'لا توجد مفضلة', en: 'No favorites' },
    'Aucun médecin trouvé': { ar: 'لم يتم العثور على أطباء', en: 'No doctors found' },
    'Aucune notification': { ar: 'لا توجد إشعارات', en: 'No notifications' },
    'Aucun patient': { ar: 'لا يوجد مرضى', en: 'No patients' },
    'Actif': { ar: 'نشط', en: 'Active' },
    'Inactif': { ar: 'غير نشط', en: 'Inactive' },
    'En attente': { ar: 'في الانتظار', en: 'Pending' },
    'Confirmé': { ar: 'مؤكد', en: 'Confirmed' },
    'Annulé': { ar: 'ملغى', en: 'Cancelled' },
    'Terminé': { ar: 'منتهي', en: 'Completed' },
    'Validé': { ar: 'تم التحقق', en: 'Validated' },
    'Rejeté': { ar: 'مرفوض', en: 'Rejected' },
    'Vérifié': { ar: 'موثق', en: 'Verified' },
    'Certifié': { ar: 'معتمد', en: 'Certified' },

    // ─── Rendez-vous ───
    'Rendez-vous': { ar: 'موعد', en: 'Appointment' },
    'Mes rendez-vous': { ar: 'مواعيدي', en: 'My appointments' },
    'Mes RDV': { ar: 'مواعيدي', en: 'My appointments' },
    'RDV à venir': { ar: 'المواعيد القادمة', en: 'Upcoming appointments' },
    'RDV passés': { ar: 'المواعيد السابقة', en: 'Past appointments' },
    'Détails du rendez-vous': { ar: 'تفاصيل الموعد', en: 'Appointment details' },
    'Prendre RDV': { ar: 'حجز موعد', en: 'Book appointment' },
    'Annuler le RDV': { ar: 'إلغاء الموعد', en: 'Cancel appointment' },
    'Confirmer le RDV': { ar: 'تأكيد الموعد', en: 'Confirm appointment' },
    'Réservation confirmée !': { ar: 'تم تأكيد الحجز!', en: 'Booking confirmed!' },
    'Récapitulatif': { ar: 'ملخص', en: 'Summary' },
    'Motif': { ar: 'السبب', en: 'Reason' },
    'Motif de consultation': { ar: 'سبب الاستشارة', en: 'Reason for visit' },
    'Date': { ar: 'التاريخ', en: 'Date' },
    'Heure': { ar: 'الوقت', en: 'Time' },
    'Lieu': { ar: 'المكان', en: 'Location' },
    'Cabinet': { ar: 'العيادة', en: 'Office' },

    // ─── Consultations ───
    'Consultation': { ar: 'استشارة', en: 'Consultation' },
    'Première consultation': { ar: 'استشارة أولى', en: 'First consultation' },
    'Consultation de suivi': { ar: 'استشارة متابعة', en: 'Follow-up' },
    'Contrôle de résultats': { ar: 'مراجعة النتائج', en: 'Results review' },
    'Urgence': { ar: 'طارئ', en: 'Emergency' },
    'Téléconsultation': { ar: 'استشارة عن بُعد', en: 'Telehealth' },

    // ─── Paiement ───
    'Paiement': { ar: 'الدفع', en: 'Payment' },
    'Mode de paiement': { ar: 'طريقة الدفع', en: 'Payment method' },
    'Mode paiement': { ar: 'طريقة الدفع', en: 'Payment method' },
    'Montant': { ar: 'المبلغ', en: 'Amount' },
    'Prix': { ar: 'السعر', en: 'Price' },
    'Total': { ar: 'الإجمالي', en: 'Total' },
    'Espèces': { ar: 'نقدًا', en: 'Cash' },
    'Carte bancaire': { ar: 'بطاقة بنكية', en: 'Bank card' },
    'En cabinet': { ar: 'في العيادة', en: 'At office' },
    'Reçus': { ar: 'الإيصالات', en: 'Receipts' },
    'Reçu': { ar: 'إيصال', en: 'Receipt' },
    'Facture': { ar: 'فاتورة', en: 'Invoice' },

    // ─── [Phase 14.2] Onboarding médecin (medecin-profile.html ?onboarding=1) ───
    'Bienvenue sur Tabibi !': { ar: 'مرحبا بك في طبيبي!', en: 'Welcome to Tabibi!' },
    'Complétez votre fiche en 3 minutes pour la rendre visible aux patients. Champs obligatoires : photo, tarif consultation et horaires.': { ar: 'أكمل ملفك في 3 دقائق لجعله مرئيا للمرضى. الحقول المطلوبة: صورة، رسوم الاستشارة، ومواعيد العمل.', en: 'Complete your listing in 3 minutes to make it visible to patients. Required: photo, consultation fee, working hours.' },
    'Sauvegarder et publier ma fiche': { ar: 'احفظ وانشر ملفي', en: 'Save and publish my listing' },

    // ─── Médecin / Spécialités ───
    'Médecin': { ar: 'طبيب', en: 'Doctor' },
    'Médecine Gén.': { ar: 'طب عام', en: 'General Med.' },
    'Médecine générale': { ar: 'الطب العام', en: 'General medicine' },
    'Généraliste': { ar: 'طب عام', en: 'Generalist' },
    'Cardiologie': { ar: 'أمراض القلب', en: 'Cardiology' },
    'Pédiatrie': { ar: 'طب الأطفال', en: 'Pediatrics' },
    'Dentiste': { ar: 'طب الأسنان', en: 'Dentist' },
    'Gynécologie': { ar: 'أمراض النساء', en: 'Gynecology' },
    'Dermatologie': { ar: 'الأمراض الجلدية', en: 'Dermatology' },
    'Ophtalmologie': { ar: 'طب العيون', en: 'Ophthalmology' },
    'ORL': { ar: 'أنف وأذن وحنجرة', en: 'ENT' },
    'Psychiatrie': { ar: 'الطب النفسي', en: 'Psychiatry' },
    'Neurologie': { ar: 'طب الأعصاب', en: 'Neurology' },
    'Radiologie': { ar: 'الأشعة', en: 'Radiology' },
    'Chirurgie': { ar: 'الجراحة', en: 'Surgery' },
    'Orthopédie': { ar: 'طب العظام', en: 'Orthopedics' },
    'Urologie': { ar: 'المسالك البولية', en: 'Urology' },
    'Pneumologie': { ar: 'طب الرئة', en: 'Pulmonology' },
    'Rhumatologie': { ar: 'طب الروماتيزم', en: 'Rheumatology' },
    'Endocrinologie': { ar: 'الغدد الصماء', en: 'Endocrinology' },
    'Gastro-entérologie': { ar: 'أمراض الجهاز الهضمي', en: 'Gastroenterology' },
    'Néphrologie': { ar: 'طب الكلى', en: 'Nephrology' },
    'Kiné': { ar: 'العلاج الطبيعي', en: 'Physio' },
    'Kinésithérapie': { ar: 'العلاج الطبيعي', en: 'Physiotherapy' },

    // ─── Documents médicaux ───
    'Ordonnances': { ar: 'الوصفات الطبية', en: 'Prescriptions' },
    'Ordonnance': { ar: 'وصفة طبية', en: 'Prescription' },
    'Certificats': { ar: 'الشهادات', en: 'Certificates' },
    'Certificat': { ar: 'شهادة', en: 'Certificate' },
    'Résultats': { ar: 'النتائج', en: 'Results' },
    'Compte-rendu': { ar: 'تقرير', en: 'Report' },
    'Analyses': { ar: 'التحاليل', en: 'Tests' },
    'Radiologie médicale': { ar: 'الأشعة الطبية', en: 'Medical imaging' },

    // ─── Patient / Pour qui ───
    'Patient': { ar: 'مريض', en: 'Patient' },
    'Moi-même': { ar: 'لنفسي', en: 'Myself' },
    'Un proche': { ar: 'قريب', en: 'A relative' },
    'Mon enfant': { ar: 'طفلي', en: 'My child' },
    'Mes patients': { ar: 'مرضاي', en: 'My patients' },

    // ─── Validation médecin (admin) ───
    'Valider le médecin': { ar: 'التحقق من الطبيب', en: 'Validate doctor' },
    'Rejeter le médecin': { ar: 'رفض الطبيب', en: 'Reject doctor' },
    'En attente de validation': { ar: 'في انتظار التحقق', en: 'Pending verification' },
    'Médecin validé': { ar: 'طبيب موثق', en: 'Validated doctor' },
    'Médecin rejeté': { ar: 'طبيب مرفوض', en: 'Rejected doctor' },

    // ─── Profil édition ───
    'Modifier mon profil': { ar: 'تعديل ملفي', en: 'Edit my profile' },
    'Modifier le profil': { ar: 'تعديل الملف', en: 'Edit profile' },
    'Changer la photo': { ar: 'تغيير الصورة', en: 'Change photo' },
    'Ajouter une photo': { ar: 'إضافة صورة', en: 'Add photo' },
    'Mes disponibilités': { ar: 'أوقات توفري', en: 'My availability' },
    'Mes diplômes': { ar: 'شهاداتي', en: 'My diplomas' },

    // ─── Avis ───
    'Avis': { ar: 'التقييمات', en: 'Reviews' },
    'Avis des patients': { ar: 'تقييمات المرضى', en: 'Patient reviews' },
    'Note moyenne': { ar: 'متوسط التقييم', en: 'Average rating' },
    'Note moy.': { ar: 'متوسط التقييم', en: 'Avg. rating' },
    'Excellent': { ar: 'ممتاز', en: 'Excellent' },
    'Très bon': { ar: 'جيد جدًا', en: 'Very good' },
    'Bon': { ar: 'جيد', en: 'Good' },
    'Moyen': { ar: 'متوسط', en: 'Average' },

    // ─── Salutations dynamiques ───
    'Bonjour, Dr.': { ar: 'مرحبًا د.', en: 'Hello, Dr.' },
    'Bon après-midi, Dr.': { ar: 'مساء الخير د.', en: 'Good afternoon, Dr.' },
    'Bonsoir, Dr.': { ar: 'مساء الخير د.', en: 'Good evening, Dr.' },

    // ─── Onboarding ───
    'Devenir médecin partenaire': { ar: 'كن طبيبًا شريكًا', en: 'Become partner doctor' },
    'Étape': { ar: 'الخطوة', en: 'Step' },
    'sur': { ar: 'من', en: 'of' },

    // ─── Erreurs / Confirmations ───
    'Erreur': { ar: 'خطأ', en: 'Error' },
    'Succès': { ar: 'نجاح', en: 'Success' },
    'Attention': { ar: 'تنبيه', en: 'Warning' },
    'Information': { ar: 'معلومة', en: 'Info' },
    'Champ requis': { ar: 'حقل مطلوب', en: 'Required field' },
    'Email invalide': { ar: 'بريد إلكتروني غير صالح', en: 'Invalid email' },

    // ─── Misc UI ───
    'Bientôt': { ar: 'قريبًا', en: 'Soon' },
    'Bientôt disponible': { ar: 'متاح قريبًا', en: 'Coming soon' },
    'Nouveau': { ar: 'جديد', en: 'New' },
    'Populaire': { ar: 'شائع', en: 'Popular' },
    'Recommandé': { ar: 'موصى به', en: 'Recommended' },
    'Filtre': { ar: 'تصفية', en: 'Filter' },
    'Filtres': { ar: 'التصفية', en: 'Filters' },
    'Trier': { ar: 'فرز', en: 'Sort' },
    'Trier par': { ar: 'فرز حسب', en: 'Sort by' },

    // ─── Footer / Liens ───
    'CGU': { ar: 'الشروط', en: 'Terms' },
    'Confidentialité': { ar: 'الخصوصية', en: 'Privacy' },
    'Cookies': { ar: 'ملفات تعريف الارتباط', en: 'Cookies' },
    'Mentions légales': { ar: 'إشعار قانوني', en: 'Legal notice' },
    'À propos': { ar: 'حول', en: 'About' },
    'Carrières': { ar: 'المهن', en: 'Careers' },
    'Presse': { ar: 'الصحافة', en: 'Press' },
    'Contact': { ar: 'اتصل بنا', en: 'Contact' },
    'Aide': { ar: 'المساعدة', en: 'Help' },
    'FAQ': { ar: 'الأسئلة الشائعة', en: 'FAQ' },

    // ─── Patient dashboard spécifique ───
    'Tout marquer lu': { ar: 'تحديد الكل كمقروء', en: 'Mark all read' },
    'Trouvez votre médecin': { ar: 'ابحث عن طبيبك', en: 'Find your doctor' },
    'Toutes': { ar: 'الكل', en: 'All' },
    'Tous': { ar: 'الكل', en: 'All' },
    'Total dépensé': { ar: 'إجمالي المصاريف', en: 'Total spent' },
    'Type de consultation': { ar: 'نوع الاستشارة', en: 'Visit type' },
    'Total à payer': { ar: 'الإجمالي المستحق', en: 'Total to pay' },
    'Cliquez sur': { ar: 'انقر على', en: 'Click on' },
    'Cliquez ici': { ar: 'انقر هنا', en: 'Click here' },

    // ─── Doctor dashboard spécifique ───
    'RDV ce mois': { ar: 'مواعيد هذا الشهر', en: 'Appointments this month' },
    'Revenus': { ar: 'الإيرادات', en: 'Revenue' },
    'En attente de validation': { ar: 'في انتظار التحقق', en: 'Awaiting validation' },
    'Profil non publié': { ar: 'ملف غير منشور', en: 'Profile not published' },
    'Compléter mon profil': { ar: 'إكمال ملفي', en: 'Complete my profile' },
    'Mes statistiques': { ar: 'إحصائياتي', en: 'My statistics' },
    'Voir mon profil public': { ar: 'عرض ملفي العام', en: 'View my public profile' },
    'Patients vus': { ar: 'المرضى المعالجون', en: 'Patients seen' },
    'Note moyenne': { ar: 'متوسط التقييم', en: 'Average rating' },
    'Pas de RDV aujourd\'hui': { ar: 'لا توجد مواعيد اليوم', en: 'No appointments today' },

    // ─── Inscription multi-étapes ───
    'Créer mon compte': { ar: 'إنشاء حسابي', en: 'Create my account' },
    'Vous êtes': { ar: 'أنت', en: 'You are' },
    'Vérification de l\'email': { ar: 'التحقق من البريد', en: 'Email verification' },
    'Confirmer l\'inscription': { ar: 'تأكيد التسجيل', en: 'Confirm registration' },
    'Choisir mon mot de passe': { ar: 'اختر كلمة المرور', en: 'Choose password' },
    'Au moins 8 caractères': { ar: '8 أحرف على الأقل', en: 'At least 8 characters' },

    // ─── Liste docs / favoris ───
    'Mes ordonnances': { ar: 'وصفاتي', en: 'My prescriptions' },
    'Mes documents': { ar: 'وثائقي', en: 'My documents' },
    'Mes favoris': { ar: 'مفضلتي', en: 'My favorites' },
    'Ajouter aux favoris': { ar: 'إضافة للمفضلة', en: 'Add to favorites' },
    'Retirer des favoris': { ar: 'إزالة من المفضلة', en: 'Remove from favorites' },

    // ─── Login / Signup ───
    'Accédez à votre espace': { ar: 'الوصول إلى مساحتك', en: 'Access your space' },
    'Créer un compte': { ar: 'إنشاء حساب', en: 'Create an account' },
    'Créez votre compte': { ar: 'أنشئ حسابك', en: 'Create your account' },
    'J\'accepte les': { ar: 'أوافق على', en: 'I accept the' },
    'Politique de confidentialité': { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
    'La santé à portée de clic': { ar: 'الصحة على بُعد نقرة', en: 'Healthcare one click away' },
    'Tabibi': { ar: 'طبيبي', en: 'Tabibi' },
    'Compte professionnel': { ar: 'حساب احترافي', en: 'Professional account' },

    // ─── Admin dashboard ───
    'Administration': { ar: 'الإدارة', en: 'Administration' },
    'Validation médecins': { ar: 'التحقق من الأطباء', en: 'Doctor validations' },
    'Médecins': { ar: 'الأطباء', en: 'Doctors' },
    'Profil médecin': { ar: 'ملف الطبيب', en: 'Doctor profile' },

    // ─── Doctor dashboard suite ───
    'Vue d\'ensemble': { ar: 'نظرة عامة', en: 'Overview' },
    'Confirmés': { ar: 'المؤكدة', en: 'Confirmed' },
    'Terminés': { ar: 'المنتهية', en: 'Completed' },
    'Annulation par patient': { ar: 'إلغاء من المريض', en: 'Cancelled by patient' },
    'Rappel': { ar: 'تذكير', en: 'Reminder' },
    'Revenus mois': { ar: 'إيرادات الشهر', en: 'Monthly revenue' },
    'Patient ajouté à votre agenda': { ar: 'تمت إضافة مريض إلى أجندتك', en: 'Patient added to your agenda' },

    // ─── Profil médecin (édition complet) ───
    'Informations personnelles': { ar: 'المعلومات الشخصية', en: 'Personal information' },
    'Informations professionnelles': { ar: 'المعلومات المهنية', en: 'Professional information' },
    'Identité civile': { ar: 'الهوية المدنية', en: 'Civil identity' },
    'Identifiant médical': { ar: 'المعرف الطبي', en: 'Medical ID' },
    'Date naissance': { ar: 'تاريخ الميلاد', en: 'Date of birth' },
    'Adresse complète': { ar: 'العنوان الكامل', en: 'Full address' },
    'Adresse visible aux patients': { ar: 'العنوان المرئي للمرضى', en: 'Address visible to patients' },
    'Code postal': { ar: 'الرمز البريدي', en: 'Postal code' },
    'Téléphone cabinet': { ar: 'هاتف العيادة', en: 'Office phone' },
    'Téléphone perso': { ar: 'الهاتف الشخصي', en: 'Personal phone' },
    'Email professionnel': { ar: 'البريد المهني', en: 'Professional email' },
    'Spécialité principale': { ar: 'التخصص الرئيسي', en: 'Main specialty' },
    'Langues parlées': { ar: 'اللغات المتحدث بها', en: 'Spoken languages' },
    'Parcours académique': { ar: 'المسار الأكاديمي', en: 'Academic background' },
    'Année de début d\'exercice': { ar: 'سنة بداية الممارسة', en: 'Year of practice start' },
    'Conventionnement': { ar: 'الاتفاقية', en: 'Convention' },
    'Visible aux patients': { ar: 'مرئي للمرضى', en: 'Visible to patients' },
    'Visible aux patients pour le filtre': { ar: 'مرئي للمرضى للتصفية', en: 'Visible to patients for filter' },

    // ─── Créneaux / Disponibilités ───
    'Ajouter des créneaux': { ar: 'إضافة فترات', en: 'Add time slots' },
    'Gérer vos créneaux': { ar: 'إدارة فتراتك', en: 'Manage your slots' },
    'Horaires d\'ouverture par défaut': { ar: 'ساعات العمل الافتراضية', en: 'Default opening hours' },
    'Modèle pour générer vos créneaux': { ar: 'نموذج لإنشاء فتراتك', en: 'Template to generate slots' },
    'Heure début': { ar: 'وقت البداية', en: 'Start time' },
    'Heure fin': { ar: 'وقت النهاية', en: 'End time' },
    'Durée d\'une consultation': { ar: 'مدة الاستشارة', en: 'Consultation duration' },
    'Aucun créneau pour ce jour': { ar: 'لا توجد فترات لهذا اليوم', en: 'No slots for this day' },
    'Journée complète': { ar: 'يوم كامل', en: 'Full day' },
    'Récurrence': { ar: 'التكرار', en: 'Recurrence' },
    'Une seule fois': { ar: 'مرة واحدة', en: 'One time' },

    // ─── Jours de la semaine ───
    'Lundi': { ar: 'الإثنين', en: 'Monday' },
    'Mardi': { ar: 'الثلاثاء', en: 'Tuesday' },
    'Mercredi': { ar: 'الأربعاء', en: 'Wednesday' },
    'Jeudi': { ar: 'الخميس', en: 'Thursday' },
    'Vendredi': { ar: 'الجمعة', en: 'Friday' },
    'Samedi': { ar: 'السبت', en: 'Saturday' },
    'Dimanche': { ar: 'الأحد', en: 'Sunday' },

    // ─── Services additionnels ───
    'Téléconsultation disponible': { ar: 'استشارة عن بُعد متاحة', en: 'Telehealth available' },
    'Disponible pour les urgences': { ar: 'متاح للطوارئ', en: 'Available for emergencies' },
    'Visites à domicile': { ar: 'زيارات منزلية', en: 'Home visits' },
    'Pour patients non-mobiles': { ar: 'للمرضى غير القادرين على التنقل', en: 'For non-mobile patients' },

    // ─── Notifications préférences ───
    'Notes supplémentaires': { ar: 'ملاحظات إضافية', en: 'Additional notes' },
    'Notif après chaque paiement': { ar: 'إشعار بعد كل دفعة', en: 'Notify after each payment' },
    'Rappel paiement reçu': { ar: 'تذكير الدفعة المستلمة', en: 'Payment received reminder' },
    'Email immédiat': { ar: 'بريد فوري', en: 'Immediate email' },
    'Newsletter mensuelle': { ar: 'النشرة الشهرية', en: 'Monthly newsletter' },
    'Récapitulatif quotidien': { ar: 'الملخص اليومي', en: 'Daily summary' },
    'Alertes professionnelles': { ar: 'تنبيهات مهنية', en: 'Professional alerts' },

    // ─── Sécurité / Compte ───
    'Sécurité du compte': { ar: 'أمان الحساب', en: 'Account security' },
    'Verrouillage automatique': { ar: 'القفل التلقائي', en: 'Auto-lock' },
    'Protection professionnelle': { ar: 'الحماية المهنية', en: 'Professional protection' },
    'Désactivation du compte': { ar: 'تعطيل الحساب', en: 'Account deactivation' },
    'Zone de danger': { ar: 'منطقة الخطر', en: 'Danger zone' },
    'Plan actuel': { ar: 'الخطة الحالية', en: 'Current plan' },
    'Renouvellement automatique le': { ar: 'التجديد التلقائي في', en: 'Auto-renewal on' },

    // ─── Paiement modes ───
    'Edahabia': { ar: 'الذهبية', en: 'Edahabia' },
    'Paymee': { ar: 'Paymee', en: 'Paymee' },
    'Contrôle résultats': { ar: 'مراجعة النتائج', en: 'Results review' },

    // ─── Spécialités (forme féminine/masculine) ───
    'Cardiologue': { ar: 'طبيب قلب', en: 'Cardiologist' },
    'Pédiatre': { ar: 'طبيب أطفال', en: 'Pediatrician' },
    'Dentisterie': { ar: 'طب الأسنان', en: 'Dentistry' },
    'Dermatologue': { ar: 'طبيب جلدية', en: 'Dermatologist' },
    'Gynécologue': { ar: 'طبيب نساء', en: 'Gynecologist' },
    'Ophtalmologue': { ar: 'طبيب عيون', en: 'Ophthalmologist' },

    // ─── [PILOTE i18n 2026] patient-dashboard — textes libres (statiques + injectés JS) ───
    'Prochain RDV': { ar: 'الموعد القادم', en: 'Next appointment' },
    'Aller au contenu': { ar: 'انتقل إلى المحتوى', en: 'Skip to content' },
    'Trouver un médecin': { ar: 'ابحث عن طبيب', en: 'Find a doctor' },
    'Aucun RDV à venir pour le moment.': { ar: 'لا مواعيد قادمة حاليًا.', en: 'No upcoming appointments for now.' },
    'Aucun rendez-vous': { ar: 'لا مواعيد', en: 'No appointments' },
    'Réservez votre premier RDV maintenant': { ar: 'احجز موعدك الأول الآن', en: 'Book your first appointment now' },

    // ─── [CONFORMITE 2026] teleconsultation — messages d'état injectés en JS ───
    'Connexion en cours...': { ar: 'جارٍ الاتصال...', en: 'Connecting...' },
    "Impossible d'enregistrer votre choix.": { ar: 'تعذّر حفظ اختيارك.', en: 'Unable to save your choice.' },
    'Vous pouvez rejoindre la consultation.': { ar: 'يمكنك الانضمام إلى الاستشارة.', en: 'You can join the consultation.' },
    'Cette consultation est terminee.': { ar: 'انتهت هذه الاستشارة.', en: 'This consultation has ended.' },
    'Cette consultation est annulee.': { ar: 'أُلغيت هذه الاستشارة.', en: 'This consultation was cancelled.' },
    'Erreur de connexion video.': { ar: 'خطأ في الاتصال المرئي.', en: 'Video connection error.' },
    'Erreur de connexion.': { ar: 'خطأ في الاتصال.', en: 'Connection error.' },
    'SDK Daily.co indisponible. Verifiez votre connexion.': { ar: 'خدمة الفيديو غير متاحة. تحقّق من اتصالك.', en: 'Video SDK unavailable. Check your connection.' },
    'Trop de tentatives. Reessayez dans 2 minutes.': { ar: 'محاولات كثيرة جدًا. أعد المحاولة بعد دقيقتين.', en: 'Too many attempts. Try again in 2 minutes.' },
    "Ce rendez-vous n'est pas confirme. Contactez le medecin.": { ar: 'هذا الموعد غير مؤكَّد. تواصل مع الطبيب.', en: 'This appointment is not confirmed. Contact the doctor.' },
    "Vous n'etes pas autorise a rejoindre cette consultation.": { ar: 'غير مصرَّح لك بالانضمام إلى هذه الاستشارة.', en: 'You are not allowed to join this consultation.' },
    "Lien invalide. Verifiez l'URL ou retournez a votre tableau de bord.": { ar: 'رابط غير صالح. تحقّق من الرابط أو عُد إلى لوحة التحكّم.', en: 'Invalid link. Check the URL or return to your dashboard.' },
    'Impossible de charger la consultation.': { ar: 'تعذّر تحميل الاستشارة.', en: 'Unable to load the consultation.' },
    'Erreur inconnue': { ar: 'خطأ غير معروف', en: 'Unknown error' },
    'Medecin': { ar: 'طبيب', en: 'Doctor' },
    'Patient': { ar: 'مريض', en: 'Patient' },
    'Téléconsultation bientôt disponible': { ar: 'الاستشارة عن بُعد متاحة قريبًا', en: 'Teleconsultation coming soon' },
    'Cette fonctionnalité sera activée prochainement, après validation du flux vidéo avec nos médecins partenaires. En attendant, vous pouvez prendre un rendez-vous en cabinet.': { ar: 'سيتم تفعيل هذه الميزة قريبًا، بعد التحقّق من تدفّق الفيديو مع أطبائنا الشركاء. في الانتظار، يمكنك حجز موعد في العيادة.', en: 'This feature will be activated soon, after validating the video flow with our partner doctors. In the meantime, you can book an in-office appointment.' },

    // ─── [GABARIT AUTH 2026] spécialités DB (specialty_fr) — dropdowns doctor-claim/annuaire ───
    'Allergologue': { ar: 'طبيب حساسية', en: 'Allergist' },
    'Anesthésiste-réanimateur': { ar: 'طبيب تخدير وإنعاش', en: 'Anesthesiologist' },
    'Autre': { ar: 'أخرى', en: 'Other' },
    'Centre de santé': { ar: 'مركز صحي', en: 'Health center' },
    'Chirurgien général': { ar: 'جرّاح عام', en: 'General surgeon' },
    'Clinique privée': { ar: 'عيادة خاصة', en: 'Private clinic' },
    'Endocrinologue': { ar: 'طبيب غدد صماء', en: 'Endocrinologist' },
    'Gastro-entérologue': { ar: 'طبيب جهاز هضمي', en: 'Gastroenterologist' },
    'Hématologue': { ar: 'طبيب أمراض دم', en: 'Hematologist' },
    'Hôpital': { ar: 'مستشفى', en: 'Hospital' },
    'Kinésithérapeute': { ar: 'أخصائي علاج طبيعي', en: 'Physiotherapist' },
    "Laboratoire d'analyses": { ar: 'مخبر تحاليل', en: 'Medical laboratory' },
    'Médecin généraliste': { ar: 'طبيب عام', en: 'General practitioner' },
    'Néphrologue': { ar: 'طبيب كلى', en: 'Nephrologist' },
    'Neurologue': { ar: 'طبيب أعصاب', en: 'Neurologist' },
    'Nutritionniste': { ar: 'أخصائي تغذية', en: 'Nutritionist' },
    'Oncologue': { ar: 'طبيب أورام', en: 'Oncologist' },
    'Opticien': { ar: 'نظاراتي', en: 'Optician' },
    'Orthodontiste': { ar: 'طبيب تقويم أسنان', en: 'Orthodontist' },
    'Orthopédiste': { ar: 'طبيب عظام', en: 'Orthopedist' },
    'Orthophoniste': { ar: 'أخصائي تقويم النطق', en: 'Speech therapist' },
    'Pharmacie': { ar: 'صيدلية', en: 'Pharmacy' },
    'Pneumologue': { ar: 'طبيب أمراض صدرية', en: 'Pulmonologist' },
    'Psychiatre': { ar: 'طبيب نفسي', en: 'Psychiatrist' },
    'Radiologue': { ar: 'طبيب أشعة', en: 'Radiologist' },
    'Rhumatologue': { ar: 'طبيب روماتيزم', en: 'Rheumatologist' },
    'Sage-femme': { ar: 'قابلة', en: 'Midwife' },
    'Urologue': { ar: 'طبيب مسالك بولية', en: 'Urologist' },

    // ─── [GABARIT AUTH 2026] forgot/reset-password + doctor-claim — textes libres JS ───
    'Email invalide.': { ar: 'بريد إلكتروني غير صالح.', en: 'Invalid email.' },
    'Client non initialise. Rechargez la page.': { ar: 'لم تتمّ تهيئة العميل. أعد تحميل الصفحة.', en: 'Client not initialized. Reload the page.' },
    'Envoi...': { ar: 'جارٍ الإرسال...', en: 'Sending...' },
    'Lien invalide ou expire.': { ar: 'الرابط غير صالح أو منتهي الصلاحية.', en: 'Invalid or expired link.' },
    'Mot de passe trop court (8 caracteres minimum).': { ar: 'كلمة المرور قصيرة جدًا (8 أحرف على الأقل).', en: 'Password too short (8 characters minimum).' },
    'Mot de passe trop faible. Ajoutez une majuscule, un chiffre.': { ar: 'كلمة المرور ضعيفة جدًا. أضف حرفًا كبيرًا ورقمًا.', en: 'Password too weak. Add an uppercase letter and a number.' },
    'Les mots de passe ne correspondent pas.': { ar: 'كلمتا المرور غير متطابقتين.', en: 'Passwords do not match.' },
    'Client non initialise.': { ar: 'لم تتمّ تهيئة العميل.', en: 'Client not initialized.' },
    'Enregistrement...': { ar: 'جارٍ الحفظ...', en: 'Saving...' },
    'Echec mise a jour. Reessayez.': { ar: 'فشل التحديث. حاول مجددًا.', en: 'Update failed. Try again.' },
    'Mot de passe mis a jour. Redirection vers la connexion...': { ar: 'تمّ تحديث كلمة المرور. جارٍ التحويل إلى تسجيل الدخول...', en: 'Password updated. Redirecting to login...' },
    'Erreur inattendue. Reessayez.': { ar: 'خطأ غير متوقّع. حاول مجددًا.', en: 'Unexpected error. Try again.' },
    "C'est moi, je veux réclamer": { ar: 'هذا أنا، أريد المطالبة بها', en: "It's me, I want to claim it" },
    'Vérification…': { ar: 'جارٍ التحقّق…', en: 'Verifying…' },
    'Réclamation…': { ar: 'جارٍ المطالبة…', en: 'Claiming…' },
    'Envoi des documents…': { ar: 'جارٍ إرسال الوثائق…', en: 'Sending documents…' },
    'Veuillez uploader les 2 documents.': { ar: 'يرجى رفع الوثيقتين.', en: 'Please upload both documents.' },

    // ─── [GABARIT AUTH 2026] email-verified — textes libres (statiques + injectés JS) ───
    'Vérification en cours...': { ar: 'جارٍ التحقّق...', en: 'Verifying...' },
    'Validation de votre lien email.': { ar: 'جارٍ التحقّق من رابط بريدك الإلكتروني.', en: 'Validating your email link.' },
    'Email vérifié !': { ar: 'تمّ التحقّق من البريد الإلكتروني!', en: 'Email verified!' },
    'Votre compte est maintenant actif.': { ar: 'حسابك الآن مفعَّل.', en: 'Your account is now active.' },
    'Bienvenue sur Tabibi. Vous pouvez vous connecter et commencer à prendre des RDV.': { ar: 'مرحبًا بك في طبيبي. يمكنك تسجيل الدخول والبدء في حجز المواعيد.', en: 'Welcome to Tabibi. You can log in and start booking appointments.' },
    'Lien invalide': { ar: 'رابط غير صالح', en: 'Invalid link' },
    'Lien expiré': { ar: 'انتهت صلاحية الرابط', en: 'Link expired' },
    'Le lien a expire ou a deja ete utilise.': { ar: 'انتهت صلاحية الرابط أو سبق استخدامه.', en: 'The link has expired or was already used.' },
    '← Retour connexion': { ar: '→ العودة إلى تسجيل الدخول', en: '← Back to login' },
    'Retour connexion': { ar: 'العودة إلى تسجيل الدخول', en: 'Back to login' },
    'Renvoyer un lien': { ar: 'إعادة إرسال الرابط', en: 'Resend a link' },
    'Client non charge.': { ar: 'لم يتمّ تحميل العميل.', en: 'Client not loaded.' },
    'Erreur inattendue': { ar: 'خطأ غير متوقّع', en: 'Unexpected error' },

    // ─── [PILOTE i18n 2026] messages + verify-email — textes libres générés en JS ───
    'Aucune conversation': { ar: 'لا توجد محادثات', en: 'No conversations' },
    'Vos échanges avec vos médecins apparaîtront ici.': { ar: 'ستظهر محادثاتك مع أطبائك هنا.', en: 'Your conversations with your doctors will appear here.' },
    'Messagerie bientôt disponible': { ar: 'المراسلة متاحة قريبًا', en: 'Messaging coming soon' },
    'votre adresse email': { ar: 'عنوان بريدك الإلكتروني', en: 'your email address' },
    'Nouvelle conversation': { ar: 'محادثة جديدة', en: 'New conversation' },
    'Envoi en cours…': { ar: 'جارٍ الإرسال…', en: 'Sending…' },
    'Email renvoyé, vérifie ta boîte (et les spams).': { ar: 'أُعيد إرسال الرسالة، تحقّق من صندوقك (والسبام).', en: 'Email resent, check your inbox (and spam).' },
    'Patiente une minute avant de réessayer.': { ar: 'انتظر دقيقة قبل إعادة المحاولة.', en: 'Wait a minute before trying again.' },
    "Échec de l'envoi, réessayez plus tard.": { ar: 'فشل الإرسال، حاول لاحقًا.', en: 'Sending failed, try again later.' },
    "Adresse email introuvable — recommencez l'inscription.": { ar: 'تعذّر العثور على البريد الإلكتروني — أعد التسجيل.', en: 'Email address not found — start signup again.' },
    'Service indisponible, réessayez dans un instant.': { ar: 'الخدمة غير متاحة، حاول بعد لحظات.', en: 'Service unavailable, try again shortly.' },

    // ─── [AUTH 2026] Pages login/signup — textes libres (sans data-i18n) ───
    'Indicatif Algérie': { ar: 'مفتاح الجزائر', en: 'Algeria code' },
    'ajouté automatiquement.': { ar: 'يُضاف تلقائيًا.', en: 'added automatically.' },
    'Entrez votre numéro : vous recevrez un code par SMS pour définir un nouveau mot de passe.': { ar: 'أدخل رقمك: ستصلك رسالة قصيرة بها رمز لتعيين كلمة مرور جديدة.', en: 'Enter your number: you will receive a code by SMS to set a new password.' },
    'Recevoir le code': { ar: 'استلام الرمز', en: 'Get the code' },
    '← Retour à la connexion': { ar: '→ العودة إلى تسجيل الدخول', en: '← Back to login' },
    '← Retour à la connexion par téléphone': { ar: '→ العودة إلى الدخول بالهاتف', en: '← Back to phone login' },
    'Vérifier': { ar: 'تحقّق', en: 'Verify' },
    'Renvoyer le code': { ar: 'إعادة إرسال الرمز', en: 'Resend the code' },
    'Changer de numéro': { ar: 'تغيير الرقم', en: 'Change number' },
    'Définir le mot de passe': { ar: 'تعيين كلمة المرور', en: 'Set password' },
    'Connexion admin': { ar: 'دخول المشرف', en: 'Admin login' },
    'Pas de compte ?': { ar: 'ليس لديك حساب؟', en: 'No account?' },
    "Vous l'utiliserez pour vous connecter (numéro + mot de passe), sans SMS à chaque fois.": { ar: 'ستستخدمها لتسجيل الدخول (الرقم + كلمة المرور)، دون رسائل قصيرة في كل مرة.', en: 'You will use it to sign in (number + password), without SMS each time.' },
    'Code reçu par SMS': { ar: 'الرمز المستلَم عبر الرسائل القصيرة', en: 'Code received by SMS' },
    'DPA médecins': { ar: 'اتفاقية معالجة بيانات الأطباء', en: 'Doctors DPA' },

    // ─── Wilayas (noms FR → AR/EN) ───
    'Annaba': { ar: 'عنابة', en: 'Annaba' },
    'Béjaïa': { ar: 'بجاية', en: 'Béjaïa' },
    'Constantine': { ar: 'قسنطينة', en: 'Constantine' },
    'Tlemcen': { ar: 'تلمسان', en: 'Tlemcen' },
    'Sétif': { ar: 'سطيف', en: 'Sétif' },

    // ─── Jours de la semaine (abréviations courtes) ───
    'Lun': { ar: 'إث', en: 'Mon' },
    'Mar': { ar: 'ثل', en: 'Tue' },
    'Mer': { ar: 'أر', en: 'Wed' },
    'Jeu': { ar: 'خم', en: 'Thu' },
    'Ven': { ar: 'جم', en: 'Fri' },
    'Sam': { ar: 'سب', en: 'Sat' },
    'Dim': { ar: 'أح', en: 'Sun' },

    // ─── Agenda / Doctor dashboard ───
    'Agenda — semaine': { ar: 'الأجندة — الأسبوع', en: 'Agenda — week' },
    'Mes horaires': { ar: 'مواعيدي', en: 'My schedule' },
    'Aucun RDV ce jour': { ar: 'لا توجد مواعيد اليوم', en: 'No appointments today' },
    'Praticien · Tabibi PRO': { ar: 'ممارس · Tabibi PRO', en: 'Practitioner · Tabibi PRO' },
    'Praticien': { ar: 'ممارس', en: 'Practitioner' },
    'Horaires enregistrés': { ar: 'تم حفظ المواعيد', en: 'Schedule saved' },
    'Fermé': { ar: 'مغلق', en: 'Closed' },
    'Ouvert': { ar: 'مفتوح', en: 'Open' },
    'Contrôle': { ar: 'مراجعة', en: 'Follow-up' },
    'Durée d\'une consultation': { ar: 'مدة الاستشارة', en: 'Consultation duration' },
    'Taux présence': { ar: 'معدل الحضور', en: 'Attendance rate' },
    'Paiement reçu': { ar: 'تم استلام الدفع', en: 'Payment received' },
    'Encaissé': { ar: 'محصل', en: 'Collected' },
    'Réussis': { ar: 'ناجحة', en: 'Successful' },

    // ─── Common deconnexion / navigation ───
    'Déconnexion réussie': { ar: 'تم تسجيل الخروج', en: 'Logged out successfully' },
    'Retour à l\'accueil': { ar: 'العودة إلى الرئيسية', en: 'Back to home' },
    'à l\'instant': { ar: 'الآن', en: 'just now' },

    // ─── Médecin / Patient interactions ───
    'Votre médecin': { ar: 'طبيبك', en: 'Your doctor' },
    'Médecin sélectionné': { ar: 'تم اختيار الطبيب', en: 'Doctor selected' },
    'Médecin en attente': { ar: 'طبيب في الانتظار', en: 'Doctor pending' },
    'Médecin introuvable': { ar: 'الطبيب غير موجود', en: 'Doctor not found' },
    'Spécialité non renseignée': { ar: 'التخصص غير محدد', en: 'Specialty not specified' },
    'Consultation générale': { ar: 'استشارة عامة', en: 'General consultation' },
    'Démarrage de la visioconsultation avec': { ar: 'بدء الاستشارة المرئية مع', en: 'Starting video consultation with' },
    'Réservé par': { ar: 'حجز من قبل', en: 'Booked by' },
    'Par téléphone': { ar: 'عبر الهاتف', en: 'By phone' },
    'Espèces au cabinet': { ar: 'نقدًا في العيادة', en: 'Cash at office' },
    'Paiement sécurisé': { ar: 'دفع آمن', en: 'Secure payment' },
    'Sélectionnez un créneau': { ar: 'اختر فترة', en: 'Select a time slot' },

    // ─── Favoris / Avis ───
    'Ajouté aux favoris': { ar: 'تمت الإضافة للمفضلة', en: 'Added to favorites' },
    'Retiré des favoris': { ar: 'تمت الإزالة من المفضلة', en: 'Removed from favorites' },
    'Noter ce médecin': { ar: 'قيّم هذا الطبيب', en: 'Rate this doctor' },
    'à noter': { ar: 'للتقييم', en: 'to rate' },
    'Sélectionnez une note': { ar: 'اختر تقييمًا', en: 'Select a rating' },
    'Très insatisfait': { ar: 'غير راضٍ جدًا', en: 'Very unsatisfied' },
    'Connectez-vous pour noter ce médecin': { ar: 'سجل الدخول لتقييم هذا الطبيب', en: 'Sign in to rate this doctor' },
    'Connectez-vous pour réserver': { ar: 'سجل الدخول للحجز', en: 'Sign in to book' },
    'Aucun avis dans cette catégorie': { ar: 'لا توجد تقييمات في هذه الفئة', en: 'No reviews in this category' },
    'Avis inapproprié signalé': { ar: 'تم الإبلاغ عن التقييم', en: 'Inappropriate review reported' },
    'Découverte': { ar: 'استكشاف', en: 'Discovery' },

    // ─── Inscription / Erreurs ───
    'Erreur lors de la création du compte': { ar: 'خطأ أثناء إنشاء الحساب', en: 'Error creating account' },
    'Prénom et nom obligatoires': { ar: 'الاسم واللقب مطلوبان', en: 'First and last name required' },
    'Rôle invalide': { ar: 'دور غير صالح', en: 'Invalid role' },
    'Mot de passe changé': { ar: 'تم تغيير كلمة المرور', en: 'Password changed' },
    'Compte supprimé': { ar: 'تم حذف الحساب', en: 'Account deleted' },
    'Le consentement au traitement des données de santé est obligatoire': { ar: 'الموافقة على معالجة البيانات الصحية إلزامية', en: 'Consent to health data processing is mandatory' },
    'Vous devez consentir à la politique de confidentialité': { ar: 'يجب الموافقة على سياسة الخصوصية', en: 'You must consent to the privacy policy' },
    'Complétez votre dossier médical pour une meilleure prise en charge': { ar: 'أكمل ملفك الطبي للحصول على رعاية أفضل', en: 'Complete your medical file for better care' },

    // ─── Documents / Diplômes ───
    'Diplôme ajouté': { ar: 'تمت إضافة الشهادة', en: 'Diploma added' },
    'Document ajouté': { ar: 'تمت إضافة الوثيقة', en: 'Document added' },
    'Reçu téléchargé': { ar: 'تم تحميل الإيصال', en: 'Receipt downloaded' },
    'Lien copié': { ar: 'تم نسخ الرابط', en: 'Link copied' },
    'Codes copiés': { ar: 'تم نسخ الرموز', en: 'Codes copied' },
    'Backup créé': { ar: 'تم إنشاء النسخة الاحتياطية', en: 'Backup created' },
    'Tout marqué comme lu': { ar: 'تم تحديد الكل كمقروء', en: 'All marked as read' },
    'Validé via admin dashboard': { ar: 'تم التحقق عبر لوحة الإدارة', en: 'Validated via admin dashboard' },
    'Rejeté via admin dashboard': { ar: 'رفض عبر لوحة الإدارة', en: 'Rejected via admin dashboard' },

    // ─── BATCH FINAL : Tous les textes restants détectés par audit forensique ───
    // Titres de pages (title HTML)
    'Mon espace patient | Tabibi': { ar: 'مساحتي كمريض | طبيبي', en: 'My patient space | Tabibi' },
    'Espace médecin | Tabibi': { ar: 'مساحة الطبيب | طبيبي', en: 'Doctor space | Tabibi' },
    'Profil médecin | Tabibi': { ar: 'ملف الطبيب | طبيبي', en: 'Doctor profile | Tabibi' },
    'Profil médecin | Tabibi — RDV en ligne en Algérie': { ar: 'ملف الطبيب | طبيبي — حجز عبر الإنترنت في الجزائر', en: 'Doctor profile | Tabibi — Online booking in Algeria' },
    'Réservation médecin | Tabibi': { ar: 'حجز طبيب | طبيبي', en: 'Doctor booking | Tabibi' },
    'Mon rendez-vous | Tabibi': { ar: 'موعدي | طبيبي', en: 'My appointment | Tabibi' },
    'Analytics — Tabibi Médecin': { ar: 'التحليلات — طبيبي', en: 'Analytics — Tabibi Doctor' },
    'Modération des avis | Tabibi Admin': { ar: 'الإشراف على التقييمات | طبيبي', en: 'Review moderation | Tabibi Admin' },
    'Connexion à Tabibi | Espace patient et médecin': { ar: 'تسجيل الدخول إلى طبيبي', en: 'Login to Tabibi' },
    'Inscription Tabibi | Créer un compte patient ou médecin': { ar: 'التسجيل في طبيبي | إنشاء حساب', en: 'Tabibi signup | Create an account' },
    'Plateforme Tabibi — Algérie': { ar: 'منصة طبيبي — الجزائر', en: 'Tabibi platform — Algeria' },
    'Votre espace santé Tabibi': { ar: 'مساحتك الصحية طبيبي', en: 'Your Tabibi health space' },

    // Headers / Sections principales
    'Bonjour, Admin': { ar: 'مرحبًا، المسؤول', en: 'Hello, Admin' },
    'Trouver un médecin': { ar: 'ابحث عن طبيب', en: 'Find a doctor' },
    'Mes médecins favoris': { ar: 'أطبائي المفضلون', en: 'My favorite doctors' },
    'Mes paiements': { ar: 'مدفوعاتي', en: 'My payments' },
    'Dossier médical': { ar: 'الملف الطبي', en: 'Medical record' },
    'Accès rapide': { ar: 'وصول سريع', en: 'Quick access' },
    'Activité récente': { ar: 'النشاط الحديث', en: 'Recent activity' },
    'Mon abonnement Tabibi PRO': { ar: 'اشتراكي Tabibi PRO', en: 'My Tabibi PRO subscription' },
    'Statistiques avancées Tabibi Pro': { ar: 'إحصائيات Tabibi Pro المتقدمة', en: 'Advanced Tabibi Pro stats' },

    // RDV / Stats
    'RDV aujourd\'hui': { ar: 'مواعيد اليوم', en: 'Today\'s appointments' },
    'RDV du jour': { ar: 'موعد اليوم', en: 'Today\'s appointment' },
    'Tous les RDV': { ar: 'جميع المواعيد', en: 'All appointments' },
    'RDV confirmé !': { ar: 'تم تأكيد الموعد!', en: 'Appointment confirmed!' },
    'RDV en visioconférence': { ar: 'موعد عبر الفيديو', en: 'Video appointment' },
    'Consultation dans 1h': { ar: 'استشارة خلال ساعة', en: 'Consultation in 1h' },
    'Consultations du jour': { ar: 'استشارات اليوم', en: 'Today\'s consultations' },
    'Donner mon avis': { ar: 'أعطِ رأيي', en: 'Give my review' },
    'Vous avez consulté ce médecin ?': { ar: 'هل استشرت هذا الطبيب؟', en: 'Have you seen this doctor?' },
    'Voir mes rendez-vous': { ar: 'عرض مواعيدي', en: 'View my appointments' },
    'Voir mes factures': { ar: 'عرض فواتيري', en: 'View my invoices' },
    'Réserver un RDV': { ar: 'حجز موعد', en: 'Book appointment' },
    'Itinéraire': { ar: 'الاتجاهات', en: 'Directions' },

    // Filtres statuts (avec parenthèses ouvrantes)
    'Tous (': { ar: 'الكل (', en: 'All (' },
    'À venir (': { ar: 'القادمة (', en: 'Upcoming (' },
    'Terminés (': { ar: 'المنتهية (', en: 'Completed (' },
    'Annulés (': { ar: 'الملغاة (', en: 'Cancelled (' },
    '0 en attente': { ar: '0 في الانتظار', en: '0 pending' },
    '1 · Détails': { ar: '1 · التفاصيل', en: '1 · Details' },

    // Étapes / Inscription
    'Étapes': { ar: 'الخطوات', en: 'Steps' },
    'Déjà inscrit ?': { ar: 'مسجل بالفعل؟', en: 'Already registered?' },
    'Pas de compte ?': { ar: 'ليس لديك حساب؟', en: 'No account?' },
    'Prénom *': { ar: 'الاسم *', en: 'First name *' },
    'Téléphone *': { ar: 'الهاتف *', en: 'Phone *' },
    'Mot de passe *': { ar: 'كلمة المرور *', en: 'Password *' },
    'Spécialité *': { ar: 'التخصص *', en: 'Specialty *' },
    'Min. 8 caractères': { ar: '8 أحرف على الأقل', en: 'Min. 8 characters' },
    'N° Conseil de l\'Ordre *': { ar: 'رقم القيد *', en: 'License N° *' },
    'N° Conseil National de l\'Ordre': { ar: 'رقم القيد الوطني', en: 'National license N°' },
    'Numéro RPPS / Identifiant médecin': { ar: 'رقم تعريف الطبيب', en: 'Doctor ID number' },
    'Médecine Générale': { ar: 'الطب العام', en: 'General Medicine' },
    'Gastro-entéro.': { ar: 'الجهاز الهضمي', en: 'Gastroenterology' },
    'médecins certifiés disponibles en Algérie': { ar: 'طبيب معتمد متاح في الجزائر', en: 'certified doctors available in Algeria' },

    // RGPD / Consentement
    'Conditions Générales d\'Utilisation': { ar: 'الشروط العامة للاستخدام', en: 'Terms of Use' },
    ', conforme à la loi algérienne 18-07.': { ar: '، وفقًا للقانون الجزائري 18-07.', en: ', compliant with Algerian law 18-07.' },
    'de Tabibi.': { ar: 'من طبيبي.', en: 'of Tabibi.' },
    'Consentement données de santé :': { ar: 'الموافقة على البيانات الصحية:', en: 'Health data consent:' },
    'J\'autorise expressément le traitement de mes données médicales sensibles aux seules fins de prise en charge médicale': { ar: 'أوافق صراحة على معالجة بياناتي الطبية الحساسة لأغراض الرعاية الطبية فقط', en: 'I expressly authorize processing of my sensitive medical data for medical care only' },
    '(Optionnel) J\'accepte de recevoir des conseils santé et offres Tabibi par email.': { ar: '(اختياري) أوافق على تلقي نصائح صحية وعروض طبيبي بالبريد', en: '(Optional) I accept health tips and Tabibi offers by email.' },

    // Spécialité / Profil médecin
    'Adresse du cabinet': { ar: 'عنوان العيادة', en: 'Office address' },
    'Nom du cabinet (optionnel)': { ar: 'اسم العيادة (اختياري)', en: 'Office name (optional)' },
    'Sous-spécialités (séparées par des virgules)': { ar: 'التخصصات الفرعية (مفصولة بفواصل)', en: 'Sub-specialties (comma-separated)' },
    'Ex : Rythmologie, Échocardiographie': { ar: 'مثال: علم النظم، تخطيط صدى القلب', en: 'Ex: Rhythmology, Echocardiography' },
    'Bio professionnelle (visible aux patients)': { ar: 'السيرة المهنية (مرئية للمرضى)', en: 'Professional bio (visible to patients)' },
    'Cette bio apparaît sur votre profil public.': { ar: 'تظهر هذه السيرة في ملفك العام.', en: 'This bio appears on your public profile.' },
    'Cardiologue avec 15 ans d\'expérience au CHU Mustapha Pacha...': { ar: 'طبيب قلب بخبرة 15 عامًا في مستشفى مصطفى باشا...', en: 'Cardiologist with 15 years of experience at Mustapha Pacha...' },
    'Décrivez brièvement vos symptômes ou le motif de votre visite...': { ar: 'صف بإيجاز أعراضك أو سبب زيارتك...', en: 'Briefly describe your symptoms or reason for visit...' },
    'Allergies connues, médicaments en cours, antécédents importants...': { ar: 'الحساسيات المعروفة، الأدوية الحالية، السوابق المهمة...', en: 'Known allergies, current medications, important history...' },
    'Diplômes & certifications': { ar: 'الشهادات والاعتمادات', en: 'Diplomas & certifications' },
    'Diplômes & formations': { ar: 'الشهادات والتكوينات', en: 'Diplomas & training' },
    'Ajouter un diplôme': { ar: 'إضافة شهادة', en: 'Add diploma' },
    'Certifié Tabibi': { ar: 'معتمد من طبيبي', en: 'Tabibi certified' },
    'Médecin certifié Tabibi': { ar: 'طبيب معتمد من طبيبي', en: 'Tabibi certified doctor' },

    // Tarifs / Paiement
    'Tarifs & types de consultation': { ar: 'الأسعار وأنواع الاستشارات', en: 'Fees & consultation types' },
    'Types de consultations': { ar: 'أنواع الاستشارات', en: 'Consultation types' },
    'Modes de paiement': { ar: 'طرق الدفع', en: 'Payment methods' },
    'Assurances & tiers payant acceptés': { ar: 'التأمينات والدفع من طرف ثالث مقبولة', en: 'Insurance & third-party payment accepted' },
    'Conventionné CNAS / CASNOS / CHIFA': { ar: 'متعاقد مع CNAS / CASNOS / CHIFA', en: 'CNAS / CASNOS / CHIFA approved' },
    'Mutuelles privées': { ar: 'التأمينات الخاصة', en: 'Private insurance' },
    'Passer à Pro — 2 900 DA/mois': { ar: 'الترقية إلى Pro — 2900 دج/شهر', en: 'Upgrade to Pro — 2,900 DA/month' },
    '5 000 DA / mois': { ar: '5000 دج / شهر', en: '5,000 DA / month' },
    'Passez à Tabibi Pro pour débloquer les statistiques en temps réel, l\'export CSV et plus': { ar: 'قم بالترقية إلى Tabibi Pro لفتح الإحصائيات الفورية، تصدير CSV والمزيد', en: 'Upgrade to Tabibi Pro to unlock real-time stats, CSV export and more' },
    'Paiement 100% sécurisé · Données chiffrées SSL/TLS': { ar: 'دفع آمن 100% · بيانات مشفرة SSL/TLS', en: '100% secure payment · SSL/TLS encrypted' },

    // Horaires
    'Configurer mes horaires': { ar: 'تكوين مواعيدي', en: 'Configure my schedule' },
    'Enregistrer mes horaires': { ar: 'حفظ مواعيدي', en: 'Save my schedule' },
    'Ajouter créneaux': { ar: 'إضافة فترات', en: 'Add slots' },
    'Gérer mes créneaux en détail': { ar: 'إدارة فتراتي بالتفصيل', en: 'Manage my slots in detail' },
    'Définissez vos horaires habituels pour générer automatiquement vos créneaux.': { ar: 'حدد مواعيدك المعتادة لإنشاء فتراتك تلقائيًا.', en: 'Set your usual schedule to auto-generate your slots.' },
    'Définissez vos jours et horaires de travail. Les patients ne pourront prendre RDV que sur ces créneaux.': { ar: 'حدد أيامك وساعات عملك. لن يتمكن المرضى من الحجز إلا في هذه الفترات.', en: 'Set your work days and hours. Patients can only book within these slots.' },
    'Matin (8h-12h)': { ar: 'صباحًا (8-12)', en: 'Morning (8am-12pm)' },
    'Après-midi (14h-18h)': { ar: 'بعد الظهر (14-18)', en: 'Afternoon (2pm-6pm)' },
    'Durée moyenne (min)': { ar: 'المدة المتوسطة (دقيقة)', en: 'Average duration (min)' },
    'Durée par RDV (min)': { ar: 'مدة كل موعد (دقيقة)', en: 'Duration per appt (min)' },
    'Générer les créneaux': { ar: 'إنشاء الفترات', en: 'Generate slots' },
    'Modèles de récurrence': { ar: 'نماذج التكرار', en: 'Recurrence templates' },
    'Toutes les semaines (4 sem.)': { ar: 'كل أسبوع (4 أسابيع)', en: 'Every week (4 weeks)' },
    'Mettre en pause (vacances)': { ar: 'إيقاف مؤقت (إجازة)', en: 'Pause (vacation)' },

    // Modération
    'Modération des avis': { ar: 'الإشراف على التقييمات', en: 'Review moderation' },
    'Publiés': { ar: 'منشورة', en: 'Published' },
    'Signalés': { ar: 'مُبلغ عنها', en: 'Reported' },
    'Refusés': { ar: 'مرفوضة', en: 'Rejected' },

    // Sécurité
    'Sécurité': { ar: 'الأمان', en: 'Security' },
    'Changer le mot de passe': { ar: 'تغيير كلمة المرور', en: 'Change password' },
    '2FA obligatoire (recommandé)': { ar: 'المصادقة الثنائية إلزامية (موصى بها)', en: '2FA mandatory (recommended)' },
    'Activer la 2FA': { ar: 'تفعيل المصادقة الثنائية', en: 'Enable 2FA' },
    'Configurer la 2FA': { ar: 'تكوين المصادقة الثنائية', en: 'Configure 2FA' },
    'SMS de vérification à chaque connexion': { ar: 'رمز SMS للتحقق عند كل تسجيل دخول', en: 'SMS verification at each login' },
    'Confirmation SMS envoyée': { ar: 'تم إرسال تأكيد SMS', en: 'SMS confirmation sent' },
    'Un SMS de confirmation a été envoyé à votre numéro de téléphone algérien.': { ar: 'تم إرسال SMS تأكيد إلى رقم هاتفك الجزائري.', en: 'A confirmation SMS was sent to your Algerian phone number.' },
    'Après 15 min d\'inactivité': { ar: 'بعد 15 دقيقة من عدم النشاط', en: 'After 15 min of inactivity' },
    'Email à 8h chaque jour': { ar: 'بريد إلكتروني في الساعة 8 صباحًا كل يوم', en: 'Email at 8am every day' },
    'Notre équipe support vous répond sous 24h ouvrées': { ar: 'يجيبك فريق الدعم خلال 24 ساعة عمل', en: 'Our support team replies within 24 business hours' },
    'Sauvegarder paramètres': { ar: 'حفظ الإعدادات', en: 'Save settings' },
    'Sauvegarder toutes les modifications': { ar: 'حفظ جميع التعديلات', en: 'Save all changes' },
    'Supprimer mon compte': { ar: 'حذف حسابي', en: 'Delete my account' },
    'Exporter données (CSV)': { ar: 'تصدير البيانات (CSV)', en: 'Export data (CSV)' },
    'Données': { ar: 'البيانات', en: 'Data' },

    // Durées
    '7 jours': { ar: '7 أيام', en: '7 days' },
    '30 jours': { ar: '30 يومًا', en: '30 days' },
    '90 jours': { ar: '90 يومًا', en: '90 days' },
    'Heures de pointe': { ar: 'ساعات الذروة', en: 'Peak hours' },
    'Évolution mensuelle des RDV': { ar: 'تطور المواعيد الشهري', en: 'Monthly appointments trend' },
    'Motifs de consultation les plus fréquents': { ar: 'أسباب الاستشارة الأكثر تكرارًا', en: 'Most frequent consultation reasons' },
    'Répartition par wilaya': { ar: 'التوزيع حسب الولاية', en: 'Distribution by wilaya' },

    // Sélecteur langue
    '🇫🇷 Français': { ar: '🇫🇷 الفرنسية', en: '🇫🇷 French' },

    // Placeholders importants
    'Spécialité, nom, ville...': { ar: 'التخصص، الاسم، المدينة...', en: 'Specialty, name, city...' },
    '— Sélectionnez —': { ar: '— اختر —', en: '— Select —' },

    // Derniers restants après audit final
    '2 · Paiement': { ar: '2 · الدفع', en: '2 · Payment' },
    'Nouveau RDV': { ar: 'موعد جديد', en: 'New appointment' },
    'Nouveau RDV pris': { ar: 'تم حجز موعد جديد', en: 'New appointment booked' },
    'Annuler l\'abonnement': { ar: 'إلغاء الاشتراك', en: 'Cancel subscription' },
    '(Optionnel) J\'accepte de recevoir des conseils santé et offres Tabibi par email. Désabonnement en 1 clic.': { ar: '(اختياري) أوافق على تلقي نصائح صحية وعروض طبيبي بالبريد. إلغاء الاشتراك بنقرة واحدة.', en: '(Optional) I accept health tips and Tabibi offers by email. 1-click unsubscribe.' },
    'J\'autorise expressément le traitement de mes données médicales sensibles aux seules fins de la prise en charge médicale': { ar: 'أوافق صراحة على معالجة بياناتي الطبية الحساسة لأغراض الرعاية الطبية فقط', en: 'I expressly authorize processing of my sensitive medical data for medical care purposes only' },
    'Passez à Tabibi Pro pour débloquer les statistiques en temps réel, l\'export CSV et la comparaison annuelle': { ar: 'قم بالترقية إلى Tabibi Pro لفتح الإحصائيات الفورية وتصدير CSV والمقارنة السنوية', en: 'Upgrade to Tabibi Pro to unlock real-time stats, CSV export and annual comparison' },

    // ═══ INDEX.HTML — Tous les textes restants ═══
    'Tabibi — Trouvez votre médecin en ligne en Algérie | RDV 24/7': { ar: 'طبيبي — احجز طبيبك عبر الإنترنت في الجزائر | مواعيد 24/7', en: 'Tabibi — Find your doctor online in Algeria | 24/7 booking' },
    'App mobile sans navigateur': { ar: 'تطبيق محمول بدون متصفح', en: 'Mobile app without browser' },
    'طبيبي · La santé à portée de clic': { ar: 'طبيبي · الصحة على بُعد نقرة', en: 'طبيبي · Healthcare one click away' },
    'طبيبي · Médecins Algérie': { ar: 'طبيبي · أطباء الجزائر', en: 'طبيبي · Algeria Doctors' },
    // [Phase 5.3 cleanup] Clé i18n "<count> médecins certifiés en Algérie" supprimée.
    // Le compteur médecins est désormais alimenté dynamiquement via
    // fetchDoctorCount() + animateCounters() (cf. index.html).
    'Trouvez votre médecin en ligne en Algérie': { ar: 'ابحث عن طبيبك عبر الإنترنت في الجزائر', en: 'Find your doctor online in Algeria' },
    'Réservez en ligne 24h/24 auprès de médecins certifiés dans les 48 wilayas. Rapide, simple, sécurisé.': { ar: 'احجز عبر الإنترنت 24/7 مع أطباء معتمدين في 48 ولاية. سريع، بسيط، آمن.', en: 'Book online 24/7 with certified doctors in all 48 wilayas. Fast, simple, secure.' },
    'Spécialités médicales': { ar: 'التخصصات الطبية', en: 'Medical specialties' },
    'Toutes les wilayas': { ar: 'جميع الولايات', en: 'All wilayas' },
    'Toutes les spécialités': { ar: 'جميع التخصصات', en: 'All specialties' },
    'Mieux notés': { ar: 'الأعلى تقييمًا', en: 'Top rated' },
    'Médecins certifiés en Algérie': { ar: 'أطباء معتمدون في الجزائر', en: 'Certified doctors in Algeria' },
    'Comment prendre RDV en ligne ?': { ar: 'كيف تحجز موعدًا عبر الإنترنت؟', en: 'How to book online?' },
    'Filtrez par nom, ville, spécialité, note et prix.': { ar: 'صفِّ حسب الاسم، المدينة، التخصص، التقييم والسعر.', en: 'Filter by name, city, specialty, rating and price.' },
    'Réservez': { ar: 'احجز', en: 'Book' },
    'Choisissez un créneau et confirmez votre RDV en ligne.': { ar: 'اختر فترة وأكد موعدك عبر الإنترنت.', en: 'Choose a time slot and confirm your appointment online.' },
    'Recevez un SMS de confirmation et rencontrez votre médecin.': { ar: 'استلم رسالة SMS تأكيد وقابل طبيبك.', en: 'Receive a confirmation SMS and meet your doctor.' },
    'Médecins certifiés': { ar: 'أطباء معتمدون', en: 'Certified doctors' },
    'Vous êtes médecin ?': { ar: 'هل أنت طبيب؟', en: 'Are you a doctor?' },
    'Rejoignez Tabibi et développez votre patientèle en ligne. Inscription gratuite pendant 30 jours.': { ar: 'انضم إلى طبيبي وطوّر قاعدة مرضاك عبر الإنترنت. تسجيل مجاني لمدة 30 يومًا.', en: 'Join Tabibi and grow your patient base online. Free registration for 30 days.' },
    'Rejoignez la waiting list': { ar: 'انضم لقائمة الانتظار', en: 'Join the waiting list' },
    'Soyez parmi les 1ers à découvrir Tabibi · Inscription gratuite': { ar: 'كن من الأوائل لاكتشاف طبيبي · تسجيل مجاني', en: 'Be among the first to discover Tabibi · Free signup' },
    // [Phase 5.3 cleanup] Clé i18n footer (variante "24/7") supprimée.
    // Le texte est désormais composé dynamiquement via <p id="foot-desc"> +
    // span #foot-doc-count alimenté par animateCounters dans index.html.
    'Tabibi PRO 5 000 DA/mois': { ar: 'Tabibi PRO 5000 دج/شهر', en: 'Tabibi PRO 5,000 DA/month' },
    'Blog santé': { ar: 'مدونة الصحة', en: 'Health blog' },
    'Légal': { ar: 'قانوني', en: 'Legal' },
    'Support 7j/7 — 8h à 22h': { ar: 'الدعم 7/7 — من 8 ص إلى 10 م', en: 'Support 7/7 — 8am to 10pm' },
    'Réponse sous 24h ouvrées': { ar: 'الرد خلال 24 ساعة عمل', en: 'Reply within 24 business hours' },
    '© 2025 Tabibi DZ — Tous droits réservés · Algérie 🇩🇿': { ar: '© 2025 طبيبي · جميع الحقوق محفوظة · الجزائر 🇩🇿', en: '© 2025 Tabibi DZ — All rights reserved · Algeria 🇩🇿' },
    'Données de santé hébergées en Algérie · Conforme RGPD': { ar: 'البيانات الصحية مستضافة في الجزائر · متوافق GDPR', en: 'Health data hosted in Algeria · GDPR compliant' },
    'votre@email.com': { ar: 'your@email.com', en: 'your@email.com' },
    '6 caractères min.': { ar: '6 أحرف على الأقل', en: '6 characters min.' },
    'Facebook (bientôt disponible)': { ar: 'فيسبوك (قريبًا)', en: 'Facebook (coming soon)' },
    'Instagram (bientôt disponible)': { ar: 'إنستغرام (قريبًا)', en: 'Instagram (coming soon)' },
    'X / Twitter (bientôt disponible)': { ar: 'X / تويتر (قريبًا)', en: 'X / Twitter (coming soon)' },
    'LinkedIn (bientôt disponible)': { ar: 'لينكدإن (قريبًا)', en: 'LinkedIn (coming soon)' },
    'App iOS bientôt disponible': { ar: 'تطبيق iOS قريبًا', en: 'iOS app coming soon' },
    'App Android bientôt disponible': { ar: 'تطبيق Android قريبًا', en: 'Android app coming soon' },

    // Phrase RGPD signup (variante longue)
    'J\'autorise expressément le traitement de mes données médicales sensibles aux seules fins de la prise en charge médicale, conforme à la loi algérienne 18-07.': { ar: 'أوافق صراحة على معالجة بياناتي الطبية الحساسة لأغراض الرعاية الطبية فقط، وفقًا للقانون الجزائري 18-07.', en: 'I expressly authorize processing of my sensitive medical data for medical care purposes only, in accordance with Algerian law 18-07.' },

    // Versions exactes des textes tronqués
    'J\'autorise expressément le traitement de mes données médicales sensibles aux seules fins de la prise de rendez-vous (art. 18 loi 18-07).': { ar: 'أوافق صراحة على معالجة بياناتي الطبية الحساسة لأغراض حجز المواعيد فقط (المادة 18 من القانون 18-07).', en: 'I expressly authorize processing of my sensitive medical data for appointment booking purposes only (art. 18 of law 18-07).' },
    'Passez à Tabibi Pro pour débloquer les statistiques en temps réel, l\'export CSV et la comparaison annuelle.': { ar: 'قم بالترقية إلى Tabibi Pro لفتح الإحصائيات الفورية، تصدير CSV والمقارنة السنوية.', en: 'Upgrade to Tabibi Pro to unlock real-time stats, CSV export and annual comparison.' },
    // [Phase 5.3 cleanup] Clé i18n footer (variante "24h/24") supprimée.
    // Compteur médecins alimenté dynamiquement (cf. index.html #foot-doc-count).

    // [I18N-UNIFY-2026] LOT 2 — Pages orphelines (404, offline, onboarding, patient-profile, reservation, success)
    // 404.html
    'Page introuvable': { ar: 'الصفحة غير موجودة', en: 'Page not found' },
    'Cette page n\'existe pas ou a été déplacée.': { ar: 'هذه الصفحة غير موجودة أو تم نقلها.', en: 'This page does not exist or has been moved.' },
    'Retour à l\'accueil': { ar: 'العودة إلى الرئيسية', en: 'Back to home' },
    'Trouver un médecin': { ar: 'ابحث عن طبيب', en: 'Find a doctor' },
    'Accueil Tabibi': { ar: 'الرئيسية طبيبي', en: 'Tabibi home' },
    'Erreur 404': { ar: 'خطأ 404', en: 'Error 404' },

    // offline.html
    'Hors connexion': { ar: 'غير متصل', en: 'Offline' },
    'Hors connexion · Tabibi طبيبي': { ar: 'غير متصل · طبيبي', en: 'Offline · Tabibi' },
    'Vous êtes hors connexion': { ar: 'أنت غير متصل', en: 'You are offline' },
    'Vérifiez votre connexion internet et réessayez.': { ar: 'تحقق من اتصالك بالإنترنت وأعد المحاولة.', en: 'Check your internet connection and try again.' },
    'Réessayer': { ar: 'إعادة المحاولة', en: 'Try again' },

    // success.html
    'Confirmation': { ar: 'تأكيد', en: 'Confirmation' },
    'Demande envoyée !': { ar: 'تم إرسال الطلب!', en: 'Request sent!' },
    'Votre demande a bien été reçue.': { ar: 'تم استلام طلبك.', en: 'Your request has been received.' },
    'Nous vous répondrons sous 24h.': { ar: 'سنرد عليك خلال 24 ساعة.', en: 'We will reply within 24 hours.' },

    // reservation.html
    'Réservation': { ar: 'حجز', en: 'Booking' },
    'Confirmer la réservation': { ar: 'تأكيد الحجز', en: 'Confirm booking' },
    'Imprimer le reçu': { ar: 'طباعة الإيصال', en: 'Print receipt' },

    // onboarding-medecin.html
    'Devenir médecin Tabibi': { ar: 'كن طبيبًا على طبيبي', en: 'Become a Tabibi doctor' },
    'Devenir médecin Tabibi — Inscription': { ar: 'كن طبيبًا على طبيبي — التسجيل', en: 'Become a Tabibi doctor — Sign up' },
    'Inscription gratuite en 4 étapes — environ 5 minutes': { ar: 'تسجيل مجاني في 4 خطوات — حوالي 5 دقائق', en: 'Free signup in 4 steps — about 5 minutes' },
    'Gratuit en 2 minutes': { ar: 'مجاني في دقيقتين', en: 'Free in 2 minutes' },
    'Identité, contact, adresse': { ar: 'الهوية، الاتصال، العنوان', en: 'Identity, contact, address' },
    'Activité et cabinet': { ar: 'النشاط والعيادة', en: 'Activity and office' },
    'Documents acceptés :': { ar: 'الوثائق المقبولة:', en: 'Accepted documents:' },
    'Diplôme de Doctorat en Médecine': { ar: 'شهادة دكتوراه في الطب', en: 'Doctorate in Medicine' },
    'Attestation d\'inscription au Conseil de l\'Ordre': { ar: 'شهادة القيد في مجلس النقابة', en: 'Council of Order registration certificate' },
    'Carte d\'identité ou passeport (recommandé)': { ar: 'بطاقة الهوية أو جواز السفر (موصى به)', en: 'ID card or passport (recommended)' },
    'En cas de question :': { ar: 'في حال وجود سؤال:', en: 'If you have a question:' },
    'Envoyer ma demande': { ar: 'إرسال طلبي', en: 'Send my request' },
    'Choisissez votre formule': { ar: 'اختر باقتك', en: 'Choose your plan' },
    'Contrat d\'Adhésion Médecin': { ar: 'عقد انضمام الطبيب', en: 'Doctor Membership Agreement' },
    'Idéalement votre email pro. Servira de login.': { ar: 'يفضل البريد المهني. سيستخدم لتسجيل الدخول.', en: 'Ideally your professional email. Used as login.' },
    'Adresse complète du cabinet': { ar: 'العنوان الكامل للعيادة', en: 'Full office address' },
    'Ces informations apparaîtront sur votre profil public Tabibi.': { ar: 'ستظهر هذه المعلومات في ملفك العام على طبيبي.', en: 'This information will appear on your public Tabibi profile.' },
    'Conformément au Code de déontologie médicale algérien. Vos documents sont chiffrés.': { ar: 'وفقًا لقانون أخلاقيات الطب الجزائري. وثائقك مشفرة.', en: 'In accordance with the Algerian medical code of ethics. Your documents are encrypted.' },
    'Conformément à l\'art. 17 du décret 92-276, Tabibi ne perçoit aucune commission sur les actes médicaux.': { ar: 'وفقًا للمادة 17 من المرسوم 92-276، لا يأخذ طبيبي أي عمولة على الأعمال الطبية.', en: 'In accordance with art. 17 of decree 92-276, Tabibi takes no commission on medical acts.' },
    'Accélère la vérification': { ar: 'يسرّع التحقق', en: 'Speeds up verification' },
    'Chirurgie générale': { ar: 'الجراحة العامة', en: 'General surgery' },
    'Gynécologie-Obstétrique': { ar: 'النساء والتوليد', en: 'Gynecology-Obstetrics' },
    'En cours de validité': { ar: 'ساري المفعول', en: 'Valid' },
    '20 RDV/mois': { ar: '20 موعد/شهر', en: '20 appts/month' },

    // patient-profile.html
    'Mon profil': { ar: 'ملفي', en: 'My profile' },
    'Carte de santé numérique': { ar: 'بطاقة الصحة الرقمية', en: 'Digital health card' },
    'Affichez ce QR aux médecins pour un accès rapide à votre dossier': { ar: 'اعرض هذا الرمز للأطباء للوصول السريع إلى ملفك', en: 'Show this QR to doctors for quick access to your file' },
    'Informations vitales accessibles aux médecins': { ar: 'معلومات حيوية متاحة للأطباء', en: 'Vital information accessible to doctors' },
    'Indicateurs santé': { ar: 'مؤشرات الصحة', en: 'Health indicators' },
    'Antécédents médicaux': { ar: 'السوابق الطبية', en: 'Medical history' },
    'Antécédents familiaux': { ar: 'السوابق العائلية', en: 'Family history' },
    'Carnet de vaccinations': { ar: 'دفتر التطعيمات', en: 'Vaccination record' },
    'Assurance & Sécurité Sociale': { ar: 'التأمين والضمان الاجتماعي', en: 'Insurance & Social Security' },
    'Cartes enregistrées et préférences': { ar: 'البطاقات المسجلة والتفضيلات', en: 'Saved cards and preferences' },
    'Cartes enregistrées': { ar: 'البطاقات المسجلة', en: 'Saved cards' },
    'Ajouter une carte': { ar: 'إضافة بطاقة', en: 'Add card' },
    'Ajouter un membre': { ar: 'إضافة عضو', en: 'Add member' },
    'Ajouter une mesure': { ar: 'إضافة قياس', en: 'Add measurement' },
    'Frère/Sœur': { ar: 'أخ/أخت', en: 'Brother/Sister' },
    'Au repos': { ar: 'عند الراحة', en: 'At rest' },
    'CNAS (Salariés)': { ar: 'CNAS (الموظفون)', en: 'CNAS (Employees)' },
    'CASNOS (Indépendants)': { ar: 'CASNOS (المستقلون)', en: 'CASNOS (Self-employed)' },
    'Aucune': { ar: 'لا شيء', en: 'None' },
    'Cholestérol': { ar: 'الكولسترول', en: 'Cholesterol' },
    'Glycémie': { ar: 'سكر الدم', en: 'Blood sugar' },
    'Comment voulez-vous être prévenu ?': { ar: 'كيف تريد أن يتم إشعارك؟', en: 'How do you want to be notified?' },
    'Conseils santé hebdomadaires par email': { ar: 'نصائح صحية أسبوعية بالبريد', en: 'Weekly health tips by email' },
    'Code de vérification par SMS': { ar: 'رمز التحقق عبر SMS', en: 'SMS verification code' },
    'Connexion biométrique': { ar: 'الاتصال البيومتري', en: 'Biometric login' },
    'Face ID / Touch ID si disponible': { ar: 'Face ID / Touch ID إن توفر', en: 'Face ID / Touch ID if available' },
    'Affichage et fuseau': { ar: 'العرض والمنطقة الزمنية', en: 'Display and timezone' },
    'Aide à améliorer Tabibi (anonymisé)': { ar: 'يساعد في تحسين طبيبي (مجهول)', en: 'Helps improve Tabibi (anonymous)' },
    'Informations légales': { ar: 'المعلومات القانونية', en: 'Legal information' },
    'CGU, confidentialité': { ar: 'الشروط، الخصوصية', en: 'Terms, privacy' },
    'Exporter mon dossier (PDF)': { ar: 'تصدير ملفي (PDF)', en: 'Export my file (PDF)' },
    'Exporter ou télécharger vos informations': { ar: 'تصدير أو تحميل معلوماتك', en: 'Export or download your information' },
    'Demander une copie complète': { ar: 'طلب نسخة كاملة', en: 'Request full copy' },
    'Actions irréversibles': { ar: 'إجراءات لا رجعة فيها', en: 'Irreversible actions' },
    'Gérez les RDV de vos proches depuis votre compte': { ar: 'إدارة مواعيد أقاربك من حسابك', en: 'Manage your relatives appointments from your account' },
    'Historique médical récent': { ar: 'التاريخ الطبي الحديث', en: 'Recent medical history' },
    '3 dernières visites': { ar: 'آخر 3 زيارات', en: 'Last 3 visits' },
    'Dr. Yacine Djalout · Pédiatrie': { ar: 'د. ياسين جالوت · طب الأطفال', en: 'Dr. Yacine Djalout · Pediatrics' },
    'Examen cutané · RAS': { ar: 'فحص الجلد · لا شيء يذكر', en: 'Skin exam · Normal' },
    '8 juin 2022 · Rappel dans 8 ans': { ar: '8 جوان 2022 · تذكير في 8 سنوات', en: 'June 8, 2022 · Reminder in 8 years' },
    'Grippe saisonnière': { ar: 'الإنفلونزا الموسمية', en: 'Seasonal flu' },
    'Consommation d\'alcool régulière': { ar: 'استهلاك منتظم للكحول', en: 'Regular alcohol consumption' },
    'En cas d\'urgence vitale': { ar: 'في حالة طوارئ حيوية', en: 'In case of vital emergency' },
    '(Protection Civile algérienne) ou rendez-vous au service d\'urgences le plus proche.': { ar: '(الحماية المدنية الجزائرية) أو توجه إلى أقرب قسم طوارئ.', en: '(Algerian Civil Protection) or go to the nearest emergency department.' },
    ', composez immédiatement le': { ar: '، اتصل فورًا بـ', en: ', immediately dial' },

    // [I18N-UNIFY-2026] Placeholders de formulaires (traduits automatiquement par translateAttributes)
    'votre@email.com': { ar: 'your@email.com', en: 'your@email.com' },
    'vous@tabibi.dz': { ar: 'you@tabibi.dz', en: 'you@tabibi.dz' },
    'Décrivez brièvement vos symptômes ou le motif de votre visite...': { ar: 'صف بإيجاز أعراضك أو سبب زيارتك...', en: 'Briefly describe your symptoms or reason for visit...' },
    'Allergies connues, médicaments en cours, antécédents importants...': { ar: 'الحساسيات المعروفة، الأدوية الحالية، السوابق المهمة...', en: 'Known allergies, current medications, important history...' },
    'Pénicilline, arachides, lactose...': { ar: 'البنسلين، الفول السوداني، اللاكتوز...', en: 'Penicillin, peanuts, lactose...' },
    'Hypertension, diabète, opérations chirurgicales...': { ar: 'ارتفاع ضغط الدم، السكري، العمليات الجراحية...', en: 'Hypertension, diabetes, surgeries...' },
    'Diabète (père), cancer (mère)...': { ar: 'السكري (الأب)، السرطان (الأم)...', en: 'Diabetes (father), cancer (mother)...' },
    'COVID-19 (rappel 2024), Tétanos (2022)...': { ar: 'كوفيد-19 (تعزيز 2024)، الكزاز (2022)...', en: 'COVID-19 (booster 2024), Tetanus (2022)...' },
    'Numéro de carte CHIFA': { ar: 'رقم بطاقة شيفاء', en: 'CHIFA card number' },
    'Minimum 8 caractères': { ar: '8 أحرف كحد أدنى', en: 'Minimum 8 characters' },
    'Ex : Rythmologie, Échocardiographie': { ar: 'مثال: علم النظم، تخطيط صدى القلب', en: 'Ex: Rhythmology, Echocardiography' },
    'Décrivez vos symptômes...': { ar: 'صف أعراضك...', en: 'Describe your symptoms...' },
    'Min. 8 caractères': { ar: '8 أحرف على الأقل', en: 'Min. 8 characters' },
    'Décrivez vos symptômes, le motif de votre visite...': { ar: 'صف أعراضك، سبب زيارتك...', en: 'Describe your symptoms, reason for visit...' },
    'Partagez votre expérience...': { ar: 'شارك تجربتك...', en: 'Share your experience...' },
    'Allergies connues': { ar: 'الحساسيات المعروفة', en: 'Known allergies' },
    'Vaccinations': { ar: 'التطعيمات', en: 'Vaccinations' },
    'Motif de consultation *': { ar: 'سبب الاستشارة *', en: 'Reason for visit *' },
    'Votre commentaire (optionnel)': { ar: 'تعليقك (اختياري)', en: 'Your comment (optional)' },
    'N° carte CHIFA': { ar: 'رقم بطاقة شيفاء', en: 'CHIFA card N°' }
  };

  // ═══════════════════════════════════════════════════════════════════
  // LOGIC
  // ═══════════════════════════════════════════════════════════════════

  // [I18N-UNIFY-2026] Mapping clés → locales BCP-47 pour Intl.*
  const LOCALES = { fr: 'fr-FR', ar: 'ar-DZ', en: 'en-US' };

  /**
   * Détection langue : 1) localStorage  2) navigator.language  3) fallback FR.
   * [I18N-UNIFY-2026]
   */
  function detectBrowserLang() {
    try {
      const nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase().slice(0, 2);
      if (['fr', 'ar', 'en'].includes(nav)) return nav;
    } catch (e) {}
    return 'fr';
  }

  function getLang() {
    try {
      const l = localStorage.getItem('tabibi_lang');
      if (['fr', 'ar', 'en'].includes(l)) return l;
    } catch (e) {}
    // [I18N-UNIFY-2026] Aucune préférence stockée → détection navigateur
    return detectBrowserLang();
  }

  function T(key) {
    const lang = getLang();
    return (TR[lang] && TR[lang][key]) || (TR.fr && TR.fr[key]) || key;
  }

  /**
   * [I18N-UNIFY-2026] Alias court de T() avec fallback explicite.
   * Usage : tabibiI18n.t('save', 'Save')
   */
  function t(key, fallback) {
    const lang = getLang();
    if (TR[lang] && TR[lang][key]) return TR[lang][key];
    if (TR.fr && TR.fr[key]) return TR.fr[key];
    return fallback !== undefined ? fallback : key;
  }

  /**
   * [I18N-UNIFY-2026] Formate une date selon la langue active.
   * En mode AR utilise locale 'ar-DZ' (français pour l'Algérie, donc mois grégoriens).
   *
   * @param {Date|string|number} date - Date à formater
   * @param {object} options - Options Intl.DateTimeFormat (year/month/day/...)
   * @returns {string} date localisée
   */
  function formatDate(date, options) {
    try {
      const d = (date instanceof Date) ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      const locale = LOCALES[getLang()] || 'fr-FR';
      const opts = options || { year: 'numeric', month: 'long', day: 'numeric' };
      return new Intl.DateTimeFormat(locale, opts).format(d);
    } catch (e) {
      return String(date || '');
    }
  }

  /**
   * [I18N-UNIFY-2026] Formate l'heure selon la langue active.
   */
  function formatTime(date, options) {
    try {
      const d = (date instanceof Date) ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      const locale = LOCALES[getLang()] || 'fr-FR';
      const opts = options || { hour: '2-digit', minute: '2-digit' };
      return new Intl.DateTimeFormat(locale, opts).format(d);
    } catch (e) {
      return String(date || '');
    }
  }

  /**
   * [I18N-UNIFY-2026] Met à jour <title> selon <meta name="tabibi-page-key">.
   * Si la meta est absente, ne touche pas au title.
   */
  function updatePageTitle() {
    try {
      const meta = document.querySelector('meta[name="tabibi-page-key"]');
      if (!meta) return;
      const key = meta.getAttribute('content');
      if (!key) return;
      const titleKey = key.startsWith('title_') ? key : 'title_' + key;
      const lang = getLang();
      const tr = (TR[lang] && TR[lang][titleKey]) || (TR.fr && TR.fr[titleKey]);
      if (tr) document.title = tr;
    } catch (e) {}
  }

  /**
   * Pour un texte FR donné, retourne la traduction si trouvée dans AUTO.
   */
  function translateFR(text) {
    if (!text) return text;
    const lang = getLang();
    if (lang === 'fr') return text;
    const trimmed = text.trim();
    const entry = AUTO[trimmed];
    if (entry && entry[lang]) {
      // Conserver les espaces avant/après
      const leading = text.match(/^\s*/)[0];
      const trailing = text.match(/\s*$/)[0];
      return leading + entry[lang] + trailing;
    }
    return text;
  }

  /**
   * Stocke le texte original FR sur chaque élément la 1ère fois pour pouvoir le restaurer.
   */
  function snapshotOriginal(el, attr) {
    const key = '__orig_' + (attr || 'text');
    if (el[key] !== undefined) return el[key];
    const val = attr ? el.getAttribute(attr) : el.textContent;
    el[key] = val;
    return val;
  }

  /**
   * Parcourir TOUS les nœuds texte d'un élément (récursif) et traduire.
   * Évite de toucher aux balises pour ne pas casser le HTML.
   */
  function translateTextNodes(root) {
    const lang = getLang();
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // Ignorer les nodes vides ou dans <script>/<style>
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if (parent.hasAttribute('data-i18n')) return NodeFilter.FILTER_REJECT; // déjà géré
          if (parent.hasAttribute('data-i18n-skip')) return NodeFilter.FILTER_REJECT;
          if (parent.hasAttribute('data-no-translate')) return NodeFilter.FILTER_REJECT;
          const txt = node.nodeValue;
          if (!txt || !txt.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    const toUpdate = [];
    let n;
    while ((n = walker.nextNode())) toUpdate.push(n);

    toUpdate.forEach(function (node) {
      // Sauvegarder original
      if (node.__origText === undefined) node.__origText = node.nodeValue;
      const original = node.__origText;
      if (lang === 'fr') {
        node.nodeValue = original;
        return;
      }
      const translated = translateFR(original);
      if (translated !== original) {
        node.nodeValue = translated;
      } else {
        // Pas de traduction → garder original FR (mieux qu'un texte vide)
        node.nodeValue = original;
      }
    });
  }

  function applyDataI18n() {
    const lang = getLang();

    // textContent
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const tr = T(key);
      if (tr && tr !== key) el.textContent = tr;
    });

    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      const tr = T(key);
      if (tr && tr !== key) el.setAttribute('placeholder', tr);
    });

    // title
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-title');
      const tr = T(key);
      if (tr && tr !== key) el.setAttribute('title', tr);
    });

    // innerHTML
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-html');
      const tr = T(key);
      if (tr && tr !== key) el.innerHTML = tr;
    });
  }

  function applyAll() {
    const lang = getLang();
    // [FIX 2026-05-19] Delegue le set dir+classes a tabibiLang.applyDir() qui
    // contient le cleanup des [dir="rtl"] lingering sur enfants. Sinon le retour
    // AR -> FR laisse la disposition RTL sur certains elements (placeholder
    // search, cards Spécialités, etc.).
    if (window.tabibiLang && typeof window.tabibiLang.set === 'function') {
      // tabibiLang.set persiste deja en localStorage, ne re-call pas
      // l'event tabibi:lang-change pour eviter une boucle (applyAll est
      // souvent appele DEPUIS un listener tabibi:lang-change). On appelle
      // directement la version interne quand disponible.
      if (typeof window.tabibiLang.applyDir === 'function') {
        window.tabibiLang.applyDir(lang);
      } else {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        if (document.body) document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
      }
    } else {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      if (document.body) document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }

    applyDataI18n();
    if (document.body) translateTextNodes(document.body);
    // [I18N-UNIFY-2026] Traduire aussi les attributs (placeholders, titles, aria-labels) via dict AUTO
    if (document.body) translateAttributes(document.body);
    // [I18N-UNIFY-2026] Met à jour <title> dynamiquement si meta tabibi-page-key présente
    updatePageTitle();
  }

  /**
   * [I18N-UNIFY-2026] Traduit automatiquement les attributs placeholder/title/aria-label/value
   * (input submit) en cherchant le texte FR dans le dictionnaire AUTO.
   * Stocke l'original sur l'élément pour pouvoir restaurer FR.
   */
  function translateAttributes(root) {
    const lang = getLang();
    const attrs = ['placeholder', 'title', 'aria-label'];
    attrs.forEach(function (attr) {
      const sel = '[' + attr + ']';
      const els = root.querySelectorAll(sel);
      els.forEach(function (el) {
        // Ignorer les éléments avec data-i18n-skip ou data-no-translate
        if (el.hasAttribute('data-i18n-skip') || el.hasAttribute('data-no-translate')) return;
        // Ignorer si un data-i18n-<attr> est défini (géré ailleurs)
        if (el.hasAttribute('data-i18n-' + attr)) return;

        // Sauvegarder original FR au 1er passage
        const key = '__orig_' + attr;
        if (el[key] === undefined) el[key] = el.getAttribute(attr);
        const original = el[key];
        if (!original) return;

        if (lang === 'fr') {
          el.setAttribute(attr, original);
          return;
        }
        const translated = translateFR(original);
        el.setAttribute(attr, translated || original);
      });
    });

    // Cas spécial : <input type="submit/button" value="...">
    const submitInputs = root.querySelectorAll('input[type="submit"], input[type="button"], input[type="reset"]');
    submitInputs.forEach(function (el) {
      if (el.hasAttribute('data-i18n-skip')) return;
      if (el.__orig_value === undefined) el.__orig_value = el.value;
      const original = el.__orig_value;
      if (!original) return;
      if (lang === 'fr') { el.value = original; return; }
      el.value = translateFR(original) || original;
    });
  }

  /**
   * Observer le DOM pour traduire les éléments ajoutés dynamiquement.
   * (modales, listes, contenu Supabase chargé après...)
   */
  function startMutationObserver() {
    if (!window.MutationObserver) return;
    const obs = new MutationObserver(function (mutations) {
      const lang = getLang();
      if (lang === 'fr') return; // pas besoin si FR
      let needsRefresh = false;
      mutations.forEach(function (m) {
        if (m.addedNodes && m.addedNodes.length) needsRefresh = true;
        if (m.type === 'characterData') needsRefresh = true;
      });
      if (needsRefresh) {
        // Débouncer pour éviter trop d'appels
        clearTimeout(window.__i18nDebounce);
        window.__i18nDebounce = setTimeout(applyAll, 80);
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false
    });
  }

  // ─── API publique ───
  window.tabibiI18n = {
    T: T,
    // [I18N-UNIFY-2026] Nouvelles méthodes
    t: t,
    formatDate: formatDate,
    formatTime: formatTime,
    locale: function () { return LOCALES[getLang()] || 'fr-FR'; },
    detectBrowserLang: detectBrowserLang,
    updatePageTitle: updatePageTitle,
    // existant
    apply: applyAll,
    lang: getLang,
    addAutoEntry: function (fr, ar, en) {
      AUTO[fr] = { ar: ar, en: en };
      applyAll();
    }
  };

  // [I18N-UNIFY-2026] Helpers globaux pour usage inline (templates), accessibles
  // depuis n'importe quel <script> de page sans dépendre de window.tabibiI18n.* qui
  // peut être chargé après. Si tabibi-i18n.js n'a pas encore tourné, les vieux Date.prototype
  // sont utilisés en fallback.
  window.tabibiFormatDate = formatDate;
  window.tabibiFormatTime = formatTime;
  window.tabibiT = t;

  // Auto-apply au chargement
  function init() {
    applyAll();
    startMutationObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-apply au changement de langue
  document.addEventListener('tabibi:lang-change', applyAll);
  if (window.tabibiLang && typeof window.tabibiLang.onChange === 'function') {
    window.tabibiLang.onChange(applyAll);
  }
})();
