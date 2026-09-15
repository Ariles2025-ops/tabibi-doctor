// =====================================================================
// Le drapeau `prescriptions` est OUVERT — et ce qui doit rester vrai
// =====================================================================
// [14/09/2026, au soir] Ouvert apres un essai de bout en bout en production :
// medecin de test -> generation -> `signed` -> verification publique « valid ».
//
// Ce fichier ne celebre pas l'ouverture, il en garde les CONSEQUENCES. Ouvrir
// un drapeau, c'est rendre atteignable du code que personne n'exercait : trois
// choses qui n'avaient aucune importance tant qu'il etait ferme en ont une
// maintenant.
//
//   1. les boutons « Enregistrer » et « Signer » s'affichent vraiment ;
//   2. la garde dure du front reste EN PLACE, pour que refermer le drapeau
//      refonctionne — un drapeau qui ne sait plus se refermer n'est pas un
//      drapeau ;
//   3. le tracage de delivrance ne se perd plus en silence (il le faisait par
//      construction : `supa.rpc()` ne rejette jamais, donc son `catch` etait
//      mort et l'erreur n'etait lue nulle part).
//
// Ce que ce fichier NE remplace PAS : `ordonnance-verification.spec.js`, qui
// garde la seule propriete vraiment dangereuse — **la page publique n'expose
// jamais les medicaments**. Elle compte davantage depuis l'ouverture, pas moins.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
  // La page redirige vers login.html faute de session. La mesure se fait avant
  // (le minuteur est a 1200 ms), mais on neutralise la cible pour qu'un runner
  // lent ne transforme pas un test de visibilite en test de navigation.
  await page.route('**/login.html*', (route) => route.fulfill({
    status: 200, contentType: 'text/html', body: '<html><body>login</body></html>',
  }));
});

test('le drapeau prescriptions est OUVERT', async ({ page }) => {
  await page.goto('/medecin-ordonnance.html', ATTENDRE);
  const drapeaux = await page.evaluate(() => window.TABIBI_FEATURES);
  expect(drapeaux.prescriptions, 'le drapeau ordonnances devrait etre ouvert').toBe(true);

  // Ce qui n'ouvre PAS au passage. Ouvrir un drapeau ne doit jamais en ouvrir
  // un autre par inadvertance.
  //
  // [14/09, nuit] `video` ET `reviews` SORTENT de cette liste — union des deux
  // retraits, faits separement par leurs lots respectifs :
  //
  //   `video`   ouvert par sa propre PR (#123) : salle Daily reelle, edge
  //             function deployee, CSP qui delegue la camera. Garde par
  //             `teleconsultation-salle.spec.js`.
  //   `reviews` ouvert par son propre lot : court-circuit retire, drapeau enfin
  //             lu par le module, 12 cas e2e. Garde par `avis-patients.spec.js`.
  //
  // Les laisser ici ferait echouer le lot ORDONNANCES pour une raison qui n'a
  // rien a voir avec les ordonnances. Chaque drapeau est garde par le fichier
  // qui sait POURQUOI il est ouvert ; ici on ne garde que ce que CE lot ne doit
  // pas toucher.
  expect(drapeaux.payments, 'payments ne doit pas s ouvrir avec les ordonnances').toBe(false);
  expect(drapeaux.messaging, 'messaging ne doit pas s ouvrir avec les ordonnances').toBe(false);
});

test('les boutons Enregistrer et Signer sont VISIBLES', async ({ page }) => {
  await page.goto('/medecin-ordonnance.html', ATTENDRE);
  // `data-feature="prescriptions"` les masquait (`hidden` + aria-hidden) tant
  // que le drapeau etait ferme. C'est la seule difference observable a l'ecran.
  for (const id of ['#btn-save-draft', '#btn-sign']) {
    await expect(page.locator(id)).not.toHaveAttribute('hidden', /.*/);
    await expect(page.locator(id)).not.toHaveAttribute('aria-hidden', 'true');
  }
});

test('LA GARDE DURE RESTE EN PLACE — le drapeau doit savoir se refermer', async ({ page }) => {
  // Le masquage des boutons ne protege pas d'un appel programmatique : les deux
  // fonctions verifient le drapeau AVANT tout appel. Si quelqu'un retirait ces
  // gardes en se disant « le drapeau est ouvert de toute facon », le refermer
  // ne refermerait plus rien.
  const src = await page.request.get('/medecin-ordonnance.html').then((r) => r.text());
  const gardes = src.match(/!window\.TABIBI_FEATURES\.prescriptions/g) || [];
  expect(gardes.length, 'saveDraft et signPrescription doivent garder le drapeau').toBeGreaterThanOrEqual(2);
});

test('le tracage de delivrance ne se perd plus en silence', async ({ page }) => {
  const src = await page.request.get('/patient-ordonnances.html').then((r) => r.text());
  const sansCommentaires = src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  // Avant : `await supa.rpc(...)` dans un try dont le catch etait mort.
  expect(sansCommentaires, 'l appel passe par la passerelle, pas par .rpc() direct')
    .not.toContain("supabase.rpc('mark_prescription_delivered'");
  expect(sansCommentaires).toContain("window.tabibiRpc('mark_prescription_delivered'");
  // Et son echec est LU. C'est tout ce qu'on demande a un best-effort.
  expect(sansCommentaires, "l echec de tracage doit etre signale").toContain('if (!r.ok)');

  // La passerelle doit etre chargee, sinon l'appel ci-dessus n'existe pas.
  expect(src).toContain('js/tabibi-rpc.js');
});
