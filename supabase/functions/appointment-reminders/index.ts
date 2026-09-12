// supabase/functions/appointment-reminders/index.ts
// =====================================================================
// Notifications RDV par SMS (BudgetSMS) — 3 passes en une exécution.
// ---------------------------------------------------------------------
// Fonction AUTONOME, appelée par pg_cron (toutes les 15 min, une fois le
// dry_run validé). Elle N'EST PAS un hook Supabase Auth : elle ne touche
// PAS à `send-sms`, réservé à l'OTP de connexion (webhook signé — le
// modifier casserait le login de tout le monde).
//
// LES 3 PASSES
//   • j1           — rappel la veille. Fenêtre [now+6h, now+24h] : tout
//                    RDV confirmé des 24 h à venir sans ligne `j1`.
//                    Fenêtre LARGE en haut → rattrape ce qui a été laissé
//                    de côté (heures calmes, run raté, déploiement).
//                    Plancher à 6 h → NE RECOUVRE PAS la fenêtre h2 : un
//                    RDV à moins de 6 h ne reçoit que le rappel h2, jamais
//                    les deux (bug constaté en test réel : 2 SMS pour 1 RDV).
//
//                    CONSÉQUENCE ASSUMÉE : un RDV pris tard le soir pour le
//                    lendemain matin (donc à moins de 6 h, ou traité pendant
//                    la fenêtre calme) peut ne recevoir QUE le rappel h2.
//                    C'est acceptable : le patient est rappelé 2 h avant, et
//                    il vient tout juste de prendre le RDV — un « rappel la
//                    veille » n'aurait de toute façon aucune valeur ajoutée.
//   • h2           — rappel ~2 h avant. Fenêtre [now+90min, now+150min].
//   • confirmation — draine l'outbox : les lignes `kind='confirmation'`
//                    status='pending' déposées par le TRIGGER SQL au
//                    passage status → 'confirmed'. La fonction n'invente
//                    aucune confirmation, elle ne fait qu'envoyer.
//
// HEURES CALMES (21h-08h Alger) — appliquées à `j1` UNIQUEMENT :
//   • j1           : suspendu (un rappel de la veille peut attendre 08h,
//                    la fenêtre large garantit le rattrapage)
//   • h2           : JAMAIS suspendu — si le RDV est à 7h du matin, le
//                    rappel H-2 doit partir à 5h, sinon il ne sert à rien
//   • confirmation : JAMAIS suspendue — message transactionnel, le
//                    patient vient d'agir et l'attend tout de suite
//
// ANTI-DOUBLON — deux mécanismes, selon la passe :
//   • j1/h2        : INSERT de la ligne outbox AVANT l'appel BudgetSMS.
//                    L'index UNIQUE (appointment_id, kind) fait échouer
//                    toute seconde tentative (Postgres 23505) → RDV sauté.
//   • confirmation : la ligne existe déjà (posée par le trigger). Le
//                    verrou est un UPDATE conditionnel 'pending'→'sending'
//                    qui ne réussit qu'une fois (le perdant lit 0 ligne).
//   Dans les deux cas, deux exécutions concurrentes du cron ne peuvent
//   pas envoyer deux fois le même message.
//
// ÉCRITURES — la fonction n'écrit QUE lorsqu'elle envoie vraiment :
//   • dry_run=true      → AUCUNE écriture, retourne les candidats des
//                         3 passes + un échantillon par passe
//   • heures calmes     → AUCUNE écriture pour j1
//   • numéro invalide   → AUCUNE écriture (j1/h2) : le RDV reste éligible
//                         si le patient corrige son numéro
//   Un dry-run ne « brûle » donc aucun message et reste rejouable.
//
// SÉCURITÉ : header `x-reminders-secret` obligatoire (comparé à
//   REMINDERS_CRON_SECRET), sinon 401. Aucun secret en dur : tout vient
//   de Deno.env. Le service_role ne quitte jamais la fonction.
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

const BATCH_MAX = 200;          // plafond d'envois par passe (garde-fou coût)
const SAMPLE_MAX = 20;          // taille de l'échantillon renvoyé en dry_run
const TZ = "Africa/Algiers";    // heure du cabinet (UTC+1 fixe, sans DST)
const QUIET_FROM = 21;          // 21h00 → plus de rappel j1
const QUIET_TO = 8;             // 08h00 → reprise
const SMS_MAX_LEN = 160;        // GSM-7 : au-delà, le SMS est facturé double

