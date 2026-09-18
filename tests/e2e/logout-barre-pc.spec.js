// =====================================================================
// « Se déconnecter » au MILIEU de l'écran, sur un PC
// =====================================================================
// ⚠️ SIGNALÉ EN LIVE PAR AGHILES. Sur PC, dans l'espace connecté, le bouton
// « Se déconnecter » s'affichait au milieu de la page.
//
// ---------------------------------------------------------------------
// LA MESURE — DEUX PAGES, ET PAS CELLES QU'ON CROIT
// ---------------------------------------------------------------------
// Relevé du 18/09 sur une fenêtre de 1280 px, toutes les pages « espace »
// ouvertes une à une (x, largeur, centre du bouton) :
//
//     patient-profile.html    PAGE   x=106  w=1068  centre = 640   ← le milieu EXACT
//     medecin-profile.html    PAGE   x=614  w=638   centre = 933
//     patient-dashboard.html  BARRE  x=1002 w=36    centre = 1020  ✓
//     doctor-dashboard.html   BARRE  x=1220 w=40    centre = 1240  ✓
//     agenda-cabinet.html     BARRE  x=1220 w=40    centre = 1240  ✓
//     secretaire-dashboard    BARRE  x=1102 w=40    centre = 1122  ✓
//     admin-dashboard.html    BARRE  x=1106 w=36    centre = 1124  ✓
//
// **Les deux pages fautives sont les deux seules qui n'avaient AUCUN bouton de
// déconnexion dans la barre du haut.** Leur `btn-full` de page était donc la
// seule sortie — et un `btn-full` dans un conteneur large, c'est un bouton
// centré au milieu de l'écran. Le skill de design tranche : **sur PC, la
// déconnexion va à DROITE dans la barre supérieure.**
//
// ---------------------------------------------------------------------
// ⚠️ CE QUE CETTE GARDE REFUSE DE LAISSER FAIRE
// ---------------------------------------------------------------------
// Supprimer le bouton de page. Sur téléphone, la barre n'a pas la place d'un
// libellé et ce bouton est la **seule sortie** : le masquer au-delà de 1024 px
// est un choix de bureau, pas une suppression. La contre-épreuve mobile est
// dans ce fichier, et elle est là pour ça.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const U = '00000000-0000-4000-8000-000000000001';
const BUREAU = { width: 1280, height: 900 };
const TELEPHONE = { width: 390, height: 844 };

/** Les pages où la déconnexion doit vivre dans la barre, sur PC. */
const AVEC_BARRE = [
  ['/patient-profile.html', 'patient'],
  ['/medecin-profile.html', 'medecin'],
  ['/patient-dashboard.html', 'patient'],
  ['/doctor-dashboard.html', 'medecin'],
  ['/secretaire-dashboard.html', 'secretaire'],
  ['/admin-dashboard.html', 'admin'],
];

async function session(page, role) {
  await page.addInitScript((ctx) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: ctx.role, name: 'Essai' }));
      localStorage.setItem('tabibi_role', ctx.role);
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: U, role });

  // ⚠️ PLAYWRIGHT ESSAIE LES ROUTES DE LA PLUS RÉCENTE À LA PLUS ANCIENNE.
  // Le fourre-tout se pose EN PREMIER, sinon il avale `users` et toutes les
  // pages admin se croient ouvertes à un patient — mesuré : elles
  // redirigeaient, et mon premier relevé « mesurait » patient-dashboard cinq
  // fois de suite sans que rien ne le dise.
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: U, email: 'p@example.test' }) }));
  await page.route('**/rest/v1/users*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: U, email: 'p@example.test', role, status: 'active', is_super_admin: true }) }));
  await page.route('**/rest/v1/rpc/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
}

/** Tout ce qui, sur l'écran RENDU, propose de se déconnecter. */
const sorties = (page) => page.evaluate(() => {
  const vue = window.innerWidth;
  const tout = [...document.querySelectorAll('button, a')].filter((b) => {
    const t = `${b.textContent || ''} ${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`;
    return /d[ée]connex|se d[ée]connecter|logout/i.test(t);
  }).map((b) => {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return {
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
      dansBarre: !!b.closest('header.app-bar'),
      // ⚠️ LES DEUX RAILS PRO S'APPELLENT AUTREMENT. `agenda-cabinet` a sa nav
      // en dur (`.ag-sidebar`) ; les autres pages reçoivent celle de
      // `js/tabibi-pro-sidebar.js` (`.tbi-pro-sidebar`). Ma première version
      // n'en connaissait qu'une : elle accusait `medecin-profile` d'un bouton
      // égaré qui était, en fait, l'entrée de son rail de gauche.
      dansRail: !!b.closest('nav.ag-sidebar, nav.tbi-pro-sidebar, aside'),
      centre: Math.round(r.x + r.width / 2),
      texte: (b.textContent || '').trim().slice(0, 30),
    };
  });
  return { vue, tout: tout.filter((b) => b.visible) };
});

async function ouvrir(page, chemin, role, taille) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await session(page, role);
  await page.setViewportSize(taille);
  await page.goto(chemin, ATTENDRE);
  expect(page.url(), `${chemin} : redirigé, la session n’a pas pris`).not.toContain('login.html');
  await page.waitForTimeout(600);   // l'en-tête partagé se rend après le DOM
}

