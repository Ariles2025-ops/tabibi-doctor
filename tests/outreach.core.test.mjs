/**
 * Tests du noyau de tools/outreach.html.
 *
 * Le bloc <script id="outreach-core"> est extrait du fichier LIVRÉ et évalué tel
 * quel : le test porte sur l'outil réellement distribué, pas sur une copie.
 *
 *   node --test tests/outreach.core.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(racine, 'tools', 'outreach.html'), 'utf8');

const bloc = html.match(/<script id="outreach-core">([\s\S]*?)<\/script>/);
assert.ok(bloc, 'bloc <script id="outreach-core"> introuvable dans tools/outreach.html');
vm.runInThisContext(bloc[1], { filename: 'outreach-core.js' });

const C = globalThis.OutreachCore;
assert.ok(C, 'OutreachCore non exposé');

/* ───────────────────────── détection des colonnes ───────────────────────── */

test('détecte les en-têtes accentués, avec BOM et casse variable', () => {
  const m = C.detecterColonnes(['﻿Nom', 'Prénom', 'Spécialité', 'Wilaya', 'Téléphone']);
  assert.deepEqual(m, { nom: 0, prenom: 1, specialite: 2, wilaya: 3, telephone: 4 });
});

test('détecte les en-têtes composés par correspondance partielle', () => {
  const m = C.detecterColonnes(['nom_du_medecin', 'tel_portable', 'specialite_principale', 'ville_cabinet']);
  assert.equal(m.nom, 0);
  assert.equal(m.telephone, 1);
  assert.equal(m.specialite, 2);
  assert.equal(m.wilaya, 3);
});

test('ne réutilise jamais deux fois la même colonne', () => {
  const m = C.detecterColonnes(['nom', 'prenom', 'nom_complet']);
  const pris = [m.nom, m.prenom].filter((i) => i !== -1);
  assert.equal(new Set(pris).size, pris.length);
});

test('renvoie -1 quand rien ne correspond (déclenche le mapping manuel)', () => {
  const m = C.detecterColonnes(['col_a', 'col_b', 'col_c']);
  assert.equal(m.nom, -1);
  assert.equal(m.telephone, -1);
});

/* ───────────────────────────────── noms ─────────────────────────────────── */

test('retire les titres déjà présents', () => {
  assert.equal(C.nettoyerNom('Dr. BENALI'), 'Benali');
  assert.equal(C.nettoyerNom('dr benali'), 'Benali');
  assert.equal(C.nettoyerNom('Docteur Karim AMRANI'), 'Karim Amrani');
  assert.equal(C.nettoyerNom('Pr. Fatima ZOHRA'), 'Fatima Zohra');
  assert.equal(C.nettoyerNom('Dr.Benali'), 'Benali');
  assert.equal(C.nettoyerNom('Dr Dr Benali'), 'Benali');
});

test('ne prend pas un vrai nom pour un titre', () => {
  assert.equal(C.nettoyerNom('Drissi Kamel'), 'Drissi Kamel');
  assert.equal(C.nettoyerNom('Prosper Martin'), 'Prosper Martin');
  // « Dr » seul : c'est tout ce qu'on a, on ne renvoie pas une chaîne vide
  assert.equal(C.nettoyerNom('Dr'), 'Dr');
});

test('capitalise proprement quelle que soit la casse d’entrée', () => {
  assert.equal(C.nettoyerNom('MOHAMED BENALI'), 'Mohamed Benali');
  assert.equal(C.nettoyerNom('mohamed benali'), 'Mohamed Benali');
  assert.equal(C.nettoyerNom('  mOhAmEd   bEnAlI  '), 'Mohamed Benali');
});

test('conserve les traits d’union', () => {
  assert.equal(C.nettoyerNom('jean-pierre DUPONT'), 'Jean-Pierre Dupont');
  assert.equal(C.nettoyerNom('ABD-EL-KADER'), 'Abd-El-Kader');
});

test('conserve les apostrophes et les particules', () => {
  assert.equal(C.nettoyerNom("marc d'amico"), "Marc d'Amico");
  assert.equal(C.nettoyerNom("D'AMICO"), "D'Amico");
  assert.equal(C.nettoyerNom("n'diaye"), "N'Diaye");
  assert.equal(C.nettoyerNom("Dr KARIM O'BRIEN"), "Karim O'Brien");
  assert.equal(C.nettoyerNom('pierre DE LA FONTAINE'), 'Pierre de la Fontaine');
  assert.equal(C.nettoyerNom('yacine BEN ACHOUR'), 'Yacine Ben Achour');
});

