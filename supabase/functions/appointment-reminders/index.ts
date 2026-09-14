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
//
// =====================================================================
// ⚠️  [14/09/2026] CETTE FONCTION N'A JAMAIS ENVOYÉ UN SEUL SMS.
// =====================================================================
// Et ce n'est pas elle qui était en cause. **Le cron ne pouvait pas entrer.**
//
// Mesure du 14/09, `cron.job` n° 2 — actif depuis le 29/07, toutes les
// 15 minutes, `dry_run: false` :
//
//     headers := jsonb_build_object('Content-Type','application/json',
//                                   'x-reminders-secret','TA_CLE')
//                                                        ^^^^^^^^
//     un espace réservé, jamais remplacé.
//
// Et la preuve, côté réponses (`net._http_response`, qui n'en garde que
// quelques heures) :
//
//     status_code 401 · 24 réponses sur 24 · contenu {"error":"unauthorized"}
//
// `cron.job_run_details` affichait pourtant **4 531 exécutions « succeeded »**
// depuis le 29/07. C'est exact et trompeur : `pg_net` est ASYNCHRONE — le SQL
// réussit en DÉPOSANT la requête, il n'attend pas la réponse. **Un tableau de
// bord tout vert pendant 47 jours pour un dispositif qui ne faisait rien.**
//
// À DÉCHARGE, et il faut le dire aussi : même avec le bon secret, aucun SMS ne
// serait parti — il y a 1 rendez-vous en base, `cancelled`, et 0 `confirmed`.
// Le 401 est réel ; ce n'est pas lui, à lui seul, qui a privé un patient d'un
// rappel. Les deux sont vrais, et l'un n'excuse pas l'autre.
//
// CE QUI CHANGE DANS CE LOT :
//   • le secret du cron vient du VAULT, plus d'un littéral à remplacer à la
//     main (`20260914_rappels_sms_reels.sql`, NON APPLIQUÉE). La migration
//     REFUSE de s'appliquer si le secret n'est pas posé : elle ne sait pas
//     recréer le silence qu'elle corrige ;
//   • une sentinelle horaire écrit dans `audit_log_echecs` dès qu'une réponse
//     du cron n'est pas 2xx. **Le défaut n'était pas le 401, c'était les
//     47 jours** ;
//   • `sms_log` est enfin écrit : sans lui, `sms-dlr` ne rattachait AUCUN
//     accusé de livraison de rappel ;
//   • `notifications_sms` : le refus de SMS était inexprimable, la colonne
//     n'existait pas ;
//   • un mode d'essai supervisé borné à UN rendez-vous.
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
// [14/09/2026] Les helpers purs vivent desormais dans un module a part, pour
// pouvoir etre ESSAYES (tests/rappels-sms.test.mjs, execute sous Node). Rien
// n'a change dans leur contenu. ⚠️ Dependance relative : a deployer avec ce
// fichier.
import {
  borner, estHeureCalme, fmtDateAlgiers, fmtTimeAlgiers, hourAlgiers,
  normalizePhoneDZ, tplConfirmation, tplH2, tplJ1, WINDOWS,
  type TplData,
} from "../_partage/sms-rappels.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

const BATCH_MAX = 200;          // plafond d'envois par passe (garde-fou cout)
const SAMPLE_MAX = 20;          // taille de l'echantillon renvoye en dry_run

