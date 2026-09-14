#!/usr/bin/env node
// =====================================================================
// verifier-proprete.mjs — le depot ne contient que ce qu'on y a mis EXPRES
// =====================================================================
// Ne le 13/09/2026 d'une faute a moi. Un `git add -A` lance pour committer
// trois fichiers de mesure a emporte **23 fichiers etrangers** dans une branche :
//
//     .wrangler/state/v3/…      9 fichiers sqlite de miniflare (etat local)
//     Claude outputs/…          6 fichiers — des livraisons deposees par
//                               l'application dans le dossier du projet
//     _to_delete/…              5 fichiers, dont DEUX archives de 2,8 Mo
//     3 documents .md a la racine, non suivis depuis des jours
//
// plus une capture de preuve e2e regeneree par un run, `docs/preuves/
// parcours4-medecin.png` — **une preuve ne se regenere pas par accident.**
//
// LA VRAIE REGLE EST DANS CLAUDE.md : on ajoute PAR CHEMIN. Cette porte est le
// FILET, pas la regle. Elle attrape ce qui est deja entre ; elle n'empeche pas
// d'entrer. Un .gitignore non plus : il ne couvre que ce qu'on a prevu.
//
// POURQUOI CA MERITE UNE PORTE, et pas seulement une resolution :
//   • le bruit CACHE la revue. 31 fichiers au lieu de 7, et le relecteur ne
//     lit plus rien — c'est la meme faute que le catch muet, a l'echelle du
//     depot : un defaut qui se presente comme un etat normal ;
//   • `Claude outputs/` peut contenir du SQL a coller, donc potentiellement
//     des valeurs sensibles. Ce n'est pas arrive ici (verifie), mais le
//     mecanisme qui l'a fait entrer ne distinguait rien ;
//   • un depot qui grossit de 5,6 Mo d'archives ne redevient pas petit : un
//     objet git ne se supprime pas d'un `git rm`.
//
// CE QU'ELLE REGARDE : les fichiers SUIVIS par git (`git ls-files`), pas le
// repertoire de travail. Des fichiers non suivis dans le dossier ne sont pas
// un defaut — c'est meme l'etat normal d'un repertoire de travail.
//
// Usage : node scripts/verifier-proprete.mjs
// =====================================================================
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;

// Motifs INTERDITS dans les fichiers suivis. Chacun a sa raison ecrite : une
// liste de motifs sans raisons devient un cimetiere que personne n'ose toucher.
const INTERDITS = [
  [/^\.wrangler\//,      'etat local de wrangler/miniflare — machine, pas depot'],
  [/^_to_delete\//,      'corbeille de travail — si c\'est a jeter, ca ne se versionne pas'],
  [/^Claude outputs\//,  'livraisons deposees par l\'app dans le dossier — peut contenir du SQL a coller'],
  [/\.zip$/i,            'archive — un binaire versionne ne redevient jamais petit'],
  [/\.sqlite(-shm|-wal)?$/i, 'base sqlite locale — etat de machine'],
  [/\.lock\.old$/i,      'residu de verrou'],
];

// Plafond de poids. `docs/preuves/` (captures e2e) et `assets/` (polices,
// bibliotheques vendorisees) sont exemptes : leur poids est DELIBERE.
const PLAFOND_OCTETS = 1024 * 1024;
const EXEMPTS_POIDS = [/^docs\/preuves\//, /^assets\//];

let suivis;
try {
  suivis = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
} catch {
  console.error(ROUGE('✗ `git ls-files` a echoue — hors depot git ?'));
  process.exit(2);
}

const interdits = [];
const tropLourds = [];

for (const f of suivis) {
  const motif = INTERDITS.find(([re]) => re.test(f));
  if (motif) { interdits.push([f, motif[1]]); continue; }
  if (EXEMPTS_POIDS.some((re) => re.test(f))) continue;
  let taille;
  try { taille = statSync(f).size; } catch { continue; }  // suivi mais absent du disque
  if (taille > PLAFOND_OCTETS) tropLourds.push([f, taille]);
}

const ko = (n) => `${(n / 1024 / 1024).toFixed(2)} Mo`;
console.log(`Controle PROPRETE — ${suivis.length} fichier(s) suivi(s) par git.`);

let echec = false;
if (interdits.length) {
  echec = true;
  console.error(ROUGE(`\n✗ ${interdits.length} fichier(s) suivi(s) correspondent a un motif interdit :`));
  for (const [f, pourquoi] of interdits) console.error(`    ${f}\n        ${pourquoi}`);
}
if (tropLourds.length) {
  echec = true;
  console.error(ROUGE(`\n✗ ${tropLourds.length} fichier(s) suivi(s) depassent ${ko(PLAFOND_OCTETS)} hors docs/preuves/ et assets/ :`));
  for (const [f, t] of tropLourds) console.error(`    ${ko(t).padStart(9)}  ${f}`);
}
if (echec) {
  console.error('\n  Les retirer du SUIVI (git rm --cached <chemin>) et les couvrir dans .gitignore.');
  console.error('  Et la cause, qui n\'est pas dans cette porte : on ajoute PAR CHEMIN.');
  console.error('  Ni `git add -A`, ni `git add .`. Voir CLAUDE.md, regle 9.');
  process.exit(1);
}

console.log(VERT('\nAucun fichier etranger suivi, aucun poids non declare.'));
