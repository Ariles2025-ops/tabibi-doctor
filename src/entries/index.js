// =====================================================================
// Point d'entree de index.html
// =====================================================================
// Genere a partir de l'ordre d'execution REEL releve dans index.html le
// 09/09/2026. L'ordre compte : ces modules communiquent par des globales
// (window.TABIBI_CONFIG, window.tabibi, window.supabase). Un import place
// avant un autre change le comportement — ne pas reordonner sans verifier.
//
// Les chemins sont RELATIFS et pointent vers des fichiers reels : ce
// module fonctionne donc AUSSI sans build, charge nativement par le
// navigateur. La migration ne casse pas le deploiement actuel.
//
// Reste hors de ce fichier, volontairement :
//   js/tabibi-i18n.js et js/tabibi-cookies.js -> scripts classiques places juste
//                            apres le hero dans index.html (LCP), voir la page.
//   js/tabibi-prelang.js  -> script classique dans le <head>, il doit poser
//                            la langue et la direction RTL avant le rendu.
//   le SDK Supabase       -> script classique. C'est un bundle UMD : importe
//                            comme module ESM, il voit un environnement de
//                            modules, s'exporte en CommonJS et n'attache PLUS
//                            window.supabase. Constate le 09/09/2026 : le
//                            build passait, la page se chargeait, et le client
//                            Supabase etait introuvable a l'execution.
// =====================================================================

import '../../js/tabibi-security.js';
import '../../js/tabibi-avatar.js';
import '../../js/tabibi-pixel.js';
import '../../js/tabibi-header.js';
import '../../js/tabibi-nav.js';
import '../../assets/dz-wilaya-centroids.js';
import '../../js/home-app.js';
import '../../js/config.js';
import '../../js/supabase-client.js';
import '../../js/auth.js';
import '../../js/capacitor-bridge.js';
import '../../js/tabibi-push-init.js';
import '../../js/api.js';
import '../../js/tabibi-bridge.js';
import '../../js/tabibi-doctor-name.js';
import '../../js/tabibi-brevo.js';
import '../../js/tabibi-turnstile.js';
import '../../js/tabibi-sms.js';
import '../../js/tabibi-network.js';
import '../../js/tabibi-beta.js';
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
import '../../js/tabibi-sentry.js';
import '../../js/tabibi-features.js';
import '../../js/tabibi-analytics.js';
import '../../js/tabibi-sw-register.js';
