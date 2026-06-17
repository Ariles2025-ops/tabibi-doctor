/* ====================================================================
 * Tabibi — tabibiDoctorName (helper formatage nom médecin)
 * --------------------------------------------------------------------
 * Phase 5.2.3-fix (PROGRESS.md) — 2026-05-22
 *
 * Helper PARTAGÉ pour formater le nom d'un profil médecin/clinique/labo.
 * Remplace la fonction _anonymizeName() obsolète qui découpait char-par-char
 * et produisait "Dr O. D. C." pour "Ouanza Dental Clinic".
 *
 * Spec utilisateur :
 *   • Si full_name existe non-vide → "Dr. ${full_name}" tel quel
 *   • Sinon si full_name_ar existe → "Dr. ${full_name_ar}"
 *   • Sinon → "Praticien" (sans préfixe)
 *   • Préfixe "Dr." UNIQUEMENT pour entity_type = médecin
 *   • Clinique / Laboratoire / Cabinet → pas de préfixe
 *
 * API publique (window.tabibiDoctorName) :
 *   • format(profile)            → string avec préfixe approprié
 *   • formatForLang(profile, lang) → idem, choisit full_name vs full_name_ar
 *                                    selon lang ('ar' privilégie l'arabe)
 *   • rawName(profile)           → string sans préfixe
 *   • initials(profile)          → 2 lettres maj pour avatar
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';

  if (window.tabibiDoctorName && typeof window.tabibiDoctorName.dirFor === 'function') {
    return;
  }

  // entity_type pour lesquels on N'AJOUTE PAS le préfixe "Dr."
  // Variantes FR + EN + capitalisation tolérées (lowercase via _norm).
  var NON_DOCTOR_ENTITIES = [
    'clinique', 'clinic',
    'laboratoire', 'laboratory', 'lab',
    'cabinet',
    'centre', 'center', 'centre_medical', 'medical_center',
    'pharmacie', 'pharmacy',
    'hopital', 'hôpital', 'hospital',
    // [Phase 13] Valeurs DB live confirmées : doctor (préfixe "Dr."),
    // pharmacy/optician/clinic/dentist/lab (autres). On range optician
    // côté NON_DOCTOR (opticien = profession non médicale). dentist reste
    // doctor par défaut (personne physique exerçant) → préfixe "Dr.".
    'optician', 'opticien',
    // [clean] valeurs base supplémentaires (non-docteur → pas de "Dr.")
    'paramedical', 'health_center'
  ];

  function _norm(t) {
    return String(t == null ? '' : t).toLowerCase().trim();
  }

  // Choisit le nom selon la langue, avec fallback sur l'autre langue.
  function _pickName(profile, lang) {
    if (!profile) return '';
    var fn   = (profile.full_name    || '').trim();
    var fnAr = (profile.full_name_ar || '').trim();
    if (lang === 'ar') return fnAr || fn;
    return fn || fnAr;
  }

  // Retourne le nom brut sans préfixe (fallback "Praticien" si tout est vide).
  function rawName(profile, lang) {
    var n = _pickName(profile, lang || 'fr');
    if (!n) return 'Praticien';
    // Strip un éventuel préfixe "Dr." déjà présent pour éviter "Dr. Dr. X"
    var name = n.replace(/^(Dr\.?|Docteur)\s+/i, '').trim();
    // [clean-display] Nettoie les caractères parasites — AFFICHAGE SEULEMENT,
    // ne réécrit JAMAIS profile.full_name ni la base.
    name = String(name)
      .replace(/^[\s\-–—_.،٫ـ]+/, '')   // vire parasites EN TÊTE
      .replace(/[\s\-–—_.،٫ـ]+$/, '')   // vire parasites EN FIN
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!name) name = 'Praticien';
    return name;
  }

  // Décide si on doit préfixer "Dr." selon entity_type.
  // Défaut (entity_type absent ou inconnu) = médecin → préfixe.
  function _shouldPrefix(profile) {
    var et = _norm(profile && profile.entity_type);
    if (!et) return true;                              // inconnu → Dr.
    return NON_DOCTOR_ENTITIES.indexOf(et) === -1;
  }

  // Format principal — fr par défaut.
  function format(profile) {
    return formatForLang(profile, 'fr');
  }

  function formatForLang(profile, lang) {
    var name = rawName(profile, lang);
    if (name === 'Praticien') return name;             // pas de préfixe sur fallback
    if (!_shouldPrefix(profile)) return name;          // clinique/labo → pas de Dr.
    return 'Dr. ' + name;
  }

  // Initiales pour avatar : 2 lettres max, à partir du nom brut (sans "Dr.").
  // Préserve l'Unicode (caractères arabes, accents, etc.) via Array.from.
  function initials(profile, lang) {
    var name = rawName(profile, lang);
    if (!name || name === 'Praticien') return '?';
    var parts = name.split(/\s+/).filter(Boolean);
    var a = parts[0] ? Array.from(parts[0])[0] : '';
    var b = parts[1] ? Array.from(parts[1])[0] : '';
    var s = (a + b);
    return s ? s.toUpperCase() : '?';
  }

  // [RTL] true si la chaîne contient au moins un caractère arabe (plage U+0600–U+06FF).
  function isArabic(str) {
    return /[\u0600-\u06FF]/.test(String(str || ''));
  }

  // [RTL] direction d'écriture pour le nom RÉELLEMENT rendu (rawName, mode fr par défaut).
  function dirFor(profile) {
    return isArabic(rawName(profile)) ? 'rtl' : 'ltr';
  }

  window.tabibiDoctorName = {
    format: format,
    formatForLang: formatForLang,
    rawName: rawName,
    initials: initials,
    isArabic: isArabic,
    dirFor: dirFor,
    // Exposé pour debug / extension future
    _NON_DOCTOR_ENTITIES: NON_DOCTOR_ENTITIES.slice()
  };
})();
