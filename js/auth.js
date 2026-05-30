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
    async requireAuth(allowedRoles = null) {
      const user = await this.getUser();
      if (!user) { window.location.href = cfg.REDIRECTS.notLoggedIn; return null; }
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        window.location.href = cfg.REDIRECTS[user.role] || cfg.REDIRECTS.patient;
        return null;
      }
      return user;
    },
  };
  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
