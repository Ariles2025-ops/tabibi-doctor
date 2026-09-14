// supabase/functions/create-video-room/index.ts
// =====================================================================
// La vraie salle de teleconsultation — creee cote serveur, jamais par le client
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.** Le drapeau `video` reste a `false`
// jusqu'a un essai reel, fait ensemble.
//
// ---------------------------------------------------------------------
// LE CONTRAT EXISTAIT DEJA — je m'y conforme, je ne le redefinis pas
// ---------------------------------------------------------------------
// `teleconsultation.html:412-437` appelle cette fonction depuis des mois :
//
//     POST /functions/v1/create-video-room
//     en-tetes : Authorization: Bearer <access_token> · apikey
//     corps    : { appointment_id }
//     attendu  : { ok, session_id, role, room_url, my_token, expires_at }
//
// **Elle n'existait pas.** Les 4 edge functions deployees au 14/09 sont
// `send-sms`, `verify-turnstile`, `appointment-reminders`, `sms-dlr`.
// Le bouton « Rejoindre » partait donc vers un 404 — masque par le drapeau
// `video: false`, qui redirige avant meme de charger le SDK.
//
// `verify_jwt` : **true** (le defaut). L'appelant est le patient ou le medecin.
//
// ---------------------------------------------------------------------
// CE QUI NE DOIT JAMAIS ARRIVER
// ---------------------------------------------------------------------
// 1. **`DAILY_API_KEY` ne quitte pas cette fonction.** Elle ouvre la creation
//    de salles et de jetons sur tout le compte. Le navigateur n'appelle jamais
//    api.daily.co : il ne recoit qu'une URL de salle et UN jeton, le sien.
// 2. **Un jeton n'est jamais celui de l'autre.** Le patient recoit le jeton
//    patient, le medecin le jeton medecin (`is_owner`, qui donne le controle
//    de la salle). On ne rend pas les deux « au cas ou ».
// 3. **Une salle n'est pas eternelle.** Elle porte une date d'expiration, et
//    les jetons aussi. Sans ca, un lien de consultation reste joignable des
//    mois plus tard — une salle medicale ouverte que plus personne ne
//    surveille.
// 4. **On n'entre pas trois semaines a l'avance.** Fenetre : de 15 minutes
//    avant l'heure du rendez-vous a 30 minutes apres sa fin.
//
// ---------------------------------------------------------------------
// POURQUOI ELLE PASSE PAR LA RPC `create_video_session`
// ---------------------------------------------------------------------
// Cette RPC existe deja, elle est `SECURITY DEFINER`, elle verifie que
// l'appelant est le patient ou le medecin, que le rendez-vous est `confirmed`,
// elle est idempotente (une session par rendez-vous) **et elle ecrit au journal
// d'audit**. La reecrire ici, c'est deux chemins d'autorisation qui divergeront.
// On l'appelle donc AVEC LE JWT DE L'APPELANT — c'est elle qui autorise — puis
// on complete la ligne en `service_role` avec ce que seul le serveur peut
// fabriquer : l'URL reelle et les jetons.
//
// ⚠️  Cette RPC ecrit aujourd'hui `https://placeholder.daily.co/<salle>` dans
// `daily_room_url`. `20260914_video_daily.sql` (NON APPLIQUEE) la fait ecrire
// **NULL** : une URL fabriquee est une valeur qui a l'air vraie. Tant que la
// migration n'est pas passee, cette fonction ECRASE le remplacant par l'URL
// reelle — mais si elle echoue avant, la ligne garde une URL qui ne mene nulle
// part, et `get_video_session` la rendrait.
//
// ---------------------------------------------------------------------
// ⚠️  CE N'EST PAS LA SEULE CHOSE QUI MANQUAIT — LA CSP
// ---------------------------------------------------------------------
// Mesure du 14/09 : `_headers` et `netlify.toml` ne contiennent **aucune**
// mention de `daily.co`. Meme avec une vraie salle, l'iframe serait bloquee :
// `frame-src` ne l'autorise pas, `connect-src` non plus, et
// `Permissions-Policy: camera=(self)` **refuse de deleguer la camera a une
// iframe d'une autre origine**. Corrige dans le meme lot ; voir le
// commentaire pose dans `_headers`.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const ORIGINES_AUTORISEES = [
  'https://tabibi.doctor',
  'https://www.tabibi.doctor',
  'http://localhost:8080',
];

// Fenetre d'acces a la salle, autour de l'heure du rendez-vous.
const AVANT_MIN = 15;    // on peut entrer 15 min avant
const APRES_MIN = 30;    // et jusqu'a 30 min apres la fin prevue
const DUREE_DEFAUT_MIN = 30;

