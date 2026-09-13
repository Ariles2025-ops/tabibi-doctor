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
// Lit la revendication `role` d'un JWT sans jamais l'afficher. Un jeton
// illisible rend null : on prefere ne rien affirmer plutot qu'affirmer faux.
function roleDuJwt(jeton) {
  try {
    const p = jeton.split('.')[1];
    if (!p) return null;
    const charge = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof charge.role === 'string' ? charge.role : null;
  } catch { return null; }
}

const fichiers = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => /\.(html|js|mjs|cjs|ts|tsx|json|toml|yml|yaml|md|sql|sh|txt|css)$/.test(f))
  .filter(f => !f.startsWith('seo/') && f !== '.gitleaks.toml');
let echecs = 0;
for (const f of fichiers) {
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of MOTIFS) {
    const hits = s.match(m.re); if (!hits) continue;
    if (m.tolereDansConfig && AUTORISES.has(f)) continue;
    echecs++;
    // [13/09/2026] Le message ne disait pas QUEL role. Alerter sur les deux est
    // juste — la cle publique n'a rien a faire en dur ailleurs que dans la
    // config — mais un message qui ne distingue pas prepare le jour ou on
    // balaiera un vrai `service_role` d'un « c'est encore la cle publique ».
    // Le jeton lui-meme n'est JAMAIS affiche (regle 6 de CLAUDE.md) : on ne lit
    // que la revendication `role` de sa charge utile.
    const roles = [...new Set(hits.map(roleDuJwt).filter(Boolean))];
    const critique = roles.some((r) => r !== 'anon') || m.nom.includes('secrète');
    const detail = roles.length
      ? ` — role=${roles.join(', ')}${critique ? ' ⚠ CRITIQUE, rotation requise' : ' (cle publique, pas de rotation — mais elle ne doit pas etre en dur ici)'}`
      : '';
    console.error(`✗ ${f} : ${m.nom} (${hits.length} occurrence${hits.length > 1 ? 's' : ''})${detail}`);
  }
}
if (echecs) { console.error(`\n${echecs} fichier(s) portent un littéral de clé hors ${[...AUTORISES].join(', ')}.`); process.exit(1); }
console.log(`Clés : aucun littéral hors ${[...AUTORISES].join(' et ')} (${fichiers.length} fichiers examinés).`);
