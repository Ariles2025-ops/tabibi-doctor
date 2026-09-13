#!/usr/bin/env node
// =====================================================================
// verifier-toutes.mjs — les portes, enchainees, lues sur $?
// =====================================================================
// CE QUI CONTROLE DOIT ETRE CONTROLE.
//
// Le 13/09/2026, neuf gardes avaient chacune leur contre-epreuve. La boucle
// shell qui les executait, elle, n'en avait aucune :
//
//   for g in ...; do printf "%s\n" "$(eval "$c" 2>&1 | tail -1)"; done
//
// Elle imprimait la DERNIERE LIGNE de chaque contrôle, jamais son code de
// sortie. « cles  1 fichier(s) portent un litteral de cle… » s'est affiche dans
// la colonne des resultats exactement comme les huit verts, et a ete lu comme
// un statut. Le merge est parti sur main avec une porte rouge.
//
// Un verdict se lit sur un CODE DE SORTIE, jamais sur une ligne de texte.
//
// Ce script est la reponse : il enchaine, s'arrete au premier echec, et rend
// lui-meme un code non nul. C'est LUI qu'on lance — jamais une boucle ecrite a
// la main, jamais un enchainement de `npm run` copie dans un terminal.
//
// Usage : npm run verifier:toutes
// =====================================================================
import { spawnSync } from 'node:child_process';

const PORTES = [
  ['eslint',   'npx',  ['eslint', 'js', 'src', 'scripts', '--quiet']],
  ['dette',    'npm',  ['run', '--silent', 'lint:dette']],
  ['i18n',     'npm',  ['run', '--silent', 'i18n:verifier']],
  ['cles',     'npm',  ['run', '--silent', 'verifier:cles']],
  ['c1',       'npm',  ['run', '--silent', 'verifier:c1']],
  ['statuts',  'npm',  ['run', '--silent', 'verifier:statuts']],
  ['panneaux', 'npm',  ['run', '--silent', 'verifier:panneaux']],
  ['fuseau',   'npm',  ['run', '--silent', 'verifier:fuseau']],
  ['rpc',      'npm',  ['run', '--silent', 'verifier:rpc']],
  ['passage',  'npm',  ['run', '--silent', 'verifier:rpc-passage']],
  ['catch',    'npm',  ['run', '--silent', 'verifier:catch']],
  ['build',    'npm',  ['run', '--silent', 'build']],
  ['e2e',      'npm',  ['run', '--silent', 'test:e2e']],
];

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;

// Certaines portes n'existent pas encore sur toutes les branches : une porte
// absente du package.json n'est pas un echec, elle est SIGNALEE puis sautee.
// Sans ce garde-fou, le script deviendrait lui-meme une source de faux rouge —
// la faute qu'il est cense empecher.
const scripts = JSON.parse(
  spawnSync('node', ['-e', "process.stdout.write(JSON.stringify(require('./package.json').scripts||{}))"],
    { encoding: 'utf8' }).stdout || '{}');

let echec = null;
const t0 = Date.now();
for (const [nom, cmd, args] of PORTES) {
  const npmScript = cmd === 'npm' && args[0] === 'run' ? args[args.length - 1] : null;
  if (npmScript && !scripts[npmScript]) {
    console.log(`  ${'-'.padEnd(6)} ${nom.padEnd(10)} absente de package.json, sautee`);
    continue;
  }
  const t = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false });
  const code = r.status === null ? 1 : r.status;
  const duree = ((Date.now() - t) / 1000).toFixed(1) + 's';
  if (code === 0) {
    console.log(`  ${VERT('  ok  ')} ${nom.padEnd(10)} ${duree}`);
    continue;
  }
  console.log(`  ${ROUGE(` ${String(code).padStart(4)} `)} ${nom.padEnd(10)} ${duree}`);
  console.error('');
  console.error(ROUGE(`✗ La porte « ${nom} » sort en ${code}. On s'arrete ici.`));
  const sortie = ((r.stdout || '') + (r.stderr || '')).trimEnd();
  if (sortie) console.error(sortie.split('\n').slice(-25).map((l) => '  ' + l).join('\n'));
  echec = nom;
  break;
}

console.log('');
if (echec) {
  console.error(ROUGE(`PORTES : ROUGE (${echec}).`) + ` ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(1);
}
console.log(VERT('PORTES : toutes vertes.') + ` ${((Date.now() - t0) / 1000).toFixed(1)}s`);
