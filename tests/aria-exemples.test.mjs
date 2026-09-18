// =====================================================================
// tests/aria-exemples.test.mjs — le lecteur d'écran annonçait l'EXEMPLE
// =====================================================================
// Dix-sept champs portaient un `aria-label` **recopié de leur placeholder** :
//
//     medecin-profile.html      « CO-2025-XXXX » · « 0661 234 567 » · « 2500 »
//                               « 1800 » · « 3500 » · « https://... » · « 123456 »
//     onboarding-medecin.html   « CO-XXXX-XXXXX » · « 2018 » · « 2500 »
//                               « +213 555 12 34 56 »
//     patient-profile.html      « XX-XXXX-XXXXXXX » · « 0555 123 456 »
//     secretaire-dashboard.html « email@exemple.com ou 0555... »
//     admin-dashboard / admin-doctor-validation / doctor-dashboard  les recherches
//
// Un lecteur d'écran annonce donc « deux mille cinq cents » là où il devrait
// dire « Tarif consultation ».
//
// ---------------------------------------------------------------------
// ⚠️ ET C'EST PIRE QUE DE NE RIEN METTRE
// ---------------------------------------------------------------------
// **`aria-label` PRIME sur le `<label>` associé.** Sur `patient-profile.html`,
// le label « N° matricule » était correctement lié par `for` — et rendu **muet**
// par un `aria-label` qui disait « XX-XXXX-XXXXXXX ». Retirer l'attribut aurait
// suffi à améliorer la page ; le recopier l'a dégradée.
//
// ---------------------------------------------------------------------
// LE CANAL MANQUAIT, ET C'EST LA VRAIE CAUSE
// ---------------------------------------------------------------------
// `js/tabibi-i18n.js` avait `data-i18n-placeholder` et `data-i18n-title`.
// **Pas `data-i18n-aria-label`.** Sans canal, un intitulé correct n'aurait pas
// été traduit — d'où la tentation de recopier le placeholder, qui, lui, l'était.
// Le canal est ajouté dans le même lot : sinon on corrige les symptômes et on
// laisse la cause.
//
// ---------------------------------------------------------------------
// POURQUOI UN ESSAI DE FICHIERS
// ---------------------------------------------------------------------
// Il **parcourt le dépôt**. Un champ ajouté demain avec un `aria-label` en
// forme d'exemple sera attrapé sans que personne ait à l'inscrire ici. C'est la
// différence entre une liste et un filet — et c'est ce qui manquait à P-100,
// dont la liste `IGNORE` cachait `blog/` (P-116).
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const RACINE = process.cwd();

/** Les pages de l'application, à la racine du dépôt. */
const PAGES = readdirSync(RACINE)
  .filter((n) => /\.html$/i.test(n) && !/^CHANTIER_/.test(n));

/** Sans commentaires : la garde ne s'accuse pas de sa propre documentation. */
const nu = (src) => src.replace(/<!--[\s\S]*?-->/g, ' ');

/**
 * Ce qui fait qu'un intitulé est un EXEMPLE et non un intitulé.
 * ⚠️ Chaque motif vient d'un cas réellement trouvé le 18/09 — on ne devine pas
 * des formes qu'on n'a pas vues.
 */
const EXEMPLES = [
  { nom: 'gabarit en X', re: /^[X\s\-_/]*X{2,}[X\s\-_/]*$|X{3,}/ },
  { nom: 'référence à trous', re: /^[A-Z]{2}-[0-9X]{4}-[0-9X]{4,}$/i },
  { nom: 'nombre nu', re: /^[\d\s+().-]+$/ },
  { nom: 'URL d’exemple', re: /^https?:\/\/\s*\.{2,}\s*$/i },
  { nom: 'adresse d’exemple', re: /exemple\.com|example\.com|@exemple|@example/i },
  // ⚠️ LE PIRE CAS TROUVÉ, ET IL N'ÉTAIT PAS DANS LE RAPPORT. Six champs
  // portaient une **clé i18n BRUTE** comme nom accessible : `ph_hero_search`
  // sur la recherche de l'accueil — la page la plus visitée — et
  // `mo_med_name_ph`, `mo_med_dosage_ph`… sur l'ordonnancier. Un lecteur
  // d'écran épelle « p h underscore hero underscore search ».
  { nom: 'clé i18n brute', re: /^[a-z][a-z0-9]*(_[a-z0-9]+){1,}$/ },
  { nom: 'préfixe d’exemple', re: /^(ex|e\.g|par ex)\b\s*[:.]/i },
];

