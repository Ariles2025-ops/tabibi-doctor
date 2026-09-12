#!/usr/bin/env node
// =====================================================================
// vite-convertir-page.mjs — convertit une page en point d'entree Vite
// =====================================================================
// Usage : node scripts/vite-convertir-page.mjs about.html legal/cgu.html ...
//
// Ce que fait la conversion, pour chaque page :
//   - js/tabibi-prelang.js  reste un script CLASSIQUE (langue/RTL avant rendu)
//   - le SDK Supabase (UMD) reste classique, passe en `defer` en tete de <head>
//     (avant tout module : defer et module s'executent dans l'ordre du document)
//   - tous les autres <script src> locaux sont retires et importes, DANS LE MEME
//     ORDRE, par src/entries/<nom>.js, charge en <script type="module">
//   - le point d'entree n'utilise que des chemins relatifs : la page fonctionne
//     AUSSI sans build (chargement natif des modules par le navigateur)
//
// A N'UTILISER QUE sur une page dont AUCUN <script> inline ne depend des
// globales posees par les scripts externes : en module, ceux-ci s'executent
// APRES le parse, donc apres tout inline. Inventaire : voir AUDIT_PROFOND §F.
// =====================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative } from 'node:path';

const GARDE_CLASSIQUE = ['tabibi-prelang.js'];
const SDK = /assets\/vendor\/supabase\/supabase-js-[\d.]+\.min\.js/;

for (const page of process.argv.slice(2)) {
  let html = readFileSync(page, 'utf8');
  const profondeur = page.split('/').length - 1;               // legal/x.html -> 1
  const versRacine = '../'.repeat(profondeur);
  const tags = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>\n?/g)]
    .filter((m) => !/^https?:/.test(m[1]));
  const imports = []; let sdk = null;
  for (const m of tags) {
    const src = m[1];
    if (GARDE_CLASSIQUE.some((g) => src.endsWith(g))) continue;
    if (SDK.test(src)) { sdk = src; html = html.replace(m[0], ''); continue; }
    imports.push(src.replace(/^(\.\.\/)+/, '').replace(/^\.\//, ''));
    html = html.replace(m[0], '');
  }
  if (!imports.length) { console.log(`${page}: aucun script a regrouper`); continue; }
  const nom = page.replace(/\.html$/, '').replace(/\//g, '-');
  const entree = `src/entries/${nom}.js`;
  const versJs = relative(dirname(entree), '.').replace(/\\/g, '/') || '.';
  const lignes = [
    '// =====================================================================',
    `// Point d'entree de ${page} — genere par scripts/vite-convertir-page.mjs`,
    '// =====================================================================',
    "// L'ordre des imports est l'ordre d'execution releve dans la page : ces modules",
    '// communiquent par des globales (window.tabibi, window.TABIBI_CONFIG...).',
    '// Ne pas reordonner sans verifier. Chemins relatifs : fonctionne sans build.',
    ...(sdk ? ['// Le SDK Supabase (UMD) reste un <script defer> dans <head> : bundle en ESM il', "// n'attache plus window.supabase."] : []),
    '',
    ...imports.map((i) => `import '${versJs}/${i}';`),
    '',
  ];
  mkdirSync('src/entries', { recursive: true });
  writeFileSync(entree, lignes.join('\n'));
  if (sdk) {
    const tagSdk = `<script defer src="${sdk}"></script>`;
    html = html.replace(/(<script src="[^"]*tabibi-prelang\.js"><\/script>)/, `$1\n${tagSdk}`);
    if (!html.includes(tagSdk)) html = html.replace('</head>', `${tagSdk}\n</head>`);
  }
  const tagModule = `<script type="module" src="${versRacine || './'}${entree}"></script>`;
  html = html.replace('</body>', `${tagModule}\n</body>`);
  writeFileSync(page, html);
  console.log(`${page}: ${imports.length} scripts -> ${entree}${sdk ? ' (+ SDK defer)' : ''}`);
}
