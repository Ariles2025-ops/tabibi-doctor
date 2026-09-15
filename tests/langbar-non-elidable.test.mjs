// =====================================================================
// tests/langbar-non-elidable.test.mjs — l'import qui disparaissait au build
// =====================================================================
// P-29. `src/entries/index.js` faisait :
//
//     import '../../js/tabibi-langbar.js';
//
// Un import à **effet de bord seul**. Le module n'exporte rien : Rollup ne
// voyait aucune valeur consommée et **éliminait l'import**. Le morceau était
// bien construit — d'autres pages le chargent par `<script src>` — mais
// l'accueil **construit** ne le chargeait plus. Le placeholder posé par
// l'en-tête n'était jamais rempli : **zéro bouton de langue**.
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER SURVEILLE, ET CE QU'IL NE PEUT PAS
// ---------------------------------------------------------------------
// Il surveille **le mécanisme**, pas le résultat : que le module pose bien un
// effet de bord de premier niveau que le bundler ne peut pas ignorer, et que
// les entrées appellent `init()` explicitement.
//
// Le **résultat** — trois boutons à l'écran, sur les sources ET sur `dist-web`
// — est prouvé par `tests/e2e/selecteur-langue.spec.js`. Il faut les deux : le
// mécanisme peut être là et le rendu cassé ; le rendu peut être bon par
// accident.
//
// ⚠️ Et le fichier doit rester chargeable par un `<script src>` classique :
// **vingt-six pages** le chargent ainsi. C'est pour ça qu'on ne peut PAS y
// écrire `export` — la correction « propre » aurait cassé vingt-six pages pour
// en réparer une.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const LANGBAR = readFileSync('js/tabibi-langbar.js', 'utf8');
const ENTREES = ['src/entries/index.js', 'src/entries/about.js', 'src/entries/cas-grave.js'];

test('le module pose un effet de bord de PREMIER NIVEAU', () => {
  // Mesuré le 15/09 : sans cette ligne, `accueil-public.html` construit charge
  // 3 morceaux et pas le langbar ; avec, il en charge 4.
  assert.match(LANGBAR, /^\s*window\.tabibiLangbar = \{/m,
    "sans affectation sur `window` au premier niveau, l'import se fait eliminer au build");
  assert.match(LANGBAR, /window\.tabibiLangbar = \{ init: init, inject: inject \}/,
    'les entrees construites appellent `init()` : il doit rester expose');
});

test('chaque entree qui importe le langbar l APPELLE aussi', () => {
  for (const f of ENTREES) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /import '\.\.\/\.\.\/js\/tabibi-langbar\.js';/, `${f} : import disparu`);
    assert.match(src, /window\.tabibiLangbar\)\s*window\.tabibiLangbar\.init\(\)/,
      `${f} : l'import seul ne suffit pas — il faut dire l'intention`);
  }
});

test('le fichier reste chargeable par un <script src> classique', () => {
  // ⚠️ Vingt-six pages le chargent ainsi. Un `export` les casserait toutes
  // (« Unexpected token 'export' ») pour reparer les trois pages construites.
  assert.doesNotMatch(LANGBAR, /^\s*export\s/m,
    '`export` rendrait le fichier illisible pour un script classique');
  const pages = execSync('git grep -l \'src="js/tabibi-langbar.js"\' -- "*.html" ":!:dist*" ":!:seo/**" || true')
    .toString().trim().split('\n').filter(Boolean);
  assert.ok(pages.length >= 20,
    `seulement ${pages.length} page(s) le chargent en script classique : le releve a change`);
});

// ─────────────────────────────────────────────────────────────────────
// LE SECOND DEFAUT — plus grave que le premier
// ─────────────────────────────────────────────────────────────────────
test('le switcher flottant n est masque QU APRES un pill pose', () => {
  // `syncLangBtns()` le masquait SANS CONDITION — donc aussi quand aucun pill
  // n'avait pu etre injecte. Sur l'accueil construit, ou le pill ne venait
  // jamais, le resultat etait : **aucun selecteur de langue, nulle part**.
  // Le filet etait retire avant que le trapeze arrive.
  const i = LANGBAR.indexOf('function syncLangBtns');
  const corps = LANGBAR.slice(i, LANGBAR.indexOf('\n  }', i));
  assert.doesNotMatch(corps, /tabibi-lang-switcher/,
    'masquer le flottant depuis syncLangBtns le retire meme quand rien ne le remplace');
  assert.match(LANGBAR, /if \(document\.querySelector\('\[data-langbar-ready\]'\)\) masquerFlottant\(\)/,
    'le flottant ne doit partir qu\'une fois un pill CONSTATE');
});

test('inject() est idempotente et rend le nombre de pills poses', () => {
  const i = LANGBAR.indexOf('function inject');
  const corps = LANGBAR.slice(i, LANGBAR.indexOf('\n  }', i));
  assert.match(corps, /hasAttribute\('data-langbar-ready'\)/,
    'sans garde, une double init poserait deux selecteurs');
  assert.match(corps, /return poses;/,
    "l'appelant doit savoir si le travail a eu lieu — sinon il ne peut rien decider");
});

test('un placeholder qui arrive en retard est rattrape, mais pas indefiniment', () => {
  // Le placeholder est pose par `tabibi-header.js` A L'EXECUTION : `inject()`
  // peut arriver avant lui et ne rien trouver.
  assert.match(LANGBAR, /new MutationObserver/, 'aucun rattrapage : une course d ordre cache le selecteur');
  assert.match(LANGBAR, /obs\.disconnect\(\)/);
  assert.match(LANGBAR, /setTimeout\(function \(\) \{ if \(!fini\)/,
    'une attente sans fin est une fuite, pas un filet');
});
