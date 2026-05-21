/**
 * Tabibi — Cookie Consent Banner (loi 18-07 + GDPR friendly)
 * Inclure sur toutes les pages publiques juste avant </body> :
 *   <script src="js/tabibi-cookies.js"></script>
 *
 * Comportement :
 *   - Affiche un bandeau si pas de consentement enregistré
 *   - Boutons : Accepter tout / Refuser / Personnaliser (→ cookies.html)
 *   - Stocke le choix dans localStorage (tabibi_cookie_consent)
 *   - Expose window.tabibiCookies.hasConsent('analytics') / 'marketing'
 *   - Re-demande le consentement après 6 mois
 */
(function() {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const KEY = 'tabibi_cookie_consent';
  const TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 mois

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.ts || (Date.now() - parsed.ts) > TTL_MS) return null;
      return parsed;
    } catch(e) { return null; }
  }
  function set(consent) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...consent, ts: Date.now() })); } catch(e) {}
    apply(consent);
  }
  function apply(c) {
    // Hook : ici on (dés)active GA, Facebook Pixel, etc.
    if (c.analytics) {
      // window.gtag && gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    if (c.marketing) {
      // window.fbq && fbq('consent', 'grant');
    }
    document.dispatchEvent(new CustomEvent('tabibi:cookie-consent', { detail: c }));
  }

  function detectLang() {
    try {
      const saved = localStorage.getItem('tabibi_lang');
      if (['fr','ar','en'].includes(saved)) return saved;
    } catch(e) {}
    return (navigator.language || '').startsWith('ar') ? 'ar' : 'fr';
  }

  const I18N = {
    fr: { title: "Nous utilisons des cookies", text: "Nous utilisons des cookies essentiels au fonctionnement du site, ainsi que des cookies analytiques et marketing (avec votre consentement).", reject: "Refuser", customize: "Personnaliser", accept: "Tout accepter" },
    ar: { title: "نستخدم ملفات تعريف الارتباط", text: "نستخدم ملفات تعريف الارتباط الضرورية لعمل الموقع، وكذلك ملفات تحليلية وتسويقية (بموافقتكم).", reject: "رفض", customize: "تخصيص", accept: "قبول الكل" },
    en: { title: "We use cookies", text: "We use essential cookies for site functioning, plus analytics and marketing cookies (with your consent).", reject: "Reject", customize: "Customize", accept: "Accept all" }
  };

  function render() {
    const lang = detectLang();
    const t = I18N[lang] || I18N.fr;
    const rtl = (lang === 'ar') ? 'rtl' : 'ltr';

    const banner = document.createElement('div');
    banner.id = 'tabibi-cookie-banner';
    banner.setAttribute('dir', rtl);
    banner.innerHTML = `
      <style>
        #tabibi-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;max-width:780px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.2);padding:20px;z-index:99999;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
        #tabibi-cookie-banner[dir="rtl"]{font-family:'Cairo','Plus Jakarta Sans',sans-serif}
        #tabibi-cookie-banner h3{font-size:16px;font-weight:800;margin:0 0 8px;color:#0f172a;display:flex;align-items:center;gap:8px}
        #tabibi-cookie-banner p{font-size:13px;color:#475569;margin:0 0 12px;line-height:1.5}
        #tabibi-cookie-banner .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        #tabibi-cookie-banner button{padding:8px 14px;border-radius:8px;font-weight:700;font-size:13px;border:none;cursor:pointer;font-family:inherit}
        #tabibi-cookie-banner .b-prim{background:#0F7560;color:#fff}
        #tabibi-cookie-banner .b-sec{background:#f8fafc;color:#0f172a;border:1px solid #e2e8f0}
        #tabibi-cookie-banner .b-link{background:transparent;color:#0F7560;text-decoration:underline;padding:8px 4px}
      </style>
      <h3>🍪 ${t.title}</h3>
      <p>${t.text} <a href="cookies.html" style="color:#0F7560">cookies.html</a></p>
      <div class="acts">
        <button class="b-sec" id="tc-reject">${t.reject}</button>
        <button class="b-link" id="tc-custom">${t.customize}</button>
        <button class="b-prim" id="tc-accept">${t.accept}</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('tc-accept').onclick = () => { set({ analytics: true, marketing: true }); banner.remove(); };
    document.getElementById('tc-reject').onclick = () => { set({ analytics: false, marketing: false }); banner.remove(); };
    document.getElementById('tc-custom').onclick = () => { window.location.href = 'cookies.html'; };
  }

  function init() {
    const existing = get();
    if (existing) {
      apply(existing);
      return;
    }
    // Délai pour ne pas casser le LCP / éviter clignotement
    setTimeout(render, 800);
  }

  window.tabibiCookies = {
    hasConsent: (type) => { const c = get(); return c ? !!c[type] : false; },
    reset: () => { try { localStorage.removeItem(KEY); } catch(e) {} window.location.reload(); },
    show: render
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