function langOf(patient: Row | undefined): string {
  // [14/09/2026] LE COMMENTAIRE QUI ETAIT ICI DISAIT FAUX : « aucune colonne
  // de langue n'existe dans public.users ». **`locale` existe** (mesuree le
  // 14/09). Le code, lui, la lisait deja en premier — il etait juste, son
  // commentaire ne l'etait plus. Les deux replis suivants restent : ils ne
  // coutent rien et couvrent un renommage.
  const raw = patient?.locale ?? patient?.lang ?? patient?.preferred_language ?? "fr";
  return String(raw).slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────
// Le patient veut-il des SMS ?
// ─────────────────────────────────────────────────────────────────────
// [14/09/2026] Il n'y avait RIEN a respecter : `public.users` porte
// `notifications_push`, `notifications_whatsapp` et `notifications_marketing`
// — **pas de `notifications_sms`**. Un refus de SMS etait donc inexprimable.
// La colonne est ajoutee par `20260914_rappels_sms_reels.sql` (NON APPLIQUEE),
// a `true` par defaut.
//
// DEFAUT `true` ASSUME : un rappel de rendez-vous est transactionnel — le
// patient a pris ce RDV, il attend qu'on le lui rappelle. Ce n'est pas de la
// prospection, et `notifications_marketing` reste, lui, a l'opposé. Mais
// « transactionnel » n'est pas « impossible a refuser » : la colonne existe
// pour que quelqu'un PUISSE dire non.
//
// Tant que la migration n'est pas appliquee, la colonne est absente : on lit
// `undefined` et on envoie. **On ne refuse jamais un envoi sur une colonne
// qu'on n'a pas** — ce serait couper les rappels au lieu de les respecter.
function veutDesSms(patient: Row | undefined): boolean {
  return (patient?.notifications_sms as unknown as boolean | undefined) !== false;
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
// Journal fournisseur — `public.sms_log`
// ─────────────────────────────────────────────────────────────────────
// [14/09/2026] CE QUI MANQUAIT, ET CE QUE CA CASSAIT.
//
// Cette fonction n'ecrivait que dans `appointment_notifications`. Or
// `sms-dlr` — qui recoit les accuses de livraison de BudgetSMS — retrouve
// l'envoi par `sms_log.provider_msg_id`, et **par la seule `sms_log`** :
//
//     .from("sms_log").update(…).eq("provider_msg_id", smsid)
//     else if (!count) console.warn("[sms-dlr] aucun envoi connu pour smsid", smsid)
//
// Autrement dit : chaque accuse de livraison d'un rappel tombait dans le vide,
// avec un avertissement que personne ne lit. **Un SMS « envoye » et un SMS
// « recu » restaient indiscernables pour les rappels** — exactement l'angle
// mort que la journalisation de l'OTP avait ete ecrite pour fermer, le 09/09.
//
// On ecrit donc aux DEUX endroits, et ce n'est pas un doublon : l'un suit le
// RENDEZ-VOUS (une ligne par RDV et par type, avec son verrou d'unicite),
// l'autre suit le MESSAGE chez le fournisseur (c'est lui qui recoit le DLR).
//
// Best-effort, comme dans `send-sms` : un echec d'ecriture au journal ne doit
// jamais faire croire que le SMS n'est pas parti — il l'est.
async function journaliserSms(db: SupabaseClient, entree: {
  user_id: string | null; phone_e164: string; body: string; status: string;
  provider_msg_id?: string | null; error_message?: string | null;
}) {
  const { error } = await db.from("sms_log").insert({ provider: "budgetsms", ...entree });
  if (error) console.error("[reminders] sms_log:", error.message);
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
  cible: string | null,        // essai supervise : UN rendez-vous, hors fenetre
) {
  const w = WINDOWS[kind];
  const from = new Date(Date.now() + w.fromMin * 60_000).toISOString();
  const to = new Date(Date.now() + w.toMin * 60_000).toISOString();

  // ESSAI SUPERVISE. Le seul assouplissement est la FENETRE DE TEMPS : sans
  // lui, essayer un rappel « 2 h avant » demanderait de creer un RDV a
  // exactement 2 h et d'attendre. Tout le reste tient : statut `confirmed`,
  // consentement, numero valide, verrou d'unicite, journaux.
  //
  // ⚠️ CE QUE CE MODE NE PERMET PAS, ET C'EST VOULU : choisir le NUMERO. Il
  // faut un rendez-vous reel dont le patient porte le numero d'essai. Un
  // parametre `to_phone` aurait fait de cette fonction un relais SMS ouvert a
  // qui detient le secret du cron.
  let q = db
    .from("appointments")
    .select("id, patient_id, doctor_id, starts_at, status")
    .eq("status", "confirmed");           // exclut pending/cancelled/completed
  q = cible
    ? q.eq("id", cible).limit(1)
    : q.gte("starts_at", from).lt("starts_at", to)
       .order("starts_at", { ascending: true }).limit(BATCH_MAX);

  const { data: appts, error } = await q;

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

  const summary = { candidates: todo.length, sent: 0, failed: 0, no_phone: 0, duplicate: 0, opted_out: 0 };

  for (const a of todo) {
    const patient = pick(pById, a.patient_id);
    const doctor = pick(dById, a.doctor_id);
    const phone = normalizePhoneDZ(patient?.phone);

    // Numéro inexploitable : on ne consomme PAS le slot — si le patient
    // corrige son numéro, le message partira au run suivant.
    if (!phone) { summary.no_phone++; continue; }

    // Refus de SMS : on ne consomme pas le slot non plus. Le patient peut
    // changer d'avis, et un creneau brule ne se rend pas.
    if (!veutDesSms(patient)) { summary.opted_out++; continue; }

    const data: TplData = {
      lang: langOf(patient),
      doctorName: doctor?.full_name,
      date: fmtDateAlgiers(String(a.starts_at)),
      time: fmtTimeAlgiers(String(a.starts_at)),
      shortAddress: doctor?.address,
    };
    const message = borner(kind === "j1" ? tplJ1(data) : tplH2(data));

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
    // Journal fournisseur — c'est LUI que `sms-dlr` retrouvera.
    await journaliserSms(db, {
      user_id: a.patient_id ? String(a.patient_id) : null,
      phone_e164: phone, body: message,
      status: res.ok ? "sent" : "failed",
      provider_msg_id: res.ok ? res.id : null,
      error_message: res.ok ? null : res.error,
    });
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

  const summary = { candidates: rows.length, sent: 0, failed: 0, no_phone: 0, duplicate: 0, opted_out: 0 };

  for (const r of rows) {
    const a = pick(aById, r.appointment_id);
    const patient = pick(pById, a?.patient_id);
    const doctor = pick(dById, a?.doctor_id);

    // Le trigger a pu poser to_phone=NULL : on résout ici en service_role.
    const phone = normalizePhoneDZ(r.to_phone ?? patient?.phone);
    if (!phone || !a) { summary.no_phone++; continue; }
    if (!veutDesSms(patient)) { summary.opted_out++; continue; }

    // Verrou : 'pending' → 'sending'. Un seul run peut gagner ; le perdant
    // reçoit 0 ligne et passe au suivant.
    const { data: claimed } = await db
      .from("appointment_notifications")
      .update({ status: "sending", to_phone: phone })
      .eq("id", r.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) { summary.duplicate++; continue; }

    const message = borner(tplConfirmation({
      lang: langOf(patient),
      doctorName: doctor?.full_name,
      date: fmtDateAlgiers(String(a.starts_at)),
      time: fmtTimeAlgiers(String(a.starts_at)),
    }));

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
    await journaliserSms(db, {
      user_id: a?.patient_id ? String(a.patient_id) : null,
      phone_e164: phone, body: message,
      status: res.ok ? "sent" : "failed",
      provider_msg_id: res.ok ? res.id : null,
      error_message: res.ok ? null : res.error,
    });
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
  let body: { dry_run?: boolean; only_appointment_id?: string; only_kind?: string } = {};
  try { body = await req.json(); } catch (_) { /* corps vide accepté */ }
  const dryRun = body.dry_run !== false;

  // ── 2 bis. Essai supervise : UN rendez-vous, UNE passe ──────────────
  // [14/09/2026] Pour l'essai reel avec Aghiles. Sans ca, il faudrait creer
  // un RDV a exactement 2 h et attendre le passage du cron — ou lancer le
  // balayage complet, qui n'a aucune raison d'etre borne le jour d'un essai.
  //
  // Ce mode NE DESSERRE RIEN d'autre que la fenetre de temps : statut
  // `confirmed`, consentement, numero valide, verrou d'unicite et journaux
  // s'appliquent tous. Et il ne permet pas de choisir le numero — il faut un
  // vrai rendez-vous. **Un parametre `to_phone` aurait fait de cette fonction
  // un relais SMS ouvert a qui detient le secret du cron.**
  const cible = typeof body.only_appointment_id === "string" ? body.only_appointment_id.trim() : "";
  if (cible && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cible)) {
    return new Response(JSON.stringify({ error: "only_appointment_id invalide" }), { status: 400, headers: JSON_HEADERS });
  }
  const passeUnique = typeof body.only_kind === "string" ? body.only_kind.trim() : "";
  if (passeUnique && !["j1", "h2", "confirmation"].includes(passeUnique)) {
    return new Response(JSON.stringify({ error: "only_kind doit valoir j1, h2 ou confirmation" }), { status: 400, headers: JSON_HEADERS });
  }
  // Cibler un RDV sans dire QUELLE passe enverrait les deux : on l'interdit
  // plutot que de deviner. Un essai qui envoie deux SMS n'est pas un essai.
  if (cible && !passeUnique) {
    return new Response(JSON.stringify({ error: "only_appointment_id exige only_kind (j1 ou h2)" }), { status: 400, headers: JSON_HEADERS });
  }

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
  const maintenant = new Date();
  const nowHour = hourAlgiers(maintenant);
  const quiet = estHeureCalme(maintenant);

  // ── 6. Exécution des 3 passes ───────────────────────────────────────
  // En dry_run on calcule j1 même pendant les heures calmes (rien n'est
  // envoyé) : c'est plus informatif ; `quiet_hours` signale que ce lot
  // serait suspendu lors d'un run réel.
  const passe = (k: string) => !passeUnique || passeUnique === k;

  const j1 = !passe("j1") ? { skipped: "only_kind" }
    : (quiet && !dryRun && !cible) ? { skipped: "quiet_hours" }
    : await scanPass(db, "j1", dryRun, creds, cible || null);
  const h2 = !passe("h2") ? { skipped: "only_kind" }
    : await scanPass(db, "h2", dryRun, creds, cible || null);
  // La passe `confirmation` draine une file : elle n'a pas de fenetre a
  // desserrer, donc `cible` ne s'y applique pas. On la saute quand un RDV
  // precis est vise, pour qu'un essai n'envoie qu'UN message.
  const confirmation = (!passe("confirmation") || cible) ? { skipped: cible ? "only_appointment_id" : "only_kind" }
    : await confirmationPass(db, dryRun, creds);

  return new Response(
    JSON.stringify({
      ok: true, dry_run: dryRun, quiet_hours: quiet, hour_algiers: nowHour,
      only_appointment_id: cible || null, only_kind: passeUnique || null,
      j1, h2, confirmation,
    }),
    { status: 200, headers: JSON_HEADERS },
  );
});