test('préserve les accents français', () => {
  assert.equal(C.nettoyerNom('Dr GRÉGOIRE MÜLLER'), 'Grégoire Müller');
  assert.equal(C.nettoyerNom('aïcha benaïssa'), 'Aïcha Benaïssa');
});

test('tolère une cellule vide', () => {
  assert.equal(C.nettoyerNom(''), '');
  assert.equal(C.nettoyerNom(null), '');
  assert.equal(C.nettoyerNom(undefined), '');
});

/* ─────────────────────────────── téléphones ─────────────────────────────── */

test('normalise les mobiles algériens en 213XXXXXXXXX', () => {
  for (const [entree, attendu] of [
    ['0550 12 34 56', '213550123456'],
    ['0550123456', '213550123456'],
    ['+213 550 12 34 56', '213550123456'],
    ['+213550123456', '213550123456'],
    ['00213550123456', '213550123456'],
    ['213550123456', '213550123456'],
    ['550123456', '213550123456'],
    ['0661.23.45.67', '213661234567'],
    ['0770-11-22-33', '213770112233'],
    ['(0)5 50 12 34 56', '213550123456']
  ]) {
    const t = C.normaliserTel(entree);
    assert.equal(t.e164, attendu, `entrée ${entree}`);
    assert.equal(t.ok, true, `entrée ${entree} devrait être valide`);
    assert.equal(t.type, 'mobile');
    assert.match(t.e164, /^213\d{9}$/, 'ni espace ni +');
  }
});

test('marque les lignes fixes comme non joignables', () => {
  for (const entree of ['021 23 45 67', '0212 34 56 78', '031234567', '+213 21 23 45 67']) {
    const t = C.normaliserTel(entree);
    assert.equal(t.type, 'fixe', `entrée ${entree}`);
    assert.equal(t.ok, false, 'un fixe ne doit pas ouvrir WhatsApp');
    assert.ok(t.motif.length > 0);
  }
});

test('marque les numéros invalides', () => {
  for (const entree of ['12345', '05501234', 'abcdef', '0999999999', '00000']) {
    const t = C.normaliserTel(entree);
    assert.equal(t.ok, false, `entrée ${entree}`);
    assert.notEqual(t.type, 'mobile');
  }
  assert.equal(C.normaliserTel('').type, 'vide');
  assert.equal(C.normaliserTel(null).type, 'vide');
});

test('l’affichage du téléphone reste lisible sans altérer le e164', () => {
  const t = C.normaliserTel('0550123456');
  assert.equal(C.telAffiche(t), '213 550 12 34 56');
  assert.equal(t.e164, '213550123456');
});

/* ───────────────────────────── code d’accès ─────────────────────────────── */

test('le code est stable et dépend du médecin', () => {
  const a = C.faireCode('TBB-', '213550123456');
  const b = C.faireCode('TBB-', '213550123456');
  const c = C.faireCode('TBB-', '213661234567');
  assert.equal(a, b, 'même médecin → même code entre deux sessions');
  assert.notEqual(a, c);
  assert.match(a, /^TBB-[0-9A-Z]{5}$/);
});

/* ────────────────────────────── gabarit ─────────────────────────────────── */

test('remplace toutes les variables, y compris répétées', () => {
  const out = C.rendre('{nom} — {specialite} à {wilaya} — {code} — {nom}', {
    nom: 'Benali', specialite: 'Cardiologie', wilaya: 'Alger', code: 'TBB-1A2B3'
  });
  assert.equal(out, 'Benali — Cardiologie à Alger — TBB-1A2B3 — Benali');
});

test('laisse intacte une variable inconnue plutôt que d’écrire « undefined »', () => {
  assert.equal(C.rendre('Bonjour {inconnue}', { nom: 'X' }), 'Bonjour {inconnue}');
});

test('le gabarit par défaut utilise les quatre variables demandées', () => {
  for (const v of ['{nom}', '{specialite}', '{wilaya}', '{code}']) {
    assert.ok(C.GABARIT_DEFAUT.includes(v), `variable ${v} absente du gabarit par défaut`);
  }
});

/* ──────────────────────── encodage de l’URL WhatsApp ────────────────────── */

