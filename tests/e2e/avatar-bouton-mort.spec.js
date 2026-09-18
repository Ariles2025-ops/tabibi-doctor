// =====================================================================
// « Changer la photo » ouvrait une boîte de dialogue de démonstration
// =====================================================================
// `patient-profile.html` posait un bouton appareil photo sur l'avatar. Il
// appelait ceci :
//
//     function changeAvatar(){ alert("Choisissez une image (à brancher avec un
//                                    input file dans la version production)"); }
//
// **Un bouton qui annonce une action et n'en fait aucune use la confiance aussi
// sûrement qu'un faux succès** — et celui-ci le disait à l'utilisateur en
// toutes lettres, dans une `alert()` qui parle de « version production ».
//
// ---------------------------------------------------------------------
// ⚠️ DÉSACTIVÉ, PAS SUPPRIMÉ — ET LA RAISON EST MESURÉE
// ---------------------------------------------------------------------
// Le composant d'upload **existe et est déjà chargé par cette page**
// (`js/tabibi-avatar.js`, l.6) : redimensionnement 400×400, centre-crop, envoi
// vers le bucket `avatars`, mise à jour de `users.photo_url`. Et le chemin
// serveur est complet — lu en base le 18/09 :
//
//     bucket `avatars`   public, 5 Mo, jpeg/png/webp
//     avatars_user_upload    INSERT  auth.uid() = storage.foldername(name)[1]
//     avatars_user_update    UPDATE  idem
//     avatars_user_delete    DELETE  idem
//     avatars_public_read    SELECT  bucket_id = 'avatars'
//
// et le composant écrit bien dans `<userId>/avatar-<ts>.jpg`.
//
// **Il ne manque que l'appel.** Supprimer le bouton effacerait la piste ; le
// laisser « actif » continuerait le mensonge. Il est donc désactivé, visible,
// et la garde interdit les deux dérives.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PATIENT = '00000000-0000-4000-8000-000000000001';

async function ouvrir(page) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((id) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'patient', name: 'Essai Patient' }));
      localStorage.setItem('tabibi_role', 'patient');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
    // ⚠️ `alert` BLOQUE un navigateur automatisé. On la capture : ce que
    // l'écran DIT est précisément ce qu'on mesure.
    window.__dits = [];
    window.alert = (m) => { window.__dits.push(String(m)); };
  }, PATIENT);

  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }) }));
  await page.route('**/rest/v1/users*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test', role: 'patient', status: 'active' }) }));

  await page.goto('/patient-profile.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');
  await expect(page.locator('#ava')).toBeAttached({ timeout: 10000 });
}

const bouton = (page) => page.locator('button[aria-label*="Changer la photo"]');

test.describe('le bouton « Changer la photo »', () => {

  test('il ne déclenche plus AUCUNE boîte de dialogue', async ({ page }) => {
    await ouvrir(page);
    const b = bouton(page);
    await expect(b).toBeAttached();
    // `click({force:true})` : un bouton désactivé n'accepte pas un clic normal,
    // et c'est déjà une preuve — mais on force, pour mesurer qu'AUCUN
    // gestionnaire ne reste accroché derrière.
    await b.click({ force: true }).catch(() => { /* désactivé : c'est le but */ });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__dits || []),
      'le bouton ouvre encore une alerte de démonstration').toEqual([]);
  });

  test('la fonction de démonstration n’existe plus', async ({ page }) => {
    // ⚠️ Elle était GLOBALE. Un bouton désactivé n'empêche pas un appel depuis
    // la console, ni un `onclick` recollé ailleurs par mégarde.
    await ouvrir(page);
    expect(await page.evaluate(() => typeof window.changeAvatar),
      '`changeAvatar` est de retour : une fonction morte finit rappelée').toBe('undefined');
  });

  test('il est DÉSACTIVÉ et le dit — pas juste inerte', async ({ page }) => {
    await ouvrir(page);
    const b = bouton(page);
    expect(await b.isDisabled(), 'le bouton est de nouveau cliquable').toBe(true);
    expect(await b.getAttribute('aria-disabled'),
      'rien n’annonce l’état au lecteur d’écran').toBe('true');
    expect(await b.getAttribute('aria-label'),
      'le lecteur d’écran n’apprend pas que la photo n’est pas modifiable').toMatch(/bientôt/i);
  });

  test('⚠️ CONTRE-ÉPREUVE — il n’a pas été SUPPRIMÉ', async ({ page }) => {
    // Le composant d'upload existe, le bucket et ses quatre policies aussi :
    // supprimer le bouton effacerait la piste. On garde donc le levier visible.
    await ouvrir(page);
    expect(await bouton(page).count(),
      'le bouton a disparu : la photo de profil sort de la feuille de route').toBe(1);
    await expect(bouton(page)).toBeVisible();
  });

  test('⚠️ CONTRE-ÉPREUVE — l’avatar affiche toujours quelque chose', async ({ page }) => {
    // Une garde qui ne vérifie que des absences fait supprimer le bloc entier.
    await ouvrir(page);
    const ava = page.locator('#ava');
    await expect(ava).toBeVisible();
    expect((await ava.innerText()).trim().length,
      'l’avatar est vide : plus d’initiales, plus de photo').toBeGreaterThan(0);
  });
});
