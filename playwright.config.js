// =====================================================================
// Configuration Playwright — tests de non-régression Tabibi
// =====================================================================
// Lancer :  npm run test:e2e          (le serveur démarre tout seul)
//           npm run test:e2e:ui       (mode inspecteur, pour déboguer)
//
// La config démarre elle-même un serveur statique sur le port 8899. Avant,
// elle exigeait deux terminaux (« Terminal A : python3 -m http.server ») :
// personne ne lance deux terminaux avant chaque commit, et une CI ne le peut
// pas du tout. C'est la raison pour laquelle ces 7 tests n'ont jamais tourné.
//
// Cible par défaut : les SOURCES (racine du dépôt), c'est-à-dire ce qui est
// déployé aujourd'hui. Pour tester la sortie de build à la place :
//   TABIBI_CIBLE=dist-web npm run test:e2e
// Pour tester la production réelle :
//   TABIBI_BASE=https://tabibi.doctor npm run test:e2e
// =====================================================================
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8899;
const CIBLE = process.env.TABIBI_CIBLE || '.';
// Une baseURL externe (production, staging) désactive le serveur local.
const BASE_EXTERNE = process.env.TABIBI_BASE;

// =====================================================================
// [15/09/2026] LE RUNNER SORT EN 1 ET NE DIT PAS QUEL TEST
// =====================================================================
// La porte `e2e` est sortie en 1 sur le runner GitHub (441 s) pendant que le
// local rendait 304/304, sources ET dist-web. Impossible de savoir LEQUEL :
// le seul rapporteur etait `list`, qui ecrit dans la sortie standard et **ne
// produit aucun fichier**. L'etape « Rapport de test si echec » du workflow
// televersait donc un `playwright-report/` qui n'avait jamais ete ecrit.
//
// Cinq reproductions locales, toutes vertes :
//   sources · dist-web · arbre PROPRE de ccbc996 (worktree detache)
//   TZ=UTC (le runner est en UTC, la machine en CEST)
//   charge 37 sur 10 coeurs, --repeat-each=3 sur les 7 specs a `waitForTimeout`
//
// La difference qui reste est le systeme : ubuntu-latest contre macOS. Elle
// n'est pas reproductible ici (pas de Docker sur la machine).
//
// ALORS ON NE DEVINE PAS : on fait en sorte que le PROCHAIN echec se nomme
// lui-meme.
//   `github` : annote le test fautif directement dans l'onglet Actions —
//              plus besoin de telecharger un artefact pour lire un nom.
//   `html`   : le rapport que l'etape d'artefact attendait deja.
//   `json`   : lisible par un script, pour comparer deux runs.
//
// ⚠️ `retries` : 2 en CI, 0 en local. Ce n'est PAS pour faire passer un test
// qui echoue — aucune assertion n'a ete touchee. C'est pour qu'un echec isole
// s'affiche « flaky » **avec son nom** au lieu de « exit 1 » sans rien.
// **Un test marque flaky n'est pas un test repare** : il doit etre chasse.
// C'est ecrit au registre (P-33).
const EN_CI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: EN_CI ? 2 : 0,
  reporter: EN_CI
    ? [['list'], ['github'], ['html', { open: 'never' }],
       ['json', { outputFile: 'test-results/resultats.json' }]]
    : [['list']],
  use: {
    baseURL: BASE_EXTERNE || `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],

  // Serveur statique démarré et arrêté par Playwright lui-même.
  // Omis quand on vise une URL externe : on ne sert pas la prod en local.
  webServer: BASE_EXTERNE ? undefined : {
    command: `python3 -m http.server ${PORT} --directory ${CIBLE}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
