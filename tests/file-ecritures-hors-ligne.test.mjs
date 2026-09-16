// =====================================================================
// tests/file-ecritures-hors-ligne.test.mjs — une file qui pouvait doubler
// un rendez-vous et écrire un jeton sur le disque
// =====================================================================
// ⚠️ DEUX DÉFAUTS, LATENTS TOUS LES DEUX.
//
// 1. **Le jeton.** `addPendingWrite({ url, opts })` rangeait `opts` tel quel
//    dans `localStorage` — en-têtes compris, donc `Authorization: Bearer …`
//    et `apikey`. Un jeton écrit sur le disque du navigateur, lisible par
//    tout script de la page. La règle du dépôt est explicite : on n'écrit
//    jamais un secret sur disque.
//
// 2. **Le doublon.** Un `POST` qui expire n'a pas échoué : son résultat est
//    **inconnu**. Le serveur l'a peut-être enregistré avant que le délai
//    tombe. Le rejouer, c'est risquer un second rendez-vous sur le même
//    créneau — et le patient ne verrait qu'un message de succès.
//
// ---------------------------------------------------------------------
// POURQUOI LE CORRECTIF EST SANS RISQUE, ET POURQUOI CE N'EST PAS UNE EXCUSE
// ---------------------------------------------------------------------
// Mesuré : `tabibiFetch` n'a **aucun appelant** dans le dépôt. Rien ne
// remplissait cette file. C'est ce qui rend la correction sans danger — pas ce
// qui rendait le défaut acceptable. **Un défaut latent attend un appelant.**
//
// ⚠️ ET LA FILE RESTE FERMÉE EN PRATIQUE : aucun serveur ne lit
// `Idempotency-Key` aujourd'hui. Mieux vaut une file vide qu'une file qui
// double des rendez-vous. Ce qu'il reste à faire est au registre (P-80).
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CLE = 'tabibi_pending_writes';

/** Charge le module dans un faux navigateur et rend son API + le stockage. */
function module() {
  const stockage = new Map();
  const fenetre = {
    localStorage: {
      getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
      setItem: (k, v) => stockage.set(k, String(v)),
      removeItem: (k) => stockage.delete(k),
    },
    navigator: { onLine: false },       // pas de vidage automatique pendant l'essai
    addEventListener() {},
    setTimeout: () => 0,
    console,
    document: {
      addEventListener() {},
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {} }),
      head: { appendChild() {} },
      body: { appendChild() {}, removeChild() {} },
    },
    fetch: async () => ({ ok: true, status: 200 }),
  };
  const src = readFileSync('js/tabibi-network.js', 'utf8');
  new Function('window', 'document', 'navigator', 'localStorage', 'console', 'setTimeout', 'fetch', src)(
    fenetre, fenetre.document, fenetre.navigator, fenetre.localStorage, console, fenetre.setTimeout, fenetre.fetch,
  );
  assert.ok(fenetre.tabibiOfflineQueue, 'le module n’expose plus sa file');
  return { api: fenetre.tabibiOfflineQueue, brut: () => stockage.get(CLE) || '' };
}

const JETON = 'eyJhbGciOiJIUzI1NiJ9.charge.signature';

// ─────────────────────────────────────────────────────────────────────
test('une écriture SANS clé d’idempotence n’entre pas en file', () => {
  // ⚠️ Perdre une écriture est réparable — l'utilisateur recommence. En créer
  // deux ne l'est pas : personne ne sait qu'il y a un doublon.
  const { api, brut } = module();
  const pose = api.add({ url: '/rest/v1/appointments', opts: { method: 'POST', body: '{}' } });
  assert.equal(pose, false, 'elle a été mise en file quand même');
  assert.deepEqual(api.get(), []);
  assert.equal(brut(), '');
});

test('une écriture non DÉCLARÉE rejouable n’entre pas non plus', () => {
  // Une clé seule ne suffit pas : c'est l'appelant qui sait si son écriture
  // supporte d'être rejouée. On ne le devine pas à sa place.
  const { api } = module();
  assert.equal(api.add({ url: '/x', opts: { method: 'POST', idempotencyKey: 'k-1' } }), false);
  assert.deepEqual(api.get(), []);
});

test('une écriture rejouable AVEC clé entre, et porte la clé au serveur', () => {
  const { api } = module();
  const pose = api.add({
    url: '/rest/v1/appointments',
    opts: { method: 'POST', body: '{"a":1}', rejouable: true, idempotencyKey: 'rdv-42' },
  });
  assert.equal(pose, true);
  const file = api.get();
  assert.equal(file.length, 1);
  assert.equal(file[0].opts.headers['Idempotency-Key'], 'rdv-42',
    'le serveur ne pourra pas dédupliquer');
  assert.equal(file[0].opts.body, '{"a":1}');
});

test('LE JETON n’est jamais écrit sur le disque', () => {
  // ⚠️ L'ESSAI LE PLUS IMPORTANT DU FICHIER. On regarde la chaîne BRUTE
  // stockée, pas l'objet rendu : c'est ce qui reste sur la machine.
  const { api, brut } = module();
  api.add({
    url: '/rest/v1/appointments',
    opts: {
      method: 'POST', body: '{}', rejouable: true, idempotencyKey: 'rdv-1',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + JETON,
        apikey: JETON,
        'X-Api-Key': JETON,
        Cookie: 'sb-access-token=' + JETON,
      },
    },
  });
  const ecrit = brut();
  assert.ok(ecrit.length > 0, 'rien n’a été mis en file : l’essai ne prouve rien');
  assert.ok(!ecrit.includes(JETON), 'le jeton est écrit sur le disque');
  assert.ok(!/authorization/i.test(ecrit), 'l’en-tête Authorization est conservé');
  assert.ok(!/apikey|api-key/i.test(ecrit), 'une clé d’API est conservée');
  assert.ok(!/cookie/i.test(ecrit), 'un cookie est conservé');
  // ⚠️ LA MOITIÉ QU'ON OUBLIE : on n'a pas jeté les en-têtes utiles.
  assert.ok(ecrit.includes('Content-Type'), 'les en-têtes anodins ont été perdus');
});

test('les en-têtes en objet `Headers` sont filtrés aussi', () => {
  // Un appelant peut passer un `Headers` plutôt qu'un objet simple. Filtrer
  // l'un et pas l'autre laisserait la moitié du trou ouvert.
  const { api, brut } = module();
  const faux = {
    forEach(cb) { cb('Bearer ' + JETON, 'authorization'); cb('application/json', 'content-type'); },
  };
  api.add({ url: '/x', opts: { method: 'POST', rejouable: true, idempotencyKey: 'k', headers: faux } });
  const ecrit = brut();
  assert.ok(!ecrit.includes(JETON), 'le jeton passe par l’objet Headers');
  assert.ok(ecrit.includes('content-type'), 'les en-têtes anodins ont été perdus');
});

test('le module n’a toujours AUCUN appelant — le constat qui date le défaut', () => {
  // ⚠️ Constat, pas règle. S'il échoue, quelqu'un s'est mis à utiliser
  // `tabibiFetch` : il faut alors relire P-80 avant d'aller plus loin, parce
  // que la file devient atteignable pour de vrai.
  const sortie = execSync(
    'git grep -l "tabibiFetch" -- "*.html" "*.js" ":!:dist*" ":!:www" ":!:tests" ":!:js/tabibi-network.js" || true',
  ).toString().trim();
  assert.equal(sortie, '',
    `\`tabibiFetch\` est désormais appelé (${sortie}) — relire P-80 : aucun serveur ne déduplique encore`);
});
