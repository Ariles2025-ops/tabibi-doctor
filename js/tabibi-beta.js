/**
 * Tabibi — Mode Bêta Privée
 * ────────────────────────────────────────────────────────
 * Affiche un bandeau "Bêta privée" sur toutes les pages.
 * Désactive visuellement les paiements (boutons grisés + tooltip).
 * Stocke la fermeture du bandeau pendant 7 jours.
 *
 * Pour désactiver (= mode production officielle) :
 * Ajouter <meta name="tabibi-mode" content="production"> dans le <head>
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // Mode : 'beta' (défaut) ou 'production'
  const MODE = (function() {
    try {
      const m = document.querySelector('meta[name="tabibi-mode"]');
      if (m && m.getAttribute('content') === 'production') return 'production';
    } catch(e) {}
    return 'beta';
  })();

  if (MODE === 'production') return; // rien à faire en prod

  const DISMISS_KEY = 'tabibi_beta_dismissed';
  const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

  // ─── I18N ───
  const I18N = {
    fr: {
      title: 'Tabibi en bêta privée',
      sub: 'Vous êtes parmi nos premiers testeurs. Lancement officiel : juillet 2026.',
      learn: 'En savoir plus',
      close: 'Fermer',
      modal_title: '🚧 Tabibi est en bêta privée',
      modal_intro: 'Vous avez accès à Tabibi avant son lancement officiel. Merci de participer à cette phase de test !',
      modal_what_works: 'Ce qui fonctionne déjà :',
      modal_works_1: 'Recherche de médecins et profils détaillés',
      modal_works_2: 'Prise de rendez-vous (testez en conditions réelles)',
      modal_works_3: 'Avis patients vérifiés',
      modal_works_4: 'Compte patient et médecin sécurisés',
      modal_coming: 'Bientôt disponible (Phase 2) :',
      modal_coming_1: 'Paiements en ligne (Edahabia, CIB, Paymee)',
      modal_coming_2: 'Téléconsultation vidéo',
      modal_coming_3: 'Apps mobiles iOS et Android',
      modal_coming_4: 'Notifications SMS automatiques',
      modal_feedback_title: 'Votre retour est précieux',
      modal_feedback: 'Rencontré un bug ? Suggestion ? Écrivez-nous :',
      modal_thanks: 'Merci de faire partie de l\'aventure Tabibi 🇩🇿',
      modal_close: 'J\'ai compris',
      payment_disabled: 'Paiement en ligne — Disponible au lancement officiel'
    },
    ar: {
      title: 'طبيبي في النسخة التجريبية الخاصة',
      sub: 'أنت من أوائل المختبرين. الإطلاق الرسمي: يوليو 2026.',
      learn: 'المزيد من المعلومات',
      close: 'إغلاق',
      modal_title: '🚧 طبيبي في النسخة التجريبية الخاصة',
      modal_intro: 'لديك حق الوصول إلى طبيبي قبل إطلاقه الرسمي. شكراً لمشاركتك في مرحلة الاختبار هذه!',
      modal_what_works: 'ما يعمل بالفعل:',
      modal_works_1: 'البحث عن الأطباء والملفات الشخصية المفصلة',
      modal_works_2: 'حجز المواعيد (اختبر في ظروف حقيقية)',
      modal_works_3: 'تقييمات المرضى الموثقة',
      modal_works_4: 'حسابات المرضى والأطباء الآمنة',
      modal_coming: 'قريباً (المرحلة 2):',
      modal_coming_1: 'الدفع عبر الإنترنت (الذهبية، CIB، Paymee)',
      modal_coming_2: 'الاستشارة عن بُعد بالفيديو',
      modal_coming_3: 'تطبيقات iOS و Android',
      modal_coming_4: 'إشعارات SMS تلقائية',
      modal_feedback_title: 'رأيك ثمين',
      modal_feedback: 'وجدت خطأ؟ اقتراح؟ راسلنا:',
      modal_thanks: 'شكراً لكونك جزءاً من مغامرة طبيبي 🇩🇿',
      modal_close: 'فهمت',
      payment_disabled: 'الدفع عبر الإنترنت — متاح عند الإطلاق الرسمي'
    },
    en: {
      title: 'Tabibi in private beta',
      sub: 'You are among our first testers. Official launch: July 2026.',
      learn: 'Learn more',
      close: 'Close',
      modal_title: '🚧 Tabibi is in private beta',
      modal_intro: 'You have access to Tabibi before its official launch. Thank you for participating in this test phase!',
      modal_what_works: 'What works already:',
      modal_works_1: 'Doctor search and detailed profiles',
      modal_works_2: 'Appointment booking (test in real conditions)',
      modal_works_3: 'Verified patient reviews',
      modal_works_4: 'Secure patient and doctor accounts',
      modal_coming: 'Coming soon (Phase 2):',
      modal_coming_1: 'Online payments (Edahabia, CIB, Paymee)',
      modal_coming_2: 'Video telemedicine',
      modal_coming_3: 'iOS and Android apps',
      modal_coming_4: 'Automated SMS notifications',
      modal_feedback_title: 'Your feedback matters',
      modal_feedback: 'Found a bug? Suggestion? Write to us:',
      modal_thanks: 'Thank you for being part of the Tabibi journey 🇩🇿',
      modal_close: 'Got it',
      payment_disabled: 'Online payment — Available at official launch'
    }
  };

  function detectLang() {
    try {
      const l = localStorage.getItem('tabibi_lang');
      if (['fr','ar','en'].includes(l)) return l;
    } catch(e) {}
    return (navigator.language || '').startsWith('ar') ? 'ar' :
           (navigator.language || '').startsWith('en') ? 'en' : 'fr';
  }

  function isDismissed() {
    try {
      const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return ts && (Date.now() - ts) < DISMISS_DURATION_MS;
    } catch(e) { return false; }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e) {}
    const b = document.getElementById('tabibi-beta-banner');
    if (b) {
      b.style.transform = 'translateY(-100%)';
      setTimeout(() => b.remove(), 300);
    }
  }

  // ─── Bandeau ───
  function renderBanner() {
    if (isDismissed()) return;
    if (document.getElementById('tabibi-beta-banner')) return;

    const lang = detectLang();
    const t = I18N[lang] || I18N.fr;
    const rtl = (lang === 'ar') ? 'rtl' : 'ltr';

    const banner = document.createElement('div');
    banner.id = 'tabibi-beta-banner';
    banner.setAttribute('dir', rtl);
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <style>
        #tabibi-beta-banner{position:sticky;top:0;left:0;right:0;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;padding:10px 16px;z-index:9000;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;box-shadow:0 2px 12px rgba(124,58,237,.3);transform:translateY(0);transition:transform .3s ease}
        #tabibi-beta-banner .inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        #tabibi-beta-banner .icon{font-size:18px;flex-shrink:0}
        #tabibi-beta-banner .txt{flex:1;min-width:220px}
        #tabibi-beta-banner .ttl{font-weight:800;font-size:13px;line-height:1.2}
        #tabibi-beta-banner .sub{font-size:11px;opacity:.92;margin-top:2px}
        #tabibi-beta-banner .actions{display:flex;gap:6px;flex-shrink:0}
        #tabibi-beta-banner button{background:rgba(255,255,255,.2);color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s}
        #tabibi-beta-banner button:hover{background:rgba(255,255,255,.3)}
        #tabibi-beta-banner button.primary{background:#fff;color:#7c3aed}
        #tabibi-beta-banner button.primary:hover{background:#f3e8ff}
        #tabibi-beta-banner .close-x{background:none !important;font-size:16px;padding:4px 8px}
        @media(max-width:480px){#tabibi-beta-banner .sub{display:none}}
      </style>
      <div class="inner">
        <div class="icon">🚧</div>
        <div class="txt">
          <div class="ttl">${t.title}</div>
          <div class="sub">${t.sub}</div>
        </div>
        <div class="actions">
          <button class="primary" onclick="window.tabibiBeta.openModal()">${t.learn}</button>
          <button class="close-x" onclick="window.tabibiBeta.dismiss()" aria-label="${t.close}">×</button>
        </div>
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // ─── Modale info ───
  function openModal() {
    if (document.getElementById('tabibi-beta-modal')) return;
    const lang = detectLang();
    const t = I18N[lang] || I18N.fr;
    const rtl = (lang === 'ar') ? 'rtl' : 'ltr';

    const modal = document.createElement('div');
    modal.id = 'tabibi-beta-modal';
    modal.setAttribute('dir', rtl);
    modal.innerHTML = `
      <style>
        #tabibi-beta-modal{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;animation:tbm-fade .2s ease}
        @keyframes tbm-fade{from{opacity:0}to{opacity:1}}
        #tabibi-beta-modal .box{background:#fff;border-radius:18px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:28px 24px;position:relative;animation:tbm-pop .25s ease}
        @keyframes tbm-pop{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}
        #tabibi-beta-modal h2{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:10px;line-height:1.25}
        #tabibi-beta-modal p{color:#475569;font-size:14px;line-height:1.6;margin-bottom:14px}
        #tabibi-beta-modal h3{font-size:14px;font-weight:800;color:#7c3aed;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.3px}
        #tabibi-beta-modal ul{margin:0;padding-${rtl === 'rtl' ? 'right' : 'left'}:20px;color:#475569;font-size:13px;line-height:1.7}
        #tabibi-beta-modal li{margin:4px 0}
        #tabibi-beta-modal .feedback-box{background:linear-gradient(135deg,#dcfce7,#f0f9ff);border-radius:12px;padding:14px;margin:18px 0;border-left:4px solid #0F7560}
        #tabibi-beta-modal .feedback-box strong{display:block;color:#0a4d3e;margin-bottom:6px;font-size:13px}
        #tabibi-beta-modal .feedback-box a{color:#0F7560;font-weight:700;text-decoration:none;font-size:14px}
        #tabibi-beta-modal .feedback-box a:hover{text-decoration:underline}
        #tabibi-beta-modal .thanks{text-align:center;font-style:italic;color:#7c3aed;font-weight:600;font-size:13px;margin-top:14px}
        #tabibi-beta-modal .close{position:absolute;top:14px;${rtl === 'rtl' ? 'left' : 'right'}:14px;background:#f8fafc;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;color:#64748b}
        #tabibi-beta-modal .close:hover{background:#e2e8f0;color:#0f172a}
        #tabibi-beta-modal .btn-ok{background:#7c3aed;color:#fff;border:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;width:100%;margin-top:14px;font-family:inherit}
        #tabibi-beta-modal .btn-ok:hover{background:#6d28d9}
      </style>
      <div class="box">
        <button class="close" onclick="document.getElementById('tabibi-beta-modal').remove()" aria-label="${t.close}">×</button>
        <h2>${t.modal_title}</h2>
        <p>${t.modal_intro}</p>

        <h3>✅ ${t.modal_what_works}</h3>
        <ul>
          <li>${t.modal_works_1}</li>
          <li>${t.modal_works_2}</li>
          <li>${t.modal_works_3}</li>
          <li>${t.modal_works_4}</li>
        </ul>

        <h3>⏳ ${t.modal_coming}</h3>
        <ul>
          <li>${t.modal_coming_1}</li>
          <li>${t.modal_coming_2}</li>
          <li>${t.modal_coming_3}</li>
          <li>${t.modal_coming_4}</li>
        </ul>

        <div class="feedback-box">
          <strong>💬 ${t.modal_feedback_title}</strong>
          <span style="color:#475569;font-size:13px">${t.modal_feedback}</span><br>
          <a href="mailto:contact@tabibi.doctor?subject=Retour%20b%C3%AAta%20Tabibi">contact@tabibi.doctor</a>
        </div>

        <div class="thanks">${t.modal_thanks}</div>

        <button class="btn-ok" onclick="document.getElementById('tabibi-beta-modal').remove()">${t.modal_close}</button>
      </div>
    `;
    document.body.appendChild(modal);
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'tabibi-beta-modal') modal.remove();
    });
  }

  // ─── Désactiver visuellement les paiements ───
  function disablePaymentButtons() {
    const lang = detectLang();
    const t = I18N[lang] || I18N.fr;
    // Cibles : boutons et liens contenant "paiement", "payer", "checkout"
    const selectors = [
      'button[onclick*="pay"]', 'button[onclick*="checkout"]',
      'a[href*="payment"]', 'a[href*="checkout"]',
      '[data-payment]', '.btn-pay', '.payment-btn'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      if (el.dataset.betaDisabled) return;
      el.dataset.betaDisabled = '1';
      el.style.opacity = '.55';
      el.style.cursor = 'not-allowed';
      el.title = t.payment_disabled;
      el.setAttribute('aria-disabled', 'true');
      // Empêcher le clic
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert('🚧 ' + t.payment_disabled);
      }, true);
    });
  }

  // ─── API publique ───
  window.tabibiBeta = {
    isBeta: () => true,
    dismiss: dismiss,
    openModal: openModal,
    reset: () => { try { localStorage.removeItem(DISMISS_KEY); } catch(e) {} window.location.reload(); },
    refreshLang: function() {
      // Re-render du bandeau si présent (changement de langue)
      const existing = document.getElementById('tabibi-beta-banner');
      if (existing) {
        existing.remove();
        renderBanner();
      }
      // Re-render modale si ouverte
      const modal = document.getElementById('tabibi-beta-modal');
      if (modal) {
        modal.remove();
        openModal();
      }
    }
  };

  // ─── Init ───
  function init() {
    renderBanner();
    disablePaymentButtons();
    // Re-vérifier les boutons paiement après chaque changement (modals dynamiques)
    setInterval(disablePaymentButtons, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
