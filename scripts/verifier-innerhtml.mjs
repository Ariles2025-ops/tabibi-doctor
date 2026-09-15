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
const ECHAPPEUR = /\b(_?esc|_?escA|_?escAttr|_?escUrl|_?escape(?:Html|HTML|Attr|Url|JsString)|hEsc|sanitize\w*|tabibiSec\.\w+)\s*\(/;
// Un libelle de dictionnaire : c'est NOUS qui l'ecrivons. Les noms reellement
// utilises ici sont `T`, `t`, `_t`, `tt`, `tr` — releves, pas devines.
const LIBELLE = /^\s*(_?T|_?t|tt|tr)\s*[(.]/;
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

/** Les morceaux « dynamiques » d'une expression : interpolations et operandes. */
function morceauxDynamiques(expr) {
  const out = [];
  for (const m of expr.matchAll(/\$\{([\s\S]*?)\}/g)) out.push(m[1]);
  // Concatenations : `... + quelqueChose`. On garde la parenthese ouvrante
  // quand il y en a une : sans elle, `+ _esc(x)` donnait le fragment `_esc`,
  // que le detecteur d'echappeur ne reconnaissait pas — et 15 sites echappes
  // de `dawini.html` etaient comptes comme dangereux.
  for (const m of expr.matchAll(/\+\s*([A-Za-z_$][\w$.\[\]'"]*\s*\(?)/g)) out.push(m[1]);
  return out;
}

function estDangereux(expr) {
  for (const d of morceauxDynamiques(expr)) {
    const t = d.trim();
    if (!t) continue;
    if (ECHAPPEUR.test(t)) continue;
    if (LIBELLE.test(t)) continue;
    if (/^['"`]/.test(t) && LITTERAL.test(t)) continue;   // litteral
    if (/^[0-9\s'"`+.*/-]+$/.test(t)) continue;           // nombre / litteral simple
    return true;
  }
  return false;
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
    if (estDangereux(expr)) {
      const ligne = src.slice(0, m.index).split('\n').length;
      dangereux.push({ f, ligne, apercu: expr.replace(/\s+/g, ' ').slice(0, 90) });
    }
  }
}

if (process.argv.includes('--lister')) {
  // Sert a travailler : ou sont-ils, et que recoivent-ils vraiment.
  const filtre = process.argv[process.argv.indexOf('--lister') + 1];
  for (const d of dangereux) {
    if (filtre && !filtre.startsWith('--') && !d.f.includes(filtre)) continue;
    console.log(`${d.f}:${d.ligne}\n    ${d.apercu}`);
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
  for (const d of dangereux.slice(0, 20)) console.error(ROUGE('  + ') + `${d.f}:${d.ligne}  ${d.apercu}`);
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
