// supabase/functions/_partage/texte-arabe.ts
// =====================================================================
// Decider de la police et du sens d'une ligne — sans rien deviner
// =====================================================================
// [15/09/2026] CE QUE J'AVAIS ECRIT LE 14/09 ETAIT TROP PESSIMISTE.
//
// J'avais conclu, en tete de `generate-prescription-pdf`, que l'arabe exigeait
// « un moteur de faconnage » et « un lot a soi ». **Mesure faite depuis** :
//
//     fontkit.layout('طبيبي')  ->  9 glyphes : 294,100,292,16,294,18,292,16,43
//     mapping naif par point   ->  5 glyphes : 40,554,742,554,742
//     pdf-lib + @pdf-lib/fontkit encode : <000100020003000400010005000300040006>
//                                          ^ NEUF indices
//
// **pdf-lib faconne**, parce que son `CustomFontEmbedder` passe par
// `font.layout()` de fontkit. Ce qui manquait n'etait pas un moteur : c'etait
// une police contenant les glyphes arabes. Les 14 polices standard du format
// PDF n'en ont aucun — c'etait vrai, et j'en avais tire la mauvaise conclusion.
//
// ---------------------------------------------------------------------
// CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS
// ---------------------------------------------------------------------
// Il repond a deux questions par morceau de texte : **quelle police**, et
// **de quel cote on aligne**. C'est tout. Le faconnage contextuel
// (formes initiale / mediane / finale, ligatures) est fait par fontkit, dans
// pdf-lib ; on ne le refait pas ici, et on ne le corrige pas.
//
// ⚠️ IL NE FAIT PAS DE BIDI COMPLET. Une ligne qui melange une phrase arabe
// et une phrase latine *dans la meme ligne* peut voir ses morceaux ordonnes
// autrement qu'un moteur bidi complet ne le ferait. Sur une ordonnance, les
// champs sont en pratique d'une seule langue — un nom de medicament, un
// diagnostic. **Cette limite est ecrite ici pour ne pas etre decouverte plus
// tard sur un document imprime**, et `contientLesDeux()` permet de la reperer.
// =====================================================================

/**
 * Plages arabes d'Unicode : arabe de base, supplement, arabe etendu-A,
 * formes de presentation A et B.
 */
const ARABE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Latin « visible » : lettres seulement, pas les chiffres ni la ponctuation. */
const LATIN = /[A-Za-zÀ-ɏ]/;

export function contientArabe(t: unknown): boolean {
  return ARABE.test(String(t ?? ''));
}

export function contientLatin(t: unknown): boolean {
  return LATIN.test(String(t ?? ''));
}

/**
 * Vrai si les deux ecritures cohabitent dans le meme texte — le seul cas ou
 * l'absence de bidi complet peut se voir. Les chiffres ne comptent pas : ils
 * sont communs aux deux, et « Doliprane 500 mg » n'est pas un cas mixte.
 */
export function contientLesDeux(t: unknown): boolean {
  return contientArabe(t) && contientLatin(t);
}

export type Sens = 'ltr' | 'rtl';

/**
 * Le sens d'un texte, decide par **la premiere lettre forte** rencontrée —
 * la regle du premier caractere fort, comme le fait Unicode.
 *
 * On ne compte pas les lettres pour prendre une majorite : « Dr Benali —
 * ملاحظة » commence en latin et se lit de gauche a droite, meme si la partie
 * arabe est plus longue.
 */
export function sensDe(t: unknown): Sens {
  const s = String(t ?? '');
  for (const c of s) {
    if (ARABE.test(c)) return 'rtl';
    if (LATIN.test(c)) return 'ltr';
  }
  return 'ltr';
}

export interface Polices {
  /** Police latine (Helvetica & co). */
  latine: unknown;
  /** Police arabe embarquee — absente tant qu'aucun texte n'en a eu besoin. */
  arabe?: unknown;
}

/**
 * Choisit la police d'un texte. **Rend `null` quand il faudrait l'arabe et
 * qu'elle n'est pas chargee** : l'appelant doit alors refuser, jamais se
 * rabattre sur la latine — qui rendrait des carres vides, ou leverait.
 *
 * C'est le meme principe que la signature : on ne fabrique pas un repli qui a
 * l'air correct.
 */
export function policePour(t: unknown, p: Polices): unknown | null {
  if (!contientArabe(t)) return p.latine;
  return p.arabe ?? null;
}

/**
 * Abscisse de depart d'une ligne selon son sens.
 * En RTL, le texte se pose a droite du cadre.
 */
export function xPour(sens: Sens, marge: number, largeur: number, largeurTexte: number): number {
  return sens === 'rtl' ? marge + largeur - largeurTexte : marge;
}

/**
 * Prefixe un numero d'ordre dans le bon sens : « 1. » a gauche en latin,
 * « .1 » a droite en arabe. Detail minuscule, mais une liste de medicaments
 * numerotee a l'envers se lit mal.
 */
export function numeroter(n: number, texte: string): string {
  return sensDe(texte) === 'rtl' ? `${texte} .${n}` : `${n}. ${texte}`;
}
