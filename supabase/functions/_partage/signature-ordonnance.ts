// supabase/functions/_partage/signature-ordonnance.ts
// =====================================================================
// La signature d'une ordonnance — ecrite UNE fois, lue par DEUX fonctions
// =====================================================================
// `generate-prescription-pdf` signe. `verify-prescription` verifie. Si les
// deux construisaient leur propre chaine canonique, une divergence d'une
// virgule invaliderait toutes les ordonnances signees ce jour-la. Ce module
// existe pour que la question ne se pose pas.
//
// ⚠️  DEPLOIEMENT : ce fichier est une **dependance relative**. Le deployer
// avec chacune des deux fonctions, sinon l'import echoue au demarrage.
//   - `supabase functions deploy <nom>` : la CLI l'embarque toute seule.
//   - MCP `deploy_edge_function` : le passer dans `files`, en plus de
//     `index.ts`. Le nom exact a donner est rappele en tete de chaque
//     `index.ts`.
//
// ---------------------------------------------------------------------
// ⚠️  UNE CIRCULARITE QU'IL A FALLU DEFAIRE, ET LA LECON QU'ELLE PORTE
// ---------------------------------------------------------------------
// Premiere version de ce module : la signature couvrait `pdf_sha256`. C'etait
// **impossible**, et je ne l'ai vu qu'en ecrivant le pied de page du PDF.
//
//     le PDF imprime l'URL de verification, qui contient la signature
//     la signature couvre l'empreinte du PDF
//     l'empreinte du PDF depend de ce qui est imprime dedans
//
// Un serpent qui se mord la queue. Aucune des trois n'est calculable en
// premier. Les issues possibles etaient : ne pas imprimer l'URL (un
// pharmacien devrait alors la retaper de memoire), ou sortir l'empreinte du
// PDF de la chaine signee.
//
// **La seconde, et elle rend le dispositif MEILLEUR** — voir ci-dessous.
//
// ---------------------------------------------------------------------
// CE QUE LA SIGNATURE PROUVE
// ---------------------------------------------------------------------
// Elle lie ensemble, de maniere inseparable :
//
//     l'identifiant · le numero · le medecin · le patient
//     la date d'emission · la date de peremption
//     **l'empreinte SHA-256 du CONTENU MEDICAL** (medicaments, diagnostic, notes)
//
// La derniere ligne est celle qui compte, et c'est elle qu'on aurait perdue
// en signant le PDF : **une modification du traitement en base casse la
// signature, sans que la verification publique ait jamais a lire le
// traitement.** On verifie un contenu qu'on ne montre pas. C'est exactement
// ce qu'une page de verification publique doit savoir faire.
//
// `pdf_sha256` reste enregistre dans la ligne — c'est l'empreinte du FICHIER,
// et `verify-prescription` la rend, pour que celui qui detient le PDF puisse
// la comparer lui-meme. Elle n'est pas signee : elle ne peut pas l'etre.
//
// Ce que la signature ne prouve PAS : que le medecin a lu ce qu'il signait,
// ni qu'il existe. **Ce n'est pas une signature electronique qualifiee**, et
// ni le PDF ni la page de verification ne doivent le laisser croire.
//
// ---------------------------------------------------------------------
// LA VERSION DE CLE EST DANS LA SIGNATURE, DES LA PREMIERE
// ---------------------------------------------------------------------
// Une ordonnance signee doit rester verifiable **apres** une rotation de cle.
// Sans identifiant de version, une rotation invalide tout l'historique — et on
// s'en apercoit le jour de la rotation, c'est-a-dire trop tard.
//
// Forme stockee dans `prescriptions.doctor_signature_hmac` :
//
//     v1:9f2c…                  <- version, deux-points, HMAC en hexadecimal
//
// Rotation, plus tard : poser `PRESCRIPTION_SIGNING_KEY_V2`, passer
// `PRESCRIPTION_SIGNING_KEY_CURRENT` a `v2`. Les nouvelles ordonnances portent
// `v2:`, les anciennes restent verifiables **tant que la V1 reste posee**.
// Retirer une ancienne cle rend invalides les ordonnances qu'elle a signees :
// ca se decide, ca ne se subit pas.
//
// ---------------------------------------------------------------------
// LES SECRETS — Aghiles les pose, je ne les lis pas (regles 4 et 6)
// ---------------------------------------------------------------------
//   PRESCRIPTION_SIGNING_KEY_V1        la cle HMAC, >= 32 caracteres aleatoires
//   PRESCRIPTION_SIGNING_KEY_CURRENT   "v1" — la version avec laquelle on SIGNE
//
// Console : Supabase > Edge Functions > Secrets. Jamais dans le depot, jamais
// dans un journal, jamais dans une reponse HTTP.
// =====================================================================

