/* ═══════════════════════════════════════════════════════════════════════════
 * tabibi-referral.js — Parrainage médecins (liens /a/<CODE>)
 * ---------------------------------------------------------------------------
 * Rôle :
 *   • Sur la page /a/<CODE> : lit le code depuis l'URL, le mémorise, affiche
 *     le bandeau « Recommandé par <display_name> » si le code existe, et
 *     enregistre un clic dans referral_clicks (1×/session, non bloquant).
 *   • Sur signup.html (et /a/) : expose window.tabibiRef.getCode() pour que le
 *     flux d'inscription écrive referred_by_code dans les métadonnées auth.
 *
 * Stockage (spéc.) :
 *   • sessionStorage['tabibi_ref']      = le code (durée de la session)
 *   • localStorage ['tabibi_ref_exp']   = timestamp d'expiration (30 jours)
 *   • localStorage ['tabibi_ref']       = copie du code (réhydrate la session
 *                                         tant que l'expiration n'est pas passée)
 *
 * Sûreté : aucune de ces opérations ne doit bloquer le rendu ni l'inscription.
 * Tout est encapsulé en try/catch ; un échec Supabase = pas de bandeau, point.
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SS_CODE  = "tabibi_ref";
  var LS_CODE  = "tabibi_ref";
  var LS_EXP   = "tabibi_ref_exp";
  var SS_CLICK = "tabibi_ref_click_done";
  var TTL_MS   = 30 * 24 * 60 * 60 * 1000; // 30 jours

  function now() { return Date.now(); }

  function expStillValid() {
    try {
      var e = localStorage.getItem(LS_EXP);
      if (!e) return false;
      var n = parseInt(e, 10);
      return !!n && now() < n;
    } catch (_) { return false; }
  }

  // Code courant : sessionStorage prioritaire ; sinon réhydrate depuis
  // localStorage si l'expiration 30 j n'est pas dépassée.
  function getCode() {
    try {
      var c = sessionStorage.getItem(SS_CODE);
      if (c) return c;
    } catch (_) {}
    try {
      if (expStillValid()) {
        var lc = localStorage.getItem(LS_CODE);
        if (lc) {
          try { sessionStorage.setItem(SS_CODE, lc); } catch (__) {}
          return lc;
        }
      }
    } catch (_) {}
    return null;
  }

  function storeCode(code) {
    if (!code) return;
    try { sessionStorage.setItem(SS_CODE, code); } catch (_) {}
    try { localStorage.setItem(LS_CODE, code); } catch (_) {}
    try { localStorage.setItem(LS_EXP, String(now() + TTL_MS)); } catch (_) {}
  }

  // /a/<CODE> → segment [1] du pathname, en MAJUSCULES.
  function codeFromPath() {
    try {
      var parts = window.location.pathname.split("/").filter(Boolean);
      var raw = parts[1];
      if (!raw) return null;
      return String(raw).toUpperCase();
    } catch (_) { return null; }
  }

  // Attend que le client Supabase soit prêt (scripts chargés en fin de page).
  function waitSupabase(cb, tries) {
    tries = tries || 0;
    var sb = window.tabibi && window.tabibi.supabase;
    if (sb) return cb(sb);
    if (tries > 50) return cb(null); // ~10 s puis on abandonne silencieusement
    setTimeout(function () { waitSupabase(cb, tries + 1); }, 200);
  }

  function showBanner(name) {
    var el = document.getElementById("ref-banner");
    if (!el) return;
    var slot = el.querySelector("[data-ref-name]");
    if (slot) slot.textContent = name;
    el.hidden = false;
  }
  function hideBanner() {
    var el = document.getElementById("ref-banner");
    if (el) el.hidden = true;
  }

  // Insert clic — 1×/session, jamais bloquant, aucune lecture (RLS : pas de SELECT anon).
  function insertClickOnce(sb, code) {
    try { if (sessionStorage.getItem(SS_CLICK) === "1") return; } catch (_) {}
    var row = {
      code: code,
      user_agent: (navigator.userAgent || "").slice(0, 500),
      referrer: (document.referrer || "").slice(0, 500)
    };
    try {
      sb.from("referral_clicks").insert(row).then(
        function () { try { sessionStorage.setItem(SS_CLICK, "1"); } catch (__) {} },
        function () { /* échec silencieux : ne bloque rien */ }
      );
    } catch (_) {}
  }

  // Page d'atterrissage /a/<CODE>
  function initLanding() {
    var code = codeFromPath();
    if (!code) { hideBanner(); return; } // pas sur /a/ → rien à faire (ex: signup.html)

    storeCode(code); // mémorise dès le chargement (spéc. étape 10)

    waitSupabase(function (sb) {
      if (!sb) { hideBanner(); return; }
      // Bandeau : uniquement si public_ambassadors renvoie une ligne (spéc. étapes 8-9)
      try {
        sb.from("public_ambassadors")
          .select("code,display_name")
          .eq("code", code)
          .maybeSingle()
          .then(function (res) {
            if (res && !res.error && res.data && res.data.display_name) {
              showBanner(res.data.display_name);
            } else {
              hideBanner(); // code inconnu → repli, formulaire utilisable normalement
            }
          }, function () { hideBanner(); });
      } catch (_) { hideBanner(); }

      insertClickOnce(sb, code); // enregistre le clic (spéc. étape 11)
    });
  }

  // API publique consommée par le flux d'inscription.
  window.tabibiRef = { getCode: getCode, storeCode: storeCode };

  if (document.readyState !== "loading") initLanding();
  else document.addEventListener("DOMContentLoaded", initLanding);
})();
