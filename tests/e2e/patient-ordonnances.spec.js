// =====================================================================
// « Mes ordonnances » interrogeait une table qui n'existe pas
// =====================================================================
// ⚠️ TROUVÉ EN LIVE PAR AGHILES. La page affichait, à chaque ouverture :
//
//     Erreur de chargement
//     Could not find the table 'public.my_prescriptions' in the schema cache
//
// **Un patient n'avait aucun moyen de voir ses ordonnances.** Pas une donnée
// manquante, pas un droit refusé : une table qui n'a jamais existé.
//
// ---------------------------------------------------------------------
// CE QUI A ÉTÉ VÉRIFIÉ EN BASE AVANT D'ÉCRIRE UNE LIGNE
// ---------------------------------------------------------------------
//   · la table réelle est `prescriptions`
//   · `prescriptions_select_fusion` autorise DÉJÀ le patient :
//       patient_id = auth.uid()   → rien à ouvrir, aucune migration
//   · les noms de médecin ne sont pas sur cette table. Ils vivent sur
//     `public.users`, et `users_select_fusion` les laisse lire au patient
//     **pour les médecins avec qui il a un rendez-vous**
//   · les clés étrangères de `prescriptions` pointent vers `auth.users`, que
//     PostgREST n'expose pas → l'imbrication `select('*, doctor:users(…)')`
//     ne peut pas fonctionner. D'où **deux lectures**, pas une jointure.
//
// **Aucune vue `my_prescriptions` n'était nécessaire.** La seule chose qui
// manquait était de viser la bonne table.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// 1. La page se charge **sans « Erreur de chargement »** — liste vide comprise.
// 2. Elle interroge `prescriptions`, **jamais** `my_prescriptions`.
// 3. Si la seconde lecture (les noms) échoue, **la liste s'affiche quand même** :
//    une ordonnance sans le nom de son prescripteur reste utile.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const PATIENT = '00000000-0000-4000-8000-000000000001';
const MEDECIN = '00000000-0000-4000-8000-00000000000d';

function ordonnance(surcharge) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    patient_id: PATIENT, doctor_id: MEDECIN, appointment_id: null,
    prescription_number: 'ORD-2026-000042',
    issue_date: '2026-09-10', expiry_date: '2026-12-10', validity_days: 90,
    medications: [{ name: 'Doliprane 1000mg', dosage: '1 comprimé', frequency: '3 fois par jour' }],
    diagnosis: 'Céphalées', clinical_notes: null,
    pdf_storage_path: 'ordonnances/ord-42.pdf', pdf_sha256: 'abc123', status: 'signed',
    ...surcharge,
  };
}

