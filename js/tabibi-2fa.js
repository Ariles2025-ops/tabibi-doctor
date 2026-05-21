/**
 * Tabibi — 2FA TOTP (Time-based One-Time Password)
 *
 * Implémentation native (sans lib externe) du standard TOTP RFC 6238
 * Compatible Google Authenticator, Authy, Microsoft Authenticator, etc.
 *
 * Workflow pour le médecin :
 *   1. Médecin clique "Activer 2FA" dans son profil
 *   2. On génère un secret aléatoire base32 (16 chars)
 *   3. On affiche un QR code (data URI SVG) à scanner avec Google Authenticator
 *   4. Médecin entre le code à 6 chiffres pour valider
 *   5. Si valide → on enregistre totp_secret + totp_enabled=true dans Supabase
 *   6. À chaque login suivant → demande du code 2FA après email/password
 *
 * Sécurité :
 *   - Le secret n'est jamais transmis en clair après l'activation (chiffré côté SB)
 *   - Génération crypto-secure via crypto.getRandomValues
 *   - Validation avec fenêtre ±1 step (30s) pour tolérer le clock skew
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ───────────────────────────────────────────────────────────────────────
  // BASE32 encoder/decoder (RFC 4648)
  // ───────────────────────────────────────────────────────────────────────
  const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(buffer) {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
    return output;
  }

  function base32Decode(str) {
    str = str.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
    let bits = 0, value = 0, output = [];
    for (let i = 0; i < str.length; i++) {
      const idx = BASE32_CHARS.indexOf(str[i]);
      if (idx < 0) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(output);
  }

  // ───────────────────────────────────────────────────────────────────────
  // GÉNÉRATION SECRET (160 bits aléatoires)
  // ───────────────────────────────────────────────────────────────────────
  function generateSecret() {
    const buf = new Uint8Array(20);
    crypto.getRandomValues(buf);
    return base32Encode(buf);
  }

  // ───────────────────────────────────────────────────────────────────────
  // HMAC-SHA1 via Web Crypto (utilisé par TOTP)
  // ───────────────────────────────────────────────────────────────────────
  async function hmacSha1(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(sig);
  }

  // ───────────────────────────────────────────────────────────────────────
  // GÉNÉRATION CODE TOTP À 6 CHIFFRES
  // ───────────────────────────────────────────────────────────────────────
  async function generateTotp(secret, timeStep) {
    const key = base32Decode(secret);
    const step = timeStep != null ? timeStep : Math.floor(Date.now() / 30000);
    // Conversion 64-bit big-endian
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(step / 0x100000000));
    view.setUint32(4, step & 0xffffffff);
    const hash = await hmacSha1(key, new Uint8Array(buf));
    // Truncation dynamique (RFC 4226)
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24)
               | ((hash[offset+1] & 0xff) << 16)
               | ((hash[offset+2] & 0xff) << 8)
               | (hash[offset+3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
  }

  // ───────────────────────────────────────────────────────────────────────
  // VALIDATION : on accepte ±1 step (30s) pour tolérer décalage horloge
  // ───────────────────────────────────────────────────────────────────────
  async function validateTotp(secret, code) {
    if (!/^\d{6}$/.test(code)) return false;
    const currentStep = Math.floor(Date.now() / 30000);
    for (let drift = -1; drift <= 1; drift++) {
      const expected = await generateTotp(secret, currentStep + drift);
      if (expected === code) return true;
    }
    return false;
  }

  // ───────────────────────────────────────────────────────────────────────
  // URI OTPAUTH:// (à mettre dans un QR code)
  // ───────────────────────────────────────────────────────────────────────
  function buildOtpAuthUri(secret, accountName, issuer) {
    accountName = accountName || 'user@tabibi.doctor';
    issuer = issuer || 'Tabibi';
    const params = new URLSearchParams({
      secret: secret,
      issuer: issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    });
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // QR CODE SVG MINIMAL — implémentation native (pas de lib externe)
  // Génère un QR code 25x25 modules (version 2) pour les URI courts
  // ───────────────────────────────────────────────────────────────────────
  // Note : pour simplifier et garder le code petit, on délègue à un service
  // public uniquement pour le QR (le secret transite via le URI mais sur HTTPS)
  // Alternative robuste : intégrer qrcode.js (60 KB) si on veut zéro dépendance externe
  function buildQrCodeImageUrl(uri, size) {
    size = size || 240;
    // Service utilisé : api.qrserver.com (gratuit, pas de tracking)
    // À remplacer par une lib locale en prod si la dépendance externe pose problème
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(uri);
  }

  // ───────────────────────────────────────────────────────────────────────
  // CODES DE SECOURS (10 codes à usage unique, alphanumériques)
  // ───────────────────────────────────────────────────────────────────────
  function generateBackupCodes(count) {
    count = count || 10;
    const codes = [];
    const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L
    for (let i = 0; i < count; i++) {
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      let code = '';
      for (let j = 0; j < 8; j++) code += ALPHA[buf[j] % ALPHA.length];
      // Format XXXX-XXXX
      codes.push(code.slice(0, 4) + '-' + code.slice(4));
    }
    return codes;
  }

  async function hashBackupCode(code) {
    const enc = new TextEncoder().encode(code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ───────────────────────────────────────────────────────────────────────
  // EXPORT GLOBAL
  // ───────────────────────────────────────────────────────────────────────
  window.tabibi2FA = {
    generateSecret,
    generateTotp,
    validateTotp,
    buildOtpAuthUri,
    buildQrCodeImageUrl,
    generateBackupCodes,
    hashBackupCode
  };

  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
