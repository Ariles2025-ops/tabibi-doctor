// =====================================================================
// « Ce médecin n'a pas activé les RDV » — et deux gros boutons pour réserver
// =====================================================================
// ⚠️ SIGNALÉ PAR LE STRATÈGE (mode nuit, INC-5). La modale d'aperçu de
// l'accueil affichait, dans la zone des créneaux, « Ce médecin n'a pas encore
// activé les RDV en ligne » — et juste en dessous **« Confirmer ce créneau »**,
// puis tout en bas **« Réserver »**.
//
// Les deux refusaient au clic. **Après coup**, par un toast qui disparaît en
// trois secondes. Entre-temps, la personne a cliqué, attendu, recliqué.
//
// ---------------------------------------------------------------------
// LA CONDITION DE RÉSERVABILITÉ — vérifiée, pas devinée
// ---------------------------------------------------------------------
// `claimed && validationStatus === 'approved'`, et rien d'autre. C'est déjà
// celle qu'appliquent, toutes les trois :
//
//   js/home-app.js:1306  bookDoc()
//   js/home-app.js:1381  renderProfileSlots()
//   js/home-app.js:1413  confirmFromProfile()
//
// Elle vient de `public_doctors` : `is_claimed` et `validation_status`
// (mappées en `claimed` / `validationStatus`, js/home-app.js:2238-2239).
// Le correctif la calcule **une fois** en haut de la modale au lieu d'ajouter
// une quatrième lecture qui pourrait dériver.
//
// ---------------------------------------------------------------------
// TROIS ÉTATS, PARCE QUE « PAS RÉSERVABLE » RECOUVRE DEUX SITUATIONS
// ---------------------------------------------------------------------
//   réservable ........ les appels à l'action, comme avant
//   en validation ..... la fiche est revendiquée, un humain vérifie
//   non revendiquée ... personne ne tient cette fiche — et c'est là qu'on
//                       propose au médecin de la revendiquer (P-90)
//
// ⚠️ `doctor-profile.html` n'est PAS concernée : son bouton « Réserver un RDV »
// est déjà désactivé avec une mention explicite (`_refreshReserveBtnState`,
// l.672). Vérifié avant d'y toucher — et un essai le garde ici, pour que
// personne ne « corrige » ce qui marche.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';

/** Une ligne de `public_doctors`, dans l'état de réservabilité voulu. */
function praticien(etat, i) {
  const base = {
    id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
    full_name: `Essai ${etat}`,
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, entity_type: 'doctor',
    rating: 4.5, review_count: 12, languages: ['fr'], is_verified: true,
    consultation_fee_dzd: 2000,
  };
  if (etat === 'reservable') return { ...base, is_claimed: true, validation_status: 'approved' };
  if (etat === 'validation') return { ...base, is_claimed: true, validation_status: 'pending' };
  return { ...base, is_claimed: false, validation_status: null };   // non revendiquée
}

const LIGNES = ['reservable', 'validation', 'nonrevendique'].map(praticien);

// ⚠️ LA LANGUE SE POSE POUR TOUS LES ESSAIS, PAS SEULEMENT CEUX QUI PASSENT
// PAR `ouvrir()`. Elle était dans ce helper : l'essai qui va directement sur
// `doctor-profile.html` lisait donc la langue du navigateur et recevait
// « This doctor hasn't enabled online booking yet. » — rouge pour une raison
// qui n'avait rien à voir avec ce qu'il garde.
test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      // Le bandeau cookies recouvre le bas de l'écran sur téléphone (P-87).
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  });
});

async function ouvrir(page) {
  const rendre = (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(LIGNES),
  });
  await page.route('**/rest/v1/rpc/praticiens_vitrine', rendre);
  await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: LIGNES.length, page: 1, limite: 20, lignes: LIGNES }),
  }));
  await page.goto(PAGE, ATTENDRE);
  await expect(page.locator('#docs-list .doc-card, #docs-list [onclick*="goDoc"]').first())
    .toBeAttached({ timeout: 10000 });
}

/** Ouvre la modale d'aperçu d'un praticien par son état. */
async function ouvrirModale(page, etat) {
  const id = praticien(etat, ['reservable', 'validation', 'nonrevendique'].indexOf(etat)).id;
  await page.evaluate((i) => window.goDoc(i), id);
  await expect(page.locator('.modal-bg .modal-sheet').last()).toBeVisible({ timeout: 8000 });
}

/** Le texte de la modale, accents normalisés. */
const texteModale = (page) => page.locator('.modal-bg').last().innerText()
  .then((t) => t.normalize('NFC').replace(/\s+/g, ' ').trim());

/**
 * Les boutons de réservation ACTIFS dans la modale.
 *
 * ⚠️ ON LES RECONNAIT PAR CE QU'ILS FONT, PAS PAR LEUR TEXTE. Ma première
 * version filtrait sur « réserver » : elle en trouvait UN seul sur une fiche
 * réservable, parce que le bouton du bas dit « Prendre RDV » (`T("rdv")`) et
 * celui des créneaux « Confirmer ce créneau ». Un essai qui s'accroche aux
 * libellés casse au premier changement de formulation — et surtout il
 * mesurait ici l'inverse de ce qu'il croyait.
 *
 * On lit donc le `onclick` : ce sont `bookDoc(...)` et `confirmFromProfile(...)`
 * qui mènent à la réservation, quel que soit le mot sur le bouton.
 */
