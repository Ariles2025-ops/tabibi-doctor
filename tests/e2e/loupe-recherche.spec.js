// =====================================================================
// La loupe emmenait vers les FILTRES, pas vers la barre
// =====================================================================
// ⚠️ SIGNALÉ PAR AGHILES. Sur l'accueil, toucher l'icône **loupe** de la barre
// d'onglets faisait défiler la page jusqu'aux **menus déroulants** — wilaya,
// spécialité, tri, curseur de prix — en laissant la barre de saisie trois
// écrans plus haut.
//
// ---------------------------------------------------------------------
// LE MÉCANISME
// ---------------------------------------------------------------------
// `js/tabibi-nav.js` déclarait l'onglet ainsi :
//
//     { id: 'search', …, href: 'index.html#sec-search' }
//
// et `tabClick()` traite toute ancre de la même façon :
//
//     var el = document.getElementById(anchor);
//     if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
//
// Or `#sec-search` **existe** sur l'accueil : c'est le bloc des filtres. La
// page faisait donc exactement ce qu'on lui demandait — on lui demandait la
// mauvaise chose.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// Que la loupe mette le **curseur dans la barre**. Pas qu'elle fasse défiler :
// sur un téléphone, la différence entre « le clavier s'ouvre » et « il ne se
// passe rien » est exactement là. On mesure donc le FOCUS, et la position de la
// barre à l'écran — pas la présence d'un attribut.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';
const PER = 7;

function lignes(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    full_name: `Dr Essai ${i}`,
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.5, review_count: 12, languages: ['fr'], is_verified: true,
  }));
}

/**
 * Un visiteur qui a déjà répondu au bandeau cookies.
 *
 * ⚠️ MESURE FAITE EN ÉCRIVANT CET ESSAI : sur téléphone, `#tabibi-cookie-banner`
 * recouvre **toute la barre d'onglets**. `document.elementFromPoint()` au centre
 * de la loupe rend le bandeau, pas le bouton. Ce n'est pas un défaut de l'essai :
 * c'est l'état réel d'une première visite — la barre du bas est inatteignable
 * tant qu'on n'a pas répondu. On se met donc dans l'état d'APRÈS la réponse,
 * qui est celui où la loupe sert. (Le recouvrement lui-même est signalé au
 * RETOUR : il vaut pour les six onglets, pas seulement la loupe.)
 */
async function consentementDeja(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
    } catch (e) { /* stockage bloqué : le bandeau restera, l'essai le dira */ }
  });
}

/** Ouvre la page SANS exiger la barre du bas — elle n'existe pas sur ordinateur. */
async function ouvrir2(page) {
  await consentementDeja(page);
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(lignes(PER)),
  }));
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: PER, page: 1, limite: PER, lignes: lignes(PER) }),
  }));
  await page.goto(PAGE, ATTENDRE);
  await expect(page.locator('#name-search')).toBeVisible({ timeout: 8000 });
}

async function ouvrir(page) {
  await consentementDeja(page);
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(lignes(PER)),
  }));
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: PER, page: 1, limite: PER, lignes: lignes(PER) }),
  }));
  await page.goto(PAGE, ATTENDRE);
  // La barre d'onglets est posée à l'exécution : on attend l'élément, pas une durée.
  await expect(page.locator('#tab-bar .tab-item[data-tab="search"]')).toBeVisible({ timeout: 8000 });
}

