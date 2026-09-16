// =====================================================================
// Le bouton « Changer le mot de passe » change le mot de passe
// =====================================================================
// ⚠️ IL NE LE CHANGEAIT PAS. Sur `patient-profile.html` comme sur
// `medecin-profile.html`, `changePassword()` appelait `getSupabase()` — une
// fonction définie **nulle part**. Le `ReferenceError` tombait dans le `catch`
// et l'écran affichait « Échec du changement — réessayez ».
//
// ---------------------------------------------------------------------
// POURQUOI UN ESSAI DE SOURCE NE SUFFISAIT PAS
// ---------------------------------------------------------------------
// `tests/client-supabase-defini.test.mjs` garde la RÉFÉRENCE : que la page
// nomme un client qui existe. Il ne peut pas dire si la fonction **demande
// vraiment le changement au serveur** — une fonction peut être syntaxiquement
// juste et ne rien appeler.
//
// Ici on appelle la fonction pour de vrai, avec un client bouchonné, et on
// regarde **ce qu'elle lui demande**. C'est le seul niveau où « le bouton
// change le mot de passe » veut dire quelque chose.
//
// ⚠️ Rien ne sort de localhost (`_hermetique`) et aucun mot de passe réel
// n'est en jeu : le client est un objet posé par l'essai.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGES = ['/patient-profile.html', '/medecin-profile.html'];

/** Ouvre la page en patient/médecin connecté, sans réseau. */
async function ouvrir(page, chemin) {
  const role = chemin.includes('medecin') ? 'doctor' : 'patient';
  // `requireAuth` garde la page : on la neutralise comme les autres essais.
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             getUser:     async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             signOut:     async () => {}, logout: async () => {}
           };`,
  }));
  await page.addInitScript((r) => {
    localStorage.setItem('tabibi_user', JSON.stringify({
      id: 'fx', role: r, name: 'Fixture', first_name: 'Fixture', email: 'fixture@example.test',
    }));
    localStorage.setItem('tabibi_role', r);
    localStorage.setItem('tabibi_lang', 'fr');
  }, role);
  await page.goto(chemin, ATTENDRE);
}

/**
 * Remplace le client par un bouchon qui NOTE ce qu'on lui demande, et répond
 * ce qu'on lui dit de répondre.
 */
async function bouchonnerClient(page, reponse) {
  await page.evaluate((rep) => {
    window.tabibi = window.tabibi || {};
    window.__appels = [];
    window.tabibi.supabase = {
      auth: {
        updateUser: async (payload) => {
          window.__appels.push(payload);
          return rep.erreur ? { data: null, error: { message: rep.erreur } } : { data: {}, error: null };
        },
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: { user: { id: 'fx' } } } }),
      },
    };
  }, reponse);
}

/** Les deux `prompt()` de la fonction : nouveau mot de passe, puis confirmation. */
async function repondreAuxPrompts(page, valeur) {
  await page.evaluate((v) => { window.prompt = () => v; }, valeur);
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});

for (const chemin of PAGES) {
  test.describe(`${chemin} — changer le mot de passe`, () => {

    test('la demande PART vers le serveur, et l écran dit que c est fait', async ({ page }) => {
      await ouvrir(page, chemin);
      await bouchonnerClient(page, {});
      await repondreAuxPrompts(page, 'unMotDePasseAssezLong');

      await page.evaluate(() => window.changePassword());

      const appels = await page.evaluate(() => window.__appels);
      expect(appels, 'aucune demande n a ete envoyee au client').toHaveLength(1);
      expect(appels[0].password).toBe('unMotDePasseAssezLong');
      await expect(page.locator('#toast-container')).toContainText(/chang/i);
    });

    test('un refus du serveur reste un ECHEC — pas un faux succès', async ({ page }) => {
      // La contre-épreuve : si l'essai du dessus passait parce qu'on affiche
      // « changé » quoi qu'il arrive, celui-ci le dirait.
      await ouvrir(page, chemin);
      await bouchonnerClient(page, { erreur: 'New password should be different' });
      await repondreAuxPrompts(page, 'unMotDePasseAssezLong');

      await page.evaluate(() => window.changePassword());

      const texte = (await page.locator('#toast-container').textContent()) || '';
      expect(texte).toMatch(/chec/i);
      expect(texte, 'un refus serveur affiche quand meme « change »').not.toMatch(/chang[ée]\b/i);
    });

    test('client absent : on ne dit pas « réessayez » — réessayer n y changerait rien', async ({ page }) => {
      // ⚠️ C'EST LE MESSAGE QUI A MASQUE LE DEFAUT. Le patient relançait une
      // opération qui ne pouvait pas aboutir, et rien ne le détrompait.
      await ouvrir(page, chemin);
      await page.evaluate(() => { window.tabibi = window.tabibi || {}; window.tabibi.supabase = null; });
      await repondreAuxPrompts(page, 'unMotDePasseAssezLong');

      await page.evaluate(() => window.changePassword());

      await expect(page.locator('#toast-container')).toContainText(/indisponible/i);
    });

    test('un mot de passe trop court n atteint jamais le serveur', async ({ page }) => {
      await ouvrir(page, chemin);
      await bouchonnerClient(page, {});
      await repondreAuxPrompts(page, 'court');

      await page.evaluate(() => window.changePassword());

      expect(await page.evaluate(() => window.__appels)).toHaveLength(0);
    });
  });
}
