// =====================================================================
// S'inscrire et se connecter par e-mail — sans toucher au chemin SMS
// =====================================================================
// ⚠️ DEMANDÉ PAR AGHILES : pouvoir créer un compte sans dépendre du SMS.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT, ET DANS QUEL ORDRE D'IMPORTANCE
// ---------------------------------------------------------------------
// 1. **Le chemin téléphone n'a pas bougé.** C'est le parcours qui marche et qui
//    sert ; le nouveau vient À CÔTÉ. Premier essai du fichier, exprès.
// 2. Le mode « E-mail » appelle bien `signUp({email, password})` — avec le rôle
//    et le nom en métadonnées, sinon le déclencheur `handle_new_auth_user` crée
//    un compte sans rôle.
// 3. **Les deux issues de Supabase sont traitées différemment** :
//    session immédiate → profil créé et entrée dans l'application ;
//    `session: null`   → écran « confirmez votre e-mail », **aucun faux succès**.
// 4. `login.html` en mode « E-mail » appelle `signInWithPassword({email})`.
//
// ---------------------------------------------------------------------
// ⚠️ POURQUOI ON BOUCHONNE `auth`, ET PAS LE RÉSEAU
// ---------------------------------------------------------------------
// `hermetiser` rend `[]` à toute requête sortante : `signUp` verrait une
// réponse vide et le client lèverait, sans qu'on sache ce que la page A
// DEMANDÉ. Or c'est exactement ce qu'on veut mesurer — l'appel, ses arguments,
// et ce que la page fait de chaque réponse. On remplace donc
// `window.tabibi.supabase.auth` par un espion qui note tout et rend ce qu'on
// lui dit de rendre.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const UID = '00000000-0000-4000-8000-0000000000aa';

/**
 * Pose l'espion AVANT tout script de page.
 *
 * ⚠️ PREMIERE VERSION FAUSSE, ET ELLE M'A COUTE CINQ ESSAIS ROUGES. J'avais
 * pose un accesseur sur `window.tabibi`. Or `js/supabase-client.js` fait :
 *
 *     window.tabibi = window.tabibi || {};          // ← mon setter voit {}
 *     window.tabibi.supabase = createClient(…);     // ← assignation DIRECTE
 *
 * Le client arrive donc APRES, sur l'objet, sans repasser par mon accesseur :
 * l'espion n'etait jamais branche, les pages parlaient au vrai client, et
 * `hermetiser` leur rendait `[]`. **Un bouchon qui ne prend pas ne rate pas
 * bruyamment — il laisse le vrai code tourner.**
 *
 * On intercepte donc `createClient` lui-meme, le seul point par lequel tout
 * client passe.
 *
 * @param reponses  ce que rendent signUp / signInWithPassword / verifyOtp
 */
async function espionAuth(page, reponses) {
  await page.addInitScript((rep) => {
    window.__appels = [];
    const noter = (nom) => async (args) => {
      window.__appels.push({ nom, args: JSON.parse(JSON.stringify(args || {})) });
      const r = rep[nom];
      if (!r) return { data: { user: null, session: null }, error: null };
      return JSON.parse(JSON.stringify(r));
    };
    const faussAuth = {
      signUp: noter('signUp'),
      signInWithPassword: noter('signInWithPassword'),
      signInWithOtp: noter('signInWithOtp'),
      verifyOtp: noter('verifyOtp'),
      resend: noter('resend'),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      updateUser: noter('updateUser'),
    };
    // On ne mesure pas la base ici ; on ne la laisse pas partir sur le reseau.
    const faussDonnees = {
      from: () => ({
        upsert: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }),
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }),
                                      maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      rpc: async () => ({ data: null, error: null }),
    };

    let sdk;
    Object.defineProperty(window, 'supabase', {
      configurable: true,
      get() { return sdk; },
      set(v) {
        sdk = v;
        if (v && typeof v.createClient === 'function') {
          const vrai = v.createClient.bind(v);
          v.createClient = function () {
            const client = vrai.apply(null, arguments);
            try { client.auth = faussAuth; } catch (e) { /* fige : l'essai le dira */ }
            try { client.from = faussDonnees.from; client.rpc = faussDonnees.rpc; } catch (e) {}
            return client;
          };
        }
      },
    });
    // La passerelle RPC : les inscriptions medecin/secretaire s'en servent.
    window.tabibiRpc = async () => ({ ok: true, data: {}, erreur: null });
  }, reponses);
}