/**
 * Forme minimale d'une ordonnance pour la signature.
 * `contenu_sha256` remplace le contenu medical : **aucun medicament ne
 * traverse ce module.**
 */
export interface OrdonnanceSignable {
  id: string;
  prescription_number: string;
  doctor_id: string;
  patient_id: string;
  issue_date: string;          // 'YYYY-MM-DD'
  expiry_date: string | null;  // 'YYYY-MM-DD' ou null
  contenu_sha256: string;      // hexadecimal minuscule, 64 caracteres
}

/** Une version de cle valide : `v` suivi d'un ou plusieurs chiffres. */
const VERSION_VALIDE = /^v[0-9]+$/;

/**
 * Erreur de configuration — jamais renvoyee telle quelle au client.
 *
 * NOTE : `version` est declaree puis affectee, et non passee en « propriete de
 * parametre » TypeScript. La forme courte exigerait une TRANSFORMATION du code,
 * la forme longue ne demande qu'un EFFACEMENT des types — c'est ce qui permet
 * a `tests/signature-ordonnance.test.mjs` d'executer ce fichier tel quel sous
 * Node, et donc de prouver le vecteur de signature sans Deno.
 */
export class CleIndisponible extends Error {
  version: string;
  constructor(version: string) {
    // Le message ne contient QUE le nom de la variable, jamais sa valeur.
    super(`cle de signature absente pour la version ${version}`);
    this.name = 'CleIndisponible';
    this.version = version;
  }
}

/**
 * Nom de la variable d'environnement portant la cle d'une version donnee.
 * Expose pour que les messages d'exploitation puissent nommer ce qui manque
 * — le NOM, jamais la valeur.
 */
export function nomVariableCle(version: string): string {
  return `PRESCRIPTION_SIGNING_KEY_${version.toUpperCase()}`;
}

/** La version avec laquelle on SIGNE aujourd'hui. */
export function versionCourante(): string {
  const v = (Deno.env.get('PRESCRIPTION_SIGNING_KEY_CURRENT') ?? '').trim().toLowerCase();
  if (!VERSION_VALIDE.test(v)) {
    throw new CleIndisponible(v || '(PRESCRIPTION_SIGNING_KEY_CURRENT vide)');
  }
  return v;
}

