// =====================================================================
// La suite e2e ne sort pas de localhost — et ce fichier le PROUVE
// =====================================================================
// [14/09/2026] Une porte qui ne se declenche pas est pire que pas de porte.
// `tests/e2e/_hermetique.js` coupe le reseau externe ; ce fichier verifie que la
// coupure tient, sur les pages qui chargent le plus de tiers.
//
// Pourquoi ca merite un test a soi : l'echec de CI du 14/09 etait INVISIBLE en
// local, parce que les CDN y repondent vite. **Une dependance reseau ne se voit
// pas quand le reseau va bien.** Ce test la rend visible tout le temps : il ne
// regarde pas si les requetes sont lentes, il regarde si elles SORTENT.
//
// LA MESURE : `response.serverAddr()` rend l'adresse du serveur reellement
// joint. Une reponse fabriquee par `route.fulfill()` n'en a pas — elle vaut
// `null`. C'est donc la preuve directe qu'aucun paquet n'est parti.
//
// A CASSER VOLONTAIREMENT si un jour un test DOIT joindre un tiers. Ce sera
// alors une decision, pas un oubli.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE, INTERNE } = require('./_hermetique');

const estExterne = (u) => !INTERNE.test(u) && !u.startsWith('data:') && !u.startsWith('blob:');

// Les pages qui chargent le plus d'exterieur : Sentry partout, Turnstile sur
// l'authentification, le client Supabase sur les pages qui l'utilisent.
const PAGES = [
  'accueil-public.html',
  'login.html',
  'signup.html',
  'forgot-password.html',
  'waiting-list.html',
];

for (const chemin of PAGES) {
  test(`${chemin} : aucune requete n'atteint le reseau`, async ({ page }) => {
    await hermetiser(page);
    await neutraliserCaptcha(page);

    const joints = [];   // requetes externes ayant VRAIMENT touche un serveur
    const echecs = [];   // requetes externes en echec (le filet aurait fui)

    page.on('response', async (r) => {
      const u = r.url();
      if (!estExterne(u)) return;
      try {
        const adresse = await r.serverAddr();
        if (adresse) joints.push(`${new URL(u).host} -> ${adresse.ipAddress}`);
      } catch (e) { /* reponse deja liberee : rien a prouver ici */ }
    });
    page.on('requestfailed', (r) => { if (estExterne(r.url())) echecs.push(r.url()); });

    await page.goto(`/${chemin}`, ATTENDRE);
    await page.waitForTimeout(1200);   // laisse partir les chargements differes

    expect(joints, `des requetes ont atteint le reseau : ${joints.join(' | ')}`)
      .toHaveLength(0);
    expect(echecs, `des requetes externes ont echoue — le filet a fui : ${echecs.join(' | ')}`)
      .toHaveLength(0);
  });
}

test('le filet intercepte vraiment quelque chose', async ({ page }) => {
  const { refuses } = await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.goto('/waiting-list.html', ATTENDRE);
  await page.waitForTimeout(1200);

  // Cette page charge Sentry depuis un CDN, Turnstile depuis Cloudflare, et
  // appelle Supabase. Si `refuses` etait vide, le filet ne protegerait rien —
  // et les tests ci-dessus passeraient pour une mauvaise raison.
  expect(refuses.length, "le filet n'a intercepte aucune requete externe : il ne protege rien")
    .toBeGreaterThan(0);

  // Et il ne coupe pas le site lui-meme.
  for (const h of refuses) expect(h).not.toMatch(/^(localhost|127\.0\.0\.1)/);
});
