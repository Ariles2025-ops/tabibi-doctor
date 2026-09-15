// =====================================================================
// La page de verification publique — et ce qu'elle ne dira jamais
// =====================================================================
// `verify-prescription.html` est la seule page du produit qu'un inconnu peut
// ouvrir pour interroger le systeme : un pharmacien recoit une ordonnance, il
// veut savoir si elle est authentique.
//
// Ce fichier garde DEUX proprietes, et la seconde compte plus que la premiere :
//
//   1. chaque verdict de la fonction produit le bon ecran ;
//   2. **aucun contenu medical n'atteint jamais cette page.** Meme si le
//      serveur en renvoyait — ce qu'il ne doit pas faire, et ce que sa propre
//      relecture de reponse l'empeche de faire — la page n'en afficherait rien.
//
// Le test de fuite n'est PAS redondant avec le garde-fou de l'edge function.
// Les deux peuvent se perdre separement : un `select('*')` cote serveur, un
// `JSON.stringify(data)` cote page. **Une regle gardee a un seul endroit est
// une regle qui tient tant que personne ne touche cet endroit-la.**
//
// Aucun reseau reel : la fonction est bouchonnee par des routes.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

const ID = '11111111-2222-3333-4444-555555555555';
const SIG = 'v1:' + 'a'.repeat(64);
const LIEN = `/verify-prescription.html?id=${ID}&sig=${encodeURIComponent(SIG)}`;

// La reponse que la fonction est censee rendre : identite du document, et
// RIEN du contenu medical.
const REPONSE_VALIDE = {
  valid: true, expired: false, cancelled: false,
  prescription_number: 'RX-2026-000123',
  issue_date: '2026-09-14',
  expiry_date: '2026-10-14',
  status: 'signed',
  doctor_name: 'Dr Amine Bensalah',
  doctor_specialty: 'Cardiologie',
  patient_initials: 'K. M.',
  pdf_sha256: 'b'.repeat(64),
  signature_key_version: 'v1',
};

async function poser(page, corps, statut = 200) {
  await page.route('**/functions/v1/verify-prescription**', (route) => route.fulfill({
    status: statut, contentType: 'application/json', body: JSON.stringify(corps),
  }));
}

