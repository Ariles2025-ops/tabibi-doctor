// =====================================================================
// Accessibilite des pages publiques — mesuree par axe, pas estimee
// =====================================================================
// Cible annoncee dans `CLAUDE.md` : **niveau AA**. Jusqu'ici c'etait une
// intention ; ce fichier la rend verifiable a chaque passage.
//
// ---------------------------------------------------------------------
// LES PAGES — et une correction a la liste demandee
// ---------------------------------------------------------------------
// Il m'a ete demande « index/accueil-public, recherche, fiche, signup,
// waiting-list ». **`recherche.html` et `fiche.html` n'existent pas.** La
// recherche de medecins et la fiche publique ne sont pas des pages de ce
// depot ; `doctor-profile.html` est l'espace du medecin connecte, pas une
// fiche publique. J'audite donc l'ensemble reellement atteignable sans
// compte — il est plus large que la liste, pas plus etroit.
//
// ---------------------------------------------------------------------
// CE QUE `axe` TROUVE, ET CE QU'IL NE TROUVE PAS
// ---------------------------------------------------------------------
// axe couvre environ **la moitie** des criteres WCAG de facon automatique.
// Il voit un contraste insuffisant, un bouton sans nom, un champ sans
// etiquette. Il ne voit pas si l'ordre de tabulation a du sens, si un
// message d'erreur est annonce, si une alternative textuelle DECRIT bien
// l'image. **Vert ici ne veut pas dire accessible** — ca veut dire qu'aucune
// des fautes mecaniquement detectables ne subsiste.
//
// C'est une porte, pas un certificat.
//
// ---------------------------------------------------------------------
// ⚠️ CE QU'AXE NE DIT PAS : LES « INCOMPLETS »
// ---------------------------------------------------------------------
// Quand axe ne parvient pas a resoudre la couleur de fond d'un element —
// degrade, transparences empilees, image dessous — il ne rend NI un succes NI
// une violation : il range le cas dans `incomplete`. **Un run vert peut donc
// cacher un vrai defaut.**
//
// Ce n'est pas theorique, c'est arrive ici le 14/09 : le badge de
// `waiting-list.html` (#2E8B57, 3,50:1) passait sur les sources et echouait sur
// `dist-web`, ou la composition se resolvait. Le defaut existait des deux
// cotes ; seule la SORTIE DE BUILD le rendait visible.
//
// D'ou deux choses ici : les `incomplete` de contraste sont IMPRIMES a chaque
// passage, et la porte se lance sur les sources ET sur la sortie de build.
// =====================================================================
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { hermetiser, neutraliserCaptcha, ATTENDRE } = require('./_hermetique');

// Les pages qu'un visiteur atteint SANS COMPTE. Une faute d'accessibilite y
// coute plus cher qu'ailleurs : c'est la seule partie du produit qu'on ne
// peut pas « expliquer a l'utilisateur ».
const PAGES = [
  ['index.html', "la porte — c'est la premiere page servie"],
  ['accueil-public.html', "l'accueil"],
  ['about.html', 'a propos'],
  ['signup.html', "l'inscription"],
  ['login.html', 'la connexion'],
  ['forgot-password.html', 'le mot de passe oublie'],
  ['waiting-list.html', "la liste d'attente"],
  ['cas-grave.html', "l'urgence — la page ou on arrive en panique"],
  ['verify-prescription.html', "la verification d'ordonnance, ouverte aux pharmaciens"],
  ['telecharger.html', "le telechargement de l'application"],
  ['404.html', 'la page introuvable'],
];

test.beforeEach(async ({ page }) => {
  await hermetiser(page);
  await neutraliserCaptcha(page);
  await page.addInitScript(() => localStorage.setItem('tabibi_lang', 'fr'));
});

// Un rapport d'echec doit dire QUOI corriger, pas seulement QU'IL FAUT
// corriger. On imprime donc la cible, le fragment de HTML et le motif d'axe
// (pour un contraste : les deux couleurs et le rapport mesure).
function lisible(violations) {
  return violations.map((v) => {
    const noeuds = v.nodes.slice(0, 20).map((n) => {
      const motifs = [...(n.any || []), ...(n.all || [])]
        .map((c) => c.message).filter(Boolean).join(' / ');
      return `      - ${n.target.join(' ')}\n        ${(n.html || '').slice(0, 120).replace(/\s+/g, ' ')}\n        ${motifs}`;
    }).join('\n');
    const reste = v.nodes.length > 20 ? `\n      … et ${v.nodes.length - 20} autre(s)` : '';
    return `  [${v.impact}] ${v.id} — ${v.help}  (${v.nodes.length} noeud(s))\n${noeuds}${reste}\n      ${v.helpUrl}`;
  }).join('\n');
}

for (const [chemin, role] of PAGES) {
  test(`${chemin} (${role}) : aucune violation WCAG A/AA detectable`, async ({ page }) => {
    await page.goto(`/${chemin}`, ATTENDRE);
    // Le contenu de plusieurs pages arrive apres le DOM (i18n, drapeaux).
    // Mesurer trop tot reviendrait a auditer une page a moitie rendue.
    await page.waitForTimeout(600);

    const resultat = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Les cas qu'axe n'a pas su trancher. Ils ne font pas echouer — ils sont
    // vraiment indecidables — mais ils ne doivent pas etre invisibles.
    const indecis = resultat.incomplete.filter((v) => v.id === 'color-contrast');
    if (indecis.length) {
      const n = indecis.reduce((t, v) => t + v.nodes.length, 0);
      console.log(`[a11y] ${chemin} : ${n} element(s) dont axe n'a PAS su resoudre le fond `
        + `(degrade, transparences). Non tranches, donc non comptes — et c'est la ou se `
        + `cachent les contrastes qu'on croit verts.`);
    }

    expect(resultat.violations.length,
      `\n${chemin} — ${resultat.violations.length} violation(s) :\n${lisible(resultat.violations)}\n`)
      .toBe(0);
  });
}