async function ouvrir(page, { ordonnances = [ordonnance()], medecinsLisibles = true } = {}) {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript((id) => {
    try {
      localStorage.setItem('tabibi_lang', 'fr');
      localStorage.setItem('tabibi_user', JSON.stringify({ id, role: 'patient', name: 'Essai Patient' }));
      localStorage.setItem('tabibi_role', 'patient');
      localStorage.setItem('sb-pudugodhiofqrctcdwfl-auth-token', JSON.stringify({
        access_token: 'jeton-de-test', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
        user: { id, email: 'p@example.test' },
      }));
    } catch (e) { /* stockage bloqué : l'essai le dira */ }
    window.__tables = [];
  }, PATIENT);

  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PATIENT, email: 'p@example.test' }),
  }));

  // ⚠️ La table demandée est notée AVANT de répondre : c'est elle qu'on garde.
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const table = (url.pathname.split('/rest/v1/')[1] || '').split('?')[0];
    await route.request().frame().page().evaluate(
      (t) => { (window.__tables = window.__tables || []).push(t); }, table).catch(() => {});

    if (table === 'my_prescriptions') {
      // Ce que la base répond réellement : la table n'existe pas.
      return route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ message: "Could not find the table 'public.my_prescriptions' in the schema cache" }) });
    }
    if (table === 'prescriptions') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ordonnances) });
    }
    if (table === 'users') {
      if (!medecinsLisibles) {
        return route.fulfill({ status: 403, contentType: 'application/json',
          body: JSON.stringify({ message: 'permission denied for table users' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: MEDECIN, first_name: 'Mohamed', last_name: 'Benali',
                                specialty_fr: 'Cardiologue' }]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/patient-ordonnances.html', ATTENDRE);
  expect(page.url(), 'redirigé : la session n’a pas pris').not.toContain('login.html');
}

const tables = (page) => page.evaluate(() => window.__tables || []);
const ecran = (page) => page.locator('#list').innerText()
  .then((t) => t.normalize('NFC').replace(/\s+/g, ' ').trim());

test.describe('« Mes ordonnances » — la page d’un patient', () => {

  test('elle se charge SANS « Erreur de chargement »', async ({ page }) => {
    // ⚠️ LE CŒUR DE LA GARDE. C'est le symptôme qu'Aghiles a vu.
    await ouvrir(page);
    await expect.poll(() => ecran(page), { timeout: 10000 }).not.toMatch(/Erreur de chargement/i);
    expect(await ecran(page), 'le message d’erreur de la table absente est revenu')
      .not.toMatch(/my_prescriptions|schema cache/i);
  });

  test('elle interroge `prescriptions`, JAMAIS `my_prescriptions`', async ({ page }) => {
    await ouvrir(page);
    await expect.poll(() => tables(page), { timeout: 10000 }).toContain('prescriptions');
    expect(await tables(page), 'la page vise de nouveau une table qui n’existe pas')
      .not.toContain('my_prescriptions');
  });

  test('l’ordonnance s’affiche, avec le nom du médecin', async ({ page }) => {
    // Une page qui ne plante plus mais n'affiche rien n'a pas été réparée.
    await ouvrir(page);
    await expect.poll(() => ecran(page), { timeout: 10000 }).toContain('ORD-2026-000042');
    const vu = await ecran(page);
    expect(vu).toContain('Dr Mohamed Benali');
    expect(vu).toContain('Cardiologue');
  });

  test('si les NOMS sont refusés, la liste s’affiche quand même', async ({ page }) => {
    // ⚠️ LA MOITIÉ QUI RAMÈNERAIT L'ÉCRAN VIDE. Le nom vient d'une seconde
    // lecture, autorisée seulement pour les médecins avec qui le patient a un
    // rendez-vous. Faire dépendre toute la liste de cette requête rendrait la
    // page aussi inutile qu'avant — pour une ordonnance parfaitement lisible.
    await ouvrir(page, { medecinsLisibles: false });

    await expect.poll(() => ecran(page), { timeout: 10000 }).toContain('ORD-2026-000042');
    const vu = await ecran(page);
    expect(vu, 'une erreur s’affiche alors que l’ordonnance est lisible')
      .not.toMatch(/Erreur de chargement/i);
    // ⚠️ Et on n'écrit pas « Dr » tout seul : ce n'est pas un nom.
    expect(vu, 'un « Dr » orphelin est affiché').not.toMatch(/\bDr\s*$/m);
    expect(vu).toMatch(/Médecin prescripteur/i);
  });

  test('une liste VIDE n’est pas une erreur', async ({ page }) => {
    // Un patient sans ordonnance doit lire « aucune ordonnance », pas une panne.
    await ouvrir(page, { ordonnances: [] });
    await expect.poll(() => ecran(page).then((t) => t.length > 0), { timeout: 10000 }).toBe(true);
    expect(await ecran(page), 'une liste vide est présentée comme une erreur')
      .not.toMatch(/Erreur de chargement/i);
  });

  test('les brouillons du médecin ne sont pas montrés au patient', async ({ page }) => {
    // ⚠️ Comportement d'origine, conservé : un brouillon n'est pas une
    // ordonnance. Le correctif change la SOURCE, pas la règle.
    await ouvrir(page, { ordonnances: [ordonnance({ status: 'draft' })] });
    await expect.poll(() => ecran(page).then((t) => t.length > 0), { timeout: 10000 }).toBe(true);
    expect(await ecran(page), 'un brouillon est visible côté patient')
      .not.toContain('ORD-2026-000042');
  });
});
