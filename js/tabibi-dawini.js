/* ====================================================================
 * Tabibi — tabibiDawini (localisation de médicaments « Dawini »)
 * --------------------------------------------------------------------
 * [DAWINI 2026-07-08] Étape 1.
 *
 * Helpers PARTAGÉS pour la fonctionnalité Dawini (patient + pharmacie).
 * Utilisé par : dawini.html (patient), dawini-pharmacie.html (pharmacie).
 *
 * Dépend de :
 *   - window.tabibi.supabase (js/supabase-client.js)
 *   - window.TABIBI_FEATURES.dawini (js/tabibi-features.js)
 *   - window.TABIBI_CONFIG.DAWINI_NAME (js/config.js) — nom de la
 *     fonctionnalité, modifiable en UN SEUL endroit.
 *   - migrations/DAWINI_step1_schema.sql (tables, RLS, RPC)
 *   - assets/dz-wilaya-centroids.js (repli wilaya quand pas de GPS)
 *
 * Décisions produit (review fondateur 2026-07-08) :
 *   - Pas de Realtime : les pages utilisent startPolling() (20 s).
 *   - Coordonnées patient : via RPC dawini_get_patient_contact,
 *     UNIQUEMENT après réponse « accepted » (loi 18-07, minimisation).
 *   - Ciblage v1 : wilaya + tri distance GPS (haversine côté client).
 *
 * Pattern anti-régression Phase 4.B.3-fix3 (identique à tabibiBooking) :
 *   - _withTimeout(promise, ms, label) via Promise.race
 *   - try/catch retournant TOUJOURS {ok, data?, error?, raw?}
 *   - Codes erreur typés ERR_*
 *
 * API publique (window.tabibiDawini) :
 *   Patient :
 *   • uploadOrdonnance(file)                → {ok, data: path}
 *   • createRequest({medicaments[], wilayaCode, imagePath?, note?, lat?, lng?})
 *   • listMyRequests()                      → demandes + réponses hydratées
 *   • closeRequest(requestId)
 *   Pharmacie :
 *   • myPharmacy()                          → fiche pharmacie du compte (ou null)
 *   • listZoneRequests()                    → demandes de la wilaya (avec ma réponse éventuelle)
 *   • getImageUrl(imagePath)                → URL signée (60 min)
 *   • respond({requestId, accepted, disponible, generique, medsDispo?, commentaire?})
 *   • getPatientContact(requestId)          → {nom, tel} si acceptée
 *   • stats()                               → {zone_total, mine_accepted, mine_refused}
 *   Commun :
 *   • expireOld() · distanceKm(lat1,lng1,lat2,lng2) · startPolling(fn, ms)
 *   • featureName() · errorMessage(code) · CODES
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';

  if (window.tabibiDawini && typeof window.tabibiDawini.createRequest === 'function') {
    return;
  }

  var POLL_MS_DEFAULT = 20000;  // décision fondateur : polling 20 s, pas de Realtime (v1)

  // ───────────────────────────────────────────────────────────────────
  // Codes erreur + messages FR (fallback si i18n indisponible)
  // ───────────────────────────────────────────────────────────────────
  var CODES = Object.freeze({
    ERR_AUTH_REQUIRED:   'ERR_AUTH_REQUIRED',
    ERR_FEATURE_OFF:     'ERR_FEATURE_OFF',
    ERR_INVALID_INPUT:   'ERR_INVALID_INPUT',
    ERR_ZONE_INACTIVE:   'ERR_ZONE_INACTIVE',
    ERR_NOT_PHARMACY:    'ERR_NOT_PHARMACY',
    ERR_ALREADY_ANSWERED:'ERR_ALREADY_ANSWERED',
    ERR_NOT_ACCEPTED:    'ERR_NOT_ACCEPTED',
    ERR_UPLOAD:          'ERR_UPLOAD',
    ERR_NOT_FOUND:       'ERR_NOT_FOUND',
    ERR_RLS_DENIED:      'ERR_RLS_DENIED',
    ERR_NETWORK:         'ERR_NETWORK',
    ERR_TIMEOUT:         'ERR_TIMEOUT',
    ERR_UNKNOWN:         'ERR_UNKNOWN'
  });

  var ERR_MSG_FR = {
    ERR_AUTH_REQUIRED:    "Connexion requise pour utiliser " + featureName() + ".",
    ERR_FEATURE_OFF:      featureName() + " n'est pas encore disponible.",
    ERR_INVALID_INPUT:    "Vérifiez le médicament et la wilaya.",
    ERR_ZONE_INACTIVE:    featureName() + " n'est pas encore ouvert dans cette wilaya.",
    ERR_NOT_PHARMACY:     "Ce compte n'est pas une pharmacie partenaire.",
    ERR_ALREADY_ANSWERED: "Vous avez déjà répondu à cette demande.",
    ERR_NOT_ACCEPTED:     "Coordonnées visibles après acceptation uniquement.",
    ERR_UPLOAD:           "Échec de l'envoi de la photo. Réessayez.",
    ERR_NOT_FOUND:        "Demande introuvable ou expirée.",
    ERR_RLS_DENIED:       "Action non autorisée.",
    ERR_NETWORK:          "Erreur réseau. Vérifiez votre connexion.",
    ERR_TIMEOUT:          "Délai dépassé. Réessayez dans un instant.",
    ERR_UNKNOWN:          "Erreur inattendue. Détails dans la console (F12)."
  };

  function featureName() {
    return (window.TABIBI_CONFIG && window.TABIBI_CONFIG.DAWINI_NAME) || 'Dawini';
  }

  function errorMessage(code) {
    // [CONFORMITE i18n] clés dw_err_* du dico partagé, fallback FR local.
    var key = 'dw_' + String(code || '').toLowerCase();
    if (typeof window.tabibiT === 'function') {
      var tr = window.tabibiT(key, '');
      if (tr && tr !== key) return tr;
    }
    return ERR_MSG_FR[code] || ERR_MSG_FR.ERR_UNKNOWN;
  }

  // ───────────────────────────────────────────────────────────────────
  // Helpers privés (pattern tabibiBooking)
  // ───────────────────────────────────────────────────────────────────
  function sb() {
    return (window.tabibi && window.tabibi.supabase) || null;
  }

  function _withTimeout(promise, ms, label) {
    var t;
    var timeout = new Promise(function (_, reject) {
      t = setTimeout(function () {
        var e = new Error('timeout:' + label);
        e.isTimeout = true;
        reject(e);
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(function () { clearTimeout(t); });
  }

  function _mapPostgrestError(err) {
    var msg = (err && (err.message || '')) + ' ' + (err && (err.details || ''));
    if (/zone_inactive/i.test(msg))        return CODES.ERR_ZONE_INACTIVE;
    if (/not_a_pharmacy/i.test(msg))       return CODES.ERR_NOT_PHARMACY;
    if (/not_accepted/i.test(msg))         return CODES.ERR_NOT_ACCEPTED;
    if (/request_unavailable/i.test(msg))  return CODES.ERR_NOT_FOUND;
    if (/medicaments_required|invalid_status/i.test(msg)) return CODES.ERR_INVALID_INPUT;
    if (/auth_required/i.test(msg))        return CODES.ERR_AUTH_REQUIRED;
    if (err && err.code === '23505')       return CODES.ERR_ALREADY_ANSWERED;
    if (err && err.code === '42501')       return CODES.ERR_RLS_DENIED;
    if (err && err.code === 'PGRST116')    return CODES.ERR_NOT_FOUND;
    return CODES.ERR_UNKNOWN;
  }

  function _mapTimeoutOrNetwork(e) {
    if (e && e.isTimeout) return CODES.ERR_TIMEOUT;
    if (e && /fetch|network/i.test(e.message || '')) return CODES.ERR_NETWORK;
    return CODES.ERR_UNKNOWN;
  }

  async function _requireSession() {
    var s = sb();
    if (!s) return { session: null, error: CODES.ERR_UNKNOWN };
    try {
      var r = await _withTimeout(s.auth.getSession(), 5000, 'get_session');
      if (!r.data || !r.data.session) return { session: null, error: CODES.ERR_AUTH_REQUIRED };
      return { session: r.data.session, error: null };
    } catch (e) {
      return { session: null, error: _mapTimeoutOrNetwork(e) };
    }
  }

  // Haversine — tri distance côté client (v1, volumes faibles par wilaya).
  function distanceKm(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some(function (v) { return v == null || isNaN(v); })) return null;
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad)
          * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  // Polling générique : exécute fn tout de suite puis toutes les ms.
  // Retourne un handle {stop}. En pause quand l'onglet est masqué.
  function startPolling(fn, ms) {
    var interval = ms || POLL_MS_DEFAULT;
    var stopped = false;
    var timer = null;
    async function tick() {
      if (stopped) return;
      if (!document.hidden) {
        try { await fn(); } catch (e) { console.warn('[tabibiDawini] poll error', e && e.message); }
      }
      timer = setTimeout(tick, interval);
    }
    tick();
    return { stop: function () { stopped = true; clearTimeout(timer); } };
  }

  // ───────────────────────────────────────────────────────────────────
  // PATIENT
  // ───────────────────────────────────────────────────────────────────

  // Upload photo ordonnance/boîte → bucket privé dawini-ordonnances.
  // Chemin imposé par la policy storage : {uid}/{timestamp}.{ext}
  async function uploadOrdonnance(file) {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    var sess = await _requireSession();
    if (sess.error) return { ok: false, error: sess.error };
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    var ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    var path = sess.session.user.id + '/' + Date.now() + '.' + ext;
    try {
      var r = await _withTimeout(
        s.storage.from('dawini-ordonnances').upload(path, file, { contentType: file.type, upsert: false }),
        20000, 'upload_ordonnance'
      );
      if (r.error) {
        console.warn('[tabibiDawini] upload error', r.error.message);
        return { ok: false, error: CODES.ERR_UPLOAD, raw: r.error };
      }
      return { ok: true, data: path };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // Création d'une demande — RPC SECURITY DEFINER (consent_at posé côté
  // serveur, notifications pharmacies atomiques, PAS de RETURNING front).
  async function createRequest(opts) {
    opts = opts || {};
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    if (!window.TABIBI_FEATURES || !window.TABIBI_FEATURES.dawini) {
      return { ok: false, error: CODES.ERR_FEATURE_OFF };
    }
    var meds = (opts.medicaments || []).map(function (m) { return String(m).trim(); }).filter(Boolean);
    var wilaya = parseInt(opts.wilayaCode, 10);
    if (!meds.length || meds.length > 10 || isNaN(wilaya) || wilaya < 1 || wilaya > 58) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    try {
      var r = await _withTimeout(
        s.rpc('dawini_create_request', {
          p_medicaments: meds,
          p_wilaya:      wilaya,
          p_image_path:  opts.imagePath || null,
          p_note:        opts.note || null,
          p_lat:         (opts.lat != null) ? opts.lat : null,
          p_lng:         (opts.lng != null) ? opts.lng : null
        }),
        10000, 'dawini_create_request'
      );
      if (r.error) {
        console.warn('[tabibiDawini] createRequest error', r.error.code, r.error.message);
        return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      }
      return { ok: true, data: r.data };  // uuid de la demande
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // Mes demandes + réponses + fiches pharmacies (2 requêtes, jointure client).
  async function listMyRequests() {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN, data: [] };
    var sess = await _requireSession();
    if (sess.error) return { ok: false, error: sess.error, data: [] };
    try {
      var rq = await _withTimeout(
        s.from('dawini_requests').select('*')
         .eq('patient_id', sess.session.user.id)
         .order('created_at', { ascending: false })
         .limit(20),
        8000, 'dawini_list_requests'
      );
      if (rq.error) return { ok: false, error: _mapPostgrestError(rq.error), data: [], raw: rq.error };
      var reqs = rq.data || [];
      if (!reqs.length) return { ok: true, data: [] };

      var ids = reqs.map(function (r) { return r.id; });
      var rs = await _withTimeout(
        s.from('dawini_responses').select('*').in('request_id', ids),
        8000, 'dawini_list_responses'
      );
      var responses = (rs.error ? [] : (rs.data || []));

      // Hydratation pharmacies (nom/adresse/geo/horaires/tel PRO)
      var phIds = responses.map(function (x) { return x.pharmacie_id; });
      var byPh = {};
      if (phIds.length) {
        var ph = await _withTimeout(
          s.from('pharmacies').select('id, nom, adresse, telephone, latitude, longitude, horaires').in('id', phIds),
          8000, 'dawini_list_pharmacies'
        );
        (ph.error ? [] : (ph.data || [])).forEach(function (p) { byPh[p.id] = p; });
      }
      responses.forEach(function (x) { x.pharmacie = byPh[x.pharmacie_id] || null; });
      reqs.forEach(function (r) {
        r.responses = responses.filter(function (x) { return x.request_id === r.id; });
      });
      return { ok: true, data: reqs };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), data: [], raw: e };
    }
  }

  async function closeRequest(requestId) {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    try {
      var r = await _withTimeout(
        s.from('dawini_requests').update({ status: 'closed' }).eq('id', requestId),
        8000, 'dawini_close_request'
      );
      if (r.error) return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // PHARMACIE
  // ───────────────────────────────────────────────────────────────────

  async function myPharmacy() {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN, data: null };
    var sess = await _requireSession();
    if (sess.error) return { ok: false, error: sess.error, data: null };
    try {
      var r = await _withTimeout(
        s.from('pharmacies').select('*').eq('user_id', sess.session.user.id).maybeSingle(),
        8000, 'dawini_my_pharmacy'
      );
      if (r.error) return { ok: false, error: _mapPostgrestError(r.error), data: null, raw: r.error };
      if (!r.data) return { ok: false, error: CODES.ERR_NOT_PHARMACY, data: null };
      return { ok: true, data: r.data };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), data: null, raw: e };
    }
  }

  // Demandes de MA wilaya (RLS filtre) + ma réponse éventuelle jointe.
  async function listZoneRequests() {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN, data: [] };
    try {
      var rq = await _withTimeout(
        s.from('dawini_requests').select('*')
         .in('status', ['pending', 'answered'])
         .order('created_at', { ascending: false })
         .limit(50),
        8000, 'dawini_zone_requests'
      );
      if (rq.error) return { ok: false, error: _mapPostgrestError(rq.error), data: [], raw: rq.error };
      var reqs = rq.data || [];
      if (!reqs.length) return { ok: true, data: [] };
      var rs = await _withTimeout(
        s.from('dawini_responses').select('*').in('request_id', reqs.map(function (r) { return r.id; })),
        8000, 'dawini_zone_my_responses'
      );
      var mine = (rs.error ? [] : (rs.data || []));  // RLS : ne renvoie que MES réponses ici
      reqs.forEach(function (r) {
        r.my_response = mine.find(function (x) { return x.request_id === r.id; }) || null;
      });
      return { ok: true, data: reqs };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), data: [], raw: e };
    }
  }

  // URL signée 60 min pour la photo d'ordonnance (policy storage côté DB).
  async function getImageUrl(imagePath) {
    var s = sb();
    if (!s || !imagePath) return { ok: false, error: CODES.ERR_NOT_FOUND };
    try {
      var r = await _withTimeout(
        s.storage.from('dawini-ordonnances').createSignedUrl(imagePath, 3600),
        8000, 'dawini_signed_url'
      );
      if (r.error || !r.data || !r.data.signedUrl) {
        return { ok: false, error: CODES.ERR_RLS_DENIED, raw: r.error };
      }
      return { ok: true, data: r.data.signedUrl };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // Répondre — RPC (unicité + zone re-vérifiées serveur, notif patient atomique).
  async function respond(opts) {
    opts = opts || {};
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    if (!opts.requestId) return { ok: false, error: CODES.ERR_INVALID_INPUT };
    try {
      var r = await _withTimeout(
        s.rpc('dawini_respond', {
          p_request_id:  opts.requestId,
          p_status:      opts.accepted ? 'accepted' : 'refused',
          p_disponible:  !!opts.disponible,
          p_generique:   !!opts.generique,
          p_meds_dispo:  (opts.medsDispo && opts.medsDispo.length) ? opts.medsDispo : null,
          p_commentaire: opts.commentaire || null
        }),
        10000, 'dawini_respond'
      );
      if (r.error) {
        console.warn('[tabibiDawini] respond error', r.error.code, r.error.message);
        return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // Coordonnées patient — UNIQUEMENT après acceptation (RPC 18-07).
  async function getPatientContact(requestId) {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    try {
      var r = await _withTimeout(
        s.rpc('dawini_get_patient_contact', { p_request_id: requestId }),
        8000, 'dawini_patient_contact'
      );
      if (r.error) return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (!row) return { ok: false, error: CODES.ERR_NOT_FOUND };
      return { ok: true, data: { nom: row.patient_nom, tel: row.patient_tel } };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  async function stats() {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN, data: null };
    try {
      var r = await _withTimeout(s.rpc('dawini_pharmacy_stats'), 8000, 'dawini_stats');
      if (r.error) return { ok: false, error: _mapPostgrestError(r.error), data: null, raw: r.error };
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      return { ok: true, data: row || { zone_total: 0, mine_accepted: 0, mine_refused: 0 } };
    } catch (e) {
      return { ok: false, error: _mapTimeoutOrNetwork(e), data: null, raw: e };
    }
  }

  // Fait passer les demandes périmées en 'expired'.
  //
  // [13/09/2026] CE QUE CETTE FONCTION FAISAIT, ET POURQUOI C'ÉTAIT UN MENSONGE.
  //   try { await _withTimeout(s.rpc('dawini_expire_old'), 6000, …); return { ok: true }; }
  //   catch (e) { return { ok: false }; }
  // `supabase-js` NE REJETTE PAS : sans `.throwOnError()`, son `then()` attache
  // `i.catch(…)` et convertit TOUT — refus RLS, 404, réseau coupé — en valeur
  // RÉSOLUE `{ error, data:null, status:0 }` (vérifié dans le client vendorisé
  // 2.116.0). Le `catch` ci-dessus n'était donc mort que pour MOITIÉ : il
  // attrapait bien le délai de `_withTimeout`, qui rejette vraiment, mais
  // JAMAIS un refus de la base. Un `42501 permission denied` ressortait en
  // `{ ok: true }`.
  //
  // Ça compte depuis aujourd'hui : `dawini_expire_old` a été retirée à `anon`
  // (20260913_revoke_liste_A.sql). Si ce REVOKE avait cassé le chemin
  // authentifié, CET APPEL AURAIT DIT QUE TOUT ALLAIT BIEN.
  //
  // LES DEUX APPELANTS N'EN FONT RIEN : `dawini.html:800` et
  // `dawini-pharmacie.html:366` écrivent `window.tabibiDawini.expireOld();`
  // sans `await` ni affectation. Rendre `{ ok:false }` ne serait donc VU de
  // personne — remplacer un mensonge par un silence. D'où la trace explicite
  // ci-dessous : l'échec doit laisser une marque même quand nul ne lit.
  //
  // ⚠️  ET CE N'EST PAS LE MÉCANISME D'EXPIRATION. Il n'existe aucune tâche
  // pg_cron pour Dawini (mesuré le 13/09 : `appointment-reminders` et
  // `cleanup_old_logs`, aucune ne touche `dawini_requests`). Tant que
  // 20260913_cron_dawini_expire.sql n'est pas appliquée, l'expiration ne vit
  // QUE dans cet appel — donc uniquement quand un humain ouvre la page.
  async function expireOld() {
    if (typeof window.tabibiRpc !== 'function') {
      (window.tabibiErreur || console.error)(
        new Error('tabibiRpc absent — js/tabibi-rpc.js non chargé'), 'dawini:expireOld');
      return { ok: false, erreur: 'passerelle_absente' };
    }
    var r;
    try {
      r = await _withTimeout(window.tabibiRpc('dawini_expire_old'), 6000, 'dawini_expire');
    } catch (e) {
      // Seul `_withTimeout` atteint ce catch : lui rejette pour de bon.
      (window.tabibiErreur || console.error)(e, 'dawini:expireOld:timeout');
      return { ok: false, erreur: 'timeout' };
    }
    if (!r.ok) {
      (window.tabibiErreur || console.error)(
        new Error('expiration Dawini refusée : ' + r.erreur), 'dawini:expireOld');
      return { ok: false, erreur: r.erreur };
    }
    return { ok: true, erreur: null };
  }

  // ───────────────────────────────────────────────────────────────────
  // Export public
  // ───────────────────────────────────────────────────────────────────
  window.tabibiDawini = Object.freeze({
    // patient
    uploadOrdonnance:  uploadOrdonnance,
    createRequest:     createRequest,
    listMyRequests:    listMyRequests,
    closeRequest:      closeRequest,
    // pharmacie
    myPharmacy:        myPharmacy,
    listZoneRequests:  listZoneRequests,
    getImageUrl:       getImageUrl,
    respond:           respond,
    getPatientContact: getPatientContact,
    stats:             stats,
    // commun
    expireOld:         expireOld,
    distanceKm:        distanceKm,
    startPolling:      startPolling,
    featureName:       featureName,
    errorMessage:      errorMessage,
    CODES:             CODES
  });
})();
