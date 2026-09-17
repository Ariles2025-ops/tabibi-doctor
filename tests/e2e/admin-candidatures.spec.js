// =====================================================================
// Une candidature persistait, et personne ne la lisait
// =====================================================================
// ⚠️ P-69. Depuis la veille, l'inscription médecin **enregistre** : la RPC
// `soumettre_candidature_medecin` dépose une ligne dans
// `public.doctor_applications`, dont la RLS réserve la lecture aux admins.
//
// **Et aucun écran ne la lisait.** Une candidature partait dans une table que
// personne n'ouvrait, pendant que l'écran de dépôt disait « Nous vous
// écrirons ». C'est la forme douce du tableau de bord vert du cron des
// rappels : le système marche, et personne ne regarde.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// Que la page demande la bonne table, la montre, dise quand elle échoue, et
// n'exécute pas ce qu'un candidat a tapé.
//
// **Ce qu'ils ne prouvent pas :** que la RLS laisse passer. La lecture est
// bouchonnée. Ce qui se passe côté serveur se lit en base.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/admin-candidatures.html';

const CANDIDATURES = [
  {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', created_at: '2026-09-15T09:30:00Z',
    status: 'pending_verification', first_name: 'Amina', last_name: 'Cherif',
    email: 'amina@example.test', phone: '+213700000001', ordre_num: 'ORD-12345',
    specialty: 'Cardiologue', subspecialty: null, wilaya: 'Alger',
    cabinet: 'Cabinet du Centre', address: '12 rue X', price_dzd: 2500,
    start_year: 2012, plan: 'discovery',
  },
  {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302', created_at: '2026-09-14T09:30:00Z',
    status: 'approved', first_name: 'Yacine', last_name: 'Benali',
    email: 'yacine@example.test', phone: '+213700000002', ordre_num: 'ORD-9',
    specialty: 'Pédiatre', wilaya: 'Oran',
  },
];

/**
 * Remplace `js/supabase-client.js` — le vrai fait
 * `window.tabibi.supabase = createClient(…)` sans condition et écraserait
 * tout bouchon posé par `addInitScript`.
 */
