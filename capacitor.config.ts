import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ── Identité de l'app ──────────────────────────────────────────────────
  appId: 'com.tabibi.doctor',
  appName: 'Tabibi',
  webDir: 'www',        // Généré par scripts/build-mobile.sh (copie des assets web)

  // ── Comportement WebView ───────────────────────────────────────────────
  bundledWebRuntime: false,

  server: {
    // Utilise https:// comme scheme Android pour éviter les restrictions CORS
    androidScheme: 'https',
    // En développement uniquement : pointer vers le serveur live pour hot reload
    // url: 'http://192.168.x.x:3000',  // ← décommenter pour dev avec live reload
  },

  // ── Plugins ───────────────────────────────────────────────────────────
  plugins: {
    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F7560',           // couleur primaire Tabibi
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Status Bar
    StatusBar: {
      style: 'DARK',                        // texte blanc sur fond vert
      backgroundColor: '#0F7560',
      overlaysWebView: false,
    },

    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Keyboard
    Keyboard: {
      resize: 'body',                       // évite que le clavier cache les champs
      resizeOnFullScreen: true,
    },

    // Local Notifications
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0F7560',
      sound: 'beep.wav',
    },

    // App (deep links)
    App: {
      // Scheme personnalisé pour deep links auth (reset-password, verify-email)
      // Configurer dans Supabase Auth → Redirect URLs : tabibi://auth/callback
    },
  },

  // ── iOS spécifique ─────────────────────────────────────────────────────
  ios: {
    contentInset: 'always',                 // respect des safe areas (notch/Dynamic Island)
    allowsLinkPreview: false,
    scrollEnabled: true,
    // limiterAccessToLocalNetworkRequest supprimé — non requis en production
  },

  // ── Android spécifique ─────────────────────────────────────────────────
  android: {
    allowMixedContent: false,               // sécurité : bloquer les requêtes HTTP depuis HTTPS
    captureInput: true,
    webContentsDebuggingEnabled: false,     // passer à true uniquement en dev
  },
};

export default config;
