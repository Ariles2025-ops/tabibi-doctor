// =====================================================================
// « Vous êtes ce médecin ? » — proposé à un patient connecté
// =====================================================================
// ⚠️ TROUVÉ EN LIVE PAR AGHILES. Le bloc de revendication s'affichait à
// **n'importe qui**, y compris à un patient connecté, sur la fiche du praticien
// qu'il venait peut-être de consulter.
//
// Un patient ne sera jamais « ce médecin ». Ce n'était pas une fuite ni une
// panne : juste une proposition absurde, au pire endroit.
//
// ---------------------------------------------------------------------
// LA CONDITION — celle que les pages lisent déjà
// ---------------------------------------------------------------------
// `tabibi_user` dans `localStorage`, comme `_refreshReserveBtnState`
// (`doctor-profile.html`) et `loadUser()` (`js/home-app.js`). On ne branche pas
// une seconde source de vérité pour une question d'AFFICHAGE : `reservation.html`
// reste l'endroit où la vraie session est vérifiée, au moment d'agir.
//
// ⚠️ ET LES RÔLES SONT NORMALISÉS. `js/auth.js` accepte `doctor`, `médecin` et
// `medecin` pour la même personne. Comparer à la seule chaîne « medecin »
// masquerait le bloc à un médecin dont le profil dit « doctor » — c'est-à-dire
// exactement à la personne qu'on veut atteindre.
//
// ---------------------------------------------------------------------
// ⚠️ CE QUI RESTE VISIBLE POUR TOUT LE MONDE
// ---------------------------------------------------------------------
// Le badge « Fiche non revendiquée ». C'est une information VRAIE, et elle
// explique au patient pourquoi la réservation est désactivée. Masquer le bloc
// entier ferait tomber un patient dans la branche du badge vert « Fiche
// revendiquée par le médecin » — on aurait remplacé une proposition absurde par
// une information fausse. Nettement pire.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3307';

function fiche(surcharge) {
  return {
    id: UUID, legacy_id: 909,
    full_name: 'BENALI Mohamed', entity_type: 'doctor',
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16,
    languages: ['fr'], rating: null, review_count: 0,
    is_verified: false, is_claimed: false, validation_status: null,
    ...surcharge,
  };
}

/** Pose (ou non) une session locale, comme le ferait une connexion. */
async function session(page, role) {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      if (r) {
        localStorage.setItem('tabibi_user', JSON.stringify({
          id: '00000000-0000-4000-8000-0000000000e1', role: r, name: 'Essai',
        }));
        localStorage.setItem('tabibi_role', r);
      } else {
        localStorage.removeItem('tabibi_user');
        localStorage.removeItem('tabibi_role');
      }
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, role);
}

async function ouvrirFiche(page, role, surcharge) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await session(page, role);
  await page.route('**/rest/v1/rpc/praticien*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([fiche(surcharge)]),
  }));
  await page.goto(`/doctor-profile.html?id=${UUID}`, ATTENDRE);
  await expect(page.locator('#claim-status-block')).toBeAttached({ timeout: 10000 });
}

const texte = (page, sel) => page.locator(sel).innerText()
  .then((t) => t.normalize('NFC').replace(/\s+/g, ' ').trim());

