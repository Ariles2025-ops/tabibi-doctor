#!/usr/bin/env node
// =====================================================================
// verifier-passerelle-chargee.mjs — une page qui APPELLE tabibiRpc doit
// CHARGER js/tabibi-rpc.js
// =====================================================================
// Ce n'est pas theorique : le 13/09/2026, `dawini-pharmacie.html` appelait
// `window.tabibiDawini.expireOld()`, qui passe par `window.tabibiRpc`, et NE
// CHARGEAIT PAS `js/tabibi-rpc.js`. Sur cette page, la passerelle etait
// `undefined`. Trouve a la main, en migrant le site — aucune garde ne le
// voyait, et rien a l'ecran ne l'aurait dit.
//
// LE DEFAUT EST TRANSITIF, et c'est ce qui le rend invisible :
//   dawini-pharmacie.html  ->  js/tabibi-dawini.js  ->  window.tabibiRpc
// La page ne mentionne jamais `tabibiRpc`. Chercher le mot dans la page ne
// trouve rien. Il faut suivre les modules qu'elle charge.
//
// TROIS CONTROLES :
//   1. PRESENCE — toute page consommatrice porte une balise tabibi-rpc.js.
//   2. RESOLUTION — le chemin de cette balise designe un fichier qui EXISTE.
//      Une page de `legal/` qui ecrit `src="js/tabibi-rpc.js"` au lieu de
//      `../js/…` passerait le controle 1 et servirait un 404 : balise
//      presente, passerelle absente. C'est le meme mensonge, en pire.
//   3. ORDRE — la balise precede le premier consommateur. Un module charge
//      avant elle ne la verra pas si son code s'execute au chargement.
//
// Usage : node scripts/verifier-passerelle-chargee.mjs
// =====================================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;
const PASSERELLE = 'js/tabibi-rpc.js';

const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'docs', 'supabase', 'migrations',
  'scripts', 'src']);

function fichiers(dir = '.', ext, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, ext, acc);
    else if (ext.test(e.name) && !e.name.includes('vendor')) acc.push(p);
  }
  return acc;
}

// Commentaires neutralises : un `// window.tabibiRpc` dans un commentaire n'est
// pas un appel, et un `<!-- … -->` non plus.
const sansCommentairesJs = (c) =>
  c.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const sansCommentairesHtml = (c) => c.replace(/<!--[\s\S]*?-->/g, ' ');

// ---------------------------------------------------------------------
// 1. Les modules de js/ qui appellent la passerelle (elle-meme exclue).
// ---------------------------------------------------------------------
const consommateurs = fichiers('js', /\.js$/)
  .filter((f) => f !== PASSERELLE)
  .filter((f) => /\btabibiRpc\s*\(/.test(sansCommentairesJs(readFileSync(f, 'utf8'))))
  .map((f) => basename(f));

// ---------------------------------------------------------------------
// 2. Chaque page : consomme-t-elle, et si oui charge-t-elle la passerelle ?
// ---------------------------------------------------------------------
const balises = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const srcDe = (attrs) => (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [, null])[1];

const manquantes = [];
const irresolues = [];
const malOrdonnees = [];
let consommatrices = 0;

for (const page of fichiers('.', /\.html$/)) {
  const brut = sansCommentairesHtml(readFileSync(page, 'utf8'));

  let posPasserelle = -1, srcPasserelle = null;
  let posConsommateur = -1, quiConsomme = null;
  let m;
  balises.lastIndex = 0;
  while ((m = balises.exec(brut)) !== null) {
    const src = srcDe(m[1] || '');
    if (src) {
      const b = basename(src.split('?')[0]);
      if (b === 'tabibi-rpc.js' && posPasserelle === -1) {
        posPasserelle = m.index; srcPasserelle = src;
      } else if (consommateurs.includes(b) && posConsommateur === -1) {
        posConsommateur = m.index; quiConsomme = b;
      }
    } else if (posConsommateur === -1 && /\btabibiRpc\s*\(/.test(sansCommentairesJs(m[2] || ''))) {
      posConsommateur = m.index; quiConsomme = 'script en ligne';
    }
  }

  if (posConsommateur === -1) continue;          // ne consomme pas : rien a exiger
  consommatrices += 1;

  if (posPasserelle === -1) { manquantes.push([page, quiConsomme]); continue; }

  // Le chemin designe-t-il un fichier qui existe, depuis CETTE page ?
  const cible = resolve(dirname(page), srcPasserelle.split('?')[0]);
  if (!existsSync(cible)) irresolues.push([page, srcPasserelle]);

  if (posPasserelle > posConsommateur) malOrdonnees.push([page, quiConsomme]);
}

console.log(`Controle PASSERELLE CHARGEE — ${consommateurs.length} module(s) consommateur(s) : ${consommateurs.join(', ') || '(aucun)'}`);
console.log(`  ${consommatrices} page(s) consommatrice(s) de window.tabibiRpc.`);

let echec = false;
if (manquantes.length) {
  echec = true;
  console.error(ROUGE(`\n✗ ${manquantes.length} page(s) appellent la passerelle SANS la charger :`));
  for (const [p, q] of manquantes) console.error(`    ${p}   <- via ${q}`);
  console.error(`  Ajouter <script src="…/${PASSERELLE}"></script> AVANT le consommateur.`);
  console.error('  Sans elle, window.tabibiRpc est undefined et l\'appel jette a l\'execution.');
}
if (irresolues.length) {
  echec = true;
  console.error(ROUGE(`\n✗ ${irresolues.length} balise(s) tabibi-rpc.js dont le chemin N'EXISTE PAS :`));
  for (const [p, s] of irresolues) console.error(`    ${p}   src="${s}"`);
  console.error('  Balise presente, passerelle absente : le navigateur sert un 404 en silence.');
}
if (malOrdonnees.length) {
  echec = true;
  console.error(ROUGE(`\n✗ ${malOrdonnees.length} page(s) chargent la passerelle APRES son consommateur :`));
  for (const [p, q] of malOrdonnees) console.error(`    ${p}   consommateur : ${q}`);
  console.error('  Sans effet si l\'appel est differe ; fatal s\'il a lieu au chargement.');
}

if (echec) process.exit(1);
console.log(VERT('\nToute page qui appelle la passerelle la charge, par un chemin qui existe, avant usage.'));
