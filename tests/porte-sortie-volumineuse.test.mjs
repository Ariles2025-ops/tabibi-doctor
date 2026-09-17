// =====================================================================
// tests/porte-sortie-volumineuse.test.mjs — la porte tuait ce qu'elle
// mesurait, puis l'accusait
// =====================================================================
// ⚠️ `npm run verifier:toutes` sortait **ROUGE sur e2e** pendant que
// `npx playwright test`, lancé à la même seconde sur la même machine et le même
// serveur neuf, rendait **502 passed**.
//
// Mesure du `spawnSync` fautif :
//
//     status : null          signal : SIGTERM
//     error  : ENOBUFS — spawnSync npm ENOBUFS
//     stdout :  82 942 o  +  stderr : 960 887 o  =  1 043 829 o
//
// `spawnSync` capture en MÉMOIRE, plafonné à 1 MiB par défaut. Au-delà, Node
// **tue l'enfant** (SIGTERM) et rend `status: null`. Et le script faisait :
//
//     const code = r.status === null ? 1 : r.status;   // → 1
//
// Donc : la suite passait, la porte la tuait à quelques essais de la fin, et
// rapportait « La porte e2e sort en 1 ». **Un faux rouge fabriqué par le
// mesureur** — et impossible à distinguer d'un vrai échec, puisque l'extrait ne
// nommait aucun test tombé : aucun ne l'était.
//
// ---------------------------------------------------------------------
// POURQUOI CE JOUR-LÀ
// ---------------------------------------------------------------------
// Le serveur statique de Playwright imprime **une ligne d'accès par requête**,
// sur stderr. La suite a grossi (502 essais), stderr a franchi le mégaoctet, et
// le plafond est tombé au milieu d'un lot qui n'y était pour rien.
//
// > **Un plafond qu'on ne voit pas monter est un plafond qu'on franchit sans le
// > savoir.** C'est la famille du `tail -1` de la boucle shell du 13/09 et des
// > « 25 dernières lignes » : le mesureur regarde une position, pas un contenu.
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER GARDE
// ---------------------------------------------------------------------
// 1. Le MÉCANISME, reproduit : une capture mémoire meurt au-delà du plafond,
//    un descripteur de fichier n'a pas de plafond. Sans cette moitié, la règle
//    du dessous serait une convention que personne ne saurait justifier.
// 2. Que `verifier-toutes.mjs` lance bien ses portes SANS capture mémoire, et
//    qu'il distingue « enfant tué » de « essai en échec ».
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, openSync, closeSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Un enfant qui écrit `mo` mégaoctets par morceaux, comme un rapporteur de test.
 *
 * ⚠️ PAS de `process.exit()` — et ce détail a d'abord fait échouer cet essai.
 * Les écritures sur un tube sont ASYNCHRONES : sortir tout de suite tronque la
 * sortie à un seul morceau, le plafond n'est jamais atteint, et l'essai conclut
 * que le mécanisme n'existe pas. Il existe ; c'était l'enfant qui trichait.
 */
const ENFANT = (mo) => `
  const bloc = 'x'.repeat(64 * 1024) + '\\n';
  for (let i = 0; i < ${mo} * 16; i++) process.stderr.write(bloc);
`;

// ─────────────────────────────────────────────────────────────────────
// 1. LE MÉCANISME
// ─────────────────────────────────────────────────────────────────────
test('capturer en mémoire TUE l’enfant au-delà du plafond — et masque son vrai code', () => {
  const r = spawnSync(process.execPath, ['-e', ENFANT(2)], { encoding: 'utf8', shell: false });

  assert.equal(r.status, null,
    'le plafond de spawnSync ne tue plus : relire ce fichier avant de simplifier la porte');
  assert.ok(r.signal === 'SIGTERM' || (r.error && r.error.code === 'ENOBUFS'),
    `attendu SIGTERM/ENOBUFS, obtenu signal=${r.signal} error=${r.error && r.error.code}`);

  // ⚠️ VOILÀ LE FAUX ROUGE, EN UNE LIGNE : l'enfant est sorti en 0, et la
  // lecture naïve du code en fait un échec.
  assert.equal(r.status === null ? 1 : r.status, 1,
    'c’est cette conversion qui transformait une suite verte en porte rouge');
});

