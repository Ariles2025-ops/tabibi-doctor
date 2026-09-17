// =====================================================================
// Un nom de membre allait brut dans `innerHTML` — dans la page qui
// peut retirer des membres
// =====================================================================
// ⚠️ DEUX ÉCRANS D'ADMINISTRATION DE CABINET INJECTAIENT DE LA DONNÉE DE BASE.
//
//   admin-cabinet.html, loadMembers()
//     `<div style="font-weight:700">${m.full_name||"--"}${pendingTag}</div>`
//     `<div …>${m.specialty_fr||""}</div>`  et  `<span class="role-pill ${pillClass}">${role}</span>`
//
//   secretaire-dashboard.html, loadCabinetDoctors()
//     `<option value="${d.user_id}">${d.full_name||"--"} (${d.specialty_fr||"--"})</option>`
//
// Aucun échappement. La donnée vient de `cabinet_members_directory_view`,
// c'est-à-dire de ce qu'un membre a saisi.
//
// ---------------------------------------------------------------------
// CE QUI REND CELUI-CI PLUS GRAVE QUE LA MOYENNE
// ---------------------------------------------------------------------
// La charge s'exécutait dans **la page d'administration du cabinet** — celle
// qui liste les membres et peut les retirer. Le lecteur de cette page est,
// par construction, celui qui a le plus de droits.
//
// Et `admin-cabinet.html` portait déjà un `_escAttr` **local** : il protégeait
// les attributs `data-*` du bouton « retirer », pendant que le texte juste au
// dessus partait brut. **La protection existait à côté du trou.**
//
// ---------------------------------------------------------------------
// COMMENT CES ESSAIS MESURENT
// ---------------------------------------------------------------------
// On ne cherche pas `&lt;` dans le HTML — ce serait garder une orthographe.
// On pose une charge qui **écrit une marque globale si elle s'exécute**, et on
// regarde la marque. Une charge qui ne s'exécute pas ne laisse rien.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const CABINET = '00000000-0000-4000-8000-00000000cab1';
const PIEGE = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';

/**
 * Remplace `js/supabase-client.js` par un faux client qui rend le membre piégé.
 *
 * ⚠️ On ne peut PAS poser le bouchon par `addInitScript` : le vrai
 * `supabase-client.js` fait `window.tabibi.supabase = createClient(…)`, sans
 * condition, et écraserait tout ce qu'on aurait mis avant. On remplace donc
 * le fichier lui-même — c'est le seul endroit où l'affectation a lieu.
 */
async function bouchonnerClient(page, membres) {
  await page.route('**/js/supabase-client.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `
      window.tabibi = window.tabibi || {};
      const MEMBRES = ${JSON.stringify(membres)};
      const CAB = ${JSON.stringify(CABINET)};
      function chaine(data){
        const o = {
          select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
          then: (res) => Promise.resolve({ data: data, error: null }).then(res),
        };
        return o;
      }
      window.tabibi.supabase = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'fx-admin' } } } }),
          signOut: async () => ({ error: null }),
        },
        rpc: async (nom) => {
          if (nom === 'get_my_cabinets') {
            return { data: [{ cabinet_id: CAB, name: 'Cabinet Essai', role: 'admin_cabinet' }], error: null };
          }
          return { data: [], error: null };
        },
        from: () => chaine(MEMBRES),
      };`,
  }));
}

async function bouchonnerAuth(page) {
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => ({ id:'fx-admin', role:'medecin', email:'a@b.test' }),
             getUser:     async () => ({ id:'fx-admin', role:'medecin' }),
             signOut: async () => {}, logout: async () => {}
           };`,
  }));
}

const MEMBRES = [{
  user_id: '00000000-0000-4000-8000-00000000m001',
  cabinet_id: CABINET,
  first_name: 'Amina', last_name: 'Cherif',
  full_name: PIEGE,
  specialty_fr: PIEGE,
  role: 'doctor',
  accepted: true,
}];

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await bouchonnerAuth(page);
  await bouchonnerClient(page, MEMBRES);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('un nom de membre piégé ne s’exécute pas', () => {

  test('admin-cabinet : la liste des membres n’exécute rien', async ({ page }) => {
    await page.goto('/admin-cabinet.html', ATTENDRE);
    // ⚠️ ON ATTEND LE RENDU, PAS UNE DUREE. Une charge qui s'exécute le fait au
    // moment où le HTML est posé : une fois le nom affiché, le verdict est
    // rendu. Dormir 600 ms rendrait l'essai vert sur une page lente qui n'a
    // simplement rien affiché — un vert qui ne protège personne.
    //
    // Et c'est aussi LA MOITIÉ QU'ON OUBLIE : échapper ne doit pas faire
    // disparaître le membre.
    await expect(page.locator('#members-list')).toContainText('img src=x', { timeout: 8000 });

    expect(await page.evaluate(() => window.__xss), 'la charge s’est exécutée').toBeUndefined();
    expect(await page.locator('#members-list img').count(), 'une balise a été construite').toBe(0);
  });

  test('secrétaire : le menu des médecins n’exécute rien', async ({ page }) => {
    await page.goto('/secretaire-dashboard.html', ATTENDRE);
    // Le nom reste lisible dans l'option, en TEXTE — et c'est ce rendu qui fait
    // foi : une fois l'option posée, une charge se serait déjà exécutée.
    await expect(page.locator('#na-doctor option')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('#na-doctor option').first()).toContainText('img src=x');

    expect(await page.evaluate(() => window.__xss), 'la charge s’est exécutée').toBeUndefined();
    expect(await page.locator('#na-doctor img').count()).toBe(0);
  });

  test('la charge EST bien exécutable — sinon ces essais ne prouvent rien', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE INDISPENSABLE. Si `onerror` ne se déclenchait pas
    // dans ce contexte (CSP, image jamais chargée…), les deux essais ci-dessus
    // seraient verts sur une page non protégée. On vérifie donc que la MÊME
    // charge, injectée sans échappement, marque bien `window.__xss`.
    await page.goto('/admin-cabinet.html', ATTENDRE);
    await page.evaluate((charge) => {
      const d = document.createElement('div');
      d.innerHTML = charge;
      document.body.appendChild(d);
    }, PIEGE);
    await expect.poll(() => page.evaluate(() => window.__xss), { timeout: 4000 }).toBe(1);
  });
});
