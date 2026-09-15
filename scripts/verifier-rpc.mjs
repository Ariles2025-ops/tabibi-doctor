#!/usr/bin/env node
// =====================================================================
// verifier-rpc.mjs — le front appelle-t-il des fonctions qui existent ?
// =====================================================================
// C'est la garde la plus rentable du depot, parce que le defaut qu'elle attrape
// est INVISIBLE : le front appelle une RPC absente, PostgREST rend 404, et le
// `catch` avale. Aucune erreur a l'ecran, aucune ligne dans la console.
//
// Ce n'est pas theorique. Pendant la recette de septembre 2026, les fonctions
// de la vague 1A ont tue la recherche de medecins et personne ne l'a vu :
// l'appel echouait, le catch avalait, la liste sortait vide comme si aucun
// medecin ne correspondait.
//
// Mesure du 13/09/2026 : 44 RPC appelees, **5 absentes de la base**.
//   create_prescription_draft, update_prescription_draft,
//   request_prescription_signature   -> medecin-ordonnance.html
//   mark_prescription_delivered      -> patient-ordonnances.html
//   validate_cabinet_invitation      -> signup.html
//
// DEUX ETAGES, comme verifier-statuts.mjs, et pour la meme raison :
//
//   structurel (defaut, AUCUN secret) — chaque `rpc('x')` du depot doit etre
//     soit dans supabase/rpc/existantes.txt, soit declare ci-dessous comme
//     absence CONNUE et justifiee. Deterministe, hors ligne, en CI.
//
//   --base (exige SUPABASE_ACCESS_TOKEN) — la reference contre `pg_proc` reel.
//     C'est le seul etage qui voit une fonction SUPPRIMEE en base sans que le
//     depot bouge : le structurel resterait vert, coherent avec lui-meme, et
//     faux. Etape obligatoire de la procedure de deploiement manuelle
//     (docs/VERIFICATION_DEPLOIEMENT_PORTE_FERMEE.md), pas en CI : aucun secret
//     Supabase n'entre dans le depot.
//
// Usage : node scripts/verifier-rpc.mjs [--base] [--ecrire]
// =====================================================================
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const REF = 'supabase/rpc/existantes.txt';

// Absences CONNUES : le front les appelle, la base ne les a pas. Chacune est un
// appel mort, inventorie dans docs/FICHE_R3_APPELS_DANS_LE_VIDE.md. Elles ne
// font pas echouer le controle — mais toute NOUVELLE absence, si.
// Retirer une ligne d'ici quand la fonction est deployee, ou quand l'appel est
// supprime du front. La liste doit MAIGRIR, jamais grossir.
// [14/09/2026] LES QUATRE MOTIFS CI-DESSOUS ETAIENT PERIMES. Ils disaient
// « drapeau prescriptions:false » ; le drapeau est OUVERT depuis ce soir, et
// les quatre fonctions EXISTENT en base (SECURITY DEFINER, executables par
// `authenticated`, mesurees par le MCP en lecture). Elles restent ici non
// parce qu'elles manquent, mais parce que la REFERENCE ne peut pas etre
// regeneree : `--base --ecrire` exige un jeton, et il est REVOQUE. Le
// stratege a demande de ne pas forcer. Un motif faux est pire qu'une entree
// en trop : il fait conclure au lecteur que l'appel est mort.
const ABSENCES_CONNUES = {
  create_prescription_draft: 'EXISTE en base (14/09) — hors reference : jeton --base revoque',
  update_prescription_draft: 'EXISTE en base (14/09) — hors reference : jeton --base revoque',
  request_prescription_signature: 'EXISTE en base (14/09) — hors reference : jeton --base revoque',
  mark_prescription_delivered: 'EXISTE en base (14/09) — hors reference : jeton --base revoque',
  // [14/09, lot invitation] Celle-ci N'EXISTE PAS ENCORE en base : sa migration
  // (20260915_invitations_medecin.sql) est ecrite et **non appliquee**.
  //
  // Je ne l'ai PAS ajoutee a `supabase/rpc/existantes.txt` : ce fichier affirme
  // « appelees par le front QUI EXISTENT en base ». L'y mettre serait ecrire
  // une chose fausse dans la reference meme qui sert a detecter le faux.
  // `ABSENCES_CONNUES` dit exactement la verite du moment : le front l'appelle,
  // la base ne l'a pas.
  //
  // ⚠️ A RETIRER le jour ou le stratege applique la migration — et ce jour-la
  // la liste MAIGRIT, ce qui est son sens.
  accepter_invitation_medecin: 'migration 20260915_invitations_medecin.sql ECRITE, NON APPLIQUEE',
};

const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'docs', 'supabase', 'migrations',
  // outillage de build : les gardes citent des noms de RPC dans leur propre texte
  'scripts']);

function fichiers(dir = '.', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    else if (/\.(html|js|mjs)$/.test(e.name) && !e.name.includes('vendor')
             && e.name !== 'index-baseline.html') acc.push(p);
  }
  return acc;
}

