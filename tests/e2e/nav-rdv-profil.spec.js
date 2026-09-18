// =====================================================================
// « Profil » renvoyait un patient CONNECTÉ vers l'écran de connexion
// =====================================================================
// ⚠️ SIGNALÉ AU SOURCE : les entrées « rdv » et « profile » de la barre du bas
// déclaraient `href: '#'`.
//
// ---------------------------------------------------------------------
// CE QUE J'AI MESURÉ AVANT D'ÉCRIRE — le diagnostic était à moitié faux
// ---------------------------------------------------------------------
// Ces boutons n'étaient **pas morts** : `tabClick` a une branche dédiée pour
// `rdv`/`profile` et n'utilise jamais leur `href`. « Mes RDV » marchait.
//
// **Le vrai défaut est ailleurs, et il est pire** : le repli envoyait vers
// `login.html` **sans regarder la session**.
//
//     if (typeof window.isLogged === 'function') { … }   ← n'existe QUE sur l'accueil
//     go((id === 'rdv') ? 'mes-rdv.html' : 'login.html');
//
// `window.isLogged` et `window.goDash` viennent de `js/home-app.js`, chargé par
// l'accueil **et par lui seul**. Partout ailleurs — mes-rdv, réservation,
// dawini, notifications — un patient **déjà connecté** qui touchait « Profil »
// atterrissait sur l'écran de connexion.
//
// ---------------------------------------------------------------------
// LA RÉSOLUTION
// ---------------------------------------------------------------------
// `TABIBI_CONFIG.REDIRECTS` — la table que `auth.js` utilise déjà après une
// connexion — et `tabibi_user` dans `localStorage`, la même source que
// `loadUser()` et `_peutRevendiquer()`. **On ne réécrit pas une seconde liste
// rôle → page** : elle divergerait au premier rôle ajouté.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

// ⚠️ Une SOUS-PAGE, pas l'accueil. Sur l'accueil, `window.isLogged` existe et
// le défaut ne se voit pas — c'est précisément pour ça qu'il a survécu.
//
// ⚠️ ET PAS LA MÊME POUR TOUS LES RÔLES. `mes-rdv.html` appelle
// `requireAuth('patient')` (l.658) : un médecin y est redirigé vers SON espace
// avant même que la barre du bas existe. Mesuré — mon premier essai « médecin »
// échouait à l'ouverture, pour une raison étrangère à ce qu'il garde.
// `notifications.html` accepte n'importe quel rôle connecté.
const PAGE_PATIENT = '/mes-rdv.html';
const PAGE_TOUT_ROLE = '/notifications.html';
const UID = '00000000-0000-4000-8000-000000000001';

async function ouvrir(page, role, chemin) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'p@example.test' },
      }));
      if (ctx.role) {
        localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: ctx.role, name: 'Essai' }));
        localStorage.setItem('tabibi_role', ctx.role);
      } else {
        localStorage.removeItem('tabibi_user');
        localStorage.removeItem('tabibi_role');
      }
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: UID, role });
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: UID, email: 'p@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: UID, email: 'p@example.test', role: role || 'patient', status: 'active' }),
  }));
  await page.goto(chemin || PAGE_PATIENT, ATTENDRE);
  expect(page.url(), 'redirigé : la page choisie refuse ce rôle').not.toContain('login.html');
  await expect(page.locator('#tab-bar .tab-item[data-tab="profile"]')).toBeVisible({ timeout: 10000 });
}

test.describe('barre du bas — « Mes RDV » et « Profil »', () => {

  test('PATIENT connecté : « Profil » mène à SON espace, pas à la connexion', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE. C'est le défaut réel : un connecté renvoyé vers
    // l'écran de connexion, partout sauf sur l'accueil.
    await ouvrir(page, 'patient');
    await page.locator('#tab-bar .tab-item[data-tab="profile"]').click();

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('patient-dashboard.html');
    expect(page.url(), 'un patient connecté est renvoyé vers la connexion')
      .not.toContain('login.html');
  });

  test('MÉDECIN connecté : « Profil » mène au tableau de bord médecin', async ({ page }) => {
    // La table `TABIBI_CONFIG.REDIRECTS` couvre tous les rôles : si on avait
    // écrit « patient → dashboard, sinon login », un médecin connecté serait
    // resté devant l'écran de connexion.
    await ouvrir(page, 'medecin', PAGE_TOUT_ROLE);
    await page.locator('#tab-bar .tab-item[data-tab="profile"]').click();

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('doctor-dashboard.html');
  });

  test('VISITEUR : « Profil » mène bien à la connexion', async ({ page }) => {
    // L'autre moitié : on n'a pas remplacé un mauvais aiguillage par un autre.
    await ouvrir(page, null, PAGE_TOUT_ROLE);
    await page.locator('#tab-bar .tab-item[data-tab="profile"]').click();

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('login.html');
  });

  test('« Mes RDV » mène à mes-rdv.html', async ({ page }) => {
    // Il marchait déjà : on le garde pour que le câblage des `href` ne le casse
    // pas au passage.
    await ouvrir(page, 'patient', PAGE_TOUT_ROLE);
    await page.locator('#tab-bar .tab-item[data-tab="rdv"]').click();

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('mes-rdv.html');
  });

  test('AUCUNE entrée de la barre ne déclare `href: \'#\'`', async ({ page }) => {
    // ⚠️ Contre-épreuve de source. Un `'#'` ne dit rien à qui lit le fichier, et
    // rien non plus au remappage du bundle desktop (`safeHref`), qui travaille
    // sur des chemins. Une cible déclarée est une cible vérifiable.
    const src = await page.request.get('/js/tabibi-nav.js').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    const declarations = [...nu.matchAll(/id:\s*'([a-z]+)'[^}]*href:\s*'([^']*)'/g)]
      .map((m) => ({ id: m[1], href: m[2] }));
    expect(declarations.length, 'les six onglets ne déclarent plus leur cible')
      .toBeGreaterThanOrEqual(6);
    for (const d of declarations) {
      expect(d.href, `l’onglet « ${d.id} » déclare une cible vide`).not.toBe('#');
      expect(d.href, `l’onglet « ${d.id} » vise la porte fermée`).not.toMatch(/^index\.html/);
    }
  });

  test('la table des espaces n’est pas recopiée dans la barre', async ({ page }) => {
    // ⚠️ Une seconde liste rôle → page divergerait au premier rôle ajouté.
    // La barre doit LIRE `TABIBI_CONFIG.REDIRECTS`, pas la dupliquer.
    const src = await page.request.get('/js/tabibi-nav.js').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    expect(nu, 'la barre n’utilise plus la table partagée des espaces')
      .toMatch(/TABIBI_CONFIG[\s\S]{0,40}REDIRECTS/);
    expect(nu, 'un tableau de bord est recopié en dur dans la barre')
      .not.toMatch(/'(?:patient|doctor|admin)-dashboard\.html'/);
  });
});
