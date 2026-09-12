// =====================================================================
// eslint.config.mjs — garde-fous automatiques
// =====================================================================
// POURQUOI CES REGLES PRECISEMENT
//
// Elles ne sont pas un style : chacune ferme un defaut CONSTATE dans le code
// le 09/09/2026, avec son compte exact.
//
//   no-empty (catch)  173 blocs `catch {}` sur 189, soit 91 % du traitement
//                     d'erreur. Consequence mesurable : Sentry est actif sur
//                     28 pages et ne recoit presque rien, non parce que le
//                     code est sain, mais parce que les erreurs sont jetees
//                     avant d'etre signalees. Le bug « noms patients =
//                     Patient » de l'agenda a exactement cette cause.
//
//   no-restricted-…   29 interpolations dans innerHTML, dont 6 seulement
//   (innerHTML)       echappees. Et js/tabibi-security.js, qui fournit
//                     escapeHtml(), n'est charge que sur 24 pages sur 45.
//                     La CSP ne rattrape rien : elle contient 'unsafe-inline',
//                     rendu obligatoire par le JS inline des pages.
//
// ETAT : ces deux regles sont en 'warn', pas en 'error'. Les passer en erreur
// aujourd'hui rendrait la CI rouge en permanence sur 200 points existants et
// on prendrait l'habitude de l'ignorer. Le contrat est : le compteur ne doit
// que BAISSER. Voir le script `npm run lint:dette`.
// =====================================================================

import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**', 'dist/**', 'dist-web/**', 'www/**',
      'desktop/dist/**', 'desktop/src-tauri/target/**',
      'v2/**',                       // a son propre outillage
      'seo/**',                      // pages generees
      'assets/vendor/**',            // dependances tierces, non modifiees
      'js/tabibi-i18n.js',           // dictionnaire de 356 Ko : donnees, pas du code
      'android/**', 'ios/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Globales du produit — l'architecture actuelle communique par window
        TABIBI_CONFIG: 'readonly',
        TABIBI_FEATURES: 'readonly',
        tabibi: 'writable',
        supabase: 'readonly',
        Capacitor: 'readonly',
        Sentry: 'readonly',
        L: 'readonly',               // Leaflet
        // Globales posees par un fichier et lues par un autre. L'architecture
        // actuelle communique ainsi ; les declarer evite 9 faux positifs.
        DZ_WILAYAS: 'readonly',      // assets/dz-wilaya-centroids.js
        initTabBar: 'readonly',      // js/tabibi-nav.js
        tabClick: 'readonly',        // js/tabibi-nav.js
      },
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: false }],
      // NB : `property` SEULE restreint la propriete sur n'importe quel objet.
      // Une premiere version ecrivait `object: '*'` — syntaxe invalide, la regle
      // ne se declenchait sur RIEN (verifie le 09/09/2026 sur js/tabibi-reviews.js).
      // Une regle qui ment sur son propre effet est pire que pas de regle.
      'no-restricted-properties': ['warn', {
        property: 'innerHTML',
        message:
          "innerHTML : passer la donnee par escapeHtml() de js/tabibi-security.js, "
          + "ou construire le noeud avec textContent. 23 injections non echappees "
          + "recensees le 09/09/2026.",
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
    },
  },
  {
    // Fichiers ES modules : points d'entree Vite et outils Node.
    // Le reste du depot est en `script` (scripts classiques a globales).
    files: ['**/*.mjs', 'src/**/*.js', 'vite.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { 'no-console': 'off' },
  },
];
