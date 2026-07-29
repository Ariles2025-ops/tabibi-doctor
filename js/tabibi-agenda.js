/* ============================================================
   js/tabibi-agenda.js — Agenda semaine cabinet — Phase 3 lot 2
   ------------------------------------------------------------
   Vue semaine 7 colonnes (lun→dim) × lignes horaires, pour
   agenda-cabinet.html. Fonctionne en navigateur ET dans Tauri
   (aucune API desktop requise — Supabase côté JS comme partout).

   SOURCES (lecture) :
   • cabinet_calendar_view       (mode cabinet — RLS secrétariat/cabinet)
   • appointments — doctor_id = doctor_profiles.id (FK réelle ; requête
     .in() couvrant aussi auth.uid pour d'éventuelles lignes legacy)
   • rpc get_my_doctor_profile   (working_hours JSONB + id doctor_profiles)
   • doctor_unavailable_slots    (mode médecin ; FK doctor_profiles.id —
     espace d'ids ≠ auth.uid(), d'où le passage par le profil)
   • doctor_patients_directory   (vue : nom + téléphone des patients ayant
     un RDV avec le médecin connecté ; filtrage par auth.uid() DANS la vue.
     ⚠️ NE JAMAIS passer cette vue en security_invoker : la RLS de
     public.users la rendrait muette et l'agenda réafficherait « Patient »)
   ACTIONS (existantes uniquement) :
   • UPDATE appointments.status confirmed|cancelled — même appel que
     setStatus() de secretaire-dashboard / confRdv() de doctor-dashboard.
   AUCUNE autre écriture. AUCUNE migration.

   Mode démo : ?demo=1 → fixtures locales, zéro appel réseau, bannière
   visible. Sert à valider le rendu sans compte (pré-launch).
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* ── i18n locale (clés ag_* absentes de tabibi-i18n.js) ─────────── */
  var I18N = {
    fr: { ag_title:'Agenda cabinet', ag_today:"Aujourd'hui", ag_all_doctors:'Tous les médecins',
          ag_loading:'Chargement…', ag_no_session:'Session requise', ag_demo:'DONNÉES DÉMO — aucune connexion à la base',
          ag_confirm:'Confirmer', ag_cancel:'Annuler le RDV', ag_close:'Fermer', ag_min:'min',
          ag_patient:'Patient', ag_doctor:'Médecin', ag_reason:'Motif', ag_phone:'Téléphone',
          ag_status_pending:'En attente', ag_status_confirmed:'Confirmé', ag_status_cancelled:'Annulé', ag_status_completed:'Terminé',
          ag_unavailable:'Indisponible', ag_work:'Horaires d’ouverture', ag_empty:'Aucun RDV cette semaine.',
          ag_cancel_ask:'Annuler ce rendez-vous ?', ag_err:'Erreur de chargement : ', ag_updated:'Statut mis à jour.',
          ag_detail_title:'Détail RDV', ag_select:'Sélectionnez un rendez-vous dans l’agenda',
          ag_nav_agenda:'Agenda', ag_nav_dash:'Tableau de bord', ag_nav_rx:'Ordonnances',
          ag_nav_msg:'Messages', ag_nav_notif:'Notifications', ag_nav_profile:'Mon profil', ag_nav_logout:'Déconnexion' },
    ar: { ag_title:'أجندة العيادة', ag_today:'اليوم', ag_all_doctors:'كل الأطباء',
          ag_loading:'جارٍ التحميل…', ag_no_session:'تسجيل الدخول مطلوب', ag_demo:'بيانات تجريبية — دون اتصال بقاعدة البيانات',
          ag_confirm:'تأكيد', ag_cancel:'إلغاء الموعد', ag_close:'إغلاق', ag_min:'د',
          ag_patient:'المريض', ag_doctor:'الطبيب', ag_reason:'السبب', ag_phone:'الهاتف',
          ag_status_pending:'قيد الانتظار', ag_status_confirmed:'مؤكد', ag_status_cancelled:'ملغى', ag_status_completed:'منتهي',
          ag_unavailable:'غير متاح', ag_work:'أوقات العمل', ag_empty:'لا مواعيد هذا الأسبوع.',
          ag_cancel_ask:'إلغاء هذا الموعد؟', ag_err:'خطأ في التحميل: ', ag_updated:'تم تحديث الحالة.',
          ag_detail_title:'تفاصيل الموعد', ag_select:'اختر موعدًا من الأجندة',
          ag_nav_agenda:'الأجندة', ag_nav_dash:'لوحة القيادة', ag_nav_rx:'الوصفات',
          ag_nav_msg:'الرسائل', ag_nav_notif:'الإشعارات', ag_nav_profile:'ملفي', ag_nav_logout:'تسجيل الخروج' },
    en: { ag_title:'Practice agenda', ag_today:'Today', ag_all_doctors:'All doctors',
          ag_loading:'Loading…', ag_no_session:'Sign-in required', ag_demo:'DEMO DATA — no database connection',
          ag_confirm:'Confirm', ag_cancel:'Cancel appointment', ag_close:'Close', ag_min:'min',
          ag_patient:'Patient', ag_doctor:'Doctor', ag_reason:'Reason', ag_phone:'Phone',
          ag_status_pending:'Pending', ag_status_confirmed:'Confirmed', ag_status_cancelled:'Cancelled', ag_status_completed:'Completed',
          ag_unavailable:'Unavailable', ag_work:'Opening hours', ag_empty:'No appointments this week.',
          ag_cancel_ask:'Cancel this appointment?', ag_err:'Loading error: ', ag_updated:'Status updated.',
          ag_detail_title:'Appointment', ag_select:'Select an appointment in the agenda',
          ag_nav_agenda:'Agenda', ag_nav_dash:'Dashboard', ag_nav_rx:'Prescriptions',
          ag_nav_msg:'Messages', ag_nav_notif:'Notifications', ag_nav_profile:'My profile', ag_nav_logout:'Sign out' }
  };
  function lang() {
    try { var s = localStorage.getItem('tabibi_lang'); if (s === 'fr' || s === 'ar' || s === 'en') return s; } catch (e) {}
    return (document.documentElement.lang || 'fr').slice(0, 2);
  }
  function t(k) {
    if (typeof window.tabibiT === 'function') { var v = window.tabibiT(k); if (v && v !== k) return v; }
    var L = I18N[lang()] || I18N.fr; return L[k] || k;
  }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  /* ── Dates (locales, pattern secretaire-dashboard — pas d'UTC shift) ─ */
  function startOfWeek(d) { var x = new Date(d); var day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function fmtDateISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ── Heure du CABINET : l'agenda affiche l'heure d'Alger (UTC+1 fixe,
     pas de DST) quel que soit le fuseau de la machine. Un Mac en
     Europe/Paris (été = UTC+2) décalait tout d'une heure. ───────────── */
  var TZ = 'Africa/Algiers';
  var _tzFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  function tzParts(d) { var p = {}; _tzFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; }); return p; }
  function tzDayIso(d) { var p = tzParts(d); return p.year + '-' + p.month + '-' + p.day; }
  function tzMin(d) { var p = tzParts(d); return (+p.hour) * 60 + (+p.minute); }
  function fmtHM(mins) { return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); }
  function hmToMin(hm) { var p = String(hm || '').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
  var DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; // ordre colonnes lun→dim

  /* ── État ───────────────────────────────────────────────────────── */
  var S = {
    weekStart: startOfWeek(new Date()),
    mode: null,               // 'cabinet' | 'doctor' | 'demo'
    cabinetId: null,
    doctors: [],              // [{user_id, full_name}] (mode cabinet)
    filterDoctor: 'all',
    profile: null,            // {id, working_hours} (mode médecin)
    appts: [],                // normalisés {id, start:Date, durMin, status, patient, doctor, phone, reason}
    unavail: [],              // {start:Date, end:Date, reason}
    selected: null,
    pxPerMin: 1.1,
    boundsMin: 8 * 60, boundsMax: 18 * 60
  };

  function sb() { return (window.tabibi && window.tabibi.supabase) || null; }

  /* ── Normalisation ──────────────────────────────────────────────── */
  function normCabinetRow(a) {
    return { id: a.appointment_id, start: new Date(a.scheduled_at),
      durMin: a.duration_minutes || 30, status: (a.status || 'pending').toLowerCase(),
      patient: ((a.patient_first_name || '') + ' ' + (a.patient_last_name || '')).trim() || 'Patient',
      doctor: ('Dr ' + (a.doctor_first_name || '') + ' ' + (a.doctor_last_name || '')).trim(),
      phone: a.patient_phone || '', reason: a.reason_short || '' };
  }
  function normDoctorRow(a, patientsMap) {
    var p = patientsMap[a.patient_id] || {};
    return { id: a.id, start: new Date(a.scheduled_at),
      durMin: a.duration_minutes || 30, status: (a.status || 'pending').toLowerCase(),
      patient: p.name || 'Patient', doctor: '', phone: p.phone || '', reason: a.reason_short || a.reason || '' };
  }

  /* ── Chargement par mode ────────────────────────────────────────── */
  function resolveMode() {
    // ?demo=1 : démos pré-launch WEB uniquement. Jamais dans l'app Tauri —
    // le poste de travail ne doit servir que des données réelles.
    if (/[?&]demo=1/.test(location.search) && window.TABIBI_PLATFORM !== 'desktop') {
      S.mode = 'demo'; return Promise.resolve();
    }
    var c = sb();
    if (!c) return Promise.reject(new Error('supabase indisponible'));
    return c.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { location.href = 'login.html'; throw new Error(t('ag_no_session')); }
      S.userId = session.user.id;
      return c.rpc('get_my_cabinets').then(function (rc) {
        var rows = (rc && rc.data) || [];
        if (rows.length) {
          S.mode = 'cabinet'; S.cabinetId = rows[0].cabinet_id; S.cabinetName = rows[0].name || '';
          return c.from('cabinet_members_directory_view').select('*')
            .eq('cabinet_id', S.cabinetId).in('role', ['doctor', 'owner'])
            .then(function (rd) { S.doctors = (rd.data || []).map(function (d) { return { user_id: d.user_id, full_name: d.full_name || '--' }; }); });
        }
        S.mode = 'doctor';
        // Profil médecin (working_hours + id doctor_profiles pour les indispos)
        return c.rpc('get_my_doctor_profile').then(function (rp) {
          var prof = rp && rp.data; if (Array.isArray(prof)) prof = prof[0];
          S.profile = prof || null;
        }).catch(function () { S.profile = null; });
      });
    });
  }

  function loadWeek() {
    if (S.mode === 'demo') return loadDemoWeek();
    var c = sb(); if (!c) return Promise.resolve();
    var d0 = S.weekStart, d7 = addDays(d0, 7);
    var jobs = [];
    if (S.mode === 'cabinet') {
      jobs.push(c.from('cabinet_calendar_view').select('*')
        .eq('cabinet_id', S.cabinetId)
        .gte('scheduled_at', fmtDateISO(d0)).lt('scheduled_at', fmtDateISO(d7))
        .order('scheduled_at', { ascending: true })
        .then(function (r) {
          if (r.error) throw r.error;
          var rows = (r.data || []).map(normCabinetRow);
          if (S.filterDoctor !== 'all') {
            var doc = S.doctors.filter(function (d) { return d.user_id === S.filterDoctor; })[0];
            var name = doc ? doc.full_name : null;
            if (name) rows = rows.filter(function (a) { return a.doctor.indexOf(name) !== -1; });
          }
          S.appts = rows;
        }));
      S.unavail = []; // FK doctor_profiles.id non exposée par la vue cabinet → couche omise en mode cabinet (MVP)
    } else {
      // [FIX données] La FK réelle est appointments.doctor_id → doctor_profiles.id
      // (prouvé par le seed : l'insert n'est passé qu'avec l'id de fiche).
      // On interroge les DEUX espaces d'ids (fiche + auth.uid) pour couvrir
      // d'éventuelles lignes legacy créées avec l'ancien pattern.
      var docIds = [S.profile && S.profile.id, S.userId].filter(Boolean);
      jobs.push(c.from('appointments').select('*')
        .in('doctor_id', docIds)
        .gte('starts_at', d0.toISOString()).lt('starts_at', d7.toISOString())
        .order('starts_at', { ascending: true })
        .then(function (r) {
          if (r.error) throw r.error;
          var rows = r.data || [];
          var ids = rows.map(function (a) { return a.patient_id; }).filter(Boolean);
          ids = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
          if (!ids.length) { S.appts = rows.map(function (a) { return normDoctorRow(a, {}); }); return; }
          // Vue doctor_patients_directory : identité minimale des patients
          // ayant au moins un RDV avec le médecin connecté (filtrage par
          // auth.uid() DANS la vue). public.users restait muet ici — sa RLS
          // scope par auth.uid(), d'où les « Patient » anonymes historiques.
          // Best effort conservé : en cas d'échec, repli silencieux sur
          // 'Patient' plutôt qu'un agenda vide.
          return c.from('doctor_patients_directory').select('id,first_name,last_name,phone').in('id', ids)
            .then(function (ru) {
              var map = {};
              (ru.data || []).forEach(function (u) { map[u.id] = { name: ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || 'Patient', phone: u.phone || '' }; });
              S.appts = rows.map(function (a) { return normDoctorRow(a, map); });
            }, function () { S.appts = rows.map(function (a) { return normDoctorRow(a, {}); }); });
        }));
      if (S.profile && S.profile.id) {
        jobs.push(c.from('doctor_unavailable_slots').select('*')
          .eq('doctor_id', S.profile.id)
          .lt('starts_at', d7.toISOString()).gt('ends_at', d0.toISOString())
          .then(function (r) {
            S.unavail = (r.data || []).map(function (u) { return { start: new Date(u.starts_at), end: new Date(u.ends_at), reason: u.reason || '' }; });
          }, function () { S.unavail = []; }));
      } else { S.unavail = []; }
    }
    return Promise.all(jobs);
  }

  /* ── Fixtures démo (déterministes, zéro réseau) ─────────────────── */
  function loadDemoWeek() {
    var wh = { sun: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }],
               mon: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }],
               tue: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }],
               wed: [{ open: '08:00', close: '12:30' }],
               thu: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '17:00' }],
               fri: [], sat: [] }; // semaine DZ : dim→jeu, week-end ven/sam
    S.profile = { working_hours: wh };
    var mk = function (dayIdx, hm, dur, status, patient, reason) {
      var base = addDays(S.weekStart, dayIdx); var m = hmToMin(hm);
      // Instant exact heure d'Alger (UTC+1 fixe, sans DST)
      var d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(m / 60) - 1, m % 60, 0));
      return { id: 'demo-' + dayIdx + '-' + hm, start: d, durMin: dur, status: status,
               patient: patient, doctor: 'Dr Benali', phone: '0555 12 34 56', reason: reason };
    };
    S.appts = [
      mk(0, '08:30', 30, 'confirmed', 'A. Meziane', 'Consultation'),
      mk(0, '09:00', 30, 'confirmed', 'S. Haddad', 'Suivi tension'),
      mk(0, '10:00', 45, 'pending', 'K. Brahimi', 'Première visite'),
      mk(0, '14:30', 30, 'confirmed', 'N. Saidi', 'Résultats analyses'),
      mk(1, '08:00', 30, 'completed', 'M. Cherif', 'Consultation'),
      mk(1, '09:30', 60, 'confirmed', 'F. Belkacem', 'ECG + consultation'),
      mk(1, '11:00', 30, 'cancelled', 'R. Toumi', 'Consultation'),
      mk(1, '15:00', 30, 'pending', 'Y. Guerroudj', 'Certificat médical'),
      mk(2, '10:30', 30, 'confirmed', 'L. Hamidi', 'Suivi diabète'),
      mk(2, '11:30', 30, 'confirmed', 'O. Ziani', 'Consultation'),
      mk(3, '08:30', 45, 'confirmed', 'B. Mansouri', 'Échographie'),
      mk(3, '10:15', 30, 'pending', 'H. Ferhat', 'Consultation'),
      mk(3, '14:00', 30, 'confirmed', 'D. Ait Ahmed', 'Vaccination'),
      mk(4, '09:00', 30, 'confirmed', 'W. Bouaziz', 'Suivi grossesse'),
      mk(4, '15:30', 30, 'pending', 'I. Khelifi', 'Consultation')
    ];
    var alg = function (dayIdx, h) { var b = addDays(S.weekStart, dayIdx);
      return new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate(), h - 1, 0, 0)); };
    var u1s = alg(2, 14), u1e = alg(2, 18), u2s = alg(4, 11), u2e = alg(4, 12);
    S.unavail = [{ start: u1s, end: u1e, reason: 'Congrès' }, { start: u2s, end: u2e, reason: 'Visite domicile' }];
    return Promise.resolve();
  }

  /* ── Bornes horaires de la grille ───────────────────────────────── */
  function computeBounds() {
    var min = 8 * 60, max = 18 * 60, wh = S.profile && S.profile.working_hours;
    if (wh) {
      var any = false;
      DAY_KEYS.forEach(function (k) {
        (wh[k] || []).forEach(function (r) {
          any = true;
          min = Math.min(min, hmToMin(r.open)); max = Math.max(max, hmToMin(r.close));
        });
      });
      if (!any) { min = 8 * 60; max = 18 * 60; }
    }
    S.appts.forEach(function (a) {
      var s = tzMin(a.start);
      min = Math.min(min, Math.floor(s / 60) * 60);
      max = Math.max(max, Math.ceil((s + a.durMin) / 60) * 60);
    });
    S.boundsMin = Math.max(0, min); S.boundsMax = Math.min(24 * 60, Math.max(max, min + 120));
  }

  /* ── Rendu ──────────────────────────────────────────────────────── */
  function statusLabel(s) { return t('ag_status_' + s); }

  function render() {
    computeBounds();
    var grid = document.getElementById('ag-grid'); if (!grid) return;
    var L = lang(), px = S.pxPerMin, m0 = S.boundsMin, m1 = S.boundsMax, H = (m1 - m0) * px;
    var fmtDay = new Intl.DateTimeFormat(L === 'ar' ? 'ar-DZ' : (L === 'en' ? 'en-GB' : 'fr-FR'), { weekday: 'short', day: 'numeric' });
    var fmtLbl = new Intl.DateTimeFormat(L === 'ar' ? 'ar-DZ' : (L === 'en' ? 'en-GB' : 'fr-FR'), { day: 'numeric', month: 'short', year: 'numeric' });
    var todayIso = fmtDateISO(new Date());

    document.getElementById('ag-week-label').textContent =
      fmtLbl.format(S.weekStart) + ' — ' + fmtLbl.format(addDays(S.weekStart, 6));

    var html = '<div class="ag-corner"></div>';
    for (var i = 0; i < 7; i++) {
      var d = addDays(S.weekStart, i);
      html += '<div class="ag-dayhead' + (fmtDateISO(d) === todayIso ? ' today' : '') + '">' + esc(fmtDay.format(d)) + '</div>';
    }

    // Colonne des heures
    html += '<div class="ag-hours" style="height:' + H + 'px">';
    for (var m = Math.ceil(m0 / 60) * 60; m <= m1; m += 60) {
      html += '<div class="ag-hlabel" style="top:' + ((m - m0) * px) + 'px">' + fmtHM(m) + '</div>';
    }
    html += '</div>';

    var wh = S.profile && S.profile.working_hours;
    var now = new Date(); var nowMin = tzMin(now); var nowIso = tzDayIso(now);

    for (i = 0; i < 7; i++) {
      d = addDays(S.weekStart, i);
      var dayIso = fmtDateISO(d);
      html += '<div class="ag-daycol' + (dayIso === todayIso ? ' today' : '') + '" style="height:' + H + 'px" data-day="' + i + '">';
      // Plages d'ouverture teintées
      if (wh) {
        (wh[DAY_KEYS[i]] || []).forEach(function (r) {
          var a = Math.max(hmToMin(r.open), m0), b = Math.min(hmToMin(r.close), m1);
          if (b > a) html += '<div class="ag-work" title="' + esc(t('ag_work')) + '" style="top:' + ((a - m0) * px) + 'px;height:' + ((b - a) * px) + 'px"></div>';
        });
      }
      // Lignes horaires
      for (m = Math.ceil(m0 / 60) * 60; m < m1; m += 60) {
        html += '<div class="ag-hline" style="top:' + ((m - m0) * px) + 'px"></div>';
      }
      // Indisponibilités hachurées
      S.unavail.forEach(function (u) {
        if (tzDayIso(u.start) > dayIso || tzDayIso(u.end) < dayIso) return;
        var a = (tzDayIso(u.start) === dayIso) ? tzMin(u.start) : m0;
        var b = (tzDayIso(u.end) === dayIso) ? tzMin(u.end) : m1;
        a = Math.max(a, m0); b = Math.min(b, m1);
        if (b > a) html += '<div class="ag-block" style="top:' + ((a - m0) * px) + 'px;height:' + ((b - a) * px) + 'px" title="' + esc(t('ag_unavailable') + (u.reason ? ' — ' + u.reason : '')) + '"><span>' + esc(u.reason || t('ag_unavailable')) + '</span></div>';
      });
      // RDV du jour (clusters de chevauchement → colonnes côte à côte)
      var dayAppts = S.appts.filter(function (a) { return tzDayIso(a.start) === dayIso; });
      var placed = layoutDay(dayAppts);
      placed.forEach(function (pl) {
        var a = pl.appt;
        var sMin = tzMin(a.start);
        var top = (Math.max(sMin, m0) - m0) * px;
        var h = Math.max(a.durMin * px, 20);
        var wPct = 100 / pl.cols, xPct = pl.col * wPct;
        html += '<button type="button" class="ag-appt ' + esc(a.status) + (S.selected === a.id ? ' sel' : '') + '"' +
          ' style="top:' + top + 'px;height:' + h + 'px;inset-inline-start:' + xPct + '%;width:calc(' + wPct + '% - 3px)"' +
          ' data-appt="' + esc(a.id) + '" title="' + esc(a.patient + ' · ' + fmtHM(sMin) + ' · ' + statusLabel(a.status)) + '">' +
          '<span class="ag-appt-t">' + fmtHM(sMin) + '</span> <span class="ag-appt-n">' + esc(a.patient) + '</span>' +
          '</button>';
      });
      // Ligne "maintenant"
      if (dayIso === nowIso && nowMin >= m0 && nowMin <= m1) {
        html += '<div class="ag-now" style="top:' + ((nowMin - m0) * px) + 'px"></div>';
      }
      html += '</div>';
    }
    grid.innerHTML = html;
    grid.style.setProperty('--ag-h', H + 'px');

    var stat = document.getElementById('ag-status');
    if (stat) stat.textContent = S.appts.length ? '' : t('ag_empty');

    // Traduction des éléments statiques ag_* (clés absentes de tabibi-i18n.js,
    // donc non couvertes par le moteur global au changement de langue)
    document.querySelectorAll('[data-i18n^="ag_"]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    var demoB = document.getElementById('ag-demo-banner');
    if (demoB && demoB.style.display !== 'none') demoB.textContent = t('ag_demo');

    // Délégation clic RDV
    grid.querySelectorAll('.ag-appt').forEach(function (el) {
      el.addEventListener('click', function () { select(el.getAttribute('data-appt')); });
    });
  }

  /* Chevauchements : algo glouton par colonnes (suffisant cabinet) */
  function layoutDay(appts) {
    var sorted = appts.slice().sort(function (a, b) { return a.start - b.start; });
    var clusters = [], cur = null, curEnd = -1;
    sorted.forEach(function (a) {
      var s = a.start.getTime(), e = s + a.durMin * 60000;
      if (!cur || s >= curEnd) { cur = []; clusters.push(cur); curEnd = e; }
      else { curEnd = Math.max(curEnd, e); }
      cur.push(a);
    });
    var out = [];
    clusters.forEach(function (cl) {
      var colEnds = [];
      cl.forEach(function (a) {
        var s = a.start.getTime(), e = s + a.durMin * 60000, col = 0;
        while (col < colEnds.length && colEnds[col] > s) col++;
        colEnds[col] = e;
        out.push({ appt: a, col: col, colsRef: colEnds });
      });
      var n = colEnds.length;
      out.forEach(function (p) { if (p.colsRef === colEnds) p.cols = n; });
    });
    return out;
  }

  /* ── Sélection + actions (bandeau détail, lot 2) ────────────────── */
  function select(id) {
    S.selected = id;
    var a = S.appts.filter(function (x) { return String(x.id) === String(id); })[0];
    var box = document.getElementById('ag-detail'); if (!box) return;
    if (!a) { box.hidden = true; render(); return; }
    var sMin = tzMin(a.start);
    var L = lang();
    var fmtD = new Intl.DateTimeFormat(L === 'ar' ? 'ar-DZ' : (L === 'en' ? 'en-GB' : 'fr-FR'), { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
    box.hidden = false;
    box.innerHTML =
      '<div class="ag-card">' +
        '<div class="ag-card-top">' +
          '<span class="status-pill ' + esc(a.status) + '">' + esc(statusLabel(a.status)) + '</span>' +
          '<span class="ag-card-when"><bdi>' + fmtHM(sMin) + '</bdi> · ' + a.durMin + ' ' + t('ag_min') + '</span>' +
        '</div>' +
        '<div class="ag-card-name">' + esc(a.patient) + '</div>' +
        '<div style="font-size:12px;color:var(--text3)">' + esc(fmtD.format(a.start)) + '</div>' +
        '<div class="ag-card-rows">' +
          (a.doctor ? '<div class="r"><i class="fa fa-user-doctor"></i> ' + esc(a.doctor) + '</div>' : '') +
          (a.reason ? '<div class="r"><i class="fa fa-tag"></i> ' + esc(a.reason) + '</div>' : '') +
          (a.phone ? '<div class="r"><i class="fa fa-phone"></i> <bdi>' + esc(a.phone) + '</bdi></div>' : '') +
        '</div>' +
        '<div class="ag-card-actions">' +
          (a.status === 'pending' ? '<button class="btn" style="background:#0F7560;color:#fff" onclick="tabibiAgenda.setStatus(\'' + esc(a.id) + '\',\'confirmed\')"><i class="fa fa-check"></i> ' + t('ag_confirm') + '</button>' : '') +
          (a.status !== 'cancelled' && a.status !== 'completed' ? '<button class="btn" style="background:#fff0f0;color:#D21010" onclick="tabibiAgenda.setStatus(\'' + esc(a.id) + '\',\'cancelled\')"><i class="fa fa-times"></i> ' + t('ag_cancel') + '</button>' : '') +
          '<button class="btn btn-ghost" onclick="tabibiAgenda.closeDetail()">' + t('ag_close') + '</button>' +
        '</div>' +
      '</div>';
    render();
  }

  function closeDetail() { S.selected = null; var b = document.getElementById('ag-detail'); if (b) b.hidden = true; render(); }

  function setStatus(id, status) {
    if (status === 'cancelled' && !window.confirm(t('ag_cancel_ask'))) return;
    if (S.mode === 'demo') { // pas de réseau : mutation locale pour la démo
      S.appts.forEach(function (a) { if (String(a.id) === String(id)) a.status = status; });
      select(id); return;
    }
    var c = sb(); if (!c) return;
    // Action EXISTANTE (identique à setStatus de secretaire-dashboard) :
    c.from('appointments').update({ status: status }).eq('id', id).then(function (r) {
      if (r.error) { alert(t('ag_err') + r.error.message); return; }
      return refresh().then(function () { select(id); });
    });
  }

  /* ── Navigation / filtres ───────────────────────────────────────── */
  function refresh() {
    var st = document.getElementById('ag-status'); if (st) st.textContent = t('ag_loading');
    return loadWeek().then(render, function (e) {
      if (st) st.textContent = t('ag_err') + (e && e.message || e);
      render();
    });
  }
  function navWeek(delta) { S.weekStart = addDays(S.weekStart, delta * 7); closeDetail(); refresh(); }
  function goToday() { S.weekStart = startOfWeek(new Date()); closeDetail(); refresh(); }
  function setDoctor(v) { S.filterDoctor = v; refresh(); }
  function logout() {
    var c = sb();
    (c ? c.auth.signOut() : Promise.resolve()).then(function () { location.href = 'login.html'; });
  }

  /* ── Init ───────────────────────────────────────────────────────── */
  function init() {
    resolveMode().then(function () {
      var sub = document.getElementById('ag-ctx-sub');
      if (sub) sub.textContent = S.mode === 'cabinet' ? (S.cabinetName || 'Cabinet') : (S.mode === 'demo' ? 'Démo' : 'Dr');
      if (S.mode === 'demo') { var b = document.getElementById('ag-demo-banner'); if (b) { b.style.display = ''; b.textContent = t('ag_demo'); } }
      if (S.mode === 'cabinet' && S.doctors.length > 1) {
        var sel = document.getElementById('ag-doctor-filter');
        sel.style.display = '';
        sel.innerHTML = '<option value="all">' + esc(t('ag_all_doctors')) + '</option>' +
          S.doctors.map(function (d) { return '<option value="' + esc(d.user_id) + '">' + esc(d.full_name) + '</option>'; }).join('');
      }
      return refresh();
    }).catch(function (e) {
      var st = document.getElementById('ag-status');
      if (st) st.textContent = t('ag_err') + (e && e.message || e);
    });
    // Re-rendu au changement de langue (labels + Intl + RTL)
    document.addEventListener('tabibi:lang-change', function () { render(); });
    window.addEventListener('resize', function () { /* grille fluide, rien à faire */ });
  }

  window.tabibiAgenda = { navWeek: navWeek, goToday: goToday, setDoctor: setDoctor,
    setStatus: setStatus, closeDetail: closeDetail, logout: logout, _state: S };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
