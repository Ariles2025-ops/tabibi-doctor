// =====================================================================
// Les corrections de l'audit du 14/09 — deux ecrans qui cessent de mentir
// =====================================================================
// B-2  `forgot-password.html` affichait « e-mail envoye » DANS TOUS LES CAS.
// B-1  `waiting-list.html` affichait « 500+ inscrits » alors qu'il y en avait 0.
//
// Les deux appartiennent a la meme famille, et c'est elle que ce fichier garde :
//
//   > **un ecran ne presente jamais comme mesure une valeur qu'il n'a pas mesuree.**
//
// Aucun compte cree, aucun reseau reel : tout est bouchonne par des routes.
// =====================================================================
const { test, expect } = require('@playwright/test');
// [14/09/2026] AUCUNE REQUETE HORS LOCALHOST. Voir tests/e2e/_hermetique.js :
// la CI rougissait sur une dependance reseau (Sentry CDN sur chaque page,
// Turnstile sur les pages d'authentification) que le local ne voyait pas.
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

// [14/09/2026] CE FICHIER A FAIT ROUGIR LA CI ALORS QU'IL ETAIT VERT EN LOCAL.
//
// Cause mesuree : mes `page.goto()` n'avaient pas de `waitUntil`, donc Playwright
// attendait l'evenement `load` — **qui inclut le widget Cloudflare Turnstile**,
// charge par `forgot-password.html` ET `waiting-list.html`. Sur un runner qui
// atteint mal challenges.cloudflare.com, chaque navigation attend le reseau.
//
// Mesure, avec un Cloudflare simule a 20 s de latence :
//     waitUntil:'load'              -> 20,1 s par navigation
//     waitUntil:'domcontentloaded'  ->  0,1 s
// 12 navigations (6 tests x 2 profils) ~ 240 s d'attente, timeout de 30 s par
// test : la porte e2e sortait en 1 apres ~173 s. En local, Cloudflare repond en
// quelques dizaines de millisecondes et rien ne se voit.
//
// DEUX CORRECTIONS, et les deux sont de principe :
//   1. `waitUntil: 'domcontentloaded'` — c'est ce que fait TOUTE la suite
//      existante (parcours-critiques.spec.js). Je m'etais ecarte du patron sans
//      le savoir.
//   2. Turnstile neutralise au niveau RESEAU pour TOUS les tests de ce fichier,
//      pas seulement ceux de B-2. **Un test e2e ne doit dependre d'aucun tiers** :
//      sinon il mesure la latence de Cloudflare, pas notre code.
test.beforeEach(async ({ page }) => {
  await page.route('**/js/tabibi-turnstile.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibiTurnstile = { getCaptchaToken: async () => 'jeton-de-test',
                                      isEnabled: () => false, verifyToken: async () => true };`
  }));
  await page.route('**/challenges.cloudflare.com/**', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

// Toute la suite navigue ainsi. Voir l'explication ci-dessus.

// ─────────────────────────────────────────────────────────────────────
// B-2 — mot de passe oublie
// ─────────────────────────────────────────────────────────────────────
test.describe('B-2 — « mot de passe oublie » ne ment plus', () => {

  // Le SEUL appel qui compte est celui de l'API d'authentification. On le
  // bouchonne au niveau reseau pour exercer le vrai code de la page.
  // Turnstile est deja neutralise par le `beforeEach` global : un
  // `addInitScript` ne suffirait pas, `js/tabibi-turnstile.js` se charge apres
  // et l'ecrase. Ici on ne bouchonne que l'appel qui est le SUJET du test.
  async function poser(page, reponse) {
    await page.route('**/auth/v1/recover**', (route) => route.fulfill(reponse));
  }

  test('ECHEC SYSTEME : l ecran montre l erreur, PAS « envoye »', async ({ page }) => {
    await poser(page, {
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })
    });
    await page.goto('/forgot-password.html', ATTENDRE);
    await page.fill('#f_email', 'temoin@example.test');
    await page.click('#submit-btn');

    const err = page.locator('#msg-err');
    const ok  = page.locator('#msg-ok');

    await expect(err).toBeVisible();
    await expect(err).toContainText('Impossible');
    // LE COEUR DU TEST : aucun faux succes.
    await expect(ok).toBeHidden();
  });

  test('SUCCES : le message reste le MEME — l anti-enumeration est gardee', async ({ page }) => {
    await poser(page, { status: 200, contentType: 'application/json', body: '{}' });
    await page.goto('/forgot-password.html', ATTENDRE);
    await page.fill('#f_email', 'temoin@example.test');
    await page.click('#submit-btn');

    const ok  = page.locator('#msg-ok');
    const err = page.locator('#msg-err');
    await expect(ok).toBeVisible();
    await expect(err).toBeHidden();
    // Le texte ne dit toujours PAS si le compte existe. C'est la propriete
    // qu'on ne veut surtout pas casser en corrigeant le mensonge.
    await expect(ok).toContainText('Si un compte existe');
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-1 — liste d'attente
// ─────────────────────────────────────────────────────────────────────
test.describe('B-1 — la liste d attente n invente plus de chiffre', () => {

  test('COMPTEUR INDISPONIBLE : aucun nombre affiche, surtout pas « 500+ »', async ({ page }) => {
    // Le cas REEL d'aujourd'hui : l'objet n'existe pas, PostgREST rend 404.
    await page.route('**/rest/v1/waiting_list_count**', (route) => route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST205', message: 'relation does not exist' })
    }));
    await page.goto('/waiting-list.html', ATTENDRE);

    const stat = page.locator('#stat-total');
    await expect(stat).toHaveText('—');
    await expect(stat).not.toContainText('500');
    await expect(stat).not.toContainText('+');
  });

  test('AUCUN « 500+ » ni « 50+ » ne subsiste dans la page', async ({ page }) => {
    // Assertion sur la SOURCE : le faux chiffre ne doit plus pouvoir apparaitre,
    // quel que soit le chemin d'execution. Les mentions restantes sont dans les
    // commentaires qui expliquent la correction — on les exclut.
    const src = await page.request.get('/waiting-list.html').then((r) => r.text());
    const sansCommentaires = src
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(sansCommentaires).not.toContain("'500+'");
    expect(sansCommentaires).not.toContain("'50+'");
    expect(sansCommentaires).not.toContain('formatNumber(500)');
  });

  test('COMPTEUR DISPONIBLE : le vrai nombre s affiche, meme petit', async ({ page }) => {
    // 3 inscrits doivent s'afficher « 3 » — l'ancien formateur rendait « 50+ ».
    await page.route('**/rest/v1/waiting_list_count**', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total_count: 3 })
    }));
    await page.goto('/waiting-list.html', ATTENDRE);
    await expect(page.locator('#stat-total')).toHaveText('3');
  });

  test('ZERO s affiche ZERO — c est la reponse juste aujourd hui', async ({ page }) => {
    await page.route('**/rest/v1/waiting_list_count**', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total_count: 0 })
    }));
    await page.goto('/waiting-list.html', ATTENDRE);
    await expect(page.locator('#stat-total')).toHaveText('0');
  });
});
