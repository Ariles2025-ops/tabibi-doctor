// supabase/functions/verify-prescription/index.ts
// =====================================================================
// Verifier une ordonnance SANS JAMAIS DIRE CE QU'ELLE CONTIENT
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.**
//
// ---------------------------------------------------------------------
// DEPLOIEMENT — deux fichiers, et `verify_jwt` a FAUX
// ---------------------------------------------------------------------
//   entrypoint : index.ts
//   dependance : ../_partage/signature-ordonnance.ts
//
// **`verify_jwt = false`** : c'est le seul point du produit ou un inconnu doit
// pouvoir interroger le systeme. Un pharmacien qui recoit une ordonnance n'a
// pas de compte Tabibi, et ne doit pas en creer un pour verifier un papier.
// L'entree correspondante est ajoutee a `supabase/config.toml`.
//
// L'endpoint est donc PUBLIC par necessite, comme `sms-dlr`. Ce qui le rend
// acceptable n'est pas une garde a l'entree, c'est **ce qu'il refuse de dire**.
//
// ---------------------------------------------------------------------
// LA REGLE, ET ELLE N'A PAS D'EXCEPTION
// ---------------------------------------------------------------------
//   > **Aucun medicament, aucun diagnostic, aucune note clinique ne sort
//   > d'ici. Jamais. Meme avec une signature valide.**
//
// Une page de verification publique qui afficherait le traitement serait une
// fuite de donnees de sante **par conception** : il suffirait de faire
// circuler un lien. Le pharmacien tient deja le papier ; il n'a pas besoin
// qu'on le lui relise, il a besoin de savoir s'il est authentique.
//
// Cette regle est ecrite deux fois dans ce fichier :
//   1. la reponse est construite champ par champ, jamais par etalement d'une
//      ligne de la base ;
//   2. avant l'envoi, `refuserToutContenuMedical()` **relit le corps produit**
//      et refuse de repondre s'il y retrouve un contenu medical.
//
// Le second point existe parce que le premier depend de quelqu'un qui se
// souvient. Un `select('*')` ajoute un jour par commodite, et la promesse
// tombe sans bruit. Le garde-fou, lui, casse bruyamment.
//
// ---------------------------------------------------------------------
// COMMENT ON DETECTE UNE FALSIFICATION SANS LIRE LE CONTENU
// ---------------------------------------------------------------------
// La chaine signee contient l'empreinte SHA-256 du contenu medical, pas le
// contenu. On la **recalcule** depuis la ligne et on recompose la signature :
//
//   - traitement modifie en base  -> empreinte differente -> signature invalide
//   - date, numero, medecin, patient modifies -> idem
//   - `sig` presente qui ne correspond pas a la ligne -> refus
//
// Et on ne lit jamais un medicament pour le dire. Voir
// `_partage/signature-ordonnance.ts`.
//
// ---------------------------------------------------------------------
// LE CONTRAT, RELEVE DANS LE FRONT (`verify-prescription.html:226-250`)
// ---------------------------------------------------------------------
//   GET /functions/v1/verify-prescription?id=<uuid>&sig=<signature>
//   sans en-tete d'autorisation.
//
//   erreurs attendues telles quelles :
//     invalid_params · not_found · invalid_signature · not_signed
//     (tout autre `error` est rendu « erreur serveur » par la page)
//
//   succes : { valid | expired | cancelled } + prescription_number,
//            issue_date, expiry_date, status, doctor_name, doctor_specialty,
//            patient_initials
//
// `patient_initials` etait deja prevu par la page : **le nom du patient ne
// sort pas non plus.** C'etait la bonne idee, elle est tenue ici.
//
// ---------------------------------------------------------------------
// CE QUI N'EST PAS RESOLU, ET QUE JE NE CACHE PAS
// ---------------------------------------------------------------------
// **Il n'y a pas de limitation de debit.** L'identifiant est un uuid v4 et la
// signature fait 64 hexadecimaux : deviner est hors de portee. Mais rien
// n'empeche d'appeler cette fonction en boucle, et la reponse distingue
// `not_found` d'`invalid_signature` — ce qui permet, avec un uuid connu, de
// savoir qu'une ordonnance existe. **C'est un choix : la page affiche deux
// messages differents**, et les confondre tromperait le pharmacien de bonne
// foi. A rediscuter si le volume le justifie.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  empreinteContenu,
  verifier,
  type OrdonnanceSignable,
} from '../_partage/signature-ordonnance.ts';

