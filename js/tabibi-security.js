/**
 * Tabibi — Helper de sécurité côté client (anti-XSS + sanitization)
 *
 * Usage :
 *   ❌ AVANT : el.innerHTML = `<div>${user.name}</div>`
 *   ✅ APRÈS : el.innerHTML = `<div>${escapeHtml(user.name)}</div>`
 *
 * Pour les chaînes contenant volontairement du HTML (rare), utiliser sanitizeHtml().
 *
 * Toutes les fonctions sont exposées globalement via window.tabibiSec.
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ───────────────────────────────────────────────────────────────────────
  // 1. ÉCHAPPEMENT HTML — protection XSS la plus courante
  // ───────────────────────────────────────────────────────────────────────
  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`=\/]/g, ch => HTML_ESCAPES[ch]);
  }

  // ───────────────────────────────────────────────────────────────────────
  // 2. ÉCHAPPEMENT ATTRIBUTE — pour valeurs dans attributs HTML
  // ───────────────────────────────────────────────────────────────────────
  function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/["'<>&]/g, ch => HTML_ESCAPES[ch] || ch);
  }

  // ───────────────────────────────────────────────────────────────────────
  // 3. ÉCHAPPEMENT JS — pour valeurs injectées dans onclick="..."
  // ───────────────────────────────────────────────────────────────────────
  function escapeJsString(str) {
    if (str == null) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E');
  }

  // ───────────────────────────────────────────────────────────────────────
  // 4. ÉCHAPPEMENT URL — pour valeurs dans href ou src
  // ───────────────────────────────────────────────────────────────────────
  function escapeUrl(str) {
    if (str == null) return '';
    const s = String(str).trim();
    // Bloquer javascript:, data:, vbscript:
    if (/^(javascript|data|vbscript|file):/i.test(s)) return '#';
    return encodeURI(s);
  }

  // ───────────────────────────────────────────────────────────────────────
  // 5. SANITIZE HTML — pour cas rare où on doit accepter du HTML utilisateur
  //    Whitelist d'éléments simples (b, i, br, p, ul, li, a sans javascript:)
  // ───────────────────────────────────────────────────────────────────────
  const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'span']);
  function sanitizeHtml(html) {
    if (html == null) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    // Walk all elements and strip dangerous ones
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        toRemove.push(node);
        continue;
      }
      // Strip all attributes (notamment onclick, onerror, style, etc.)
      [...node.attributes].forEach(attr => node.removeAttribute(attr.name));
    }
    toRemove.forEach(n => {
      // Remplacer par le texte uniquement
      const txt = document.createTextNode(n.textContent || '');
      n.parentNode && n.parentNode.replaceChild(txt, n);
    });
    return tmp.innerHTML;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 6. VALIDATION CÔTÉ CLIENT (en + de la validation serveur)
  // ───────────────────────────────────────────────────────────────────────
  function validateEmail(email) {
    if (typeof email !== 'string') return false;
    // RFC 5322 simplifié
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
  }
  function validatePhoneDZ(phone) {
    if (typeof phone !== 'string') return false;
    const clean = phone.replace(/\s|-/g, '');
    // Format DZ : 05XX/06XX/07XX (10 chiffres) ou +213 5/6/7 XX XX XX XX
    return /^(\+213|0)(5|6|7)\d{8}$/.test(clean);
  }
  function validatePassword(pw) {
    if (typeof pw !== 'string') return { ok: false, reason: 'Mot de passe requis' };
    if (pw.length < 8) return { ok: false, reason: 'Au moins 8 caractères requis' };
    if (pw.length > 128) return { ok: false, reason: 'Mot de passe trop long' };
    if (!/[a-z]/.test(pw)) return { ok: false, reason: 'Au moins une minuscule requise' };
    if (!/[A-Z]/.test(pw)) return { ok: false, reason: 'Au moins une majuscule requise' };
    if (!/[0-9]/.test(pw)) return { ok: false, reason: 'Au moins un chiffre requis' };
    return { ok: true };
  }
  function validateName(name) {
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return false;
    // Lettres unicode (FR+AR) + espaces + tirets + apostrophes
    return /^[\p{L}\s\-']+$/u.test(trimmed);
  }
  function validateUuid(id) {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  // ───────────────────────────────────────────────────────────────────────
  // 7. RATE LIMITING CÔTÉ CLIENT (bouclier de surface)
  //    Note : la vraie protection rate limit doit être côté serveur (Edge Function)
  // ───────────────────────────────────────────────────────────────────────
  const _rateBuckets = {};
  function rateLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    const bucket = _rateBuckets[key] || { attempts: [], blocked: 0 };
    // Nettoyer les tentatives hors fenêtre
    bucket.attempts = bucket.attempts.filter(t => now - t < windowMs);
    if (bucket.blocked > now) {
      const sec = Math.ceil((bucket.blocked - now) / 1000);
      return { allowed: false, retryIn: sec, reason: `Trop de tentatives. Réessayez dans ${sec}s.` };
    }
    if (bucket.attempts.length >= maxAttempts) {
      // Backoff exponentiel : 30s × 2^(dépassements)
      bucket.blocked = now + 30000;
      _rateBuckets[key] = bucket;
      return { allowed: false, retryIn: 30, reason: 'Trop de tentatives. Réessayez dans 30s.' };
    }
    bucket.attempts.push(now);
    _rateBuckets[key] = bucket;
    return { allowed: true };
  }

  // ───────────────────────────────────────────────────────────────────────
  // 8. SETTEXT/SETATTR helpers — usage simple à la place de innerHTML
  // ───────────────────────────────────────────────────────────────────────
  function setText(elOrId, text) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.textContent = String(text == null ? '' : text);
  }

  // ───────────────────────────────────────────────────────────────────────
  // EXPORT GLOBAL
  // ───────────────────────────────────────────────────────────────────────
  window.tabibiSec = {
    escapeHtml,
    escapeAttr,
    escapeJsString,
    escapeUrl,
    sanitizeHtml,
    validateEmail,
    validatePhoneDZ,
    validatePassword,
    validateName,
    validateUuid,
    rateLimit,
    setText
  };
  // Raccourcis pratiques
  window.esc = escapeHtml;
  window.escAttr = escapeAttr;
  window.escJs = escapeJsString;
  window.escUrl = escapeUrl;

  /* [FIX-PROD-2026-05-19] log d'initialisation retiré */
})();
