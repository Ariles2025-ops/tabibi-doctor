/* ====================================================================
 * Tabibi — tabibiBooking (helpers patient booking)
 * --------------------------------------------------------------------
 * Phase 5.2.1 (PROGRESS.md) — 2026-05-22
 *
 * Helpers PARTAGÉS pour le flow réservation patient bout-en-bout.
 * Utilisé par : reservation.html (5.2.3), mes-rdv.html (5.2.4),
 *               doctor-profile.html bouton "Prendre RDV" (5.2.2).
 *
 * Dépend de :
 *   - window.tabibi.supabase (js/supabase-client.js)
 *   - RPC public.get_available_slots (Phase 5.1bis)
 *   - Table public.appointments + vue my_upcoming_appointments
 *   - Enum public.appointment_status (pending|confirmed|cancelled|completed|no_show)
 *
 * Pattern anti-régression Phase 4.B.3-fix3 :
 *   - _withTimeout(promise, ms, label) via Promise.race
 *   - try/catch retournant TOUJOURS {ok, data?, error?, raw?}
 *   - Validation client pré-flight (UUID, date range, slot duration)
 *   - 13 codes erreur typés ERR_* (norme industrie, plus explicite que
 *     les codes lowercase de Phase 4.B.3 — TODO Phase 12 : aligner)
 *
 * API publique exposée (window.tabibiBooking) :
 *   • getAvailableSlots(doctorId, date, slotDuration=30)
 *       → {ok, data: [{slot_start, slot_end}, ...], error?}
 *   • createAppointment({doctorId, scheduledAt, durationMinutes=30,
 *                        reason, notesPatient, consultType, payMethod, prix})
 *       → {ok, data: appointmentRow, error?}
 *   • listMyAppointments()
 *       → {ok, data: [row, ...], error?}
 *   • cancelMyAppointment(appointmentId, reason)
 *       → {ok, data: updatedRow, error?}
 *   • errorMessage(errCode)
 *       → string FR à afficher dans toast / inline
 *   • CODES (read-only constants des 14 codes erreur)
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';

  // Idempotence : si déjà chargé, ne rien faire
  if (window.tabibiBooking && typeof window.tabibiBooking.getAvailableSlots === 'function') {
    return;
  }

  // ───────────────────────────────────────────────────────────────────
  // Constantes : codes erreur + messages FR
  // ───────────────────────────────────────────────────────────────────
  // [Phase 5.2.1] 14 codes ERR_*, validés en review user.
  // [TODO Phase 12] migrer ERR_MSG_FR vers js/tabibi-i18n.js pour ar/fr/en.

  var CODES = Object.freeze({
    ERR_AUTH_REQUIRED:       'ERR_AUTH_REQUIRED',
    ERR_SESSION_EXPIRED:     'ERR_SESSION_EXPIRED',
    ERR_INVALID_INPUT:       'ERR_INVALID_INPUT',
    ERR_REASON_REQUIRED:     'ERR_REASON_REQUIRED',
    ERR_DOCTOR_NOT_CLAIMED:  'ERR_DOCTOR_NOT_CLAIMED',
    ERR_SLOT_TAKEN:          'ERR_SLOT_TAKEN',
    ERR_SLOT_OUTSIDE_HOURS:  'ERR_SLOT_OUTSIDE_HOURS',
    ERR_NOT_FOUND:           'ERR_NOT_FOUND',
    ERR_RLS_DENIED:          'ERR_RLS_DENIED',
    ERR_NETWORK:             'ERR_NETWORK',
    ERR_TIMEOUT:             'ERR_TIMEOUT',
    ERR_RATE_LIMIT:          'ERR_RATE_LIMIT',
    ERR_UNKNOWN:             'ERR_UNKNOWN'
  });

  var ERR_MSG_FR = {
    ERR_AUTH_REQUIRED:       "Connexion requise pour confirmer le RDV.",
    ERR_SESSION_EXPIRED:     "Session expirée, reconnectez-vous puis réessayez.",
    ERR_INVALID_INPUT:       "Données invalides. Vérifiez date et créneau.",
    ERR_REASON_REQUIRED:     "Indiquez un motif de consultation.",
    ERR_DOCTOR_NOT_CLAIMED:  "Ce médecin n'accepte pas encore les RDV en ligne.",
    ERR_SLOT_TAKEN:          "Ce créneau n'est plus disponible. Choisissez-en un autre.",
    ERR_SLOT_OUTSIDE_HOURS:  "Ce créneau n'est plus disponible. Choisissez-en un autre.",
    ERR_NOT_FOUND:           "RDV introuvable. Il a peut-être déjà été annulé.",
    ERR_RLS_DENIED:          "Action non autorisée.",
    ERR_NETWORK:             "Erreur réseau. Vérifiez votre connexion.",
    ERR_TIMEOUT:             "Délai dépassé. Réessayez dans un instant.",
    ERR_RATE_LIMIT:          "Trop de demandes. Patientez quelques secondes.",
    ERR_UNKNOWN:             "Erreur inattendue. Détails dans la console (F12)."
  };

  function errorMessage(code) {
    return ERR_MSG_FR[code] || ERR_MSG_FR.ERR_UNKNOWN;
  }

  // ───────────────────────────────────────────────────────────────────
  // Helpers privés
  // ───────────────────────────────────────────────────────────────────

  function sb() {
    return (window.tabibi && window.tabibi.supabase) || null;
  }

  // [Phase 4.B.3-fix3 pattern] Wrap toute promise avec un timeout.
  // Reject avec Error('timeout:<label>') si dépasse `ms`.
  function _withTimeout(promise, ms, label) {
    var timer;
    var t = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error('timeout:' + (label || 'unknown')));
      }, ms);
    });
    return Promise.race([promise, t]).finally(function () { clearTimeout(timer); });
  }

  // Validations pré-flight
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isValidUuid(s) { return typeof s === 'string' && UUID_RE.test(s); }

  // [Phase 5.2.1 review] Conversion date → 'YYYY-MM-DD' déterministe via
  // Intl.DateTimeFormat 'en-CA' qui sort directement le format ISO court.
  // Évite le double-parse Date→string→Date qui dérivait selon la TZ navigateur.
  // Comparaison lexicographique sur strings YYYY-MM-DD (tri = tri chronologique).
  var _DF_ALGIERS = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit'
  });
  function _isoDateAlgiers(d) {
    // d : Date object — retourne 'YYYY-MM-DD' du jour-calendrier Algiers
    return _DF_ALGIERS.format(d);
  }
  function _todayIsoAlgiers() {
    return _isoDateAlgiers(new Date());
  }
  function _addDaysIso(iso, days) {
    // Avance/recule de N jours sur une string 'YYYY-MM-DD' en local Algiers.
    // Reconstruit via Date local (Algeria CET sans DST → safe).
    var parts = iso.split('-');
    var d = new Date(parseInt(parts[0], 10),
                     parseInt(parts[1], 10) - 1,
                     parseInt(parts[2], 10),
                     12, 0, 0);   // 12:00 local pour éviter rollover ±1h DST hypothétique
    d.setDate(d.getDate() + days);
    return _isoDateAlgiers(d);
  }
  function _isDateInRange(dateInput) {
    // Accepte Date, string ISO, ou string YYYY-MM-DD.
    var iso;
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return false;
      iso = _isoDateAlgiers(dateInput);
    } else if (typeof dateInput === 'string') {
      // String : on prend les 10 premiers chars si c'est un ISO complet,
      // sinon on tente un parse et reconvertit en YYYY-MM-DD Algeria.
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        iso = dateInput;
      } else {
        var parsed = new Date(dateInput);
        if (isNaN(parsed.getTime())) return false;
        iso = _isoDateAlgiers(parsed);
      }
    } else {
      return false;
    }
    var todayIso = _todayIsoAlgiers();
    var maxIso = _addDaysIso(todayIso, 90);
    // Tri lexicographique = tri chronologique sur format YYYY-MM-DD
    return iso >= todayIso && iso <= maxIso;
  }

  // Renvoie le code ERR_* à partir d'un objet error Supabase / Postgres
  function _mapPostgrestError(err) {
    if (!err) return CODES.ERR_UNKNOWN;
    var msg = String(err.message || '').toLowerCase();
    var code = String(err.code || '');
    // Codes PostgreSQL
    if (code === '42501') return CODES.ERR_RLS_DENIED;
    if (code === '23P01' || code === '23505') return CODES.ERR_SLOT_TAKEN; // exclusion / unique
    if (code === '23503') return CODES.ERR_NOT_FOUND;                       // FK violation
    if (code === '23514') return CODES.ERR_INVALID_INPUT;                   // CHECK violation
    // HTTP
    if (err.status === 401) return CODES.ERR_SESSION_EXPIRED;
    if (err.status === 429) return CODES.ERR_RATE_LIMIT;
    // Messages
    if (msg.indexOf('jwt') !== -1 || msg.indexOf('expired') !== -1) return CODES.ERR_SESSION_EXPIRED;
    if (msg.indexOf('network') !== -1 || msg.indexOf('failed to fetch') !== -1) return CODES.ERR_NETWORK;
    return CODES.ERR_UNKNOWN;
  }

  function _mapTimeoutOrNetwork(e) {
    if (!e) return CODES.ERR_UNKNOWN;
    var msg = String(e.message || '');
    if (/^timeout:/.test(msg)) return CODES.ERR_TIMEOUT;
    if (msg.indexOf('NetworkError') !== -1
        || msg.indexOf('Failed to fetch') !== -1
        || msg.indexOf('network') !== -1) return CODES.ERR_NETWORK;
    return CODES.ERR_UNKNOWN;
  }

  // [Phase 5.2.1 review] Retourne {session, error} pour distinguer
  // "pas de session" (→ caller doit ERR_AUTH_REQUIRED) vs "check a échoué"
  // (→ caller doit ERR_NETWORK ou ERR_TIMEOUT). Si error défini, session=null.
  async function _requireSession() {
    var s = sb();
    if (!s) return { session: null, error: CODES.ERR_UNKNOWN };
    try {
      var r = await _withTimeout(s.auth.getSession(), 5000, 'get_session');
      var sess = (r && r.data && r.data.session) || null;
      return { session: sess, error: null };
    } catch (e) {
      return { session: null, error: _mapTimeoutOrNetwork(e) };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // getAvailableSlots(doctorId, date, slotDuration=30)
  // ───────────────────────────────────────────────────────────────────
  // Appel RPC public.get_available_slots (Phase 5.1bis).
  // Accessible à anon (UX patient voit avant signup).
  // Date acceptée : string YYYY-MM-DD ou Date object.
  // Retourne {ok:true, data:[{slot_start, slot_end}]} ou {ok:false, error:'ERR_*'}.
  async function getAvailableSlots(doctorId, date, slotDuration) {
    var s = sb();
    if (!s) {
      console.warn('[tabibiBooking] getAvailableSlots: no supabase client');
      return { ok: false, error: CODES.ERR_UNKNOWN };
    }
    var dur = (slotDuration == null) ? 30 : parseInt(slotDuration, 10);
    // Validation pré-flight
    if (!isValidUuid(doctorId)) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    if (!_isDateInRange(date)) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    if (isNaN(dur) || dur < 5 || dur > 240) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    // Normaliser en YYYY-MM-DD (interprété par PostgreSQL en TZ session
    // qui est UTC par défaut sur Supabase → la RPC re-projette en Algeria
    // côté serveur, donc envoyer YYYY-MM-DD "tel quel" est correct).
    var dateIso;
    if (date instanceof Date) {
      dateIso = _isoDateAlgiers(date);
    } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dateIso = date;
    } else {
      dateIso = _isoDateAlgiers(new Date(date));
    }
    try {
      // [Phase 5.2.1 review POINT 1] Noms params alignés sur la RPC prod
      // déployée en commit 79a66a0 (doctor_id, target_date, slot_duration),
      // PAS sur mon SQL `PHASE5_1bis_get_available_slots_rpc.sql` qui utilise
      // les préfixes p_* (à hotpatcher pour cohérence — TODO Phase 5.2.5).
      var r = await _withTimeout(
        s.rpc('get_available_slots', {
          doctor_id:     doctorId,
          target_date:   dateIso,
          slot_duration: dur
        }),
        8000,
        'get_available_slots'
      );
      if (r.error) {
        console.warn('[tabibiBooking] getAvailableSlots RPC error', r.error);
        return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      }
      return { ok: true, data: Array.isArray(r.data) ? r.data : [] };
    } catch (e) {
      console.warn('[tabibiBooking] getAvailableSlots exception', e);
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // createAppointment({doctorId, scheduledAt, durationMinutes=30, reason, ...})
  // ───────────────────────────────────────────────────────────────────
  // INSERT public.appointments — RLS "Patients create own appointments"
  // exige patient_id=auth.uid() AND status='pending' (forcés ci-dessous).
  // Schema OLD : scheduled_at, duration_minutes, reason, notes_patient,
  //              consult_type, pay_method, prix.
  // Le trigger trg_appointments_sync_slot_times alimente starts_at/ends_at.
  // [Phase 5.2.1 review POINT 6] Garde anti double-clic via _createInFlight :
  // si un INSERT est en cours, le 2e clic retourne ERR_RATE_LIMIT immédiatement.
  var _createInFlight = false;
  async function createAppointment(opts) {
    opts = opts || {};
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };

    // [POINT 6] Garde anti double-clic — protection contre INSERT concurrents.
    // L'UI désactive normalement le bouton (cf. pattern Phase 4.B.3-fix3),
    // mais on garde une protection serveur-near au cas où.
    if (_createInFlight) {
      return { ok: false, error: CODES.ERR_RATE_LIMIT };
    }

    // Validation pré-flight
    if (!isValidUuid(opts.doctorId)) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    var scheduledAt = opts.scheduledAt;
    var scheduledDate = (scheduledAt instanceof Date) ? scheduledAt : new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    if (!_isDateInRange(scheduledDate)) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    var dur = opts.durationMinutes != null ? parseInt(opts.durationMinutes, 10) : 30;
    if (isNaN(dur) || dur < 5 || dur > 240) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    var reason = (opts.reason || '').trim();
    if (!reason) {
      return { ok: false, error: CODES.ERR_REASON_REQUIRED };
    }

    // [POINT 4] Session obligatoire — distinguer no-session vs check failed
    var sessRes = await _requireSession();
    if (sessRes.error) {
      return { ok: false, error: sessRes.error };
    }
    if (!sessRes.session) {
      return { ok: false, error: CODES.ERR_AUTH_REQUIRED };
    }

    var payload = {
      patient_id:       sessRes.session.user.id,
      doctor_id:        opts.doctorId,
      scheduled_at:     scheduledDate.toISOString(),
      duration_minutes: dur,
      reason:           reason,
      notes_patient:    (opts.notesPatient || '').trim() || null,
      status:           'pending',  // FORCÉ — RLS Patients INSERT n'autorise que pending
      consult_type:     opts.consultType || null,
      pay_method:       opts.payMethod || null,
      prix:             (opts.prix != null) ? parseInt(opts.prix, 10) : null
    };

    _createInFlight = true;
    try {
      // [POINT 5] PII logs gated derrière window.__TABIBI_DEBUG__ = true.
      // Par défaut OFF en prod. Activer dans la console pour debug ponctuel.
      if (window.__TABIBI_DEBUG__) {
        console.info('[tabibiBooking] INSERT appointments payload=', payload);
      }
      var insertPromise = s.from('appointments').insert(payload).select().single();
      var r = await _withTimeout(insertPromise, 10000, 'create_appointment');
      if (window.__TABIBI_DEBUG__) {
        console.info('[tabibiBooking] INSERT response data=', r.data, ' error=', r.error);
      }
      if (r.error) {
        // console.warn gardé pour ops (n'expose pas le payload PII, juste l'erreur)
        console.warn('[tabibiBooking] createAppointment error', r.error.code, r.error.message);
        return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      }
      if (!r.data || !r.data.id) {
        // Garde Phase 4.B.2-hotfix : si pas d'erreur mais data null
        return { ok: false, error: CODES.ERR_UNKNOWN, raw: r };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      console.warn('[tabibiBooking] createAppointment exception', e && e.message);
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    } finally {
      _createInFlight = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // listMyAppointments() — utilise la vue my_upcoming_appointments
  // ───────────────────────────────────────────────────────────────────
  // RLS appliquée via la vue (patient_id=auth.uid() côté table source).
  async function listMyAppointments() {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN, data: [] };
    // [POINT 4] Session : distingue no-session vs check failed
    var sessRes = await _requireSession();
    if (sessRes.error) {
      return { ok: false, error: sessRes.error, data: [] };
    }
    if (!sessRes.session) {
      return { ok: false, error: CODES.ERR_AUTH_REQUIRED, data: [] };
    }
    try {
      var listPromise = s.from('my_upcoming_appointments').select('*');
      var r = await _withTimeout(listPromise, 8000, 'list_my_appointments');
      if (r.error) {
        console.warn('[tabibiBooking] listMyAppointments error', r.error.code, r.error.message);
        return { ok: false, error: _mapPostgrestError(r.error), data: [], raw: r.error };
      }
      return { ok: true, data: r.data || [] };
    } catch (e) {
      console.warn('[tabibiBooking] listMyAppointments exception', e && e.message);
      return { ok: false, error: _mapTimeoutOrNetwork(e), data: [], raw: e };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // cancelMyAppointment(appointmentId, reason)
  // ───────────────────────────────────────────────────────────────────
  // UPDATE — RLS "appointments_update_patient_cancel_only" (5.1bis)
  // exige patient_id=auth.uid() AND status IN (pending,confirmed)
  // WITH CHECK status='cancelled'.
  async function cancelMyAppointment(appointmentId, reason) {
    var s = sb();
    if (!s) return { ok: false, error: CODES.ERR_UNKNOWN };
    if (!isValidUuid(appointmentId)) {
      return { ok: false, error: CODES.ERR_INVALID_INPUT };
    }
    // [POINT 4] Session : distingue no-session vs check failed
    var sessRes = await _requireSession();
    if (sessRes.error) {
      return { ok: false, error: sessRes.error };
    }
    if (!sessRes.session) {
      return { ok: false, error: CODES.ERR_AUTH_REQUIRED };
    }
    var payload = {
      status:               'cancelled',
      cancelled_by_user_id: sessRes.session.user.id,
      cancelled_at:         new Date().toISOString(),
      cancellation_reason:  (reason || '').trim() || null
    };
    try {
      // [POINT 5] PII : on log juste l'id (UUID = pas PII en soi)
      if (window.__TABIBI_DEBUG__) {
        console.info('[tabibiBooking] CANCEL appointment id=', appointmentId);
      }
      var updatePromise = s.from('appointments')
        .update(payload)
        .eq('id', appointmentId)
        .select()
        .maybeSingle();  // tolère 0 row sans throw (= ERR_NOT_FOUND)
      var r = await _withTimeout(updatePromise, 8000, 'cancel_appointment');
      if (r.error) {
        console.warn('[tabibiBooking] cancelMyAppointment error', r.error.code, r.error.message);
        return { ok: false, error: _mapPostgrestError(r.error), raw: r.error };
      }
      if (!r.data) {
        // 0 row affected = RDV introuvable OU RLS USING masque (déjà cancelled
        // ou completed). UX patient identique : "RDV introuvable. Il a peut-être
        // déjà été annulé." (cf. ERR_MSG_FR.ERR_NOT_FOUND).
        return { ok: false, error: CODES.ERR_NOT_FOUND };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      console.warn('[tabibiBooking] cancelMyAppointment exception', e && e.message);
      return { ok: false, error: _mapTimeoutOrNetwork(e), raw: e };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Export
  // ───────────────────────────────────────────────────────────────────
  window.tabibiBooking = window.tabibiBooking || {
    // API publique
    getAvailableSlots:    getAvailableSlots,
    createAppointment:    createAppointment,
    listMyAppointments:   listMyAppointments,
    cancelMyAppointment:  cancelMyAppointment,
    errorMessage:         errorMessage,
    // Constantes
    CODES:                CODES
  };
})();
