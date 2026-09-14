#!/usr/bin/env node
// =====================================================================
// generer-police-arabe.mjs — embarque Noto Naskh Arabic dans un module TS
// =====================================================================
// Une edge function qui irait chercher sa police par le reseau au moment de
// signer une ordonnance dependrait d'un second service pour produire un
// document medical. Embarquee, elle ne peut pas manquer.
//
// Source : @fontsource/noto-naskh-arabic (SIL Open Font License 1.1),
// sous-ensemble « arabic », poids 400, format WOFF — 87 Ko.
//
// Usage :
//   npm i --no-save @fontsource/noto-naskh-arabic
//   node scripts/generer-police-arabe.mjs [chemin/vers/le.woff]
//
// Le module produit porte le SHA-256 du binaire : une regeneration qui ne
// change pas l'empreinte prouve qu'on a bien remis la meme police.
// =====================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DEFAUT = 'node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff';
const source = process.argv[2] || DEFAUT;

if (!existsSync(source)) {
  console.error(`Police introuvable : ${source}`);
  console.error('Poser d\'abord : npm i --no-save @fontsource/noto-naskh-arabic');
  process.exit(1);
}

const binaire = readFileSync(source);
const sha = createHash('sha256').update(binaire).digest('hex');
const b64 = binaire.toString('base64');

const lignes = [];
for (let i = 0; i < b64.length; i += 100) lignes.push(`  '${b64.slice(i, i + 100)}'`);

const sortie = `// supabase/functions/_partage/police-arabe.ts
// =====================================================================
// Noto Naskh Arabic — embarquee, parce qu'un PDF ne va pas chercher sa police
// =====================================================================
// PROVENANCE : @fontsource/noto-naskh-arabic, sous-ensemble « arabic »,
// poids 400, format WOFF. ${binaire.length} octets.
// LICENCE : SIL Open Font License 1.1 — Copyright 2022 The Noto Project
// Authors. Le texte complet est dans LICENSE-NOTO.txt, a cote.
//
// POURQUOI EMBARQUEE, ET PAS TELECHARGEE
// Une edge function qui irait chercher sa police par le reseau au moment de
// signer une ordonnance dependrait d'un second service pour produire un
// document medical. Embarquee, elle ne peut pas manquer — et la generation
// reste deterministe, ce dont depend \`pdf_sha256\`.
//
// ⚠️ NE PAS EDITER A LA MAIN. Regenere par :
//     npm i --no-save @fontsource/noto-naskh-arabic
//     node scripts/generer-police-arabe.mjs
// =====================================================================

/** SHA-256 du binaire d'origine — une regeneration se prouve par cette valeur. */
export const POLICE_ARABE_SHA256 = '${sha}';

/** Noto Naskh Arabic (sous-ensemble arabe), WOFF, en base64. */
export const POLICE_ARABE_B64 =
${lignes.join(' +\n')};

/** Le binaire, decode a la demande. */
export function policeArabe(): Uint8Array {
  const bin = atob(POLICE_ARABE_B64);
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}
`;

writeFileSync('supabase/functions/_partage/police-arabe.ts', sortie);
console.log(`module ecrit — police ${binaire.length} octets, sha256 ${sha.slice(0, 16)}…`);
console.log(`taille du module : ${(sortie.length / 1024).toFixed(0)} Ko`);
