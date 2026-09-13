#!/usr/bin/env node
// =====================================================================
// verifier-rpc-passage.mjs — tout appel RPC passe par tabibiRpc()
// =====================================================================
// Une reponse PostgREST a deux moities — `res.error` (transport) et
// `res.data.error` (metier) — et il faut lire les deux. Le 13/09/2026, deux
// sites sur 44 n'en lisaient qu'une :
//   signup.html                  -> compte secretaire cree dans un etat faux
//   admin-doctor-validation.html -> e-mail « fiche validee » envoye au medecin
//                                   alors que rien n'etait valide en base
//
// js/tabibi-rpc.js est le point de passage : il normalise en
// { ok, data, erreur } et met `data` a NULL des que `ok` est faux, pour que
// celui qui ignore `ok` casse VISIBLEMENT au lieu de continuer sur un mensonge.
//
// Ce controle empeche de le contourner. Un `.rpc(` direct hors du point de
// passage fait echouer la verification.
//
// LE PLAFOND EST LE COMPTE ACTUEL, PAS UN COMPTE CIBLE. La migration des 61
// sites existants n'est PAS faite : elle se fera par lots verifies, pas par un
// balayage mecanique — les deux regressions du 13/09 sont nees d'editions
// mecaniques, et la regle « supprimer est l'operation dangereuse de ce depot »
// vaut aussi pour « reecrire 61 sites d'un coup ».
//
// Ce que la garde apporte des maintenant : AUCUN NOUVEAU site ne peut oublier.
// Le plafond doit DESCENDRE a chaque lot migre, jamais monter.
//
// Usage : node scripts/verifier-rpc-passage.mjs
// =====================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const IGNORE = new Set(['node_modules', 'dist', 'dist-web', 'www', 'ios', 'android',
  'desktop', 'v2', 'seo', '.git', 'tests', 'blog', 'docs', 'supabase', 'migrations',
  // outillage de build, pas du code applicatif — et le script se compterait lui-meme
  'scripts']);

// Compte au 13/09/2026, avant toute migration. Chaque lot migre retire des
// unites ici. `js/tabibi-rpc.js` est le point de passage lui-meme : son unique
// `.rpc(` est celui qu'il encapsule, il reste a 1 pour toujours.
const PLAFOND = {
  'js/tabibi-rpc.js': 1,
  'admin-doctor-validation.html': 6,
  'js/doctors-display.js': 5,
  'js/tabibi-dawini.js': 5,
  'dawini.html': 4,
  'teleconsultation.html': 4,
  'admin-api-keys.html': 3,
  'admin-cabinet.html': 3,
  'js/tabibi-pii-migration.js': 3,
  'medecin-ordonnance.html': 3,
  'signup.html': 3,
  'admin-dashboard.html': 2,
  'doctor-profile.html': 2,
  'js/api.js': 2,
  'js/tabibi-agenda.js': 2,
  'js/tabibi-booking.js': 2,
  'js/tabibi-claim.js': 2,
  'js/tabibi-doctor-dashboard.js': 2,
  'js/tabibi-messaging.js': 2,
  'doctor-analytics.html': 1,
  'js/tabibi-reviews.js': 1,
  'legal/rgpd-droits.html': 1,
  'patient-ordonnances.html': 1,
  'secretaire-dashboard.html': 1,
};

function fichiers(dir = '.', acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    else if (/\.(html|js|mjs)$/.test(e.name) && !e.name.includes('vendor')
             && e.name !== 'index-baseline.html') acc.push(p);
  }
  return acc;
}

const vus = {};
let total = 0;
for (const f of fichiers()) {
  let code = readFileSync(f, 'utf8');
  code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const n = (code.match(/\.rpc\s*\(/g) || []).length;
  if (n) { vus[f] = n; total += n; }
}

let fautes = 0, migres = 0;
for (const f of [...new Set([...Object.keys(vus), ...Object.keys(PLAFOND)])].sort()) {
  const vu = vus[f] || 0, max = PLAFOND[f] || 0;
  if (vu === max) continue;
  if (vu > max) { fautes++; console.log(`  ${ROUGE(`✗ ${vu} > ${max}`)}  ${f}`); }
  else { migres++; console.log(`  ↓ ${vu} < ${max}  ${f}  — migre, abaisser le plafond`); }
}
const cible = Object.values(PLAFOND).reduce((a, b) => a + b, 0);
console.log(`\n${total} appel(s) .rpc( direct(s), plafond ${cible}.`);
if (fautes) {
  console.error(ROUGE(`\n✗ ${fautes} fichier(s) au-dessus du plafond.`));
  console.error(`  Un appel RPC passe par window.tabibiRpc(nom, args) : il rend`);
  console.error(`  { ok, data, erreur } et met data a null des que ok est faux.`);
  console.error(`  Lire seulement res.error, c'est ignorer la moitie METIER de la reponse :`);
  console.error(`  une fonction qui rend {"error":"..."} a REUSSI au sens du transport.`);
  process.exit(1);
}
if (migres) console.log(`${migres} fichier(s) sous leur plafond : abaisser les chiffres dans le script.`);
console.log('Aucun appel RPC hors du point de passage.');
