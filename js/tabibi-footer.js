/* ====================================================================
 * Tabibi — Footer global minimaliste (Phase 3 PROGRESS.md)
 * --------------------------------------------------------------------
 * Injecte un petit footer harmonise avec liens vers /legal/* sur toute
 * page publique qui inclut ce script. Idempotent (no-op si #tabibi-footer
 * existe deja, ce qui evite de doubler le footer riche d'index.html).
 *
 * Usage minimum dans n'importe quelle page publique, juste avant </body> :
 *   <script src="js/tabibi-footer.js"></script>
 *
 * Le footer riche (index.html / about.html) reste prioritaire — ce script
 * verifie #tabibi-footer + .site-footer + <footer> existant avant injection.
 * ==================================================================== */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  // Idempotent : si une page a deja un footer (riche ou minimal), on ne fait rien
  if (document.getElementById('tabibi-footer-min')) return;
  if (document.getElementById('tabibi-footer')) return;

  function detectLang() {
    try {
      var saved = localStorage.getItem('tabibi_lang');
      if (saved === 'fr' || saved === 'ar' || saved === 'en') return saved;
    } catch (e) {}
    return (navigator.language || '').startsWith('ar') ? 'ar' : 'fr';
  }

  // Detection de la profondeur : si la page est sous /legal/, prefixer ../
  function prefix() {
    var p = location.pathname || '';
    return p.indexOf('/legal/') !== -1 ? '../' : '';
  }

  var lang = detectLang();
  var pre = prefix();
  var labels = {
    fr: { cgu: 'CGU', priv: 'Confidentialité', cook: 'Cookies', men: 'Mentions légales', rgpd: 'Mes droits RGPD', dpa: 'DPA médecins', copy: '© 2026 Tabibi.doctor' },
    ar: { cgu: 'الشروط', priv: 'الخصوصية', cook: 'الكوكيز', men: 'بيانات قانونية', rgpd: 'حقوقي', dpa: 'اتفاقية معالجة البيانات', copy: '© 2026 طبيبي.دكتور' },
    en: { cgu: 'Terms', priv: 'Privacy', cook: 'Cookies', men: 'Legal notice', rgpd: 'My GDPR rights', dpa: 'Doctor DPA', copy: '© 2026 Tabibi.doctor' }
  };
  var L = labels[lang] || labels.fr;

  var footer = document.createElement('footer');
  footer.id = 'tabibi-footer-min';
  footer.setAttribute('role', 'contentinfo');
  footer.style.cssText = 'background:#f8faff;border-top:1px solid #dcfce7;padding:18px 16px;margin-top:32px;font-size:12px;color:#475569;text-align:center;line-height:1.8';
  footer.innerHTML =
    '<div style="max-width:900px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px 18px;justify-content:center;align-items:center">' +
      '<a href="' + pre + 'legal/cgu.html" style="color:#0F7560;text-decoration:none">' + L.cgu + '</a>' +
      '<a href="' + pre + 'legal/confidentialite.html" style="color:#0F7560;text-decoration:none">' + L.priv + '</a>' +
      '<a href="' + pre + 'legal/cookies.html" style="color:#0F7560;text-decoration:none">' + L.cook + '</a>' +
      '<a href="' + pre + 'legal/mentions-legales.html" style="color:#0F7560;text-decoration:none">' + L.men + '</a>' +
      '<a href="' + pre + 'legal/rgpd-droits.html" style="color:#0F7560;text-decoration:none">' + L.rgpd + '</a>' +
      '<a href="' + pre + 'legal/dpa.html" style="color:#0F7560;text-decoration:none">' + L.dpa + '</a>' +
    '</div>' +
    '<div style="margin-top:10px;color:#94a3b8">' + L.copy + ' — Loi DZ 18-07 / RGPD UE 2016/679</div>';

  function inject() {
    // Inject avant </body>, ou append au body si pas trouvé
    if (document.body) {
      document.body.appendChild(footer);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
