// =====================================================================
// « Validation... » qui tourne pour toujours
// =====================================================================
// ⚠️ SIGNALÉ PAR LE STRATÈGE. `doValidate()` et `doReject()` désactivaient le
// bouton et posaient le tourniquet **avant** de vérifier que le client base
// existe. Quand il manque, le `return` partait sans rien remettre :
//
//     b.disabled = true; b.innerHTML = '… Validation...';
//     const sb = window.tabibi && window.tabibi.supabase;
//     if (!sb) { toastM('Supabase indisponible','error'); return; }   ← figé
//
// L'admin reste devant un bouton mort qui tourne, dans une modale qu'il faut
// fermer à la main. Le toast rouge passe en trois secondes ; **le bouton figé
// reste**, et c'est lui qu'on regarde.
//
// ---------------------------------------------------------------------
// LE POINT INTÉRESSANT : LES `catch` LE FAISAIENT DÉJÀ
// ---------------------------------------------------------------------
// La remise en état existait, écrite à la main dans chaque `catch`. Le défaut
// n'est pas qu'on ne savait pas le faire — c'est qu'**une sortie anticipée
// l'oubliait**. Le geste est donc sorti dans `_rendreLeBouton()`, et les quatre
// chemins de sortie passent par elle. Le prochain `return` ajouté la trouvera.
//
// ---------------------------------------------------------------------
// CE QUE CET ESSAI NE PROUVE PAS
// ---------------------------------------------------------------------
// Que la validation marche. Elle passe par `admin_validate_doctor` et exige un
// admin réel ; ici on garde **l'état de l'interface quand le client manque**,
// ce qui est précisément le cas que personne ne teste à la main.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const ADMIN = '00000000-0000-4000-8000-00000000000a';

/**
 * Ouvre la page admin avec une session, et SANS client base.
 *
 * ⚠️ `window.tabibi.supabase` est retiré **après** le chargement des scripts :
 * la page a besoin du client pour se dessiner, c'est au moment du clic qu'il
 * doit manquer. C'est exactement la situation réelle — un client qui n'a pas
 * survécu (SDK non chargé, config absente), pas une page morte-née.
 */
async function ouvrir(page) {
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
  }, ADMIN);
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: ADMIN, email: 'a@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    // ⚠️ `status` ET `is_super_admin` : la garde de la page lit
    // `meta.status!=='active'` et redirige sinon. Sans eux, l'essai mesurait un
    // ecran de connexion en croyant mesurer la page admin.
    body: JSON.stringify({ id: ADMIN, email: 'a@example.test', role: 'admin',
                           status: 'active', is_super_admin: false }),
  }));
  await page.goto('/admin-doctor-validation.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session admin n’a pas pris').not.toContain('login.html');
  await expect(page.locator('#btn-val')).toBeAttached({ timeout: 10000 });
}

/** Retire le client base, comme s'il n'avait pas survécu au chargement. */
const sansClientBase = (page) => page.evaluate(() => {
  if (window.tabibi) window.tabibi.supabase = null;
});

/** L'état visible du bouton : figé ou rendu ? */
const etatBouton = (page, sel) => page.evaluate((s) => {
  const b = document.querySelector(s);
  if (!b) return null;
  return { desactive: b.disabled, texte: (b.textContent || '').trim(),
           tourniquet: !!b.querySelector('.fa-spinner') };
}, sel);

/**
 * Ouvre la modale de validation **par le chemin réel** et coche les trois cases.
 *
 * ⚠️ MA PREMIERE VERSION POSAIT `window._act` A LA MAIN. Elle ne mesurait RIEN :
 * `_act` est declare `let` (ligne 174), donc invisible depuis `window`.
 * `doValidate()` sortait a `if(!_act) return;` sans toucher au bouton, et
 * l'essai lisait un bouton desactive **par l'ouverture de la modale** — pas par
 * le defaut. Il aurait donc ete rouge avec le correctif, et rouge sans.
 * On passe par `openVal()`, comme un admin qui clique.
 */
