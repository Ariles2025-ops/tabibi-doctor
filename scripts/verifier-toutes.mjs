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
import { mkdirSync, readFileSync, openSync, closeSync } from 'node:fs';

// =====================================================================
// [17/09/2026] LA PORTE TUAIT CE QU'ELLE MESURAIT, PUIS L'ACCUSAIT
// =====================================================================
// `verifier:toutes` sortait ROUGE sur `e2e` pendant que `npx playwright test`,
// lance a la meme seconde sur la meme machine, rendait **502 passed**.
//
// Mesure du spawnSync fautif :
//
//     status : null          signal : SIGTERM
//     error  : ENOBUFS — spawnSync npm ENOBUFS
//     stdout :  82 942 o  +  stderr : 960 887 o  =  1 043 829 o
//
// `spawnSync` capture en MEMOIRE, plafonne a 1 MiB par defaut. Au-dela, Node
// **tue l'enfant** (SIGTERM) et rend `status: null`. Et ce script faisait :
//
//     const code = r.status === null ? 1 : r.status;   // -> 1
//
// Donc : la suite passait, la porte la tuait a quelques tests de la fin, et
// rapportait « La porte e2e sort en 1 ». **Un faux rouge fabrique par le
// mesureur.** Le pire des deux mondes : on ne peut pas le distinguer d'un vrai
// echec, et l'extrait ne nomme aucun test tombe — puisqu'aucun n'est tombe.
//
// Pourquoi maintenant : le serveur statique de Playwright imprime une ligne
// d'acces par requete, sur stderr. La suite a grossi (502 essais), stderr a
// franchi le mega-octet, et le plafond est tombe pile au milieu d'un lot.
// **Un plafond qu'on ne voit pas monter est un plafond qu'on franchit sans le
// savoir.**
//
// Correctif : la sortie va DIRECTEMENT dans un fichier (aucun plafond), et on
// la relit pour l'extrait. Et si l'enfant est tue quand meme, on le DIT au
// lieu de le confondre avec un echec de test.
// =====================================================================

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
  ['passerelle','npm', ['run', '--silent', 'verifier:passerelle']],
  ['proprete', 'npm',  ['run', '--silent', 'verifier:proprete']],
  ['catch',    'npm',  ['run', '--silent', 'verifier:catch']],
  // [14/09/2026] Cette porte s'appelait `signature` et ne lancait qu'UN fichier.
  // Renommee `unites` et elargie a `tests/*.test.mjs`, pour deux raisons qui
  // se completent :
  //
  //   - les modules de `supabase/functions/_partage/` sont du code Deno qu'on
  //     execute sous Node (voir l'en-tete de chaque fichier d'essai) ; une
  //     porte par module aurait fait grossir cette liste d'une ligne a chaque
  //     fois, et la ligne qu'on OUBLIE d'ajouter est une porte qui n'existe pas ;
  //   - le jour ou un lot ajoute un essai unitaire sans penser a declarer sa
  //     porte, cet essai serait ecrit et lance par PERSONNE — une absence
  //     deguisee en normalite.
  //
  // `signature` ne reapparait pas a cote : `unites` lance STRICTEMENT PLUS de
  // fichiers qu'elle (elle inclut `signature-ordonnance.test.mjs`). Les garder
  // toutes les deux ferait tourner le meme essai sous deux noms — du bruit qui
  // ressemble a de la couverture.
  ['unites',   'npm',  ['run', '--silent', 'verifier:unites']],
  ['video',    'npm',  ['run', '--silent', 'verifier:video']],
  // [15/09/2026] Le compteur d'innerHTML recevant une donnee NON constante.
  // Meme contrat que `dette` : il ne doit que BAISSER. Les reecrire tous d'un
  // coup produirait un diff que personne ne relit.
  ['innerhtml','npm',  ['run', '--silent', 'verifier:innerhtml']],
  ['build',    'npm',  ['run', '--silent', 'build']],
  ['e2e',      'npm',  ['run', '--silent', 'test:e2e']],
];

