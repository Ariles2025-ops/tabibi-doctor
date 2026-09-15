// =====================================================================
// L'acceptation d'une invitation medecin — et ce qu'elle ne promet pas
// =====================================================================
// `invitation-medecin.html` est la porte d'entree du pilote : un medecin
// choisi recoit un lien, et ce lien rattache SON compte a SA fiche.
//
// Ce que ce fichier garde :
//
//   1. **aucun ecran de succes n'est atteignable sans un `ok` de la base.**
//      C'est la lecon du « e-mail envoye » de `forgot-password.html` et du
//      « 500+ » de la liste d'attente : un ecran ne presente jamais comme fait
//      ce qu'il n'a pas vu se faire ;
//   2. **chaque refus a une phrase en francais**, pas un code machine ;
//   3. **le jeton ne reste pas dans l'URL** apres usage — une capture d'ecran
//      ou un historique partage promenerait un identifiant au porteur ;
//   4. sans connexion, la page **le dit avant** de consommer quoi que ce soit.
//
// Aucun reseau reel : la RPC est bouchonnee par des routes.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const JETON = 'b'.repeat(64);
const LIEN = `/invitation-medecin.html?token=${JETON}`;

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

/** Simule une session Supabase valide cote navigateur. */
async function connecte(page) {
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'dr@example.test' }),
  }));
  await page.addInitScript(() => {
    // supabase-js lit sa session dans localStorage. Une session dont l'echeance
    // est loin devant evite un rafraichissement reseau pendant l'essai.
    const demain = Math.floor(Date.now() / 1000) + 3600;
    const cle = Object.keys(localStorage).find((k) => k.startsWith('sb-')) || 'sb-pudugodhiofqrctcdwfl-auth-token';
    localStorage.setItem(cle, JSON.stringify({
      access_token: 'jeton-de-test', token_type: 'bearer', expires_at: demain,
      refresh_token: 'r', user: { id: '00000000-0000-4000-8000-000000000001', email: 'dr@example.test' },
    }));
  });
}

async function poserRpc(page, corps, statut = 200) {
  await page.route('**/rest/v1/rpc/accepter_invitation_medecin', (route) => route.fulfill({
    status: statut, contentType: 'application/json', body: JSON.stringify(corps),
  }));
}

