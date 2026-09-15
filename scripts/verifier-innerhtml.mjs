#!/usr/bin/env node
// =====================================================================
// verifier-innerhtml.mjs — le compteur d'`innerHTML` ne doit que BAISSER
// =====================================================================
// NE LE 15/09/2026. Le depot porte ~363 `innerHTML`. Les reecrire tous d'un
// coup produirait un diff que personne ne relit — la faute du `git add -A`, a
// l'echelle d'un audit de securite. Et la plupart sont inoffensifs.
//
// ---------------------------------------------------------------------
// CE QUE CETTE PORTE COMPTE, ET CE QU'ELLE NE COMPTE PAS
// ---------------------------------------------------------------------
// Elle ne compte pas les `innerHTML`. Elle compte **ceux qui recoivent une
// donnee non constante** — une reponse de la base, une saisie, un parametre
// d'URL. Un gabarit 100 % litteral ne peut rien injecter : le compter
// gonflerait le chiffre et noierait les vrais.
//
// Un site est donc classe DANGEREUX quand son expression contient une
// interpolation ou une concatenation dont l'operande n'est ni un litteral, ni
// un appel a un echappeur connu (`esc`, `hEsc`, `escapeHtml`, `sanitize`), ni
// un libelle de dictionnaire (`T(...)`, `t(...)`).
//
// ⚠️ CE N'EST PAS UNE PREUVE D'INNOCUITE. Un echappeur mal utilise reste un
// trou ; une variable qui ne contient qu'une constante est comptee a tort.
// **C'est un compteur, pas un analyseur.** Sa seule promesse : le nombre ne
// remonte pas sans que quelqu'un s'en aperçoive.
//
// ---------------------------------------------------------------------
// POURQUOI UN PLAFOND ET PAS ZERO
// ---------------------------------------------------------------------
// Meme raison que `lint:dette`, et elle est ecrite noir sur blanc dans
// `eslint.config.mjs` : une porte rouge en permanence sur 200 points existants
// s'ignore au bout de deux jours. Le contrat est que **le compteur ne monte
// jamais**. Chaque lot qui en retire abaisse le plafond ; la porte le reclame.
//
// Usage : node scripts/verifier-innerhtml.mjs [--ecrire]
// =====================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;
const JAUNE = (s) => `\x1b[33m${s}\x1b[0m`;

const PLAFOND = 'scripts/innerhtml-plafond.json';

