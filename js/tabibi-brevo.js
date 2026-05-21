/* ═══════════════════════════════════════════════════════════════════════
   TABIBI v10.5 — SERVICE BREVO (MULTILINGUE FR/AR/EN + XSS-safe)
   ═══════════════════════════════════════════════════════════════════════

   AMÉLIORATIONS v10.5 :
   ✅ Templates FR + AR (RTL) + EN
   ✅ Détection automatique de la langue préférée du destinataire
   ✅ Échappement HTML sur tous les inputs utilisateur
   ✅ Fallback gracieux si template/langue manquante

   USAGE :
     await window.tabibiBrevo.sendEmail('welcome_patient', 'user@example.com', {
       firstName: 'Ahmed',
       lang: 'ar'  // optionnel, défaut: 'fr'
     });
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const TABIBI_CONFIG = {
    fromEmail: 'contact@tabibi.doctor',
    fromName: 'Tabibi DZ',
    replyTo: 'contact@tabibi.doctor',
    siteUrl: 'https://tabibi.doctor',
    primaryColor: '#0F7560',
    accentColor: '#2E8B57',
    enabled: true
  };

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'/]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' }[c];
    });
  }

  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email);
  }

  function escUrl(url) {
    if (!url) return '';
    const s = String(url).trim();
    if (/^(javascript|data|vbscript|file):/i.test(s)) return '#';
    return esc(s);
  }

  /**
   * Email wrapper RTL/LTR-aware avec font Cairo pour AR
   */
  function emailWrap(lang, titleSafe, contentSafe, ctaText, ctaUrl, labels) {
    const isRTL = (lang === 'ar');
    const dir = isRTL ? 'rtl' : 'ltr';
    const fontFamily = isRTL
      ? "'Cairo','Tajawal',Arial,sans-serif"
      : "'Inter','Segoe UI',Arial,sans-serif";

    const ctaTextSafe = esc(ctaText || '');
    const ctaUrlSafe = escUrl(ctaUrl || '');
    const cta = (ctaTextSafe && ctaUrlSafe && ctaUrlSafe !== '#') ? `
      <tr><td style="padding:24px 0;text-align:center">
        <a href="${ctaUrlSafe}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,${TABIBI_CONFIG.primaryColor},#0a4d3e);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;font-family:${fontFamily}">${ctaTextSafe}</a>
      </td></tr>` : '';

    const footer = labels.footer_sent_by;
    const footerLinks = labels.footer_links;

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titleSafe)}</title>
${isRTL ? '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">' : ''}
</head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:${fontFamily};color:#0f172a" dir="${dir}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6fa;padding:32px 16px" dir="${dir}">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,${TABIBI_CONFIG.primaryColor},#0a4d3e);padding:32px 24px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-.5px">Tabibi <span style="color:#2E8B57">D</span><span style="color:#D21010">Z</span></h1>
            <p style="margin:6px 0 0 0;color:rgba(255,255,255,.85);font-size:13px;font-weight:500">${esc(labels.tagline)}</p>
          </td>
        </tr>
        <tr><td style="padding:32px 32px 16px 32px;text-align:${isRTL ? 'right' : 'left'}">${contentSafe}</td></tr>
        ${cta}
        <tr>
          <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e5e7eb">
            <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;text-align:center;line-height:1.6">${footer}</p>
            <p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6">
              <a href="${TABIBI_CONFIG.siteUrl}" style="color:${TABIBI_CONFIG.primaryColor};text-decoration:none">tabibi.doctor</a>
              · <a href="${TABIBI_CONFIG.siteUrl}/confidentialite.html" style="color:#94a3b8;text-decoration:none">${esc(footerLinks.privacy)}</a>
              · <a href="${TABIBI_CONFIG.siteUrl}/cgu.html" style="color:#94a3b8;text-decoration:none">${esc(footerLinks.terms)}</a>
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">© 2026 Tabibi · ${esc(labels.location)}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Labels communs (footer, etc.) par langue
   */
  const COMMON = {
    fr: {
      tagline: 'La santé à portée de clic',
      footer_sent_by: 'Email envoyé par <strong style="color:#0f172a">Tabibi</strong> — 1ère plateforme algérienne de prise de RDV médical.',
      footer_links: { privacy: 'Confidentialité', terms: 'CGU' },
      location: 'Alger, Algérie'
    },
    ar: {
      tagline: 'الصحة على بُعد نقرة',
      footer_sent_by: 'بريد إلكتروني من <strong style="color:#0f172a">طبيبي</strong> — أول منصة جزائرية لحجز المواعيد الطبية.',
      footer_links: { privacy: 'الخصوصية', terms: 'الشروط' },
      location: 'الجزائر العاصمة'
    },
    en: {
      tagline: 'Healthcare at your fingertips',
      footer_sent_by: 'Email sent by <strong style="color:#0f172a">Tabibi</strong> — 1st Algerian medical appointment platform.',
      footer_links: { privacy: 'Privacy', terms: 'Terms' },
      location: 'Algiers, Algeria'
    }
  };

  /**
   * Templates multilingues. Chaque template est une fonction qui retourne
   * { subject, html } selon la langue passée dans data.lang.
   */
  const templates = {
    welcome_patient(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const name = esc(data.firstName);

      const T = {
        fr: {
          subject: 'Bienvenue sur Tabibi' + (name ? ', ' + name : '') + ' ! 🩺',
          h2: 'Bonjour ' + (name || 'cher patient') + ',',
          intro: 'Bienvenue sur <strong>Tabibi</strong>, la 1ère plateforme algérienne de prise de RDV médical en ligne.',
          features_title: 'Avec Tabibi, vous pouvez :',
          li1: '🔍 Trouver un médecin dans 48 wilayas',
          li2: '📅 Prendre RDV 24h/24 en quelques clics',
          li3: '⏰ Recevoir des rappels automatiques',
          li4: '⭐ Consulter les avis vérifiés des patients',
          contact: 'Pour toute question : <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>',
          cta: 'Trouver un médecin'
        },
        ar: {
          subject: 'مرحبًا بك في طبيبي' + (name ? '، ' + name : '') + ' ! 🩺',
          h2: 'مرحبًا ' + (name || 'عزيزي المريض') + '،',
          intro: 'مرحبًا بك في <strong>طبيبي</strong>، أول منصة جزائرية لحجز المواعيد الطبية عبر الإنترنت.',
          features_title: 'مع طبيبي، يمكنك :',
          li1: '🔍 العثور على طبيب في 48 ولاية',
          li2: '📅 حجز موعد 24/24 ببضع نقرات',
          li3: '⏰ تلقي تذكيرات تلقائية',
          li4: '⭐ الاطلاع على تقييمات المرضى الموثقة',
          contact: 'للاستفسار : <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>',
          cta: 'البحث عن طبيب'
        },
        en: {
          subject: 'Welcome to Tabibi' + (name ? ', ' + name : '') + '! 🩺',
          h2: 'Hello ' + (name || 'dear patient') + ',',
          intro: 'Welcome to <strong>Tabibi</strong>, Algeria\'s 1st online medical appointment booking platform.',
          features_title: 'With Tabibi, you can:',
          li1: '🔍 Find a doctor in 48 wilayas',
          li2: '📅 Book 24/7 in a few clicks',
          li3: '⏰ Receive automatic reminders',
          li4: '⭐ See verified patient reviews',
          contact: 'For questions: <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>',
          cta: 'Find a doctor'
        }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.features_title}</p>
           <ul style="margin:0 0 16px 0;padding-${lang==='ar'?'right':'left'}:20px;font-size:14px;line-height:1.8;color:#334155">
             <li>${t.li1}</li><li>${t.li2}</li><li>${t.li3}</li><li>${t.li4}</li>
           </ul>
           <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b">${t.contact}</p>`,
          t.cta, TABIBI_CONFIG.siteUrl, c
        )
      };
    },

    medecin_pending(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const fname = esc(data.firstName);

      const T = {
        fr: {
          subject: 'Votre inscription Tabibi est en cours de vérification',
          h2: 'Bonjour ' + (fname ? 'Dr ' + fname : 'cher Docteur') + ',',
          intro: 'Votre inscription à <strong>Tabibi</strong> a bien été enregistrée. Merci de nous rejoindre.',
          alert_title: '⏳ Vérification en cours',
          alert_text: 'Notre équipe vérifie vos qualifications (diplôme + Conseil de l\'Ordre) sous <strong>48h ouvrées maximum</strong>.',
          docs_title: '📋 Documents à nous envoyer :',
          li1: 'Copie de votre diplôme de médecin',
          li2: 'Attestation du Conseil National de l\'Ordre',
          li3: 'Pièce d\'identité',
          send_to: 'Envoyez ces documents à <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '"><strong>contact@tabibi.doctor</strong></a>',
          end: 'Vous recevrez un email dès que votre compte sera activé.'
        },
        ar: {
          subject: 'تسجيلك في طبيبي قيد التحقق',
          h2: 'مرحبًا ' + (fname ? 'د. ' + fname : 'سيدي الطبيب الكريم') + '،',
          intro: 'تم تسجيل اشتراكك في <strong>طبيبي</strong> بنجاح. شكرًا لانضمامك إلينا.',
          alert_title: '⏳ التحقق قيد التنفيذ',
          alert_text: 'يقوم فريقنا بالتحقق من مؤهلاتك (الشهادة + هيئة الأطباء) خلال <strong>48 ساعة عمل كحد أقصى</strong>.',
          docs_title: '📋 الوثائق المطلوبة :',
          li1: 'نسخة من شهادة الطب',
          li2: 'شهادة من هيئة الأطباء الوطنية',
          li3: 'بطاقة الهوية',
          send_to: 'أرسل هذه الوثائق إلى <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '"><strong>contact@tabibi.doctor</strong></a>',
          end: 'ستتلقى بريدًا إلكترونيًا بمجرد تفعيل حسابك.'
        },
        en: {
          subject: 'Your Tabibi registration is being reviewed',
          h2: 'Hello ' + (fname ? 'Dr ' + fname : 'dear Doctor') + ',',
          intro: 'Your registration on <strong>Tabibi</strong> has been received. Thank you for joining us.',
          alert_title: '⏳ Verification in progress',
          alert_text: 'Our team is verifying your credentials (diploma + Medical Council) within <strong>48 business hours max</strong>.',
          docs_title: '📋 Documents to send us:',
          li1: 'Copy of your medical degree',
          li2: 'Certificate from the National Medical Council',
          li3: 'ID document',
          send_to: 'Send these documents to <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '"><strong>contact@tabibi.doctor</strong></a>',
          end: 'You\'ll get an email as soon as your account is activated.'
        }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <div style="background:#fff7ed;border-${lang==='ar'?'right':'left'}:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:0 0 20px 0">
             <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#92400e">${t.alert_title}</p>
             <p style="margin:0;font-size:13px;line-height:1.6;color:#78350f">${t.alert_text}</p>
           </div>
           <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#0f172a">${t.docs_title}</p>
           <ul style="margin:0 0 16px 0;padding-${lang==='ar'?'right':'left'}:20px;font-size:14px;line-height:1.8;color:#334155">
             <li>${t.li1}</li><li>${t.li2}</li><li>${t.li3}</li>
           </ul>
           <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#334155">${t.send_to}</p>
           <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b">${t.end}</p>`,
          null, null, c
        )
      };
    },

    medecin_validated(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const fname = esc(data.firstName);

      const T = {
        fr: {
          subject: '✅ Votre compte Tabibi est activé !',
          h2: 'Félicitations ' + (fname ? 'Dr ' + fname : 'cher Docteur') + ' !',
          alert: '✅ Votre compte Tabibi est désormais <strong>actif</strong>. Vous pouvez vous connecter et commencer à recevoir des RDV.',
          steps_title: '🚀 Prochaines étapes :',
          li1: 'Connectez-vous sur tabibi.doctor',
          li2: 'Complétez votre profil (photo, spécialités, horaires)',
          li3: 'Définissez vos disponibilités',
          li4: 'Recevez vos premiers RDV en ligne !',
          welcome: 'Bienvenue dans la communauté Tabibi.',
          cta: 'Accéder à mon espace médecin'
        },
        ar: {
          subject: '✅ تم تفعيل حسابك في طبيبي !',
          h2: 'تهانينا ' + (fname ? 'د. ' + fname : 'سيدي الطبيب') + ' !',
          alert: '✅ حسابك في طبيبي أصبح <strong>نشطًا</strong>. يمكنك الآن تسجيل الدخول والبدء في استقبال المواعيد.',
          steps_title: '🚀 الخطوات التالية :',
          li1: 'سجّل دخولك على tabibi.doctor',
          li2: 'أكمل ملفك الشخصي (صورة، تخصصات، مواعيد)',
          li3: 'حدد أوقات توفرك',
          li4: 'استقبل أولى مواعيدك عبر الإنترنت !',
          welcome: 'مرحبًا بك في مجتمع طبيبي.',
          cta: 'الدخول إلى حسابي'
        },
        en: {
          subject: '✅ Your Tabibi account is active!',
          h2: 'Congratulations ' + (fname ? 'Dr ' + fname : 'dear Doctor') + '!',
          alert: '✅ Your Tabibi account is now <strong>active</strong>. You can sign in and start receiving appointments.',
          steps_title: '🚀 Next steps:',
          li1: 'Sign in at tabibi.doctor',
          li2: 'Complete your profile (photo, specialties, schedule)',
          li3: 'Set your availability',
          li4: 'Receive your first online appointments!',
          welcome: 'Welcome to the Tabibi community.',
          cta: 'Access my doctor dashboard'
        }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <div style="background:#f0fdf4;border-${lang==='ar'?'right':'left'}:4px solid #10b981;border-radius:8px;padding:16px 20px;margin:0 0 20px 0">
             <p style="margin:0;font-size:14px;line-height:1.6;color:#065f46;font-weight:600">${t.alert}</p>
           </div>
           <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#0f172a">${t.steps_title}</p>
           <ol style="margin:0 0 16px 0;padding-${lang==='ar'?'right':'left'}:20px;font-size:14px;line-height:1.8;color:#334155">
             <li>${t.li1}</li><li>${t.li2}</li><li>${t.li3}</li><li>${t.li4}</li>
           </ol>
           <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b">${t.welcome}</p>`,
          t.cta, TABIBI_CONFIG.siteUrl + '/doctor-dashboard.html', c
        )
      };
    },

    medecin_rejected(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const fname = esc(data.firstName);
      const reason = esc(data.reason || 'documents insuffisants ou non conformes');

      const T = {
        fr: {
          subject: 'Concernant votre inscription Tabibi',
          h2: 'Bonjour ' + (fname ? 'Dr ' + fname : 'cher Docteur') + ',',
          intro: 'Nous avons examiné votre demande d\'inscription à Tabibi.',
          alert_title: 'Inscription non validée',
          reason_label: 'Raison : ',
          retry: 'Vous pouvez soumettre une nouvelle demande avec les documents complets à <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>.',
          end: 'Pour toute question, n\'hésitez pas à nous contacter.'
        },
        ar: {
          subject: 'بشأن تسجيلك في طبيبي',
          h2: 'مرحبًا ' + (fname ? 'د. ' + fname : 'سيدي الطبيب') + '،',
          intro: 'لقد قمنا بمراجعة طلب تسجيلك في طبيبي.',
          alert_title: 'لم يتم التحقق من التسجيل',
          reason_label: 'السبب : ',
          retry: 'يمكنك تقديم طلب جديد مع الوثائق الكاملة إلى <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>.',
          end: 'لأي استفسار، لا تتردد في التواصل معنا.'
        },
        en: {
          subject: 'Regarding your Tabibi registration',
          h2: 'Hello ' + (fname ? 'Dr ' + fname : 'dear Doctor') + ',',
          intro: 'We have reviewed your Tabibi registration request.',
          alert_title: 'Registration not validated',
          reason_label: 'Reason: ',
          retry: 'You can submit a new request with complete documents to <a href="mailto:contact@tabibi.doctor" style="color:' + TABIBI_CONFIG.primaryColor + '">contact@tabibi.doctor</a>.',
          end: 'For any question, please contact us.'
        }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <div style="background:#fef2f2;border-${lang==='ar'?'right':'left'}:4px solid #ef4444;border-radius:8px;padding:16px 20px;margin:0 0 20px 0">
             <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#991b1b">${t.alert_title}</p>
             <p style="margin:0;font-size:13px;line-height:1.6;color:#7f1d1d">${t.reason_label}${reason}</p>
           </div>
           <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#334155">${t.retry}</p>
           <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b">${t.end}</p>`,
          null, null, c
        )
      };
    },

    rdv_confirmation(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const name = esc(data.patientName);
      const docName = esc(data.doctorName) || (lang === 'ar' ? 'الطبيب' : (lang === 'en' ? 'the doctor' : 'le médecin'));
      const dateStr = esc(data.date);
      const timeStr = esc(data.time);
      const address = esc(data.address);

      const T = {
        fr: {
          subject: '✅ RDV confirmé avec ' + docName,
          h2: 'Bonjour ' + (name || 'cher patient') + ',',
          intro: 'Votre rendez-vous est <strong>confirmé</strong> ✅',
          details_label: 'Détails du RDV',
          remember: '⚠️ À retenir :',
          li1: 'Arrivez 10 minutes en avance',
          li2: 'Apportez votre carte d\'identité et carte Chifa',
          li3: 'Vous recevrez un rappel automatique avant le RDV',
          end: 'Pour annuler ou modifier votre RDV, connectez-vous à votre espace patient.',
          cta: 'Voir mon RDV'
        },
        ar: {
          subject: '✅ تم تأكيد الموعد مع ' + docName,
          h2: 'مرحبًا ' + (name || 'عزيزي المريض') + '،',
          intro: 'موعدك <strong>مؤكد</strong> ✅',
          details_label: 'تفاصيل الموعد',
          remember: '⚠️ ملاحظات مهمة :',
          li1: 'احضر قبل 10 دقائق من الموعد',
          li2: 'أحضر بطاقة الهوية وبطاقة الشفاء',
          li3: 'ستتلقى تذكيرًا تلقائيًا قبل الموعد',
          end: 'لإلغاء أو تعديل موعدك، سجّل دخولك إلى حسابك.',
          cta: 'عرض موعدي'
        },
        en: {
          subject: '✅ Appointment confirmed with ' + docName,
          h2: 'Hello ' + (name || 'dear patient') + ',',
          intro: 'Your appointment is <strong>confirmed</strong> ✅',
          details_label: 'Appointment details',
          remember: '⚠️ Reminders:',
          li1: 'Arrive 10 minutes early',
          li2: 'Bring your ID and Chifa card',
          li3: 'You\'ll receive an automatic reminder',
          end: 'To cancel or modify, sign in to your patient dashboard.',
          cta: 'View my appointment'
        }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin:0 0 20px 0">
             <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:700">${t.details_label}</p>
             <p style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#0f172a">${docName}</p>
             <p style="margin:0 0 6px 0;font-size:14px;color:#475569">📅 <strong>${dateStr || ''}${timeStr ? (lang === 'ar' ? ' في ' : ' à ') + timeStr : ''}</strong></p>
             ${address ? `<p style="margin:0;font-size:14px;color:#475569">📍 ${address}</p>` : ''}
           </div>
           <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#0f172a">${t.remember}</p>
           <ul style="margin:0 0 16px 0;padding-${lang==='ar'?'right':'left'}:20px;font-size:14px;line-height:1.8;color:#334155">
             <li>${t.li1}</li><li>${t.li2}</li><li>${t.li3}</li>
           </ul>
           <p style="margin:0;font-size:13px;color:#64748b">${t.end}</p>`,
          t.cta, TABIBI_CONFIG.siteUrl + '/patient-dashboard.html', c
        )
      };
    },

    rdv_reminder_j1(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const name = esc(data.patientName);
      const docName = esc(data.doctorName) || (lang === 'ar' ? 'طبيبك' : 'votre médecin');
      const dateStr = esc(data.date);
      const timeStr = esc(data.time);

      const T = {
        fr: { subject: 'Rappel : RDV demain avec ' + docName, h2: 'Bonjour ' + (name || 'cher patient') + ',',
              intro: '⏰ Petit rappel : vous avez RDV <strong>demain</strong> avec ' + docName + '.',
              warn: 'N\'oubliez pas votre RDV !', end: 'Si vous ne pouvez pas y aller, merci d\'annuler dès que possible pour libérer le créneau.', cta: 'Voir / Annuler mon RDV' },
        ar: { subject: 'تذكير : موعد غدًا مع ' + docName, h2: 'مرحبًا ' + (name || 'عزيزي المريض') + '،',
              intro: '⏰ تذكير صغير : لديك موعد <strong>غدًا</strong> مع ' + docName + '.',
              warn: 'لا تنسَ موعدك !', end: 'إذا لم تستطع الحضور، يرجى الإلغاء في أقرب وقت لتحرير الموعد.', cta: 'عرض / إلغاء موعدي' },
        en: { subject: 'Reminder: Appointment tomorrow with ' + docName, h2: 'Hello ' + (name || 'dear patient') + ',',
              intro: '⏰ Quick reminder: you have an appointment <strong>tomorrow</strong> with ' + docName + '.',
              warn: 'Don\'t forget your appointment!', end: 'If you can\'t make it, please cancel ASAP to free up the slot.', cta: 'View / Cancel my appointment' }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:0 0 20px 0">
             <p style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#0f172a">📅 ${dateStr || ''}${timeStr ? (lang === 'ar' ? ' في ' : ' à ') + timeStr : ''}</p>
             <p style="margin:0;font-size:14px;color:#92400e">${t.warn}</p>
           </div>
           <p style="margin:0;font-size:13px;color:#64748b">${t.end}</p>`,
          t.cta, TABIBI_CONFIG.siteUrl + '/patient-dashboard.html', c
        )
      };
    },

    rdv_reminder_h2(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const docName = esc(data.doctorName) || (lang === 'ar' ? 'طبيبك' : 'votre médecin');
      const timeStr = esc(data.time);

      const T = {
        fr: { subject: '⏰ RDV dans 2 heures avec ' + docName, h2: 'Votre RDV approche !', label: 'Dans 2 heures', note: '✅ N\'oubliez pas vos documents (CIN + carte Chifa)' },
        ar: { subject: '⏰ موعد بعد ساعتين مع ' + docName, h2: 'موعدك يقترب !', label: 'بعد ساعتين', note: '✅ لا تنس وثائقك (الهوية + بطاقة الشفاء)' },
        en: { subject: '⏰ Appointment in 2 hours with ' + docName, h2: 'Your appointment is coming!', label: 'In 2 hours', note: '✅ Don\'t forget your documents (ID + Chifa card)' }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:24px;margin:0 0 20px 0;text-align:center">
             <p style="margin:0 0 8px 0;font-size:13px;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;font-weight:700">${t.label}</p>
             <p style="margin:0;font-size:20px;font-weight:800;color:#0f172a">${docName}</p>
             ${timeStr ? `<p style="margin:8px 0 0 0;font-size:16px;color:#475569">${lang==='ar'?'في':'à'} ${timeStr}</p>` : ''}
           </div>
           <p style="margin:0;font-size:14px;color:#334155">${t.note}</p>`,
          null, null, c
        )
      };
    },

    password_reset(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const name = esc(data.firstName);
      const link = escUrl(data.resetLink || TABIBI_CONFIG.siteUrl + '/login.html');

      const T = {
        fr: { subject: 'Réinitialisation de votre mot de passe Tabibi', h2: 'Bonjour ' + (name || 'cher utilisateur') + ',',
              intro: 'Vous avez demandé à réinitialiser votre mot de passe Tabibi.',
              info: 'Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans <strong>1 heure</strong>.',
              warn: '⚠️ Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email. Votre compte reste sécurisé.', cta: 'Réinitialiser mon mot de passe' },
        ar: { subject: 'إعادة تعيين كلمة المرور في طبيبي', h2: 'مرحبًا ' + (name || 'عزيزي المستخدم') + '،',
              intro: 'لقد طلبت إعادة تعيين كلمة المرور الخاصة بك في طبيبي.',
              info: 'انقر على الزر أدناه لإنشاء كلمة مرور جديدة. الرابط صالح لمدة <strong>ساعة واحدة</strong>.',
              warn: '⚠️ إذا لم تطلب إعادة التعيين هذه، تجاهل هذا البريد. حسابك آمن.', cta: 'إعادة تعيين كلمة المرور' },
        en: { subject: 'Reset your Tabibi password', h2: 'Hello ' + (name || 'dear user') + ',',
              intro: 'You requested to reset your Tabibi password.',
              info: 'Click the button below to create a new password. This link expires in <strong>1 hour</strong>.',
              warn: '⚠️ If you didn\'t request this reset, ignore this email. Your account is safe.', cta: 'Reset my password' }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#334155">${t.info}</p>
           <div style="background:#fef3c7;border-${lang==='ar'?'right':'left'}:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:0 0 20px 0">
             <p style="margin:0;font-size:13px;line-height:1.6;color:#78350f">${t.warn}</p>
           </div>`,
          t.cta, link, c
        )
      };
    },

    waiting_list_welcome(data) {
      const lang = (data.lang && COMMON[data.lang]) ? data.lang : 'fr';
      const c = COMMON[lang];
      const count = esc(data.count) || '1 000';

      const T = {
        fr: { subject: 'Merci ! Vous êtes sur la liste Tabibi 🇩🇿', h2: 'Merci de votre intérêt !',
              intro: 'Vous faites désormais partie des <strong>' + count + '+ Algériens</strong> qui attendent Tabibi avec impatience. 🎉',
              wait_title: '🚀 Ce qui vous attend :',
              li1: 'Plus de <strong>1 500 médecins</strong> disponibles',
              li2: 'RDV en <strong>30 secondes</strong>',
              li3: 'Rappels SMS et email automatiques',
              li4: '100% gratuit pour les patients, à vie',
              end: 'Nous vous préviendrons par email dès le lancement (été 2026).',
              follow: 'En attendant, suivez-nous sur Instagram <a href="https://instagram.com/tabibi.dz" style="color:' + TABIBI_CONFIG.primaryColor + '">@tabibi.dz</a> pour les actualités.',
              cta: 'Suivre Tabibi sur Instagram' },
        ar: { subject: 'شكرًا ! أنت في قائمة طبيبي 🇩🇿', h2: 'شكرًا على اهتمامك !',
              intro: 'أنت الآن جزء من <strong>' + count + '+ جزائري</strong> ينتظرون طبيبي بفارغ الصبر. 🎉',
              wait_title: '🚀 ما ينتظرك :',
              li1: 'أكثر من <strong>1500 طبيب</strong> متاح',
              li2: 'حجز موعد في <strong>30 ثانية</strong>',
              li3: 'تذكيرات SMS وبريد إلكتروني تلقائية',
              li4: 'مجاني 100% للمرضى، مدى الحياة',
              end: 'سنُعلمك بالبريد الإلكتروني عند الإطلاق (صيف 2026).',
              follow: 'في انتظار ذلك، تابعنا على Instagram <a href="https://instagram.com/tabibi.dz" style="color:' + TABIBI_CONFIG.primaryColor + '">@tabibi.dz</a>.',
              cta: 'متابعة طبيبي على Instagram' },
        en: { subject: 'Thanks! You\'re on the Tabibi list 🇩🇿', h2: 'Thanks for your interest!',
              intro: 'You\'re now one of <strong>' + count + '+ Algerians</strong> eagerly waiting for Tabibi. 🎉',
              wait_title: '🚀 What awaits you:',
              li1: 'Over <strong>1,500 doctors</strong> available',
              li2: 'Book in <strong>30 seconds</strong>',
              li3: 'Automatic SMS and email reminders',
              li4: '100% free for patients, forever',
              end: 'We\'ll email you at launch (summer 2026).',
              follow: 'In the meantime, follow us on Instagram <a href="https://instagram.com/tabibi.dz" style="color:' + TABIBI_CONFIG.primaryColor + '">@tabibi.dz</a>.',
              cta: 'Follow Tabibi on Instagram' }
      };
      const t = T[lang];
      return {
        subject: t.subject,
        html: emailWrap(lang, t.subject,
          `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a">${t.h2}</h2>
           <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#334155">${t.intro}</p>
           <div style="background:#f0f9ff;border-radius:12px;padding:20px;margin:0 0 20px 0">
             <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#0f172a">${t.wait_title}</p>
             <ul style="margin:0;padding-${lang==='ar'?'right':'left'}:20px;font-size:14px;line-height:1.8;color:#334155">
               <li>${t.li1}</li><li>${t.li2}</li><li>${t.li3}</li><li>${t.li4}</li>
             </ul>
           </div>
           <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#334155">${t.end}</p>
           <p style="margin:0;font-size:13px;color:#64748b">${t.follow}</p>`,
          t.cta, 'https://instagram.com/tabibi.dz', c
        )
      };
    }
  };

  async function sendEmail(templateName, toEmail, data) {
    data = data || {};

    if (!TABIBI_CONFIG.enabled) {
      return { success: true, disabled: true };
    }
    if (!isValidEmail(toEmail)) {
      return { success: false, error: 'Email destinataire invalide' };
    }
    if (!templates[templateName]) {
      return { success: false, error: 'Template inconnu : ' + templateName };
    }

    const tpl = templates[templateName](data);

    try {
      if (!window.tabibi || !window.tabibi.supabase) {
        throw new Error('Supabase client non disponible');
      }
      const { data: result, error } = await window.tabibi.supabase.functions.invoke('send-email', {
        body: {
          to: toEmail,
          subject: tpl.subject,
          html: tpl.html,
          from: { email: TABIBI_CONFIG.fromEmail, name: TABIBI_CONFIG.fromName },
          replyTo: TABIBI_CONFIG.replyTo
        }
      });
      if (error) throw error;
      return { success: true, messageId: result && result.messageId };
    } catch (err) {
      return { success: false, error: (err && err.message) || 'Erreur d\'envoi' };
    }
  }

  window.tabibiBrevo = {
    sendEmail: sendEmail,
    templates: Object.keys(templates),
    config: TABIBI_CONFIG,
    languages: Object.keys(COMMON)
  };

})();
