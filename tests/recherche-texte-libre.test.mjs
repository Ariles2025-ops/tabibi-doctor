// =====================================================================
// tests/recherche-texte-libre.test.mjs — la barre de recherche cherchait plus
// =====================================================================
// ⚠️ SIX JOURS. Depuis le durcissement C1 (`b878ff8`, 09/09), taper
// « cardiologue » dans la barre SANS choisir de menu affichait « Choisissez une
// wilaya ou une spécialité » et **n'appelait même pas le serveur**.
//
// Le garde-fou disait : `if(!opts.ville && !opts.spec) { … return; }`. Il avait
// raison le 09/09 — la RPC refusait alors une recherche sans filtre. Il a eu
// tort dès que la RPC a accepté `p_q` seul. **Une garde correcte devient fausse
// quand ce qu'elle protège change, et rien ne le lui dit.**
//
// ---------------------------------------------------------------------
// COMMENT CE FICHIER ESSAIE DU CODE DE NAVIGATEUR
// ---------------------------------------------------------------------
// `js/home-app.js` touche `window` et `document` à son chargement : on ne peut
// pas l'importer sous Node. On en EXTRAIT donc les deux fonctions pures, par
// leur déclaration, et on les évalue telles quelles.
//
// C'est bien le code du produit qui est essayé — pas une copie. Si quelqu'un
// renomme ou supprime ces fonctions, l'extraction échoue et le test le dit,
// au lieu d'essayer un fantôme.
//
// Le comportement de bout en bout (la page, la RPC appelée, l'écran qui ne
// s'affiche plus) est prouvé par `tests/e2e/recherche-texte-libre.spec.js`.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('js/home-app.js', 'utf8');

/** Extrait le texte d'une fonction déclarée, accolades comptées. */
function fonction(nom) {
  const debut = SRC.indexOf(`function ${nom}(`);
  assert.ok(debut > -1, `${nom} n'existe plus dans js/home-app.js`);
  let i = SRC.indexOf('{', debut);
  let profondeur = 0;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') profondeur++;
    else if (SRC[i] === '}') { profondeur--; if (profondeur === 0) break; }
  }
  return SRC.slice(debut, i + 1);
}

const analyser = new Function(
  `${fonction('_normaliserRecherche')}\n${fonction('_analyserTexteLibre')}\nreturn _analyserTexteLibre;`,
)();

const WILAYAS = ['Alger', 'Béjaïa', 'Oran', 'Constantine', 'Bordj Bou Arreridj', 'Tizi Ouzou'];
const SPECS = ['Cardiologue', 'Pédiatre', 'Médecin généraliste', 'Dentiste', 'ORL'];

// ─────────────────────────────────────────────────────────────────────
// 1. LE CAS QUI A ETE SIGNALE
// ─────────────────────────────────────────────────────────────────────
test('« cardiologue béjaïa » pose la spécialité ET la wilaya, valeurs de la base', () => {
  const r = analyser('cardiologue béjaïa', WILAYAS, SPECS);
  assert.equal(r.spec, 'Cardiologue');
  assert.equal(r.wilaya, 'Béjaïa');
  assert.equal(r.reste, null, 'rien ne doit rester en texte libre : les deux jetons sont reconnus');
});

test('SANS ACCENT aussi — c\'est tout l\'intérêt de la normalisation', () => {
  // « bejaia » tapé au clavier ne porte aucun accent. Sans normalisation, il
  // ne correspondait à rien et la wilaya était perdue.
  const r = analyser('cardiologue bejaia', WILAYAS, SPECS);
  assert.equal(r.spec, 'Cardiologue');
  assert.equal(r.wilaya, 'Béjaïa', 'la valeur rendue est celle de la BASE, accents compris');
});

test('un terme seul reste un terme seul', () => {
  const r = analyser('cardiologue', WILAYAS, SPECS);
  assert.equal(r.spec, 'Cardiologue');
  assert.equal(r.wilaya, null);
  assert.equal(r.reste, null);
});

