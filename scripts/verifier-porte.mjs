#!/usr/bin/env node
// =====================================================================
// verifier-porte.mjs — `index.html` a la racine EST la page fermee
// =====================================================================
// LE DEFAUT QUE CETTE GARDE FERME, constate le 13/09/2026.
//
// `https://effulgent-kelpie-e48e81.netlify.app` — et chaque *Deploy Preview* de
// PR — servait **l'application complete, porte ouverte**, branchee sur la base
// de PRODUCTION. Pendant ce temps, neuf entrees du journal des deploiements
// disaient « porte fermee ».
//
// Les deux etaient vraies. La porte n'etait pas une propriete du CODE, c'etait
// une propriete d'UN GESTE :
//
//   netlify.toml:6        publish = "."   et AUCUNE command
//                         -> la racine du depot est servie telle quelle
//   scripts/porte.mjs     copie porte/porte-fermee.html PAR-DESSUS
//                         dist-web/index.html, APRES le build
//   index.html (racine)   l'application entiere
//
// Netlify ne buildait pas, donc `porte.mjs` ne tournait pas, donc l'app partait
// nue. Tout hebergeur branche sur `main` que personne n'a inventorie faisait
// pareil — et l'inventaire des hotes est un plancher, jamais un plafond :
// Netlify et Vercel se branchent cote fournisseur, sans laisser de fichier.
//
// L'INVERSION. Avant : `index.html` = l'app, et un geste la FERME — oublier le
// geste ouvre la porte. Apres : `index.html` = la page fermee, et un geste
// l'OUVRE — oublier le geste la ferme. C'est la meme inversion que partout
// ailleurs dans ce depot : **le vert doit etre une autorisation, pas un
// defaut.** Ici, la porte ouverte etait le defaut.
//
// PAR EMPREINTE, PAS PAR TAILLE. Deux fichiers de meme taille ne sont pas le
// meme fichier. Le 13/09, une taille annoncee a 115 952 o est sortie a
// 116 268 o parce que Cloudflare reecrit les `mailto:` — une mesure de taille
// avait deja trompe une fois ce jour-la.
//
// Usage : node scripts/verifier-porte.mjs
// =====================================================================
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const RACINE = 'index.html';
const FERMEE = 'porte/porte-fermee.html';
const OUVERTE = 'accueil-public.html';

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

for (const f of [RACINE, FERMEE]) {
  if (!existsSync(f)) {
    console.error(ROUGE(`✗ ${f} est introuvable.`));
    process.exit(2);
  }
}

const hRacine = sha(RACINE);
const hFermee = sha(FERMEE);

console.log(`  ${RACINE.padEnd(24)} ${hRacine.slice(0, 16)}…  ${readFileSync(RACINE).length} o`);
console.log(`  ${FERMEE.padEnd(24)} ${hFermee.slice(0, 16)}…  ${readFileSync(FERMEE).length} o`);

if (hRacine !== hFermee) {
  console.error(ROUGE(`\n✗ index.html a la racine N'EST PAS la page fermee.`));
  console.error(`  Tout hebergeur qui sert le depot tel quel — Netlify avec publish = "." , une`);
  console.error(`  preview de PR, un projet Vercel que personne n'a inventorie — sert alors`);
  console.error(`  l'application OUVERTE sur la base de PRODUCTION.`);
  console.error(``);
  console.error(`  La porte ne doit pas dependre du geste de deploiement : elle doit etre`);
  console.error(`  l'etat du depot. Deplacer l'application vers ${OUVERTE}, et mettre`);
  console.error(`  ${FERMEE} a la racine.`);
  process.exit(1);
}

if (!existsSync(OUVERTE)) {
  console.error(ROUGE(`\n✗ ${OUVERTE} est introuvable.`));
  console.error(`  index.html est bien la page fermee, mais l'application n'est nulle part :`);
  console.error(`  l'ouverture serait impossible. Les deux fichiers vont ensemble.`);
  process.exit(1);
}

console.log(`  ${OUVERTE.padEnd(24)} ${sha(OUVERTE).slice(0, 16)}…  ${readFileSync(OUVERTE).length} o`);
console.log(`\nLa porte est l'etat du depot : index.html EST la page fermee.`);
