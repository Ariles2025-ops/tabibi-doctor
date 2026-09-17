// =====================================================================
// tests/canaux-annonces.test.mjs — on n'annonce pas un canal qui n'émet pas
// =====================================================================
// ⚠️ `success.html` disait, après chaque réservation :
//
//     « Un SMS et un email de confirmation vous ont été envoyés. »
//
// **Les deux étaient faux.**
//
//   SMS   — `js/tabibi-sms.js` porte `enabled: false`, et `window.tabibiSMS`
//           n'est APPELÉ nulle part. Le fichier est chargé par `login.html` et
//           `signup.html` ; personne ne s'en sert.
//   E-mail — ni `reservation.html` ni `js/tabibi-booking.js` n'appellent
//           `sendEmail`. Les seuls e-mails du produit sont la validation/refus
//           d'un médecin et l'accusé de liste d'attente. Et la boîte d'envoi
//           prévue en base pour les rendez-vous — `appointment_notifications`,
//           alimentée par `trg_appointment_confirmed_outbox` — contient
//           **0 ligne, dont 0 envoyée** (mesuré le 16/09).
//
// Annoncer un canal qui n'émet pas, ce n'est pas une imprécision : **c'est
// faire attendre quelqu'un**. Le patient ne relance pas, puisqu'on lui a dit
// que c'était parti. Même famille que P-28 et que le cron des rappels qui
// affichait 4 531 succès en envoyant le mot `TA_CLE`.
//
// ---------------------------------------------------------------------
// LA RÈGLE GARDÉE, ET POURQUOI ELLE SE MET À JOUR TOUTE SEULE
// ---------------------------------------------------------------------
// On ne garde pas « la phrase ne doit pas dire SMS » — ce serait interdire un
// mot, et bloquer le jour où le SMS marchera pour de bon.
//
// On garde : **un canal ne s'annonce que s'il a un émetteur.** Le fichier
// mesure d'abord s'il existe un émetteur, et n'exige le silence que dans ce
// cas-là. Le jour où quelqu'un branche l'envoi, l'essai demande l'inverse.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Le code d'un fichier, commentaires retirés et accents NORMALISÉS.
 *
 * ⚠️ `.normalize('NFC')` n'est pas de la coquetterie : sans lui, cette garde
 * est restée **verte sur « Email envoyé. »**. Le `é` du fichier était décomposé
 * (e + U+0301) et celui de mon motif composé (U+00E9) — deux chaînes qui
 * s'affichent pareil et ne se comparent pas. Les motifs ci-dessous travaillent
 * en plus sur des RADICAUX (`envoy`, `sent`) : un accent dans une expression
 * régulière est un piège qui se voit à l'œil et pas à la lecture.
 */
function code(chemin) {
  return readFileSync(chemin, 'utf8').normalize('NFC')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n');
}

function dictionnaires() {
  globalThis.window = globalThis.window || {};
  for (const l of ['fr', 'en', 'ar']) {
    new Function('window', readFileSync(`js/i18n/${l}.js`, 'utf8'))(globalThis.window);
  }
  return globalThis.window.TABIBI_TR;
}

/**
 * Un SMS peut-il partir ? Il faut **les deux** : le module activé, et
 * quelqu'un qui l'appelle. Un module activé que personne n'appelle n'envoie
 * rien — c'est l'état actuel, à l'envers.
 */
