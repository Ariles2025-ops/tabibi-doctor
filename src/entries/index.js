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
import '../../js/tabibi-sentry.js';
import '../../js/tabibi-features.js';
import '../../js/tabibi-analytics.js';
import '../../js/tabibi-sw-register.js';