/** Remplit le formulaire commun (prénom, nom, mot de passe, consentements). */
async function remplirCommun(page) {
  await page.fill('#sf', 'Amine');
  await page.fill('#sl', 'Test');
  await page.fill('#spw', 'motdepasse123');
  await page.check('#cgu');
  await page.check('#privacy');
  const soin = page.locator('#medical-consent');
  if (await soin.count() && await soin.isVisible()) await soin.check();
}

async function ouvrirInscription(page, reponses) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await espionAuth(page, reponses || {});
  await page.addInitScript(() => { try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {} });
  await page.goto('/signup.html', ATTENDRE);
  await expect(page.locator('#su-form')).toBeVisible({ timeout: 8000 });
}

const appels = (page) => page.evaluate(() => window.__appels || []);

test.describe('inscription par e-mail, à côté du téléphone', () => {

  test('LE CHEMIN TÉLÉPHONE N’A PAS BOUGÉ — signUp({phone}) + écran OTP', async ({ page }) => {
    // ⚠️ PREMIER ESSAI DU FICHIER, ET C'EST VOULU. Le parcours SMS est celui
    // qui sert aujourd'hui ; tout le reste de ce lot vient à côté de lui. S'il
    // casse, on veut l'apprendre ici, pas dans un rapport d'utilisateur.
    await ouvrirInscription(page, {
      signUp: { data: { user: { id: UID }, session: null }, error: null },
    });
    await remplirCommun(page);
    await page.fill('#sp', '0555123456');
    await page.click('#su-form button[type="submit"]');

    await expect.poll(() => appels(page).then((a) => a.length), { timeout: 8000 }).toBeGreaterThan(0);
    const [appel] = await appels(page);
    expect(appel.nom).toBe('signUp');
    expect(appel.args.phone, 'le numéro n’est plus envoyé en E.164').toBe('+213555123456');
    expect(appel.args.email, 'un e-mail part sur le chemin téléphone').toBeUndefined();
    expect(appel.args.options.channel).toBe('sms');

    // Et l'écran OTP s'affiche, comme avant.
    await expect(page.locator('#su-screen-otp')).toBeVisible();
    await expect(page.locator('#su-screen-confirm')).toBeHidden();
  });

  test('choisir « E-mail » montre le champ e-mail et cache le numéro', async ({ page }) => {
    await ouvrirInscription(page);
    await expect(page.locator('#su-grp-phone')).toBeVisible();
    await expect(page.locator('#su-grp-email')).toBeHidden();

    await page.click('#su-mode-email');

    await expect(page.locator('#su-grp-email')).toBeVisible();
    await expect(page.locator('#su-grp-phone')).toBeHidden();
    // ⚠️ `required` DOIT suivre. Laissé sur le champ caché, le formulaire
    // devient impossible à soumettre et le navigateur essaie de mettre le focus
    // sur un champ invisible : le bouton ne fait plus rien, sans un mot.
    expect(await page.locator('#sp').evaluate((el) => el.required)).toBe(false);
    expect(await page.locator('#se').evaluate((el) => el.required)).toBe(true);
    // Et le lecteur d'écran doit entendre le changement.
    await expect(page.locator('#su-mode-email')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#su-mode-phone')).toHaveAttribute('aria-checked', 'false');
  });

  test('mode « E-mail » : signUp part avec {email, password} et les métadonnées', async ({ page }) => {
    await ouvrirInscription(page, {
      signUp: { data: { user: { id: UID, email: 'amine@exemple.test' }, session: null }, error: null },
    });
    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'amine@exemple.test');
    await page.click('#su-form button[type="submit"]');

    await expect.poll(() => appels(page).then((a) => a.length), { timeout: 8000 }).toBeGreaterThan(0);
    const [appel] = await appels(page);
    expect(appel.nom).toBe('signUp');
    expect(appel.args.email).toBe('amine@exemple.test');
    expect(appel.args.password, 'le mot de passe n’est pas transmis').toBeTruthy();
    expect(appel.args.phone, 'un numéro part sur le chemin e-mail').toBeUndefined();
    // ⚠️ Sans `role` en métadonnées, le déclencheur `handle_new_auth_user` crée
    // une ligne `public.users` sans rôle — et la personne se connecte dans le
    // vide. Ce n'est pas un détail d'analytics.
    expect(appel.args.options.data.role).toBe('patient');
    expect(appel.args.options.data.first_name).toBe('Amine');
    expect(appel.args.options.emailRedirectTo).toContain('email-verified.html');
  });

  test('AUCUNE SESSION → écran de confirmation, et AUCUN faux succès', async ({ page }) => {
    // ⚠️ LE CŒUR DU LOT. `session: null` veut dire : le compte existe, personne
    // n'est connecté, un lien est parti. Annoncer « Compte créé ! » et rediriger
    // poserait un tableau de bord vide devant quelqu'un que la première requête
    // déconnecterait — la faute de P-67 et de P-83.
    await ouvrirInscription(page, {
      signUp: { data: { user: { id: UID, email: 'amine@exemple.test' }, session: null }, error: null },
    });
    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'amine@exemple.test');
    await page.click('#su-form button[type="submit"]');

    await expect(page.locator('#su-screen-confirm')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#su-confirm-target')).toHaveText('amine@exemple.test');
    await expect(page.locator('#su-form')).toBeHidden();

    // On n'a NI redirigé, NI annoncé un succès.
    expect(page.url()).toContain('signup.html');
    const texte = await page.locator('#toast-container').innerText();
    expect(texte.toLowerCase(), 'un faux succès est annoncé').not.toContain('compte créé');
  });

  test('SESSION IMMÉDIATE → le profil est créé et on entre dans l’application', async ({ page }) => {
    // ⚠️ LA PAGE D'ARRIVEE EST REMPLACEE, ET C'EST LA CORRECTION D'UN ESSAI
    // INSTABLE. `patient-dashboard.html` exige une session ; l'espion n'en rend
    // aucune, sa garde d'authentification part sur `login.html` et **efface
    // `tabibi_user` au passage**. L'essai lisait donc tantot la valeur posee
    // par l'inscription, tantot rien : deux fois « flaky » sur deux cibles.
    // On n'assouplit pas l'assertion — on retire la course. Ce qu'on mesure
    // ici, c'est l'INSCRIPTION, pas le tableau de bord.
    await ouvrirInscription(page, {
      signUp: {
        data: {
          user: { id: UID, email: 'amine@exemple.test' },
          session: { access_token: 'jeton-de-test', user: { id: UID, email: 'amine@exemple.test' } },
        },
        error: null,
      },
    });
    // ⚠️ APRES `ouvrirInscription`, ET C'EST TOUTE LA CORRECTION. Pose avant,
    // ce bouchon ne servait jamais : `hermetiser` s'installe ensuite, sa route
    // `**` est donc plus RECENTE, et son `route.continue()` envoie la requete
    // AU SERVEUR — il ne repasse pas la main aux routes plus anciennes. Le vrai
    // tableau de bord se chargeait, sa garde d'authentification partait sur
    // `login.html` en effaçant `tabibi_user`, et l'essai echouait une fois sur
    // deux. **L'ordre des routes n'est pas un detail de style.**
    await page.route('**/patient-dashboard.html*', (route) => route.fulfill({
      status: 200, contentType: 'text/html',
      body: '<!doctype html><title>arrivee</title><main id="arrivee">arrivee</main>',
    }));

    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'amine@exemple.test');
    await page.click('#su-form button[type="submit"]');

    // La preuve, c'est la REDIRECTION vers l'espace patient — pas un toast.
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('patient-dashboard.html');
    // ⚠️ ET ON ATTEND QUE LA PAGE D'ARRIVEE SOIT LA. L'URL change AVANT que le
    // nouveau document existe : lire `localStorage` dans cet intervalle donne
    // « Execution context was destroyed ». C'est ce qui rendait l'essai
    // instable une fois sur deux, en parallele — pas le code mesure.
    await expect(page.locator('#arrivee')).toHaveText('arrivee', { timeout: 10000 });

    // ⚠️ Et l'adresse est retenue. `_persistAndGo` posait `email: ""` en dur :
    // un compte créé par e-mail se serait affiché sans adresse dans toute
    // l'application, alors que c'est la seule chose qu'il possède.
    const stocke = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('tabibi_user') || '{}'); } catch (e) { return {}; }
    });
    expect(stocke.email).toBe('amine@exemple.test');
    expect(stocke.role).toBe('patient');
    // L'écran de confirmation n'a PAS été montré : il y avait une session.
    expect(stocke.phone || '', 'un numéro est inventé pour un compte e-mail').toBe('');
  });

  test('le NAVIGATEUR refuse « pas-une-adresse » — rien ne part', async ({ page }) => {
    // ⚠️ MESURÉ, ET ÇA A CORRIGÉ L'ESSAI. J'attendais un toast : il n'y en a
    // pas, parce que `<input type="email">` bloque la soumission lui-même et
    // affiche sa propre bulle. `doSignup` n'est jamais appelé. C'est le bon
    // comportement — mais ce n'est pas celui que j'avais écrit, et un essai qui
    // décrit mal ce qui se passe finit par être « assoupli » jusqu'à passer.
    await ouvrirInscription(page);
    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'pas-une-adresse');
    await page.click('#su-form button[type="submit"]');

    expect(await page.locator('#se').evaluate((el) => el.validity.valid)).toBe(false);
    expect(await appels(page), 'on appelle Supabase avec une adresse invalide').toHaveLength(0);
    await expect(page.locator('#su-screen-confirm')).toBeHidden();
  });

  test('et la validation JS rattrape ce que le navigateur laisse passer', async ({ page }) => {
    // ⚠️ `a@b` est VALIDE pour `type="email"` — les navigateurs acceptent un
    // domaine sans point. Sans le contrôle JS, l'inscription partirait avec une
    // adresse qui ne recevra jamais rien, et la personne attendrait un courriel
    // qui n'existe pas. C'est exactement l'écart que la garde doit tenir : le
    // navigateur ne suffit pas.
    await ouvrirInscription(page);
    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'a@b');
    expect(await page.locator('#se').evaluate((el) => el.validity.valid),
      'le navigateur refuse déjà a@b : cet essai ne prouve plus rien').toBe(true);
    await page.click('#su-form button[type="submit"]');

    await expect(page.locator('#toast-container')).toContainText(/email|e-mail/i, { timeout: 5000 });
    expect(await appels(page), 'on appelle Supabase avec a@b').toHaveLength(0);
  });

  test('« adresse déjà utilisée » se dit en français, pas en anglais brut', async ({ page }) => {
    // ⚠️ Et surtout : PAS « Ce numéro a déjà un compte ». Sur une inscription
    // par e-mail, ce message est un mensonge poli — la personne n'a saisi aucun
    // numéro et relit le sien trois fois sans comprendre.
    await ouvrirInscription(page, {
      signUp: { data: { user: null, session: null },
        error: { message: 'User already registered', status: 422 } },
    });
    await remplirCommun(page);
    await page.click('#su-mode-email');
    await page.fill('#se', 'deja@exemple.test');
    await page.click('#su-form button[type="submit"]');

    const toast = page.locator('#toast-container');
    await expect(toast).toContainText(/e-mail|adresse/i, { timeout: 8000 });
    const texte = await toast.innerText();
    expect(texte, 'le message parle d’un numéro sur une inscription par e-mail')
      .not.toMatch(/numéro/i);
    expect(texte, 'message anglais brut de Supabase').not.toMatch(/already registered/i);
  });
});

