const { test, expect } = require('@playwright/test');
test('le point de passage est charge et normalise', async ({ page }) => {
  await page.route('**/js/auth.js', r => r.fulfill({status:200, contentType:'application/javascript',
    body:`window.tabibi=window.tabibi||{};window.tabibi.auth={requireAuth:async()=>({id:'fx'}),getUser:async()=>null,logout:async()=>{}};`}));
  await page.route('**/*.supabase.co/**', r => r.abort());
  await page.goto('/mes-rdv.html');
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
