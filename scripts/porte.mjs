#!/usr/bin/env node
// =====================================================================
// porte.mjs — choisit l'ÉTAT DE PORTE du site avant déploiement.
// =====================================================================
// Deux états, un seul choix explicite, jamais un accident de commit :
//
//   fermee  → dist-web/index.html devient la page « Bientôt disponible ».
//             Les pages internes restent servies (login, réservation, etc.),
//             c'est l'état réel de la production depuis le 26/08/2026.
//   ouverte → dist-web/index.html reste l'accueil public complet, tel que
//             le build vient de le produire.
//
// Pourquoi ce script existe (incident du 13/09/2026) :
// la production servait la page « Bientôt disponible » alors que `main` ne
// la contenait plus. Elle venait du commit f06aa3d (PR #51, 26/08), et #55
// avait rétabli l'accueil public sur main le 03/09 sans jamais redéployer.
// Personne ne pouvait le savoir en lisant main. Un `wrangler pages deploy`
// depuis main aurait donc OUVERT le site sans que ce soit décidé.
//
// Usage :  node scripts/porte.mjs fermee|ouverte  [--dist dist-web]
// Sortie : le script écrit ce qu'il a fait et le marqueur à vérifier ensuite.
// =====================================================================
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const etat = args[0];
const dist = (() => { const i = args.indexOf('--dist'); return i >= 0 ? args[i + 1] : 'dist-web'; })();

if (!['fermee', 'ouverte'].includes(etat)) {
  console.error('✗ Usage : node scripts/porte.mjs fermee|ouverte [--dist dist-web]');
  process.exit(2);
}
if (!existsSync(dist)) {
  console.error(`✗ ${dist}/ absent. Lancer « npm run build » d'abord.`);
  process.exit(2);
}

const cible = join(dist, 'index.html');
const MARQUEUR = 'tabibi-porte';

if (etat === 'fermee') {
  const source = 'porte/porte-fermee.html';
  if (!existsSync(source)) { console.error(`✗ ${source} introuvable.`); process.exit(2); }
  // On garde l'accueil public sous un nom stable : il reste déployé, mais
  // il n'est plus la page d'entrée. Rien n'est perdu, rien n'est deviné.
  if (existsSync(cible)) copyFileSync(cible, join(dist, 'accueil-public.html'));
  copyFileSync(source, cible);
}

// Marqueur vérifiable de l'extérieur, dans les deux états.
let html = readFileSync(cible, 'utf8');
html = html.replace(/\s*<meta name="tabibi-porte"[^>]*>/g, '');
const meta = `<meta name="${MARQUEUR}" content="${etat}" data-genere="${new Date().toISOString()}">`;
html = html.includes('</head>') ? html.replace('</head>', `  ${meta}\n</head>`) : meta + html;
writeFileSync(cible, html);

const taille = Buffer.byteLength(html);
console.log(`✓ Porte « ${etat} » appliquée à ${cible} (${taille} octets).`);
if (etat === 'fermee') console.log(`  L'accueil public reste déployé sous ${dist}/accueil-public.html.`);
console.log('');
console.log('  Contrôle après déploiement, depuis l\'extérieur :');
console.log(`    curl -s "https://tabibi.doctor/?cb=$RANDOM" | grep -o 'name="${MARQUEUR}" content="[a-z]*"'`);
console.log(`    → doit rendre : name="${MARQUEUR}" content="${etat}"`);
