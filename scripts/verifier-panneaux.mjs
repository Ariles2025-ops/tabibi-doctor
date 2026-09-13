#!/usr/bin/env node
// =====================================================================
// verifier-panneaux.mjs — un panneau que rien ne declenche est mort
// =====================================================================
// Le 13/09/2026, des assertions Playwright portaient sur `#rdv-list`, dans le
// panneau `#tab-rdv` de patient-dashboard.html. Ce panneau etait neutralise
// depuis la phase 5.2.5 : son onglet redirigeait ailleurs, `sw('rdv')` n'etait
// appele nulle part. Les tests passaient au VERT sur un ecran que plus personne
// ne voit — et le vrai ecran, `mes-rdv.html`, n'etait pas teste du tout.
//
// La neutralisation avait pourtant ete faite proprement : commentee, datee,
// justifiee. C'est precisement ce qui l'a rendue invisible.
//
// Ce script echoue si un element `.tab-panel` porteur d'un id n'est atteignable
// par aucun declencheur du meme fichier.
//
// « Conserve pour rollback rapide » n'est pas une raison de le garder : git
// fait ce travail, et mieux. Un filet vers du code neutralise parce qu'il etait
// faux n'est pas un filet.
//
// SON ANGLE MORT, declare : ce script voit les PANNEAUX, pas les FONCTIONS
// orphelines. Le 13/09/2026 il a bien trouve #tab-stats, mais il n'a rien dit
// de showBookingStep, selDate, selTime, confirmBooking, renderPayMethods et
// payMethodsDisponibles — une grappe de six fonctions qui ne s'appelaient que
// les unes les autres, sans aucune entree. Elles ont ete trouvees a la main.
//
// Une garde qui ne declare pas son angle mort en cree un : on croit le domaine
// couvert parce que le controle est vert.
//
// Pourquoi ce n'est pas automatise : une analyse d'atteignabilite naive a
// classe toggleMenu() et refreshOverview() comme morts alors qu'ils sont bien
// vivants — elle ne voit pas les `onclick` ecrits dans des gabarits JS. Deux
// faux positifs sur des fonctions vivantes suffisent a rendre l'outil
// dangereux. Tant qu'il n'est pas fiable, la suppression de fonctions se fait
// a la main, occurrence par occurrence.
//
// Usage : node scripts/verifier-panneaux.mjs
// =====================================================================
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', 'tests', '.git', 'assets', 'blog']);

function pages(dir = '.', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) pages(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// Un panneau `tab-X` est atteignable si le fichier contient un appel de bascule
// portant 'X', ou une manipulation directe de '#tab-X'.
function declencheurs(src, id) {
  const court = id.replace(/^tab-/, '');
  const motifs = [
    new RegExp(`\\b(?:sw|showTab|switchTab|goTab|openTab)\\s*\\(\\s*['"\`]${court}['"\`]`),
    new RegExp(`getElementById\\(\\s*['"\`]${id}['"\`]`),
    new RegExp(`querySelector(?:All)?\\(\\s*['"\`][^'"\`]*#${id}\\b`),
    new RegExp(`data-panel\\s*=\\s*['"]${court}['"]`)
  ];
  return motifs.some((m) => m.test(src));
}

let morts = 0, vus = 0;
for (const f of pages()) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes('tab-panel')) continue;
  const ids = [...src.matchAll(/id="([^"]+)"[^>]*class="[^"]*\btab-panel\b/g)].map((m) => m[1])
    .concat([...src.matchAll(/class="[^"]*\btab-panel\b[^"]*"[^>]*id="([^"]+)"/g)].map((m) => m[1]));
  for (const id of [...new Set(ids)]) {
    vus++;
    if (!declencheurs(src, id)) {
      morts++;
      console.error(ROUGE(`✗ ${f} : le panneau #${id} n'est declenche par rien.`));
      console.error(`  Soit on le rend atteignable, soit on le SUPPRIME. Un panneau desactive`);
      console.error(`  mais laisse en place se fait tester a la place du vrai (incident du 13/09/2026).`);
      console.error(`  « Conserve pour rollback » : git fait ce travail, et mieux.`);
    }
  }
}
console.log(`${vus} panneau(x) .tab-panel examine(s), ${morts} sans declencheur.`);
if (morts) process.exit(1);
console.log('Tous les panneaux sont atteignables.');
