// =====================================================================
// L'accueil montre de VRAIS médecins — plus « Choisissez une wilaya »
// =====================================================================
// ⚠️ L'accueil ANNONÇAIT « 75 000+ médecins » et n'en MONTRAIT aucun : la liste
// affichait « Choisissez une wilaya ou une spécialité ». Un chiffre sans une
// seule fiche derrière, c'est la famille du « 500+ inscrits » (P-01).
//
// `praticiens_vitrine(page, limite)` rend une page de vrais praticiens, sans
// filtre obligatoire et **sans comptage coûteux**. C'est ce qui s'affiche par
// défaut ; dès qu'un filtre ou du texte arrive, on repasse à
// `chercher_praticiens` (le parsing du texte libre de P-51 reste).
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS NE PROUVENT PAS
// ---------------------------------------------------------------------
// La RPC est bouchonnée : ils prouvent que la PAGE demande les bons médecins
// et les affiche, pas que la base en rend de bons. **Le contenu réel se voit
// au navigateur, sur la prod.**
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';
const PER = 7;   // `const PER=7` dans js/home-app.js — la page en demande autant

/** Fabrique `n` lignes a la forme de `public_doctors`. */
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

/**
 * Bouchonne la vitrine et retient les pages demandees.
 * `parPage` decide si la page est PLEINE — donc si « suivant » doit exister.
 */
async function bouchonnerVitrine(page, parPage = PER) {
  const appels = [];
  await page.route('**/rest/v1/rpc/praticiens_vitrine', async (route) => {
    let corps = {};
    try { corps = JSON.parse(route.request().postData() || '{}'); } catch { corps = {}; }
    appels.push(corps);
    const p = Number(corps.p_page) || 1;
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(lignes(parPage, (p - 1) * PER)),
    });
  });
  return { appels };
}

async function bouchonnerRecherche(page) {
  const appels = [];
  await page.route('**/rest/v1/rpc/chercher_praticiens', async (route) => {
    try { appels.push(JSON.parse(route.request().postData() || '{}')); } catch { appels.push(null); }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 3, page: 1, limite: PER, lignes: lignes(3, 100) }),
    });
  });
  return { appels };
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

// ─────────────────────────────────────────────────────────────────────
test.describe('accueil — la vitrine', () => {

  test('sans aucun filtre, l accueil affiche des medecins, pas une invite', async ({ page }) => {
    const { appels } = await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);

    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });
    // ⚠️ L'ecran « Choisissez une wilaya ou une specialite » ne doit plus
    // apparaitre au chargement : c'est tout l'objet de ce lot.
    expect(await page.locator('#docs-list .empty-state').count()).toBe(0);
    expect(appels.length).toBeGreaterThan(0);
    expect(appels[0]).toEqual({ p_page: 1, p_limite: PER });
  });

  test('les filtres et la barre restent visibles AU-DESSUS de la vitrine', async ({ page }) => {
    await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    for (const sel of ['#name-search', '#f-ville', '#f-spec', '#f-sort']) {
      await expect(page.locator(sel), `${sel} a disparu`).toBeVisible();
    }
  });

  test('la pagination avance — page 2 demande bien la page 2', async ({ page }) => {
    const { appels } = await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.locator('#pag button:not([disabled])').last().click();
    await expect.poll(() => appels.length, { timeout: 8000 }).toBeGreaterThan(1);
    expect(appels[appels.length - 1].p_page).toBe(2);
  });

  test('« suivant » n existe PAS quand la page n est pas pleine', async ({ page }) => {
    // ⚠️ La RPC ne compte pas : on ne connait pas le nombre de pages. La seule
    // chose qu'on sache est « la page recue etait pleine ». Proposer un
    // « suivant » au-dela serait promettre une page qu'on n'a pas vue.
    await bouchonnerVitrine(page, 3);        // page incomplete
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3, { timeout: 8000 });

    const actifs = await page.locator('#pag button:not([disabled])').count();
    expect(actifs, 'aucun bouton ne doit etre actif sur une page incomplete en page 1').toBe(0);
  });

  test('le compteur ne promet aucun total qu on n a pas mesure', async ({ page }) => {
    await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    const texte = (await page.locator('#res-count').textContent()) || '';
    expect(texte).toContain('7');
    // Ni « sur 75 000 », ni « 0 medecin » : on dit ce qu'on montre.
    expect(texte).not.toMatch(/sur\s+\d/);
    expect(texte.trim()).not.toMatch(/^0\b/);
  });

  test('taper un terme REPASSE sur chercher_praticiens', async ({ page }) => {
    await bouchonnerVitrine(page);
    const { appels } = await bouchonnerRecherche(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.fill('#name-search', 'benali');
    await expect.poll(() => appels.length, { timeout: 8000 }).toBeGreaterThan(0);
    expect(appels[appels.length - 1].p_q).toBe('benali');
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(3);
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('accueil — ce qui est annonce', () => {

  test('la teleconsultation est annoncee DISPONIBLE, et mene a la reservation', async ({ page }) => {
    await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);

    const bande = page.locator('.v4-tele');
    await expect(bande).toBeVisible();
    await expect(bande.locator('.v4-live')).toHaveText(/disponible/i);
    // Elle ne doit plus envoyer attendre une chose qui marche.
    expect(await bande.locator('a[href*="waiting-list"]').count()).toBe(0);

    // ⚠️ LE BOUTON, APRES CE QU'AGHILES A VU EN LIGNE. Le HTML servait
    // « Disponible » et le bouton disait « Etre prevenu » : ce n'etait pas le
    // HTML qui avait tort, c'etait le DICTIONNAIRE, servi depuis un cache.
    // On lit donc le bouton TEL QU'AFFICHE, apres passage de `setLang`.
    const cta = bande.locator('a.cta');
    await expect(cta).toHaveText(/r[ée]server/i);
    await expect(cta).toHaveAttribute('href', '#sec-docs');
    const texteBande = ((await bande.textContent()) || '');
    expect(texteBande, 'un reste de « bientot »/« etre prevenu » dans la bande')
      .not.toMatch(/bient[oô]t|pr[ée]venu|coming\s*soon|قريبا/i);
  });

  test('la bande dit la meme chose en AR et en EN — pas seulement en FR', async ({ page }) => {
    // Les trois langues portent la meme promesse. Un bouton juste en francais
    // et perime en arabe, c'est le defaut d'origine, deplace.
    await bouchonnerVitrine(page);
    for (const [lang, attendu] of [['ar', /حجز/], ['en', /book/i]]) {
      await page.addInitScript((l) => localStorage.setItem('tabibi_lang', l), lang);
      await page.goto(PAGE, ATTENDRE);
      const bande = page.locator('.v4-tele');
      await expect(bande.locator('a.cta')).toHaveText(attendu, { timeout: 8000 });
      expect(((await bande.textContent()) || ''), `reste d'attente en ${lang}`)
        .not.toMatch(/bient[oô]t|pr[ée]venu|coming\s*soon|قريبا/i);
    }
  });

  test('plus aucun medecin INVENTE dans la carte du hero', async ({ page }) => {
    await bouchonnerVitrine(page);
    await page.goto(PAGE, ATTENDRE);
    // « Dr. Amine · 09:30 » etait un medecin invente presente comme un vrai
    // rendez-vous — meme famille que P-27 et P-47.
    const hero = (await page.locator('.badge-float').allTextContents()).join(' ');
    expect(hero).not.toMatch(/Dr\.?\s*Amine/i);
  });
});
