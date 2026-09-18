// =====================================================================
// tests/porte-jumelle-source.test.mjs — la porte existe en DEUX exemplaires
// =====================================================================
// `index.html` à la racine et `porte/porte-fermee.html` doivent être le MÊME
// fichier, à l'octet près. `scripts/verifier-porte.mjs` compare leurs
// empreintes SHA-256 et sort en 1 à la moindre différence : c'est ce qui rend
// la porte fermée **l'état du dépôt** plutôt que le geste d'un déploiement
// (voir l'en-tête de ce script, et P-82).
//
// ⚠️ POURQUOI UN ESSAI DE PLUS, PUISQUE `verifier:porte` LE FAIT DÉJÀ ?
// Parce que `verifier:porte` **n'est pas dans `npm run verifier:toutes`**
// (relevé le 18/09 : la liste `PORTES` de `scripts/verifier-toutes.mjs` ne la
// contient pas). Un lot qui touche la page fermée peut donc être vert de bout
// en bout et faire diverger les jumelles sans que rien ne le dise.
//
// ⚠️ ET POURQUOI PAS DANS L'ESSAI e2e ? Parce qu'il lirait les fichiers
// SERVIS. Sur `dist-web`, Vite traite `index.html` comme un point d'entrée et
// n'émet pas `porte/porte-fermee.html` : la comparaison sortait rouge sur un
// dépôt sain. **Une assertion sur deux fichiers du dépôt appartient à un essai
// qui lit le dépôt** — leçon de P-108.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const RACINE = join(process.cwd(), 'index.html');
const FERMEE = join(process.cwd(), 'porte', 'porte-fermee.html');

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

test('index.html et porte/porte-fermee.html sont le même fichier', () => {
  assert.equal(sha(RACINE), sha(FERMEE),
    'les deux copies de la porte ont divergé : toute modification se fait DANS LES DEUX');
});

test('la porte fermée embarque le monitoring, dans le bon ordre', () => {
  // Sans commentaires : une garde qui lit sa propre documentation s'accuse
  // elle-même — c'est arrivé dans ce lot même, sur `accueil-public.html`.
  const nu = readFileSync(RACINE, 'utf8').replace(/<!--[\s\S]*?-->/g, ' ');
  const iConfig = nu.indexOf('js/config.js');
  const iSentry = nu.indexOf('js/tabibi-sentry.js');
  assert.ok(iConfig > -1, 'js/config.js a disparu de la porte fermée');
  assert.ok(iSentry > -1, 'le monitoring a disparu de la porte fermée');
  assert.ok(iConfig < iSentry,
    'tabibi-sentry.js vient avant config.js : il lirait un DSN absent et s’éteindrait en silence');
});

test('la porte fermée reste une page FERMÉE', () => {
  // ⚠️ LA CONTRE-ÉPREUVE QUI COMPTE. Ajouter des scripts à la page fermée ne
  // doit pas y faire entrer l'application : elle reste un écran d'attente.
  const html = readFileSync(RACINE, 'utf8');
  assert.ok(/Arrive bient[oô]t/i.test(html), 'la page fermée ne dit plus qu’elle est fermée');
  assert.ok(!/supabase-js-|src\/entries\/|home-app\.js/.test(html),
    'l’application est entrée dans la porte fermée');
});
