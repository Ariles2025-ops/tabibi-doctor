// =====================================================================
// tests/sentry-anonymisation.test.mjs — on nettoyait le seul champ que
// presque rien n'emprunte
// =====================================================================
// ⚠️ `beforeSend` ne filtrait que `event.message`.
//
// Or `event.message` n'est renseigné que par `captureMessage()`. Une exception
// **levée** — le cas courant, celui que le SDK capture tout seul — range son
// texte ailleurs :
//
//     event.exception.values[].value   c'est LUI que Sentry affiche
//     event.breadcrumbs[].message      « POST /rest/v1/… »
//     event.breadcrumbs[].data         corps, url, paramètres
//     event.request.url                ?email=…&phone=…
//
// Le filtre existait, il était juste posé sur le mauvais champ. **Une garde
// qui couvre un cas rare et affiche vert rassure sur ce qu'elle ignore** —
// c'est le motif du compteur `innerHTML` qui voyait 29 cas sur 134.
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER ESSAIE, ET COMMENT
// ---------------------------------------------------------------------
// Il ne charge pas le SDK Sentry : il appelle la fonction de nettoyage sur des
// événements fabriqués, à la forme exacte de ceux du SDK. Faire lever une
// vraie exception dans le SDK depuis un essai hermétique n'est pas possible,
// et **un filtre qu'on ne peut pas essayer est un filtre qu'on croit sur
// parole**.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/** Charge `js/tabibi-sentry.js` dans un faux navigateur et rend le nettoyeur. */
function nettoyeur() {
  const fenetre = {
    location: { hostname: 'localhost', href: 'http://localhost/x' },
    document: { addEventListener() {}, readyState: 'complete' },
    addEventListener() {},
    console,
  };
  const src = readFileSync('js/tabibi-sentry.js', 'utf8');
  new Function('window', 'document', 'console', src)(fenetre, fenetre.document, console);
  assert.equal(typeof fenetre.tabibiSentryNettoyer, 'function',
    'le nettoyeur n’est plus exposé — les essais ne peuvent plus rien vérifier');
  return fenetre.tabibiSentryNettoyer;
}

/**
 * Le VRAI `beforeSend`, celui que le SDK appellera — pas la fonction de
 * nettoyage prise à part.
 *
 * ⚠️ POURQUOI CETTE MOITIÉ EXISTE. Les essais du bas appellent
 * `tabibiSentryNettoyer` directement. Écrits seuls, ils sont restés **verts**
 * pendant une contre-épreuve où `beforeSend` avait été ramené à
 * `event.message` : ils prouvaient qu'un nettoyeur juste existe, pas qu'il
 * soit BRANCHÉ. C'est exactement le défaut qu'on répare ici — un filtre posé
 * sur le mauvais champ — reproduit dans sa propre garde.
 *
 * On simule donc le chargement du SDK : `document.head.appendChild` pose un
 * faux `window.Sentry` et déclenche `onload`, et on récupère la configuration
 * réellement passée à `Sentry.init`.
 */
function beforeSendReel() {
  let config = null;
  const script = {};
  const fenetre = {
    TABIBI_CONFIG: { SENTRY_DSN: 'https://cle@o0.ingest.sentry.io/1', APP_VERSION: 'essai' },
    location: { hostname: 'localhost', pathname: '/x.html' },
    addEventListener() {},
    console,
  };
  fenetre.document = {
    createElement: () => script,
    head: {
      appendChild() {
        fenetre.Sentry = {
          init: (c) => { config = c; },
          setTag() {}, setUser() {}, captureException() {}, captureMessage() {},
        };
        if (typeof script.onload === 'function') script.onload();
      },
    },
    addEventListener() {},
  };
  const src = readFileSync('js/tabibi-sentry.js', 'utf8');
  new Function('window', 'document', 'console', src)(fenetre, fenetre.document, console);
  assert.ok(config && typeof config.beforeSend === 'function',
    'Sentry.init n’a pas reçu de beforeSend');
  return config.beforeSend;
}

const EMAIL = 'amina.cherif@example.test';
const TEL = '0555123456';
const TEL_INTL = '+213 55 51 23 45';

/** Tout le texte d'un objet, aplati — pour chercher une fuite n'importe où. */
const aplati = (o) => JSON.stringify(o);

// ─────────────────────────────────────────────────────────────────────
// 1. LE BRANCHEMENT — sans lui, tout le reste ne prouve rien
// ─────────────────────────────────────────────────────────────────────
test('`beforeSend` NETTOIE VRAIMENT une exception — pas seulement le message', () => {
  // ⚠️ L'ESSAI QUI MANQUAIT AU PREMIER JET. Il passe par la configuration
  // réellement remise au SDK, pas par la fonction prise à part.
  const ev = beforeSendReel()({
    exception: { values: [{ type: 'Error', value: `Echec pour ${EMAIL} (${TEL})` }] },
    breadcrumbs: [{ category: 'fetch', message: `POST /a?phone=${TEL}` }],
    request: { url: `https://tabibi.doctor/p.html?email=${EMAIL}`, cookies: { a: 'b' } },
  });
  assert.ok(!aplati(ev).includes(EMAIL), 'l’e-mail part encore par beforeSend');
  assert.ok(!aplati(ev).includes(TEL), 'le numéro part encore par beforeSend');
  assert.equal(ev.request.cookies, undefined, 'les cookies partent encore');
});

