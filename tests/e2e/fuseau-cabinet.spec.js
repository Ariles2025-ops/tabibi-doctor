// =====================================================================
// Le fuseau du CABINET — le meme rendez-vous, trois navigateurs
// =====================================================================
// Un rendez-vous a lieu a un INSTANT. Le medecin et le patient doivent lire
// LA MEME heure, quel que soit l'endroit d'ou ils regardent.
//
// Le cas qui decale la date : 00h30 heure cabinet. En UTC c'est encore la
// veille a 23h30 ; a Paris c'est deja 01h30. Avant le 13/09/2026, la date
// sortait en UTC et l'heure en local — les deux se contredisaient.
//
// Les trois NON-REGRESSIONS sont dans le meme fichier, a dessein : ce sont les
// cas ou poser naivement un fuseau CASSE l'affichage (une Date construite
// localement pour representer un jour, et une chaine 'jour T heure' parsee en
// local). Ils doivent rester justes aux trois fuseaux.
// =====================================================================
const { test, expect } = require('@playwright/test');

const FUSEAUX = ['Africa/Algiers', 'Europe/Paris', 'UTC'];
const RDV_MINUIT = '2026-09-15T23:30:00Z';   // 00h30 le 16 septembre, heure cabinet
const RDV_MATIN  = '2026-09-16T08:00:00Z';   // 09h00 le 16 septembre, heure cabinet

async function charger(page) {
  // La garde d'authentification renverrait vers login.html ; on ne teste ici que
  // l'utilitaire de temps, charge des le head de la page.
  await page.route('**/js/auth.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: `window.tabibi=window.tabibi||{};window.tabibi.auth={requireAuth:async()=>({id:'fx',role:'patient'}),getUser:async()=>null,logout:async()=>{}};` }));
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.goto('/mes-rdv.html');
  await page.waitForFunction(() => typeof window.tabibiTemps === 'object', null, { timeout: 5000 });
}

for (const tz of FUSEAUX) {
  test.describe(`navigateur en ${tz}`, () => {
    test.use({ timezoneId: tz, locale: 'fr-FR' });

    test('le meme instant rend la meme date et la meme heure', async ({ page }) => {
      await charger(page);
      const r = await page.evaluate(([minuit, matin]) => {
        const T = window.tabibiTemps;
        return {
          tzNavigateur: Intl.DateTimeFormat().resolvedOptions().timeZone,
          minuitJour: T.jourDe(minuit), minuitHeure: T.heureDe(minuit),
          matinJour: T.jourDe(matin), matinHeure: T.heureDe(matin),
          minuitLisible: T.instant(minuit, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }),
          // Aller-retour : jour + heure murale du cabinet -> instant -> relu
          allerRetour: T.jourDe(T.instantDepuisJourEtHeure('2026-09-16', '00:30'))
                     + ' ' + T.heureDe(T.instantDepuisJourEtHeure('2026-09-16', '00:30'))
        };
      }, [RDV_MINUIT, RDV_MATIN]);

      expect(r.tzNavigateur).toBe(tz);            // le navigateur EST bien depayse
      expect(r.minuitJour).toBe('2026-09-16');    // pas le 15, meme vu d'UTC
      expect(r.minuitHeure).toBe('00:30');        // pas 01:30, meme vu de Paris
      expect(r.matinJour).toBe('2026-09-16');
      expect(r.matinHeure).toBe('09:00');
      expect(r.allerRetour).toBe('2026-09-16 00:30');
      expect(r.minuitLisible).toContain('mercredi 16 septembre');
    });

    test('non-regression : un JOUR CALENDAIRE ne bouge pas', async ({ page }) => {
      await charger(page);
      const r = await page.evaluate(() => {
        const T = window.tabibiTemps;
        return {
          // cas 3 du 13/09 : `setHours(0,0,0,0)` local rendu en fuseau cabinet
          // reculait la date d'un jour a Paris. Ici, aucun fuseau n'est applique.
          jour: T.jourCalendaire('2026-09-16', { weekday: 'long', day: 'numeric', month: 'long' }),
          lundi: T.lundiDe('2026-09-16'),
          demain: T.ajouterJours('2026-09-16', 1),
          semaine: T.jourSemaine('2026-09-16')
        };
      });
      expect(r.jour).toBe('mercredi 16 septembre');
      expect(r.lundi).toBe('2026-09-14');
      expect(r.demain).toBe('2026-09-17');
      expect(r.semaine).toBe(3);
    });

    test('non-regression : une heure murale saisie part juste en base', async ({ page }) => {
      await charger(page);
      // cas 4 du 13/09 : `new Date('2026-09-16T09:00')` parse en LOCAL. Depuis
      // Paris un RDV saisi a 09:00 partait a 07:00 UTC, soit 08:00 cabinet.
      const iso = await page.evaluate(() => window.tabibiTemps.instantDepuisJourEtHeure('2026-09-16', '09:00'));
      expect(iso).toBe('2026-09-16T08:00:00.000Z');
    });
  });
}

test.describe('capture aux trois fuseaux', () => {
  for (const tz of FUSEAUX) {
    test(`rendu ${tz}`, async ({ browser }) => {
      const ctx = await browser.newContext({ timezoneId: tz, locale: 'fr-FR' });
      const page = await ctx.newPage();
      await page.route('**/js/auth.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
        body: `window.tabibi=window.tabibi||{};window.tabibi.auth={requireAuth:async()=>JSON.parse(localStorage.getItem('tabibi_user')||'null'),getUser:async()=>null,logout:async()=>{}};` }));
      await page.addInitScript((rows) => {
        localStorage.setItem('tabibi_user', JSON.stringify({ id: 'fx', role: 'patient', name: 'Fixture' }));
        localStorage.setItem('tabibi_lang', 'fr');
        Object.defineProperty(window, 'tabibiBooking', {
          value: { listMyAppointments: async () => ({ ok: true, data: rows }) },
          writable: true, configurable: true
        });
      }, [
        { id: 'a', status: 'confirmed', scheduled_at: RDV_MINUIT, doctor_name: 'Dr Minuit' },
        { id: 'b', status: 'confirmed', scheduled_at: RDV_MATIN,  doctor_name: 'Dr Matin' }
      ]);
      await page.goto('/mes-rdv.html');
      await page.waitForTimeout(1500);
      const textes = await page.evaluate(() => Array.from(document.querySelectorAll('#section-upcoming .rdv-card, #section-past .rdv-card'))
        .map((e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 90)));
      console.log('   ' + tz.padEnd(16) + ' -> ' + JSON.stringify(textes));
      await page.screenshot({ path: 'docs/preuves/fuseau-' + tz.replace(/\W/g, '-') + '.png', fullPage: true });
      await ctx.close();
    });
  }
});
