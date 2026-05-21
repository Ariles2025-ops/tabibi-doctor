/**
 * Tabibi — Helper de robustesse réseau
 * 
 * Wrappe `fetch()` natif avec :
 *  - Retry automatique sur erreurs réseau (3 tentatives max, backoff exponentiel)
 *  - Détection hors-ligne via navigator.onLine
 *  - Timeout configurable (15s par défaut)
 *  - Toast utilisateur clair en cas d'échec persistant
 *  - File d'attente pour rejouer les écritures (POST/PATCH) quand la connexion revient
 * 
 * Utilisation : remplacer `fetch(url, opts)` par `tabibiFetch(url, opts)` dans le code
 * critique (réservations, sync RDV, etc.). Le fetch standard reste utilisable pour
 * les appels non critiques.
 */
(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  const DEFAULT_TIMEOUT_MS = 15000;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [600, 1500, 3000]; // ms
  const PENDING_QUEUE_KEY = 'tabibi_pending_writes';

  // ─── Toast minimal autonome (si l'app n'a pas son propre toastM) ───
  function showOfflineToast(message, type) {
    type = type || 'warning';
    // Si l'app a déjà toastM, on l'utilise
    if (typeof window.toastM === 'function') {
      window.toastM(message, type);
      return;
    }
    if (typeof window.toast === 'function') {
      window.toast(message, type, 4000);
      return;
    }
    // Sinon, on crée un toast minimaliste
    const t = document.createElement('div');
    const colors = {
      warning: '#f59e0b',
      error: '#dc2626',
      success: '#10b981',
      info: '#0F7560'
    };
    t.style.cssText = `
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      background:${colors[type] || colors.info};color:#fff;
      padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;
      box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:99999;
      max-width:90vw;text-align:center;
      font-family:-apple-system,sans-serif;
      animation:tabibi-toast-in .25s ease-out;
    `;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  // Animation CSS pour le toast
  if (!document.getElementById('tabibi-toast-style')) {
    const s = document.createElement('style');
    s.id = 'tabibi-toast-style';
    s.textContent = '@keyframes tabibi-toast-in{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(s);
  }

  // ─── Détection du statut hors-ligne ───
  let _offlineBannerShown = false;
  function showOfflineBanner() {
    if (_offlineBannerShown) return;
    _offlineBannerShown = true;
    showOfflineToast('Vous êtes hors connexion — vos actions seront synchronisées au retour du réseau.', 'warning');
  }
  function showOnlineBanner() {
    if (!_offlineBannerShown) return;
    _offlineBannerShown = false;
    showOfflineToast('Connexion rétablie — synchronisation en cours…', 'success');
    // Rejouer la file d'attente d'écritures
    flushPendingWrites();
  }

  window.addEventListener('online',  showOnlineBanner);
  window.addEventListener('offline', showOfflineBanner);

  // ─── File d'attente des écritures à rejouer ───
  function getPendingWrites() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
    } catch(e) { return []; }
  }
  function addPendingWrite(entry) {
    const q = getPendingWrites();
    q.push({ ...entry, queuedAt: Date.now() });
    try { localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(q)); } catch(e) {}
  }
  async function flushPendingWrites() {
    const q = getPendingWrites();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        const res = await fetch(item.url, item.opts);
        if (!res.ok && res.status >= 500) {
          remaining.push(item); // Erreur serveur, on garde pour réessayer
        }
      } catch(e) {
        remaining.push(item); // Erreur réseau, on garde
      }
    }
    try { localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining)); } catch(e) {}
    if (remaining.length === 0 && q.length > 0) {
      showOfflineToast('✓ ' + q.length + ' action(s) synchronisée(s)', 'success');
    }
  }

  // ─── Sleep helper ───
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ─── fetch avec retry + timeout ───
  async function tabibiFetch(url, opts = {}) {
    opts = opts || {};
    const method = (opts.method || 'GET').toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD';
    const timeout = opts.timeout || DEFAULT_TIMEOUT_MS;
    const maxRetries = opts.maxRetries != null ? opts.maxRetries : MAX_RETRIES;
    const silent = opts.silent === true; // Si true, pas de toast utilisateur

    // Si hors-ligne et c'est une écriture, on met en file d'attente
    if (!navigator.onLine && isWrite) {
      addPendingWrite({ url, opts: { ...opts, signal: undefined } });
      if (!silent) showOfflineToast('Action enregistrée — sera envoyée au retour de la connexion', 'info');
      throw new Error('OFFLINE_QUEUED');
    }

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Timeout via AbortController
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);

      try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        clearTimeout(timer);

        // 5xx → on retry
        if (res.status >= 500 && attempt < maxRetries) {
          lastError = new Error('HTTP ' + res.status);
          await sleep(RETRY_DELAYS[attempt] || 3000);
          continue;
        }

        return res; // Succès ou erreur 4xx (pas de retry sur les erreurs client)

      } catch (err) {
        clearTimeout(timer);
        lastError = err;

        // AbortError = timeout
        if (err.name === 'AbortError') {
          if (attempt < maxRetries) {
            await sleep(RETRY_DELAYS[attempt] || 3000);
            continue;
          }
          if (!silent) showOfflineToast('Délai dépassé — vérifiez votre connexion', 'error');
          if (isWrite) addPendingWrite({ url, opts: { ...opts, signal: undefined } });
          throw new Error('TIMEOUT');
        }

        // TypeError = erreur réseau (généralement Failed to fetch)
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Network'))) {
          if (attempt < maxRetries) {
            await sleep(RETRY_DELAYS[attempt] || 3000);
            continue;
          }
          if (!silent) showOfflineToast('Problème de connexion — réessayez plus tard', 'error');
          if (isWrite) addPendingWrite({ url, opts: { ...opts, signal: undefined } });
          throw new Error('NETWORK_ERROR');
        }

        throw err; // Autre erreur, on remonte
      }
    }
    throw lastError || new Error('FETCH_FAILED');
  }

  // ─── Expose globalement ───
  window.tabibiFetch = tabibiFetch;
  window.tabibiOfflineQueue = {
    get: getPendingWrites,
    flush: flushPendingWrites,
    add: addPendingWrite
  };

  // Au chargement, si en ligne et la file n'est pas vide, on tente de la vider
  if (navigator.onLine) {
    setTimeout(flushPendingWrites, 2000);
  } else {
    // Si on charge la page hors-ligne, on affiche le banner après 500ms
    setTimeout(showOfflineBanner, 500);
  }

  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
