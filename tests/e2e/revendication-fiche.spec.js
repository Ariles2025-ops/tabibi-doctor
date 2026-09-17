// =====================================================================
// 75 035 fiches, une seule revendiquée — le tunnel n'avait pas de porte
// =====================================================================
// ⚠️ CE N'EST PAS UNE RÉPARATION, C'EST UNE BRIQUE MANQUANTE.
//
// Le tunnel de revendication existe depuis des semaines : `doctor-claim.html`,
// la RPC `claim_my_doctor_profile`, la gestion d'erreurs, le dépôt de pièces.
// Et la fiche publique — la page qu'un médecin trouve en cherchant son propre
// nom — n'y menait **pas** : elle ne proposait que « Par WhatsApp ».
//
// ⚠️ MISE À JOUR DU 18/09 : ce chemin WhatsApp a été **retiré** (décision
// d'Aghiles — un médecin parti sur WhatsApp ne crée pas de compte). Le bloc ne
// porte donc plus qu'un seul appel : le tunnel. L'essai qui exigeait WhatsApp
// a été retourné en essai qui l'interdit, au même endroit.
//
// Lu en base : la vue `public_doctors` expose déjà `is_claimed`, et même
// `show_claim_badge` = `NOT COALESCE(dp.is_claimed, false)` — une colonne
// écrite exprès pour ça. Le signal était là ; c'est l'entrée qui manquait.
//
// ---------------------------------------------------------------------
// CE QUE CES ESSAIS GARDENT
// ---------------------------------------------------------------------
// 1. Une fiche NON revendiquée montre l'appel, et il mène au tunnel avec la
//    fiche **pré-remplie** (`?legacy_id=N`, le paramètre que `doctor-claim`
//    attend déjà).
// 2. Une fiche revendiquée ne le montre **pas** — on n'invite pas à revendiquer
//    ce qui l'est déjà.
// 3. **Aucune donnée privée** dans le bloc : ni téléphone, ni e-mail, ni adresse
//    précise. C'est la moitié qu'on oublie en ajoutant un encart sur une page
//    publique.
//
// **Ce qu'ils ne prouvent pas :** que la revendication aboutisse. La RPC
// `claim_my_doctor_profile` est hors de ce lot ; ici on garde la PORTE.
// =====================================================================
const { test, expect } = require('@playwright/test');
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

// ⚠️ ACCENTS : on compare toujours du NFC à du NFC. Un « é » composé (U+00E9)
// et un « é » décomposé (e + U+0301) s'affichent pareil et ne s'égalent pas —
// une garde écrite sans ça reste verte sur du texte qu'elle croit avoir lu.
const nfc = (s) => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();

/** Ce que rend la vue `public_doctors` — avec du PRIVÉ qui ne doit pas sortir. */
function fiche(surcharge) {
  return {
    id: UUID, legacy_id: 4242,
    full_name: 'BENALI Mohamed', full_name_ar: 'بن علي محمد',
    entity_type: 'doctor',
    specialty_fr: 'Cardiologue', specialty_slug: 'cardiologue',
    wilaya_fr: 'Alger', wilaya_code: 16, city: 'Alger-Centre',
    languages: ['fr', 'ar'], rating: null, review_count: 0,
    is_verified: false, is_claimed: false, validation_status: null,
    accepts_cash: true,
    // ⚠️ VOLONTAIREMENT PLUS SALE QUE LA RÉALITÉ. Lu en base le 17/09 :
    // `public_doctors` n'expose **ni** `phone` **ni** `email`, et aucune des
    // 75 034 fiches non revendiquées ne porte d'`address`. Ces champs ne
    // peuvent donc pas arriver aujourd'hui — l'essai garde le FRONT pour le
    // jour où la vue en laissera passer un. Une garde qui n'éprouve que ce qui
    // ne peut pas arriver ne garde rien.
    phone: '+213555112233', email: 'benali.prive@example.test',
    address: '12 rue Privee, Hydra',
    ...surcharge,
  };
}

/**
 * Ouvre la fiche publique avec une ligne bouchonnée.
 *
 * ⚠️ Le bouchon est posé DANS le test, donc APRÈS `hermetiser` : Playwright
 * essaie les routes de la plus récente à la plus ancienne, celle-ci gagne.
 * Et `maybeSingle()` accepte un tableau d'une ligne — c'est ce que la RPC
 * renvoie réellement, on ne bouchonne pas une forme plus commode.
 */
