/* ====================================================================
 * Tabibi — window.tabibiDoctors API
 * Phase 16.5 refactor : remplace le while(true) full-scan de public_doctors
 * par des méthodes filtrées côté serveur (PostgREST .range() + filtres).
 *
 * Avant : loadAllDoctorsViaApi() → 80 × fetch(limit=1000) → 84 Mo par visiteur
 * Après : window.tabibiDoctors.search() → 1 fetch filtré par page
 *
 * API exposée :
 *   tabibiDoctors.search({ query, specialty_fr, wilaya_fr, page, pageSize })
 *     → { data: ConvertedDoctor[], total: number, error }
 *   tabibiDoctors.getById(uuid)
 *     → { data: ConvertedDoctor|null, error }
 *   tabibiDoctors.getByLegacyId(int)
 *     → { data: ConvertedDoctor|null, error }
 *   tabibiDoctors.count({ specialty_fr, wilaya_fr })
 *     → { count: number, error }
 *   tabibiDoctors.getByIds(uuid[])
 *     → { data: ConvertedDoctor[], error }
 *   tabibiDoctors.convertDoctor(rawRow)
 *     → ConvertedDoctor
 *
 * ConvertedDoctor = { id, fr, spec, ville, in, bg, tc, prix, note, cert, ... }
 *   (format compatible avec les vues existantes patient-dashboard / appointment)
 *
 * window.DOCTORS = [] conservé (tableau vide) pour éviter crashes sur les pages
 * qui testent `typeof DOCTORS !== 'undefined'`.
 * ==================================================================== */
