// =====================================================================
// tests/apikey-rotation-source.test.mjs — la garde ne peut pas disparaître
// =====================================================================
// Le défaut de P-108 tenait en une ligne : `${row.new_secret}` lu sans avoir
// vérifié qu'une ligne existe. Il peut revenir dans une fonction qu'aucun
// essai ne déclenche.
//
// ⚠️ POURQUOI ICI, ET PAS DANS L'ESSAI e2e. Cet essai-là lit le fichier SERVI.
// Sur `dist-web`, Vite minifie le script en ligne : `if (!secret)` devient
// `if(!o)`, et l'assertion sortait ROUGE sur un code parfaitement correct —
// famille de P-29 (sources vertes, build faux), dans l'autre sens.
//
// **Une assertion sur la FORME du source appartient à un essai qui lit le
// dépôt.** Le comportement, lui, reste gardé sur les deux cibles par
// `tests/e2e/apikey-rotation.spec.js`.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FICHIER = join(process.cwd(), 'admin-api-keys.html');

/** Sans commentaires : la garde ne se rassure pas sur sa propre documentation. */
function nu(src) {
  return src
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

test('le secret n’est plus affiché sans avoir été vérifié', () => {
  const src = nu(readFileSync(FICHIER, 'utf8'));
  assert.doesNotMatch(src, /\$\{row\.new_secret\}/,
    'le secret est de nouveau lu sans garde — « Nouvelle clé : undefined » peut revenir');
  assert.match(src, /if\s*\(\s*!secret\s*\)/,
    'la vérification de présence du secret a disparu');
});

test('on ne teste PAS `data.error` — ce retour n’en a pas', () => {
  // ⚠️ `rotate_api_key` rend une TABLE, sans enveloppe métier. Tester
  // `data.error` ajouterait du code mort qui a l'air d'une garde : c'est la
  // faute relevée par l'audit du 17/09 sur trois lots de la file nuit.
  const src = nu(readFileSync(FICHIER, 'utf8'));
  const rotation = src.slice(src.indexOf('rotate_api_key'));
  assert.doesNotMatch(rotation.slice(0, 1500), /data\.error/,
    'une garde teste `data.error` sur un retour qui n’en a pas');
});
