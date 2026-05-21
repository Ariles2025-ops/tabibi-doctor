// =====================================================================
// Tabibi Bridge — connecte Supabase Auth ↔ localStorage (tabibi_user)
// =====================================================================
// Comportement :
//  - Si une session Supabase existe : on récupère le profil depuis la
//    table `users` et on l'écrit dans localStorage.tabibi_user (avec
//    fusion intelligente pour préserver les champs locaux).
//  - Si AUCUNE session Supabase n'existe : on NE TOUCHE PAS au
//    tabibi_user déjà présent (mode démo via login.html).
//  - Charge aussi les médecins publics dans window.SUPABASE_DOCTORS
//    pour les pages qui en ont besoin.
// =====================================================================
(function () {
  if (!window.tabibi || !window.tabibi.api) {
    console.warn('[Tabibi/bridge] api.js non chargé — bridge désactivé');
    return;
  }

  const api = window.tabibi.api;
  const sb = window.tabibi.supabase;

  // ─── Charger les médecins publics depuis Supabase (uniquement pour pages qui n'ont pas app.js) ───
  // IMPORTANT: ne JAMAIS toucher à DOCTORS si app.js est chargé — le format diffère
  // et app.js charge les 14 000 médecins par batches via loadDoctorsIntoApp
  async function loadDoctorsFromSupabase() {
    // Si app.js a déjà défini DOCTORS, on ne s'en mêle pas
    if (typeof DOCTORS !== 'undefined') {
      /* [FIX-PROD-2026-05-19] log d'init retiré */
      return;
    }

    try {
      const { data, count } = await api.searchDoctors({ limit: 100 });
      const list = data || [];
      /* [FIX-PROD-2026-05-19] log retiré */

      window.SUPABASE_DOCTORS = list.map(d => ({
        id: d.id,
        name: d.full_name,
        nameAr: d.full_name_ar || '',
        // [I18N-UNIFY-2026] specialty multilingue via JOIN specialties
        specialty: d.specialty_name_fr || d.specialty_fr || 'Généraliste',
        specialtyAr: d.specialty_ar || d.specialty_fr || '',
        specialtyEn: d.specialty_en || d.specialty_fr || '',
        specialtySlug: d.specialty_slug,
        wilaya: d.wilaya_fr || '',
        wilayaAr: d.wilaya_ar || d.wilaya_fr || '',
        wilayaEn: d.wilaya_en || d.wilaya_fr || '',
        wilayaCode: d.wilaya_code,
        address: d.address || '',
        phone: '',
        rating: d.rating || 0,
        reviewCount: d.review_count || 0,
        fee: d.consultation_fee_dzd || 0,
        photo: d.photo_url || null,
        verified: d.is_verified,
        claimed: d.is_claimed,
        entityType: d.entity_type,
      }));

      document.dispatchEvent(new CustomEvent('tabibi:doctors-loaded', {
        detail: { count: list.length }
      }));
    } catch (e) {
      console.warn('[Tabibi/bridge] Erreur chargement médecins (mode hors-ligne possible):', e && e.message);
    }
  }

  // ─── Synchroniser le profil utilisateur Supabase → localStorage ───
  async function syncUserProfile() {
    try {
      const session = await window.tabibi.auth.getSession();
      if (!session) {
        // Pas de session Supabase : on PRÉSERVE tabibi_user (mode démo)
        document.dispatchEvent(new CustomEvent('tabibi:auth', {
          detail: { event: 'NO_SUPABASE_SESSION' }
        }));
        return;
      }

      // Vraie session Supabase → on charge le profil
      const user = await window.tabibi.auth.getUser();
      /* [FIX-PROD-2026-05-19] log retiré (PII email) */

      // Lire l'existant pour fusionner sans perdre les champs locaux
      let existing = {};
      try { existing = JSON.parse(localStorage.getItem('tabibi_user') || '{}') || {}; } catch (e) {}

      const u = user || {};
      const role = normalizeRole(u.role || existing.role || 'patient');

      // Construire un nom d'affichage
      let displayName = existing.name;
      if (u.first_name || u.last_name) {
        displayName = ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
      }
      if (!displayName) displayName = (u.email || session.user.email || '').split('@')[0];

      // Initiales
      let initials = existing.initials;
      if (!initials || displayName !== existing.name) {
        const parts = displayName.replace(/^Dr\.?\s+/i, '').split(/\s+/);
        initials = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      }

      const merged = Object.assign({}, existing, {
        id: u.id || session.user.id,
        email: u.email || session.user.email,
        role: role,
        firstName: u.first_name || existing.firstName,
        lastName: u.last_name || existing.lastName,
        name: displayName,
        initials: initials,
      });

      // Champs spécifiques médecin si la table renvoie ces colonnes
      if (u.specialty_fr || u.specialty || existing.specialty) {
        merged.specialty = u.specialty_fr || u.specialty || existing.specialty;
      }
      if (u.wilaya_fr || u.ville || existing.ville) {
        merged.ville = u.wilaya_fr || u.ville || existing.ville;
      }
      if (u.phone || existing.phone) {
        merged.phone = u.phone || existing.phone;
      }

      localStorage.setItem('tabibi_user', JSON.stringify(merged));
      localStorage.setItem('tabibi_role', merged.role);

      document.dispatchEvent(new CustomEvent('tabibi:auth', {
        detail: { event: 'SIGNED_IN', user: merged }
      }));
    } catch (e) {
      console.warn('[Tabibi/bridge] syncUserProfile erreur (ignorée):', e && e.message);
    }
  }

  // Le rôle peut être en français ou anglais selon la table
  function normalizeRole(r) {
    if (!r) return 'patient';
    const s = String(r).toLowerCase().trim();
    if (s === 'doctor' || s === 'médecin' || s === 'medecin') return 'medecin';
    if (s === 'admin' || s === 'administrator') return 'admin';
    return 'patient';
  }

  // Écouter les changements d'auth Supabase
  if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
    try {
      sb.auth.onAuthStateChange((event /*, session */) => {
        /* [FIX-PROD-2026-05-19] log retiré */
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          syncUserProfile();
        }
        // SIGNED_OUT : on laisse logout() de l'app gérer le cleanup
      });
    } catch (e) {
      console.warn('[Tabibi/bridge] onAuthStateChange indispo:', e && e.message);
    }
  }

  // Lancer au chargement
  function start() {
    loadDoctorsFromSupabase();
    syncUserProfile();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
