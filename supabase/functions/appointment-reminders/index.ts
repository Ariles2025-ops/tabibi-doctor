// supabase/functions/appointment-reminders/index.ts
// =====================================================================
// LOT A — Rappel J-1 des rendez-vous (SMS BudgetSMS).
// ---------------------------------------------------------------------
// Fonction AUTONOME, appelée par pg_cron (toutes les 15 min, une fois le
// dry_run validé). Elle N'EST PAS un hook Supabase Auth : elle ne touche
// PAS à `send-sms`, qui reste strictement réservé à l'OTP de connexion
// (webhook signé — le modifier casserait le login de tout le monde).
//
// CHAÎNE : sélection des RDV dus → réservation d'une ligne outbox
//   (appointment_notifications) → envoi BudgetSMS → mise à jour du statut.
//
// ANTI-DOUBLON : la ligne outbox est insérée AVANT l'envoi. L'index
//   UNIQUE (appointment_id, kind) fait échouer toute seconde tentative
//   (code Postgres 23505) → on saute le RDV. Deux exécutions concurrentes
//   du cron ne peuvent donc pas envoyer deux fois le même rappel.
//
// SÉCURITÉ : header `x-reminders-secret` obligatoire (comparé à
//   REMINDERS_CRON_SECRET), sinon 401. Aucun secret en dur : tout vient
//   de Deno.env. Le service_role ne quitte jamais la fonction.
//
// ⚠️ LIMITE CONNUE (à trancher avant d'activer le cron) : la fenêtre est
//   fixée à [now+23h, now+25h] et les envois sont suspendus de 21h à 08h
//   (heure d'Alger). Un RDV de demain 20h-22h tombe donc dans une fenêtre
//   qui n'est balayée que pendant les heures calmes → son rappel J-1 peut
//   être manqué. Correctif possible au moment de l'activation : ajouter
//   une passe de rattrapage (RDV < 25h sans ligne j1) au 1er run de 08h.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

const BATCH_MAX = 200;          // plafond d'envois par exécution (garde-fou coût)
const TZ = "Africa/Algiers";    // heure du cabinet (UTC+1 fixe, sans DST)
const QUIET_FROM = 21;          // 21h00 → plus d'envoi
const QUIET_TO = 8;             // 08h00 → reprise
const SMS_MAX_LEN = 160;        // GSM-7 : au-delà, le SMS est facturé double

