// =====================================================================
// Ce que le lecteur d'écran annonce VRAIMENT — pas ce que le source déclare
// =====================================================================
// `tests/aria-exemples.test.mjs` lit le dépôt : il attrape un `aria-label` en
// forme d'exemple ou de clé, où qu'il soit. **Il ne peut pas voir si la
// traduction arrive.**
//
// C'est justement ce qui manquait : `js/tabibi-i18n.js` avait un canal pour
// `placeholder` et pour `title`, **pas pour `aria-label`**. Un intitulé correct
// posé sans canal reste en français pour un lecteur arabophone — et la
// tentation de recopier le placeholder (lui, traduit) revient.
//
// Cet essai-ci mesure le **nom accessible rendu**, dans deux langues.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '00000000-0000-4000-8000-00000000000d';

async function ouvrir(page, chemin, langue) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', ctx.langue);
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: 'medecin', name: 'Dr Essai' }));
      localStorage.setItem('tabibi_role', 'medecin');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'd@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: MEDECIN, langue });
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test' }) }));
  await page.route('**/rest/v1/users*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test', role: 'medecin', status: 'active' }) }));
  await page.goto(chemin, ATTENDRE);
  expect(page.url(), `${chemin} : redirigé, rien n’a été mesuré`).not.toContain('login.html');
  await page.waitForTimeout(900);   // l'i18n s'applique après le DOM
}

/** Les noms accessibles RENDUS des champs de saisie. */
const intitules = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    const a = el.getAttribute('aria-label');
    if (a) out.push({ id: el.id || el.name || '(sans id)', aria: a, ph: el.placeholder || '' });
  });
  return out;
});

/** Une clé i18n brute : ce que le lecteur d'écran épellerait lettre par lettre. */
const CLE_BRUTE = /^[a-z][a-z0-9]*(_[a-z0-9]+){1,}$/;

test.describe('noms accessibles des champs', () => {

  for (const chemin of ['/medecin-profile.html', '/onboarding-medecin.html', '/accueil-public.html']) {
    test(`${chemin} — aucun nom accessible n’est une clé ni un exemple`, async ({ page }) => {
      await ouvrir(page, chemin, 'fr');
      const champs = await intitules(page);
      expect(champs.length, `${chemin} : aucun champ trouvé, l’essai ne mesure rien`)
        .toBeGreaterThan(0);

      const fautifs = champs.filter((c) => CLE_BRUTE.test(c.aria.trim())
        || /X{3,}/.test(c.aria)
        || /^[\d\s+().-]+$/.test(c.aria.trim())
        || /^(ex|e\.g)\b\s*[:.]/i.test(c.aria.trim()));
      expect(fautifs.map((c) => `${c.id} → « ${c.aria} »`).join(' | '),
        `${chemin} : le lecteur d’écran annonce autre chose qu’un intitulé`).toBe('');
    });
  }

  test('⚠️ LE CANAL MARCHE : les intitulés changent avec la langue', async ({ page }) => {
    // ⚠️ SANS `data-i18n-aria-label` DANS `js/tabibi-i18n.js`, CET ESSAI EST
    // ROUGE. C'est lui qui prouve que le correctif ne s'arrête pas au source :
    // un intitulé français figé pour un lecteur arabophone est le défaut
    // d'origine sous une autre forme.
    await ouvrir(page, '/medecin-profile.html', 'fr');
    const fr = Object.fromEntries((await intitules(page)).map((c) => [c.id, c.aria]));

    await ouvrir(page, '/medecin-profile.html', 'ar');
    const ar = Object.fromEntries((await intitules(page)).map((c) => [c.id, c.aria]));

    const temoins = ['f_price', 'f_phone_cab', 'f_ordre'];
    for (const id of temoins) {
      expect(fr[id], `${id} : pas d’intitulé en français`).toBeTruthy();
      expect(ar[id], `${id} : pas d’intitulé en arabe`).toBeTruthy();
      expect(ar[id], `${id} : l’intitulé arabe est identique au français — le canal ne passe pas`)
        .not.toBe(fr[id]);
      expect(ar[id], `${id} : l’intitulé arabe ne contient pas d’arabe`).toMatch(/[؀-ۿ]/);
    }
  });

  test('⚠️ CONTRE-ÉPREUVE — les placeholders d’exemple sont TOUJOURS là', async ({ page }) => {
    // Le SEQ le demande explicitement : « garder l'exemple en placeholder
    // visuel si utile ». Un correctif qui les effacerait rendrait les
    // formulaires plus durs à remplir pour tout le monde — on aurait réparé
    // l'accessibilité en abîmant l'utilisabilité.
    await ouvrir(page, '/medecin-profile.html', 'fr');
    const champs = await intitules(page);
    const avecExemple = champs.filter((c) => c.ph && c.ph.trim().length > 0);
    expect(avecExemple.length,
      'plus aucun placeholder : les exemples ont été supprimés au lieu d’être déplacés')
      .toBeGreaterThan(3);

    const prix = champs.find((c) => c.id === 'f_price');
    expect(prix.ph, 'l’exemple de tarif a disparu du placeholder').toBe('2500');
    expect(prix.aria, 'l’intitulé n’est pas revenu').toMatch(/[Tt]arif/);
  });
});
