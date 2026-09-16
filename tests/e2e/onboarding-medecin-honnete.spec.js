// =====================================================================
// « Demande envoyée ! » — d'abord un mensonge, puis un envoi
// =====================================================================
// ⚠️ DEUX LOTS, DEUX MOITIÉS DU MÊME DÉFAUT.
//
// **Hier (P-67).** `onboarding-medecin.html` faisait remplir CINQ écrans à un
// médecin, puis affichait « Demande envoyée ! … vous contactera SOUS 48 HEURES
// OUVRÉES ». Rien ne partait : `submitAll()` poussait le dossier dans
// `localStorage.tabibi_doctor_applications` sous un « TODO : envoyer à
// Supabase », et **aucun code du dépôt ne lisait cette clé** — mesuré. Le
// dossier contenait `password`, en clair. L'écran de succès a été supprimé.
//
// **Aujourd'hui (P-68).** La destination existe :
// `public.soumettre_candidature_medecin(p jsonb) returns uuid` — SECURITY
// DEFINER, exécutable par `anon`, 3 dépôts/heure par empreinte d'IP, table en
// RLS lecture admin seule. L'écran de succès revient **avec** elle.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// 1. L'envoi passe par la PASSERELLE (`tabibiRpc`), pas par `supabase.rpc` —
//    une réponse PostgREST a deux moitiés, et la passerelle lit les deux.
// 2. Le succès ne s'affiche que sur un **identifiant** rendu par la base. Pas
//    « ça n'a pas levé » : un uuid. C'est la seule preuve qu'une ligne existe.
// 3. Le mot de passe saisi ne part pas et n'est stocké nulle part.
// 4. Un échec reste un échec, et laisse un chemin qui, lui, enregistre.
//
// **Ce qu'ils ne prouvent pas :** que la base accepte. La RPC est bouchonnée.
// Ce qui se passe côté serveur se lit en base, pas ici.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/onboarding-medecin.html';
const MOT_DE_PASSE = 'MotDePasseDEssai2026!';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * Remplace la passerelle par un bouchon qui NOTE ce qu'on lui demande.
 * @param {object} reponse  ce que `tabibiRpc` doit rendre ({ok, data, erreur})
 */
async function bouchonnerPasserelle(page, reponse) {
  await page.evaluate((rep) => {
    window.__rpc = [];
    window.tabibiRpc = async (nom, args) => {
      window.__rpc.push({ nom, args });
      return rep;
    };
  }, reponse);
}

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
    mettre('f-wilaya', 'Alger');
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

