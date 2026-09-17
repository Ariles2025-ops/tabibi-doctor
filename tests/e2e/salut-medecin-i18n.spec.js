// =====================================================================
// Le salut du tableau de bord médecin ne montre JAMAIS une clé brute
// =====================================================================
// ⚠️ LE DIAGNOSTIC REÇU ÉTAIT « ces clés sont absentes des dictionnaires ».
// **Mesuré avant d'écrire une ligne : elles y sont, toutes les quatre, dans les
// trois langues**, avec de vraies traductions :
//
//   fr  hello="Bonjour"  good_morning="Bonjour, Dr."  …
//   en  hello="Hello"    good_morning="Good morning, Dr."  …
//   ar  hello="مرحبًا"   good_morning="صباح الخير، د."  …
//
// Elles sont arrivées avec le découpage de l'i18n par langue (`1409c27`).
// **Aucune clé n'était donc à ajouter.**
//
// ---------------------------------------------------------------------
// CE QUI PEUT QUAND MÊME AFFICHER UNE CLÉ BRUTE
// ---------------------------------------------------------------------
// `tabibiI18n.T(key)` rend `TR[lang][key]`, sinon `TR.fr[key]`, **sinon la clé
// elle-même** (`js/tabibi-i18n.js:98`). Le salut est donc à la merci du
// MOMENT : si le dictionnaire n'est pas encore chargé quand l'en-tête se
// dessine, `T('hello')` rend « hello ». Ce n'est pas un défaut de vocabulaire,
// c'est un défaut d'ordre — et un dictionnaire complet ne l'empêche pas.
//
// Cette garde mesure donc **ce que l'écran affiche**, dans les trois langues,
// plutôt que la présence des clés. Un essai qui vérifie le dictionnaire aurait
// été vert le jour du défaut.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '00000000-0000-4000-8000-00000000000d';

/** Toutes les clés que le salut peut demander. Aucune ne doit être affichée. */
const CLES = ['hello', 'good_morning', 'good_afternoon', 'good_evening'];

async function ouvrir(page, langue) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', ctx.langue);
      localStorage.setItem('tabibi_user', JSON.stringify({
        id: ctx.id, role: 'medecin', name: 'Dr. Benali Mohamed',
        firstName: 'Mohamed', lastName: 'Benali', specialty: 'Cardiologue', ville: 'Alger',
      }));
      localStorage.setItem('tabibi_role', 'medecin');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'd@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { langue, id: MEDECIN });
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test', role: 'medecin',
                           first_name: 'Mohamed', last_name: 'Benali' }),
  }));
  await page.goto('/doctor-dashboard.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');
}

/** Le salut tel qu'il est RENDU, accents normalisés. */
const salut = (page) => page.evaluate(() => {
  const h = document.getElementById('hdr-title');
  const g = document.getElementById('med-greet');
  return { hdr: (h && h.textContent) || '', greet: (g && g.textContent) || '' };
}).then((v) => ({ hdr: v.hdr.normalize('NFC').trim(), greet: v.greet.normalize('NFC').trim() }));

for (const langue of ['fr', 'en', 'ar']) {
  test(`salut du médecin en ${langue} : aucune clé brute à l’écran`, async ({ page }) => {
    await ouvrir(page, langue);

    // On attend que le salut soit posé — un fait, pas une durée.
    await expect.poll(() => salut(page).then((s) => s.hdr.length > 0), { timeout: 10000 }).toBe(true);
    const s = await salut(page);

    for (const cle of CLES) {
      // ⚠️ Égalité exacte, et pas `toContain` : « Bonjour » contient-il
      // « hello » ? Non — mais un libellé anglais pourrait contenir le mot
      // d'une clé, et l'essai accuserait à tort. Ce qu'on refuse, c'est que le
      // texte affiché SOIT la clé.
      expect(s.hdr.split(',')[0].trim(), `l’en-tête affiche la clé « ${cle} »`).not.toBe(cle);
      expect(s.greet.trim(), `le salut affiche la clé « ${cle} »`).not.toBe(cle);
    }

    // Et le prénom est bien là : un salut sans nom serait vert ici sans rien dire.
    expect(s.hdr, 'le prénom du médecin manque dans l’en-tête').toContain('Mohamed');
  });
}

test('le salut parle la LANGUE demandée — pas seulement « pas une clé »', async ({ page }) => {
  // ⚠️ La moitié qu'un « aucune clé brute » laisse passer : un repli français
  // permanent satisferait la règle ci-dessus tout en ignorant la langue. On
  // exige donc le texte anglais quand la page est en anglais.
  await ouvrir(page, 'en');
  await expect.poll(() => salut(page).then((s) => s.hdr), { timeout: 10000 }).toContain('Mohamed');
  const s = await salut(page);
  expect(s.hdr, 'l’en-tête reste en français alors que la page est en anglais').toMatch(/^Hello/);
  expect(s.greet, 'le salut reste en français').toMatch(/Good (morning|afternoon|evening)/);
});

test('les quatre clés existent dans les TROIS dictionnaires', async ({ page }) => {
  // ⚠️ Cet essai NE remplace PAS ceux du dessus : les clés étaient déjà là
  // pendant que le défaut était signalé. Il garde l'autre moitié — que
  // personne ne les retire — et c'est lui qui a montré que le diagnostic reçu
  // (« clés absentes ») ne tenait pas.
  for (const langue of ['fr', 'en', 'ar']) {
    const src = await page.request.get(`/js/i18n/${langue}.js`).then((r) => r.text());
    for (const cle of CLES) {
      expect(src, `« ${cle} » manque dans ${langue}.js`).toContain(`"${cle}":`);
    }
  }
});
