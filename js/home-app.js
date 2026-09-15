/* ================================================================
   TABIBI PWA v4.0 — app.js
   <i class='fa fa-circle-check' style='color:var(--green)'></i> 3 comptes fonctionnels (patient / médecin / admin)
   <i class='fa fa-circle-check' style='color:var(--green)'></i> Auth complète + sessions localStorage
   <i class='fa fa-circle-check' style='color:var(--green)'></i> Recherche FR+AR+EN
   <i class='fa fa-circle-check' style='color:var(--green)'></i> Paiements algériens (CIB / Edahabia / Paymee / Espèces / CNAS)
   <i class='fa fa-circle-check' style='color:var(--green)'></i> Traductions FR / AR / EN
   <i class='fa fa-circle-check' style='color:var(--green)'></i> PWA Install + Service Worker
   ================================================================ */

/* [SECU 2026-09-09] Echappement HTML pour toute donnee venant de la base ou de
   l'utilisateur (nom de medecin, specialite, ville, identite du compte). Un nom de
   praticien contenant du HTML s'executait chez chaque visiteur qui le trouvait.
   window.esc est fourni par js/tabibi-security.js ; repli local si absent. */
const hEsc = (v) => (window.esc ? window.esc(v) : String(v == null ? '' : v)
  .replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

/* ══ TRANSLATIONS ═══════════════════════════════════════════ */
const TR = {
  fr:{
    welcome:"Bienvenue",logout_ok:"Déconnecté",bad_creds:"Email ou mot de passe incorrect.",
    fill_all:"Veuillez remplir tous les champs.",pass_short:"Mot de passe : 6 caractères minimum.",
    signup_ok:"Compte créé avec succès !",fav_add:"Ajouté aux favoris <i class='fa fa-heart' style='color:var(--red)'></i>",fav_rm:"Retiré des favoris",
    conn_req:"Connectez-vous pour réserver",reset_ok:"Filtres réinitialisés",
    docs_choose_filter:"Choisissez une wilaya ou une spécialité",docs_choose_filter_sub:"La liste s'affiche dès qu'un de ces deux filtres est renseigné.",no_docs:"Aucun médecin trouvé",try_other:"Essayez d'autres critères",docs_load_err:"Impossible de charger les médecins",docs_load_err_sub:"Vérifiez votre connexion.",retry:"Réessayer",
    cert:"Certifié",urgent:"Urgences",available:"Disponible",rdv:"Prendre RDV",
    found:"médecin(s) trouvé(s)",avis_word:"avis",consult_word:"consult.",
    nav_home:"Accueil",nav_spec:"Spécialités",nav_docs:"Médecins",nav_rdv:"Mes RDV",nav_profile:"Profil",nav_map:"Carte",greeting:"Bonjour",
    login:"Connexion",signup:"Inscription",my_account:"Mon compte",logout:"Déconnexion",
    hero_badge:"Médecins en Algérie",
    hero_title:"Trouvez votre",hero_title_em:"médecin en ligne",hero_title2:"en Algérie",
    hero_sub:"Prenez rendez-vous avec un médecin partout en Algérie — 58 wilayas, 24h/24.",
    s_ph:"Dr. Benali, Cardiologie, Alger...",
    all_cities:"Toutes les wilayas",all_specs:"Toutes les spécialités",
    chip_urg:"Urgences",chip_4:"4 <i class='fa fa-star' style='font-size:.8em;color:#f59e0b'></i> et plus",chip_cheap:"Moins de 2000 DA",chip_fem:"Femmes",
    step1_t:"Recherchez",step1_d:"Filtrez par nom, ville, spécialité, note et prix.",
    step2_t:"Réservez",step2_d:"Choisissez un créneau et confirmez votre RDV en ligne.",
    step3_t:"Consultez",step3_d:"Recevez un SMS de confirmation et rencontrez votre médecin.",
    pay_title:"Mode de paiement",
    pay_cash:"Espèces",pay_cash_s:"Payer au cabinet",
    pay_cib:"Carte CIB",pay_cib_s:"Carte bancaire algérienne (CIB/SATIM)",
    pay_edahabia:"Edahabia",pay_edahabia_s:"Carte Algérie Poste",
    pay_paymee:"Paymee",pay_paymee_s:"Paiement mobile sécurisé",
    pay_ins:"Assurance (CNAS/CASNOS)",pay_ins_s:"Présentez votre carte d'assuré",
    confirm_rdv:"Confirmer le RDV",rdv_ok:"RDV confirmé !",
    slot_req:"Veuillez sélectionner un créneau",reason_req:"Veuillez indiquer le motif",
    sms_ok:"Confirmation SMS envoyée <i class='fa fa-check'></i>",
    cancel_rdv:"Annuler ce rendez-vous ?",rdv_cancelled:"RDV annulé",
    save_ok:"Sauvegardé !",profile_ok:"Profil mis à jour !",
    slot_added:"Créneau ajouté !",slot_fill:"Remplissez tous les champs",
    review_ok:"Avis envoyé avec succès !",rating_req:"Sélectionnez une note",comment_req:"Ajoutez un commentaire",
    install_title:"Installer Tabibi",install_sub:"Accédez à votre médecin sans navigateur",install_btn:"Installer",
    hs1:"Médecins",hs2:"Wilayas",hs3:"Patients",hs4:"Note moy.",
    // [I18N-RES 2026-06-18] cartes annuaire + modale fiche + hero stat (P0 #3)
    not_rated_yet:"Pas encore noté", badge_teleconsult:"Téléconsultation", badge_chifa:"Chifa", badge_card:"Carte",
    price_tbd:"Tarif à confirmer", validation_pending:"Validation en cours", badge_urgent:"Urgences",
    status_bookable:"Réservable", status_unclaimed:"Fiche non réclamée", see_sheet:"Voir la fiche",
    available_slots:"Créneaux disponibles", confirm_slot:"Confirmer ce créneau", about_doctor:"À propos",
    addr_label:"Adresse", langs_label:"Langues", availability_label:"Disponibilité", hours_default:"Lun – Ven • 8h – 18h",
    validation_pending_long:"Validation en cours — réservation bientôt disponible.",
    booking_not_active:"Ce médecin n'a pas encore activé les RDV en ligne.",
    doctor_validating:"Ce médecin est en cours de validation.",
    hero_booking:"Réservation", claim_hint_title:"Vous êtes ce médecin ? Cliquez pour réclamer votre fiche.",
    sb1:"Médecins référencés",sb2:"Wilayas",sb3:"Patients satisfaits",sb4:"Taux de satisfaction",
    patient_role:"Patient",medecin_role:"Médecin",admin_role:"Admin",
    today_rdv:"Consultations du jour",next_rdv:"Prochain rendez-vous",
    days_label:"jours",bonjour:"Bonjour",bonsoir:"Bonsoir",
    my_rdv:"Mes rendez-vous",my_favs:"Mes favoris",dossier:"Dossier médical",my_profile:"Mon profil",
    overview:"Vue générale",agenda:"Agenda",stats:"Statistiques",
    demo_accounts:"Comptes de démonstration :",
    rdv_coming:"À venir",rdv_done:"Terminés",rdv_cancelled_tab:"Annulés",all_rdv:"Tous",
    confirm_status:"Confirmé",pending_status:"En attente",done_status:"Terminé",cancelled_status:"Annulé",
    about:"À propos",diplomes:"Diplômes & Formations",reviews:"Avis patients",add_review:"Laisser un avis",
    your_comment:"Votre commentaire...",send:"Envoyer",
nav_doctors:"Médecins",cta_login:"Se connecter",cta_signup:"Créer un compte",
    sec_specs:"Spécialités",sec_doctors:"Médecins",see_all:"Voir tout →",
    foot_patients:"Patients",foot_doctors:"Médecins",foot_company:"Entreprise",foot_legal:"Légal",
    foot_find_doc:"Trouver un médecin",foot_signin:"Se connecter",foot_signup:"Créer un compte",
    foot_my_rdv:"Mes RDV",foot_become:"Devenir partenaire",foot_pro_space:"Espace pro",foot_claim_fiche:"Réclamer ma fiche",cta_doctor_claim:"Vous êtes médecin ? Réclamez votre fiche",badge_unclaimed:"Non réclamée",
    foot_about:"À propos",foot_careers:"Carrières",foot_press:"Presse",foot_blog:"Blog santé",
    foot_cgu:"CGU",foot_privacy:"Confidentialité",foot_cookies:"Cookies",foot_legal_mentions:"Mentions légales",
    foot_support_24:"Support 7j/7 — 8h à 22h",
    price_max:"Prix max",
    sort_rating:"Mieux notés",sort_price_asc:"Prix ↑",sort_price_desc:"Prix ↓",sort_reviews:"Plus d'avis",
    section_doctors_in_dz:"Médecins référencés en Algérie",
    howto_title:"Comment prendre RDV en ligne ?",
    cta_doc_title:"Vous êtes médecin ?",
    cta_doc_sub:"Rejoignez Tabibi et développez votre patientèle en ligne. Inscription gratuite pendant 30 jours.",
    cta_doc_btn:"Rejoindre Tabibi",
    cta_wl_title:"Rejoignez la waiting list",
    cta_wl_sub:"Soyez parmi les 1ers à découvrir Tabibi · Inscription gratuite"
  },
  ar:{
    welcome:"مرحباً",logout_ok:"تم تسجيل الخروج",bad_creds:"البريد أو كلمة المرور غير صحيحة.",
    fill_all:"يرجى ملء جميع الحقول.",pass_short:"كلمة المرور: 6 أحرف على الأقل.",
    signup_ok:"تم إنشاء الحساب بنجاح!",fav_add:"تمت الإضافة للمفضلة <i class='fa fa-heart' style='color:var(--red)'></i>",fav_rm:"تمت الإزالة من المفضلة",
    conn_req:"سجّل دخولك للحجز",reset_ok:"تمت إعادة التعيين",
    docs_choose_filter:"اختر ولاية أو تخصصًا",docs_choose_filter_sub:"تظهر القائمة بمجرد تحديد أحد هذين الفلترين.",no_docs:"لا يوجد طبيب مطابق",try_other:"حاول تغيير المعايير",
    cert:"معتمد",urgent:"طوارئ",available:"متاح",rdv:"حجز موعد",
    found:"طبيب(ة) وُجد(ت)",avis_word:"تقييم",consult_word:"استشارة",
    nav_home:"الرئيسية",nav_spec:"التخصصات",nav_docs:"الأطباء",nav_rdv:"مواعيدي",nav_profile:"حسابي",nav_map:"الخريطة",greeting:"مرحبا",
    login:"دخول",signup:"تسجيل",my_account:"حسابي",logout:"خروج",
    hero_badge:"أطباء في الجزائر",
    hero_title:"ابحث عن",hero_title_em:"طبيبك",hero_title2:"في كل أنحاء الجزائر",
    hero_sub:"احجز موعدًا مع طبيب في كل أنحاء الجزائر — 58 ولاية، 24/24.",
    s_ph:"د. بن علي، قلب، الجزائر...",
    all_cities:"كل الولايات",all_specs:"كل التخصصات",
    chip_urg:"طوارئ",chip_4:"4 <i class='fa fa-star' style='font-size:.8em;color:#f59e0b'></i> فأكثر",chip_cheap:"أقل من 2000 دج",chip_fem:"نساء",
    step1_t:"ابحث",step1_d:"صفّ حسب الاسم والمدينة والتخصص والسعر.",
    step2_t:"احجز",step2_d:"اختر وقتاً وأكّد موعدك أونلاين.",
    step3_t:"استشر",step3_d:"احصل على تأكيد SMS والتقِ بطبيبك.",
    pay_title:"طريقة الدفع",
    pay_cash:"نقداً",pay_cash_s:"الدفع في العيادة",
    pay_cib:"بطاقة CIB",pay_cib_s:"البطاقة البنكية الجزائرية",
    pay_edahabia:"الذهبية",pay_edahabia_s:"بطاقة بريد الجزائر",
    pay_paymee:"Paymee",pay_paymee_s:"الدفع الإلكتروني الآمن",
    pay_ins:"التأمين (CNAS/CASNOS)",pay_ins_s:"قدّم بطاقة التأمين",
    confirm_rdv:"تأكيد الموعد",rdv_ok:"تم تأكيد الموعد!",
    slot_req:"يرجى اختيار وقت",reason_req:"يرجى ذكر السبب",
    sms_ok:"تم إرسال تأكيد SMS <i class='fa fa-check'></i>",
    cancel_rdv:"إلغاء هذا الموعد؟",rdv_cancelled:"تم إلغاء الموعد",
    save_ok:"تم الحفظ!",profile_ok:"تم تحديث الملف!",
    slot_added:"تمت إضافة الوقت!",slot_fill:"يرجى ملء الحقول",
    review_ok:"تم إرسال التقييم!",rating_req:"اختر تقييماً",comment_req:"أضف تعليقاً",
    install_title:"تثبيت طبيبي",install_sub:"الوصول إلى طبيبك بدون متصفح",install_btn:"تثبيت",
    hs1:"طبيب",hs2:"ولاية",hs3:"مريض",hs4:"التقييم",
    // [I18N-RES 2026-06-18] cartes annuaire + modale fiche + hero stat (P0 #3)
    not_rated_yet:"لم يُقيَّم بعد", badge_teleconsult:"استشارة عن بُعد", badge_chifa:"شيفا", badge_card:"بطاقة",
    price_tbd:"السعر قيد التأكيد", validation_pending:"قيد التحقق", badge_urgent:"حالات طارئة",
    status_bookable:"قابل للحجز", status_unclaimed:"ملف غير مُطالَب به", see_sheet:"عرض الملف",
    available_slots:"المواعيد المتاحة", confirm_slot:"تأكيد هذا الموعد", about_doctor:"نبذة",
    addr_label:"العنوان", langs_label:"اللغات", availability_label:"التوفّر", hours_default:"الاثنين – الجمعة • 08:00 – 18:00",
    validation_pending_long:"قيد التحقق — الحجز متاح قريبًا.",
    booking_not_active:"لم يُفعّل هذا الطبيب الحجز عبر الإنترنت بعد.",
    doctor_validating:"هذا الطبيب قيد التحقق.",
    hero_booking:"الحجز", claim_hint_title:"هل أنت هذا الطبيب؟ انقر للمطالبة بملفك.",
    sb1:"طبيب مُدرج",sb2:"ولاية",sb3:"مريض راضٍ",sb4:"معدل الرضا",
    patient_role:"مريض",medecin_role:"طبيب",admin_role:"مدير",
    today_rdv:"استشارات اليوم",next_rdv:"الموعد القادم",
    days_label:"أيام",bonjour:"صباح الخير",bonsoir:"مساء الخير",
    my_rdv:"مواعيدي",my_favs:"مفضلتي",dossier:"الملف الطبي",my_profile:"ملفي",
    overview:"نظرة عامة",agenda:"جدول المواعيد",stats:"الإحصائيات",
    demo_accounts:"حسابات تجريبية :",
    rdv_coming:"قادمة",rdv_done:"منتهية",rdv_cancelled_tab:"ملغاة",all_rdv:"الكل",
    confirm_status:"مؤكد",pending_status:"قيد الانتظار",done_status:"منتهي",cancelled_status:"ملغي",
    about:"نبذة",diplomes:"الشهادات والتكوين",reviews:"آراء المرضى",add_review:"اترك تقييماً",
    your_comment:"تعليقك...",send:"إرسال",
nav_doctors:"الأطباء",cta_login:"تسجيل الدخول",cta_signup:"إنشاء حساب",
    sec_specs:"التخصصات",sec_doctors:"الأطباء",see_all:"عرض الكل →",
    foot_patients:"المرضى",foot_doctors:"الأطباء",foot_company:"الشركة",foot_legal:"قانوني",
    foot_find_doc:"ابحث عن طبيب",foot_signin:"تسجيل الدخول",foot_signup:"إنشاء حساب",
    foot_my_rdv:"مواعيدي",foot_become:"أصبح شريكا",foot_pro_space:"الفضاء المهني",foot_claim_fiche:"المطالبة بملفي",cta_doctor_claim:"هل أنت طبيب؟ طالب بملفك",badge_unclaimed:"غير مطالب به",
    foot_about:"من نحن",foot_careers:"التوظيف",foot_press:"الصحافة",foot_blog:"مدونة صحية",
    foot_cgu:"الشروط",foot_privacy:"الخصوصية",foot_cookies:"الكوكيز",foot_legal_mentions:"إشعارات قانونية",
    foot_support_24:"الدعم 7/7 — من 8 إلى 22",
    price_max:"السعر الأقصى",
    sort_rating:"الأعلى تقييماً",sort_price_asc:"السعر ↑",sort_price_desc:"السعر ↓",sort_reviews:"الأكثر تقييماً",
    section_doctors_in_dz:"أطباء مُدرجون في الجزائر",
    howto_title:"كيف تحجز موعدك عبر الإنترنت؟",
    cta_doc_title:"هل أنت طبيب؟",
    cta_doc_sub:"انضم إلى طبيبي وطوّر قاعدة مرضاك عبر الإنترنت. تسجيل مجاني لمدة 30 يومًا.",
    cta_doc_btn:"الانضمام إلى طبيبي",
    cta_wl_title:"انضم إلى قائمة الانتظار",
    cta_wl_sub:"كن من الأوائل لاكتشاف طبيبي · تسجيل مجاني"
  },
  en:{
    welcome:"Welcome",logout_ok:"Logged out",bad_creds:"Incorrect email or password.",
    fill_all:"Please fill in all fields.",pass_short:"Password: min 6 characters.",
    signup_ok:"Account created successfully!",fav_add:"Added to favorites <i class='fa fa-heart' style='color:var(--red)'></i>",fav_rm:"Removed from favorites",
    conn_req:"Sign in to book",reset_ok:"Filters reset",
    docs_choose_filter:"Pick a wilaya or a specialty",docs_choose_filter_sub:"The list appears as soon as one of these two filters is set.",no_docs:"No doctors found",try_other:"Try different criteria",
    cert:"Certified",urgent:"Urgent",available:"Available",rdv:"Book",
    found:"doctor(s) found",avis_word:"reviews",consult_word:"consult.",
    nav_home:"Home",nav_spec:"Specialties",nav_docs:"Doctors",nav_rdv:"My Appts",nav_profile:"Profile",nav_map:"Map",greeting:"Hello",
    login:"Sign in",signup:"Sign up",my_account:"My account",logout:"Log out",
    hero_badge:"Doctors across Algeria",
    hero_title:"Find your",hero_title_em:"doctor",hero_title2:"across Algeria",
    hero_sub:"Book an appointment with a doctor anywhere in Algeria — 58 wilayas, 24/7.",
    s_ph:"Dr. Benali, Cardiology, Algiers...",
    all_cities:"All cities",all_specs:"All specialties",
    chip_urg:"Urgent",chip_4:"4 <i class='fa fa-star' style='font-size:.8em;color:#f59e0b'></i> and above",chip_cheap:"Under 2000 DA",chip_fem:"Female",
    step1_t:"Search",step1_d:"Filter by name, city, specialty, rating and price.",
    step2_t:"Book",step2_d:"Choose a slot and confirm your appointment online.",
    step3_t:"Consult",step3_d:"Get an SMS confirmation and meet your doctor.",
    pay_title:"Payment method",
    pay_cash:"Cash",pay_cash_s:"Pay at the clinic",
    pay_cib:"CIB Card",pay_cib_s:"Algerian bank card (CIB/SATIM)",
    pay_edahabia:"Edahabia",pay_edahabia_s:"Algérie Poste card",
    pay_paymee:"Paymee",pay_paymee_s:"Secure mobile payment",
    pay_ins:"Insurance (CNAS/CASNOS)",pay_ins_s:"Show your insurance card",
    confirm_rdv:"Confirm appointment",rdv_ok:"Appointment confirmed!",
    slot_req:"Please select a slot",reason_req:"Please enter the reason",
    sms_ok:"SMS confirmation sent <i class='fa fa-check'></i>",
    cancel_rdv:"Cancel this appointment?",rdv_cancelled:"Appointment cancelled",
    save_ok:"Saved!",profile_ok:"Profile updated!",
    slot_added:"Slot added!",slot_fill:"Please fill in all fields",
    review_ok:"Review sent successfully!",rating_req:"Please select a rating",comment_req:"Add a comment",
    install_title:"Install Tabibi",install_sub:"Access your doctor without a browser",install_btn:"Install",
    hs1:"Doctors",hs2:"Wilayas",hs3:"Patients",hs4:"Avg. rating",
    // [I18N-RES 2026-06-18] annuaire cards + profile modal + hero stat (P0 #3)
    not_rated_yet:"Not rated yet", badge_teleconsult:"Teleconsultation", badge_chifa:"Chifa", badge_card:"Card",
    price_tbd:"Price to confirm", validation_pending:"Validation pending", badge_urgent:"Emergencies",
    status_bookable:"Bookable", status_unclaimed:"Unclaimed profile", see_sheet:"View profile",
    available_slots:"Available slots", confirm_slot:"Confirm this slot", about_doctor:"About",
    addr_label:"Address", langs_label:"Languages", availability_label:"Availability", hours_default:"Mon – Fri • 8am – 6pm",
    validation_pending_long:"Validation in progress — booking available soon.",
    booking_not_active:"This doctor hasn't enabled online booking yet.",
    doctor_validating:"This doctor is being validated.",
    hero_booking:"Booking", claim_hint_title:"Are you this doctor? Click to claim your profile.",
    sb1:"Referenced doctors",sb2:"Wilayas",sb3:"Happy patients",sb4:"Satisfaction rate",
    patient_role:"Patient",medecin_role:"Doctor",admin_role:"Admin",
    today_rdv:"Today's consultations",next_rdv:"Next appointment",
    days_label:"days",bonjour:"Good morning",bonsoir:"Good evening",
    my_rdv:"My appointments",my_favs:"My favorites",dossier:"Medical record",my_profile:"My profile",
    overview:"Overview",agenda:"Agenda",stats:"Statistics",
    demo_accounts:"Demo accounts:",
    rdv_coming:"Upcoming",rdv_done:"Completed",rdv_cancelled_tab:"Cancelled",all_rdv:"All",
    confirm_status:"Confirmed",pending_status:"Pending",done_status:"Completed",cancelled_status:"Cancelled",
    about:"About",diplomes:"Degrees & Training",reviews:"Patient reviews",add_review:"Leave a review",
    your_comment:"Your comment...",send:"Send",
nav_doctors:"Doctors",cta_login:"Sign in",cta_signup:"Sign up",
    sec_specs:"Specialties",sec_doctors:"Doctors",see_all:"See all →",
    foot_patients:"Patients",foot_doctors:"Doctors",foot_company:"Company",foot_legal:"Legal",
    foot_find_doc:"Find a doctor",foot_signin:"Sign in",foot_signup:"Sign up",
    foot_my_rdv:"My appointments",foot_become:"Become partner",foot_pro_space:"Pro space",foot_claim_fiche:"Claim my listing",cta_doctor_claim:"Are you a doctor? Claim your listing",badge_unclaimed:"Unclaimed",
    foot_about:"About",foot_careers:"Careers",foot_press:"Press",foot_blog:"Health blog",
    foot_cgu:"Terms",foot_privacy:"Privacy",foot_cookies:"Cookies",foot_legal_mentions:"Legal notice",
    foot_support_24:"Support 7/7 — 8am to 10pm",
    price_max:"Max price",
    sort_rating:"Top rated",sort_price_asc:"Price ↑",sort_price_desc:"Price ↓",sort_reviews:"Most reviewed",
    section_doctors_in_dz:"Referenced doctors in Algeria",
    howto_title:"How to book online?",
    cta_doc_title:"Are you a doctor?",
    cta_doc_sub:"Join Tabibi and grow your patient base online. Free sign-up for 30 days.",
    cta_doc_btn:"Join Tabibi",
    cta_wl_title:"Join the waiting list",
    cta_wl_sub:"Be among the first to discover Tabibi · Free sign-up"
  }
};

/* ══ COMPTES — AUTHENTIFICATION VIA SUPABASE UNIQUEMENT (v10) ═══
   Les anciens comptes démo hardcodés ont été retirés du code source.
   Tous les comptes (admin, patients, médecins) sont stockés en base
   de données Supabase, jamais en clair dans le client.
   
   Pour tester : utiliser les comptes test créés dans Supabase
   (voir README-v10-SECURITE.md pour les identifiants).
════════════════════════════════════════════════════════════ */
const ACCOUNTS = {};

// Hash SHA-256 hex via Web Crypto (conservé pour usages divers)
async function _sha256Hex(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ══ DOCTORS DATA — chargés depuis Supabase au démarrage ══════ */
let DOCTORS = [];

const SPECS = [
  {name:"Médecine Générale",ar:"طب عام",en:"General Practice",icon:"fa-stethoscope",count:412},
  {name:"Cardiologie",ar:"قلب وأوعية",en:"Cardiology",icon:"fa-heart-pulse",count:98},
  {name:"Pédiatrie",ar:"أطفال",en:"Paediatrics",icon:"fa-baby",count:156},
  {name:"Dentiste",ar:"أسنان",en:"Dentist",icon:"fa-tooth",count:203},
  {name:"Gynécologie",ar:"نسائية",en:"Gynaecology",icon:"fa-user-nurse",count:134},
  {name:"Dermatologie",ar:"جلدية",en:"Dermatology",icon:"fa-leaf",count:87},
  {name:"Ophtalmologie",ar:"عيون",en:"Ophthalmology",icon:"fa-eye",count:76},
  {name:"Orthopédie",ar:"عظام",en:"Orthopaedics",icon:"fa-bone",count:65},
  {name:"Neurologie",ar:"أعصاب",en:"Neurology",icon:"fa-brain",count:54},
  {name:"Radiologie",ar:"أشعة",en:"Radiology",icon:"fa-satellite-dish",count:43},
  {name:"Pneumologie",ar:"رئتين",en:"Pulmonology",icon:"fa-lungs",count:38},
  {name:"Chirurgie Générale",ar:"جراحة عامة",en:"General Surgery",icon:"fa-scissors",count:61},
  {name:"ORL",ar:"أنف أذن حنجرة",en:"ENT",icon:"fa-ear-listen",count:48},
  {name:"Psychiatrie",ar:"طب نفسي",en:"Psychiatry",icon:"fa-brain",count:35},
  {name:"Rhumatologie",ar:"روماتيزم",en:"Rheumatology",icon:"fa-bone",count:30},
  {name:"Urologie",ar:"مسالك بولية",en:"Urology",icon:"fa-droplet",count:42},
  {name:"Endocrinologie",ar:"غدد صماء",en:"Endocrinology",icon:"fa-vial",count:28},
  {name:"Gastro-entérologie",ar:"جهاز هضمي",en:"Gastroenterology",icon:"fa-utensils",count:36},
  {name:"Néphrologie",ar:"كلى",en:"Nephrology",icon:"fa-kit-medical",count:22},
  {name:"Chirurgie Plastique",ar:"جراحة تجميل",en:"Plastic Surgery",icon:"fa-syringe",count:18},
  {name:"Anesthésie",ar:"تخدير",en:"Anaesthesia",icon:"fa-mask",count:25},
  {name:"Oncologie",ar:"أورام",en:"Oncology",icon:"fa-ribbon",count:32},
  {name:"Hématologie",ar:"دم",en:"Haematology",icon:"fa-vial-virus",count:20},
  {name:"Médecine Interne",ar:"طب باطني",en:"Internal Medicine",icon:"fa-stethoscope",count:50},
  {name:"Allergologie",ar:"حساسية",en:"Allergology",icon:"fa-virus",count:24},
  {name:"Phlébologie",ar:"أوردة",en:"Phlebology",icon:"fa-droplet",count:15},
  {name:"Sage-femme",ar:"قابلة",en:"Midwifery",icon:"fa-baby-carriage",count:55},
  {name:"Kinésithérapie",ar:"علاج طبيعي",en:"Physiotherapy",icon:"fa-hand-holding-medical",count:68},
  {name:"Diabétologie",ar:"سكري",en:"Diabetology",icon:"fa-vial",count:40},
  {name:"Psychologie",ar:"علم النفس",en:"Psychology",icon:"fa-brain",count:45},
];

const CITIES = [
  "Alger","Oran","Constantine","Annaba","Blida","Sétif","Tlemcen","Batna",
  "Béjaïa","Biskra","Mostaganem","Médéa","Chlef","Skikda","Souk Ahras",
  "Tiaret","Jijel","Guelma","Relizane","Bordj Bou Arreridj","Tizi Ouzou","Béchar"
];

// [CLEAN 2026-05-18] Donnees demo retirees de la prod.
// Variables conservees vides pour retro-compat avec les imports existants.
// Source de verite: API Supabase (rdv table + rdv_patient view).
const DEMO_RDV = [];
const DEMO_DOC_RDV = [];

// Cache des slots occupés par (doctorId|YYYY-MM-DD)
const TAKEN_SLOTS = [];
window._takenSlotsCache = window._takenSlotsCache || {};

async function loadTakenSlots(doctorId, dateIso, onLoaded){
  if (!doctorId) return;
  if (!dateIso) { dateIso = window.tabibiTemps.ajouterJours(window.tabibiTemps.aujourdhui(), 1); }
  const key = doctorId + '|' + dateIso;
  if (window._takenSlotsCache[key] !== undefined) {
    if (typeof onLoaded === 'function') onLoaded(window._takenSlotsCache[key]);
    return;
  }
  window._takenSlotsCache[key] = [];
  try {
    const SB_URL = (typeof _SB_URL !== 'undefined') ? _SB_URL : 'https://pudugodhiofqrctcdwfl.supabase.co';
    const SB_KEY = (typeof _SB_KEY !== 'undefined') ? _SB_KEY : ((window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || '');
    const url = SB_URL + '/rest/v1/appointments?select=scheduled_at,status&doctor_id=eq.' + encodeURIComponent(doctorId) +
                '&scheduled_at=gte.' + encodeURIComponent(dateIso + 'T00:00:00.000Z') +
                '&scheduled_at=lte.' + encodeURIComponent(dateIso + 'T23:59:59.999Z');
    const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!res.ok) { if (typeof onLoaded === 'function') onLoaded([]); return; }
    const rows = await res.json();
    if (!Array.isArray(rows)) { if (typeof onLoaded === 'function') onLoaded([]); return; }
    const taken = rows
      .filter(r => r.status !== 'cancelled' && r.status !== 'Cancelled')
      .map(r => window.tabibiTemps.heureDe(r.scheduled_at));   // heure du CABINET
    window._takenSlotsCache[key] = taken;
    if (typeof onLoaded === 'function') onLoaded(taken);
  } catch(e) {
    console.warn('[Tabibi] loadTakenSlots:', e && e.message);
    if (typeof onLoaded === 'function') onLoaded([]);
  }
}

function generateSlots() {
  // [12/09/2026] Grille codée en dur supprimée : elle ne reflétait ni working_hours
  // ni le jour d'ouverture. La disponibilité réelle passe par get_available_slots
  // (parcours reservation.html). Conservée vide pour compat d'appel.
  return [];
}

/* ══ LANGUAGE ════════════════════════════════════════════════ */
let lang = localStorage.getItem("tabibi_lang") || "fr";

// [I18N 2026-09-14] CETTE FONCTION ET SON APPELANT ONT CASSE L'ACCUEIL EN PROD.
//
// `TR` ci-dessus est le dictionnaire PRIVE de ce fichier : 207 cles. Le
// dictionnaire du produit, `window.TABIBI_TR`, en a 1509 et vit dans
// `js/i18n/<langue>.js`. Les cles `bc_*`, `v4_*`, `dwh_*` de l'accueil sont
// dans le second, **pas dans le premier**.
//
// Mesure du 14/09 : 80 des 106 elements [data-i18n] d'accueil-public.html
// affichaient leur CLE BRUTE (« bc_confirm », « v4_pay »…) au lieu du texte.
//
// On consulte donc le dictionnaire local D'ABORD — pour ne rien changer aux
// 207 cles qui marchaient — puis le dictionnaire partage.
function T(k) {
  const partage = window.TABIBI_TR || {};
  return TR[lang]?.[k] || TR.fr?.[k]
      || partage[lang]?.[k] || partage.fr?.[k]
      || k;
}

function setLang(l) {
  lang = l;
  localStorage.setItem("tabibi_lang", l);
  // [FIX 2026-05-19] Delegue a tabibiLang.set() pour beneficier du cleanup
  // DOM (suppression des dir="rtl" lingering sur enfants au retour en LTR).
  if (window.tabibiLang && typeof window.tabibiLang.set === 'function') {
    window.tabibiLang.set(l);
  } else {
    // Fallback si tabibi-lang.js pas charge
    document.documentElement.lang = l;
    document.documentElement.dir  = l === "ar" ? "rtl" : "ltr";
    if (document.body) {
      document.body.dir = document.documentElement.dir;
      document.body.classList.remove('lang-fr','lang-ar','lang-en');
      document.body.classList.add('lang-' + l);
    }
    if (l !== 'ar') {
      // Cleanup enfants
      try {
        document.querySelectorAll('[dir="rtl"]').forEach(function(el){
          if (el === document.documentElement || el === document.body) return;
          if (el.hasAttribute('data-rtl-keep')) return;
          el.removeAttribute('dir');
        });
      } catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:372'); }
    }
  }
  // update lang buttons
  document.querySelectorAll("[data-lang-btn]").forEach(b => {
    const active = b.dataset.langBtn === l;
    b.style.background = active ? "var(--blue)" : "transparent";
    b.style.color      = active ? "#fff" : "var(--text3)";
  });
  // translate all [data-i18n] elements
  //
  // [I18N 2026-09-14] **C'EST ICI QUE LA CLE BRUTE S'ECRIVAIT A L'ECRAN.**
  // `T()` retombe sur la cle quand elle est introuvable — c'est son contrat.
  // Mais l'affectation etait INCONDITIONNELLE : elle remplacait le texte
  // francais present dans le HTML par « bc_confirm ».
  //
  // Sans cette ligne, une cle manquante n'aurait RIEN casse : le visiteur
  // aurait lu le texte d'origine. Le defaut n'est pas l'absence de traduction,
  // c'est d'avoir DETRUIT une valeur juste pour y mettre un identifiant.
  // Meme famille que le « 500+ » et le « e-mail envoye » : un repli qui
  // fabrique une valeur fausse au lieu de laisser la vraie.
  //
  // `tabibi-i18n.js` tenait deja cette regle (`if (tr && tr !== key)`). Ce
  // fichier ne la tenait pas.
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const cle = el.dataset.i18n;
    const v = T(cle);
    if (!v || v === cle) return;   // rien de mieux a mettre : on ne touche pas
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = v;
    else el.textContent = v;
  });
  if (typeof onLangChange === "function") onLangChange(l);
}

