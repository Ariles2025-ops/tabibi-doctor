// =====================================================================
// La signature d'ordonnance, EXECUTEE — pas relue
// =====================================================================
// `supabase/functions/_partage/signature-ordonnance.ts` tourne sous Deno, sur
// un serveur qu'on n'a pas. Le laisser sans essai jusqu'au deploiement
// reviendrait a decouvrir une erreur de chaine canonique **apres** la premiere
// ordonnance signee — c'est-a-dire trop tard : on ne resigne pas une
// ordonnance emise.
//
// Or ce module n'utilise de Deno qu'une chose, `Deno.env.get`. Tout le reste
// est du Web Crypto, present dans Node depuis la 18. On pose donc un `Deno`
// minimal et on execute le VRAI fichier — pas une copie, pas un portage.
//
//   node --experimental-strip-types tests/signature-ordonnance.test.mjs
//
// ---------------------------------------------------------------------
// CE QUE CE FICHIER PROUVE, ET POURQUOI CHAQUE POINT COMPTE
// ---------------------------------------------------------------------
// 1. UN VECTEUR FIGE. Cle connue + ordonnance connue = HMAC attendu, ecrit en
//    dur ci-dessous. **C'est le seul garde-fou contre une modification
//    silencieuse de la chaine canonique.** Le jour ou quelqu'un ajoute un
//    champ ou change un separateur, ce test rougit — au lieu que des
//    ordonnances deja signees deviennent invalides en production.
//    Si tu casses ce test volontairement, il faut une NOUVELLE VERSION DE CLE.
// 2. Une modification du CONTENU MEDICAL invalide la signature.
// 3. Une modification d'un champ d'identite (date, numero, patient) aussi.
// 4. L'ordre des cles JSON ne change pas la signature (le `jsonStable`).
// 5. On ne signe JAMAIS sans cle : absence -> exception, pas de repli.
// 6. Une cle de version absente donne « indecidable », pas « invalide ».
//
// La cle ci-dessous est un texte d'essai ecrit ici a dessein : elle ne signe
// rien de reel et n'est posee nulle part (regle 4).
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';

const CLE_ESSAI = 'cle-de-test-uniquement-32-caracteres-minimum';
const environnement = {
  PRESCRIPTION_SIGNING_KEY_CURRENT: 'v1',
  PRESCRIPTION_SIGNING_KEY_V1: CLE_ESSAI,
};

// Le `Deno` minimal dont le module a besoin. Rien d'autre n'est simule.
globalThis.Deno = { env: { get: (k) => environnement[k] } };

const M = await import('../supabase/functions/_partage/signature-ordonnance.ts');

const ORDONNANCE = {
  id: '11111111-2222-3333-4444-555555555555',
  prescription_number: 'RX-2026-000123',
  doctor_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  patient_id: '99999999-8888-7777-6666-555555555555',
  issue_date: '2026-09-14',
  expiry_date: '2026-10-14',
  contenu_sha256: '0'.repeat(64),
};

// ─────────────────────────────────────────────────────────────────────
test('VECTEUR FIGE : la chaine canonique ne bouge pas', () => {
  assert.equal(
    M.chaineCanonique('v1', ORDONNANCE),
    'v1|11111111-2222-3333-4444-555555555555|RX-2026-000123|'
    + 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee|99999999-8888-7777-6666-555555555555|'
    + '2026-09-14|2026-10-14|' + '0'.repeat(64),
  );
});

test('VECTEUR FIGE : meme cle + meme ordonnance = meme signature', async () => {
  const signature = await M.signer(ORDONNANCE);
  // Valeur relevee a la premiere execution et figee ici. Elle n'a de sens
  // qu'avec CLE_ESSAI ci-dessus, qui n'est la cle de rien.
  assert.equal(
    signature,
    'v1:598f81b538719f5c4445e95edf93874319023ef2b8ae618f169ddfd2b357cdfd',
  );
});

test('une expiration nulle se signe, et differemment', async () => {
  const a = await M.signer(ORDONNANCE);
  const b = await M.signer({ ...ORDONNANCE, expiry_date: null });
  assert.notEqual(a, b);
  assert.match(b, /^v1:[0-9a-f]{64}$/);
});

// ─────────────────────────────────────────────────────────────────────
test('LE POINT CENTRAL : modifier le traitement casse la signature', async () => {
  const contenuAvant = await M.empreinteContenu(
    [{ name: 'Doliprane', dosage: '1000 mg' }], 'Grippe saisonniere', null,
  );
  const contenuApres = await M.empreinteContenu(
    [{ name: 'Doliprane', dosage: '4000 mg' }], 'Grippe saisonniere', null,
  );
  assert.notEqual(contenuAvant, contenuApres);

  const signature = await M.signer({ ...ORDONNANCE, contenu_sha256: contenuAvant });
  const verdict = await M.verifier({ ...ORDONNANCE, contenu_sha256: contenuApres }, signature);
  assert.equal(verdict.etat, 'signature_invalide');
});

