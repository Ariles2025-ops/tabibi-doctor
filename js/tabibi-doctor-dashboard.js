/* ====================================================================
 * Tabibi — tabibiDoctor (helpers RPC + photo + schedule)
 * --------------------------------------------------------------------
 * Phase 4.B.2 (PROGRESS.md) — 2026-05-21
 *
 * Helpers PARTAGÉS entre `medecin-profile.html` et `doctor-dashboard.html`
 * (Phase 4.B.3 utilisera cette API pour le CRUD doctor_unavailable_slots).
 *
 * Origine : extrait du namespace inline IIFE de `medecin-profile.html`
 * créé en Phase 4.B.1. Comportement strictement identique, seule la
 * localisation change → testable indépendamment, réutilisable.
 *
 * Dépend de : window.tabibi.supabase (js/supabase-client.js)
 *             → ce script DOIT être inclus APRÈS supabase-client.js
 *
 * API publique exposée (window.tabibiDoctor) :
 *   • DAYS_FR / DAYS_EN  — constantes pour la sérialisation horaires
 *   • hasSession()       — true si session Supabase active
 *   • getMyProfile()     — RPC get_my_doctor_profile (null si pas claim)
 *   • updateMyProfile(p) — RPC update_my_doctor_profile (5 codes erreur)
 *   • serializeSchedule(uiSched) — UI Lundi/Mardi tuple → DB mon/tue array
 *   • parseSchedule(dbSched)     — inverse, DB → UI
 *   • uploadPhoto(file, oldUrl)  — pipeline commit-then-purge complet
 *   • extractStoragePath(url)    — helper parser URL bucket
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op (préserve les refs
 * existantes pour ne pas casser les handlers déjà attachés).
 * ==================================================================== */