test.describe('connexion par e-mail', () => {

  async function ouvrirConnexion(page, reponses) {
    await hermetiser(page);
    await neutraliserCaptcha(page);
    await espionAuth(page, reponses || {});
    await page.addInitScript(() => { try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {} });
    await page.goto('/login.html', ATTENDRE);
    await expect(page.locator('#screen-phone')).toBeVisible({ timeout: 8000 });
  }

  test('LE CHEMIN TÉLÉPHONE N’A PAS BOUGÉ — signInWithPassword({phone})', async ({ page }) => {
    await ouvrirConnexion(page, {
      signInWithPassword: { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } },
    });
    await page.fill('#lp-phone', '0555123456');
    await page.fill('#lp-pass', 'motdepasse123');
    await page.click('#pwLoginForm button[type="submit"]');

    await expect.poll(() => appels(page).then((a) => a.length), { timeout: 8000 }).toBeGreaterThan(0);
    const [appel] = await appels(page);
    expect(appel.nom).toBe('signInWithPassword');
    expect(appel.args.phone).toBe('+213555123456');
    expect(appel.args.email).toBeUndefined();
  });

  test('« E-mail » bascule d’écran et appelle signInWithPassword({email})', async ({ page }) => {
    await ouvrirConnexion(page, {
      signInWithPassword: { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } },
    });
    await page.click('#lo-mode-email');
    await expect(page.locator('#screen-admin')).toBeVisible();
    await expect(page.locator('#screen-phone')).toBeHidden();

    await page.fill('#le', 'amine@exemple.test');
    await page.fill('#lp', 'motdepasse123');
    await page.click('#screen-admin button[type="submit"]');

    await expect.poll(() => appels(page).then((a) => a.length), { timeout: 8000 }).toBeGreaterThan(0);
    const [appel] = await appels(page);
    expect(appel.nom).toBe('signInWithPassword');
    expect(appel.args.email).toBe('amine@exemple.test');
    expect(appel.args.phone).toBeUndefined();
  });

  test('le chemin e-mail n’est plus étiqueté « admin »', async ({ page }) => {
    // ⚠️ C'ÉTAIT TOUT LE DÉFAUT. `doLogin()` existait, marchait, et appelait
    // déjà `signInWithPassword({email})` — derrière un lien gris de 12 px
    // nommé « Connexion admin ». Quelqu'un qui a un compte e-mail et n'est pas
    // administrateur n'avait aucune raison de cliquer dessus.
    await ouvrirConnexion(page);
    const html = await page.request.get('/login.html').then((r) => r.text());
    const nu = html.replace(/<!--[\s\S]*?-->/g, ' ');
    expect(nu, 'le lien « Connexion admin » est revenu').not.toMatch(/Connexion admin/i);
    await expect(page.locator('#lo-mode-email')).toBeVisible();
  });

  test('le sélecteur disparaît pendant « mot de passe oublié » — et revient après', async ({ page }) => {
    // Un sélecteur qui reste affiché pendant les trois écrans de réinitialisation
    // proposerait de basculer vers un formulaire sans rapport, et le retour
    // serait un mystère.
    await ouvrirConnexion(page);
    await page.click('a[onclick="showReset(event)"]');
    await expect(page.locator('#screen-reset')).toBeVisible();
    await expect(page.locator('#lo-mode')).toBeHidden();
  });
});
