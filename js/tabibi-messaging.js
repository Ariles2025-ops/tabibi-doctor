/* ====================================================================
 * Tabibi — Messagerie patient <-> medecin (couche donnees, polling)
 * --------------------------------------------------------------------
 * Helpers lus par messages.html (inbox) + conversation.html (fil).
 * Calque le pattern notifications.html : lecture via window.tabibi.supabase,
 * RLS cote DB, AUCUN realtime. Gate par window.TABIBI_FEATURES.messaging.
 *
 * Modele DB (migrations/MSG_step1_messaging.sql) :
 *   conversations(id, patient_id, doctor_id, doctor_user_id, last_message_at)
 *   messages(id, conversation_id, sender_id, body, created_at, read_at)
 *   RPC ensure_conversation(p_doctor_id) -> uuid (gating RDV confirmed/completed)
 *
 * Resolution noms :
 *   - cote patient  : public_doctors.full_name / specialty_fr (par doctor_id)
 *   - cote medecin  : users.first_name/last_name (par patient_id ; fallback "Patient"
 *                     si la RLS users bloque la lecture).
 *
 * Idempotent : si charge 2x, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';
  if (window.tabibiMessaging && window.tabibiMessaging.__loaded) return;

  // ── Acces de base ───────────────────────────────────────────────────
  function _sb() { return (window.tabibi && window.tabibi.supabase) || null; }
  function _enabled() { return !!(window.TABIBI_FEATURES && window.TABIBI_FEATURES.messaging); }
  function _uid() {
    try { var u = JSON.parse(localStorage.getItem('tabibi_user') || 'null'); return (u && u.id) || null; }
    catch (e) { return null; }
  }

  // ── Helpers presentation ────────────────────────────────────────────
  function _esc(s){
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function _fmtRel(iso){
    if (!iso) return '';
    try {
      var s = Math.floor((Date.now() - new Date(iso).getTime())/1000);
      if (s < 60) return "à l'instant";
      var m = Math.floor(s/60); if (m < 60) return 'il y a ' + m + ' min';
      var h = Math.floor(m/60); if (h < 24) return 'il y a ' + h + ' h';
      var d = Math.floor(h/24); if (d < 7) return 'il y a ' + d + ' j';
      return new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'short', timeZone:'Africa/Algiers' }).format(new Date(iso));
    } catch (e) { return ''; }
  }
  function _fmtClock(iso){
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Algiers' }).format(new Date(iso)); }
    catch (e) { return ''; }
  }
  function _initials(name){
    var n = (name || '').trim();
    if (!n) return '?';
    return n.split(/\s+/).map(function(w){ return w.charAt(0) || ''; }).slice(0,2).join('').toUpperCase() || '?';
  }

  // ── Resolution batch des noms des "autres participants" ─────────────
  async function _resolveNames(sb, doctorIds, patientIds) {
    var doctors = {}, patients = {};
    try {
      if (doctorIds.length) {
        var rd = await sb.from('public_doctors').select('id,full_name,specialty_fr').in('id', doctorIds);
        (rd.data || []).forEach(function (d) {
          doctors[d.id] = { name: d.full_name || 'Médecin', sub: d.specialty_fr || '' };
        });
      }
    } catch (e) { /* champ/RLS -> fallback */ }
    // [FIX 2026-08-05] doctor_patients_directory au lieu de public.users : la
    // RLS de public.users scope par auth.uid(), un médecin n'y voit que sa
    // propre ligne. La vue filtre par auth.uid() dans sa définition et ne
    // renvoie que les patients ayant un RDV avec lui. Même périmètre.
    try {
      if (patientIds.length) {
        var rp = await sb.from('doctor_patients_directory').select('id,first_name,last_name').in('id', patientIds);
        // rp.error DOIT être testé : PostgREST peut répondre 200 avec une erreur
        // dans le corps, et `rp.data || []` avalait ce cas comme un 401.
        if (rp.error) throw rp.error;
        (rp.data || []).forEach(function (u) {
          patients[u.id] = { name: ((u.first_name||'') + ' ' + (u.last_name||'')).trim() || 'Patient', sub: 'Patient' };
        });
      }
    } catch (e) {
      // Repli « Patient » conservé, mais plus jamais silencieux.
      if (window.console && console.error) {
        console.error('[messaging] lecture doctor_patients_directory ÉCHOUÉE — '
          + 'les conversations s\'afficheront sans nom de patient.', e);
      }
    }
    return { doctors: doctors, patients: patients };
  }

  function _otherOf(conv, myUid, names) {
    if (conv.doctor_user_id === myUid) {           // je suis le MEDECIN -> autre = patient
      var p = names.patients[conv.patient_id] || { name: 'Patient', sub: 'Patient' };
      return { name: p.name, sub: p.sub, iAmDoctor: true };
    }
    var d = names.doctors[conv.doctor_id] || { name: 'Médecin', sub: '' };
    return { name: d.name, sub: d.sub, iAmDoctor: false };
  }

  // ── API publique ────────────────────────────────────────────────────

  // Ouvre/recupere la conversation avec un medecin (gating RDV cote RPC).
  // -> uuid de conversation, ou throw (message lisible, ex. 42501 = pas de RDV).
  async function ensureConversation(doctorId) {
    var sb = _sb(); if (!sb) throw new Error('Service indisponible');
    var r = await sb.rpc('ensure_conversation', { p_doctor_id: doctorId });
    if (r.error) throw new Error(r.error.message || 'Messagerie indisponible');
    return r.data; // uuid
  }

  // Liste enrichie pour l'inbox : [{id,name,sub,iAmDoctor,lastBody,lastAt,unread}].
  async function listConversations() {
    var sb = _sb(); var myUid = _uid();
    if (!sb || !myUid || !_enabled()) return [];
    var rc = await sb.from('conversations').select('*').order('last_message_at', { ascending:false });
    if (rc.error || !rc.data || !rc.data.length) return [];
    var convs = rc.data;

    // Messages (RLS -> uniquement mes conversations) pour preview + non-lus.
    var prev = {}, unread = {};
    try {
      var rm = await sb.from('messages')
        .select('conversation_id,body,created_at,sender_id,read_at')
        .order('created_at', { ascending:false })
        .limit(1000);
      (rm.data || []).forEach(function (m) {
        if (!prev[m.conversation_id]) prev[m.conversation_id] = m;   // 1er rencontre = + recent
        if (m.sender_id !== myUid && m.read_at == null) {
          unread[m.conversation_id] = (unread[m.conversation_id] || 0) + 1;
        }
      });
    } catch (e) { /* ignore : inbox sans preview/badge */ }

    // Noms
    var doctorIds = [], patientIds = [];
    convs.forEach(function (c) {
      if (c.doctor_user_id === myUid) { if (patientIds.indexOf(c.patient_id) < 0) patientIds.push(c.patient_id); }
      else { if (doctorIds.indexOf(c.doctor_id) < 0) doctorIds.push(c.doctor_id); }
    });
    var names = await _resolveNames(sb, doctorIds, patientIds);

    return convs.map(function (c) {
      var other = _otherOf(c, myUid, names);
      var lm = prev[c.id];
      return {
        id: c.id, name: other.name, sub: other.sub, iAmDoctor: other.iAmDoctor,
        lastBody: lm ? lm.body : '', lastAt: lm ? lm.created_at : c.last_message_at,
        unread: unread[c.id] || 0
      };
    });
  }

  // En-tete du fil : {id,name,sub,iAmDoctor} ou null si non accessible.
  async function getConversation(convId) {
    var sb = _sb(); var myUid = _uid();
    if (!sb || !myUid || !convId) return null;
    var rc = await sb.from('conversations').select('*').eq('id', convId).maybeSingle();
    if (rc.error || !rc.data) return null;
    var c = rc.data;
    var doctorIds = [], patientIds = [];
    if (c.doctor_user_id === myUid) patientIds.push(c.patient_id); else doctorIds.push(c.doctor_id);
    var names = await _resolveNames(sb, doctorIds, patientIds);
    var other = _otherOf(c, myUid, names);
    return { id: c.id, name: other.name, sub: other.sub, iAmDoctor: other.iAmDoctor };
  }

  // Messages d'une conversation, ordre chronologique : [{id,body,created_at,read_at,mine}].
  async function loadMessages(convId) {
    var sb = _sb(); var myUid = _uid();
    if (!sb || !convId) return [];
    var r = await sb.from('messages').select('*').eq('conversation_id', convId)
      .order('created_at', { ascending:true }).limit(500);
    if (r.error || !r.data) return [];
    return r.data.map(function (m) {
      return { id: m.id, body: m.body, created_at: m.created_at, read_at: m.read_at, mine: (m.sender_id === myUid) };
    });
  }

  // Envoi : {error} (null si OK). RLS impose sender_id=auth.uid()+participant.
  async function sendMessage(convId, body) {
    var sb = _sb(); var myUid = _uid();
    var t = (body || '').trim();
    if (!sb || !myUid || !convId || !t) return { error: 'vide' };
    var r = await sb.from('messages').insert({ conversation_id: convId, sender_id: myUid, body: t.slice(0,4000) });
    return { error: r.error ? (r.error.message || 'erreur') : null };
  }

  // Marque LUS les messages RECUS (sender <> moi) d'une conversation.
  async function markRead(convId) {
    var sb = _sb(); var myUid = _uid();
    if (!sb || !myUid || !convId) return;
    try {
      await sb.from('messages').update({ read_at: new Date().toISOString() })
        .eq('conversation_id', convId).neq('sender_id', myUid).is('read_at', null);
    } catch (e) { /* ignore */ }
  }

  // ── Export global ───────────────────────────────────────────────────
  window.tabibiMessaging = {
    __loaded: true,
    enabled: _enabled, uid: _uid,
    esc: _esc, fmtRel: _fmtRel, fmtClock: _fmtClock, initials: _initials,
    ensureConversation: ensureConversation,
    listConversations: listConversations,
    getConversation: getConversation,
    loadMessages: loadMessages,
    sendMessage: sendMessage,
    markRead: markRead
  };
})();