// Un appel qui rend du texte deja sur.
// Les echappeurs REELLEMENT presents dans ce depot — releves, pas devines :
//     git grep -ohE "function (_?esc\w*|escapeHtml|hEsc|sanitize\w*)\s*\("
// Ils s'appellent `esc`, `_esc`, `escapeHtml`, `hEsc`. Un detecteur qui ignore
// `_esc` classerait 15 sites de `dawini.html` comme dangereux alors qu'ils sont
// echappes — et la porte crierait sur du code correct, donc finirait ignoree.
// Onze noms, releves par :
//   git grep -ohE "(function |const |var |let )_?[eE]sc[a-zA-Z]*\s*[=(]"
// -> esc, _esc, escA, escAttr, escUrl, escapeHtml, _escapeHtml, escapeAttr,
//    _escapeAttr, escapeUrl, escapeJsString, plus hEsc et les sanitize.
// Un detecteur qui en ignore un classe du code CORRECT comme dangereux — et la
// porte crie sur ce qui va bien, donc finit desactivee. C'est arrive deux fois
// en ecrivant cette porte : `_esc` puis `_escapeHtml`.
// [15/09/2026] `_eJs` s'ajoute a la liste — l'echappeur de CHAINE JS pour les
// attributs `onclick="…"`, ou `esc()` ne suffit pas (le parseur HTML decode
// `&#39;` avant que le JS ne soit lu, et la quote revient fermer la chaine).
// `encodeURIComponent` aussi : une valeur passee la ne peut plus porter de
// quote, de chevron ni d'espace.
// `Number` / `parseInt` / `parseFloat` : ce qui en sort est un nombre ou NaN.
// Aucun des deux ne peut porter de balise. Ce n'est pas une tolerance, c'est
// une propriete du langage.
const ECHAPPEUR = /\b(_?esc|_?escA|_?escAttr|_?escUrl|_?eJs|_?escJs|_?escape(?:Html|HTML|Attr|Url|JsString)|hEsc|sanitize\w*|encodeURIComponent|encodeURI|Number|parseInt|parseFloat|tabibiSec\.\w+)\s*\(/;
// Un libelle de dictionnaire : c'est NOUS qui l'ecrivons. Les noms sont
// RELEVES, pas devines :
//   git grep -ohE "(function |const |var |let |window\.)(tabibiT|_?T|_?t|tt|tr)\s*[=(]"
// -> _t (14), T (7+3+1), tabibiT (5), t (5+3).
//
// [15/09/2026] `tabibiT` manquait, et c'est la MEME faute que pour les
// echappeurs : un nom oublie fait compter comme dangereux du code qui ne
// l'est pas. `doctor-dashboard.html` avait quatre gabarits 100 % litteraux
// accuses pour ce seul motif. **Une porte qui crie sur du code correct finit
// desactivee.**
const LIBELLE = /^\s*(tabibiT|_?T|_?t|tt|tr)\s*[(.]/;
// Un litteral pur (chaine, nombre, booleen, operateurs).
const LITTERAL = /^[\s'"`0-9+\-*/.,:;!?()[\]{}<>=&|%#@$_a-zA-Z\\À-ɏ؀-ۿ]*$/;

/** Extrait l'expression affectee a innerHTML, en suivant les backticks multi-lignes. */
function expressionApres(src, i) {
  let profondeurBt = 0;
  let j = i;
  const fin = Math.min(src.length, i + 4000);
  while (j < fin) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') profondeurBt = profondeurBt ? 0 : 1;
    if (!profondeurBt && (c === ';' || c === '\n')) {
      // Une expression peut continuer apres un retour a la ligne si elle se
      // termine par un operateur — on regarde le dernier caractere utile.
      const avant = src.slice(i, j).trimEnd();
      if (c === ';' || !/[+({[,]$/.test(avant)) return src.slice(i, j);
    }
    j++;
  }
  return src.slice(i, fin);
}

/**
 * Retire le CONTENU des chaines, en gardant les `${…}` visibles.
 *
 * [15/09/2026] QUATRIEME ERREUR DE CE COMPTEUR, et la plus bete : il cherchait
 * `+ quelqueChose` dans le TEXTE BRUT de l'expression. Un `+` ecrit dans une
 * phrase francaise etait donc lu comme une concatenation :
 *
 *   wrap.innerHTML = `<div>Aucune cle. Cliquez sur "+ Nouvelle cle".</div>`;
 *                                                   ^^^^^^^^^^^^
 *   -> operande « Nouvelle », donc « donnee non constante », donc dangereux.
 *
 * C'etait un gabarit 100 % litteral. **On ne regarde une expression que la ou
 * il y a une expression** : dans les `${…}` et entre les chaines, jamais
 * dedans. Le squelette rendu ici garde les guillemets et les `${…}`, et
 * remplace tout le reste par des blancs — les positions ne bougent pas.
 *
 * Ecrit avec une PILE, et pas avec un drapeau. Premiere version : un `quote`
 * et un compteur d'interpolations. Elle traitait le contenu d'une `${…}`
 * comme du code brut — y compris les chaines ecrites DEDANS. Resultat, sur
 * `signup.html` :
 *
 *   ${tabibiT('med_pending_verify',"… diplome + Conseil de l'Ordre …")}
 *                                             ^^^^^^^^^^^
 *   -> operande « Conseil ».
 *
 * Le meme defaut, un niveau plus bas. Une chaine dans une interpolation reste
 * une chaine.
 */
function squelette(expr) {
  let out = '';
  let i = 0;
  const pile = [];   // 'q\'' 'q"' 'q`' pour une chaine, 'i' pour une interpolation
  const dansChaine = () => pile.length && pile[pile.length - 1][0] === 'q';
  while (i < expr.length) {
    const c = expr[i];
    if (dansChaine()) {
      const q = pile[pile.length - 1][1];
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (q === '`' && c === '$' && expr[i + 1] === '{') { pile.push('i'); out += '${'; i += 2; continue; }
      if (c === q) { pile.pop(); out += c; i++; continue; }
      out += (c === '\n' ? '\n' : ' ');   // contenu de chaine : efface
      i++; continue;
    }
    // Hors chaine : soit au premier niveau, soit dans une interpolation.
    if (c === '\'' || c === '"' || c === '`') { pile.push('q' + c); out += c; i++; continue; }
    if (c === '}' && pile.length && pile[pile.length - 1] === 'i') { pile.pop(); out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

/** Les morceaux « dynamiques » d'une expression : interpolations et operandes. */
function morceauxDynamiques(expr) {
  const out = [];
  const sq = squelette(expr);
  for (const m of sq.matchAll(/\$\{([\s\S]*?)\}/g)) out.push(m[1]);
  // Concatenations : `... + quelqueChose`. On garde la parenthese ouvrante
  // quand il y en a une : sans elle, `+ _esc(x)` donnait le fragment `_esc`,
  // que le detecteur d'echappeur ne reconnaissait pas — et 15 sites echappes
  // de `dawini.html` etaient comptes comme dangereux.
  for (const m of sq.matchAll(/\+\s*([A-Za-z_$][\w$.\[\]'"]*\s*\(?)/g)) out.push(m[1]);
  return out;
}

/**
 * Rend la LISTE des fragments juges dangereux — pas un booleen.
 *
 * [15/09/2026] Avant, la porte disait « ce site est dangereux » et montrait
 * 90 caracteres d'un gabarit qui en fait 600. On passait plus de temps a
 * chercher QUEL morceau qu'a le corriger. Une porte qui ne dit pas ou
 * regarder se paie a chaque passage.
 */
/** Vrai si CE fragment, pris tel quel, rend du texte deja sur. */
function fragmentSur(t) {
  if (!t) return true;
  if (ECHAPPEUR.test(t)) return true;
  if (LIBELLE.test(t)) return true;
  if (/^['"`]/.test(t) && LITTERAL.test(t)) return true;   // litteral
  if (/^[0-9\s'"`+.*/-]+$/.test(t)) return true;           // nombre / litteral simple
  return false;
}

/**
 * Les VALEURS possibles d'un fragment conditionnel, au premier niveau.
 *
 * [15/09/2026] Ce depot ecrit partout `${r.urgent ? '<span…>' : ''}`. Le
 * fragment complet n'est ni un litteral ni un appel d'echappeur, donc il
 * etait compte dangereux — alors qu'AUCUNE de ses deux valeurs possibles ne
 * l'est. **Une expression vaut ce que valent ses branches.**
 *
 * La CONDITION est ecartee a dessein : `r.urgent` ne va pas dans le DOM, il
 * decide seulement laquelle des deux branches y va. La compter reviendrait a
 * accuser le test au lieu du resultat.
 *
 * Decoupe au premier niveau seulement : parentheses, crochets, accolades,
 * chaines et interpolations sont traverses sans etre coupes.
 */
function branches(t) {
  let prof = 0, quote = null;
  let apresPoint = -1, deuxPoints = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { prof++; continue; }
    if (c === ')' || c === ']' || c === '}') { prof--; continue; }
    if (prof !== 0) continue;
    if (c === '?' && t[i + 1] !== '.' && apresPoint < 0) apresPoint = i;
    else if (c === ':' && apresPoint >= 0 && deuxPoints < 0) deuxPoints = i;
  }
  if (apresPoint >= 0 && deuxPoints > apresPoint) {
    return [t.slice(apresPoint + 1, deuxPoints).trim(), t.slice(deuxPoints + 1).trim()];
  }
  return null;
}

/**
 * Rend la LISTE des fragments juges dangereux — pas un booleen.
 *
 * [15/09/2026] Avant, la porte disait « ce site est dangereux » et montrait
 * 90 caracteres d'un gabarit qui en fait 600. On passait plus de temps a
 * chercher QUEL morceau qu'a le corriger. Une porte qui ne dit pas ou
 * regarder se paie a chaque passage.
 */
/**
 * Sur si le fragment l'est, ou si TOUTES ses branches le sont — recursivement,
 * jusqu'a 3 niveaux (les ternaires imbriques de ce depot n'en font pas plus).
 *
 * ⚠️ Le tableau vide est le piege : `[].every(...)` vaut `true`. Ecrit
 * naivement, « aucune branche » se lisait « toutes les branches sont sures »
 * et `${ok ? row.nom : 'rien'}` passait. La contre-epreuve l'a attrape ; c'est
 * pour ca qu'on en ecrit une AVANT de croire une porte.
 */
function valeurSure(t, profondeur = 0) {
  if (fragmentSur(t)) return true;
  if (profondeur >= 3) return false;
  const br = branches(t);
  if (!br || !br.length) return false;
  return br.every((b) => valeurSure(b, profondeur + 1));
}

function fragmentsDangereux(expr) {
  const mauvais = [];
  for (const d of morceauxDynamiques(expr)) {
    const t = d.trim();
    if (valeurSure(t)) continue;
    mauvais.push(t);
  }
  return mauvais;
}

/**
 * Retire les commentaires AVANT de compter. Sans ca, la porte se lit elle-meme :
 * `js/tabibi-security.js` porte en tete l'exemple de ce qu'il NE faut PAS faire
 * (`el.innerHTML = \`<div>${user.name}</div>\``), et il etait compte comme un
 * defaut. Une porte qui accuse sa propre documentation finit desactivee.
 *
 * Les blancs remplacent les commentaires pour que les numeros de ligne restent
 * justes dans le rapport.
 */
function sansCommentaires(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

const fichiers = execSync(
  'git ls-files "*.html" "*.js" ":!:seo/**" ":!:dist*/**" ":!:assets/vendor/**" ":!:www/**" ":!:tests/**"',
).toString().trim().split('\n').filter(Boolean);

const dangereux = [];
let total = 0;

for (const f of fichiers) {
  let src;
  try { src = sansCommentaires(readFileSync(f, 'utf8')); } catch { continue; }
  const re = /\.innerHTML\s*\+?=\s*/g;
  let m;
  while ((m = re.exec(src))) {
    total++;
    const debut = m.index + m[0].length;
    const expr = expressionApres(src, debut);
    const fragments = fragmentsDangereux(expr);
    if (fragments.length) {
      const ligne = src.slice(0, m.index).split('\n').length;
      dangereux.push({
        f, ligne,
        apercu: expr.replace(/\s+/g, ' ').slice(0, 90),
        fragments: [...new Set(fragments.map((x) => x.replace(/\s+/g, ' ').slice(0, 60)))],
      });
    }
  }
}

if (process.argv.includes('--lister')) {
  // Sert a travailler : ou sont-ils, et que recoivent-ils vraiment.
  const filtre = process.argv[process.argv.indexOf('--lister') + 1];
  for (const d of dangereux) {
    if (filtre && !filtre.startsWith('--') && !d.f.includes(filtre)) continue;
    console.log(`${d.f}:${d.ligne}`);
    for (const fr of d.fragments) console.log(`    -> ${fr}`);
  }
  console.log(`\n${dangereux.length} site(s) au total.`);
  process.exit(0);
}

if (process.argv.includes('--ecrire')) {
  writeFileSync(PLAFOND, JSON.stringify({
    plafond: dangereux.length,
    total_innerhtml: total,
    note: 'Nombre d\'innerHTML recevant une donnee NON constante. Ne doit que BAISSER. '
        + 'Regenere par : node scripts/verifier-innerhtml.mjs --ecrire',
    mis_a_jour: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n');
  console.log(`plafond ecrit : ${dangereux.length} (sur ${total} innerHTML au total)`);
  process.exit(0);
}

let plafond;
try {
  plafond = JSON.parse(readFileSync(PLAFOND, 'utf8')).plafond;
} catch {
  console.error(ROUGE(`${PLAFOND} introuvable. Le creer : node scripts/verifier-innerhtml.mjs --ecrire`));
  process.exit(1);
}

console.log(`Controle innerHTML — ${total} au total, ${dangereux.length} recevant une donnee non constante (plafond ${plafond}).`);

if (dangereux.length > plafond) {
  console.error('');
  for (const d of dangereux.slice(0, 20)) {
    console.error(ROUGE('  + ') + `${d.f}:${d.ligne}  ${d.fragments.join(' · ')}`);
  }
  console.error('');
  console.error(ROUGE(`Le compteur MONTE : ${plafond} -> ${dangereux.length}. `
    + 'Un innerHTML qui recoit une donnee non constante doit passer par textContent, '
    + 'un noeud DOM, ou un echappeur.'));
  process.exit(1);
}

if (dangereux.length < plafond) {
  console.log(JAUNE(`  ! Le compteur a BAISSE (${plafond} -> ${dangereux.length}). `
    + 'Abaisser le plafond : node scripts/verifier-innerhtml.mjs --ecrire'));
}

console.log('');
console.log(VERT('Aucun innerHTML dangereux supplementaire.'));