test('`beforeSend` retire toujours e-mail, identifiant et IP de `user`', () => {
  const ev = beforeSendReel()({ user: { id: 'u-1', email: EMAIL, username: 'amina', ip_address: '1.2.3.4' } });
  assert.equal(ev.user.email, undefined);
  assert.equal(ev.user.username, undefined);
  assert.equal(ev.user.ip_address, undefined);
  assert.equal(ev.user.id, 'u-1', 'l’id du compte a été perdu');
});

// ─────────────────────────────────────────────────────────────────────
// 2. LE NETTOYEUR LUI-MÊME
// ─────────────────────────────────────────────────────────────────────
test('le message d’une EXCEPTION est nettoyé — pas seulement event.message', () => {
  // ⚠️ LE CAS QUI PASSAIT ENTIÈREMENT À TRAVERS.
  const ev = nettoyeur()({
    exception: { values: [
      { type: 'Error', value: `Echec pour ${EMAIL} (${TEL})` },
      { type: 'TypeError', value: `contact ${TEL_INTL}` },
    ] },
  });
  assert.ok(!aplati(ev).includes(EMAIL), 'l’e-mail part encore');
  assert.ok(!aplati(ev).includes(TEL), 'le numéro part encore');
  assert.ok(!aplati(ev).includes('+213 55 51 23 45'), 'le numéro international part encore');
  assert.match(ev.exception.values[0].value, /\[email\]/);
  assert.match(ev.exception.values[0].value, /\[tel\]/);
});

test('les fils d’Ariane sont nettoyés — message ET données', () => {
  const ev = nettoyeur()({
    breadcrumbs: [
      { category: 'fetch', message: `POST /rest/v1/users?email=${EMAIL}` },
      { category: 'xhr', data: { url: `https://x.test/a?phone=${TEL}`, body: `{"email":"${EMAIL}"}` } },
    ],
  });
  assert.ok(!aplati(ev).includes(EMAIL));
  assert.ok(!aplati(ev).includes(TEL));
});

test('la query-string est rédigée PAR NOM, pas seulement par motif', () => {
  // ⚠️ `?token=…` n'a la forme ni d'un e-mail ni d'un numéro — et c'est
  // pourtant ce qu'on veut le moins voir partir chez un tiers.
  const ev = nettoyeur()({
    request: { url: 'https://tabibi.doctor/p.html?token=eyJabc.def&ville=Alger&email=' + EMAIL },
  });
  assert.ok(!ev.request.url.includes('eyJabc.def'), 'le jeton part encore');
  assert.ok(!ev.request.url.includes(EMAIL));
  // ⚠️ ET LA MOITIÉ QU'ON OUBLIE : on ne détruit pas ce qui sert à déboguer.
  assert.ok(ev.request.url.includes('/p.html'), 'le chemin a été perdu');
  assert.ok(ev.request.url.includes('ville=Alger'), 'un paramètre anodin a été perdu');
});

test('le message simple reste nettoyé — on n’a rien cassé en élargissant', () => {
  const ev = nettoyeur()({ message: `Erreur pour ${EMAIL}` });
  assert.ok(!ev.message.includes(EMAIL));
  assert.match(ev.message, /\[email\]/);
});

test('l’identifiant du compte SURVIT — c’est lui qui relie deux erreurs', () => {
  // Sans lui, on ne peut plus dire « ces deux pannes touchent le même
  // utilisateur » ; et un UUID ne dit pas qui c'est.
  const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const ev = nettoyeur()({ user: { id }, message: 'coucou' });
  assert.equal(ev.user.id, id);
});

test('un événement CYCLIQUE ne fait pas boucler le filtre', () => {
  // ⚠️ Un `beforeSend` qui part en récursion infinie gèle l'onglet à la
  // première erreur — on remplacerait une fuite par un plantage.
  const ev = { message: `a ${EMAIL}`, contexts: {} };
  ev.contexts.self = ev;
  const sorti = nettoyeur()(ev);
  assert.ok(!sorti.message.includes(EMAIL));
});

test('un événement ÉNORME ne coûte pas cher — la passe est bornée', () => {
  // Un filtre coûteux ralentit CHAQUE erreur de la page, donc finit par être
  // retiré. Bornes : profondeur 8, 400 nœuds.
  const gros = { breadcrumbs: Array.from({ length: 2000 }, (_, i) => ({ message: `b${i} ${EMAIL}` })) };
  const t0 = Date.now();
  nettoyeur()(gros);
  assert.ok(Date.now() - t0 < 500, 'la passe a pris plus de 500 ms');
});

test('les trois motifs d’origine sont TOUS encore là', () => {
  // La contre-épreuve de la réécriture : élargir la portée ne doit pas avoir
  // perdu un motif en route.
  const src = readFileSync('js/tabibi-sentry.js', 'utf8');
  assert.match(src, /\[\\w\.\+-\]\+@/, 'le motif e-mail a disparu');
  assert.match(src, /213/, 'le motif +213 a disparu');
  assert.match(src, /0\[567\]/, 'le motif 0[567] a disparu');
});
