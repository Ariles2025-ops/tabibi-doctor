// =====================================================================
// tests/wilayas-69.test.mjs — 58 wilayas codées en dur, à quatre endroits
// =====================================================================
// Décret présidentiel 26-206 du 25/05/2026 : l'Algérie passe de **58 à 69**
// wilayas. La base est faite ; la liste vivait **en dur dans le front**, et pas
// à un seul endroit :
//
//     js/home-app.js            `_W`            (code -> nom FR)
//     js/home-app.js            `WILAYA_I18N`   (nom FR -> AR/EN)
//     assets/dz-wilaya-centroids.js             (code -> lat/lng)
//     signup.html               <select id="sw">
//
// ⚠️ **Quatre copies d'une même liste, c'est quatre occasions de diverger** —
// et elles avaient déjà divergé avant ce lot (voir les deux essais du bas).
//
// Ce fichier n'invente aucune donnée : il vérifie que les quatre disent la
// MÊME chose. Ce que valent les coordonnées, lui, il ne peut pas le dire.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const HOME = readFileSync('js/home-app.js', 'utf8');
const SIGNUP = readFileSync('signup.html', 'utf8');

/** `_W` : code -> nom FR. */
function wilayas() {
  const bloc = HOME.match(/const _W=\{[\s\S]*?\};/);
  assert.ok(bloc, '`_W` a disparu de js/home-app.js');
  const m = new Map();
  for (const x of bloc[0].matchAll(/(\d+):(?:'([^']*)'|"([^"]*)")/g)) {
    m.set(Number(x[1]), x[2] !== undefined ? x[2] : x[3]);
  }
  return m;
}

