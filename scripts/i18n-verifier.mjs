#!/usr/bin/env node
// =====================================================================
// i18n-verifier.mjs — les trois dictionnaires doivent avoir les MEMES cles
// =====================================================================
// Avant le decoupage du 09/09/2026, l'anglais avait 21 cles de moins que le
// francais et personne ne le voyait : la cle tombait en francais en silence.
// Ce script echoue (sortie 1) des qu'une langue manque une cle ou qu'une
// traduction automatique n'existe pas dans les deux langues cibles.
// Usage : node scripts/i18n-verifier.mjs   (branche en CI)
// =====================================================================
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const charger = (lang) => {
  const ctx = { window: {}, document: { body: null } };
  vm.runInNewContext(readFileSync(`js/i18n/${lang}.js`, 'utf8'), ctx);
  return { tr: ctx.window.TABIBI_TR[lang], auto: ctx.window.TABIBI_AUTO || {} };
};
const L = { fr: charger('fr'), ar: charger('ar'), en: charger('en') };
let echec = false;
const ref = Object.keys(L.fr.tr);
for (const lang of ['ar', 'en']) {
  const manquantes = ref.filter((k) => !(k in L[lang].tr));
  const enTrop = Object.keys(L[lang].tr).filter((k) => !(k in L.fr.tr));
  console.log(`${lang}: ${Object.keys(L[lang].tr).length} cles | manquantes ${manquantes.length} | orphelines ${enTrop.length}`);
  if (manquantes.length) { echec = true; console.log('  manquantes :', manquantes.slice(0, 10).join(', ')); }
}
const autoAr = Object.keys(L.ar.auto), autoEn = Object.keys(L.en.auto);
const diff = autoAr.filter((k) => !autoEn.includes(k)).concat(autoEn.filter((k) => !autoAr.includes(k)));
console.log(`auto: ar ${autoAr.length} | en ${autoEn.length} | desalignees ${diff.length}`);
if (diff.length) { echec = true; console.log('  ', diff.slice(0, 5)); }
if (echec) { console.error('\nDictionnaires DESALIGNES.'); process.exit(1); }
console.log('\nDictionnaires alignes.');
