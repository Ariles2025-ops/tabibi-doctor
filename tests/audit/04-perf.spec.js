// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * 04-perf.spec.js — Performance budget audit.
 *
 * On capture:
 * - Compteur de requêtes réseau total
 * - Compteur de requêtes vers le projet Supabase (regression Phase 16.5)
 * - Poids transféré
 * - Métriques Performance API (TTFB, FCP, LCP via PerformanceObserver — best effort)
 */

const SUPA_HOST_RE = /supabase\.co/;

// Pages clés à mesurer
const TARGETS = [
  { path: '/', label: 'index', budget: { reqs: 60, supaReqs: 5, bytes: 1_500_000 } },
  { path: '/doctor-profile.html?id=241', label: 'doctor-profile', budget: { reqs: 60, supaReqs: 5, bytes: 1_500_000 } },
  { path: '/signup.html', label: 'signup', budget: { reqs: 50, supaReqs: 3, bytes: 1_000_000 } },
  { path: '/login.html', label: 'login', budget: { reqs: 50, supaReqs: 3, bytes: 1_000_000 } },
];

const REPORT_DIR = path.join(process.cwd(), 'tests', 'reports');
const PERF_OUT = path.join(REPORT_DIR, 'perf-results.json');
const perfResults = [];

test.describe('04 — Performance budgets', () => {
  for (const t of TARGETS) {
    test(`budget — ${t.label}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'perf measured on chromium only for consistency');

      let totalReqs = 0;
      let supaReqs = 0;
      let totalBytes = 0;
      page.on('request', (r) => {
        totalReqs++;
        if (SUPA_HOST_RE.test(r.url())) supaReqs++;
      });
      page.on('response', async (r) => {
        try {
          const len = parseInt(r.headers()['content-length'] || '0', 10);
          if (Number.isFinite(len) && len > 0) totalBytes += len;
        } catch {}
      });

      const t0 = Date.now();
      await page.goto(t.path, { waitUntil: 'networkidle', timeout: 30_000 });
      const elapsedMs = Date.now() - t0;

      // Web Vitals best effort
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const out = {};
          try {
            const nav = performance.getEntriesByType('navigation')[0];
            if (nav) {
              out.ttfb = nav.responseStart - nav.requestStart;
              out.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
              out.loadEvent = nav.loadEventEnd - nav.startTime;
            }
            const fcp = performance.getEntriesByName('first-contentful-paint')[0];
            if (fcp) out.fcp = fcp.startTime;
          } catch {}
          // wait briefly for LCP if available
          let lcp = 0;
          try {
            const po = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const last = entries[entries.length - 1];
              if (last) lcp = last.renderTime || last.startTime;
            });
            po.observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => {
              out.lcp = lcp;
              po.disconnect();
              resolve(out);
            }, 1500);
          } catch {
            resolve(out);
          }
        });
      });

      const entry = {
        page: t.label,
        elapsedMs,
        totalReqs,
        supaReqs,
        totalBytesApprox: totalBytes,
        vitals,
        budget: t.budget,
        verdict: {
          reqsOk: totalReqs <= t.budget.reqs,
          supaReqsOk: supaReqs <= t.budget.supaReqs,
          bytesOk: totalBytes <= t.budget.bytes,
        },
      };
      perfResults.push(entry);
      fs.writeFileSync(PERF_OUT, JSON.stringify(perfResults, null, 2));

      // SOFT checks — on log, on n'échoue que pour les régressions critiques (Supabase > budget)
      expect.soft(supaReqs, `Trop de requêtes Supabase sur ${t.label} (régression Phase 16.5?)`).toBeLessThanOrEqual(t.budget.supaReqs);
    });
  }
});
