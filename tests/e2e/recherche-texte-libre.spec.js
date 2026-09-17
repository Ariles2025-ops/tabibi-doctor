// =====================================================================
// La barre de recherche cherche — six jours après avoir cessé
// =====================================================================
// ⚠️ SIGNALE PAR AGHILES LE 15/09. Taper « cardiologue » dans la barre SANS
// choisir de menu affichait « Choisissez une wilaya ou une spécialité » et
// **n'appelait même pas le serveur**. Depuis le durcissement C1 (09/09).
//
// Le garde-fou avait raison le 09/09 : la RPC refusait alors une recherche sans
// filtre. Il a eu tort dès que la RPC a accepté `p_q` seul. **Une garde
// correcte devient fausse quand ce qu'elle protège change, et rien ne le lui
// dit.**
//
// ---------------------------------------------------------------------
// CE QUE CET ESSAI PROUVE, ET COMMENT
// ---------------------------------------------------------------------
// Il ne regarde pas le code : il tape dans le champ et **lit ce qui part sur
// le réseau**. La RPC est bouchonnée — rien ne sort de localhost — et le corps
// de la requête est capturé tel quel.
//
// C'est le seul niveau où « la barre cherche » veut dire quelque chose : une
// fonction peut être juste et n'être jamais appelée. C'est exactement ce qui
// s'est passé pendant six jours.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PAGE = '/accueil-public.html';

/** Les listes que la page charge normalement du serveur. */
const WILAYAS = ['Alger', 'Béjaïa', 'Oran', 'Constantine', 'Bordj Bou Arreridj'];
const SPECS = ['Cardiologue', 'Pédiatre', 'Médecin généraliste', 'Dentiste'];

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

/**
 * Bouchonne `chercher_praticiens` et retient CHAQUE corps recu.
 * @returns {{ appels: object[] }}
 */
async function bouchonnerRecherche(page) {
  const appels = [];
  await page.route('**/rest/v1/rpc/chercher_praticiens', async (route) => {
    try { appels.push(JSON.parse(route.request().postData() || '{}')); } catch { appels.push(null); }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 0, page: 1, limite: 12, lignes: [] }),
    });
  });
  return { appels };
}

/**
 * Pose les listes de la base, comme le premier chargement les poserait.
 *
 * ⚠️ `addInitScript` NE SUFFIT PAS : la page appelle `stats_publiques` a son
 * chargement et **ecrase** `_DB_SPECIALTIES` avec ce qu'elle en recoit. Avec la
 * reponse hermetique par defaut (`[]`), la liste redevenait vide et aucune
 * specialite n'etait reconnue — l'essai accusait le code d'un defaut qui etait
 * dans le bouchon.
 *
 * On bouchonne donc la SOURCE, pas la variable.
 */
async function poserListes(page) {
  await page.route('**/rest/v1/rpc/stats_publiques', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ specialites: SPECS, praticiens: 0, wilayas: WILAYAS.length }),
  }));
  await page.addInitScript(([w, s]) => {
    window._DB_WILAYAS = w;
    window._DB_SPECIALTIES = s;
    // Le cache de session porterait une liste d'un essai precedent.
    try { sessionStorage.removeItem('tb_stats_v2'); } catch { /* stockage bloque */ }
  }, [WILAYAS, SPECS]);
}

async function chercher(page, terme) {
  await page.fill('#name-search', terme);
  // `doFilter()` est debounce a 300 ms ; on laisse passer la fenetre.
  await page.waitForTimeout(700);
}

