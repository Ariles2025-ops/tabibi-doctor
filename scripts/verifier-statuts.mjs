#!/usr/bin/env node
// =====================================================================
// verifier-statuts.mjs — l'utilitaire connait-il TOUS les statuts ?
// =====================================================================
// Sans cette garde, on corrige six ecrans aujourd'hui et le trou se rouvre
// au premier `ALTER TYPE appointment_status ADD VALUE`.
//
// DEUX ETAGES, parce qu'ils n'attrapent pas la meme faute :
//
//   structurel (defaut, AUCUN secret) — compare la liste de
//     js/tabibi-statut-rdv.js au fichier de reference
//     supabase/enums/appointment_status.txt. Attrape : « quelqu'un a touche
//     l'un sans l'autre ». Deterministe, hors ligne, dans les portes locales.
//
//   base (--base, exige un jeton) — compare la liste a l'enum REEL lu dans
//     pg_enum. Attrape : « quelqu'un a fait un ALTER TYPE en base et n'a
//     rien mis dans le depot ». C'est la faute que le structurel ne peut PAS
//     voir : le depot est coherent avec lui-meme, et faux.
//
// Usage : node scripts/verifier-statuts.mjs [--base]
// =====================================================================
import { readFileSync } from 'node:fs';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;

function listeUtilitaire() {
  const src = readFileSync('js/tabibi-statut-rdv.js', 'utf8');
  const m = src.match(/var VALEURS = \[([^\]]*)\]/);
  if (!m) throw new Error("VALEURS introuvable dans js/tabibi-statut-rdv.js");
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

function listeReference() {
  return readFileSync('supabase/enums/appointment_status.txt', 'utf8')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

async function listeBase() {
  const ref = 'pudugodhiofqrctcdwfl';
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  if (!jeton) {
    console.error(ROUGE('✗ --base exige SUPABASE_ACCESS_TOKEN dans l\'environnement.'));
    console.error('  Rien n\'est lu depuis le trousseau par ce script : le jeton est fourni par l\'appelant.');
    process.exit(2);
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "select e.enumlabel as v from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='appointment_status' order by e.enumsortorder"
    })
  });
  if (!r.ok) { console.error(ROUGE(`✗ lecture de l'enum : HTTP ${r.status}`)); process.exit(2); }
  const rows = await r.json();
  if (!Array.isArray(rows)) { console.error(ROUGE('✗ reponse inattendue')); process.exit(2); }
  return rows.map((x) => x.v);
}

function comparer(nomA, a, nomB, b) {
  const manquantes = b.filter((x) => !a.includes(x));   // en B, absentes de A
  const enTrop = a.filter((x) => !b.includes(x));       // en A, absentes de B
  console.log(`  ${nomA} : ${a.join(', ')}`);
  console.log(`  ${nomB} : ${b.join(', ')}`);
  if (!manquantes.length && !enTrop.length) return true;
  if (manquantes.length) {
    console.error(ROUGE(`\n✗ ${manquantes.length} statut(s) de ${nomB} que ${nomA} ne connait pas : ${manquantes.join(', ')}`));
    console.error(`  Ces rendez-vous s'afficheront « Statut inconnu », en gris, sans action et hors des totaux.`);
    console.error(`  C'est le repli sur, pas un etat acceptable : declare-les dans js/tabibi-statut-rdv.js`);
    console.error(`  (TABLE + VALEURS), ajoute leurs libelles aux trois dictionnaires, et mets a jour`);
    console.error(`  supabase/enums/appointment_status.txt.`);
  }
  if (enTrop.length) {
    console.error(ROUGE(`\n✗ ${enTrop.length} statut(s) declare(s) dans ${nomA} et absent(s) de ${nomB} : ${enTrop.join(', ')}`));
    console.error(`  Du code mort, ou une reference perimee.`);
  }
  return false;
}

const base = process.argv.includes('--base');
const util = listeUtilitaire();
let ok;
if (base) {
  console.log('Controle BASE — l\'utilitaire contre l\'enum reel de pg_enum.');
  ok = comparer('utilitaire', util, 'enum en base', await listeBase());
} else {
  console.log('Controle STRUCTUREL — l\'utilitaire contre la reference du depot (aucun secret).');
  console.log('  Il ne voit PAS un ALTER TYPE fait en base : pour cela, --base.');
  ok = comparer('utilitaire', util, 'reference', listeReference());
}
if (!ok) process.exit(1);
console.log('\nStatuts alignes.');