/* ══ AUTH — CONNEXION / INSCRIPTION / SESSIONS ═══════════════ */
let user = null;

function loadUser() {
  try { const s = localStorage.getItem("tabibi_user"); if (s) user = JSON.parse(s); } catch { user = null; }
  return user;
}
function saveUser(u) { user = u; localStorage.setItem("tabibi_user", JSON.stringify(u)); }
function isLogged()  { return !!user; }
function getRole()   { return user?.role || null; }

/**
 * LOGIN — OBSOLÈTE (v10)
 * L'authentification se fait via Supabase Auth dans login.html.
 * Cette fonction est conservée comme stub pour compatibilité.
 */
async function login(email, password) {
  // v10 : tous les comptes sont sur Supabase, plus de comptes locaux
  console.warn("[index.js] login() local appelée — utilisez Supabase Auth via login.html");
  return null;
}

function logout() { user = null; localStorage.removeItem("tabibi_user"); }

function requireAuth(redirect = "index.html") {
  loadUser();
  if (!isLogged()) { window.location.href = redirect; return false; }
  return true;
}
function requireRole(role, redirect = "index.html") {
  loadUser();
  if (!isLogged() || user.role !== role) { window.location.href = redirect; return false; }
  return true;
}
function redirectByRole(role) {
  const map = { medecin:"doctor-dashboard.html", admin:"admin-dashboard.html" };
  window.location.href = map[role] || "patient-dashboard.html";
}

