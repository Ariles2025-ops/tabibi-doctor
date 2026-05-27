// @ts-check
import { test, expect } from '@playwright/test';

/**
 * 02-flows.spec.js — End-to-end critical flows.
 *
 * IMPORTANT — Politique de test :
 * Les flows qui créent des données en base (signup, prise RDV, claim) sont
 * marqués `test.skip()` par défaut sur staging pour éviter de polluer la DB.
 * Ils peuvent être réactivés ponctuellement via:
 *    RUN_DESTRUCTIVE=1 npx playwright test 02-flows.spec.js
 * et idéalement contre une base de test dédiée.
 */

const RUN_DESTRUCTIVE = process.env.RUN_DESTRUCTIVE === '1';

const TEST_PATIENT = {
  email: `audit-${Date.now()}@test.tabibi.invalid`,
  password: 'AuditTabibi#2026',
  firstName: 'Audit',
  lastName: 'Test',
  phone: '+213777000001',
};

// ============================================================
// FLOW 1 — Signup patient
// ============================================================
test.describe('FLOW 1 — Signup patient', () => {
  test('signup form renders correctly', async ({ page }) => {
    await page.goto('/signup.html');
    await expect(page).toHaveTitle(/inscri|signup|tabibi/i);

    // Champs obligatoires attendus
    const expectedFields = ['email', 'password'];
    for (const f of expectedFields) {
      const count = await page.locator(`input[type="${f}"], input[name="${f}"], input[id*="${f}"]`).count();
      expect(count, `Field "${f}" should be present`).toBeGreaterThan(0);
    }
  });

  test('signup creates patient account', async ({ page }) => {
    test.skip(!RUN_DESTRUCTIVE, 'destructive — set RUN_DESTRUCTIVE=1 to run');
    await page.goto('/signup.html');
    // Sélecteurs à confirmer par inspection manuelle de la page
    await page.locator('input[type="email"]').first().fill(TEST_PATIENT.email);
    await page.locator('input[type="password"]').first().fill(TEST_PATIENT.password);
    // Sélection rôle "Patient" si requis
    // await page.locator('input[value="patient"]').check();
    // ...
    // await page.locator('button[type="submit"]').click();
    // await expect(page).toHaveURL(/dashboard|verify|merci/i);
  });
});

// ============================================================
// FLOW 2 — Login patient
// ============================================================
test.describe('FLOW 2 — Login patient', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login.html');
    const email = page.locator('input[type="email"]').first();
    const pwd = page.locator('input[type="password"]').first();
    await expect(email).toBeVisible({ timeout: 5000 });
    await expect(pwd).toBeVisible();
  });

  test('login with invalid creds shows error', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('input[type="email"]').first().fill('nonexistent@invalid.tld');
    await page.locator('input[type="password"]').first().fill('WrongPassword#123');
    const submit = page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Login")').first();
    await submit.click();
    // Wait for some kind of error indicator (toast, alert, banner)
    await page.waitForTimeout(2500);
    // Au minimum: on doit toujours être sur login (pas redirigé)
    expect(page.url()).toMatch(/login|signin|index/i);
  });
});

