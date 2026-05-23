// Tabibi Login Handler - branche les formulaires login/signup sur Supabase
(function() {
  if (!window.tabibi || !window.tabibi.auth) {
    console.error('[Tabibi/login-handler] auth.js non charge');
    return;
  }

  function findLoginForm() {
    // [Phase 14.2 fix] Fallback `document.querySelector('form')` SUPPRIMÉ.
    // Avant : signup.html (form sans id) tombait sur le catch-all → listener
    // login attaché → POST /auth/v1/token?grant_type=password sur submit signup
    // → 400 Invalid login credentials → flow signup cassé.
    // Maintenant : opt-in explicite via id="loginForm" ou data-form="login".
    // login.html ajoute id="loginForm" au form. Toute autre page (signup,
    // forgot-password, reset, contact, etc.) est désormais immune.
    return document.querySelector('form#loginForm') ||
           document.querySelector('form[data-form="login"]');
  }

  function showError(msg) {
    let err = document.querySelector('.login-error, #loginError, [data-login-error]');
    if (!err) {
      err = document.createElement('div');
      err.className = 'login-error';
      err.style.cssText = 'color:#dc2626;text-align:center;margin:10px 0;font-size:14px;';
      const form = findLoginForm();
      if (form) form.insertBefore(err, form.firstChild);
    }
    err.textContent = msg;
    err.style.display = 'block';
  }

  function clearError() {
    const err = document.querySelector('.login-error, #loginError, [data-login-error]');
    if (err) err.style.display = 'none';
  }

  function attachLogin() {
    const form = findLoginForm();
    if (!form) return;
    if (form.dataset.tabibiBound === '1') return;
    form.dataset.tabibiBound = '1';

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      clearError();

      const email = (form.querySelector('input[type="email"]') || form.querySelector('input[name="email"]'))?.value?.trim();
      const password = (form.querySelector('input[type="password"]') || form.querySelector('input[name="password"]'))?.value;

      if (!email || !password) {
        showError('Veuillez remplir tous les champs.');
        return;
      }

      const btn = form.querySelector('button[type="submit"], button');
      const originalText = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }

      try {
        await window.tabibi.auth.signIn(email, password);
        await window.tabibi.auth.redirectAfterLogin();
      } catch (err) {
        console.error('[Tabibi/login] Erreur:', err);
        showError('Email ou mot de passe incorrect.');
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
      }
    }, true);

    /* [FIX-PROD-2026-05-19] log retiré */
  }

  function attachSignup() {
    const form = document.querySelector('form#signupForm') ||
                 document.querySelector('form[data-form="signup"]');
    if (!form) return;
    if (form.dataset.tabibiBound === '1') return;
    form.dataset.tabibiBound = '1';

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      clearError();

      const email = form.querySelector('input[type="email"]')?.value?.trim();
      const password = form.querySelector('input[type="password"]')?.value;
      const role = form.querySelector('input[name="role"]:checked')?.value || 'patient';

      if (!email || !password) {
        showError('Veuillez remplir tous les champs.');
        return;
      }

      try {
        await window.tabibi.auth.signUp(email, password, role);
        alert('Inscription reussie ! Vous pouvez vous connecter.');
        window.location.href = 'login.html';
      } catch (err) {
        console.error('[Tabibi/signup] Erreur:', err);
        showError('Erreur lors de l inscription : ' + err.message);
      }
    }, true);

    /* [FIX-PROD-2026-05-19] log retiré */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachLogin();
      attachSignup();
    });
  } else {
    attachLogin();
    attachSignup();
  }
})();
