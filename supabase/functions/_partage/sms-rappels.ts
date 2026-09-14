// supabase/functions/_partage/sms-rappels.ts
// =====================================================================
// Ce qu'un rappel SMS contient — la partie qui peut etre ESSAYEE
// =====================================================================
// Extrait de `appointment-reminders/index.ts` le 14/09/2026. Rien n'y est
// change : ce sont les memes fonctions, au caractere pres.
//
// POURQUOI LES SORTIR. Le corps de la fonction importe `jsr:@supabase/…` et
// appelle `Deno.serve()` a son chargement : il ne peut pas etre execute
// ailleurs que sur un serveur Deno. Ces helpers-la, eux, ne dependent de RIEN.
// Sortis, ils deviennent essayables sous Node — et c'est ce que fait
// `tests/rappels-sms.test.mjs`.
//
// **Ce n'est pas du rangement.** Deux des regles ci-dessous ont deja produit
// un defaut mesure en conditions reelles :
//   - les fenetres j1/h2 se recouvraient : UN patient, DEUX SMS ;
//   - la normalisation des numeros algeriens decide a elle seule si un
//     message part ou pas.
// Elles etaient gardees par une relecture. Elles sont gardees par un essai.
//
// ⚠️  DEPLOIEMENT : dependance relative, a passer avec `index.ts`.
// =====================================================================

