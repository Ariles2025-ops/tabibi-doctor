// =====================================================================
// vite.config.js — build du site Tabibi (multi-pages)
// =====================================================================
// POURQUOI CE FICHIER EXISTE
//
// Le site est un ensemble de pages HTML autonomes, sans bundler. Mesure du
// 09/09/2026 : l'accueil chargeait 675 Ko de JavaScript local reparti sur
// 27 requetes, sans minification ni tree-shaking. C'est la cause directe du
// Lighthouse Performance a 67, et le premier facteur de perte d'utilisateur
// sur un reseau mobile algerien.
//
// Vite est utilise ici en mode MULTI-PAGES : chaque .html reste un point
// d'entree autonome. Ce n'est PAS une reecriture — aucune page ne devient une
// application monopage, aucun framework n'est introduit.
//
// CE QUI N'EST VOLONTAIREMENT PAS DANS LE BUILD
//   seo/     576 pages statiques sans JS applicatif. Les bundler couterait
//            plusieurs minutes par build pour zero gain : elles n'ont pas de
//            module a regrouper.
//   www/     sortie de scripts/build-mobile.sh
//   dist*/   sorties de build
//   desktop/ bundle Tauri, produit par desktop/build-dist.sh
//   v2/      application React, elle a son propre build
//
// MIGRATION PROGRESSIVE — etat au 09/09/2026
// Une page n'est reellement bundlee que lorsque ses <script src> classiques
// ont ete remplaces par UN point d'entree `type="module"`. Les pages non
// encore converties traversent le build sans dommage : leurs scripts sont
// copies tels quels. On convertit page par page, en mesurant a chaque fois.
// =====================================================================

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const RACINE = import.meta.dirname;

// Pages exclues du build : sorties generees ou sauvegardes locales.
const EXCLUES = new Set([
  'index-baseline.html',          // capture avant extraction du JS inline
  'index.html.avant-extraction',
  'CHANTIER_MOBILE_2026-09-08.html',
]);

function pagesHtml() {
  const entrees = {};
  for (const f of readdirSync(RACINE)) {
    if (f.endsWith('.html') && !EXCLUES.has(f)) {
      entrees[f.replace(/\.html$/, '')] = resolve(RACINE, f);
    }
  }
  for (const dossier of ['legal', 'blog']) {
    for (const f of readdirSync(resolve(RACINE, dossier))) {
      if (f.endsWith('.html')) {
        entrees[`${dossier}/${f.replace(/\.html$/, '')}`] = resolve(RACINE, dossier, f);
      }
    }
  }
  return entrees;
}


// ---------------------------------------------------------------------
// PONT DE MIGRATION — a retirer quand les 45 pages seront converties.
//
// Tant qu'une page charge ses scripts en balises classiques, Vite ne les
// traite pas ET ne les copie pas : la page se retrouverait avec des 404.
// On recopie donc les arborescences telles quelles. Les pages deja
// converties, elles, pointent vers les bundles hashes.
//
// Deux fichiers resteront copies meme apres la migration complete :
//   js/tabibi-prelang.js  — script classique du <head> (langue avant rendu)
//   assets/vendor/...     — SDK Supabase, UMD : bundle en ESM il cesse
//                           d'attacher window.supabase (constate le 09/09/2026)
// ---------------------------------------------------------------------
const pontMigration = viteStaticCopy({
  targets: [
    { src: 'js', dest: '.' },
    { src: 'css', dest: '.' },
    { src: 'styles', dest: '.' },
    { src: 'images', dest: '.' },
    { src: 'assets', dest: '.' },
    { src: 'brand', dest: '.' },
    { src: 'manifest.json', dest: '.' },
    { src: 'favicon.ico', dest: '.' },
    { src: 'sw.js', dest: '.' },
    { src: 'robots.txt', dest: '.' },
    { src: 'sitemap.xml', dest: '.' },
    { src: 'sitemaps', dest: '.' },
    { src: 'seo', dest: '.' },
    { src: '_headers', dest: '.' },
    { src: '_redirects', dest: '.' },
  ],
});

export default defineConfig({
  root: RACINE,
  plugins: [pontMigration],
  base: './',                      // chemins RELATIFS : indispensable pour les
                                   // WebViews Capacitor (https://localhost) et
                                   // Tauri, ou une base absolue casse tout.
  publicDir: false,                // les assets sont deja references par les pages
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2020',              // minSdk 26 = Android 8 / Chrome WebView recent
    cssCodeSplit: true,
    sourcemap: true,               // Sentry a besoin des sources pour etre lisible
    rollupOptions: {
      input: pagesHtml(),
      output: {
        entryFileNames: 'assets/build/[name]-[hash].js',
        chunkFileNames: 'assets/build/[name]-[hash].js',
        assetFileNames: 'assets/build/[name]-[hash][extname]',
      },
    },
  },
  server: { port: 8080 },
});