// ── Portage fidèle de js/tabibi-sms.js (GSM-7 = 160 car. au lieu de 70) ──
function toGSM7(str: unknown): string {
  if (!str) return "";
  return String(str)
    .replace(/[àâä]/gi, "a").replace(/[éèêë]/gi, "e")
    .replace(/[îï]/gi, "i").replace(/[ôö]/gi, "o")
    .replace(/[ùûü]/gi, "u").replace(/[ÿ]/gi, "y")
    .replace(/[ç]/gi, "c").replace(/[ñ]/gi, "n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

function sanitizeSMS(str: unknown): string {
  if (str == null) return "";
  return toGSM7(String(str))
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80);
}

// Normalisation DZ : retourne "213XXXXXXXXX" (sans "+") ou null.
function normalizePhoneDZ(phone: unknown): string | null {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-\(\)\.+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = "213" + p.slice(1);
  if (!p.startsWith("213")) {
    if (/^[567]/.test(p) && p.length === 9) p = "213" + p;
    else return null;
  }
  if (!/^213[567]\d{8}$/.test(p)) return null;
  return p;
}

// Template rdv_reminder_j1 — porté à l'identique de js/tabibi-sms.js:94.
// Le mot « Tabibi » est DANS LE CORPS : sur le réseau DZ, un sender
// alphanumérique est filtré par les opérateurs (jamais livré), l'envoi
// part donc d'un sender numérique (BSMS_FROM).
function tplReminderJ1(data: { lang?: string; doctorName?: string; date?: string; time?: string }): string {
  const lang = data.lang || "fr";
  const doc = sanitizeSMS(data.doctorName) || "medecin";
  const date = sanitizeSMS(data.date) || "demain";
  const time = sanitizeSMS(data.time);
  const T: Record<string, string> = {
    fr: "Tabibi: rappel RDV " + date + (time ? " a " + time : "") + " avec " + doc + ". tabibi.doctor",
    ar: "Tabibi: tadhkir maw3id " + date + (time ? " fi " + time : "") + " ma3a " + doc + ". tabibi.doctor",
    en: "Tabibi: reminder appt " + date + (time ? " at " + time : "") + " with " + doc + ". tabibi.doctor",
  };
  return T[lang] || T.fr;
}

// Date/heure telles que le patient les vit : heure d'Alger, pas celle du serveur.
function fmtDateAlgiers(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
function fmtTimeAlgiers(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function hourAlgiers(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(d));
}

Deno.serve(async (req) => {
  // ── 1. Authentification du déclencheur (cron) ───────────────────────
  const cronSecret = Deno.env.get("REMINDERS_CRON_SECRET");
  if (!cronSecret) {
    console.error("[reminders] REMINDERS_CRON_SECRET manquant côté fonction");
    return new Response(JSON.stringify({ error: "not configured" }), { status: 500, headers: JSON_HEADERS });
  }
  if (req.headers.get("x-reminders-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
  }

  // ── 2. Paramètres d'exécution ───────────────────────────────────────
  // dry_run est VRAI par défaut : tant qu'on ne demande pas explicitement
  // false, aucun SMS n'est envoyé (les lignes outbox sont journalisées
  // en 'skipped'). Sécurité volontaire — un cron mal configuré ne peut
  // pas déclencher une facture surprise.
  let body: { dry_run?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* corps vide accepté */ }
  const dryRun = body.dry_run !== false;

  // Kill-switch (secret REMINDERS_ENABLED, défaut "true")
  if ((Deno.env.get("REMINDERS_ENABLED") ?? "true").toLowerCase() === "false") {
    return new Response(JSON.stringify({ ok: true, skipped: "kill_switch", sent: 0 }), { status: 200, headers: JSON_HEADERS });
  }

  // Heures calmes 21h-08h (Alger) : on ne réveille personne.
  const nowHour = hourAlgiers(new Date());
  if (nowHour >= QUIET_FROM || nowHour < QUIET_TO) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "quiet_hours", hour_algiers: nowHour, sent: 0 }),
      { status: 200, headers: JSON_HEADERS },
    );
  }

  // ── 3. Client service_role (contourne la RLS — jamais exposé au client) ──
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[reminders] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
    return new Response(JSON.stringify({ error: "not configured" }), { status: 500, headers: JSON_HEADERS });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 4. RDV dus : confirmés, dans [now+23h, now+25h] ─────────────────
  const from = new Date(Date.now() + 23 * 3600_000).toISOString();
  const to = new Date(Date.now() + 25 * 3600_000).toISOString();

  const { data: appts, error: apptErr } = await db
    .from("appointments")
    .select("id, patient_id, doctor_id, starts_at, status")
    .eq("status", "confirmed")          // exclut de fait pending/cancelled/completed
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true })
    .limit(BATCH_MAX);

  if (apptErr) {
    console.error("[reminders] lecture appointments:", apptErr.message);
    return new Response(JSON.stringify({ error: "db_read_failed" }), { status: 500, headers: JSON_HEADERS });
  }
  if (!appts || appts.length === 0) {
    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, candidates: 0, sent: 0 }), { status: 200, headers: JSON_HEADERS });
  }

  // Pré-filtre : rappels J-1 déjà journalisés (l'index UNIQUE reste le
  // garde-fou dur ; ceci évite juste des tentatives inutiles).
  const ids = appts.map((a) => a.id);
  const { data: already } = await db
    .from("appointment_notifications")
    .select("appointment_id")
    .eq("kind", "j1")
    .in("appointment_id", ids);
  const done = new Set((already ?? []).map((r) => r.appointment_id));
  const todo = appts.filter((a) => !done.has(a.id));

  // ── 5. Résolution patients (téléphone + langue) et médecins (nom) ───
  // La RLS bloque ces lectures côté navigateur ; service_role les autorise.
  // `select("*")` volontaire : aucune colonne de langue n'existe
  // aujourd'hui dans public.users (la langue vit dans localStorage), donc
  // on lit ce qui est là et on retombe sur "fr" — sans casser si une
  // colonne locale/lang est ajoutée plus tard.
  const patientIds = [...new Set(todo.map((a) => a.patient_id).filter(Boolean))];
  const doctorIds = [...new Set(todo.map((a) => a.doctor_id).filter(Boolean))];

  const { data: patients } = await db.from("users").select("*").in("id", patientIds);
  const { data: doctors } = await db.from("doctor_profiles").select("id, full_name").in("id", doctorIds);

  const pById = new Map((patients ?? []).map((u) => [u.id, u]));
  const dById = new Map((doctors ?? []).map((d) => [d.id, d]));

  // ── 6. Envoi ────────────────────────────────────────────────────────
  const BSMS_USER = Deno.env.get("BSMS_USER");
  const BSMS_USERID = Deno.env.get("BSMS_USERID");
  const BSMS_HANDLE = Deno.env.get("BSMS_HANDLE");
  const BSMS_FROM = Deno.env.get("BSMS_FROM") ?? "12345"; // sender NUMÉRIQUE (obligatoire en DZ)

  if (!dryRun && (!BSMS_USER || !BSMS_USERID || !BSMS_HANDLE)) {
    console.error("[reminders] identifiants BudgetSMS manquants");
    return new Response(JSON.stringify({ error: "sms provider not configured" }), { status: 500, headers: JSON_HEADERS });
  }

  const summary = { candidates: todo.length, sent: 0, failed: 0, skipped: 0, no_phone: 0, duplicate: 0 };

  for (const a of todo) {
    const patient = pById.get(a.patient_id);
    const doctor = dById.get(a.doctor_id);
    const phone = normalizePhoneDZ(patient?.phone);

    // Numéro inexploitable → on journalise en 'skipped' (trace explicite,
    // et le slot unique est consommé : pas de retentative en boucle).
    if (!phone) {
      summary.no_phone++;
      await db.from("appointment_notifications").insert({
        appointment_id: a.id, kind: "j1", to_phone: null,
        status: "skipped", error: "phone_invalid_or_missing",
      });
      continue;
    }

    const lang = (patient?.locale ?? patient?.lang ?? patient?.preferred_language ?? "fr").toString().slice(0, 2);
    let message = tplReminderJ1({
      lang,
      doctorName: doctor?.full_name,
      date: fmtDateAlgiers(a.starts_at),
      time: fmtTimeAlgiers(a.starts_at),
    });
    if (message.length > SMS_MAX_LEN) message = message.substring(0, SMS_MAX_LEN);

    // 6a. Réservation du slot AVANT l'envoi (verrou anti-doublon).
    const { data: row, error: insErr } = await db
      .from("appointment_notifications")
      .insert({
        appointment_id: a.id, kind: "j1", to_phone: phone,
        status: dryRun ? "skipped" : "pending",
        error: dryRun ? "dry_run" : null,
      })
      .select("id")
      .single();

    if (insErr) {
      // 23505 = violation de l'index UNIQUE → un autre run a déjà pris ce RDV.
      if ((insErr as { code?: string }).code === "23505") { summary.duplicate++; continue; }
      console.error("[reminders] insert outbox:", insErr.message);
      summary.failed++;
      continue;
    }

    // 6b. Dry-run : on s'arrête là, rien n'est envoyé ni facturé.
    if (dryRun) { summary.skipped++; continue; }

    // 6c. Envoi réel BudgetSMS (GET, `to` sans "+").
    try {
      const url = "https://api.budgetsms.net/sendsms/"
        + `?username=${encodeURIComponent(BSMS_USER!)}`
        + `&userid=${encodeURIComponent(BSMS_USERID!)}`
        + `&handle=${encodeURIComponent(BSMS_HANDLE!)}`
        + `&from=${encodeURIComponent(BSMS_FROM)}`
        + `&to=${encodeURIComponent(phone)}`
        + `&msg=${encodeURIComponent(message)}`;

      const res = await fetch(url);
      const raw = (await res.text()).trim();

      if (raw.startsWith("OK")) {
        // "OK <smsid> <cost> <parts>"
        const [, smsId, cost] = raw.split(/\s+/);
        await db.from("appointment_notifications")
          .update({ status: "sent", provider_msg_id: smsId ?? null, cost: cost ?? null, sent_at: new Date().toISOString() })
          .eq("id", row.id);
        summary.sent++;
      } else {
        // "ERR <code>"
        await db.from("appointment_notifications")
          .update({ status: "failed", error: raw.substring(0, 200) })
          .eq("id", row.id);
        summary.failed++;
      }
    } catch (err) {
      await db.from("appointment_notifications")
        .update({ status: "failed", error: `network: ${(err as Error).message}`.substring(0, 200) })
        .eq("id", row.id);
      summary.failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, dry_run: dryRun, ...summary }), { status: 200, headers: JSON_HEADERS });
});
