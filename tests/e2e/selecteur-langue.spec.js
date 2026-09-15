// =====================================================================
// Le sélecteur de langue — P-29, et pourquoi il fallait le voir CONSTRUIT
// =====================================================================
// ⚠️ SIGNALÉ PAR AGHILES : plus aucun bouton FR/AR/EN sur l'accueil en ligne.
//
// C'était P-29, ouvert depuis le 14/09 avec la mention « mécanisme non
// élucidé ». Il était mesuré, déjà, et dans les bons termes :
//
//     sources hermétique      -> 3 boutons
//     dist-web hermétique     -> 0 bouton
//     dist-web serveur nu     -> 3 boutons
//
// ---------------------------------------------------------------------
// LE MÉCANISME, MAINTENANT MESURÉ
// ---------------------------------------------------------------------
// `src/entries/index.js` faisait `import '../../js/tabibi-langbar.js';` — un
// import à **effet de bord seul**. Le module n'exporte rien : Rollup ne voyait
// aucune valeur consommée et **éliminait l'import**.
//
// Le morceau `tabibi-langbar-*.js` était bien construit — d'autres pages le
// chargent par `<script src>` — mais l'accueil **construit** ne le chargeait
// plus :
//
//     avant : accueil-public.html charge 3 morceaux, pas le langbar
//     après : il en charge 4, dont `tabibi-langbar-*.js`
//
// Le placeholder `[data-langbar]`, posé par `tabibi-header.js` à l'exécution,
// n'était jamais rempli.
//
// ---------------------------------------------------------------------
// ⚠️ POURQUOI CET ESSAI COMPTE DOUBLE
// ---------------------------------------------------------------------
// La suite tourne **deux fois** : sur les sources, puis sur `dist-web`
// (`TABIBI_CIBLE=dist-web`). Un essai qui ne regarderait que les sources aurait
// été **vert pendant tout le temps où la page en ligne était cassée** — c'est
// exactement ce qui s'est passé.
//
// **Ce que le visiteur reçoit, c'est le build.** C'est lui qu'il faut essayer.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

// Les pages qui portent une BARRE dans leur en-tete (`[data-langbar]`).
//
// ⚠️ `cas-grave.html` n'en a pas : elle n'a pas d'en-tete injecte et s'appuie
// sur le SWITCHER FLOTTANT. Je l'avais mise dans cette liste et l'essai a
// echoue — il avait raison : cette page n'a jamais eu de pill. Elle a son
// propre essai, plus bas, parce que c'est son chemin a elle qui doit tenir.
const PAGES = ['/accueil-public.html', '/about.html'];

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

for (const chemin of PAGES) {
  test(`${chemin} : exactement 3 boutons de langue (FR/AR/EN)`, async ({ page }) => {
    await page.goto(chemin, ATTENDRE);
    // Le placeholder peut etre pose a l'execution par l'en-tete : on attend le
    // resultat, pas une duree.
    await expect(page.locator('[data-lang-btn]')).toHaveCount(3, { timeout: 8000 });

    const labels = await page.locator('[data-lang-btn]').allTextContents();
    expect(labels.map((s) => s.trim())).toEqual(['FR', 'AR', 'EN']);
  });
}

test('cas-grave.html garde son switcher FLOTTANT — le filet tient', async ({ page }) => {
  // ⚠️ C'EST LE SECOND DEFAUT DE CE LOT, et il etait plus grave que le premier.
  //
  // `syncLangBtns()` masquait `#tabibi-lang-switcher` SANS CONDITION, donc
  // aussi quand aucun pill n'avait pu etre injecte. Sur l'accueil construit —
  // ou le pill ne venait jamais — le resultat etait : **aucun selecteur de
  // langue, nulle part**. Le filet etait retire avant que le trapeze arrive.
  //
  // On ne masque desormais le flottant qu'APRES avoir constate un pill.
  await page.goto('/cas-grave.html', ATTENDRE);
  await expect(page.locator('#tabibi-lang-switcher')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('#tabibi-lang-switcher:visible')).toHaveCount(1);
  // Elle n'a pas de barre : rien ne doit lui en poser une.
  expect(await page.locator('[data-lang-btn]').count()).toBe(0);
});

test("l'accueil n'a AUCUN placeholder laisse en plan", async ({ page }) => {
  await page.goto('/accueil-public.html', ATTENDRE);
  await expect(page.locator('[data-lang-btn]')).toHaveCount(3, { timeout: 8000 });
  // Un `[data-langbar]` qui survit, c'est un emplacement que personne n'a
  // rempli — le defaut exact de P-29, sous une autre forme.
  const restants = await page.locator('[data-langbar]:not([data-langbar-ready])').count();
  expect(restants, 'un emplacement de barre de langue est reste vide').toBe(0);
});

test('un seul selecteur : le pill pose, le flottant masque', async ({ page }) => {
  await page.goto('/accueil-public.html', ATTENDRE);
  await expect(page.locator('[data-langbar-ready]')).toHaveCount(1, { timeout: 8000 });
  // Deux selecteurs a l'ecran seraient une regression d'affichage.
  const flottantVisible = await page.locator('#tabibi-lang-switcher:visible').count();
  expect(flottantVisible).toBe(0);
});

test('cliquer AR bascule vraiment la langue', async ({ page }) => {
  // Trois boutons qui ne font rien seraient un succes de facade — la famille
  // du « 500+ inscrits » et du « e-mail envoye ».
  await page.goto('/accueil-public.html', ATTENDRE);
  await expect(page.locator('[data-lang-btn]')).toHaveCount(3, { timeout: 8000 });

  await page.locator('[data-lang-btn="ar"]').click();
  await expect.poll(
    () => page.evaluate(() => document.documentElement.getAttribute('dir')),
    { timeout: 6000 },
  ).toBe('rtl');
  expect(await page.evaluate(() => localStorage.getItem('tabibi_lang'))).toBe('ar');
});

test('deux initialisations ne font pas deux selecteurs', async ({ page }) => {
  // Les pages construites appellent `init()` explicitement ET gardent
  // l'auto-init pour les pages non construites. `inject()` doit donc etre
  // idempotente — sinon le correctif de P-29 en creerait un autre.
  await page.goto('/accueil-public.html', ATTENDRE);
  await expect(page.locator('[data-langbar-ready]')).toHaveCount(1, { timeout: 8000 });

  await page.evaluate(() => {
    window.tabibiLangbar.init();
    window.tabibiLangbar.init();
  });
  await expect(page.locator('[data-langbar-ready]')).toHaveCount(1);
  await expect(page.locator('[data-lang-btn]')).toHaveCount(3);
});