/**
 * Vrai si l'attribut est CALCULÉ au rendu — gabarit `${…}` ou concaténation
 * `' + _t(…) + '`. Ce qui arrive dans le DOM est alors le texte traduit.
 *
 * ⚠️ MA PREMIÈRE VERSION LES REFUSAIT comme « source JS échappée ». Elle
 * accusait `dawini.html` (« Retirer cette alerte ») et `dawini-pharmacie.html`
 * de défauts inexistants : ces attributs rendent une traduction correcte.
 * **Une garde qui lit le littéral d'un gabarit ne lit pas ce que l'écran dit.**
 */
function estConstruitALExecution(valeur) {
  return /\$\{|_t\(|_esc\(|T\(|'\s*\+/.test(valeur);
}

function estUnExemple(valeur) {
  const v = valeur.trim();
  if (!v) return null;
  for (const { nom, re } of EXEMPLES) if (re.test(v)) return nom;
  return null;
}

test('aucun aria-label n’est un exemple recopié du placeholder', () => {
  const coupables = [];
  for (const nomFichier of PAGES) {
    const src = nu(readFileSync(join(RACINE, nomFichier), 'utf8'));
    // ⚠️ `(?<![-\w])` : sans lui, ce motif attrape aussi
    // **`data-i18n-aria-label="…"`**, dont la valeur EST une clé i18n par
    // construction. La garde s'accusait alors de ses propres corrections —
    // dix-sept fois. C'est la même faute que le lookbehind du placeholder, à
    // deux essais d'intervalle.
    for (const m of src.matchAll(/(?<![-\w])aria-label="([^"]*)"/g)) {
      // ⚠️ Un aria-label construit à l'exécution — gabarit `${…}` ou
      // concaténation `' + _t(…) + '` — est déjà un appel de traduction. Ce
      // qui arrive dans le DOM est le texte traduit, pas ce littéral : on ne
      // le juge pas sur sa forme brute. Vu sur `medecin-ordonnance.html` et
      // `dawini*.html`, et vérifié : ce sont de vrais intitulés.
      if (estConstruitALExecution(m[1])) continue;
      const forme = estUnExemple(m[1]);
      if (forme) coupables.push(`${nomFichier} — « ${m[1]} » (${forme})`);
    }
  }
  assert.deepEqual(coupables, [],
    `Ces aria-label annoncent un exemple au lecteur d’écran :\n  ${coupables.join('\n  ')}`);
});

test('un aria-label n’est jamais la copie d’un placeholder qui est un EXEMPLE', () => {
  // ⚠️ DEUX CORRECTIONS DE MA PROPRE GARDE, TOUTES DEUX MESURÉES.
  //
  // 1. `/placeholder="…"/` attrapait aussi **`data-i18n-placeholder="…"`** —
  //    la chaîne y est contenue. La garde comparait donc l'aria-label à une
  //    CLÉ i18n, pas au placeholder. Sur `accueil-public.html` elle criait
  //    « aria-label == placeholder : ph_hero_search » alors que le placeholder
  //    rendu vaut « Dr. Benali, Cardiologie, Alger... » — mesuré au navigateur.
  //    D'où le `(?<![-\w])` : on veut l'attribut, pas sa fin de nom.
  //
  // 2. Ma première version refusait TOUTE copie du placeholder. Elle sortait
  //    rouge sur `api-docs.html` (« Email professionnel »), `medecin-profile`
  //    (« Nom de votre cabinet »), `patient-profile` (« Numéro de carte
  //    CHIFA ») — des placeholders qui sont de **vrais intitulés**. Les
  //    recopier est redondant, pas faux. **Une garde qui pleure sur du code
  //    juste finit désactivée** : elle ne refuse la copie que si la valeur
  //    copiée est elle-même un exemple.
  const coupables = [];
  for (const nomFichier of PAGES) {
    const src = nu(readFileSync(join(RACINE, nomFichier), 'utf8'));
    for (const m of src.matchAll(/<input\b[^>]*>|<textarea\b[^>]*>|<select\b[^>]*>/g)) {
      const balise = m[0];
      const ph = /(?<![-\w])placeholder="([^"]*)"/.exec(balise);
      const al = /(?<![-\w])aria-label="([^"]*)"/.exec(balise);
      if (!ph || !al || estConstruitALExecution(al[1])) continue;
      if (!ph[1].trim() || ph[1].trim() !== al[1].trim()) continue;
      const forme = estUnExemple(al[1]);
      if (forme) coupables.push(`${nomFichier} — aria-label == placeholder d’exemple : « ${ph[1]} » (${forme})`);
    }
  }
  assert.deepEqual(coupables, [],
    `Ces champs annoncent leur exemple au lieu de leur intitulé :\n  ${coupables.join('\n  ')}`);
});

