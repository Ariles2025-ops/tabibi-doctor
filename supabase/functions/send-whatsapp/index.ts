// supabase/functions/send-whatsapp/index.ts
// =====================================================================
// Envoi WhatsApp via la Cloud API de Meta (Graph API).
// ---------------------------------------------------------------------
// ⚠️ CHANTIER PRÉPARATOIRE — NON DÉPLOYÉ, NON BRANCHÉ.
// Le canal actif reste send-sms (BudgetSMS). Cette fonction dort dans le
// dépôt jusqu'à la vérification du compte Meta Business, qui dépend du
// registre de commerce. Rien dans le flux existant ne l'appelle.
// Procédure d'activation : docs/WHATSAPP_ACTIVATION.md
//
// PROTOCOLE
//   POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
//   Authorization: Bearer {WA_TOKEN}
//   Corps : message de type `template` — hors fenêtre de service client de
//   24 h, Meta n'autorise QUE les templates pré-approuvés. Les deux templates
//   utilisés ici doivent donc être validés côté Meta avant tout envoi réel.
//
// SECRETS (Deno.env, jamais en dur — règle 4 de CLAUDE.md)
//   WA_TOKEN            token permanent du système utilisateur
//   WA_PHONE_NUMBER_ID  identifiant du numéro expéditeur
//
// CONTRAT DE RÉPONSE — c'est lui qui permettra le repli sur send-sms.
// Le repli n'est PAS branché ici : cette fonction se contente de qualifier
// l'échec pour que l'appelant décide.
//   200 { ok: true,  message_id, wa_id }
//   4xx { ok: false, code, fallback: true|false, detail }
// `fallback: true` signifie « ce message ne partira jamais par WhatsApp,
// bascule sur SMS ». `fallback: false` signifie « problème de configuration
// de notre côté » : réessayer par SMS ne le corrigera pas, il faut alerter.
// Voir FALLBACK_CODES plus bas.
// =====================================================================

const JSON_HEADERS = { "Content-Type": "application/json" };
const GRAPH_VERSION = "v21.0";

/** Langues supportées. Le contenu fr est prêt ; ar est structuré mais les
 *  templates doivent être soumis séparément à Meta (un template = une langue). */
type Lang = "fr" | "ar";

/** Codes d'erreur Meta qui signifient « inutile de réessayer en WhatsApp ».
 *  Sources : documentation Cloud API, section error codes.
 *    131026 destinataire injoignable (pas de compte WhatsApp, ou n'accepte
 *           pas les messages de ce type)
 *    131047 fenêtre de 24 h expirée et template non applicable
 *    131051 type de message non supporté par le destinataire
 *    132000-132015 famille « template » : introuvable, non approuvé, nombre
 *           de paramètres incorrect, langue absente…
 *  Dans tous ces cas, l'appelant doit basculer sur send-sms. */
const FALLBACK_CODES = new Set([131026, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015]);

interface SendRequest {
  to: string;                 // E.164 sans le « + », ex. 213770000000
  template: "rdv_confirmation" | "otp_code";
  lang?: Lang;
  params: Record<string, string>;
}

/** Définition des templates. L'ORDRE des paramètres est significatif : la
 *  Cloud API ne connaît que des placeholders positionnels {{1}}, {{2}}…
 *  Cet ordre DOIT correspondre exactement à celui déclaré dans le template
 *  approuvé côté Meta, sinon les valeurs sont interverties sans erreur. */
const TEMPLATES = {
  rdv_confirmation: {
    category: "utility" as const,
    // {{1}} médecin · {{2}} date · {{3}} heure · {{4}} adresse
    order: ["nom_medecin", "date", "heure", "adresse"],
    langCode: { fr: "fr", ar: "ar" },
  },
  otp_code: {
    category: "authentication" as const,
    // {{1}} code
    order: ["code"],
    langCode: { fr: "fr", ar: "ar" },
  },
} as const;

function err(status: number, code: string, detail: string, fallback: boolean) {
  return new Response(JSON.stringify({ ok: false, code, fallback, detail }), {
    status,
    headers: JSON_HEADERS,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "POST attendu", false);
  }

  const WA_TOKEN = Deno.env.get("WA_TOKEN");
  const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
    // Config manquante : ce n'est pas au SMS de rattraper ça, il faut alerter.
    console.error("[send-whatsapp] secrets manquants (WA_TOKEN / WA_PHONE_NUMBER_ID)");
    return err(500, "not_configured", "canal WhatsApp non configuré", false);
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return err(400, "bad_request", "corps JSON illisible", false);
  }

  const tpl = TEMPLATES[body?.template as keyof typeof TEMPLATES];
  if (!tpl) {
    return err(400, "unknown_template", "template inconnu", false);
  }
  if (!body.to || !/^\d{8,15}$/.test(body.to)) {
    // Numéro invalide : le SMS échouerait pour la même raison.
    return err(400, "invalid_recipient", "numéro destinataire invalide", false);
  }

  const lang: Lang = body.lang === "ar" ? "ar" : "fr";
  const missing = tpl.order.filter((k) => !body.params || !body.params[k]);
  if (missing.length) {
    return err(400, "missing_params", `paramètres absents : ${missing.join(", ")}`, false);
  }

  // Paramètres positionnels, dans l'ordre déclaré ci-dessus.
  const parameters = tpl.order.map((k) => ({ type: "text", text: String(body.params[k]) }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: body.to,
    type: "template",
    template: {
      name: body.template,
      language: { code: tpl.langCode[lang] },
      components: [{ type: "body", parameters }],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.messages?.[0]?.id) {
      const messageId = data.messages[0].id;
      const waId = data?.contacts?.[0]?.wa_id ?? null;
      // Même pattern de journalisation que [send-sms] : identifiant + statut,
      // jamais le numéro ni le contenu du message.
      console.log("[send-whatsapp] envoye:", messageId, "template:", body.template, "lang:", lang, "wa_id_present:", !!waId);
      return new Response(JSON.stringify({ ok: true, message_id: messageId, wa_id: waId }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // Meta renvoie ses erreurs dans data.error.{code,message,error_subcode}
    const metaCode = Number(data?.error?.code ?? 0);
    const metaMsg = String(data?.error?.message ?? "erreur inconnue");
    const fallback = FALLBACK_CODES.has(metaCode);
    console.error(
      "[send-whatsapp] echec:", res.status,
      "code:", metaCode,
      "template:", body.template,
      "fallback_sms:", fallback,
      "detail:", metaMsg.slice(0, 200),
    );
    return err(502, `meta_${metaCode || "unknown"}`, metaMsg.slice(0, 200), fallback);
  } catch (e) {
    // Panne réseau : WhatsApp est indisponible, le SMS peut passer.
    console.error("[send-whatsapp] erreur reseau lors de l'appel Graph API:", e);
    return err(502, "network_error", String(e).slice(0, 200), true);
  }
});
