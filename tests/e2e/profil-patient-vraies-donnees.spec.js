// =====================================================================
// Trois vaccins écrits en dur, affichés à tous les patients
// =====================================================================
// ⚠️ `patient-profile.html` affichait, sur le dossier de **chaque** patient :
//
//     COVID-19 (rappel) · Pfizer · 12 mars 2024        [À jour]
//     Tétanos / Diphtérie · 8 juin 2022 · Rappel dans 8 ans   [À jour]
//     Grippe saisonnière · Recommandé avant novembre   [À faire]
//
// Ce n'était pas une illustration : **c'était une affirmation médicale sur
// quelqu'un, sur la page de son propre dossier.** Un patient pouvait y lire
// qu'il était à jour du tétanos sans l'avoir jamais été — et le croire.
//
// Deux autres blocs mentaient plus discrètement :
//   • la carte santé (#hc-blood, #hc-imc, #hc-age, #hc-allergies) n'était
//     **jamais remplie** — quatre tirets alors que la donnée existe ;
//   • « Patient · membre depuis **2025** » était écrit en dur.
//
// ---------------------------------------------------------------------
// « ON NE SAIT PAS » ET « ZÉRO » NE SE VALENT PAS
// ---------------------------------------------------------------------
// Sur un dossier médical, un tiret est une réponse ; une valeur inventée n'en
// est pas une. C'est aussi pour ça que les compteurs de rendez-vous affichent
// « — » tant que le cache serveur n'a jamais été écrit, au lieu de « 0 » :
// un patient qui a trois rendez-vous lisait zéro.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/patient-profile.html';

/**
 * Ouvre la page avec un patient donné et, si fourni, un dossier médical.
 * @param {object|null} medical  ce que `tabibiPII.load()` doit rendre
 */
async function ouvrir(page, { medical = null, user = {}, rdvCache = null } = {}) {
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             getUser:     async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             signOut: async () => {}, logout: async () => {}
           };`,
  }));
  // Le témoin `CHARGE` part avec le dossier : il ne change rien à ce qui est
  // mesuré, et il rend le `.then()` de la page OBSERVABLE.
  const dossier = medical ? { medical_history: TEMOIN, ...medical } : null;
  await page.route('**/js/tabibi-pii-migration.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibiPII = { load: async () => (${JSON.stringify(dossier)}), save: async () => ({ ok: true }) };`,
  }));
  await page.addInitScript(([u, cache]) => {
    localStorage.setItem('tabibi_lang', 'fr');
    localStorage.setItem('tabibi_user', JSON.stringify({
      id: 'fx', role: 'patient', name: 'Amina Cherif', email: 'a@b.test', ...u,
    }));
    localStorage.removeItem('tabibi_rdv');
    if (cache) localStorage.setItem('tabibi_rdv', JSON.stringify(cache));
  }, [user, rdvCache]);
  await page.goto(PAGE, ATTENDRE);
}

const texte = async (page, sel) => ((await page.locator(sel).textContent()) || '').trim();

/**
 * Attend que la page ait FINI de peupler la fiche — sans dormir.
 *
 * ⚠️ Une attente fixe est un pari sur la vitesse de la machine : elle tient sur
 * un portable et ment sur un runner partagé. On attend donc un FAIT.
 *
 * Deux cas, deux faits différents :
 *  • dossier médical rendu par la base — `tabibiPII.load()` remplit d'abord le
 *    formulaire, PUIS rappelle `peuplerFicheSante()`. Le témoin `CHARGE`, posé
 *    dans un champ qu'aucun essai n'inspecte, prouve que ce `.then()` a tourné.
 *  • aucun dossier (`load()` rend `null`) — la page sort de son `.then()` sans
 *    rien faire : seul le premier appel, synchrone, a peuplé la fiche. Le fait
 *    observable est alors le carnet, qui n'est jamais vide (liste ou message).
 */