test.describe('déconnexion : à droite dans la barre, jamais au milieu', () => {

  for (const [chemin, role] of AVEC_BARRE) {
    test(`${chemin} — sur PC, la sortie est dans la barre et à droite`, async ({ page }) => {
      await ouvrir(page, chemin, role, BUREAU);
      const { vue, tout } = await sorties(page);

      const barre = tout.filter((b) => b.dansBarre);
      expect(barre.length, `${chemin} : aucune déconnexion dans la barre du haut`)
        .toBeGreaterThan(0);
      for (const b of barre) {
        expect(b.centre, `${chemin} : la sortie de barre est à ${b.centre} px sur ${vue} — pas à droite`)
          .toBeGreaterThan(vue * 0.66);
      }

      // ⚠️ LE SYMPTÔME REMONTÉ — et la règle est plus large que « au milieu ».
      // Ma première version ne refusait qu'un bouton à moins de 20 % du centre :
      // elle attrapait `patient-profile` (centre 640) et **laissait passer**
      // `medecin-profile` (centre 933). Une garde calibrée sur un seul relevé
      // ne garde qu'un seul cas. Sur PC, la sortie est DANS LA BARRE : aucun
      // bouton de déconnexion visible dans le corps de page, où qu'il soit.
      //
      // Le rail de gauche des postes pro (x ≈ 12) est toléré : c'est une
      // navigation latérale, pas un bouton égaré au milieu d'un formulaire.
      const enPage = tout.filter((b) => !b.dansBarre && !b.dansRail);
      expect(enPage.map((b) => `${b.texte} @${b.centre}/${vue}`).join(' | '),
        `${chemin} : une déconnexion traîne dans le corps de la page sur PC`).toBe('');
    });
  }

  test('⚠️ CONTRE-ÉPREUVE — sur téléphone, la sortie de page reste', async ({ page }) => {
    // Masquer un bouton au-delà de 1024 px est un choix de bureau. Le
    // supprimer couperait la SEULE sortie du téléphone, où la barre n'a pas la
    // place d'un libellé. Cette garde-ci est ce qui interdit le raccourci.
    for (const chemin of ['/patient-profile.html', '/medecin-profile.html']) {
      await ouvrir(page, chemin, chemin.includes('medecin') ? 'medecin' : 'patient', TELEPHONE);
      const { tout } = await sorties(page);
      const enPage = tout.filter((b) => !b.dansBarre && /d[ée]connecter/i.test(b.texte));
      expect(enPage.length, `${chemin} : plus aucune sortie sur téléphone`).toBeGreaterThan(0);
    }
  });

  test('le bouton de barre appelle bien `logout()` — mesuré, pas lu', async ({ page }) => {
    // ⚠️ Une garde qui ne compte que les boutons laisserait poser un bouton
    // MUET à droite : le défaut visuel disparaît, la sortie aussi.
    await ouvrir(page, '/patient-profile.html', 'patient', BUREAU);
    await page.evaluate(() => { window.__sorti = 0; window.logout = () => { window.__sorti += 1; }; });
    await page.locator('header.app-bar button[aria-label="Se déconnecter"]').first().click();
    expect(await page.evaluate(() => window.__sorti),
      'le bouton de barre ne déclenche aucune déconnexion').toBe(1);
  });

  test('admin-cabinet : le cap EN LIGNE ne défait plus `page-large`', async ({ page }) => {
    // ⚠️ MESURÉ À 960 px SUR UNE FENÊTRE DE 1280. La page se déclarait
    // `page page-large` — et posait `max-width:960px` dans son attribut
    // `style`, qui bat toute feuille. **Une classe qui dit « large » et un
    // style en ligne qui dit « 960 » : c'est le style en ligne qui gagne, en
    // silence.**
    await ouvrir(page, '/admin-cabinet.html', 'admin', BUREAU);
    const l = await page.evaluate(() => {
      const e = document.querySelector('main.page');
      return e ? Math.round(e.getBoundingClientRect().width) : null;
    });
    expect(l, `admin-cabinet : ${l} px sur un écran de 1280 — toujours plafonnée`)
      .toBeGreaterThan(1000);
  });

  test('⚠️ `agenda-cabinet` reste à 732 px, ET C’EST VOULU', async ({ page }) => {
    // Cette page est un POSTE DE TRAVAIL à trois colonnes : rail fixe de
    // 224 px à gauche, panneau fixe de 324 px à droite, agenda au centre.
    // 1280 − 224 − 324 − marges = ~732. **Une garde qui exigerait 1000 px
    // partout ferait « corriger » une mise en page juste** — c'est exactement
    // la faute que ce dépôt documente depuis P-82. On l'écrit donc ici.
    await ouvrir(page, '/agenda-cabinet.html', 'secretaire', BUREAU);
    const cotes = await page.evaluate(() => ({
      rail: document.querySelector('.ag-sidebar')
        ? Math.round(document.querySelector('.ag-sidebar').getBoundingClientRect().width) : 0,
      panneau: document.querySelector('.ag-panel')
        ? Math.round(document.querySelector('.ag-panel').getBoundingClientRect().width) : 0,
    }));
    expect(cotes.rail, 'le rail de gauche a disparu : la mise en page à trois colonnes n’est plus')
      .toBeGreaterThan(150);
    expect(cotes.panneau, 'le panneau de droite a disparu').toBeGreaterThan(200);
  });
});
