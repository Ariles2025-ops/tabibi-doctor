// =====================================================================
// Les avis patients — le parcours, et le drapeau qui le commande VRAIMENT
// =====================================================================
// [14/09/2026, nuit] Deux choses fermaient les avis, et une seule etait visible.
//
//   1. `TABIBI_FEATURES.reviews = false` — **lu par personne.** Zero occurrence
//      dans tout le produit hors la ligne qui le declare. Un drapeau que rien
//      ne lit ne ferme rien ; il donne l'impression qu'une fonction est
//      desactivee.
//   2. un `return []` INCONDITIONNEL au milieu de
//      `getMyReviewableAppointments()` — **le vrai verrou**, invisible depuis
//      le fichier des drapeaux. Qui aurait ouvert le drapeau n'aurait toujours
//      rien vu, et aurait cherche le defaut ailleurs.
//
// Le court-circuit est retire ET le drapeau est rendu lisible, dans le meme
// geste. **Sinon on echangeait un verrou invisible contre rien du tout.**
//
// Ce fichier eprouve le parcours cote front, PostgREST bouchonne : la suite est
// hermetique (tests/e2e/_hermetique.js), aucune ligne n'est ecrite en base. Il
// prouve ce que le navigateur fait de chaque reponse — pas que la base accepte,
// ce qui se verifie avec un vrai compte et reste a faire.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const MEDECIN = '11111111-2222-3333-4444-555555555555';

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

/**
 * Charge le module d'avis dans une page neutre, avec un `sb` bouchonne.
 * On teste le MODULE — c'est lui qui portait le court-circuit — sans dependre
 * d'un ecran qui redirige faute de session.
 */
async function chargerModule(page, { drapeau = true, reponses = {} } = {}) {
  // `about.html` : page statique, aucune redirection, aucun drapeau charge —
  // on pose donc nous-memes l'environnement dont le module a besoin.
  await page.goto('/about.html', ATTENDRE);
  return page.evaluate(async ({ drapeau, reponses, MEDECIN }) => {
    // Faux client Supabase : il enregistre ce qu'on lui demande.
    const appels = [];
    const resultat = (cle) => reponses[cle] ?? { data: null, error: null };
    const table = (nom) => {
      appels.push('from:' + nom);
      const chaine = {
        select: () => chaine, eq: () => chaine, in: () => chaine, order: () => chaine,
        range: () => Promise.resolve(resultat('select:' + nom)),
        maybeSingle: () => Promise.resolve(resultat('select:' + nom)),
        single: () => Promise.resolve(resultat('insert:' + nom)),
        insert: (p) => { appels.push('insert:' + nom); chaine._payload = p; return chaine; },
        update: () => chaine,
        then: (r) => Promise.resolve(resultat('select:' + nom)).then(r),
      };
      return chaine;
    };
    window.tabibi = window.tabibi || {};
    window.tabibi.supabase = {
      from: table,
      rpc: (nom) => { appels.push('rpc:' + nom); return Promise.resolve(resultat('rpc:' + nom)); },
    };
    window.tabibi.auth = { getSession: async () => ({ user: { id: 'patient-1' } }) };
    // Le drapeau, avant le chargement du module.
    window.TABIBI_FEATURES = Object.freeze({ reviews: drapeau });

    await new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = '/js/tabibi-reviews.js';
      s.onload = ok; s.onerror = () => ko(new Error('module introuvable'));
      document.head.appendChild(s);
    });
    window.__appels = appels;
    return { charge: typeof window.tabibi.reviews === 'object' };
  }, { drapeau, reponses, MEDECIN });
}

