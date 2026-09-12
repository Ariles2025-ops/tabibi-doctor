/* ====================================================================
 * Tabibi — tabibiDawini MODE DÉMO (aperçu design sans backend)
 * --------------------------------------------------------------------
 * [DEMO DAWINI 2026-07-08] Fichier TEMPORAIRE de prévisualisation.
 * À SUPPRIMER (ou laisser : inerte sans le sésame) avant la prod.
 *
 * Activation : ouvrir dawini.html?demo=1 (ou dawini-pharmacie.html?demo=1)
 *   → pose localStorage tabibi_dawini_demo=1 + le flag features override,
 *     puis recharge. Désactivation : ?demo=0.
 *
 * Effet : remplace window.tabibiDawini par une implémentation EN MÉMOIRE
 * (state partagé via localStorage entre les 2 pages, pour dérouler le
 * parcours complet : demande patient → réception pharmacie → réponse
 * dispo/générique → contact révélé après acceptation). AUCUN appel réseau.
 * Les pages bypassent la garde session quand le mode démo est actif.
 *
 * Données factices : 3 pharmacies d'Alger (une = « ma pharmacie » côté
 * dawini-pharmacie.html), 1 demande d'exemple pré-remplie.
 * ==================================================================== */
(function () {
  'use strict';

  var KEY_ON    = 'tabibi_dawini_demo';
  var KEY_STATE = 'tabibi_dawini_demo_state';

  // ── Activation / désactivation par URL ─────────────────────────────
  var m = /[?&]demo=([01])/.exec(location.search);
  if (m) {
    if (m[1] === '1') {
      localStorage.setItem(KEY_ON, '1');
      // Flag features via l'override QA officiel (merge, sans écraser)
      var ov = {};
      try { ov = JSON.parse(localStorage.getItem('tabibi_features_override') || '{}') || {}; } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-dawini-demo.js:33'); }
      ov.dawini = true;
      localStorage.setItem('tabibi_features_override', JSON.stringify(ov));
      // features.js a déjà gelé TABIBI_FEATURES pour CE chargement → reload
      if (!window.TABIBI_FEATURES || !window.TABIBI_FEATURES.dawini) {
        location.replace(location.pathname);  // repart propre, override actif
        return;
      }
    } else {
      localStorage.removeItem(KEY_ON);
      localStorage.removeItem(KEY_STATE);
    }
  }

  if (localStorage.getItem(KEY_ON) !== '1') return;  // inerte hors démo

  console.info('[tabibiDawini] MODE DÉMO actif — aucune donnée réelle, aucun appel réseau.');
  window.TABIBI_DAWINI_DEMO = true;

  var real = window.tabibiDawini || {};
  var CODES = real.CODES || {};

  // ── Pharmacies factices (Alger) — la n°1 est « ma pharmacie » ───────
  var PHARMACIES = [
    { id: 'demo-ph-1', nom: 'Pharmacie El Chifa',      adresse: '12 rue Didouche Mourad, Alger-Centre', telephone: '+213 21 63 12 45', latitude: 36.7754, longitude: 3.0590, wilaya_code: 16, horaires: null },
    { id: 'demo-ph-2', nom: 'Pharmacie Es-Salem',      adresse: '4 bd Colonel Amirouche, Bab El Oued',  telephone: '+213 21 96 30 08', latitude: 36.7925, longitude: 3.0510, wilaya_code: 16, horaires: null },
    { id: 'demo-ph-3', nom: 'Pharmacie du 1er Novembre', adresse: 'Cité 1er Novembre, Hussein Dey',     telephone: '+213 21 77 54 21', latitude: 36.7440, longitude: 3.0960, wilaya_code: 16, horaires: null }
  ];
  var MY_PHARMACY   = PHARMACIES[0];
  var DEMO_PATIENT  = { nom: 'Amina R.', tel: '+213 550 12 34 56' };

  // Fausse ordonnance (SVG data-URI, aucun fichier requis)
  var DEMO_ORDONNANCE =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">' +
      '<rect width="480" height="320" fill="#fff" stroke="#d4e9e1" stroke-width="4"/>' +
      '<text x="24" y="48" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0E5F46">Dr S. Benali — Médecine générale</text>' +
      '<text x="24" y="84" font-family="sans-serif" font-size="14" fill="#334">Alger, le 08/07/2026</text>' +
      '<text x="24" y="140" font-family="sans-serif" font-size="16" fill="#111">R/ Amoxicilline 1g — 2×/jour, 7 jours</text>' +
      '<text x="24" y="170" font-family="sans-serif" font-size="16" fill="#111">R/ Paracétamol 1000 mg — si douleur</text>' +
      '<text x="24" y="280" font-family="sans-serif" font-size="13" fill="#888">ORDONNANCE DE DÉMONSTRATION — Tabibi</text>' +
      '</svg>');

  // ── State partagé entre les 2 pages ─────────────────────────────────
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY_STATE) || 'null');
      if (s && s.requests) return s;
    } catch (e) { (window.tabibiErreur || console.warn)(e, 'tabibi-dawini-demo.js:81'); }
    // Seed : 1 demande d'exemple déjà en attente
    var seed = {
      requests: [{
        id: 'demo-req-1',
        patient_id: 'demo-patient',
        medicaments: ['Amoxicilline 1g', 'Paracétamol 1000'],
        image_path: 'demo/ordonnance.svg',
        note: 'Pour un enfant de 8 ans — assez urgent',
        wilaya_code: 16,
        latitude: 36.7631, longitude: 3.0506,
        status: 'pending',
        created_at: new Date(Date.now() - 25 * 60000).toISOString(),
        expires_at: new Date(Date.now() + 23 * 3600000).toISOString()
      }],
      responses: []
    };
    saveState(seed);
    return seed;
  }
  function saveState(s) { localStorage.setItem(KEY_STATE, JSON.stringify(s)); }
  function ok(data)  { return Promise.resolve({ ok: true,  data: data }); }
  function ko(code)  { return Promise.resolve({ ok: false, error: code }); }
  function hydrate(st) {
    st.responses.forEach(function (r) {
      r.pharmacie = PHARMACIES.find(function (p) { return p.id === r.pharmacie_id; }) || null;
    });
  }

  // ── Remplacement complet de l'API (même surface que le réel) ────────
  window.tabibiDawini = Object.freeze({
    // patient
    uploadOrdonnance: function () { return ok('demo/ordonnance.svg'); },
    createRequest: function (opts) {
      var st = loadState();
      st.requests.unshift({
        id: 'demo-req-' + Date.now(),
        patient_id: 'demo-patient',
        medicaments: opts.medicaments || [],
        image_path: opts.imagePath || null,
        note: opts.note || null,
        wilaya_code: parseInt(opts.wilayaCode, 10) || 16,
        latitude: opts.lat, longitude: opts.lng,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600000).toISOString()
      });
      saveState(st);
      return ok(st.requests[0].id);
    },
    listMyRequests: function () {
      var st = loadState(); hydrate(st);
      st.requests.forEach(function (q) {
        q.responses = st.responses.filter(function (r) { return r.request_id === q.id; });
      });
      return ok(st.requests);
    },
    closeRequest: function (id) {
      var st = loadState();
      var q = st.requests.find(function (x) { return x.id === id; });
      if (q) q.status = 'closed';
      saveState(st);
      return ok(null);
    },
    // pharmacie
    myPharmacy: function () { return ok(MY_PHARMACY); },
    listZoneRequests: function () {
      var st = loadState(); hydrate(st);
      var list = st.requests.filter(function (q) { return q.status === 'pending' || q.status === 'answered'; });
      list.forEach(function (q) {
        q.my_response = st.responses.find(function (r) {
          return r.request_id === q.id && r.pharmacie_id === MY_PHARMACY.id;
        }) || null;
      });
      return ok(list);
    },
    getImageUrl: function () { return ok(DEMO_ORDONNANCE); },
    respond: function (opts) {
      var st = loadState();
      if (st.responses.some(function (r) { return r.request_id === opts.requestId && r.pharmacie_id === MY_PHARMACY.id; })) {
        return ko(CODES.ERR_ALREADY_ANSWERED || 'ERR_ALREADY_ANSWERED');
      }
      st.responses.push({
        id: 'demo-resp-' + Date.now(),
        request_id: opts.requestId,
        pharmacie_id: MY_PHARMACY.id,
        status: opts.accepted ? 'accepted' : 'refused',
        disponible: !!opts.disponible,
        generique: !!opts.generique,
        medicaments_dispo: opts.medsDispo || null,
        commentaire: opts.commentaire || null,
        created_at: new Date().toISOString()
      });
      if (opts.accepted) {
        var q = st.requests.find(function (x) { return x.id === opts.requestId; });
        if (q && q.status === 'pending') q.status = 'answered';
      }
      saveState(st);
      return ok(st.responses[st.responses.length - 1].id);
    },
    getPatientContact: function (requestId) {
      var st = loadState();
      var accepted = st.responses.some(function (r) {
        return r.request_id === requestId && r.pharmacie_id === MY_PHARMACY.id && r.status === 'accepted';
      });
      return accepted ? ok(DEMO_PATIENT) : ko(CODES.ERR_NOT_ACCEPTED || 'ERR_NOT_ACCEPTED');
    },
    stats: function () {
      var st = loadState();
      var mine = st.responses.filter(function (r) { return r.pharmacie_id === MY_PHARMACY.id; });
      return ok({
        zone_total:    st.requests.length,
        mine_accepted: mine.filter(function (r) { return r.status === 'accepted'; }).length,
        mine_refused:  mine.filter(function (r) { return r.status === 'refused'; }).length
      });
    },
    // commun (réutilise le réel quand dispo)
    expireOld:    function () { return Promise.resolve({ ok: true }); },
    distanceKm:   real.distanceKm || function () { return null; },
    startPolling: real.startPolling || function (fn) { fn(); return { stop: function () {} }; },
    featureName:  real.featureName || function () { return 'Dawini'; },
    errorMessage: real.errorMessage || function (c) { return String(c); },
    CODES:        CODES
  });
})();