test('modifier une date, un numero ou le patient casse la signature', async () => {
  const signature = await M.signer(ORDONNANCE);
  for (const [champ, valeur] of [
    ['issue_date', '2026-09-15'],
    ['prescription_number', 'RX-2026-000124'],
    ['patient_id', '00000000-8888-7777-6666-555555555555'],
    ['doctor_id', '00000000-bbbb-cccc-dddd-eeeeeeeeeeee'],
    ['expiry_date', '2026-12-31'],
  ]) {
    const verdict = await M.verifier({ ...ORDONNANCE, [champ]: valeur }, signature);
    assert.equal(verdict.etat, 'signature_invalide', `${champ} aurait du invalider`);
  }
});

test('la signature intacte se verifie, et dit avec quelle version', async () => {
  const verdict = await M.verifier(ORDONNANCE, await M.signer(ORDONNANCE));
  assert.deepEqual(verdict, { etat: 'valide', version: 'v1' });
});

// ─────────────────────────────────────────────────────────────────────
test("l ordre des cles JSON ne change RIEN — sinon la signature dependrait de PostgREST", async () => {
  const a = await M.empreinteContenu([{ name: 'Amoxicilline', dosage: '500 mg', duration: '7 jours' }], 'Angine', 'A jeun');
  const b = await M.empreinteContenu([{ duration: '7 jours', dosage: '500 mg', name: 'Amoxicilline' }], 'Angine', 'A jeun');
  assert.equal(a, b);
});

test('jsonStable trie en profondeur', () => {
  assert.equal(
    M.jsonStable({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } }),
    '{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}',
  );
});

// ─────────────────────────────────────────────────────────────────────
test('ON NE SIGNE PAS SANS CLE — aucun repli, aucune signature vide', async () => {
  const sauvegarde = environnement.PRESCRIPTION_SIGNING_KEY_V1;
  delete environnement.PRESCRIPTION_SIGNING_KEY_V1;
  await assert.rejects(() => M.signer(ORDONNANCE), (e) => e.name === 'CleIndisponible');
  environnement.PRESCRIPTION_SIGNING_KEY_V1 = sauvegarde;
});

test('une cle trop courte est refusee comme une cle absente', async () => {
  const sauvegarde = environnement.PRESCRIPTION_SIGNING_KEY_V1;
  environnement.PRESCRIPTION_SIGNING_KEY_V1 = 'trop-courte';
  await assert.rejects(() => M.signer(ORDONNANCE), (e) => e.name === 'CleIndisponible');
  environnement.PRESCRIPTION_SIGNING_KEY_V1 = sauvegarde;
});

test("cle de version absente = INDECIDABLE, et pas « invalide »", async () => {
  // La distinction n'est pas cosmetique : « invalide » accuse le document,
  // « indecidable » nous accuse nous. Une rotation mal faite ne doit pas faire
  // passer une ordonnance authentique pour un faux.
  const signature = await M.signer(ORDONNANCE);
  const sauvegarde = environnement.PRESCRIPTION_SIGNING_KEY_V1;
  delete environnement.PRESCRIPTION_SIGNING_KEY_V1;
  const verdict = await M.verifier(ORDONNANCE, signature);
  environnement.PRESCRIPTION_SIGNING_KEY_V1 = sauvegarde;
  assert.deepEqual(verdict, { etat: 'cle_absente', version: 'v1' });
});

test('ROTATION : une v2 signe, une v1 deja signee reste verifiable', async () => {
  const signeeV1 = await M.signer(ORDONNANCE);

  environnement.PRESCRIPTION_SIGNING_KEY_V2 = 'seconde-cle-de-test-32-caracteres-minimum';
  environnement.PRESCRIPTION_SIGNING_KEY_CURRENT = 'v2';
  const signeeV2 = await M.signer(ORDONNANCE);
  assert.match(signeeV2, /^v2:/);
  assert.notEqual(signeeV1.slice(3), signeeV2.slice(3));

  // C'est LA propriete qui justifie la version dans la signature.
  assert.equal((await M.verifier(ORDONNANCE, signeeV1)).etat, 'valide');
  assert.equal((await M.verifier(ORDONNANCE, signeeV2)).etat, 'valide');

  environnement.PRESCRIPTION_SIGNING_KEY_CURRENT = 'v1';
  delete environnement.PRESCRIPTION_SIGNING_KEY_V2;
});

// ─────────────────────────────────────────────────────────────────────
test('une signature mal formee est rejetee avant tout calcul', async () => {
  for (const mauvaise of ['', ':', 'v1:', 'abc', 'v1:xyz', '1:' + '0'.repeat(64), 'v1:' + '0'.repeat(63)]) {
    assert.equal((await M.verifier(ORDONNANCE, mauvaise)).etat, 'forme_invalide', mauvaise);
  }
});

test('egalConstant ne se laisse pas avoir par une longueur differente', () => {
  assert.equal(M.egalConstant('abc', 'abc'), true);
  assert.equal(M.egalConstant('abc', 'abd'), false);
  assert.equal(M.egalConstant('abc', 'abcd'), false);
  assert.equal(M.egalConstant('', ''), true);
});
