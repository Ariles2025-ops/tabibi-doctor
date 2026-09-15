// =====================================================================
// L'acces medecin par numero — ce que la page fait, et ce qu'elle refuse
// =====================================================================
// ⚠️ RAPPEL : un numero de telephone n'est pas un secret. Ce mode d'acces est
// une DETTE DE SECURITE ASSUMEE (registre P-40), reservee au pilote ferme.
// Ces essais ne le rendent pas sur. Ils verifient que la PAGE :
//
//   - n'ouvre jamais de session sans jetons reels,
//   - ne dit jamais POURQUOI un numero est refuse,
//   - n'appelle meme pas le serveur pour un numero mal forme,
//   - transmet bien le jeton Turnstile.
//
// Le serveur est bouchonne : aucun reseau reel, comme partout dans cette
// suite (`_hermetique.js`).
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS NE PEUVENT PAS FAIRE
// ---------------------------------------------------------------------
// La liste blanche, l'interrupteur, Turnstile et la limitation vivent DANS LA
// FONCTION. Un essai navigateur ne peut que bouchonner ses reponses — il
// verifie la page, pas la garde. Les gardes elles-memes sont verifiees par
// `tests/acces-pilote.test.mjs`, qui lit le code de la fonction.
// **Aucun des deux ne remplace un essai reel sur la fonction deployee.**
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/medecin-pilote.html';
const NUMERO_OK = '0555123456';

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

/**
 * Bouchonne la fonction `acces-pilote` et retient les corps recus.
 * @returns {{ appels: object[] }} — a inspecter pour prouver ce qui est parti.
 */
async function bouchonner(page, reponse, statut = 200) {
  const appels = [];
  await page.route('**/functions/v1/acces-pilote', async (route) => {
    let corps = null;
    try { corps = JSON.parse(route.request().postData() || 'null'); } catch { corps = null; }
    appels.push(corps);
    await route.fulfill({
      status: statut, contentType: 'application/json', body: JSON.stringify(reponse),
    });
  });
  return { appels };
}

/**
 * Un jeton d'acces SYNTAXIQUEMENT valide.
 *
 * `setSession` de supabase-js decode le jeton pour y lire `exp` : une chaine
 * quelconque le fait echouer. Premiere version de cet essai : `'a'` — la page
 * affichait « la session n'a pas pu etre ouverte », **et elle avait raison**.
 * C'est le bouchon qui etait faux, pas la page.
 *
 * ⚠️ Et la SIGNATURE compte aussi, alors qu'elle n'est jamais verifiee ici :
 * chaque partie doit etre du base64url VALIDE, donc sa longueur ne peut pas
 * valoir 1 modulo 4. `'signature-de-test'` (17 caracteres) faisait echouer le
 * decodage avec « JWT not in base64url format ». Trois caracteres suffisent.
 */
function jetonDeTest() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: '00000000-0000-4000-8000-000000000042', role: 'authenticated', exp,
  })}.sig`;                    // <- 3 caracteres, et ce n'est pas indifferent
}

/** La pose de session interroge `/auth/v1/user` : on repond, sinon elle echoue. */
async function bouchonnerSession(page) {
  // Tout `/auth/v1/**`, pas seulement `/user` : supabase-js peut aussi appeler
  // `/token` pendant la pose. Une seule route non couverte recevait la reponse
  // hermetique par defaut (`[]`), et la session echouait — en accusant la page.
  await page.route('**/auth/v1/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: '00000000-0000-4000-8000-000000000042', phone: '213555123456',
      aud: 'authenticated', role: 'authenticated',
      // Le role metier est dans les metadonnees : c'est ce que la fonction y
      // ecrit, et ce que le tableau de bord medecin verifie a l'arrivee.
      user_metadata: { role: 'medecin', pilote: true },
    }),
  }));
}

/**
 * Le tableau de bord medecin, remplace par une page inerte.
 *
 * Sans ce bouchon, l'essai partait pour de bon sur `doctor-dashboard.html`,
 * qui renvoie ailleurs quand la session bouchonnee ne lui plait pas — et
 * l'essai echouait en accusant la redirection de NOTRE page, qui avait
 * pourtant fait exactement ce qu'il fallait. **On mesure l'arrivee, pas le
 * voyage qui suit.**
 */
async function bouchonnerTableauDeBord(page) {
  await page.route('**/doctor-dashboard.html*', (route) => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8',
    body: '<!DOCTYPE html><title>bord medecin (bouchon)</title><h1 id="bord">bord medecin</h1>',
  }));
}

async function saisirEtEnvoyer(page, numero) {
  await page.fill('#pil-phone', numero);
  await page.click('#pil-btn');
}