// Fenêtres de balayage, en minutes depuis maintenant.
// ⚠️ Les deux fenêtres NE DOIVENT PAS SE RECOUVRIR : avec un plancher j1
// à 60 min, un RDV à ~100 min tombait dans les deux passes et le patient
// recevait 2 SMS (constaté en test réel). Le plancher j1 est donc à 6 h,
// bien au-dessus du plafond h2 (150 min) — marge volontaire.
const WINDOWS = {
  j1: { fromMin: 6 * 60, toMin: 24 * 60 },  // [now+6h,  now+24h]
  h2: { fromMin: 90, toMin: 150 },          // [now+90min, now+150min]
} as const;

// ─────────────────────────────────────────────────────────────────────
// Portage fidèle de js/tabibi-sms.js (GSM-7 = 160 car. au lieu de 70)
// ─────────────────────────────────────────────────────────────────────
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
    .replace(/ /g, " ");
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

// ─────────────────────────────────────────────────────────────────────
// TEMPLATES (fr/ar/en, ASCII GSM-7)
// Sender : mesuré le 2026-07-31 sur MCCMNC 60302 (même numéro, même
// opérateur) — sender alphanumérique "Tabibi" → 5/5 livrés (4 tests + 1 OTP
// d'inscription réelle, 2026-07-31 22:05) ; sender numérique partagé "12345"
// → 11/19 livrés (~42 % perdus). BSMS_FROM vaut donc "Tabibi".
// Le mot « Tabibi » reste dans le CORPS du message.
// Réserve : Google Messages classe le 1er SMS en Spam tant que "Tabibi"
// n'est pas enregistré auprès des opérateurs DZ chez BudgetSMS.
// j1 et h2 sont portés à l'identique de js/tabibi-sms.js ; confirmation
// est nouveau et vit ici (pas dans le module front, qui est désactivé).
// ─────────────────────────────────────────────────────────────────────
// Les valeurs viennent de la DB : elles peuvent être null (et pas
// seulement undefined) — sinon erreur de type sous strictNullChecks.
interface TplData {
  lang?: string | null; doctorName?: string | null; date?: string | null;
  time?: string | null; shortAddress?: string | null;
}

function tplJ1(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || "medecin";
  const date = sanitizeSMS(d.date) || "demain";
  const time = sanitizeSMS(d.time);
  const T: Record<string, string> = {
    fr: "Tabibi: rappel RDV " + date + (time ? " a " + time : "") + " avec " + doc + ". tabibi.doctor",
    ar: "Tabibi: tadhkir maw3id " + date + (time ? " fi " + time : "") + " ma3a " + doc + ". tabibi.doctor",
    en: "Tabibi: reminder appt " + date + (time ? " at " + time : "") + " with " + doc + ". tabibi.doctor",
  };
  return T[d.lang ?? "fr"] ?? T.fr;
}

function tplH2(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || "medecin";
  const time = sanitizeSMS(d.time);
  const addr = sanitizeSMS(d.shortAddress);
  const T: Record<string, string> = {
    fr: "Tabibi: RDV dans 2h avec " + doc + (time ? " a " + time : "") + "." + (addr ? " " + addr : "") + " Bon RDV!",
    ar: "Tabibi: maw3id fi sa3atayn ma3a " + doc + (time ? " fi " + time : "") + "." + (addr ? " " + addr : "") + " Bon RDV!",
    en: "Tabibi: appt in 2h with " + doc + (time ? " at " + time : "") + "." + (addr ? " " + addr : "") + " Good visit!",
  };
  return T[d.lang ?? "fr"] ?? T.fr;
}

function tplConfirmation(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || "medecin";
  const date = sanitizeSMS(d.date);
  const time = sanitizeSMS(d.time);
  const T: Record<string, string> = {
    fr: "Tabibi: votre RDV du " + date + " a " + time + " avec Dr " + doc + " est confirme. tabibi.doctor",
    ar: "Tabibi: maw3idik yawm " + date + " fi " + time + " ma3a Dr " + doc + " mo2akkad. tabibi.doctor",
    en: "Tabibi: your appt on " + date + " at " + time + " with Dr " + doc + " is confirmed. tabibi.doctor",
  };
  return T[d.lang ?? "fr"] ?? T.fr;
}