(function () {
  'use strict';

  // Idempotence : si déjà chargé, ne rien faire
  if (window.tabibiDoctor && typeof window.tabibiDoctor.getMyProfile === 'function') {
    return;
  }

  var DAYS_FR = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
  var DAYS_EN = ["mon","tue","wed","thu","fri","sat","sun"];
  // Index : Lundi -> 0 -> "mon", etc.
  function frToEn(d) { return DAYS_EN[DAYS_FR.indexOf(d)] || null; }
  function enToFr(d) { return DAYS_FR[DAYS_EN.indexOf(d)] || null; }

  function sb() { return (window.tabibi && window.tabibi.supabase) || null; }

  // [Phase 4.B.3-fix3] Wrap toute promise avec un timeout (Promise.race).
  // Si la promise ne resolve/reject pas en `ms` millisecondes, on rejette
  // avec une Error('timeout:<label>'). Indispensable car un await Supabase
  // peut rester pending indéfiniment si le token est expiré silencieusement,
  // si CORS Safari muet, ou si le réseau coupe sans envoyer FIN.
  function _withTimeout(promise, ms, label) {
    var timer;
    var t = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error('timeout:' + (label || 'unknown')));
      }, ms);
    });
    return Promise.race([promise, t]).finally(function () { clearTimeout(timer); });
  }

  // hasSession() : true si une session Supabase active existe
  async function hasSession() {
    var s = sb(); if (!s) return false;
    try {
      var r = await s.auth.getSession();
      return !!(r && r.data && r.data.session);
    } catch (e) { return false; }
  }

  // get_my_doctor_profile() : retourne le row doctor_profiles du connecté
  // Convention : null si pas auth OU si pas de fiche réclamée.
  // [Phase 4.B.3-fix3] Timeout 5s pour éviter pending infini (session expirée).
  async function getMyProfile() {
    var s = sb(); if (!s) return null;
    try {
      var r = await _withTimeout(s.rpc('get_my_doctor_profile'), 5000, 'get_my_doctor_profile');
      if (r.error) { console.warn('[tabibiDoctor] get_my_doctor_profile', r.error); return null; }
      // [Phase 4.B.2-hotfix] PostgREST peut retourner null (cas idéal) OU un row
      // composite tout-NULL selon version/config quand RETURNS row_type ne match
      // aucune ligne. id étant PK NOT NULL dans doctor_profiles, son absence
      // signale forcément "pas de row" — on normalise sur null pour l'appelant
      // (sinon showNotClaimedBanner ne se déclenche jamais).
      if (!r.data || !r.data.id) return null;
      return r.data;
    } catch (e) {
      console.warn('[tabibiDoctor] getMyProfile exception/timeout', e && e.message);
      return null;
    }
  }

  // update_my_doctor_profile() : update partiel sécurisé
  // Renvoie { ok, data?, error? } avec error string parmi : not_authenticated,
  // invalid_fee, bio_too_long, working_hours_not_object, profile_not_found_or_not_claimed
  async function updateMyProfile(params) {
    var s = sb(); if (!s) return { ok: false, error: 'no_supabase_client' };
    try {
      var r = await s.rpc('update_my_doctor_profile', params);
      if (r.error) {
        var code = (r.error.message || '').replace(/^.*?:\s*/, ''); // strip pgcode prefix éventuel
        return { ok: false, error: code || 'rpc_error', raw: r.error };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      return { ok: false, error: 'network_error', raw: e };
    }
  }

  // ─── Sérialiseur / parser working_hours ─────────────────────────────
  //
  // UI legacy (localStorage) :
  //   { "Lundi": ["09:00","17:00",true], ..., "Dimanche":["","",false] }
  //   = tuple [start, end, enabled] mono-créneau
  //
  // DB JSONB (Phase 4 docs SQL) :
  //   { "mon":[{"open":"09:00","close":"17:00"}], ..., "sun":[] }
  //   = array d'objets multi-créneaux. Vide = jour fermé.
  // Format documenté en base via COMMENT ON COLUMN (Phase 4.B.1).

  function serializeSchedule(uiSched) {
    var out = {};
    DAYS_EN.forEach(function (en) { out[en] = []; });
    if (!uiSched || typeof uiSched !== 'object') return out;
    DAYS_FR.forEach(function (fr, i) {
      var slot = uiSched[fr];
      if (!Array.isArray(slot)) return;
      var start = slot[0], end = slot[1], enabled = slot[2];
      // règle : enabled true + horaires présents et valides + close > open
      if (enabled && start && end && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && end > start) {
        out[DAYS_EN[i]] = [{ open: start, close: end }];
      } else {
        out[DAYS_EN[i]] = [];
      }
    });
    return out;
  }

  function parseSchedule(dbSched) {
    var out = {};
    DAYS_FR.forEach(function (fr) { out[fr] = ["09:00", "17:00", false]; });
    if (!dbSched || typeof dbSched !== 'object') return out;
    DAYS_EN.forEach(function (en, i) {
      var fr = DAYS_FR[i];
      var arr = dbSched[en];
      if (Array.isArray(arr) && arr.length > 0 && arr[0].open && arr[0].close) {
        // V1 : on prend le 1er créneau, l'UI mono-créneau actuelle ne supporte pas le split.
        // [TODO Phase 4.B.3] UI multi-créneaux pause midi
        out[fr] = [arr[0].open, arr[0].close, true];
      } else {
        out[fr] = ["09:00", "17:00", false];
      }
    });
    return out;
  }

  // ─── Photo upload (commit-then-purge) ────────────────────────────────
  // Returns { ok, publicUrl?, error? }
  async function uploadPhoto(file, currentPhotoUrl) {
    var s = sb(); if (!s) return { ok: false, error: 'no_supabase_client' };
    if (!file) return { ok: false, error: 'no_file' };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'file_too_large' };
    if (['image/jpeg','image/png','image/webp'].indexOf(file.type) === -1) {
      return { ok: false, error: 'invalid_mime' };
    }
    try {
      var u = await s.auth.getUser();
      var user = u && u.data && u.data.user;
      if (!user) return { ok: false, error: 'not_authenticated' };

      var ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      var newPath = user.id + '/photo-' + Date.now() + '.' + ext;

      // 1. Upload nouveau (upsert=false : si conflit improbable, on échoue propre)
      var up = await s.storage.from('doctor-photos').upload(newPath, file, { upsert: false, contentType: file.type });
      if (up.error) return { ok: false, error: 'upload_failed', raw: up.error };

      // 2. Récupère URL publique + update RPC
      var pub = s.storage.from('doctor-photos').getPublicUrl(newPath);
      var publicUrl = pub && pub.data && pub.data.publicUrl;
      if (!publicUrl) {
        await s.storage.from('doctor-photos').remove([newPath]);
        return { ok: false, error: 'no_public_url' };
      }
      var rpc = await updateMyProfile({ p_photo_url: publicUrl });
      if (!rpc.ok) {
        // Rollback : nouveau fichier orphan, ancien intact
        await s.storage.from('doctor-photos').remove([newPath]);
        return { ok: false, error: rpc.error };
      }

      // 3. Succès → purge ancien (best-effort, n'invalide pas le succès)
      // [TODO Phase 12] Cron purge des orphans si suppression échoue silencieusement
      var oldPath = extractStoragePath(currentPhotoUrl);
      if (oldPath && oldPath !== newPath) {
        s.storage.from('doctor-photos').remove([oldPath]).catch(function () {});
      }
      return { ok: true, publicUrl: publicUrl, newPath: newPath };
    } catch (e) {
      console.warn('[tabibiDoctor] uploadPhoto exception', e);
      return { ok: false, error: 'network_error', raw: e };
    }
  }

  function extractStoragePath(publicUrl) {
    var m = String(publicUrl || '').match(/\/doctor-photos\/(.+)$/);
    return m ? m[1] : null;
  }

  // ─── [Phase 4.B.3] CRUD doctor_unavailable_slots ────────────────────
  // Les 4 RLS Phase 4.A scopent automatiquement par doctor_profiles.user_id
  // = auth.uid() pour insert/update/delete (et SELECT public pour lecture).
  // On ne fait jamais d'erreur SQL crue côté UI : on retourne toujours
  // { ok, data?, error? } avec error string lisible.

  // Cache interne du doctor_id du médecin connecté (évite n appels getMyProfile)
  // [Phase 4.B.3-fix1] Param forceRefresh pour bypasser le cache après mutations
  // ou en cas de session restaurée tardivement.
  var _cachedDoctorId = null;
  async function getMyDoctorId(forceRefresh) {
    if (!forceRefresh && _cachedDoctorId) return _cachedDoctorId;
    var p = await getMyProfile();
    _cachedDoctorId = (p && p.id) || null;
    return _cachedDoctorId;
  }
  function invalidateDoctorIdCache() { _cachedDoctorId = null; }

  // listUnavailableSlots() : renvoie [{id, doctor_id, starts_at, ends_at, reason, all_day}, ...]
  // Retourne [] si pas authentifié OU pas de fiche réclamée OU erreur réseau.
  // [Phase 4.B.3-fix3] Timeout 8s pour éviter pending infini.
  async function listUnavailableSlots() {
    var s = sb(); if (!s) return [];
    try {
      var docId = await getMyDoctorId();
      if (!docId) return [];
      var query = s.from('doctor_unavailable_slots')
        .select('id, doctor_id, starts_at, ends_at, reason, all_day, created_at')
        .eq('doctor_id', docId)
        .order('starts_at', { ascending: true });
      var r = await _withTimeout(query, 8000, 'list_unavailable_slots');
      if (r.error) { console.warn('[tabibiDoctor] list slots', r.error); return []; }
      return r.data || [];
    } catch (e) {
      console.warn('[tabibiDoctor] listUnavailableSlots exception/timeout', e && e.message);
      return [];
    }
  }

  // addUnavailableSlot(startsAt, endsAt, reason, allDay)
  // startsAt/endsAt : ISO strings ou Date objects. La RLS dus_insert_owner
  // exige que doctor_id matche une fiche dont user_id = auth.uid().
  // [Phase 4.B.3-fix1] Logs console explicites + garde res.data null
  async function addUnavailableSlot(startsAt, endsAt, reason, allDay) {
    var s = sb(); if (!s) { console.warn('[tabibiDoctor] addUnavailableSlot: no supabase client'); return { ok: false, error: 'no_supabase_client' }; }
    try {
      // Force refresh du cache : la session peut avoir été restaurée APRÈS le 1er load
      var docId = await getMyDoctorId(true);
      if (!docId) {
        console.warn('[tabibiDoctor] addUnavailableSlot: no docId (fiche non réclamée pour ce user)');
        return { ok: false, error: 'profile_not_found_or_not_claimed' };
      }
      // [Phase 4.B.3-fix2] Comparer DIRECTEMENT les Date (millisecondes UTC
      // internes), sans repasser par toISOString + new Date qui peut
      // ré-introduire de l'ambiguïté. La validation chronologique côté
      // frontend (saveUnavailSlot) reste la source de vérité ; ce check
      // n'est qu'un garde-fou si le helper est appelé hors du flow UI.
      var startMs = (startsAt instanceof Date) ? startsAt.getTime() : new Date(startsAt).getTime();
      var endMs   = (endsAt   instanceof Date) ? endsAt.getTime()   : new Date(endsAt).getTime();
      if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
        return { ok: false, error: 'invalid_range_end_before_start' };
      }
      var startIso = new Date(startMs).toISOString();
      var endIso   = new Date(endMs).toISOString();
      var payload = {
        doctor_id: docId,
        starts_at: startIso,
        ends_at:   endIso,
        reason:    reason || null,
        all_day:   !!allDay
      };
      console.info('[tabibiDoctor] INSERT doctor_unavailable_slots payload=', payload);
      // [Phase 4.B.3-fix3] Timeout 10s pour éviter pending infini sur INSERT.
      var insertQuery = s.from('doctor_unavailable_slots').insert(payload).select().single();
      var r = await _withTimeout(insertQuery, 10000, 'insert_unavailable_slot');
      console.info('[tabibiDoctor] INSERT response : data=', r.data, ' error=', r.error);
      if (r.error) {
        var code = r.error.code || '';
        // 42501 = RLS violation, 23514 = CHECK violation (chrono), 23503 = FK violation
        var hint = code === '42501' ? 'rls_denied'
                 : code === '23514' ? 'check_violation_chrono'
                 : code === '23503' ? 'doctor_not_found'
                 : (r.error.message || 'insert_failed');
        console.warn('[tabibiDoctor] addUnavailableSlot ERROR', code, r.error);
        return { ok: false, error: hint, raw: r.error };
      }
      // [Phase 4.B.3-fix1] Garde explicite : si pas d'erreur mais data null/undefined,
      // c'est qu'on n'a RIEN inséré (edge case PostgREST). On le signale au lieu de
      // retourner ok:true silencieusement.
      if (!r.data || !r.data.id) {
        console.warn("[tabibiDoctor] addUnavailableSlot SILENT FAILURE : pas d'erreur mais aucune data retournée");
        return { ok: false, error: 'insert_returned_no_data', raw: r };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      console.warn('[tabibiDoctor] addUnavailableSlot EXCEPTION', e);
      // [Phase 4.B.3-fix3] Distingue timeout réseau d'autres erreurs réseau
      var isTimeout = e && /^timeout:/.test(String(e.message || ''));
      return { ok: false, error: isTimeout ? 'timeout' : 'network_error', raw: e };
    }
  }

  // deleteUnavailableSlot(id) : RLS dus_delete_owner protège implicitement
  // [Phase 4.B.3-fix3] Timeout 8s pour éviter pending infini.
  async function deleteUnavailableSlot(id) {
    var s = sb(); if (!s) return { ok: false, error: 'no_supabase_client' };
    if (!id) return { ok: false, error: 'no_id' };
    try {
      console.info('[tabibiDoctor] DELETE doctor_unavailable_slots id=', id);
      var deleteQuery = s.from('doctor_unavailable_slots').delete().eq('id', id);
      var r = await _withTimeout(deleteQuery, 8000, 'delete_unavailable_slot');
      console.info('[tabibiDoctor] DELETE response : error=', r.error);
      if (r.error) {
        var code = r.error.code || '';
        var hint = code === '42501' ? 'rls_denied' : (r.error.message || 'delete_failed');
        console.warn('[tabibiDoctor] deleteUnavailableSlot ERROR', code, r.error);
        return { ok: false, error: hint, raw: r.error };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[tabibiDoctor] deleteUnavailableSlot EXCEPTION', e);
      var isTimeout = e && /^timeout:/.test(String(e.message || ''));
      return { ok: false, error: isTimeout ? 'timeout' : 'network_error', raw: e };
    }
  }

  window.tabibiDoctor = window.tabibiDoctor || {
    DAYS_FR: DAYS_FR, DAYS_EN: DAYS_EN,
    hasSession: hasSession,
    getMyProfile: getMyProfile,
    getMyDoctorId: getMyDoctorId,
    invalidateDoctorIdCache: invalidateDoctorIdCache,
    updateMyProfile: updateMyProfile,
    serializeSchedule: serializeSchedule,
    parseSchedule: parseSchedule,
    uploadPhoto: uploadPhoto,
    extractStoragePath: extractStoragePath,
    // [Phase 4.B.3] CRUD blocages exceptionnels
    listUnavailableSlots: listUnavailableSlots,
    addUnavailableSlot: addUnavailableSlot,
    deleteUnavailableSlot: deleteUnavailableSlot,
  };
})();
