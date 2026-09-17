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
import { readFileSync } from 'node:fs';

/** Le code d'un fichier, commentaires retirés. */
function code(chemin) {
  return readFileSync(chemin, 'utf8')
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
