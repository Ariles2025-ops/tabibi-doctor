// =====================================================================
// « Contacter par e-mail » ouvrait un mail sans destinataire
// =====================================================================
// ⚠️ `doctor-dashboard.html` posait `window.location.href = 'mailto:?subject=…'`
// — champ « À » **vide**. Le commentaire d'origine disait « le médecin
// complétera le destinataire ». Il ne le peut pas : il n'a pas l'adresse, et
// l'application non plus.
//
// ---------------------------------------------------------------------
// LA MESURE QUI TRANCHE — lue en base le 18/09
// ---------------------------------------------------------------------
// `doctor_patients_directory` est la **seule** source de patients accessible à
// un médecin (la RLS de `public.users` ne lui montre que sa propre ligne, cf.
// le commentaire l.668). Elle expose exactement :
//
//     id · first_name · last_name · phone
//
// **Pas d'e-mail.** Ce n'est pas « pas encore chargé » : ce n'est **pas
// exposé**. Un bouton qui ne peut pas aboutir, quelle que soit la donnée.
//
// ---------------------------------------------------------------------
// LA FORME DU CORRECTIF EXISTAIT DÉJÀ DANS LE FICHIER
// ---------------------------------------------------------------------
// Le bouton « Appeler » est rendu **conditionnellement** sur `r.patientPhone`.
// Le bouton « Email » suit désormais la même règle sur `r.patientEmail` —
// aujourd'hui toujours absent, donc masqué. Le jour où la vue exposera
// l'adresse, il revient **sans qu'on retouche le code**.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '00000000-0000-4000-8000-00000000000d';

/**
 * Un rendez-vous tel que le tableau de bord le range en local.
 *
 * ⚠️ LA DATE EST CELLE DU JOUR, DANS LE FUSEAU DU CABINET. `renderToday()`
 * filtre sur `r.date === window.tabibiTemps.aujourdhui()` : une date « dans
 * deux jours » ne s'affiche nulle part, et mon premier essai cherchait un
 * bouton dans une liste vide — rouge avec ou sans le correctif.
 * On lit l'horloge du cabinet, pas celle du navigateur (leçon des fuseaux,
 * `js/tabibi-temps.js`).
 */
function rdv(surcharge) {
  return {
    id: 'rdv-001', sbId: 'rdv-001', _sb: true,
    date: '__AUJOURDHUI__', time: '09:30', slot: '09:30',
    patientName: 'Amine Test', patientPhone: '+213555112233',
    motif: 'Consultation', status: 'pending', urgent: false, duree: 30,
    ...surcharge,
  };
}

async function ouvrir(page, rdvs) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  // La date du cabinet (Africa/Algiers), résolue DANS la page — pas ici.
  await page.addInitScript((ctx) => {
    const jour = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    ctx.rdvs = ctx.rdvs.map((r) => (r.date === '__AUJOURDHUI__' ? { ...r, date: jour } : r));
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id: ctx.id, role: 'medecin', name: 'Dr Essai' }));
      localStorage.setItem('tabibi_role', 'medecin');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id: ctx.id, email: 'd@example.test' },
      }));
      // La liste des RDV est lue depuis le cache local par `getDocRdvs()`.
      localStorage.setItem('tabibi_doc_rdv', JSON.stringify(ctx.rdvs));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, { id: MEDECIN, rdvs });

  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test' }),
  }));
  await page.route('**/rest/v1/users*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: MEDECIN, email: 'd@example.test', role: 'medecin', status: 'active' }),
  }));
  // ⚠️ Les RDV distants écraseraient le cache : on rend une liste vide pour que
  // l'essai mesure exactement les rendez-vous qu'il a posés.
  await page.route('**/rest/v1/appointments*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/doctor-dashboard.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');
}

/** Tout ce qui, dans la page, mène à un `mailto:`. */
const liensMailto = (page) => page.evaluate(() => {
  const trouves = [];
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => trouves.push(a.getAttribute('href')));
  document.querySelectorAll('[onclick]').forEach((el) => {
    const h = el.getAttribute('onclick') || '';
    if (h.includes('mailto:')) trouves.push(h);
  });
  return trouves;
});

test.describe('tableau de bord médecin — aucun mail sans destinataire', () => {

  test('AUCUN lien `mailto:` sans destinataire dans la page', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE. On accepte un `mailto:` — mais jamais un
    // `mailto:` suivi de rien ou d'un `?`.
    await ouvrir(page, [rdv()]);
    await page.waitForFunction(() => !!document.querySelector('body'));

    for (const lien of await liensMailto(page)) {
      expect(lien, `mailto sans destinataire : ${lien}`).not.toMatch(/mailto:\s*(?:['"]|\?|$)/);
    }
  });

  test('le bouton « Email » est MASQUÉ tant que l’adresse n’existe pas', async ({ page }) => {
    // Aujourd'hui, `doctor_patients_directory` n'expose pas d'e-mail : le
    // bouton ne doit jamais apparaître.
    await ouvrir(page, [rdv()]);
    await expect(page.locator('text=Amine Test').first()).toBeVisible({ timeout: 10000 });

    expect(await page.locator('[onclick^="contactPatientByEmail"]').count(),
      'le bouton « Email » s’affiche sans adresse de patient').toBe(0);
  });

  test('… mais « Appeler » reste là — on n’a pas coupé ce qui marche', async ({ page }) => {
    // ⚠️ Le téléphone, LUI, est exposé par la vue. C'est la moitié qu'un
    // « masquons les boutons de contact » aurait emportée.
    await ouvrir(page, [rdv()]);
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('AVEC une adresse, le bouton revient et le mail est adressé', async ({ page }) => {
    // ⚠️ LA CONTRE-ÉPREUVE DU MASQUAGE. Une garde qui ne vérifie que l'absence
    // fait supprimer la fonction. Le jour où la vue exposera l'e-mail, le
    // bouton doit revenir sans qu'on retouche le code.
    await ouvrir(page, [rdv({ patientEmail: 'amine@example.test' })]);
    const bouton = page.locator('[onclick^="contactPatientByEmail"]');
    await expect(bouton).toBeVisible({ timeout: 10000 });

    // ⚠️ CE QUE CET ESSAI NE PEUT PAS FAIRE, ET JE LE DIS PLUTOT QUE DE LE
    // SIMULER : `mailto:` ne produit aucune requete reseau, et `location.href`
    // n'est pas redefinissable (« Cannot redefine property: href » — mesure).
    // Il n'y a donc aucun moyen honnete d'observer la navigation depuis la
    // page. Ce qui est verifie ici : le bouton REVIENT des que l'adresse
    // existe. Le fait que l'adresse parte bien dans le `mailto:` est verifie a
    // la SOURCE, par l'essai suivant. Deux moities, deux essais — plutot qu'un
    // seul qui pretendrait mesurer ce qu'il ne voit pas.
    expect(await bouton.getAttribute('onclick')).toContain('contactPatientByEmail');
  });

  test('la source ne contient plus de `mailto:` sans destinataire', async ({ page }) => {
    // ⚠️ Contre-épreuve de source : le défaut était une chaîne écrite en dur.
    // Elle pourrait revenir dans une fonction qu'aucun essai ne clique.
    const src = await page.request.get('/doctor-dashboard.html').then((r) => r.text());
    const nu = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    expect(nu, 'un `mailto:` sans destinataire est revenu dans la source')
      .not.toMatch(/mailto:\?/);
    expect(nu, "le `mailto:` construit n'adresse plus personne")
      .toMatch(/mailto:'\s*\+\s*encodeURIComponent\(/);
  });
});
