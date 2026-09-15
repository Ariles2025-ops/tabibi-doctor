// =====================================================================
// tests/robustesse-front.test.mjs — deux façons de figer une page sans bruit
// =====================================================================
// 1. `getElementById('x').textContent = …` quand `#x` n'existe pas encore.
//    Ce n'est pas un avertissement, c'est une exception : « Cannot read
//    properties of null ». **Tout le script s'arrête à cette ligne**, et les
//    branchements déclarés plus bas ne sont jamais faits. La page reste à
//    moitié vivante, sans message.
//
// 2. Un formulaire qu'on peut soumettre deux fois — deux écritures, deux
//    e-mails, deux rendez-vous.
//
// Les deux sont invisibles en relecture et évidents au premier clic.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PAGES = execSync('git ls-files "*.html" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:tests/**" ":!:node_modules/**"')
  .toString().trim().split('\n').filter(Boolean);

function sansCommentaires(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1 ');
}

/** Les scripts écrits DANS la page — les seuls dont on connaisse le DOM. */
function inlineDe(html) {
  let out = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) out += '\n' + m[1];
  return sansCommentaires(out);
}

// ─────────────────────────────────────────────────────────────────────
// 1. LES DEREFERENCEMENTS SANS FILET
// ─────────────────────────────────────────────────────────────────────
test('aucun getElementById(...) dereference directement sur un id absent de la page', () => {
  // ⚠️ DEUX RESTRICTIONS, et elles viennent d'une premiere version qui rendait
  // 52 alertes dont ~45 fausses :
  //   - scripts INLINE seulement (les fichiers partagés de `js/` cherchent
  //     légitimement des ids qui n'existent que sur d'autres pages) ;
  //   - déréférencement DIRECT seulement. `const el = …; if (el)` est une
  //     précaution, pas un défaut — c'est même la forme qu'on veut encourager.
  const fautes = [];
  for (const page of PAGES) {
    const brut = readFileSync(page, 'utf8');
    const html = sansCommentaires(brut);
    const inline = inlineDe(brut);
    const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
    for (const m of inline.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*(\w+)/g)) {
      const cible = m[1];
      if (ids.has(cible)) continue;
      if (/[-_]$/.test(cible)) continue;                       // `'tab-' + nom` : pas un id
      if (new RegExp(`\\bid\\s*=\\s*['"\`]${cible}['"\`]`).test(inline)) continue;  // cree par le script
      fautes.push(`${page}:${inline.slice(0, m.index).split('\n').length} #${cible}.${m[2]}`);
    }
  }
  assert.deepEqual(fautes, [],
    `dereferencement(s) sans filet — la page se fige a cette ligne :\n  ${fautes.join('\n  ')}`);
});

// ─────────────────────────────────────────────────────────────────────
// 2. LA DOUBLE SOUMISSION
// ─────────────────────────────────────────────────────────────────────
//
// ⚠️ MESURE AVANT CORRECTIF, et elle a change la conclusion.
//
// L'audit 360 signalait « 7 fichiers posent un submit, 23 desactivent un
// bouton, les deux ensembles ne se recouvrent pas — donc des formulaires sont
// soumettables deux fois ». Verification fichier par fichier : **six des sept
// desactivent bien leur bouton dans le gestionnaire**. Le septieme,
// `cas-grave.html`, n'ecrit RIEN : il ouvre un lien WhatsApp. Le soumettre
// deux fois ouvre deux onglets.
//
// **Il n'y avait pas de defaut.** Le signal etait une correlation lue trop
// vite. On garde quand meme la mesure, en porte : ce qui manquait n'etait pas
// le correctif, c'etait la surveillance.
const SANS_ECRITURE = new Map([
  ['cas-grave.html', "n'ecrit rien : ouvre un lien WhatsApp. Deux clics = deux onglets."],
]);

test('tout formulaire qui ECRIT desactive son bouton pendant la soumission', () => {
  const nus = [];
  for (const page of PAGES) {
    const inline = inlineDe(readFileSync(page, 'utf8'));
    const i = inline.search(/addEventListener\(\s*['"]submit['"]/);
    if (i === -1) continue;
    // La desactivation peut etre dans le gestionnaire pose plus loin (les
    // pages nomment souvent une fonction). On regarde donc TOUT le script
    // inline de la page : s'il ne contient aucun `disabled`, il n'y en a pas.
    if (/\.disabled\s*=\s*true/.test(inline)) continue;
    if (SANS_ECRITURE.has(page)) continue;
    nus.push(page);
  }
  assert.deepEqual(nus, [],
    `formulaire(s) soumettable(s) deux fois :\n  ${nus.join('\n  ')}\n`
    + '  Desactiver le bouton pendant la soumission, ou inscrire la page dans '
    + 'SANS_ECRITURE en disant POURQUOI elle n\'ecrit rien.');
});

test('la liste des pages sans ecriture ne se remplit pas toute seule', () => {
  // Une liste d'exceptions qui grossit est une garde qui s'eteint. Chaque
  // entree doit exister et porter sa raison.
  for (const [page, raison] of SANS_ECRITURE) {
    assert.ok(PAGES.includes(page), `${page} n'existe plus : retirer l'exception`);
    assert.ok(raison.length > 20, `${page} : la raison doit etre une phrase, pas un mot`);
  }
  assert.ok(SANS_ECRITURE.size <= 2,
    'plus de deux exceptions : ce n\'est plus une exception, c\'est une habitude');
});
