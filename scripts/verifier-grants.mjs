#!/usr/bin/env node
// Contrôle des privilèges réels de anon et authenticated contre la liste blanche versionnée
// (supabase/grants-liste-blanche.json). Échoue (code 1) si un privilège réel dépasse la liste,
// si le rôle postgres pose encore des défauts ouverts sur les tables/séquences de public, ou si
// l'USAGE du schéma manque. Un privilège attendu mais absent est signalé (△) sans faire échouer.
//
// Lancement à la main :  npm run verifier:grants        (ou : node scripts/verifier-grants.mjs)
// Options : --liste <chemin.json>   autre liste blanche (tests)
//           --projet <ref>          autre projet Supabase
// Accès : jeton de l'API de gestion Supabase, lu dans SUPABASE_ACCESS_TOKEN, sinon dans le
// trousseau macOS (entrée « Supabase CLI »). Le jeton n'est jamais affiché ni écrit.
// Pas en CI tant que ce n'est pas décidé (règle du 12/09/2026) : le jeton devrait alors être un
// secret d'Actions, et le contrôle tourner sur un planning, pas à chaque PR.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CHEMIN = opt('--liste', 'supabase/grants-liste-blanche.json');
const liste = JSON.parse(readFileSync(CHEMIN, 'utf8'));
const REF = opt('--projet', process.env.SUPABASE_PROJECT_REF || liste.projet);
const SCHEMA = liste.schema || 'public';

function jeton() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  if (process.platform === 'darwin') {
    try { return execSync('security find-generic-password -s "Supabase CLI" -w', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* absent */ }
  }
  console.error('✗ Aucun jeton : définir SUPABASE_ACCESS_TOKEN ou se connecter avec `supabase login`.');
  process.exit(2);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) { console.error(`✗ API de gestion : HTTP ${r.status}`); process.exit(2); }
  return r.json();
}

const roles = Object.keys(liste.tables);
const inList = (arr) => arr.map((r) => `'${r}'`).join(',');

const [grants, seqs, usage, defauts] = await Promise.all([
  sql(`select table_name as rel, grantee as role, privilege_type as verbe from information_schema.role_table_grants
        where table_schema='${SCHEMA}' and grantee in (${inList(roles)})`),
  sql(`select object_name as rel, grantee as role, privilege_type as verbe from information_schema.role_usage_grants
        where object_schema='${SCHEMA}' and object_type='SEQUENCE' and grantee in (${inList(roles)})`),
  sql(`select r as role, has_schema_privilege(r, '${SCHEMA}', 'USAGE') as ok from unnest(array[${inList(liste.schema_usage_requis || [])}]) r`),
  sql(`select defaclrole::regrole::text as role_posant, defaclobjtype as type, defaclacl::text as acl from pg_default_acl
        where defaclnamespace = '${SCHEMA}'::regnamespace and defaclacl::text ~ '(${roles.join('|')})='`),
]);

let echecs = 0, avertissements = 0;
const ligne = (sym, rel, verbe, role, note) => console.log(`${sym} ${rel.padEnd(34)} ${verbe.padEnd(10)} ${role.padEnd(14)} ${note}`);

// 1. Tables et vues : réel vs liste
const attendu = new Set();
for (const role of roles) for (const [rel, verbes] of Object.entries(liste.tables[role])) for (const v of verbes) attendu.add(`${role}|${rel}|${v}`);
const reel = new Set(grants.map((g) => `${g.role}|${g.rel}|${g.verbe}`));
for (const k of [...reel].sort()) {
  if (!attendu.has(k)) { const [role, rel, v] = k.split('|'); ligne('✗', rel, v, role, 'hors liste blanche'); echecs++; }
}
for (const k of [...attendu].sort()) {
  if (!reel.has(k)) { const [role, rel, v] = k.split('|'); ligne('△', rel, v, role, 'attendu, absent (le front peut casser)'); avertissements++; }
}

// 2. Séquences
const attSeq = new Set();
for (const role of Object.keys(liste.sequences || {})) for (const [rel, verbes] of Object.entries(liste.sequences[role])) for (const v of verbes) attSeq.add(`${role}|${rel}|${v}`);
for (const s of seqs) {
  const k = `${s.role}|${s.rel}|${s.verbe}`;
  if (!attSeq.has(k)) { ligne('✗', s.rel, s.verbe, s.role, 'séquence hors liste blanche'); echecs++; }
}

// 3. USAGE du schéma
for (const u of usage) if (!u.ok) { ligne('✗', `schéma ${SCHEMA}`, 'USAGE', u.role, 'manquant : plus rien ne répond pour ce rôle'); echecs++; }

// 4. Défauts (pg_default_acl)
const ctrl = liste.defauts_interdits || { roles_controles: ['postgres'], types: ['r', 'S'] };
for (const d of defauts) {
  const sym = ctrl.roles_controles.includes(d.role_posant) && ctrl.types.includes(d.type) ? '✗' : '△';
  ligne(sym, `défaut ${d.role_posant}`, `type ${d.type}`, roles.filter((r) => d.acl.includes(`${r}=`)).join('+'), sym === '✗' ? 'défaut ouvert : les tables futures hériteront' : 'défaut posé par un rôle non modifiable par postgres (info)');
  if (sym === '✗') echecs++; else avertissements++;
}

const total = grants.length;
console.log(`\n${total} privilège(s) réel(s) lus sur ${SCHEMA} pour ${roles.join(', ')} ; liste blanche : ${attendu.size}.`);
if (echecs) { console.error(`✗ ${echecs} dépassement(s), ${avertissements} avertissement(s). Rétablir avec la migration 20260912_grants_liste_blanche.sql ou mettre la liste à jour dans la même PR.`); process.exit(1); }
console.log(`✓ Aucun privilège hors liste blanche (${avertissements} avertissement(s)).`);
