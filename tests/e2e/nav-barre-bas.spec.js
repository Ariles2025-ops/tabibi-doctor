// =====================================================================
// La barre du bas renvoyait l'utilisateur DEHORS — sur la porte fermée
// =====================================================================
// ⚠️ SIGNALÉ PAR LE STRATÈGE. Depuis une sous-page (mes RDV, réservation,
// dawini…), toucher **Accueil**, **Spécialités**, **Carte** ou la **loupe**
// menait à `index.html` — c'est-à-dire, depuis l'inversion du 13/09, à la page
// « Bientôt disponible ». Un utilisateur déjà **dans** l'application se
// retrouvait devant la porte close.
//
// ---------------------------------------------------------------------
// DEUX FAUTES QUI SE CACHAIENT L'UNE L'AUTRE
// ---------------------------------------------------------------------
// 1. La mauvaise **page** : `index.html` est la porte fermée ; l'application
//    vit dans `accueil-public.html` (`scripts/verifier-porte.mjs` le tient).
// 2. La mauvaise **ancre** : `#sec-spec` et `#name-search` n'existent QUE sur
//    `accueil-public.html`. La cible portait donc une ancre introuvable sur la
//    page visée — corriger l'une sans l'autre n'aurait rien donné.
//
// ---------------------------------------------------------------------
// ⚠️ POURQUOI LA GARDE DE LA LOUPE (P-86) N'A PAS VU ÇA
// ---------------------------------------------------------------------
// Elle s'ouvre sur l'accueil, où le cas spécial `id === 'search'` trouve le
// champ et met le focus **sans jamais naviguer**. Le repli — la ligne
// `go(href)` qui partait sur la porte fermée — n'était sur aucun de ses
// chemins. **Une garde ne couvre que le chemin qu'elle emprunte** ; celle-ci
// part donc d'une SOUS-PAGE, là où le repli est le seul chemin possible.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

// ⚠️ MESURÉ EN ÉCRIVANT CET ESSAI : **les huit pages qui portent la barre du
// bas sont derrière la connexion**, sauf l'accueil lui-même. Ma première
// version partait de `dawini.html` en la croyant publique — elle a filé sur
// `login.html?next=/dawini.html`, et les sept essais sont sortis rouges alors
// que le correctif était bon.
//
// C'est la conséquence, pas une gêne d'essai : **ce défaut ne frappe QUE des
// gens connectés**, déjà à l'intérieur de l'application, à qui la barre du bas
// proposait la sortie. On pose donc une session, comme `accessibilite.spec.js`,
// et on vérifie qu'on n'a PAS été redirigé avant de mesurer quoi que ce soit.
const SOUS_PAGE = '/mes-rdv.html';
const PATIENT = '00000000-0000-4000-8000-000000000001';

/** Une session de patient, posée avant le premier script de la page. */
async function sessionPatient(page) {
  const demain = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript(({ exp, id }) => {
    try {
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer', expires_at: exp,
        refresh_token: 'r', user: { id, email: 'p@example.test' },
      }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'patient' }));
      localStorage.setItem('tabibi_role', 'patient');
    } catch (e) { /* stockage bloqué : la page redirigera, l'essai le dira */ }
  }, { exp: demain, id: PATIENT });
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }),
  }));
}

const ONGLETS = {
  home: { attendu: 'accueil-public.html', ancre: '' },
  spec: { attendu: 'accueil-public.html', ancre: '#sec-spec' },
  search: { attendu: 'accueil-public.html', ancre: '#name-search' },
  carte: { attendu: 'accueil-public.html', ancre: '#carte' },
};

/** Un visiteur qui a déjà répondu au bandeau cookies (il recouvre la barre — P-87). */
async function consentementDeja(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
    } catch (e) { /* stockage bloqué : le bandeau restera, l'essai le dira */ }
  });
}

async function ouvrirSousPage(page) {
  await consentementDeja(page);
  await sessionPatient(page);
  await page.goto(SOUS_PAGE, ATTENDRE);
  // ⚠️ On le DIT si la session n'a pas pris, au lieu de mesurer un écran de
  // connexion en croyant mesurer une sous-page.
  expect(page.url(), 'la session n’a pas pris : on est sur l’écran de connexion')
    .not.toContain('login.html');
  await expect(page.locator('#tab-bar .tab-item[data-tab="home"]')).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => { try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {} });
});