// ── Date/heure telles que le patient les vit : heure d'Alger ──────────
function fmtDateAlgiers(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
function fmtTimeAlgiers(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function hourAlgiers(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(d));
}

function langOf(patient: Row | undefined): string {
  // Aucune colonne de langue n'existe aujourd'hui dans public.users (la
  // langue vit dans localStorage) → on lit ce qui est là, repli sur "fr",
  // sans casser si une colonne locale/lang est ajoutée plus tard.
  const raw = patient?.locale ?? patient?.lang ?? patient?.preferred_language ?? "fr";
  return String(raw).slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────
// Envoi BudgetSMS (GET, `to` sans "+") — retourne le résultat brut parsé.
// ─────────────────────────────────────────────────────────────────────
interface SmsCreds { user: string; userid: string; handle: string; from: string }

async function sendSms(creds: SmsCreds, to: string, message: string):
  Promise<{ ok: true; id: string | null; cost: string | null } | { ok: false; error: string }> {
  try {
    const url = "https://api.budgetsms.net/sendsms/"
      + `?username=${encodeURIComponent(creds.user)}`
      + `&userid=${encodeURIComponent(creds.userid)}`
      + `&handle=${encodeURIComponent(creds.handle)}`
      + `&from=${encodeURIComponent(creds.from)}`
      + `&to=${encodeURIComponent(to)}`
      + `&msg=${encodeURIComponent(message)}`;
    const res = await fetch(url);
    const raw = (await res.text()).trim();
    if (raw.startsWith("OK")) {
      // "OK <smsid> <cost> <parts>"
      const [, id, cost] = raw.split(/\s+/);
      return { ok: true, id: id ?? null, cost: cost ?? null };
    }
    return { ok: false, error: raw.substring(0, 200) };   // "ERR <code>"
  } catch (err) {
    return { ok: false, error: `network: ${(err as Error).message}`.substring(0, 200) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Contexte partagé : patients (téléphone + langue) et médecins (nom).
// La RLS bloque ces lectures côté navigateur ; service_role les autorise.
// `select("*")` volontaire : évite un 400 si une colonne attendue
// (locale, address…) n'existe pas dans ce projet.
// ─────────────────────────────────────────────────────────────────────
type Row = Record<string, string | null>;

async function loadContext(db: SupabaseClient, patientIds: string[], doctorIds: string[]) {
  const pById = new Map<string, Row>();
  const dById = new Map<string, Row>();

  if (patientIds.length) {
    const { data } = await db.from("users").select("*").in("id", patientIds);
    for (const u of (data ?? []) as Row[]) if (u.id) pById.set(String(u.id), u);
  }
  if (doctorIds.length) {
    const { data } = await db.from("doctor_profiles").select("*").in("id", doctorIds);
    for (const d of (data ?? []) as Row[]) if (d.id) dById.set(String(d.id), d);
  }
  return { pById, dById };
}

// Accès tolérant aux clés potentiellement absentes/nulles.
function pick(map: Map<string, Row>, id: string | null | undefined): Row | undefined {
  return id ? map.get(String(id)) : undefined;
}

// ─────────────────────────────────────────────────────────────────────
// PASSE j1 / h2 — balayage des RDV dus dans une fenêtre.
// ─────────────────────────────────────────────────────────────────────
async function scanPass(
  db: SupabaseClient,
  kind: "j1" | "h2",
  dryRun: boolean,
  creds: SmsCreds | null,
) {
  const w = WINDOWS[kind];
  const from = new Date(Date.now() + w.fromMin * 60_000).toISOString();
  const to = new Date(Date.now() + w.toMin * 60_000).toISOString();

  const { data: appts, error } = await db
    .from("appointments")
    .select("id, patient_id, doctor_id, starts_at, status")
    .eq("status", "confirmed")            // exclut pending/cancelled/completed
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true })
    .limit(BATCH_MAX);

  if (error) {
    console.error(`[reminders/${kind}] lecture appointments:`, error.message);
    return { error: "db_read_failed" };
  }
  if (!appts || appts.length === 0) return { candidates: 0, sent: 0, failed: 0, no_phone: 0, duplicate: 0, sample: [] };

  // Pré-filtre (l'index UNIQUE reste le garde-fou dur ; ceci évite des
  // tentatives inutiles).
  const ids = appts.map((a) => a.id);
  const { data: already } = await db
    .from("appointment_notifications")
    .select("appointment_id")
    .eq("kind", kind)
    .in("appointment_id", ids);
  const done = new Set((already ?? []).map((r) => r.appointment_id));
  const todo = appts.filter((a) => !done.has(a.id));

  const { pById, dById } = await loadContext(
    db,
    [...new Set(todo.map((a) => a.patient_id).filter(Boolean))],
    [...new Set(todo.map((a) => a.doctor_id).filter(Boolean))],
  );

  // ── Dry-run : lecture seule, on ne consomme aucun slot ──────────────
  if (dryRun) {
    return {
      candidates: todo.length,
      sample: todo.slice(0, SAMPLE_MAX).map((a) => ({
        appointment_id: a.id,
        to_phone: normalizePhoneDZ(pick(pById, a.patient_id)?.phone),
        starts_at: a.starts_at,
        lang: langOf(pick(pById, a.patient_id)),
      })),
    };
  }

  // ── Envoi réel ──────────────────────────────────────────────────────
  // Garde explicite plutôt qu'une assertion `creds!` : si les
  // identifiants manquent, on n'écrit rien et on le dit.
  if (!creds) return { error: "sms_credentials_missing" };

  const summary = { candidates: todo.length, sent: 0, failed: 0, no_phone: 0, duplicate: 0 };

  for (const a of todo) {
    const patient = pick(pById, a.patient_id);
    const doctor = pick(dById, a.doctor_id);
    const phone = normalizePhoneDZ(patient?.phone);

    // Numéro inexploitable : on ne consomme PAS le slot — si le patient
    // corrige son numéro, le message partira au run suivant.
    if (!phone) { summary.no_phone++; continue; }

    const data: TplData = {
      lang: langOf(patient),
      doctorName: doctor?.full_name,
      date: fmtDateAlgiers(String(a.starts_at)),
      time: fmtTimeAlgiers(String(a.starts_at)),
      shortAddress: doctor?.address,
    };
    let message = kind === "j1" ? tplJ1(data) : tplH2(data);
    if (message.length > SMS_MAX_LEN) message = message.substring(0, SMS_MAX_LEN);

    // (a) Réservation du slot AVANT l'envoi = verrou anti-doublon.
    const { data: row, error: insErr } = await db
      .from("appointment_notifications")
      .insert({ appointment_id: a.id, kind, to_phone: phone, status: "pending" })
      .select("id")
      .single();

    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") { summary.duplicate++; continue; }
      console.error(`[reminders/${kind}] insert outbox:`, insErr.message);
      summary.failed++;
      continue;
    }

    // (b) Envoi · (c) mise à jour du statut.
    const res = await sendSms(creds, phone, message);
    if (res.ok) {
      await db.from("appointment_notifications")
        .update({ status: "sent", provider_msg_id: res.id, cost: res.cost, sent_at: new Date().toISOString() })
        .eq("id", row.id);
      summary.sent++;
    } else {
      await db.from("appointment_notifications")
        .update({ status: "failed", error: res.error })
        .eq("id", row.id);
      summary.failed++;
    }
  }
  return summary;
}

// ─────────────────────────────────────────────────────────────────────
// PASSE confirmation — draine l'outbox alimentée par le trigger SQL.
// Le trigger pose la ligne (status='pending') au passage → 'confirmed' ;
// il n'envoie rien. Ici on résout le téléphone si le trigger ne l'a pas
// fait (to_phone NULL) puis on envoie.
// ─────────────────────────────────────────────────────────────────────
async function confirmationPass(db: SupabaseClient, dryRun: boolean, creds: SmsCreds | null) {
  const { data: rows, error } = await db
    .from("appointment_notifications")
    .select("id, appointment_id, to_phone")
    .eq("kind", "confirmation")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_MAX);

  if (error) {
    console.error("[reminders/confirmation] lecture outbox:", error.message);
    return { error: "db_read_failed" };
  }
  if (!rows || rows.length === 0) return { candidates: 0, sent: 0, failed: 0, no_phone: 0, duplicate: 0, sample: [] };

  // RDV liés (date/heure/médecin + patient pour la langue et le repli tél.)
  const apptIds = rows.map((r) => r.appointment_id);
  const { data: appts } = await db
    .from("appointments")
    .select("id, patient_id, doctor_id, starts_at, status")
    .in("id", apptIds);
  const aById = new Map<string, Row>();
  for (const a of (appts ?? []) as Row[]) if (a.id) aById.set(String(a.id), a);

  const { pById, dById } = await loadContext(
    db,
    [...new Set((appts ?? []).map((a) => a.patient_id).filter(Boolean))],
    [...new Set((appts ?? []).map((a) => a.doctor_id).filter(Boolean))],
  );

  if (dryRun) {
    return {
      candidates: rows.length,
      sample: rows.slice(0, SAMPLE_MAX).map((r) => {
        const a = pick(aById, r.appointment_id);
        return {
          appointment_id: r.appointment_id,
          to_phone: r.to_phone ?? normalizePhoneDZ(pick(pById, a?.patient_id)?.phone),
          starts_at: a?.starts_at ?? null,
          lang: langOf(pick(pById, a?.patient_id)),
        };
      }),
    };
  }

  if (!creds) return { error: "sms_credentials_missing" };

  const summary = { candidates: rows.length, sent: 0, failed: 0, no_phone: 0, duplicate: 0 };

  for (const r of rows) {
    const a = pick(aById, r.appointment_id);
    const patient = pick(pById, a?.patient_id);
    const doctor = pick(dById, a?.doctor_id);

    // Le trigger a pu poser to_phone=NULL : on résout ici en service_role.
    const phone = normalizePhoneDZ(r.to_phone ?? patient?.phone);
    if (!phone || !a) { summary.no_phone++; continue; }

    // Verrou : 'pending' → 'sending'. Un seul run peut gagner ; le perdant
    // reçoit 0 ligne et passe au suivant.
    const { data: claimed } = await db
      .from("appointment_notifications")
      .update({ status: "sending", to_phone: phone })
      .eq("id", r.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) { summary.duplicate++; continue; }

    let message = tplConfirmation({
      lang: langOf(patient),
      doctorName: doctor?.full_name,
      date: fmtDateAlgiers(String(a.starts_at)),
      time: fmtTimeAlgiers(String(a.starts_at)),
    });
    if (message.length > SMS_MAX_LEN) message = message.substring(0, SMS_MAX_LEN);

    const res = await sendSms(creds, phone, message);
    if (res.ok) {
      await db.from("appointment_notifications")
        .update({ status: "sent", provider_msg_id: res.id, cost: res.cost, sent_at: new Date().toISOString() })
        .eq("id", r.id);
      summary.sent++;
    } else {
      await db.from("appointment_notifications")
        .update({ status: "failed", error: res.error })
        .eq("id", r.id);
      summary.failed++;
    }
  }
  return summary;
}

// ─────────────────────────────────────────────────────────────────────
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
  // dry_run est VRAI par défaut : il faut passer explicitement false pour
  // envoyer. Un cron mal configuré ne peut pas générer de facture surprise.
  let body: { dry_run?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* corps vide accepté */ }
  const dryRun = body.dry_run !== false;

  // Kill-switch global (secret REMINDERS_ENABLED, défaut "true")
  if ((Deno.env.get("REMINDERS_ENABLED") ?? "true").toLowerCase() === "false") {
    return new Response(JSON.stringify({ ok: true, skipped: "kill_switch" }), { status: 200, headers: JSON_HEADERS });
  }

  // ── 3. Client service_role (contourne la RLS — jamais exposé au client) ──
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = (Deno.env.get("TABIBI_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[reminders] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
    return new Response(JSON.stringify({ error: "not configured" }), { status: 500, headers: JSON_HEADERS });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 4. Identifiants SMS (inutiles en dry_run : rien n'est envoyé) ────
  const BSMS_USER = Deno.env.get("BSMS_USER");
  const BSMS_USERID = Deno.env.get("BSMS_USERID");
  const BSMS_HANDLE = Deno.env.get("BSMS_HANDLE");
  const BSMS_FROM = Deno.env.get("BSMS_FROM") ?? "Tabibi"; // sender ALPHANUMÉRIQUE (mesuré 2026-07-31)

  if (!dryRun && (!BSMS_USER || !BSMS_USERID || !BSMS_HANDLE)) {
    console.error("[reminders] identifiants BudgetSMS manquants");
    return new Response(JSON.stringify({ error: "sms provider not configured" }), { status: 500, headers: JSON_HEADERS });
  }
  const creds: SmsCreds | null = dryRun ? null
    : { user: BSMS_USER!, userid: BSMS_USERID!, handle: BSMS_HANDLE!, from: BSMS_FROM };

  // ── 5. Heures calmes : bloque j1 SEULEMENT (h2 et confirmation passent) ──
  const nowHour = hourAlgiers(new Date());
  const quiet = nowHour >= QUIET_FROM || nowHour < QUIET_TO;

  // ── 6. Exécution des 3 passes ───────────────────────────────────────
  // En dry_run on calcule j1 même pendant les heures calmes (rien n'est
  // envoyé) : c'est plus informatif ; `quiet_hours` signale que ce lot
  // serait suspendu lors d'un run réel.
  const j1 = (quiet && !dryRun) ? { skipped: "quiet_hours" } : await scanPass(db, "j1", dryRun, creds);
  const h2 = await scanPass(db, "h2", dryRun, creds);
  const confirmation = await confirmationPass(db, dryRun, creds);

  return new Response(
    JSON.stringify({ ok: true, dry_run: dryRun, quiet_hours: quiet, hour_algiers: nowHour, j1, h2, confirmation }),
    { status: 200, headers: JSON_HEADERS },
  );
});
