// =====================================================================
// tests/porte-fermee-liens.test.mjs — personne ne renvoie sur la porte close
// =====================================================================
// Depuis l'inversion du 13/09, `index.html` à la racine **EST** la page
// « Bientôt disponible » (`scripts/verifier-porte.mjs` le tient par empreinte),
// et l'application vit dans `accueil-public.html`.
//
// Des dizaines de liens, boutons et redirections n'avaient pas suivi. Ils ne
// levaient aucune erreur : ils **marchaient**, et déposaient l'utilisateur
// dehors. NAV-1 (P-91) a corrigé la barre du bas ; P-92 a inventorié le reste.
//
// ---------------------------------------------------------------------
// POURQUOI CET ESSAI EST UN ESSAI DE FICHIERS, PAS UN ESSAI DE NAVIGATEUR
// ---------------------------------------------------------------------
// Un essai e2e ne voit que les pages qu'on a pensé à lui donner. **Celui-ci
// parcourt le dépôt** : une page ajoutée demain, avec un « Retour à l'accueil »
// vers `index.html`, sera attrapée sans que personne ait à l'inscrire nulle
// part. C'est la différence entre une liste et un filet.
//
// Le comportement au clic, lui, est gardé par
// `tests/e2e/porte-fermee-navigation.spec.js`. Les deux sont nécessaires :
// celui-ci dit « personne ne vise la porte close », l'autre dit « et la cible
// répond vraiment ».
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = process.cwd();

// Répertoires hors application : sorties de build, pages SEO générées,
// bundles mobiles, et la porte elle-même — qui a parfaitement le droit de
// parler d'`index.html`, c'est son sujet.
const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'dist-web', 'www', 'ios', 'android', 'desktop',
  // ⚠️ [18/09/2026] `blog` EST SORTI DE CETTE LISTE. Il y était, et
  // `blog/index.html` renvoyait sur la porte close — deux fois — sans que rien
  // ne le dise. **Une exclusion est un angle mort qu'on s'accorde**, et
  // celle-ci cachait exactement ce que la garde existe pour attraper.
  //
  // `seo` reste exclu, et c'est une décision documentée, pas un oubli : ses
  // 576 pages visent `https://tabibi.doctor/index.html?specialty=…`. Les
  // repointer est un lot à part (diff de 576 fichiers). Un cliquet dédié, plus
  // bas, empêche ce nombre de grandir en silence.
  'seo', 'v2', 'porte', 'test-results', 'playwright-report', 'scripts',
  'supabase', 'migrations', 'tests', 'assets', 'images', '.claude',
]);