// Les appels du depot, commentaires exclus : un `// rpc('ancienne_fonction')`
// dans un commentaire ne doit pas faire echouer le controle.
function appelsDuDepot() {
  // [13/09/2026] Les guillemets etaient OPTIONNELS : `sb.rpc(nom, args)` du point
  // de passage faisait croire a une RPC nommee « nom ». Un nom de RPC est
  // toujours un litteral ; une variable n'est pas verifiable ici, c'est le role
  // de verifier-rpc-passage de garantir qu'elle vient du point de passage.
  //
  // [14/09/2026] IL MANQUAIT `tabibiRpc(` — ET CETTE GARDE DEVENAIT AVEUGLE A
  // MESURE QU'ON FAISAIT BIEN. Le motif ne connaissait que `.rpc(`. Or migrer un
  // site vers la passerelle REMPLACE `sb.rpc('x')` par `tabibiRpc('x')` : la RPC
  // disparaissait donc de la detection, et la regeneration de la reference
  // l'aurait RETIREE — sans que rien ne devienne rouge.
  //
  // Constate en regenerant apres le lot « rebut visible » : la reference passait
  // de 39 a 34, en retirant `admin_validate_doctor`, `dawini_expire_old`,
  // `mark_video_session_started` et `mark_video_session_ended` — QUATRE RPC
  // TOUJOURS APPELEES, migrees vers la passerelle aux lots 1 et 2. La garde
  // aurait cesse de les proteger precisement parce qu'on avait bien travaille.
  // (La cinquieme, `seo_couples`, n'est vraiment plus appelee : elle sort.)
  //
  // Le plafond de `verifier-rpc-passage` descend quand on migre ; la couverture
  // de CE controle-ci ne doit PAS descendre avec lui. Les deux motifs cohabitent.
  const re = /(?:\.rpc\(\s*(['"])|\btabibiRpc\s*\(\s*(['"])|rest\/v1\/rpc\/)([a-z_][a-z0-9_]*)/gi;
  const par = new Map();
  for (const f of fichiers()) {
    let code = readFileSync(f, 'utf8');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    let m;
    while ((m = re.exec(code)) !== null) {
      const nom = m[3];
      if (!par.has(nom)) par.set(nom, new Set());
      par.get(nom).add(f);
    }
  }
  return par;
}

const reference = () => readFileSync(REF, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

async function pgProc() {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  if (!jeton) {
    console.error(ROUGE("✗ --base exige SUPABASE_ACCESS_TOKEN dans l'environnement."));
    console.error('  Le script ne lit rien du trousseau : le jeton est fourni par l\'appelant.');
    process.exit(2);
  }
  const r = await fetch('https://api.supabase.com/v1/projects/pudugodhiofqrctcdwfl/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'" }),
  });
  if (!r.ok) { console.error(ROUGE(`✗ lecture de pg_proc : HTTP ${r.status}`)); process.exit(2); }
  const rows = await r.json();
  if (!Array.isArray(rows)) { console.error(ROUGE('✗ reponse inattendue')); process.exit(2); }
  return rows.map((x) => x.proname);
}

// ---------------------------------------------------------------------
// LE RATCHET DE MIGRATION VERS LA PASSERELLE
// ---------------------------------------------------------------------
// Une reponse PostgREST a DEUX moities — `error` (transport) et `data.error`
// (metier) — et lire la mauvaise fait annoncer un succes sur un refus. Le
// 13/09/2026, deux ecrans le faisaient : signup.html sur
// `accept_cabinet_invitation` (compte cree dans un etat faux) et
// admin-doctor-validation.html sur `admin_validate_doctor` (e-mail de
// validation envoye pour rien). Les deux sont corriges, A LA MAIN.
//
// `window.tabibiRpc()` (js/tabibi-rpc.js) normalise les deux moities en
// { ok, data, erreur } avec `data: null` des que `ok` est faux. Il NE LEVE PAS :
// une passerelle qui leve obligerait chaque site a un try/catch, et un
// try/catch de plus est un catch silencieux de plus.
//
// Ce plafond descend a chaque site migre, et interdit qu'un NOUVEAU site
// court-circuite la passerelle. Il ne monte jamais.
// 60 -> 56 le 13/09/2026, lot 1 : les quatre sites a effet externe irreversible
// (envoi d e-mail apres admin_validate_doctor) passent par la passerelle.
// 56 -> 55 le 13/09/2026, lot 2a : js/tabibi-dawini.js:443, le seul site du
// depot qui declarait ACTIVEMENT un succes sur un echec (`return { ok:true }`
// hors de tout test du retour).
// 55 -> 53 le 13/09/2026, lot 2b : teleconsultation.html:549 et :598, les deux
// seuls sites ou une ecriture refusee ne laissait AUCUNE trace — ni dans
// `error` de transport (la RPC refuse par un jsonb {"error":…} sans lever), ni
// dans un rejet (supabase-js resout, le `.catch` etait mort).
// 53 -> 51 le 14/09/2026, lot « consentements journalises » : les deux appels
// du bloc secretaire de signup.html (validate_cabinet_invitation,
// accept_cabinet_invitation) passent par la passerelle. Le second est le site
// du defaut d'origine — celui qui creait un compte secretaire « avec succes »
// sans aucune adhesion au cabinet.
const PLAFOND_RPC_DIRECT = 51;

function appelsDirects() {
  const par = {};
  for (const f of fichiers()) {
    if (f === 'js/tabibi-rpc.js') continue;   // la passerelle elle-meme
    let code = readFileSync(f, 'utf8');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const m = code.match(/\.rpc\s*\(/g);
    if (m) par[f] = m.length;
  }
  return par;
}

const base = process.argv.includes('--base');
const ecrire = process.argv.includes('--ecrire');
const appels = appelsDuDepot();
let echec = false;

if (base) {
  console.log('Controle BASE — la reference contre pg_proc reel.');
  const enBase = new Set(await pgProc());
  const presentes = [...appels.keys()].filter((k) => enBase.has(k)).sort();
  if (ecrire) {
    writeFileSync(REF, readFileSync(REF, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n')
      + '\n' + presentes.join('\n') + '\n');
    console.log(`  ${REF} regenere : ${presentes.length} entrees.`);
  }
  const ref = reference();
  const disparues = ref.filter((k) => !enBase.has(k));
  const revenues = Object.keys(ABSENCES_CONNUES).filter((k) => enBase.has(k));
  console.log(`  ${appels.size} RPC appelees · ${enBase.size} fonctions en base · reference ${ref.length}`);
  if (disparues.length) {
    echec = true;
    console.error(ROUGE(`\n✗ ${disparues.length} fonction(s) de la reference ONT DISPARU de la base : ${disparues.join(', ')}`));
    console.error('  Le front les appelle. PostgREST rendra 404 et le catch avalera : aucune erreur visible.');
  }
  if (revenues.length) {
    console.log(`\n↑ ${revenues.length} absence(s) connue(s) existent desormais en base : ${revenues.join(', ')}`);
    console.log('  Les retirer de ABSENCES_CONNUES et regenerer la reference (--ecrire).');
  }
} else {
  console.log('Controle STRUCTUREL — les appels du depot contre la reference versionnee (aucun secret).');
  console.log('  Il ne voit PAS une fonction supprimee en base : pour cela, --base.');
  const ref = new Set(reference());
  const inconnues = [...appels.keys()].filter((k) => !ref.has(k) && !(k in ABSENCES_CONNUES)).sort();
  const inutiles = [...ref].filter((k) => !appels.has(k)).sort();
  console.log(`  ${appels.size} RPC appelees · ${ref.size} dans la reference · ${Object.keys(ABSENCES_CONNUES).length} absences connues`);
  if (inconnues.length) {
    echec = true;
    console.error(ROUGE(`\n✗ ${inconnues.length} RPC appelee(s) et absente(s) de la reference :`));
    for (const k of inconnues) console.error(`    ${k}  <- ${[...appels.get(k)].join(', ')}`);
    console.error('  Soit la fonction existe et la reference est perimee (--base --ecrire),');
    console.error('  soit elle n\'existe pas : le front appelle dans le vide et le catch avale.');
  }
  const directs = appelsDirects();
  const totalDirects = Object.values(directs).reduce((a, b) => a + b, 0);
  console.log(`  ${totalDirects} appel(s) .rpc( direct(s), hors passerelle · plafond ${PLAFOND_RPC_DIRECT}`);
  if (totalDirects > PLAFOND_RPC_DIRECT) {
    echec = true;
    console.error(ROUGE(`\n\u2717 ${totalDirects} > ${PLAFOND_RPC_DIRECT} : un site court-circuite window.tabibiRpc().`));
    console.error('  Une reponse PostgREST a deux moities. Lire la mauvaise fait annoncer un succes');
    console.error('  sur un refus — c\'est arrive deux fois le 13/09/2026. Passer par la passerelle :');
    console.error("    const r = await tabibiRpc('nom', args); if (!r.ok) { ...; return; }");
    const pires = Object.entries(directs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [f, n] of pires) console.error(`    ${String(n).padStart(3)}  ${f}`);
  } else if (totalDirects < PLAFOND_RPC_DIRECT) {
    console.log(`  \u2193 ${PLAFOND_RPC_DIRECT - totalDirects} de moins que le plafond : abaissez-le a ${totalDirects}.`);
  }

  if (inutiles.length) {
    console.log(`\n↓ ${inutiles.length} entree(s) de la reference que plus personne n'appelle : ${inutiles.join(', ')}`);
  }
}

const connues = Object.keys(ABSENCES_CONNUES);
if (connues.length) {
  console.log(`\n${connues.length} absence(s) CONNUE(S), inventoriee(s) dans docs/FICHE_R3_APPELS_DANS_LE_VIDE.md :`);
  for (const k of connues) console.log(`  ${k}  — ${ABSENCES_CONNUES[k]}`);
  console.log('  Cette liste doit MAIGRIR, jamais grossir.');
}
if (echec) process.exit(1);
console.log('\nToute RPC appelee est declaree.');
