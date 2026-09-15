// =====================================================================
// Un message d'erreur du serveur ne s'execute pas dans le navigateur
// =====================================================================
// [14/09/2026] Le chemin complet d'un XSS reflechi existait sur la page de
// reservation, et il tenait en trois lignes :
//
//     var _bkMsg = _bkServerError ? (" (" + String(_bkServerError).slice(0,160) + ")") : "";
//     toast("<i …></i> Echec de la reservation…" + _bkMsg, "error", 8000);
//     ...
//     t.innerHTML = `<i class='fa …'></i>${msg}`;
//
// `_bkServerError` est un message d'erreur **du serveur**. Une erreur Postgres
// cite volontiers la valeur qui l'a provoquee — c'est-a-dire une saisie de
// l'utilisateur, renvoyee au navigateur et **rendue comme du HTML**.
//
// ---------------------------------------------------------------------
// POURQUOI CE TEST N'EST PAS UNE LECTURE DE SOURCE
// ---------------------------------------------------------------------
// On pourrait verifier que `innerHTML` a disparu du fichier. Ca prouverait un
// mot, pas une propriete : la ligne peut revenir sous une autre forme, ou
// ailleurs. **Ici, on tente reellement l'injection** et on constate que rien
// ne s'execute — c'est la seule facon de le savoir.
//
// Et on ne « nettoie » pas le message : on cesse de l'interpreter. Un
// assainisseur est une liste de ce qu'on a pense a interdire ; `textContent`
// n'interprete rien, et il n'y a rien a oublier.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const CHARGES = [
  '<img src=x onerror="window.__xss=1">',
  '<script>window.__xss=1<\/script>',
  '<svg onload="window.__xss=1">',
  "<iframe srcdoc=\"<script>parent.__xss=1<\\/script>\"></iframe>",
];

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

test.describe("le toast n'execute pas ce qu'on lui donne", () => {

  for (const charge of CHARGES) {
    test(`charge refusee : ${charge.slice(0, 28)}…`, async ({ page }) => {
      await page.goto('/accueil-public.html', ATTENDRE);
      await page.waitForTimeout(400);

      const r = await page.evaluate((c) => {
        window.__xss = 0;
        // Exactement ce que fait le chemin d'echec de reservation : un message
        // du serveur concatene a du texte a nous.
        window.toast('Echec de la reservation — le rendez-vous n\'a PAS ete enregistre. (' + c + ')', 'error', 200);
        const t = document.querySelector('#toast-wrap .toast');
        return {
          xss: window.__xss,
          texte: t ? t.textContent : '',
          // Ce qui compte n'est pas la chaine serialisee — `innerHTML` re-echappe
          // la charge, donc « onerror= » y reapparait sous une forme inoffensive
          // et un test sur la chaine crierait a tort. Ce qui compte, c'est
          // qu'AUCUN ELEMENT n'ait ete cree.
          elements: t ? t.querySelectorAll('img, script, iframe, svg, object, embed').length : -1,
        };
      }, charge);

      // 1. Rien ne s'est execute.
      expect(r.xss, `la charge « ${charge} » s'est executee`).toBe(0);
      // 2. Le message reste LISIBLE — on ne l'a pas mange, on l'a affiche
      //    tel quel. Un message d'erreur tronque par la defense est un message
      //    d'erreur perdu.
      expect(r.texte).toContain("n'a PAS ete enregistre");
      expect(r.texte).toContain(charge);
      // 3. Et la charge n'a cree AUCUN element : elle est restee du texte.
      expect(r.elements, 'la charge a produit des elements dans le DOM').toBe(0);
    });
  }

  test("l'icone est bien la — la defense n'a pas casse l'affichage", async ({ page }) => {
    await page.goto('/accueil-public.html', ATTENDRE);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      window.toast('Un message ordinaire', 'error', 200);
      const t = document.querySelector('#toast-wrap .toast');
      return { classes: t.className, icone: !!t.querySelector('i.fa'), texte: t.textContent };
    });
    expect(r.icone, "l'icone du toast a disparu").toBe(true);
    expect(r.classes).toContain('toast-error');
    expect(r.texte).toBe('Un message ordinaire');
  });

  test("les libelles de NOTRE dictionnaire gardent leur balisage", async ({ page }) => {
    // Trois entrees du dictionnaire portent volontairement une icone
    // (`fav_add`, `fav_rm`, `sms_ok`). Elles passent par une porte explicite.
    // Le point : cette porte existe, et elle est la SEULE voie vers du HTML.
    await page.goto('/accueil-public.html', ATTENDRE);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      window.toast("Ajoute aux favoris <i class='fa fa-heart'></i>", 'success', 200, { html: true });
      const t = document.querySelector('#toast-wrap .toast');
      return { coeurs: t.querySelectorAll('i.fa-heart').length };
    });
    expect(r.coeurs, 'le balisage volontaire du dictionnaire est perdu').toBe(1);
  });

  test("AUCUN appel du produit ne demande le rendu HTML avec une donnee externe", async ({ page }) => {
    // La porte `{html:true}` est une exception : elle ne doit servir qu'a des
    // chaines litterales ou a `T(...)`. Si un jour quelqu'un y passe une
    // variable, ce test le dit — c'est la porte qui redeviendrait le trou.
    const src = await page.request.get('/js/home-app.js').then((r) => r.text());
    const appels = src.match(/toast\([^;]*\{\s*html\s*:\s*true\s*\}\s*\)/g) || [];
    expect(appels.length, 'aucun appel opt-in trouve : le test ne garde plus rien')
      .toBeGreaterThan(0);
    for (const a of appels) {
      const premier = a.slice(6, a.indexOf(','));
      expect(premier.trim(), `rendu HTML demande pour une expression non litterale : ${a.slice(0, 70)}`)
        .toMatch(/^(T\(|["'`])/);
    }
  });
});
