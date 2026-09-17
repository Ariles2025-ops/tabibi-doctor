// =====================================================================
// Le rejet d'un médecin appelait une fonction qui n'existe pas
// =====================================================================
// ⚠️ TROUVÉ PAR L'AUDIT SOURCE (SEQ 70), PROUVÉ EN BASE. `admin-dashboard.html`
// envoyait `p_reason` **et** `p_notes` :
//
//     window.tabibiRpc('admin_validate_doctor', {
//       p_doctor_id, p_action: 'reject', p_reason: reason,
//       p_notes: 'Rejeté via admin dashboard' })
//
// Signature lue en base le 17/09 — **la seule** :
//
//     admin_validate_doctor(p_doctor_id uuid, p_action text,
//                           p_notes text DEFAULT NULL) -> jsonb
//
// **PostgREST apparie par NOMS d'arguments.** Un nom inconnu, et il ne trouve
// aucune surcharge : le rejet ne s'exécutait **jamais**. Il tombait dans le
// `catch`, et l'admin lisait « Erreur : … » sans savoir pourquoi.
//
// ---------------------------------------------------------------------
// ⚠️ ET `p_notes` EST LE MOTIF — lu dans le corps de la fonction
// ---------------------------------------------------------------------
//     IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
//       RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
//     UPDATE doctor_profiles SET … validation_rejected_reason = p_notes
//
// La constante « Rejeté via admin dashboard » aurait donc, une fois l'appel
// réparé, **remplacé le motif écrit par l'admin** — et c'est ce motif que le
// médecin reçoit par courriel. Réparer la signature sans réparer le contenu
// aurait produit un rejet qui marche et qui ne dit rien.
//
// ---------------------------------------------------------------------
// CE QUE CET ESSAI NE PROUVE PAS
// ---------------------------------------------------------------------
// Que la base accepte l'appel : il bouchonne la passerelle. Ce qu'il tient,
// c'est **ce que le front envoie** — les noms d'arguments et le contenu du
// motif. La signature réelle, elle, est vérifiée en base et recopiée ici.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const ADMIN = '00000000-0000-4000-8000-00000000000a';
const MEDECIN = '00000000-0000-4000-8000-0000000000d1';

/** Les arguments que la fonction accepte, recopiés de la base — rien d'autre. */
const ARGS_REELS = ['p_doctor_id', 'p_action', 'p_notes'];

const MOTIF = 'Carte de l’Ordre illisible, merci de renvoyer une photo nette.';

/**
 * Bouchonne la passerelle et note tout appel.
 *
 * ⚠️ Par un ACCESSEUR : `js/tabibi-rpc.js` fait `window.tabibiRpc = …` sans
 * condition et écraserait un bouchon posé normalement. L'essai mesurerait alors
 * la vraie passerelle, qui part sur le réseau que `hermetiser` coupe.
 */
async function espionRpc(page, reponse) {
  await page.addInitScript((rep) => {
    window.__rpc = [];
    const faux = async (nom, args) => {
      window.__rpc.push({ nom, args: JSON.parse(JSON.stringify(args || {})) });
      return JSON.parse(JSON.stringify(rep));
    };
    Object.defineProperty(window, 'tabibiRpc', {
      configurable: true,
      get() { return faux; },
      set() { /* le vrai module n'ecrase pas le bouchon */ },
    });
  }, reponse || { ok: true, data: { ok: true }, erreur: null });
}

async function ouvrirAdmin(page, chemin) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await espionRpc(page);
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
    body: JSON.stringify({ id: ADMIN, email: 'a@example.test', role: 'admin',
                           status: 'active', is_super_admin: false, preferred_language: 'fr' }),
  }));
  await page.goto(chemin, ATTENDRE);
  expect(page.url(), 'redirigé : la session admin n’a pas pris').not.toContain('login.html');
}

const appels = (page) => page.evaluate(() => window.__rpc || []);
const validations = async (page) =>
  (await appels(page)).filter((a) => a.nom === 'admin_validate_doctor');

