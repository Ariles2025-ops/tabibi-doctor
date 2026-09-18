// =====================================================================
// tests/ordonnances-modale-source.test.mjs — la modale ne s'ouvre pas vide
// =====================================================================
// Deux propriétés que la page ne peut pas prouver depuis un navigateur :
//
// 1. `openDetail()` refuse une donnée absente. La fonction est **locale au
//    module** de la page : rien ne l'atteint depuis l'extérieur, donc aucun
//    essai e2e ne peut l'appeler avec `null`.
// 2. La surcouche est ciblée **par son ID**. C'est ce qui la fait gagner contre
//    le `.modal` global de `styles/components-v2.css` **quel que soit l'ordre
//    des feuilles** — et l'ordre s'inverse au build (P-88, P-29).
//
// ⚠️ ET POURQUOI PAS DANS L'ESSAI e2e : celui-ci lit le fichier **servi**. Sur
// `dist-web`, Vite minifie le script en ligne et réécrit les identifiants —
// une assertion de forme y accuserait un code correct. Leçon payée à P-108.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(process.cwd(), 'patient-ordonnances.html');
const V2 = join(process.cwd(), 'styles/components-v2.css');

const nu = (src) => src
  .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

test('openDetail refuse une donnée absente', () => {
  const src = nu(readFileSync(PAGE, 'utf8'));
  const i = src.indexOf('function openDetail');
  assert.ok(i > -1, 'openDetail a disparu');
  const debut = src.slice(i, i + 400);
  assert.match(debut, /if\s*\(\s*!p\s*\|\|\s*!p\.id\s*\)/,
    'openDetail peut de nouveau ouvrir une modale vide');
});

test('la surcouche est ciblée par son ID — pas par la seule classe', () => {
  // ⚠️ LE CŒUR DU DÉFAUT. `components-v2.css` définit un `.modal` GLOBAL qui
  // est un panneau (`display:flex; max-width:480px`). Même spécificité que le
  // `.modal` de la page → c'est l'ordre qui tranche, et il s'inverse au build.
  const src = nu(readFileSync(PAGE, 'utf8'));
  assert.match(src, /#modal\.modal\s*\{/,
    'la surcouche est revenue à un sélecteur de classe : le build la rouvrira');
  assert.match(src, /#modal\.modal[^}]*max-width:\s*none/,
    'la surcouche ne neutralise plus le `max-width: 480px` du panneau global');
  assert.match(src, /#modal\.modal\.open\s*\{[^}]*display:\s*flex/,
    'l’ouverture n’est plus portée par l’ID');
});

test('le conflit existe toujours dans la feuille partagée — la garde a une raison', () => {
  // ⚠️ Si quelqu'un retire un jour le `.modal` global, cette garde n'aura plus
  // d'objet — et il faut qu'on le sache, plutôt que de garder un correctif
  // dont personne ne comprend la cause.
  const v2 = readFileSync(V2, 'utf8');
  assert.match(v2, /\n\.modal\s*\{/,
    '`.modal` global a disparu de components-v2.css : relire le correctif de #modal, sa raison a changé');
});