// LE PLANCHER. Une porte de cette liste DOIT exister dans package.json.
//
// Sans lui, le garde-fou « absente -> sautee » devient une faille : il suffirait
// de retirer une ligne du package.json pour que la porte disparaisse en
// silence, signalee d'un tiret, et que tout reste vert. C'est l'ABSENCE
// DEGUISEE EN NORMALITE — exactement la faute que ce script existe pour
// empecher, retournee contre lui.
//
// Regle : une porte y entre le jour ou sa branche entre dans main. La liste des
// « sautees » doit MAIGRIR, jamais grossir.
const PORTES_OBLIGATOIRES = new Set([
  'lint:dette', 'i18n:verifier', 'verifier:cles', 'verifier:c1',
  'verifier:statuts', 'verifier:panneaux', 'verifier:fuseau',
  'verifier:rpc', 'verifier:rpc-passage', 'verifier:passerelle', 'verifier:proprete',
  'verifier:catch', 'verifier:unites', 'verifier:video', 'verifier:innerhtml', 'build', 'test:e2e',
]);

// LES PORTES ATTENDUES. Elles existent sur une branche non encore fusionnee.
//
// Ceci etait une paire de COMMENTAIRES dans PORTES_OBLIGATOIRES. Un commentaire
// depend de quelqu'un qui le lit — c'est `tail -1` en plus petit. Si personne ne
// le decommente, la porte entre dans main et reste sautee EN SILENCE, le script
// restant vert. Une absence deguisee en normalite, une fois de plus.
//
// C'est desormais une liste declaree, que le script IMPRIME a chaque passage.
// Une ligne de sortie qu'on voit, pas un commentaire qu'on oublie. Elle
// disparait d'elle-meme le jour ou la liste se vide.
const PORTES_A_VENIR = new Map([
]);

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;

// =====================================================================
// [15/09/2026] UNE PORTE ROUGE DOIT DIRE **QUOI**
// =====================================================================
// La porte `e2e` est sortie en 1 sur le runner — et personne n'a pu savoir
// quel test. Ce script imprimait les 25 DERNIERES lignes de la sortie ; or
// Playwright demarre un serveur statique dont CHAQUE requete s'imprime
// (`[WebServer] "GET /js/… 200"`). Mesure du 15/09 : sur les 25 dernieres
// lignes d'un echec e2e reel, **22 etaient des lignes d'acces HTTP** et
// aucune ne nommait le test tombe. Le diagnostic etait dans la sortie, a
// quatre cents lignes de la fin.
//
// « Les 25 dernieres lignes » est le meme raccourci que le `tail -1` de la
// boucle shell du 13/09, en un peu plus long : **on regarde une position,
// pas un contenu.**
//
// Desormais : le bruit d'acces HTTP est retire, les lignes qui PARLENT d'un
// echec sont remontees en premier, et la sortie COMPLETE est ecrite dans un
// fichier dont le chemin est imprime — parce qu'un extrait, aussi bien
// choisi soit-il, reste un extrait.
const BRUIT = /^\s*\[WebServer\]|^\s*$/;
const PARLANT = /✘|✗|×|Error|error|FAIL|failed|failing|flaky|Expected|Received|expect\(|assert|Timeout|ECONNREFUSED|ENOENT|\bat .*\.(js|mjs|ts):\d+/;

function extraire(nom, sortie) {
  const lignes = sortie.split('\n').filter((l) => !BRUIT.test(l));
  const parlantes = lignes.filter((l) => PARLANT.test(l));
  // Ce qui parle d'abord ; a defaut, la fin, qui vaut mieux que rien.
  const choix = (parlantes.length ? parlantes : lignes).slice(-30);

  // Le fichier existe deja : la sortie y a ete ecrite DIRECTEMENT par l'enfant,
  // sans passer par un tampon plafonne (voir l'en-tete du fichier).
  const chemin = `test-results/porte-${nom}.log`;

  const bloc = choix.map((l) => '  ' + l).join('\n');
  return chemin
    ? `${bloc}\n\n  ${ROUGE('Sortie complete :')} ${chemin}  (${lignes.length} lignes utiles`
      + ` sur ${sortie.split('\n').length})`
    : bloc;
}

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
    if (PORTES_OBLIGATOIRES.has(npmScript)) {
      console.log(`  ${ROUGE('  !!  ')} ${nom.padEnd(10)} OBLIGATOIRE et ABSENTE de package.json`);
      console.error('');
      console.error(ROUGE(`\u2717 La porte « ${nom} » (${npmScript}) est declaree OBLIGATOIRE et n'existe plus.`));
      console.error(`  Une porte ne disparait pas sans decision : soit on la retablit dans`);
      console.error(`  package.json, soit on la retire de PORTES_OBLIGATOIRES en disant pourquoi.`);
      console.error(`  Une absence silencieuse est une absence deguisee en normalite.`);
      echec = nom;
      break;
    }
    const attendue = PORTES_A_VENIR.has(npmScript);
    console.log(`  ${'-'.padEnd(6)} ${nom.padEnd(10)} absente de package.json, sautee`
      + (attendue ? ' (attendue)' : ' (non declaree)'));
    continue;
  }
  const t = Date.now();
  // ⚠️ La sortie part dans un FICHIER, pas dans un tampon memoire. `spawnSync`
  // plafonne sa capture a 1 MiB et TUE l'enfant au-dela : la porte e2e a ete
  // rapportee rouge alors que ses 502 essais passaient. Un descripteur de
  // fichier n'a pas de plafond.
  mkdirSync('test-results', { recursive: true });
  const journal = `test-results/porte-${nom}.log`;
  const fd = openSync(journal, 'w');
  let r;
  try {
    r = spawnSync(cmd, args, { stdio: ['ignore', fd, fd], shell: false });
  } finally {
    closeSync(fd);
  }
  const duree = ((Date.now() - t) / 1000).toFixed(1) + 's';

  // ⚠️ UN ENFANT TUE N'EST PAS UN ESSAI QUI ECHOUE. On les distingue, parce
  // que les confondre a coute une journee : le message disait « la porte sort
  // en 1 » et l'extrait ne nommait aucun test — puisqu'aucun n'etait tombe.
  if (r.status === null) {
    const cause = r.signal ? `tue par ${r.signal}` : 'termine sans code';
    console.log(`  ${ROUGE('  !!  ')} ${nom.padEnd(10)} ${duree}`);
    console.error('');
    console.error(ROUGE(`✗ La porte « ${nom} » n'a pas rendu de code : ${cause}`
      + `${r.error ? ` (${r.error.code || r.error.message})` : ''}.`));
    console.error(ROUGE('  Ce n\'est PAS un essai en echec : c\'est l\'execution qui a ete interrompue.'));
    console.error(`  Sortie partielle : ${journal}`);
    echec = nom;
    break;
  }

  const code = r.status;
  if (code === 0) {
    console.log(`  ${VERT('  ok  ')} ${nom.padEnd(10)} ${duree}`);
    continue;
  }
  console.log(`  ${ROUGE(` ${String(code).padStart(4)} `)} ${nom.padEnd(10)} ${duree}`);
  console.error('');
  console.error(ROUGE(`✗ La porte « ${nom} » sort en ${code}. On s'arrete ici.`));
  let sortie = '';
  try { sortie = readFileSync(journal, 'utf8').trimEnd(); } catch { /* journal illisible */ }
  if (sortie) console.error(extraire(nom, sortie));
  echec = nom;
  break;
}