// ─────────────────────────────────────────────────────────────────────
test.describe("invitation medecin — l'ecran dit ce qui s'est passe", () => {

  test('SANS jeton : « Lien incomplet », et la base n est jamais interrogee', async ({ page }) => {
    let appels = 0;
    await page.route('**/rest/v1/rpc/accepter_invitation_medecin', (route) => {
      appels++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invitation-medecin.html', ATTENDRE);
    await page.waitForTimeout(600);

    await expect(page.locator('#inv-titre')).toContainText(/incomplet/i);
    expect(appels, 'la page a interroge la base sans jeton').toBe(0);
  });

  test('SANS connexion : on le dit AVANT de consommer l invitation', async ({ page }) => {
    let appels = 0;
    await page.route('**/rest/v1/rpc/accepter_invitation_medecin', (route) => {
      appels++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto(LIEN, ATTENDRE);
    await page.waitForTimeout(800);

    await expect(page.locator('#inv-titre')).toContainText(/[Cc]onnectez-vous/);
    // LE POINT : un jeton a usage unique ne doit pas etre brule par une visite
    // sans session. Il doit rester valable apres la connexion.
    expect(appels, "l'invitation a ete consommee sans session").toBe(0);
    // Et le lien de retour ramene ICI, avec le jeton.
    const href = await page.locator('a[href*="login.html"]').first().getAttribute('href');
    expect(decodeURIComponent(href || '')).toContain('invitation-medecin');
    expect(decodeURIComponent(href || '')).toContain(JETON);
  });

  test('SUCCES : la fiche est rattachee, et le jeton quitte l URL', async ({ page }) => {
    await connecte(page);
    await poserRpc(page, { ok: true, doctor_profile_id: '11111111-2222-3333-4444-555555555555' });
    await page.goto(LIEN, ATTENDRE);
    await page.waitForTimeout(1000);

    await expect(page.locator('#inv-titre')).toContainText(/rattach/i);
    await expect(page.locator('#inv-ico')).toHaveClass(/ok/);
    await expect(page.locator('a[href*="doctor-dashboard"]')).toBeVisible();

    // ⚠️ Le jeton est un identifiant au porteur : il ne reste pas dans la barre
    // d'adresse une fois consomme.
    expect(page.url(), "le jeton est reste dans l'URL").not.toContain(JETON);
  });

  test('SECOND CLIC : « deja rattachee », et surtout pas une erreur', async ({ page }) => {
    await connecte(page);
    await poserRpc(page, { ok: true, already_accepted: true, doctor_profile_id: '1111...' });
    await page.goto(LIEN, ATTENDRE);
    await page.waitForTimeout(1000);

    await expect(page.locator('#inv-ico')).toHaveClass(/ok/);
    await expect(page.locator('#inv-titre')).toContainText(/d[ée]j[àa]/i);
  });

  test('CHAQUE REFUS a une phrase en francais, jamais un code machine', async ({ page }) => {
    // Les codes viennent de `accepter_invitation_medecin` (migration
    // 20260915_invitations_medecin.sql). Si la liste s'allonge la-bas sans
    // s'allonger dans la page, ce test le dit.
    const attendus = {
      invalid_token: /pas valide/i,
      expired: /expir/i,
      revoked: /annul/i,
      already_accepted: /d[ée]j[àa] [ée]t[ée] utilis/i,
      already_claimed: /d[ée]j[àa] rattach/i,
      email_mismatch: /autre adresse/i,
      not_authenticated: /session a expir/i,
    };

    for (const [code, motif] of Object.entries(attendus)) {
      await connecte(page);
      await poserRpc(page, { error: code });
      await page.goto(LIEN, ATTENDRE);
      await page.waitForTimeout(900);

      const titre = await page.locator('#inv-titre').innerText();
      const texte = await page.locator('#inv-texte').innerText();
      expect(texte, `le refus « ${code} » n'a pas de phrase`).toMatch(motif);
      // Et le code brut ne s'affiche jamais.
      expect(titre + texte, `le code « ${code} » est affiche tel quel`).not.toContain(code);
    }
  });

  test("AUCUN ecran de succes n est atteignable sans un ok de la base", async ({ page }) => {
    // On sert une reponse qui n'est NI un ok NI une erreur connue. La page doit
    // rester du cote du refus — jamais annoncer un rattachement qu'elle n'a pas
    // vu se faire.
    await connecte(page);
    await poserRpc(page, { quelque_chose: 'inattendu' });
    await page.goto(LIEN, ATTENDRE);
    await page.waitForTimeout(900);

    await expect(page.locator('#inv-ico')).not.toHaveClass(/ok/);
    await expect(page.locator('a[href*="doctor-dashboard"]')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('invitation medecin — la source', () => {

  test('le jeton ne part ni dans un journal ni vers un tiers', async ({ page }) => {
    const src = await page.request.get('/invitation-medecin.html').then((r) => r.text());
    const sansCommentaires = src
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // Le jeton n'est jamais journalise ni envoye a Sentry.
    expect(sansCommentaires).not.toMatch(/console\.(log|info|warn|error)\([^)]*jeton/);
    expect(sansCommentaires).not.toMatch(/captureE\w*\([^)]*jeton/);
    // Et il est retire de l'URL apres usage.
    expect(sansCommentaires).toContain('history.replaceState');
  });

  test('la page passe par la passerelle RPC, pas par un appel direct', async ({ page }) => {
    const src = await page.request.get('/invitation-medecin.html').then((r) => r.text());
    expect(src).toContain("window.tabibiRpc('accepter_invitation_medecin'");
    expect(src).toContain('js/tabibi-rpc.js');
  });
});
