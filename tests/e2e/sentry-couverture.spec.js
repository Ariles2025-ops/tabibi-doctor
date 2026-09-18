// =====================================================================
// Trois pages dont les erreurs n'arrivaient nulle part
// =====================================================================
// Sentry EST branché : DSN réel dans `js/config.js`, `js/tabibi-sentry.js`
// inclus sur 27 pages, anonymisation des PII corrigée le 16/09 (P-74).
//
// **Trois pages ne l'incluaient pas** — et pas les moins importantes :
//
//     accueil-public.html        la page la plus visitée
//     patient-ordonnances.html   la page du défaut de modale remonté EN LIVE
//     index.html                 la porte fermée
//
// Une erreur y était invisible. **Un tableau de bord vert parce que personne
// ne regarde la bonne chose, c'est l'incident fondateur de ce dépôt** : le cron
// des rappels a envoyé le mot `TA_CLE` pendant 47 jours en affichant 4 531
// exécutions « succeeded ».
//
// ---------------------------------------------------------------------
// ⚠️ CE QUI EST MESURÉ ICI, ET CE QUI NE PEUT PAS L'ÊTRE
// ---------------------------------------------------------------------
// `_hermetique` coupe le réseau vers les tiers : le SDK Sentry du CDN ne se
// charge **jamais** pendant ces essais, donc `window.Sentry` n'existe pas et
// **aucune erreur ne part**. C'est voulu — un essai qui enverrait des
// événements à Sentry pollurait la production.
//
// Ce qui est vérifié, c'est le **câblage** : `window.tabibiErreur` — le point
// d'entrée unique posé par `js/tabibi-sentry.js` — est défini au chargement, et
// `window.TABIBI_CONFIG.SENTRY_DSN` est lisible AU MOMENT où il s'exécute.
//
// **Ce second point est tout le sujet sur `accueil-public.html`.** Sa
// configuration n'arrive que par le point d'entrée Vite, qui est un
// `<script type="module">` — donc **différé jusqu'après l'analyse du
// document**. Poser `tabibi-sentry.js` seul l'aurait fait tourner AVANT, sur un
// DSN absent : il se serait désactivé **en silence**, et la garde aurait été
// verte sur une page toujours aveugle. D'où le `js/config.js` classique repris
// juste avant lui, et d'où l'essai d'ordre plus bas.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGES = ['/accueil-public.html', '/patient-ordonnances.html', '/index.html'];

const PATIENT = '00000000-0000-4000-8000-000000000001';

async function ouvrir(page, chemin) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  // ⚠️ SESSION PATIENT POSEE MEME SUR LES PAGES PUBLIQUES. Sans elle,
  // `patient-ordonnances.html` redirige vers `login.html` — et
  // `page.evaluate` meurt sur « Execution context was destroyed ». Mesuré :
  // l'essai sortait rouge sans jamais atteindre la page qu'il prétendait juger.
  await page.addInitScript((id) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_cookie_consent',
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'patient', name: 'Essai' }));
      localStorage.setItem('tabibi_role', 'patient');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
  }, PATIENT);
  await page.route('**/auth/v1/user**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }) }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(chemin, ATTENDRE);
  expect(page.url(), `${chemin} : redirigé — la page n’a pas été mesurée`)
    .not.toContain('login.html');
}