test.describe('la barre du bas, depuis une sous-page', () => {

  for (const [id, { attendu, ancre }] of Object.entries(ONGLETS)) {
    test(`l’onglet « ${id} » mène à l’accueil ouvert, jamais à la porte fermée`, async ({ page }) => {
      await ouvrirSousPage(page);
      await page.locator(`#tab-bar .tab-item[data-tab="${id}"]`).click();

      // On attend que l'URL change — un fait, pas une durée.
      await expect.poll(() => page.url(), { timeout: 8000 }).toContain(attendu);

      const url = page.url();
      // ⚠️ LE CŒUR DE LA GARDE. `index.html` est la porte fermée : y arriver
      // depuis l'intérieur de l'application est le défaut qu'on ferme.
      expect(url, 'la barre du bas renvoie sur la porte fermée').not.toContain('index.html');
      if (ancre) expect(url, `l’ancre ${ancre} est perdue en route`).toContain(ancre);
    });
  }

  test('la loupe arrive sur la page où le champ EXISTE', async ({ page }) => {
    // ⚠️ Ce que cet essai NE prouve PAS : le focus. Depuis une sous-page, le
    // navigateur change de page ; le curseur dans le champ est le comportement
    // de l'accueil, gardé par `loupe-recherche.spec.js` (P-86). Ici on garde la
    // moitié qui manquait : **arriver là où le champ existe**, au lieu d'une
    // ancre introuvable sur une page fermée.
    await ouvrirSousPage(page);
    await page.locator('#tab-bar .tab-item[data-tab="search"]').click();

    await expect(page.locator('#name-search')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('#name-search');
  });

  test('l’onglet « Spécialités » arrive sur une section qui EXISTE vraiment', async ({ page }) => {
    // Une ancre qui ne correspond à rien ne fait pas d'erreur : la page
    // s'affiche en haut et personne ne sait qu'elle a raté sa cible. On exige
    // donc l'élément, pas seulement l'URL.
    await ouvrirSousPage(page);
    await page.locator('#tab-bar .tab-item[data-tab="spec"]').click();

    await expect(page.locator('#sec-spec')).toBeAttached({ timeout: 10000 });
  });

  test('l’onglet « Carte » OUVRE la carte — pas un cul-de-sac', async ({ page }) => {
    // ⚠️ LA MOITIÉ QU'ON OUBLIE. Il n'existe aucun `id="carte"` dans le dépôt :
    // la carte est une surcouche `hidden` qu'on OUVRE. Envoyer l'onglet sur
    // `accueil-public.html#carte` sans rien à l'arrivée aurait remplacé une
    // porte fermée par une page d'accueil muette — on ne remplace pas un
    // mensonge par un cul-de-sac.
    await ouvrirSousPage(page);
    await page.locator('#tab-bar .tab-item[data-tab="carte"]').click();

    await expect(page.locator('#map-overlay')).toBeVisible({ timeout: 10000 });
  });

  test('AUCUN onglet ne déclare `index.html` dans la source', async ({ page }) => {
    // ⚠️ La contre-épreuve de source. Sans elle, quelqu'un pourrait remettre
    // `index.html` sur un onglet que les essais ci-dessus ne cliquent pas
    // (rdv, profil) — et personne ne le saurait avant l'ouverture de la porte.
    const src = await page.request.get('/js/tabibi-nav.js').then((r) => r.text());
    // ⚠️ LES COMMENTAIRES D'ABORD, ET LES LIGNES AVANT LES BLOCS. Ce fichier
    // PARLE d'`index.html` (c'en est le sujet) : une garde qui lit ses propres
    // explications s'accuse elle-même. Onzième fois dans ce dépôt qu'on paie
    // cet ordre-là.
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    const cibles = [...nu.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(cibles.length, 'plus aucun onglet ne déclare de cible').toBeGreaterThanOrEqual(6);
    for (const c of cibles) {
      expect(c, `un onglet vise encore la porte fermée : ${c}`).not.toContain('index.html');
    }
    // Les replis de `tabClick` aussi — c'est par là que le défaut passait.
    expect(nu, 'un repli de tabClick vise encore la porte fermée').not.toContain("go('index.html");
    expect(nu).not.toContain("'index.html#");
  });

  test('le bundle desktop sait où envoyer l’accueil — sinon le bouton ne fait RIEN', async ({ page }) => {
    // ⚠️ MESURÉ EN ÉCRIVANT CE LOT. `js/tabibi-desktop-nav.js` rend `null` pour
    // toute page hors bundle sans équivalent, et `go()` s'arrête net sur
    // `null`. En pointant la barre sur `accueil-public.html` sans l'ajouter au
    // remappage, Accueil / Spécialités / loupe seraient devenus des boutons
    // morts sur le desktop : une mauvaise destination remplacée par aucune.
    const src = await page.request.get('/js/tabibi-desktop-nav.js').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(nu, 'accueil-public.html n’a pas d’équivalent dans le bundle desktop')
      .toMatch(/'accueil-public\.html':\s*'[a-z0-9-]+\.html'/);
  });
});
