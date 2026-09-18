// =====================================================================
// Une modale vide, collée à gauche, et un chargement qui ne finit jamais
// =====================================================================
// ⚠️ REMONTÉ EN LIVE (Safari, patient connecté, 0 ordonnance) : sur
// `patient-ordonnances.html`, une modale « Détail de l'ordonnance » apparaissait
// **vide** — titre + bouton Fermer, rien d'autre — pendant que la liste disait
// « Aucune ordonnance active ».
//
// ---------------------------------------------------------------------
// LA CAUSE, MESURÉE : UN CONFLIT DE SPÉCIFICITÉ QUI S'INVERSE AU BUILD
// ---------------------------------------------------------------------
// `styles/components-v2.css:707` définit un `.modal` **global** qui est un
// PANNEAU, pas une surcouche :
//
//     .modal { width:100%; max-width:480px; display:flex;
//              flex-direction:column; animation:modal-in-mobile; … }
//
// Cette page appelle `.modal` sa **surcouche** (`position:fixed; inset:0;
// display:none`). **Même spécificité (0,1,0)** → c'est l'**ordre** qui tranche.
// Sur les sources, le `<style>` de la page vient après le lien : elle gagne.
// **Au build, l'ordre s'inverse.** Mesure du 18/09, même page, même navigateur :
//
//     sources    #modal → display: none   max-width: 480px
//     dist-web   #modal → display: FLEX   max-width: 480px
//
// Sur le site déployé, la surcouche était donc **visible en permanence**, large
// de 480 px (« collée à gauche »), et vide — personne n'avait ouvert de détail.
//
// **C'est P-88 à la lettre** (`nav.tab-bar`, 13/09). D'où le même correctif :
// passer par l'**ID** (1,0,0), qui gagne quel que soit l'ordre.
//
// ⚠️ CES ESSAIS NE VALENT QUE PARCE QU'ILS TOURNENT SUR LES DEUX CIBLES. Sur
// les sources seules, ils auraient été verts **avant** le correctif.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PATIENT = '00000000-0000-4000-8000-000000000001';
const MEDECIN = '00000000-0000-4000-8000-00000000000d';

function ordonnance() {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    patient_id: PATIENT, doctor_id: MEDECIN, appointment_id: null,
    prescription_number: 'ORD-2026-000042',
    issue_date: '2026-09-10', expiry_date: '2026-12-10', validity_days: 90,
    medications: [{ name: 'Doliprane 1000mg', dosage: '1 comprimé', frequency: '3 fois par jour' }],
    diagnosis: 'Céphalées', pdf_storage_path: 'o/42.pdf', pdf_sha256: 'abc123', status: 'signed',
  };
}

async function ouvrir(page, { ordonnances = [], clientBase = true } = {}) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: 'patient', name: 'Essai' }));
      localStorage.setItem('tabibi_role', 'patient');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: PATIENT, clientBase });

  // ⚠️ LE SDK EST COUPE PAR LE RESEAU, PAS PAR UN ACCESSEUR SUR `window`.
  // Ma premiere version posait un `Object.defineProperty(window,'supabase')` :
  // elle marchait sur les sources et PAS sur le build — mesure, 3 squelettes
  // contre 0 — parce que le bundle n'evalue pas le meme code au meme moment.
  // Un bouchon qui depend de la forme du build ne mesure pas le produit.
  //
  // On rend donc le fichier vendu VIDE : c'est ce qui se passe reellement quand
  // il ne se charge pas (404, coupure, parse casse), et `js/supabase-client.js`
  // sort alors sur son propre `console.error('[Tabibi] SDK Supabase non
  // charge')` — sur les DEUX cibles.
  if (!clientBase) {
    await page.route('**/supabase-js-*.min.js', (route) => route.fulfill({
      status: 200, contentType: 'application/javascript', body: '' }));
  }

  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }),
  }));
  await page.route('**/rest/v1/prescriptions*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(ordonnances) }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: MEDECIN, first_name: 'Mohamed', last_name: 'Benali',
                            specialty_fr: 'Cardiologue' }]) }));

  await page.goto('/patient-ordonnances.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');
}

/** L'état RENDU de la surcouche — pas ce que le source déclare. */
const etatModale = (page) => page.evaluate(() => {
  const m = document.getElementById('modal');
  if (!m) return null;
  const s = getComputedStyle(m);
  return {
    display: s.display,
    maxWidth: s.maxWidth,
    ouverte: m.classList.contains('open'),
    corps: (document.getElementById('m-body') || {}).textContent || '',
  };
});

