// supabase/functions/send-email/index.ts
// =====================================================================
// L'envoi de courriel — celui que quatre pages appelaient depuis mai
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.** Le stratege deploie apres revue.
//
// DEPLOIEMENT :
//   entrypoint  : index.ts
//   dependances : ../_partage/courriel.ts, ../_partage/modeles-courriel.ts
//   `verify_jwt`: **false** — declare dans `config.toml`. La fonction fait sa
//                 PROPRE authentification, parce qu'elle sert deux publics :
//                 un administrateur connecte (validation medecin) et un
//                 visiteur anonyme (accuse d'inscription a la liste
//                 d'attente). Une passerelle unique ne sait pas distinguer les
//                 deux ; la fonction, si.
//
// =====================================================================
// CE QU'ELLE REPARE
// =====================================================================
// `js/tabibi-brevo.js:619` appelle `functions.invoke('send-email', …)` depuis
// **le 20/05**. La fonction n'a jamais existe : l'appel partait vers un 404, et
// l'ecran d'administration annoncait quand meme que le medecin avait ete
// prevenu. Un medecin valide n'a jamais recu son message ; un medecin refuse
// non plus.
//
// C'est **P-28** au registre — et c'est la famille du « 500+ inscrits » et du
// « e-mail envoye » de `forgot-password` : **un succes affiche que personne n'a
// constate**.
//
// =====================================================================
// ⚠️ CE QU'ELLE REFUSE DE FAIRE — et pourquoi le contrat a change
// =====================================================================
// Le front envoyait `{ to, subject, html }`. Ecrire la fonction sur ce contrat
// aurait produit **un relais ouvert** : n'importe quel compte connecte aurait
// pu faire partir **n'importe quel HTML**, vers **n'importe quelle adresse**,
// signe `contact@tabibi.doctor`. C'est la definition d'un outil d'hameconnage,
// et il aurait porte notre nom de domaine.
//
// Cette fonction n'accepte donc **aucun HTML**. Elle accepte :
//
//     { template: 'medecin_validated' | 'medecin_rejected',
//       to: '<adresse>',
//       params: { firstName, reason?, lang? } }
//
// et compose elle-meme (`_partage/modeles-courriel.ts`). Ce qui n'est pas dans
// la liste ne s'envoie pas.
//
// Chaque modele porte SA condition, et elle est verifiee avant tout envoi :
//
//   medecin_validated / medecin_rejected
//       -> une session, et `is_admin()` verifie AVEC LE JWT DE L'APPELANT
//          (pas avec la cle de service : c'est la base qui tranche, pas nous).
//
//   waiting_list_welcome
//       -> aucune session : la page est publique. Mais **le destinataire doit
//          deja etre sur la liste d'attente**, verifie en base. On ne peut donc
//          ecrire qu'a quelqu'un qui s'est inscrit lui-meme.
//
//          ⚠️ Ce que ca ne ferme pas : quelqu'un qui connait une adresse
//          INSCRITE peut faire renvoyer l'accuse. C'est une nuisance bornee
//          (un seul modele, aucun contenu choisi par l'appelant), pas une
//          fuite. La vraie borne serait une limitation par IP — a poser le
//          jour ou la liste d'attente redevient publique.
//
// Et dans tous les cas : **un modele connu**, sinon refus, sans envoi.
//
// `js/tabibi-brevo.js` a ete adapte pour parler ce contrat.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { envoyerCourriel } from '../_partage/courriel.ts';
import { MODELES, modeleConnu } from '../_partage/modeles-courriel.ts';

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

/** Une adresse plausible. On ne « repare » pas : on refuse. */
function adresseValide(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v);
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'POST') return echec(req, 405, 'method_not_allowed');

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cleResend = Deno.env.get('RESEND_API_KEY');
  const expediteur = Deno.env.get('MAIL_FROM') ?? 'Tabibi.doctor <contact@tabibi.doctor>';

  if (!urlSupabase || !cleAnon) {
    console.error('[send-email] configuration Supabase incomplete');
    return echec(req, 500, 'server_misconfigured');
  }
  if (!cleResend) {
    // On NOMME la variable, jamais sa valeur (regles 4 et 6).
    console.error('[send-email] RESEND_API_KEY absente');
    return echec(req, 500, 'mail_not_configured');
  }

  // ── 1. Un modele connu, et rien d'autre ─────────────────────────────
  let nom: unknown = '';
  let to: unknown = '';
  let params: Record<string, unknown> = {};
  try {
    const corps = await req.json();
    nom = corps?.template;
    to = corps?.to;
    params = (corps?.params && typeof corps.params === 'object') ? corps.params : {};
  } catch {
    nom = '';
  }

  if (!modeleConnu(nom)) return echec(req, 400, 'unknown_template');
  if (!adresseValide(to)) return echec(req, 400, 'invalid_email');

  // ── 2. La condition PROPRE au modele ────────────────────────────────
  if (nom === 'waiting_list_welcome') {
    // Public, mais pas ouvert : on n'ecrit qu'a quelqu'un qui s'est inscrit.
    if (!cleService) {
      console.error('[send-email] SUPABASE_SERVICE_ROLE_KEY absente');
      return echec(req, 500, 'server_misconfigured');
    }
    const service = createClient(urlSupabase, cleService, { auth: { persistSession: false } });
    const { data: ligne, error: errListe } = await service
      .from('waiting_list').select('email').eq('email', to).limit(1).maybeSingle();
    if (errListe) {
      console.error('[send-email] lecture liste d attente :', errListe.message);
      return echec(req, 500, 'server_error');
    }
    // Refus GENERIQUE : dire « cette adresse n'est pas inscrite » ferait de la
    // fonction un testeur d'appartenance a la liste.
    if (!ligne) return echec(req, 403, 'forbidden');
  } else {
    // Les deux messages de validation : administrateur connecte, et lui seul.
    const autorisation = req.headers.get('Authorization') ?? '';
    if (!autorisation.toLowerCase().startsWith('bearer ')) return echec(req, 401, 'not_authenticated');

    // On agit AVEC le JWT de l'appelant : c'est la base qui dit s'il est
    // administrateur. Un controle ecrit ici divergerait un jour du sien.
    const client = createClient(urlSupabase, cleAnon, {
      global: { headers: { Authorization: autorisation } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: errUser } = await client.auth.getUser();
    if (errUser || !user) return echec(req, 401, 'not_authenticated');

    const { data: admin, error: errAdmin } = await client.rpc('is_admin');
    if (errAdmin) {
      console.error('[send-email] is_admin :', errAdmin.message);
      return echec(req, 500, 'server_error');
    }
    if (admin !== true) return echec(req, 403, 'forbidden');
  }

  const message = MODELES[nom](params);

  // ── 4. L'envoi ──────────────────────────────────────────────────────
  const envoi = await envoyerCourriel(cleResend, expediteur, { to, ...message });
  if (!envoi.ok) {
    // ⚠️ ON NE DIT PAS « ENVOYE ». C'est tout le sujet de ce lot : l'appelant
    // doit pouvoir distinguer un envoi d'un echec, sinon on recree le defaut
    // qu'on repare.
    console.error('[send-email] envoi :', envoi.erreur);
    return new Response(JSON.stringify({ error: 'mail_failed', detail: envoi.erreur }), {
      status: 502, headers: enTetes(req),
    });
  }

  return new Response(JSON.stringify({ ok: true, messageId: envoi.id }), {
    status: 200, headers: enTetes(req),
  });
});