const MESSAGE_PIEGE = [
  'Bonjour Dr Benaïssa,',
  '',
  'Spécialité : Oto-rhino-laryngologie — Béjaïa & Sétif.',
  "L’inscription est gratuite (100 % ) ; code = TBB-9X#42 + suivi ?",
  'Coût : 0 DA/mois — 50 % de remise, a+b=c.',
  '',
  'Bien confraternellement.'
].join('\n');

test('l’URL wa.me survit aux accents, apostrophes et retours à la ligne', () => {
  const url = C.urlWhatsApp('213550123456', MESSAGE_PIEGE);
  assert.ok(url.startsWith('https://wa.me/213550123456?text='));

  const recu = decodeURIComponent(url.split('?text=')[1]);
  assert.equal(recu, MESSAGE_PIEGE, 'le message doit revenir identique après décodage');

  // Les caractères qui cassent un paramètre de requête doivent être encodés.
  const q = url.split('?text=')[1];
  for (const [brut, code] of [['#', '%23'], ['&', '%26'], ['+', '%2B'], ['=', '%3D'],
                              ['?', '%3F'], ['\n', '%0A'], [' ', '%20']]) {
    assert.ok(!q.includes(brut), `« ${brut} » ne doit pas rester brut dans la query`);
    assert.ok(q.includes(code), `« ${brut} » doit être encodé en ${code}`);
  }
  // Piège classique : encodeURI aurait laissé passer # & + = ? et tronqué le texte.
  assert.notEqual(q, encodeURI(MESSAGE_PIEGE));
});

test('le repli api.whatsapp.com encode le message de la même façon', () => {
  const url = C.urlWhatsAppLongue('213550123456', MESSAGE_PIEGE);
  assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=213550123456&text='));
  assert.equal(decodeURIComponent(url.split('&text=')[1]), MESSAGE_PIEGE);
});

test('l’URL réelle du gabarit par défaut reste sous la limite de 2000 caractères', () => {
  const msg = C.rendre(C.GABARIT_DEFAUT, {
    nom: 'Mohamed Benaïssa', specialite: 'Oto-rhino-laryngologie',
    wilaya: 'Alger', code: 'TBB-1A2B3'
  });
  const url = C.urlWhatsApp('213550123456', msg);
  assert.ok(url.length < 2000, `URL de ${url.length} caractères — au-delà de 2000, troncature possible`);
});

/* ─────────────────────────────── CSV ────────────────────────────────────── */

test('détecte le séparateur, point-virgule des exports Excel FR compris', () => {
  assert.equal(C.detecterSeparateur('a;b;c\n1;2;3'), ';');
  assert.equal(C.detecterSeparateur('a,b,c\n1,2,3'), ',');
  assert.equal(C.detecterSeparateur('a\tb\tc'), '\t');
});

test('le parseur de repli gère BOM, guillemets et sauts de ligne internes', () => {
  const texte = '﻿nom;telephone\n"Benali;Karim";0550123456\n"Ligne\navec saut";0661234567\n';
  const { entetes, lignes } = C.parserCsv(texte);
  assert.deepEqual(entetes, ['nom', 'telephone']);
  assert.equal(lignes.length, 2);
  assert.equal(lignes[0][0], 'Benali;Karim');
  assert.equal(lignes[1][0], 'Ligne\navec saut');
});

test('l’export protège les messages multi-lignes et réimporte à l’identique', () => {
  const csv = C.versCsv(['nom', 'telephone', 'message', 'traite', 'date_traitement'],
    [['Dr "X"', '213550123456', MESSAGE_PIEGE, 'oui', '2026-08-30 17:45']], ';');

  assert.ok(csv.startsWith('﻿'), 'BOM requis pour Excel');
  const relu = C.parserCsv(csv, ';');
  assert.deepEqual(relu.entetes, ['nom', 'telephone', 'message', 'traite', 'date_traitement']);
  assert.equal(relu.lignes[0][0], 'Dr "X"');
  assert.equal(relu.lignes[0][2], MESSAGE_PIEGE, 'le message doit survivre à l’aller-retour CSV');
  assert.equal(relu.lignes[0][3], 'oui');
});

test('dateLisible formate ou renvoie une chaîne vide', () => {
  assert.equal(C.dateLisible(''), '');
  assert.equal(C.dateLisible('pas-une-date'), '');
  assert.match(C.dateLisible(new Date().toISOString()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});
