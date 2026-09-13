#!/usr/bin/env node
// =====================================================================
// compter-dette.mjs — le compteur ne doit que BAISSER
// =====================================================================
// Les regles ESLint du projet sont en `warn`, pas en `error` : les passer en
// erreur rendrait la CI rouge en permanence sur ~200 points existants, et on
// prendrait l'habitude de l'ignorer. Le contrat est different : un plafond
// par regle, qui ne remonte jamais.
//
// Usage :  npm run lint:dette
// En CI  :  sortie 1 si un plafond est depasse.
// Quand une dette baisse, ABAISSER le plafond ici, dans le meme commit.
// =====================================================================

const PLAFONDS = {
  'no-empty': 0,           // 74 -> 0 le 09/09/2026 : chaque catch signale via window.tabibiErreur
  'no-unused-vars': 43,   // 117 -> 43 le 09/09/2026
  'no-console': 28,
  'no-restricted-properties': 57, // innerHTML dans js/ ; 58 -> 57 le 12/09/2026 — un cliquet qui ne se resserre jamais ne sert à rien
  'no-undef': 0,
  // [13/09/2026] Horloge locale sur une date de rendez-vous. Plafond au compte
  // REEL apres correction (18 -> 3), jamais releve « en attendant ». Les trois
  // restants : js/home-app.js:1339 et js/tabibi-legal-version.js:40 sont des
  // REPLIS quand le formateur partage n'est pas charge ; js/tabibi-reviews.js:326
  // est le mois d'un avis, pas une date de rendez-vous.
  // Le JS inline des pages HTML echappe a eslint : c'est verifier-fuseau.mjs.
  'no-restricted-syntax': 3,
};

let brut = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (brut += c));
process.stdin.on('end', () => {
  const compte = {};
  for (const f of JSON.parse(brut)) {
    for (const m of f.messages) {
      const r = m.ruleId || 'parse-error';
      compte[r] = (compte[r] || 0) + 1;
    }
  }
  let echec = false;
  const regles = new Set([...Object.keys(PLAFONDS), ...Object.keys(compte)]);
  for (const r of [...regles].sort()) {
    const n = compte[r] || 0;
    const max = PLAFONDS[r];
    if (max === undefined) {
      console.log(`  ?  ${String(n).padStart(4)}  ${r}  (regle sans plafond — en ajouter un)`);
      continue;
    }
    const ok = n <= max;
    if (!ok) echec = true;
    console.log(`  ${ok ? '=' : 'X'}  ${String(n).padStart(4)} / ${max}  ${r}${n < max ? '   <- baisse : abaisser le plafond' : ''}`);
  }
  if (echec) {
    console.error('\nLa dette a AUGMENTE. Corriger, ou justifier explicitement.');
    process.exit(1);
  }
  console.log('\nDette sous les plafonds.');
});