// ─────────────────────────────────────────────────────────────────────
test.describe('recherche en texte libre', () => {

  test('un terme SEUL appelle le serveur — plus de « Choisissez une wilaya »', async ({ page }) => {
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'cardiologue');

    expect(appels.length, 'aucun appel : le court-circuit est toujours la').toBeGreaterThan(0);
    const dernier = appels[appels.length - 1];
    // Quelque chose de cherchable est parti : soit le texte, soit un filtre
    // qu'on en a tire. Ce qui compte est qu'on ait INTERROGE le serveur.
    expect(dernier.p_q || dernier.p_specialite || dernier.p_wilaya).toBeTruthy();

    // Et l'ecran d'invite ne doit plus s'afficher.
    const invite = await page.locator('.empty-state .empty-title').count();
    if (invite) {
      const texte = await page.locator('.empty-state .empty-title').first().textContent();
      expect(texte || '').not.toMatch(/Choisissez une wilaya/i);
    }
  });

  test('« cardiologue béjaïa » part en spécialité ET wilaya', async ({ page }) => {
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'cardiologue béjaïa');

    const dernier = appels[appels.length - 1];
    expect(dernier.p_specialite).toBe('Cardiologue');
    expect(dernier.p_wilaya).toBe('Béjaïa');
  });

  test('sans accent aussi — « bejaia » trouve « Béjaïa »', async ({ page }) => {
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'cardiologue bejaia');

    const dernier = appels[appels.length - 1];
    expect(dernier.p_specialite).toBe('Cardiologue');
    expect(dernier.p_wilaya, 'la valeur envoyee doit etre celle de la BASE').toBe('Béjaïa');
  });

  test('un NOM part en texte libre, et ne devient pas un filtre', async ({ page }) => {
    // Le vrai risque : transformer « Benali » en specialite et rendre
    // 1 500 fiches au lieu d'une.
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'benali');

    const dernier = appels[appels.length - 1];
    expect(dernier.p_q).toBe('benali');
    expect(dernier.p_specialite).toBeNull();
    expect(dernier.p_wilaya).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────
  // [17/09/2026] « Dr » DEVANT UN NOM FAISAIT DISPARAITRE LES DEUX TIERS
  // ─────────────────────────────────────────────────────────────────
  // Mesure sur la base de production, meme RPC, meme jour :
  //
  //     « benali »          -> 131 praticiens
  //     « dr benali »       ->  46
  //     « docteur benali »  ->   0
  //
  // Le texte partait tel quel en `p_q`, et la civilite se retrouvait comparee
  // au NOM. Un patient qui ecrit « Docteur Benali » — la facon la plus
  // naturelle de nommer un medecin — ne trouvait **personne**.
  //
  // ⚠️ Ce n'etait PAS le defaut soupconne (« Dr Cardin » devenant « cardio ») :
  // l'analyse fait de l'egalite STRICTE sur les listes de la base, une civilite
  // ne ressemble a aucune specialite. Le defaut etait en aval.
  for (const [saisie, attendu] of [
    ['dr benali', 'benali'],
    ['docteur benali', 'benali'],
    ['Dr. Benali', 'Benali'],
    ['pr benali', 'benali'],
  ]) {
    test(`« ${saisie} » part sans la civilite`, async ({ page }) => {
      const { appels } = await bouchonnerRecherche(page);
      await poserListes(page);
      await page.goto(PAGE, ATTENDRE);
      await chercher(page, saisie);

      const dernier = appels[appels.length - 1];
      expect(dernier, 'aucun appel n est parti').toBeTruthy();
      expect(dernier.p_q, `la civilite part encore au serveur`).toBe(attendu);
    });
  }

  test('un nom qui ressemble a une civilite n est PAS mange', async ({ page }) => {
    // ⚠️ LA CONTRE-EPREUVE. Retirer trop serait pire que ne rien retirer : on
    // ne doit pas amputer un nom propre. Seuls les mots ENTIERS de la liste
    // sautent — « Drissi » commence par « dr » et doit survivre intact.
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'drissi');

    expect(appels[appels.length - 1].p_q).toBe('drissi');
  });

  test('une saisie faite QUE de civilites part quand meme', async ({ page }) => {
    // On ne rend pas une recherche vide a quelqu'un qui a tape quelque chose :
    // il verrait la vitrine sans comprendre pourquoi.
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, 'dr');

    expect(appels[appels.length - 1].p_q).toBe('dr');
  });

  test('le champ vide ne declenche aucune recherche — l invite revient', async ({ page }) => {
    // La CONTRE-EPREUVE du premier essai : si le court-circuit avait ete
    // simplement supprime, la page appellerait le serveur sans aucun critere a
    // chaque chargement. Il doit toujours etre la pour le cas vide.
    const { appels } = await bouchonnerRecherche(page);
    await poserListes(page);
    await page.goto(PAGE, ATTENDRE);
    await chercher(page, '');

    const avecCritere = appels.filter((a) => a && (a.p_q || a.p_wilaya || a.p_specialite));
    expect(avecCritere.length).toBe(0);
  });
});