function smsEmet() {
  const module = code('js/tabibi-sms.js');
  const active = /enabled\s*:\s*true/.test(module);
  const appele = ['reservation.html', 'js/tabibi-booking.js', 'success.html']
    .some((f) => /tabibiSMS\s*\.\s*\w+\s*\(/.test(code(f)));
  return active && appele;
}

/** Un e-mail de confirmation part-il à la réservation ? */
function emailRdvEmet() {
  return ['reservation.html', 'js/tabibi-booking.js', 'success.html']
    .some((f) => /sendEmail\s*\(/.test(code(f)));
}

// =====================================================================
// [17/09/2026] P-28 — L'E-MAIL, MAINTENANT QU'ON A MESURE OU IL VA
// =====================================================================
// La fiche P-28 disait « `send-email` jamais écrite » d'après `README_APP.md`.
// **Vérifié à la source le 17/09, sur le projet Supabase : elle n'est déployée
// nulle part.** Treize fonctions edge en production — `send-sms`,
// `verify-turnstile`, `acces-pilote`, `create-video-room`… — et pas
// `send-email`. Le dépôt n'en contient pas non plus le code.
//
// Donc : `js/tabibi-brevo.js` appelle `functions.invoke('send-email')`, reçoit
// un **404**, et rend `{ success: false }`. Quatre pages appelaient ça et
// annonçaient « Email envoyé. » — dans un `try/catch` inutile, puisque la
// fonction ne lève pas : elle REND l'échec.
//
// L'admin lisait « Email envoyé », ne prévenait pas le médecin à la main, et le
// médecin attendait. **C'est le cron des rappels, en plus petit : l'écran de
// contrôle dit autre chose que ce qui se passe.**
//
// ---------------------------------------------------------------------
// LA RÈGLE, ET POURQUOI ELLE NE SE PÉRIME PAS
// ---------------------------------------------------------------------
// On n'interdit pas le mot « e-mail » : on exige qu'un écran qui annonce un
// envoi **lise le résultat de cet envoi**. Le jour où `send-email` est
// déployée, rien ne change ici — la phrase devient vraie toute seule, parce
// qu'elle vient du résultat et non d'un littéral.

/** Les pages qui demandent un envoi d'e-mail. */
const PAGES_ENVOI = [
  'admin-dashboard.html',
  'admin-doctor-validation.html',
  'waiting-list.html',
];

/**
 * Une affirmation qu'un e-mail EST PARTI — au passé, ou maintenant.
 *
 * ⚠️ LA REGLE NE VISE PAS LES PROMESSES D'AVENIR, et ma premiere version s'y
 * est trompée : elle accusait `waiting-list.html`, qui dit « Vous recevrez un
 * email dès le lancement ». C'est un engagement pour décembre, sur une liste
 * qui est **réellement enregistrée** — pas une affirmation sur une opération
 * qui vient d'avoir lieu. Les deux ne se valent pas :
 *
 *   « Email envoyé. »                 -> vérifiable AUJOURD'HUI, et faux.
 *   « Vous recevrez un email au       -> un engagement qu'on peut encore tenir.
 *     lancement. »
 *
 * Ce qui rendait `doctor-claim.html` fautif n'était pas le futur, c'était la
 * DÉPENDANCE : on disait au médecin d'attendre un e-mail pour connaître une
 * décision, par un canal qui ne peut pas émettre. Il aurait attendu pour rien.
 */
const CLAME_ENVOI = /(e-?mail|courriel)\s*(envoy|exp[ée]di|sent)/i;

test('aucune page n’AFFIRME qu’un e-mail est parti', () => {
  // ⚠️ Lu SANS les commentaires : ceux qui expliquent ce défaut citent la
  // phrase fautive, mot pour mot. Onzième fois que ce piège se présente ici.
  const fautes = [];
  for (const f of [...PAGES_ENVOI, 'doctor-claim.html', 'signup.html']) {
    const src = code(f);
    for (const m of src.matchAll(new RegExp(CLAME_ENVOI.source, 'gi'))) {
      fautes.push(`${f}:${src.slice(0, m.index).split('\n').length} « ${m[0]} »`);
    }
  }
  assert.deepEqual(fautes, [],
    `affirmation(s) d'envoi ecrite(s) en dur :\n  ${fautes.join('\n  ')}`);
});

test('on ne fait pas ATTENDRE un e-mail pour une décision qui vient d’être prise', () => {
  // `doctor-claim.html` disait « vous recevrez un email à <adresse> dès qu'ils
  // seront validés ». Le médecin attendait un canal muet pour savoir si sa
  // fiche était acceptée — et ne relançait pas, puisqu'on lui avait dit
  // d'attendre.
  const src = code('doctor-claim.html');
  assert.doesNotMatch(src, /recevrez\s+un\s+e-?mail/i,   // radical : pas d'accent ici
    'doctor-claim fait de nouveau attendre un e-mail qui ne part pas');
  // Et il dit toujours ce qui est VRAI : les documents sont enregistrés.
  assert.match(src, /documents sont enregistr/i,
    'le message ne dit plus ce qui a réellement eu lieu');
});

test('les écrans d’admin LISENT le résultat de l’envoi', () => {
  // ⚠️ La moitié qu'on oublie : retirer la phrase ne suffit pas. Sans lecture
  // du résultat, l'admin ne saurait toujours pas que rien n'est parti — il
  // aurait simplement cessé d'être trompé, sans être informé.
  for (const f of ['admin-dashboard.html', 'admin-doctor-validation.html']) {
    const src = code(f);
    assert.match(src, /envoyerEtDire\(/,
      `${f} n'utilise plus la fonction qui rend le resultat`);
    assert.doesNotMatch(src, /tabibiBrevo\.sendEmail\(/,
      `${f} rappelle sendEmail() en direct : son resultat repart a la poubelle`);
    assert.match(src, /_mail\.phrase/,
      `${f} n'affiche plus ce qui s'est reellement passe`);
  }
});

test('un envoi DÉSACTIVÉ n’est plus rendu comme un succès', () => {
  // `sendEmail` rendait `{ success: true, disabled: true }` quand le module
  // est éteint. Un appelant qui lit `success` — ce que le nom invite à faire —
  // annonçait un envoi sur un module qui n'envoie rien.
  const src = code('js/tabibi-brevo.js');
  assert.doesNotMatch(src, /success:\s*true,\s*disabled:\s*true/,
    'le drapeau « desactive » repasse pour un succes');
  assert.match(src, /success:\s*false,\s*disabled:\s*true/);
});

test('le constat qui DATE le défaut : aucun expéditeur d’e-mail dans le dépôt', () => {
  // ⚠️ Constat, pas règle. S'il échoue, quelqu'un a écrit la fonction : il faut
  // alors la DÉPLOYER pour que les écrans redeviennent vrais, et relire P-83.
  assert.equal(existsSync('supabase/functions/send-email'), false,
    'une fonction `send-email` existe desormais : la deployer, puis relire P-83');
});

/** Les formes de « ça a été envoyé », dans les trois langues. */
const ANNONCE_ENVOI = /envoy|expédi|sent\b|have been|أرسل|إرسال/i;

// ─────────────────────────────────────────────────────────────────────
test('l’état mesuré : aujourd’hui, aucun des deux canaux n’émet', () => {
  // ⚠️ Cet essai n'est PAS une règle, c'est un constat daté. S'il échoue, ce
  // n'est pas une régression : c'est que quelqu'un a branché un envoi — et
  // alors les essais suivants changent d'exigence tout seuls. Lire le message.
  assert.equal(smsEmet(), false,
    'un SMS part désormais : `success.html` PEUT et DOIT l’annoncer de nouveau');
  assert.equal(emailRdvEmet(), false,
    'un e-mail part désormais : `success.html` PEUT et DOIT l’annoncer de nouveau');
});

test('tant que rien n’émet, l’écran de confirmation n’annonce aucun envoi', () => {
  const T = dictionnaires();
  if (smsEmet() && emailRdvEmet()) return;   // un émetteur existe : plus rien à interdire

  for (const l of ['fr', 'en', 'ar']) {
    const phrase = T[l].suc_sub;
    assert.ok(phrase, `${l} : la clé suc_sub a disparu`);
    assert.doesNotMatch(phrase, ANNONCE_ENVOI,
      `${l}.suc_sub annonce un envoi alors qu'aucun canal n'émet : « ${phrase} »`);
  }
});

test('et elle le DIT — sinon on a juste retiré la phrase', () => {
  // ⚠️ LA MOITIÉ QU'ON OUBLIE. Supprimer le mensonge sans rien mettre laisse
  // le patient attendre un SMS quand même, simplement sans qu'on le lui ait
  // promis. On lui dit qu'il n'y en aura pas, et de garder le récapitulatif.
  const T = dictionnaires();
  if (smsEmet() && emailRdvEmet()) return;

  for (const l of ['fr', 'en', 'ar']) {
    const phrase = T[l].suc_no_notif;
    assert.ok(phrase, `${l} : la mention « aucun SMS ni e-mail » a disparu`);
    assert.match(phrase, /sms|رسالة/i, `${l} : elle ne parle pas du SMS`);
  }
  // Et la page la rend vraiment.
  assert.match(code('success.html'), /data-i18n="suc_no_notif"/,
    'success.html n’affiche plus la mention');
});

test('la phrase d’origine, mot pour mot, ne peut pas revenir', () => {
  // Un repère daté : c'est elle qu'Aghiles a vue, et c'est elle qu'un
  // copier-coller ramènerait.
  const T = dictionnaires();
  for (const l of ['fr', 'en', 'ar']) {
    assert.doesNotMatch(T[l].suc_sub || '', /SMS.*(e-?mail|بريد)/i,
      `${l}.suc_sub promet de nouveau les deux canaux`);
  }
});

test('ce que la page annonce de vrai : le rendez-vous est retrouvable', () => {
  // On n'a pas remplacé une promesse par du vide : la phrase dit où retrouver
  // le rendez-vous, et le bouton correspondant existe.
  const T = dictionnaires();
  assert.match(T.fr.suc_sub, /rendez-vous/i);
  assert.match(code('success.html'), /href="patient-dashboard\.html"/,
    'le lien vers les rendez-vous a disparu de l’écran de confirmation');
});