// ─────────────────────────────────────────────────────────────────────
test.describe('avis patients — le court-circuit est bien parti', () => {

  test('LE VERROU CACHE A DISPARU : la liste des RDV a noter interroge la base', async ({ page }) => {
    // C'est LE test de ce lot. Avant, cette fonction rendait [] quoi qu'il
    // arrive, sans jamais toucher la base.
    await chargerModule(page, {
      drapeau: true,
      reponses: { 'select:my_reviewable_appointments': { data: [{ id: 'rdv-1', doctor_name: 'Dr Ali' }], error: null } },
    });
    const r = await page.evaluate(async () => {
      const liste = await window.tabibi.reviews.getMyReviewableAppointments();
      return { liste, appels: window.__appels };
    });
    expect(r.appels, "la vue n'a pas ete interrogee — le court-circuit est encore la")
      .toContain('from:my_reviewable_appointments');
    expect(r.liste).toHaveLength(1);
  });

  test('la source ne contient plus de `return []` inconditionnel', async ({ page }) => {
    const src = await page.request.get('/js/tabibi-reviews.js').then((r) => r.text());
    const bloc = src.slice(src.indexOf('getMyReviewableAppointments'));
    const corps = bloc.slice(0, bloc.indexOf('async getMyReviews'));
    // Un `return []` subsiste, mais GARDE par le drapeau : c'est la difference
    // entre un verrou qu'on peut ouvrir et un verrou soude.
    expect(corps).toContain('if (!ouvert()) return [];');
    expect(corps).toContain("from('my_reviewable_appointments')");
    expect(corps, 'la requete reelle ne doit plus etre en commentaire')
      .not.toMatch(/\/\/\s*const \{ data, error \} = await sb\.from\('my_reviewable_appointments'\)/);
  });
});

test.describe('avis patients — le drapeau commande enfin quelque chose', () => {

  test('DRAPEAU FERME : aucune ecriture ne part, et on le dit', async ({ page }) => {
    await chargerModule(page, { drapeau: false });
    const r = await page.evaluate(async () => {
      let refus = null;
      try {
        await window.tabibi.reviews.submitReview({ doctorId: 'd1', ratingOverall: 5 });
      } catch (e) { refus = e.message; }
      const liste = await window.tabibi.reviews.getMyReviewableAppointments();
      const peut = await window.tabibi.reviews.canReview('d1');
      return { refus, liste, peut, appels: window.__appels };
    });
    expect(r.refus, "l'ecriture n'a pas ete refusee").toBe('feature_disabled');
    expect(r.liste).toEqual([]);
    expect(r.peut.can_review).toBe(false);
    // Le point : rien n'est parti en base. Masquer un bouton ne protege pas
    // d'un appel programmatique.
    expect(r.appels.filter((a) => a.startsWith('insert:'))).toEqual([]);
    expect(r.appels).not.toContain('rpc:can_review_doctor');
  });

  test('DRAPEAU OUVERT : l ecriture part, avec le statut « pending »', async ({ page }) => {
    await chargerModule(page, {
      drapeau: true,
      reponses: { 'insert:reviews': { data: { id: 'avis-1', status: 'pending' }, error: null } },
    });
    const r = await page.evaluate(async () => {
      const avis = await window.tabibi.reviews.submitReview({
        doctorId: 'd1', ratingOverall: 5, comment: 'Medecin tres a l ecoute, je recommande.',
      });
      return { avis, appels: window.__appels };
    });
    expect(r.appels).toContain('insert:reviews');
    // Un avis n'est jamais publie d'office : il passe par la moderation.
    expect(r.avis.status).toBe('pending');
  });
});

test.describe('avis patients — le drapeau du produit', () => {

  test('reviews est OUVERT, et le module le lit vraiment', async ({ page }) => {
    // Page qui charge reellement `tabibi-features.js` sans naviguer ensuite.
    await page.route('**/login.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>login</body></html>' }));
    await page.goto('/teleconsultation.html', ATTENDRE);
    await page.waitForTimeout(400);
    const drapeaux = await page.evaluate(() => window.TABIBI_FEATURES);
    expect(drapeaux.reviews, 'le drapeau avis devrait etre ouvert').toBe(true);

    // ⚠️ Ce qui rend l'ouverture reelle : le module CITE le drapeau. Avant ce
    // lot, `TABIBI_FEATURES.reviews` n'apparaissait nulle part dans le produit
    // — l'ouvrir ou le fermer ne changeait rien.
    const src = await page.request.get('/js/tabibi-reviews.js').then((r) => r.text());
    expect(src, 'le module ne lit pas le drapeau : l ouvrir ne veut rien dire')
      .toContain('TABIBI_FEATURES.reviews');
  });

  test('ouvrir les avis n a ouvert aucun autre drapeau', async ({ page }) => {
    await page.route('**/login.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>login</body></html>' }));
    await page.goto('/teleconsultation.html', ATTENDRE);
    await page.waitForTimeout(400);
    const d = await page.evaluate(() => window.TABIBI_FEATURES);
    expect(d.payments, 'payments ne s ouvre pas avec les avis').toBe(false);
    expect(d.messaging, 'messaging ne s ouvre pas avec les avis').toBe(false);
  });
});
