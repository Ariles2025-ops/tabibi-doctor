#!/usr/bin/env node
// =====================================================================
// verifier-c1.mjs — preuve du correctif C1 (fermeture de l'énumération)
// =====================================================================
// 1. Statique : aucun fichier déployé ne lit plus la vue public_doctors
//    (ni public_doctors_listed) en direct, et chaque appelant historique
//    passe bien par une RPC. Sortie 1 si un accès direct subsiste.
// 2. Live (--live) : trois appels HTTP avec la clé anon, sans rien écrire :
//      GET  /rest/v1/public_doctors?select=id&limit=1     → attendu ≠ 200
//      POST /rest/v1/rpc/chercher_praticiens {}            → attendu 400
//      POST /rest/v1/rpc/chercher_praticiens {wilaya, 500} → attendu 200, ≤ 50 lignes
//    Tant que la migration n'est pas exécutée, le premier appel répond 200 :
//    le script le dit noir sur blanc au lieu de l'inventer.
// Usage : node scripts/verifier-c1.mjs [--live]
// =====================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;
// desktop/dist, android, ios, www : sorties de build (régénérées par scripts/build-mobile.sh / tauri build)
const EXCLUS = /^(node_modules|dist|dist-web|seo|android|ios|src-tauri|desktop\/dist|_to_delete|www|\.git|v2\/node_modules|v2\/dist)(\/|$)/;
const FICHIERS_IGNORES = new Set(['scripts/verifier-c1.mjs', 'index-baseline.html', 'index.html.avant-extraction', 'CHANTIER_MOBILE_2026-09-08.html']);

// Les neuf appelants historiques (inventaire VERIF_NAVIGATEUR.md / B3) et la
// RPC qu'ils doivent désormais utiliser.
const ATTENDUS = [
  ['js/api.js',                    /rpc\('chercher_praticiens'/],
  ['js/api.js',                    /rpc\('praticien'/],
  ['js/doctors-display.js',        /rpc\('chercher_praticiens'/],
  ['js/doctors-display.js',        /rpc\('praticien'/],
  ['js/doctors-display.js',        /rpc\('praticiens_par_ids'/],
  ['js/home-app.js',               /_tbRpc\('chercher_praticiens'/],
  ['js/home-app.js',               /_tbRpc\('praticiens_carte'/],
  ['js/home-app.js',               /_tbRpc\('stats_publiques'/],
  ['js/tabibi-booking.js',         /rpc\('praticiens_par_ids'/],
  ['js/tabibi-messaging.js',       /rpc\('praticiens_par_ids'/],
  ['doctor-profile.html',          /rpc\('praticien'/],
  ['doctor-claim.html',            /rpc\/chercher_praticiens/],
  ['doctor-claim.html',            /rpc\/stats_publiques/],
  ['doctor-claim.html',            /rpc\/praticien'/],
  ['scripts/generate-seo-pages.mjs', /rpc\/seo_couples/],
];

const DIRECT = [
  /rest\/v1\/public_doctors(_listed)?[?'"`]/,     // fetch REST sur la vue
  /\.from\(\s*['"]public_doctors(_listed)?['"]/, // supabase-js .from()
];

function* fichiers(dir) {
  for (const nom of readdirSync(dir)) {
    const abs = join(dir, nom);
    const rel = relative(RACINE, abs);
    if (EXCLUS.test(rel) || FICHIERS_IGNORES.has(rel)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) yield* fichiers(abs);
    else if (/\.(js|mjs|html|ts|tsx)$/.test(nom)) yield rel;
  }
}

let echec = false;
const directs = [];
for (const rel of fichiers(RACINE)) {
  const src = readFileSync(join(RACINE, rel), 'utf8');
  src.split('\n').forEach((ligne, i) => {
    if (DIRECT.some((re) => re.test(ligne))) directs.push(`${rel}:${i + 1}: ${ligne.trim().slice(0, 110)}`);
  });
}
console.log('1. Accès directs à public_doctors / public_doctors_listed dans les sources déployées :', directs.length);
directs.forEach((d) => console.log('   ✗', d));
if (directs.length) echec = true;

console.log('2. Appelants historiques → RPC :');
for (const [rel, re] of ATTENDUS) {
  const ok = re.test(readFileSync(join(RACINE, rel), 'utf8'));
  console.log(`   ${ok ? '✓' : '✗'} ${rel}  ${re.source}`);
  if (!ok) echec = true;
}

if (process.argv.includes('--live')) {
  const cfg = readFileSync(join(RACINE, 'js', 'config.js'), 'utf8');
  const url = cfg.match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
  const key = cfg.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)?.[1];
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const appel = async (label, req, attendu) => {
    const r = await fetch(req.url, { method: req.method || 'GET', headers: h, body: req.body });
    let corps = null; try { corps = await r.json(); } catch { /* vide */ }
    const detail = attendu(r.status, corps);
    console.log(`   ${detail.ok ? '✓' : '✗'} ${label} → HTTP ${r.status} ${detail.note}`);
    if (!detail.ok) echec = true;
  };
  console.log('3. Live (clé anon, lecture seule) :');
  await appel('GET vue public_doctors (limit=1)', { url: `${url}/rest/v1/public_doctors?select=id&limit=1` },
    (s) => ({ ok: s !== 200, note: s === 200 ? '— la vue est ENCORE lisible : migration C1 non exécutée' : '— vue fermée' }));
  await appel('RPC chercher_praticiens sans filtre', { url: `${url}/rest/v1/rpc/chercher_praticiens`, method: 'POST', body: '{}' },
    (s, c) => ({ ok: s === 400, note: s === 404 ? '— RPC absente : migration C1 non exécutée' : `— ${c && (c.message || c.hint) || ''}` }));
  await appel('RPC chercher_praticiens Alger, p_limite=500', { url: `${url}/rest/v1/rpc/chercher_praticiens`, method: 'POST', body: JSON.stringify({ p_wilaya: 'Alger', p_limite: 500 }) },
    (s, c) => { const n = c && Array.isArray(c.lignes) ? c.lignes.length : -1; return { ok: s === 200 && n >= 0 && n <= 50, note: s === 200 ? `— ${n} lignes, total ${c.total}` : (s === 404 ? '— RPC absente : migration C1 non exécutée' : '') }; });
}

console.log(echec ? '\nÉCHEC' : '\nOK');
process.exit(echec ? 1 : 0);