const ORIGINES_AUTORISEES = [
  'https://tabibi.doctor',
  'https://www.tabibi.doctor',
  'http://localhost:8080',
];

function enTetes(req: Request): HeadersInit {
  const origine = req.headers.get('Origin') ?? '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ORIGINES_AUTORISEES.includes(origine) ? origine : ORIGINES_AUTORISEES[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // Un verdict ne se met pas en cache : une ordonnance peut etre annulee.
    'Cache-Control': 'no-store',
  };
}

function refus(req: Request, statut: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), { status: statut, headers: enTetes(req) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE = /^v[0-9]+:[0-9a-f]{64}$/i;

/** Initiales, et rien de plus : « Amina Belkacem » -> « A. B. » */
function initiales(prenom?: string | null, nom?: string | null): string {
  const bouts = [prenom, nom].map((s) => (s ?? '').trim()).filter(Boolean);
  if (!bouts.length) return '—';
  return bouts.map((s) => `${[...s][0].toUpperCase()}.`).join(' ');
}

/**
 * DERNIER REMPART. Relit le corps qu'on s'apprete a envoyer et refuse de
 * repondre s'il contient un fragment du contenu medical.
 *
 * Ce n'est pas de la defiance envers le code d'a cote : c'est que ce code
 * changera, et que la promesse « on n'expose pas les medicaments » ne doit pas
 * dependre de la memoire du prochain lecteur. Une regle qui ne se verifie pas
 * n'est pas une regle, c'est une intention.
 *
 * DEUX REGLAGES, et ils se paient l'un l'autre :
 *   - seuil de 5 caracteres ;
 *   - les valeurs purement numeriques ou datees sont ignorees.
 * En dessous, une collision fortuite (« 1 an » qui se retrouve dans une date)
 * ferait rendre « erreur serveur » sur une ordonnance parfaitement valide —
 * un faux positif ici n'est pas gratuit, il casse une verification legitime.
 * Au-dessus, un nom de medicament court passerait. Un nom de medicament fait
 * rarement moins de cinq lettres ; une duree en fait rarement plus.
 */
function refuserToutContenuMedical(corps: string, medical: unknown[]): string | null {
  const bas = corps.toLowerCase();
  const fragments: string[] = [];
  const aplatir = (v: unknown) => {
    if (typeof v === 'string') fragments.push(v);
    else if (Array.isArray(v)) v.forEach(aplatir);
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(aplatir);
  };
  medical.forEach(aplatir);

  for (const f of fragments) {
    const t = f.trim().toLowerCase();
    if (t.length < 5) continue;
    if (/^[\d\s/.:-]+$/.test(t)) continue;   // une date, un dosage chiffre : pas un contenu
    if (bas.includes(t)) return f.slice(0, 40);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'GET') return refus(req, 405, 'method_not_allowed');

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!urlSupabase || !cleService) {
    console.error('[verify-prescription] configuration Supabase incomplete');
    return refus(req, 500, 'verification_unavailable');
  }

  // ── 1. La forme d'abord : on ne touche pas la base pour une entree absurde ──
  const params = new URL(req.url).searchParams;
  const id = (params.get('id') ?? '').trim();
  const sig = (params.get('sig') ?? '').trim();
  if (!UUID.test(id) || !SIGNATURE.test(sig)) return refus(req, 400, 'invalid_params');

  const service = createClient(urlSupabase, cleService, { auth: { persistSession: false } });

  // ── 2. La ligne. On lit le contenu medical POUR LE HACHER, jamais pour le dire. ──
  const { data: ordo, error: errOrdo } = await service
    .from('prescriptions')
    .select('id, prescription_number, doctor_id, patient_id, issue_date, expiry_date, status, doctor_signature_hmac, pdf_sha256, cancelled_at, medications, diagnosis, clinical_notes')
    .eq('id', id)
    .maybeSingle();
  if (errOrdo) {
    console.error('[verify-prescription] lecture :', errOrdo.message);
    return refus(req, 500, 'verification_unavailable');
  }
  if (!ordo) return refus(req, 404, 'not_found');
  if (!ordo.doctor_signature_hmac || ordo.status === 'draft') return refus(req, 409, 'not_signed');

  // ── 3. Le recalcul — c'est LUI qui detecte une base modifiee ─────────
  const aVerifier: OrdonnanceSignable = {
    id: ordo.id,
    prescription_number: ordo.prescription_number,
    doctor_id: ordo.doctor_id,
    patient_id: ordo.patient_id,
    issue_date: String(ordo.issue_date),
    expiry_date: ordo.expiry_date ? String(ordo.expiry_date) : null,
    contenu_sha256: await empreinteContenu(ordo.medications, ordo.diagnosis, ordo.clinical_notes),
  };

  const verdict = await verifier(aVerifier, ordo.doctor_signature_hmac);
  if (verdict.etat === 'cle_absente') {
    // On ne peut pas conclure. Dire « invalide » accuserait un document
    // peut-etre irreprochable d'un defaut qui est le NOTRE.
    console.error(`[verify-prescription] cle de version ${verdict.version} absente : verification impossible`);
    return refus(req, 503, 'verification_unavailable');
  }
  // 200 et non 4xx : la requete etait bien formee et a ete traitee jusqu'au
  // bout. « Cette ordonnance n'est pas authentique » EST la reponse, pas une
  // erreur de l'appelant. (`not_found` et `not_signed`, eux, decrivent une
  // demande a laquelle on ne peut pas repondre : ils gardent leur code.)
  if (verdict.etat !== 'valide') return refus(req, 200, 'invalid_signature');

  // La signature presentee doit etre celle de cette ordonnance-la. Le
  // recalcul ci-dessus prouve que la ligne n'a pas bouge ; ceci prouve que le
  // porteur tient bien le lien de CE document.
  if (sig.toLowerCase() !== ordo.doctor_signature_hmac.toLowerCase()) {
    return refus(req, 200, 'invalid_signature');
  }

  // ── 4. La reponse, champ par champ. Aucun etalement de la ligne. ─────
  const { data: medecin } = await service
    .from('users').select('first_name, last_name, specialty_fr').eq('id', ordo.doctor_id).maybeSingle();
  const { data: patient } = await service
    .from('users').select('first_name, last_name').eq('id', ordo.patient_id).maybeSingle();

  const annulee = ordo.status === 'cancelled' || !!ordo.cancelled_at;
  const perimee = !!ordo.expiry_date && String(ordo.expiry_date) < new Date().toISOString().slice(0, 10);

  const reponse = {
    valid: !annulee && !perimee,
    expired: !annulee && perimee,
    cancelled: annulee,
    prescription_number: ordo.prescription_number,
    issue_date: String(ordo.issue_date),
    expiry_date: ordo.expiry_date ? String(ordo.expiry_date) : '—',
    status: ordo.status,
    doctor_name: `Dr ${medecin?.first_name ?? ''} ${medecin?.last_name ?? ''}`.trim(),
    doctor_specialty: medecin?.specialty_fr ?? null,
    patient_initials: initiales(patient?.first_name, patient?.last_name),
    // L'empreinte du FICHIER, pour que celui qui detient le PDF puisse la
    // comparer. Ce n'est pas un contenu : c'est un condensat a sens unique.
    pdf_sha256: ordo.pdf_sha256 ?? null,
    signature_key_version: verdict.version,
  };

  const corps = JSON.stringify(reponse);
  const fuite = refuserToutContenuMedical(corps, [ordo.medications, ordo.diagnosis, ordo.clinical_notes]);
  if (fuite) {
    // On n'assainit pas, on n'envoie pas. Une reponse partiellement nettoyee
    // laisserait croire que le garde a fonctionne.
    console.error('[verify-prescription] FUITE EVITEE : un contenu medical figurait dans la reponse. Corriger le code.');
    return refus(req, 500, 'verification_unavailable');
  }

  return new Response(corps, { status: 200, headers: enTetes(req) });
});
