// =====================================================================
// Parcours 4 — LA FIXTURE SALE
// =====================================================================
// Une base propre cache le defaut : c'est pour ca qu'il a survecu a la
// recette. On injecte donc une fixture qui contient ce qu'une vraie base
// finira par contenir : un honore, un annule, un absent, et un statut
// INVENTE que le code ne connait pas.
//
// Attendu, sur les trois ecrans :
//   consultations = 1 (le completed seul)
//   absents       = 1 (le no_show)
//   l'annule VISIBLE comme annule, hors total
//   l'invente NEUTRE, libelle « Statut inconnu », hors total
// Si l'un des deux ressort vert, c'est rate.
// =====================================================================
const { test, expect } = require('@playwright/test');

const AUJ = new Date().toISOString().split('T')[0];
const MOIS = AUJ.slice(0, 7);

const SALE_MEDECIN = [
  { id: 'f1', sbId: 'f1', _sb: true, date: AUJ, time: '09:00', slot: '09:00',
    patientName: 'A. Honore',  patientPhone: '', motif: 'Consultation', status: 'completed' },
  { id: 'f2', sbId: 'f2', _sb: true, date: AUJ, time: '10:00', slot: '10:00',
    patientName: 'B. Annule',  patientPhone: '', motif: 'Consultation', status: 'cancelled' },
  { id: 'f3', sbId: 'f3', _sb: true, date: AUJ, time: '11:00', slot: '11:00',
    patientName: 'C. Absent',  patientPhone: '', motif: 'Consultation', status: 'no_show' },
  { id: 'f4', sbId: 'f4', _sb: true, date: AUJ, time: '12:00', slot: '12:00',
    patientName: 'D. Invente', patientPhone: '', motif: 'Consultation', status: 'rescheduled' }
];

const SALE_MESRDV = [
  { id: 'f1', status: 'completed',   scheduled_at: AUJ + 'T09:00:00Z', doctor_name: 'Dr Test' },
  { id: 'f2', status: 'cancelled',   scheduled_at: AUJ + 'T10:00:00Z', doctor_name: 'Dr Test' },
  { id: 'f3', status: 'no_show',     scheduled_at: AUJ + 'T11:00:00Z', doctor_name: 'Dr Test' },
  { id: 'f4', status: 'rescheduled', scheduled_at: AUJ + 'T12:00:00Z', doctor_name: 'Dr Test' }
];

const SALE_PATIENT = SALE_MEDECIN.map((r, i) => ({
  id: r.id, sbId: r.sbId, _sb: true, date: r.date, time: r.time,
  doctorName: 'Dr Test', spec: 'Generaliste', status: r.status,
  reason: 'Consultation', payMethod: 'cash', prix: 0, reviewed: false,
  createdAt: r.date, _i: i
}));

