// =====================================================================
// Une ordonnance au nom de « 3f2504e0... »
// =====================================================================
// ⚠️ `medecin-ordonnance.html` lisait le nom du patient dans `public.users` —
// une table dont la RLS **scope par `auth.uid()`** : un médecin n'y voit que
// sa propre ligne.
//
// La requête ne levait pas. Elle rendait simplement **rien**, et le code
// tombait dans son `else` :
//
//     $('#pv-pat').textContent = pid.slice(0, 8) + '...';
//
// L'ordonnance portait donc les huit premiers caractères d'un identifiant
// technique, **à la place du nom du patient**. Sur un document médical, ça
// ressemble à un nom tronqué : on ne se dit pas que c'est une panne.
//
// ---------------------------------------------------------------------
// LA MÊME CORRECTION AVAIT DÉJÀ ÉTÉ FAITE AILLEURS
// ---------------------------------------------------------------------
// `js/tabibi-messaging.js:71` porte le même commentaire, daté du 05/08/2026,
// pour le même motif : la vue `doctor_patients_directory` filtre par
// `auth.uid()` dans sa définition et ne rend que les patients ayant un
// rendez-vous avec ce médecin. **Même périmètre, sans la RLS qui bloque.**
//
// Le correctif avait été appliqué à un appelant et pas à l'autre — exactement
// la faute de P-65, où `getSupabase` avait voyagé sans sa définition.
//
// Vérifié en base le 16/09 : `doctor_patients_directory`, `authenticated:
// SELECT`, filtre `auth.uid()`, passe par `appointments`.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/medecin-ordonnance.html';
const PID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * Faux client : note la table interrogée et rend ce qu'on lui dit.
 * @param {object} parTable  { nomDeTable: {data, error} }
 */
async function bouchonner(page, parTable) {
  await page.route('**/js/supabase-client.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `
      window.tabibi = window.tabibi || {};
      window.__tables = [];
      const REP = ${JSON.stringify(parTable)};
      function chaine(t){
        const o = {
          select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o,
          maybeSingle: () => Promise.resolve(REP[t] || { data: null, error: null }),
          single: () => Promise.resolve(REP[t] || { data: null, error: null }),
          then: (res) => Promise.resolve(REP[t] || { data: [], error: null }).then(res),
        };
        return o;
      }
      window.tabibi.supabase = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'fx-doc' } } } }),
          getUser: async () => ({ data: { user: { id: 'fx-doc' } } }),
        },
        from: (t) => { window.__tables.push(t); return chaine(t); },
        rpc: async () => ({ data: null, error: null }),
      };`,
  }));
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => ({ id:'fx-doc', role:'medecin' }),
             getUser: async () => ({ id:'fx-doc', role:'medecin' }),
             signOut: async () => {}, logout: async () => {}
           };`,
  }));
}

/**
 * Saisit l'identifiant du patient et attend que la page ait INTERROGÉ la base.
 *
 * ⚠️ Pas de sommeil : le faux client note chaque table demandée, et une table
 * de plus est la preuve que `refreshPatientDisplay()` a tourné. Une durée fixe
 * ne prouverait que la vitesse de la machine.
 */
async function poserPatient(page, pid) {
  const avant = (await page.evaluate(() => window.__tables.length));
  await page.evaluate((id) => {
    const el = document.getElementById('f_patient_id');
    el.value = id;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }, pid);
  await expect.poll(() => page.evaluate(() => window.__tables.length),
    { timeout: 10000 }).toBeGreaterThan(avant);
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('le nom du patient sur une ordonnance', () => {

  test('il vient de `doctor_patients_directory`, pas de `users`', async ({ page }) => {
    await bouchonner(page, {
      doctor_patients_directory: { data: { first_name: 'Amina', last_name: 'Cherif' }, error: null },
      users: { data: { first_name: 'Dr', last_name: 'Traitant' }, error: null },
    });
    await page.goto(PAGE, ATTENDRE);
    await poserPatient(page, PID);

    await expect(page.locator('#pv-pat')).toHaveText('Amina Cherif');
    const tables = await page.evaluate(() => window.__tables);
    expect(tables, 'la vue des patients n’a pas été interrogée').toContain('doctor_patients_directory');
  });

  test('un identifiant ne sert JAMAIS de nom sur une ordonnance', async ({ page }) => {
    // ⚠️ LE SYMPTÔME D'ORIGINE. « 3f2504e0... » sur un document médical
    // ressemble à un nom tronqué : le médecin ne se dit pas que c'est une panne.
    await bouchonner(page, {
      doctor_patients_directory: { data: null, error: { message: 'permission denied' } },
    });
    await page.goto(PAGE, ATTENDRE);
    await poserPatient(page, PID);

    await expect(page.locator('#pv-pat')).toHaveText(/non identifié/i, { timeout: 8000 });
    const vu = await page.locator('#pv-pat').textContent();
    expect(vu, 'l’identifiant est encore affiché comme un nom').not.toContain('3f2504e0');
  });

  test('patient inconnu de la vue : on le dit, on n’invente pas', async ({ page }) => {
    await bouchonner(page, { doctor_patients_directory: { data: null, error: null } });
    await page.goto(PAGE, ATTENDRE);
    await poserPatient(page, PID);

    await expect(page.locator('#pv-pat')).toHaveText(/non identifié/i);
    await expect(page.locator('#patient-display')).toBeHidden();
  });

  test('une ligne SANS nom ne passe pas pour un patient identifié', async ({ page }) => {
    // La vue peut rendre une ligne dont les deux champs sont vides. Afficher
    // une chaîne vide en gros sur une ordonnance serait pire qu'un message.
    await bouchonner(page, {
      doctor_patients_directory: { data: { first_name: null, last_name: '' }, error: null },
    });
    await page.goto(PAGE, ATTENDRE);
    await poserPatient(page, PID);

    await expect(page.locator('#pv-pat')).toHaveText(/non identifié/i);
  });
});
