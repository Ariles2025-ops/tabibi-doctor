// supabase/functions/whatsapp-webhook/index.ts
// =====================================================================
// Webhook WhatsApp Cloud API — réception des statuts de livraison.
// ---------------------------------------------------------------------
// ⚠️ CHANTIER PRÉPARATOIRE — NON DÉPLOYÉ. Procédure : docs/WHATSAPP_ACTIVATION.md
//
// POURQUOI : send-whatsapp ne connaît que la réponse SYNCHRONE de Meta
// (« accepté par la Cloud API »). Accepté n'est pas livré : le message peut
// échouer chez l'opérateur, expirer, ou n'être jamais lu. Sans ce webhook, un
// OTP jamais reçu serait indiscernable d'un OTP reçu et ignoré — exactement
// l'angle mort qu'on a fermé côté SMS avec sms-dlr.
//
// DEUX MÉTHODES HTTP, deux rôles :
//   GET  — vérification de l'abonnement. Meta appelle l'URL avec
//          hub.mode=subscribe, hub.verify_token et hub.challenge. Il faut
//          renvoyer hub.challenge EN TEXTE BRUT, et uniquement si le
//          verify_token correspond au nôtre. C'est un handshake unique, fait
//          au moment de configurer le webhook dans l'app Meta.
//   POST — notifications de statut : sent, delivered, read, failed.
//
// PORTÉE VOLONTAIREMENT MINIMALE : on LOGGE, on n'écrit RIEN en base — même
// choix que sms-dlr. Stocker les statuts supposerait d'abord que
// send-whatsapp persiste le message_id qu'il reçoit, ce qu'il ne fait pas.
//
// AUTHENTIFICATION : verify_jwt = false (déclaré dans supabase/config.toml).
// Le callback vient des serveurs Meta, qui n'envoient aucun JWT Supabase.
// Contrairement au Push DLR de BudgetSMS, Meta signe ses requêtes avec
// X-Hub-Signature-256 (HMAC-SHA256 du corps, clé = app secret). Cette
// vérification est PRÉVUE mais désactivée tant que WA_APP_SECRET n'est pas
// posé : voir verifySignature() plus bas.
// ⚠️ À ACTIVER LE JOUR J — sans elle, n'importe qui peut poster de faux
// statuts. Sans gravité tant qu'on se contente de journaliser, inacceptable
// dès qu'un statut déclenchera une action (renvoi, bascule SMS, alerte).
//
// AUCUNE donnée personnelle n'est journalisée : ni numéro, ni contenu, ni
// code. Meta envoie un wa_id (numéro du destinataire) — il est délibérément
// exclu des logs, seule sa présence est notée.
// =====================================================================

const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

/** Statuts émis par la Cloud API, dans l'ordre du cycle de vie. */
const STATUS_LABELS: Record<string, string> = {
  sent: "Envoyé à l'opérateur",
  delivered: "Remis sur l'appareil",
  read: "Lu par le destinataire",
  failed: "Échec de livraison",
  deleted: "Message supprimé",
};

/** Statuts signalant un échec réel — ceux qui mériteront une alerte le jour
 *  où on branchera du monitoring, et un repli SMS si l'on va jusque-là. */
const FAILURE_STATUSES = new Set(["failed"]);

/**
 * Vérification de la signature Meta (X-Hub-Signature-256).
 * Inactive tant que WA_APP_SECRET est absent : on ne bloque pas un webhook de
 * test faute de secret, mais on trace le fait qu'il n'est pas vérifié.
 * Retourne true si vérifiée OU si la vérification est désactivée.
 */
async function verifySignature(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get("WA_APP_SECRET");
  if (!secret) {
    console.warn("[whatsapp-webhook] WA_APP_SECRET absent — signature NON verifiee");
    return true;
  }
  const header = req.headers.get("x-hub-signature-256") ?? "";
  const expectedPrefix = "sha256=";
  if (!header.startsWith(expectedPrefix)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return header.slice(expectedPrefix.length) === hex;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── GET : handshake de vérification de l'abonnement ────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WA_VERIFY_TOKEN");

    if (!expected) {
      console.error("[whatsapp-webhook] WA_VERIFY_TOKEN absent — handshake impossible");
      return new Response("ERR not configured", { status: 500, headers: TEXT_HEADERS });
    }
    if (mode === "subscribe" && token === expected && challenge) {
      console.log("[whatsapp-webhook] handshake OK — abonnement verifie");
      // Meta attend le challenge EN TEXTE BRUT, sans guillemets ni JSON.
      return new Response(challenge, { status: 200, headers: TEXT_HEADERS });
    }
    console.warn("[whatsapp-webhook] handshake refuse — mode:", mode, "token_correspond:", token === expected);
    return new Response("ERR forbidden", { status: 403, headers: TEXT_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("ERR method", { status: 405, headers: TEXT_HEADERS });
  }

  // ── POST : notifications de statut ─────────────────────────────────
  const raw = await req.text();

  if (!(await verifySignature(req, raw))) {
    console.error("[whatsapp-webhook] signature X-Hub-Signature-256 invalide — rejet");
    return new Response("ERR signature", { status: 401, headers: TEXT_HEADERS });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    console.warn("[whatsapp-webhook] corps JSON illisible");
    return new Response("ERR body", { status: 400, headers: TEXT_HEADERS });
  }

  // Structure Meta : entry[].changes[].value.statuses[]
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  let seen = 0;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const statuses = (value.statuses as Record<string, unknown>[] | undefined) ?? [];
      for (const st of statuses) {
        seen++;
        const id = String(st.id ?? "");
        const status = String(st.status ?? "");
        const label = STATUS_LABELS[status] ?? "statut inconnu";
        const ts = st.timestamp && /^\d+$/.test(String(st.timestamp))
          ? new Date(Number(st.timestamp) * 1000).toISOString()
          : "(absent)";
        // Détail d'erreur éventuel, sans le numéro du destinataire.
        const errs = (st.errors as Record<string, unknown>[] | undefined) ?? [];
        const errCode = errs.length ? String(errs[0]?.code ?? "") : "";

        const line = [
          "[whatsapp-webhook] message_id:", id,
          "status:", status, "->", label,
          "date:", ts,
          errCode ? `err:${errCode}` : "",
        ];
        if (FAILURE_STATUSES.has(status)) console.error(...line, "[ECHEC]");
        else console.log(...line);
      }
    }
  }

  if (seen === 0) {
    // Meta envoie aussi des notifications entrantes (messages reçus) : on ne
    // les traite pas, mais on accuse réception pour éviter les relances.
    console.log("[whatsapp-webhook] notification sans statut de livraison — ignoree");
  }

  // Meta attend un 200 rapide. Tout autre code déclenche des relances puis la
  // désactivation de l'abonnement.
  return new Response("OK", { status: 200, headers: TEXT_HEADERS });
});
