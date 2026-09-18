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
  // [PERF 2026-09-09] Les dictionnaires vivent dans js/i18n/{fr,ar,en}.js et sont
  // charges par js/tabibi-prelang.js (synchrone) — ou ici, a la demande, quand
  // l'utilisateur change de langue. Ces objets sont MUTES en place par les
  // fichiers de langue : les references ci-dessous voient les ajouts tardifs.
  const TR = (window.TABIBI_TR = window.TABIBI_TR || {});
  const AUTO = (window.TABIBI_AUTO = window.TABIBI_AUTO || {});

  // Insertion SYNCHRONE du dictionnaire courant, ici meme (fin de body : le
  // contenu est deja parse, rien ne bloque le premier rendu). Pre-charge par
  // tabibi-prelang.js, il est deja en cache : execution immediate, AVANT tout
  // script suivant — les pages gardent leurs semantiques synchrones.
  // En module ES (build Vite), document.write est inoperant : chargerLangue()
  // prend le relais de facon asynchrone via applyAll (auto-reparateur).
  (function insererDictionnaire() {
    try {
      const lang = getLang();
      if (TR[lang]) return;
      const cs = document.currentScript;
      if (document.readyState === 'loading' && cs && cs.getAttribute('src')) {
        const base = cs.getAttribute('src').replace(/tabibi-i18n\.js.*$/, '');
        document.write('<script src="' + base + 'i18n/' + lang + '.js"><\/script>');
      }
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'i18n:inserer'); }
  })();

  // Chargement a la demande d'une langue absente (changement de langue en place).
  const _chargements = {};
  function baseJs() {
    if (window.__TABIBI_I18N_BASE) return window.__TABIBI_I18N_BASE;
    const s = document.querySelector('script[src*="tabibi-i18n.js"]');
    const src = (s && s.getAttribute('src')) || 'js/tabibi-i18n.js';
    return src.replace(/tabibi-i18n\.js.*$/, '');
  }
  function chargerLangue(lang) {
    if (TR[lang]) return Promise.resolve();
    if (_chargements[lang]) return _chargements[lang];
    _chargements[lang] = new Promise(function (ok, ko) {
      const el = document.createElement('script');
      el.src = baseJs() + 'i18n/' + lang + '.js';
      el.onload = function () { ok(); };
      el.onerror = function () { delete _chargements[lang]; ko(new Error('i18n ' + lang + ' introuvable')); };
      document.head.appendChild(el);
    });
    return _chargements[lang];
  }


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
      // [13/09/2026] Rendait la date dans le fuseau du NAVIGATEUR. Aiguille
      // desormais vers js/tabibi-temps.js selon ce qu'il recoit : une chaine
      // 'YYYY-MM-DD' est un JOUR CALENDAIRE (aucun fuseau), tout le reste est
      // un INSTANT (fuseau du CABINET). C'est la confusion entre les deux qui
      // produisait le decalage d'un jour.
      var T = (typeof window !== 'undefined') && window.tabibiTemps;
      if (T) {
        var brut = String(date == null ? '' : date);
        if (typeof date === 'string' && brut.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(brut)) {
          return T.jourCalendaire(brut, options || { year: 'numeric', month: 'long', day: 'numeric' });
        }
        return T.instant(date, options || { year: 'numeric', month: 'long', day: 'numeric' });
      }
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
      // Une heure est toujours celle d'un INSTANT : fuseau du cabinet.
      var T2 = (typeof window !== 'undefined') && window.tabibiTemps;
      if (T2) return T2.instant(date, options || { hour: '2-digit', minute: '2-digit', hour12: false });
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

    // ══════════════════════════════════════════════════════════════════
    // [18/09/2026] aria-label — LE SEUL ATTRIBUT QUI N'AVAIT PAS SON CANAL
    // ══════════════════════════════════════════════════════════════════
    // `placeholder` et `title` avaient le leur ; `aria-label`, non. Faute de
    // canal, dix-sept champs portaient un aria-label RECOPIE de leur
    // placeholder : « 2500 », « CO-2025-XXXX », « 0661 234 567 ». Un lecteur
    // d'ecran annoncait l'EXEMPLE a la place de l'intitule.
    //
    // ⚠️ ET C'EST PIRE QUE DE NE RIEN METTRE : `aria-label` PRIME sur le
    // `<label>` associe. Sur `patient-profile.html`, le label « N° matricule »
    // etait correctement lie par `for` — et rendu muet par un aria-label qui
    // disait « XX-XXXX-XXXXXXX ».
    //
    // Le nom de l'attribut est `data-i18n-aria-label` et pas autre chose :
    // `translateAttributes()` saute deja tout element portant
    // `data-i18n-<attr>`. Les deux mecanismes s'accordent sans se marcher
    // dessus, par construction.
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-aria-label');
      const tr = T(key);
      if (tr && tr !== key) el.setAttribute('aria-label', tr);
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
    const langCourante = getLang();
    if (!TR[langCourante]) {
      chargerLangue(langCourante).then(applyAll).catch(function (e) { (window.tabibiErreur || console.warn)(e, 'i18n:charger'); });
      return;
    }
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
    ensure: chargerLangue,
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
    // [PERF 2026-09-09] Traduit des maintenant ce qui est deja parse (ex. le hero de
    // l'accueil) si le dictionnaire est disponible ; le reste suivra a DOMContentLoaded.
    try { if (document.body && TR[getLang()]) applyAll(); } catch (e) { (window.tabibiErreur || console.warn)(e, 'i18n:apply-precoce'); }
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
