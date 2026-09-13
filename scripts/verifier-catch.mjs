#!/usr/bin/env node
// =====================================================================
// verifier-catch.mjs — un catch qui avale sans signaler est un mensonge
// =====================================================================
// C'est la meme faute que le badge vert par defaut, que le `|| 'Pending'` et
// que le bouton qui annonce sans agir : **un defaut qui se presente comme un
// etat normal.**
//
// Le 13/09/2026, une ReferenceError a ete avalee par six
// `try { renderAgenda(); } catch(e){}` de doctor-dashboard.html. Grille VIDE en
// production, console PROPRE, deux verifications passees a cote.
//
// POURQUOI PAS ESLINT.
//   1. `no-empty` ne voit pas `catch(e){ /* commentaire */ }` — or un
//      commentaire n'est pas un signalement.
//   2. eslint ne lit que js/src/scripts. Sur les 226 catch non signalants du
//      13/09, la grande majorite vivent dans le JS inline des pages HTML.
//   3. Le mettre dans `no-restricted-syntax` melangerait son plafond avec celui
//      de l'horloge locale — exactement la faute corrigee pour innerHTML : deux
//      dettes sous un seul chiffre, et on ne sait plus laquelle monte.
//
// CE QUI COMPTE COMME SIGNALEMENT : window.tabibiErreur, captureErr, Sentry,
// console.warn/error, toastM, _showError, un `throw`, un `reject`, ou un retour
// qui porte l'erreur (`return { ok: false, error }`, `errors.push`). Un
// commentaire, non.
//
// LA REGLE, non negociable sur un chemin d'ECRITURE : un catch qui entoure une
// mutation ne peut JAMAIS etre muet. Il signale a l'utilisateur, il rend
// l'erreur a l'appelant, ou il releve. Jamais il n'avale. L'ecran dirait oui
// pendant que la base dit non, et personne ne le saurait.
//
// Usage : node scripts/verifier-catch.mjs
// =====================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'migrations', 'supabase', 'docs']);

// Le plafond ne compte QUE les catch sur un chemin d'ECRITURE. Les autres sont
// inventories dans docs/FICHE_CATCH_SILENCIEUX.md, pas gardes ici : on ne met
// pas 226 lignes sous un chiffre, on garde ce qui peut mentir sur une donnee.
const PLAFOND = {
  'js/tabibi-messaging.js': 1,   // messages.update({read_at}) : un echec laisse le
                                 // fil marque non-lu. Visible par l'utilisateur au
                                 // badge qui ne se vide pas — genant, pas grave.
  'patient-ordonnances.html': 1, // mark_prescription_delivered : la RPC n'existe pas
                                 // (docs/FICHE_R3). Echoue TOUJOURS, en silence.
  'signup.html': 1,              // validate_cabinet_invitation : idem, RPC absente.
                                 // L'inscription continue avec accept_cabinet_invitation.
};

const SIGNALE = /tabibiErreur|console\.(warn|error|log)|captureErr|Sentry|toastM|_showError|throw\b|reject\(|return\s*\{[^}]*\berror\b|return\s*\{[^}]*ok\s*:\s*false|errors\.push/;
// `method: 'POST'` seul n'est PAS retenu : PostgREST poste aussi les lectures
// (`rpc/stats_publiques` rend des listes de wilayas). Une methode HTTP ne dit pas
// si l'appel mute. On s'appuie donc sur ce qui est explicite : PATCH/PUT/DELETE,
// les mutations du client Supabase, et les RPC dont le NOM porte un verbe.
const ECRIT = /method\s*:\s*['"](PATCH|PUT|DELETE)|\.insert\(|\.update\(|\.upsert\(|\.delete\(|signUp|signIn|rpc\(\s*['"](?:\w*(?:create|update|delete|mark|respond|accept|validate|close|expire|cancel|claim|report|submit)\w*)['"]/i;

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

const parFichier = {};
let total = 0;
for (const f of fichiers()) {
  const src = readFileSync(f, 'utf8');
  const re = /catch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length - 1, prof = 0, j = i;
    while (j < src.length) {
      if (src[j] === '{') prof++;
      else if (src[j] === '}') { prof--; if (prof === 0) break; }
      j++;
    }
    const corps = src.slice(i + 1, j).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    if (SIGNALE.test(corps)) continue;
    // Vrai `try { } catch` seulement : sans ce test on attrape les
    // `.catch(function(){})` de promesse, et le `try` le plus proche appartient
    // alors a un bloc sans rapport. Les catch de promesse sont inventories dans
    // la fiche, pas gardes ici.
    const avant = src.slice(0, m.index).replace(/\s+$/, '');
    if (!avant.endsWith('}')) continue;
    const k = src.lastIndexOf('try', m.index);
    if (!ECRIT.test(src.slice(k, m.index))) continue;   // seules les ECRITURES sont gardees
    parFichier[f] = (parFichier[f] || 0) + 1;
    total++;
  }
}

let fautes = 0;
for (const f of [...new Set([...Object.keys(parFichier), ...Object.keys(PLAFOND)])].sort()) {
  const vu = parFichier[f] || 0, max = PLAFOND[f] || 0;
  if (vu === max) continue;
  console.log(`  ${vu > max ? ROUGE(`✗ ${vu} > ${max}`) : `↓ ${vu} < ${max}`}  ${f}`);
  if (vu > max) fautes++;
}
console.log(`\n${total} catch muet(s) sur un chemin d'ECRITURE, plafond ${Object.values(PLAFOND).reduce((a, b) => a + b, 0)}.`);
if (fautes) {
  console.error(ROUGE(`\n✗ ${fautes} fichier(s) au-dessus du plafond.`));
  console.error(`  Un catch sur une ecriture ne peut JAMAIS etre muet : l'ecran dirait oui`);
  console.error(`  pendant que la base dit non. Signaler a l'utilisateur, rendre`);
  console.error(`  { ok: false, error } a l'appelant, ou relever. Un commentaire ne compte pas.`);
  process.exit(1);
}
console.log("Aucun catch muet sur un chemin d'ecriture, hors les cas justifies.");
