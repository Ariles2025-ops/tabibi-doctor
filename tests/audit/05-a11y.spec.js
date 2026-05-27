// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

/**
 * 05-a11y.spec.js — Accessibility audit via axe-core (WCAG 2.1 AA).
 */

const PAGES = [
  { path: '/', label: 'index' },
  { path: '/signup.html', label: 'signup' },
  { path: '/login.html', label: 'login' },
  { path: '/doctor-profile.html?id=241', label: 'doctor-profile' },
  { path: '/reservation.html', label: 'reservation' },
  { path: '/legal/cgu.html', label: 'legal-cgu' },
  { path: '/about.html', label: 'about' },
];

const REPORT_DIR = path.join(process.cwd(), 'tests', 'reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const a11yResults = [];

test.describe('05 — Accessibility (axe-core)', () => {
  for (const p of PAGES) {
    test(`a11y scan: ${p.label}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'axe scan on chromium only');
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = {
        page: p.label,
        url: p.path,
        violations: results.violations.length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        topIssues: results.violations.slice(0, 10).map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          count: v.nodes.length,
        })),
      };

      a11yResults.push(summary);
      fs.writeFileSync(path.join(REPORT_DIR, 'a11y-results.json'), JSON.stringify(a11yResults, null, 2));

      // Soft: on documente mais on ne bloque pas
      const critical = results.violations.filter((v) => v.impact === 'critical');
      expect.soft(critical, `${p.label}: violations a11y CRITICAL`).toEqual([]);
    });
  }
});
