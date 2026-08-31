// ═══════════════════════════════════════════════════════════════════════════
// Edge Function : ambassador-submit
// ---------------------------------------------------------------------------
// Sécurise la soumission de ambassadeur.html côté SERVEUR :
//   1) Vérifie le token Turnstile (secret serveur, jamais exposé au client).
//   2) Insère la candidature via service_role (colonnes whitelistées only).
//   3) Notifie contact@tabibi.doctor via Brevo (best-effort, non bloquant).
//
// ⚠️  NON DÉPLOYÉE. Déploiement (côté toi) :
//     supabase functions deploy ambassador-submit --no-verify-jwt
//   Secrets requis (supabase secrets set …) :
//     TURNSTILE_SECRET_KEY      (secret Turnstile — PAS la site key)
//     SUPABASE_URL              (injecté d'office par Supabase)
//     SUPABASE_SERVICE_ROLE_KEY (injecté d'office par Supabase)
//     BREVO_API_KEY             (clé API Brevo transactionnel)
//
// ⚠️  Pour que la page l'utilise, remplacer dans ambassadeur.html l'INSERT direct
//     par un appel à cette fonction (une fois déployée) :
//
//       const res = await fetch(window.TABIBI_CONFIG.SUPABASE_URL +
//         "/functions/v1/ambassador-submit", {
//         method: "POST",
//         headers: { "Content-Type": "application/json",
//                    "apikey": window.TABIBI_CONFIG.SUPABASE_ANON_KEY },
//         body: JSON.stringify({ ...row, captchaToken: token })
//       });
//       const out = await res.json();
//       if (!res.ok || !out.ok) { /* toast erreur */ }
//
//     Tant qu'elle n'est pas déployée, la page fait un INSERT anon direct
//     (fonctionne dès que la table existe ; Turnstile only côté client).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Colonnes autorisées (identiques au GRANT INSERT anon de PHASE18).
const FIELDS = [
  "first_name", "last_name", "specialty", "order_number",
  "phone", "email", "wilaya", "commune", "cabinet_address",
];

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  // 1) Turnstile — vérification serveur
  const token = (body.captchaToken ?? body.token ?? "") as string;
  if (!token) return json(400, { error: "captcha_required" });

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return json(500, { error: "server_misconfigured" });

  const ip = (req.headers.get("CF-Connecting-IP") ||
              req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);

  try {
    const tsRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form });
    const ts = await tsRes.json();
    if (!ts.success) return json(403, { error: "captcha_failed" });
  } catch {
    return json(502, { error: "captcha_unreachable" });
  }

  // 2) Validation + whitelist des colonnes (jamais status/code/is_active)
  const row: Record<string, string> = {};
  for (const f of FIELDS) row[f] = String(body[f] ?? "").trim().slice(0, 300);
  if (!row.first_name || !row.last_name || !row.email) {
    return json(400, { error: "missing_fields" });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) {
    return json(400, { error: "invalid_email" });
  }

  // 3) Insert via service_role (contourne la RLS, mais colonnes whitelistées)
  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) return json(500, { error: "server_misconfigured" });

  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { error } = await admin.from("ambassadors").insert(row);
  if (error) return json(500, { error: "insert_failed", detail: error.message });

  // 4) Notification email — best-effort, n'échoue jamais la requête
  try {
    const brevo = Deno.env.get("BREVO_API_KEY");
    if (brevo) {
      const rows = FIELDS.map((f) =>
        `<li><b>${f}</b> : ${escapeHtml(row[f] || "—")}</li>`).join("");
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({
          sender: { name: "Tabibi", email: "contact@tabibi.doctor" },
          to: [{ email: "contact@tabibi.doctor", name: "Tabibi" }],
          replyTo: row.email ? { email: row.email } : undefined,
          subject: `Nouvelle candidature ambassadeur — ${row.first_name} ${row.last_name}`,
          htmlContent: `<h2>Nouvelle candidature ambassadeur</h2><ul>${rows}</ul>`,
        }),
      });
    }
  } catch { /* non bloquant */ }

  return json(200, { ok: true });
});
