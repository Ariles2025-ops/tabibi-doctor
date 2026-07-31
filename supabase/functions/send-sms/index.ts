// supabase/functions/send-sms/index.ts
// =====================================================================
// Send SMS Auth Hook (Supabase) → envoi de l'OTP via BudgetSMS.
// ---------------------------------------------------------------------
// Supabase génère lui-même l'OTP, puis appelle ce hook avec un webhook
// SIGNÉ (standardwebhooks). Le payload vérifié contient :
//   { user: { phone }, sms: { otp } }
//
// Contrainte réseau DZ (mesurée le 2026-07-31, MCCMNC 60302) :
// sender NUMÉRIQUE partagé "12345" → 11/19 livrés (~42 % perdus).
// sender ALPHANUMÉRIQUE "Tabibi"  → 4/4 livrés, même numéro, même opérateur.
// BSMS_FROM vaut donc "Tabibi" (secret Supabase, mis à jour le 2026-07-31).
// Réserve : Google Messages classe le 1er SMS en Spam tant que "Tabibi"
// n'est pas enregistré auprès des opérateurs DZ chez BudgetSMS.
//
// Aucun secret/identifiant en dur : tout provient de Deno.env
// (secrets de la fonction côté Supabase).
// =====================================================================

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const JSON_HEADERS = { "Content-Type": "application/json" };

interface SmsHookPayload {
  user: { phone: string };
  sms: { otp: string };
}

Deno.serve(async (req) => {
  // ── 1. Webhook signé : lecture brute du corps + vérification de signature ──
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRETS");
  if (!hookSecret) {
    console.error("[send-sms] SEND_SMS_HOOK_SECRETS manquant");
    return new Response(JSON.stringify({ error: "hook secret missing" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let user: SmsHookPayload["user"];
  let sms: SmsHookPayload["sms"];
  try {
    const base64Secret = hookSecret.replace("v1,whsec_", "");
    const wh = new Webhook(base64Secret);
    ({ user, sms } = wh.verify(payload, headers) as SmsHookPayload);
  } catch (err) {
    console.error("[send-sms] vérification du webhook échouée:", err);
    return new Response(JSON.stringify({ error: "invalid webhook signature" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  // ── 2. Construction du SMS ────────────────────────────────────────────────
  const message = `Tabibi: votre code est ${sms.otp}`;
  const to = user.phone.replace(/^\+/, ""); // BudgetSMS n'accepte pas le "+"

  // ── 3. Identifiants BudgetSMS (env uniquement, jamais en dur) ─────────────
  const BSMS_USER = Deno.env.get("BSMS_USER");
  const BSMS_USERID = Deno.env.get("BSMS_USERID");
  const BSMS_HANDLE = Deno.env.get("BSMS_HANDLE");
  // Sender alphanumérique : mesures du 2026-07-31, cf. en-tête du fichier.
  const BSMS_FROM = Deno.env.get("BSMS_FROM") ?? "Tabibi";

  if (!BSMS_USER || !BSMS_USERID || !BSMS_HANDLE) {
    console.error("[send-sms] identifiants BudgetSMS manquants (BSMS_USER/USERID/HANDLE)");
    return new Response(JSON.stringify({ error: "sms provider not configured" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  // ── 4. Envoi via BudgetSMS (GET /sendsms/) ────────────────────────────────
  try {
    const url = "https://api.budgetsms.net/sendsms/"
      + `?username=${encodeURIComponent(BSMS_USER)}`
      + `&userid=${encodeURIComponent(BSMS_USERID)}`
      + `&handle=${encodeURIComponent(BSMS_HANDLE)}`
      + `&from=${encodeURIComponent(BSMS_FROM)}`
      + `&to=${encodeURIComponent(to)}`
      + `&msg=${encodeURIComponent(message)}`;

    const res = await fetch(url);
    const body = (await res.text()).trim();
    console.log("[send-sms] BudgetSMS reponse:", body, "sender:", BSMS_FROM);

    // BudgetSMS : "OK <smsid> <cost> <parts>" si accepté ; "ERR <code>" sinon.
    if (body.startsWith("OK")) {
      return new Response(JSON.stringify({}), { status: 200, headers: JSON_HEADERS });
    }

    console.error("[send-sms] BudgetSMS a refusé l'envoi:", body);
    return new Response(JSON.stringify({ error: `sms provider error: ${body}` }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error("[send-sms] erreur réseau lors de l'appel BudgetSMS:", err);
    return new Response(JSON.stringify({ error: "sms send failed" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