function fichiers(dir = RACINE, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    if (IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    else if (/\.(html|js)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Retire commentaires de ligne, de bloc et HTML — la garde ne s'accuse pas. */
function nu(src) {
  return src
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

const relatif = (p) => p.slice(RACINE.length + 1);

// ⚠️ LES SEULES MENTIONS LÉGITIMES, et pourquoi.
const TOLERE = new Map([
  // La porte vit là : ce fichier EST `index.html`, il ne se lie pas à lui-même.
  ['index.html', 'la page fermée elle-même'],
  // Le bundle desktop remappe TOUT lien vers index.html sur la page pro : c'est
  // un filet de sécurité, pas une cible. Le retirer rendrait muets les liens
  // qu'on n'aurait pas repointés.
  ['js/tabibi-desktop-nav.js', 'remappage de secours du bundle desktop'],
  // Page de chantier, hors application.
  ['CHANTIER_MOBILE_2026-09-08.html', 'document de chantier, hors application'],
]);

/** Les formes qui envoient RÉELLEMENT quelqu'un sur la porte close. */
const CIBLES = [
  { quoi: 'href', motif: /href\s*=\s*["'](?:\.\.\/)?index\.html/gi },
  { quoi: 'location', motif: /location(?:\.href)?\s*=\s*["'](?:\.\.\/)?index\.html/gi },
  { quoi: 'location.replace', motif: /location\.replace\(\s*["'](?:\.\.\/)?index\.html/gi },
  { quoi: 'data-home/back', motif: /data-(?:home|back)\s*=\s*["']index\.html/gi },
  { quoi: 'redirection de config', motif: /afterLogout\s*:\s*["']index\.html/gi },
  // ⚠️ [18/09/2026] LA FORME QUI NE NOMME PAS SA CIBLE. `href="/"` sert la
  // RACINE — et depuis l'inversion du 13/09, la racine EST la porte fermée.
  // Quatre liens y menaient (`api-docs.html` ×3, `telecharger.html` ×2) et
  // aucune recherche sur « index.html » ne pouvait les trouver.
  //
  // **Un inventaire par nom de fichier rate tout ce qui vise un chemin.**
  { quoi: 'lien vers la racine', motif: /href\s*=\s*["']\/["']/gi },
  { quoi: 'redirection vers la racine', motif: /location(?:\.href)?\s*=\s*["']\/["']/gi },
];

test('aucune page de l’application ne renvoie vers index.html (la porte close)', () => {
  const coupables = [];
  for (const chemin of fichiers()) {
    const rel = relatif(chemin);
    if (TOLERE.has(rel)) continue;
    const src = nu(readFileSync(chemin, 'utf8'));
    for (const { quoi, motif } of CIBLES) {
      const trouvees = src.match(motif);
      if (trouvees) coupables.push(`${rel} — ${quoi} × ${trouvees.length}`);
    }
  }
  assert.deepEqual(coupables, [],
    `Ces emplacements renvoient sur la porte fermée :\n  ${coupables.join('\n  ')}`);
});

test('la cible existe, et c’est bien l’accueil OUVERT', () => {
  // ⚠️ Une garde qui interdit `index.html` sans vérifier la cible laisserait
  // repointer tout le monde vers une page absente. On ne remplace pas une
  // mauvaise destination par aucune.
  const accueil = readFileSync(join(RACINE, 'accueil-public.html'), 'utf8');
  assert.match(accueil, /id="name-search"/,
    'l’ancre #name-search a disparu : les liens « Trouver un médecin » ne mènent plus à rien');
  assert.ok(accueil.length > 50000,
    'accueil-public.html est suspicieusement petit — serait-ce devenu la page fermée ?');
  // ⚠️ ET LA PORTE CLOSE DOIT LE RESTER — sinon cet essai interdirait des liens
  // vers une page qui n'a plus rien de fermé.
  //
  // ⚠️ MA PREMIÈRE VERSION CHERCHAIT UN MARQUEUR `tabibi-porte` DANS LE SOURCE.
  // Il n'y est pas : `scripts/porte.mjs` le pose dans `dist-web`, pas dans le
  // dépôt. L'essai était rouge sur un dépôt parfaitement sain — une garde qui
  // se trompe de critère accuse le code juste, et finit désactivée.
  //
  // Le critère qui fait foi est l'**empreinte** : `verifier:porte` exige
  // `index.html` == `porte/porte-fermee.html`, octet pour octet. On ne le
  // recopie pas ici ; on vérifie ce que cet essai-ci a besoin de savoir — que
  // la racine est bien la page « Bientôt disponible », et pas l'application.
  const porte = readFileSync(join(RACINE, 'index.html'), 'utf8');
  assert.match(porte, /Bient[oô]t disponible/i,
    'index.html n’est plus la page fermée : l’inversion du 13/09 a été défaite');
  assert.ok(porte.length < 20000,
    `index.html fait ${porte.length} o : c’est l’application, pas la porte fermée`);
});

test('les valeurs par défaut des modules visent l’accueil ouvert', () => {
  // ⚠️ CE SONT ELLES QUI COMPTENT LE PLUS. Une page peut oublier son attribut ;
  // le défaut, lui, s'applique à toutes celles qui n'en posent pas — et
  // `afterLogout` s'applique à TOUS les rôles, à chaque déconnexion.
  const cfg = readFileSync(join(RACINE, 'js/config.js'), 'utf8');
  assert.match(cfg, /afterLogout:\s*'accueil-public\.html'/,
    'la déconnexion renvoie de nouveau sur la porte fermée');

  const entete = nu(readFileSync(join(RACINE, 'js/tabibi-header.js'), 'utf8'));
  assert.doesNotMatch(entete, /\|\|\s*'index\.html'/,
    'un défaut de l’en-tête vise encore la porte fermée');

  const home = nu(readFileSync(join(RACINE, 'js/home-app.js'), 'utf8'));
  assert.doesNotMatch(home, /redirect\s*=\s*"index\.html"/,
    'une garde d’accès renvoie encore sur la porte fermée');
});

// =====================================================================
// LE CLIQUET DES PAGES SEO — 576 CTA PUBLICS SUR LA PORTE CLOSE
// =====================================================================
// ⚠️ MESURÉ LE 18/09/2026. Les 576 pages de `seo/` portent toutes le même
// bouton d'appel :
//
//     <a class="btn" href="https://tabibi.doctor/index.html?specialty=…&wilaya=…">
//       Voir les disponibilités</a>
//
// **URL absolue, donc invisible à toute recherche de lien relatif** — et P-100,
// qui a repointé 54 emplacements, excluait déjà `seo/`. Ce sont des pages
// d'atterrissage publiques : leur seul bouton dépose le visiteur sur
// « Bientôt disponible ».
//
// ⚠️ POURQUOI UN CLIQUET ET PAS UN CORRECTIF. Repointer 576 fichiers produit
// un diff que personne ne relit — la faute que ce dépôt documente depuis le
// `git add -A` du 13/09. C'est un lot à part entière, et il est au registre.
//
// Ce cliquet fait ce qu'un cliquet fait : **il interdit d'en ajouter un de
// plus**, et il rend le chiffre visible à chaque passage des portes. Le jour
// où le lot passe, ce nombre tombe à 0 et la ligne devient une assertion
// d'absence.
// =====================================================================
const SEO_PLAFOND = 576;

test(`les pages SEO visent encore la porte close — au plus ${SEO_PLAFOND}`, () => {
  const dossier = join(RACINE, 'seo');
  let total = 0;
  let pages = 0;
  for (const nom of readdirSync(dossier)) {
    if (!/\.html$/i.test(nom)) continue;
    const src = nu(readFileSync(join(dossier, nom), 'utf8'));
    const trouvees = src.match(/https:\/\/tabibi\.doctor\/index\.html/gi);
    if (trouvees) { total += trouvees.length; pages += 1; }
  }
  console.log(`  seo/ : ${total} lien(s) vers la porte close, sur ${pages} page(s)`);
  assert.ok(total <= SEO_PLAFOND,
    `${total} liens SEO vers la porte close (plafond ${SEO_PLAFOND}) : il y en a de NOUVEAUX. ` +
    'Une page SEO neuve doit viser accueil-public.html.');
  // ⚠️ ET ON EXIGE QUE LE PLAFOND SOIT SERRÉ. Un cliquet qu'on n'abaisse
  // jamais devient un plafond décoratif : si le lot passe et que le nombre
  // tombe, cet essai le dit, et le plafond doit suivre dans le même commit.
  assert.ok(total >= SEO_PLAFOND,
    `Plus que ${total} liens (plafond ${SEO_PLAFOND}) : abaissez SEO_PLAFOND a ${total} ` +
    'dans le meme commit, sinon le cliquet ne serre plus rien.');
});
