// =====================================================================
// « Sauvegarde échouée » puis, une ligne plus bas, « Profil sauvegardé ! »
// =====================================================================
// ⚠️ SIGNALÉ PAR LE STRATÈGE. Dans `saveAll()` de `medecin-profile.html`, les
// branches d'erreur **métier** font `return` — bio trop longue, tarif invalide,
// session expirée. Mais la branche « réseau / inconnue » et le `catch`
// tombaient dans la suite du code, qui affiche le toast **VERT**.
//
// L'écran disait donc les deux choses en même temps. **Le médecin retient le
// vert**, ferme la page, et croit que ses horaires sont enregistrés.
//
// ---------------------------------------------------------------------
// TROIS ÉTATS, PAS DEUX — et c'est ce qui rend le correctif non trivial
// ---------------------------------------------------------------------
//   sauvegarde distante réussie ....... vert « (Tabibi DB) »
//   sauvegarde distante ÉCHOUÉE ....... rouge seul, la copie locale est gardée
//   aucune sauvegarde TENTÉE .......... vert : sans session, le mode local
//                                       EST le comportement attendu
//
// ⚠️ Un `if (!didDbSave) → erreur` aurait transformé le troisième cas en faux
// échec. Et un `return` sec aurait sauté l'écriture `localStorage` : on aurait
// remplacé un mensonge par une **perte de saisie**. C'est le toast vert qu'il
// faut retirer, pas la sauvegarde.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '00000000-0000-4000-8000-00000000000d';

/**
 * Pose une session de médecin ET le verdict de `updateMyProfile`.
 *
 * ⚠️ On bouchonne `window.tabibiDoctor`, la couche que la page appelle, et pas
 * le réseau : `hermetiser` rendrait `[]`, ce qui ne dit pas si la page a vu un
 * succès ou un échec. Ici on choisit la réponse, et on mesure ce que l'écran
 * en fait — c'est tout le sujet.
 *
 * @param verdict  'ok' | 'echec-reseau' | 'exception' | 'pas-de-session'
 */
async function poser(page, verdict) {
  await page.addInitScript((v) => {
    const vrai = { hasSession: async () => v !== 'pas-de-session' };
    window.tabibiDoctor = {
      hasSession: vrai.hasSession,
      serializeSchedule: () => ({}),
      async loadMyProfile() { return { ok: false, error: 'profile_not_found_or_not_claimed' }; },
      async updateMyProfile() {
        if (v === 'exception') throw new Error('réseau coupé');
        if (v === 'ok') return { ok: true, data: {} };
        return { ok: false, error: 'network_error' };
      },
    };
    try {
      localStorage.setItem('tabibi_user', JSON.stringify({
        id: '00000000-0000-4000-8000-00000000000d', role: 'medecin',
        name: 'Dr Essai', firstName: 'Essai', lastName: 'Docteur',
      }));
      localStorage.setItem('tabibi_role', 'medecin');
      localStorage.setItem('tabibi_lang', 'fr');
      // ⚠️ SANS CE JETON, `requireAuth('medecin')` PURGE ET REDIRIGE. La page
      // se chargeait, `#f_bio` n'existait jamais, et les cinq essais sortaient
      // rouges pour une raison etrangere a ce qu'ils mesurent. Meme recette que
      // `accessibilite.spec.js`, qui auditait sinon un ecran de connexion en
      // croyant auditer un tableau de bord.
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: '00000000-0000-4000-8000-00000000000d', email: 'd@example.test' },
      }));
    } catch (e) { /* stockage bloqué : la page le dira */ }
  }, verdict);
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test' }),
  }));
  // `getUser()` relit `public.users` : sans role, la garde renvoie ailleurs.
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test', role: 'medecin',
                           first_name: 'Essai', last_name: 'Docteur' }),
  }));
}

async function ouvrir(page, verdict) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await poser(page, verdict);
  await page.goto('/medecin-profile.html', ATTENDRE);
  expect(page.url(), 'redirigé vers la connexion : la session n’a pas pris')
    .not.toContain('login.html');
  await expect(page.locator('#f_bio')).toBeAttached({ timeout: 10000 });
}