async function bouchonner(page, reponse) {
  await page.route('**/js/supabase-client.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `
      window.tabibi = window.tabibi || {};
      window.__table = null;
      const REP = ${JSON.stringify(reponse)};
      function chaine(){
        const o = {
          select: () => o, order: () => o, limit: () => o, eq: () => o,
          then: (res) => Promise.resolve(REP).then(res),
        };
        return o;
      }
      window.tabibi.supabase = {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'fx-admin' } } } }) },
        from: (t) => { window.__table = t; return chaine(); },
      };`,
  }));
}

/**
 * Bouchonne la PASSERELLE, pas `supabase.rpc` : c'est par elle que la page
 * passe, et c'est donc elle qu'il faut essayer.
 *
 * @param {object} parStatut  { <p_statut>: reponse, defaut: reponse } — une
 *   réponse par transition, pour pouvoir faire réussir l'une et refuser l'autre
 *   dans le même essai.
 */
async function bouchonnerRpc(page, parStatut) {
  await page.addInitScript((rep) => {
    window.__rpc = [];
    const faux = async (nom, args) => {
      window.__rpc.push({ nom, args });
      const cle = args && args.p_statut;
      return (cle && Object.prototype.hasOwnProperty.call(rep, cle)) ? rep[cle] : rep.defaut;
    };
    // ⚠️ POSÉE AVANT le chargement de `js/tabibi-rpc.js`, qui fait
    // `window.tabibiRpc = tabibiRpc` **sans condition** et écraserait le
    // bouchon. On installe donc un accesseur : le module croit s'installer, le
    // bouchon reste. Sans ça, l'essai mesurerait la vraie passerelle — et
    // partirait sur le réseau, que `hermetiser` coupe.
    Object.defineProperty(window, 'tabibiRpc', {
      configurable: true,
      get() { return faux; },
      set() { /* le module s'installe : on garde le bouchon */ },
    });
  }, parStatut);
}

async function bouchonnerAuth(page, role = 'admin') {
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.__roleDemande = null;
           window.tabibi.auth = {
             requireAuth: async (r) => { window.__roleDemande = r; return ${JSON.stringify(role)} ? { id:'fx', role: ${JSON.stringify(role)} } : null; },
             getUser: async () => ({ id:'fx' }), signOut: async () => {}, logout: async () => {}
           };`,
  }));
}

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe('la liste admin des candidatures', () => {

  test('elle lit `doctor_applications` et AFFICHE ce qu’elle reçoit', async ({ page }) => {
    await bouchonnerAuth(page);
    await bouchonner(page, { data: CANDIDATURES, error: null });
    await page.goto(PAGE, ATTENDRE);

    await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });  // filtre par défaut
    expect(await page.evaluate(() => window.__table)).toBe('doctor_applications');
    await expect(page.locator('.cand-card').first()).toContainText('Amina Cherif');
    // Le n° au Conseil de l'Ordre est LA pièce qui sert à vérifier : il doit être là.
    await expect(page.locator('.cand-card').first()).toContainText('ORD-12345');
  });

  test('le filtre montre les autres statuts — rien n’est perdu de vue', async ({ page }) => {
    await bouchonnerAuth(page);
    await bouchonner(page, { data: CANDIDATURES, error: null });
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

    await page.locator('.tab[data-st="all"]').click();
    await expect(page.locator('.cand-card')).toHaveCount(2);
    await expect(page.locator('.cand-card').nth(1)).toContainText('Yacine Benali');
  });

  test('les compteurs d’onglets viennent des DONNÉES, pas d’un chiffre écrit', async ({ page }) => {
    await bouchonnerAuth(page);
    await bouchonner(page, { data: CANDIDATURES, error: null });
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

    await expect(page.locator('.tab[data-st="pending_verification"]')).toContainText('(1)');
    await expect(page.locator('.tab[data-st="approved"]')).toContainText('(1)');
    await expect(page.locator('.tab[data-st="rejected"]')).toContainText('(0)');
    await expect(page.locator('.tab[data-st="all"]')).toContainText('(2)');
  });

  test('une ERREUR de lecture se voit — elle ne se lit pas « aucune candidature »', async ({ page }) => {
    // ⚠️ LE PIÈGE À ÉVITER. Une liste vide sur une erreur de lecture se lit
    // « personne ne s'inscrit » — et on en conclurait que le formulaire est
    // cassé, ou pire, qu'il n'intéresse personne.
    await bouchonnerAuth(page);
    await bouchonner(page, { data: null, error: { message: 'permission denied' } });
    await page.goto(PAGE, ATTENDRE);

    await expect(page.locator('#liste')).toContainText(/impossible de charger/i, { timeout: 8000 });
    expect(await page.locator('.cand-card').count()).toBe(0);
  });

  test('aucune candidature : on le dit, sans faire croire à une panne', async ({ page }) => {
    await bouchonnerAuth(page);
    await bouchonner(page, { data: [], error: null });
    await page.goto(PAGE, ATTENDRE);

    await expect(page.locator('#liste')).toContainText(/aucune candidature/i, { timeout: 8000 });
  });

  test('la page est réservée aux ADMINS', async ({ page }) => {
    await bouchonnerAuth(page);
    await bouchonner(page, { data: CANDIDATURES, error: null });
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

    expect(await page.evaluate(() => window.__roleDemande),
      'la garde d’authentification ne demande plus le rôle admin').toEqual(['admin']);
  });

  test('sans autorisation, rien ne s’affiche — et rien n’est demandé à la base', async ({ page }) => {
    await bouchonnerAuth(page, null);   // requireAuth rend null : accès refusé
    await bouchonner(page, { data: CANDIDATURES, error: null });
    await page.goto(PAGE, ATTENDRE);
    // ⚠️ On attend un FAIT, pas une durée : que la garde d'authentification ait
    // répondu. Dormir 700 ms marche ici et ment sur une machine plus lente —
    // et l'essai deviendrait vert parce que la page n'a pas EU LE TEMPS de
    // charger, pas parce qu'elle a refusé.
    await expect.poll(() => page.evaluate(() => window.__roleDemande),
      { timeout: 8000 }).not.toBeNull();

    expect(await page.locator('.cand-card').count()).toBe(0);
    expect(await page.evaluate(() => window.__table),
      'la table a été interrogée malgré le refus').toBeNull();
  });

  test('le tableau de bord admin MÈNE à cette page', async ({ page }) => {
    // ⚠️ Sans ce lien, la page n'existe pas : une liste que personne ne sait
    // ouvrir laisse le défaut de P-69 intact — la candidature est lisible, et
    // personne ne la lit. C'est le seul essai de ce fichier qui parle d'une
    // AUTRE page, et c'est celui sans lequel les sept autres ne servent à rien.
    // On lit la page SERVIE, pas le fichier du dépôt : la suite tourne aussi
    // sur `dist-web`, et c'est le build que le visiteur reçoit (P-29).
    const reponse = await page.request.get('/admin-dashboard.html');
    expect(reponse.ok(), 'le tableau de bord admin ne se sert plus').toBe(true);
    expect(await reponse.text(), 'aucun lien vers admin-candidatures.html dans le tableau de bord')
      .toContain('admin-candidatures.html');
  });

  // ─────────────────────────────────────────────────────────────────
  // [17/09/2026] CHANGER UN STATUT — la moitié qui manquait à P-78
  // ─────────────────────────────────────────────────────────────────
  // La liste était en lecture seule : changer un statut est une ÉCRITURE, et la
  // RPC n'existait pas. Elle existe désormais —
  // `public.maj_statut_candidature(p_id, p_statut)`, SECURITY DEFINER,
  // verrouillée par `is_admin()`, rendant la ligne à jour.
  //
  // ⚠️ Ces essais bouchonnent la PASSERELLE, pas `supabase.rpc` : c'est par elle
  // que la page passe. Ils ne prouvent donc PAS que la base accepte — ça, ça se
  // lit en base. Ils prouvent que la page demande la bonne chose, et surtout
  // qu'elle ne bouge l'écran que sur la LIGNE rendue.
  test.describe('changer le statut', () => {

    test('un clic appelle la RPC par la passerelle, avec les bons arguments', async ({ page }) => {
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, {
        defaut: { ok: true, data: { ...CANDIDATURES[0], status: 'contacted' }, erreur: null },
      });
      await page.goto(PAGE, ATTENDRE);
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      await page.locator('.cand-card .act-contacted').click();

      await expect.poll(() => page.evaluate(() => window.__rpc.length), { timeout: 8000 })
        .toBeGreaterThan(0);
      const appel = (await page.evaluate(() => window.__rpc))[0];
      expect(appel.nom).toBe('maj_statut_candidature');
      expect(appel.args.p_id).toBe(CANDIDATURES[0].id);
      expect(appel.args.p_statut).toBe('contacted');
    });

    test('l’écran suit la LIGNE rendue par le serveur', async ({ page }) => {
      // ⚠️ Pas « la requête n'a pas levé » : la ligne. Et c'est la ligne du
      // SERVEUR qui fait foi — `reviewed_at` vient de lui, on ne le devine pas.
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, {
        defaut: {
          ok: true, erreur: null,
          data: { ...CANDIDATURES[0], status: 'approved', reviewed_at: '2026-09-17T10:00:00Z' },
        },
      });
      await page.goto(PAGE, ATTENDRE);
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      await page.locator('.cand-card .act-approved').click();

      // La ligne quitte l'onglet « À vérifier » et le compteur suit.
      await expect(page.locator('.cand-card')).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('.tab[data-st="approved"]')).toContainText('(2)');
      await expect(page.locator('.tab[data-st="pending_verification"]')).toContainText('(0)');

      await page.locator('.tab[data-st="approved"]').click();
      await expect(page.locator('.cand-card')).toHaveCount(2);
      await expect(page.locator('.cand-card').first()).toContainText(/accept/i);
    });

    test('un REFUS du serveur ne change rien à l’écran, et le DIT', async ({ page }) => {
      // Le défaut le plus courant de ce produit : annoncer un succès que
      // personne n'a vérifié (P-68 b, P-83). Ici, un refus laisse la ligne où
      // elle est — et l'admin le lit.
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, { defaut: { ok: false, data: null, erreur: 'not_admin' } });
      await page.goto(PAGE, ATTENDRE);
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      await page.locator('.cand-card .act-approved').click();

      await expect(page.locator('.cand-card .act-msg')).toContainText(/non modifi/i, { timeout: 8000 });
      await expect(page.locator('.cand-card .act-msg')).toContainText('not_admin');
      // La ligne n'a pas bougé d'onglet.
      await expect(page.locator('.cand-card')).toHaveCount(1);
      await expect(page.locator('.tab[data-st="pending_verification"]')).toContainText('(1)');
    });

    test('une réponse VIDE n’est pas un succès', async ({ page }) => {
      // `ok: true` avec `data: null` — déjà vu ici. Sans ce contrôle, l'écran
      // annoncerait un changement qui n'a pas eu lieu.
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, { defaut: { ok: true, data: null, erreur: null } });
      await page.goto(PAGE, ATTENDRE);
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      await page.locator('.cand-card .act-approved').click();
      await expect(page.locator('.cand-card .act-msg')).toContainText(/non modifi/i, { timeout: 8000 });
      await expect(page.locator('.tab[data-st="approved"]')).toContainText('(1)');
    });

    test('deux clics ne font pas deux écritures', async ({ page }) => {
      // Le verrou d'envoi de P-68 b, appliqué avant d'avoir le défaut : la
      // seconde écriture écraserait la première sans que personne le sache.
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, {
        defaut: { ok: true, data: { ...CANDIDATURES[0], status: 'approved' }, erreur: null },
      });
      await page.goto(PAGE, ATTENDRE);
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      // ⚠️ DEUX CLICS SYNCHRONES, dans la page. Passer par `locator.click()` deux
      // fois ne marche pas : après le premier, la ligne change d'onglet et le
      // bouton quitte le DOM — Playwright attend alors trente secondes un
      // élément qui ne reviendra pas. Ce qu'on veut reproduire, c'est le
      // double-clic RAPIDE, avant que la réponse arrive.
      await page.evaluate(() => {
        const b = document.querySelector('.cand-card .act-approved');
        b.click(); b.click();
      });
      await expect.poll(() => page.evaluate(() => window.__rpc.length), { timeout: 8000 })
        .toBeGreaterThan(0);
      await page.waitForTimeout(400);   // laisse une seconde écriture arriver, si elle vient

      expect(await page.evaluate(() => window.__rpc.length),
        'le second clic a déclenché une seconde écriture').toBe(1);
    });

    test('la carte ne propose PAS le statut qu’elle a déjà', async ({ page }) => {
      // Un bouton « Approuver » sur une candidature déjà approuvée est une
      // écriture qui ne change rien : du bruit, et une occasion de se tromper.
      await bouchonnerAuth(page);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, { defaut: { ok: true, data: CANDIDATURES[1], erreur: null } });
      await page.goto(PAGE, ATTENDRE);
      await page.locator('.tab[data-st="approved"]').click();
      await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

      expect(await page.locator('.cand-card .act-approved').count()).toBe(0);
      expect(await page.locator('.cand-card .act-rejected').count()).toBe(1);
    });

    test('sans autorisation, aucun bouton de statut n’est même rendu', async ({ page }) => {
      await bouchonnerAuth(page, null);
      await bouchonner(page, { data: CANDIDATURES, error: null });
      await bouchonnerRpc(page, { defaut: { ok: true, data: CANDIDATURES[0], erreur: null } });
      await page.goto(PAGE, ATTENDRE);
      await expect.poll(() => page.evaluate(() => window.__roleDemande), { timeout: 8000 })
        .not.toBeNull();

      expect(await page.locator('.act').count()).toBe(0);
      expect(await page.evaluate(() => window.__rpc.length),
        'une ecriture a ete tentee malgre le refus').toBe(0);
    });
  });

  test('une candidature piégée ne s’exécute pas', async ({ page }) => {
    // Ces champs viennent d'un formulaire PUBLIC, rempli par n'importe qui.
    // La page est construite en DOM (`textContent`) : il n'y a rien à échapper,
    // donc rien à oublier d'échapper. C'est la leçon de P-73, appliquée avant
    // d'avoir le défaut.
    await bouchonnerAuth(page);
    await bouchonner(page, {
      data: [{ ...CANDIDATURES[0], first_name: '<img src=x onerror="window.__xss=1">', cabinet: '<script>window.__xss=2</script>' }],
      error: null,
    });
    await page.goto(PAGE, ATTENDRE);
    await expect(page.locator('.cand-card')).toHaveCount(1, { timeout: 8000 });

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('.cand-card img').count()).toBe(0);
    await expect(page.locator('.cand-card')).toContainText('img src=x');
  });
});