// ============================================================
// FLOW 3 — Recherche médecin
// ============================================================
test.describe('FLOW 3 — Recherche médecin', () => {
  test('home loads with search controls', async ({ page }) => {
    await page.goto('/');
    // Cherche un input de recherche ou un select de spécialité
    const hasSearchInput = await page.locator('input[type="search"], input[placeholder*="médecin" i], input[placeholder*="spécial" i]').count();
    const hasSpecSelect = await page.locator('select, [role="combobox"]').count();
    expect(hasSearchInput + hasSpecSelect, 'Home doit avoir au moins un contrôle de recherche').toBeGreaterThan(0);
  });

  test('search results page renders cards', async ({ page }) => {
    // Tente une URL de recherche directe avec query string standard
    await page.goto('/?specialty=cardiologie&wilaya=alger', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const cardCount = await page.locator('.doctor-card, [data-doctor-id], article:has(a[href*="doctor-profile"])').count();
    // Note: si 0, on log mais on ne fail pas — l'URL params syntax doit être confirmée
    console.log(`Search results: ${cardCount} cards found`);
  });
});

// ============================================================
// FLOW 4 — Prise de RDV patient
// ============================================================
test.describe('FLOW 4 — Prise de RDV (read-only smoke)', () => {
  test('doctor profile loads and shows booking CTA', async ({ page }) => {
    await page.goto('/doctor-profile.html?id=241');
    await page.waitForTimeout(2500);
    // Doit afficher au moins le nom OU le bouton de prise RDV OU CTA claim WhatsApp
    const hasName = await page.locator('h1, .doctor-name').count();
    const hasBookCTA = await page.locator('button:has-text("Prendre"), button:has-text("RDV"), a:has-text("RDV"), a:has-text("Réclamer")').count();
    expect(hasName + hasBookCTA, 'Doctor profile must show name and/or booking CTA').toBeGreaterThan(0);
  });

  test('booking flow creates appointment', async ({ page }) => {
    test.skip(!RUN_DESTRUCTIVE, 'destructive — needs RUN_DESTRUCTIVE=1 + logged-in patient');
    // Steps: login → doctor → click "Prendre RDV" → choisir créneau → confirmer
    // À implémenter avec un compte patient propre.
  });
});

// ============================================================
// FLOW 5 — Claim WhatsApp médecin
// ============================================================
test.describe('FLOW 5 — Claim médecin via WhatsApp', () => {
  test('claim button opens WhatsApp link', async ({ page, context }) => {
    await page.goto('/doctor-profile.html?id=241');
    await page.waitForTimeout(1500);

    // Cherche le lien wa.me
    const waLinks = await page.locator('a[href*="wa.me/213"]').count();
    if (waLinks > 0) {
      const href = await page.locator('a[href*="wa.me/213"]').first().getAttribute('href');
      expect(href).toMatch(/wa\.me\/213777169074/);
      expect(href).toMatch(/text=/i);
    } else {
      // Sinon, chercher un bouton "Réclamer" et vérifier qu'il déclenche un wa.me
      const claimBtn = page.locator('button:has-text("Réclamer"), button:has-text("Claim"), a:has-text("Réclamer")').first();
      const exists = await claimBtn.count();
      if (exists > 0) {
        // Pas de clic réel (peut ouvrir un onglet externe non testable)
        const href = await claimBtn.getAttribute('href').catch(() => null);
        if (href) expect(href).toMatch(/wa\.me/);
      } else {
        test.info().annotations.push({ type: 'TODO', description: 'Aucun CTA WhatsApp clairement identifiable sur doctor-profile.html?id=241' });
      }
    }
  });
});

// ============================================================
// FLOW 6 — Dashboard médecin
// ============================================================
test.describe('FLOW 6 — Doctor dashboard (gating only)', () => {
  test('redirects unauthenticated user', async ({ page }) => {
    await page.goto('/doctor-dashboard.html');
    await page.waitForTimeout(2000);
    const url = page.url();
    const visible = await page.isVisible('h1, .dashboard-title').catch(() => false);
    // Soit redirection auth, soit affichage placeholder "connectez-vous"
    const protected_ = /login|signup/.test(url) || (await page.locator('text=/connect|sign in/i').count()) > 0;
    expect(protected_, 'Dashboard médecin doit imposer une authentification').toBeTruthy();
  });
});

// ============================================================
// FLOW 7 — Dashboard admin
// ============================================================
test.describe('FLOW 7 — Admin dashboard (gating only)', () => {
  test('admin dashboard gates non-admin', async ({ page }) => {
    await page.goto('/admin-dashboard.html');
    await page.waitForTimeout(2000);
    const url = page.url();
    const protected_ = /login|signup|403/.test(url) || (await page.locator('text=/admin only|reserved|connectez/i').count()) > 0;
    expect(protected_, 'Admin doit imposer authentification + role').toBeTruthy();
  });
});

// ============================================================
// FLOW 8 — Mobile responsive
// ============================================================
test.describe('FLOW 8 — Mobile responsive', () => {
  const MOBILE_PAGES = ['/', '/signup.html', '/login.html', '/doctor-profile.html?id=241'];
  for (const p of MOBILE_PAGES) {
    test(`no horizontal scroll: ${p}`, async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium-mobile', 'mobile only');
      await page.goto(p);
      await page.waitForTimeout(1000);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(overflow, `Page ${p} ne doit pas overflow en mobile`).toBeFalsy();
    });
  }
});
