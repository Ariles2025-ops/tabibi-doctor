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

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
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
