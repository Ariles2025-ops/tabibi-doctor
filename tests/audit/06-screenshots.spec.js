// @ts-check
import { test } from '@playwright/test';
import path from 'path';

/**
 * 06-screenshots.spec.js — Captures plein écran de toutes les pages publiques
 * en 3 viewports (via les projets `chromium-desktop`, `chromium-tablet`, `chromium-mobile`).
 */

const PAGES = [
  { path: '/', label: 'index' },
  { path: '/signup.html', label: 'signup' },
  { path: '/login.html', label: 'login' },
  { path: '/forgot-password.html', label: 'forgot-password' },
  { path: '/about.html', label: 'about' },
  { path: '/doctor-profile.html?id=241', label: 'doctor-profile' },
  { path: '/reservation.html', label: 'reservation' },
  { path: '/appointment.html', label: 'appointment' },
  { path: '/doctor-claim.html', label: 'doctor-claim' },
  { path: '/teleconsultation.html', label: 'teleconsult' },
  { path: '/waiting-list.html', label: 'waiting-list' },
  { path: '/legal/cgu.html', label: 'legal-cgu' },
  { path: '/legal/confidentialite.html', label: 'legal-confid' },
  { path: '/legal/cookies.html', label: 'legal-cookies' },
];

// Note: tests/screenshots est nettoyé par PW (outputDir); on écrit dans tests/visual/
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'visual');
import fs from 'fs';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('06 — Screenshots full page', () => {
  for (const p of PAGES) {
    test(`shot: ${p.label}`, async ({ page, browserName }, info) => {
      const projectName = info.project.name;
      // On ne capture qu'avec les projets chromium-* pour rester rapide
      test.skip(!projectName.startsWith('chromium-'), 'only chromium projects');
      await page.goto(p.path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(1500);
      const file = path.join(SCREENSHOT_DIR, `${p.label}_${projectName}.png`);
      await page.screenshot({ path: file, fullPage: true });
    });
  }
});
