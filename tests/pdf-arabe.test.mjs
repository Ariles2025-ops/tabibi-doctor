// =====================================================================
// L'arabe dans le PDF — EXECUTE, y compris le faconnage
// =====================================================================
// [15/09/2026] JE CORRIGE UNE CONCLUSION QUE J'AVAIS ECRITE LA VEILLE.
//
// Le 14/09 j'ai ecrit, en tete de `generate-prescription-pdf`, que l'arabe
// exigeait « un moteur de faconnage » et « un lot a soi », et j'ai fait
// REFUSER la signature. La premiere moitie du constat etait juste — les 14
// polices standard du PDF n'ont aucun glyphe arabe — mais la conclusion etait
// fausse : **pdf-lib faconne**, via `font.layout()` de fontkit, des qu'on lui
// donne une police qui contient l'arabe.
//
// Ce fichier le PROUVE plutot que de l'affirmer, et c'est la difference entre
// les deux versions de ce lot :
//
//   fontkit.layout('طبيبي')   ->  9 glyphes contextuels
//   mapping naif par point    ->  5 formes isolees
//   pdf-lib, apres embarquement de la police -> NEUF indices encodes
//
// **Neuf contre cinq.** Si pdf-lib ne faconnait pas, on obtiendrait cinq
// lettres detachees — de l'arabe qui *ressemble* a de l'arabe pour qui ne le
// lit pas. C'est exactement le defaut que le refus evitait, et c'est pour ca
// qu'il fallait le mesurer avant de lever le refus.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const M = await import('../supabase/functions/_partage/texte-arabe.ts');
const P = await import('../supabase/functions/_partage/police-arabe.ts');

const PHRASE = 'طبيبي';

// ─────────────────────────────────────────────────────────────────────
test('la police embarquee est bien celle qu\'on croit', () => {
  const o = P.policeArabe();
  assert.equal(o.length, 87400, 'taille inattendue');
  const sha = createHash('sha256').update(Buffer.from(o)).digest('hex');
  assert.equal(sha, P.POLICE_ARABE_SHA256,
    'le binaire ne correspond plus a son empreinte — regenerer par scripts/generer-police-arabe.mjs');
  // Signature WOFF.
  assert.equal(Buffer.from(o.slice(0, 4)).toString('ascii'), 'wOFF');
});

test('la licence OFL accompagne la police', () => {
  const l = readFileSync('supabase/functions/_partage/LICENSE-NOTO.txt', 'utf8');
  assert.match(l, /SIL Open Font License/);
  assert.match(l, /Noto Project Authors/);
});

// ─────────────────────────────────────────────────────────────────────
test('detection : arabe, latin, et les deux', () => {
  assert.equal(M.contientArabe(PHRASE), true);
  assert.equal(M.contientArabe('Doliprane 500 mg'), false);
  // Les chiffres ne font pas d'un texte un texte mixte.
  assert.equal(M.contientLesDeux('Doliprane 500 mg'), false);
  assert.equal(M.contientLesDeux('Doliprane ' + PHRASE), true);
  assert.equal(M.contientArabe(null), false);
  assert.equal(M.contientArabe(''), false);
});

test('le sens suit la PREMIERE lettre forte, pas la majorite', () => {
  assert.equal(M.sensDe(PHRASE), 'rtl');
  assert.equal(M.sensDe('Doliprane'), 'ltr');
  // « Dr Benali — <beaucoup d'arabe> » se lit de gauche a droite : la premiere
  // lettre forte est latine, meme si la partie arabe est plus longue.
  assert.equal(M.sensDe('Dr Benali — ' + PHRASE.repeat(5)), 'ltr');
  assert.equal(M.sensDe(PHRASE + ' Dr Benali'), 'rtl');
  // Chiffres et ponctuation seuls : aucune lettre forte, on reste en latin.
  assert.equal(M.sensDe('500 mg — 3/j'), 'ltr');
  assert.equal(M.sensDe(''), 'ltr');
});

test('ON NE SE RABAT JAMAIS SUR LA POLICE LATINE POUR DE L ARABE', () => {
  // Le repli silencieux donnerait des carres vides, ou une exception au milieu
  // de la generation. `null` oblige l'appelant a refuser explicitement.
  assert.equal(M.policePour(PHRASE, { latine: 'HELV' }), null);
  assert.equal(M.policePour(PHRASE, { latine: 'HELV', arabe: 'NOTO' }), 'NOTO');
  assert.equal(M.policePour('Doliprane', { latine: 'HELV' }), 'HELV');
});

test('une ligne arabe se pose a DROITE du cadre', () => {
  // marge 56, largeur 483, texte de 100 -> x = 56 + 483 - 100
  assert.equal(M.xPour('rtl', 56, 483, 100), 439);
  assert.equal(M.xPour('ltr', 56, 483, 100), 56);
});

test('le numero de medicament se met du bon cote', () => {
  assert.equal(M.numeroter(1, 'Doliprane'), '1. Doliprane');
  assert.equal(M.numeroter(2, PHRASE), PHRASE + ' .2');
});

// ─────────────────────────────────────────────────────────────────────
// LA MESURE QUI JUSTIFIE TOUT LE LOT
// ─────────────────────────────────────────────────────────────────────
test('FACONNAGE : pdf-lib rend NEUF glyphes contextuels, pas cinq formes isolees', async (t) => {
  let PDFDocument, fontkit;
  try {
    ({ PDFDocument } = await import('pdf-lib'));
    fontkit = (await import('@pdf-lib/fontkit')).default;
  } catch {
    // Ces deux paquets ne sont pas necessaires au produit — la fonction les
    // prend depuis esm.sh. Ils le sont pour PROUVER le faconnage ici.
    t.skip('pdf-lib / @pdf-lib/fontkit absents : npm i -D pdf-lib @pdf-lib/fontkit');
    return;
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const police = await doc.embedFont(P.policeArabe(), { subset: true });

  const encode = police.encodeText(PHRASE).toString();
  // `<0001000200...>` : deux octets par glyphe, entre chevrons.
  const glyphes = (encode.replace(/[<>]/g, '').match(/.{4}/g) || []).length;

  assert.equal(glyphes, 9,
    `attendu 9 glyphes contextuels pour « ${PHRASE} », obtenu ${glyphes}. `
    + 'Cinq signifierait que le faconnage n\'a pas eu lieu : des lettres detachees, '
    + 'de l\'arabe qui ressemble a de l\'arabe pour qui ne le lit pas.');

  // Et la largeur mesuree est non nulle : la police couvre bien ces glyphes.
  assert.ok(police.widthOfTextAtSize(PHRASE, 24) > 10);
});

test('un PDF contenant de l arabe se produit vraiment', async (t) => {
  let PDFDocument, fontkit;
  try {
    ({ PDFDocument } = await import('pdf-lib'));
    fontkit = (await import('@pdf-lib/fontkit')).default;
  } catch { t.skip('pdf-lib absent'); return; }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const police = await doc.embedFont(P.policeArabe(), { subset: true });
  const page = doc.addPage([400, 120]);
  const largeur = police.widthOfTextAtSize(PHRASE, 24);
  page.drawText(PHRASE, { x: M.xPour('rtl', 20, 360, largeur), y: 50, size: 24, font: police });

  const octets = await doc.save({ useObjectStreams: false });
  assert.ok(octets.length > 1000, 'PDF suspectement petit');
  assert.equal(Buffer.from(octets.slice(0, 5)).toString('ascii'), '%PDF-');
});
