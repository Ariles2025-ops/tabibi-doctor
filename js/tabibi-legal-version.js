// =====================================================================
// Tabibi -- Versionnage des documents legaux (source unique de verite)
// =====================================================================
// Mettre a jour ces versions a chaque modification d'un document legal.
// Format date: YYYY-MM-DD (ISO). Le rendu UI est formate par tabibi-i18n.
//
// Usage dans une page legale:
//   <span class="update">
//     <span data-i18n="updated">Derniere mise a jour</span>
//     : <span data-tabibi-legal="cgu"></span>
//   </span>
//
//   <script src="js/tabibi-legal-version.js"></script>
//   <script src="js/tabibi-i18n.js"></script>
//
// tabibi-legal-version.js doit etre charge AVANT tabibi-i18n (qui appelle render).

(function () {
  window.TABIBI_LEGAL_VERSIONS = {
    cgu:               { version: '2.0', updated: '2026-05-18' },
    confidentialite:   { version: '2.0', updated: '2026-05-18' },
    cookies:           { version: '2.0', updated: '2026-05-18' },
    'mentions-legales':{ version: '2.0', updated: '2026-05-18' },
  };

  function render() {
    var nodes = document.querySelectorAll('[data-tabibi-legal]');
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-tabibi-legal');
      var entry = window.TABIBI_LEGAL_VERSIONS[key];
      if (!entry) return;
      var formatted = entry.updated;
      try {
        if (typeof window.tabibiFormatDate === 'function') {
          formatted = window.tabibiFormatDate(entry.updated);
        } else {
          // Fallback simple si i18n pas encore charge
          var d = new Date(entry.updated + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            formatted = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
          }
        }
      } catch (e) {}
      el.textContent = formatted + ' — v' + entry.version;
    });
  }

  // Render au load + sur changement de langue
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  document.addEventListener('tabibi:lang-change', render);

  // Expose pour debug
  window.tabibiLegalRender = render;
})();
