// =====================================================================
// Deux puces ne pouvaient rien trouver, jamais
// =====================================================================
// ⚠️ « Urgences » filtrait sur `d.urgent`, « Femmes » sur `d.g === 'F'`. Les
// deux champs étaient **fabriqués à l'hydratation** :
//
//     urgent: false,   // pour les 75 035
//     g: 'H',          // pour les 75 035
//
// Cliquer l'une ou l'autre rendait donc **toujours zéro résultat**, et l'écran
// répondait « Aucun médecin avec ces filtres » — un message qui accuse la
// recherche alors que la faute est dans la donnée.
//
// Mesuré en base le 16/09 : **aucune colonne de genre ni d'urgence** n'existe,
// ni dans `doctor_profiles`, ni dans `public_doctors`. Ce n'est pas « pas
// encore branché » : la donnée n'existe pas.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// Qu'aucune puce affichée ne mène à un état vide **injustifié** — c'est-à-dire
// vide alors que le lot reçu contient des fiches qui devraient passer.
//
// Ils ne gardent pas « il y a exactement deux puces » : ce serait garder un
// compte. Ils gardent que **chacune de celles qu'on montre peut trouver**.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';
const PER = 7;

/**
 * Des fiches qui devraient passer TOUTES les puces encore affichées :
 * note 4,5 (donc « 4 et plus ») et aucun tarif (donc « moins de 2000 »,
 * qui laisse passer un tarif absent).
 */
function lignes(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    full_name: `Dr Essai ${i}`,
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.5, review_count: 12, languages: ['fr'],
    is_verified: true, accepts_cash: true,
  }));
}

/**
 * Bouchonne les deux RPC et COMPTE les appels.
 *
 * ⚠️ Le compteur n'est pas un ornement : `doFilter()` est débounce à 300 ms, et
 * une assertion posée juste après un clic lit l'écran d'AVANT. Attendre une
 * durée fixe marche sur une machine rapide et ment sur une machine lente — la
 * première version de cet essai est restée verte avec les puces mortes remises.
 * On attend donc que le serveur ait été RE-INTERROGÉ, ce qui est le signal
 * exact que le filtre a été appliqué.
 */
async function bouchonner(page) {
  const appels = { n: 0 };
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => {
    appels.n++;
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(lignes(PER)),
    });
  });
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => {
    appels.n++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: PER, page: 1, limite: PER, lignes: lignes(PER) }),
    });
  });
  return appels;
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('les puces de recherche', () => {

  test('CHAQUE puce affichée peut trouver quelque chose', async ({ page }) => {
    // ⚠️ L'essai qui compte. Il ne nomme aucune puce : il prend celles que la
    // page rend, les clique une par une, et vérifie qu'aucune ne vide la liste
    // alors que le lot reçu devrait passer. Une puce ajoutée demain sur une
    // colonne absente échouera ici sans que personne n'ait à y penser.
    const appels = await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    const puces = await page.locator('.chip[data-cv]').evaluateAll(
      (els) => els.map((e) => e.dataset.cv));
    expect(puces.length, 'plus aucune puce : on a vidé la barre').toBeGreaterThan(0);

    for (const cv of puces) {
      const bouton = page.locator(`.chip[data-cv="${cv}"]`);

      // ⚠️ ON ATTEND UN SIGNAL, PAS UNE DUREE. `doFilter()` est débounce à
      // 300 ms : juste après le clic, la liste porte encore les fiches d'avant,
      // et une assertion « il y a PER fiches » serait vraie **immédiatement**.
      // La contre-épreuve l'a montré — l'essai passait avec les puces mortes
      // remises. Le serveur ré-interrogé est la preuve que le filtre a tourné,
      // et elle ne dépend pas de la vitesse de la machine.
      const avant = appels.n;
      await bouton.click();
      await expect.poll(() => appels.n, { timeout: 10000 }).toBeGreaterThan(avant);

      await expect(
        page.locator('#docs-list .doc-card'),
        `la puce « ${cv} » ne trouve rien alors que le lot devrait passer`,
      ).toHaveCount(PER);

      const avantRelache = appels.n;
      await bouton.click();   // on la relâche avant la suivante
      await expect.poll(() => appels.n, { timeout: 10000 }).toBeGreaterThan(avantRelache);
    }
  });

  test('les deux puces sans donnée ne sont plus proposées', async ({ page }) => {
    const appels = await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    for (const cv of ['urg', 'fem']) {
      expect(await page.locator(`.chip[data-cv="${cv}"]`).count(),
        `la puce « ${cv} » est de retour — la colonne existe-t-elle vraiment ?`).toBe(0);
    }
  });

  test('on n’AFFIRME plus le genre ni l’urgence de 75 000 praticiens', async ({ page }) => {
    // ⚠️ La contre-épreuve de la correction : masquer les puces sans corriger
    // l'hydratation aurait laissé `g:'H'` dans l'objet — une affirmation fausse
    // sur chaque praticien, prête à ressortir au premier code qui la lit.
    const appels = await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    const fabrique = await page.evaluate(() => {
      const d = (window.DOCTORS || [])[0] || {};
      return { g: d.g, urgent: d.urgent };
    });
    expect(fabrique.g, 'le genre est de nouveau codé en dur').not.toBe('H');
    expect(fabrique.urgent, 'l’urgence est de nouveau affirmée').toBeFalsy();
  });
});