/* ══ AUTH (redirections) ═══════════════════════════════════════
   Plus aucun formulaire email/mdp dans index.html : la modale d'auth
   a été retirée. Patients & médecins s'authentifient via les pages OTP
   dédiées (login.html / signup.html) ; l'admin garde email/mdp dans
   login.html. openModal() reste un simple shim de redirection pour
   préserver tous ses appelants (gates d'auth, boutons uarea, CTA). */
function openModal(tab) {
  location.href = (tab === "signup") ? "signup.html" : "login.html";
}

function handleLogout() {
  logout(); renderUserUI(); toast(T("logout_ok"),"info");
  const onDash=["patient-dashboard","doctor-dashboard","admin-dashboard"].some(p=>window.location.pathname.includes(p));
  if(onDash) setTimeout(()=>window.location.href="index.html",600);
}

/* ══ USER UI ══════════════════════════════════════════════════ */
function renderUserUI() {
  const d=document.getElementById("uarea-desk"), m=document.getElementById("uarea-mob");
  if (!user) {
    if(d) d.innerHTML=`<button class="btn btn-outline btn-sm" onclick="openModal('login')">${T("login")}</button><button class="btn btn-primary btn-sm" onclick="openModal('signup')">${T("signup")}</button>`;
    if(m) m.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;padding:4px 0"><button class="btn btn-primary btn-full btn-md" onclick="openModal('login')">${T("login")}</button><button class="btn btn-ghost btn-full" onclick="openModal('signup')">${T("signup")}</button></div>`;
    return;
  }
  const rc={patient:T("patient_role"),medecin:T("medecin_role"),admin:T("admin_role")};
  const r=(user.role||"").toLowerCase(),lbl=rc[r]||(r?r:"");
  const bg=user.avatar?.bg||"#e7f3ef",tc=user.avatar?.tc||"#0a4d3e";
  const pill=`
    <div onclick="goDash()" role="button" tabindex="0" style="display:flex;align-items:center;gap:8px;padding:4px 10px 4px 5px;border-radius:var(--rfull);border:1.5px solid var(--border);cursor:pointer;transition:all .12s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="width:28px;height:28px;border-radius:50%;background:${hEsc(bg)};color:${hEsc(tc)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${hEsc(user.initials)}</div>
      <div><div style="font-size:13px;font-weight:700;color:var(--text)">${hEsc(user.name)}</div><div style="font-size:10px;color:var(--text3)">${hEsc(lbl)}</div></div>
    </div>
    <button type="button" class="btn btn-icon btn-icon-sm btn-ghost" onclick="handleLogout()" title="${T('logout')}" aria-label="${T('logout')}"><i class='fa fa-right-from-bracket'></i></button>`;
  if(d) d.innerHTML=pill;
  if(m) m.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);margin-bottom:8px">
      <div style="width:38px;height:38px;border-radius:50%;background:${hEsc(bg)};color:${hEsc(tc)};display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:13px">${hEsc(user.initials)}</div>
      <div><div style="font-size:14px;font-weight:700">${hEsc(user.name)}</div><div style="font-size:11px;color:var(--text3)">${hEsc(lbl)}</div></div>
    </div>
    <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:10px" onclick="goDash()"><i class='fa fa-chart-line'></i> Tableau de bord</button>
    <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:10px;color:var(--red);margin-top:6px;border-color:var(--red-l)" onclick="handleLogout()"><i class='fa fa-right-from-bracket'></i> ${T("logout")}</button>`;
}
function goDash(){const r=user?.role;window.location.href=r==="medecin"?"doctor-dashboard.html":r==="admin"?"admin-dashboard.html":"patient-dashboard.html";}

/* ══ TOAST ════════════════════════════════════════════════════ */
// [XSS 2026-09-14] `msg` ETAIT INJECTE EN HTML, et il n'est pas toujours a nous.
//
// L'appel le plus parlant etait celui de l'echec de reservation :
//
//     var _bkMsg = _bkServerError ? (" (" + String(_bkServerError).slice(0,160) + ")") : "";
//     toast("<i …></i> Echec de la reservation…" + _bkMsg, "error", 8000);
//
// `_bkServerError` est un message d'erreur **du serveur**. Une erreur Postgres
// cite volontiers la valeur qui l'a provoquee — c'est-a-dire une saisie de
// l'utilisateur, renvoyee telle quelle et rendue comme du HTML. Le chemin
// complet d'un XSS reflechi, sur la page de reservation.
//
// Desormais : **le message est du TEXTE** (`textContent`), et l'icone est
// construite a part, a partir de la table interne `icons` — jamais d'une
// entree. Le seul moyen d'y mettre du HTML est de le demander explicitement,
// pour les trois libelles du dictionnaire qui en contiennent volontairement.
//
// On ne « nettoie » pas le message : on cesse de l'interpreter. Un assainisseur
// est une liste de ce qu'on a pense a interdire ; `textContent` n'interprete
// rien, et il n'y a rien a oublier.
function toast(msg,type="info",ms=3500,opts){
  let c=document.getElementById("toast-wrap");
  if(!c){c=document.createElement("div");c.id="toast-wrap";c.className="toast-wrap";document.body.appendChild(c);}
  const icons={success:"fa-check-circle",error:"fa-circle-xmark",info:"fa-circle-info"};
  const t=document.createElement("div");
  t.className=`toast toast-${type}`;t.setAttribute("role","alert");
  const ico=document.createElement("i");
  ico.className="fa "+(icons[type]||icons.info);
  ico.setAttribute("aria-hidden","true");
  t.appendChild(ico);
  if(opts&&opts.html===true){
    // Reserve aux libelles de NOTRE dictionnaire (fav_add, fav_rm, sms_ok) qui
    // portent une icone. Jamais pour une donnee qui vient d'ailleurs.
    const span=document.createElement("span");span.innerHTML=String(msg==null?"":msg);t.appendChild(span);
  }else{
    t.appendChild(document.createTextNode(String(msg==null?"":msg)));
  }
  c.appendChild(t);
  setTimeout(()=>{t.style.transition="all .28s";t.style.opacity="0";t.style.transform="translateY(-6px)";setTimeout(()=>t.remove(),300);},ms);
}
function hideLoading(){document.getElementById("loading")?.classList.add("hidden");}
function showLoading(){document.getElementById("loading")?.classList.remove("hidden");}

/* ══ HELPERS ══════════════════════════════════════════════════ */
function stars(n,max=5){
  let h='';
  for(let i=1;i<=max;i++) h+=i<=Math.round(n)?'<i class="fa fa-star" style="color:#f59e0b;font-size:inherit"></i>':'<i class="fa fa-star" style="color:var(--border);font-size:inherit"></i>';
  return h;
}
function dname(d){return lang==="ar"?(d.ar||d.fr):lang==="en"?(d.en||d.fr):d.fr;}
/* ─── i18n SPÉCIALITÉS (FR ↔ AR ↔ EN) ─── */
const SPEC_I18N = {
  'Médecine Gén.':{ar:'طب عام',en:'General Med.'},
  'Cardiologie':{ar:'أمراض القلب',en:'Cardiology'},
  'Pédiatrie':{ar:'طب الأطفال',en:'Pediatrics'},
  'Dentiste':{ar:'طب الأسنان',en:'Dentist'},
  'Gynécologie':{ar:'أمراض النساء',en:'Gynecology'},
  'Dermatologie':{ar:'الأمراض الجلدية',en:'Dermatology'},
  'Ophtalmologie':{ar:'طب العيون',en:'Ophthalmology'},
  'ORL':{ar:'أنف وأذن وحنجرة',en:'ENT'},
  'Psychiatrie':{ar:'الطب النفسي',en:'Psychiatry'},
  'Neurologie':{ar:'طب الأعصاب',en:'Neurology'},
  'Radiologie':{ar:'الأشعة',en:'Radiology'},
  'Chirurgie':{ar:'الجراحة',en:'Surgery'},
  'Orthopédie':{ar:'طب العظام',en:'Orthopedics'},
  'Urologie':{ar:'المسالك البولية',en:'Urology'},
  'Pneumologie':{ar:'طب الرئة',en:'Pulmonology'},
  'Rhumatologie':{ar:'طب الروماتيزم',en:'Rheumatology'},
  'Endocrinologie':{ar:'الغدد الصماء',en:'Endocrinology'},
  'Gastro-entérologie':{ar:'أمراض الجهاز الهضمي',en:'Gastroenterology'},
  'Néphrologie':{ar:'طب الكلى',en:'Nephrology'},
  'Kinésithérapie':{ar:'العلاج الطبيعي',en:'Physiotherapy'},
  'Méd. du travail':{ar:'طب العمل',en:'Occupational Med.'},
  'Biologie médicale':{ar:'البيولوجيا الطبية',en:'Medical Biology'}
};
/* ─── i18n WILAYAS (FR ↔ AR ↔ EN) ─── */
const WILAYA_I18N = {
  'Alger':{ar:'الجزائر',en:'Algiers'},'Oran':{ar:'وهران',en:'Oran'},
  'Constantine':{ar:'قسنطينة',en:'Constantine'},'Annaba':{ar:'عنابة',en:'Annaba'},
  'Blida':{ar:'البليدة',en:'Blida'},'Sétif':{ar:'سطيف',en:'Setif'},
  'Tizi Ouzou':{ar:'تيزي وزو',en:'Tizi Ouzou'},'Tlemcen':{ar:'تلمسان',en:'Tlemcen'},
  'Béjaïa':{ar:'بجاية',en:'Bejaia'},'Batna':{ar:'باتنة',en:'Batna'},
  'Sidi Bel Abbès':{ar:'سيدي بلعباس',en:'Sidi Bel Abbes'},
  'Mostaganem':{ar:'مستغانم',en:'Mostaganem'},
  'Bordj Bou Arréridj':{ar:'برج بوعريريج',en:'Bordj Bou Arreridj'},
  'Tamanrasset':{ar:'تمنراست',en:'Tamanrasset'},'Ouargla':{ar:'ورقلة',en:'Ouargla'},
  'Adrar':{ar:'أدرار',en:'Adrar'},'Chlef':{ar:'الشلف',en:'Chlef'},
  'Laghouat':{ar:'الأغواط',en:'Laghouat'},'Oum El Bouaghi':{ar:'أم البواقي',en:'Oum El Bouaghi'},
  'Biskra':{ar:'بسكرة',en:'Biskra'},'Béchar':{ar:'بشار',en:'Bechar'},
  'Bouira':{ar:'البويرة',en:'Bouira'},'Tébessa':{ar:'تبسة',en:'Tebessa'},
  'Tiaret':{ar:'تيارت',en:'Tiaret'},'Djelfa':{ar:'الجلفة',en:'Djelfa'},
  'Jijel':{ar:'جيجل',en:'Jijel'},'Saïda':{ar:'سعيدة',en:'Saida'},
  'Skikda':{ar:'سكيكدة',en:'Skikda'},'Guelma':{ar:'قالمة',en:'Guelma'},
  'Médéa':{ar:'المدية',en:'Medea'},"M'Sila":{ar:'المسيلة',en:"M'Sila"},
  'Mascara':{ar:'معسكر',en:'Mascara'},'El Bayadh':{ar:'البيض',en:'El Bayadh'},
  'Illizi':{ar:'إليزي',en:'Illizi'},'Boumerdès':{ar:'بومرداس',en:'Boumerdes'},
  'El Tarf':{ar:'الطارف',en:'El Tarf'},'Tindouf':{ar:'تندوف',en:'Tindouf'},
  'Tissemsilt':{ar:'تيسمسيلت',en:'Tissemsilt'},'El Oued':{ar:'الوادي',en:'El Oued'},
  'Khenchela':{ar:'خنشلة',en:'Khenchela'},'Souk Ahras':{ar:'سوق أهراس',en:'Souk Ahras'},
  'Tipaza':{ar:'تيبازة',en:'Tipaza'},'Mila':{ar:'ميلة',en:'Mila'},
  'Aïn Defla':{ar:'عين الدفلى',en:'Ain Defla'},'Naâma':{ar:'النعامة',en:'Naama'},
  'Aïn Témouchent':{ar:'عين تموشنت',en:'Ain Temouchent'},
  'Ghardaïa':{ar:'غرداية',en:'Ghardaia'},'Relizane':{ar:'غليزان',en:'Relizane'}
};
function dspec(d){
  const fr = d.spec || '';
  if (lang === 'fr' || !fr) return fr;
  // Si une traduction existe pour la valeur AR/EN précalculée, l'utiliser
  if (lang === 'ar' && d.sAr) return d.sAr;
  if (lang === 'en' && d.sEn) return d.sEn;
  // Sinon fallback sur le dictionnaire
  const t = SPEC_I18N[fr];
  if (t) return lang === 'ar' ? t.ar : t.en;
  return fr; // pas de traduction = on garde le FR
}
function dcity(d){
  const fr = d.ville || '';
  if (lang === 'fr' || !fr) return fr;
  if (lang === 'ar' && d.vAr) return d.vAr;
  if (lang === 'en' && d.vEn) return d.vEn;
  const t = WILAYA_I18N[fr];
  if (t) return lang === 'ar' ? t.ar : t.en;
  return fr;
}
function sname(s){return lang==="ar"?s.ar:lang==="en"?s.en:s.name;}
function getParam(k){return new URLSearchParams(window.location.search).get(k);}
function scrollTo$(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});}
function daysUntil(d){return Math.max(0,Math.ceil((new Date(d)-new Date())/(1000*60*60*24)));}

/* ── Name search (multilingual) ───────────────────────────── */
function searchByName(q,docs){
  if(!q||!q.trim()) return docs;
  const ql=q.toLowerCase().trim();
  return docs.filter(d=>
    d.fr.toLowerCase().includes(ql)||d.ar.includes(ql)||d.en.toLowerCase().includes(ql)||
    d.spec.toLowerCase().includes(ql)||(d.sEn||"").toLowerCase().includes(ql)||d.ville.toLowerCase().includes(ql)
  );
}

/* ══ FAVORITES ════════════════════════════════════════════════ */
function getFavs(){try{return JSON.parse(localStorage.getItem("tabibi_favs")||"[]");}catch{return[];}}
function isFav(id){return getFavs().includes(id);}
function toggleFav(id,btn){
  const f=getFavs(),i=f.indexOf(id);
  if(i>-1){f.splice(i,1);toast(T("fav_rm"),"info",3500,{html:true});}else{f.push(id);toast(T("fav_add"),"success",3500,{html:true});}
  localStorage.setItem("tabibi_favs",JSON.stringify(f));
  const act=f.includes(id);
  document.querySelectorAll(`[data-fid="${id}"]`).forEach(b=>{b.classList.toggle("is-fav",act);b.querySelector("i").className=act?"fa fa-heart":"far fa-heart";});
  return act;
}

/* ══ PAYMENTS ═════════════════════════════════════════════════ */
const PAY_METHODS = {
  cash:     {key:"pay_cash",     sub:"pay_cash_s",     icon:"fa-money-bill-wave",color:"#22c55e"},
  cib:      {key:"pay_cib",      sub:"pay_cib_s",      icon:"fa-credit-card",color:"#0F7560"},
  edahabia: {key:"pay_edahabia", sub:"pay_edahabia_s", icon:"fa-circle",color:"#f59e0b"},
  paymee:   {key:"pay_paymee",   sub:"pay_paymee_s",   icon:"fa-mobile-screen",color:"#8b5cf6"},
  insurance:{key:"pay_ins",      sub:"pay_ins_s",      icon:"fa-hospital",color:"#06b6d4"}
};
function renderPayMethods(sel){
  return Object.entries(PAY_METHODS).map(([id,m])=>`
    <div class="pay-card${sel===id?" sel":""}" onclick="selectPay('${id}',this)">
      <input type="radio" name="pay" value="${id}" ${sel===id?"checked":""}>
      <div class="pay-logo" style="background:${m.color}1a;color:${m.color}">${m.icon.startsWith&&m.icon.startsWith("fa-")?`<i class='fa ${m.icon}'></i>`:m.icon}</div>
      <div class="pay-info"><h4>${T(m.key)}</h4><p>${T(m.sub)}</p></div>
    </div>`).join("");
}
function selectPay(id,el){
  window._pay=id;
  document.querySelectorAll(".pay-card").forEach(c=>c.classList.remove("sel"));
  el.classList.add("sel");el.querySelector("input[type=radio]").checked=true;
}

/* ══ BOTTOM NAV ═══════════════════════════════════════════════
   [Phase 0] initTabBar()/tabClick() extraits → js/tabibi-nav.js
   (chargé juste après <nav id="tab-bar">, expose window.initTabBar
   + window.tabClick — mêmes hooks openMapOverlay/isLogged/goDash). */
