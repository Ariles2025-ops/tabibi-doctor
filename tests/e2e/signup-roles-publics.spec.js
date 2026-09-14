// =====================================================================
// Le formulaire public ne propose QUE les roles qui peuvent aboutir
// =====================================================================
// [14/09/2026] Le role « Secretariat » a ete retire du parcours public. Ce
// n'etait pas un defaut de code : c'etait **un chemin qui ne peut pas aboutir**.
//
// Le formulaire demandait un « code d'invitation cabinet » au format
// `cab_xxxxxxxx-xxxx-xxxx`. Mesure du 14/09 : RIEN, NULLE PART, ne genere un tel
// code — la chaine `cab_` n'existait qu'a un seul endroit du depot, ce
// placeholder. Et `accept_cabinet_invitation` n'attend pas un code : elle attend
// `p_cabinet_id uuid`, l'identifiant du cabinet, que rien ne communique a la
// secretaire. Celle qui tapait ce que le champ lui montrait recevait « Code
// cabinet invalide ou expire » et croyait s'etre trompee.
//
// CE TEST EST UNE ASSERTION NEGATIVE, et c'est sa raison d'etre : le code
// secretaire est toujours dans le fichier (volontairement, pour que la
// reouverture soit un geste d'interface). **Il serait donc facile de rendre le
// bouton par accident** — en decommentant, en regenerant le bloc, en copiant une
// ancienne version. Ce test l'empeche.
//
// A SUPPRIMER — pas a contourner — le jour ou le mecanisme d'invitation existe
// (une RPC qui emet un code + un ecran admin qui l'affiche). Le supprimer sera
// alors un geste delibere, pas un oubli.
// =====================================================================
const { test, expect } = require('@playwright/test');

// Les libelles sont traduits a l'execution : sans langue posee, la page suit le
// navigateur et rend « Doctor » au lieu de « Medecin ». On pose donc `fr` comme
// les autres specs — et on assertionne sur la CLE i18n, qui ne bouge pas d'une
// langue a l'autre. Un test qui depend d'une traduction casse au premier ajout
// de langue, et pour une raison qui n'a rien a voir avec ce qu'il garde.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('inscription publique — les roles proposes', () => {

  test('les deux roles qui aboutissent sont proposes', async ({ page }) => {
    await page.goto('/signup.html');
    const roles = page.locator('[role="radiogroup"] button[role="radio"]');
    await expect(roles).toHaveCount(2);
    await expect(roles.nth(0).locator('[data-i18n]')).toHaveAttribute('data-i18n', 'role_patient');
    await expect(roles.nth(1).locator('[data-i18n]')).toHaveAttribute('data-i18n', 'role_doctor');
  });

  test('« Secretariat » N EST PAS proposable — il ne peut pas aboutir', async ({ page }) => {
    await page.goto('/signup.html');

    // Aucun bouton de role ne le propose.
    const roles = page.locator('[role="radiogroup"] button[role="radio"]');
    await expect(roles).toHaveCount(2);
    const cles = await page.locator('[role="radiogroup"] button[role="radio"] [data-i18n]')
                           .evaluateAll((els) => els.map((e) => e.getAttribute('data-i18n')));
    expect(cles).not.toContain('role_secretaire');

    // Et aucun element cliquable de la page ne declenche selRole('secretaire') —
    // un bouton cache ailleurs compterait aussi.
    const declencheurs = await page.locator('[onclick*="secretaire"]').count();
    expect(declencheurs).toBe(0);

    // Le champ « code cabinet » n'est jamais montre : il ne peut plus l'etre,
    // puisque rien ne selectionne le role qui le revele.
    await expect(page.locator('#scab')).toBeHidden();
  });

  test('le code secretaire reste dans le fichier — la reouverture doit rester simple', async ({ page }) => {
    // On ne teste pas du code mort pour le plaisir : on garde la PROPRIETE que la
    // decision est reversible. Si quelqu'un supprimait le bloc au lieu de le
    // masquer, ce test tomberait et la discussion aurait lieu.
    const source = await page.request.get('/signup.html').then((r) => r.text());
    expect(source).toContain("selRole('secretaire'");   // present, mais commente
    expect(source).toContain('accept_cabinet_invitation');
    expect(source).toContain('id="scab"');
  });
});
