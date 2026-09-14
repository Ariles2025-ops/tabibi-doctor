// =====================================================================
// La tuile « Échecs d'audit (rebut) » — elle ne ment pas quand elle ne sait pas
// =====================================================================
// `public.audit_log_echecs` recueille les ecritures d'audit perdues par les
// sept RPC classees PREUVE. Sans compteur a l'ecran, c'est un tiroir : la
// table existe, personne ne l'ouvre, et le silence a simplement demenage.
//
// CE QUE CE TEST GARDE, ET C'EST LE TROISIEME ETAT :
//
//   > **Un compteur qui affiche 0 parce qu'il n'a PAS PU compter est un
//   > mensonge.** C'est la classe du « catch mort » : l'echec ne se voit nulle
//   > part, et l'ecran affirme que tout va bien.
//
// Les deux premiers etats (0 vert, n rouge) sont faciles et ne cassent pas.
// Le troisieme est celui qu'on rate, et c'est celui qui compte.
//
// ---------------------------------------------------------------------
// CE QUE CE TEST NE PROUVE PAS — a lire avant de s'y fier
// ---------------------------------------------------------------------
// Le refus `42501` est SIMULE par une route Playwright, pas obtenu d'une vraie
// session non-admin. **Il n'existe aucune fixture de compte dans cette suite**
// (les tests posent du localStorage et bouchonnent `js/auth.js` ; aucun compte
// n'est cree, aucun reseau ne part vers Supabase). On ne fabrique pas un compte
// admin pour un test sans decision.
//
// Restent donc NON EPROUVES, et ils le seront le jour ou une fixture existera :
//   • que la garde SQL de `admin_audit_rebut_count()` rende bien `42501` a un
//     authentifie non-admin (le corps le dit, la base ne l'a jamais joue) ;
//   • que `tabibiRpc` traduise ce 401 PostgREST exactement comme ici.
// Ce test garde le COMPORTEMENT DE L'ECRAN face a un refus. Pas le refus.
// =====================================================================
const { test, expect } = require('@playwright/test');

// Pose un admin cote CLIENT uniquement : bouchon a la place de js/auth.js,
// comme parcours-4-fixture-sale. Aucun compte, aucune ecriture, aucun reseau.
async function poserAdmin(page) {
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             getUser:     async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             getSession:  async () => ({ user: JSON.parse(localStorage.getItem('tabibi_user') || 'null') }),
             signOut:     async () => {},
             logout:      async () => {}
           };`
  }));
  await page.addInitScript(() => {
    localStorage.setItem('tabibi_user', JSON.stringify({
      id: 'fx-admin', role: 'admin', status: 'active',
      name: 'Fixture Admin', first_name: 'Fixture', last_name: 'Admin', email: 'fx@example.test'
    }));
    localStorage.setItem('tabibi_role', 'admin');
    localStorage.setItem('tabibi_lang', 'fr');
  });
}

// Repond a la place de PostgREST pour UNE rpc. Enregistree APRES le filet
// d'abandon : Playwright essaie les routes de la plus recente a la plus
// ancienne, donc celle-ci gagne.
async function repondreRpc(page, nom, statut, corps) {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.route(`**/rest/v1/rpc/${nom}`, (route) => route.fulfill({
    status: statut, contentType: 'application/json', body: JSON.stringify(corps)
  }));
}

const VALEUR = '#rebut-valeur';
const DETAIL = '#rebut-detail';

test.describe('rebut d audit — la tuile admin', () => {

  test('la tuile existe sur la vue d ensemble', async ({ page }) => {
    await poserAdmin(page);
    await repondreRpc(page, 'admin_audit_rebut_count', 200, 0);
    await page.goto('/admin-dashboard.html');
    await expect(page.locator('#rebut-carte')).toBeVisible();
    await expect(page.locator('#rebut-carte')).toContainText("Échecs d'audit");
  });

  test('SUR REFUS, la tuile dit qu elle ne sait pas — jamais 0', async ({ page }) => {
    await poserAdmin(page);
    // Ce que PostgREST rend quand la garde SQL leve `not_admin` en 42501.
    await repondreRpc(page, 'admin_audit_rebut_count', 401, {
      code: '42501', message: 'not_admin', details: null, hint: null
    });
    await page.goto('/admin-dashboard.html');

    const valeur = page.locator(VALEUR);
    await expect(valeur).toContainText('rebut illisible');

    // LE COEUR DU TEST : aucun zero, aucun « aucun echec ».
    await expect(valeur).not.toContainText('aucun échec');
    await expect(valeur).not.toContainText('0');

    // Et l'ecran DIT que le nombre est inconnu, il ne se tait pas.
    const detail = page.locator(DETAIL);
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('INCONNU, pas nul');
    await expect(detail).toContainText('not_admin');
  });

  test('a zero, la tuile est verte et l a VRAIMENT compte', async ({ page }) => {
    await poserAdmin(page);
    await repondreRpc(page, 'admin_audit_rebut_count', 200, 0);
    await page.goto('/admin-dashboard.html');

    const valeur = page.locator(VALEUR);
    await expect(valeur).toContainText('aucun échec');

    // Assertion sur le STYLE CALCULE, jamais sur la classe : c'est la couleur
    // que l'oeil voit qui distingue « compte a zero » de « n'a pas pu compter ».
    const couleur = await valeur.locator('span').evaluate((el) => getComputedStyle(el).color);
    expect(couleur).toBe('rgb(5, 150, 105)');
  });

  test('a n > 0, le nombre est rouge et la liste se deplie', async ({ page }) => {
    await poserAdmin(page);
    await repondreRpc(page, 'admin_audit_rebut_count', 200, 2);
    await page.route('**/rest/v1/rpc/admin_audit_rebut_list', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, survenu_le: '2026-09-14T08:30:00Z', fonction: 'create_cabinet',
          sqlstate: '23505', sqlerrm: 'duplicate key', action: 'cabinet:create', table_name: 'cabinet' },
        { id: 2, survenu_le: '2026-09-14T09:15:00Z', fonction: 'invite_cabinet_member',
          sqlstate: '53100', sqlerrm: 'disk full', action: 'cabinet_member:invite', table_name: 'cabinet_member' }
      ])
    }));
    await page.goto('/admin-dashboard.html');

    const bouton = page.locator('#rebut-bouton');
    await expect(bouton).toContainText('2 échecs');
    const couleur = await bouton.evaluate((el) => getComputedStyle(el).color);
    expect(couleur).toBe('rgb(220, 38, 38)');

    await expect(page.locator(DETAIL)).toBeHidden();
    await bouton.click();
    const detail = page.locator(DETAIL);
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('create_cabinet');
    await expect(detail).toContainText('23505');
    await expect(detail).toContainText('cabinet_member:invite');
  });
});