test('le canal `data-i18n-aria-label` EXISTE — sinon les intitulés ne se traduisent pas', () => {
  // ⚠️ C'EST LA CAUSE, PAS UN DÉTAIL. `placeholder` et `title` avaient leur
  // canal ; `aria-label`, non. Un intitulé correct posé sans canal reste en
  // français pour un lecteur arabophone — et la tentation de recopier le
  // placeholder (lui, traduit) revient.
  const src = readFileSync(join(RACINE, 'js/tabibi-i18n.js'), 'utf8');
  assert.match(src, /\[data-i18n-aria-label\]/,
    'le canal de traduction des aria-label a disparu de js/tabibi-i18n.js');
  assert.match(src, /setAttribute\('aria-label',\s*tr\)/,
    'le canal existe mais n’écrit plus l’attribut');
  // ⚠️ Et il ne doit pas entrer en conflit avec la passe automatique, qui
  // saute déjà tout élément portant `data-i18n-<attr>`.
  assert.match(src, /el\.hasAttribute\('data-i18n-' \+ attr\)/,
    'la passe automatique ne saute plus les attributs pris en charge explicitement');
});

test('les clés visées existent dans LES TROIS dictionnaires', () => {
  // ⚠️ Un `data-i18n-aria-label` qui pointe une clé absente ne fait RIEN :
  // `if (tr && tr !== key)` laisse l'attribut tel quel. La faute serait
  // silencieuse — l'exemple reviendrait par la porte de derrière.
  const charger = (lang) => {
    const ctx = { window: {}, document: { body: null } };
    vm.runInNewContext(readFileSync(join(RACINE, `js/i18n/${lang}.js`), 'utf8'), ctx);
    return ctx.window.TABIBI_TR[lang];
  };
  const dicos = { fr: charger('fr'), ar: charger('ar'), en: charger('en') };

  const manquantes = [];
  let vues = 0;
  for (const nomFichier of PAGES) {
    const src = nu(readFileSync(join(RACINE, nomFichier), 'utf8'));
    for (const m of src.matchAll(/data-i18n-aria-label="([^"]+)"/g)) {
      vues += 1;
      for (const lang of ['fr', 'ar', 'en']) {
        if (!(m[1] in dicos[lang])) manquantes.push(`${nomFichier} — ${m[1]} absente en ${lang}`);
      }
    }
  }
  assert.ok(vues >= 16,
    `seulement ${vues} aria-label traduits : les corrections du 18/09 ont été défaites`);
  assert.deepEqual(manquantes, [],
    `Ces clés d’aria-label ne mènent à rien :\n  ${manquantes.join('\n  ')}`);
});