// ─────────────────────────────────────────────────────────────────────
test.describe('verification d ordonnance — les verdicts', () => {

  test('SIGNATURE VALIDE : ecran authentique + les champs d identite', async ({ page }) => {
    await poser(page, REPONSE_VALIDE);
    await page.goto(LIEN, ATTENDRE);

    await expect(page.locator('#verdict')).toContainText('authentique');
    await expect(page.locator('#verdict')).toHaveClass(/ok/);
    const grille = page.locator('#info-grid');
    await expect(grille).toBeVisible();
    await expect(grille).toContainText('RX-2026-000123');
    await expect(grille).toContainText('Dr Amine Bensalah');
    await expect(grille).toContainText('K. M.');
  });

  test('SIGNATURE INVALIDE : « INVALIDE », et AUCUNE donnee affichee', async ({ page }) => {
    await poser(page, { error: 'invalid_signature' });
    await page.goto(LIEN, ATTENDRE);

    await expect(page.locator('#verdict')).toContainText('INVALIDE');
    // Le point : un document refuse ne montre rien de lui-meme. Sinon un lien
    // falsifie deviendrait un moyen de lire la fiche.
    await expect(page.locator('#info-grid')).toBeHidden();
  });

  test('INTROUVABLE : dit introuvable, pas « invalide »', async ({ page }) => {
    await poser(page, { error: 'not_found' }, 404);
    await page.goto(LIEN, ATTENDRE);
    await expect(page.locator('#verdict')).toContainText('INTROUVABLE');
  });

  test('BROUILLON (not_signed) : traite comme invalide, jamais comme authentique', async ({ page }) => {
    await poser(page, { error: 'not_signed' }, 409);
    await page.goto(LIEN, ATTENDRE);
    await expect(page.locator('#verdict')).toContainText('INVALIDE');
    await expect(page.locator('#info-grid')).toBeHidden();
  });

  test('ANNULEE : « ne pas delivrer » s affiche', async ({ page }) => {
    await poser(page, { ...REPONSE_VALIDE, valid: false, cancelled: true, status: 'cancelled' });
    await page.goto(LIEN, ATTENDRE);
    // Les accents viennent du dictionnaire i18n, pas des replis ASCII du
    // code : on assert donc sur ce qui S'AFFICHE, tolerant a l'accent.
    await expect(page.locator('#verdict')).toContainText(/ANNUL[EÉ]E/);
    await expect(page.locator('#alert-slot')).toContainText(/[Nn]e pas d[eé]livrer/);
  });

  test('EXPIREE : authentique MAIS perimee — la nuance est gardee', async ({ page }) => {
    await poser(page, { ...REPONSE_VALIDE, valid: false, expired: true, expiry_date: '2026-01-01' });
    await page.goto(LIEN, ATTENDRE);
    await expect(page.locator('#verdict')).toContainText(/EXPIR[EÉ]E/);
    await expect(page.locator('#verdict-sub')).toContainText(/[Aa]uthentique/);
  });

  test('CLE DE VERIFICATION ABSENTE : erreur serveur, et surtout PAS « invalide »', async ({ page }) => {
    // Si notre cle manque, le defaut est le NOTRE. Accuser le document serait
    // faire passer une ordonnance authentique pour un faux.
    await poser(page, { error: 'verification_unavailable' }, 503);
    await page.goto(LIEN, ATTENDRE);
    await expect(page.locator('#verdict')).toContainText('Erreur serveur');
    await expect(page.locator('#verdict')).not.toContainText('INVALIDE');
  });

  test('LIEN INCOMPLET : aucun appel reseau n est tente', async ({ page }) => {
    let appels = 0;
    await page.route('**/functions/v1/verify-prescription**', (route) => {
      appels++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/verify-prescription.html', ATTENDRE);
    await expect(page.locator('#verdict')).toContainText('incomplet');
    expect(appels, 'la page a interroge le serveur sans signature').toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('verification d ordonnance — la fuite qui ne doit pas arriver', () => {

  test('AUCUN CONTENU MEDICAL N ATTEINT LA PAGE, meme si le serveur en renvoie', async ({ page }) => {
    // On bouchonne une reponse FAUTIVE, celle qu'un futur `select('*')`
    // produirait. La page ne doit rien en montrer : elle n'affiche que les
    // champs qu'elle nomme, jamais ce qu'elle recoit.
    await poser(page, {
      ...REPONSE_VALIDE,
      medications: [{ name: 'Doliprane', dosage: '1000 mg' }],
      diagnosis: 'Grippe saisonniere',
      clinical_notes: 'Patient diabetique',
    });
    await page.goto(LIEN, ATTENDRE);
    await expect(page.locator('#verdict')).toContainText('authentique');

    const texte = await page.locator('body').innerText();
    for (const secret of ['Doliprane', '1000 mg', 'Grippe saisonniere', 'diabetique']) {
      expect(texte, `« ${secret} » s'affiche sur une page publique`).not.toContain(secret);
    }
  });

  test('LA SOURCE de la page ne lit aucun champ medical', async ({ page }) => {
    // Assertion sur le fichier, pas sur un chemin d'execution : le jour ou
    // quelqu'un ajoute `data.medications`, ce test rougit avant la revue.
    const src = await page.request.get('/verify-prescription.html').then((r) => r.text());
    const sansCommentaires = src.replace(/<!--[\s\S]*?-->/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const champ of ['medications', 'diagnosis', 'clinical_notes', 'patient_name']) {
      expect(sansCommentaires, `la page lit « ${champ} »`).not.toContain(champ);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
test.describe('l ecran de signature ne montre plus de code machine', () => {

  test('chaque refus de la fonction a une phrase en francais', async ({ page }) => {
    const src = await page.request.get('/medecin-ordonnance.html').then((r) => r.text());

    // 1. Le code brut n'est plus jete a l'ecran.
    expect(src).not.toContain('throw new Error(payload.error');

    // 2. Tous les codes que la fonction peut rendre sont traduits. La liste
    //    vient de `supabase/functions/generate-prescription-pdf/index.ts` :
    //    si elle s'allonge la-bas sans s'allonger ici, ce test le dit.
    for (const code of [
      'not_authenticated', 'not_owner', 'already_signed', 'not_signable',
      'not_found', 'invalid_medications', 'doctor_not_verified', 'not_a_doctor',
      'unsupported_characters', 'arabic_font_unavailable', 'signing_key_missing', 'pdf_generation_failed',
      'pdf_upload_failed', 'sign_failed', 'server_misconfigured',
    ]) {
      expect(src, `le refus « ${code} » n'a pas de message`).toContain(`${code}:`);
    }
  });

  test('un lien de telechargement absent ne devient pas href="null"', async ({ page }) => {
    const src = await page.request.get('/medecin-ordonnance.html').then((r) => r.text());
    // La signature peut reussir et le lien signe echouer : l'ecran ne doit pas
    // proposer un bouton qui mene nulle part.
    expect(src).toContain('if (payload.pdf_url_signed_24h)');
    expect(src).toContain("removeAttribute('href')");
  });
});
