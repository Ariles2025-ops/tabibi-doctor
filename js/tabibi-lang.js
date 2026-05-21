/**
 * Tabibi — Switcher de langue unifié (FR / AR / EN)
 * Inclure sur toute page publique :
 *   <script src="js/tabibi-lang.js"></script>
 *
 * Génère automatiquement un bouton flottant en haut à droite,
 * persiste le choix dans localStorage et gère le RTL pour l'arabe.
 *
 * API exposée :
 *   window.tabibiLang.get()        → "fr" | "ar" | "en"
 *   window.tabibiLang.set("ar")    → bascule la langue
 *   window.tabibiLang.onChange(cb) → callback appelé à chaque changement
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.tabibiLang) return; // déjà chargé

  const KEY = 'tabibi_lang';
  const ALLOWED = ['fr', 'ar', 'en'];
  const LABELS = { fr: 'Français', ar: 'العربية', en: 'English' };
  const FLAGS  = { fr: '🇫🇷', ar: '🇩🇿', en: '🇬🇧' };
  const listeners = [];

  function detect() {
    try {
      const saved = localStorage.getItem(KEY);
      if (ALLOWED.includes(saved)) return saved;
    } catch(e) {}
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ar')) return 'ar';
    if (nav.startsWith('en')) return 'en';
    return 'fr';
  }

  function applyDir(lang) {
    var dir = (lang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (document.body) {
      document.body.dir = dir;
      // [FIX 2026-05-19] Force class on body for CSS selectors qui ciblent .lang-XX
      document.body.classList.remove('lang-fr', 'lang-ar', 'lang-en');
      document.body.classList.add('lang-' + lang);
    }

    // [FIX 2026-05-19] Bug RTL lingering : quand on revient en LTR (fr/en) depuis ar,
    // certains elements enfants gardent leur attribut dir="rtl" pose dynamiquement
    // (i18n widgets, modals, formulaires, inputs avec dir=auto, etc.).
    // Le selector CSS [dir="rtl"] reste alors actif sur ces sous-arbres meme apres
    // le retour en FR. On walk le DOM pour clear tout dir explicite sur les enfants.
    // Les elements avec data-rtl-keep="true" sont preserves (ex: nom arabe d'un medecin).
    try {
      if (dir === 'ltr') {
        var rtlChildren = document.querySelectorAll('[dir="rtl"]');
        for (var i = 0; i < rtlChildren.length; i++) {
          var el = rtlChildren[i];
          if (el === document.documentElement || el === document.body) continue;
          if (el.hasAttribute('data-rtl-keep')) continue;
          el.removeAttribute('dir');
        }
        // Reset inline direction/text-align:right poses dynamiquement
        var styledRtl = document.querySelectorAll('[style*="direction"], [style*="text-align"]');
        for (var j = 0; j < styledRtl.length; j++) {
          var s = styledRtl[j];
          if (s === document.documentElement || s === document.body) continue;
          if (s.hasAttribute('data-rtl-keep')) continue;
          // Ne reset que si style inline matche rtl/right
          var styleStr = s.getAttribute('style') || '';
          if (/direction\s*:\s*rtl/i.test(styleStr)) s.style.direction = '';
          // text-align:right est legitime en LTR (prix, nombres) — on touche pas
        }
      } else {
        // En AR, on garantit que les form controls heritent bien du dir parent
        // (sinon dir="auto" sur input cause le bug "le placeholder reste LTR")
        var inputs = document.querySelectorAll('input, textarea, select');
        for (var k = 0; k < inputs.length; k++) {
          if (inputs[k].getAttribute('dir') === 'auto') {
            inputs[k].removeAttribute('dir');
          }
        }
      }
    } catch (e) {
      if (window.console) console.warn('[Tabibi/lang] applyDir cleanup error', e);
    }
  }

  function set(lang) {
    if (!ALLOWED.includes(lang)) return;
    try { localStorage.setItem(KEY, lang); } catch(e) {}
    applyDir(lang);
    refreshDropdown(lang);
    listeners.forEach(cb => { try { cb(lang); } catch(e) {} });
    document.dispatchEvent(new CustomEvent('tabibi:lang-change', { detail: { lang } }));
  }

  function refreshDropdown(lang) {
    const el = document.getElementById('tabibi-lang-current');
    if (el) el.textContent = FLAGS[lang] + ' ' + lang.toUpperCase();
  }

  function render() {
    if (document.getElementById('tabibi-lang-switcher')) return;
    const current = detect();
    const sw = document.createElement('div');
    sw.id = 'tabibi-lang-switcher';
    sw.innerHTML = `
      <style>
        #tabibi-lang-switcher{position:fixed;top:12px;right:12px;z-index:9998;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
        #tabibi-lang-switcher[dir="rtl"]{right:auto;left:12px}
        #tabibi-lang-trigger{background:rgba(255,255,255,.95);border:1px solid #e2e8f0;color:#0a4d3e;padding:7px 12px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);display:flex;align-items:center;gap:6px}
        #tabibi-lang-trigger:hover{background:#fff;border-color:#0F7560}
        #tabibi-lang-menu{position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);min-width:140px;overflow:hidden;display:none}
        #tabibi-lang-menu.open{display:block}
        #tabibi-lang-menu button{display:flex;width:100%;align-items:center;gap:8px;padding:10px 14px;background:none;border:none;text-align:left;font-family:inherit;font-size:13px;cursor:pointer;color:#0f172a}
        #tabibi-lang-menu button:hover{background:#f8fafc}
        #tabibi-lang-menu button.active{background:#dcfce7;color:#0a4d3e;font-weight:700}
        [dir="rtl"] #tabibi-lang-menu{right:auto;left:0;text-align:right}
        @media print{#tabibi-lang-switcher{display:none}}
      </style>
      <button id="tabibi-lang-trigger" aria-label="Changer de langue" onclick="document.getElementById('tabibi-lang-menu').classList.toggle('open')">
        <span id="tabibi-lang-current">${FLAGS[current]} ${current.toUpperCase()}</span>
        <i class="fa fa-chevron-down" style="font-size:10px"></i>
      </button>
      <div id="tabibi-lang-menu" role="menu">
        ${ALLOWED.map(l => `<button class="${l === current ? 'active' : ''}" onclick="window.tabibiLang.set('${l}');document.getElementById('tabibi-lang-menu').classList.remove('open')">${FLAGS[l]} ${LABELS[l]}</button>`).join('')}
      </div>
    `;
    document.body.appendChild(sw);
    // Fermer le menu si clic ailleurs
    document.addEventListener('click', (e) => {
      if (!sw.contains(e.target)) {
        const m = document.getElementById('tabibi-lang-menu');
        if (m) m.classList.remove('open');
      }
    });
  }

  window.tabibiLang = {
    get: detect,
    set: set,
    applyDir: applyDir, // [FIX 2026-05-19] expose pour delegation depuis tabibi-i18n
    onChange: (cb) => { if (typeof cb === 'function') listeners.push(cb); }
  };

  // Appliquer immédiatement le dir
  applyDir(detect());

  // Render UI quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