// ══ [CARTE 2026-07-09] Leaflet RÉEL (fin du placeholder B5) ══════════
// Pins = médecins RÉCLAMÉS avec coordonnées (consentement — jamais d'adresse
// pour les non-réclamés). Compteurs par wilaya sur les chefs-lieux (estimated,
// cache session). Filtres wilaya/spécialité clonés des selects de la page
// (donc déjà traduits). Vendorisé : assets/vendor/leaflet (CSP _headers OK).
let _tbMap=null,_tbPins=null,_tbBubbles=null,_tbDocs=[],_tbCounts=null;
function _tbEsc(x){return String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function _tbLeaflet(cb){
  if(window.L) return cb();
  const l=document.createElement('link'); l.rel='stylesheet'; l.href='assets/vendor/leaflet/leaflet.css'; document.head.appendChild(l);
  const s=document.createElement('script'); s.src='assets/vendor/leaflet/leaflet.js'; s.onload=cb;
  s.onerror=function(){ const c=document.getElementById('map-canvas'); if(c) c.innerHTML='<div class="tb-map-err">Carte indisponible pour le moment.</div>'; };
  document.body.appendChild(s);
}
function openMapOverlay(){
  const ov=document.getElementById("map-overlay"); if(!ov) return;
  ov.hidden=false; document.body.style.overflow="hidden";
  if(!window._mapInited){ window._mapInited=true; _tbLeaflet(_tbInitMap); }
  else if(_tbMap){ setTimeout(function(){ _tbMap.invalidateSize(); },60); }
}
function closeMapOverlay(){
  const ov=document.getElementById("map-overlay");
  if(ov) ov.hidden=true;
  document.body.style.overflow="";
}
function _tbInitMap(){
  _tbMap=L.map('map-canvas',{zoomControl:true}).setView([28.4,2.8],5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(_tbMap);
  _tbBubbles=L.layerGroup().addTo(_tbMap);
  _tbPins=L.layerGroup().addTo(_tbMap);
  _tbBuildMapBar();
  _tbLoadPins(); _tbLoadCounts();
  setTimeout(function(){ _tbMap.invalidateSize(); },80);
}
function _tbBuildMapBar(){
  const bar=document.querySelector('.map-ov-bar'); if(!bar||document.getElementById('map-f-w')) return;
  const selW=document.getElementById('f-ville'), selS=document.getElementById('f-spec');
  const wrap=document.createElement('div'); wrap.className='tb-map-filters';
  wrap.innerHTML='<select id="map-f-w" class="form-control">'+(selW?selW.innerHTML:'<option value="">Toutes les wilayas</option>')
    +'</select><select id="map-f-s" class="form-control">'+(selS?selS.innerHTML:'<option value="">Toutes les spécialités</option>')
    +'</select><span class="tb-map-count" id="map-count"></span>';
  bar.appendChild(wrap);
  document.getElementById('map-f-w').onchange=_tbMapFilter;
  document.getElementById('map-f-s').onchange=_tbMapFilter;
}
// [ORDRE-IMPORTS 2026-09-12] La clé est lue À CHAQUE APPEL, jamais capturée à
// l'évaluation du module. Le point d'entrée importait home-app.js AVANT
// config.js : window.TABIBI_CONFIG n'existait pas encore, _SB_KEY valait la
// chaîne vide pour toute la durée de vie de la page, et chaque requête partait
// avec « apikey: » vide. Supabase répondait 401 « No API key found in request »,
// silencieusement : la recherche publique ne rendait rien et aucune erreur ne
// s'affichait. Lire au moment de l'appel rend l'ordre des imports sans effet.
function _tbCle(){ return (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || ''; }
function _tbHdrs(extra){ var k = _tbCle(); return Object.assign({apikey:k,Authorization:'Bearer '+k},extra||{}); }
// [C1 2026-09-09] La vue public_doctors n'est plus lisible par le front.
// Tout passe par des RPC PostgREST (POST /rest/v1/rpc/<nom>) :
//   chercher_praticiens (≤50/page, wilaya OU spécialité obligatoire),
//   praticiens_carte (épingles), stats_publiques (compteurs + listes de filtres).
function _tbRpc(nom, args, signal){
  return fetch(_SB_URL+'/rest/v1/rpc/'+nom, {
    method:'POST',
    headers:_tbHdrs({'Content-Type':'application/json'}),
    body:JSON.stringify(args||{}),
    signal:signal
  });
}
let _tbStatsPromise = null;
function _tbStats(){
  if(_tbStatsPromise) return _tbStatsPromise;
  try{
    const c = JSON.parse(sessionStorage.getItem('tb_stats_v2')||'null');
    if(c && c.t && (Date.now()-c.t) < 3600e3 && c.v){ _tbStatsPromise = Promise.resolve(c.v); return _tbStatsPromise; }
  }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:_tbStats'); }
  _tbStatsPromise = _tbRpc('stats_publiques', {})
    .then(function(r){ if(!r.ok) throw new Error('stats_publiques HTTP '+r.status); return r.json(); })
    .then(function(v){
      v = v || {};
      try{ sessionStorage.setItem('tb_stats_v2', JSON.stringify({t:Date.now(), v:v})); }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:_tbStats'); }
      return v;
    })
    .catch(function(e){ _tbStatsPromise = null; console.warn('[Tabibi] stats_publiques KO', e && e.message); return {}; });
  return _tbStatsPromise;
}
function _tbLoadPins(){
  _tbRpc('praticiens_carte', {})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(d){ _tbDocs=d||[]; _tbRenderPins(); })
    .catch(function(){ _tbDocs=[]; _tbRenderPins(); });
}
function _tbRenderPins(){
  if(!_tbPins) return; _tbPins.clearLayers();
  const w=(document.getElementById('map-f-w')||{}).value||'';
  const s=(document.getElementById('map-f-s')||{}).value||'';
  _tbDocs.filter(function(d){return (!w||(d.wilaya_fr||'')===w)&&(!s||(d.specialty_fr||'')===s);}).forEach(function(d){
    const ic=L.divIcon({className:'',html:'<div class="tb-pin"><i class="fa fa-user-doctor"></i></div>',iconSize:[34,34],iconAnchor:[17,32],popupAnchor:[0,-30]});
    const m=L.marker([d.latitude,d.longitude],{icon:ic});
    const note=d.rating?('<span class="tb-rate">★ '+Number(d.rating).toFixed(1)+'</span>'+(d.review_count?' · '+d.review_count+' avis':'')):'';
    m.bindPopup('<div class="tb-pop"><b>'+_tbEsc(d.full_name)+'</b><br>'+_tbEsc(d.specialty_fr||'')+(d.city?' · '+_tbEsc(d.city):'')+'<br>'+note
      +'<button class="tb-pop-btn" onclick="closeMapOverlay();_tbOpenDoc(\''+_tbEsc(d.id)+'\')"><i class="fa fa-user-doctor"></i> Voir la fiche</button></div>');
    _tbPins.addLayer(m);
  });
  _tbUpdateCount();
}
function _tbOpenDoc(id){
  try{ if(typeof goDoc==='function'&&typeof DOCTORS!=='undefined'&&DOCTORS.find(function(x){return x.id===id;})){ goDoc(id); return; } }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:688'); }
  window.location.href='doctor-profile.html?id='+encodeURIComponent(id);
}
function _tbLoadCounts(){
  try{ const c=sessionStorage.getItem('tb_map_wcounts_v1'); if(c){ _tbCounts=JSON.parse(c); _tbRenderBubbles(); return; } }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:692'); }
  const codes=Object.keys(window.DZ_WILAYAS||{});
  // [C1] 1 seul appel agrégé (stats_publiques.par_wilaya) au lieu de 58 COUNT.
  _tbStats().then(function(st){
    const par=(st&&st.par_wilaya)||{};
    _tbCounts={}; codes.forEach(function(code){ _tbCounts[code]=parseInt(par[String(parseInt(code,10))],10)||0; });
    try{ sessionStorage.setItem('tb_map_wcounts_v1',JSON.stringify(_tbCounts)); }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:700'); }
    _tbRenderBubbles();
  });
}
function _tbRenderBubbles(){
  if(!_tbBubbles||!window.DZ_WILAYAS||!_tbCounts) return; _tbBubbles.clearLayers();
  const w=(document.getElementById('map-f-w')||{}).value||'';
  Object.keys(DZ_WILAYAS).forEach(function(code){
    const info=DZ_WILAYAS[code], n=_tbCounts[code]||0; if(!n) return;
    if(w && info.name!==w) return;
    const label=n>=1000?(Math.round(n/100)/10)+'k':String(n);
    const ic=L.divIcon({className:'',html:'<div class="tb-bubble">'+label+'</div>',iconSize:[46,30],iconAnchor:[23,15]});
    const m=L.marker([info.lat,info.lng],{icon:ic});
    m.bindTooltip(info.name+' · ≈ '+n.toLocaleString('fr-DZ')+' médecins',{direction:'top'});
    m.on('click',function(){
      const sw=document.getElementById('map-f-w');
      if(sw){ const opt=Array.prototype.find.call(sw.options,function(o){return o.value===info.name||o.textContent.trim()===info.name;}); if(opt) sw.value=opt.value; }
      _tbMapFilter(code);
    });
    _tbBubbles.addLayer(m);
  });
  _tbUpdateCount();
}
function _tbMapFilter(zoomCode){
  _tbRenderPins(); _tbRenderBubbles();
  const w=(document.getElementById('map-f-w')||{}).value||'';
  if(zoomCode && window.DZ_WILAYAS && DZ_WILAYAS[zoomCode]){ _tbMap.setView([DZ_WILAYAS[zoomCode].lat,DZ_WILAYAS[zoomCode].lng],9,{animate:false}); return; }
  if(w && window.DZ_WILAYAS){
    const e=Object.keys(DZ_WILAYAS).map(function(k){return DZ_WILAYAS[k];}).find(function(i){return i.name===w;});
    if(e){ _tbMap.setView([e.lat,e.lng],9,{animate:false}); return; }
  }
  _tbMap.setView([28.4,2.8],5,{animate:false});
}
function _tbUpdateCount(){
  // [FIX 2026-07-09] count=estimated sous-évalue (37 517 vs 75 033 réels — cf.
  // note PERF 57014 plus bas) : le TOTAL affiche le libellé vitrine canonique,
  // les bulles restent une répartition indicative (≈).
  const el=document.getElementById('map-count'); if(!el) return;
  const pins=_tbDocs.length;
  const lbl=(typeof TABIBI_DOCTOR_COUNT_LABEL!=='undefined'?TABIBI_DOCTOR_COUNT_LABEL:'75 000+');
  el.textContent = pins ? (pins+' géolocalisés · '+lbl+' référencés')
                        : lbl+' médecins référencés';
}

/* ══ INSTALL PWA ══════════════════════════════════════════════ */
// [Phase 5.4 fix BUG #3] 3 améliorations UX :
//   (a) Skip si déjà installé (matchMedia display-mode:standalone)
//   (b) Auto-hide après 12s d'inactivité (banner laissé non-cliqué)
//   (c) Dismiss persistant 7j déjà OK (localStorage tabibi_install_dismissed)
// + CSS : X plus visible (40×40 + bg .35 + bold) — voir styles/app.css
let _deferredPWA=null;
let _bannerAutoHide=null;
function _isStandalone(){
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true; // iOS Safari
  } catch(e) { return false; }
}
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();_deferredPWA=e;
  // [BUG #3-a] Si app déjà installée → ne JAMAIS afficher le banner
  if (_isStandalone()) return;
  // Respecter le dismiss : ne pas réafficher pendant 7 jours
  try {
    const dismissed = parseInt(localStorage.getItem("tabibi_install_dismissed")||"0",10);
    if (dismissed && (Date.now() - dismissed) < 7*24*60*60*1000) return;
  } catch (err) { (window.tabibiErreur || console.warn)(err, 'home-app.js:766'); }
  setTimeout(()=>{
    const b=document.getElementById("install-banner");
    if(b){
      b.classList.add("show");
      // Pousser le contenu pour ne pas cacher le footer
      document.body.style.paddingBottom = (b.offsetHeight + 16) + "px";
      // [BUG #3-b] Auto-hide après 12s pour ne pas bloquer la navigation
      _bannerAutoHide = setTimeout(()=>{
        if(b.classList.contains("show")){
          b.classList.remove("show");
          document.body.style.paddingBottom="";
        }
      }, 12000);
    }
  },4000);
});
window.addEventListener("appinstalled",()=>{
  const b=document.getElementById("install-banner");if(b)b.classList.remove("show");
  if(_bannerAutoHide){clearTimeout(_bannerAutoHide);_bannerAutoHide=null;}
});
function triggerInstall(){
  if(_bannerAutoHide){clearTimeout(_bannerAutoHide);_bannerAutoHide=null;}
  if(_deferredPWA){_deferredPWA.prompt();_deferredPWA.userChoice.then(()=>{const b=document.getElementById("install-banner");if(b)b.classList.remove("show");_deferredPWA=null;});}
}
function dismissInstall(){
  if(_bannerAutoHide){clearTimeout(_bannerAutoHide);_bannerAutoHide=null;}
  const b=document.getElementById("install-banner");
  if(b){
    b.classList.remove("show");
    document.body.style.paddingBottom="";
  }
  try{localStorage.setItem("tabibi_install_dismissed",String(Date.now()));}catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:798'); }
}

/* ══ SERVICE WORKER ═══════════════════════════════════════════ */
/* SW désactivé en local — réactivé en HTTPS */

/* ══ SHARED INIT ══════════════════════════════════════════════ */
function initApp(){
  loadUser();
  setLang(lang);
  renderUserUI();
  hideLoading();

  // Auto-filter from URL params (depuis pages SEO)
  // Format : ?specialty=cardiologie&wilaya=alger
  setTimeout(function(){
    var sp = getParam("specialty");
    var wi = getParam("wilaya");
    if (!sp && !wi) return;
    var ss = document.getElementById("f-spec");
    var vs = document.getElementById("f-ville");
    var matched = false;
    if (sp && ss) {
      var spNorm = _norm(sp);
      for (var i=0; i<SPECS.length; i++) {
        if (_norm(SPECS[i].name) === spNorm || _norm(SPECS[i].en||"") === spNorm) {
          ss.value = SPECS[i].name;
          matched = true;
          break;
        }
      }
    }
    if (wi && vs) {
      var wiNorm = _norm(wi);
      for (var j=0; j<CITIES.length; j++) {
        if (_norm(CITIES[j]) === wiNorm) {
          vs.value = CITIES[j];
          matched = true;
          break;
        }
      }
    }
    if (matched && typeof doFilter === "function") {
      doFilter();
      setTimeout(function(){ scrollTo$("sec-docs"); }, 150);
      if (typeof renderSpecs === "function") renderSpecs();
    }
  }, 300);
}
document.addEventListener("DOMContentLoaded",initApp);

/* ══ GLOBAL EXPOSE ════════════════════════════════════════════ */
Object.assign(window,{
  TR,T,lang,setLang,
  DOCTORS,SPECS,CITIES,ACCOUNTS,DEMO_RDV,DEMO_DOC_RDV,generateSlots,TAKEN_SLOTS,
  user,loadUser,isLogged,getRole,login,logout,requireAuth,requireRole,redirectByRole,saveUser,
  openModal,handleLogout,
  renderUserUI,goDash,
  toast,showLoading,hideLoading,
  stars,dname,dspec,dcity,sname,searchByName,getParam,scrollTo$,daysUntil,
  getFavs,isFav,toggleFav,
  renderPayMethods,selectPay,PAY_METHODS,
  triggerInstall,dismissInstall
});
/* [Phase 0] initTabBar/tabClick ne sont plus exportés ici : posés sur
   window par js/tabibi-nav.js (chargé plus haut, avant ce script). */


/* ═══ PAGE LOGIC ═══════════════════════════════════════════ */
let filtered=[], curPage=1;
const PER=7;

function populateSelects(){
  const vs=document.getElementById("f-ville"),ss=document.getElementById("f-spec");
  if (!vs || !ss) return;
  // Mémoriser sélection actuelle
  const curV = vs.value, curS = ss.value;
  // Vider sauf la première option (placeholder "Toutes les wilayas/spécialités")
  while (vs.children.length > 1) vs.removeChild(vs.lastChild);
  while (ss.children.length > 1) ss.removeChild(ss.lastChild);

  // [Phase 5.6 fix] Source des wilayas : DB DISTINCT si dispo, sinon CITIES.
  const wilayaSrc = (Array.isArray(window._DB_WILAYAS) && window._DB_WILAYAS.length)
    ? window._DB_WILAYAS : CITIES;
  wilayaSrc.forEach(c => {
    const o = document.createElement("option");
    o.value = c;   // value = valeur DB exacte
    const tr = WILAYA_I18N[c];
    o.textContent = (lang==="ar"&&tr?tr.ar:lang==="en"&&tr?tr.en:c);
    vs.appendChild(o);
  });

  // [Phase 5.6 fix BUG #1 v2] Source des spécialités : DB DISTINCT EN PRIORITÉ
  // (28 valeurs réelles : "Cardiologue", "Pédiatre"...). Fallback SPECS uniquement
  // si fetch a échoué. SPECS reste utilisé pour les chips visuelles (renderSpecs)
  // avec mapping via _specUIToDB().
  if(Array.isArray(window._DB_SPECIALTIES) && window._DB_SPECIALTIES.length){
    window._DB_SPECIALTIES.forEach(name => {
      const o = document.createElement("option");
      o.value = name;       // valeur DB → matchera filtre PostgREST eq.X
      o.textContent = name; // label DB (pas de traduction AR/EN pour l'instant —
                             // i18n des spécialités scrapées = Phase 12)
      ss.appendChild(o);
    });
  } else {
    SPECS.forEach(s => {
      const o = document.createElement("option");
      o.value = s.name;
      o.textContent = (lang==="ar"&&s.ar?s.ar:lang==="en"&&s.en?s.en:s.name);
      ss.appendChild(o);
    });
  }
  // Restaurer sélection
  vs.value = curV; ss.value = curS;
}

function renderSpecs(){
  // [Phase 5.6 fix] cur (DB value) comparé via _specUIToDB(s.name) (UI → DB)
  // pour que la chip "Cardiologie" reste active quand f-spec.value="Cardiologue".
  const cur=document.getElementById("f-spec")?.value||"";
  document.getElementById("spec-scroll").innerHTML=SPECS.map(s=>{
    const dbVal = _specUIToDB(s.name);
    const isActive = (cur && cur === dbVal);
    return `<div class="spec-chip${isActive?" active":""}" onclick="filterBySpec('${s.name}')" tabindex="0" onkeydown="if(event.key==='Enter')filterBySpec('${s.name}')">
      <div class="spec-chip-icon">${s.icon.startsWith("fa-")?`<i class='fa ${s.icon}' style='color:var(--blue);font-size:24px'></i>`:s.icon}</div>
      <div class="spec-chip-name">${sname(s)}</div>
    </div>`;
  }).join("");
}

