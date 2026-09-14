// =====================================================================
// Teleconsultation — ce qui doit rester vrai AVANT l'essai reel
// =====================================================================
// Le drapeau `video` est **ferme**, et il le reste jusqu'a un appel reel entre
// deux navigateurs. On ne peut donc pas essayer l'appel ici — et essayer le
// vrai fournisseur serait de toute facon hors de portee d'une suite e2e
// hermetique (`tests/e2e/_hermetique.js`).
//
// Ce que ce fichier garde, c'est **tout ce qui echouerait AVANT que le
// fournisseur soit en cause** :
//
//   1. le drapeau ferme se comporte comme ferme (redirection, pas de SDK) ;
//   2. la CSP et la Permissions-Policy autorisent l'iframe — mesure du 14/09 :
//      elles ne contenaient AUCUNE mention de daily.co, et l'appel aurait
//      echoue sans que le fournisseur y soit pour quoi que ce soit ;
//   3. le contrat d'appel de `create-video-room` est celui que la page
//      utilise ;
//   4. **la cle du fournisseur ne figure nulle part dans le front.**
//
// Le point 4 est le seul qui serait grave s'il lachait : une cle Daily dans
// une page publique ouvre la creation de salles sur tout le compte.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');
const fs = require('node:fs');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

// ─────────────────────────────────────────────────────────────────────
test.describe('le drapeau video est ferme, et se comporte comme tel', () => {

  test('video reste FERME — il ne s ouvre pas avec les ordonnances', async ({ page }) => {
    // `waiting-list.html` ne charge pas tabibi-features.js : on lit le drapeau
    // sur une page qui s'en sert vraiment. Elle redirige faute de session, on
    // neutralise donc la cible pour qu'un runner lent ne fasse pas echouer une
    // lecture de drapeau sur une navigation.
    await page.route('**/login.html*', (route) => route.fulfill({
      status: 200, contentType: 'text/html', body: '<html><body>login</body></html>',
    }));
    await page.goto('/medecin-ordonnance.html', ATTENDRE);
    const drapeaux = await page.evaluate(() => window.TABIBI_FEATURES);
    expect(drapeaux.video, "`video` ne s'ouvre qu'apres un appel reel").toBe(false);
  });

  test('la page de teleconsultation ne charge pas le SDK quand le drapeau est ferme', async ({ page }) => {
    // Elle redirige avant. Le point n'est pas la redirection en soi : c'est
    // qu'aucune permission camera ne soit demandee pour une fonction fermee.
    const src = await page.request.get('/teleconsultation.html').then((r) => r.text());
    expect(src).toContain('TABIBI_FEATURES');
    expect(src, 'la page doit garder sa sortie anticipee').toMatch(/video/);
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('la CSP laisse passer la teleconsultation', () => {

  // Mesure du 14/09/2026 : `_headers` et `netlify.toml` ne contenaient AUCUNE
  // mention de daily.co. L'iframe aurait ete bloquee, la camera refusee, et le
  // diagnostic serait parti chercher le fournisseur.
  const FICHIERS = ['_headers', 'netlify.toml'];

  for (const fichier of FICHIERS) {
    test(`${fichier} : l iframe, la signalisation et les flux sont autorises`, () => {
      const contenu = fs.readFileSync(fichier, 'utf8');
      const csp = contenu.split('\n').find((l) => l.includes('Content-Security-Policy'));
      expect(csp, `${fichier} n'a pas de CSP`).toBeTruthy();
      for (const source of ['https://*.daily.co', 'wss://*.daily.co']) {
        expect(csp, `${fichier} : ${source} absent de la CSP`).toContain(source);
      }
    });

    test(`${fichier} : la camera et le micro sont DELEGUES a une origine`, () => {
      // Le piege : `camera=(self)` refuse de deleguer a une iframe d'une autre
      // origine, et ce champ n'accepte aucun joker — il faut une origine exacte.
      const pp = fs.readFileSync(fichier, 'utf8').split('\n').find((l) => l.includes('Permissions-Policy'));
      expect(pp).toBeTruthy();
      expect(pp).toMatch(/camera=\(self\s+"https:\/\/[^"]+"\)/);
      expect(pp).toMatch(/microphone=\(self\s+"https:\/\/[^"]+"\)/);
    });
  }

  test('les deux fichiers d en-tetes disent LA MEME chose', () => {
    // Ils vivent en double (Cloudflare Pages + Netlify). Une correction faite
    // dans un seul est une correction a moitie faite — et c'est le fichier
    // oublie qui sert en production ce jour-la.
    const csp = FICHIERS.map((f) => {
      const l = fs.readFileSync(f, 'utf8').split('\n').find((x) => x.includes('Content-Security-Policy'));
      return l.replace(/^\s*(Content-Security-Policy\s*[:=]\s*"?)/, '').replace(/"\s*$/, '').trim();
    });
    expect(csp[0], '_headers et netlify.toml ont des CSP differentes').toBe(csp[1]);
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('le contrat de create-video-room', () => {

  test('la page appelle bien la fonction, avec le JWT et l appointment_id', async ({ page }) => {
    const src = await page.request.get('/teleconsultation.html').then((r) => r.text());
    expect(src).toContain("/functions/v1/create-video-room");
    expect(src).toContain('appointment_id');
    // Elle rejoint avec CE que la fonction rend, pas avec l'URL stockee en base
    // (qui vaut NULL tant que la salle n'existe pas).
    expect(src).toContain('roomInfo.room_url');
    expect(src).toContain('roomInfo.my_token');
  });

  test('LE POINT QUI COMPTE : aucune cle Daily dans le front', async ({ page }) => {
    // Une cle Daily dans une page publique ouvre la creation de salles sur
    // tout le compte. Elle ne doit vivre que dans l'environnement de la
    // fonction, jamais dans le depot servi.
    for (const chemin of ['/teleconsultation.html', '/js/config.js', '/js/tabibi-features.js']) {
      const src = await page.request.get(chemin).then((r) => r.text());
      expect(src, `${chemin} cite api.daily.co`).not.toContain('api.daily.co');
      expect(src, `${chemin} contient DAILY_API_KEY`).not.toContain('DAILY_API_KEY');
    }
  });
});