// La garde d'authentification valide la session aupres de Supabase et redirige
// vers login.html sinon. On ne touche PAS au code de production : on sert un
// bouchon a la place de js/auth.js, pour ce test uniquement. Aucun compte de
// test, aucune ecriture en base, aucun reseau vers Supabase.
async function poser(page, cles, role) {
  const r = role || 'patient';
  await page.route('**/js/auth.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.tabibi = window.tabibi || {};
           window.tabibi.auth = {
             requireAuth: async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             getUser:     async () => JSON.parse(localStorage.getItem('tabibi_user') || 'null'),
             logout:      async () => {}
           };`
  }));
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.addInitScript(([c, ro]) => {
    for (const k of Object.keys(c)) localStorage.setItem(k, JSON.stringify(c[k]));
    localStorage.setItem('tabibi_user', JSON.stringify({ id: 'fx', role: ro, name: 'Fixture', first_name: 'Fixture' }));
    localStorage.setItem('tabibi_role', ro);
    localStorage.setItem('tabibi_lang', 'fr');   // libelles deterministes
  }, [cles, r]);
}

test.describe('parcours 4 — fixture sale', () => {
  test('l utilitaire ne rend jamais un inconnu comme valide', async ({ page }) => {
    await poser(page, {}, 'patient');
    await page.goto('/mes-rdv.html');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const S = window.tabibiStatutRdv;
      const d = (x) => { const o = S.decrire(x); return { cle: o.cle, connu: o.connu, libelle: o.libelle, classe: o.classe, cons: o.compteConsultations, abs: o.compteAbsents, actions: o.actions }; };
      return {
        inconnu: d('rescheduled'), vide: d(''), nul: d(null), majuscule: d('Confirmed'),
        annule: d('cancelled'), absent: d('no_show'), honore: d('completed'),
        totaux: S.compter([{ status: 'completed' }, { status: 'cancelled' }, { status: 'no_show' }, { status: 'rescheduled' }])
      };
    });

    // Un inconnu : neutre, explicite, sans action, dans aucun total.
    expect(r.inconnu.connu).toBe(false);
    expect(r.inconnu.cle).toBeNull();
    expect(r.inconnu.libelle).toMatch(/inconnu|unknown/i);
    expect(r.inconnu.classe).not.toMatch(/green/);
    expect(r.inconnu.actions).toEqual([]);
    expect(r.inconnu.cons).toBe(false);
    expect(r.inconnu.abs).toBe(false);

    // Vide et nul : inconnus. Jamais un repli silencieux sur « pending »,
    // c'etait le defaut de STATUS_MAP.
    for (const c of [r.vide, r.nul]) {
      expect(c.connu).toBe(false);
      expect(c.cle).not.toBe('pending');
      expect(c.classe).not.toMatch(/green/);
    }

    // Tolerant en ENTREE, strict en SORTIE : une valeur capitalisee heritee de
    // l'ancien code se normalise, elle ne devient pas « inconnu » pour rien.
    // Mais la cle rendue est toujours celle de la base, en minuscules.
    expect(r.majuscule.connu).toBe(true);
    expect(r.majuscule.cle).toBe('confirmed');

    // Le vert est une autorisation : seul completed l'obtient.
    expect(r.honore.classe).toMatch(/green/);
    expect(r.annule.classe).not.toMatch(/green/);
    expect(r.absent.classe).not.toMatch(/green/);

    // Les totaux, option A.
    expect(r.totaux).toMatchObject({ consultations: 1, absents: 1, inconnus: 1, total: 4 });
  });

  test('tableau de bord medecin : 1 consultation, 1 absent, rien de vert en trop', async ({ page }) => {
    await poser(page, { tabibi_doc_rdv: SALE_MEDECIN }, 'medecin');
    await page.goto('/doctor-dashboard.html');
    await page.waitForTimeout(1200);

    await expect(page.locator('#kpi-month')).toHaveText('1');
    await expect(page.locator('#kpi-absents')).toHaveText('1');

    const liste = page.locator('#today-list');
    await expect(liste).toContainText('Annulé');
    await expect(liste).toContainText('Statut inconnu');
    // Aucun badge vert en dehors du seul honore.
    expect(await liste.locator('.badge-green').count()).toBe(1);

    // La couleur de la CARTE, pas seulement du badge : la bordure de base etait
    // verte, donc l'annule et l'inconnu heritaient du vert sans qu'aucune
    // assertion sur le badge ne le voie. On mesure la couleur calculee.
    const bordures = await liste.locator('.appt-card').evaluateAll(
      (els) => els.map((e) => getComputedStyle(e).borderLeftColor));
    expect(bordures).toHaveLength(4);
    const vert = bordures.filter((c) => /rgb\(\s*(0|1?\d|2[0-9]|4[0-9]|46)\s*,\s*1[0-9]{2}/.test(c));
    // Une seule bordure verte au plus : celle du RDV honore.
    expect(vert.length).toBeLessThanOrEqual(1);

    await page.locator('#today-list').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/preuves/parcours4-medecin.png', fullPage: true });
  });

  // Le vrai ecran patient est mes-rdv.html : le panneau #tab-rdv de
  // patient-dashboard est neutralise depuis la phase 5.2.5 (son onglet redirige
  // ici). On teste donc l'ecran servi, pas le DOM mort.
  test('mes-rdv : l annule visible et classe, l invente neutre et hors du a-venir', async ({ page }) => {
    await poser(page, {}, 'patient');
    await page.addInitScript((rows) => {
      // Bouchon du module de reservation : la fixture sale arrive par la ou
      // arriveraient les vraies lignes, sans reseau ni compte de test.
      Object.defineProperty(window, 'tabibiBooking', {
        value: { listMyAppointments: async () => ({ ok: true, data: rows }) },
        writable: true, configurable: true
      });
    }, SALE_MESRDV);

    await page.goto('/mes-rdv.html');
    await page.waitForTimeout(1200);

    const totaux = await page.evaluate(() => ({
      up: document.querySelectorAll('#section-upcoming .rdv-card').length,
      past: document.querySelectorAll('#section-past .rdv-card').length,
      annules: document.querySelectorAll('#section-cancelled .rdv-card').length,
      badges: Array.from(document.querySelectorAll('.badge-sm')).map((e) => e.className + '|' + e.textContent.trim())
    }));

    // L'annule est dans sa section, pas ailleurs.
    expect(totaux.annules).toBe(1);
    // L'invente n'est PAS « a venir » : on ne promet rien qu'on ne sait pas tenir.
    expect(totaux.up).toBe(0);

    const statuts = totaux.badges.filter((b) => /badge-(green|red|gray|amber|blue)/.test(b));
    expect(statuts.join(' ')).toMatch(/Statut inconnu/);
    expect(statuts.join(' ')).toMatch(/Annul/);
    // Un seul badge vert : le RDV honore.
    expect(statuts.filter((b) => b.includes('badge-green')).length).toBe(1);

    // La preuve doit se VOIR : l'onglet « Passes » porte l'honore, l'absent et
    // l'inventé ; « Annules » porte l'annule.
    await page.evaluate(() => window.showTab('past'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/preuves/parcours4-patient-passes.png', fullPage: true });
    await page.evaluate(() => window.showTab('cancelled'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/preuves/parcours4-patient-annules.png', fullPage: true });
  });
});