// ─────────────────────────────────────────────────────────────────────
// 2. ⚠️ CE QU'ELLE NE DOIT SURTOUT PAS DEVINER
// ─────────────────────────────────────────────────────────────────────
test('un nom de médecin n\'est pas une spécialité', () => {
  // Le vrai risque de cette fonction : transformer « Benali » en filtre et
  // rendre 1 500 fiches au lieu d\'une. La correspondance est EXACTE, pas par
  // préfixe.
  for (const nom of ['benali', 'cardin', 'orlane', 'pediatre-benali']) {
    const r = analyser(nom, WILAYAS, SPECS);
    assert.equal(r.spec, null, `« ${nom} » a été pris pour une spécialité`);
    assert.equal(r.wilaya, null, `« ${nom} » a été pris pour une wilaya`);
    assert.ok(r.reste, `« ${nom} » doit repartir en texte libre`);
  }
});

test('ce qui n\'est pas reconnu repart EN TEXTE LIBRE, jamais jeté', () => {
  const r = analyser('cardiologue benali', WILAYAS, SPECS);
  assert.equal(r.spec, 'Cardiologue');
  assert.equal(r.reste, 'benali', 'le nom doit continuer de chercher');
});

test('les valeurs à plusieurs mots sont reconnues entières', () => {
  // Sans ça, « bordj » seul ne correspond à rien et la wilaya est perdue.
  const r = analyser('pédiatre bordj bou arreridj', WILAYAS, SPECS);
  assert.equal(r.wilaya, 'Bordj Bou Arreridj');
  assert.equal(r.spec, 'Pédiatre');
  assert.equal(r.reste, null);
  const r2 = analyser('medecin generaliste alger', WILAYAS, SPECS);
  assert.equal(r2.spec, 'Médecin généraliste');
  assert.equal(r2.wilaya, 'Alger');
});

test('sans listes chargées, rien n\'est deviné — et rien n\'est perdu', () => {
  // `_DB_WILAYAS` / `_DB_SPECIALTIES` sont nulles tant que le premier appel
  // n'a pas répondu. Le texte doit alors partir tel quel.
  const r = analyser('cardiologue bejaia', null, null);
  assert.equal(r.spec, null);
  assert.equal(r.wilaya, null);
  assert.equal(r.reste, 'cardiologue bejaia');
});

test('une entrée vide ne fabrique pas de filtre', () => {
  for (const vide of ['', '   ', null, undefined, '  ...  ']) {
    const r = analyser(vide, WILAYAS, SPECS);
    assert.equal(r.spec, null);
    assert.equal(r.wilaya, null);
    assert.equal(r.reste, null);
  }
});

// ─────────────────────────────────────────────────────────────────────
// 3. LE GARDE-FOU, LA OU IL EST ECRIT
// ─────────────────────────────────────────────────────────────────────
test('le court-circuit laisse passer le texte libre', () => {
  // La ligne exacte qui a fait taire la recherche pendant six jours.
  assert.match(SRC, /if\(!opts\.ville && !opts\.spec && !opts\.search\)\{ _renderChooseFilter\(\); return; \}/,
    "sans `!opts.search`, un terme seul n'atteint jamais le serveur");
});

test('un menu choisi PRIME sur le texte : on ne devine pas contre l\'utilisateur', () => {
  const i = SRC.indexOf('function _buildDoctorCardsArgs');
  const corps = SRC.slice(i, i + 1200);
  assert.match(corps, /if\(!wilaya && !spec && q\)/,
    "l'analyse ne doit tourner QUE si aucun menu n'est rempli");
});

test('la RPC reçoit bien les trois paramètres, et rien de plus', () => {
  const i = SRC.indexOf('function _buildDoctorCardsArgs');
  const corps = SRC.slice(i, i + 1200);
  for (const champ of ['p_wilaya:', 'p_specialite:', 'p_q:', 'p_page:', 'p_limite:']) {
    assert.ok(corps.includes(champ), `${champ} a disparu des arguments`);
  }
});