test('écrire dans un FICHIER n’a pas de plafond — l’enfant vit et son code est lu', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'porte-'));
  const journal = join(dossier, 'sortie.log');
  const fd = openSync(journal, 'w');
  let r;
  try {
    r = spawnSync(process.execPath, ['-e', ENFANT(2)], { stdio: ['ignore', fd, fd], shell: false });
  } finally {
    closeSync(fd);
  }

  assert.equal(r.status, 0, 'l’enfant a été tué alors qu’il écrivait dans un fichier');
  assert.equal(r.signal, null);
  const octets = readFileSync(journal).length;
  // ⚠️ La MOITIÉ QU'ON OUBLIE : ne pas mourir ne suffit pas, il faut que la
  // sortie soit ENTIÈRE — c'est elle qui nomme le test tombé, un jour.
  assert.ok(octets > 2 * 1024 * 1024 * 0.9,
    `sortie tronquée : ${octets} octets pour ~2 Mio écrits`);
  rmSync(dossier, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────
// 2. CE QUE FAIT L'ENCHAÎNEUR
// ─────────────────────────────────────────────────────────────────────
/**
 * Le script, commentaires retirés — il EXPLIQUE le défaut, donc il le cite.
 *
 * ⚠️ L'ORDRE DES DEUX PASSES COMPTE, et il m'a eu. En retirant les blocs
 * `/* … *\/` d'abord, la ligne de commentaire
 *
 *     // Renommee `unites` et elargie a `tests/*.test.mjs`, pour deux raisons
 *
 * ouvrait un faux bloc : la passe avalait **8 331 caractères** jusqu'au `*\/`
 * suivant, deux cents lignes plus bas, et le code qu'on venait vérifier
 * disparaissait. L'essai concluait que le correctif n'était pas là.
 *
 * On retire donc les commentaires de LIGNE d'abord — ils emportent leur faux
 * `/*` avec eux. Dixième fois qu'une garde de ce dépôt se fait avoir par ce
 * qu'on écrit à côté du code.
 */
function scriptNu() {
  return readFileSync('scripts/verifier-toutes.mjs', 'utf8')
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

test('l’enchaîneur lance ses portes SANS capture mémoire', () => {
  const src = scriptNu();
  assert.match(src, /spawnSync\(cmd, args, \{\s*stdio: \['ignore', fd, fd\]/,
    'la sortie d’une porte repasse par un tampon mémoire plafonné');
  // `encoding: 'utf8'` sur le spawnSync d'une PORTE = capture mémoire de retour.
  const lancementPorte = src.slice(src.indexOf('const journal ='), src.indexOf('const duree ='));
  assert.doesNotMatch(lancementPorte, /encoding:\s*'utf8'/,
    'le lancement d’une porte capture de nouveau en mémoire');
});

test('« enfant tué » et « essai en échec » ne sont PAS confondus', () => {
  // ⚠️ C'est la confusion qui a coûté la journée : le message disait « la porte
  // sort en 1 » et l'extrait ne nommait aucun test — puisqu'aucun n'était tombé.
  const src = scriptNu();
  assert.match(src, /if \(r\.status === null\)/,
    'le cas « pas de code de sortie » n’est plus traité à part');
  assert.doesNotMatch(src, /r\.status === null \? 1 : r\.status/,
    'la conversion qui fabriquait le faux rouge est revenue');
  assert.match(src, /n'a pas rendu de code/,
    'le message ne distingue plus une interruption d’un échec d’essai');
});