/** Où se trouve un élément dans la fenêtre, en pixels depuis le haut. */
const positionEcran = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? Math.round(el.getBoundingClientRect().top) : null;
}, sel);

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('la loupe de la barre d’onglets', () => {

  // ⚠️ LA BARRE DU BAS EST UN ÉLÉMENT DE TÉLÉPHONE. `accueil-public.html` porte
  // `@media(min-width:768px){ nav.tab-bar{display:none} }` : sur ordinateur, ce
  // bouton n'existe pas à l'écran. Mesuré, pas supposé.
  //
  // Les essais qui le cliquent ne valent donc que sur le profil mobile. Les
  // déclarer `skip` ailleurs, plutôt que de les laisser échouer ou — pire — de
  // relâcher leurs assertions jusqu'à ce qu'ils passent partout.
  test.describe('sur téléphone', () => {
    test.skip(({ isMobile }) => !isMobile, 'la barre du bas est masquée au-dessus de 768 px');

  test('elle met le CURSEUR dans la barre de recherche', async ({ page }) => {
    await ouvrir(page);
    // On part d'en bas : sinon la barre est déjà à l'écran et l'essai ne
    // prouverait rien sur le défilement.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    await page.locator('#tab-bar .tab-item[data-tab="search"]').click();

    await expect.poll(
      () => page.evaluate(() => document.activeElement && document.activeElement.id),
      { timeout: 8000 },
    ).toBe('name-search');
  });

  test('la barre arrive À L’ÉCRAN — le focus seul ne suffit pas', async ({ page }) => {
    // ⚠️ Un champ qui a le focus hors de l'écran, c'est un clavier qui s'ouvre
    // sur rien. Les deux moitiés comptent.
    await ouvrir(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    await page.locator('#tab-bar .tab-item[data-tab="search"]').click();
    await expect.poll(async () => {
      const y = await positionEcran(page, '#name-search');
      const h = page.viewportSize().height;
      return y !== null && y >= 0 && y <= h;
    }, { timeout: 8000 }).toBe(true);
  });

  test('elle n’emmène PLUS vers le bloc des filtres', async ({ page }) => {
    // Le symptôme d'origine, mesuré : après le clic, c'est la BARRE qui est
    // en haut de l'écran, pas `#sec-search`.
    await ouvrir(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    await page.locator('#tab-bar .tab-item[data-tab="search"]').click();
    await expect.poll(
      () => page.evaluate(() => document.activeElement && document.activeElement.id),
      { timeout: 8000 },
    ).toBe('name-search');

    const yBarre = await positionEcran(page, '#name-search');
    const yFiltres = await positionEcran(page, '#sec-search');
    expect(yBarre, 'la barre n’est pas à l’écran').toBeLessThanOrEqual(page.viewportSize().height);
    expect(yBarre, 'les filtres sont au-dessus de la barre : on a scrollé au mauvais endroit')
      .toBeLessThan(yFiltres);
  });

  test('on peut TAPER tout de suite après le clic', async ({ page }) => {
    // La preuve par l'usage : le but de la loupe est de pouvoir écrire.
    await ouvrir(page);
    await page.locator('#tab-bar .tab-item[data-tab="search"]').click();
    await expect.poll(
      () => page.evaluate(() => document.activeElement && document.activeElement.id),
      { timeout: 8000 },
    ).toBe('name-search');

    await page.keyboard.type('benali');
    await expect(page.locator('#name-search')).toHaveValue('benali');
  });

  });   // fin « sur téléphone »

  // ─────────────────────────────────────────────────────────────────
  // SUR ORDINATEUR : il n'y a pas de barre du bas — et c'est voulu
  // ─────────────────────────────────────────────────────────────────
  test.describe('sur ordinateur', () => {
    test.skip(({ isMobile }) => isMobile, 'la barre du bas n’existe qu’en dessous de 768 px');

    test('la barre du bas est masquée — le bouton loupe n’y est pas', async ({ page }) => {
      // ⚠️ Mesuré, pas supposé : `@media(min-width:768px){ nav.tab-bar{display:none} }`.
      // Sans cet essai, quelqu'un lirait les essais « sur téléphone » et croirait
      // que la loupe du bas existe partout.
      await ouvrir2(page);
      await expect(page.locator('#tab-bar')).toBeHidden();
    });

    test('la loupe du héros laisse le clic atteindre la barre', async ({ page }) => {
      // Sur ordinateur, la seule loupe est celle DANS le champ : `.hero-si`
      // porte `pointer-events:none`, donc le clic traverse et atterrit sur
      // l'input. C'est deja le bon comportement — on le GARDE, parce qu'un
      // `pointer-events` retire un jour ferait un clic qui ne fait rien.
      await ouvrir2(page);
      // ⚠️ ON CLIQUE AUX COORDONNEES, pas sur le localisateur. `.hero-si` porte
      // `pointer-events:none` : Playwright refuse de « cliquer » un element qui
      // ne peut pas recevoir l'evenement — et il a raison, personne ne le clique
      // jamais. Ce qu'on veut mesurer, c'est ce qui arrive quand un doigt se
      // pose LA : l'evenement traverse et atteint le champ.
      const boite = await page.locator('.hero-si').boundingBox();
      expect(boite, 'la loupe du heros a disparu du champ').toBeTruthy();
      await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2);
      await expect.poll(
        () => page.evaluate(() => document.activeElement && document.activeElement.id),
        { timeout: 8000 },
      ).toBe('name-search');
    });
  });

  test('l’onglet ne vise plus `#sec-search` dans sa déclaration', async ({ page }) => {
    // ⚠️ La contre-épreuve de source : sans elle, quelqu'un pourrait remettre
    // l'ancienne ancre et les essais du dessus resteraient verts tant que le
    // cas particulier `id === 'search'` est là — jusqu'au jour où on le retire
    // « puisque l'ancre suffit ».
    const src = await page.request.get('/js/tabibi-nav.js').then((r) => r.text());
    const sansCommentaires = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    const ligne = sansCommentaires.split('\n').find((l) => /id:\s*'search'/.test(l)) || '';
    expect(ligne, 'l’onglet loupe vise de nouveau le bloc des filtres').not.toContain('#sec-search');
    expect(ligne).toContain('#name-search');
  });
});
