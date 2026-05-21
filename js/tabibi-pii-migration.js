// =====================================================================
// Tabibi -- Migration PII medicales localStorage -> Supabase
// =====================================================================
// Detecte les PII medicales encore presentes dans tabibi_user localStorage,
// les pousse vers la table patient_medical_data via RPC, puis les supprime
// du navigateur. A executer une fois apres deploiement de la migration SQL.
//
// Charger ce script dans patient-dashboard.html et patient-profile.html.
// Le script est idempotent: si pas de PII en local, ne fait rien.
//
// IMPORTANT: tabibi-pii-migration.js doit etre charge APRES supabase-client.js.

(function () {
  'use strict';

  var PII_FIELDS = [
    'bloodType','height','weight','allergies','history','meds','familyHistory',
    'vaccinations','smoker','drinker','insurance','matricule','chifa','mutual',
    'emerg_name','emerg_rel','emerg_phone'
  ];

  function hasPII(u) {
    if (!u) return false;
    for (var i = 0; i < PII_FIELDS.length; i++) {
      var v = u[PII_FIELDS[i]];
      if (v !== undefined && v !== null && v !== '' && v !== false) return true;
    }
    return false;
  }

  function purgeFromLocalStorage(u) {
    PII_FIELDS.forEach(function (f) { delete u[f]; });
    try {
      localStorage.setItem('tabibi_user', JSON.stringify(u));
      localStorage.setItem('tabibi_pii_migrated_at', new Date().toISOString());
    } catch (e) {
      console.warn('[Tabibi PII] localStorage write failed', e);
    }
  }

  async function migrate() {
    try {
      var sb = window.tabibi && window.tabibi.supabase;
      if (!sb) {
        console.warn('[Tabibi PII] Supabase client absent, migration differee');
        return;
      }

      // [FIX 2026-05-19] Anti race-condition multi-onglets:
      // pose immediatement un "in_progress" lock avec timeout 60s.
      var nowMs = Date.now();
      var lockKey = 'tabibi_pii_migration_lock';
      var existingLock = parseInt(localStorage.getItem(lockKey) || '0', 10);
      if (existingLock && (nowMs - existingLock) < 60000) {
        // Un autre onglet est en train de migrer.
        return;
      }
      try { localStorage.setItem(lockKey, String(nowMs)); } catch (e) {}

      // [FIX 2026-05-19] Compteur de tentatives anti-boucle-infinie en cas d'echec permanent
      var attemptsKey = 'tabibi_pii_migration_attempts';
      var attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10);
      if (attempts >= 5) {
        console.warn('[Tabibi PII] 5 tentatives echouees, abandon. Contactez le support.');
        return;
      }
      try { localStorage.setItem(attemptsKey, String(attempts + 1)); } catch (e) {}

      // Deja migre (sentinel terminal) ?
      if (localStorage.getItem('tabibi_pii_migrated_at')) {
        // Cleanup du lock devenu inutile
        try { localStorage.removeItem(lockKey); } catch (e) {}
        try { localStorage.removeItem(attemptsKey); } catch (e) {}
        return;
      }

      var raw = localStorage.getItem('tabibi_user');
      if (!raw) {
        try { localStorage.removeItem(lockKey); } catch (e) {}
        return;
      }
      var u;
      try { u = JSON.parse(raw); } catch (e) {
        try { localStorage.removeItem(lockKey); } catch (e) {}
        return;
      }
      if (!hasPII(u)) {
        try { localStorage.removeItem(lockKey); } catch (e) {}
        return;
      }

      // Doit etre authentifie
      var session = await sb.auth.getSession();
      if (!session || !session.data || !session.data.session || !session.data.session.user) {
        try { localStorage.removeItem(lockKey); } catch (e) {}
        return;
      }

      var heightInt = u.height ? parseInt(u.height, 10) : null;
      if (heightInt !== null && (isNaN(heightInt) || heightInt < 30 || heightInt > 250)) heightInt = null;

      var weightNum = u.weight ? parseFloat(String(u.weight).replace(',', '.')) : null;
      if (weightNum !== null && (isNaN(weightNum) || weightNum < 1 || weightNum > 500)) weightNum = null;

      var payload = {
        p_blood_type:          u.bloodType || null,
        p_height_cm:           heightInt,
        p_weight_kg:           weightNum,
        p_allergies:           u.allergies || null,
        p_medical_history:     u.history || null,
        p_current_medications: u.meds || null,
        p_family_history:      u.familyHistory || null,
        p_vaccinations:        u.vaccinations || null,
        p_smoker:              !!u.smoker,
        p_drinker:             !!u.drinker,
        p_insurance:           u.insurance || null,
        p_mutual:              u.mutual || null,
        p_matricule:           u.matricule || null,
        p_chifa_card:          u.chifa || null,
        p_emergency_name:      u.emerg_name || null,
        p_emergency_relation:  u.emerg_rel || null,
        p_emergency_phone:     u.emerg_phone || null
      };

      var rpc = await sb.rpc('upsert_patient_medical_data', payload);
      if (rpc.error) {
        console.error('[Tabibi PII] migration upsert failed', rpc.error);
        // [FIX 2026-05-19] Cleanup du lock pour permettre nouvelle tentative
        try { localStorage.removeItem(lockKey); } catch (e) {}
        return;
      }

      purgeFromLocalStorage(u);
      // [FIX 2026-05-19] Cleanup lock + attempts apres succes terminal
      try { localStorage.removeItem(lockKey); } catch (e) {}
      try { localStorage.removeItem(attemptsKey); } catch (e) {}
      /* [FIX-PROD-2026-05-19] log retiré */
    } catch (e) {
      console.error('[Tabibi PII] migration error', e);
      // [FIX 2026-05-19] Cleanup du lock en cas d'exception
      try {
        if (typeof lockKey !== 'undefined') localStorage.removeItem(lockKey);
      } catch (e2) {}
    }
  }

  // Expose une API publique pour la lecture/ecriture cote app
  window.tabibiPII = {
    fields: PII_FIELDS,

    // Charge depuis Supabase
    load: async function () {
      var sb = window.tabibi && window.tabibi.supabase;
      if (!sb) return null;
      var r = await sb.rpc('get_patient_medical_data');
      if (r.error) {
        console.error('[Tabibi PII] load failed', r.error);
        return null;
      }
      return (r.data && r.data[0]) || null;
    },

    // Sauve dans Supabase
    save: async function (data) {
      var sb = window.tabibi && window.tabibi.supabase;
      if (!sb) return { error: 'no_client' };
      var heightInt = data.height_cm != null ? parseInt(data.height_cm, 10) : null;
      if (heightInt !== null && (isNaN(heightInt) || heightInt < 30 || heightInt > 250)) heightInt = null;
      var weightNum = data.weight_kg != null ? parseFloat(String(data.weight_kg).replace(',', '.')) : null;
      if (weightNum !== null && (isNaN(weightNum) || weightNum < 1 || weightNum > 500)) weightNum = null;

      return await sb.rpc('upsert_patient_medical_data', {
        p_blood_type:          data.blood_type || null,
        p_height_cm:           heightInt,
        p_weight_kg:           weightNum,
        p_allergies:           data.allergies || null,
        p_medical_history:     data.medical_history || null,
        p_current_medications: data.current_medications || null,
        p_family_history:      data.family_history || null,
        p_vaccinations:        data.vaccinations || null,
        p_smoker:              !!data.smoker,
        p_drinker:             !!data.drinker,
        p_insurance:           data.insurance || null,
        p_mutual:              data.mutual || null,
        p_matricule:           data.matricule || null,
        p_chifa_card:          data.chifa_card || null,
        p_emergency_name:      data.emergency_name || null,
        p_emergency_relation:  data.emergency_relation || null,
        p_emergency_phone:     data.emergency_phone || null
      });
    },

    // Purge force (utilise par la page droits RGPD apres confirmation)
    purgeLocal: function () {
      try {
        var raw = localStorage.getItem('tabibi_user');
        if (!raw) return;
        var u = JSON.parse(raw);
        purgeFromLocalStorage(u);
      } catch (e) {}
    }
  };

  // Auto-migration au load (sans bloquer le rendu)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { migrate(); });
  } else {
    setTimeout(migrate, 100);
  }
})();
