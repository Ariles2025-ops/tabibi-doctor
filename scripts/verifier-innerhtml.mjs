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
// [15/09/2026 — v2] LA QUESTION EST RETOURNEE.
//
// La v1 cherchait ce qui AVAIT L'AIR dangereux dans l'expression : un `${…}`,
// un `+ variable`. Elle ne voyait donc rien quand l'expression est une simple
// variable — et c'est le cas le plus frequent :
//
//     let html = '';
//     data.forEach(k => { html += `<td>${k.partner_name}</td>`; });
//     wrap.innerHTML = html;        // <- aucun ${…}, aucun `+` : INVISIBLE
//
// Cas reel, `admin-api-keys.html` : du HTML assemble depuis la base, pose en
// une affectation que la porte declarait sure. **Le trou n'etait pas dans le
// code surveille, il etait dans la surveillance.**
//
// La v2 exige l'inverse : CHAQUE valeur ecrite doit etre PROUVABLEMENT sure —
// un litteral, un gabarit dont toutes les interpolations sont sures, un appel
// d'echappeur, un libelle de dictionnaire, un nombre. Tout le reste est
// compte, y compris une variable dont on ne sait rien.
//
// ⚠️ LE CHIFFRE DE LA v2 NE SE COMPARE PAS A CELUI DE LA v1. 12 -> 135 ne dit
// pas que le code a empire : il dit que la mesure voit 125 endroits de plus.
// Douze etait un plancher de ce qu'on savait voir ; on le disait deja.
//
// Compter une valeur opaque n'est pas l'accuser. C'est refuser de la declarer
// sure sans preuve — ce qui est tout le contrat de ce depot.
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

/**
 * Les OPERANDES de premier niveau d'une concatenation.
 *
 * [15/09/2026 — COMPTEUR v2] LE TROU QUE CE DECOUPAGE FERME.
 *
 * La v1 cherchait des `${…}` et des `+ quelqueChose` DANS l'expression. Elle
 * ne voyait donc rien du tout quand l'expression est une simple variable :
 *
 *     let html = '';
 *     data.forEach(k => { html += `<td>${k.partner_name}</td>`; });
 *     wrap.innerHTML = html;          // <- aucun ${…}, aucun `+` : INVISIBLE
 *
 * C'est le cas reel de `admin-api-keys.html` : du HTML assemble a partir de la
 * base, pose en une affectation que la porte comptait comme sure. **Le trou
 * n'etait pas dans le code surveille, il etait dans la surveillance.**
 *
 * La v2 renverse la question. Au lieu de chercher ce qui a l'air dangereux
 * dans l'expression, elle exige que CHAQUE operande soit sur : un litteral,
 * un gabarit dont toutes les interpolations sont sures, un appel d'echappeur,
 * un libelle de dictionnaire. Tout le reste — une variable, un appel
 * quelconque, une propriete — est compte.
 *
 * Plus severe, et c'est le but : un compteur qui ne voit pas une variable
 * rassure sur ce qu'il ignore.
 */
