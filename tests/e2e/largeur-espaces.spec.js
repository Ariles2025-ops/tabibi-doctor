// =====================================================================
// Un tableau de bord dans un couloir de 760 px
// =====================================================================
// ⚠️ SIGNALÉ EN LIVE PAR AGHILES. Sur un écran de bureau, les pages « espace »
// (tableau de bord patient, médecin, mes RDV, notifications…) s'affichaient
// dans une colonne étroite, avec du vide à gauche et à droite.
//
// ---------------------------------------------------------------------
// LE CAP, TROUVÉ ET NON DEVINÉ
// ---------------------------------------------------------------------
//     styles/app.css, @media (min-width:1024px)
//     .page { … max-width: 760px; margin-inline: auto; }
//
// Cette règle est **volontaire** et data du 08/07 : « fin du mobile étiré,
// colonne de lecture centrée ». Elle a raison pour de la prose — une
// confirmation, une page légale, un tunnel. Elle a tort pour un tableau de
// bord, où le shell `.app-root` fait déjà 1100 px (1240 au-delà de 1440).
//
// ⚠️ D'OÙ UN OPT-IN, PAS UN ÉLARGISSEMENT GLOBAL. `class="page page-large"`
// sur les pages espace ; `success.html`, `verify-email.html` et les pages
// légales gardent leur colonne étroite — c'est ce qu'on veut pour elles.
//
// ---------------------------------------------------------------------
// ⚠️ TROIS PAGES POSAIENT UN SECOND CAP, PLUS DUR
// ---------------------------------------------------------------------
//   messages.html        .msg-shell   { max-width: 480px }
//   notifications.html   .notif-shell { max-width: 480px }
//   patient-ordonnances  .wrap        { max-width: 880px }  (et AUCUN `.page`)
//
// Ajouter la classe n'y suffisait pas : leur propre règle gagnait. Une garde
// qui ne mesurerait que `patient-dashboard` les aurait laissées dans le
// couloir.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PATIENT = '00000000-0000-4000-8000-000000000001';

// ⚠️ Largeur de FENÊTRE, pas de viewport « desktop » par défaut : ces essais
// mesurent une décision de mise en page, elle doit être posée explicitement.
const BUREAU = { width: 1280, height: 900 };
const TELEPHONE = { width: 390, height: 844 };

/** Les pages « espace » et le conteneur qui porte leur largeur. */
const ESPACES = [
  ['/patient-dashboard.html', '.page'],
  ['/doctor-dashboard.html', '.page'],
  ['/mes-rdv.html', '.page'],
  ['/patient-profile.html', '.page'],
  ['/notifications.html', '.notif-shell'],
  ['/patient-ordonnances.html', '.wrap'],
];

// ⚠️ `messages.html` N'EST PAS DANS CETTE LISTE, ET CE N'EST PAS UN OUBLI.
// La messagerie est derrière un drapeau ÉTEINT (`tabibi-features.js:93,
// messaging: false`) : la page se redirige avant de se dessiner, et aucune
// largeur n'y est mesurable. Son cap est donc vérifié **à la source**, plus
// bas. Le jour où le drapeau s'allume, la ligne se déplace ici.


async function session(page, role) {
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: ctx.role, name: 'Essai' }));
      localStorage.setItem('tabibi_role', ctx.role);
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: PATIENT, role });
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test', role, status: 'active' }),
  }));
}

/** La largeur RENDUE du conteneur, en pixels. */
const largeur = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? Math.round(el.getBoundingClientRect().width) : null;
}, sel);