function enTetes(req: Request): HeadersInit {
  const origine = req.headers.get('Origin') ?? '';
  return {
    ...JSON_HEADERS,
    'Access-Control-Allow-Origin': ORIGINES_AUTORISEES.includes(origine) ? origine : ORIGINES_AUTORISEES[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function echec(req: Request, statut: number, code: string): Response {
  // Le front lit `body.error` et traduit quelques codes (`forbidden`,
  // `appointment_not_confirmed`). On garde exactement ces noms-la.
  return new Response(JSON.stringify({ error: code }), { status: statut, headers: enTetes(req) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────
// API Daily — la cle ne sort pas d'ici
// ─────────────────────────────────────────────────────────────────────
async function daily(chemin: string, cle: string, init?: RequestInit) {
  const res = await fetch(`https://api.daily.co/v1${chemin}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${cle}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let corps: Record<string, unknown> = {};
  try { corps = await res.json(); } catch { /* reponse non JSON : `corps` reste vide, le statut suffit */ }
  return { statut: res.status, corps };
}

/**
 * Salle idempotente. Daily rend 400 « already exists » sur une seconde
 * creation : ce n'est pas une erreur, c'est la reponse a « assure-toi
 * qu'elle existe ». On relit alors la salle.
 */
async function assurerSalle(cle: string, nom: string, expUnix: number) {
  const creation = await daily('/rooms', cle, {
    method: 'POST',
    body: JSON.stringify({
      name: nom,
      privacy: 'private',        // sans jeton, on n'entre pas
      properties: {
        exp: expUnix,            // la salle meurt d'elle-meme
        eject_at_room_exp: true, // et vide les participants a ce moment-la
        enable_prejoin_ui: true, // le patient se voit avant d'entrer
        enable_chat: false,      // aucune trace ecrite non journalisee
        enable_recording: false, // l'enregistrement se decide ailleurs, avec consentement
        max_participants: 3,     // patient + medecin, et une place de secours
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });
  if (creation.statut >= 200 && creation.statut < 300) return { ok: true as const, salle: creation.corps };

  const dejaLa = creation.statut === 400
    && String((creation.corps as { info?: string }).info ?? '').includes('already exists');
  if (!dejaLa) {
    return { ok: false as const, detail: `rooms ${creation.statut}` };
  }

  const lecture = await daily(`/rooms/${encodeURIComponent(nom)}`, cle);
  if (lecture.statut >= 200 && lecture.statut < 300) return { ok: true as const, salle: lecture.corps };
  return { ok: false as const, detail: `rooms-get ${lecture.statut}` };
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'POST') return echec(req, 405, 'method_not_allowed');

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('TABIBI_SECRET_KEY');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const cleDaily = Deno.env.get('DAILY_API_KEY');
  const domaineDaily = (Deno.env.get('DAILY_DOMAIN') ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  if (!urlSupabase || !cleService || !cleAnon) {
    console.error('[create-video-room] configuration Supabase incomplete');
    return echec(req, 500, 'server_misconfigured');
  }
  if (!cleDaily || !domaineDaily) {
    // On NOMME les variables, jamais leurs valeurs (regles 4 et 6).
    console.error('[create-video-room] DAILY_API_KEY et/ou DAILY_DOMAIN absents');
    return echec(req, 500, 'video_not_configured');
  }

  // ── 1. Qui appelle ? ────────────────────────────────────────────────
  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation.toLowerCase().startsWith('bearer ')) return echec(req, 401, 'not_authenticated');

  const clientAppelant = createClient(urlSupabase, cleAnon, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: errUser } = await clientAppelant.auth.getUser();
  if (errUser || !user) return echec(req, 401, 'not_authenticated');

  let idRdv = '';
  try {
    const corps = await req.json();
    idRdv = typeof corps?.appointment_id === 'string' ? corps.appointment_id.trim() : '';
  } catch {
    // Corps illisible : `idRdv` reste vide et le refus tombe juste apres.
    idRdv = '';
  }
  if (!UUID.test(idRdv)) return echec(req, 400, 'invalid_params');

  // ── 2. L'autorisation est celle de la RPC, pas une seconde ecrite ici ──
  // Elle verifie proprietaire + `confirmed`, elle est idempotente, et elle
  // ecrit au journal d'audit. On l'appelle AVEC le JWT de l'appelant.
  const { data: session, error: errRpc } = await clientAppelant
    .rpc('create_video_session', { p_appointment_id: idRdv });
  if (errRpc) {
    console.error('[create-video-room] create_video_session:', errRpc.message);
    return echec(req, 500, 'server_error');
  }
  const s = (session ?? {}) as Record<string, unknown>;
  if (s.error) {
    // `not_authenticated` · `appointment_not_found` · `forbidden` ·
    // `appointment_not_confirmed` — le front en traduit trois.
    const code = String(s.error);
    const statut = code === 'forbidden' ? 403 : code === 'appointment_not_found' ? 404 : 400;
    return echec(req, statut, code);
  }
  const idSession = String(s.session_id ?? '');
  const nomSalle = String(s.daily_room_name ?? '');
  if (!UUID.test(idSession) || !nomSalle) {
    console.error('[create-video-room] reponse RPC inattendue');
    return echec(req, 500, 'server_error');
  }

  const service = createClient(urlSupabase, cleService, { auth: { persistSession: false } });

  // ── 3. Le role, et l'heure ──────────────────────────────────────────
  const { data: rdv, error: errRdv } = await service
    .from('appointments')
    .select('id, patient_id, doctor_id, scheduled_at, duration_minutes, status')
    .eq('id', idRdv)
    .maybeSingle();
  if (errRdv || !rdv) {
    console.error('[create-video-room] lecture rendez-vous :', errRdv?.message ?? 'introuvable');
    return echec(req, 500, 'server_error');
  }

  const role = rdv.patient_id === user.id ? 'patient' : rdv.doctor_id === user.id ? 'doctor' : null;
  // La RPC a deja refuse un tiers ; cette ligne ne rattrape pas une faille,
  // elle evite d'ecrire un jeton dans une colonne au hasard si la RPC changeait.
  if (!role) return echec(req, 403, 'forbidden');

  const debut = new Date(String(rdv.scheduled_at)).getTime();
  const duree = Number(rdv.duration_minutes) > 0 ? Number(rdv.duration_minutes) : DUREE_DEFAUT_MIN;
  const ouvre = debut - AVANT_MIN * 60_000;
  const ferme = debut + (duree + APRES_MIN) * 60_000;
  const maintenant = Date.now();

  // **Une salle medicale n'est pas un lien permanent.** Hors fenetre, on ne
  // cree rien et on ne rend aucun jeton.
  if (maintenant < ouvre) {
    return new Response(JSON.stringify({
      error: 'too_early', opens_at: new Date(ouvre).toISOString(),
    }), { status: 409, headers: enTetes(req) });
  }
  if (maintenant > ferme) return echec(req, 409, 'too_late');

  // ── 4. La salle chez Daily, puis LE jeton de l'appelant ─────────────
  const expUnix = Math.floor(ferme / 1000);

  const salle = await assurerSalle(cleDaily, nomSalle, expUnix);
  if (!salle.ok) {
    console.error('[create-video-room] salle Daily :', salle.detail);
    return echec(req, 502, 'video_provider_error');
  }
  const urlSalle = String((salle.salle as { url?: string }).url ?? `https://${domaineDaily}/${nomSalle}`);

  const jeton = await daily('/meeting-tokens', cleDaily, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: nomSalle,
        // `is_owner` donne le controle de la salle : le medecin conduit la
        // consultation, le patient la rejoint.
        is_owner: role === 'doctor',
        user_id: user.id,
        exp: expUnix,
        eject_at_token_exp: true,
        // L'enregistrement ne se decide pas ici : il exige le consentement du
        // patient, porte par `set_video_recording_consent`.
        enable_recording: false,
      },
    }),
  });
  if (jeton.statut < 200 || jeton.statut >= 300) {
    console.error('[create-video-room] jeton Daily :', jeton.statut);
    return echec(req, 502, 'video_provider_error');
  }
  const monJeton = String((jeton.corps as { token?: string }).token ?? '');
  if (!monJeton) return echec(req, 502, 'video_provider_error');

  // ── 5. On garde l'URL reelle et LE jeton de ce role ─────────────────
  // Le declencheur `video_sessions_protect_columns` n'autorise ces colonnes
  // qu'au `service_role` (auth.uid() NULL) : c'est bien ce qu'on est ici.
  const expIso = new Date(ferme).toISOString();
  const maj: Record<string, unknown> = { daily_room_url: urlSalle, tokens_expire_at: expIso };
  maj[role === 'doctor' ? 'doctor_token' : 'patient_token'] = monJeton;

  const { error: errMaj } = await service.from('video_sessions').update(maj).eq('id', idSession);
  if (errMaj) {
    // L'appel PEUT avoir lieu : l'URL et le jeton sont rendus ci-dessous. Ne
    // pas refuser une consultation parce qu'on n'a pas su ranger le jeton.
    console.error('[create-video-room] enregistrement session :', errMaj.message);
  }

  return new Response(JSON.stringify({
    ok: true,
    session_id: idSession,
    role,
    room_url: urlSalle,
    my_token: monJeton,
    expires_at: expIso,
  }), { status: 200, headers: enTetes(req) });
});