const TEMOIN = 'CHARGE';
async function ficheRemplie(page, avecDossier) {
  if (avecDossier) {
    await expect(page.locator('#f_history')).toHaveValue(TEMOIN, { timeout: 8000 });
  } else {
    await expect(page.locator('#vacc-list')).not.toBeEmpty({ timeout: 8000 });
  }
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

test.describe('le profil patient n’affiche que du vrai', () => {

  test('AUCUN vaccin codé en dur, quel que soit le dossier', async ({ page }) => {
    await ouvrir(page, { medical: null });
    await ficheRemplie(page, false);
    const page_txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    for (const faux of ['COVID-19', 'Pfizer', '12 mars 2024', 'Tétanos', 'Diphtérie', '8 juin 2022', 'Grippe saisonnière']) {
      expect(page_txt, `« ${faux} » est encore affiché à tous les patients`).not.toContain(faux);
    }
  });

  test('sans vaccination renseignée : on le DIT, sans pastille « à jour »', async ({ page }) => {
    await ouvrir(page, { medical: { vaccinations: '' } });
    await expect(page.locator('#vacc-list')).toContainText(/aucune vaccination/i, { timeout: 8000 });
    // ⚠️ Une pastille verte sur un carnet vide serait le défaut d'origine,
    // repeint : « à jour » de quoi ?
    expect(await page.locator('#vacc-list .badge-green').count()).toBe(0);
  });

  test('avec des vaccinations : ce sont CELLES DU DOSSIER qui s’affichent', async ({ page }) => {
    await ouvrir(page, { medical: { vaccinations: 'BCG 2019, Hépatite B 2021' } });
    await expect(page.locator('#vacc-list')).toContainText('BCG 2019', { timeout: 8000 });
    await expect(page.locator('#vacc-list')).toContainText('Hépatite B 2021');
    expect(await page.locator('#vacc-list > div').count()).toBe(2);
  });

  test('la carte santé est REMPLIE quand la donnée existe', async ({ page }) => {
    await ouvrir(page, {
      medical: { blood_type: 'O+', height_cm: 170, weight_kg: 68, allergies: 'Pénicilline, arachides' },
      user: { birthDate: '1990-01-01' },
    });
    await expect.poll(() => texte(page, '#hc-blood'), { timeout: 8000 }).toBe('O+');
    expect(await texte(page, '#hc-imc')).toBe('23.5');       // 68 / 1,70²
    expect(await texte(page, '#hc-allergies')).toBe('Pénicilline +1');
    expect(Number(await texte(page, '#hc-age'))).toBeGreaterThan(30);
  });

  test('sans donnée, la carte santé reste à « — » — elle n’invente pas', async ({ page }) => {
    await ouvrir(page, { medical: { blood_type: null, height_cm: null, weight_kg: null, allergies: null } });
    await ficheRemplie(page, true);
    for (const id of ['#hc-imc', '#hc-age', '#hc-allergies']) {
      expect(await texte(page, id), `${id} affiche une valeur inventée`).toBe('—');
    }
  });

  test('un IMC ne se calcule pas sur une saisie aberrante', async ({ page }) => {
    // ⚠️ 3 cm et 900 kg sont des fautes de frappe. Un IMC calculé dessus serait
    // un nombre AFFIRMÉ faux — pire qu'un tiret, parce qu'il a l'air d'un calcul.
    await ouvrir(page, { medical: { height_cm: 3, weight_kg: 900 } });
    await ficheRemplie(page, true);
    expect(await texte(page, '#hc-imc')).toBe('—');
  });

  test('« membre depuis » : la vraie année, ou rien du tout', async ({ page }) => {
    await ouvrir(page, { medical: null, user: { created_at: '2024-03-08T10:00:00Z' } });
    await expect(page.locator('#member-badge')).toBeVisible({ timeout: 8000 });
    expect(await texte(page, '#member-since')).toBe('2024');

    // Sans date connue, la pastille disparaît : « 2025 » en dur était une date
    // de plus à ne pas croire.
    await ouvrir(page, { medical: null });
    await ficheRemplie(page, false);
    await expect(page.locator('#member-badge')).toBeHidden();
  });

  test('les compteurs disent « — » tant qu’on n’a rien lu, « 0 » quand on sait', async ({ page }) => {
    await ouvrir(page, { medical: null });          // aucun cache serveur
    await ficheRemplie(page, false);
    expect(await texte(page, '#rdv-count'), 'un patient qui a des RDV lirait « 0 »').toBe('—');

    await ouvrir(page, { medical: null, rdvCache: [] });   // cache lu, vraiment vide
    await ficheRemplie(page, false);
    expect(await texte(page, '#rdv-count')).toBe('0');

    await ouvrir(page, { medical: null, rdvCache: [{ id: 'a', status: 'Confirmed' }, { id: 'b', status: 'Done' }] });
    await ficheRemplie(page, false);
    expect(await texte(page, '#rdv-count')).toBe('2');
    expect(await texte(page, '#upcoming-count')).toBe('1');
  });

  test('un nom de vaccin piégé ne s’exécute pas', async ({ page }) => {
    // Le carnet est construit en DOM (`textContent`), pas en `innerHTML` : rien
    // à échapper, donc rien à oublier d'échapper.
    await ouvrir(page, { medical: { vaccinations: '<img src=x onerror="window.__xss=1">' } });
    await expect(page.locator('#vacc-list')).toContainText('img src=x', { timeout: 8000 });
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('#vacc-list img').count()).toBe(0);
  });
});
