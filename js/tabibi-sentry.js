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

// [2026-09-09] Point d'entree UNIQUE pour signaler une erreur attrapee.
// Utilisable sans dependance : `(window.tabibiErreur || console.warn)(e, 'contexte')`.
// Avant, 173 blocs `catch {}` jetaient les erreurs avant tout signalement, et
// Sentry ne recevait presque rien.
window.tabibiErreur = function (erreur, contexte) {
  try {
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(erreur, { tags: { contexte: contexte || 'inconnu' } });
    } else {
      console.warn('[Tabibi]', contexte || '', erreur);
    }
  } catch { /* le signalement ne doit jamais casser l'appelant */ }
};
(function () {
  'use strict';

  // =====================================================================
  // ANONYMISATION — ce qui part chez un tiers ne revient jamais
  // =====================================================================
  // ⚠️ Le filtre ne couvrait que `event.message`, qui n'est renseigne que par
  // `captureMessage()`. Une exception LEVEE — le cas courant — n'y passait
  // pas : son texte vit dans `event.exception.values[].value`. On nettoyait le
  // seul champ que presque rien n'emprunte.
  //
  // Les motifs sont ceux d'avant, inchanges. Ce qui change, c'est OU on les
  // applique : partout, en une passe recursive bornee.

  /** Les trois formes de PII qu'on sait reconnaitre. */
  var _MOTIFS = [
    [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
    [/\+?213[\s\-.]?\d{2}[\s\-.]?\d{2}[\s\-.]?\d{2}[\s\-.]?\d{2}/g, '[tel]'],
    [/0[567]\d{8}/g, '[tel]']
  ];

  /** Les noms de parametres dont on ne garde JAMAIS la valeur. */
  var _PARAM_SENSIBLE = /^(token|access_token|refresh_token|key|apikey|api_key|secret|password|pwd|email|mail|phone|tel|telephone)$/i;

  function _nettoyerTexte(t) {
    var out = String(t);
    for (var i = 0; i < _MOTIFS.length; i++) out = out.replace(_MOTIFS[i][0], _MOTIFS[i][1]);
    return out;
  }

  /**
   * Une URL, sans les valeurs de ses parametres sensibles.
   *
   * ⚠️ On ne se contente pas des motifs PII : `?token=…` n'a la forme ni d'un
   * e-mail ni d'un numero, et c'est pourtant ce qu'on veut le moins voir
   * partir. On redige donc par NOM de parametre, puis on passe les motifs sur
   * ce qui reste.
   */
  function _nettoyerUrl(u) {
    var url = String(u);
    var i = url.indexOf('?');
    if (i === -1) return _nettoyerTexte(url);
    var base = url.slice(0, i);
    var reste = url.slice(i + 1);
    var frag = '';
    var h = reste.indexOf('#');
    if (h !== -1) { frag = reste.slice(h); reste = reste.slice(0, h); }
    var parties = reste.split('&').map(function (kv) {
      var j = kv.indexOf('=');
      if (j === -1) return kv;
      var nom = kv.slice(0, j);
      return _PARAM_SENSIBLE.test(decodeURIComponent(nom)) ? (nom + '=[redige]') : kv;
    });
    return _nettoyerTexte(base + '?' + parties.join('&') + frag);
  }

  /**
   * Passe recursive sur une valeur d'evenement.
   *
   * ⚠️ BORNEE, et c'est delibere : profondeur 8, 400 noeuds. Un `beforeSend`
   * qui coute cher ralentit CHAQUE erreur de la page — et un filtre couteux
   * finit par etre retire, ce qui est pire que pas de filtre du tout. Les
   * cycles sont coupes par la liste `vus` : un evenement Sentry en contient
   * (contexts qui se referencent), et une recursion infinie dans `beforeSend`
   * gelerait l'onglet.
   */
  function _nettoyer(valeur, profondeur, vus, compteur) {
    if (valeur == null || profondeur > 8 || compteur.n > 400) return valeur;
    if (typeof valeur === 'string') { compteur.n++; return _nettoyerTexte(valeur); }
    if (typeof valeur !== 'object') return valeur;
    if (vus.indexOf(valeur) !== -1) return valeur;
    vus.push(valeur);

    if (Object.prototype.toString.call(valeur) === '[object Array]') {
      for (var i = 0; i < valeur.length; i++) {
        compteur.n++;
        valeur[i] = _nettoyer(valeur[i], profondeur + 1, vus, compteur);
      }
      return valeur;
    }
    for (var k in valeur) {
      if (!Object.prototype.hasOwnProperty.call(valeur, k)) continue;
      compteur.n++;
      if (compteur.n > 400) break;
      // Une URL se nettoie autrement qu'un texte : par nom de parametre.
      if (/^(url|href|request_url|from|to)$/i.test(k) && typeof valeur[k] === 'string') {
        valeur[k] = _nettoyerUrl(valeur[k]);
      } else {
        valeur[k] = _nettoyer(valeur[k], profondeur + 1, vus, compteur);
      }
    }
    return valeur;
  }

  /**
   * Nettoie l'evenement entier, en place.
   *
   * ⚠️ `event.user.id` est un UUID : il ne ressemble ni a un e-mail ni a un
   * numero, aucun motif ne le touche. On le garde — c'est ce qui permet de
   * relier deux erreurs au meme compte sans savoir qui c'est.
   */
  function _nettoyerEvenement(event) {
    if (!event || typeof event !== 'object') return event;
    var vus = [];
    var compteur = { n: 0 };
    var garde = event.user ? event.user.id : undefined;
    _nettoyer(event, 0, vus, compteur);
    if (event.user && garde !== undefined) event.user.id = garde;
    return event;
  }

  // Exposee pour les essais : on ne peut pas faire lever une vraie exception
  // dans le SDK depuis un essai hermetique, et un filtre qu'on ne peut pas
  // essayer est un filtre qu'on croit sur parole.
  window.tabibiSentryNettoyer = _nettoyerEvenement;

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
        release: 'tabibi@' + ((window.TABIBI_CONFIG && window.TABIBI_CONFIG.APP_VERSION) || 'inconnue'),
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
            // ⚠️ [16/09/2026] ON NE NETTOYAIT QUE `event.message`.
            //
            // Or un evenement Sentry porte le texte a QUATRE autres endroits au
            // moins, et c'est meme la ou il finit le plus souvent :
            //
            //   event.exception.values[].value   le message de l'exception —
            //                                    c'est LUI que Sentry affiche
            //   event.breadcrumbs[].message      « POST /rest/v1/… »
            //   event.breadcrumbs[].data         corps, url, parametres
            //   event.request.url                ?email=…&phone=…
            //
            // `event.message` n'est renseigne que par `captureMessage()`. Une
            // exception levee — le cas courant — passait donc a cote du filtre
            // **entierement**. Le nettoyage etait pose sur le seul champ que
            // presque rien n'emprunte.
            //
            // On passe desormais sur l'evenement en entier (voir `_nettoyer`),
            // bornes en profondeur et en nombre de noeuds : un `beforeSend` qui
            // coute cher est un `beforeSend` qu'on finit par retirer.
            _nettoyerEvenement(event);
          } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-sentry.js:126'); }
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
