/* =====================================================================
 * Tabibi — Capacitor Bridge
 * Version : 1.0.0 (Phase Mobile — Capacitor Setup)
 * Créé : 2026-05-28
 * =====================================================================
 *
 * Ce fichier gère toutes les différences de comportement entre :
 *   - L'app web (browser) : comportement standard
 *   - L'app native iOS/Android (Capacitor) : comportements adaptés
 *
 * USAGE :
 *   Charger ce script APRÈS @capacitor/core dans les pages concernées.
 *   Ne pas charger dans les pages admin (hors scope mobile).
 *
 * ARCHITECTURE :
 *   1. Détection plateforme
 *   2. Liens externes (WhatsApp, tel:, mailto:, https)
 *   3. Authentification Supabase (deep links)
 *   4. Stockage session (localStorage → Preferences)
 *   5. Caméra & fichiers
 *   6. Back button Android
 *   7. Notifications push
 *   8. Turnstile bypass
 *   9. Analytics & cookies
 *  10. Status bar & safe areas
 *
 * ===================================================================== */

(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────
  // 0. GUARD : ne s'exécute que si Capacitor est disponible
  // ──────────────────────────────────────────────────────────────────
  const isCapacitorAvailable = typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined';

  /**
   * Récupère un plugin Capacitor exposé nativement sur window.Capacitor.Plugins.
   * App non-bundlée → import ESM bare-specifier ('@capacitor/x') NON résolvable
   * par le WebView. On lit donc le registre natif des plugins.
   * Retourne null si absent (web, ou plugin non installé).
   */
  function _plug(name) {
    return (isCapacitorAvailable &&
            window.Capacitor.Plugins &&
            window.Capacitor.Plugins[name]) || null;
  }

  /**
   * Expose l'API bridge globalement.
   * window.tabibi.bridge est disponible sur toutes les pages qui chargent ce script.
   */
  window.tabibi = window.tabibi || {};
  window.tabibi.bridge = {

    // ─── 1. DÉTECTION PLATEFORME ────────────────────────────────────

    /** true si on tourne dans Capacitor (iOS ou Android natif) */
    isNative: isCapacitorAvailable && window.Capacitor.isNativePlatform(),

    /** 'ios' | 'android' | 'web' */
    platform: isCapacitorAvailable
      ? window.Capacitor.getPlatform()
      : 'web',

    /** true si iOS */
    isIOS: isCapacitorAvailable && window.Capacitor.getPlatform() === 'ios',

    /** true si Android */
    isAndroid: isCapacitorAvailable && window.Capacitor.getPlatform() === 'android',

    // ─── 2. LIENS EXTERNES ──────────────────────────────────────────

    /**
     * Ouvre un lien externe de manière appropriée selon la plateforme.
     *
     * En web    → window.open(url, '_blank')
     * En natif  → AppLauncher.openUrl() ou Browser.open()
     *
     * @param {string} url - URL à ouvrir
     * @param {Object} [opts] - Options
     * @param {boolean} [opts.inApp=false] - Ouvrir dans un browser in-app (natif)
     */
    async openUrl(url, opts) {
      opts = opts || {};

      if (!this.isNative) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      try {
        if (opts.inApp) {
          // Ouvre dans un browser intégré à l'app (garde le contexte)
          const Browser = _plug('Browser');
          if (!Browser) { console.warn('[Tabibi/Bridge] Browser plugin indisponible'); window.open(url, '_blank', 'noopener,noreferrer'); return; }
          await Browser.open({ url, presentationStyle: 'popover' });
        } else {
          // Ouvre dans l'app système (WhatsApp, téléphone, etc.)
          const AppLauncher = _plug('AppLauncher');
          if (!AppLauncher) { console.warn('[Tabibi/Bridge] AppLauncher plugin indisponible'); window.open(url, '_blank', 'noopener,noreferrer'); return; }
          const { completed } = await AppLauncher.openUrl({ url });
          if (!completed) {
            // Fallback si l'app cible n'est pas installée
            const Browser = _plug('Browser');
            if (Browser) { await Browser.open({ url }); }
            else { window.open(url, '_blank', 'noopener,noreferrer'); }
          }
        }
      } catch (err) {
        console.warn('[Tabibi/Bridge] openUrl fallback:', err);
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },

    /**
     * Patch automatique des liens wa.me, tel:, mailto: sur la page courante.
     * À appeler au DOMContentLoaded.
     */
    patchExternalLinks() {
      if (!this.isNative) return;

      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href') || '';

        // WhatsApp
        if (href.startsWith('https://wa.me') || href.startsWith('https://api.whatsapp.com')) {
          e.preventDefault();
          this.openUrl(href);
          return;
        }

        // Appels téléphoniques
        if (href.startsWith('tel:')) {
          e.preventDefault();
          this.openUrl(href);
          return;
        }

        // Emails
        if (href.startsWith('mailto:')) {
          e.preventDefault();
          this.openUrl(href);
          return;
        }

        // Liens externes https (hors app) → browser in-app
        if (href.startsWith('http') && !href.includes('tabibi.doctor') && !href.includes('supabase.co')) {
          e.preventDefault();
          this.openUrl(href, { inApp: true });
          return;
        }
      }, true);
    },

    // ─── 3. AUTHENTIFICATION SUPABASE (DEEP LINKS) ──────────────────

    /**
     * Configure les redirections Supabase pour mobile.
     *
     * En web    → redirectTo = 'https://tabibi.doctor/reset-password.html'
     * En natif  → redirectTo = 'com.tabibi.doctor://reset-password'
     *
     * URLs à ajouter dans Supabase Auth Settings → Redirect URLs :
     *   com.tabibi.doctor://reset-password
     *   com.tabibi.doctor://verify-email
     *   com.tabibi.doctor://email-verified
     *   com.tabibi.doctor://auth/callback
     *
     * @param {'reset-password'|'verify-email'|'email-verified'|'auth/callback'} path
     * @returns {string} URL de redirect appropriée
     */
    getAuthRedirectUrl(path) {
      if (this.isNative) {
        return 'com.tabibi.doctor://' + path;
      }
      const base = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SITE_URL) || 'https://tabibi.doctor';
      const pageMap = {
        'reset-password': '/reset-password.html',
        'verify-email': '/verify-email.html',
        'email-verified': '/email-verified.html',
        'auth/callback': '/auth/callback.html',
      };
      return base + (pageMap[path] || '/' + path);
    },

    /**
     * Gère les deep links entrants (ouverture depuis email Supabase).
     * À appeler au démarrage de l'app.
     *
     * Supabase encode les tokens dans le fragment (#access_token=...) ou
     * en query param (?token=...).
     */
    async initDeepLinks() {
      if (!this.isNative) return;

      try {
        const App = _plug('App');
        if (!App) { console.warn('[Tabibi/Bridge] App plugin indisponible (deep links)'); return; }

        // Deep link reçu quand l'app est déjà ouverte
        App.addListener('appUrlOpen', (event) => {
          console.log('[Tabibi/Bridge] Deep link reçu:', event.url);
          this._handleDeepLink(event.url);
        });

        // Deep link reçu au démarrage (app ouverte via le lien)
        const { url } = await App.getLaunchUrl() || {};
        if (url) {
          console.log('[Tabibi/Bridge] Launch URL:', url);
          this._handleDeepLink(url);
        }
      } catch (err) {
        console.warn('[Tabibi/Bridge] initDeepLinks error:', err);
      }
    },

    /** @private */
    _handleDeepLink(url) {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const path = parsed.pathname || parsed.hostname || '';

        // Reset password
        if (path.includes('reset-password')) {
          const params = new URLSearchParams(parsed.search || parsed.hash.replace('#', '?'));
          const token = params.get('access_token') || params.get('token');
          if (token) {
            window.location.href = '/reset-password.html?access_token=' + encodeURIComponent(token);
          }
          return;
        }

        // Vérification email
        if (path.includes('verify-email') || path.includes('email-verified')) {
          const params = new URLSearchParams(parsed.search || parsed.hash.replace('#', '?'));
          const token = params.get('access_token') || params.get('token');
          if (token) {
            window.location.href = '/email-verified.html?access_token=' + encodeURIComponent(token);
          }
          return;
        }

        console.log('[Tabibi/Bridge] Deep link non reconnu:', url);
      } catch (err) {
        console.warn('[Tabibi/Bridge] _handleDeepLink error:', url, err);
      }
    },

    // ─── 4. STOCKAGE SESSION ────────────────────────────────────────

    /**
     * Wrapper Preferences (Capacitor) / localStorage (web).
     * Utiliser tabibiBridge.storage pour une persistence native plus robuste.
     *
     * Note : Supabase JS SDK gère déjà sa session via localStorage.
     * Ce wrapper est pour les données custom (lang, role, cookie prefs).
     */
    storage: {
      async get(key) {
        if (isCapacitorAvailable && window.Capacitor.isNativePlatform()) {
          try {
            const Preferences = _plug('Preferences');
            if (!Preferences) return localStorage.getItem(key);
            const { value } = await Preferences.get({ key });
            return value;
          } catch (err) {
            return localStorage.getItem(key);
          }
        }
        return localStorage.getItem(key);
      },

      async set(key, value) {
        if (isCapacitorAvailable && window.Capacitor.isNativePlatform()) {
          try {
            const Preferences = _plug('Preferences');
            if (!Preferences) { localStorage.setItem(key, value); return; }
            await Preferences.set({ key, value: String(value) });
            return;
          } catch (err) { /* fallback */ }
        }
        localStorage.setItem(key, value);
      },

      async remove(key) {
        if (isCapacitorAvailable && window.Capacitor.isNativePlatform()) {
          try {
            const Preferences = _plug('Preferences');
            if (!Preferences) { localStorage.removeItem(key); return; }
            await Preferences.remove({ key });
            return;
          } catch (err) { /* fallback */ }
        }
        localStorage.removeItem(key);
      },
    },

    // ─── 5. CAMÉRA & FICHIERS ───────────────────────────────────────

    /**
     * Prend une photo ou sélectionne depuis la galerie.
     * Retourne un objet { dataUrl, blob, mimeType } ou null si annulé.
     *
     * En web    → <input type="file"> standard
     * En natif  → @capacitor/camera
     *
     * @param {'photo'|'gallery'} source - 'photo' = caméra, 'gallery' = galerie
     * @returns {Promise<{dataUrl:string, mimeType:string}|null>}
     */
    async pickImage(source) {
      source = source || 'gallery';

      if (!this.isNative) {
        // Fallback web : input file natif
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (source === 'photo') input.capture = 'environment';
          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = (e) => resolve({ dataUrl: e.target.result, mimeType: file.type });
            reader.readAsDataURL(file);
          };
          input.click();
        });
      }

      try {
        const Camera = _plug('Camera');
        if (!Camera) { console.warn('[Tabibi/Bridge] Camera plugin indisponible'); return null; }
        const image = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: 'dataUrl',                            // CameraResultType.DataUrl
          source: source === 'photo' ? 'CAMERA' : 'PHOTOS', // CameraSource.Camera / .Photos
        });
        return { dataUrl: image.dataUrl, mimeType: 'image/' + image.format };
      } catch (err) {
        if (err && err.message && err.message.includes('cancelled')) return null;
        console.error('[Tabibi/Bridge] pickImage error:', err);
        return null;
      }
    },

    // ─── 6. BACK BUTTON ANDROID ─────────────────────────────────────

    /**
     * Configure le bouton retour Android.
     * - Si historique disponible → history.back()
     * - Si page racine → App.exitApp()
     *
     * À appeler une seule fois au chargement de l'app.
     */
    async initBackButton() {
      if (!this.isAndroid) return;

      try {
        const App = _plug('App');
        if (!App) { console.warn('[Tabibi/Bridge] App plugin indisponible (back button)'); return; }
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
      } catch (err) {
        console.warn('[Tabibi/Bridge] initBackButton error:', err);
      }
    },

    // ─── 7. NOTIFICATIONS PUSH ──────────────────────────────────────

    /**
     * Demande la permission pour les notifications push et retourne le token FCM/APNs.
     *
     * À appeler APRÈS que l'utilisateur soit connecté (pas au démarrage).
     * Le token est à envoyer à Supabase/backend pour l'envoi ciblé.
     *
     * @returns {Promise<{token:string|null, granted:boolean}>}
     */
    async initPushNotifications() {
      if (!this.isNative) {
        return { token: null, granted: false };
      }

      try {
        const PushNotifications = _plug('PushNotifications');
        if (!PushNotifications) { console.warn('[Tabibi/Bridge] PushNotifications plugin indisponible'); return { token: null, granted: false }; }

        // Demander la permission
        const { receive: permStatus } = await PushNotifications.requestPermissions();

        if (permStatus !== 'granted') {
          console.log('[Tabibi/Bridge] Push permissions refusées');
          return { token: null, granted: false };
        }

        // Enregistrer
        await PushNotifications.register();

        // Écouter le token
        return new Promise((resolve) => {
          PushNotifications.addListener('registration', async (token) => {
            console.log('[Tabibi/Bridge] Push token:', token.value.substring(0, 20) + '...');
            await this.saveDeviceToken(token.value); // ← UPSERT Supabase device_tokens
            resolve({ token: token.value, granted: true });
          });
          PushNotifications.addListener('registrationError', (err) => {
            console.error('[Tabibi/Bridge] Push registration error:', err);
            resolve({ token: null, granted: false });
          });

          // Timeout 10s
          setTimeout(() => resolve({ token: null, granted: false }), 10000);
        });
      } catch (err) {
        console.error('[Tabibi/Bridge] initPushNotifications error:', err);
        return { token: null, granted: false };
      }
    },

    /**
     * Configure les listeners pour les notifications reçues.
     * À appeler après initPushNotifications().
     *
     * @param {Function} onReceived - callback(notification) quand app au premier plan
     * @param {Function} onAction - callback(notification) quand tap sur notif
     */
    /**
     * Sauvegarde le token FCM/APNs dans Supabase (table device_tokens).
     * UPSERT sur (user_id, token) → jamais de doublon.
     * Ne throw pas : un échec de save ne doit jamais bloquer l'app.
     *
     * @param {string} token - Token FCM (Android) ou APNs (iOS)
     */
    async saveDeviceToken(token) {
      if (!token) return;
      try {
        const sb = window.tabibi && window.tabibi.supabase;
        if (!sb) return;

        const { data: sessionData } = await sb.auth.getSession();
        const userId = sessionData &&
                       sessionData.session &&
                       sessionData.session.user &&
                       sessionData.session.user.id;

        if (!userId) {
          console.log('[Tabibi/Bridge] saveDeviceToken: pas de session active, token ignoré');
          return;
        }

        const platform = this.platform || 'android'; // 'android' | 'ios' | 'web'

        const { error } = await sb.from('device_tokens').upsert(
          { user_id: userId, token, platform, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,token' }
        );

        if (error) {
          console.warn('[Tabibi/Bridge] saveDeviceToken error:', error.message);
        } else {
          console.log('[Tabibi/Bridge] Token FCM sauvegardé (' + platform + ')');
        }
      } catch (err) {
        console.warn('[Tabibi/Bridge] saveDeviceToken exception:', err);
      }
    },

    async onPushNotification(onReceived, onAction) {
      if (!this.isNative) return;
      try {
        const PushNotifications = _plug('PushNotifications');
        if (!PushNotifications) { console.warn('[Tabibi/Bridge] PushNotifications plugin indisponible'); return; }
        if (onReceived) {
          PushNotifications.addListener('pushNotificationReceived', onReceived);
        }
        if (onAction) {
          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            onAction(action.notification);
          });
        }
      } catch (err) {
        console.warn('[Tabibi/Bridge] onPushNotification error:', err);
      }
    },

    // ─── 8. TURNSTILE BYPASS ────────────────────────────────────────

    /**
     * Détermine si Turnstile doit être affiché.
     * En app native → TOUJOURS false (captcha incompatible avec WebView).
     * En web → selon la config TABIBI_CONFIG.
     *
     * @returns {boolean}
     */
    shouldShowTurnstile() {
      if (this.isNative) return false;
      // En web : Turnstile normal
      return true;
    },

    /**
     * Retourne un header à inclure dans les appels Edge Function
     * pour indiquer que la requête vient de l'app native (bypass Turnstile).
     *
     * IMPORTANT : Le secret X-App-Platform-Token doit être configuré dans
     * les Edge Functions Supabase (variable CAPACITOR_APP_SECRET).
     *
     * @returns {Object} Headers à merger dans les requêtes fetch
     */
    getNativeHeaders() {
      if (!this.isNative) return {};
      return {
        'X-App-Platform': 'capacitor',
        'X-App-Version': '1.0.0',
        // X-App-Platform-Token: à ajouter quand CAPACITOR_APP_SECRET configuré
      };
    },

    // ─── 9. ANALYTICS & COOKIES ─────────────────────────────────────

    /**
     * En app native, la bannière cookies et le tracking tiers sont inutiles.
     * Cette méthode masque la bannière si on est en natif.
     */
    initAnalytics() {
      if (!this.isNative) return;

      // Masquer le cookie banner (inutile en app native)
      const cookieBanner = document.getElementById('tabibi-cookie-banner');
      if (cookieBanner) cookieBanner.style.display = 'none';

      // Désactiver Plausible (tracking web → utiliser analytics store à la place)
      if (window.TABIBI_FEATURES) {
        window.TABIBI_FEATURES.analytics = false;
      }

      console.log('[Tabibi/Bridge] Analytics web désactivées en mode natif');
    },

    // ─── 10. STATUS BAR & SAFE AREAS ────────────────────────────────

    /**
     * Configure la status bar native (couleur, style).
     * À appeler au chargement de chaque page.
     *
     * @param {Object} [opts]
     * @param {string} [opts.backgroundColor='#0F7560'] - Couleur de fond
     * @param {'DARK'|'LIGHT'} [opts.style='DARK'] - Style texte (DARK = blanc)
     */
    async setStatusBar(opts) {
      if (!this.isNative) return;
      opts = opts || {};

      try {
        const StatusBar = _plug('StatusBar');
        if (!StatusBar) { console.warn('[Tabibi/Bridge] StatusBar plugin indisponible'); return; }
        await StatusBar.setStyle({
          style: opts.style === 'LIGHT' ? 'LIGHT' : 'DARK', // Style.Light / .Dark
        });
        if (this.isAndroid) {
          await StatusBar.setBackgroundColor({
            color: opts.backgroundColor || '#0F7560',
          });
        }
      } catch (err) {
        console.warn('[Tabibi/Bridge] setStatusBar error:', err);
      }
    },

    // ─── INIT GLOBAL ─────────────────────────────────────────────────

    /**
     * Initialise tous les comportements natifs.
     * Appeler UNE SEULE FOIS dans une page maîtresse (ex: index.html).
     *
     * Exemple d'utilisation :
     *   document.addEventListener('DOMContentLoaded', async () => {
     *     await window.tabibi.bridge.init();
     *   });
     */
    async init() {
      if (!this.isNative) {
        console.log('[Tabibi/Bridge] Mode web — bridge inactif');
        return;
      }

      console.log('[Tabibi/Bridge] Initialisation mode natif (' + this.platform + ')');

      // Ordre important : status bar en premier (visuel immédiat)
      await this.setStatusBar();

      // Liens externes
      this.patchExternalLinks();

      // Back button Android
      await this.initBackButton();

      // Deep links auth
      await this.initDeepLinks();

      // Analytics off
      this.initAnalytics();

      // Service Worker inutile en mode natif
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.unregister());
        });
      }

      console.log('[Tabibi/Bridge] ✅ Initialisé sur', this.platform);
    },
  };

  // Auto-init léger (sans await — le init() complet est manuel)
  if (isCapacitorAvailable && window.Capacitor.isNativePlatform()) {
    document.addEventListener('DOMContentLoaded', () => {
      // Masquer cookie banner immédiatement si natif
      const banner = document.getElementById('tabibi-cookie-banner');
      if (banner) banner.style.display = 'none';
    });
  }

})();