function renderChips(){
  const prev={};
  document.querySelectorAll(".chip[data-cv]").forEach(c=>{prev[c.dataset.cv]=c.classList.contains("active");});
  document.getElementById("chips").innerHTML=[
    {k:"chip_urg",v:"urg"},{k:"chip_4",v:"4plus"},{k:"chip_cheap",v:"cheap"},{k:"chip_fem",v:"fem"}
  ].map(c=>`<button class="chip${prev[c.v]?" active":""}" data-cv="${c.v}" onclick="this.classList.toggle('active');doFilter()">${T(c.k)}</button>`).join("");
}

// [Phase 5.5 fix BUG #1] doFilter() ne filtre plus en mémoire (qui ne contenait
// que 20 médecins random). Il lit l'état UI puis délègue à loadDoctorCards()
// qui re-requête Supabase avec les filtres en query string PostgREST.
// Debounce 300ms sur input texte pour ne pas spammer la base.
let _doFilterDebounce = null;
function _readFilterUI(){
  const chipEls = [...document.querySelectorAll(".chip.active")];
  const chips = chipEls.map(c=>c.dataset.cv).filter(Boolean);
  const maxP = parseInt(document.getElementById("f-price")?.value || 10000);
  return {
    search:    (document.getElementById("name-search")?.value||"").trim(),
    ville:     document.getElementById("f-ville")?.value || "",
    spec:      document.getElementById("f-spec")?.value || "",
    sort:      document.getElementById("f-sort")?.value || "rating",
    maxPrice:  (maxP < 10000) ? maxP : null,   // null si user n'a pas bougé le slider
    minRating: chips.indexOf("4plus") !== -1 ? 4 : 0,
    chips:     chips
  };
}
function doFilter(immediate){
  if(_doFilterDebounce){ clearTimeout(_doFilterDebounce); _doFilterDebounce = null; }
  const fire = () => loadDoctorCards(_readFilterUI());
  if(immediate === true) { fire(); return; }
  _doFilterDebounce = setTimeout(fire, 300);
}

function filterBySpec(name){
  // [Phase 5.6 fix BUG #1 v2] Le chip envoie un nom UI ("Cardiologie") mais
  // f-spec attend désormais une valeur DB ("Cardiologue"). Translation via
  // _specUIToDB(). Si pas de mapping → setvalue brut (filter retournera 0).
  const dbVal = _specUIToDB(name);
  const sel = document.getElementById("f-spec");
  if(sel) sel.value = dbVal;
  doFilter(); renderSpecs();
  scrollTo$("sec-docs");
}

function renderDocs(){
  const box=document.getElementById("docs-list");
  if(!filtered.length){
    box.innerHTML=`<div class="empty-state"><div class="empty-icon"><i class='fa fa-magnifying-glass'></i></div><div class="empty-title">${T("no_docs")}</div><p class="empty-sub">${T("try_other")}</p></div>`;
    document.getElementById("pag").innerHTML=""; return;
  }
  // Pagination SERVEUR : le batch EST déjà la page ; nb pages = total serveur / PER
  const pages=Math.ceil(_lastDoctorTotal/PER);
  box.innerHTML=filtered.map(d=>docCard(d)).join("");
  const pag=document.getElementById("pag");
  pag.innerHTML = pages>1 ? buildPagination(curPage, pages) : "";
}

function goPage(p){loadDoctorCards(_lastFilterOpts, p);scrollTo$("sec-docs");}

function buildPagination(cur, total){
  // Style Google : 1 ... cur-2 cur-1 cur cur+1 cur+2 ... total
  function btn(i, label, disabled){
    const isCur = i === cur && !disabled;
    const lbl = label != null ? label : i;
    return `<button style="min-width:34px;height:34px;padding:0 8px;border-radius:var(--r8);border:1.5px solid ${isCur?"var(--blue)":"var(--border)"};background:${isCur?"var(--blue)":"#fff"};color:${isCur?"#fff":"var(--text3)"};font-size:13px;font-weight:600;cursor:${disabled?"not-allowed":"pointer"};transition:all .12s;opacity:${disabled?".4":"1"}" ${disabled?"disabled":`onclick="goPage(${i})"`} ${isCur?'aria-current="page"':''}>${hEsc(lbl)}</button>`;
  }
  function gap(){
    return `<span style="min-width:24px;text-align:center;color:var(--text3);font-weight:700">…</span>`;
  }
  const parts = [];
  // Bouton « précédent »
  parts.push(btn(Math.max(1,cur-1), '‹', cur===1));
  // Algorithme : toujours 1, dernière, et ±2 autour de cur
  const pages = new Set([1, total, cur, cur-1, cur+1, cur-2, cur+2]);
  const sorted = [...pages].filter(p => p>=1 && p<=total).sort((a,b) => a-b);
  let prev = 0;
  for (const p of sorted){
    if (p - prev > 1) parts.push(gap());
    parts.push(btn(p));
    prev = p;
  }
  // Bouton « suivant »
  parts.push(btn(Math.min(total,cur+1), '›', cur===total));
  return parts.join("");
}


// Avatar neutre (soignant générique) — placeholder décoratif si AUCUNE initiale calculable.
const AVATAR_NEUTRAL = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="tbAvN5"><circle cx="50" cy="50" r="50"/></clipPath></defs><circle cx="50" cy="50" r="50" fill="var(--pastille,#e7f3ef)"/><g clip-path="url(#tbAvN5)"><path d="M14 104C16 77 33 70 50 70 67 70 84 77 86 104Z" fill="#fff"/><path d="M41 71 59 71 50 90Z" fill="var(--logo-bg,#0F7560)"/><path d="M45 71 55 71 50 82Z" fill="#f1f5f9"/><rect x="45" y="54" width="10" height="13" rx="5" fill="#ddae84"/><circle cx="50" cy="42" r="16" fill="#ddae84"/><circle cx="34" cy="43" r="3.2" fill="#ddae84"/><circle cx="66" cy="43" r="3.2" fill="#ddae84"/><path d="M32 45C30 25 40 18 50 18 60 18 70 25 68 45 68 40 62 34 50 34 38 34 32 40 32 45Z" fill="var(--logo-bg,#0F7560)"/><path d="M50 18C50 14 53 12 56 13" stroke="var(--logo-bg,#0F7560)" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="44.5" cy="42" r="1.8" fill="#0F2A24"/><circle cx="55.5" cy="42" r="1.8" fill="#0F2A24"/><path d="M45 48Q50 52 55 48" stroke="#0F2A24" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M43 72C39 80 44 86 50 87" stroke="var(--logo-bg,#0F7560)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M57 72C61 80 56 86 50 87" stroke="var(--logo-bg,#0F7560)" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="92" r="5" fill="var(--logo-accent,#D4A437)"/><circle cx="50" cy="92" r="2.4" fill="#b88d2d"/></g></svg>`;
function docCard(d){
  const n=dname(d),s=dspec(d),c=dcity(d),fav=isFav(d.id);
  // [RTL] dir="auto" : le navigateur choisit la direction d'après le 1er caractère fort.
  // Nom 100% arabe → rtl (aligné à droite) ; nom mixte latin+arabe → ltr (la partie latine se lit en premier, plus de troncature).
  const rk  = ' dir="auto" data-rtl-keep="true"';
  // Avatar = MONOGRAMME (initiales) sur pastille verte pâle — données réelles only, pas de photo.
  const avaHtml = `<div class="doc-ava">${hEsc((d.in||'').toString().trim())}</div>`;
  // Statut réel : Réservable (claimed+approved) / En validation (claimed, pending) / Fiche non réclamée.
  const reservable = d.claimed && d.validationStatus === 'approved';
  const statusBadge = reservable
    ? `<span class="doc-status doc-status-on"><i class='fa fa-circle-check fa-xs'></i>${T("status_bookable")}</span>`
    : (d.claimed
        ? `<span class="doc-status doc-status-pending"><i class='fa fa-clock fa-xs'></i>${T("validation_pending")}</span>`
        : `<span class="doc-status doc-status-off"><i class='fa fa-circle-info fa-xs'></i>${T("status_unclaimed")}</span>`);
  return `<article class="doc-card fu" onclick="goDoc('${d.id}')" tabindex="0" onkeydown="if(event.key==='Enter')goDoc('${d.id}')">
    <button class="fav-btn${fav?" is-fav":""}" data-fid="${d.id}" onclick="event.stopPropagation();toggleFav('${d.id}',this)" aria-label="Favori">
      <i class="${fav?"fa":"far"} fa-heart"></i>
    </button>
    <div class="doc-row">
      ${avaHtml}
      <div style="flex:1;min-width:0">
        <div class="doc-name" dir="auto" data-rtl-keep="true">${hEsc(n)}</div>
        <div class="doc-spec"${rk}><i class='fa fa-stethoscope fa-xs'></i>${hEsc(s)}</div>
        <div class="doc-loc"${rk}><i class='fa fa-location-dot fa-xs'></i>${hEsc(c)}</div>
      </div>
    </div>
    <div class="doc-tags">
      ${statusBadge}
      ${d.telehealth?`<span class="badge badge-blue"><i class='fa fa-video fa-xs'></i>${T("badge_teleconsult")}</span>`:""}
      ${d.acceptsChifa?`<span class="badge" style="background:#e7f3ef;color:#0a4d3e"><i class='fa fa-id-card fa-xs'></i>${T("badge_chifa")}</span>`:""}
    </div>
    <div class="doc-footer">
      <div class="doc-price">${d.prix != null ? `${d.prix.toLocaleString()} DA <small>/${T("consult_word")}</small>` : `<span style="color:var(--text3);font-weight:600">${T("price_tbd")}</span>`}</div>
      ${reservable
        ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();bookDoc('${d.id}')"><i class='fa fa-calendar-plus'></i>${T("rdv")}</button>`
        : `<button class="btn btn-sm doc-btn-ghost" onclick="event.stopPropagation();goDoc('${d.id}')"><i class='fa fa-arrow-right'></i>${T("see_sheet")}</button>`
      }
    </div>
  </article>`;
}

function goDoc(id){
  // Show doctor profile inline (modal) since we're in a single file
  const d=DOCTORS.find(x=>x.id===id); if(!d) return;
  showDoctorModal(d);
}

function bookDoc(id){
  if(!isLogged()){openModal("login");toast(T("conn_req"),"info");return;}
  const d=DOCTORS.find(x=>x.id===id);
  if(!d) return;
  // [Phase 16.4 / P1.6b] garde : réservable SSI fiche claimed + approved
  if(!(d.claimed && d.validationStatus === 'approved')){
    toast(d.claimed ? T("doctor_validating") : T("booking_not_active"),"info"); return;
  }
  showBookingModal(d);
}

function showDoctorModal(d){
  const n=dname(d),s=dspec(d),c=dcity(d);
  const modal=document.createElement("div");
  modal.className="modal-bg";
  modal.style.zIndex="600";
  modal.innerHTML=`
    <div class="modal-sheet" style="max-height:95dvh">
      <div class="modal-handle"></div>
      <div style="position:relative">
        <div style="background:var(--grad-brand);padding:20px 20px 50px;margin-bottom:-36px;position:relative">
          <div style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;color:#fff;border:none" onclick="this.closest('.modal-bg').remove();document.body.style.overflow=''">×</div>
          <div style="width:64px;height:64px;border-radius:16px;background:${hEsc(d.bg)};color:${hEsc(d.tc)};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;border:3px solid rgba(255,255,255,.3);margin-bottom:10px">${hEsc(d.in)}</div>
          <div style="font-size:18px;font-weight:800;color:#fff">${hEsc(n)}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75)">${hEsc(s)} · ${hEsc(c)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:8px">
            ${d.note != null
              ? `<span style='color:#F59E0B;font-size:13px'>${stars(d.note)}</span><span style='font-size:13px;font-weight:700;color:#fff'>${d.note}</span><span style='font-size:12px;color:rgba(255,255,255,.65)'>(${d.avis||0} ${T("avis_word")})</span>`
              : `<span style='font-size:12px;color:rgba(255,255,255,.65)'>${T("not_rated_yet")}</span>`}
            ${d.cert?`<span class="badge badge-green" style="font-size:10px"><i class='fa fa-check fa-xs'></i>${T("cert")}</span>`:""}
            ${d.urgent?`<span class="badge badge-red" style="font-size:10px"><i class='fa fa-bolt fa-xs'></i>${T("badge_urgent")}</span>`:""}
          </div>
        </div>
        <div style="padding:44px 16px 16px">
          <!-- Créneaux -->
          <div class="card" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="font-size:14px;font-weight:700"><i class='fa fa-calendar-days'></i> ${T("available_slots")}</div>
              <div style="font-size:16px;font-weight:800;color:var(--blue)">${d.prix != null ? `${d.prix.toLocaleString()} DA` : `<span style="font-size:13px;color:var(--text3)">${T("price_tbd")}</span>`}</div>
            </div>
            <div class="slots-grid" id="prof-slots"></div>
            <div id="slot-confirm-txt" class="hidden" style="background:var(--blue-l);border-radius:var(--r12);padding:10px;font-size:13px;color:var(--blue);margin:10px 0;display:flex;align-items:center;gap:6px"><i class='fa fa-check-circle'></i><span id="slot-txt"></span></div>
            <button class="btn btn-primary btn-full btn-lg" style="margin-top:8px" onclick="confirmFromProfile('${d.id}')"><i class='fa fa-calendar-check'></i> ${T("confirm_slot")}</button>
          </div>
          <!-- About -->
          <div class="card" style="margin-bottom:14px">
            <div style="font-size:14px;font-weight:700;margin-bottom:10px">${T("about_doctor")}</div>
            <p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:12px">${d.desc||""}</p>
            ${[["fa-location-dot",T("addr_label"),d.addr||"—"],["fa-language",T("langs_label"),(d.langs||[]).join(", ")],["fa-clock",T("availability_label"),T("hours_default")]].map(([ic,lbl,val])=>`
              <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bg2);font-size:12px">
                <span style='color:var(--text3);display:flex;align-items:center;gap:4px'><i class='fa ${ic} fa-xs'></i>${hEsc(lbl)}</span>
                <span style='font-weight:600;color:var(--text);text-align:end'>${val}</span>
              </div>`).join("")}
            <div style="margin-top:12px">
              ${(d.diplomes||[]).map(dp=>`<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text2);margin-bottom:6px"><i class='fa fa-graduation-cap fa-xs' style='color:var(--blue);flex-shrink:0;margin-top:2px'></i>${dp}</div>`).join("")}
            </div>
          </div>
          <button class="btn btn-primary btn-full btn-xl" onclick="bookDoc('${d.id}');this.closest('.modal-bg').remove();document.body.style.overflow=''"><i class='fa fa-calendar-plus'></i> ${T("rdv")}</button>
          <div style="height:20px"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow="hidden";
  modal.addEventListener("click",e=>{if(e.target===modal){modal.remove();document.body.style.overflow="";}});
  
  // Render slots
  window._profileDoctorId=d.id;
  window._profileSlot=null;
  // Date par défaut pour la réservation = demain (cohérent avec loadTakenSlots)
  // [13/09/2026] « demain » se calcule dans le fuseau du cabinet, pas du navigateur.
  window._profileDate = window.tabibiTemps.ajouterJours(window.tabibiTemps.aujourdhui(), 1);

  // Re-render des slots (lit window._takenSlotsCache, alimente par loadTakenSlots)
  function renderProfileSlots(){
    const el = document.getElementById("prof-slots");
    if (!el) return;
    // [P1.6b] Masque les créneaux générés si la fiche n'est pas claimed+approved
    // (UX uniquement — le serveur bloque déjà la réservation via RLS).
    if (!(d.claimed && d.validationStatus === 'approved')) {
      el.innerHTML = `<div style="grid-column:1/-1;font-size:12px;color:var(--text3);padding:6px 0">${d.claimed ? T("validation_pending_long") : T("booking_not_active")}</div>`;
      return;
    }
    // [12/09/2026] Plus de grille codée en dur : on route vers le calendrier réel.
    el.innerHTML = '';
    var _cta = document.createElement('button');
    _cta.className = 'btn btn-primary btn-full btn-lg';
    _cta.style.gridColumn = '1/-1';
    _cta.innerHTML = "<i class='fa fa-calendar-days'></i> " + T("available_slots");
    _cta.onclick = function(){ showBookingModal(d); };
    el.appendChild(_cta);
    return;
  }
  renderProfileSlots();

  // Charger les vrais slots pris depuis Supabase puis re-render
  loadTakenSlots(d.id, null, () => renderProfileSlots());
}

function selectProfileSlot(el,slot){
  window._profileSlot=slot;
  document.querySelectorAll("#prof-slots .slot-btn").forEach(b=>b.classList.remove("sel"));
  el.classList.add("sel");
  const sc=document.getElementById("slot-confirm-txt");
  sc.classList.remove("hidden");
  document.getElementById("slot-txt").textContent="Créneau sélectionné : "+slot;
}

function confirmFromProfile(docId){
  if(!isLogged()){openModal("login");toast(T("conn_req"),"info");return;}
  const d=DOCTORS.find(x=>x.id===docId);
  // [P1.6b] réservable SSI claimed + approved (UX ; le serveur bloque déjà via RLS)
  if(!d || !(d.claimed && d.validationStatus === 'approved')){
    toast(d && d.claimed ? "Ce médecin est en cours de validation." : "Ce médecin n'a pas encore activé les RDV en ligne.","info");
    return;
  }
  // [12/09/2026] Plus de créneau présélectionné ici : on ouvre le calendrier réel.
  showBookingModal(d);
}

/* Inline booking modal */
function showBookingModal(d, slot){
  // [12/09/2026] La disponibilité est une règle métier UNIQUE : elle vit dans
  // get_available_slots, exposée par le parcours reservation.html (calendrier réel,
  // fuseau Africa/Algiers). On n'ouvre plus de modale à grille codée en dur —
  // c'est elle qui, le 12/09, a créé un RDV le dimanche (jour fermé) avec une heure
  // décalée d'une heure. On route vers le parcours unique, comme doctor-profile.html.
  // Le slot éventuellement présélectionné est ignoré : reservation.html le fait
  // rechoisir sur des créneaux réels.
  if (!d) return;
  var qs = '?doctor_id='   + encodeURIComponent(d.id)
         + '&doctor_name=' + encodeURIComponent(dname(d) || '')
         + '&prix='        + encodeURIComponent(d.prix != null ? d.prix : 0)
         + '&spec='        + encodeURIComponent(dspec(d) || '');
  location.href = 'reservation.html' + qs;
}