async function prepararValidation(page) {
  await page.evaluate(() => {
    window.openVal('00000000-0000-4000-8000-000000000001', 'Dr Essai', 'd@example.test');
    ['chk1', 'chk2', 'chk3'].forEach((c) => {
      const el = document.getElementById(c);
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  // Le bouton doit etre ACTIF avant qu'on le clique — sinon l'essai ne mesure
  // pas ce qu'il croit.
  await expect(page.locator('#btn-val')).toBeEnabled({ timeout: 5000 });
}

async function preparerRejet(page) {
  await page.evaluate(() => {
    window.openRej('00000000-0000-4000-8000-000000000001', 'Dr Essai', 'd@example.test');
    const ta = document.getElementById('ta-rej');
    ta.value = 'Document illisible, merci de renvoyer une photo nette.';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.onReason();
  });
  await expect(page.locator('#btn-rej')).toBeEnabled({ timeout: 5000 });
}

test.describe('validation admin — le bouton ne reste jamais figé', () => {

  test('VALIDER sans client base : le bouton revient, sans tourniquet', async ({ page }) => {
    await ouvrir(page);
    await prepararValidation(page);
    await sansClientBase(page);

    await page.locator('#btn-val').click();

    await expect.poll(() => etatBouton(page, '#btn-val').then((e) => e && e.tourniquet),
      { timeout: 8000 }).toBe(false);
    const e = await etatBouton(page, '#btn-val');
    expect(e.desactive, 'le bouton « Valider » reste mort').toBe(false);
    expect(e.texte, 'le bouton reste sur « Validation… »').not.toMatch(/Validation/i);
    expect(e.texte).toMatch(/Valider/i);
  });

  test('REJETER sans client base : le bouton revient ACTIF', async ({ page }) => {
    // ⚠️ Le bouton de rejet est normalement désactivé tant que le motif fait
    // moins de 20 caractères. Le remettre « comme avant » sans réfléchir
    // l'aurait rendu inerte alors que le motif est valide : on vérifie donc
    // qu'il revient CLIQUABLE, pas seulement sans tourniquet.
    await ouvrir(page);
    await preparerRejet(page);
    await sansClientBase(page);

    await page.locator('#btn-rej').click();

    await expect.poll(() => etatBouton(page, '#btn-rej').then((e) => e && e.tourniquet),
      { timeout: 8000 }).toBe(false);
    const e = await etatBouton(page, '#btn-rej');
    expect(e.desactive, 'le bouton « Confirmer le rejet » reste mort').toBe(false);
    expect(e.texte, 'le bouton reste sur « Rejet… »').not.toMatch(/^Rejet\b/i);
    expect(e.texte).toMatch(/rejet/i);
  });

  test('l’admin est PRÉVENU — le bouton rendu ne remplace pas le message', async ({ page }) => {
    // Un bouton qui redevient cliquable sans explication invite à recliquer
    // indéfiniment. Les deux moitiés comptent.
    await ouvrir(page);
    await prepararValidation(page);
    await sansClientBase(page);

    await page.locator('#btn-val').click();
    await expect(page.locator('#toast-container')).toContainText(/indisponible/i, { timeout: 8000 });
  });

  test('les sorties d’échec passent TOUTES par la même remise en état', async ({ page }) => {
    // ⚠️ La contre-épreuve de source. Le défaut n'était pas l'ignorance du
    // geste — les `catch` le faisaient déjà — mais une sortie anticipée qui
    // l'oubliait. Si quelqu'un réécrit une remise en état à la main, elle
    // redeviendra oubliable ailleurs.
    const src = await page.request.get('/admin-doctor-validation.html').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    expect((nu.match(/_rendreLeBouton\(/g) || []).length,
      'les quatre sorties d’échec ne passent plus par la fonction commune')
      .toBeGreaterThanOrEqual(5);   // 1 définition + 4 appels
    // ⚠️ ON REGARDE LES DEUX FONCTIONS CONCERNEES, PAS TOUT LE FICHIER.
    // `prevDoc()` porte le meme `toastM(...);return;` — et c'est TRES BIEN :
    // elle n'a desactive aucun bouton avant. Une assertion a l'echelle du
    // fichier l'accusait a tort, et la seule facon de la faire taire aurait
    // ete de l'affaiblir. On isole donc les corps de `doValidate` et
    // `doReject`.
    for (const nom of ['doValidate', 'doReject']) {
      const debut = nu.indexOf(`async function ${nom}(`);
      expect(debut, `${nom} est introuvable`).toBeGreaterThan(-1);
      const corps = nu.slice(debut, nu.indexOf('\n}', debut));
      expect(corps, `${nom} sort encore sans rendre le bouton`)
        .not.toMatch(/Supabase indisponible','error'\);\s*return;/);
      expect(corps, `${nom} ne passe pas par la remise en etat commune`)
        .toContain('_rendreLeBouton(');
    }
  });
});
