// =====================================================================
// « Demande envoyée ! » — elle ne l'était pas
// =====================================================================
// ⚠️ `onboarding-medecin.html` faisait remplir CINQ écrans à un médecin —
// identité, n° au Conseil de l'Ordre, spécialité, cabinet, tarifs, consentements
// — puis affichait :
//
//     « Demande envoyée ! Notre équipe vérifie vos justificatifs et vous
//       contactera SOUS 48 HEURES OUVRÉES par email à … »
//
// **Rien n'était envoyé à personne.** `submitAll()` poussait le dossier dans
// `localStorage.tabibi_doctor_applications`, sous un commentaire
// « TODO : envoyer à Supabase », et affichait le succès. La page ne charge
// aucun client Supabase, et **aucun code du dépôt ne lit cette clé** — mesuré.
//
// Et le dossier contenait `password`, **en clair**, gardé sur la machine sans
// limite de durée, alors qu'aucun compte n'était créé.
//
// Même famille que « 500+ inscrits » (P-01) et « e-mail envoyé » (P-28) : un
// écran de succès sur une opération qui n'a pas eu lieu. Celui-ci est pire —
// il fait **attendre** quelqu'un.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// 1. Le mot de passe saisi ne se retrouve NULLE PART dans le stockage local.
// 2. Aucun écran n'annonce un envoi tant que rien n'est parti.
// 3. La page dit quand même quelque chose d'utile — sinon on aurait remplacé
//    un mensonge par un cul-de-sac.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/onboarding-medecin.html';
const MOT_DE_PASSE = 'MotDePasseDEssai2026!';

/** Remplit le formulaire et déclenche l'envoi, sans passer par les 5 écrans. */
async function envoyer(page) {
  await page.evaluate((pw) => {
    const mettre = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    mettre('f-firstname', 'Amina');
    mettre('f-lastname', 'Cherif');
    mettre('f-email', 'amina.cherif@example.test');
    mettre('f-phone', '+213700000000');
    mettre('f-bd', '1985-04-12');
    mettre('f-pw', pw);
    mettre('f-ordre-num', 'ORD-12345');
    for (const id of ['c-cgu', 'c-privacy', 'c-ethics']) {
      const el = document.getElementById(id); if (el) el.checked = true;
    }
  }, MOT_DE_PASSE);
  await page.evaluate(() => window.submitAll());
}

/** Tout le stockage local de la page, aplati en une seule chaîne. */
async function stockage(page) {
  return page.evaluate(() => {
    let out = '';
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out += k + '=' + (localStorage.getItem(k) || '') + '\n';
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('onboarding médecin — ce qu’on dit et ce qu’on garde', () => {

  test('le mot de passe saisi n’est écrit NULLE PART dans le stockage local', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    await envoyer(page);

    const tout = await stockage(page);
    expect(tout, 'le mot de passe est conservé en clair sur la machine').not.toContain(MOT_DE_PASSE);
    // Et la clé qui le portait n'existe plus du tout : elle n'avait aucun
    // lecteur, donc aucune raison de garder le reste du dossier non plus.
    expect(tout).not.toContain('tabibi_doctor_applications');
  });

  test('aucun écran n’annonce un envoi qui n’a pas eu lieu', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    await envoyer(page);

    const visible = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    // ⚠️ Les trois promesses de l'ancien écran, mot pour mot.
    expect(visible, 'la page annonce encore un envoi').not.toMatch(/demande envoy[ée]e/i);
    expect(visible, 'la page promet encore un rappel').not.toMatch(/48\s*heures/i);
    expect(visible).not.toMatch(/v[ée]rifie vos justificatifs/i);
  });

  test('elle dit ce qui s’est passé, et donne un chemin qui ENREGISTRE vraiment', async ({ page }) => {
    // ⚠️ LA MOITIE QU'ON OUBLIE. Retirer le faux succès sans rien mettre à la
    // place laisserait le médecin devant un écran muet après cinq formulaires.
    // `medecin-waitinglist.html` insère pour de vrai dans `waiting_list` — c'est
    // le seul chemin médecin du produit qui persiste aujourd'hui.
    await page.goto(PAGE, ATTENDRE);
    await envoyer(page);

    const bloc = page.locator('#step-nonenvoye');
    await expect(bloc).toBeVisible();
    await expect(bloc).toContainText(/n['’]a pas été envoyé/i);
    await expect(bloc.locator('a[href="medecin-waitinglist.html"]')).toBeVisible();
    await expect(bloc.locator('a[href^="mailto:"]')).toBeVisible();
  });

  test('sans les trois consentements, rien ne part et rien ne s’affiche', async ({ page }) => {
    // La contre-épreuve : si `submitAll` affichait l'écran quoi qu'il arrive,
    // cet essai le dirait.
    await page.goto(PAGE, ATTENDRE);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => window.submitAll());

    await expect(page.locator('#step-nonenvoye')).toBeHidden();
  });

  test('l’ancien écran de succès n’existe plus dans la page', async ({ page }) => {
    // Un bloc de succès qui dort dans le DOM est une invitation à le rebrancher
    // sans sa persistance. Il reviendra AVEC elle.
    await page.goto(PAGE, ATTENDRE);
    expect(await page.locator('#step-done').count()).toBe(0);
  });
});