async function finalBooking(docId,slot,docName,prix){
  const reason=document.getElementById("bk-reason")?.value.trim();
  if(!reason){toast(T("reason_req"),"error");return;}
  const consultType=document.getElementById("bk-type")?.value || "Première consultation";
  const payMethod=window._bkPay||"cash";
  // Date : si window._profileDate (sélectionnée par l'utilisateur) on la prend, sinon demain par défaut
  const isoDate = window._profileDate || (function(){
    return window.tabibiTemps.ajouterJours(window.tabibiTemps.aujourdhui(), 1);
  })();

  // [FIX P17] Auth obligatoire AVANT tout INSERT : la RLS de public.appointments impose
  // patient_id = auth.uid(). Sans session connectée, on n'insère pas et on n'affiche aucun succès.
  let _patientId = null, _sbAccessToken = null;
  try {
    if (window.tabibi && window.tabibi.supabase) {
      const { data: { session } } = await window.tabibi.supabase.auth.getSession();
      if (session && session.user) { _patientId = session.user.id; _sbAccessToken = session.access_token || null; }
    }
  } catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:1262'); }
  if (!_patientId) {
    toast("Connectez-vous pour réserver un rendez-vous.", "error", 5000);
    return;
  }

  // Construire le RDV pour le storage local (rétrocompat avec affichage dashboard)
  const u = JSON.parse(localStorage.getItem("tabibi_user")||"{}");
  const appt={
    id:"r"+Date.now(),
    doctorId:docId, doctorName:docName,
    slot, date:isoDate, time:slot,
    reason, consultType, payMethod,
    prix:parseInt(prix),
    status:"Pending",
    patientName:user?.name || u.name || "",
    patientPhone:u.phone||"",
    createdAt:new Date().toISOString()
  };
  // [FIX P17] Écriture localStorage DÉPLACÉE dans la branche succès de l'INSERT ci-dessous
  // (plus d'écriture optimiste) : aucun RDV local fantôme si l'INSERT échoue.

  // INSERT dans Supabase (source de vérité — sinon le médecin ne reçoit jamais le RDV)
  let supabaseOk = false, _bkServerError = null;
  try {
    const SB_URL = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_URL) || 'https://pudugodhiofqrctcdwfl.supabase.co'; /* [FIX-AUDIT-2026-05] #5 */
    const SB_KEY = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || '';
    const token = _sbAccessToken || SB_KEY;
    const dt = new Date(isoDate + 'T' + slot);
    const res = await fetch(SB_URL + '/rest/v1/appointments', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        patient_id: _patientId,        // [FIX P17] requis : RLS WITH CHECK patient_id=auth.uid() + NOT NULL
        doctor_id: docId,              // inchangé = doctor_profiles.id (correct)
        scheduled_at: dt.toISOString(),
        duration_minutes: 30,
        reason: reason,
        notes_patient: '',
        status: 'pending',
        consult_type: consultType,
        pay_method: payMethod,
        prix: parseInt(prix)
      })
    });
    if (res.ok) {
      supabaseOk = true;
      // [FIX P17] Écriture localStorage UNIQUEMENT ici (INSERT abouti), en reflétant ce que
      // la DB a réellement écrit : id + short_id réels via Prefer:return=representation.
      try {
        const data = await res.json().catch(()=>null);
        const row = (Array.isArray(data) && data[0]) ? data[0] : null;
        if (row) {
          appt.sbId = row.id;                   // id réel DB
          appt.shortId = row.short_id || null;  // short_id réel généré par la DB
          appt._sb = true;
        }
        // Si la réponse n'est pas exploitable (row null) : on stocke appt avec les champs
        // déjà connus côté client, SANS inventer d'id/short_id DB.
        const arr = JSON.parse(localStorage.getItem("tabibi_rdv")||"[]");
        arr.unshift(appt);
        localStorage.setItem("tabibi_rdv", JSON.stringify(arr));
      } catch (_) { (window.tabibiErreur || console.warn)(_, 'home-app.js:1324'); }
      /* [FIX-PROD-2026-05-19] console.log retiré */
      // Invalider le cache des slots pour ce médecin/date
      if (window._takenSlotsCache) delete window._takenSlotsCache[docId + '|' + isoDate];
    } else {
      _bkServerError = (await res.text().catch(()=>'')) || ('HTTP ' + res.status);
      console.warn('[Tabibi] INSERT appointments HTTP', res.status, _bkServerError);
    }
  } catch(e) {
    _bkServerError = (e && e.message) || 'erreur réseau';
    console.warn('[Tabibi] INSERT Supabase erreur:', e && e.message);
  }

  document.querySelectorAll(".modal-bg").forEach(m=>{m.remove();document.body.style.overflow="";});

  // Confirmation visuelle
  const dateLbl = (function(){
    try {
      return (window.tabibiFormatDate ? window.tabibiFormatDate(isoDate, {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : new Date(isoDate).toLocaleDateString("fr-FR", {weekday:'long', day:'numeric', month:'long', year:'numeric'}));
    } catch(e) { return isoDate; }
  })();
  // [FIX P17] Gating strict : AUCUN toast de succès si l'écriture en base a échoué.
  if (!supabaseOk) {
    var _bkMsg = _bkServerError ? (" (" + String(_bkServerError).slice(0, 160) + ")") : "";
    toast("Échec de la réservation — le rendez-vous n'a PAS été enregistré." + _bkMsg, "error", 8000);
    return;
  }
  toast(T("rdv_ok"), "success", 4000);
  setTimeout(()=>{
    toast("Le médecin a été notifié", "info", 3500);
    toast("RDV confirmé pour le " + dateLbl + " à " + slot, "success", 5000);
  }, 800);
}

/* [FIX 2026-07-17] goDash était défini 2× : cette 2e version legacy (modals
   de démo + toast « déployez le ZIP ») écrasait la vraie navigation définie
   plus haut → « Tableau de bord » n'ouvrait plus les dashboards. Supprimée. */

function showPatientDashboardModal(){
  const rdv=JSON.parse(localStorage.getItem("tabibi_rdv")||"[]");
  const all=[...DEMO_RDV,...rdv];
  const STC={Confirmed:"badge-blue",Completed:"badge-green",Cancelled:"badge-red",Pending:"badge-amber"};
  const STL={Confirmed:"Confirmé",Completed:"Terminé",Cancelled:"Annulé",Pending:"En attente"};
  const modal=document.createElement("div");
  modal.className="modal-bg";
  modal.style.zIndex="800";
  const upcoming=all.filter(r=>r.status==="Confirmed"||r.status==="Pending");
  modal.innerHTML=`
    <div class="modal-sheet" style="max-height:95dvh">
      <div class="modal-handle"></div>
      <div class="modal-hdr" style="position:relative">
        <div class="modal-title"><i class='fa fa-user'></i> Mon espace patient</div>
        <button class="modal-close" onclick="this.closest('.modal-bg').remove();document.body.style.overflow=''">×</button>
      </div>
      <div class="modal-body" style="padding-bottom:24px">
        <!-- User info -->
        <div class="tbm-user">
          <div class="tbm-ava">${hEsc(user?.initials||"?")}</div>
          <div style="min-width:0"><b>${hEsc(user?.name||"")}</b><small>${hEsc(user?.email||"")}</small></div>
        </div>
        <!-- Stats -->
        <div class="tbm-stats">
          ${[["<i class='fa fa-calendar-days'></i>",upcoming.length,"RDV à venir"],["<i class='fa fa-circle-check'></i>",all.filter(r=>r.status==="Completed").length,"Terminés"],["<i class='fa fa-heart'></i>",getFavs().length,"Favoris"]].map(([ic,n,l])=>`
            <div class="tbm-stat">
              <div>${ic}</div>
              <div class="n">${hEsc(n)}</div>
              <div class="l">${l}</div>
            </div>`).join("")}
        </div>
        <!-- RDV List -->
        <div class="tbm-row-t">Mes rendez-vous</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${all.slice(0,5).map(r=>`
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r12)">
              <div style="width:36px;height:36px;border-radius:var(--r8);background:var(--blue-l);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class='fa fa-stethoscope fa-sm'></i></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hEsc(r.doctorName||r.doctor||"Médecin")}</div>
                <div style="font-size:11px;color:var(--text3)">${r.date} — ${r.time}</div>
              </div>
              <span class="badge ${STC[r.status]||"badge-gray"}" style="flex-shrink:0">${STL[r.status]||r.status}</span>
            </div>`).join("")}
          ${!all.length?`<div class="tbm-empty"><i class='fa fa-calendar-days'></i><b>Aucun RDV</b><p>Prenez votre premier rendez-vous.</p><a onclick="this.closest('.modal-bg').remove();document.body.style.overflow='';var s=document.getElementById('sec-search');if(s)s.scrollIntoView({behavior:'smooth'})">Trouver un médecin</a></div>`:""}
        </div>
        <a href="patient-dashboard.html" class="btn btn-primary btn-full btn-lg tbm-cta" style="margin-bottom:10px"><i class='fa fa-chart-line'></i> Tableau de bord complet</a>
        <button class="tbm-logout" onclick="handleLogout();this.closest('.modal-bg').remove();document.body.style.overflow=''"><i class='fa fa-right-from-bracket'></i> Déconnexion</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow="hidden";
}

function showDoctorDashboardModal(){
  const modal=document.createElement("div");
  modal.className="modal-bg";
  modal.style.zIndex="800";
  modal.innerHTML=`
    <div class="modal-sheet" style="max-height:95dvh">
      <div class="modal-handle"></div>
      <div class="modal-hdr" style="position:relative">
        <div class="modal-title"><i class='fa fa-user-doctor'></i> Espace médecin</div>
        <button class="modal-close" onclick="this.closest('.modal-bg').remove();document.body.style.overflow=''">×</button>
      </div>
      <div class="modal-body" style="padding-bottom:24px">
        <div class="tbm-user">
          <div class="tbm-ava">${hEsc(user?.initials||"?")}</div>
          <div style="min-width:0"><b>${hEsc(user?.name||"")}</b><small>${hEsc([user?.specialty,user?.ville].filter(Boolean).join(" · "))}</small>${user?._validation_status==='approved'?`<div><span class="badge badge-green" style="margin-top:4px"><i class='fa fa-check fa-xs'></i> Certifié Tabibi</span></div>`:""}</div>
        </div>
        <!-- [TODO 2026-05-18] Remplacer ces stats hardcodees par appel API Supabase
             (rdv count, sum revenus, avg rating, pending count) avant lancement public.
             Modal teaser uniquement: source de verite = doctor-dashboard.html -->
        <div class="tbm-stats" style="grid-template-columns:1fr 1fr">
          ${[["<i class='fa fa-calendar-days'></i>","--","RDV ce mois"],["<i class='fa fa-coins'></i>","--","Revenus"],["<i class='fa fa-star'></i>","--","Note moy."],["<i class='fa fa-hourglass-half'></i>","--","En attente"]].map(([ic,n,l])=>`
            <div class="tbm-stat">
              <div>${ic}</div>
              <div class="n">${hEsc(n)}</div>
              <div class="l">${l}</div>
            </div>`).join("")}
        </div>
        <div class="tbm-row-t">Consultations du jour</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${DEMO_DOC_RDV.filter(r=>r.date.includes("07 Mai")).map(r=>`
            <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r12)">
              <div style="width:36px;height:36px;border-radius:var(--r8);background:var(--blue-l);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class='fa fa-user fa-sm'></i></div>
              <div style="flex:1"><div style="font-size:13px;font-weight:700">${r.patient}</div><div style="font-size:11px;color:var(--text3)">${r.time} · ${r.motif}</div></div>
              <span class="badge ${{Confirmed:"badge-blue",Completed:"badge-green",Pending:"badge-amber"}[r.status]||"badge-gray"}">${{Confirmed:"Confirmé",Completed:"Terminé",Pending:"En attente"}[r.status]||r.status}</span>
            </div>`).join("")}
          ${!DEMO_DOC_RDV.filter(r=>r.date.includes("07 Mai")).length?`<div class="tbm-empty"><i class='fa fa-calendar-days'></i><b>Aucune consultation aujourd'hui</b><p>Votre agenda complet vous attend.</p></div>`:""}
        </div>
        <a href="doctor-dashboard.html" class="btn btn-primary btn-full btn-lg tbm-cta" style="margin-bottom:10px"><i class='fa fa-chart-line'></i> Tableau de bord complet</a>
        <button class="tbm-logout" onclick="handleLogout();this.closest('.modal-bg').remove();document.body.style.overflow=''"><i class='fa fa-right-from-bracket'></i> Déconnexion</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow="hidden";
}

function onLangChange(){
  // Re-render des éléments dynamiques
  renderSpecs(); renderChips(); doFilter();

  // Re-render header UI (boutons Sign in/Sign up + pill user)
  if (typeof renderUserUI === 'function') renderUserUI();
  if (typeof initTabBar === 'function') {
    // Conserver l'onglet actif courant
    const active = document.querySelector('.tab-bar [aria-current="page"]')?.dataset?.tab || 'home';
    initTabBar(active);
  }

  // Re-render bandeau bêta dans la nouvelle langue
  if (window.tabibiBeta && typeof window.tabibiBeta.refreshLang === 'function') {
    window.tabibiBeta.refreshLang();
  }

  // Re-peupler les selects (wilayas + spécialités) dans la langue active
  if (typeof populateSelects === 'function') populateSelects();

  // Traduire les éléments hardcodés par ID
  const tr = TR[lang] || TR.fr;
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  // Filtres
  set('opt-allcities', tr.all_cities);
  set('opt-allspecs', tr.all_specs);
  set('lbl-pricemax', tr.price_max || 'Prix max');
  set('opt-sort-rating', tr.sort_rating || tr.f_rating || 'Mieux notés');
  set('opt-sort-priceasc', tr.sort_price_asc || 'Prix ↑');
  set('opt-sort-pricedesc', tr.sort_price_desc || 'Prix ↓');
  set('opt-sort-reviews', tr.sort_reviews || "Plus d'avis");

  // Titres sections
  set('st-docs', tr.section_doctors_in_dz || 'Médecins référencés en Algérie');
  set('hiw-title', tr.howto_title || 'Comment prendre RDV en ligne ?');
  set('see-all-btn', tr.see_all || 'Voir tout →');

  // Stats
  set('stats-doc-lbl', tr.sb1 || 'Médecins référencés');
  set('stats-wilaya-lbl', tr.sb2 || 'Wilayas');
  // [I18N-RES] hero stats sans data-i18n (id only)
  set('hs2', tr.hs2 || 'Wilayas');
  set('hs4', tr.hero_booking || 'Réservation');

  // CTA Médecin
  set('cta-doc-title', tr.cta_doc_title || 'Vous êtes médecin ?');
  set('cta-doc-sub', tr.cta_doc_sub || 'Rejoignez Tabibi et développez votre patientèle en ligne. Inscription gratuite pendant 30 jours.');
  set('cta-doc-btn', tr.cta_doc_btn || 'Rejoindre Tabibi');

  // CTA Waiting list
  set('cta-wl-title', tr.cta_wl_title || 'Rejoignez la waiting list');
  set('cta-wl-sub', tr.cta_wl_sub || 'Soyez parmi les 1ers à découvrir Tabibi · Inscription gratuite');

  // Hero title COMPLET (phrase entière, pas juste un mot)
  const heroFullTitle = {
    fr: 'Votre santé ne devrait jamais attendre.',
    ar: 'صحتك لا يجب أن تنتظر.',
    en: 'Your health should never wait.'
  };
  set('hero-t', heroFullTitle[lang] || heroFullTitle.fr);

  // Compteur dynamique certifiés + indexés (fallback window._tabibiBadge, màj async au load)
  _updateDocCounterUI();

  // Footer "Bientôt" badges
  const soonText = { fr: 'Bientôt', ar: 'قريبًا', en: 'Soon' };
  document.querySelectorAll('.foot-soon').forEach(el => { el.textContent = soonText[lang] || soonText.fr; });

  // Footer "Réponse sous 24h ouvrées"
  const respText = {
    fr: '<i class="fa fa-clock fa-xs"></i> Réponse sous 24h ouvrées',
    ar: '<i class="fa fa-clock fa-xs"></i> الرد خلال 24 ساعة عمل',
    en: '<i class="fa fa-clock fa-xs"></i> Reply within 24 business hours'
  };
  const respEl = document.getElementById('foot-response');
  if (respEl) respEl.innerHTML = respText[lang] || respText.fr;

  // Steps (How it works)
  set('s1t', tr.step1_t || 'Recherchez');
  set('s1d', tr.step1_d || 'Filtrez par nom, ville, spécialité, note et prix.');
  set('s2t', tr.step2_t || 'Réservez');
  set('s2d', tr.step2_d || 'Choisissez un créneau et confirmez votre RDV en ligne.');
  set('s3t', tr.step3_t || 'Consultez');
  set('s3d', tr.step3_d || 'Recevez un SMS de confirmation et rencontrez votre médecin.');

  // Sous-titre header (طبيبي · Médecins Algérie)
  const sub = document.querySelector('.app-bar-sub');
  if (sub) sub.textContent = (lang === 'ar' ? 'طبيبي · أطباء الجزائر' : (lang === 'en' ? 'طبيبي · Doctors Algeria' : 'طبيبي · Médecins Algérie'));

  // Tagline (la santé à portée de clic)
  const tagline = document.querySelector('p[style*="Cairo"][style*="text3"]');
  if (tagline) tagline.textContent = (lang === 'ar' ? 'طبيبي · الصحة على بُعد نقرة' : (lang === 'en' ? 'طبيبي · Healthcare at your fingertips' : 'طبيبي · La santé à portée de clic'));

  // Prix label dynamique (5 000 DA / 5,000 DZD)
  const priceLbl = document.getElementById('price-lbl');
  const priceInput = document.getElementById('f-price');
  if (priceLbl && priceInput) {
    const val = parseInt(priceInput.value);
    const formatted = val.toLocaleString(lang === 'fr' ? 'fr-DZ' : (lang === 'ar' ? 'ar-DZ' : 'en-US'));
    const unit = (lang === 'en' ? ' DZD' : ' DA');
    priceLbl.textContent = formatted + unit;
  }
}