const ctaActifs = (page) => page.evaluate(() => {
  const m = document.querySelectorAll('.modal-bg');
  const mod = m[m.length - 1];
  if (!mod) return null;
  return [...mod.querySelectorAll('button')]
    .filter((b) => !b.disabled &&
      /bookDoc\(|confirmFromProfile\(|showBookingModal\(/.test(b.getAttribute('onclick') || ''))
    .map((b) => (b.textContent || '').normalize('NFC').replace(/\s+/g, ' ').trim());
});

test.describe('fiche médecin — les appels à réserver suivent la réservabilité', () => {

  test('NON RÉSERVABLE : aucun bouton de réservation actif', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE. On compte les boutons ACTIFS, pas les textes :
    // un bouton désactivé qui dit « pas encore disponible » est une réponse,
    // un bouton actif qui refuse au clic est un piège.
    await ouvrir(page);
    await ouvrirModale(page, 'nonrevendique');

    expect(await ctaActifs(page), 'un appel à réserver survit sur une fiche non réservable')
      .toEqual([]);
    // Et on DIT pourquoi, au lieu de laisser un trou.
    expect(await texteModale(page)).toMatch(/pas encore disponible/i);
  });

  test('EN VALIDATION : pas d’appel à réserver, et le bon message', async ({ page }) => {
    // Une fiche revendiquée dont la validation est en cours n'est pas « pas
    // activée » : un humain est en train de vérifier. Dire l'un pour l'autre
    // enverrait le médecin revendiquer une fiche qu'il a déjà revendiquée.
    await ouvrir(page);
    await ouvrirModale(page, 'validation');

    expect(await ctaActifs(page)).toEqual([]);
    const t = await texteModale(page);
    expect(t).toMatch(/validation en cours/i);
    expect(t, 'on propose de revendiquer une fiche déjà revendiquée')
      .not.toMatch(/Revendiquez cette fiche/i);
  });

  test('NON REVENDIQUÉE : on oriente vers la revendication', async ({ page }) => {
    // ⚠️ On ne remplace pas deux boutons morts par un cul-de-sac. Personne ne
    // tient cette fiche : le seul geste utile, c'est que le médecin la
    // revendique. Le lien mène à sa fiche publique, qui porte le tunnel
    // pré-rempli (P-90).
    await ouvrir(page);
    await ouvrirModale(page, 'nonrevendique');

    const lien = page.locator('#cta-revendiquer');
    await expect(lien).toBeVisible();
    const href = await lien.getAttribute('href');
    expect(href).toContain('doctor-profile.html?id=');
    expect(href, 'le lien part sans identifiant : le médecin devra se chercher parmi 75 035 fiches')
      .toMatch(/id=[0-9a-f-]{36}$/i);
  });

  test('RÉSERVABLE : les deux appels à l’action sont TOUJOURS là', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DU CORRECTIF. Une garde qui ne vérifie que l'absence
    // finit par faire supprimer le bouton utile. Le parcours qui marche doit
    // rester intact — c'est la moitié la plus importante.
    await ouvrir(page);
    await ouvrirModale(page, 'reservable');

    const actifs = await ctaActifs(page);
    expect(actifs.length, 'les appels à réserver ont disparu d’une fiche RÉSERVABLE')
      .toBeGreaterThanOrEqual(2);
    expect(await page.locator('#cta-indispo').count()).toBe(0);
    expect(await page.locator('#cta-revendiquer').count()).toBe(0);
  });

  test('le bouton désactivé n’est pas cliquable — et le reste après un clic', async ({ page }) => {
    // Un `disabled` retiré par mégarde rendrait le piège d'origine. On clique
    // vraiment dessus, et on vérifie qu'il ne s'est rien passé.
    await ouvrir(page);
    await ouvrirModale(page, 'nonrevendique');

    const b = page.locator('#cta-indispo');
    await expect(b).toBeDisabled();
    // La modale défile : le bouton est en bas, hors de la fenêtre.
    await b.scrollIntoViewIfNeeded();
    await b.click({ force: true });
    await expect(page.locator('.modal-bg .modal-sheet').last()).toBeVisible();
    expect(await ctaActifs(page)).toEqual([]);
  });

  test('`doctor-profile.html` était DÉJÀ correcte — on ne l’a pas cassée', async ({ page }) => {
    // ⚠️ Vérifié avant d'y toucher, et gardé pour que personne ne « corrige »
    // ce qui marche : le bouton y est désactivé avec une mention explicite.
    const uuid = praticien('nonrevendique', 2).id;
    await page.route('**/rest/v1/rpc/praticien*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([praticien('nonrevendique', 2)]),
    }));
    await page.goto(`/doctor-profile.html?id=${uuid}`, ATTENDRE);

    await expect(page.locator('#reserve-btn')).toBeDisabled({ timeout: 10000 });
    await expect(page.locator('#reserve-mention')).toContainText(/pas encore activ/i);
  });
});
