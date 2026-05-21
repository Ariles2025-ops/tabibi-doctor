/**
 * Tabibi — Module Avis (Reviews) v1.0
 * ════════════════════════════════════════════════════════════════════════
 * Charge APRÈS : config.js, supabase-client.js, auth.js, tabibi-security.js
 *
 * Expose :
 *   window.tabibi.reviews — API
 *   window.tabibiReviewsUI — Composants UI (renderStars, renderForm, etc.)
 *
 * Workflow :
 *   1. Patient consulte un médecin → RDV passe status='completed' (par médecin)
 *   2. Dashboard patient affiche bouton "Noter ce médecin"
 *   3. Patient soumet l'avis → status='pending' (invisible)
 *   4. Admin valide via admin-dashboard → status='published'
 *   5. Avis affiché anonymisé sur la fiche médecin
 * ════════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (!window.tabibi || !window.tabibi.supabase) {
    console.error('[Tabibi/reviews] supabase-client.js non chargé');
    return;
  }
  const sb = window.tabibi.supabase;
  const esc = window.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

  // ──────────────────────────────────────────────────────────────────────
  // I18N
  // ──────────────────────────────────────────────────────────────────────
  const T = {
    fr: {
      verified: 'Patient vérifié',
      overall: 'Note globale',
      punctuality: 'Ponctualité',
      listening: 'Écoute',
      expertise: 'Expertise',
      comment_label: 'Commentaire (optionnel)',
      comment_placeholder: 'Décrivez votre expérience en quelques mots…',
      submit: 'Publier mon avis',
      submitting: 'Envoi…',
      thanks_title: 'Merci pour votre avis',
      thanks_text: 'Votre avis sera publié après validation par notre équipe. Cela prend généralement moins de 24h.',
      no_reviews: 'Aucun avis pour le moment',
      based_on: 'avis',
      report: 'Signaler',
      report_title: 'Signaler cet avis',
      report_reasons: { inappropriate: 'Inapproprié', spam: 'Spam', false: 'Informations fausses', offensive: 'Offensant', personal_data: 'Données personnelles', other: 'Autre' },
      report_submit: 'Envoyer le signalement',
      report_sent: 'Signalement envoyé. Merci.',
      pending: 'En attente de modération',
      rejected: 'Avis refusé',
      flagged: 'Avis signalé',
      already_reviewed: 'Vous avez déjà noté ce médecin',
      no_appointment: 'Vous devez avoir consulté ce médecin avant de pouvoir le noter',
      char_min: 'Minimum 10 caractères',
      error_generic: 'Une erreur est survenue, réessayez plus tard'
    },
    ar: {
      verified: 'مريض موثق',
      overall: 'التقييم العام',
      punctuality: 'الالتزام بالمواعيد',
      listening: 'الإصغاء',
      expertise: 'الخبرة',
      comment_label: 'تعليق (اختياري)',
      comment_placeholder: 'صف تجربتك بكلمات قليلة…',
      submit: 'نشر تقييمي',
      submitting: 'جارٍ الإرسال…',
      thanks_title: 'شكراً على تقييمك',
      thanks_text: 'سيتم نشر تقييمك بعد التحقق من قبل فريقنا. عادةً ما يستغرق ذلك أقل من 24 ساعة.',
      no_reviews: 'لا توجد تقييمات حتى الآن',
      based_on: 'تقييم',
      report: 'إبلاغ',
      report_title: 'الإبلاغ عن هذا التقييم',
      report_reasons: { inappropriate: 'غير مناسب', spam: 'بريد مزعج', false: 'معلومات خاطئة', offensive: 'مسيء', personal_data: 'بيانات شخصية', other: 'أخرى' },
      report_submit: 'إرسال البلاغ',
      report_sent: 'تم إرسال البلاغ. شكراً.',
      pending: 'في انتظار المراجعة',
      rejected: 'تم رفض التقييم',
      flagged: 'تم الإبلاغ عن التقييم',
      already_reviewed: 'لقد قيّمت هذا الطبيب من قبل',
      no_appointment: 'يجب استشارة هذا الطبيب قبل تقييمه',
      char_min: '10 أحرف على الأقل',
      error_generic: 'حدث خطأ، حاول لاحقاً'
    },
    en: {
      verified: 'Verified patient',
      overall: 'Overall rating',
      punctuality: 'Punctuality',
      listening: 'Listening',
      expertise: 'Expertise',
      comment_label: 'Comment (optional)',
      comment_placeholder: 'Describe your experience in a few words…',
      submit: 'Publish my review',
      submitting: 'Sending…',
      thanks_title: 'Thanks for your review',
      thanks_text: 'Your review will be published after validation by our team. Usually within 24h.',
      no_reviews: 'No reviews yet',
      based_on: 'reviews',
      report: 'Report',
      report_title: 'Report this review',
      report_reasons: { inappropriate: 'Inappropriate', spam: 'Spam', false: 'False information', offensive: 'Offensive', personal_data: 'Personal data', other: 'Other' },
      report_submit: 'Send report',
      report_sent: 'Report sent. Thanks.',
      pending: 'Awaiting moderation',
      rejected: 'Review rejected',
      flagged: 'Review flagged',
      already_reviewed: 'You have already reviewed this doctor',
      no_appointment: 'You must have consulted this doctor before reviewing',
      char_min: 'Minimum 10 characters',
      error_generic: 'An error occurred, please try again later'
    }
  };
  function getLang() {
    try { const l = localStorage.getItem('tabibi_lang'); if (['fr','ar','en'].includes(l)) return l; } catch(e) {}
    return (navigator.language || '').startsWith('ar') ? 'ar' : 'fr';
  }
  function t() { return T[getLang()] || T.fr; }

  // ──────────────────────────────────────────────────────────────────────
  // API
  // ──────────────────────────────────────────────────────────────────────
  const api = {
    async canReview(doctorId) {
      const { data, error } = await sb.rpc('can_review_doctor', { p_doctor_id: doctorId });
      if (error) { console.error('[reviews] canReview', error); return { can_review: false, reason: 'error' }; }
      return data;
    },
    async getDoctorReviews(doctorId, { limit = 20, offset = 0 } = {}) {
      const { data, error, count } = await sb
        .from('doctor_reviews_public')
        .select('*', { count: 'exact' })
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) { console.error('[reviews] getDoctorReviews', error); return { data: [], count: 0 }; }
      return { data: data || [], count: count || 0 };
    },
    async getDoctorRatingSummary(doctorId) {
      const { data, error } = await sb
        .from('doctor_ratings_summary')
        .select('*')
        .eq('doctor_id', doctorId)
        .maybeSingle();
      if (error) { console.error('[reviews] summary', error); return null; }
      return data;
    },
    async submitReview({ doctorId, appointmentId = null, ratingOverall, ratingPunctuality, ratingListening, ratingExpertise, comment = null }) {
      const session = await window.tabibi.auth.getSession();
      if (!session) throw new Error('not_authenticated');

      const payload = {
        patient_id: session.user.id,
        doctor_id: doctorId,
        appointment_id: appointmentId,
        rating_overall: ratingOverall,
        rating_punctuality: ratingPunctuality || null,
        rating_listening: ratingListening || null,
        rating_expertise: ratingExpertise || null,
        comment: (comment && comment.trim().length >= 10) ? comment.trim() : null,
        status: 'pending',
        language: getLang()
      };

      const { data, error } = await sb.from('reviews').insert(payload).select().single();
      if (error) { console.error('[reviews] submit', error); throw error; }
      return data;
    },
    async getMyReviewableAppointments() {
      const { data, error } = await sb.from('my_reviewable_appointments').select('*');
      if (error) { console.error('[reviews] reviewable', error); return []; }
      return data || [];
    },
    async getMyReviews() {
      const session = await window.tabibi.auth.getSession();
      if (!session) return [];
      const { data, error } = await sb.from('reviews').select('*').eq('patient_id', session.user.id).order('created_at', { ascending: false });
      if (error) { console.error('[reviews] mine', error); return []; }
      return data || [];
    },
    async reportReview(reviewId, reason, details = null) {
      const session = await window.tabibi.auth.getSession();
      if (!session) throw new Error('not_authenticated');
      const { data, error } = await sb.from('review_reports').insert({
        review_id: reviewId,
        reporter_id: session.user.id,
        reason,
        details: details ? details.substring(0, 500) : null
      }).select().single();
      if (error) { console.error('[reviews] report', error); throw error; }
      return data;
    },
    // ADMIN
    async getPendingReviews({ limit = 50 } = {}) {
      const { data, error } = await sb.from('reviews').select('*').in('status', ['pending', 'flagged']).order('created_at', { ascending: true }).limit(limit);
      if (error) { console.error('[reviews] pending', error); return []; }
      return data || [];
    },
    async moderate(reviewId, newStatus, rejectionReason = null) {
      if (!['published', 'rejected', 'archived'].includes(newStatus)) {
        throw new Error('Invalid status');
      }
      const session = await window.tabibi.auth.getSession();
      const { data, error } = await sb.from('reviews').update({
        status: newStatus,
        rejection_reason: rejectionReason,
        moderated_by: session?.user?.id,
        moderated_at: new Date().toISOString()
      }).eq('id', reviewId).select().single();
      if (error) { console.error('[reviews] moderate', error); throw error; }
      return data;
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // UI : Composant Étoiles (affichage)
  // ──────────────────────────────────────────────────────────────────────
  function renderStars(rating, { max = 5, size = 16, showValue = false, color = '#fbbf24' } = {}) {
    const r = Math.max(0, Math.min(max, Number(rating) || 0));
    const full = Math.floor(r);
    const half = (r - full) >= 0.5;
    const empty = max - full - (half ? 1 : 0);

    let html = `<span class="tabibi-stars" style="display:inline-flex;align-items:center;gap:2px;font-size:${size}px;color:${color};line-height:1;vertical-align:middle">`;
    for (let i = 0; i < full; i++) html += `<i class="fa fa-star"></i>`;
    if (half) html += `<i class="fa fa-star-half-stroke"></i>`;
    for (let i = 0; i < empty; i++) html += `<i class="fa-regular fa-star" style="color:#d1d5db"></i>`;
    if (showValue) html += `<span style="color:#0f172a;font-weight:700;margin-left:6px;font-size:${size}px">${r.toFixed(1)}</span>`;
    html += `</span>`;
    return html;
  }

  // Étoiles interactives (sélection note)
  function renderInteractiveStars(name, currentValue = 0, { max = 5, size = 28, onChange = null } = {}) {
    const id = 'stars-' + Math.random().toString(36).slice(2, 9);
    let html = `<div class="tabibi-stars-input" data-name="${esc(name)}" data-value="${currentValue}" id="${id}" style="display:inline-flex;gap:6px;font-size:${size}px;cursor:pointer">`;
    for (let i = 1; i <= max; i++) {
      const filled = i <= currentValue;
      html += `<i class="fa-${filled ? 'solid' : 'regular'} fa-star" data-val="${i}" style="color:${filled ? '#fbbf24' : '#d1d5db'};transition:transform .1s"></i>`;
    }
    html += `</div>`;

    // Bind après injection dans le DOM
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const stars = el.querySelectorAll('i');
      function paint(val) {
        stars.forEach(s => {
          const v = parseInt(s.dataset.val, 10);
          s.className = 'fa-' + (v <= val ? 'solid' : 'regular') + ' fa-star';
          s.style.color = v <= val ? '#fbbf24' : '#d1d5db';
        });
      }
      stars.forEach(s => {
        s.addEventListener('mouseenter', () => paint(parseInt(s.dataset.val, 10)));
        s.addEventListener('click', () => {
          const v = parseInt(s.dataset.val, 10);
          el.dataset.value = v;
          paint(v);
          if (onChange) onChange(v);
        });
      });
      el.addEventListener('mouseleave', () => paint(parseInt(el.dataset.value, 10)));
    }, 0);

    return html;
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI : Résumé du rating médecin (étoiles + distribution)
  // ──────────────────────────────────────────────────────────────────────
  function renderRatingSummary(summary, { lang = getLang() } = {}) {
    const tr = T[lang] || T.fr;
    if (!summary || !summary.total_reviews) {
      return `<div class="tabibi-no-reviews" style="text-align:center;color:#64748b;padding:24px;font-size:14px"><i class="fa fa-comment-slash" style="font-size:32px;color:#cbd5e1;display:block;margin-bottom:8px"></i>${esc(tr.no_reviews)}</div>`;
    }
    const total = summary.total_reviews;
    const bar = (n) => {
      const pct = total > 0 ? (n / total) * 100 : 0;
      return `<div style="background:#e2e8f0;height:6px;border-radius:3px;overflow:hidden;flex:1"><div style="background:#fbbf24;height:100%;width:${pct}%"></div></div>`;
    };

    return `
      <div class="tabibi-rating-summary" style="display:flex;flex-direction:column;gap:16px;padding:16px;background:#f8fafc;border-radius:12px">
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-size:42px;font-weight:800;color:#0f172a;line-height:1">${Number(summary.avg_overall).toFixed(1)}</div>
            <div style="margin:6px 0">${renderStars(summary.avg_overall, { size: 16 })}</div>
            <div style="font-size:12px;color:#64748b">${total} ${esc(tr.based_on)}</div>
          </div>
          <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:6px">
            ${[5,4,3,2,1].map(n => `
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#475569">
                <span style="width:14px">${n}</span>
                <i class="fa fa-star" style="color:#fbbf24;font-size:11px"></i>
                ${bar(summary['count_' + n] || 0)}
                <span style="width:24px;text-align:right;color:#94a3b8">${summary['count_' + n] || 0}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:12px;border-top:1px solid #e2e8f0">
          ${['punctuality','listening','expertise'].map(k => `
            <div style="text-align:center">
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">${esc(tr[k])}</div>
              <div style="font-weight:700;color:#0f172a">${summary['avg_' + k] ? Number(summary['avg_' + k]).toFixed(1) : '—'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI : Liste d'avis
  // ──────────────────────────────────────────────────────────────────────
  function renderReviewsList(reviews, { lang = getLang(), allowReport = true } = {}) {
    const tr = T[lang] || T.fr;
    if (!reviews || !reviews.length) return '';
    return reviews.map(r => {
      const date = new Date(r.created_at);
      const dateStr = date.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : (lang === 'en' ? 'en-US' : 'fr-DZ'), { year: 'numeric', month: 'long' });
      return `
        <div class="tabibi-review" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                ${renderStars(r.rating_overall, { size: 14 })}
                ${r.is_verified ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px"><i class="fa fa-check-circle"></i> ${esc(tr.verified)}</span>` : ''}
              </div>
              <div style="font-size:13px;color:#64748b">${esc(dateStr)}</div>
            </div>
            ${allowReport ? `<button onclick="tabibiReviewsUI.openReportModal('${esc(r.id)}')" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 8px"><i class="fa fa-flag"></i> ${esc(tr.report)}</button>` : ''}
          </div>
          ${r.comment ? `<p style="margin-top:10px;color:#334155;line-height:1.55;font-size:14px;white-space:pre-wrap">${esc(r.comment)}</p>` : ''}
          <div style="display:flex;gap:12px;margin-top:10px;font-size:12px;color:#64748b;flex-wrap:wrap">
            ${r.rating_punctuality ? `<span><i class="fa fa-clock"></i> ${esc(tr.punctuality)}: <b>${r.rating_punctuality}/5</b></span>` : ''}
            ${r.rating_listening ? `<span><i class="fa fa-ear-listen"></i> ${esc(tr.listening)}: <b>${r.rating_listening}/5</b></span>` : ''}
            ${r.rating_expertise ? `<span><i class="fa fa-user-doctor"></i> ${esc(tr.expertise)}: <b>${r.rating_expertise}/5</b></span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI : Formulaire de soumission d'avis (modal)
  // ──────────────────────────────────────────────────────────────────────
  function openReviewModal(doctorId, doctorName = '', appointmentId = null) {
    const tr = t();
    const modal = document.createElement('div');
    modal.id = 'tabibi-review-modal';
    modal.innerHTML = `
      <style>
        #tabibi-review-modal{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
        #tabibi-review-modal .box{background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;position:relative}
        #tabibi-review-modal h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px;display:flex;align-items:center;gap:8px}
        #tabibi-review-modal .subtitle{font-size:13px;color:#64748b;margin-bottom:20px}
        #tabibi-review-modal .close{position:absolute;top:14px;right:14px;background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer}
        #tabibi-review-modal .field{margin-bottom:18px}
        #tabibi-review-modal label{display:block;font-weight:600;font-size:13px;color:#334155;margin-bottom:8px}
        #tabibi-review-modal textarea{width:100%;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;min-height:90px;resize:vertical;color:#0f172a;background:#fff}
        #tabibi-review-modal textarea:focus{outline:none;border-color:#0F7560}
        #tabibi-review-modal .char-count{font-size:11px;color:#94a3b8;margin-top:4px}
        #tabibi-review-modal .btn{background:#0F7560;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;width:100%;margin-top:8px}
        #tabibi-review-modal .btn:disabled{opacity:.5;cursor:not-allowed}
        #tabibi-review-modal .info-box{background:#dcfce7;border-left:4px solid #0F7560;padding:10px 14px;border-radius:8px;font-size:13px;color:#0a4d3e;margin-bottom:16px}
      </style>
      <div class="box" dir="${getLang() === 'ar' ? 'rtl' : 'ltr'}">
        <button class="close" onclick="document.getElementById('tabibi-review-modal').remove()">×</button>
        <h2><i class="fa fa-star" style="color:#fbbf24"></i> ${esc(doctorName || 'Médecin')}</h2>
        <div class="subtitle">${esc(tr.thanks_text)}</div>

        <div class="field">
          <label>${esc(tr.overall)} *</label>
          ${renderInteractiveStars('overall', 0, { size: 32 })}
        </div>
        <div class="field">
          <label>${esc(tr.punctuality)}</label>
          ${renderInteractiveStars('punctuality', 0, { size: 22 })}
        </div>
        <div class="field">
          <label>${esc(tr.listening)}</label>
          ${renderInteractiveStars('listening', 0, { size: 22 })}
        </div>
        <div class="field">
          <label>${esc(tr.expertise)}</label>
          ${renderInteractiveStars('expertise', 0, { size: 22 })}
        </div>
        <div class="field">
          <label>${esc(tr.comment_label)}</label>
          <textarea id="trv-comment" maxlength="1000" placeholder="${esc(tr.comment_placeholder)}"></textarea>
          <div class="char-count"><span id="trv-count">0</span>/1000 — ${esc(tr.char_min)}</div>
        </div>

        <button class="btn" id="trv-submit">${esc(tr.submit)}</button>
        <div id="trv-error" style="color:#dc2626;font-size:13px;margin-top:8px;text-align:center"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const $com = modal.querySelector('#trv-comment');
    const $count = modal.querySelector('#trv-count');
    $com.addEventListener('input', () => { $count.textContent = $com.value.length; });

    modal.querySelector('#trv-submit').addEventListener('click', async () => {
      const $btn = modal.querySelector('#trv-submit');
      const $err = modal.querySelector('#trv-error');
      $err.textContent = '';

      const get = (n) => parseInt(modal.querySelector(`[data-name="${n}"]`).dataset.value, 10) || 0;
      const overall = get('overall');
      if (overall < 1) { $err.textContent = '⚠️ ' + esc(tr.overall) + ' *'; return; }

      const comment = $com.value.trim();
      if (comment.length > 0 && comment.length < 10) { $err.textContent = '⚠️ ' + esc(tr.char_min); return; }

      $btn.disabled = true;
      $btn.textContent = tr.submitting;
      try {
        await api.submitReview({
          doctorId,
          appointmentId,
          ratingOverall: overall,
          ratingPunctuality: get('punctuality') || null,
          ratingListening: get('listening') || null,
          ratingExpertise: get('expertise') || null,
          comment: comment || null
        });
        modal.querySelector('.box').innerHTML = `
          <div style="text-align:center;padding:20px">
            <i class="fa fa-circle-check" style="font-size:48px;color:#10b981;margin-bottom:16px"></i>
            <h2 style="margin-bottom:8px">${esc(tr.thanks_title)}</h2>
            <p style="color:#64748b;font-size:14px">${esc(tr.thanks_text)}</p>
            <button class="btn" onclick="document.getElementById('tabibi-review-modal').remove()" style="margin-top:20px;max-width:200px">OK</button>
          </div>
        `;
        document.dispatchEvent(new CustomEvent('tabibi:review-submitted', { detail: { doctorId } }));
      } catch (e) {
        $btn.disabled = false;
        $btn.textContent = tr.submit;
        const msg = (e?.message || '').includes('uq_review_patient_doctor')
          ? tr.already_reviewed
          : ((e?.message || '').includes('row-level') ? tr.no_appointment : tr.error_generic);
        $err.textContent = '⚠️ ' + msg;
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI : Modal de signalement
  // ──────────────────────────────────────────────────────────────────────
  function openReportModal(reviewId) {
    const tr = t();
    const modal = document.createElement('div');
    modal.id = 'tabibi-report-modal';
    const reasons = Object.entries(tr.report_reasons).map(([k, v]) =>
      `<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px">
        <input type="radio" name="rep-reason" value="${esc(k)}"> ${esc(v)}
      </label>`
    ).join('');
    modal.innerHTML = `
      <style>
        #tabibi-report-modal{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
        #tabibi-report-modal .box{background:#fff;border-radius:16px;max-width:440px;width:100%;padding:24px;position:relative}
        #tabibi-report-modal h2{font-size:18px;font-weight:800;margin:0 0 16px;color:#0f172a}
        #tabibi-report-modal .close{position:absolute;top:14px;right:14px;background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer}
        #tabibi-report-modal textarea{width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-family:inherit;font-size:13px;min-height:60px;margin-top:8px}
        #tabibi-report-modal .btn{background:#dc2626;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;width:100%;margin-top:12px}
      </style>
      <div class="box" dir="${getLang() === 'ar' ? 'rtl' : 'ltr'}">
        <button class="close" onclick="document.getElementById('tabibi-report-modal').remove()">×</button>
        <h2><i class="fa fa-flag" style="color:#dc2626"></i> ${esc(tr.report_title)}</h2>
        ${reasons}
        <textarea id="rep-details" placeholder="Détails (optionnel, max 500 caractères)" maxlength="500"></textarea>
        <button class="btn" id="rep-submit">${esc(tr.report_submit)}</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#rep-submit').addEventListener('click', async () => {
      const checked = modal.querySelector('input[name="rep-reason"]:checked');
      if (!checked) { alert((window.tabibiT?window.tabibiT('alert_select_reason','Sélectionnez un motif'):'Sélectionnez un motif')); return; }
      const details = modal.querySelector('#rep-details').value.trim();
      try {
        await api.reportReview(reviewId, checked.value, details || null);
        modal.querySelector('.box').innerHTML = `<div style="text-align:center;padding:20px"><i class="fa fa-check-circle" style="font-size:40px;color:#10b981"></i><p style="margin-top:12px">${esc(tr.report_sent)}</p><button class="btn" style="background:#0F7560" onclick="document.getElementById('tabibi-report-modal').remove()">OK</button></div>`;
      } catch (e) {
        alert(tr.error_generic);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // EXPORT GLOBAL
  // ──────────────────────────────────────────────────────────────────────
  window.tabibi.reviews = api;
  window.tabibiReviewsUI = {
    renderStars,
    renderInteractiveStars,
    renderRatingSummary,
    renderReviewsList,
    openReviewModal,
    openReportModal,
    t: () => t(),
    setLang: (l) => { try { localStorage.setItem('tabibi_lang', l); } catch(e) {} }
  };

  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
