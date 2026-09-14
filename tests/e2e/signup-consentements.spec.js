// =====================================================================
// L'inscription ECRIT le registre de consentement
// =====================================================================
// `public.consents_log` a existe des mois en etant VIDE : `record_consent`
// n'etait appelee nulle part. Les consentements vivaient comme quatre
// horodatages sur `public.users` — QUAND, et rien d'autre : ni version, ni
// source, ni refus, ni revocation.
//
// CE QUE CE TEST GARDE :
//   1. les SCOPES sont ceux que la contrainte de la table accepte — 'cgu' et
//      non 'terms', 'marketing_email' et non 'marketing' ;
//   2. un REFUS s'ecrit (granted:false), il ne s'omet pas : ne rien ecrire ne
//      prouverait pas le refus ;
//   3. `health_data_processing` ne part QUE pour un patient ;
//   4. un echec de journalisation N'ARRETE PAS l'inscription, mais NE SE TAIT
//      PAS — un registre incomplet dont personne n'est averti est un registre
//      faux.
//
// ---------------------------------------------------------------------
// CE QUE CE TEST NE PROUVE PAS
// ---------------------------------------------------------------------
// Aucun compte n'est cree, aucun reseau ne part vers Supabase : tout est
// bouchonne par des routes Playwright, comme dans les autres specs de cette
// suite. Le test garde ce que LA PAGE ENVOIE. Il ne prouve ni que
// `record_consent` accepte ces scopes en base (la contrainte a ete LUE, pas
// jouee), ni que la ligne atterrit dans `consents_log`.
// =====================================================================
const { test, expect } = require('@playwright/test');

// Un compte qui vient d'etre cree cote Supabase, sans aucun reseau reel.
const UID = '00000000-0000-0000-0000-0000000000aa';

async function poser(page, { role, marketing, echecScope }) {
  const appels = [];

  await page.route('**/*.supabase.co/**', (route) => route.abort());

  // `record_consent` : on capture ce que la page envoie.
  await page.route('**/rest/v1/rpc/record_consent', (route) => {
    let corps = {};
    try { corps = JSON.parse(route.request().postData() || '{}'); } catch (e) { corps = {}; }
    appels.push(corps);
    if (echecScope && corps.p_scope === echecScope) {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ code: '42501', message: 'not_authenticated' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, scope: corps.p_scope }) });
  });

  await page.addInitScript(([r, m, uid]) => {
    localStorage.setItem('tabibi_lang', 'fr');
    // On n'ouvre pas le vrai parcours d'inscription (OTP, captcha, reseau) :
    // on appelle la fonction de journalisation de la page, telle qu'elle est.
    window.__fixture = { role: r, marketingConsent: m, uid };
  }, [role, marketing, UID]);

  return appels;
}

// La page expose `journaliserConsentements(P)` et `toastM`. On les utilise tels
// quels : c'est le code reel de signup.html qui tourne.
async function journaliser(page) {
  return page.evaluate(async () => {
    const vus = [];
    const origine = window.toastM;
    window.toastM = function (msg, niveau) { vus.push({ msg: msg, niveau: niveau }); };
    await window.journaliserConsentements({
      role: window.__fixture.role,
      marketingConsent: window.__fixture.marketingConsent
    });
    window.toastM = origine;
    return vus;
  });
}

test.describe('inscription — le registre de consentement', () => {

  test('patient : quatre scopes, et ceux que la table accepte', async ({ page }) => {
    const appels = await poser(page, { role: 'patient', marketing: true });
    await page.goto('/signup.html');
    await journaliser(page);

    expect(appels.map((a) => a.p_scope)).toEqual([
      'cgu', 'privacy', 'health_data_processing', 'marketing_email'
    ]);
    // 'terms' et 'marketing' NE SONT PAS dans la contrainte de la table.
    expect(appels.map((a) => a.p_scope)).not.toContain('terms');
    expect(appels.map((a) => a.p_scope)).not.toContain('marketing');

    for (const a of appels) {
      expect(a.p_version).toBe('1.0');
      expect(a.p_source).toBe('signup');
      expect(['fr', 'ar', 'en']).toContain(a.p_locale);
      expect(a.p_ip).toBeNull();                       // on n'invente pas l'IP
      expect(String(a.p_user_agent).length).toBeLessThanOrEqual(300);
    }
    expect(appels.every((a) => a.p_granted === true)).toBe(true);
  });

  test('UN REFUS S ECRIT : marketing decoche part avec granted=false', async ({ page }) => {
    const appels = await poser(page, { role: 'patient', marketing: false });
    await page.goto('/signup.html');
    await journaliser(page);

    const mk = appels.find((a) => a.p_scope === 'marketing_email');
    expect(mk).toBeTruthy();          // il PART, il n'est pas omis
    expect(mk.p_granted).toBe(false); // et il dit non
  });

  test('medecin : trois scopes, pas de donnees de sante', async ({ page }) => {
    const appels = await poser(page, { role: 'medecin', marketing: false });
    await page.goto('/signup.html');
    await journaliser(page);

    expect(appels.map((a) => a.p_scope)).toEqual(['cgu', 'privacy', 'marketing_email']);
    expect(appels.map((a) => a.p_scope)).not.toContain('health_data_processing');
  });

  test('un echec ne bloque pas l inscription, mais ne se tait pas', async ({ page }) => {
    const appels = await poser(page, { role: 'patient', marketing: true, echecScope: 'privacy' });
    await page.goto('/signup.html');
    const toasts = await journaliser(page);

    // Les quatre partent quand meme : un echec n'interrompt pas la boucle.
    expect(appels).toHaveLength(4);
    // Et l'utilisateur est averti — pas de catch mort, pas de silence.
    expect(toasts).toHaveLength(1);
    expect(toasts[0].niveau).toBe('error');
    expect(toasts[0].msg).toContain('régularisée');
  });
});
