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

  test("il n'existe PLUS de porte vers du HTML — meme demandee", async ({ page }) => {
    // ⚠️ [17/09/2026] CE QUI A CHANGE, ET POURQUOI.
    //
    // `toast()` portait une porte `{html:true}`, « reservee aux libelles de
    // NOTRE dictionnaire ». Mesure avant de trancher : **un seul appelant**
    // l'empruntait, pour `fav_add` et `fav_rm` — et `fav_rm` ne contenait aucun
    // balisage. `sms_ok`, le troisieme libelle cite, n'avait AUCUN appelant, et
    // annonçait « Confirmation SMS envoyee » alors qu'aucun SMS ne part (P-75).
    //
    // Le commentaire de la fonction disait, quinze lignes plus haut : « on
    // cesse de l'interpreter […] il n'y a rien a oublier ». La porte
    // contredisait cette phrase dans la fonction qui la porte.
    //
    // **Une exception gardee reste une exception** : c'est la seule chose qu'on
    // aura a verifier a chaque relecture, pour toujours. L'icone se demande
    // maintenant par un NOM choisi dans une table interne — rien de ce qui
    // vient de l'appelant n'est interprete.
    await page.goto('/accueil-public.html', ATTENDRE);
    const r = await page.evaluate(() => {
      window.toast("Ajoute aux favoris <i class='fa fa-heart'></i>", 'success', 200, { html: true });
      const t = document.querySelector('#toast-wrap .toast');
      return { coeurs: t.querySelectorAll('i.fa-heart').length, texte: t.textContent };
    });
    expect(r.coeurs, 'la porte vers du HTML est revenue').toBe(0);
    // Et le message reste lisible : on n'a pas remplace le balisage par du vide.
    expect(r.texte).toContain('Ajoute aux favoris');
  });

  test("l'icone se demande par un NOM, jamais par du balisage", async ({ page }) => {
    await page.goto('/accueil-public.html', ATTENDRE);
    const r = await page.evaluate(() => {
      window.toast('Ajoute aux favoris', 'success', 200, { icone: 'coeur' });
      const t = document.querySelector('#toast-wrap .toast');
      return { coeurs: t.querySelectorAll('i.fa-heart').length };
    });
    expect(r.coeurs, 'le coeur des favoris a disparu').toBe(1);
  });

  test("un nom d'icone INCONNU ne produit rien — pas une balise fabriquee", async ({ page }) => {
    // La contre-epreuve de la table : elle doit REFUSER ce qu'elle ne connait
    // pas, au lieu de construire une classe a partir de l'entree.
    await page.goto('/accueil-public.html', ATTENDRE);
    const r = await page.evaluate(() => {
      window.toast('Message', 'info', 200, { icone: 'fa-bomb" onload="window.__xss=1' });
      const t = document.querySelector('#toast-wrap .toast');
      return { icones: t.querySelectorAll('i').length, xss: window.__xss };
    });
    expect(r.icones, 'une icone a ete fabriquee a partir de l entree').toBe(1);  // celle du type
    expect(r.xss).toBeUndefined();
  });

  test("AUCUN appel du produit ne demande le rendu HTML", async ({ page }) => {
    // La porte n'existe plus : plus aucun appel ne doit la reclamer.
    const src = await page.request.get('/js/home-app.js').then((r) => r.text());
    const sansCommentaires = src
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    const appels = sansCommentaires.match(/toast\([^;]*\{\s*html\s*:\s*true\s*\}\s*\)/g) || [];
    expect(appels, `un appel reclame de nouveau du HTML : ${appels[0] || ''}`).toHaveLength(0);
  });
});
