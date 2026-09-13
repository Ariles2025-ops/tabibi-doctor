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
  // [13/09/2026, revision] L'ancien plafond de 11 melangeait CODE et COMMENTAIRE :
  // le script ne sautait que les lignes COMMENCANT par // ou *. Il compte
  // desormais sur du code depouille pour de bon. Chaque entree ci-dessous est du
  // CODE, verifie ligne par ligne, et aucune ne formate l'instant d'un RDV.
  //
  'js/tabibi-temps.js': 2,      // l'utilitaire lui-meme : la Date y est ancree a
                                // minuit UTC, `toISOString().slice(0,10)` la relit
                                // sans derive possible.
  'js/tabibi-i18n.js': 2,       // les deux Intl de REPLI, atteints seulement si
                                // tabibiTemps n'est pas charge.
  'reservation.html': 8,        // arithmetique ENTIERE de la grille mensuelle :
                                // new Date(y, m, 1).getDay() sur un couple annee/
                                // mois deja fixe. Le point d'entree est correct :
                                // _todayIso() passe par un formateur en fuseau
                                // cabinet, et _addDaysIso par tabibiTemps.
  'admin-api-keys.html': 4,     // fenetre de 30 jours de statistiques d'usage de
                                // cles API. Aucun rendez-vous.
  'doctor-analytics.html': 2,   // libelles d'axe (jour de semaine, mois) calcules
                                // sur un point median deja arrondi.
  'patient-ordonnances.html': 2, // dates de validite d'ordonnance.
  'patient-dashboard.html': 1,  // date d'un document ajoute a la main.
  'medecin-ordonnance.html': 1, // date de generation du document.
  'legal/rgpd-droits.html': 1,  // date dans le nom du fichier d'export.
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

// ---------------------------------------------------------------------------
// Un compteur de motifs qui ne distingue pas le CODE du COMMENTAIRE derive :
// son plafond melange les deux, et un commentaire ajoute le fait monter. Pire,
// un commentaire QUI DECRIT le defaut le fait ressembler au defaut.
//
// Le 13/09/2026, une mesure a la main sur le HTML servi a compte
// `toISOString().split('T')[0] -> 1` dans doctor-dashboard : c'etait la ligne
// 1222, un commentaire expliquant pourquoi on ne l'utilise PAS.
//
// Une premiere tentative de depouillement, une machine a etats sur le fichier
// entier, s'est DESYNCHRONISEE : les apostrophes de la prose francaise en HTML
// (« l'heure », « d'affichage ») ouvraient un etat « chaine » qui ne se refermait
// jamais, et tout ce qui suivait echappait au comptage. Elle donnait 23 au lieu
// de 25 sur un fichier ou l'on venait d'ajouter deux commentaires.
//
// On ne lit donc que ce qui est EXECUTABLE : le corps des <script> et les
// attributs on*. La prose HTML ne peut pas contenir de code, ses apostrophes ne
// nous concernent pas. Dans ce code-la, on retire les commentaires // et /* */,
// en epargnant les `//` d'URL (precedes de « : »).
function partiesExecutables(src, estHtml) {
  if (!estHtml) return src;
  const morceaux = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) morceaux.push(m[1]);
  const attrs = src.match(/\son[a-z]+\s*=\s*"[^"]*"/gi) || [];
  return morceaux.join('\n') + '\n' + attrs.join('\n');
}

function sansCommentaires(src, estHtml) {
  let code = partiesExecutables(src, estHtml);
  code = code.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));
  code = code.replace(/(^|[^:])\/\/[^\n]*/g, (t, avant) => avant);
  return code;
}

const SIGNATURES = [
  { nom: 'date-utc-affichee',
    // `.slice(0,10)` n'est retenu que sur une expression qui ressemble a une
    // date : sinon la signature ramasse n'importe quelle troncature de chaine.
    re: /toISOString\(\)\s*\.\s*(?:split\(['"]T['"]\)\s*\[\s*0\s*\]|slice\(\s*0\s*,\s*10\s*\))|[A-Za-z_$][\w$]*(?:_at|[Dd]ate|[Ii]so|[Jj]our|scheduled|starts|ends)[\w$]*\s*(?:\|\|\s*["'`]{2}\s*\))?\s*\.slice\(\s*0\s*,\s*10\s*\)/g,
    aide: "jour UTC pris pour un jour cabinet -> window.tabibiTemps.jourDe(instant)" },
  { nom: 'composantes-locales',
    // eslint couvre ceci sur js/src/scripts (no-restricted-syntax). Ici on le
    // fait pour le JS inline des pages, ou il est aveugle. C'est par ce trou
    // qu'est passe `_tomorrowLocalIso()` de doctor-dashboard, qui pre-remplissait
    // une indisponibilite avec « demain » dans le fuseau du NAVIGATEUR.
    re: /\.(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes)\s*\(/g,
    aide: "composantes d'horloge locale -> window.tabibiTemps.aujourdhui() / jourDe / heureDe" },
  { nom: 'date-parse-locale',
    re: /new Date\(\s*[^)'"`]*['"`]\s*\+|new Date\(\s*['"`]\d{4}-\d{2}-\d{2}T[^Z'"`]*['"`]\s*\)/g,
    aide: "chaine sans fuseau parsee en LOCAL -> window.tabibiTemps.instantDepuisJourEtHeure(jour, heure)" },
];

let total = 0, fautes = 0;
const parFichier = {};
for (const f of fichiers()) {
  const src = readFileSync(f, 'utf8');
  let n = 0;
  const code = sansCommentaires(src, /\.html$/.test(f));
  for (const s of SIGNATURES) {
    s.re.lastIndex = 0;
    const m = code.match(s.re);
    if (m) n += m.length;
  }
  // 3e signature : Intl.DateTimeFormat sans timeZone dans les 5 lignes suivantes
  const L = code.split('\n');
  for (let i = 0; i < L.length; i++) {
    if (!L[i].includes('Intl.DateTimeFormat')) continue;
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
