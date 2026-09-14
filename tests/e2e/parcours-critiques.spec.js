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
// [14/09/2026] AUCUNE REQUETE HORS LOCALHOST. Voir tests/e2e/_hermetique.js :
// la CI rougissait sur une dependance reseau (Sentry CDN sur chaque page,
// Turnstile sur les pages d'authentification) que le local ne voyait pas.
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

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
// [INVERSION 2026-09-13] Ce test affirmait « le site ne doit pas servir la page
// Coming Soon par accident » sur `/index.html`. C'est exactement l'hypothese
// qu'on vient d'inverser : `index.html` a la racine EST desormais la page
// fermee, DELIBEREMENT, et l'application vit dans `accueil-public.html`.
//
// Avant, l'app etait a la racine et un geste la fermait — donc tout hebergeur
// qui ne lance pas `scripts/porte.mjs` servait l'app ouverte sur la base de
// production. C'est arrive sur Netlify. Le test gardait la mauvaise moitie.
//
// Il garde desormais les DEUX : la porte est bien fermee a la racine, et
// l'application se charge toujours la ou elle vit.
test("la racine sert la page fermee, deliberement", async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Tabibi/i);
  expect(await page.title()).toMatch(/bientôt disponible/i);

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

test("l'application se charge et affiche le hero", async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/accueil-public.html`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Tabibi/i);
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await page.title()).not.toMatch(/bientôt disponible/i);

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 2. Inscription — le tunnel d'entrée des médecins et patients
// ---------------------------------------------------------------------
// [CORRIGE 2026-09-09] Ce test attendait un champ email VISIBLE. Il n'y en a
// pas : l'inscription se fait par TELEPHONE (#sp) puis code SMS — c'est la
// decision produit « SMS-only en DZ », mesuree sur le reseau algerien. Le test
// avait ete ecrit sans jamais etre execute, Playwright n'etant pas installe.
// Il verifie desormais le parcours reel, consentements RGPD compris : sur une
// plateforme de sante, une case de consentement qui disparait est un incident
// juridique, pas un detail d'interface.
test("la page d'inscription affiche le formulaire telephone et les consentements", async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/signup.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#sp')).toBeVisible();          // telephone
  await expect(page.locator('#spw')).toBeVisible();         // mot de passe
  await expect(page.locator('#sw')).toBeVisible();          // wilaya
  await expect(page.locator('button[type="submit"]').first()).toBeVisible();

  for (const consentement of ['#cgu', '#privacy', '#medical-consent']) {
    await expect(page.locator(consentement)).toBeVisible();
  }

  expect(erreurs, `Erreurs console:\n${erreurs.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------
// 3. Connexion — sans elle, aucun médecin n'accède à son agenda
// ---------------------------------------------------------------------
// [CORRIGE 2026-09-09] Meme correction : le seul champ email de login.html vit
// dans <div id="screen-admin" class="hidden">, l'ecran de connexion admin. Le
// parcours principal est le telephone (#lp-phone). Un test qui affirme le
// mauvais parcours donne une fausse assurance : il serait reste vert alors que
// la connexion des medecins etait cassee.
test('la page de connexion affiche le formulaire telephone', async ({ page }) => {
  const erreurs = collecteErreurs(page);
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#lp-phone')).toBeVisible();
  await expect(page.locator('#lp-pass')).toBeVisible();
  await expect(page.locator('button[type="submit"]').first()).toBeVisible();

  // L'ecran admin doit rester masque tant qu'on n'a pas clique le lien dedie.
  await expect(page.locator('#screen-admin')).toBeHidden();

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
