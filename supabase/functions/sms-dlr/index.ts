// supabase/functions/sms-dlr/index.ts
// =====================================================================
// Push DLR BudgetSMS → réception des accusés de livraison SMS.
// ---------------------------------------------------------------------
// POURQUOI : send-sms ne connaît que la réponse SYNCHRONE de BudgetSMS
// ("OK <smsid> ..." = accepté par la passerelle). Accepté n'est PAS
// livré : un SMS peut être refusé par l'opérateur, expirer, ou tomber
// sur un numéro invalide plusieurs minutes après. Sans ce callback, un
// OTP jamais reçu est indiscernable d'un OTP reçu et ignoré — c'est
// exactement l'angle mort qui a rendu le diagnostic du sender si long.
//
// PROTOCOLE (doc : budgetsms.net/sms-http-api/push-dlr/)
// BudgetSMS appelle l'URL de callback avec 3 paramètres :
//   id     — le smsid renvoyé par /sendsms/ à l'envoi
//   status — code DLR numérique (table ci-dessous)
//   date   — horodatage Unix (secondes)
// La doc ne précise pas la méthode HTTP : GET et POST sont donc tous
// deux acceptés ici, et les paramètres lus dans la query string comme
// dans le corps (urlencoded ou JSON).
//
// PORTÉE VOLONTAIREMENT MINIMALE : on LOGGE, on n'écrit RIEN en base.
// La décision de stocker les DLR (table sms_delivery, jointure sur
// smsid) est reportée — il faudrait d'abord que send-sms persiste le
// smsid qu'il reçoit, ce qu'il ne fait pas aujourd'hui.
//
// AUTHENTIFICATION : aucune. BudgetSMS n'offre ni secret partagé ni
// signature sur le Push DLR ; l'endpoint doit donc être public
// (verify_jwt = false, cf. supabase/config.toml). Conséquence assumée :
// n'importe qui peut poster de faux DLR. C'est sans gravité tant qu'on
// se contente de journaliser — à revoir impérativement AVANT toute
// écriture en base ou toute action déclenchée par un DLR (renvoi
// automatique, blocage de numéro...).
// AUCUNE donnée personnelle n'est journalisée : ni numéro, ni OTP, ni
// contenu — BudgetSMS n'en envoie d'ailleurs aucun, juste un id.
// =====================================================================

// Table officielle : budgetsms.net/sms-http-api/dlr-status/
// (9, 10 n'existent pas côté BudgetSMS — absents de la table publiée)
const DLR_LABELS: Record<number, string> = {
  0: "Envoyé, pas encore de statut (défaut)",
  1: "Livré",
  2: "Non envoyé",
  3: "Échec de livraison",
  4: "Envoyé",
  5: "Expiré",
  6: "Destinataire invalide",
  7: "Erreur SMSC, message non traité",
  8: "Message non autorisé",
  11: "Statut inconnu (aucune mise à jour SMSC après 24 h)",
  12: "Statut inconnu (code SMSC non reconnu)",
  13: "Statut inconnu (aucune mise à jour SMSC après 72 h)",
};

// Codes signalant un ÉCHEC réel — ceux qui méritent une alerte le jour
// où on branchera du monitoring dessus.
const FAILURE_CODES = new Set([2, 3, 5, 6, 7, 8]);

const TEXT_HEADERS = { "Content-Type": "text/plain" };

/** Lit un paramètre dans la query string puis, à défaut, dans le corps. */
function pick(url: URL, body: Record<string, string>, name: string): string | null {
  return url.searchParams.get(name) ?? body[name] ?? null;
}

/** Corps de requête tolérant : urlencoded ou JSON, jamais fatal. */
async function readBody(req: Request): Promise<Record<string, string>> {
  if (req.method === "GET" || req.method === "HEAD") return {};
  try {
    const raw = (await req.text()).trim();
    if (!raw) return {};
    if (raw.startsWith("{")) {
      const j = JSON.parse(raw);
      const out: Record<string, string> = {};
      for (const k of Object.keys(j)) out[k] = String(j[k]);
      return out;
    }
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return {};
  }
}

import { createClient } from "jsr:@supabase/supabase-js@2";

// [A9 2026-09-09] Le DLR n'etait que journalise en console : impossible, apres
// coup, de savoir si un OTP precis a ete livre. On met a jour la ligne de
// sms_log portant ce smsid (provider_msg_id). Sans ligne correspondante (SMS
// envoye avant cette version, ou faux DLR), rien n'est ecrit : la garde
// « on ne cree jamais depuis un DLR » evite qu'un tiers remplisse la table.
async function rattacherDlr(smsid: string, statut: string, ts: string | null) {
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = (Deno.env.get("TABIBI_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    if (!url || !key) return;
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error, count } = await db.from("sms_log")
      .update({ status: statut, error_message: ts ? `dlr:${ts}` : null }, { count: "exact" })
      .eq("provider", "budgetsms").eq("provider_msg_id", smsid);
    if (error) console.error("[sms-dlr] sms_log:", error.message);
    else if (!count) console.warn("[sms-dlr] aucun envoi connu pour smsid", smsid);
  } catch (e) { console.error("[sms-dlr] sms_log exception:", e); }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = await readBody(req);

  const rawId = pick(url, body, "id");
  const rawStatus = pick(url, body, "status");
  const rawDate = pick(url, body, "date");

  // ── Validation de plausibilité ────────────────────────────────────
  // smsid : uniquement des chiffres (ceux observés font 9 caractères).
  if (!rawId || !/^\d+$/.test(rawId)) {
    console.warn("[sms-dlr] rejet : smsid absent ou non numerique");
    return new Response("ERR invalid id", { status: 400, headers: TEXT_HEADERS });
  }
  const status = Number(rawStatus);
  if (!rawStatus || !Number.isInteger(status) || !(status in DLR_LABELS)) {
    console.warn("[sms-dlr] rejet : status inconnu:", rawStatus, "smsid:", rawId);
    return new Response("ERR invalid status", { status: 400, headers: TEXT_HEADERS });
  }

  const label = DLR_LABELS[status];
  const ts = rawDate && /^\d+$/.test(rawDate)
    ? new Date(Number(rawDate) * 1000).toISOString()
    : "(absent)";

  // Un échec sort en console.error pour être filtrable dans les logs
  // Supabase sans avoir à relire chaque ligne.
  const line = ["[sms-dlr] smsid:", rawId, "status:", status, "->", label, "date:", ts];
  if (FAILURE_CODES.has(status)) console.error(...line, "[ECHEC]");
  else console.log(...line);
  await rattacherDlr(rawId, FAILURE_CODES.has(status) ? `failed:${label}` : `dlr:${label}`, ts === "(absent)" ? null : ts);

  // BudgetSMS attend un 200. La doc ne spécifie pas de corps : "OK".
  return new Response("OK", { status: 200, headers: TEXT_HEADERS });
});
