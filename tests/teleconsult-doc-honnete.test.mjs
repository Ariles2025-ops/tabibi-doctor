// =====================================================================
// tests/teleconsult-doc-honnete.test.mjs — deux fichiers se contredisaient
// =====================================================================
// `teleconsultation.html:11-13` affirmait « get_video_session et
// set_video_recording_consent absents en DB (SQL_TODO-008) ». **Faux.** Les
// quatre RPC existent — lu sur `pg_proc` le 18/09/2026 :
//
//     get_video_session(p_session_id uuid)
//     mark_video_session_started(p_session_id uuid)
//     mark_video_session_ended(p_session_id uuid, p_duration integer)
//     set_video_recording_consent(p_session_id uuid, p_consent boolean)
//
// Et `js/tabibi-features.js:44` disait déjà correctement le contraire depuis le
// 14/09. **Deux fichiers du même dépôt se contredisaient sur un fait vérifiable
// en une requête**, et celui qui avait tort était celui que lirait un
// intervenant venu toucher à la téléconsultation.
//
// Le danger n'est pas le commentaire : c'est ce qu'on fait en le croyant.
// Quelqu'un qui « corrige » sur cette base **casse une vidéo qui marche**.
//
// ---------------------------------------------------------------------
// ⚠️ POURQUOI UN ESSAI QUI LIT UN COMMENTAIRE
// ---------------------------------------------------------------------
// Parce que le correctif EST un commentaire : il n'a aucune trace à
// l'exécution, donc aucun essai de comportement ne peut le garder. Sans cet
// essai, le lot serait « un correctif sans garde » — un sursis (règle 10).
//
// ⚠️ ET LE MENSONGE EST CONSERVÉ, BARRÉ (`~~…~~`), parce qu'il a servi de
// référence : qui cherche `SQL_TODO-008` doit tomber sur sa réfutation, pas sur
// le silence. Cet essai **retire donc le texte barré avant de chercher** —
// sinon il s'accuserait de la citation qu'il exige. Ce dépôt a déjà rencontré
// cette faute treize fois ; celle-ci est la quatorzième évitée.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = readFileSync(join(process.cwd(), 'teleconsultation.html'), 'utf8');
const FLAGS = readFileSync(join(process.cwd(), 'js', 'tabibi-features.js'), 'utf8');

/** Sans le texte BARRÉ : ce qui est corrigé n'est plus une affirmation. */
const vivant = (src) => src.replace(/~~[\s\S]*?~~/g, ' ');

const RPC = ['get_video_session', 'mark_video_session_started',
             'mark_video_session_ended', 'set_video_recording_consent'];

test('la page n’affirme plus que les RPC vidéo sont absentes', () => {
  const nu = vivant(PAGE);
  for (const menteur of [/absents?\s+en\s+DB/i, /inexistante?s?/i, /SQL_TODO-008/]) {
    assert.ok(!menteur.test(nu),
      `teleconsultation.html affirme à nouveau une absence : ${menteur}`);
  }
});

test('elle nomme les quatre RPC, et la date de la mesure', () => {
  // ⚠️ Un correctif qui se contenterait de SUPPRIMER le mensonge laisserait un
  // vide : le prochain lecteur n'aurait toujours aucune raison de croire que
  // les RPC existent. **On ne remplace pas un mensonge par un cul-de-sac.**
  for (const nom of RPC) {
    assert.ok(PAGE.includes(nom), `la RPC « ${nom} » n’est plus documentée dans la page`);
  }
  assert.match(PAGE, /pg_proc/,
    'la méthode de la mesure a disparu : un document sans méthode ne fait que répéter');
  assert.match(PAGE, /18\/09\/2026/,
    'la date de la mesure a disparu : une règle de référence n’est pas une mesure');
});

test('les deux fichiers s’accordent sur le FAIT, pas sur le drapeau', () => {
  // ⚠️ MA PREMIÈRE VERSION EXIGEAIT `video: true`, ET C'ÉTAIT FAUX. Le
  // commentaire de `js/tabibi-features.js` prévoit **explicitement** que le
  // drapeau se referme si le flux casse en séance : une garde qui virerait
  // rouge ce jour-là pleurerait sur une décision juste, et finirait désactivée.
  // Contre-épreuve : en refermant le drapeau, elle restait verte — mais pour
  // une autre raison encore, le fichier CITE `video: true` dans sa propre
  // documentation. Elle mesurait un commentaire. **Quatorzième fois.**
  //
  // Ce qui doit tenir n'est pas l'état du drapeau : c'est que les deux fichiers
  // disent la même chose du FAIT vérifiable — les RPC existent.
  const nu = FLAGS
    .split('\n').map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, '$1')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(nu, /video:\s*(true|false)/,
    'le drapeau vidéo n’est plus déclaré du tout');
  // ⚠️ ET ON ANCRE SUR LE NOM DE LA RPC, PAS SUR LE MOT « EXISTENT » SEUL.
  // Mesuré : `js/tabibi-features.js` contient un SECOND « elles existent »,
  // l.133, à propos des RPC d'avis — sans rapport. Un `/EXISTENT/i` nu restait
  // donc vert même en effaçant la ligne qui compte. **Une garde qui peut être
  // satisfaite par une phrase voisine ne garde rien.**
  assert.match(FLAGS, /set_video_recording_consent[\s\S]{0,200}EXISTENT/,
    'js/tabibi-features.js ne dit plus que les RPC VIDÉO existent : la contradiction peut revenir');
});

test('⚠️ CONTRE-ÉPREUVE — le garde-fou de drapeau est toujours là', () => {
  // Le commentaire décrit un bloc. Si quelqu'un supprimait le bloc en gardant
  // le commentaire, on aurait remplacé un mensonge par un autre. Et ce
  // garde-fou compte : le commentaire de `tabibi-features.js` prévoit
  // explicitement que le drapeau se REFERME si le flux casse en séance.
  assert.match(PAGE, /TABIBI_FEATURES\s*&&\s*window\.TABIBI_FEATURES\.video\s*===\s*false/,
    'le garde-fou de drapeau a disparu — le commentaire décrirait du vide');
  assert.match(PAGE, /bient[oô]t disponible/i,
    'la carte « bientôt disponible » a disparu : refermer le drapeau ne dirait plus rien');
});
