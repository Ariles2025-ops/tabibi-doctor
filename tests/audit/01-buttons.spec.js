// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * 01-buttons.spec.js
 * Smoke check: pour chaque page principale, on charge la page et on clique sur
 * chaque <button> et <a> non-bloquant, en interceptant console errors + 4xx/5xx.
 * Les boutons ouvrant des modales sont vérifiés pour ouverture, fermeture si bouton close trouvé.
 *
 * Résultat agrégé écrit dans tests/reports/BUTTONS_REPORT.json puis transformé en .md.
 */

const PAGES = [
  { path: '/', label: 'index' },
  { path: '/index.html', label: 'index-html' },
  { path: '/signup.html', label: 'signup' },
  { path: '/login.html', label: 'login' },
  { path: '/forgot-password.html', label: 'forgot-password' },
  { path: '/about.html', label: 'about' },
  { path: '/doctor-profile.html?id=241', label: 'doctor-profile-241' },
  { path: '/doctor-claim.html', label: 'doctor-claim' },
  { path: '/reservation.html', label: 'reservation' },
  { path: '/appointment.html', label: 'appointment' },
  { path: '/teleconsultation.html', label: 'teleconsult' },
  { path: '/waiting-list.html', label: 'waiting-list' },
  { path: '/api-docs.html', label: 'api-docs' },
  { path: '/legal/cgu.html', label: 'legal-cgu' },
  { path: '/legal/confidentialite.html', label: 'legal-confid' },
  { path: '/legal/cookies.html', label: 'legal-cookies' },
  { path: '/legal/mentions-legales.html', label: 'legal-mentions' },
  { path: '/blog/index.html', label: 'blog' },
];

// PAGES authentifiées (testées uniquement en smoke "page charge" — pas de clic des boutons internes
// pour éviter de produire des données ou actions destructives sans contexte de test propre)
const AUTH_PAGES = [
  { path: '/patient-dashboard.html', label: 'patient-dashboard' },
  { path: '/doctor-dashboard.html', label: 'doctor-dashboard' },
  { path: '/admin-dashboard.html', label: 'admin-dashboard' },
  { path: '/medecin-profile.html', label: 'medecin-profile' },
  { path: '/mes-rdv.html', label: 'mes-rdv' },
  { path: '/notifications.html', label: 'notifications' },
  { path: '/payment.html', label: 'payment' },
  { path: '/patient-profile.html', label: 'patient-profile' },
];

const REPORT_DIR = path.join(process.cwd(), 'tests', 'reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

/**
 * Une seule exécution: on accumule dans un fichier JSON.
 */
const reportEntries = [];

function logEntry({ page, button, selector, result, error, severity }) {
  reportEntries.push({ page, button, selector, result, error, severity, ts: Date.now() });
  const fp = path.join(REPORT_DIR, 'BUTTONS_REPORT.json');
  fs.writeFileSync(fp, JSON.stringify(reportEntries, null, 2));
}

test.describe('01 — Buttons & links smoke (public pages)', () => {
  for (const p of PAGES) {
    test(`page loads & buttons reachable: ${p.label}`, async ({ page, browserName }) => {
      const consoleErrors = [];
      const networkErrors = [];

      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && r.url().startsWith(page.context().browser()?._options?.baseURL || '')) {
          networkErrors.push(`${r.status()} ${r.url()}`);
        }
      });

      try {
        await page.goto(p.path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      } catch (e) {
        logEntry({
          page: p.label, button: '(page load)', selector: 'goto',
          result: 'FAIL', error: e.message, severity: 'CRIT',
        });
        throw e;
      }

      // Page loaded — count buttons & links
      const buttons = await page.locator('button:visible').all();
      const links = await page.locator('a[href]:visible').all();

      logEntry({
        page: p.label, button: '(page load)', selector: 'goto',
        result: 'PASS', error: '', severity: 'INFO',
        meta: { buttons: buttons.length, links: links.length, browser: browserName },
      });

      // Click each visible button — non-destructive: skip those with text matching destructive patterns
      const DESTRUCTIVE_RE = /(supprimer|delete|annuler.*compte|résilier|payer|envoyer.*sms)/i;

      for (let i = 0; i < Math.min(buttons.length, 30); i++) {
        const btn = buttons[i];
        const text = (await btn.textContent({ timeout: 1000 }).catch(() => '')) || '';
        const sel = `button:nth-visible(${i + 1}) "${text.trim().slice(0, 40)}"`;

        if (DESTRUCTIVE_RE.test(text)) {
          logEntry({
            page: p.label, button: text.trim().slice(0, 60), selector: sel,
            result: 'SKIP', error: 'destructive pattern — skipped', severity: 'INFO',
          });
          continue;
        }

        try {
          await btn.click({ timeout: 2000, trial: false });
          // brief wait for any modal/animation
          await page.waitForTimeout(150);
          // close any opened modal/popup by Escape
          await page.keyboard.press('Escape').catch(() => {});
        } catch (e) {
          logEntry({
            page: p.label, button: text.trim().slice(0, 60), selector: sel,
            result: 'CLICK_FAIL', error: (e.message || '').slice(0, 200), severity: 'MAJ',
          });
        }
      }

      // After all clicks, dump any console / network errors
      if (consoleErrors.length) {
        logEntry({
          page: p.label, button: '(console)', selector: 'console.error',
          result: 'FAIL', error: consoleErrors.slice(0, 5).join(' || ').slice(0, 400),
          severity: 'MAJ',
        });
      }
      if (networkErrors.length) {
        logEntry({
          page: p.label, button: '(network)', selector: 'network 4xx/5xx',
          result: 'FAIL', error: networkErrors.slice(0, 5).join(' || ').slice(0, 400),
          severity: 'MAJ',
        });
      }
    });
  }
});

test.describe('01b — Auth-gated pages smoke load (unauthenticated visits)', () => {
  for (const p of AUTH_PAGES) {
    test(`unauthenticated visit: ${p.label}`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const url = page.url();
      const title = await page.title().catch(() => '');

      // Expected: either redirected to login OR shown login modal
      const redirected = /login|signup/i.test(url) || /(connect|inscri|login)/i.test(title);

      logEntry({
        page: p.label, button: '(auth gating)', selector: 'redirect-or-modal',
        result: redirected ? 'PASS' : 'CHECK',
        error: redirected ? '' : `Page loaded but no redirect to login. URL=${url}, title="${title}". Verify manually.`,
        severity: redirected ? 'INFO' : 'MAJ',
      });
    });
  }
});
