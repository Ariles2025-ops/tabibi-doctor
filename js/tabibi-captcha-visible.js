/* ============================================================
   js/tabibi-captcha-visible.js — Captcha VISIBLE en desktop — Phase 3
   ------------------------------------------------------------
   Problème : dans la WKWebView macOS (Tauri), Cloudflare escalade le
   widget invisible (interaction-only + execute()) vers un challenge
   interactif qu'il ne peut jamais afficher → token NULL muet → login
   impossible. Web/mobile : aucun souci, widget caché conservé.

   Solution (desktop UNIQUEMENT, no-op ailleurs) :
   • Rend un widget Turnstile VISIBLE (mode managed, appearance:always,
     via tabibiTurnstile.renderWidget existant) dans chaque conteneur
     <div class="tbi-captcha-slot"></div> des formulaires d'auth.
     Si Cloudflare exige une interaction, la case est cliquable.
   • Surcharge window.tabibiTurnstile.getCaptchaToken : renvoie le
     token du widget visible (attend jusqu'à 8 s la résolution auto ou
     le clic), puis reset le widget (token à usage unique). AUCUNE
     modification des 4 flux appelants (login, reset OTP ×2, forgot).
   • Émet des événements 'tabibi:captcha' {detail:{ev,info}} — relayés
     vers stderr par tabibi-desktop-diag.js pour preuve en fenêtre réelle.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.TABIBI_PLATFORM !== 'desktop') return;

  var token = null;          // dernier token minté par un widget visible
  var widgets = [];          // ids des widgets rendus (pour reset)
  var waiters = [];          // resolveurs en attente d'un token

  function emit(ev, info) {
    try { document.dispatchEvent(new CustomEvent('tabibi:captcha', { detail: { ev: ev, info: info || '' } })); } catch (e) {}
  }

  function onToken(tok) {
    token = tok || null;
    emit('token', tok ? ('OUI ' + String(tok).length + ' chars') : 'vide');
    var w = waiters.splice(0);
    w.forEach(function (r) { r(consume()); });
  }

  /* Consomme le token courant (usage unique) et re-arme les widgets */
  function consume() {
    var t = token;
    if (!t) return null;
    token = null;
    widgets.forEach(function (id) {
      try { window.turnstile && window.turnstile.reset(id); } catch (e) {}
    });
    emit('consomme', 'widgets re-armés');
    return t;
  }

  function renderSlots() {
    var slots = document.querySelectorAll('.tbi-captcha-slot');
    if (!slots.length) { emit('aucun-slot'); return; }
    slots.forEach(function (slot, i) {
      slot.style.display = '';
      window.tabibiTurnstile.renderWidget(slot, {
        callback: onToken,
        errorCallback: function (code) { emit('erreur-widget', String(code || window.__ttErr || 'inconnu')); },
        expiredCallback: function () { token = null; emit('expire'); }
      }).then(function (id) {
        if (id !== null && id !== undefined) { widgets.push(id); emit('rendu', 'slot ' + i + ' widget ' + id); }
        else emit('rendu-echec', 'slot ' + i);
      });
    });
  }

  /* Surcharge : les flux existants appellent getCaptchaToken() sans le savoir */
  function install() {
    if (!window.tabibiTurnstile || typeof window.tabibiTurnstile.renderWidget !== 'function') {
      emit('turnstile-absent'); return;
    }
    renderSlots();
    var orig = window.tabibiTurnstile.getCaptchaToken;
    window.tabibiTurnstile.getCaptchaToken = function () {
      emit('getToken-appelé', token ? 'token déjà prêt' : 'attente (≤8s)');
      if (token) return Promise.resolve(consume());
      if (!widgets.length) {
        emit('fallback-invisible', 'aucun widget visible rendu');
        return orig.apply(window.tabibiTurnstile, arguments);
      }
      return new Promise(function (resolve) {
        var done = false;
        var to = setTimeout(function () {
          if (done) return; done = true;
          if (!window.__ttErr) window.__ttErr = 'visible-timeout-8s(cochez la case)';
          emit('timeout-8s');
          resolve(null);
        }, 8000);
        waiters.push(function (t) {
          if (done) return; done = true; clearTimeout(to); resolve(t);
        });
      });
    };
    emit('installé', widgets.length + ' slot(s)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
