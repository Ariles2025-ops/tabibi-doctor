/* ====================================================================
 * Tabibi - Claim flow (réclamation fiche médecin)
 * --------------------------------------------------------------------
 * Phase 1 (PROGRESS.md) - 2026-05-21
 *
 * Logique partagée entre :
 *   - doctor-profile.html  : bandeau "Réclamer ma fiche"
 *   - signup.html          : auto-claim post-inscription si
 *                            ?claim_legacy_id=<int> présent
 *
 * RPC backend (DÉJÀ EN BASE - NE PAS MODIFIER) :
 *   claim_my_doctor_profile(legacy_id_input INT)
 *   -> { ok: true,  profile_id, legacy_id, claimed_at }
 *   -> { ok: false, error: <code> }
 *
 * Codes d'erreur RPC :
 *   not_authenticated, user_not_found, not_a_doctor_account,
 *   already_claimed_another_profile, profile_not_found,
 *   profile_already_claimed
 *
 * Storage clé :
 *   localStorage.tabibi_pending_claim_legacy_id
 *   -> set quand auto-claim fail (réseau ou not_authenticated)
 *   -> consommé au prochain login médecin (cf. auth.js / dashboard)
 * ==================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'tabibi_pending_claim_legacy_id';

  // ---------- helpers --------------------------------------------------

  function _sb() {
    return global.tabibi && global.tabibi.supabase;
  }

  function _toast(msg, kind) {
    try {
      if (typeof global.toastM === 'function') return global.toastM(msg, kind || 'info');
      if (typeof global.toast === 'function') return global.toast(msg, kind || 'info');
    } catch (e) {}
    // fallback
    try { console[(kind === 'error' ? 'error' : 'log')]('[claim]', msg); } catch (e) {}
  }

  // Récupère { isAuth, role } pour décider du routage du bandeau
  async function getCurrentUserInfo() {
    var sb = _sb();
    if (!sb) return { isAuth: false, role: null, userId: null };
    try {
      var sess = await sb.auth.getSession();
      var user = sess && sess.data && sess.data.session && sess.data.session.user;
      if (!user) return { isAuth: false, role: null, userId: null };
      // tentative lookup role dans public.users
      var role = null;
      try {
        var r = await sb.from('users').select('role').eq('id', user.id).maybeSingle();
        if (r && r.data && r.data.role) role = r.data.role;
      } catch (e) {}
      // fallback : metadata du signup
      if (!role && user.user_metadata && user.user_metadata.role) role = user.user_metadata.role;
      return { isAuth: true, role: role, userId: user.id };
    } catch (e) {
      console.warn('[claim] getCurrentUserInfo', e);
      return { isAuth: false, role: null, userId: null };
    }
  }

  // Mappe les codes d'erreur RPC -> messages FR humains
  function _humanError(code) {
    switch (code) {
      case 'not_authenticated':
        return "Vous devez d'abord créer un compte médecin pour réclamer cette fiche.";
      case 'user_not_found':
        return "Compte introuvable. Reconnectez-vous puis réessayez.";
      case 'not_a_doctor_account':
        return "Seul un compte médecin peut réclamer une fiche. Créez un compte avec le rôle « médecin ».";
      case 'already_claimed_another_profile':
        return "Vous avez déjà réclamé une autre fiche. Contactez le support si c'est une erreur.";
      case 'profile_not_found':
        return "Fiche introuvable. Le lien est peut-être obsolète.";
      case 'profile_already_claimed':
        return "Cette fiche a déjà été réclamée par un autre médecin. Si c'est une erreur, écrivez à support@tabibi.doctor.";
      default:
        return "Erreur lors de la réclamation : " + String(code || 'inconnue');
    }
  }

  // Appelle la RPC backend de claim. Renvoie { ok, data?, error? }.
  async function performClaim(legacyId) {
    var sb = _sb();
    if (!sb) return { ok: false, error: 'no_supabase_client' };
    var n = parseInt(legacyId, 10);
    if (!n || isNaN(n) || n < 1) return { ok: false, error: 'invalid_legacy_id' };
    try {
      var r = await sb.rpc('claim_my_doctor_profile', { legacy_id_input: n });
      if (r.error) {
        console.warn('[claim] RPC error', r.error);
        return { ok: false, error: r.error.message || 'rpc_error' };
      }
      // La fonction retourne un JSON { ok: bool, ... } directement dans r.data
      var payload = r.data;
      if (payload && payload.ok === true) {
        return { ok: true, data: payload };
      }
      return { ok: false, error: (payload && payload.error) || 'unknown_error' };
    } catch (e) {
      console.warn('[claim] RPC exception', e);
      return { ok: false, error: 'network_error' };
    }
  }

  // ---------- Cas 1 : bouton bandeau doctor-profile.html --------------

  // Handler appelé par le bandeau "Réclamer ma fiche".
  // Routage selon état utilisateur :
  //   A. Non connecté        -> redirige signup.html?role=medecin&claim_legacy_id=<n>
  //   B. Connecté médecin    -> appelle RPC tout de suite
  //   C. Connecté patient    -> toast d'erreur (doit créer compte médecin)
  async function handleClaimBanner(legacyId) {
    var n = parseInt(legacyId, 10);
    if (!n || isNaN(n)) {
      _toast("Identifiant de fiche invalide.", 'error');
      return;
    }

    var info = await getCurrentUserInfo();

    // Cas A : non connecté -> signup avec param
    if (!info.isAuth) {
      var url = 'signup.html?role=medecin&claim_legacy_id=' + encodeURIComponent(n);
      global.location.href = url;
      return;
    }

    // Cas C : connecté mais pas médecin
    if (info.role && info.role !== 'medecin') {
      _toast(
        "Vous êtes connecté en tant que " + info.role + ". " +
        "Pour réclamer une fiche médecin, créez un compte médecin (déconnectez-vous d'abord).",
        'error'
      );
      return;
    }

    // Cas B : médecin connecté -> claim direct
    _toast("Réclamation en cours...", 'info');
    var res = await performClaim(n);
    if (res.ok) {
      // [Phase 14.2] Post-claim → onboarding wizard pour remplir bio/tarif/horaires.
      // Si déjà fait (ex: re-claim cas absurde), medecin-profile détectera et
      // n'affichera pas la banner onboarding.
      _toast("Fiche réclamée ! Complétez maintenant votre profil en 3 minutes.", 'success');
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      setTimeout(function () {
        global.location.href = 'medecin-profile.html?onboarding=1';
      }, 1500);
    } else {
      _toast(_humanError(res.error), 'error');
    }
  }

  // ---------- Cas 2 : auto-claim post-signup --------------------------

  // Appelé depuis signup.html APRÈS upsert profil et AVANT signOut.
  // Si succès : nettoie le storage. Si échec : stocke pour retry.
  async function autoClaim(legacyId) {
    var n = parseInt(legacyId, 10);
    if (!n || isNaN(n)) return { ok: false, error: 'invalid_legacy_id' };
    var res = await performClaim(n);
    if (res.ok) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      return res;
    }
    // Fallback : stocke pour retry au prochain login médecin
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (e) {}
    return res;
  }

  // ---------- Cas 3 : retry pending au login --------------------------

  // À appeler depuis le flow post-login médecin (dashboard ou auth.js).
  // Si un legacy_id est en attente dans localStorage, tente la RPC.
  async function consumePending() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!raw) return { ok: false, error: 'no_pending' };
    var n = parseInt(raw, 10);
    if (!n || isNaN(n)) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      return { ok: false, error: 'invalid_pending' };
    }
    var res = await performClaim(n);
    if (res.ok || res.error === 'profile_already_claimed' || res.error === 'already_claimed_another_profile') {
      // succès OU situation définitive -> on nettoie
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
    return res;
  }

  // ---------- API publique --------------------------------------------

  global.tabibiClaim = {
    handle: handleClaimBanner,
    autoClaim: autoClaim,
    consumePending: consumePending,
    performClaim: performClaim,
    getCurrentUserInfo: getCurrentUserInfo,
    STORAGE_KEY: STORAGE_KEY
  };
})(window);
