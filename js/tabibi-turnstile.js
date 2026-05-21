/* ═══════════════════════════════════════════════════════════════════════
   TABIBI v10 — SERVICE CLOUDFLARE TURNSTILE (anti-bot invisible)
   ═══════════════════════════════════════════════════════════════════════

   Cloudflare Turnstile : alternative gratuite et meilleure que hCaptcha/reCAPTCHA.
   Spécialement adaptée pour l'Algérie (POP Cloudflare à Alger = ultra rapide).

   IMPORTANT — SÉCURITÉ :
   - Le Site Key peut être public (frontend)
   - Le Secret Key DOIT rester côté serveur (Supabase Edge Function)

   Pour activer :
   1. Créer compte Cloudflare gratuit
   2. Aller dans Turnstile → Add widget
   3. Domain : tabibi.doctor
   4. Widget mode : Managed (recommandé)
   5. Récupérer Site Key (public) + Secret Key (privé)
   6. Configurer dans index.html : <meta name="turnstile-sitekey" content="0x4...">
   7. Dans Supabase Secrets : TURNSTILE_SECRET_KEY
   8. Déployer Edge Function verify-turnstile
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const TURNSTILE_CONFIG = {
    siteKey: null,  // Sera lu depuis <meta name="turnstile-sitekey">
    scriptUrl: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    loaded: false,
    enabled: true,  // Mettre false pour bypasser en dev
    theme: 'light',
    size: 'normal',  // 'normal' ou 'compact' ou 'invisible'
    appearance: 'always'  // 'always', 'execute', 'interaction-only'
  };

  /**
   * Lire la Site Key — ordre de precedence:
   *   1. window.TABIBI_CONFIG.TURNSTILE_SITE_KEY  (source de verite globale, cf. js/config.js)
   *   2. <meta name="turnstile-sitekey" content="...">  (override par page)
   * [FIX-AUDIT-2026-05-18] Centralisation cle dans config.js — un seul endroit a editer.
   */
  function readSiteKey() {
    // 1. Config globale (recommande)
    if (window.TABIBI_CONFIG && window.TABIBI_CONFIG.TURNSTILE_SITE_KEY) {
      const k = window.TABIBI_CONFIG.TURNSTILE_SITE_KEY;
      if (k && k.length > 10 && !k.includes('YOUR_') && !k.includes('REPLACE_')) {
        TURNSTILE_CONFIG.siteKey = k;
        return k;
      }
      if (k && (k.includes('YOUR_') || k.includes('REPLACE_'))) {
        console.warn(
          '%c[Tabibi/Turnstile] %cTURNSTILE_SITE_KEY placeholder dans config.js — captcha DESACTIVE.\n' +
          'Generer la cle: https://dash.cloudflare.com -> Turnstile, puis editer js/config.js.',
          'color:#7c3aed;font-weight:bold', 'color:#dc2626'
        );
        return null;
      }
    }

    // 2. Fallback meta tag (legacy)
    const meta = document.querySelector('meta[name="turnstile-sitekey"]');
    if (meta) {
      const key = meta.getAttribute('content');
      if (key && key.length > 10 && !key.includes('YOUR_') && !key.includes('REPLACE_')) {
        TURNSTILE_CONFIG.siteKey = key;
        return key;
      }
      if (key && (key.includes('YOUR_') || key.includes('REPLACE_'))) {
        console.warn(
          '%c[Tabibi/Turnstile] %cSite key placeholder dans meta tag — captcha DESACTIVE.\n' +
          'Recommande: definir TURNSTILE_SITE_KEY dans js/config.js plutot que dans chaque page.',
          'color:#7c3aed;font-weight:bold', 'color:#dc2626'
        );
      }
    }
    return null;
  }

  /**
   * Charger le script Turnstile dynamiquement
   */
  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (TURNSTILE_CONFIG.loaded) return resolve();
      if (typeof window.turnstile !== 'undefined') {
        TURNSTILE_CONFIG.loaded = true;
        return resolve();
      }

      const existing = document.querySelector('script[src*="turnstile"]');
      if (existing) {
        existing.addEventListener('load', () => {
          TURNSTILE_CONFIG.loaded = true;
          resolve();
        });
        existing.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = TURNSTILE_CONFIG.scriptUrl + '?onload=tabibiTurnstileOnload';
      script.async = true;
      script.defer = true;

      window.tabibiTurnstileOnload = function () {
        TURNSTILE_CONFIG.loaded = true;
        resolve();
      };

      script.addEventListener('error', () => {
        reject(new Error('Impossible de charger Turnstile (vérifiez votre connexion)'));
      });

      document.head.appendChild(script);
    });
  }

  /**
   * Render Turnstile dans un container DOM
   * @param {HTMLElement|string} container - Élément DOM ou sélecteur
   * @param {object} options - { callback, errorCallback, expiredCallback }
   * @returns {Promise<string>} widgetId (pour reset/remove)
   */
  async function renderWidget(container, options = {}) {
    if (!TURNSTILE_CONFIG.enabled) {
      /* [FIX-PROD-2026-05-19] log retiré */
      if (options.callback) options.callback('DISABLED_TOKEN');
      return null;
    }

    if (!TURNSTILE_CONFIG.siteKey) readSiteKey();
    if (!TURNSTILE_CONFIG.siteKey) {
      console.warn('[Turnstile] Site key manquante, ajoutez <meta name="turnstile-sitekey" content="...">');
      return null;
    }

    try {
      await loadTurnstileScript();

      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) {
        console.warn('[Turnstile] Container introuvable:', container);
        return null;
      }

      // Vider le container s'il a déjà un widget
      el.innerHTML = '';

      const widgetId = window.turnstile.render(el, {
        sitekey: TURNSTILE_CONFIG.siteKey,
        theme: TURNSTILE_CONFIG.theme,
        size: TURNSTILE_CONFIG.size,
        appearance: TURNSTILE_CONFIG.appearance,
        callback: (token) => {
          if (options.callback) options.callback(token);
        },
        'error-callback': () => {
          if (options.errorCallback) options.errorCallback();
        },
        'expired-callback': () => {
          if (options.expiredCallback) options.expiredCallback();
        }
      });

      return widgetId;
    } catch (err) {
      console.error('[Turnstile] Render error:', err);
      return null;
    }
  }

  /**
   * Vérifier un token côté serveur via Edge Function
   * @param {string} token - Le token Turnstile à vérifier
   * @returns {Promise<{valid:boolean, error?:string}>}
   */
  async function verifyToken(token) {
    if (!TURNSTILE_CONFIG.enabled || token === 'DISABLED_TOKEN') {
      return { valid: true, bypass: true };
    }

    if (!token) {
      return { valid: false, error: 'Token manquant' };
    }

    try {
      if (!window.tabibi || !window.tabibi.supabase) {
        throw new Error('Supabase non disponible');
      }

      const { data, error } = await window.tabibi.supabase.functions.invoke('verify-turnstile', {
        body: { token }
      });

      if (error) throw error;

      return { valid: !!data?.success, error: data?.error };
    } catch (err) {
      console.error('[Turnstile] Verify error:', err);
      // En cas d'erreur réseau, on permet quand même (pas bloquer l'utilisateur)
      return { valid: true, error: 'Verification skipped: ' + err.message };
    }
  }

  /**
   * Reset un widget (pour réessayer après échec)
   */
  function resetWidget(widgetId) {
    if (window.turnstile && widgetId) {
      try { window.turnstile.reset(widgetId); } catch (e) {}
    }
  }

  /**
   * Récupérer la response d'un widget
   */
  function getResponse(widgetId) {
    if (window.turnstile && widgetId) {
      try { return window.turnstile.getResponse(widgetId); } catch (e) { return null; }
    }
    return null;
  }

  // Initialiser au chargement
  readSiteKey();

  // Exposer publiquement
  window.tabibiTurnstile = {
    renderWidget,
    verifyToken,
    resetWidget,
    getResponse,
    isEnabled: () => TURNSTILE_CONFIG.enabled && !!TURNSTILE_CONFIG.siteKey,
    config: TURNSTILE_CONFIG
  };

})();