// ─────────────────────────────────────────────────────────────────────
// Texte
// ─────────────────────────────────────────────────────────────────────
/** GSM-7 : 160 caracteres au lieu de 70. Portage fidele de js/tabibi-sms.js. */
export function toGSM7(str: unknown): string {
  if (!str) return '';
  return String(str)
    .replace(/[àâä]/gi, 'a').replace(/[éèêë]/gi, 'e')
    .replace(/[îï]/gi, 'i').replace(/[ôö]/gi, 'o')
    .replace(/[ùûü]/gi, 'u').replace(/[ÿ]/gi, 'y')
    .replace(/[ç]/gi, 'c').replace(/[ñ]/gi, 'n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
}

export function sanitizeSMS(str: unknown): string {
  if (str == null) return '';
  return toGSM7(String(str))
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

// ─────────────────────────────────────────────────────────────────────
// Numeros algeriens
// ─────────────────────────────────────────────────────────────────────
/**
 * Rend `213XXXXXXXXX` (sans « + »), ou `null` si le numero n'est pas un
 * mobile algerien exploitable.
 *
 * **Rendre `null` est un resultat, pas un echec** : l'appelant ne consomme
 * alors aucun creneau, et le message repartira si le patient corrige son
 * numero. Un numero « repare » de force partirait chez quelqu'un d'autre.
 */
export function normalizePhoneDZ(phone: unknown): string | null {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-()\.+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '213' + p.slice(1);
  if (!p.startsWith('213')) {
    if (/^[567]/.test(p) && p.length === 9) p = '213' + p;
    else return null;
  }
  if (!/^213[567]\d{8}$/.test(p)) return null;
  return p;
}

// ─────────────────────────────────────────────────────────────────────
// Fenetres de balayage, en minutes depuis maintenant
// ─────────────────────────────────────────────────────────────────────
// ⚠️ ELLES NE DOIVENT PAS SE RECOUVRIR. Avec un plancher j1 a 60 min, un RDV
// a ~100 min tombait dans les DEUX passes et le patient recevait deux SMS
// (constate en essai reel). Le plancher j1 est donc a 6 h, tres au-dessus du
// plafond h2 (150 min) — la marge est volontaire, pas approximative.
// `tests/rappels-sms.test.mjs` verifie l'invariant : il ne depend plus de la
// vigilance de celui qui modifiera ces nombres.
export const WINDOWS = {
  j1: { fromMin: 6 * 60, toMin: 24 * 60 },  // [now+6h,   now+24h]
  h2: { fromMin: 90, toMin: 150 },          // [now+90min, now+150min]
} as const;

export const SMS_MAX_LEN = 160;     // GSM-7 : au-dela, le SMS est facture double
export const TZ = 'Africa/Algiers'; // heure du cabinet (UTC+1 fixe, sans DST)
export const QUIET_FROM = 21;       // 21h00 -> plus de rappel j1
export const QUIET_TO = 8;          // 08h00 -> reprise

/** Vrai si les deux fenetres se chevauchent. Doit rester FAUX. */
export function fenetresSeRecouvrent(): boolean {
  return WINDOWS.j1.fromMin < WINDOWS.h2.toMin && WINDOWS.h2.fromMin < WINDOWS.j1.toMin;
}

// ─────────────────────────────────────────────────────────────────────
// Dates telles que le patient les vit : heure d'Alger
// ─────────────────────────────────────────────────────────────────────
export function fmtDateAlgiers(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(new Date(iso));
}
export function fmtTimeAlgiers(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
export function hourAlgiers(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
}

/** Heures calmes : vrai entre 21h et 8h, heure d'Alger. */
export function estHeureCalme(d: Date): boolean {
  const h = hourAlgiers(d);
  return h >= QUIET_FROM || h < QUIET_TO;
}

// ─────────────────────────────────────────────────────────────────────
// Gabarits (fr/ar/en, ASCII GSM-7)
// ─────────────────────────────────────────────────────────────────────
// Sender : mesure le 2026-07-31 sur MCCMNC 60302 (meme numero, meme
// operateur) — sender alphanumerique « Tabibi » -> 5/5 livres ; sender
// numerique partage « 12345 » -> 11/19 livres (~42 % perdus). BSMS_FROM vaut
// donc « Tabibi ». Le mot reste aussi dans le CORPS du message.
export interface TplData {
  lang?: string | null; doctorName?: string | null; date?: string | null;
  time?: string | null; shortAddress?: string | null;
}

export function tplJ1(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || 'medecin';
  const date = sanitizeSMS(d.date) || 'demain';
  const time = sanitizeSMS(d.time);
  const T: Record<string, string> = {
    fr: 'Tabibi: rappel RDV ' + date + (time ? ' a ' + time : '') + ' avec ' + doc + '. tabibi.doctor',
    ar: 'Tabibi: tadhkir maw3id ' + date + (time ? ' fi ' + time : '') + ' ma3a ' + doc + '. tabibi.doctor',
    en: 'Tabibi: reminder appt ' + date + (time ? ' at ' + time : '') + ' with ' + doc + '. tabibi.doctor',
  };
  return T[d.lang ?? 'fr'] ?? T.fr;
}

export function tplH2(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || 'medecin';
  const time = sanitizeSMS(d.time);
  const addr = sanitizeSMS(d.shortAddress);
  const T: Record<string, string> = {
    fr: 'Tabibi: RDV dans 2h avec ' + doc + (time ? ' a ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Bon RDV!',
    ar: 'Tabibi: maw3id fi sa3atayn ma3a ' + doc + (time ? ' fi ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Bon RDV!',
    en: 'Tabibi: appt in 2h with ' + doc + (time ? ' at ' + time : '') + '.' + (addr ? ' ' + addr : '') + ' Good visit!',
  };
  return T[d.lang ?? 'fr'] ?? T.fr;
}

export function tplConfirmation(d: TplData): string {
  const doc = sanitizeSMS(d.doctorName) || 'medecin';
  const date = sanitizeSMS(d.date);
  const time = sanitizeSMS(d.time);
  const T: Record<string, string> = {
    fr: 'Tabibi: votre RDV du ' + date + ' a ' + time + ' avec Dr ' + doc + ' est confirme. tabibi.doctor',
    ar: 'Tabibi: maw3idik yawm ' + date + ' fi ' + time + ' ma3a Dr ' + doc + ' mo2akkad. tabibi.doctor',
    en: 'Tabibi: your appt on ' + date + ' at ' + time + ' with Dr ' + doc + ' is confirmed. tabibi.doctor',
  };
  return T[d.lang ?? 'fr'] ?? T.fr;
}

/** Tronque a la longueur facturee d'un seul SMS. */
export function borner(message: string): string {
  return message.length > SMS_MAX_LEN ? message.substring(0, SMS_MAX_LEN) : message;
}
