#!/usr/bin/env node
// =====================================================================
// audit-360.mjs — chaque page, chaque bouton : le fil est-il branche ?
// =====================================================================
// NE LE 15/09/2026, pour `docs/AUDIT_360.md`.
//
// ⚠️ CE QUE CET OUTIL FAIT, ET CE QU'IL NE FAIT PAS
//
// Il lit le code. Il ne clique sur rien. Il peut donc dire « ce bouton appelle
// une fonction qui n'existe nulle part » — c'est un fait verifiable — mais il
// ne peut pas dire « ce bouton marche » : une fonction qui existe peut se
// tromper, et une RPC qui existe peut refuser.
//
// **Un rapport statique borne le probleme par le bas.** Ce qu'il trouve est
// reellement casse ; ce qu'il ne trouve pas n'est pas pour autant sain.
//
// Trois sources de verite, toutes RELEVEES, aucune devinee :
//   - les pages et les scripts : `git ls-files` ;
//   - les fonctions edge : les repertoires de `supabase/functions/` ;
//   - les RPC : `supabase/rpc/existantes.txt`, la reference versionnee.
//
// Usage : node scripts/audit-360.mjs [--json]
// =====================================================================
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, normalize } from 'node:path';

const git = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const PAGES = git('git ls-files "*.html" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:tests/**" ":!:node_modules/**"');
const EDGE = readdirSync('supabase/functions', { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
const RPC_REF = existsSync('supabase/rpc/existantes.txt')
  ? new Set(readFileSync('supabase/rpc/existantes.txt', 'utf8').split('\n')
      .map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))
  : new Set();

// Ce qui n'a pas a etre defini par nous : le langage, le navigateur, les
// bibliotheques chargees. Une liste EXPLICITE vaut mieux qu'une heuristique :
// on voit ce qu'on a decide d'ignorer.
const CONNUS = new Set([
  'alert', 'confirm', 'prompt', 'console', 'window', 'document', 'location', 'history',
  'localStorage', 'sessionStorage', 'navigator', 'event', 'this', 'return', 'if', 'else',
  'for', 'while', 'try', 'catch', 'function', 'var', 'let', 'const', 'new', 'typeof',
  'setTimeout', 'setInterval', 'clearTimeout', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Math', 'Date', 'Promise', 'fetch', 'encodeURIComponent',
  'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'Intl', 'URL', 'URLSearchParams',
  'supabase', 'tabibi', 'gtag', 'dataLayer', 'turnstile', 'Sentry', 'Capacitor',
  'print', 'open', 'close', 'scrollTo', 'focus', 'blur', 'reload', 'back', 'forward',
  'true', 'false', 'null', 'undefined', 'void',
]);

/** Retire les commentaires : une definition en commentaire n'est pas une definition. */
function sansCommentaires(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1 ');
}

/**
 * Resout un chemin RELATIF A LA PAGE qui l'ecrit.
 *
 * Premiere version : resolution depuis la racine du depot. `blog/index.html`
 * charge `../src/entries/blog-index.js` — qui existe — et l'outil le declarait
 * absent, avec dix « liens casses » du meme tonneau. **Un rapport qui se
 * trompe dix fois ne sera pas lu la onzieme.**
 */
function resoudre(depuis, cible) {
  if (/^https?:|^\/\/|^mailto:|^tel:|^data:/.test(cible)) return null;
  const c = cible.split(/[?#]/)[0];
  if (!c) return null;
  return normalize(c.startsWith('/') ? c.slice(1) : join(dirname(depuis), c));
}

/**
 * Le code JS visible depuis une page : ses scripts inline, ses `src` locaux,
 * et **ce que ces fichiers importent**.
 *
 * Suivre les `import` n'est pas un raffinement : `accueil-public.html` ne
 * charge pas `js/home-app.js` directement, il charge `src/entries/index.js`
 * qui l'importe. Sans ce pas, DOUZE gestionnaires parfaitement definis etaient
 * declares morts.
 */
function porteeDe(html, page) {
  let code = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) code += '\n' + m[1];
  const fichiers = [];
  const vus = new Set();
  const charger = (chemin, profondeur) => {
    if (!chemin || vus.has(chemin) || profondeur > 3) return;
    vus.add(chemin);
    if (!existsSync(chemin)) { fichiers.push('ABSENT:' + chemin); return; }
    fichiers.push(chemin);
    const src = readFileSync(chemin, 'utf8');
    code += '\n' + src;
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
      const cible = m[1];
      if (!cible.startsWith('.') && !cible.startsWith('/')) continue;   // paquet, pas un fichier a nous
      let r = resoudre(chemin, cible);
      if (r && !existsSync(r) && existsSync(r + '.js')) r += '.js';
      charger(r, profondeur + 1);
    }
  };
  for (const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)) {
    charger(resoudre(page, m[1]), 0);
  }
  return { code: sansCommentaires(code), fichiers, page };
}