async function ouvrir(page, surcharge) {
  await page.route('**/rest/v1/rpc/praticien*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([fiche(surcharge)]),
  }));
  await page.goto(`/doctor-profile.html?id=${UUID}`, ATTENDRE);
}

/** Attend le bloc — un fait posé après la réponse, jamais une durée fixe. */
const attendreLeBloc = (page) =>
  expect(page.locator('#claim-status-block')).toBeAttached({ timeout: 10000 });

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => { try { localStorage.setItem('tabibi_lang', 'fr'); } catch (e) {} });
});

test.describe('revendiquer sa fiche depuis la fiche publique', () => {

  test('fiche NON revendiquée : l’appel est là, et il mène au tunnel', async ({ page }) => {
    await ouvrir(page, { is_claimed: false });
    await attendreLeBloc(page);

    await expect(page.locator('#claim-cta')).toBeVisible();
    expect(nfc(await page.locator('#claim-cta').innerText()))
      .toContain(nfc('Vous êtes ce médecin ?'));

    const lien = page.locator('#claim-cta-link');
    await expect(lien).toBeVisible();
    // ⚠️ LA FICHE DOIT ÊTRE PRÉ-REMPLIE. Sans le paramètre, le médecin retombe
    // sur une recherche manuelle parmi 75 035 fiches — c'est-à-dire sur
    // l'obstacle exact qu'on essaie de retirer.
    await expect(lien).toHaveAttribute('href', 'doctor-claim.html?legacy_id=4242');
    expect(nfc(await lien.innerText())).toContain(nfc('Revendiquer ma fiche'));
  });

  test('AUCUN chemin WhatsApp dans le bloc — un seul appel, le tunnel', async ({ page }) => {
    // ══════════════════════════════════════════════════════════════════
    // ⚠️ CET ESSAI DISAIT L'INVERSE, ET C'EST MOI QUI L'AVAIS ÉCRIT
    // ══════════════════════════════════════════════════════════════════
    // Version du 17/09 : « WhatsApp reste, en SECOND — on ajoute une porte, on
    // n'en ferme pas une ». L'argument tenait côté parcours : c'est un chemin
    // qui aboutit, avec un humain au bout.
    //
    // Il rate ce qui compte ici. **Un médecin parti sur WhatsApp ne crée pas de
    // compte** : il écrit à une équipe, quelqu'un lui répond à la main, et la
    // plateforme n'a gagné ni utilisateur ni fiche revendiquée. Décision
    // d'Aghiles le 18/09 — et c'est son arbitrage, pas le mien.
    //
    // L'essai est **retourné**, pas supprimé : la trace de la décision reste
    // lisible là où elle s'applique.
    await ouvrir(page, { is_claimed: false });
    await attendreLeBloc(page);

    expect(await page.locator('#claim-cta-wa').count(),
      'le chemin WhatsApp est revenu dans le bloc de revendication').toBe(0);

    const bloc = page.locator('#claim-status-block');
    const liens = await bloc.locator('a').evaluateAll(
      (as) => as.map((a) => a.getAttribute('href') || '').join(' '));
    expect(liens, 'un lien WhatsApp subsiste dans le bloc').not.toMatch(/wa\.me|whatsapp/i);
    expect(nfc(await bloc.innerText()), 'le bloc parle encore de WhatsApp')
      .not.toMatch(/whatsapp/i);

    // ⚠️ ET L'APPEL RESTANT MÈNE TOUJOURS AU TUNNEL. Retirer un chemin sans
    // vérifier l'autre laisserait un bloc sans aucune issue.
    await expect(page.locator('#claim-cta-link'))
      .toHaveAttribute('href', 'doctor-claim.html?legacy_id=4242');
  });

  test('les autres usages WhatsApp du dépôt ne sont PAS touchés', async ({ page }) => {
    // ⚠️ La contre-épreuve du retrait. « Retirer WhatsApp » pris au pied de la
    // lettre aurait coupé le formulaire de cas urgent — un canal qui n'a rien à
    // voir avec l'inscription et où quelqu'un attend une réponse. Ce qui est
    // retiré, c'est le chemin qui REMPLACE une inscription, pas la messagerie.
    // ⚠️ ON RETIRE LES COMMENTAIRES D'ABORD, ET C'EST UNE CORRECTION, PAS UN
    // ORNEMENT. Ma première version lisait le HTML brut : en coupant pour de
    // vrai le lien de `cas-grave.html` (contre-épreuve), l'essai RESTAIT VERT —
    // parce qu'un commentaire du fichier contient « wa.me ». Une garde qui lit
    // les commentaires se rassure toute seule. Douzième fois dans ce dépôt.
    const nu = (t) => t
      .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    const urgence = nu(await page.request.get('/cas-grave.html').then((r) => r.text()));
    expect(urgence, 'le canal WhatsApp des cas urgents a disparu').toMatch(/wa\.me/);

    const partage = nu(await page.request.get('/waiting-list.html').then((r) => r.text()));
    expect(partage, 'le partage de la liste d’attente a disparu').toMatch(/wa\.me/);
  });

  test('fiche DÉJÀ revendiquée : aucun appel à revendiquer', async ({ page }) => {
    await ouvrir(page, { is_claimed: true });
    await attendreLeBloc(page);

    expect(await page.locator('#claim-cta').count(),
      'on invite a revendiquer une fiche qui l’est deja').toBe(0);
    expect(await page.locator('#claim-cta-link').count()).toBe(0);
    expect(await page.locator('#claim-cta-wa').count()).toBe(0);
    // Et on dit ce qui est vrai à sa place.
    expect(nfc(await page.locator('#claim-status-block').innerText()))
      .toContain(nfc('Fiche revendiquée par le médecin'));
  });

  test('le bloc n’expose AUCUNE donnée privée', async ({ page }) => {
    // ⚠️ La moitié qu'on oublie en ajoutant un encart sur une page publique.
    // La ligne bouchonnée porte un téléphone, un e-mail et une adresse précise :
    // aucun ne doit apparaître, ni dans le texte, ni dans un lien.
    await ouvrir(page, { is_claimed: false });
    await attendreLeBloc(page);

    const bloc = page.locator('#claim-status-block');
    const texte = nfc(await bloc.innerText());
    const liens = (await bloc.locator('a').evaluateAll(
      (as) => as.map((a) => a.getAttribute('href')).join(' '))) || '';

    for (const prive of ['+213555112233', '555112233', 'benali.prive@example.test', 'rue Privee']) {
      expect(texte, `« ${prive} » apparait dans le texte du bloc`).not.toContain(prive);
      expect(decodeURIComponent(liens), `« ${prive} » apparait dans un lien du bloc`)
        .not.toContain(prive);
    }
  });

  test('un nom piégé ne devient pas du HTML', async ({ page }) => {
    // ⚠️ CET ESSAI A PERDU SA CIBLE LE 18/09, et il fallait le dire plutôt que
    // le laisser mourir. Il lisait l'URL WhatsApp : c'était là que le nom et
    // des chaînes se recollaient. Ce lien n'existe plus.
    //
    // Le nom ne rentre plus du tout dans le bloc de revendication — ce qui est
    // la meilleure protection possible, et exactement ce qu'un essai doit
    // constater au lieu de le supposer. On élargit donc à **toute la page** :
    // le nom y est rendu (en-tête, titre), et c'est là que l'échappement compte
    // désormais.
    await ouvrir(page, { is_claimed: false, full_name: '<img src=x onerror="window.__xss=1">' });
    await attendreLeBloc(page);

    expect(await page.evaluate(() => window.__xss),
      'le nom piégé s’est exécuté').toBeUndefined();
    expect(await page.locator('#claim-status-block img').count()).toBe(0);
    // Aucune balise `img` injectée nulle part par ce nom — les images
    // légitimes de la page ont une source, celle-ci serait `x`.
    expect(await page.locator('img[src="x"]').count(),
      'le nom piégé a produit une balise dans la page').toBe(0);
    // Et il s'affiche bien QUELQUE PART, en texte : un essai vert parce que le
    // nom a disparu ne prouverait rien.
    //
    // ⚠️ Comparaison INSENSIBLE À LA CASSE : la page applique un
    // `text-transform: capitalize`, et `innerText` rend le texte TRANSFORMÉ —
    // « Dr. <Img Src=X … ». Un essai qui compare au caractère près accuserait
    // ici une feuille de style, pas un défaut d'échappement.
    expect(nfc(await page.locator('#d-name').innerText()))
      .toMatch(/<img src=x/i);
  });

  test('une fiche sans `legacy_id` n’affiche PAS le bloc', async ({ page }) => {
    // ⚠️ Mesuré, pas supposé : tout le bloc est sous `if (d.legacy_id)`. Une
    // fiche sans identifiant historique est une fiche créée dans l'application
    // — elle a déjà un propriétaire, il n'y a rien à revendiquer, et la RPC
    // `claim_my_doctor_profile` n'aurait rien à quoi se raccrocher.
    await ouvrir(page, { is_claimed: false, legacy_id: null });
    // On attend un fait de la page (le nom rendu), puis on constate l'absence :
    // sans ça, l'essai serait vert parce que la page n'a simplement pas fini.
    await expect(page.locator('#d-name')).toContainText(/BENALI/i, { timeout: 10000 });
    expect(await page.locator('#claim-status-block').count()).toBe(0);
  });

  test('le tunnel est INDEXABLE, et les pages de compte ne le sont pas', async ({ page }) => {
    // ⚠️ `doctor-claim.html` portait `noindex,nofollow` : un médecin qui cherche
    // « revendiquer ma fiche Tabibi » ne pouvait pas la trouver. Une porte
    // d'entrée qu'on interdit d'indexer est une porte fermée de l'intérieur.
    const tunnel = await page.request.get('/doctor-claim.html').then((r) => r.text());
    expect(tunnel, 'le tunnel est de nouveau interdit d’indexation')
      .toContain('<meta name="robots" content="index,follow">');

    const publique = await page.request.get('/doctor-profile.html').then((r) => r.text());
    expect(publique).toContain('<meta name="robots" content="index,follow');

    // ⚠️ LA CONTRE-ÉPREUVE : ouvrir le tunnel ne doit RIEN ouvrir d'autre.
    for (const privee of ['/patient-dashboard.html', '/doctor-dashboard.html',
      '/medecin-profile.html', '/patient-profile.html', '/admin-candidatures.html']) {
      const html = await page.request.get(privee).then((r) => r.text());
      expect(html, `${privee} est devenue indexable`)
        .toContain('<meta name="robots" content="noindex,nofollow">');
    }
  });
  // ─────────────────────────────────────────────────────────────────
  // FR / EN / AR — trois langues, et le lien NE CHANGE PAS
  // ─────────────────────────────────────────────────────────────────
  // ⚠️ Une clé absente ne casse rien ici : `_t(cle, defaut)` retombe sur le
  // français. Un encart « traduit » peut donc rester vert en anglais tout en
  // affichant du français. On mesure donc le TEXTE RENDU, pas la présence des
  // clés — et on exige qu'il soit celui de la langue demandée.
  for (const [langue, attendus] of Object.entries({
    en: { titre: 'Are you this doctor?', cta: 'Claim my listing', pris: 'Listing claimed by the doctor' },
    ar: { titre: 'هل أنت هذا الطبيب؟', cta: 'المطالبة ببطاقتي', pris: 'بطاقة مُطالَب بها من الطبيب' },
  })) {
    test(`l’encart parle ${langue} quand la page est en ${langue}`, async ({ page }) => {
      await page.addInitScript((l) => { try { localStorage.setItem('tabibi_lang', l); } catch (e) {} }, langue);
      await ouvrir(page, { is_claimed: false });
      await attendreLeBloc(page);

      const bloc = page.locator('#claim-status-block');
      await expect.poll(() => bloc.innerText().then(nfc), { timeout: 8000 })
        .toContain(nfc(attendus.titre));
      expect(nfc(await bloc.innerText())).toContain(nfc(attendus.cta));
      // Le français ne doit PAS transparaître : c'est le repli qui trahit une
      // clé manquante.
      expect(nfc(await bloc.innerText()), 'repli en francais : une cle manque')
        .not.toContain(nfc('Revendiquer ma fiche'));

      // ⚠️ Le LIEN, lui, est le même dans les trois langues. Traduire une URL
      // est exactement le genre de zèle qui casse un tunnel.
      await expect(page.locator('#claim-cta-link'))
        .toHaveAttribute('href', 'doctor-claim.html?legacy_id=4242');
    });

    test(`fiche revendiquée : le badge parle ${langue} lui aussi`, async ({ page }) => {
      await page.addInitScript((l) => { try { localStorage.setItem('tabibi_lang', l); } catch (e) {} }, langue);
      await ouvrir(page, { is_claimed: true });
      await attendreLeBloc(page);

      await expect.poll(() => page.locator('#claim-status-block').innerText().then(nfc),
        { timeout: 8000 }).toContain(nfc(attendus.pris));
      expect(await page.locator('#claim-cta').count()).toBe(0);
    });
  }
});
