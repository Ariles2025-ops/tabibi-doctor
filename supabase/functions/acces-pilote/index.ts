// supabase/functions/acces-pilote/index.ts
// =====================================================================
// Acces pilote par numero — le raccourci, et tout ce qui le tient
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.** Le stratege deploie apres revue.
//
// DEPLOIEMENT :
//   entrypoint  : index.ts
//   `verify_jwt`: **false** — l'appelant n'a pas encore de session, c'est le
//                 but. A declarer dans `supabase/config.toml`, sinon un
//                 deploiement futur le remettra a `true` et la fonction
//                 repondra 401 a tout le monde (defaut P-05, deja paye une
//                 fois avec le cron des rappels).
//
// =====================================================================
// ⚠️⚠️  CE QUE CETTE FONCTION EST, ET CE QU'ELLE N'EST PAS  ⚠️⚠️
// =====================================================================
// Elle ouvre une session a qui tape un numero present sur une liste blanche.
// Pas de mot de passe, pas de code SMS, pas de lien.
//
// **UN NUMERO DE TELEPHONE N'EST PAS UN SECRET.** Il est sur une plaque, une
// ordonnance, un annuaire, une page Facebook. Quiconque connait le numero d'un
// medecin de la liste peut ouvrir SA session et voir ce qu'il voit.
//
// Ce n'est donc pas une authentification : c'est un raccourci de
// demonstration. Il ne tient que par quatre choses, et si l'une saute il n'y a
// plus rien :
//
//   1. `ACCES_PILOTE_NUMERO_ENABLED` — l'interrupteur. A `false`, rien ne
//      passe. **Il doit rester a `false` en production.**
//   2. La LISTE BLANCHE — un administrateur inscrit les numeros un par un.
//   3. Turnstile — obligatoire. Sans jeton valide, on ne regarde meme pas le
//      numero.
//   4. La limitation — 5 tentatives par minute, par numero ET par IP.
//
// ⚠️ **DETTE DE SECURITE ASSUMEE — registre P-40.** A remplacer par un code
// SMS (OTP) avant qu'un seul vrai patient n'existe.
//
// =====================================================================
// COMMENT LA SESSION EST MINTEE — et pourquoi ainsi
// =====================================================================
// Supabase ne propose pas de « donne-moi une session pour cet utilisateur ».
// Les trois voies possibles, et le choix :
//
//   a) `admin.generateLink()` — ne fonctionne que pour un compte a EMAIL.
//      Notre cle est le TELEPHONE : beaucoup de fiches n'ont pas d'adresse.
//      Ecartee.
//   b) Signer un JWT avec le secret du projet. On obtiendrait un jeton
//      d'acces, mais **aucun jeton de rafraichissement** : la session mourrait
//      au bout d'une heure sans pouvoir se prolonger, et il faudrait refaire
//      entrer le numero. Ecartee — et fabriquer des jetons a la main, c'est se
//      substituer au serveur d'authentification.
//   c) **Poser un mot de passe aleatoire, s'en servir cote serveur, puis le
//      remplacer par un autre.** C'est la voie retenue.
//
// Le mot de passe (c) :
//   - est tire de 32 octets aleatoires cryptographiques ;
//   - ne sort JAMAIS de cette fonction — ni dans la reponse, ni dans un
//     journal (regles 4 et 6) ;
//   - est **remplace par un autre, tout aussi aleatoire, juste apres usage**.
//     Il n'est donc utilisable qu'une fois, pendant quelques millisecondes,
//     et seulement par le code qui vient de le poser.
//
// La reponse ne contient que `access_token` et `refresh_token` — ce qu'un
// navigateur obtiendrait d'une connexion ordinaire.
//
// =====================================================================
// L'ENUMERATION — ce qu'on refuse de laisser fuiter
// =====================================================================
// Une reponse qui distingue « ce numero n'est pas sur la liste » de « ce
// numero est sur la liste mais X » transforme la fonction en annuaire : on
// essaie des numeros, et les reponses disent lesquels sont medecins testeurs.
//
// Donc : **une seule reponse de refus, un seul code, et un plancher de duree**
// (`PLANCHER_MS`). Que le numero soit inconnu, mal forme, revoque ou
// simplement absent, l'appelant voit la meme chose et l'attend aussi
// longtemps.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
// UNE seule normalisation cote TypeScript, et elle est deja essayee :
// `tests/rappels-sms.test.mjs` lui passe 9 formes acceptees et 10 refusees.
// En ecrire une seconde ici aurait cree deux verites pour un meme numero.
import { normalizePhoneDZ } from '../_partage/sms-rappels.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const ORIGINES_AUTORISEES = [
  'https://tabibi.doctor',
  'https://www.tabibi.doctor',
  'http://localhost:8080',
];

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Duree plancher d'une reponse de refus. Voir « L'ENUMERATION ». */
const PLANCHER_MS = 700;