/** Un nom est-il defini quelque part dans cette portee ? */
function estDefini(nom, code) {
  const n = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(function\\s+${n}\\s*\\(` +
    `|\\b(?:var|let|const)\\s+${n}\\s*=` +
    `|\\bwindow\\.${n}\\s*=` +
    `|\\b${n}\\s*=\\s*(?:async\\s*)?(?:function|\\()` +
    `|['"]?${n}['"]?\\s*:\\s*(?:async\\s*)?(?:function|\\()` +
    `)`,
  ).test(code);
}

/**
 * Les fonctions appelees par un attribut `on…="…"`.
 *
 * Deux pieges, tous deux rencontres au premier passage :
 *   - `document.getElementById(...)` n'est pas un appel a NOUS : un nom
 *     precede d'un point est une METHODE, pas une fonction a definir ;
 *   - `alert('consultation(s)')` donnait « consultation » — un nom lu DANS
 *     une chaine. On efface donc le contenu des chaines avant de lire.
 */
function appelesDans(expr) {
  const sansChaines = expr.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
  const out = [];
  for (const m of sansChaines.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) out.push(m[2]);
  return out;
}

const rapport = [];
const total = { pages: 0, elements: 0, morts: 0, liens: 0, liensCasses: 0, idsAbsents: 0 };
const rpcAppelees = new Set();
const edgeAppelees = new Set();

for (const page of PAGES) {
  const brut = readFileSync(page, 'utf8');
  const html = sansCommentaires(brut);
  const portee = porteeDe(brut, page);
  const p = { page, morts: [], liensCasses: [], scriptsAbsents: [], idsAbsents: [], elements: 0, liens: 0 };

  p.scriptsAbsents = portee.fichiers.filter((f) => f.startsWith('ABSENT:')).map((f) => f.slice(7));

  // ── 1. Les gestionnaires poses dans le HTML ─────────────────────────
  for (const m of html.matchAll(/\son(click|submit|change|input|keyup|keydown)\s*=\s*"([^"]*)"/gi)) {
    p.elements++;
    const ligne = html.slice(0, m.index).split('\n').length;
    for (const nom of appelesDans(m[2])) {
      if (CONNUS.has(nom)) continue;
      if (estDefini(nom, portee.code)) continue;
      p.morts.push({ ligne, nom, extrait: m[2].slice(0, 70) });
    }
  }

  // ── 1 bis. Les DEREFERENCEMENTS SANS FILET ──────────────────────────
  // `getElementById('x').textContent = …` quand aucun `id="x"` n'existe dans
  // la page : ce n'est pas un avertissement, c'est une exception —
  // « Cannot read properties of null » — qui casse TOUT le script a partir de
  // cette ligne. Les boutons declares plus bas ne sont jamais branches.
  //
  // ⚠️ DEUX RESTRICTIONS, et elles viennent d'une premiere version qui rendait
  // 52 alertes dont 45 fausses :
  //   - scripts INLINE seulement. Les fichiers partages de `js/` cherchent
  //     legitimement des ids qui n'existent que sur d'autres pages.
  //   - dereferencement DIRECT seulement (`...).quelquechose`). Un
  //     `const el = getElementById('x'); if (el) …` est une precaution, pas un
  //     defaut — et c'est la forme la plus frequente (`splash`, `loading`).
  let inline = '';
  for (const m of brut.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) inline += '\n' + m[1];
  inline = sansCommentaires(inline);
  const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
  for (const m of inline.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*(\w+)/g)) {
    const cible = m[1];
    if (ids.has(cible)) continue;
    // Un id fabrique par concatenation (`'tab-' + nom`) n'est pas un id.
    if (/[-_]$/.test(cible)) continue;
    if (new RegExp(`\\bid\\s*=\\s*['"\`]${cible}['"\`]`).test(inline)) continue;
    p.idsAbsents.push(`${cible} (.${m[2]})`);
  }

  // ── 2. Les liens internes ───────────────────────────────────────────
  // Les URL absolues (`https://tabibi.doctor/...`, canoniques et partages) ne
  // sont pas des liens internes : les compter cassees ajoutait 60 fausses
  // alertes.
  for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']+\.html)(?:[?#][^"']*)?["']/gi)) {
    const cible = resoudre(page, m[1]);
    if (!cible) continue;
    p.liens++;
    if (!existsSync(cible)) {
      p.liensCasses.push({ ligne: html.slice(0, m.index).split('\n').length, cible });
    }
  }

  // ── 3. Ce que la page demande au serveur ────────────────────────────
  for (const m of portee.code.matchAll(/\.rpc\(\s*['"]([\w.]+)['"]/g)) rpcAppelees.add(m[1]);
  for (const m of portee.code.matchAll(/tabibiRpc\(\s*['"]([\w.]+)['"]/g)) rpcAppelees.add(m[1]);
  for (const m of portee.code.matchAll(/functions\.invoke\(\s*['"]([\w-]+)['"]/g)) edgeAppelees.add(m[1]);

  total.pages++;
  total.elements += p.elements;
  total.morts += p.morts.length;
  total.liens += p.liens;
  total.liensCasses += p.liensCasses.length;
  total.idsAbsents += p.idsAbsents.length;
  rapport.push(p);
}

const rpcAbsentes = [...rpcAppelees].filter((r) => RPC_REF.size && !RPC_REF.has(r)).sort();
const edgeAbsentes = [...edgeAppelees].filter((f) => !EDGE.includes(f)).sort();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, rapport, rpcAbsentes, edgeAbsentes,
    rpcAppelees: [...rpcAppelees].sort(), edgeAppelees: [...edgeAppelees].sort() }, null, 2));
  process.exit(0);
}

console.log(`Pages ............... ${total.pages}`);
console.log(`Elements interactifs  ${total.elements}   (attributs on*)`);
console.log(`Gestionnaires MORTS . ${total.morts}`);
console.log(`Liens internes ...... ${total.liens}   dont casses : ${total.liensCasses}`);
console.log(`Dereferencements nuls ${total.idsAbsents}   (script inline -> id absent, sans filet)`);
console.log(`RPC appelees ........ ${rpcAppelees.size}   hors reference : ${rpcAbsentes.length}`);
console.log(`Edge appelees ....... ${edgeAppelees.size}   sans repertoire : ${edgeAbsentes.length}`);
console.log('');

for (const p of rapport) {
  if (!p.morts.length && !p.liensCasses.length && !p.scriptsAbsents.length && !p.idsAbsents.length) continue;
  console.log(`── ${p.page}`);
  for (const s of p.scriptsAbsents) console.log(`   SCRIPT ABSENT  ${s}`);
  for (const d of p.morts) console.log(`   MORT  :${d.ligne}  ${d.nom}()   ${d.extrait}`);
  for (const l of p.liensCasses) console.log(`   LIEN  :${l.ligne}  -> ${l.cible}`);
  for (const i of p.idsAbsents) console.log(`   NUL   #${i}  dereference sans filet`);
}
if (rpcAbsentes.length) console.log(`\nRPC hors reference : ${rpcAbsentes.join(', ')}`);
if (edgeAbsentes.length) console.log(`Edge sans repertoire : ${edgeAbsentes.join(', ')}`);
