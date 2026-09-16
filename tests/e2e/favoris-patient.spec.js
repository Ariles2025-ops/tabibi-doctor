// =====================================================================
// Le cœur des favoris ne faisait rien à l'écran
// =====================================================================
// ⚠️ TROUVÉ EN CONSTRUISANT LA GARDE DE P-65, pas en cherchant celui-ci.
//
// `patient-dashboard.html` : `toggFav()` appelait `renderDocs()`, définie
// UNIQUEMENT dans `js/home-app.js` — un fichier que cette page **ne charge
// pas** (23 scripts, pas celui-là). Mesure au navigateur, avant correctif :
//
//     TYPES {"renderDocs":"undefined","toggFav":"function","renderFavs":"function"}
//     APPEL toggFav -> LANCE: renderDocs is not defined
//
// **L'ordre des instructions décidait de tout.** `localStorage.setItem`
// passait, puis la fonction s'arrêtait : `renderFavs()` et le toast ne
// s'exécutaient jamais. Le patient cliquait sur le cœur, le favori changeait
// en mémoire, et rien ne bougeait à l'écran. Il recliquait — le favori
// revenait. Il fallait recharger pour voir l'état vrai.
//
// Même famille que P-65 (`getSupabase` appelé sans exister) : un nom absent,
// une exception, une moitié de fonction qui ne s'exécute pas. Ici il n'y avait
// même pas de `catch` pour l'avaler — juste personne pour lire la console.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS MESURENT
// ---------------------------------------------------------------------
// Pas « la ligne contient `typeof` » : ils APPELLENT `toggFav()` sur la page
// réellement chargée — donc sans `renderDocs` — et regardent si la suite de la
// fonction s'exécute. Un essai qui lirait la source serait vert sur une page
// qui, elle, lèverait quand même.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/patient-dashboard.html';

async function ouvrir(page) {
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => ({ id:'fx', role:'patient', first_name:'Amina', last_name:'Cherif', email:'a@b.test' }),
             getUser:     async () => ({ id:'fx', role:'patient' }),
             signOut: async () => {}, logout: async () => {}
           };`,
  }));
  await page.addInitScript(() => {
    localStorage.setItem('tabibi_lang', 'fr');
    localStorage.setItem('tabibi_favs', '[]');
  });
  await page.goto(PAGE, ATTENDRE);
  // La page pose son écran de façon asynchrone : on attend que la fonction
  // existe plutôt qu'une durée.
  await expect.poll(() => page.evaluate(() => typeof window.toggFav), { timeout: 8000 })
    .toBe('function');
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

test.describe('les favoris du patient', () => {

  test('cette page n’a PAS `renderDocs` — c’est la condition du défaut', async ({ page }) => {
    // ⚠️ SANS CET ESSAI, TOUS LES AUTRES SERAIENT VIDES DE SENS. Le jour où
    // quelqu'un chargerait `js/home-app.js` ici, `renderDocs` existerait, la
    // suite passerait, et les essais resteraient verts **sans rien prouver**.
    // Ils garderaient une page qui n'a plus le problème, pas un correctif.
    await ouvrir(page);
    expect(await page.evaluate(() => typeof window.renderDocs)).toBe('undefined');
  });

  test('cliquer un favori ne LÈVE plus, et la suite s’exécute', async ({ page }) => {
    await ouvrir(page);

    const resultat = await page.evaluate(() => {
      try { window.toggFav('doc-1'); return 'ok'; } catch (e) { return 'LANCE: ' + e.message; }
    });
    expect(resultat, 'toggFav leve encore').toBe('ok');

    // La PREUVE que la suite s'est exécutée : le toast, dernière instruction
    // de la fonction, après `renderFavs()`.
    await expect(page.locator('#toast-container')).toContainText(/favoris/i, { timeout: 4000 });
  });

  test('le favori est bien ajouté, puis retiré — l’état suit les clics', async ({ page }) => {
    await ouvrir(page);

    await page.evaluate(() => window.toggFav('doc-1'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_favs') || '[]')))
      .toEqual(['doc-1']);

    await page.evaluate(() => window.toggFav('doc-1'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_favs') || '[]')))
      .toEqual([]);
  });

  test('aucune erreur de page pendant l’aller-retour', async ({ page }) => {
    // La contre-épreuve de l'essai précédent : le stockage peut être juste
    // pendant que la fonction lève — c'est exactement ce qui se passait, puisque
    // `setItem` précédait l'appel fautif. On regarde donc AUSSI la console.
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(String((e && e.message) || e)));
    await ouvrir(page);

    await page.evaluate(() => { window.toggFav('doc-2'); window.toggFav('doc-2'); });
    await page.waitForTimeout(400);

    expect(erreurs.filter((m) => /renderDocs/.test(m)), 'renderDocs leve encore').toEqual([]);
  });
});
