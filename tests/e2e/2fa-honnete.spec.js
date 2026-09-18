// =====================================================================
// « 2FA activée — vos connexions sont sécurisées » : les deux étaient faux
// =====================================================================
// `medecin-profile.html` faisait tout le parcours TOTP — QR code, validation
// du code à 6 chiffres, dix codes de secours — puis écrivait ceci :
//
//     u._totp_secret_temp = _2faSecret;     // le secret, EN CLAIR
//     u._totp_backup_hashes = hashes;
//     localStorage.setItem("tabibi_user", …);
//     // TODO Edge Function : envoyer à Supabase
//
// …et affichait « **2FA activée — vos connexions sont sécurisées** ».
//
// ---------------------------------------------------------------------
// LE SECOND DÉFAUT, MESURÉ, ET C'EST LE PIRE
// ---------------------------------------------------------------------
// **Aucune vérification TOTP à la connexion.** Ni `login.html`, ni
// `js/auth.js` ne demandent de code — relevé le 18/09. Même persisté côté
// serveur, ce secret n'aurait rien protégé : personne ne l'aurait jamais
// demandé.
//
// La promesse était donc fausse à DEUX niveaux, et un médecin la lisait sur
// l'écran qui donne accès aux dossiers de ses patients.
//
// **Un faux positif de sécurité est pire qu'une absence de sécurité** : il
// fait baisser la garde de quelqu'un qui croyait s'être protégé.
//
// ---------------------------------------------------------------------
// ET L'INTERRUPTEUR ÉTAIT ALLUMÉ D'USINE
// ---------------------------------------------------------------------
// `medecin-profile.html:377` : « 2FA obligatoire (recommandé) · **SMS de
// vérification à chaque connexion** », `class="toggle-switch on"`. Aucun SMS
// n'est envoyé : `toggleSwitch` bascule une classe, `saveAll()` range la
// valeur dans `localStorage`, et rien ne la lit jamais. C'était le faux
// positif le plus visible de la page — et le seul qui était **activé par
// défaut**.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '00000000-0000-4000-8000-00000000000d';

/**
 * Ouvre le profil médecin.
 * @param avecTraces  simule un médecin qui avait « activé » la 2FA avant ce lot
 */
async function ouvrir(page, { avecTraces = false } = {}) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      const u = { id: ctx.id, role: 'medecin', name: 'Dr Essai', email: 'd@example.test' };
      if (ctx.traces) {
        // L'état exact que `save2FAToProfile` laissait derrière lui.
        u.totp_enabled = true;
        u._totp_secret_temp = 'JBSWY3DPEHPK3PXP';
        u._totp_backup_hashes = ['a1b2', 'c3d4'];
      }
      localStorage.setItem('tabibi_user', JSON.stringify(u));
      localStorage.setItem('tabibi_role', 'medecin');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'd@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: MEDECIN, traces: avecTraces });

  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test' }) }));
  await page.route('**/rest/v1/users*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test', role: 'medecin', status: 'active' }) }));

  await page.goto('/medecin-profile.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session médecin n’a pas pris').not.toContain('login.html');
  await expect(page.locator('#twofa-status')).toBeAttached({ timeout: 10000 });
  await page.waitForFunction(() => {
    const e = document.getElementById('twofa-status');
    return e && e.textContent.trim().length > 0;
  }, { timeout: 10000 });
}

/** Tout le texte de l'écran, ramené à une ligne. */
const ecran = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

