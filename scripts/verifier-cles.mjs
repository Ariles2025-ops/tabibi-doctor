#!/usr/bin/env node
// Échoue si un littéral de clé Supabase apparaît ailleurs que dans les deux fichiers de configuration.
// Miroir inverse de l'allowlist gitleaks : gitleaks tolère la clé publique dans l'historique,
// ce script interdit qu'elle revienne en dur dans le code (8 copies retirées le 10/09/2026).
// Une clé secrète (sb_secret_, JWT service_role) n'est tolérée NULLE PART.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const AUTORISES = new Set(['js/config.js', 'v2/src/lib/config.ts']);
const MOTIFS = [
  { nom: 'JWT Supabase (ancienne clé anon/service_role)', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, tolereDansConfig: false },
  { nom: 'clé publiable sb_publishable_', re: /sb_publishable_[A-Za-z0-9_-]{10,}/g, tolereDansConfig: true },
  { nom: 'clé secrète sb_secret_', re: /sb_secret_[A-Za-z0-9_-]{10,}/g, tolereDansConfig: false },
];
const fichiers = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => /\.(html|js|mjs|cjs|ts|tsx|json|toml|yml|yaml|md|sql|sh|txt|css)$/.test(f))
  .filter(f => !f.startsWith('seo/') && f !== '.gitleaks.toml');
let echecs = 0;
for (const f of fichiers) {
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of MOTIFS) {
    const hits = s.match(m.re); if (!hits) continue;
    if (m.tolereDansConfig && AUTORISES.has(f)) continue;
    echecs++; console.error(`✗ ${f} : ${m.nom} (${hits.length} occurrence${hits.length > 1 ? 's' : ''})`);
  }
}
if (echecs) { console.error(`\n${echecs} fichier(s) portent un littéral de clé hors ${[...AUTORISES].join(', ')}.`); process.exit(1); }
console.log(`Clés : aucun littéral hors ${[...AUTORISES].join(' et ')} (${fichiers.length} fichiers examinés).`);