// ─────────────────────────────────────────────────────────────────────
test.describe('acces pilote par numero', () => {

  test('un numero de la liste ouvre la session et mene au tableau de bord', async ({ page }) => {
    await bouchonnerSession(page);
    await bouchonnerTableauDeBord(page);
    const { appels } = await bouchonner(page, {
      ok: true,
      access_token: jetonDeTest(),
      refresh_token: 'jeton-rafraichissement-de-test',
      expires_in: 3600,
      doctor_profile_id: '00000000-0000-4000-8000-000000000007',
    });

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);

    await page.waitForURL(/doctor-dashboard\.html/, { timeout: 10000 });
    expect(appels.length).toBe(1);
    // Le numero part NORMALISE : le serveur n'a pas a deviner la forme.
    expect(appels[0].phone).toBe('213555123456');
  });

  test('un numero hors liste : un refus, et AUCUNE session', async ({ page }) => {
    await bouchonner(page, { error: 'acces_non_autorise' }, 403);

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);

    const msg = page.locator('#pil-msg');
    await expect(msg).toBeVisible();
    await expect(msg).toHaveClass(/err/);
    // On reste sur la page : il n'existe pas d'ecran de succes sans jetons.
    expect(page.url()).toContain('medecin-pilote');

    // Et rien n'a ete pose en session.
    const session = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('sb-')).length);
    expect(session).toBe(0);
  });

  test('le refus ne dit JAMAIS pourquoi — sinon la page devient un annuaire', async ({ page }) => {
    // Le serveur, lui, ne renvoie qu'un code. Mais si un jour il en renvoyait
    // un plus bavard, la page ne doit pas le relayer.
    await bouchonner(page, {
      error: 'numero_revoque',
      detail: 'ce numero a ete revoque le 12/09 par admin@tabibi.doctor',
    }, 403);

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);

    const texte = await page.locator('#pil-msg').textContent();
    expect(texte).not.toContain('revoque');
    expect(texte).not.toContain('admin@tabibi.doctor');
    expect(texte).not.toContain('12/09');
  });

  test('interrupteur ferme : un refus, pas un ecran cassé', async ({ page }) => {
    await bouchonner(page, { error: 'feature_disabled' }, 403);

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);

    await expect(page.locator('#pil-msg')).toBeVisible();
    await expect(page.locator('#pil-msg')).toHaveClass(/err/);
    expect(page.url()).toContain('medecin-pilote');
  });

  test('une reponse « ok » SANS jetons ne suffit pas', async ({ page }) => {
    // Le piege du « e-mail envoye » : un `ok: true` qui ne prouve rien.
    // `tabibiRpc` et `functions.invoke` rendent `ok` des qu'il n'y a pas
    // d'erreur — la page doit exiger les JETONS, pas le mot « ok ».
    await bouchonner(page, { ok: true }, 200);

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);

    await expect(page.locator('#pil-msg')).toHaveClass(/err/);
    expect(page.url()).toContain('medecin-pilote');
  });

  test('un numero mal forme n atteint meme pas le serveur', async ({ page }) => {
    const { appels } = await bouchonner(page, { ok: true }, 200);

    await page.goto(PAGE, ATTENDRE);
    // Un fixe algerien : ce n'est pas un mobile.
    await saisirEtEnvoyer(page, '021123456');

    await expect(page.locator('#pil-msg')).toHaveClass(/err/);
    expect(appels.length).toBe(0);
  });

  test('le jeton Turnstile est transmis — le champ existe toujours', async ({ page }) => {
    await bouchonnerSession(page);
    await bouchonnerTableauDeBord(page);
    const { appels } = await bouchonner(page, {
      ok: true, access_token: jetonDeTest(), refresh_token: 'b', expires_in: 3600,
    });

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);
    await page.waitForURL(/doctor-dashboard\.html/, { timeout: 10000 });

    expect(appels.length).toBe(1);
    // Le contrat avec la fonction : le champ part, meme vide. La fonction
    // refuse quand il est vide — c'est SA garde, pas celle de la page.
    expect(Object.keys(appels[0])).toContain('turnstile_token');
  });

  test('apres l entree, `tabibi_user` est REMPLI — sinon le bord affiche « Dr. -- »', async ({ page }) => {
    // ⚠️ Mesure en live le 15/09 : une session valide ne suffisait pas. Le
    // tableau de bord ne lit pas la session, il lit `tabibi_user` dans
    // `localStorage` — et l'entree par numero ne le remplissait pas.
    await bouchonnerSession(page);
    await bouchonnerTableauDeBord(page);
    await page.route('**/rest/v1/rpc/get_my_doctor_profile', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000007',
        full_name: 'Dr Amina Benali', specialty_raw: 'Cardiologie', city: 'Alger',
        phone: '213555123456', email: 'a.benali@example.test', photo_url: '',
        validation_status: 'approved',
      }),
    }));
    await bouchonner(page, {
      ok: true, access_token: jetonDeTest(), refresh_token: 'r', expires_in: 3600,
      doctor_profile_id: '00000000-0000-4000-8000-000000000007',
    });

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);
    await page.waitForURL(/doctor-dashboard\.html/, { timeout: 10000 });

    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_user') || 'null'));
    expect(u, 'tabibi_user absent : le tableau de bord affichera « Dr. -- »').not.toBeNull();
    expect(u.name).toBe('Dr Amina Benali');
    expect(u.initials).toBe('AB');
    expect(u.role).toBe('medecin');
    expect(u.specialty).toBe('Cardiologie');
    expect(u.ville).toBe('Alger');
    expect(u.doctor_profile_id).toBe('00000000-0000-4000-8000-000000000007');
    // Le marqueur de sortie : un pilote n'a pas de mot de passe.
    expect(await page.evaluate(() => localStorage.getItem('tabibi_pilote'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('tabibi_role'))).toBe('medecin');
  });

  test('si la fiche ne revient pas, on n INVENTE pas de nom', async ({ page }) => {
    // Un nom fabrique donnerait le change et masquerait le defaut. On ecrit le
    // minimum, et le tableau de bord dira ce qu'il sait.
    await bouchonnerSession(page);
    await bouchonnerTableauDeBord(page);
    await page.route('**/rest/v1/rpc/get_my_doctor_profile', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: 'null',
    }));
    await bouchonner(page, {
      ok: true, access_token: jetonDeTest(), refresh_token: 'r', expires_in: 3600,
      doctor_profile_id: '00000000-0000-4000-8000-000000000007',
    });

    await page.goto(PAGE, ATTENDRE);
    await saisirEtEnvoyer(page, NUMERO_OK);
    await page.waitForURL(/doctor-dashboard\.html/, { timeout: 10000 });

    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_user') || 'null'));
    expect(u.role).toBe('medecin');
    expect(u.name === undefined || u.name === '').toBeTruthy();
    // Le lien vers la fiche est conserve : il vient de la liste blanche, pas d'elle.
    expect(u.doctor_profile_id).toBe('00000000-0000-4000-8000-000000000007');
  });

  // ───────────────────────────────────────────────────────────────────
  // LA SORTIE — un pilote n'a pas de mot de passe
  // ───────────────────────────────────────────────────────────────────
  async function bouchonnerLesDeuxPortes(page) {
    await page.route('**/medecin-pilote.html*', (route) => route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!DOCTYPE html><title>porte pilote (bouchon)</title><h1 id="porte">pilote</h1>',
    }));
    await page.route('**/login.html*', (route) => route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!DOCTYPE html><title>login (bouchon)</title><h1 id="porte">login</h1>',
    }));
  }

  test('session expiree, compte PILOTE : on repart vers medecin-pilote.html', async ({ page }) => {
    // ⚠️ `login.html` serait un mur : il n'a pas de mot de passe a y taper.
    await bouchonnerLesDeuxPortes(page);
    // ⚠️ PAS `addInitScript` : il rejoue a CHAQUE navigation, donc aussi sur la
    // page d'arrivee — le marqueur etait repose juste apres avoir ete purge, et
    // le test accusait le code d'un nettoyage qu'il avait bien fait.
    await page.goto('/medecin-pilote.html', ATTENDRE);
    await page.evaluate(() => localStorage.setItem('tabibi_pilote', '1'));
    await page.goto('/doctor-dashboard.html', ATTENDRE);
    await page.waitForURL(/medecin-pilote\.html/, { timeout: 10000 });
    // Et le marqueur part avec la purge : il ne doit pas survivre a la session.
    expect(await page.evaluate(() => localStorage.getItem('tabibi_pilote'))).toBeNull();
  });

  test('session expiree, compte ORDINAIRE : on repart vers login.html', async ({ page }) => {
    // La contre-epreuve du test precedent : sans le marqueur, rien ne change.
    await bouchonnerLesDeuxPortes(page);
    await page.goto('/doctor-dashboard.html', ATTENDRE);
    await page.waitForURL(/login\.html/, { timeout: 10000 });
  });

  test('la page n affiche aucun champ de mot de passe', async ({ page }) => {
    await page.goto(PAGE, ATTENDRE);
    expect(await page.locator('input[type="password"]').count()).toBe(0);
    // Et elle dit a qui elle s'adresse : un medecin qui arrive par hasard doit
    // comprendre qu'il n'est pas au bon endroit.
    await expect(page.locator('.pil-note')).toContainText(/pilote/i);
  });

  test('aucune cle ni jeton en dur dans la page servie', async ({ page }) => {
    const reponse = await page.goto(PAGE, ATTENDRE);
    const html = await reponse.text();
    // On cherche une chaine EN FORME de secret, pas le mot « secret ».
    const suspects = (html.match(/['"][A-Za-z0-9_-]{40,}['"]/g) || [])
      .filter((s) => !/^['"](assets|images|styles|css|js)\//.test(s));
    expect(suspects, `chaines suspectes : ${suspects.slice(0, 3).join(', ')}`).toEqual([]);
  });
});
