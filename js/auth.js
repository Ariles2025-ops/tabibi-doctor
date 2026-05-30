// Tabibi auth module
(function() {
  if (!window.tabibi || !window.tabibi.supabase) {
    console.error('[Tabibi/auth] supabase-client.js non charge');
    return;
  }
  const sb = window.tabibi.supabase;
  const cfg = window.TABIBI_CONFIG;

  window.tabibi.auth = {
    async signUp(email, password, role = 'patient') {
      // [CRIT-5] token captcha frais (Supabase Auth le valide server-side)
      const captchaToken = window.tabibiTurnstile ? await window.tabibiTurnstile.getCaptchaToken() : undefined;
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { role }, captchaToken },
      });
      if (error) throw error;
      return data;
    },
    async signIn(email, password) {
      // [CRIT-5] token captcha frais (Supabase Auth le valide server-side)
      const captchaToken = window.tabibiTurnstile ? await window.tabibiTurnstile.getCaptchaToken() : undefined;
      const { data, error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
      try {
        localStorage.removeItem('tabibi_user');
        localStorage.removeItem('tabibi_role');
      } catch(e) {}
      window.location.href = cfg.REDIRECTS.afterLogout;
    },
    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    // [FIX session] Variante qui PRÉSERVE l'error du SDK.
    // getSession() reste inchangé (backward-compat : api.js, reviews, bridge, pages).
    async getSessionResult() {
      const { data, error } = await sb.auth.getSession();
      return { session: (data && data.session) || null, error: error || null };
    },
    async getUser() {
      const session = await this.getSession();
      if (!session) return null;
      const { data, error } = await sb.from('users').select('*').eq('id', session.user.id).single();
      if (error) return { id: session.user.id, email: session.user.email, role: 'patient' };
      return data;
    },
    async redirectAfterLogin() {
      const user = await this.getUser();
      if (!user) { window.location.href = cfg.REDIRECTS.notLoggedIn; return; }
      // Normaliser le rôle (FR ou EN)
      let role = (user.role || 'patient').toLowerCase();
      if (role === 'doctor' || role === 'médecin') role = 'medecin';
      const target = cfg.REDIRECTS[role] || cfg.REDIRECTS.patient;
      window.location.href = target;
    },
    // [FIX session] Garde réseau-aware : valide la session AVANT le cache,
    // purge sur rejet serveur, tolère le réseau coupé (mode dégradé).
    async requireAuth(allowedRoles = null) {
      const red = (cfg && cfg.REDIRECTS) || {};
      const loginUrl = red.notLoggedIn || 'login.html';
      const normRole = (r) => { r = (r||'patient').toLowerCase(); return (r==='doctor'||r==='médecin')?'medecin':r; };
      const roleAllowed = (role) => {
        if (!allowedRoles) return true;
        const list = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        return list.map(normRole).indexOf(normRole(role)) !== -1;
      };
      const cachedUser = () => { try { return JSON.parse(localStorage.getItem('tabibi_user')||'null'); } catch(e){ return null; } };
      const purgeAndLogin = () => {
        try { localStorage.removeItem('tabibi_user'); localStorage.removeItem('tabibi_role'); } catch(e){}
        window.location.href = loginUrl; return null;
      };
      // (e) classification fine, pas de catch générique
      const isAuthRejection = (err) => {
        if (!err) return false;
        if (err.name === 'AuthApiError') return true;
        const s = (typeof err.status === 'number') ? err.status : null;
        return s === 400 || s === 401 || s === 403;
      };
      const isNetworkError = (err) => {
        if (!err) return false;
        if (err.name === 'AuthRetryableFetchError' || err.name === 'TypeError' || err.name === 'FetchError') return true;
        const s = (typeof err.status === 'number') ? err.status : null;
        return s === null || s === 0; // pas de réponse serveur = réseau
      };
      const gateRole = (user) => {
        if (roleAllowed(user.role)) return user;
        const r = normRole(user.role);
        window.location.href = red[r] || red.patient || loginUrl; return null;
      };

      // (a) session AVANT le cache, en gardant l'error
      const { session, error } = await this.getSessionResult();

      // (c) session nulle + rejet serveur (refresh token invalide) → purge + login
      if (!session && isAuthRejection(error)) return purgeAndLogin();

      // (d) session nulle + erreur réseau/retryable → mode dégradé : cache si présent
      if (!session && isNetworkError(error)) {
        const cu = cachedUser();
        return (cu && roleAllowed(cu.role)) ? cu : purgeAndLogin();
      }

      // session nulle sans erreur (jamais connecté) → login
      if (!session) return purgeAndLogin();

      // (b) session présente → profil frais + rafraîchit le cache tabibi_user
      const user = await this.getUser();
      if (!user) { const cu = cachedUser(); return (cu && roleAllowed(cu.role)) ? cu : purgeAndLogin(); }
      try {
        const cu = cachedUser() || {};
        cu.id = user.id; cu.email = user.email; cu.role = normRole(user.role);
        localStorage.setItem('tabibi_user', JSON.stringify(cu));
      } catch(e){}

      // (3) rôle attendu
      return gateRole(user);
    },
  };
  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
