// =====================================================================
// Aucun ecran n'affiche jamais une CLE de traduction
// =====================================================================
// [14/09/2026] Mesure en production : sur `accueil-public.html`, **80 des 106
// elements `[data-i18n]` affichaient leur cle brute** — « bc_confirm »,
// « v4_pay », « dwh_h » — a la place du texte. Sur la page d'accueil. A trois
// mois d'un congres medical.
//
// ---------------------------------------------------------------------
// LA CAUSE, ET POURQUOI CE TEST A CETTE FORME-LA
// ---------------------------------------------------------------------
// `js/home-app.js` porte son PROPRE dictionnaire (181 cles) a cote du
// dictionnaire du produit (1510 cles). Son `setLang()` parcourait tous les
// `[data-i18n]` et ecrivait `T(cle)` — **sans verifier que `T` avait trouve
// quelque chose**. Or `T` retombe sur la cle. Il remplacait donc le texte
// francais deja present dans le HTML par l'identifiant.
//
// Le defaut n'etait pas « la traduction manque » : sans cette ecriture, le
// visiteur aurait lu le texte d'origine et personne n'aurait rien remarque.
// **Le defaut est d'avoir detruit une valeur juste pour y mettre un
// identifiant** — meme famille que le « 500+ » et le « e-mail envoye ».
//
// ---------------------------------------------------------------------
// POURQUOI PAS UNE PORTE STATIQUE
// ---------------------------------------------------------------------
// On pourrait comparer les cles du HTML au dictionnaire. Mesure faite :
// **83 cles ne sont dans AUCUN des deux dictionnaires globaux** — et c'est
// legitime, une dizaine de pages (waiting-list, legal/*) ont leur propre
// dictionnaire inline. Une porte statique serait rouge pour de mauvaises
// raisons, donc ignoree.
//
// Ce test-ci regarde **ce que le visiteur voit**. Il ne se soucie pas d'ou
// vient la traduction : il refuse qu'un identifiant technique s'affiche.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGES = [
  'accueil-public.html',
  'index.html',
  'about.html',
  'signup.html',
  'login.html',
  'forgot-password.html',
  'waiting-list.html',
  'cas-grave.html',
  'telecharger.html',
  'verify-prescription.html',
];

const LANGUES = ['fr', 'en', 'ar'];

for (const langue of LANGUES) {
  for (const chemin of PAGES) {
    test(`[${langue}] ${chemin} : aucune cle de traduction a l ecran`, async ({ page }) => {
      await hermetiser(page);
      await neutraliserCaptcha(page);
      await page.addInitScript((l) => localStorage.setItem('tabibi_lang', l), langue);

      await page.goto(`/${chemin}`, ATTENDRE);
      // Les dictionnaires se chargent a la demande et plusieurs scripts
      // re-appliquent apres coup : on mesure l'ecran STABILISE, pas le premier
      // rendu. C'est precisement entre DOMContentLoaded et `load` que la cle
      // s'ecrivait.
      await page.waitForLoadState('load');
      await page.waitForTimeout(1200);

      const brutes = await page.evaluate(() => {
        const trouvees = [];
        document.querySelectorAll('[data-i18n]').forEach((el) => {
          const cle = el.getAttribute('data-i18n');
          if (cle && el.textContent.trim() === cle) trouvees.push(cle);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
          const cle = el.getAttribute('data-i18n-placeholder');
          if (cle && (el.getAttribute('placeholder') || '').trim() === cle) trouvees.push(cle + ' (placeholder)');
        });
        return trouvees;
      });

      expect(brutes,
        `${chemin} en ${langue} affiche ${brutes.length} cle(s) brute(s) : ${brutes.slice(0, 15).join(', ')}`)
        .toEqual([]);
    });
  }
}

test('[fr] le changement de langue a chaud ne fait pas apparaitre de cle', async ({ page }) => {
  // Le dictionnaire d'une langue n'est charge QU'A LA DEMANDE. Le moment ou on
  // bascule est donc celui ou le texte peut se retrouver sans traduction — et
  // c'est la que l'ancienne ecriture inconditionnelle frappait.
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
  await page.goto('/accueil-public.html', ATTENDRE);
  await page.waitForLoadState('load');
  await page.waitForTimeout(800);

  // On bascule par `window.setLang`, EXACTEMENT ce que le bouton appelle
  // (`js/tabibi-langbar.js:55`). Ce n'est pas un raccourci de confort :
  //
  // ⚠️ MESURE DU 14/09 — le selecteur de langue n'est PAS rendu de la meme
  // facon selon la cible :
  //     sources, suite hermetique      -> 3 boutons
  //     dist-web, suite hermetique     -> 0 bouton
  //     dist-web, serveur statique nu  -> 3 boutons
  // Le selecteur disparait donc quand le bundle construit rencontre un tiers
  // remplace par un corps vide. En production le tiers repond, et personne ne
  // le voit. **C'est signale au stratege comme defaut ouvert** — ce test-ci ne
  // doit pas dependre d'un widget pour garder une propriete qui, elle, ne
  // depend pas de lui.
  await page.evaluate(() => {
    if (typeof window.setLang === 'function') return window.setLang('en');
    if (window.tabibiLang && window.tabibiLang.set) return window.tabibiLang.set('en');
    throw new Error('aucun moyen de changer de langue');
  });
  await page.waitForTimeout(1500);

  const etat = await page.evaluate(() => ({
    langue: document.documentElement.lang,
    dicos: Object.keys(window.TABIBI_TR || {}),
    brutes: [...document.querySelectorAll('[data-i18n]')]
      .filter((el) => el.textContent.trim() === el.getAttribute('data-i18n'))
      .map((el) => el.getAttribute('data-i18n')),
  }));

  expect(etat.brutes, `apres bascule en anglais : ${etat.brutes.slice(0, 10).join(', ')}`).toEqual([]);
  // Et l'anglais est bien ARRIVE — sinon le test ci-dessus passerait pour une
  // mauvaise raison : une page restee en francais n'affiche aucune cle non plus.
  expect(etat.dicos, "le dictionnaire anglais n'a pas ete charge").toContain('en');
  expect(etat.langue).toBe('en');
});
