// supabase/functions/verify-turnstile/index.ts
// =====================================================================
// Vérification serveur des tokens Cloudflare Turnstile (anti-bot).
// ---------------------------------------------------------------------
// [FIX 2026-07-04] Le front (js/tabibi-turnstile.js L191) appelle
// functions.invoke('verify-turnstile', { body: { token } }) mais la
// fonction n'était pas déployée → 404 → fail-closed [CRIT-5] → le
// formulaire liste d'attente ne pouvait jamais soumettre.
//
// Contrat front (tabibi-turnstile.js L191-198) :
//   entrée  : POST JSON { token: string }
//   sortie  : 200 JSON { success: boolean, error?: string }
//             (un statut non-2xx est traité en erreur → valid:false)
//
// Appelée depuis le NAVIGATEUR → CORS obligatoire (send-sms n'en a pas
// car c'est un hook serveur-à-serveur) : allowlist d'origines + OPTIONS.
//
// Fail-closed : secret absente ou API injoignable → jamais success:true.
// Aucun secret en dur : TURNSTILE_SECRET_KEY vient de Deno.env
// (supabase secrets set TURNSTILE_SECRET_KEY=...).
// =====================================================================

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Origines autorisées à appeler la fonction depuis un navigateur.
const ALLOWED_ORIGINS = [
  "https://tabibi.doctor",
  "https://www.tabibi.doctor",
  "http://localhost:8080", // QA locale (python http.server)
];

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // En-têtes envoyés par supabase-js functions.invoke (anon key incluse).
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);

  // ── 1. Preflight CORS ────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "method not allowed" }), {
      status: 405,
      headers,
    });
  }

  // ── 2. Secret (fail-closed si absente) ───────────────────────────────────
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[verify-turnstile] TURNSTILE_SECRET_KEY manquante");
    return new Response(JSON.stringify({ success: false, error: "captcha not configured" }), {
      status: 500,
      headers,
    });
  }

  // ── 3. Token du widget (body { token }) ──────────────────────────────────
  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch (_e) {
    /* body invalide → token vide → rejet ci-dessous */
  }
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: "missing token" }), {
      status: 200,
      headers,
    });
  }

  // ── 4. Vérification auprès de Cloudflare (siteverify) ────────────────────
  try {
    const form = new URLSearchParams({ secret, response: token });
    // IP client si dispo (facultatif côté siteverify, améliore la détection).
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) form.set("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    const data = await res.json();

    if (data.success === true) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }
    console.warn("[verify-turnstile] token refusé:", data["error-codes"]);
    return new Response(
      JSON.stringify({ success: false, error: (data["error-codes"] ?? []).join(",") || "invalid token" }),
      { status: 200, headers },
    );
  } catch (err) {
    // Fail-closed : API injoignable → rejet, jamais success:true par défaut.
    console.error("[verify-turnstile] appel siteverify échoué:", err);
    return new Response(JSON.stringify({ success: false, error: "verification unavailable" }), {
      status: 500,
      headers,
    });
  }
});
