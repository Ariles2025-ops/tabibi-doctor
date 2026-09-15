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
//   1. le drapeau OUVERT se comporte comme ouvert : l'ecran « bientot
//      disponible » a disparu, et la vraie coquille repond correctement a un
//      lien sans session ;
//   2. la CSP et la Permissions-Policy autorisent l'iframe — mesure du 14/09 :
//      elles ne contenaient AUCUNE mention de daily.co, et l'appel aurait
//      echoue sans que le fournisseur y soit pour quoi que ce soit ;
//   3. le contrat d'appel de `create-video-room` est celui que la page
//      utilise ;
//   4. **la cle du fournisseur ne figure nulle part dans le front.**
//
// Le point 4 est le seul qui serait grave s'il lachait : une cle Daily dans
// une page publique ouvre la creation de salles sur tout le compte.
//
// ---------------------------------------------------------------------
// [14/09, nuit] LE DRAPEAU EST PASSE A `true` (PR #123)
// ---------------------------------------------------------------------
// Ce fichier verifiait l'etat FERME. Il verifie maintenant l'etat OUVERT —
// **sans perdre de couverture** : chaque assertion « c'est ferme » est
// remplacee par une assertion sur le comportement reel une fois ouvert, pas
// supprimee. Un test qu'on vide pour faire passer la CI est pire qu'un test
// rouge : il reste vert quoi qu'il arrive.
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
test.describe('le drapeau video est OUVERT, et se comporte comme tel', () => {

  // La page redirige vers /login.html des qu'un lien porte une session sans
  // compte connecte. On sert une page de substitution pour pouvoir observer la
  // redirection sans dependre du vrai ecran de connexion.
  const bouchonLogin = (page) => page.route('**/login.html*', (route) => route.fulfill({
    status: 200, contentType: 'text/html', body: '<html><body data-faux-login>login</body></html>',
  }));

  test('video est OUVERT — et n a ouvert aucun autre drapeau', async ({ page }) => {
    await bouchonLogin(page);
    await page.goto('/teleconsultation.html', ATTENDRE);
    const drapeaux = await page.evaluate(() => window.TABIBI_FEATURES);
    expect(drapeaux.video, '`video` devrait etre ouvert depuis la PR #123').toBe(true);
    // Ouvrir un drapeau ne doit jamais en ouvrir un autre par inadvertance.
    //
    // [15/09, integration] `reviews` SORT de cette liste : il a ete ouvert
    // depuis, par son propre lot (court-circuit retire, drapeau enfin lu par le
    // module). Le laisser ici ferait echouer le lot VIDEO pour une raison qui
    // n'a rien a voir avec la video. Son etat est garde par
    // `avis-patients.spec.js`, qui sait pourquoi il est ouvert.
    expect(drapeaux.payments, 'payments ne s ouvre pas avec la video').toBe(false);
    expect(drapeaux.messaging, 'messaging ne s ouvre pas avec la video').toBe(false);
  });

  test("L ECRAN « bientot disponible » A DISPARU — c est la seule chose qu'on voit changer", async ({ page }) => {
    // C'est la consequence observable du drapeau, et la raison d'etre de la PR.
    // Tant qu'il etait ferme, `.tc-shell` etait remplace en entier par une carte
    // « Teleconsultation bientot disponible ».
    await bouchonLogin(page);
    await page.goto('/teleconsultation.html', ATTENDRE);
    await page.waitForTimeout(500);

    const texte = await page.locator('body').innerText();
    expect(texte, "l'ecran coming-soon s'affiche encore").not.toContain('bientot disponible');
    expect(texte).not.toContain('bientôt disponible');
    // Et la vraie coquille est bien la, pas une page vide.
    await expect(page.locator('.tc-shell')).toHaveCount(1);
  });

  test('SANS session_id : « Lien invalide », pas un ecran blanc ni un coming-soon', async ({ page }) => {
    // `parseSessionId()` rend null -> `showError('Lien invalide. …')`. C'est le
    // chemin qu'un visiteur prend s'il ouvre la page a la main.
    await bouchonLogin(page);
    await page.goto('/teleconsultation.html', ATTENDRE);
    await page.waitForTimeout(500);

    await expect(page.locator('#tc-error')).toBeVisible();
    await expect(page.locator('#tc-error-msg')).toContainText('Lien invalide');
    await expect(page.locator('#tc-error')).toContainText(/Impossible de d[eé]marrer la consultation/);
    // Les autres ecrans restent caches : on ne montre pas une salle d'attente
    // pour une consultation qui n'existe pas.
    for (const id of ['#tc-prejoin', '#tc-incall', '#tc-ended']) {
      await expect(page.locator(id)).toBeHidden();
    }
  });

  test('AVEC un session_id valide mais SANS compte : redirection vers la connexion', async ({ page }) => {
    // `requireAuth()` n'est atteinte qu'avec un identifiant bien forme. Elle
    // redirige en conservant l'URL de retour — sinon le patient perdrait son
    // lien de consultation en se connectant.
    await bouchonLogin(page);
    const sid = '11111111-2222-3333-4444-555555555555';
    await page.goto(`/teleconsultation.html?session_id=${sid}`, ATTENDRE);
    await page.waitForURL(/\/login\.html\?redirect=/, { timeout: 8000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/login.html');
    const retour = decodeURIComponent(url.searchParams.get('redirect') || '');
    expect(retour, "le lien de consultation doit survivre a la connexion").toContain('teleconsultation.html');
    expect(retour).toContain(sid);
  });

  test('LA SORTIE ANTICIPEE RESTE DANS LE CODE — le drapeau doit savoir se refermer', async ({ page }) => {
    // Le drapeau est ouvert ; la branche « bientot disponible » n'est donc plus
    // empruntee. La tentation est de la supprimer comme du code mort.
    // **Un drapeau qui ne sait plus se refermer n'est pas un drapeau** : si le
    // fournisseur tombe, on doit pouvoir repasser a false et retrouver un ecran
    // honnete au lieu d'une page qui echoue.
    const src = await page.request.get('/teleconsultation.html').then((r) => r.text());
    expect(src).toContain('TABIBI_FEATURES.video === false');
    expect(src, 'la carte coming-soon doit rester joignable').toMatch(/bient[oô]t disponible/i);
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
    //
    // [14/09, nuit] ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER. Ce test a
    // rougi sur un COMMENTAIRE de `tabibi-features.js` qui explique que
    // `DAILY_API_KEY` ne quitte jamais l'edge function — c'est-a-dire sur une
    // phrase qui dit exactement ce que le test veut garantir. Un test qui
    // interdit de NOMMER le risque pousse a ne plus l'ecrire nulle part.
    // Ce qu'on protege, c'est une VALEUR servie au navigateur, pas un mot.
    const sansCommentaires = (src) => src
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    for (const chemin of ['/teleconsultation.html', '/js/config.js', '/js/tabibi-features.js']) {
      const brut = await page.request.get(chemin).then((r) => r.text());
      const src = sansCommentaires(brut);
      expect(src, `${chemin} appelle api.daily.co depuis le navigateur`).not.toContain('api.daily.co');
      expect(src, `${chemin} contient DAILY_API_KEY hors commentaire`).not.toContain('DAILY_API_KEY');
      // Et la vraie chose a interdire : une valeur qui A LA FORME d'une cle
      // Daily (32 hexadecimaux ou plus). Le nom d'une variable ne fuit rien ;
      // une chaine de cette forme, si.
      const suspects = (src.match(/['"`][0-9a-f]{32,}['"`]/gi) || [])
        .filter((v) => !/^['"`]0+['"`]$/.test(v));
      expect(suspects, `${chemin} contient une chaine en forme de cle : ${suspects.join(', ')}`)
        .toEqual([]);
    }
  });
});