// ─────────────────────────────────────────────────────────────────────
test.describe('onboarding médecin — l’envoi', () => {

  test('le dossier part par la PASSERELLE, vers la bonne fonction', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: true, data: UUID, erreur: null });
    await envoyer(page);

    const appels = await page.evaluate(() => window.__rpc);
    expect(appels, 'aucun appel : rien ne part encore').toHaveLength(1);
    expect(appels[0].nom).toBe('soumettre_candidature_medecin');

    // La fonction attend UN paramètre nommé `p`, de type jsonb.
    const p = appels[0].args.p;
    expect(p, 'le payload n est pas passé sous `p`').toBeTruthy();
    expect(p.firstname).toBe('Amina');
    expect(p.lastname).toBe('Cherif');
    expect(p.email).toBe('amina.cherif@example.test');
    expect(p.ordre_num).toBe('ORD-12345');
    expect(p.consents).toBeTruthy();
    expect(p.consents.cgu_at).toBeTruthy();
    expect(p.consents.privacy_at).toBeTruthy();
    expect(p.consents.ethics_at).toBeTruthy();
  });

  test('le mot de passe ne part PAS, et n’est stocké nulle part', async ({ page }) => {
    // ⚠️ La table n'a pas de colonne pour lui et la RPC pas de champ : le
    // compte se créera après vérification. Un mot de passe transporté « pour
    // plus tard » est un mot de passe stocké quelque part.
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: true, data: UUID, erreur: null });
    await envoyer(page);

    const envoye = JSON.stringify(await page.evaluate(() => window.__rpc));
    expect(envoye, 'le mot de passe part vers le serveur').not.toContain(MOT_DE_PASSE);

    const tout = await stockage(page);
    expect(tout, 'le mot de passe est conservé sur la machine').not.toContain(MOT_DE_PASSE);
    expect(tout).not.toContain('tabibi_doctor_applications');
  });

  test('succès affiché UNIQUEMENT sur un identifiant, et il est montré', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: true, data: UUID, erreur: null });
    await envoyer(page);

    await expect(page.locator('#step-done')).toBeVisible();
    await expect(page.locator('#sent-ref')).toHaveText(UUID);
    await expect(page.locator('#sent-email')).toHaveText('amina.cherif@example.test');
    await expect(page.locator('#step-nonenvoye')).toBeHidden();
    // ⚠️ L'ancien écran promettait un rappel « sous 48 heures ouvrées ». Tenir
    // ce délai suppose que quelqu'un relise les dossiers — rien ne le garantit
    // encore (P-68 b2). On n'annonce donc aucun délai.
    const visible = (await page.locator('#step-done').innerText()).replace(/\s+/g, ' ');
    expect(visible, 'la page promet de nouveau un délai').not.toMatch(/48\s*heures/i);
  });

  // ⚠️ LES QUATRE FAÇONS DE NE PAS AVOIR D'IDENTIFIANT. Chacune a déjà été,
  // quelque part dans ce dépôt, prise pour un succès.
  for (const [nom, reponse] of [
    ['la passerelle refuse', { ok: false, data: null, erreur: 'rls_denied' }],
    ['elle dit oui sans rien rendre', { ok: true, data: null, erreur: null }],
    ['elle rend une chaîne vide', { ok: true, data: '', erreur: null }],
    ['elle rend autre chose qu un uuid', { ok: true, data: 'ok', erreur: null }],
  ]) {
    test(`pas d identifiant (${nom}) : AUCUN succès affiché`, async ({ page }) => {
      await page.goto(PAGE, ATTENDRE);
      await bouchonnerPasserelle(page, reponse);
      await envoyer(page);

      await expect(page.locator('#step-done')).toBeHidden();
      await expect(page.locator('#step-nonenvoye')).toBeVisible();
      // Et le repli reste : on ne perd pas le contact d'un médecin sur un échec.
      await expect(page.locator('#step-nonenvoye a[href="medecin-waitinglist.html"]')).toBeVisible();
    });
  }

  test('la passerelle absente est un échec, pas un succès silencieux', async ({ page }) => {
    // Le défaut de P-65, dans l'autre sens : si `tabibiRpc` n'est pas chargée,
    // appeler `window.tabibiRpc(...)` lèverait. On veut un échec AFFICHÉ.
    await page.goto(PAGE, ATTENDRE);
    await page.evaluate(() => { delete window.tabibiRpc; });
    await envoyer(page);

    await expect(page.locator('#step-done')).toBeHidden();
    await expect(page.locator('#step-nonenvoye')).toBeVisible();
    await expect(page.locator('#notsent-code')).toHaveText(/passerelle_absente/);
  });

  test('un refus de débit le DIT, au lieu d’inviter à recommencer', async ({ page }) => {
    // « Réessayez » n'est vrai qu'au bout d'une heure. Le dire évite qu'on
    // recommence les cinq écrans pour rien — c'est la leçon de P-65.
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: false, data: null, erreur: 'rate_limited' });
    await envoyer(page);

    await expect(page.locator('#notsent-body')).toContainText(/une heure/i);
  });

  test('deux clics ne font pas deux candidatures', async ({ page }) => {
    // ⚠️ Tant que `submitAll()` n'écrivait que dans `localStorage`, un
    // double-clic était sans conséquence. Maintenant il déposerait DEUX lignes
    // — et l'index unique sur le n° d'ordre ferait échouer la seconde, donc
    // afficher un échec après un succès.
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: true, data: UUID, erreur: null });
    await page.evaluate(() => {
      const lent = window.tabibiRpc;
      window.tabibiRpc = async (n, a) => { await new Promise((r) => setTimeout(r, 300)); return lent(n, a); };
    });

    await page.evaluate((pw) => {
      const mettre = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      mettre('f-firstname', 'Amina'); mettre('f-lastname', 'Cherif');
      mettre('f-email', 'amina.cherif@example.test'); mettre('f-phone', '+213700000000');
      mettre('f-ordre-num', 'ORD-12345'); mettre('f-wilaya', 'Alger'); mettre('f-pw', pw);
      for (const id of ['c-cgu', 'c-privacy', 'c-ethics']) document.getElementById(id).checked = true;
    }, MOT_DE_PASSE);

    // ⚠️ On n'utilise pas `click()` : le bouton vit sur le 5e ecran, masque
    // tant qu'on n'y est pas, et Playwright attendrait sa visibilite. Deux
    // appels lances SANS attendre le premier reproduisent exactement le
    // double-clic — c'est la concurrence qu'on garde, pas le geste.
    await page.evaluate(() => { window.submitAll(); window.submitAll(); });
    await page.waitForTimeout(900);

    expect(await page.evaluate(() => window.__rpc.length)).toBe(1);
  });

  test('sans les trois consentements, rien ne part et rien ne s’affiche', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    await bouchonnerPasserelle(page, { ok: true, data: UUID, erreur: null });
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => window.submitAll());

    expect(await page.evaluate(() => window.__rpc.length)).toBe(0);
    await expect(page.locator('#step-done')).toBeHidden();
    await expect(page.locator('#step-nonenvoye')).toBeHidden();
  });

  test('la page charge vraiment la passerelle et le client', async ({ page }) => {
    // ⚠️ La contre-épreuve des bouchons : tous les essais ci-dessus remplacent
    // `tabibiRpc`. Si la page ne la chargeait pas, ils resteraient verts et
    // la vraie page n'enverrait rien — c'est exactement ce qui est arrivé au
    // sélecteur de langue (P-29), vert sur les sources, absent du build.
    await page.goto(PAGE, ATTENDRE);
    const charge = await page.evaluate(() => ({
      rpc: typeof window.tabibiRpc,
      client: !!(window.tabibi && window.tabibi.supabase),
    }));
    expect(charge.rpc, 'js/tabibi-rpc.js n est pas chargé par la page').toBe('function');
    expect(charge.client, 'aucun client Supabase sur la page').toBe(true);
  });
});
