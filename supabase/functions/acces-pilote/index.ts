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
//   3. La limitation — 5 tentatives par minute, par numero ET par IP.
//   4. Le captcha — **verifie par Supabase, pas par nous.** Voir ci-dessous.
//
// =====================================================================
// ⚠️ LE CAPTCHA N'EST PLUS VERIFIE ICI — et ce n'est pas un relachement
// =====================================================================
// La v1 faisait son PROPRE `siteverify` Turnstile, puis appelait
// `signInWithPassword` **sans** jeton. Elle ne pouvait pas marcher : le projet
// a le captcha active globalement, et GoTrue refuse alors toute connexion sans
// `options.captchaToken` — **meme depuis le serveur, meme avec le bon mot de
// passe**. Chaque essai reel sortait en 500.
//
// Or un jeton Turnstile est **a usage unique** : le consommer une premiere
// fois dans notre `siteverify` le rendait inutilisable pour GoTrue. Les deux
// verifications ne pouvaient donc pas coexister ; il fallait en choisir une,
// et c'est celle de GoTrue qui compte, puisque c'est elle qui delivre la
// session.
//
// Le jeton est donc transmis tel quel a `signInWithPassword`. **Il est
// toujours verifie** — par Cloudflare, via Supabase, au moment qui decide.
//
// ⚠️ CE QUE CE DEPLACEMENT COUTE : le captcha n'est plus la PREMIERE porte.
// Un appelant sans jeton valide atteint desormais la liste blanche et, si son
// numero y est, la creation du compte auth. Ce qui l'arrete avant : la
// limitation (5/min par IP et par numero) et la liste blanche elle-meme.
// **L'enumeration, elle, reste fermee** — a condition que l'echec de session
// rende le MEME refus que le numero inconnu. C'est pour ca que le dernier
// `errSession` sort en `refus()` et pas en `panne()` : deux reponses
// differentes diraient lequel des deux numeros est sur la liste.
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
//     journal (regles 4 et 6), ni nulle part ailleurs ;
//   - est pose **une seule fois**, et laisse tel quel.
//
// ⚠️ IL N'EST PAS REBROUILLE APRES USAGE, ET C'EST VOULU. La v3 le faisait —
// l'intention etait bonne, l'effet non : **changer le mot de passe REVOQUE les
// sessions de l'utilisateur**, y compris celle qu'on venait de creer. La page
// recevait des jetons deja morts (`Auth session missing`). Le meilleur des
// soins, applique une ligne trop tard.
//
// Ce que ca laisse derriere : un compte dont le mot de passe est **32 octets
// que personne n'a jamais vus**. Il n'a ete ni affiche, ni journalise, ni
// stocke, et il sera reecrit a la prochaine entree. Un secret que personne ne
// connait ne s'utilise pas.
//
// ⚠️ Corollaire a savoir : poser le mot de passe revoque aussi les sessions
// PRECEDENTES de ce medecin. Deux appareils a la fois, ca ne marche pas — le
// second fait tomber le premier. Pour un pilote, c'est acceptable ; il faut
// juste ne pas le decouvrir en recette.
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

  if (!urlSupabase || !cleService) {
    console.error('[acces-pilote] configuration Supabase incomplete');
    return panne(req, 'server_misconfigured');
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

  // ⚠️ Elle REFUSE plutot que de reparer. Un numero « repare » ouvrirait la
  // session de quelqu'un d'autre — c'est la meme regle que pour les rappels
  // SMS, et c'est la meme fonction.
  const phone = normalizePhoneDZ(phoneBrut);

  const admin = createClient(urlSupabase, cleService, { auth: { persistSession: false } });

  // ── 2. La limitation — par IP, et par numero ────────────────────────
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

  // ── 3. La liste blanche ─────────────────────────────────────────────
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

  // ── 4. Le compte auth pour ce numero ────────────────────────────────
  // `createUser` d'abord : s'il existe deja, l'erreur nous le dit, et on le
  // retrouve. C'est un aller-retour de moins que « lister puis creer », et
  // surtout ca ne laisse pas de fenetre entre les deux.
  //
  // ⚠️ LE RATTACHEMENT A LA FICHE SE FAIT ICI, PAS APRES LA SESSION. Toute
  // ecriture sur le compte doit passer AVANT `signInWithPassword` : apres, on
  // touche a un utilisateur dont une session vient d'etre delivree, et
  // certaines ecritures la revoquent (c'est ce qui a casse la v3).
  const metadonnees = {
    role: 'medecin',
    pilote: true,
    doctor_profile_id: ligne.doctor_profile_id,
  };

  let userId = '';
  const { data: cree, error: errCreate } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: true,
    user_metadata: metadonnees,
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
    // Compte deja connu : on remet le lien vers la fiche a jour — avant la
    // session, comme tout le reste.
    const { error: errMeta } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: metadonnees,
    });
    if (errMeta) console.error('[acces-pilote] rattachement fiche :', errMeta.message);
  }

  // ── 5. La session — c'est ICI que le captcha est verifie ────────────
  // Voir « COMMENT LA SESSION EST MINTEE » en tete. Le mot de passe est pose
  // UNE fois, consomme, et laisse tel quel. Il ne sort pas d'ici.
  const passe = motDePasseEphemere();
  const { error: errPasse } = await admin.auth.admin.updateUserById(userId, { password: passe });
  if (errPasse) {
    console.error('[acces-pilote] pose du mot de passe ephemere :', errPasse.message);
    return panne(req, 'server_error');
  }

  const anonyme = createClient(urlSupabase, Deno.env.get('SUPABASE_ANON_KEY') ?? cleService, {
    auth: { persistSession: false },
  });
  // ⚠️ `options.captchaToken` N'EST PAS FACULTATIF ICI. Le projet a le captcha
  // active globalement : sans ce champ, GoTrue refuse la connexion — meme
  // depuis le serveur, meme avec le bon mot de passe. C'est ce qui rendait la
  // v1 inutilisable (500 `server_error` a chaque essai reel).
  const { data: session, error: errSession } =
    await anonyme.auth.signInWithPassword({
      phone, password: passe, options: { captchaToken: jetonCaptcha },
    });

  // ⚠️⚠️ NE RIEN ECRIRE SUR LE COMPTE APRES CETTE LIGNE. ⚠️⚠️
  //
  // La v3 rebrouillait le mot de passe juste ici, pour qu'il ne survive pas.
  // L'intention etait bonne ; l'effet, non : **changer le mot de passe REVOQUE
  // les sessions de l'utilisateur**, y compris celle qu'on venait de creer. La
  // page recevait des jetons deja morts et `setSession` echouait en
  // « Auth session missing ». Le meilleur des soins, applique une ligne trop
  // tard.
  //
  // Le mot de passe ephemere reste donc en place jusqu'a la prochaine entree,
  // qui le reecrit. **Personne ne le connait** : 32 octets tires de
  // `crypto.getRandomValues`, jamais renvoyes, jamais journalises, jamais
  // stockes. Un secret que personne n'a vu ne s'utilise pas.
  if (errSession || !session?.session?.access_token) {
    // ⚠️ UN REFUS, PAS UNE PANNE. La cause la plus frequente est un captcha
    // invalide ou expire — c'est-a-dire l'appelant, pas nous. Et repondre 500
    // ici rouvrirait l'enumeration par la bande : un numero HORS liste sort en
    // 403 plus haut, un numero SUR la liste avec un captcha invalide sortirait
    // en 500. Deux reponses differentes disent lequel est sur la liste.
    console.error('[acces-pilote] ouverture de session :', errSession?.message);
    return refus(req, debut);
  }

  // ── 6. La trace ─────────────────────────────────────────────────────
  // Une RPC, pas une ecriture sur le compte : elle ne touche pas la session.
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
