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
    'Je consens au traitement de mes données personnelles selon la': { ar: 'أوافق على معالجة بياناتي الشخصية وفقًا لـ', en: 'I consent to the processing of my personal data according to the' },
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