test.describe('largeur des espaces connectés', () => {

  // ⚠️ Les deux projets Playwright rejouent chaque essai ; la largeur est
  // imposée ici, donc le verdict ne dépend pas du profil. On ne laisse pas le
  // hasard du projet décider de ce qu'on mesure.
  for (const [chemin, sel] of ESPACES) {
    test(`${chemin} remplit l’écran de bureau`, async ({ page }) => {
      await hermetiser(page);
      await neutraliserCaptcha(page);
      await session(page, chemin.includes('doctor-dashboard') ? 'medecin' : 'patient');
      await page.setViewportSize(BUREAU);
      await page.goto(chemin, ATTENDRE);
      expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');

      await expect(page.locator(sel).first()).toBeAttached({ timeout: 10000 });
      const l = await largeur(page, sel);
      // Seuil : nettement au-delà de la colonne de lecture (760) et du couloir
      // mobile (480). On ne vérifie pas une valeur exacte — elle dépend du
      // shell et des marges, et un essai au pixel près casse au premier
      // ajustement de padding.
      expect(l, `${chemin} : ${l} px sur un écran de 1280 — encore la colonne étroite`)
        .toBeGreaterThan(1000);
    });
  }

  test('sur téléphone, rien ne déborde', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DE L'ÉLARGISSEMENT. Ouvrir une largeur en oubliant
    // le petit écran produit un défilement horizontal — le défaut le plus
    // pénible du web mobile, et celui qu'on ne voit jamais depuis un bureau.
    await hermetiser(page);
    await neutraliserCaptcha(page);
    await session(page, 'patient');
    await page.setViewportSize(TELEPHONE);
    await page.goto('/patient-dashboard.html', ATTENDRE);
    await expect(page.locator('.page').first()).toBeAttached({ timeout: 10000 });

    const debordement = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vue: window.innerWidth,
    }));
    expect(debordement.doc,
      `débordement horizontal : ${debordement.doc} px pour une fenêtre de ${debordement.vue}`)
      .toBeLessThanOrEqual(debordement.vue + 1);   // 1 px de tolérance d'arrondi

    const l = await largeur(page, '.page');
    expect(l, 'le conteneur dépasse l’écran du téléphone').toBeLessThanOrEqual(390);
  });

  test('les pages de LECTURE gardent leur colonne étroite', async ({ page }) => {
    // ⚠️ L'AUTRE MOITIÉ, et la raison de l'opt-in. Élargir `.page` pour tout le
    // monde étirerait aussi les confirmations et les pages légales, où 760 px
    // est un choix de lisibilité — pas un oubli.
    await hermetiser(page);
    await neutraliserCaptcha(page);
    await page.addInitScript(() => { try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {} });
    await page.setViewportSize(BUREAU);
    await page.goto('/success.html', ATTENDRE);

    await expect(page.locator('.page').first()).toBeAttached({ timeout: 10000 });
    const l = await largeur(page, '.page');
    expect(l, `success.html s’est élargie à ${l} px : la colonne de lecture a sauté`)
      .toBeLessThanOrEqual(800);
  });

  test('messagerie (drapeau éteint) : son cap est levé à la source', async ({ page }) => {
    // ⚠️ On ne peut pas la mesurer — elle se redirige. On vérifie donc ce qu'on
    // PEUT vérifier, et on dit lequel : le second cap de 480 px est surchargé
    // au-delà de 1024. Un essai qui prétendrait mesurer la page serait faux.
    const html = await page.request.get('/messages.html').then((r) => r.text());
    expect(html, 'la page espace ne se déclare plus large').toContain('page page-large');
    // ⚠️ ON N'EXIGE PAS DE SURCHARGE `@media` ICI, et c'est une correction.
    // J'en avais ajouté une ; ma contre-épreuve l'a retirée et tout est resté
    // vert : `.page.page-large` (0,2,0) bat `.msg-shell` (0,1,0) sur le même
    // élément. Exiger du code mort dans une garde, c'est le rendre
    // indéboulonnable. Le comportement réel est mesuré sur `notifications.html`,
    // qui a exactement la même structure et qui, elle, se charge.
    expect(html, 'le cap mobile de 480 px a disparu — il sert en dessous de 1024')
      .toMatch(/\.msg-shell\s*\{[^}]*max-width:\s*480px/);
  });

  test('la règle est un OPT-IN — la classe existe dans la feuille partagée', async ({ page }) => {
    // Contre-épreuve de source : si quelqu'un retire la règle, les pages
    // gardent leur classe et retombent silencieusement à 760 px.
    const css = await page.request.get('/styles/app.css').then((r) => r.text());
    expect(css, 'la règle `.page.page-large` a disparu de la feuille partagée')
      .toMatch(/\.page\.page-large\s*\{[^}]*max-width:\s*none/);
    expect(css, 'la colonne de lecture par défaut a été supprimée au lieu d’être surchargée')
      .toMatch(/\.page\s*\{[^}]*max-width:\s*760px/);
  });
});
