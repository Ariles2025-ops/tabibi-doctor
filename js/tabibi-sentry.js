// =====================================================================
// Tabibi -- Monitoring erreurs production via Sentry
// =====================================================================
// Charge Sentry browser SDK depuis CDN et l'initialise avec le DSN
// defini dans window.TABIBI_CONFIG.SENTRY_DSN.
//
// Si SENTRY_DSN est vide ou contient "REPLACE_", Sentry est DESACTIVE
// (mode dev) -- aucune erreur n'est envoyee aux serveurs Sentry.
//
// A inclure en bas de chaque page HTML AVANT </body> et APRES config.js.

(function () {
  'use strict';

  function getDSN() {
    if (window.TABIBI_CONFIG && typeof window.TABIBI_CONFIG.SENTRY_DSN === 'string') {
      var d = window.TABIBI_CONFIG.SENTRY_DSN.trim();
      if (d && !d.includes('REPLACE_')) return d;
    }
    return null;
  }

  function getEnv() {
    var h = (window.location && window.location.hostname) || '';
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return 'development';
    if (h.includes('preview') || h.includes('staging') || h.includes('netlify.app')) return 'staging';
    return 'production';
  }

  var dsn = getDSN();
  if (!dsn) {
    if (window.console && console.info) {
      console.info('[Tabibi/Sentry] DSN non configure dans TABIBI_CONFIG.SENTRY_DSN -- monitoring desactive (mode dev).');
    }
    // Stub minimal pour eviter les erreurs si du code appelle window.Sentry.*
    window.Sentry = window.Sentry || {
      captureException: function () {},
      captureMessage: function () {},
      setUser: function () {},
      setTag: function () {},
      setContext: function () {},
      addBreadcrumb: function () {}
    };
    return;
  }

  // Chargement du SDK depuis CDN Sentry (version pinnee + SRI obligatoire)
  // SRI calcule via: curl -sS URL | openssl dgst -sha384 -binary | openssl base64 -A
  // A regenerer si on change de version SDK.
  var SDK_URL = 'https://browser.sentry-cdn.com/8.45.0/bundle.tracing.min.js';
  var SDK_INTEGRITY = 'sha384-2v8OMaiLyo5IQ6yjyGhZ8db0RBrxRo/GmWZE2FR+b1H7WCLNM8rUbYEX7G2g7n7+';

  var script = document.createElement('script');
  script.src = SDK_URL;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.integrity = SDK_INTEGRITY;

  script.onload = function () {
    if (!window.Sentry) return;

    try {
      var env = getEnv();
      var pagePath = (window.location && window.location.pathname) || '/';
      var pageName = pagePath.split('/').pop().replace('.html', '') || 'home';

      window.Sentry.init({
        dsn: dsn,
        environment: env,
        release: 'tabibi@v10.27.0',
        integrations: [
          window.Sentry.browserTracingIntegration ? window.Sentry.browserTracingIntegration() : null
        ].filter(Boolean),
        // Echantillonnage tracing (10% en prod pour eviter de saturer 50k events/mois)
        tracesSampleRate: env === 'production' ? 0.1 : 1.0,
        // 100% des erreurs envoyees
        sampleRate: 1.0,
        // Limiter le volume de breadcrumbs pour pages lentes
        maxBreadcrumbs: 40,
        // Ne pas capturer les erreurs sur des extensions navigateur
        denyUrls: [
          /^chrome-extension:\/\//,
          /^moz-extension:\/\//,
          /^safari-extension:\/\//,
          /^webkit-masked-url:\/\//
        ],
        // Ignorer le bruit classique browser
        ignoreErrors: [
          'top.GLOBALS',
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',
          'Network request failed', // les fetch fails on les loggue ailleurs
          'NetworkError when attempting to fetch resource'
        ],
        beforeSend: function (event) {
          // Anonymisation PII -- on ne veut JAMAIS envoyer email/tel/matricule a Sentry
          try {
            if (event.request && event.request.cookies) delete event.request.cookies;
            if (event.user) {
              // On garde l'id Supabase (UUID) mais on retire email et username clair
              delete event.user.email;
              delete event.user.username;
              delete event.user.ip_address;
            }
            // Strip PII patterns dans le message d'erreur (defensif)
            if (event.message && typeof event.message === 'string') {
              event.message = event.message
                .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
                .replace(/\+?213[\s\-.]?\d{2}[\s\-.]?\d{2}[\s\-.]?\d{2}[\s\-.]?\d{2}/g, '[tel]')
                .replace(/0[567]\d{8}/g, '[tel]');
            }
          } catch (e) {}
          return event;
        }
      });

      window.Sentry.setTag('page', pageName);

      // Si Supabase auth identifie un user, on tag son UUID (pas l'email)
      if (window.tabibi && window.tabibi.supabase && window.tabibi.supabase.auth) {
        window.tabibi.supabase.auth.getUser().then(function (r) {
          if (r && r.data && r.data.user) {
            window.Sentry.setUser({ id: r.data.user.id });
          }
        }).catch(function () {});
      }

      if (window.console && console.info) {
        console.info('[Tabibi/Sentry] Monitoring actif (env=' + env + ', page=' + pageName + ')');
      }
    } catch (e) {
      if (window.console && console.warn) console.warn('[Tabibi/Sentry] init failed', e);
    }
  };

  script.onerror = function () {
    if (window.console && console.warn) {
      console.warn('[Tabibi/Sentry] Impossible de charger le SDK depuis le CDN.');
    }
  };

  document.head.appendChild(script);
})();