/* ══ CHARGEMENT MÉDECINS DEPUIS SUPABASE ══════════════════════ */
const _SB_URL = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_URL) || 'https://pudugodhiofqrctcdwfl.supabase.co'; /* [FIX-AUDIT-2026-05] #5 */
const _SB_KEY = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || '';  // [ROTATION 2026-09-10] plus de littéral : config.js est la source unique
const _COLORS = [
  {bg:'#EEF4FB',tc:'#1557A0'},{bg:'#F3EEFB',tc:'#5B21B6'},{bg:'#EEF8F1',tc:'#007A23'},
  {bg:'#FAEEF4',tc:'#9D174D'},{bg:'#FEF9EE',tc:'#92400E'},{bg:'#EEF9F8',tc:'#0F766E'},
  {bg:'#FDF4EE',tc:'#9A3412'},{bg:'#F5F3FF',tc:'#5b21b6'},{bg:'#FFF7ED',tc:'#92400e'},
  {bg:'#ECFDF5',tc:'#065f46'},{bg:'#FEF2F2',tc:'#991b1b'},{bg:'#F0FDF4',tc:'#14532d'}
];

/* Wilayas algériennes */
const _W={1:'Adrar',2:'Chlef',3:'Laghouat',4:'Oum El Bouaghi',5:'Batna',6:'Béjaïa',7:'Biskra',8:'Béchar',9:'Blida',10:'Bouira',11:'Tamanrasset',12:'Tébessa',13:'Tlemcen',14:'Tiaret',15:'Tizi Ouzou',16:'Alger',17:'Djelfa',18:'Jijel',19:'Sétif',20:'Saïda',21:'Skikda',22:'Sidi Bel Abbès',23:'Annaba',24:'Guelma',25:'Constantine',26:'Médéa',27:'Mostaganem',28:"M'Sila",29:'Mascara',30:'Ouargla',31:'Oran',32:'El Bayadh',33:'Illizi',34:'Bordj Bou Arréridj',35:'Boumerdès',36:'El Tarf',37:'Tindouf',38:'Tissemsilt',39:'El Oued',40:'Khenchela',41:'Souk Ahras',42:'Tipaza',43:'Mila',44:'Aïn Defla',45:'Naâma',46:'Aïn Témouchent',47:'Ghardaïa',48:'Relizane',49:"El M'Ghair",50:'El Meniaa',51:'Ouled Djellal',52:'Bordj Baji Mokhtar',53:'Béni Abbès',54:'Timimoun',55:'Touggourt',56:'Djanet',57:'In Salah',58:'In Guezzam'};
/* Spécialités normalisées */
const _S={'medecine-generale':'Médecine Gén.','generaliste':'Médecine Gén.','medecin-generaliste':'Médecine Gén.','cardiologie':'Cardiologie','cardiologue':'Cardiologie','pediatrie':'Pédiatrie','pédiatrie':'Pédiatrie','dentiste':'Dentiste','chirurgie-dentaire':'Dentiste','stomatologie':'Dentiste','stomatologiste':'Dentiste','gynecologie':'Gynécologie','gynécologie':'Gynécologie','dermatologie':'Dermatologie','dermatologue':'Dermatologie','ophtalmologie':'Ophtalmologie','orl':'ORL','psychiatrie':'Psychiatrie','neurologie':'Neurologie','radiologie':'Radiologie','chirurgie':'Chirurgie','orthopedie':'Orthopédie','orthopédie':'Orthopédie','urologie':'Urologie','pneumologie':'Pneumologie','rhumatologie':'Rhumatologie','endocrinologie':'Endocrinologie','gastro-enterologie':'Gastro-entérologie','nephrologie':'Néphrologie','kinesitherapie':'Kinésithérapie','kinesithérapeute':'Kinésithérapie','kinesitherapeute':'Kinésithérapie','medecine-du-travail':'Méd. du travail','biologie':'Biologie médicale','autre':'Médecine Gén.'};
function _norm(s){return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
const _STD_SPECS=[
  {label:'Cardiologie',keys:['cardio']},
  {label:'Dermatologie',keys:['dermato']},
  {label:'Pédiatrie',keys:['pediat','enfant']},
  {label:'Gynécologie',keys:['gyneco','obstetrique','sagefemme','sage-femme']},
  {label:'Ophtalmologie',keys:['ophtalmo','ophthalmo','optique']},
  {label:'ORL',keys:['orl','otorhino','oto-rhino','laryngo']},
  {label:'Dentiste',keys:['dentiste','dentist','stomatolog','dental','odontolog','orthodont']},
  {label:'Neurologie',keys:['neuro']},
  {label:'Psychiatrie',keys:['psychiat','psychothera']},
  {label:'Psychologie',keys:['psycholog']},
  {label:'Orthopédie',keys:['orthoped','traumato']},
  {label:'Radiologie',keys:['radio','imagerie','scanner','irm','echograph']},
  {label:'Urologie',keys:['urolog']},
  {label:'Pneumologie',keys:['pneumo','phtisio','allergolog']},
  {label:'Rhumatologie',keys:['rhumato']},
  {label:'Endocrinologie',keys:['endocrino','diabeto','thyroid']},
  {label:'Gastro-entérologie',keys:['gastro','hepato','digesti','procto']},
  {label:'Néphrologie',keys:['nephrolog','dialyse','renale']},
  {label:'Kinésithérapie',keys:['kinesi','reeducation','readapt']},
  {label:'Médecine interne',keys:['interniste','medecineinterne']},
  {label:'Hématologie',keys:['hemato']},
  {label:'Oncologie',keys:['oncolog','chimio','radiotherapie']},
  {label:'Anesthésie',keys:['anesthes','reanim']},
  {label:'Chirurgie',keys:['chirurg']},
  {label:'Nutrition',keys:['nutrition','dietet']},
  {label:'Médecine du travail',keys:['medecinedutravail','medecinetravail']},
  {label:'Pharmacie',keys:['pharmac']},
  {label:'Médecine Gén.',keys:['generalist','medecinegenerale','generale','generaliste']},
];
function _matchStd(text){if(!text)return null;const n=_norm(text);if(!n)return null;for(const cat of _STD_SPECS){for(const k of cat.keys){if(n.indexOf(k)!==-1)return cat.label;}}return null;}
function _spec(d){
  const candidates=[d.specialty_fr,d.specialty_name,d.specialty_label,d.specialty_slug,d.specialty];
  for(const c of candidates){const m=_matchStd(c);if(m)return m;}
  const fr=(d.specialty_fr||d.specialty_name||d.specialty_label||'').trim();
  if(fr) return fr;
  return 'Médecine Gén.';
}
function _ville(d){if(d.wilaya_name&&d.wilaya_name!=='')return d.wilaya_name;if(d.commune_name&&d.commune_name!=='')return d.commune_name;if(d.city&&d.city!=='')return d.city;if(d.wilaya_code)return _W[parseInt(d.wilaya_code)]||('Wilaya '+d.wilaya_code);return 'Algérie';}

// [Phase 16.5 refactor] loadRealDoctors() supprimée — full table scan (84 Mo/visiteur).
// Remplacée par loadDoctorCards() (déjà active) + window.tabibiDoctors API.
/* loadRealDoctors désactivée */

function animateCounters(total){if(!total)return;const targets=[document.getElementById("hero-doc-count"),document.getElementById("stats-doc-count"),document.getElementById("foot-doc-count")].filter(Boolean);const duration=1200,start=performance.now();function tick(now){const p=Math.min((now-start)/duration,1);const eased=1-Math.pow(1-p,3);const val=Math.floor(eased*total);const txt=val.toLocaleString("fr-DZ");targets.forEach(el=>{if(el)el.textContent=txt;});if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);}

// [Phase 5.5 fix BUG #1] Recherche médecins SERVEUR — accepte un objet
// `opts` de filtres et construit une query PostgREST. AVANT (Phase 5.4) :
// fetch limit=20 sans filtres + filtrage client sur 20 cards → Constantine+ORL
// retournait "0 médecin(s)" alors que la DB a 37 ORL Constantine.
//
// Filtres SERVEUR (colonnes présentes dans la vue public_doctors) :
//   wilaya_fr (eq), specialty_fr (eq), full_name (ilike OR-search), is_verified (eq)
// Filtres CLIENT (colonnes manquantes — fallback post-fetch sur les 20 résultats) :
//   maxPrice, minRating, urgent, gender ← skippés tant que les colonnes
//   `consultation_fee_dzd`, `rating`, `is_urgent`, `gender` ne sont pas
//   ajoutées à la vue. Tracked SQL_TODO TODO-SQL-004/005/006.
//
// Compteur via Prefer: count=estimated + parsing header Content-Range "0-19/<TOTAL>".
// N'écrit JAMAIS sur hero-doc-count / stats-doc-count / foot-doc-count
// (réservés exclusivement à animateCounters via fetchDoctorCount).
// AbortController : annule un fetch en cours si l'utilisateur retape vite.
// Race-protection : numéro de séquence ; on ignore une réponse plus ancienne
// que la dernière demandée (= AbortController + safety net).
let _loadDocsAbort = null;
let _loadDocsSeq = 0;
let _lastDoctorTotal = 0;
let _lastFilterOpts = {};

// [Phase 5.6 fix BUG #1 v2] Fetch DISTINCT values des colonnes que filtre la
// recherche : la cause racine du bug Mostaganem+Cardiologie etc. = mismatch
// total entre l'UI (`Cardiologie`, `Pédiatrie`, ...) et la DB (`Cardiologue`,
// `Pédiatre`, ...). Phase 5.5 avait fixé Constantine+ORL parce que `ORL` et
// `Dentiste` étaient les SEULS specs qui matchaient (2/30).
// On peuple maintenant le <select id="f-spec"> avec les vraies valeurs DB.
window._DB_SPECIALTIES = null;
window._DB_WILAYAS = null;
// [Phase 16.5 refactor] _fetchDistinctSpecsAndWilayas() :
//   - Wilayas  : dérivées de _W (0 requête réseau, instantané)
//   - Spécialités : 1 fetch × 500 lignes (vs 10 000 avant)
//     → économie ~95% bande passante pour cet appel
async function _fetchDistinctSpecsAndWilayas(){
  // ── Wilayas : pas de fetch, on lit le dict _W déjà en mémoire ──────────
  try {
    const wilayas = Object.values(_W).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
    if (wilayas.length) window._DB_WILAYAS = wilayas;
  } catch (e) {
    console.warn('[Tabibi] _W wilayas KO', e && e.message);
  }

  // ── Spécialités : liste DISTINCT servie par la RPC stats_publiques [C1] ─
  try {
    const st = await _tbStats();
    const specs = Array.isArray(st.specialites) ? st.specialites.slice().sort((a, b) => a.localeCompare(b, 'fr')) : [];
    if (specs.length) window._DB_SPECIALTIES = specs;
  } catch (e) {
    console.warn('[Tabibi] fetchDistinct specialty_fr KO', e && e.message);
  }
}

// Mappe un nom de spécialité UI ("Cardiologie") vers la valeur DB correspondante
// ("Cardiologue") via match exact d'abord, puis prefix-match fuzzy normalisé
// (NFD strip accents + lowercase). Si aucune correspondance, retourne uiName
// tel quel — la recherche retournera 0 résultats avec empty state intelligent.
function _specUIToDB(uiName){
  if(!uiName) return '';
  const list = window._DB_SPECIALTIES;
  if(!Array.isArray(list) || !list.length) return uiName;
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const target = norm(uiName);
  // 1. Match exact (Dentiste, ORL, Sage-femme, Pharmacie)
  for(const v of list){ if(norm(v) === target) return v; }
  // 2. Prefix-match — 7 chars pour éviter "orthopédie" → "orthophoniste"
  //    (les 2 partagent "orthop" mais "orthope" diffère de "orthopho").
  if(target.length >= 5){
    const prefix = target.substring(0, Math.min(7, target.length - 2));
    for(const v of list){ if(norm(v).startsWith(prefix)) return v; }
  }
  // 3. Cas 2 mots — premier mot prefix 7 (ex: "Médecine Générale"
  //    → premier mot "medecine" → prefix "medecin" → "Médecin généraliste").
  const firstWord = target.split(/\s+/)[0];
  if(firstWord && firstWord.length >= 5){
    const prefix = firstWord.substring(0, Math.min(7, firstWord.length - 1));
    for(const v of list){ if(norm(v).startsWith(prefix)) return v; }
  }
  return uiName;   // pas trouvé → laisse passer, filtre serveur → 0 hits
}

function _inferEntityType(slug){
  // Devine entity_type à partir de specialty_slug (la vue n'expose pas la
  // colonne — workaround Phase 5.5 jusqu'à TODO-SQL-001).
  if(!slug) return null;
  const s = String(slug).toLowerCase();
  if(s.indexOf('pharmacie') !== -1)   return 'pharmacie';
  if(s.indexOf('laboratoire') !== -1) return 'laboratoire';
  if(s.indexOf('clinique') !== -1)    return 'clinique';
  if(s.indexOf('cabinet') !== -1)     return 'cabinet';
  if(s.indexOf('centre') !== -1)      return 'centre';
  if(s.indexOf('hopital') !== -1 || s.indexOf('hôpital') !== -1) return 'hopital';
  return null;   // défaut médecin → préfixe "Dr."
}

// =====================================================================
// [15/09/2026] « cardiologue bejaia » doit trouver, sans menu et sans accent
// =====================================================================
// LE DEFAUT : depuis le durcissement C1 (b878ff8, 09/09), taper un terme dans
// la barre SANS choisir de menu affichait « Choisissez une wilaya ou une
// specialite » — et n'appelait meme pas le serveur. La barre de recherche
// **avait cesse de chercher** pendant six jours.
//
// La RPC accepte desormais `p_q` seul (corrige en base par le stratege). Le
// garde-fou du front, lui, ne laissait toujours pas passer le texte.
//
// ---------------------------------------------------------------------
// CE QUE FAIT CETTE FONCTION, ET POURQUOI ELLE EST SEPAREE
// ---------------------------------------------------------------------
// Elle lit le texte libre et en extrait ce qu'elle RECONNAIT franchement :
// une wilaya, une specialite. Le reste part en `p_q`.
//
// « cardiologue bejaia »  ->  p_specialite='Cardiologue', p_wilaya='Béjaïa'
// « benali »              ->  p_q='benali'   (aucun jeton reconnu)
// « cardiologue benali »  ->  p_specialite='Cardiologue', p_q='benali'
//
// ⚠️ ELLE NE REMPLACE JAMAIS UN MENU. Si `f-ville` ou `f-spec` est rempli,
// l'utilisateur a choisi : son choix prime, et rien n'est devine.
//
// ⚠️ ET ELLE NE DEVINE PAS A MOITIE. Un jeton doit correspondre **exactement**
// (apres normalisation) a une valeur de la base. Un prefixe suffirait a faire
// d'un nom de medecin une specialite — « Dr Cardin » deviendrait
// « Cardiologue », et la recherche rendrait 1 500 fiches au lieu d'une.
//
// La normalisation (minuscules + sans accents) sert LES DEUX COTES : c'est
// elle qui fait que « bejaia » trouve « Béjaïa ».
// ---------------------------------------------------------------------
function _normaliserRecherche(s){
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function _analyserTexteLibre(texte, wilayas, specialites){
  const vide = { wilaya: null, spec: null, reste: null };
  const brut = String(texte == null ? '' : texte).trim();
  if(!brut) return vide;

  const W = Array.isArray(wilayas) ? wilayas : [];
  const S = Array.isArray(specialites) ? specialites : [];
  // Index normalise -> valeur EXACTE de la base. C'est cette valeur-la qu'on
  // renvoie : la RPC compare a la base, pas a ce que l'utilisateur a tape.
  const index = (liste) => {
    const m = new Map();
    for(const v of liste){ const n = _normaliserRecherche(v); if(n) m.set(n, v); }
    return m;
  };
  const iW = index(W);
  const iS = index(S);

  const jetons = _normaliserRecherche(brut).split(' ').filter(Boolean);
  if(!jetons.length) return vide;

  let wilaya = null, spec = null;
  const reste = [];
  for(let i = 0; i < jetons.length; i++){
    // Les valeurs a deux mots d'abord (« bordj bou arreridj », « medecin
    // generaliste ») : sans ca, « bordj » seul ne correspondrait a rien et on
    // perdrait la wilaya.
    let pris = false;
    for(let n = Math.min(3, jetons.length - i); n >= 1 && !pris; n--){
      const groupe = jetons.slice(i, i + n).join(' ');
      if(!wilaya && iW.has(groupe)){ wilaya = iW.get(groupe); i += n - 1; pris = true; break; }
      if(!spec   && iS.has(groupe)){ spec   = iS.get(groupe); i += n - 1; pris = true; break; }
    }
    if(!pris) reste.push(jetons[i]);
  }

  return {
    wilaya,
    spec,
    // Le reste part tel quel en texte libre. S'il ne reste rien, `p_q` est
    // nul : la recherche porte alors uniquement sur les deux filtres, ce qui
    // est exactement ce que les menus auraient fait.
    reste: reste.length ? reste.join(' ') : null,
  };
}

// [C1] Arguments de la RPC chercher_praticiens. Le texte libre est passé tel
// quel : c'est la RPC qui neutralise les jokers ilike et borne à 60 caractères.
function _buildDoctorCardsArgs(opts, page){
  let wilaya = opts.ville || null;
  let spec   = opts.spec  || null;
  let q      = opts.search ? String(opts.search).trim() || null : null;

  // Le texte n'est analyse QUE si l'utilisateur n'a choisi aucun menu. Un choix
  // explicite prime toujours sur une devinette.
  if(!wilaya && !spec && q){
    const lu = _analyserTexteLibre(q, window._DB_WILAYAS, window._DB_SPECIALTIES);
    if(lu.wilaya || lu.spec){ wilaya = lu.wilaya; spec = lu.spec; q = lu.reste; }
  }

  return {
    p_wilaya:     wilaya,
    p_specialite: spec,
    p_q:          q,
    p_type:       null,
    p_page:       Math.min(100, Math.max(1, page || 1)),
    p_limite:     Math.min(50, PER)
  };
}
// [C1] Sans wilaya ni spécialité, la RPC refuse (400 filtre_obligatoire) :
// on affiche l'invite et on n'appelle pas le serveur.
function _renderChooseFilter(){
  const rc = document.getElementById('res-count'); if(rc) rc.textContent = '';
  const box = document.getElementById('docs-list');
  if(box){
    // Construit l'état vide par l'API DOM (aucun innerHTML : texte i18n → textContent).
    const wrap = document.createElement('div'); wrap.className = 'empty-state';
    const ico = document.createElement('div'); ico.className = 'empty-icon';
    const i = document.createElement('i'); i.className = 'fa fa-location-dot'; ico.appendChild(i);
    const titre = document.createElement('div'); titre.className = 'empty-title'; titre.textContent = T('docs_choose_filter');
    const sous = document.createElement('p'); sous.textContent = T('docs_choose_filter_sub');
    wrap.append(ico, titre, sous);
    box.replaceChildren(wrap);
  }
  const pag = document.getElementById('pag'); if(pag) pag.replaceChildren();
  DOCTORS.length = 0; _lastDoctorTotal = 0;
}

async function loadDoctorCards(opts, page){
  opts = opts || {};
  page = page || 1;
  _lastFilterOpts = opts;

  // Annule un fetch en vol si l'user retape
  if(_loadDocsAbort){ try{ _loadDocsAbort.abort(); }catch (e) { (window.tabibiErreur || console.warn)(e, 'home-app.js:1764'); } }
  _loadDocsAbort = (typeof AbortController!=='undefined') ? new AbortController() : null;
  const signal = _loadDocsAbort ? _loadDocsAbort.signal : undefined;
  const mySeq = ++_loadDocsSeq;

  // Loading state — discret pour ne pas flash le compteur
  const rc = document.getElementById('res-count');
  if(rc) rc.textContent = '...';

  // [15/09/2026] `!opts.search` AJOUTE. Sans lui, taper « cardiologue » sans
  // toucher aux menus affichait « Choisissez une wilaya ou une specialite » et
  // **n'appelait pas le serveur** : la barre de recherche ne cherchait plus.
  // La RPC accepte `p_q` seul depuis aujourd'hui ; le front doit la laisser
  // faire son travail.
  if(!opts.ville && !opts.spec && !opts.search){ _renderChooseFilter(); return; }

  try {
    const res = await _tbRpc('chercher_praticiens', _buildDoctorCardsArgs(opts, page), signal);
    if(mySeq !== _loadDocsSeq) return;  // une requête plus récente a démarré
    if(!res.ok){
      console.warn('[Tabibi] loadDoctorCards HTTP', res.status);
      if(rc) rc.textContent = '';
      // [INTÉGRITÉ 2026-07-09] plus d'échec silencieux : état d'erreur + Réessayer
      var _dl=document.getElementById('docs-list');
      if(_dl) _dl.innerHTML = '<div style="text-align:center;padding:34px 16px;color:var(--text3)">'
        + '<div style="width:52px;height:52px;border-radius:50%;background:#F4EEE2;color:#B49B62;display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 10px"><i class="fa fa-triangle-exclamation"></i></div>'
        + '<div style="font-size:14px;font-weight:800;color:var(--ink);margin-bottom:3px">' + T('docs_load_err') + '</div>'
        + '<div style="font-size:12.5px;margin-bottom:9px">' + T('docs_load_err_sub') + '</div>'
        + '<a onclick="doFilter(true)" style="font-size:12.5px;font-weight:700;color:#0E5F46;border-bottom:1px dashed #0F7560;cursor:pointer">' + T('retry') + '</a></div>';
      return;
    }
    // [C1] La RPC renvoie { total, page, limite, lignes }
    const corps = await res.json();
    if(mySeq !== _loadDocsSeq) return;
    const total = (corps && corps.total) || 0;
    _lastDoctorTotal = total;
    const batch = (corps && corps.lignes) || [];

    // Hydrate DOCTORS
    DOCTORS.length = 0;
    (Array.isArray(batch) ? batch : []).forEach((d, i) => {
      const clr = _COLORS[i % _COLORS.length];
      const DN = window.tabibiDoctorName;
      // [Phase 13] entity_type vient maintenant directement de la vue (32 cols).
      // Fallback _inferEntityType uniquement si NULL (cas rare en M0, base entièrement typée).
      const inferredEntity = d.entity_type || _inferEntityType(d.specialty_slug);
      const dForName = { ...d, entity_type: inferredEntity };
      const nameFr = DN ? DN.formatForLang(dForName,'fr') : (d.full_name || 'Médecin');
      const nameAr = DN ? DN.formatForLang(dForName,'ar') : (d.full_name_ar || d.full_name || nameFr);
      const nameEn = DN ? DN.formatForLang(dForName,'en') : (d.full_name || nameFr);
      const ini    = DN ? DN.initials(dForName) : '?';
      // [Phase 13] Composition ville : "City, Wilaya" si city dispo, sinon wilaya seul
      const cityStr = (d.city && d.city.trim()) ? (d.city + ', ' + (d.wilaya_fr || '')) : (d.wilaya_fr || _ville(d));
      DOCTORS.push({
        id: String(d.id || ('db_'+i)),
        entityType: dForName.entity_type,
        fr: nameFr, ar: nameAr, en: nameEn,
        spec: _spec(d), sAr:'', sEn:'',
        ville: cityStr, vAr:'', vEn:'',
        wilayaCode: d.wilaya_code || null,
        // null si pas de donnée — docCard affiche "Tarif à confirmer" / "Pas encore noté"
        note: (d.rating != null) ? parseFloat(d.rating) : null,
        prix: (d.consultation_fee_dzd != null && d.consultation_fee_dzd > 0) ? parseInt(d.consultation_fee_dzd, 10) : null,
        urgent: false,  // colonne is_urgent toujours pas dans la vue enrichie
        cert: d.is_verified !== undefined ? !!d.is_verified : false,
        in: ini, bg: clr.bg, tc: clr.tc,
        g: 'H',  // colonne gender toujours pas dans la vue enrichie
        avis: parseInt(d.review_count || 0) || 0,
        langs: Array.isArray(d.languages) ? d.languages.map(l => l.toUpperCase()) : ['FR','AR'],
        desc: d.bio || '',
        addr: d.address || '',
        diplomes: [],
        // [Phase 13] Nouveaux champs DB
        photoUrl:    d.photo_url || null,
        bio:         d.bio || null,
        workingHours: d.working_hours || null,
        telehealth:  !!d.telehealth_enabled,
        telehealthFee: (d.telehealth_fee_dzd != null && d.telehealth_fee_dzd > 0) ? parseInt(d.telehealth_fee_dzd,10) : null,
        acceptsCard:  !!d.accepts_card,
        acceptsChifa: !!d.accepts_chifa,
        acceptsCash:  d.accepts_cash !== false,  // defaut true si null
        claimed:     !!d.is_claimed,
        validationStatus: d.validation_status || null,  // [Phase 16.4]
        latitude:    d.latitude || null,
        longitude:   d.longitude || null
      });
    });

    // Post-filter client (colonnes absentes de la vue — skippe si filtre actif
    // sur des colonnes absent = retourne tout vu qu'on ne sait pas filtrer)
    let res2 = [...DOCTORS];
    if(opts.maxPrice != null){
      // Ne filtre que les docs qui ONT un prix renseigné > maxPrice. Pas de
      // prix renseigné = laisse passer (sinon on cacherait toute la base).
      res2 = res2.filter(d => d.prix == null || d.prix <= opts.maxPrice);
    }
    if(opts.minRating > 0){
      res2 = res2.filter(d => d.note != null && d.note >= opts.minRating);
    }
    if(opts.chips && opts.chips.indexOf('fem') !== -1){
      res2 = res2.filter(d => d.g === 'F');
    }
    if(opts.chips && opts.chips.indexOf('urg') !== -1){
      res2 = res2.filter(d => d.urgent);
    }
    if(opts.chips && opts.chips.indexOf('cheap') !== -1){
      res2 = res2.filter(d => d.prix == null || d.prix < 2000);
    }

    filtered = res2; curPage = page;
    renderDocs();
    _updateResCount(total, res2.length, opts);
  } catch(e) {
    if(e && e.name === 'AbortError') return;
    console.warn('[Tabibi] loadDoctorCards exception:', e && e.message);
      var _dl=document.getElementById('docs-list');
      if(_dl) _dl.innerHTML = '<div style="text-align:center;padding:34px 16px;color:var(--text3)">'
        + '<div style="width:52px;height:52px;border-radius:50%;background:#F4EEE2;color:#B49B62;display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 10px"><i class="fa fa-triangle-exclamation"></i></div>'
        + '<div style="font-size:14px;font-weight:800;color:var(--ink);margin-bottom:3px">' + T('docs_load_err') + '</div>'
        + '<div style="font-size:12.5px;margin-bottom:9px">' + T('docs_load_err_sub') + '</div>'
        + '<a onclick="doFilter(true)" style="font-size:12.5px;font-weight:700;color:#0E5F46;border-bottom:1px dashed #0F7560;cursor:pointer">' + T('retry') + '</a></div>';
    if(rc) rc.textContent = '';
  }
}

// Affiche un compteur + message UX selon contexte
function _updateResCount(serverTotal, shownLocal, opts){
  const rc = document.getElementById('res-count');
  if(!rc) return;
  if(serverTotal === 0){
    const filtersActive = !!(opts.ville || opts.spec || opts.search
                          || opts.maxPrice != null || opts.minRating > 0
                          || (opts.chips && opts.chips.length));
    if(filtersActive){
      rc.innerHTML = '<span style="color:var(--text2)">Aucun médecin avec ces filtres.</span> '
                   + '<button type="button" onclick="resetFilters()" '
                   + 'style="background:none;border:none;color:var(--blue);font-weight:600;cursor:pointer;text-decoration:underline;font-size:inherit;font-family:inherit;padding:0">'
                   + 'Voir tous les médecins</button>';
    } else {
      rc.textContent = '0 ' + (T('found')||'médecin(s) trouvé(s)');
    }
    return;
  }
  if(serverTotal > 20){
    rc.textContent = shownLocal + ' affichés sur ' + serverTotal.toLocaleString('fr-DZ')
                   + ' — affinez votre recherche pour voir plus';
  } else {
    rc.textContent = serverTotal.toLocaleString('fr-DZ') + ' ' + (T('found')||'médecin(s) trouvé(s)');
  }
}

// Reset complet : vide tous les filtres puis recharge
function resetFilters(){
  const ns = document.getElementById('name-search'); if(ns) ns.value = '';
  const fv = document.getElementById('f-ville');    if(fv) fv.value = '';
  const fs = document.getElementById('f-spec');     if(fs) fs.value = '';
  const fp = document.getElementById('f-price');
  if(fp){
    fp.value = 10000;
    const pl = document.getElementById('price-lbl');
    if(pl) pl.textContent = '10 000 DA';
  }
  document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
  doFilter(true);
}
window.resetFilters = resetFilters;

/* INIT */
document.addEventListener("DOMContentLoaded",()=>{
  loadUser(); setLang(lang);
  // 1er populateSelects avec SPECS/CITIES hardcodés (instant, pas de réseau)
  // pour avoir une UI réactive immédiate.
  populateSelects(); renderSpecs(); renderChips();
  renderUserUI(); initTabBar("home");
  // [ÉTAPE C] Source unique des stats : 1 routine COUNT au load → window.TABIBI_STATS
  _loadTabibiStats();

  // [Phase 5.6 fix BUG #1 v2] Fetch async des DISTINCT specialty_fr +
  // wilaya_fr depuis la DB → re-populate les <select> avec les VRAIES valeurs.
  // En parallèle, doFilter(true) déclenche un 1er load des cards. Si le
  // user clique un filtre avant que distinct soit prêt, on a le fallback
  // SPECS/CITIES (qui ne matchera pas la DB pour spec mais c'est temporaire,
  // <300ms typique). Quand distinct arrive, on re-populate + re-render chips.
  _fetchDistinctSpecsAndWilayas().then(() => {
    populateSelects();
    renderSpecs();
  }).catch(e => console.warn('[Tabibi] fetchDistinct boot KO', e && e.message));

  // [Phase 5.5] doFilter(true) déclenche loadDoctorCards immédiatement (pas
  // de debounce 300ms au load). loadDoctorCards récupère 20 médecins +
  // count exact ET applique les filtres UI (vides au load).
  doFilter(true);
  /* loadRealDoctors(); désactivé */     // ancienne fonction batches multi-pages (rollback)
  setTimeout(()=>{const s=document.getElementById("splash");if(s){s.classList.add("hide");setTimeout(()=>s.remove(),420);}},1800);
});

// [ÉTAPE C] SOURCE UNIQUE des stats — alimentée par _loadTabibiStats() au load.
// Définitions : indexed = total vitrine EN DUR (count=estimated sous-évaluait :
//               37 517 vs 75 033 réels, COALESCE dans le WHERE de la vue)
//               certified = public_doctors?validation_status=eq.approved (estimated)
// Label affiché partout où le total "référencés" apparaît :
var TABIBI_DOCTOR_COUNT_LABEL = '75 000+';
window.TABIBI_STATS = { indexed: 0, listed: 0, certified: 0, claimed: 0 };

async function _loadTabibiStats() {
  try {
    // [C1] compteurs servis par la RPC stats_publiques (agrégat, aucun nom).
    // Le total "référencés" reste EN DUR (TABIBI_DOCTOR_COUNT_LABEL).
    var st = await _tbStats();
    window.TABIBI_STATS = { indexed: 75000, certified: parseInt(st.certifies, 10) || 0, listed: 0, claimed: 0 };
  } catch (e) { /* garde les valeurs courantes */ }
  _updateDocCounterUI();
}

// Tous les compteurs lisent window.TABIBI_STATS (plus aucun COUNT dupliqué dispersé).
function _updateDocCounterUI() {
  var _lm = { fr: 'fr-DZ', ar: 'ar-DZ', en: 'en-US' };
  var _loc = _lm[lang] || 'fr-DZ';
  var _S = window.TABIBI_STATS || { indexed: 0, certified: 0 };
  var _cert = _S.certified || 0;
  var _idx  = _S.indexed || 0;
  var _fc = _cert.toLocaleString(_loc);
  // Total vitrine : chaîne EN DUR (jamais de toLocaleString dessus) ;
  // _idx reste numérique pour les seuls tests de pluriel (_idx>1).
  var _fi = TABIBI_DOCTOR_COUNT_LABEL;
  var _hb = document.getElementById('hbadge');
  // [ÉTAPE D] certified=0 → "N médecins référencés" ; certified>0 → "X certifiés · Y référencés"
  if (_hb) {
    if (_cert >= 10) {  // [FIX 2026-07-08] seuil : jamais de petit « N certifiés » ni de 0
      _hb.textContent = lang === 'ar' ? _fc + ' طبيب معتمد · ' + _fi + ' مُدرج في الجزائر'
                      : lang === 'en' ? _fc + ' certified · ' + _fi + ' referenced in Algeria'
                      :                 _fc + ' certifié'+(_cert>1?'s':'') + ' · ' + _fi + ' référencé'+(_idx>1?'s':'') + ' en Algérie';
    } else {
      _hb.textContent = lang === 'ar' ? _fi + ' طبيب مُدرج في الجزائر'
                      : lang === 'en' ? _fi + ' doctors referenced in Algeria'
                      :                 _fi + ' médecin'+(_idx>1?'s':'') + ' référencé'+(_idx>1?'s':'') + ' en Algérie';
    }
  }
  var _hdc = document.getElementById('hero-doc-count'); if (_hdc) _hdc.textContent = _fi;
  var _sdc = document.getElementById('stats-doc-count'); if (_sdc) _sdc.textContent = _fi;
  var _fdc = document.getElementById('foot-doc-count');  if (_fdc) _fdc.textContent = _fi;
  // [REEL 2026-07-08] Compteur section avis : certifiés réels uniquement, sinon caché.
  var _vc = document.getElementById('v4-counter');
  if (_vc) {
    if (_cert >= 10) {  // [FIX 2026-07-08] seuil : jamais de petit « N certifiés » ni de 0
      _vc.hidden = false;
      var _vn = document.getElementById('v4-cnt-num'); if (_vn) _vn.textContent = _fc;
      var _vl = document.getElementById('v4-cnt-lab');
      if (_vl) _vl.textContent = lang === 'ar' ? 'طبيب معتمد في الجزائر'
                               : lang === 'en' ? 'certified doctors in Algeria'
                               :                 'médecins certifiés en Algérie';
    } else { _vc.hidden = true; }
  }
  var _fdEl = document.getElementById('foot-desc');
  if (_fdEl) _fdEl.textContent = lang === 'ar'
    ? 'أول منصة طبية جزائرية. ' + _fi + ' طبيب مُدرج في 58 ولاية. احجز عبر الإنترنت 24/24.'
    : lang === 'en'
    ? '1st Algerian medical platform. ' + _fi + ' referenced doctors across 58 wilayas. Book online 24/7.'
    : 'La 1ère plateforme médicale algérienne. ' + _fi + ' médecins référencés dans 58 wilayas. Réservez en ligne 24h/24.';
}
window.doFilter=doFilter; window.goPage=goPage; window.goDoc=goDoc; window.bookDoc=bookDoc;
window.filterBySpec=filterBySpec; window.onLangChange=onLangChange;
window.selectProfileSlot=selectProfileSlot; window.confirmFromProfile=confirmFromProfile;
window.finalBooking=finalBooking;window.openMapOverlay=openMapOverlay;window.closeMapOverlay=closeMapOverlay;window._tbOpenDoc=_tbOpenDoc;
window.showPatientDashboardModal=showPatientDashboardModal;
window.showDoctorDashboardModal=showDoctorDashboardModal;
