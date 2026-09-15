// =====================================================================
// Ce qu'on demande doit s'afficher là où on l'a demandé
// =====================================================================
// ⚠️ SIGNALE PAR AGHILES LE 16/09, CAPTURES A L'APPUI : il tape « ben » dans
// la barre du héros, et les fiches trouvées sortent **tout en bas** de
// l'accueil — derrière le bloc de statistiques, la carte d'exemple, Dawini,
// les spécialités et les quatre portraits de la vitrine.
//
// « Juste en dessous qu'on trouve. » C'est une demande de POSITION, et une
// position, ça se mesure — en pixels, pas à l'œil.
//
// ---------------------------------------------------------------------
// CE QUE CET ESSAI MESURE
// ---------------------------------------------------------------------
// L'écart vertical entre le BAS du champ de recherche et le HAUT de la
// section des résultats, dans les deux états :
//
//     vitrine (rien de tapé)  -> l'écart est grand, et c'est normal :
//                                la page présente le service.
//     recherche active        -> l'écart doit tenir dans un écran.
//
// **Les deux moitiés comptent.** Un essai qui ne vérifierait que le second
// serait vert si on supprimait purement et simplement la page d'accueil.
//
// ---------------------------------------------------------------------
// CE QU'IL NE PROUVE PAS
// ---------------------------------------------------------------------
// Que ce soit agréable. Il prouve que les résultats entrent dans l'écran
// avec la barre qui les a produits ; le reste se regarde.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';
const PER = 7;

function lignes(n, decalage = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(decalage + i).padStart(12, '0')}`,
    full_name: `Dr Essai ${decalage + i}`,
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.5, review_count: 12, languages: ['fr', 'ar'],
    is_verified: true, accepts_cash: true,
  }));
}

async function bouchonner(page) {
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(lignes(PER)),
  }));
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 3, page: 1, limite: PER, lignes: lignes(3, 100) }),
  }));
}

/** L'écart, en pixels de page, entre le bas de la barre et le haut des résultats. */
async function ecart(page) {
  return page.evaluate(() => {
    const barre = document.getElementById('name-search');
    const docs = document.getElementById('sec-docs');
    const y = (el) => el.getBoundingClientRect().top + window.scrollY;
    return Math.round(y(docs) - (y(barre) + barre.getBoundingClientRect().height));
  });
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('la position des résultats', () => {

  test('en cherchant, les résultats remontent sous la barre', async ({ page }) => {
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    const avant = await ecart(page);
    // ⚠️ LA MOITIE QU'ON OUBLIE : sans elle, cet essai serait vert sur une page
    // vide. On mesure d'abord que les blocs de presentation sont bien la.
    expect(avant, 'la page d accueil ne presente plus rien').toBeGreaterThan(700);

    await page.fill('#name-search', 'ben');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });
    const apres = await ecart(page);

    // Un ecran de telephone fait ~812 px de haut. Les resultats doivent tenir
    // avec la barre qui les a produits.
    expect(apres, `les resultats restent a ${apres} px sous la barre`).toBeLessThan(600);
    expect(apres).toBeLessThan(avant);
  });

  test('en vidant le champ, la page d accueil revient ENTIERE', async ({ page }) => {
    // La contre-épreuve : replier n'est pas supprimer. Une page qui ne se
    // rouvre pas, c'est un accueil perdu au premier caractère tapé.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });
    const entiere = await ecart(page);

    await page.fill('#name-search', 'ben');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });

    await page.fill('#name-search', '');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });
    await expect.poll(() => ecart(page), { timeout: 6000 }).toBe(entiere);

    for (const sel of ['.hero-stats', '#sec-dawini', '#sec-vitrine']) {
      await expect(page.locator(sel).first(), `${sel} n est pas revenu`).toBeVisible();
    }
  });

  test('la barre et les filtres restent à l écran pendant la recherche', async ({ page }) => {
    // On replie la PRESENTATION, jamais les commandes : un utilisateur doit
    // pouvoir corriger son terme sans remonter chercher le champ.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await page.fill('#name-search', 'ben');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });

    for (const sel of ['#name-search', '#f-ville', '#f-spec', '#f-sort', '#chips']) {
      await expect(page.locator(sel), `${sel} a ete replie par erreur`).toBeVisible();
    }
  });

  test('choisir une WILAYA replie aussi — pas seulement le texte', async ({ page }) => {
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.evaluate(() => {
      const s = document.getElementById('f-ville');
      s.innerHTML = '<option value="">Toutes</option><option value="Alger">Alger</option>';
      s.value = 'Alger';
      s.dispatchEvent(new Event('change'));
    });
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });
    expect(await ecart(page)).toBeLessThan(600);
  });

  test('une PUCE seule replie aussi, même si la RPC ne change pas', async ({ page }) => {
    // ⚠️ CE CAS A FAILLI PASSER A TRAVERS. La bascule suivait d'abord `vitrine`
    // — la variable qui decide QUELLE RPC appeler. Or une puce ou le curseur de
    // prix ne changent pas la RPC : ils filtrent le lot deja recu, cote
    // navigateur. L'utilisateur avait demande quelque chose et la page ne
    // bougeait pas. Les deux notions repondent a deux questions differentes.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.locator('.chip[data-cv="4plus"]').click();
    await expect.poll(() => ecart(page), { timeout: 8000 }).toBeLessThan(600);
    // Et les fiches sont toujours la : replier n'est pas filtrer.
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER);
  });

  test('la meme notion sert au repli ET au message « aucun medecin »', async ({ page }) => {
    // La contre-epreuve de l'extraction : `_filtresActifs()` a remplace une
    // seconde definition ecrite a la main dans `_updateResCount`. Si les deux
    // divergeaient a nouveau, on verrait une page repliee avec le message des
    // pages NON filtrees — ou l'inverse. On les fait donc repondre sur la
    // MEME interaction.
    //
    // ⚠️ Et cette notion-la etait FAUSSE avant ce lot : elle lisait
    // `maxPrice != null`, or le curseur de prix demarre a 5 000 DA. Elle
    // repondait donc « oui, il filtre » sur une page ou personne n'avait rien
    // touche — et la page se repliait toute seule au chargement. C'est cet
    // essai-ci qui l'a trouve, pas la relecture.
    await bouchonner(page);
    await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 0, page: 1, limite: PER, lignes: [] }),
    }));
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.fill('#name-search', 'zzzz');
    await expect(page.locator('#res-count')).toContainText(/ces filtres/i, { timeout: 8000 });
    expect(await ecart(page), 'replie d un cote, « non filtre » de l autre').toBeLessThan(600);
  });

  test('le DOM n est pas reordonné — les ancres tiennent encore', async ({ page }) => {
    // ⚠️ Pourquoi on replie au lieu de deplacer : `scrollTo$('sec-docs')`, la
    // pagination et « Voir tout » pointent tous sur cette section, et un
    // lecteur d'ecran suit l'ordre du DOM, pas l'ordre a l'ecran. Deplacer le
    // bloc aurait corrige la position en cassant tout ce qui la vise.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await page.fill('#name-search', 'ben');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });

    const ordre = await page.evaluate(() => {
      const barre = document.getElementById('name-search');
      const docs = document.getElementById('sec-docs');
      // 4 = DOCUMENT_POSITION_FOLLOWING : #sec-docs vient toujours APRES.
      return barre.compareDocumentPosition(docs) & 4;
    });
    expect(ordre, 'le bloc des resultats a change de place dans le DOM').toBeTruthy();
  });
});
