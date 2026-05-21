/* ═══════════════════════════════════════════════════════════════════════
   TABIBI v10.5 — SERVICE BUDGETSMS (MULTILINGUE + ASCII safe)
   ═══════════════════════════════════════════════════════════════════════

   AMÉLIORATIONS v10.5 :
   ✅ Templates FR/AR/EN
   ✅ Caractères ASCII uniquement (GSM-7) = 160 chars au lieu de 70 en UCS-2
   ✅ Pas d'accents (é→e, à→a, ç→c) = compatible 100% opérateurs DZ
   ✅ Pour AR : utilise translittération latine (Mobilis/Djezzy supportent mal UCS-2 arabe)
   ✅ Sanitization stricte
   ✅ Économie : 1 SMS au lieu de 2 sur messages avec accents

   IMPORTANT : SMS = ressource PAYANTE = admin uniquement
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SMS_CONFIG = {
    enabled: false,
    senderId: 'Tabibi',
    defaultCountryCode: '213',
    maxLength: 160,  // GSM-7 sans encoding spécial
    enableLogging: false
  };

  /**
   * Convertit en ASCII GSM-7 safe (supprime accents, garde lisibilité)
   * Économise 50% du coût SMS (160 chars vs 70 en UCS-2)
   */
  function toGSM7(str) {
    if (!str) return '';
    return String(str)
      // Accents français
      .replace(/[àâä]/gi, 'a').replace(/[éèêë]/gi, 'e')
      .replace(/[îï]/gi, 'i').replace(/[ôö]/gi, 'o')
      .replace(/[ùûü]/gi, 'u').replace(/[ÿ]/gi, 'y')
      .replace(/[ç]/gi, 'c').replace(/[ñ]/gi, 'n')
      // Quotes/dashes "intelligents" → ASCII
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ');  // non-breaking space
  }

  /**
   * Sanitization stricte
   */
  function sanitizeSMS(str) {
    if (str == null) return '';
    return toGSM7(String(str))
      .replace(/[\x00-\x1F\x7F]/g, '')   // Caractères de contrôle
      .replace(/[<>]/g, '')               // Tags HTML
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80);
  }

  /**
   * Normalise un numéro DZ
   */
  function normalizePhoneDZ(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[\s\-\(\)\.+]/g, '');
    if (p.startsWith('00')) p = p.slice(2);
    if (p.startsWith('0')) p = '213' + p.slice(1);
    if (!p.startsWith('213')) {
      if (/^[567]/.test(p) && p.length === 9) p = '213' + p;
      else return null;
    }
    if (!/^213[567]\d{8}$/.test(p)) return null;
    return p;
  }

  /**
   * Templates multilingues — toujours ASCII pour économiser
   */
  const smsTemplates = {
    rdv_reminder_h2: function (data) {
      const lang = data.lang || 'fr';
      const doc = sanitizeSMS(data.doctorName) || 'medecin';
      const time = sanitizeSMS(data.time);
      const addr = sanitizeSMS(data.shortAddress);

      const T = {
        fr: 'Tabibi: RDV dans 2h avec ' + doc + (time ? ' a ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Bon RDV!',
        ar: 'Tabibi: maw3id fi sa3atayn ma3a ' + doc + (time ? ' fi ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Bon RDV!',
        en: 'Tabibi: appt in 2h with ' + doc + (time ? ' at ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Good visit!'
      };
      return T[lang] || T.fr;
    },

    rdv_reminder_j1: function (data) {
      const lang = data.lang || 'fr';
      const doc = sanitizeSMS(data.doctorName) || 'medecin';
      const date = sanitizeSMS(data.date) || 'demain';
      const time = sanitizeSMS(data.time);

      const T = {
        fr: 'Tabibi: rappel RDV ' + date + (time ? ' a ' + time : '') + ' avec ' + doc + '. tabibi.doctor',
        ar: 'Tabibi: tadhkir maw3id ' + date + (time ? ' fi ' + time : '') + ' ma3a ' + doc + '. tabibi.doctor',
        en: 'Tabibi: reminder appt ' + date + (time ? ' at ' + time : '') + ' with ' + doc + '. tabibi.doctor'
      };
      return T[lang] || T.fr;
    },

    otp_code: function (data) {
      const lang = data.lang || 'fr';
      let code = String(data.code || '').replace(/\D/g, '').substring(0, 8);
      if (code.length < 4) code = '000000';

      const T = {
        fr: 'Tabibi: votre code de verification est ' + code + '. Valide 5 min. Ne le partagez jamais.',
        ar: 'Tabibi: rumz at-tahaqquq huwa ' + code + '. Salihun 5 daqa2iq. La tusharikhu abadan.',
        en: 'Tabibi: your verification code is ' + code + '. Valid 5 min. Never share it.'
      };
      return T[lang] || T.fr;
    },

    rdv_canceled_by_doctor: function (data) {
      const lang = data.lang || 'fr';
      const doc = sanitizeSMS(data.doctorName) || 'medecin';
      const date = sanitizeSMS(data.date) || '';

      const T = {
        fr: 'Tabibi: ' + doc + ' a annule ' + (date || 'votre RDV') + '. Reprenez RDV sur tabibi.doctor',
        ar: 'Tabibi: ' + doc + ' algha ' + (date || 'maw3idik') + '. Ihjuz maw3idan jadidan 3ala tabibi.doctor',
        en: 'Tabibi: ' + doc + ' canceled ' + (date || 'your appt') + '. Rebook on tabibi.doctor'
      };
      return T[lang] || T.fr;
    }
  };

  async function sendSMS(templateName, phone, data) {
    data = data || {};
    if (!SMS_CONFIG.enabled) {
      return { success: true, disabled: true };
    }
    if (!smsTemplates[templateName]) {
      return { success: false, error: 'Template SMS inconnu' };
    }
    var normalizedPhone = normalizePhoneDZ(phone);
    if (!normalizedPhone) {
      return { success: false, error: 'Numero DZ invalide' };
    }

    var message = smsTemplates[templateName](data);
    if (message.length > SMS_CONFIG.maxLength) {
      message = message.substring(0, SMS_CONFIG.maxLength);
    }

    try {
      if (!window.tabibi || !window.tabibi.supabase) {
        throw new Error('Supabase client non disponible');
      }
      const { data: result, error } = await window.tabibi.supabase.functions.invoke('send-sms', {
        body: { to: normalizedPhone, message: message, senderId: SMS_CONFIG.senderId }
      });
      if (error) throw error;
      return {
        success: true,
        messageId: result && result.messageId,
        cost: result && result.cost,
        parts: (result && result.parts) || 1
      };
    } catch (err) {
      return { success: false, error: (err && err.message) || 'Erreur d\'envoi SMS' };
    }
  }

  function setEnabled(enabled) {
    SMS_CONFIG.enabled = !!enabled;
  }

  window.tabibiSMS = {
    sendSMS: sendSMS,
    setEnabled: setEnabled,
    normalizePhoneDZ: normalizePhoneDZ,
    toGSM7: toGSM7,
    templates: Object.keys(smsTemplates),
    config: SMS_CONFIG
  };

})();
