// =====================================================================
// catch-morts.mjs — MESURE, lecture seule. Combien des catch du depot sont
// MORTS, c'est-a-dire n'entourent QUE des appels qui ne rejettent jamais ?
// =====================================================================
// On PARSE avec acorn. Pas de regex, pas d'automate a etats : le decoupeur de
// commentaires maison s'est desynchronise sur les apostrophes francaises le
// 13/09, et la classification par regex s'est trompee quatre fois dans la
// journee.
//
// LE FAIT MESURE DANS LE CLIENT VENDORISE supabase-js 2.116.0 :
//   PostgREST (.rpc / .from / .select …) : `this.shouldThrowOnError || (i =
//     i.catch(…))` -> NE REJETTE JAMAIS. Meme l'echec reseau devient une valeur
//     resolue { error, data:null, status:0 }.
//   auth / storage : `catch(e){ if (estErreurMaison(e)) return {…,error:e};
//     throw e }` -> RELEVE tout ce qui n'est pas son type d'erreur. PEUT rejeter.
// =====================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';

const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'docs', 'supabase', 'migrations']);

function fichiers(dir = '.', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    // Une mesure ne se mesure pas elle-meme : son propre try/catch de parsing
    // ferait +1 au total et rendrait le chiffre irreproductible.
    else if (e.name === 'mesurer-catch-morts.mjs') continue;
    else if (/\.(html|js|mjs)$/.test(e.name) && !e.name.includes('vendor')) acc.push(p);
  }
  return acc;
}

// Morceaux de JS d'un fichier, avec le decalage de caracteres dans le fichier.
function morceaux(f, src) {
  if (!f.endsWith('.html')) return [{ code: src, offset: 0 }];
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;                 // script externe
    if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs)) continue; // json-ld, gabarit
    out.push({ code: m[2], offset: m.index + m[0].indexOf(m[2]) });
  }
  return out;
}

function ligneDe(src, index) { return src.slice(0, index).split('\n').length; }

// Parcours d'AST minimal : on descend dans tout ce qui est objet.
function parcourir(n, visite) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { for (const x of n) parcourir(x, visite); return; }
  if (typeof n.type === 'string') visite(n);
  for (const k of Object.keys(n)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    parcourir(n[k], visite);
  }
}

const SUPA_POSTGREST = /\.(rpc|from)\s*\(/;
const SUPA_RELEVE    = /\.(auth|storage|functions|realtime)\b|\.channel\s*\(/;

// Le texte d'un appel, pour dire CE QUI d'autre peut lever dans le try.
function texteCallee(code, n) {
  return code.slice(n.callee.start, n.callee.end).replace(/\s+/g, '');
}

// Un appel fait-il partie d'une chaine PostgREST ? `sb.rpc(x)`, `sb.from(t)
// .select().eq()` : le maillon `.rpc`/`.from` et TOUS les maillons qui le
// suivent appartiennent a la chaine et ne rejettent pas.
function estChainePostgrest(code, n) {
  let c = n.callee;
  while (c && c.type === 'MemberExpression') {
    const prop = c.property && c.property.name;
    if (prop === 'rpc' || prop === 'from') return true;
    c = c.object;
    if (c && c.type === 'CallExpression') c = c.callee;
  }
  return false;
}

// Tout ce qui, dans le try, peut lever ALORS QUE PostgREST ne le fait pas.
function autresJeteurs(code, bloc) {
  const out = new Set();
  parcourir(bloc, (n) => {
    if (n.type === 'ThrowStatement') out.add('throw');
    else if (n.type === 'NewExpression') { /* new X() : rarement jetant, ignore */ }
    else if (n.type === 'CallExpression') {
      if (estChainePostgrest(code, n)) return;
      out.add(texteCallee(code, n).slice(0, 46) + '()');
    } else if (n.type === 'MemberExpression' && n.computed) {
      out.add('acces[] ' + code.slice(n.start, n.end).replace(/\s+/g, '').slice(0, 34));
    }
  });
  return [...out];
}

let nTotal = 0, nEchecParse = 0;
const echecs = [];
const candidats = [];

for (const f of fichiers()) {
  const src = readFileSync(f, 'utf8');
  for (const { code, offset } of morceaux(f, src)) {
    // Repli sur `module` : les scripts de build et src/entries sont des modules
    // ES. Un echec de parsing NE DOIT PAS etre un saut silencieux — c'est
    // exactement la faute qu'on recense.
    let ast = null, derniere = null;
    for (const st of ['script', 'module']) {
      try {
        ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: st,
                                  allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
        break;
      } catch (e) { derniere = e; }
    }
    if (!ast) {
      nEchecParse += 1;
      echecs.push(`${f}:${ligneDe(src, offset)}  ${derniere.message}`);
      continue;
    }
    parcourir(ast, (n) => {
      if (n.type !== 'TryStatement' || !n.handler) return;
      nTotal += 1;
      const corpsTry = code.slice(n.block.start, n.block.end);
      const corpsCatch = code.slice(n.handler.body.start, n.handler.body.end);
      if (!SUPA_POSTGREST.test(corpsTry) && !SUPA_RELEVE.test(corpsTry)) return;
      candidats.push({
        ou: `${f}:${ligneDe(src, offset + n.start)}`,
        postgrest: SUPA_POSTGREST.test(corpsTry),
        releve: SUPA_RELEVE.test(corpsTry),
        nStatements: n.block.body.length,
        autres: autresJeteurs(code, n.block),
        try: corpsTry,
        catch: corpsCatch,
      });
    });
  }
}

console.log(`TOTAL try/catch parses : ${nTotal}`);
console.log(`Echecs de parsing      : ${nEchecParse}`);
for (const e of echecs) console.log('  ! ' + e);
console.log(`Candidats (le try touche supabase) : ${candidats.length}`);
console.log(`  dont PostgREST seul (.rpc/.from, ne rejette jamais) : ${candidats.filter(c => c.postgrest && !c.releve).length}`);
console.log(`  dont auth/storage/functions present (peut rejeter)  : ${candidats.filter(c => c.releve).length}`);
// MORT PRESUME : PostgREST seul, et RIEN d'autre qui puisse lever.
const morts = candidats.filter((c) => c.postgrest && !c.releve && c.autres.length === 0);
const aLire = candidats.filter((c) => c.postgrest && !c.releve && c.autres.length > 0);

console.log(`\nMORTS PRESUMES (PostgREST seul, zero autre jeteur) : ${morts.length}`);
console.log(`A LIRE (PostgREST + autre chose qui peut lever)    : ${aLire.length}`);

console.log('\n' + '='.repeat(70));
console.log('LES MORTS PRESUMES — a confirmer par lecture');
console.log('='.repeat(70) + '\n');
for (const c of morts) {
  console.log(`──── ${c.ou}`);
  console.log(c.try.replace(/\n\s*/g, ' ').slice(0, 300));
  console.log(`   CATCH -> ${c.catch.replace(/\s+/g, ' ').slice(0, 120)}\n`);
}

console.log('\n' + '='.repeat(70));
console.log('LES AUTRES — ce qui d\'autre peut lever dans le try');
console.log('='.repeat(70) + '\n');
for (const c of aLire) {
  console.log(`──── ${c.ou}  -> ${c.autres.join(' · ').slice(0, 200)}`);
}