test.describe('rejet / validation admin — la signature réellement appelée', () => {

  test('REJET : aucun `p_reason`, et le MOTIF SAISI part dans `p_notes`', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE, et ses deux moitiés : la bonne signature ET le
    // bon contenu. L'une sans l'autre donne un rejet qui aboutit sans motif.
    await ouvrirAdmin(page, '/admin-dashboard.html');
    await page.evaluate((m) => { window.prompt = () => m; }, MOTIF);
    await page.evaluate((id) => window.rejectDoctor(id, 'd@example.test', 'Dr Benali'), MEDECIN);

    await expect.poll(() => validations(page).then((a) => a.length), { timeout: 8000 }).toBe(1);
    const [appel] = await validations(page);

    expect(Object.keys(appel.args).sort(), 'la signature envoyée ne correspond pas à celle de la base')
      .toEqual([...ARGS_REELS].sort());
    expect(appel.args.p_reason, '`p_reason` n’existe pas : PostgREST n’appariera aucune fonction')
      .toBeUndefined();
    expect(appel.args.p_action).toBe('reject');
    expect(appel.args.p_notes, 'le motif saisi par l’admin est remplacé par une constante')
      .toBe(MOTIF);
    expect(appel.args.p_notes, 'la constante est revenue').not.toMatch(/via admin dashboard/i);
  });

  test('`p_notes` respecte la longueur minimale que la fonction exige', async ({ page }) => {
    // La fonction refuse (`reason_required`) en dessous de 3 caractères. Le
    // front garde déjà 5 minimum : on vérifie qu'un motif trop court n'atteint
    // jamais la base — un aller-retour pour se faire refuser est une seconde
    // perdue et un message d'erreur de plus.
    await ouvrirAdmin(page, '/admin-dashboard.html');
    await page.evaluate(() => { window.prompt = () => 'ok'; });
    await page.evaluate((id) => window.rejectDoctor(id, 'd@example.test', 'Dr Benali'), MEDECIN);

    await expect(page.locator('#toast-container')).toContainText(/trop courte/i, { timeout: 8000 });
    expect(await validations(page), 'un motif trop court part quand même en base').toHaveLength(0);
  });

  test('VALIDATION : elle reste fonctionnelle, et sur la même signature', async ({ page }) => {
    // ⚠️ La contre-épreuve du correctif : on n'a pas réparé le rejet en cassant
    // l'approbation, qui elle marchait.
    await ouvrirAdmin(page, '/admin-dashboard.html');
    // ⚠️ `validateDoctor` s'ouvre sur un `confirm()`. Sans cette ligne, le
    // navigateur le refuse par défaut en mode automatisé, la fonction sort
    // aussitôt, et l'essai conclut « aucun appel » — un rouge qui n'a rien à
    // voir avec la signature qu'il garde.
    await page.evaluate(() => { window.confirm = () => true; });
    await page.evaluate((id) => window.validateDoctor(id, 'd@example.test', 'Dr Benali'), MEDECIN);

    await expect.poll(() => validations(page).then((a) => a.length), { timeout: 8000 }).toBe(1);
    const [appel] = await validations(page);
    expect(Object.keys(appel.args).sort()).toEqual([...ARGS_REELS].sort());
    expect(appel.args.p_action).toBe('validate');
  });

  test('LES DEUX ÉCRANS parlent la même signature — contre-épreuve de source', async ({ page }) => {
    // ⚠️ `admin-doctor-validation.html` était déjà correct (vérifié avant d'y
    // toucher : aucune ligne modifiée là-bas). Cet essai empêche qu'un des deux
    // écrans reparte de son côté — c'est exactement ce qui s'est produit ici.
    for (const chemin of ['/admin-dashboard.html', '/admin-doctor-validation.html']) {
      const src = await page.request.get(chemin).then((r) => r.text());
      const nu = src
        .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ');

      expect(nu, `${chemin} envoie encore p_reason`).not.toMatch(/p_reason\s*:/);
      expect(nu, `${chemin} n’appelle plus admin_validate_doctor`)
        .toMatch(/admin_validate_doctor/);
      // Tout argument `p_…` passé à cette RPC doit être l'un des trois réels.
      for (const m of nu.matchAll(/admin_validate_doctor'[^)]*?\{([^}]*)\}/g)) {
        for (const arg of (m[1].match(/\bp_[a-z_]+/g) || [])) {
          expect(ARGS_REELS, `${chemin} passe « ${arg} », inconnu de la fonction`).toContain(arg);
        }
      }
    }
  });
});
