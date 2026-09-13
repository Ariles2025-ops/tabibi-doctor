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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

// [INVERSION 2026-09-13] La porte etait un GESTE ; elle est desormais l'ETAT DU
// DEPOT. Avant : `index.html` = l'application, et ce script la FERMAIT apres le
// build — donc tout hebergeur qui ne lance pas ce script servait l'app ouverte.
// C'est ce qui s'est passe sur Netlify (`netlify.toml:6`, `publish = "."`, sans
// `command`) : l'application complete, branchee sur la base de PRODUCTION,
// pendant que neuf entrees du journal disaient « porte fermee ».
//
// Apres : `index.html` a la racine EST la page fermee, et l'application vit dans
// `accueil-public.html`. Oublier ce script FERME la porte au lieu de l'ouvrir.
// Le sens de l'erreur est enfin le bon.
//
//   fermee   -> rien a copier, le build porte deja la page fermee. On pose le
//               marqueur, c'est tout.
//   ouverte  -> on copie `accueil-public.html` par-dessus `index.html` et on
//               retablit `index,follow`. Le marqueur devient la PREUVE QUE LE
//               GESTE D'OUVERTURE A EU LIEU, au lieu d'etre la preuve qu'il a eu
//               lieu dans le bon sens.
//
// La garde qui tient tout ceci : `npm run verifier:porte`.
if (etat === 'ouverte') {
  const source = join(dist, 'accueil-public.html');
  if (!existsSync(source)) {
    console.error(`✗ ${source} introuvable : impossible d'ouvrir la porte.`);
    console.error("  L'application doit etre construite dans dist-web sous ce nom.");
    process.exit(2);
  }
  let pub = readFileSync(source, 'utf8');
  // Le fichier source porte `noindex,nofollow` tant que la porte est fermee,
  // puisqu'il est servi tel quel par tout hebergeur qui publie la racine. En
  // l'ouvrant, il devient la page d'accueil publique : il redevient indexable.
  pub = pub.replace(/<meta\s+name="robots"[^>]*>/i,
                    '<meta name="robots" content="index,follow,max-image-preview:large">');
  writeFileSync(cible, pub);
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
