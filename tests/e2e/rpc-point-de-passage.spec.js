const { test, expect } = require('@playwright/test');
// [14/09/2026] AUCUNE REQUETE HORS LOCALHOST. Voir tests/e2e/_hermetique.js :
// la CI rougissait sur une dependance reseau (Sentry CDN sur chaque page,
// Turnstile sur les pages d'authentification) que le local ne voyait pas.
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
});
// [14/09/2026] `waitUntil: 'domcontentloaded'` PARTOUT, et ce n'est pas cosmetique.
// Sans lui, Playwright attend l'evenement `load`, qui inclut les CDN TIERS :
// `js/tabibi-sentry.js` charge le SDK depuis browser.sentry-cdn.com sur CHAQUE
// page, et les pages d'authentification chargent en plus Cloudflare Turnstile.
// Mesure du 14/09, CDN simule a 20 s de latence : 20,1 s par navigation contre
// 0,1 s en `domcontentloaded`. C'est ce qui a fait rougir la CI (~173 s) alors
// que le local etait vert — un CDN rapide chez moi, lent sur le runner.
// **Un test e2e ne mesure pas la latence d'un tiers.**

test('le point de passage est charge et normalise', async ({ page }) => {
  await page.route('**/js/auth.js', r => r.fulfill({status:200, contentType:'application/javascript',
    body:`window.tabibi=window.tabibi||{};window.tabibi.auth={requireAuth:async()=>({id:'fx'}),getUser:async()=>null,logout:async()=>{}};`}));
  await page.route('**/*.supabase.co/**', r => r.abort());
  await page.goto('/mes-rdv.html', ATTENDRE);
  await page.waitForFunction(()=>typeof window.tabibiRpc==='function', null, {timeout:5000});
  const r = await page.evaluate(async () => {
    window.tabibi = window.tabibi || {};
    const faux = (rep) => ({ rpc: async () => rep });
    const out = {};
    window.tabibi.supabase = faux({ data: { error: 'no_pending_invitation' }, error: null });
    out.metier = await window.tabibiRpc('x');
    window.tabibi.supabase = faux({ data: { ok: false }, error: null });
    out.okFalse = await window.tabibiRpc('x');
    window.tabibi.supabase = faux({ data: { ok: true, v: 1 }, error: null });
    out.succes = await window.tabibiRpc('x');
    window.tabibi.supabase = faux({ data: null, error: { message: 'reseau' } });
    out.transport = await window.tabibiRpc('x');
    return out;
  });
  expect(r.metier).toEqual({ ok:false, data:null, erreur:'no_pending_invitation' });
  expect(r.okFalse).toEqual({ ok:false, data:null, erreur:'refus' });
  expect(r.succes.ok).toBe(true);
  expect(r.succes.data).toEqual({ ok:true, v:1 });
  expect(r.transport).toEqual({ ok:false, data:null, erreur:'reseau' });
  console.log('   normalisation :', JSON.stringify(r));
});