test.describe('couverture du monitoring', () => {

  for (const chemin of PAGES) {
    test(`${chemin} — le point de remontée est posé au chargement`, async ({ page }) => {
      await ouvrir(page, chemin);
      // ⚠️ `window.Sentry` ne peut PAS être attendu ici : le CDN est coupé. Ce
      // qui doit exister, c'est le point d'entrée que `tabibi-sentry.js`
      // définit de façon synchrone, avant même de charger le SDK.
      await expect.poll(() => page.evaluate(() => typeof window.tabibiErreur), { timeout: 10000 })
        .toBe('function');
    });

    test(`${chemin} — la configuration porte un DSN actif`, async ({ page }) => {
      // ⚠️ CE QUE CET ESSAI NE PROUVE PAS, ET C'EST MESURÉ. Il lit
      // `TABIBI_CONFIG` une fois la page chargée — donc APRÈS l'exécution du
      // module différé. Contre-épreuve : en retirant la balise `js/config.js`
      // de `accueil-public.html`, il reste VERT, parce que le module a fini par
      // poser la globale. Il ne dit rien de l'ORDRE.
      //
      // Ce qui garde l'ordre, c'est l'essai de balises plus bas — et lui vire
      // rouge sur ce retrait (mesuré). Les deux sont là parce qu'ils ne
      // gardent pas la même chose : celui-ci vérifie que le DSN est réel et pas
      // un gabarit `REPLACE_`, celui-là que le monitoring le verra.
      await ouvrir(page, chemin);
      const dsn = await page.evaluate(() => {
        const c = window.TABIBI_CONFIG || {};
        return { present: !!window.TABIBI_CONFIG, actif: !!c.SENTRY_DSN && !/REPLACE_/.test(c.SENTRY_DSN) };
      });
      expect(dsn.present, `${chemin} : TABIBI_CONFIG absent — le monitoring se désactive en silence`)
        .toBe(true);
      expect(dsn.actif, `${chemin} : DSN vide ou gabarit — Sentry est éteint`).toBe(true);
    });
  }

  test('l’ORDRE des balises : config.js avant tabibi-sentry.js', async ({ page }) => {
    // ⚠️ Un essai de comportement ne distingue pas les deux ordres quand le
    // réseau est coupé : `tabibiErreur` est posé dans les deux cas. L'ordre se
    // vérifie donc sur le document SERVI — il est identique aux sources et au
    // build, puisque ce sont des balises, pas du script minifié.
    for (const chemin of PAGES) {
      const brut = await page.request.get(chemin).then((r) => r.text());
      // ⚠️ ON RETIRE LES COMMENTAIRES HTML AVANT DE CHERCHER. Ma première
      // version lisait le document brut — et le commentaire que je venais
      // d'écrire au-dessus des balises cite `js/tabibi-sentry.js` avant
      // `js/config.js`. La garde sortait ROUGE sur un ordre parfaitement juste,
      // en s'accusant de sa propre documentation. **Treizième fois que ce dépôt
      // rencontre exactement cette faute.**
      const html = brut.replace(/<!--[\s\S]*?-->/g, ' ');
      const iConfig = html.indexOf('js/config.js');
      const iSentry = html.indexOf('js/tabibi-sentry.js');
      expect(iConfig, `${chemin} : plus aucune balise config.js`).toBeGreaterThan(-1);
      expect(iSentry, `${chemin} : le monitoring n’est plus inclus`).toBeGreaterThan(-1);
      expect(iConfig, `${chemin} : tabibi-sentry.js vient AVANT config.js — DSN absent, Sentry éteint`)
        .toBeLessThan(iSentry);
    }
  });

  // ⚠️ L'ESSAI « LES DEUX COPIES DE LA PORTE SONT IDENTIQUES » A DEMENAGE —
  // voir `tests/porte-jumelle-source.test.mjs`.
  //
  // Il vivait ici et comparait les deux fichiers SERVIS. Sur `dist-web`, ça ne
  // veut rien dire : Vite traite `index.html` comme point d'entrée (5 544 o) et
  // n'émet pas `porte/porte-fermee.html` du tout — la copie de la page fermée
  // par-dessus `dist-web/index.html` est faite APRÈS le build, par
  // `scripts/porte.mjs`, et seulement sur `npm run porte:fermee`. L'essai
  // sortait donc rouge sur un dépôt parfaitement sain.
  //
  // **Une assertion sur deux fichiers DU DEPOT appartient à un essai qui lit le
  // dépôt** — leçon de P-108, deuxième application en deux lots.

  test('⚠️ CONTRE-ÉPREUVE — les 27 pages déjà couvertes le sont toujours', async ({ page }) => {
    // Une garde qui ne regarde que les trois pages ajoutées laisserait retirer
    // les autres. On vérifie un échantillon représentatif : un espace patient,
    // un espace pro, un tunnel.
    for (const chemin of ['/mes-rdv.html', '/doctor-dashboard.html', '/reservation.html']) {
      const html = await page.request.get(chemin).then((r) => r.text());
      expect(html, `${chemin} : le monitoring a disparu d’une page qui l’avait`)
        .toContain('js/tabibi-sentry.js');
    }
  });
});