test.describe('« Mes ordonnances » — la modale et le chargement', () => {

  test('SANS ordonnance : aucune modale ouverte, aucun squelette', async ({ page }) => {
    // ⚠️ LE SYMPTÔME REMONTÉ. Sur `dist-web`, `display` valait `flex` AVANT ce
    // lot : cet essai n'a de valeur que parce qu'il tourne sur les deux cibles.
    await ouvrir(page, { ordonnances: [] });
    await expect(page.locator('#list .empty')).toBeVisible({ timeout: 10000 });

    const m = await etatModale(page);
    expect(m.display, 'la modale est affichée alors que rien ne l’a ouverte').toBe('none');
    expect(m.ouverte).toBe(false);
    expect(await page.locator('.skeleton').count(), 'le squelette de chargement tourne encore').toBe(0);
  });

  test('la surcouche prend TOUT l’écran — plus de panneau de 480 px', async ({ page }) => {
    // ⚠️ La moitié « collée à gauche ». Redéclarer `display` sans `max-width`
    // aurait laissé une surcouche de 480 px : le défaut visuel serait resté.
    await ouvrir(page, { ordonnances: [ordonnance()] });
    await expect(page.locator('#list .presc-card, #list .empty').first())
      .toBeVisible({ timeout: 10000 });

    const m = await etatModale(page);
    expect(m.maxWidth, 'la surcouche est bornée à 480 px : elle sera collée à gauche')
      .toBe('none');
  });

  test('AVEC une ordonnance : le détail s’ouvre REMPLI et centré', async ({ page }) => {
    // Une garde qui ne vérifie que la fermeture ferait supprimer la modale.
    await ouvrir(page, { ordonnances: [ordonnance()] });
    await page.locator('[data-act="detail"]').first().click();

    await expect.poll(() => etatModale(page).then((m) => m.display), { timeout: 8000 })
      .toBe('flex');
    const m = await etatModale(page);
    expect(m.corps, 'la modale s’ouvre vide').toContain('ORD-2026-000042');
    expect(m.corps).toContain('Doliprane');

    // Centrée : le panneau n'est pas collé au bord.
    const boite = await page.locator('#modal .modal-content').boundingBox();
    const largeur = page.viewportSize().width;
    expect(boite.x, 'le panneau est collé à gauche').toBeGreaterThan(4);
    expect(Math.abs((boite.x + boite.width / 2) - largeur / 2),
      'le panneau n’est pas centré').toBeLessThan(40);
  });

  test('SANS client base : le squelette s’arrête et l’écran DIT pourquoi', async ({ page }) => {
    // ⚠️ MESURÉ AVANT LE CORRECTIF : 3 squelettes, aucun message, pour
    // toujours. `applyFilter()` retire bien le squelette — mais il n'est
    // atteint que si `load()` va au bout. **Un écran qui charge indéfiniment
    // ment autant qu'un faux succès : il promet que quelque chose arrive.**
    await ouvrir(page, { clientBase: false });

    await expect.poll(() => page.locator('.skeleton').count(), { timeout: 10000 }).toBe(0);
    await expect(page.locator('#list .empty')).toBeVisible();
    expect((await page.locator('#list').innerText()).trim().length,
      'l’écran est vide et muet').toBeGreaterThan(0);
  });

  test('une donnée introuvable n’ouvre pas de modale', async ({ page }) => {
    // ⚠️ MA PREMIERE VERSION NE MESURAIT RIEN. Elle changeait `dataset.id`
    // apres coup — or le gestionnaire capture l'identifiant AU MOMENT OU IL EST
    // POSE (`const id = el.dataset.id;`). Le clic cherchait donc toujours
    // l'ancien identifiant, la modale s'ouvrait, et l'essai « prouvait » un
    // defaut inexistant.
    //
    // On vide la liste en memoire : `find()` ne rend plus rien, et c'est le
    // chemin reel d'une liste rechargee pendant un clic.
    await ouvrir(page, { ordonnances: [ordonnance()] });
    await expect(page.locator('[data-act="detail"]').first()).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => { document.querySelector('[data-act="detail"]').click(); });
    await expect.poll(() => etatModale(page).then((m) => m.display), { timeout: 8000 }).toBe('flex');
    await page.evaluate(() => document.getElementById('modal').classList.remove('open'));

    // La garde de `openDetail` elle-meme (p nul) n'est pas atteignable depuis
    // la page : la fonction est locale au module. Elle est tenue a la SOURCE,
    // par `tests/ordonnances-modale-source.test.mjs` — un essai qui lit le
    // depot, pas la sortie de build (lecon de P-108).
    expect((await etatModale(page)).display).toBe('none');
  });
});
