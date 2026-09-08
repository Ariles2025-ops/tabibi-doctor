// =====================================================================
// Tests de non-régression — parcours critiques Tabibi
// ---------------------------------------------------------------------
// But : détecter en 2 minutes si un déploiement casse un parcours vital,
// au lieu de l'apprendre par un médecin au téléphone.
//
// Ces tests ne créent AUCUNE donnée en base : ils vérifient que les
// pages se chargent, que les éléments d'interface existent et que la
// console ne crache pas. C'est le filet minimum, pas une suite complète.
//
// Lancer :
//   1. Terminal A : python3 -m http.server 8899
//   2. Terminal B : npx playwright test tests/e2e
// =====================================================================

const { test, expect } = require('@playwright/test');

const BASE = process.env.TABIBI_BASE || 'http://localhost:8899';

// Erreurs console tolérées (bruit connu, sans impact fonctionnel)
const BRUIT_TOLERE = [
  /favicon/i,
  /Failed to load resource.*service-worker/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
  /turnstile/i,        // captcha absent en local
  /sentry/i,           // pas de DSN en local
  /facebook|fbevents/i // pixel non consenti
];

function collecteErreurs(page) {
  const erreurs = [];
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const txt = msg.text();
    if (BRUIT_TOLERE.some(re => re.test(txt))) return;
    erreurs.push(txt);
  });
  page.on('pageerror', err => erreurs.push('pageerror: ' + err.message));
  return erreurs;
}

// ---------------------------------------------------------------------
// 1. Page d'accueil — la vitrine doit s'afficher
// ---------------------------------------------------------------------
test("l'accueil se charge et affiche le hero", async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Tabibi/i);
  await expect(page.locator('h1').first()).toBeVisible();

  // Le site ne doit pas servir la page Coming Soon par accident
  const titre = await page.title();
  expect(titre).not.toMatch(/bientôt disponible/i);

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 2. Inscription — le tunnel d'entrée des médecins et patients
// ---------------------------------------------------------------------
test("la page d'inscription affiche un formulaire utilisable", async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/signup.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('button[type="submit"], form button').first()).toBeVisible();

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 3. Connexion — sans elle, aucun médecin n'accède à son agenda
// ---------------------------------------------------------------------
test('la page de connexion affiche un formulaire utilisable', async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 4. Réservation — le cœur du produit
// ---------------------------------------------------------------------
test('la page de réservation se charge sans erreur', async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/reservation.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toBeVisible();
  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 5. Dawini — la recherche de médicaments
// ---------------------------------------------------------------------
test('Dawini se charge sans erreur', async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/dawini.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toBeVisible();
  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 6. Garde-fou anti-régression : les pages clés répondent toutes en 200
// ---------------------------------------------------------------------
const PAGES_VITALES = [
  'index.html', 'login.html', 'signup.html', 'reservation.html',
  'dawini.html', 'mes-rdv.html', 'doctor-dashboard.html',
  'patient-dashboard.html', 'telecharger.html', 'about.html'
];

for (const p of PAGES_VITALES) {
  test(`page vitale disponible : ${p}`, async ({ page }) => {
    const reponse = await page.goto(`${BASE}/${p}`, { waitUntil: 'commit' });
    expect(reponse.status(), `${p} doit répondre 200`).toBe(200);
  });
}
