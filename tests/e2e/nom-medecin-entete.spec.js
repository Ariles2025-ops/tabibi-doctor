// =====================================================================
// « Dr. -- » — le nom était là, à un champ de distance
// =====================================================================
// ⚠️ LE MEDECIN PILOTE VOYAIT « Dr. -- » sur son propre tableau de bord.
//
// Le nom de l'entête venait UNIQUEMENT de la table `users` :
//
//     const name = (fn + ' ' + ln).trim() || (a.email||'').split('@')[0];
//
// Un médecin pilote entre par son NUMÉRO (`acces-pilote`) : pas de prénom, pas
// de nom, **pas d'e-mail**. `''.split('@')[0]` vaut `''` — donc `u.name` est
// vide, donc `u.name || "Dr. --"` affiche le tiret. À trois endroits :
// `med-name`, `prof-name`, `menu-name`.
//
// Son nom existait pourtant dans `doctor_profiles.full_name`, et la page
// appelait **déjà** `getMyProfile()` — qui rend la ligne entière
// (`RETURNS doctor_profiles`, vérifié en base). Elle n'en lisait que
// `working_hours`.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS PROUVENT, ET CE QU'ILS NE PROUVENT PAS
// ---------------------------------------------------------------------
// La fiche est bouchonnée : ils prouvent que la PAGE va chercher le nom là où
// il est et l'affiche partout. Ils ne disent pas que la base en renvoie un.
//
// La fixture est celle demandée : `users` **sans nom ni e-mail**,
// `doctor_profiles.full_name = 'Benali'`.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/doctor-dashboard.html';

/**
 * Prépare la page : `users` renvoyé par `requireAuth`, et la fiche médecin.
 * @param {object|null} fiche  la ligne `doctor_profiles`, ou null si pas réclamée
 * @param {object} usagerSupp  ce que `users` porte en plus (nom, e-mail…)
 */
async function ouvrir(page, fiche, usagerSupp = {}) {
  const usager = { id: 'fx-user', role: 'medecin', phone: '+213700000000', ...usagerSupp };

  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => (${JSON.stringify(usager)}),
             getUser:     async () => (${JSON.stringify(usager)}),
             signOut: async () => {}, logout: async () => {}
           };`,
  }));

  // `js/tabibi-doctor-dashboard.js` fait `window.tabibiDoctor = window.tabibiDoctor || {…}`
  // et sort tout de suite si `getMyProfile` existe deja : poser le bouchon
  // AVANT le chargement suffit a neutraliser le module.
  await page.addInitScript((f) => {
    window.__profilsDemandes = 0;
    window.tabibiDoctor = {
      getMyProfile: async () => { window.__profilsDemandes++; return f; },
      getMyDoctorId: async () => (f ? f.id : null),
      invalidateDoctorIdCache: () => {},
      parseScheduleDays: () => ({}),
      serializeScheduleDays: () => ({}),
      listUnavailableSlots: async () => [],
      addUnavailableSlot: async () => ({ ok: true }),
      deleteUnavailableSlot: async () => ({ ok: true }),
      updateMyProfile: async () => ({ ok: true }),
    };
    localStorage.setItem('tabibi_lang', 'fr');
    localStorage.removeItem('tabibi_user');
  }, fiche);

  await page.goto(PAGE, ATTENDRE);
}

/** Les trois endroits où le nom s'affiche. */
const ENDROITS = ['#med-name', '#prof-name', '#menu-name'];

const FICHE = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Benali', specialty_raw: 'Cardiologue', city: 'Alger',
  entity_type: 'doctor', is_claimed: true, working_hours: null,
};

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

test.describe('le nom du médecin dans l’entête', () => {

  test('`users` sans nom : l entete prend celui de la FICHE, jamais « Dr. -- »', async ({ page }) => {
    await ouvrir(page, FICHE);

    // `renderProfile()` relit le cache : on l'appelle pour couvrir l'onglet profil.
    await page.evaluate(() => { try { window.renderProfile(); } catch (e) { /* onglet non monte */ } });

    for (const sel of ENDROITS) {
      await expect(page.locator(sel), `${sel}`).toContainText(/Benali/, { timeout: 8000 });
      const txt = (await page.locator(sel).textContent()) || '';
      expect(txt, `${sel} affiche encore un tiret`).not.toMatch(/^\s*(Dr\.?\s*)?--\s*$/);
    }
  });

  test('un `users` QUI A un nom garde le sien — on ne change pas la source', async ({ page }) => {
    // ⚠️ LA CONTRE-EPREUVE. Le correctif comble un trou ; il ne doit pas
    // renommer les comptes qui vont bien. Si la fiche prenait la main, tout
    // medecin dont `users` et `doctor_profiles` divergent verrait son entete
    // changer sans l'avoir demande.
    await ouvrir(page, FICHE, { first_name: 'Amina', last_name: 'Cherif' });

    await expect(page.locator('#med-name')).toContainText(/Amina Cherif/, { timeout: 8000 });
    // ⚠️ La fiche EST quand meme chargee ensuite : l'agenda en a besoin pour
    // les horaires. Ce qu'on garde, c'est qu'elle n'ECRASE rien en passant.
    await page.waitForTimeout(1200);
    for (const sel of ['#med-name', '#menu-name']) {
      await expect(page.locator(sel), `${sel} a ete renomme`).toContainText(/Amina Cherif/);
      await expect(page.locator(sel)).not.toContainText(/Benali/);
    }
  });

  test('aucune fiche réclamée : on n’INVENTE pas un nom', async ({ page }) => {
    // Sans fiche, il n'y a rien a afficher. Le tiret est alors la reponse
    // HONNETE — mieux qu'un nom fabrique (P-27, P-47).
    await ouvrir(page, null);
    await expect(page.locator('#med-name')).toHaveText(/--/, { timeout: 8000 });
  });

  test('une fiche SANS nom ne devient pas « Praticien »', async ({ page }) => {
    // ⚠️ `tabibiDoctorName.format()` ne rend jamais vide : sans nom il rend
    // « Praticien ». Sur une liste publique c'est un repli utile ; ecrit dans
    // le cache du medecin connecte, ce serait une identite inventee.
    await ouvrir(page, { ...FICHE, full_name: null, full_name_ar: null });

    const txt = (await page.locator('#med-name').textContent()) || '';
    expect(txt).not.toMatch(/Praticien/i);
    expect(txt).toMatch(/--/);
  });

  test('la fiche n est demandée QU UNE FOIS au démarrage', async ({ page }) => {
    // L'agenda la relisait en la redemandant au serveur. Deux allers-retours
    // pour la meme ligne, sur une page qui en fait deja beaucoup.
    await ouvrir(page, FICHE);
    await expect(page.locator('#med-name')).toContainText(/Benali/, { timeout: 8000 });
    await page.waitForTimeout(1200);   // laisse passer loadDoctorScheduleFromDb + loadUnavailSlots

    expect(await page.evaluate(() => window.__profilsDemandes)).toBe(1);
  });
});
