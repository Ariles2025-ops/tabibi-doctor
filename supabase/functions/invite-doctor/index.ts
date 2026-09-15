// supabase/functions/invite-doctor/index.ts
// =====================================================================
// Inviter UN medecin precis au pilote — et n'ecrire le jeton nulle part
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.**
//
// DEPLOIEMENT — deux fichiers :
//   entrypoint : index.ts
//   dependance : ../_partage/courriel.ts
// `verify_jwt` : **true** (defaut). L'appelant est un administrateur connecte.
//
// ---------------------------------------------------------------------
// LE JETON NE SURVIT NULLE PART, SAUF DANS L'E-MAIL
// ---------------------------------------------------------------------
// Il est fabrique ici, envoye dans un message, et oublie :
//
//   - **la base n'en voit que le SHA-256** — `admin_creer_invitation_medecin`
//     ne recoit que l'empreinte, jamais le jeton ;
//   - **la reponse HTTP ne le contient pas** — meme pour l'administrateur qui
//     declenche l'envoi. S'il l'avait, il pourrait rattacher la fiche a son
//     propre compte ;
//   - **aucun journal ne l'imprime.** Les traces disent « invitation creee »,
//     avec l'identifiant de l'invitation, jamais son jeton.
//
// Un jeton d'invitation est un identifiant au porteur. Le seul endroit ou il a
// une raison d'exister est la boite du medecin.
//
// ---------------------------------------------------------------------
// ET L'ADRESSE COMPTE AUTANT QUE LE JETON
// ---------------------------------------------------------------------
// L'acceptation (cote base) exige que l'e-mail du compte connecte soit celui
// de l'invitation. Sans ca, un lien transfere — capture d'ecran, message
// suivi — suffirait a prendre la fiche d'un confrere. **Cette fonction ne peut
// donc pas « inviter n'importe qui sur n'importe quelle fiche » :** elle fixe
// le couple (fiche, adresse), et la base le fait respecter.
//
// ---------------------------------------------------------------------
// ⚠️ CE QUE CE LOT NE CORRIGE PAS
// ---------------------------------------------------------------------
// `README_APP.md` recense **trois parcours qui affichent « Email envoye » alors
// que rien ne part** — `RESEND_API_KEY` est pose depuis le 20/05 et la fonction
// `send-email` n'a jamais existe. Ce lot pose enfin la brique d'envoi
// (`_partage/courriel.ts`) et s'en sert pour UN parcours : l'invitation.
// **Les trois autres restent ouverts** ; ils sont signales, pas corriges ici.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { composerInvitationMedecin, envoyerCourriel } from '../_partage/courriel.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const ORIGINES_AUTORISEES = [
  'https://tabibi.doctor',
  'https://www.tabibi.doctor',
  'http://localhost:8080',
];

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
  return new Response(JSON.stringify({ error: code }), { status: statut, headers: enTetes(req) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 32 octets aleatoires en hexadecimal. */
function fabriquerJeton(): string {
  const o = new Uint8Array(32);
  crypto.getRandomValues(o);
  return [...o].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'POST') return echec(req, 405, 'method_not_allowed');

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const cleResend = Deno.env.get('RESEND_API_KEY');
  const expediteur = Deno.env.get('MAIL_FROM') ?? 'Tabibi.doctor <invitations@tabibi.doctor>';
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://tabibi.doctor').replace(/\/+$/, '');

  if (!urlSupabase || !cleAnon) {
    console.error('[invite-doctor] configuration Supabase incomplete');
    return echec(req, 500, 'server_misconfigured');
  }
  if (!cleResend) {
    // On NOMME la variable, jamais sa valeur (regles 4 et 6).
    console.error('[invite-doctor] RESEND_API_KEY absente');
    return echec(req, 500, 'mail_not_configured');
  }

  // ── 1. Qui appelle ? ────────────────────────────────────────────────
  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation.toLowerCase().startsWith('bearer ')) return echec(req, 401, 'not_authenticated');

  // On agit AVEC le JWT de l'appelant : c'est la RPC qui verifie qu'il est
  // administrateur. Un second controle ecrit ici divergerait du premier.
  const client = createClient(urlSupabase, cleAnon, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: errUser } = await client.auth.getUser();
  if (errUser || !user) return echec(req, 401, 'not_authenticated');

  // ── 2. Quelle fiche, quelle adresse ? ───────────────────────────────
  let idFiche = '';
  let email = '';
  let jours = 14;
  try {
    const corps = await req.json();
    idFiche = typeof corps?.doctor_profile_id === 'string' ? corps.doctor_profile_id.trim() : '';
    email = typeof corps?.email === 'string' ? corps.email.trim().toLowerCase() : '';
    if (Number.isInteger(corps?.days)) jours = corps.days;
  } catch {
    // Corps illisible : les champs restent vides, le refus tombe juste apres.
    idFiche = '';
  }
  if (!UUID.test(idFiche)) return echec(req, 400, 'invalid_params');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return echec(req, 400, 'invalid_email');

  // ── 3. Le jeton — fabrique ici, hache avant d'aller en base ─────────
  const jeton = fabriquerJeton();
  const empreinte = await sha256Hex(jeton);

  const { data, error } = await client.rpc('admin_creer_invitation_medecin', {
    p_doctor_profile_id: idFiche,
    p_email: email,
    p_token_sha256: empreinte,
    p_jours: jours,
  });
  if (error) {
    console.error('[invite-doctor] creation invitation :', error.message);
    return echec(req, 500, 'server_error');
  }
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.error) {
    // `forbidden` · `doctor_not_found` · `already_claimed` ·
    // `invitation_already_pending` · `invalid_email` · `invalid_duration`
    const code = String(r.error);
    const statut = code === 'forbidden' ? 403
      : code === 'doctor_not_found' ? 404
      : code === 'already_claimed' || code === 'invitation_already_pending' ? 409
      : 400;
    return echec(req, statut, code);
  }

  // ── 4. Le message ───────────────────────────────────────────────────
  // Sans `.html` : Cloudflare Pages redirige 308 la forme avec extension, et un
  // lien d'invitation ne doit pas embarquer une redirection.
  const lien = `${siteUrl}/invitation-medecin?token=${jeton}`;
  const message = composerInvitationMedecin({
    nomMedecin: String(r.doctor_name ?? ''),
    lien,
    expireLe: String(r.expires_at ?? ''),
  });

  const envoi = await envoyerCourriel(cleResend, expediteur, { to: email, ...message });
  if (!envoi.ok) {
    // ⚠️ L'INVITATION EXISTE DEJA EN BASE, et son jeton n'est plus recuperable :
    // il n'a jamais ete stocke. Dire « envoye » ici serait le mensonge que ce
    // depot traque ; dire « echec » sans plus serait laisser une invitation
    // fantome bloquer la fiche (index partiel : une seule vivante).
    // On rend donc l'identifiant, pour qu'un administrateur puisse la revoquer
    // et recommencer — `admin_revoquer_invitation_medecin`.
    console.error('[invite-doctor] envoi :', envoi.erreur);
    return new Response(JSON.stringify({
      error: 'mail_failed',
      detail: envoi.erreur,
      invitation_id: r.invitation_id,
      hint: 'invitation creee mais NON envoyee — la revoquer avant de reessayer',
    }), { status: 502, headers: enTetes(req) });
  }

  // Le jeton n'est PAS dans cette reponse, a dessein : l'administrateur qui
  // declenche l'envoi ne doit pas pouvoir rattacher la fiche a son propre compte.
  return new Response(JSON.stringify({
    ok: true,
    invitation_id: r.invitation_id,
    doctor_name: r.doctor_name,
    email,
    expires_at: r.expires_at,
    provider_message_id: envoi.id,
  }), { status: 200, headers: enTetes(req) });
});
