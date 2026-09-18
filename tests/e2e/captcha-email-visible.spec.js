// =====================================================================
// « Email ou mot de passe incorrect » — sur un mot de passe JUSTE
// =====================================================================
// ⚠️ REMONTÉ EN PROD, SAFARI, PAR UN TESTEUR RÉEL. Sur `/login` onglet
// « E-mail », avec des identifiants **corrects**, la connexion échouait.
//
// ---------------------------------------------------------------------
// LE MÉCANISME
// ---------------------------------------------------------------------
// Le captcha Turnstile **visible** n'était rendu que pour trois écrans :
// `login` (téléphone), `reset`, `otp`. L'écran e-mail (`#screen-admin`) n'avait
// **aucun widget**. Son jeton retombait donc sur le chemin **invisible**
// (`getCaptchaToken`), que WebKit **ne complète jamais** — PAT 401 + ITP, déjà
// documenté dans `login.html:121` pour le téléphone.
//
// Supabase exige le captcha → refus → et le refus s'affiche, par prudence, en
// « Email ou mot de passe incorrect ». **Le message le plus trompeur possible :
// il accuse l'utilisateur d'une faute qu'il n'a pas commise.**
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// 1. Le formulaire e-mail **possède** un emplacement de captcha.
// 2. Il est **rendu à la bascule d'onglet**, pas au chargement — dans un
//    conteneur `display:none`, Turnstile calcule une taille nulle (c'est
//    pourquoi `reset` et `otp` font déjà ainsi).
// 3. La connexion e-mail passe le jeton du widget **visible**, pas l'invisible.
// 4. Le chemin **téléphone** continue de marcher.
//
// ⚠️ CE QU'ILS NE PROUVENT PAS : que Safari accepte. Les essais tournent sur
// Chromium, et `_hermetique` coupe le réseau vers Cloudflare — le vrai widget
// ne se charge donc jamais ici. Ce qui est vérifié, c'est **le câblage** : le
// slot existe, il est demandé au bon moment, et le jeton passe par le bon
// chemin. La recette Safari reste à faire à la main (P-31).
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

async function ouvrir(page) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {}
    // On note quel écran demande un rendu de widget, et sur quel emplacement.
    window.__widgets = [];
  });
  await page.goto('/login.html', ATTENDRE);
  await expect(page.locator('#screen-phone')).toBeVisible({ timeout: 10000 });
}

test.describe('captcha visible sur la connexion par e-mail', () => {

  test('le formulaire e-mail POSSÈDE un emplacement de captcha', async ({ page }) => {
    // ⚠️ Sans lui, `_ensureCaptcha` sort sur `if (!slot) return;` — en silence.
    // C'était exactement l'état d'avant : rien ne signalait l'absence.
    await ouvrir(page);
    expect(await page.locator('#screen-admin .tbi-captcha-slot').count(),
      'le formulaire e-mail n’a plus d’emplacement de captcha').toBe(1);
  });

  test('les QUATRE écrans qui en ont besoin sont déclarés', async ({ page }) => {
    // téléphone · reset · otp · **e-mail** — le quatrième est celui qui
    // manquait. Un essai qui ne compterait que le sien laisserait retirer les
    // autres.
    const src = await page.request.get('/login.html').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    for (const cle of ['login:', 'reset:', 'otp:', 'loginEmail:']) {
      expect(nu, `le widget « ${cle} » n’est plus déclaré`).toContain(cle);
    }
    expect(nu, 'le widget e-mail ne vise plus le bon emplacement')
      .toMatch(/loginEmail:[^}]*#screen-admin \.tbi-captcha-slot/);
  });

  test('il est rendu À LA BASCULE, pas au chargement', async ({ page }) => {
    // ⚠️ Dans un conteneur `display:none`, Turnstile calcule une taille nulle.
    // C'est pourquoi `reset` et `otp` sont déjà rendus à l'affichage de leur
    // écran — et pourquoi un rendu au `DOMContentLoaded` ne marcherait pas ici.
    await ouvrir(page);
    const src = await page.request.get('/login.html').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    expect(nu, 'le captcha e-mail n’est plus rendu à la bascule d’écran')
      .toMatch(/which === "admin"\s*\)\s*_ensureCaptcha\("loginEmail"\)/);
    expect(nu, 'il est rendu au chargement : dans un écran caché, il ferait 0 px')
      .not.toMatch(/DOMContentLoaded[^)]*_ensureCaptcha\("loginEmail"\)/);
  });

  test('la connexion e-mail passe le jeton VISIBLE, pas l’invisible', async ({ page }) => {
    // ⚠️ LE CŒUR DU DÉFAUT. `auth.signIn()` demande son jeton à
    // `getCaptchaToken()` — le chemin invisible, celui que WebKit ne complète
    // jamais. La page doit appeler `signInWithPassword` avec le jeton du
    // widget visible, comme le fait déjà `doPhoneLogin`.
    const src = await page.request.get('/login.html').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    const doLogin = nu.slice(nu.indexOf('async function doLogin'));
    const corps = doLogin.slice(0, doLogin.indexOf('\n}'));
    expect(corps, 'la connexion e-mail retombe sur le captcha invisible')
      .not.toMatch(/auth\.signIn\(/);
    expect(corps, 'le jeton du widget visible n’est plus demandé')
      .toMatch(/_captchaTokenFor\("loginEmail"\)/);
    expect(corps, 'le jeton n’est pas transmis à Supabase')
      .toMatch(/captchaToken:\s*captchaEmail/);
    expect(corps, 'le jeton n’est pas remis à zéro après un refus')
      .toMatch(/_resetCaptcha\("loginEmail"\)/);
  });

  test('l’appel part bien avec un `captchaToken` — mesuré, pas lu', async ({ page }) => {
    // On intercepte la requête d'authentification : c'est la seule preuve que
    // le jeton quitte réellement la page.
    await ouvrir(page);
    let corpsEnvoye = null;
    await page.route('**/auth/v1/token**', async (route) => {
      try { corpsEnvoye = route.request().postData(); } catch (e) { corpsEnvoye = null; }
      await route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'refus simule' }) });
    });

    await page.evaluate(() => { window.tabibiTurnstile = {
      isEnabled: () => true,
      getCaptchaToken: async () => 'JETON-INVISIBLE',
      renderWidget: async () => 1,
      getResponse: () => 'JETON-VISIBLE',
    }; });
    await page.locator('#lo-mode-email').click();
    await expect(page.locator('#screen-admin')).toBeVisible();
    await page.fill('#le', 'essai@example.test');
    await page.fill('#lp', 'motdepasse123');
    await page.click('#screen-admin button[type="submit"]');

    await expect.poll(() => corpsEnvoye, { timeout: 10000 }).toBeTruthy();
    expect(corpsEnvoye, 'aucun jeton de captcha n’accompagne la connexion e-mail')
      .toMatch(/captcha|gotrue_meta_security/i);
  });

  test('le chemin TÉLÉPHONE marche toujours', async ({ page }) => {
    // ⚠️ La contre-épreuve : on n'a pas réparé l'e-mail en cassant le
    // téléphone, qui lui fonctionnait.
    await ouvrir(page);
    expect(await page.locator('#pwLoginForm .tbi-captcha-slot').count(),
      'l’emplacement du captcha téléphone a disparu').toBe(1);
    const src = await page.request.get('/login.html').then((r) => r.text());
    expect(src).toMatch(/_captchaTokenFor\("login"\)/);
  });
});