function operandes(expr) {
  const sq = squelette(expr);
  const bouts = [];
  let prof = 0, debut = 0, quote = null;
  for (let i = 0; i < sq.length; i++) {
    const c = sq[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { prof++; continue; }
    if (c === ')' || c === ']' || c === '}') { prof--; continue; }
    // Un `+` de premier niveau, et pas un `++` ni un `+=`.
    if (prof === 0 && c === '+' && sq[i - 1] !== '+' && sq[i + 1] !== '+' && sq[i + 1] !== '=') {
      bouts.push(sq.slice(debut, i));
      debut = i + 1;
    }
  }
  bouts.push(sq.slice(debut));
  return bouts.map((b) => b.trim()).filter(Boolean);
}

/** Les interpolations `${…}` d'un gabarit. */
function interpolations(sq) {
  const out = [];
  for (const m of sq.matchAll(/\$\{([\s\S]*?)\}/g)) out.push(m[1]);
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
  // ⚠️ ANCRE AU DEBUT. Avant, `ECHAPPEUR.test()` cherchait n'importe ou : il
  // suffisait qu'un `esc(` apparaisse QUELQUE PART dans l'expression pour que
  // le tout soit declare sur. `rows.map(r => esc(r.n)).concat(brut)` passait.
  // Ce qui compte est ce que rend l'expression, donc l'appel du DESSUS.
  // Le prefixe d'objet est admis : `M.esc(…)`, `window.tabibiSec.escapeHtml(…)`.
  // Releve, pas devine — `conversation.html` echappe CHAQUE message par
  // `M.esc()`, et sans ce prefixe la page des messages entiers passait pour
  // non protegee.
  if (new RegExp('^\\s*([A-Za-z_$][\\w$]*\\.)*' + ECHAPPEUR.source.replace(/^\\b/, '')).test(t)) return true;
  if (LIBELLE.test(t)) return true;
  // Un litteral — mais un gabarit qui porte une `${…}` n'en est pas un. La
  // classe de caracteres de LITTERAL accepte `$`, `{` et `}` : sans cette
  // garde, `` `<b>${row.nom}</b>` `` passait pour une constante.
  if (/^['"`]/.test(t) && LITTERAL.test(t) && !/\$\{/.test(t)) return true;
  if (/^[0-9\s'"`+.*/-]+$/.test(t)) return true;           // nombre / litteral simple
  return false;
}

/** Le fragment construit-il du HTML sur place (chaine ou gabarit ecrit dedans) ? */
function contientLitteral(t) {
  return /['"`]/.test(squelette(t));
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
  if (profondeur >= 6) return false;
  const suivant = (x) => valeurSure(x.trim(), profondeur + 1);
  // Des parentheses qui enveloppent TOUT : on les retire, sinon le ternaire
  // qu'elles contiennent n'est plus vu au premier niveau. C'est ce qui faisait
  // passer `${a ? (b ? row.x : 'y') : 'z'}` — attrape par la contre-epreuve.
  if (t.startsWith('(') && enveloppeTout(t)) return suivant(t.slice(1, -1));
  // Un gabarit : sur si CHACUNE de ses interpolations l'est.
  if (t.startsWith('`')) return interpolations(t).every(suivant);
  // Une concatenation, entre parentheses ou non.
  const ops = operandes(t);
  if (ops.length > 1) return ops.every(suivant);
  // Un ternaire : sur si CHAQUE branche l'est (la condition ne va pas au DOM).
  const br = branches(t);
  if (br && br.length) return br.every(suivant);
  // ---------------------------------------------------------------------
  // LE POINT DE LA v2.
  //
  // Reste une expression d'un seul tenant : `html`, `rows`, `sk.repeat(2)`,
  // `list.map(r => `<li>${esc(r.n)}</li>`).join('')`.
  //
  // - Si elle CONSTRUIT du HTML sur place (une chaine ou un gabarit est ecrit
  //   dedans), on peut la juger : ses interpolations doivent etre sures.
  // - Si elle n'en construit aucun, elle est OPAQUE : son contenu a ete
  //   assemble ailleurs, et rien ici ne dit quoi. **C'est exactement le trou
  //   de la v1**, qui declarait `wrap.innerHTML = html` inoffensif.
  //
  // Une valeur opaque est comptee. Pas parce qu'elle est dangereuse : parce
  // qu'on ne sait pas.
  // ---------------------------------------------------------------------
  // ⚠️ `interpolations(t)` peut etre VIDE, et `[].every(...)` vaut `true`.
  // On exige donc qu'il y en ait au moins une : « aucune interpolation » ne
  // veut pas dire « toutes sures », ca veut dire qu'on n'a rien juge.
  const interp = interpolations(squelette(t));
  if (contientLitteral(t) && interp.length) return interp.every(suivant);
  return false;
}

/** Les parentheses ouvrantes en tete enveloppent-elles toute l'expression ? */
function enveloppeTout(t) {
  let prof = 0, quote = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(') prof++;
    else if (c === ')') { prof--; if (prof === 0) return i === t.length - 1; }
  }
  return false;
}

function fragmentsDangereux(expr) {
  const mauvais = [];
  for (const d of operandes(expr)) {
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
    mesure: 'v2',
    note: 'Nombre d\'innerHTML dont la valeur n\'est pas PROUVABLEMENT sure. Ne doit que '
        + 'BAISSER. Regenere par : node scripts/verifier-innerhtml.mjs --ecrire',
    attention: 'v2 ne se compare PAS a v1. La v1 (plafond 12) ne regardait que les '
        + 'gabarits et les concatenations ecrits sur place ; elle ne voyait pas '
        + '`el.innerHTML = html`, ou `html` est assemble ailleurs. La v2 compte aussi '
        + 'ces valeurs OPAQUES. Le chiffre monte parce que la mesure voit plus loin, '
        + 'pas parce que le code a empire.',
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
