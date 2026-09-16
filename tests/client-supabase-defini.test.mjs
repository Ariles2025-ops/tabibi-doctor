// =====================================================================
// tests/client-supabase-defini.test.mjs — un appel à une fonction qui
// n'existe pas, avalé par un `catch`
// =====================================================================
// ⚠️ LE CHANGEMENT DE MOT DE PASSE ECHOUAIT A TOUS LES COUPS, sur deux pages.
//
//     const sb = await getSupabase();          // patient-profile.html:474
//     const { error } = await sb.auth.updateUser({ password: nw });
//
// `getSupabase` n'était défini **ni dans la page, ni dans aucun script
// qu'elle charge**. L'appel levait un `ReferenceError`, qui tombait dans le
// `catch` juste en dessous :
//
//     toastM(tabibiT('toast_password_change_failed',
//                    "Échec du changement — réessayez."), "error");
//
// Le patient voyait un message qui l'invitait à **recommencer une chose qui ne
// pouvait pas marcher**. Le même code était copié dans `medecin-profile.html`
// — la SEQ n'en signalait qu'une, la mesure en a trouvé deux.
//
// ---------------------------------------------------------------------
// D'OU VENAIT CE NOM
// ---------------------------------------------------------------------
// De `admin-cabinet.html` et `secretaire-dashboard.html`, où la fonction est
// bien **définie**, page par page (ligne 201 et 218). Elle a été copiée dans
// deux autres pages **sans sa définition**. Le client, lui, est exposé par
// `js/supabase-client.js` sous `window.tabibi.supabase` — ce que faisait déjà
// `saveAll()`, quelques lignes plus haut, dans le même fichier.
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER GARDE
// ---------------------------------------------------------------------
// Qu'aucune page n'appelle `getSupabase()` sans la définir, et que chaque
// `changePassword()` obtienne son client d'une source qui existe vraiment.
//
// **Ce qu'il ne prouve pas :** que le changement aboutisse. Ça, c'est
// `tests/e2e/changer-mot-de-passe.spec.js`, qui appelle la fonction pour de
// vrai et regarde ce qu'elle demande au client.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PAGES = execSync(
  'git ls-files "*.html" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:v2/**" ":!:node_modules/**"',
).toString().trim().split('\n').filter(Boolean);

/**
 * Le code d'une page, COMMENTAIRES RETIRES.
 *
 * ⚠️ Le commentaire qui explique ce défaut, dans les deux pages corrigées,
 * contient le mot `getSupabase`. Une garde qui lirait ses propres explications
 * conclurait que le défaut est revenu — **huitième fois** que ce piège se
 * présente dans ce dépôt. On lit le code, jamais ce qu'on a écrit à son sujet.
 */
function code(chemin) {
  return readFileSync(chemin, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n');
}

/** Les scripts LOCAUX qu'une page charge, dans l'ordre. */
function scriptsDe(chemin) {
  const brut = readFileSync(chemin, 'utf8');
  return [...brut.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)]
    .map((m) => m[1].replace(/^\.?\//, '').split('?')[0])
    .filter((p) => !/^https?:/.test(p) && existsSync(p));
}

/** `nom` est-il défini dans ce texte ? (déclaration, affectation, `window.nom`) */
function definit(src, nom) {
  const n = nom.replace(/[$]/g, '\\$');
  return new RegExp(
    `(?:function\\s+${n}\\b|(?:const|let|var)\\s+${n}\\s*=|window\\.${n}\\s*=)`,
  ).test(src);
}

// ─────────────────────────────────────────────────────────────────────
test('aucune page n’appelle `getSupabase()` sans la définir', () => {
  const fautes = [];
  for (const page of PAGES) {
    const src = code(page);
    if (!/\bgetSupabase\s*\(/.test(src)) continue;
    if (definit(src, 'getSupabase')) continue;
    if (scriptsDe(page).some((s) => definit(code(s), 'getSupabase'))) continue;
    fautes.push(page);
  }
  assert.deepEqual(fautes, [],
    'page(s) appelant `getSupabase()` sans définition — le ReferenceError '
    + `tombera dans le catch et affichera un faux échec :\n  ${fautes.join('\n  ')}`);
});

test('les deux pages qui CHANGENT un mot de passe tiennent un vrai client', () => {
  // On ne vérifie pas « il n'y a plus getSupabase » — ce serait garder une
  // orthographe. On vérifie que la fonction obtient son client d'une source
  // qui existe : `window.tabibi.supabase`, posé par `js/supabase-client.js`.
  const pages = PAGES.filter((p) => /\bfunction\s+changePassword\b/.test(code(p)));
  assert.deepEqual(pages.sort(), ['medecin-profile.html', 'patient-profile.html'],
    'la liste des pages qui changent un mot de passe a bougé — vérifier la nouvelle');

  for (const page of pages) {
    const src = code(page);
    const d = src.indexOf('function changePassword');
    const corps = src.slice(d, src.indexOf('\n}', d));
    assert.match(corps, /window\.tabibi\s*&&\s*window\.tabibi\.supabase/,
      `${page} : changePassword n'obtient pas le client de window.tabibi.supabase`);
    assert.match(corps, /auth\.updateUser\(\s*\{\s*password/,
      `${page} : changePassword ne demande plus le changement au serveur`);
    // ⚠️ Et il ne dit plus « réessayez » quand le client manque : réessayer
    // n'y changerait rien. C'est le message qui a masqué le défaut des mois.
    assert.match(corps, /toast_auth_unavailable/,
      `${page} : client absent -> le message doit dire que le service manque`);
  }
});

test('`window.tabibi.supabase` est bien ce que pose `js/supabase-client.js`', () => {
  // La contre-épreuve du test précédent : il exige une référence ; encore
  // faut-il que quelqu'un la pose. Sans ceci, on garderait une convention.
  const src = code('js/supabase-client.js');
  assert.match(src, /window\.tabibi\.supabase\s*=\s*window\.supabase\.createClient\(/,
    'js/supabase-client.js ne pose plus window.tabibi.supabase');

  for (const page of ['patient-profile.html', 'medecin-profile.html']) {
    assert.ok(scriptsDe(page).includes('js/supabase-client.js'),
      `${page} ne charge plus js/supabase-client.js — la référence serait vide`);
  }
});
