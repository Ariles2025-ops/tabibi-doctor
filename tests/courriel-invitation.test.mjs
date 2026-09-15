// =====================================================================
// Le message d'invitation, EXECUTE — pas relu
// =====================================================================
// `supabase/functions/_partage/courriel.ts` tourne sous Deno. `composer…()`
// est pur — aucun reseau, aucune variable d'environnement — donc il s'execute
// ici tel quel.
//
// CE QUE CES ESSAIS GARDENT, ET POURQUOI
//
//   1. **Le nom du medecin vient de la base et part dans du HTML.** Un nom
//      contenant `<` ou `"` doit ressortir echappe. C'est la meme dette XSS que
//      le lot 5 traite cote front, sauf qu'ici la cible est une boite mail —
//      et un e-mail n'a pas de CSP.
//   2. **Le message ne promet que ce que le lien fait.** Pas « votre compte est
//      cree », pas « vous etes verifie » : il rattache une fiche. Un e-mail qui
//      promet plus que le systeme ne fait est la meme faute que le « 500+ ».
//   3. **Le lien porte le jeton** : il doit apparaitre tel quel, entier, et
//      dans les deux versions (texte et HTML). Un lien tronque dans la version
//      texte, c'est une invitation morte pour qui lit ses mails en texte brut.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';

const M = await import('../supabase/functions/_partage/courriel.ts');

const LIEN = 'https://tabibi.doctor/invitation-medecin?token=' + 'a'.repeat(64);

test("le nom du medecin est ECHAPPE — un e-mail n'a pas de CSP", () => {
  const m = M.composerInvitationMedecin({
    nomMedecin: 'Dr <script>alert(1)</script> "Benali"',
    lien: LIEN,
    expireLe: '2026-09-28T00:00:00Z',
  });
  assert.ok(!m.html.includes('<script>alert'), 'balise script injectee dans le HTML');
  assert.ok(m.html.includes('&lt;script&gt;'), 'le chevron doit ressortir echappe');
  assert.ok(m.html.includes('&quot;Benali&quot;'), 'les guillemets doivent etre echappes');
});

test('le lien apparait ENTIER dans les deux versions', () => {
  const m = M.composerInvitationMedecin({ nomMedecin: 'Dr Ali', lien: LIEN, expireLe: '2026-09-28T00:00:00Z' });
  assert.ok(m.text.includes(LIEN), 'lien absent ou tronque dans la version texte');
  assert.ok(m.html.includes(LIEN), 'lien absent ou tronque dans la version HTML');
});

test("le message ne promet QUE le rattachement", () => {
  const m = M.composerInvitationMedecin({ nomMedecin: 'Dr Ali', lien: LIEN, expireLe: '2026-09-28T00:00:00Z' });
  const tout = (m.text + ' ' + m.html).toLowerCase();
  // Ce qu'il dit.
  assert.match(tout, /rattache/);
  // Ce qu'il ne doit PAS dire : le lien ne cree aucun compte et ne verifie
  // personne. Promettre l'un ou l'autre ferait attendre au medecin quelque
  // chose qui n'arrivera pas.
  for (const promesse of ['compte a ete cree', 'compte créé', 'vous etes verifie', 'vérifié']) {
    assert.ok(!tout.includes(promesse), `le message promet « ${promesse} »`);
  }
});

test("il annonce que l'adresse compte, pas seulement le lien", () => {
  // C'est la garde cote base (`email_mismatch`). Si le message ne l'annonce
  // pas, le medecin qui se connecte avec une autre adresse croit a une panne.
  const m = M.composerInvitationMedecin({ nomMedecin: 'Dr Ali', lien: LIEN, expireLe: '2026-09-28T00:00:00Z' });
  assert.match(m.text, /adresse/i);
  assert.match(m.html, /adresse/i);
  assert.match((m.text + m.html), /le lien seul ne suffit pas/i);
});

test('la date de peremption est lisible par un humain', () => {
  assert.equal(M.dateLisible('2026-09-28T00:00:00Z'), '28 septembre 2026');
  assert.equal(M.dateLisible('2026-01-01T12:00:00Z'), '1 janvier 2026');
  // Une date absente ne doit pas produire « Invalid Date » dans un e-mail.
  assert.equal(M.dateLisible(''), '');
  assert.equal(M.dateLisible('pas-une-date'), '');
});

test("une date vide ne laisse pas de phrase a trou", () => {
  const m = M.composerInvitationMedecin({ nomMedecin: 'Dr Ali', lien: LIEN, expireLe: '' });
  assert.ok(!/valable jusqu'au\s*\./i.test(m.text), 'phrase de validite a trou dans le texte');
  assert.ok(!m.html.includes('valable jusqu'), 'phrase de validite vide dans le HTML');
  assert.ok(!(m.text + m.html).includes('Invalid Date'));
});

test('un medecin sans nom donne un message correct, pas « undefined »', () => {
  const m = M.composerInvitationMedecin({ nomMedecin: '', lien: LIEN, expireLe: '2026-09-28T00:00:00Z' });
  assert.ok(!/undefined|null/.test(m.subject + m.text + m.html));
  assert.match(m.text, /Docteur/);
});

test('echapper() ne laisse passer aucun des cinq caracteres dangereux', () => {
  assert.equal(M.echapper(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(M.echapper(null), '');
  assert.equal(M.echapper(undefined), '');
});