test.describe('fiche publique — à qui propose-t-on de revendiquer', () => {

  test('PATIENT connecté : aucun appel à revendiquer', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE.
    await ouvrirFiche(page, 'patient');

    expect(await page.locator('#claim-cta').count(),
      'on propose à un patient de revendiquer une fiche de médecin').toBe(0);
    expect(await page.locator('#claim-cta-link').count()).toBe(0);
    expect(await texte(page, '#claim-status-block'))
      .not.toMatch(/vous êtes ce médecin/i);
  });

  test('… mais le badge « non revendiquée » reste, et il dit VRAI', async ({ page }) => {
    // ⚠️ LA MOITIÉ QU'ON CASSE EN MASQUANT TROP. Sans elle, un patient sur une
    // fiche non revendiquée tomberait dans la branche du badge VERT
    // « Fiche revendiquée par le médecin » — une information fausse, et qui
    // contredirait le bouton de réservation désactivé juste à côté.
    await ouvrirFiche(page, 'patient');

    const vu = await texte(page, '#claim-status-block');
    expect(vu, 'le badge d’état a disparu pour le patient').toMatch(/non revendiquée/i);
    expect(vu, 'on annonce une fiche revendiquée alors qu’elle ne l’est pas')
      .not.toMatch(/revendiquée par le médecin/i);
  });

  test('VISITEUR non connecté : l’appel est bien là', async ({ page }) => {
    // C'est LUI qu'on veut atteindre : un médecin qui tombe sur sa propre fiche
    // depuis une recherche, sans compte.
    await ouvrirFiche(page, null);

    await expect(page.locator('#claim-cta')).toBeVisible();
    await expect(page.locator('#claim-cta-link'))
      .toHaveAttribute('href', 'doctor-claim.html?legacy_id=909');
  });

  for (const role of ['medecin', 'doctor', 'médecin']) {
    test(`MÉDECIN connecté (role « ${role} ») : l’appel reste visible`, async ({ page }) => {
      // ⚠️ LES TROIS ÉCRITURES COMPTENT. `js/auth.js` les normalise toutes en
      // « medecin » ; une comparaison naïve à la seule chaîne « medecin »
      // masquerait le bloc à un médecin dont le profil dit « doctor » —
      // exactement la personne qu'on veut atteindre.
      await ouvrirFiche(page, role);
      await expect(page.locator('#claim-cta')).toBeVisible();
    });
  }

  test('fiche DÉJÀ revendiquée : rien ne change pour personne', async ({ page }) => {
    // Le rôle ne doit pas rouvrir un appel que l'état de la fiche a fermé.
    await ouvrirFiche(page, 'medecin', { is_claimed: true });

    expect(await page.locator('#claim-cta').count()).toBe(0);
    expect(await texte(page, '#claim-status-block')).toMatch(/revendiquée par le médecin/i);
  });
});

test.describe('modale de l’accueil — même règle', () => {

  const LIGNES = [fiche({ id: UUID })];

  async function ouvrirModale(page, role) {
    await hermetiser(page);
    await neutraliserCaptcha(page);
    await session(page, role);
    const rendre = (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(LIGNES),
    });
    await page.route('**/rest/v1/rpc/praticiens_vitrine', rendre);
    await page.route('**/rest/v1/rpc/chercher_praticiens', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 1, page: 1, limite: 20, lignes: LIGNES }),
    }));
    await page.goto('/accueil-public.html', ATTENDRE);
    await expect(page.locator('#docs-list').first()).toBeAttached({ timeout: 10000 });
    await page.evaluate((id) => window.goDoc(id), UUID);
    await expect(page.locator('.modal-bg .modal-sheet').last()).toBeVisible({ timeout: 8000 });
  }

  test('PATIENT connecté : pas de lien « Revendiquez cette fiche »', async ({ page }) => {
    await ouvrirModale(page, 'patient');
    expect(await page.locator('#cta-revendiquer').count(),
      'la modale propose à un patient de revendiquer').toBe(0);
  });

  test('VISITEUR non connecté : le lien est là', async ({ page }) => {
    await ouvrirModale(page, null);
    await expect(page.locator('#cta-revendiquer')).toBeVisible();
  });

  test('le bouton « Réservation indisponible » reste, lui, pour tout le monde', async ({ page }) => {
    // ⚠️ Il explique pourquoi on ne peut pas réserver. Le masquer avec l'appel
    // à revendiquer laisserait le patient devant un silence.
    await ouvrirModale(page, 'patient');
    await expect(page.locator('#cta-indispo')).toBeAttached();
  });
});
