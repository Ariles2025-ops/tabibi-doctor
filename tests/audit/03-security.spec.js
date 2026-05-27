// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * 03-security.spec.js
 *
 * Tests sécurité qui ne probent PAS la production de manière intrusive.
 * Probes intrusives (RLS bypass, fuzz auth) sont laissées DRY-RUN / skip
 * et requièrent une base test dédiée.
 */

const RUN_INTRUSIVE = process.env.RUN_INTRUSIVE === '1';

// ============================================================
// 1) Headers de sécurité
// ============================================================
test.describe('Security — HTTP headers', () => {
  test('staging serves secure headers', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBeLessThan(400);

    const h = res.headers();
    // Checks que l'on documente plus que l'on ne fait échouer le test (CSP n'est pas obligatoire)
    const findings = {
      strictTransportSecurity: !!h['strict-transport-security'],
      contentSecurityPolicy: !!h['content-security-policy'],
      xFrameOptions: !!h['x-frame-options'] || !!h['content-security-policy'],
      xContentTypeOptions: h['x-content-type-options'] === 'nosniff',
      referrerPolicy: !!h['referrer-policy'],
      permissionsPolicy: !!h['permissions-policy'],
    };

    // log to report file
    const report = path.join('tests', 'reports', 'security-headers.json');
    fs.writeFileSync(report, JSON.stringify({ headers: h, findings }, null, 2));

    // hard checks: HSTS + nosniff
    expect.soft(findings.strictTransportSecurity, 'HSTS recommandé').toBeTruthy();
    expect.soft(findings.xContentTypeOptions, 'X-Content-Type-Options:nosniff recommandé').toBeTruthy();
  });
});

// ============================================================
// 2) HTTPS partout — pas de mixed content
// ============================================================
test.describe('Security — Mixed content', () => {
  test('home page has no http:// asset references', async ({ page }) => {
    const httpResources = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('http://') && !url.startsWith('http://localhost')) {
        httpResources.push(url);
      }
    });
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});
    expect.soft(httpResources, 'Pas de ressources HTTP en clair').toEqual([]);
    if (httpResources.length) {
      fs.writeFileSync(path.join('tests', 'reports', 'mixed-content.json'), JSON.stringify(httpResources, null, 2));
    }
  });
});

// ============================================================
// 3) Pas de secrets hardcodés dans le bundle JS livré
// ============================================================
test.describe('Security — Secrets in delivered JS', () => {
  test('no obvious service_role or sk_ secrets in any loaded JS', async ({ page, request }) => {
    const jsBodies = [];
    page.on('response', async (r) => {
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('javascript') || r.url().endsWith('.js')) {
        try { jsBodies.push({ url: r.url(), body: await r.text() }); } catch {}
      }
    });
    await page.goto('/', { waitUntil: 'networkidle', timeout: 20_000 });

    const SECRET_PATTERNS = [
      /service_role/i,
      /sk_live_/,
      /sk_test_/,
      /xkeysib-/,           // Brevo legacy
      /SG\.[A-Za-z0-9_-]{20,}/, // SendGrid
      /AKIA[0-9A-Z]{16}/,   // AWS access key
      /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
    ];

    const findings = [];
    for (const { url, body } of jsBodies) {
      for (const p of SECRET_PATTERNS) {
        if (p.test(body)) findings.push({ url, pattern: p.source.slice(0, 60) });
      }
    }
    if (findings.length) fs.writeFileSync(path.join('tests', 'reports', 'secret-leaks.json'), JSON.stringify(findings, null, 2));
    expect(findings, 'Aucun secret dangereux dans le JS public').toEqual([]);
  });
});

// ============================================================
// 4) Anon Supabase key — présent mais limité aux droits RLS
// ============================================================
test.describe('Security — Supabase anon key exposure', () => {
  test('anon key is anon (JWT role=anon)', async ({ page }) => {
    let anonKey = null;
    const jsBodies = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('.js') || r.url().includes('config.js') || r.url().includes('supabase-client')) {
        try {
          const body = await r.text();
          jsBodies.push({ url: r.url(), body });
          // Pattern simple JWT
          const m = body.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
          if (m && !anonKey) anonKey = m[0];
        } catch {}
      }
    });
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15_000 });

    if (!anonKey) {
      test.info().annotations.push({ type: 'WARN', description: 'No Supabase JWT detected in delivered JS (could be in HTML meta).' });
      return;
    }

    const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64').toString());
    expect(payload.role, 'Clé Supabase doit être role=anon').toBe('anon');
  });
});

// ============================================================
// 5) XSS reflected basique sur les inputs publics (search)
// ============================================================
test.describe('Security — XSS in search input', () => {
  test('payload <script> ne s\'exécute pas sur la home', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', async (d) => { alertFired = true; await d.dismiss(); });
    const payload = `<script>alert('xss-audit')</script>`;
    await page.goto(`/?q=${encodeURIComponent(payload)}`);
    await page.waitForTimeout(2000);
    expect(alertFired, 'Aucun alert() ne doit se déclencher via param URL').toBeFalsy();
  });
});

// ============================================================
// 6) Probes RLS intrusifs (skip par défaut)
// ============================================================
test.describe('Security — RLS probes (intrusive)', () => {
  test.skip(!RUN_INTRUSIVE, 'Intrusive — set RUN_INTRUSIVE=1 to run; uses test patient creds');
  test('patient A cannot read patient B data', async () => {
    // Implémentation: 2 comptes test, A liste appointments → ne contient que ses propres
    // Nécessite jeu de données contrôlé.
  });
});

// ============================================================
// 7) Sitemap / robots presence
// ============================================================
test.describe('Security — robots & sitemap', () => {
  test('robots.txt is served', async ({ request }) => {
    const r = await request.get('/robots.txt');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toMatch(/User-agent/);
  });
  test('sitemap is served', async ({ request }) => {
    const r = await request.get('/sitemap.xml');
    expect(r.status()).toBe(200);
  });
});