test.describe('2FA : plus aucune promesse de sécurité non tenue', () => {

  test('AUCUN écran n’annonce une 2FA active', async ({ page }) => {
    await ouvrir(page);
    const texte = await ecran(page);
    expect(texte, 'l’écran annonce une 2FA active').not.toMatch(/2FA activée/i);
    expect(texte, 'l’écran promet des connexions sécurisées')
      .not.toMatch(/connexions sont sécurisées/i);
    expect(texte, 'l’écran dit ce qu’il en est').toMatch(/en préparation/i);
  });

  test('⚠️ MÊME pour un médecin qui avait « activé » avant ce lot', async ({ page }) => {
    // C'est le cas qui compte : celui qui croyait être protégé. Le taire
    // serait continuer le mensonge sous une autre forme.
    await ouvrir(page, { avecTraces: true });
    const texte = await ecran(page);
    expect(texte, 'un médecin « activé » voit toujours « 2FA activée »')
      .not.toMatch(/2FA activée/i);
    expect(texte, 'on ne lui dit pas que son activation ne protégeait rien')
      .toMatch(/n’a jamais protégé|n'a jamais protégé/i);
  });

  test('le levier d’activation ne peut plus aboutir', async ({ page }) => {
    // ⚠️ DEUX VERROUS, ET LES DEUX COMPTENT. Le bouton est `disabled` ; et
    // `open2FASetup` refuse en tête, parce qu'un `disabled` se retire depuis la
    // console et que la fonction est globale.
    await ouvrir(page);
    const btn = page.locator('#twofa-toggle-btn');
    expect(await btn.isDisabled(), 'le bouton d’activation est de nouveau cliquable').toBe(true);

    await page.evaluate(() => window.open2FASetup && window.open2FASetup());
    await page.waitForTimeout(400);
    expect(await page.locator('#twofa-modal.hidden').count(),
      'le parcours d’activation s’ouvre encore').toBe(1);
  });

  test('rien n’écrit un secret TOTP dans le navigateur', async ({ page }) => {
    // ⚠️ LE CŒUR DU DÉFAUT : un secret en clair dans `localStorage`. Il ne doit
    // plus pouvoir y arriver, même en appelant le parcours à la main.
    await ouvrir(page);
    await page.evaluate(() => window.open2FASetup && window.open2FASetup());
    await page.waitForTimeout(400);
    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_user') || '{}'));
    expect(u._totp_secret_temp, 'un secret TOTP a été écrit en clair').toBeUndefined();
    expect(u.totp_enabled, 'le drapeau « 2FA active » a été posé').toBeUndefined();
  });

  test('les traces locales peuvent être effacées, et le sont vraiment', async ({ page }) => {
    await ouvrir(page, { avecTraces: true });
    await page.getByRole('button', { name: /Effacer les traces locales/i }).click();
    await expect.poll(() => page.evaluate(
      () => JSON.parse(localStorage.getItem('tabibi_user') || '{}')._totp_secret_temp
    ), { timeout: 8000 }).toBeUndefined();

    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_user') || '{}'));
    expect(u.totp_enabled).toBeUndefined();
    expect(u._totp_backup_hashes).toBeUndefined();
    // ⚠️ Et on n'a pas effacé le reste du profil au passage.
    expect(u.role, 'la purge a emporté le profil').toBe('medecin');
    expect(u.email).toBe('d@example.test');
  });

  test('l’interrupteur « SMS à chaque connexion » ne s’allume plus', async ({ page }) => {
    // Il était `on` D'USINE et annonçait un SMS qui n'existe pas.
    await ouvrir(page);
    expect(await page.locator('[data-key="sec_2fa"]').count(),
      'l’interrupteur de fausse 2FA est revenu').toBe(0);
    const texte = await ecran(page);
    expect(texte, 'l’écran promet encore un SMS à chaque connexion')
      .not.toMatch(/SMS de vérification à chaque connexion/i);
  });

  test('⚠️ CONTRE-ÉPREUVE — le reste de l’écran de sécurité est intact', async ({ page }) => {
    // Une garde qui ne vérifie que des absences fait supprimer la section.
    await ouvrir(page);
    const texte = await ecran(page);
    expect(texte, 'la section Sécurité du compte a disparu').toMatch(/Sécurité du compte/i);
    expect(texte, 'le changement de mot de passe a disparu').toMatch(/Changer le mot de passe/i);
    expect(texte, 'le verrouillage automatique a disparu').toMatch(/Verrouillage automatique/i);
    expect(await page.locator('#twofa-toggle-btn').count(),
      'le levier a été supprimé au lieu d’être désactivé : la 2FA disparaît de la feuille de route')
      .toBe(1);
  });
});