/** `WILAYA_I18N` : nom FR -> {ar, en}. */
function traductions() {
  const bloc = HOME.match(/const WILAYA_I18N = \{[\s\S]*?\n\};/);
  assert.ok(bloc, '`WILAYA_I18N` a disparu de js/home-app.js');
  const m = new Map();
  for (const x of bloc[0].matchAll(/(?:'([^']*)'|"([^"]*)"):\{ar:'([^']*)',en:(?:'([^']*)'|"([^"]*)")\}/g)) {
    m.set(x[1] !== undefined ? x[1] : x[2], { ar: x[3], en: x[4] !== undefined ? x[4] : x[5] });
  }
  return m;
}

/** Les chefs-lieux, charges pour de vrai — pas relus a l'oeil. */
async function centroides() {
  globalThis.window = globalThis.window || {};
  const src = readFileSync('assets/dz-wilaya-centroids.js', 'utf8');
  new Function('window', src)(globalThis.window);
  return globalThis.window.DZ_WILAYAS;
}

/** Les options du menu de `signup.html`, placeholder exclu. */
function optionsSignup() {
  const d = SIGNUP.indexOf('id="sw"');
  assert.ok(d > -1, 'le menu wilaya de signup.html a disparu');
  const bloc = SIGNUP.slice(d, SIGNUP.indexOf('</select>', d));
  return [...bloc.matchAll(/<option(?![^>]*value="")[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
}

// ─────────────────────────────────────────────────────────────────────
// 1. LE COMPTE, AUX QUATRE ENDROITS
// ─────────────────────────────────────────────────────────────────────
test('les quatre listes comptent 69 wilayas', async () => {
  const W = wilayas();
  assert.equal(W.size, 69, `_W en a ${W.size}`);
  assert.equal(traductions().size, 69, 'WILAYA_I18N ne couvre pas les 69');
  assert.equal(Object.keys(await centroides()).length, 69, 'dz-wilaya-centroids n en a pas 69');
  assert.equal(optionsSignup().length, 69, 'le menu de signup.html n en a pas 69');
});

test('les codes vont de 1 a 69, sans trou ni doublon', async () => {
  const W = wilayas();
  const C = await centroides();
  for (let i = 1; i <= 69; i++) {
    assert.ok(W.has(i), `code ${i} absent de _W`);
    assert.ok(C[i], `code ${i} absent des chefs-lieux`);
  }
  assert.equal(new Set(W.values()).size, 69, 'deux codes portent le meme nom');
});

// ─────────────────────────────────────────────────────────────────────
// 2. LES ONZE NOUVELLES — decret 26-206 du 25/05/2026
// ─────────────────────────────────────────────────────────────────────
const NOUVELLES = [
  [59, 'Aflou'], [60, 'Barika'], [61, 'El Kantara'], [62, 'Bir El Ater'],
  [63, 'El Aricha'], [64, 'Ksar Chellala'], [65, 'Aïn Ouessara'], [66, 'Messaad'],
  [67, 'Ksar El Boukhari'], [68, 'Bou Saâda'], [69, 'El Abiodh Sidi Cheikh'],
];

test('les onze nouvelles sont au bon code, au caractere pres', () => {
  const W = wilayas();
  for (const [code, nom] of NOUVELLES) {
    assert.equal(W.get(code), nom, `code ${code}`);
  }
});

test('les onze ont un libelle arabe ET anglais, non vides', () => {
  const T = traductions();
  for (const [, nom] of NOUVELLES) {
    const t = T.get(nom);
    assert.ok(t, `${nom} n'a aucune traduction`);
    assert.ok(t.ar && t.ar.trim().length >= 3, `${nom} : libelle arabe vide`);
    assert.ok(t.en && t.en.trim().length >= 3, `${nom} : libelle anglais vide`);
    // Un libelle « arabe » ecrit en latin est une traduction qui n'a pas ete faite.
    assert.match(t.ar, /[؀-ۿ]/, `${nom} : le libelle « arabe » ne contient aucun caractere arabe`);
  }
});

test('les onze ont un chef-lieu, avec des coordonnees numeriques et plausibles', async () => {
  const C = await centroides();
  for (const [code, nom] of NOUVELLES) {
    const c = C[code];
    assert.equal(c.name, nom, `code ${code} : nom different des chefs-lieux`);
    assert.equal(typeof c.lat, 'number', `${nom} : lat non numerique`);
    assert.equal(typeof c.lng, 'number', `${nom} : lng non numerique`);
    // Les bornes de l'Algerie, ecrites en tete du fichier de donnees.
    assert.ok(c.lat > 19 && c.lat < 37, `${nom} : lat ${c.lat} hors d'Algerie`);
    assert.ok(c.lng > -9 && c.lng < 12, `${nom} : lng ${c.lng} hors d'Algerie`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// 3. ⚠️ LES DEUX DIVERGENCES TROUVEES EN FAISANT CE LOT
// ─────────────────────────────────────────────────────────────────────
test('CHAQUE wilaya a une traduction — pas seulement les 48 d\'avant 2019', () => {
  // ⚠️ `WILAYA_I18N` s'arretait a 48. Les dix wilayas de 2019 — El M'Ghair,
  // El Meniaa, Ouled Djellal, Bordj Baji Mokhtar, Béni Abbès, Timimoun,
  // Touggourt, Djanet, In Salah, In Guezzam — n'avaient NI arabe NI anglais,
  // et `dcity()` retombait sur le francais sans rien signaler.
  //
  // On ne cherchait pas ce trou : on l'a heurte en ajoutant les onze de 2026.
  const T = traductions();
  const sans = [...wilayas().values()].filter((n) => !T.has(n));
  assert.deepEqual(sans, [], `wilaya(s) sans libelle AR/EN : ${sans.join(', ')}`);
});

test('signup.html dit EXACTEMENT les memes noms que `_W`', () => {
  // ⚠️ `signup.html` ecrivait « Bordj Badji Mokhtar », `_W` et la base
  // « Bordj Baji Mokhtar ». Un medecin qui choisissait cette wilaya a
  // l'inscription posait une valeur que la recherche ne retrouvait pas.
  // **Une lettre.** C'est le genre de defaut qu'aucune relecture n'attrape et
  // qu'une comparaison attrape toujours.
  const attendus = [...wilayas().values()];
  const trouves = optionsSignup();
  assert.deepEqual(trouves, attendus,
    'le menu de signup.html a divergé de `_W` — comparer les deux listes');
});

test('les noms des chefs-lieux sont ceux de `_W`, code par code', async () => {
  const W = wilayas();
  const C = await centroides();
  const ecarts = [];
  for (const [code, nom] of W) {
    if (C[code] && C[code].name !== nom) ecarts.push(`${code}: « ${C[code].name} » ≠ « ${nom} »`);
  }
  assert.deepEqual(ecarts, [], `nom(s) divergent(s) :\n  ${ecarts.join('\n  ')}`);
});

// ─────────────────────────────────────────────────────────────────────
// 4. LE TEXTE VISIBLE — corriger la liste ne corrige pas la phrase
// ─────────────────────────────────────────────────────────────────────
//
// ⚠️ SIGNALE PAR AGHILES SUR LA PAGE EN LIGNE, apres le lot precedent : les
// quatre listes etaient a 69, et le titre disait toujours « 58 wilayas ». Le
// bloc de statistiques affichait « 58 ».
//
// **Une donnee corrigee et une phrase qui la contredit, c'est pire qu'avant :**
// la page se contredit elle-meme, et le lecteur croit la phrase.
const PRODUIT = execSync('git ls-files "*.html" "*.js" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:tests/**" ":!:v2/**" ":!:node_modules/**"')
  .toString().trim().split('\n').filter(Boolean);

test('aucune phrase visible ne dit encore « 58 wilayas »', () => {
  const restes = [];
  for (const f of PRODUIT) {
    const src = readFileSync(f, 'utf8');
    // Les trois langues. L'arabe compte autant que le francais : c'est la
    // meme promesse, faite a quelqu'un d'autre.
    for (const m of src.matchAll(/(58 wilayas|58 Wilayas|les 58 wilayas|58 ولاية)/g)) {
      restes.push(`${f}:${src.slice(0, m.index).split('\n').length} « ${m[1]} »`);
    }
  }
  assert.deepEqual(restes, [],
    `mention(s) de 58 wilayas encore visibles :\n  ${restes.join('\n  ')}`);
});

test('le compteur de wilayas est DERIVE de `_W`, pas recopie', () => {
  // Il etait « 58 » en dur a deux endroits de `accueil-public.html`. Le
  // decoupage a change DEUX fois (48 -> 58 en 2019, 58 -> 69 en 2026) et ce
  // nombre est reste faux les deux fois. **Un chiffre recopie ne se met jamais
  // a jour.**
  assert.match(HOME, /const _nbW = String\(Object\.keys\(_W\)\.length\);/,
    'le compteur n est plus derive de `_W`');
  assert.match(HOME, /set\('stats-wilaya-n', _nbW\)/);
  assert.match(HOME, /set\('hs-wilaya-n', _nbW\)/);
  // Et les deux points d'affichage existent bien dans la page.
  const accueil = readFileSync('accueil-public.html', 'utf8');
  assert.match(accueil, /id="stats-wilaya-n"/);
  assert.match(accueil, /id="hs-wilaya-n"/);
});

// ─────────────────────────────────────────────────────────────────────
// 5. LES DEUX COPIES QUI DORMAIENT AILLEURS — 16/09/2026
// ─────────────────────────────────────────────────────────────────────
//
// ⚠️ Le lot de 2026 avait aligné les QUATRE listes et les phrases de l'accueil.
// Deux nombres étaient restés dans des modules que personne n'avait ouverts :
//
//   js/tabibi-dawini.js   `wilaya > 58`   — une demande depuis une des ONZE
//                                           nouvelles wilayas était REFUSÉE,
//                                           silencieusement, par un contrôle
//                                           de saisie.
//   js/tabibi-brevo.js    « 48 wilayas »  — dans un e-mail de bienvenue. Une
//                                           fois expédié, on ne le corrige plus.
//
// Le second ne dit plus de nombre du tout : le découpage a changé deux fois et
// la copie est restée fausse les deux fois. **Une phrase sans chiffre ne se
// périme pas.**

/** Le code d'un fichier, commentaires retirés. */
function codeNu(chemin) {
  return readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n');
}

test('la borne de Dawini suit `_W`, elle ne vit pas sa vie', () => {
  // ⚠️ On ne vérifie pas « c'est 69 » : ce serait recopier le chiffre une
  // cinquième fois, dans l'essai. On vérifie qu'il ÉGALE la liste de référence.
  const src = codeNu('js/tabibi-dawini.js');
  const m = src.match(/NB_WILAYAS\s*=\s*(\d+)/);
  assert.ok(m, '`NB_WILAYAS` a disparu de js/tabibi-dawini.js');
  assert.equal(Number(m[1]), wilayas().size,
    `Dawini borne a ${m[1]} wilayas, \`_W\` en compte ${wilayas().size}`);
  assert.match(src, /wilaya\s*>\s*NB_WILAYAS/,
    'la borne de Dawini est redevenue un nombre en dur');
});

test('aucun module ne dit encore « 48 wilayas »', () => {
  // ⚠️ Lu SANS les commentaires : celui qui explique ce défaut cite la phrase.
  // Neuvième fois que ce piège se présente dans ce dépôt.
  const restes = [];
  for (const f of ['js/tabibi-brevo.js', 'js/tabibi-dawini.js']) {
    const src = codeNu(f);
    for (const m of src.matchAll(/(48 wilayas|48 Wilayas|48 ولاية|58 wilayas)/g)) {
      restes.push(`${f}:${src.slice(0, m.index).split('\n').length} « ${m[1]} »`);
    }
  }
  assert.deepEqual(restes, [], `mention(s) perimee(s) :\n  ${restes.join('\n  ')}`);
});

test('la valeur ecrite dans le HTML vaut deja 69 — avant meme que le script tourne', () => {
  // Le script la reecrit, mais la page doit etre juste des le premier rendu :
  // un lecteur sans JavaScript, un robot d'indexation, une capture d'ecran.
  const accueil = readFileSync('accueil-public.html', 'utf8');
  for (const id of ['stats-wilaya-n', 'hs-wilaya-n']) {
    const m = accueil.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
    assert.ok(m, `${id} introuvable`);
    assert.equal(m[1].trim(), '69', `${id} affiche « ${m[1]} » dans le HTML servi`);
  }
});
