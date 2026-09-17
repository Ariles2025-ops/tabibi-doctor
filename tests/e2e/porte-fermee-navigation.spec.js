// =====================================================================
// Les chemins de retour mènent à l'accueil OUVERT, et il répond
// =====================================================================
// ⚠️ La moitié « personne ne vise la porte close » est tenue par
// `tests/porte-fermee-liens.test.mjs`, qui parcourt **tout le dépôt** — une
// page ajoutée demain y sera attrapée sans qu'on l'inscrive nulle part.
//
// Ce fichier-ci tient l'autre moitié, celle qu'un essai de fichiers ne peut pas
// voir : **la cible répond**. Interdire `index.html` sans vérifier où l'on
// arrive remplacerait une mauvaise destination par aucune — et un lien vers
// une page absente ne lève pas d'erreur non plus, il affiche un 404 que
// personne ne surveille.
//
// ---------------------------------------------------------------------
// CE QUI EST MESURÉ
// ---------------------------------------------------------------------
//   · les cibles sont servies (200) et ce sont bien l'accueil ouvert
//   · « Trouver un médecin » depuis l'espace patient AMÈNE au champ de
//     recherche, pas seulement à la page
//   · la déconnexion ne dépose plus personne devant la porte close
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PATIENT = '00000000-0000-4000-8000-000000000001';

async function sessionPatient(page) {
  await page.addInitScript((id) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'patient', name: 'Essai Patient' }));
      localStorage.setItem('tabibi_role', 'patient');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, PATIENT);
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test', role: 'patient', status: 'active' }),
  }));
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

test('les deux cibles sont servies, et ce sont les bonnes', async ({ page }) => {
  const accueil = await page.request.get('/accueil-public.html');
  expect(accueil.status(), 'l’accueil ouvert ne répond pas').toBe(200);
  const html = await accueil.text();
  expect(html, 'l’ancre #name-search a disparu').toContain('id="name-search"');

  // ⚠️ Et la porte close reste la porte close : sans ça, cet essai serait vert
  // le jour où quelqu'un défait l'inversion du 13/09 — et tous les liens
  // repointés deviendraient un détour inutile.
  const porte = await page.request.get('/index.html');
  expect(porte.status()).toBe(200);
  expect(await porte.text(), 'index.html n’est plus la page fermée')
    .toMatch(/Bient[oô]t disponible/i);
});

test('« Trouver un médecin » depuis l’espace patient amène AU CHAMP de recherche', async ({ page }) => {
  // ⚠️ Pas seulement « à la page ». Ces boutons disent « trouver » : arriver en
  // haut d'un accueil sans voir la barre de recherche, c'est le même défaut que
  // la loupe qui menait aux filtres (P-86).
  await sessionPatient(page);
  await page.goto('/patient-dashboard.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');

  const bouton = page.locator('[onclick*="accueil-public.html#name-search"]').first();
  await expect(bouton).toBeAttached({ timeout: 10000 });
  await bouton.scrollIntoViewIfNeeded();
  await bouton.click();

  await expect.poll(() => page.url(), { timeout: 10000 }).toContain('accueil-public.html');
  expect(page.url(), 'l’ancre est perdue en route').toContain('#name-search');
  await expect(page.locator('#name-search')).toBeVisible({ timeout: 10000 });
  expect(page.url(), 'on atterrit sur la porte fermée').not.toContain('index.html');
});

test('la DÉCONNEXION ne dépose plus personne devant la porte close', async ({ page }) => {
  // ⚠️ C'est la redirection la plus centrale du dépôt : `auth.signOut()` la lit
  // pour TOUS les rôles. Une page peut oublier son attribut ; celle-ci
  // s'applique à tout le monde, à chaque déconnexion.
  await page.goto('/login.html', ATTENDRE);
  const cible = await page.evaluate(() =>
    (window.TABIBI_CONFIG && window.TABIBI_CONFIG.REDIRECTS &&
     window.TABIBI_CONFIG.REDIRECTS.afterLogout) || null);

  expect(cible, 'afterLogout n’est plus défini').toBeTruthy();
  expect(cible, 'la déconnexion renvoie sur la porte fermée').not.toContain('index.html');
  expect(cible).toContain('accueil-public.html');

  // Et la cible répond — un `afterLogout` vers une page absente serait pire.
  expect((await page.request.get('/' + cible.split('#')[0])).status()).toBe(200);
});

test('l’en-tête partagé vise l’accueil ouvert, y compris sans attribut', async ({ page }) => {
  // `js/tabibi-header.js` construit le logo et la flèche retour depuis
  // `data-home` / `data-back`. Les pages les posent ; le DÉFAUT s'applique à
  // celles qui les oublient — et c'est lui qui visait la porte close.
  await sessionPatient(page);
  await page.goto('/patient-dashboard.html', ATTENDRE);

  // ⚠️ ON LIT `header.app-bar`, PAS LE PLACEHOLDER. `render()` fait
  // `ph.parentNode.replaceChild(header, ph)` : l'attribut `data-tabibi-header`
  // n'existe PLUS une fois l'en-tête construit. Ma première version cherchait
  // le placeholder et trouvait zéro lien — elle aurait été rouge avec ou sans
  // le correctif.
  await expect(page.locator('header.app-bar')).toBeAttached({ timeout: 10000 });
  const liens = await page.locator('header.app-bar a').evaluateAll(
    (as) => as.map((a) => a.getAttribute('href') || ''));
  expect(liens.length, 'l’en-tête partagé ne rend aucun lien').toBeGreaterThan(0);
  for (const href of liens) {
    expect(href, `un lien de l’en-tête vise la porte fermée : ${href}`).not.toMatch(/^index\.html/);
  }
});

test('les pages légales reviennent vers l’accueil ouvert — avec le bon `../`', async ({ page }) => {
  // ⚠️ Elles vivent dans `legal/` : un chemin relatif mal préfixé donnerait
  // `legal/accueil-public.html`, qui n'existe pas. Le repointage d'un
  // sous-répertoire n'est pas un simple remplacement de texte.
  const html = await page.request.get('/legal/cgu.html').then((r) => r.text());
  expect(html, 'le retour des pages légales vise encore la porte fermée')
    .not.toMatch(/href="\.\.\/index\.html"/);
  expect(html).toMatch(/href="\.\.\/accueil-public\.html"/);

  await page.goto('/legal/cgu.html', ATTENDRE);
  const retour = page.locator('a.back').first();
  await expect(retour).toBeVisible({ timeout: 8000 });
  await retour.click();
  await expect.poll(() => page.url(), { timeout: 10000 }).toContain('accueil-public.html');
  await expect(page.locator('#name-search')).toBeAttached({ timeout: 10000 });
});
