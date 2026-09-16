// =====================================================================
// tests/fuseau-des-essais.test.mjs — l'essai faisait la faute que le
// module existe pour supprimer
// =====================================================================
// ⚠️ TROUVE EN PASSANT LES PORTES LE 16/09/2026 A 01 h 10 (Alger).
//
// `tests/e2e/parcours-4-fixture-sale.spec.js` datait sa fixture avec :
//
//     const AUJ = new Date().toISOString().split('T')[0];   // le jour UTC
//
// La page, elle, demande `window.tabibiTemps.aujourdhui()` — le jour du
// **cabinet** (Africa/Algiers, UTC+1). Entre 23 h et minuit UTC, les deux
// rendent des jours differents. La fixture se posait donc la VEILLE, et
// `renderToday()` affichait « Aucun RDV aujourd'hui ». Mesure du soir :
// UTC `2026-09-15`, cabinet `2026-09-16`.
//
// **L'essai avait tort, pas le produit.** Et il n'avait tort qu'une heure par
// nuit : vingt-trois heures sur vingt-quatre, il etait vert.
//
// ---------------------------------------------------------------------
// POURQUOI CETTE GARDE, ET PAS UN ELARGISSEMENT DE `verifier:fuseau`
// ---------------------------------------------------------------------
// `scripts/verifier-fuseau.mjs` ignore `tests/` — volontairement : il traque
// trois signatures, et deux d'entre elles sont legitimes dans une fixture.
// Celle-ci n'en traque qu'UNE, la seule qui produise un decalage d'un jour :
// **un `toISOString()` dont on ne garde que la date.**
//
// C'est le remplacement que `js/tabibi-temps.js` documente dans sa propre
// docstring — « Remplace `new Date().toISOString().split('T')[0]`, qui rendait
// le jour UTC ». Un essai qui le refait mesure autre chose que ce que la page
// calcule, et **une porte qui pleure sur du code juste finit desactivee.**
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Un `toISOString()` dont on ne retient que les dix premiers caracteres. */
const JOUR_UTC = /toISOString\(\)\s*\.\s*(?:split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]|slice\(\s*0\s*,\s*10\s*\)|substring\(\s*0\s*,\s*10\s*\)|substr\(\s*0\s*,\s*10\s*\))/;

function specs(dir = 'tests', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) specs(p, acc);
    else if (/\.(spec|test)\.(js|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ⚠️ CE FICHIER-CI EST EXEMPTE, ET C'EST DELIBERE.
//
// La contre-epreuve du bas fabrique EXPRES un jour UTC pour montrer que les
// deux calendriers divergent. Sans exemption, cette garde **s'accuse
// elle-meme** — elle l'a fait au premier passage, et c'est la **septieme** fois
// qu'une garde de ce depot se fait avoir par son propre contenu.
//
// L'exemption est nominative : un seul fichier, ecrit en toutes lettres. Une
// regle large (« ignorer les fichiers qui parlent de fuseau ») aurait rouvert
// le trou pour tous les autres.
const SOI = 'tests/fuseau-des-essais.test.mjs';

test('aucun essai ne fabrique un JOUR avec `toISOString()`', () => {
  const fautes = [];
  for (const f of specs()) {
    if (f === SOI) continue;
    // ⚠️ On lit le CODE, pas ce qu'on a ecrit a son sujet : le commentaire qui
    // explique ce defaut contient le motif exact. Une garde qui lit ses propres
    // commentaires s'accuse elle-meme — **sept fois** dans ce depot, dont une
    // fois ici meme, au premier passage : d'ou l'exemption ci-dessus.
    const src = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    for (const m of src.matchAll(new RegExp(JOUR_UTC.source, 'g'))) {
      fautes.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(fautes, [],
    'jour UTC fabrique dans un essai — utiliser le fuseau du cabinet '
    + "(Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' })) :\n  "
    + fautes.join('\n  '));
});

test('la contre-epreuve : les deux jours DIVERGENT vraiment, une heure par nuit', () => {
  // Sans ceci, l'essai du dessus serait une regle de style. Il faut montrer que
  // le decalage EXISTE, sinon personne ne saura pourquoi la regle est la.
  const jour = (d, tz) => (tz
    ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    : d.toISOString().split('T')[0]);

  // 23 h 10 UTC : minuit dix a Alger, le LENDEMAIN.
  const nuit = new Date('2026-09-15T23:10:00Z');
  assert.equal(jour(nuit), '2026-09-15', 'jour UTC');
  assert.equal(jour(nuit, 'Africa/Algiers'), '2026-09-16', 'jour du cabinet');
  assert.notEqual(jour(nuit), jour(nuit, 'Africa/Algiers'),
    'sans divergence, il n y aurait rien a garder');

  // Et en pleine journee, ils sont d'accord : c'est pour ca que le defaut a
  // survecu. Une porte verte a 14 h ne dit rien de ce qu'elle vaut a 00 h 10.
  const midi = new Date('2026-09-15T12:00:00Z');
  assert.equal(jour(midi), jour(midi, 'Africa/Algiers'));
});