(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  function _sb() {
    return global.tabibi && global.tabibi.supabase;
  }

  // Convertit une ligne brute public_doctors en ConvertedDoctor.
  // Compatible avec le format attendu par appointment.html, patient-dashboard.html, etc.
  function convertDoctor(doc) {
    var DN = global.tabibiDoctorName;
    var initials = DN
      ? DN.initials(doc)
      : ((doc.full_name || '').split(' ').map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase() || 'MD');
    return {
      id:         String(doc.id || ''),
      entityType: doc.entity_type || null,
      rawName:    doc.full_name || '',
      fr:         DN ? DN.formatForLang(doc, 'fr') : (doc.full_name || 'Médecin'),
      ar:         DN ? DN.formatForLang(doc, 'ar') : (doc.full_name_ar || doc.full_name || ''),
      en:         DN ? DN.formatForLang(doc, 'en') : (doc.full_name || 'Doctor'),
      spec:       doc.specialty_fr || 'Généraliste',
      sAr:        doc.specialty_ar || doc.specialty_fr || '',
      sEn:        doc.specialty_en || doc.specialty_fr || '',
      ville:      doc.wilaya_fr || 'Algérie',
      vAr:        doc.wilaya_ar || doc.wilaya_fr || '',
      vEn:        doc.wilaya_en || doc.wilaya_fr || '',
      note:       Number(doc.rating) || 4.5,
      prix:       Number(doc.consultation_fee_dzd) || 1500,
      urgent:     false,
      cert:       !!(doc.is_verified),
      in:         initials,
      bg:         '#E0F2FE',
      tc:         '#0066CC',
      g:          'H',
      avis:       Number(doc.review_count) || 0,
      langs:      ['FR', 'AR'],
      desc:       'Médecin certifié en Algérie. Profil vérifié.',
      addr:       doc.address || doc.wilaya_fr || 'Algérie',
      diplomes:   ['Doctorat en Médecine'],
      // champs bruts utiles pour la fiche médecin
      legacy_id:  doc.legacy_id || null,
      _isClaimed: !!(doc.user_id)
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mapping spécialité UI → DB via _DB_SPECIALTIES (optionnel)
  // "Cardiologie" → "Cardiologue", "Dermatologie" → "Dermatologue", etc.
  // Retourne null si _DB_SPECIALTIES non disponible → l'appelant utilise ilike.
  // ──────────────────────────────────────────────────────────────────────
  function _mapSpec(uiName) {
    if (!uiName) return null;
    var list = global._DB_SPECIALTIES;
    if (!Array.isArray(list) || !list.length) return null;
    var norm = function (s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    };
    var target = norm(uiName);
    // 1. Exact
    for (var i = 0; i < list.length; i++) { if (norm(list[i]) === target) return list[i]; }
    // 2. Prefix 7 chars
    if (target.length >= 5) {
      var prefix = target.substring(0, Math.min(7, target.length - 2));
      for (var j = 0; j < list.length; j++) { if (norm(list[j]).startsWith(prefix)) return list[j]; }
    }
    // 3. Premier mot
    var firstWord = target.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 5) {
      var fp = firstWord.substring(0, Math.min(7, firstWord.length - 1));
      for (var k = 0; k < list.length; k++) { if (norm(list[k]).startsWith(fp)) return list[k]; }
    }
    return null; // inconnu → appelant fait ilike fallback
  }

  // ──────────────────────────────────────────────────────────────────────
  // search — UNE requête filtrée, paginée
  // opts: { query, specialty_fr, wilaya_fr, page=1, pageSize=20 }
  // Retourne { data: ConvertedDoctor[], total: number, error: string|null }
  // ──────────────────────────────────────────────────────────────────────
  async function search(opts) {
    var sb = _sb();
    if (!sb) return { data: [], total: 0, error: 'no_client' };
    opts = opts || {};
    var page     = Math.max(1, parseInt(opts.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(opts.pageSize, 10) || 20));
    var offset   = (page - 1) * pageSize;

    try {
      var q = sb.from('public_doctors').select('*', { count: 'exact' });

      if (opts.wilaya_fr) {
        q = q.eq('wilaya_fr', opts.wilaya_fr);
      }

      if (opts.specialty_fr) {
        var mapped = _mapSpec(opts.specialty_fr);
        if (mapped) {
          q = q.eq('specialty_fr', mapped);
        } else {
          // Fallback ilike sur les 7 premiers chars normalisés
          var specPart = opts.specialty_fr.substring(0, Math.min(7, opts.specialty_fr.length));
          q = q.ilike('specialty_fr', '%' + specPart + '%');
        }
      }

      if (opts.query) {
        // Échapper les wildcards PostgREST
        var safe = String(opts.query).replace(/[%_]/g, '\\$&').trim();
        if (safe) {
          q = q.or(
            'full_name.ilike.%' + safe + '%,' +
            'specialty_fr.ilike.%' + safe + '%,' +
            'wilaya_fr.ilike.%' + safe + '%'
          );
        }
      }

      q = q.order('full_name').range(offset, offset + pageSize - 1);

      var res = await q;
      if (res.error) return { data: [], total: 0, error: res.error.message || 'query_error' };
      return {
        data:  (res.data || []).map(convertDoctor),
        total: res.count || 0,
        error: null
      };
    } catch (e) {
      console.warn('[tabibiDoctors] search error', e && e.message);
      return { data: [], total: 0, error: (e && e.message) || 'unknown' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // getById — récupère 1 médecin par UUID
  // ──────────────────────────────────────────────────────────────────────
  async function getById(id) {
    var sb = _sb();
    if (!sb || !id) return { data: null, error: 'invalid_id' };
    try {
      var res = await sb.from('public_doctors').select('*').eq('id', String(id)).maybeSingle();
      if (res.error) return { data: null, error: res.error.message };
      return { data: res.data ? convertDoctor(res.data) : null, error: null };
    } catch (e) {
      return { data: null, error: (e && e.message) || 'unknown' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // getByLegacyId — récupère 1 médecin par legacy_id (int)
  // ──────────────────────────────────────────────────────────────────────
  async function getByLegacyId(legacyId) {
    var sb = _sb();
    var n = parseInt(legacyId, 10);
    if (!sb || !n || isNaN(n)) return { data: null, error: 'invalid_legacy_id' };
    try {
      var res = await sb.from('public_doctors').select('*').eq('legacy_id', n).maybeSingle();
      if (res.error) return { data: null, error: res.error.message };
      return { data: res.data ? convertDoctor(res.data) : null, error: null };
    } catch (e) {
      return { data: null, error: (e && e.message) || 'unknown' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // count — count() avec filtres, 0 donnée transférée (head: true)
  // opts: { specialty_fr, wilaya_fr }
  // ──────────────────────────────────────────────────────────────────────
  async function count(opts) {
    var sb = _sb();
    if (!sb) return { count: 0, error: 'no_client' };
    opts = opts || {};
    try {
      var q = sb.from('public_doctors').select('*', { count: 'exact', head: true });
      if (opts.wilaya_fr) q = q.eq('wilaya_fr', opts.wilaya_fr);
      if (opts.specialty_fr) {
        var mapped = _mapSpec(opts.specialty_fr);
        if (mapped) {
          q = q.eq('specialty_fr', mapped);
        } else {
          var specPart = opts.specialty_fr.substring(0, Math.min(7, opts.specialty_fr.length));
          q = q.ilike('specialty_fr', '%' + specPart + '%');
        }
      }
      var res = await q;
      if (res.error) return { count: 0, error: res.error.message };
      return { count: res.count || 0, error: null };
    } catch (e) {
      return { count: 0, error: (e && e.message) || 'unknown' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // getByIds — batch fetch par UUIDs (max 100)
  // ──────────────────────────────────────────────────────────────────────
  async function getByIds(ids) {
    var sb = _sb();
    if (!sb || !Array.isArray(ids) || !ids.length) return { data: [], error: null };
    var safeIds = ids.map(String).filter(Boolean).slice(0, 100);
    if (!safeIds.length) return { data: [], error: null };
    try {
      var res = await sb.from('public_doctors').select('*').in('id', safeIds);
      if (res.error) return { data: [], error: res.error.message };
      return { data: (res.data || []).map(convertDoctor), error: null };
    } catch (e) {
      return { data: [], error: (e && e.message) || 'unknown' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // API publique
  // ──────────────────────────────────────────────────────────────────────
  global.tabibiDoctors = {
    search:         search,
    getById:        getById,
    getByLegacyId:  getByLegacyId,
    count:          count,
    getByIds:       getByIds,
    convertDoctor:  convertDoctor
  };

  // Compatibilité — garder DOCTORS[] vide pour éviter les crashes
  // sur les pages qui testent `typeof DOCTORS !== 'undefined'`
  if (!Array.isArray(global.DOCTORS)) global.DOCTORS = [];

})(window);