/** Hexadecimal minuscule d'un tampon binaire. */
function hex(octets: ArrayBuffer): string {
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/**
 * JSON **stable** : les cles d'objet sont triees, recursivement.
 *
 * Sans ca, la signature dependrait de l'ordre dans lequel les cles arrivent.
 * Postgres range deja les cles d'un `jsonb`, mais rien ne garantit que
 * PostgREST, le client, ou une version future les rende dans le meme ordre.
 * **Une signature ne se repose pas sur un ordre qu'on n'impose pas soi-meme.**
 */
export function jsonStable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`;
  const o = v as Record<string, unknown>;
  const cles = Object.keys(o).sort();
  return `{${cles.map((c) => `${JSON.stringify(c)}:${jsonStable(o[c])}`).join(',')}}`;
}

/**
 * Empreinte du contenu medical. **Ne jamais changer cette forme sans changer
 * de version de cle** : toute ordonnance deja signee deviendrait invalide.
 */
export async function empreinteContenu(
  medications: unknown,
  diagnosis: string | null,
  clinicalNotes: string | null,
): Promise<string> {
  const canonique = jsonStable({
    medications: medications ?? [],
    diagnosis: diagnosis ?? null,
    clinical_notes: clinicalNotes ?? null,
  });
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonique)));
}

/**
 * Chaine canonique signee. **Ne jamais la modifier sans changer de version de
 * cle.**
 *
 * Separateur `|` : aucun des champs ne peut en contenir (uuid, dates ISO,
 * hexadecimal, et un numero d'ordonnance contraint). Un separateur qu'un champ
 * pourrait contenir permettrait de decaler les champs sans changer la chaine.
 */
export function chaineCanonique(version: string, p: OrdonnanceSignable): string {
  return [
    version,
    p.id,
    p.prescription_number,
    p.doctor_id,
    p.patient_id,
    p.issue_date,
    p.expiry_date ?? '',
    p.contenu_sha256,
  ].join('|');
}

async function hmacHex(cle: string, message: string): Promise<string> {
  const encodeur = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw', encodeur.encode(cle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', k, encodeur.encode(message)));
}

function cleDeVersion(version: string): string {
  if (!VERSION_VALIDE.test(version)) throw new CleIndisponible(version);
  const cle = Deno.env.get(nomVariableCle(version));
  if (!cle || cle.length < 32) throw new CleIndisponible(version);
  return cle;
}

/**
 * Signe et rend la valeur a stocker : `<version>:<hmac hexadecimal>`.
 * Leve `CleIndisponible` si la cle courante n'est pas posee — **on ne signe
 * jamais avec un repli**. Une signature fabriquee sans cle aurait l'air
 * valide : ce serait pire que pas de signature.
 */
export async function signer(p: OrdonnanceSignable): Promise<string> {
  const version = versionCourante();
  return `${version}:${await hmacHex(cleDeVersion(version), chaineCanonique(version, p))}`;
}

/** Decoupe une valeur stockee. Rend `null` si la forme n'est pas la bonne. */
export function decouper(stocke: string): { version: string; hmac: string } | null {
  const i = stocke.indexOf(':');
  if (i <= 0) return null;
  const version = stocke.slice(0, i).toLowerCase();
  const hmac = stocke.slice(i + 1).toLowerCase();
  if (!VERSION_VALIDE.test(version)) return null;
  if (!/^[0-9a-f]{64}$/.test(hmac)) return null;
  return { version, hmac };
}

/**
 * Comparaison a temps constant. Une comparaison `===` sur des chaines sort au
 * premier caractere different : elle laisse mesurer une signature octet par
 * octet. Ici le temps ne depend que de la LONGUEUR, qui n'est pas un secret.
 */
export function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Verdict =
  | { etat: 'valide'; version: string }
  | { etat: 'forme_invalide' }
  | { etat: 'cle_absente'; version: string }
  | { etat: 'signature_invalide'; version: string };

/**
 * Recalcule la signature depuis les donnees de la base et la compare a la
 * valeur stockee. **C'est ce recalcul qui detecte une modification de la
 * base** — pas la comparaison avec ce que presente le visiteur.
 */
export async function verifier(p: OrdonnanceSignable, stocke: string): Promise<Verdict> {
  const decoupe = decouper(stocke);
  if (!decoupe) return { etat: 'forme_invalide' };

  let cle: string;
  try {
    cle = cleDeVersion(decoupe.version);
  } catch {
    // La cle de CETTE version n'est plus posee : on ne peut pas conclure.
    // Ce n'est pas « invalide », c'est « indecidable » — et les deux ne se
    // confondent pas : l'une accuse le document, l'autre nous accuse nous.
    return { etat: 'cle_absente', version: decoupe.version };
  }

  const attendu = await hmacHex(cle, chaineCanonique(decoupe.version, p));
  return egalConstant(attendu, decoupe.hmac)
    ? { etat: 'valide', version: decoupe.version }
    : { etat: 'signature_invalide', version: decoupe.version };
}