/** Tentatives autorisees par fenetre d'une minute, par cle. */
const MAX_PAR_MINUTE = 5;

function enTetes(req: Request): HeadersInit {
  const origine = req.headers.get('Origin') ?? '';
  return {
    ...JSON_HEADERS,
    'Access-Control-Allow-Origin': ORIGINES_AUTORISEES.includes(origine) ? origine : ORIGINES_AUTORISEES[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

/**
 * Le SEUL refus. Un code, un message, une duree plancher.
 *
 * `debut` sert a completer jusqu'a `PLANCHER_MS` : sans ca, un numero absent
 * de la liste repondrait plus vite qu'un numero present, et la difference de
 * duree dirait ce que le message tait.
 */
async function refus(req: Request, debut: number): Promise<Response> {
  const reste = PLANCHER_MS - (Date.now() - debut);
  if (reste > 0) await new Promise((r) => setTimeout(r, reste));
  return new Response(
    JSON.stringify({ error: 'acces_non_autorise' }),
    { status: 403, headers: enTetes(req) },
  );
}

/** Une panne de notre cote n'a pas a se cacher : elle se distingue du refus. */
function panne(req: Request, code: string, statut = 500): Response {
  return new Response(JSON.stringify({ error: code }), { status: statut, headers: enTetes(req) });
}

async function sha256Hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** 32 octets aleatoires, en hexadecimal. Jamais journalise, jamais renvoye. */
function motDePasseEphemere(): string {
  const o = new Uint8Array(32);
  crypto.getRandomValues(o);
  return [...o].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Turnstile. Fail-closed : secret absente ou Cloudflare injoignable -> false. */
async function turnstileValide(secret: string, jeton: string, ip: string | null): Promise<boolean> {
  if (!jeton) return false;
  try {
    const corps = new FormData();
    corps.append('secret', secret);
    corps.append('response', jeton);
    if (ip) corps.append('remoteip', ip);
    const r = await fetch(SITEVERIFY_URL, { method: 'POST', body: corps });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.success === true;
  } catch (err) {
    console.error('[acces-pilote] siteverify injoignable :', (err as Error).message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const debut = Date.now();

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'POST') return panne(req, 'method_not_allowed', 405);

  // ── 0. L'INTERRUPTEUR — avant tout le reste ─────────────────────────
  // Absent vaut FERME. Une porte pareille ne s'ouvre pas par defaut.
  if (Deno.env.get('ACCES_PILOTE_NUMERO_ENABLED') !== 'true') {
    return panne(req, 'feature_disabled', 403);
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secretTurnstile = Deno.env.get('TURNSTILE_SECRET_KEY');

  if (!urlSupabase || !cleService) {
    console.error('[acces-pilote] configuration Supabase incomplete');
    return panne(req, 'server_misconfigured');
  }
  if (!secretTurnstile) {
    // On NOMME la variable, jamais sa valeur (regles 4 et 6).
    console.error('[acces-pilote] TURNSTILE_SECRET_KEY absente');
    return panne(req, 'captcha_not_configured');
  }

  // ── 1. Ce qu'on nous envoie ─────────────────────────────────────────
  let phoneBrut = '';
  let jetonCaptcha = '';
  try {
    const corps = await req.json();
    phoneBrut = typeof corps?.phone === 'string' ? corps.phone : '';
    jetonCaptcha = typeof corps?.turnstile_token === 'string' ? corps.turnstile_token : '';
  } catch {
    phoneBrut = '';
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // ── 2. Turnstile, AVANT de regarder le numero ───────────────────────
  // L'ordre n'est pas un detail : verifier le numero d'abord permettrait de
  // sonder la liste sans jamais resoudre un captcha.
  if (!await turnstileValide(secretTurnstile, jetonCaptcha, ip)) {
    return refus(req, debut);
  }

  // ⚠️ Elle REFUSE plutot que de reparer. Un numero « repare » ouvrirait la
  // session de quelqu'un d'autre — c'est la meme regle que pour les rappels
  // SMS, et c'est la meme fonction.
  const phone = normalizePhoneDZ(phoneBrut);

  const admin = createClient(urlSupabase, cleService, { auth: { persistSession: false } });

  // ── 3. La limitation — par IP, et par numero ────────────────────────
  // Par IP seule, un attaquant change d'IP. Par numero seul, il essaie mille
  // numeros depuis la meme machine. Il faut les deux.
  //
  // ⚠️ Elle tourne meme quand le numero est mal forme : sinon, envoyer des
  // numeros invalides serait un moyen gratuit de sonder le systeme.
  const cles: string[] = [];
  if (ip) cles.push(await sha256Hex('ip:' + ip));
  if (phone) cles.push(await sha256Hex('tel:' + phone));
  for (const cle of cles) {
    const { data, error } = await admin.rpc('pilote_compter_tentative', {
      p_cle_sha256: cle, p_max: MAX_PAR_MINUTE,
    });
    if (error) {
      console.error('[acces-pilote] limitation indisponible :', error.message);
      // Fail-closed : sans compteur, on ne laisse pas passer.
      return panne(req, 'server_error');
    }
    if (data?.ok !== true) {
      return new Response(
        JSON.stringify({ error: 'trop_de_tentatives' }),
        { status: 429, headers: { ...enTetes(req), 'Retry-After': '60' } },
      );
    }
  }

  if (!phone) return refus(req, debut);

  // ── 4. La liste blanche ─────────────────────────────────────────────
  const { data: ligne, error: errListe } = await admin
    .from('pilote_acces_numero')
    .select('phone, doctor_profile_id, actif')
    .eq('phone', phone)
    .eq('actif', true)
    .maybeSingle();

  if (errListe) {
    console.error('[acces-pilote] lecture liste blanche :', errListe.message);
    return panne(req, 'server_error');
  }
  if (!ligne) return refus(req, debut);

  // ── 5. Le compte auth pour ce numero ────────────────────────────────
  // `createUser` d'abord : s'il existe deja, l'erreur nous le dit, et on le
  // retrouve. C'est un aller-retour de moins que « lister puis creer », et
  // surtout ca ne laisse pas de fenetre entre les deux.
  let userId = '';
  const { data: cree, error: errCreate } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: true,
    user_metadata: { role: 'medecin', pilote: true },
  });
  if (cree?.user?.id) {
    userId = cree.user.id;
  } else {
    // Deja inscrit : on le retrouve par son numero.
    const { data: liste, error: errList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (errList) {
      console.error('[acces-pilote] listUsers :', errList.message);
      return panne(req, 'server_error');
    }
    const trouve = liste?.users?.find((u) => u.phone === phone);
    if (!trouve) {
      console.error('[acces-pilote] compte introuvable apres createUser :', errCreate?.message);
      return panne(req, 'server_error');
    }
    userId = trouve.id;
  }

  // ── 6. La session ───────────────────────────────────────────────────
  // Voir « COMMENT LA SESSION EST MINTEE » en tete. Le mot de passe est pose,
  // consomme, puis remplace. Il ne sort pas d'ici.
  const passe = motDePasseEphemere();
  const { error: errPasse } = await admin.auth.admin.updateUserById(userId, { password: passe });
  if (errPasse) {
    console.error('[acces-pilote] pose du mot de passe ephemere :', errPasse.message);
    return panne(req, 'server_error');
  }

  const anonyme = createClient(urlSupabase, Deno.env.get('SUPABASE_ANON_KEY') ?? cleService, {
    auth: { persistSession: false },
  });
  const { data: session, error: errSession } =
    await anonyme.auth.signInWithPassword({ phone, password: passe });

  // ⚠️ QU'ON REUSSISSE OU NON, on rebrouille le mot de passe. Un echec de
  // connexion laisserait sinon un compte ouvert avec un mot de passe que le
  // processus vient d'ecrire — et qui pourrait finir dans une trace.
  const { error: errRotation } =
    await admin.auth.admin.updateUserById(userId, { password: motDePasseEphemere() });
  if (errRotation) {
    // On le DIT. Un mot de passe ephemere qui survit n'est plus ephemere.
    console.error('[acces-pilote] ROTATION DU MOT DE PASSE ECHOUEE pour', userId, ':', errRotation.message);
  }

  if (errSession || !session?.session?.access_token) {
    console.error('[acces-pilote] ouverture de session :', errSession?.message);
    return panne(req, 'server_error');
  }

  // ── 7. Le rattachement a la fiche, et la trace ──────────────────────
  // On pose le lien dans les metadonnees pour que le front sache quelle fiche
  // ouvrir. Ce n'est PAS un droit : la RLS ne lit pas les metadonnees.
  const { error: errMeta } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { role: 'medecin', pilote: true, doctor_profile_id: ligne.doctor_profile_id },
  });
  if (errMeta) console.error('[acces-pilote] rattachement fiche :', errMeta.message);

  const { error: errTrace } = await admin.rpc('pilote_noter_entree', { p_phone: phone });
  if (errTrace) console.error('[acces-pilote] trace d entree :', errTrace.message);

  // La reponse ne contient que ce qu'une connexion ordinaire rendrait.
  return new Response(JSON.stringify({
    ok: true,
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_in: session.session.expires_in,
    doctor_profile_id: ligne.doctor_profile_id,
  }), { status: 200, headers: enTetes(req) });
});
