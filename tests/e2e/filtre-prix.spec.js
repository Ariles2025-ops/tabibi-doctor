// =====================================================================
// Un filtre que personne n'avait posé — et un reset qui ne remettait rien
// =====================================================================
// ⚠️ DEUX DÉFAUTS, UNE SEULE CAUSE : **« une valeur est posée » n'est pas
// « quelqu'un a choisi »**.
//
// 1. Le post-filtre client s'exécutait **au chargement**. Sa condition était
//    `opts.maxPrice != null`, et `maxPrice` vaut 5 000 dès le premier rendu :
//    le curseur DÉMARRE là. Tout praticien affichant plus de 5 000 DA
//    disparaissait de l'accueil, sans filtre posé et sans rien à l'écran pour
//    le dire.
//
//    Inoffensif au 16/09 — mesuré : 75 035 / 75 035 fiches n'ont aucun tarif,
//    et un tarif absent passe. **Un défaut latent reste un défaut : il attend
//    une donnée.** Le premier médecin qui saisit 6 000 DA disparaissait.
//
// 2. « Réinitialiser » posait 10 000 alors que le curseur démarre à 5 000.
//    Après un reset, `prixModifie` valait donc `true` — le curseur avait bougé,
//    de son point de vue — et la page restait **repliée**
//    (`body.recherche-active`) alors que plus aucun filtre n'était actif.
//
// ---------------------------------------------------------------------
// LE BOUCHON PORTE UN TARIF, ET C'EST TOUT L'OBJET
// ---------------------------------------------------------------------
// La base n'en a aucun : un essai sur des fiches sans tarif serait vert dans
// les deux sens et ne prouverait rien. On fabrique donc un praticien à
// **6 000 DA** — celui que le défaut faisait disparaître.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';
const PER = 7;

/** Six fiches sans tarif + une à 6 000 DA — au-dessus du départ du curseur. */
function lignes() {
  const l = Array.from({ length: PER - 1 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    full_name: `Dr SansTarif ${i}`,
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.5, review_count: 12, languages: ['fr'], is_verified: true,
  }));
  l.push({
    id: '00000000-0000-4000-8000-000000009999',
    full_name: 'Dr SixMille',
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.8, review_count: 3, languages: ['fr'], is_verified: true,
    consultation_fee_dzd: 6000,
  });
  return l;
}

async function bouchonner(page) {
  await page.route('**/rest/v1/rpc/praticiens_vitrine', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(lignes()),
  }));
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: PER, page: 1, limite: PER, lignes: lignes() }),
  }));
}

const repliee = (page) => page.evaluate(() => document.body.classList.contains('recherche-active'));

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('le filtre de prix', () => {

  test('un praticien à 6 000 DA reste visible tant que le curseur n’a pas bougé', async ({ page }) => {
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });
    await expect(page.locator('#docs-list')).toContainText(/sixmille/i);
  });

  test('la page n’est PAS repliée au chargement — aucun filtre n’a été posé', async ({ page }) => {
    // Le curseur à sa valeur de départ ne doit compter pour personne : ni pour
    // le post-filtre, ni pour « l'utilisateur cherche-t-il ? ».
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });
    expect(await repliee(page), 'la page se replie toute seule au chargement').toBe(false);
  });

  test('quand le curseur BOUGE, le filtre s’applique vraiment', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE. Sans elle, on aurait pu « corriger » en désactivant
    // le filtre de prix pour de bon : les deux essais du dessus seraient verts
    // et le curseur ne servirait plus à rien.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.evaluate(() => {
      const fp = document.getElementById('f-price');
      fp.value = '3000';
      fp.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(800);

    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER - 1);
    await expect(page.locator('#docs-list')).not.toContainText(/sixmille/i);
    expect(await repliee(page), 'un curseur bougé est bien une recherche').toBe(true);
  });

  test('après « réinitialiser », la page se rouvre ENTIÈREMENT', async ({ page }) => {
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.evaluate(() => {
      const fp = document.getElementById('f-price');
      fp.value = '3000';
      fp.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(800);
    expect(await repliee(page)).toBe(true);

    await page.evaluate(() => window.resetFilters());
    await page.waitForTimeout(800);

    expect(await repliee(page), 'la page reste repliée après un reset').toBe(false);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER);
    await expect(page.locator('#docs-list')).toContainText(/sixmille/i);
  });

  test('« réinitialiser » remet le curseur à sa valeur d’ORIGINE', async ({ page }) => {
    // Il posait 10 000 — une valeur que personne n'avait choisie, et qui
    // faisait croire au reste du code que le curseur avait bougé.
    await bouchonner(page);
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('#docs-list .doc-card')).toHaveCount(PER, { timeout: 8000 });

    await page.evaluate(() => {
      const fp = document.getElementById('f-price');
      fp.value = '3000';
      fp.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.resetFilters());

    const etat = await page.evaluate(() => {
      const fp = document.getElementById('f-price');
      return {
        valeur: fp.value,
        origine: fp.defaultValue,
        libelle: (document.getElementById('price-lbl').textContent || '').replace(/\s/g, ''),
      };
    });
    expect(etat.valeur).toBe(etat.origine);
    // Et le libellé suit la valeur : un curseur et un chiffre qui se
    // contredisent, c'est la page qui ment sur son propre état.
    expect(etat.libelle).toContain(String(parseInt(etat.origine, 10)).slice(0, 1));
  });
});
