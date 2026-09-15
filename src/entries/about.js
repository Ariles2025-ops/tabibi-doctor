// =====================================================================
// Point d'entree de about.html — genere par scripts/vite-convertir-page.mjs
// =====================================================================
// L'ordre des imports est l'ordre d'execution releve dans la page : ces modules
// communiquent par des globales (window.tabibi, window.TABIBI_CONFIG...).
// Ne pas reordonner sans verifier. Chemins relatifs : fonctionne sans build.

import '../../js/tabibi-cookies.js';
import '../../js/tabibi-beta.js';
import '../../js/tabibi-lang.js';
import '../../js/tabibi-i18n.js';
import '../../js/tabibi-langbar.js';
// ⚠️ [15/09/2026] L'IMPORT SEUL NE SUFFISAIT PAS — c'est P-29.
//
// `tabibi-langbar.js` n'exporte rien : l'import ci-dessus est un import a
// EFFET DE BORD SEUL. Rollup ne voyait aucune valeur consommee et l'ELIMINAIT.
// Le morceau `tabibi-langbar-*.js` etait bien construit (d'autres pages le
// chargent par `<script src>`), mais l'accueil CONSTRUIT ne le chargeait plus :
// le placeholder `[data-langbar]` etait pose par le header, jamais rempli, et
// **il n'y avait aucun bouton de langue**.
//
// Le module pose desormais `window.tabibiLangbar` au premier niveau, ce que le
// bundler ne peut pas ignorer. L'appel ci-dessous est la seconde ceinture : il
// dit l'INTENTION a qui lit ce fichier, et il rattrape le cas ou l'auto-init
// serait passee trop tot. `inject()` est idempotente — deux appels ne font pas
// deux selecteurs.
if (typeof window !== 'undefined' && window.tabibiLangbar) window.tabibiLangbar.init();
