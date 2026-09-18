// =====================================================================
// 75 035 épingles sans coordonnées, et une carte qui casse à la première
// =====================================================================
// ⚠️ MESURÉ EN BASE LE 18/09, pas supposé :
//
//     doctor_profiles : 75 035 lignes · AVEC GPS : 0 · SANS GPS : 75 035
//
// Pas « presque aucune » : **aucune**. Chaque `L.marker([null, null])` jette
// (« Invalid LatLng object »), et l'exception part d'un `forEach` — elle
// interrompt donc le rendu **entier** : compteur jamais mis à jour, et sur un
// clic de filtre (`_tbMapFilter`), rien ne rattrape le jet.
//
// ---------------------------------------------------------------------
// ON IGNORE, ON NE REMPLACE PAS
// ---------------------------------------------------------------------
// Poser ces médecins au centre de leur wilaya — ou pire, au centre du pays —
// **inventerait une adresse** : la carte dirait « ce médecin est ICI » alors
// que personne ne le sait. C'est la même faute que les quatre praticiens
// inventés de la vitrine (P-64), en plus difficile à repérer.
//
// La couche des **bulles par wilaya** dit une chose vraie — « environ N
// médecins dans cette région » — et ne dépend d'aucun GPS. C'est elle qui
// porte la vue, et ce lot n'y touche pas.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

/** Ce que rend `praticiens_carte` aujourd'hui : tout le monde sans GPS. */
function praticien(i, surcharge) {
  return {
    id: `00000000-0000-4000-8000-${String(700 + i).padStart(12, '0')}`,
    full_name: `Essai ${i}`, entity_type: 'doctor',
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, city: 'Alger-Centre',
    rating: 4.5, review_count: 3, is_verified: true,
    latitude: null, longitude: null,
    ...surcharge,
  };
}

const STATS = {
  medecins: 75035, certifies: 1,
  par_wilaya: { 16: 12000, 31: 8000, 9: 3000 },
};

async function ouvrirCarte(page, praticiens) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      // ⚠️ Le cache de session garderait les compteurs d'un essai précédent.
      sessionStorage.removeItem('tb_map_wcounts_v1');
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
    window.__erreurs = [];
    window.addEventListener('error', (ev) => window.__erreurs.push(String(ev.message)));
    window.addEventListener('unhandledrejection',
      (ev) => window.__erreurs.push('rejet: ' + String(ev.reason && ev.reason.message)));
  });

  const vide = { total: 0, page: 1, limite: 20, lignes: [] };
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(vide) }));
  await page.route('**/rest/v1/rpc/praticiens_carte', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(praticiens) }));
  await page.route('**/rest/v1/rpc/stats_publiques', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(STATS) }));

  await page.goto('/accueil-public.html', ATTENDRE);
  await expect(page.locator('#name-search')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => window.openMapOverlay());
  await expect(page.locator('#map-overlay')).toBeVisible({ timeout: 8000 });
}

const erreurs = (page) => page.evaluate(() => window.__erreurs || []);
const bulles = (page) => page.locator('#map-overlay .tb-bubble').count();
const epingles = (page) => page.locator('#map-overlay .tb-pin').count();

test.describe('carte — 75 035 médecins sans coordonnées', () => {

  test('ouvrir la carte ne jette AUCUNE erreur', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE. Une seule coordonnée nulle suffisait à
    // interrompre le rendu de toute la couche.
    await ouvrirCarte(page, [praticien(1), praticien(2), praticien(3)]);

    // Les bulles arrivent après `stats_publiques` : on attend un fait.
    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThan(0);
    expect(await erreurs(page), 'la carte jette').toEqual([]);
  });

  test('les BULLES par wilaya s’affichent — c’est la vue voulue', async ({ page }) => {
    // Elles ne dépendent d'aucun GPS : `DZ_WILAYAS` + `stats_publiques`.
    // Ce lot ne doit pas les avoir touchées.
    await ouvrirCarte(page, [praticien(1), praticien(2)]);

    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThanOrEqual(3);
    const texte = await page.locator('#map-overlay .tb-bubble').first().innerText();
    expect(texte.trim(), 'la bulle n’affiche aucun compte').not.toBe('');
  });

  test('AUCUNE épingle n’est créée pour un médecin sans coordonnées', async ({ page }) => {
    await ouvrirCarte(page, [praticien(1), praticien(2), praticien(3)]);
    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThan(0);

    expect(await epingles(page), 'des épingles apparaissent sans coordonnées').toBe(0);
  });

  test('un médecin AVEC coordonnées est bien épinglé — on n’a pas tout coupé', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DU GARDE. Une garde qui ne vérifie que l'absence
    // finit par faire supprimer la couche. Le jour où la base aura des
    // coordonnées, les épingles doivent revenir sans qu'on y retouche.
    await ouvrirCarte(page, [
      praticien(1),
      praticien(2, { latitude: 36.7538, longitude: 3.0588 }),
      praticien(3),
    ]);
    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThan(0);

    await expect.poll(() => epingles(page), { timeout: 8000 }).toBe(1);
    expect(await erreurs(page)).toEqual([]);
  });

  test('coordonnées EN CHAÎNE : ignorées, et sans jeter', async ({ page }) => {
    // ⚠️ `Number.isFinite('36.75')` est FAUX, et c'est voulu : on n'accepte pas
    // une coordonnée dont on devrait deviner le type. Si la base se met à
    // renvoyer des chaînes, la carte n'affiche rien plutôt que d'inventer — et
    // cet essai le dit tout de suite.
    await ouvrirCarte(page, [praticien(1, { latitude: '36.75', longitude: '3.05' })]);
    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThan(0);

    expect(await epingles(page)).toBe(0);
    expect(await erreurs(page), 'une coordonnée en chaîne fait jeter la carte').toEqual([]);
  });

  test('le FILTRE par wilaya ne jette pas non plus', async ({ page }) => {
    // ⚠️ C'est le chemin le plus exposé : `_tbMapFilter` est appelé depuis un
    // clic, où rien ne rattrape une exception. Le rendu initial pouvait
    // paraître correct et le premier clic tout casser.
    await ouvrirCarte(page, [praticien(1), praticien(2)]);
    await expect.poll(() => bulles(page), { timeout: 10000 }).toBeGreaterThan(0);

    await page.locator('#map-overlay .tb-bubble').first().click();
    await page.waitForFunction(() => true);
    expect(await erreurs(page), 'filtrer la carte jette').toEqual([]);
  });

  test('l’onglet Carte ouvre bien la surcouche', async ({ page }) => {
    // Demandé par le SEQ : vérifier que `#carte` est toujours câblé
    // (P-91 l'a branché sur `openMapOverlay` à l'arrivée).
    await ouvrirCarte(page, [praticien(1)]);
    await page.evaluate(() => window.closeMapOverlay());
    await expect(page.locator('#map-overlay')).toBeHidden();

    await page.evaluate(() => window.tabClick('carte', '#carte'));
    await expect(page.locator('#map-overlay')).toBeVisible({ timeout: 8000 });
  });
});
