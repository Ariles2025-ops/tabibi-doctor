// =====================================================================
// tests/send-email.test.mjs — l'envoi de courriel, et la porte qui l'a manqué
// =====================================================================
// `js/tabibi-brevo.js` appelait `functions.invoke('send-email', …)` depuis le
// **20/05**. La fonction n'a jamais existe : l'appel partait vers un 404, et
// l'ecran d'administration annoncait quand meme que le medecin avait ete
// prevenu. Personne n'a rien recu — ni les valides, ni les refuses.
//
// Quatre mois. **Ce n'est pas un defaut d'ecriture, c'est un defaut de
// mesure** : rien ne comparait ce que le front appelle a ce qui existe.
// C'est cette comparaison-la qui devient une garde ici.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FONCTIONS = readdirSync('supabase/functions', { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);

/** Le code du produit : pages et modules, sans les essais ni la sortie de build. */
function fichiersProduit() {
  return execSync('git ls-files "*.html" "*.js" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:tests/**" ":!:node_modules/**"')
    .toString().trim().split('\n').filter(Boolean);
}

function sansCommentaires(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1 ');
}

// ─────────────────────────────────────────────────────────────────────
// 1. LA GARDE QUI MANQUAIT — appeler une fonction qui existe
// ─────────────────────────────────────────────────────────────────────
test('toute fonction edge appelee par le front EXISTE dans supabase/functions/', () => {
  const manquantes = new Map();
  for (const f of fichiersProduit()) {
    const src = sansCommentaires(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/functions\.invoke\(\s*['"]([\w-]+)['"]/g)) {
      if (FONCTIONS.includes(m[1])) continue;
      const ligne = src.slice(0, m.index).split('\n').length;
      manquantes.set(`${f}:${ligne}`, m[1]);
    }
  }
  assert.deepEqual([...manquantes.entries()], [],
    'un appel vers une fonction absente part dans le vide — et l\'ecran annonce souvent un succes');
});

test('la fonction send-email existe, avec ses deux dependances', () => {
  assert.ok(existsSync('supabase/functions/send-email/index.ts'));
  assert.ok(existsSync('supabase/functions/_partage/courriel.ts'));
  assert.ok(existsSync('supabase/functions/_partage/modeles-courriel.ts'));
});

// ─────────────────────────────────────────────────────────────────────
// 2. ⚠️ CE QUE LA FONCTION REFUSE — le relais ouvert
// ─────────────────────────────────────────────────────────────────────
const SRC = sansCommentaires(readFileSync('supabase/functions/send-email/index.ts', 'utf8'));
const FRONT = sansCommentaires(readFileSync('js/tabibi-brevo.js', 'utf8'));

test('le serveur n accepte AUCUN html venant de l appelant', () => {
  // Accepter `{to, subject, html}` d'un navigateur, c'est offrir un relais
  // ouvert : n'importe quel compte connecte fait partir n'importe quel HTML,
  // vers n'importe quelle adresse, signe contact@tabibi.doctor.
  assert.doesNotMatch(SRC, /corps\??\.\s*html/, 'le HTML de l appelant ne doit jamais etre lu');
  assert.doesNotMatch(SRC, /corps\??\.\s*subject/, 'le sujet non plus : il se compose avec le modele');
  assert.match(SRC, /modeleConnu\(nom\)/, 'seul un modele CONNU s envoie');
  assert.match(SRC, /unknown_template/);
});

test('le front n envoie plus de html non plus', () => {
  const i = FRONT.indexOf("functions.invoke('send-email'");
  assert.ok(i > -1, "l'appel a disparu : si c'est voulu, ce test doit disparaitre avec lui");
  const appel = FRONT.slice(i, i + 260);
  assert.match(appel, /template:\s*templateName/);
  assert.doesNotMatch(appel, /html:/, 'le HTML ne doit plus quitter le navigateur');
});

test('CHAQUE modele porte sa condition, et elle passe AVANT l envoi', () => {
  const iModele = SRC.indexOf('modeleConnu(nom)');
  const iCondition = SRC.indexOf("nom === 'waiting_list_welcome'");
  const iAdmin = SRC.indexOf("rpc('is_admin')");
  const iEnvoi = SRC.indexOf('envoyerCourriel(');
  assert.ok(iModele > -1 && iCondition > -1 && iAdmin > -1 && iEnvoi > -1, 'un verrou a disparu');
  assert.ok(iModele < iCondition, 'un modele inconnu doit tomber avant toute lecture en base');
  assert.ok(iCondition < iEnvoi && iAdmin < iEnvoi, 'aucune condition ne doit passer APRES l envoi');
  assert.match(SRC, /admin !== true/, "l'absence de reponse doit fermer, pas ouvrir");
});

test('les messages d administration exigent is_admin, verifie AVEC le JWT de l appelant', () => {
  // Avec la cle de service, `is_admin()` repondrait sur le compte de service :
  // tout le monde serait administrateur.
  assert.match(SRC, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*autorisation/);
  // La cle de service ne sert QU'A la verification d'appartenance a la liste
  // d'attente — jamais a decider d'un role.
  const iService = SRC.indexOf('SUPABASE_SERVICE_ROLE_KEY');
  assert.ok(iService > -1);
  const usages = [...SRC.matchAll(/createClient\(urlSupabase,\s*(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(usages.sort(), ['cleAnon', 'cleService'],
    'un client de plus, ou un client de service la ou il ne faut pas');
});

test('l accuse de liste d attente n ecrit qu a une adresse DEJA inscrite', () => {
  // Public, mais pas ouvert : sans ce controle, la fonction devient un
  // expediteur anonyme vers n'importe quelle adresse.
  assert.match(SRC, /from\('waiting_list'\)[\s\S]{0,120}\.eq\('email', to\)/);
  // Et le refus est GENERIQUE : dire « pas inscrite » ferait un testeur
  // d'appartenance a la liste.
  assert.match(SRC, /if \(!ligne\) return echec\(req, 403, 'forbidden'\)/);
});

// ─────────────────────────────────────────────────────────────────────
// 3. ON NE DIT PAS « ENVOYE » SANS L AVOIR VU — la lecon de P-28
// ─────────────────────────────────────────────────────────────────────
test('un echec d envoi ne rend PAS un succes', () => {
  assert.match(SRC, /if \(!envoi\.ok\)[\s\S]{0,400}mail_failed/);
  const i = SRC.indexOf('ok: true, messageId');
  assert.ok(i > -1, 'la reponse de succes a change de forme');
  assert.ok(i > SRC.indexOf('mail_failed'), 'le succes doit venir APRES le controle d echec');
});

test('le front exige ok === true, pas seulement l absence d erreur', () => {
  // `functions.invoke` ne rejette pas sur un 4xx, et une reponse sans `error`
  // n'est pas une reponse d'envoi. C'est exactement le piege du 500+ et du
  // « e-mail envoye ».
  assert.match(FRONT, /result\.ok !== true/,
    "sans ce controle, un 404 silencieux redeviendrait un « envoye »");
});

// ─────────────────────────────────────────────────────────────────────
// 4. LES MODELES — ce qui part vraiment
// ─────────────────────────────────────────────────────────────────────
const M = await import('../supabase/functions/_partage/modeles-courriel.ts');

test('les modeles appeles par le produit existent tous', () => {
  // Relevé, pas devine : ce que `admin-*.html` demande reellement.
  const demandes = new Set();
  for (const f of fichiersProduit()) {
    const src = sansCommentaires(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/sendEmail\(\s*['"]([\w-]+)['"]/g)) demandes.add(m[1]);
  }
  for (const d of demandes) {
    assert.ok(M.modeleConnu(d), `le produit demande « ${d} », le serveur ne le connait pas`);
  }
  assert.ok(demandes.size >= 2, 'le relevé n a rien trouve : le motif de recherche a change');
});

test('un modele inconnu est refuse', () => {
  assert.equal(M.modeleConnu('n_importe_quoi'), false);
  assert.equal(M.modeleConnu(''), false);
  assert.equal(M.modeleConnu(null), false);
  // Et pas de piege par la chaine de prototypes.
  assert.equal(M.modeleConnu('toString'), false);
  assert.equal(M.modeleConnu('constructor'), false);
});

test('le nom du medecin et le motif de refus sont ECHAPPES', () => {
  // Ils viennent d'un formulaire d'administration : un motif portant du
  // balisage partirait tel quel dans la boite du medecin.
  const m = M.MODELES.medecin_rejected({
    firstName: '<img src=x onerror="alert(1)">',
    reason: '<script>alert(2)</script>',
    lang: 'fr',
  });
  assert.doesNotMatch(m.html, /<img src=x/);
  assert.doesNotMatch(m.html, /<script>alert\(2\)/);
  assert.match(m.html, /&lt;img/);
  assert.match(m.html, /&lt;script&gt;/);
});

test('les trois langues rendent un message complet, et l arabe se lit a droite', () => {
  for (const lang of ['fr', 'ar', 'en']) {
    const v = M.MODELES.medecin_validated({ firstName: 'Amina', lang });
    assert.ok(v.subject.length > 5, `${lang} : sujet vide`);
    assert.ok(v.html.includes('Amina'), `${lang} : le nom n apparait pas`);
    assert.ok(v.text.length > 40, `${lang} : la version texte est vide — certains clients ne lisent que celle-la`);
    assert.match(v.html, new RegExp(`<html lang="${lang}"`));
  }
  assert.match(M.MODELES.medecin_validated({ lang: 'ar' }).html, /dir="rtl"/);
  assert.match(M.MODELES.medecin_validated({ lang: 'fr' }).html, /dir="ltr"/);
});

test('une langue inconnue retombe sur le francais, sans lever', () => {
  const m = M.MODELES.medecin_validated({ firstName: 'X', lang: 'kl' });
  assert.match(m.html, /<html lang="fr"/);
});