/** Le texte de TOUS les toasts affichés, normalisé. */
const toasts = (page) => page.locator('#toast-container').innerText()
  .then((t) => t.normalize('NFC').replace(/\s+/g, ' ').trim());

/**
 * Le geste réel : on clique le bouton « Sauvegarder », pas la fonction.
 * Un essai qui appelle `saveAll()` directement resterait vert le jour où le
 * bouton cesse de l'appeler.
 */
const enregistrer = (page) =>
  page.locator('button[onclick="saveAll()"]').first().click();

test.describe('sauvegarde du profil médecin — ce que l’écran annonce', () => {

  test('ÉCHEC RÉSEAU : le vert « sauvegardé » n’apparaît PAS', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE.
    await ouvrir(page, 'echec-reseau');
    await enregistrer(page);

    await expect.poll(() => toasts(page), { timeout: 8000 }).toMatch(/échouée|echouee/i);
    const vus = await toasts(page);
    expect(vus, 'on annonce une sauvegarde qui a échoué').not.toMatch(/Profil sauvegard/i);
  });

  test('EXCEPTION : la coupure ne passe plus en silence', async ({ page }) => {
    // ⚠️ Ce `catch` ne faisait qu'un `console.warn`. Personne n'ouvre la
    // console : l'écran affichait le vert et rien d'autre.
    await ouvrir(page, 'exception');
    await enregistrer(page);

    await expect.poll(() => toasts(page), { timeout: 8000 }).toMatch(/échouée|echouee/i);
    expect(await toasts(page), 'on annonce une sauvegarde qui a levé')
      .not.toMatch(/Profil sauvegard/i);
  });

  test('SUCCÈS : le vert est bien là — on n’a pas éteint le bon cas', async ({ page }) => {
    // Une garde qui ne vérifie que l'absence finit par faire supprimer le
    // message utile. On exige donc aussi la confirmation quand elle est vraie.
    await ouvrir(page, 'ok');
    await enregistrer(page);

    await expect.poll(() => toasts(page), { timeout: 8000 }).toMatch(/Profil sauvegard/i);
    expect(await toasts(page)).toMatch(/Tabibi DB/i);
    expect(await toasts(page), 'une erreur s’affiche alors que tout a marché')
      .not.toMatch(/échouée|echouee/i);
  });

  test('SANS SESSION : le mode local reste un succès', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DU CORRECTIF. Un `if (!didDbSave) → erreur` aurait
    // transformé ce cas — parfaitement normal — en faux échec. Aucune
    // sauvegarde distante n'est TENTÉE : il n'y a rien qui ait échoué.
    await ouvrir(page, 'pas-de-session');
    await enregistrer(page);

    await expect.poll(() => toasts(page), { timeout: 8000 }).toMatch(/Profil sauvegard/i);
    expect(await toasts(page), 'le mode local est présenté comme une panne')
      .not.toMatch(/échouée|echouee/i);
  });

  test('ÉCHEC : la saisie locale est CONSERVÉE — pas de perte de données', async ({ page }) => {
    // ⚠️ L'autre moitié, et la raison pour laquelle le correctif n'est pas un
    // `return`. Le message d'erreur promet « copie locale gardée » : on vérifie
    // que c'est vrai, sinon on aurait remplacé un mensonge par un autre.
    await ouvrir(page, 'echec-reseau');
    await page.fill('#f_bio', 'Cardiologue depuis 1998, Alger-Centre.');
    await enregistrer(page);

    await expect.poll(() => toasts(page), { timeout: 8000 }).toMatch(/échouée|echouee/i);
    const garde = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('tabibi_user') || '{}'); } catch (e) { return {}; }
    });
    expect(garde.bio, 'la saisie est perdue alors qu’on promet de la garder')
      .toContain('Cardiologue depuis 1998');
  });
});