// Bilan des portes ATTENDUES, imprime a chaque passage tant que la liste n'est
// pas vide. Une porte attendue qui EXISTE desormais doit etre promue : sans ce
// signal, elle tournerait sans plancher et pourrait disparaitre en silence.
const aPromouvoir = [...PORTES_A_VENIR.keys()].filter((k) => scripts[k]);
const encoreAbsentes = [...PORTES_A_VENIR.keys()].filter((k) => !scripts[k]);
if (encoreAbsentes.length) {
  console.log('');
  console.log(`  ${encoreAbsentes.length} porte(s) attendue(s), pas encore obligatoire(s) : ${encoreAbsentes.join(', ')}`);
  for (const k of encoreAbsentes) console.log(`      ${k.padEnd(18)} ${PORTES_A_VENIR.get(k)}`);
}
if (aPromouvoir.length) {
  console.log('');
  console.log(ROUGE(`  ⇧ ${aPromouvoir.length} porte(s) A PROMOUVOIR en obligatoire : ${aPromouvoir.join(', ')}`));
  console.log('      Elle(s) existe(nt) desormais dans package.json et tournent SANS PLANCHER :');
  console.log('      les deplacer de PORTES_A_VENIR vers PORTES_OBLIGATOIRES.');
}

console.log('');
if (echec) {
  console.error(ROUGE(`PORTES : ROUGE (${echec}).`) + ` ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(1);
}
console.log(VERT('PORTES : toutes vertes.') + ` ${((Date.now() - t0) / 1000).toFixed(1)}s`);
