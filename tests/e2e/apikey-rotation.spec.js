// =====================================================================
// « Nouvelle clé : undefined » — et l'admin la transmet au partenaire
// =====================================================================
// `admin-api-keys.html` lisait `row.new_secret` **sans vérifier qu'une ligne
// existe**. Sur une réponse vide, `row` vaut `undefined` : l'accès lève, ou —
// pire — la boîte de dialogue affiche le mot « undefined », que l'admin copie
// et envoie au partenaire en croyant tenir une clé.
//
// ---------------------------------------------------------------------
// ⚠️ LU EN BASE LE 18/09 — LE DÉFAUT N'EST PAS CELUI QU'ON CROIT
// ---------------------------------------------------------------------
// `rotate_api_key` fait `RAISE EXCEPTION` quand la clé est introuvable (donc :
// `error`, déjà traité) et termine **toujours** par `RETURN NEXT`. Le cas
// « zéro ligne » **n'est pas atteignable aujourd'hui**.
//
// Ce qui l'est, dans le corps de la fonction :
//
//     SELECT * INTO v_pair FROM public.generate_api_key_pair(...);
//     new_secret := v_pair.key_id || ':' || v_pair.secret_plain;
//
// `SELECT INTO` **ne lève pas** quand rien ne vient : `v_pair` reste NULL et la
// concaténation rend **NULL**. La ligne existe, son secret est vide.
//
// Les deux cas sont gardés — celui qui peut arriver **et** celui qui ne peut
// pas encore. Un `RETURN QUERY` ajouté demain rendrait le second réel.
//
// ⚠️ PAS DE `data.error` : ce retour n'a **pas** d'enveloppe métier. On juge
// sur la présence de la ligne et du champ.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const ADMIN = '00000000-0000-4000-8000-00000000000a';

/**
 * Ouvre l'écran des clés et choisit ce que rend `rotate_api_key`.
 *
 * @param reponse  le corps JSON rendu par la RPC (tableau, objet, ou vide)
 */
async function ouvrir(page, reponse) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((id) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'admin', name: 'Admin Essai' }));
      localStorage.setItem('tabibi_role', 'admin');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id, email: 'a@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
    // ⚠️ `alert` et `confirm` bloquent un navigateur automatisé. On les capture :
    // ce que l'écran DIT est précisément ce qu'on mesure ici.
    window.__dits = [];
    window.alert = (m) => { window.__dits.push(String(m)); };
    window.confirm = () => true;
  }, ADMIN);

  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: ADMIN, email: 'a@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: ADMIN, email: 'a@example.test', role: 'admin',
                           status: 'active', is_super_admin: true }),
  }));
  await page.route('**/rest/v1/rpc/rotate_api_key', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(reponse),
  }));
  // Le reste de l'écran (liste des clés) n'est pas le sujet.
  await page.route('**/rest/v1/api_keys*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/admin-api-keys.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session admin n’a pas pris').not.toContain('login.html');
  await page.waitForFunction(() => typeof window.rotateKey === 'function', { timeout: 10000 });
}

const dits = (page) => page.evaluate(() => window.__dits || []);
const tourner = (page) => page.evaluate(() => window.rotateKey('tbk_live_001'));

test.describe('rotation d’une clé API — ce que l’écran annonce', () => {

  test('AUCUNE ligne : message clair, et jamais « undefined »', async ({ page }) => {
    await ouvrir(page, []);
    await tourner(page);

    await expect.poll(() => dits(page).then((d) => d.length), { timeout: 8000 }).toBeGreaterThan(0);
    const tout = (await dits(page)).join(' | ');
    expect(tout, 'l’écran affiche « undefined »').not.toMatch(/undefined/i);
    expect(tout, 'aucun message d’erreur : l’admin croit avoir une clé')
      .toMatch(/aucune clé/i);
  });

  test('ligne SANS secret (le cas réellement atteignable) : refusée aussi', async ({ page }) => {
    // ⚠️ C'est le chemin que le corps de la fonction rend possible :
    // `generate_api_key_pair` sans ligne → `new_secret` NULL.
    await ouvrir(page, [{ new_secret: null, expires_old_at: '2026-09-25T00:00:00Z' }]);
    await tourner(page);

    await expect.poll(() => dits(page).then((d) => d.length), { timeout: 8000 }).toBeGreaterThan(0);
    const tout = (await dits(page)).join(' | ');
    expect(tout, 'un secret NULL est présenté comme une clé').not.toMatch(/undefined|null/i);
    expect(tout).toMatch(/aucune clé/i);
  });

  test('secret VIDE ou fait d’espaces : refusé', async ({ page }) => {
    await ouvrir(page, [{ new_secret: '   ', expires_old_at: '2026-09-25T00:00:00Z' }]);
    await tourner(page);

    await expect.poll(() => dits(page).then((d) => d.length), { timeout: 8000 }).toBeGreaterThan(0);
    expect((await dits(page)).join(' | ')).toMatch(/aucune clé/i);
  });

  test('UNE VRAIE CLÉ s’affiche — on n’a pas cassé le cas qui marche', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DU GARDE. Une garde qui ne vérifie que le refus
    // finit par faire refuser tout le monde.
    await ouvrir(page, [{ new_secret: 'tbk_live_002:s3cr3t', expires_old_at: '2026-09-25T00:00:00Z' }]);
    await tourner(page);

    await expect.poll(() => dits(page).then((d) => d.join(' | ')), { timeout: 8000 })
      .toContain('tbk_live_002:s3cr3t');
    const tout = (await dits(page)).join(' | ');
    expect(tout, 'une vraie clé est refusée').not.toMatch(/aucune clé/i);
    expect(tout).not.toMatch(/undefined/i);
  });

  test('objet SEUL (non enveloppé dans un tableau) : accepté', async ({ page }) => {
    // PostgREST rend un tableau ; mais le code acceptait déjà l'objet nu. On
    // garde cette tolérance plutôt que de la retirer au passage.
    await ouvrir(page, { new_secret: 'tbk_live_003:abc', expires_old_at: null });
    await tourner(page);

    await expect.poll(() => dits(page).then((d) => d.join(' | ')), { timeout: 8000 })
      .toContain('tbk_live_003:abc');
    // ⚠️ Et une date manquante ne devient pas « undefined » non plus.
    expect((await dits(page)).join(' | ')).not.toMatch(/undefined/i);
  });

  // ⚠️ L'ESSAI DE SOURCE A DEMENAGE — voir `tests/apikey-rotation-source.test.mjs`.
  //
  // Il vivait ici et lisait le fichier SERVI. Sur `dist-web`, Vite minifie le
  // script en ligne : `if (!secret)` devient `if(!o)`, et l'essai sortait
  // ROUGE sur un code parfaitement correct — famille de P-29 (sources vertes,
  // build faux), dans l'autre sens.
  //
  // Une assertion sur la FORME du source appartient a un essai qui lit le
  // DEPOT, pas la sortie de build. Les essais de comportement ci-dessus, eux,
  // tournent bien sur les deux cibles.
});
