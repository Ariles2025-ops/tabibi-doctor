// =====================================================================
// tests/teleconsultation-annonce.test.mjs — le HTML disait vrai, le
// dictionnaire disait faux
// =====================================================================
// ⚠️ SIGNALE PAR AGHILES LE 16/09, SUR LA PAGE EN LIGNE : la carte
// « Téléconsultation » affichait bien le badge **Disponible**, et juste en
// dessous le bouton disait encore **« Être prévenu »**.
//
// Le dépôt, lui, était DEJA juste : `git grep "Être prévenu"` ne rendait rien,
// et `accueil-public.html` servait « Disponible » + « Prendre rendez-vous ».
// Les deux constats sont vrais en même temps, et c'est tout le sujet.
//
// ---------------------------------------------------------------------
// LE MECANISME
// ---------------------------------------------------------------------
// Le HTML est servi en `no-cache` (`_headers`). **`js/i18n/*.js` ne l'est pas
// partout** : `netlify.toml` pose `/js/* max-age=3600`. Le navigateur recevait
// donc un HTML A JOUR et un dictionnaire PERIME — et `setLang()` écrit le
// dictionnaire PAR DESSUS le HTML :
//
//     v = T(cle); if (!v || v === cle) return;   // js/home-app.js
//     el.textContent = v;
//
// Un vieux `v4_tec = "Être prévenu"` gagnait contre un HTML neuf. **Ce n'était
// pas le *quoi* qui était faux, c'était le *quand*** — troisième fois en deux
// jours (P-41, P-42, P-51).
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER GARDE
// ---------------------------------------------------------------------
// 1. Le texte écrit dans le HTML et la valeur FR du dictionnaire disent la
//    MEME chose. Tant qu'ils sont d'accord, un dictionnaire périmé ne peut
//    que réécrire la même phrase — il ne peut plus en ressusciter une autre.
// 2. Aucune des trois langues n'annonce une attente sur une bande qui se dit
//    disponible.
//
// **Ce que ce fichier ne prouve pas :** que la prod serve le bon fichier. Ça,
// ça se mesure au navigateur avec un cache-bust (règle 8) — et la vraie
// parade est la clé NEUVE : un dictionnaire périmé ne connaît pas
// `v4_tec_book`, donc `v === cle` et le HTML reste en place (P-03).
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const PAGE = 'accueil-public.html';

/** Les mots d'attente, dans les trois langues de la page. */
const ATTENTE = /bient[oô]t|pr[ée]venu|coming\s*soon|notify\s*me|قريبا|أعلمني/i;

/**
 * La bande téléconsultation, COMMENTAIRES RETIRES.
 *
 * ⚠️ Le commentaire posé juste au-dessus explique le défaut et cite donc
 * « Etre prevenu ». Une garde qui lirait ses propres commentaires
 * s'accuserait elle-même — c'est arrivé **cinq fois** dans ce dépôt. On lit
 * le code, jamais ce qu'on a écrit à son sujet.
 */
function bande() {
  const src = readFileSync(PAGE, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const d = src.indexOf('<div class="v4-tele">');
  assert.ok(d > -1, 'la bande `.v4-tele` a disparu de ' + PAGE);
  const f = src.indexOf('</div>', src.indexOf('</a>', d));
  return src.slice(d, f);
}

/** `data-i18n` -> texte écrit en dur dans la balise. */
function libelles() {
  const m = new Map();
  for (const x of bande().matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
    m.set(x[1], x[2].trim());
  }
  return m;
}

function dictionnaires() {
  globalThis.window = globalThis.window || {};
  for (const l of ['fr', 'en', 'ar']) {
    const src = readFileSync(`js/i18n/${l}.js`, 'utf8');
    new Function('window', src)(globalThis.window);
  }
  return globalThis.window.TABIBI_TR;
}

// ─────────────────────────────────────────────────────────────────────
test('la bande porte bien un badge et un bouton, tous deux traduits', () => {
  const L = libelles();
  assert.ok(L.size >= 3, `seulement ${L.size} libellé(s) traduit(s) dans la bande`);
  const b = bande();
  assert.match(b, /class="v4-live"/, 'le badge « disponible » a disparu');
  assert.match(b, /<a[^>]*class="[^"]*\bcta\b/, 'le bouton d’action a disparu');
});

test('le bouton propose de RESERVER, et mène à la liste des médecins', () => {
  // ⚠️ « Être prévenu » renvoyait vers `waiting-list.html` : on envoyait
  // attendre une chose qui marche (P-12, P-13). Le bouton doit agir.
  const b = bande();
  const a = b.match(/<a[^>]*class="[^"]*\bcta\b[^"]*"[^>]*>([^<]*)</);
  assert.ok(a, 'bouton introuvable');
  assert.match(a[1], /r[ée]server/i, `le bouton dit « ${a[1].trim()} »`);
  assert.match(b, /href="#sec-docs"/, 'le bouton ne mène plus à la liste des médecins');
  assert.doesNotMatch(b, /waiting-list/, 'le bouton renvoie encore vers la liste d’attente');
});

test('aucune des trois langues n’annonce une ATTENTE sur une bande « disponible »', () => {
  const T = dictionnaires();
  const fautes = [];
  for (const cle of libelles().keys()) {
    for (const l of ['fr', 'en', 'ar']) {
      const v = T[l][cle];
      assert.ok(v, `${l} : la clé « ${cle} » de la bande n’existe pas au dictionnaire`);
      if (ATTENTE.test(v)) fautes.push(`${l}.${cle} = « ${v} »`);
    }
  }
  assert.deepEqual(fautes, [], `libellé(s) d’attente encore présent(s) :\n  ${fautes.join('\n  ')}`);
});

test('le HTML et le dictionnaire FR disent EXACTEMENT la même phrase', () => {
  // ⚠️ C'EST LA GARDE CENTRALE DE CE LOT.
  //
  // Le défaut n'était visible NI dans le HTML seul (juste), NI dans le
  // dictionnaire seul (cohérent avec lui-même) : il était dans leur ECART.
  // Tant que les deux disent la même chose, la version servie n'a plus
  // d'importance — c'est la seule propriété qu'un cache ne peut pas casser.
  const T = dictionnaires();
  const ecarts = [];
  for (const [cle, texte] of libelles()) {
    if (!texte) continue;                       // balise vide : rien à comparer
    if (T.fr[cle] !== texte) ecarts.push(`${cle} : HTML « ${texte} » ≠ fr « ${T.fr[cle]} »`);
  }
  assert.deepEqual(ecarts, [], `le HTML et le dictionnaire FR divergent :\n  ${ecarts.join('\n  ')}`);
});

test('les clés de la bande ne sont dans AUCUN dictionnaire d’une autre langue par erreur', () => {
  // Contre-épreuve du précédent : les trois dictionnaires doivent couvrir les
  // mêmes clés. Une clé présente en FR et absente en AR laisserait le texte
  // français à l'écran d'un lecteur arabophone, sans rien signaler (P-03).
  const T = dictionnaires();
  const manques = [];
  for (const cle of libelles().keys()) {
    for (const l of ['en', 'ar']) if (!T[l][cle]) manques.push(`${l}.${cle}`);
  }
  assert.deepEqual(manques, [], `clé(s) non traduite(s) : ${manques.join(', ')}`);
});
