#!/usr/bin/env node
// =====================================================================
// verifier-fuseau.mjs — l'heure d'un rendez-vous se lit dans le fuseau
//                       du CABINET, jamais dans celui du navigateur
// =====================================================================
// Pourquoi ce script existe alors qu'il y a deja un cliquet eslint : eslint ne
// lit que `js src scripts`. Le JS inline des pages HTML lui est INVISIBLE, et
// c'est la que vivaient 105 des 134 lectures d'horloge locale du 13/09/2026.
// Un cliquet qui couvre 29 cas sur 134 et affiche vert est une garde qui
// rassure.
//
// Trois signatures, parce que le defaut en a trois :
//
//   1. `toISOString().split('T')[0]` et `.slice(0,10)` utilises comme DATE
//      D'AFFICHAGE. C'est le motif exact qui produit le decalage d'un jour :
//      la date sort en UTC pendant que l'heure sort en local.
//
//   2. `new Date(<chaine sans fuseau>)` — parse en heure LOCALE. Depuis Paris,
//      `new Date('2026-09-16T09:00')` vaut 07:00 UTC, soit 08:00 heure cabinet.
//      Quand le resultat est ecrit en base, ce n'est plus un defaut
//      d'affichage : c'est une donnee fausse.
//
//   3. `Intl.DateTimeFormat` sans `timeZone` sur une date de rendez-vous.
//
// Usage : node scripts/verifier-fuseau.mjs
// =====================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
// `scripts/` est de l'outillage de build, pas du code d'affichage de rendez-vous.
const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'migrations', 'supabase', 'docs', 'scripts']);

// Le plafond est le compte REEL mesure apres correction, jamais releve « en
// attendant ». Chaque entree est un usage legitime, justifie ici.
const PLAFOND = {
  'js/tabibi-temps.js': 2,        // l'utilitaire lui-meme : c'est lui qui convertit
  'js/tabibi-i18n.js': 2,         // le repli quand tabibiTemps n'est pas charge
  'admin-api-keys.html': 2,       // statistiques d'usage de cles API, pas des rendez-vous
  'patient-ordonnances.html': 2,  // dates de validite d'ordonnance
  'medecin-ordonnance.html': 1,   // date de generation du document
  'patient-dashboard.html': 1,    // date d'un document ajoute a la main
  'legal/rgpd-droits.html': 1,    // date dans le nom du fichier d'export
};

function fichiers(dir = '.', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    // index-baseline.html n'est pas suivi par git : une relique locale.
    else if (/\.(html|js|mjs)$/.test(e.name) && !e.name.includes('vendor') && e.name !== 'index-baseline.html') acc.push(p);
  }
  return acc;
}

const SIGNATURES = [
  { nom: 'date-utc-affichee',
    // `.slice(0,10)` n'est retenu que sur une expression qui ressemble a une
    // date : sinon la signature ramasse n'importe quelle troncature de chaine.
    re: /toISOString\(\)\s*\.\s*(?:split\(['"]T['"]\)\s*\[\s*0\s*\]|slice\(\s*0\s*,\s*10\s*\))|[A-Za-z_$][\w$]*(?:_at|[Dd]ate|[Ii]so|[Jj]our|scheduled|starts|ends)[\w$]*\s*(?:\|\|\s*["'`]{2}\s*\))?\s*\.slice\(\s*0\s*,\s*10\s*\)/g,
    aide: "jour UTC pris pour un jour cabinet -> window.tabibiTemps.jourDe(instant)" },
  { nom: 'date-parse-locale',
    re: /new Date\(\s*[^)'"`]*['"`]\s*\+|new Date\(\s*['"`]\d{4}-\d{2}-\d{2}T[^Z'"`]*['"`]\s*\)/g,
    aide: "chaine sans fuseau parsee en LOCAL -> window.tabibiTemps.instantDepuisJourEtHeure(jour, heure)" },
];

let total = 0, fautes = 0;
const parFichier = {};
for (const f of fichiers()) {
  const src = readFileSync(f, 'utf8');
  let n = 0;
  // Les lignes de commentaire ne comptent pas : elles DECRIVENT le defaut.
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n');
  for (const s of SIGNATURES) {
    s.re.lastIndex = 0;
    const m = code.match(s.re);
    if (m) n += m.length;
  }
  // 3e signature : Intl.DateTimeFormat sans timeZone dans les 5 lignes suivantes
  const L = src.split('\n');
  for (let i = 0; i < L.length; i++) {
    if (!L[i].includes('Intl.DateTimeFormat')) continue;
    if (/^\s*(\*|\/\/)/.test(L[i])) continue;
    if (!L.slice(i, i + 5).join('\n').includes('timeZone')) n++;
  }
  if (n) { parFichier[f] = n; total += n; }
}

const noms = new Set([...Object.keys(parFichier), ...Object.keys(PLAFOND)]);
for (const f of [...noms].sort()) {
  const vu = parFichier[f] || 0, max = PLAFOND[f] || 0;
  const etat = vu > max ? ROUGE(`✗ ${vu} > ${max}`) : (vu < max ? `↓ ${vu} < ${max}` : `= ${vu}`);
  if (vu !== max) console.log(`  ${etat}  ${f}`);
  if (vu > max) fautes++;
}
console.log(`\n${total} lecture(s) d'horloge suspecte(s), plafond total ${Object.values(PLAFOND).reduce((a, b) => a + b, 0)}.`);
if (fautes) {
  console.error(ROUGE(`\n✗ ${fautes} fichier(s) au-dessus du plafond.`));
  console.error(`  L'heure d'un rendez-vous se lit dans le fuseau du CABINET : js/tabibi-temps.js.`);
  console.error(`  instant(v) pour un timestamptz · jourCalendaire(s) pour un 'YYYY-MM-DD'.`);
  console.error(`  Un plafond ne se releve pas « en attendant » : on corrige, ou on justifie ici.`);
  process.exit(1);
}
console.log('Aucune lecture d\'horloge locale sur une date de rendez-vous.');
