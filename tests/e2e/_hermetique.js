// =====================================================================
// _hermetique.js — un test e2e ne sort JAMAIS de localhost
// =====================================================================
// Ne le 14/09/2026 d'un echec que je n'arrivais pas a reproduire : la porte
// e2e sortait en 1 sur le runner GitHub, et rendait 100/100 chez moi, en
// conditions CI, sur les sources ET sur la sortie de build.
//
// **Un test vert chez soi et rouge sur le runner, c'est une dependance a
// l'environnement.** Et la seule chose qui change vraiment entre les deux, c'est
// le RESEAU EXTERNE.
//
// Ce que les pages chargent de l'exterieur, mesure le 14/09 :
//   js/tabibi-sentry.js  -> https://browser.sentry-cdn.com/8.45.0/…   CHAQUE page
//   pages d'authentification -> https://challenges.cloudflare.com/…   (Turnstile)
//   le client Supabase   -> https://<projet>.supabase.co/…
//
// Premiere correction (commit 42431e0) : `waitUntil: 'domcontentloaded'` partout,
// pour ne plus ATTENDRE ces ressources. Necessaire, et **pas suffisant** — une
// requete lancee apres le DOM peut encore faire echouer une assertion qui
// attend l'ecran, et le runner reste libre de mettre 20 s a la refuser.
//
// Ici on va au bout : **on ne laisse plus sortir une seule requete.**
// Tout ce qui n'est pas `localhost` / `127.0.0.1` est refuse immediatement.
// Le test mesure alors notre code, et rien d'autre.
//
// ---------------------------------------------------------------------
// L'ORDRE DES ROUTES COMPTE, ET IL JOUE EN NOTRE FAVEUR
// ---------------------------------------------------------------------
// Playwright essaie les routes de la PLUS RECENTE a la plus ancienne. Ce
// filet s'installe dans un `beforeEach` ; les bouchons propres a un test
// s'installent DANS le test, donc APRES, donc ils gagnent.
// Un test qui veut simuler une reponse de Supabase continue de le faire.
// =====================================================================

const INTERNE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

/**
 * Coupe tout acces reseau hors localhost et rend la liste des hosts refuses.
 * @returns {{ refuses: string[] }} — a inspecter pour prouver l'hermeticite.
 */
// On REPOND a vide, on n'ABORTE pas. Premiere version : `route.abort()` — et dix
// tests sont tombes, parce que `parcours-critiques.spec.js` verifie qu'AUCUNE
// erreur de console n'apparait, et qu'un abort en produit une
// (« Failed to load resource »). Rendre un 200 vide garde la console propre ET
// coupe le reseau : le test mesure alors le meme ecran, sans l'exterieur.
const VIDE = {
  script:     { contentType: 'application/javascript', body: '' },
  stylesheet: { contentType: 'text/css',               body: '' },
  image:      { contentType: 'image/gif',              body: '' },
  font:       { contentType: 'font/woff2',             body: '' },
};
// Tout le reste (xhr, fetch, …) : un tableau JSON vide. C'est ce que rend une
// table sans lignes ; aucun code du site ne le prend pour un succes porteur de
// donnees, et aucun ne leve dessus. Les tests qui ont besoin d'une reponse
// precise la posent eux-memes — leur route, plus recente, gagne.
const DEFAUT = { contentType: 'application/json', body: '[]' };

async function hermetiser(page) {
  const refuses = [];
  await page.route('**', (route) => {
    const url = route.request().url();
    if (INTERNE.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    try { refuses.push(new URL(url).host); } catch (e) { refuses.push(url.slice(0, 60)); }
    const forme = VIDE[route.request().resourceType()] || DEFAUT;
    return route.fulfill({ status: 200, ...forme });
  });
  return { refuses };
}

/** Navigation standard : on n'attend jamais `load`, qui inclurait les tiers. */
const ATTENDRE = { waitUntil: 'domcontentloaded' };

/**
 * Bouchon du captcha. `addInitScript` ne suffit PAS : `js/tabibi-turnstile.js`
 * se charge APRES et ecrase l'objet. On remplace donc le SCRIPT lui-meme.
 * (Redondant avec `hermetiser` pour le reseau, utile pour que le code de la
 * page trouve un `window.tabibiTurnstile` utilisable au lieu de rien.)
 */
async function neutraliserCaptcha(page) {
  await page.route('**/js/tabibi-turnstile.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibiTurnstile = { getCaptchaToken: async () => 'jeton-de-test',
                                      isEnabled: () => false, verifyToken: async () => true };`,
  }));
}

module.exports = { hermetiser, neutraliserCaptcha, ATTENDRE, INTERNE };
