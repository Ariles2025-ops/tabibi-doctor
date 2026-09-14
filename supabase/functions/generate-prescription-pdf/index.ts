// supabase/functions/generate-prescription-pdf/index.ts
// =====================================================================
// La seule chose au monde qui fait passer une ordonnance de `draft` a `signed`
// =====================================================================
// ⚠️  ETAT : **ECRITE, NON DEPLOYEE.** Le drapeau `prescriptions` reste a
// `false` tant que cette fonction n'est pas deployee ET essayee. Sinon le
// bouton « Signer » annonce ce qu'il ne fait pas — la classe de defauts de la
// semaine.
//
// ---------------------------------------------------------------------
// DEPLOIEMENT — deux fichiers, pas un
// ---------------------------------------------------------------------
//   entrypoint : index.ts
//   dependance : ../_partage/signature-ordonnance.ts
// `supabase functions deploy generate-prescription-pdf` embarque les deux.
// Par MCP, passer les DEUX dans `files`. Sans le second, la fonction ne
// demarre pas.
//
// `verify_jwt` : **true** (le defaut). L'appelant est un medecin connecte.
//
// ---------------------------------------------------------------------
// LE CONTRAT, RELEVE DANS LE FRONT — je m'y conforme, je ne le redefinis pas
// ---------------------------------------------------------------------
// `medecin-ordonnance.html:564-580` fait deja, dans cet ordre :
//   1. `rpc('request_prescription_signature', { p_prescription_id })` — le verrou amont
//   2. `POST /functions/v1/generate-prescription-pdf`
//      en-tetes : Authorization: Bearer <access_token> · apikey · Content-Type
//      corps    : { prescription_id }
//   3. attend : `{ success: true, prescription_number, pdf_url_signed_24h,
//                  verify_url, pdf_sha256 }`
//      et sur echec : un `payload.error` affiche tel quel a l'ecran.
//
// **Le front n'a donc pas a changer.** Les codes d'erreur ci-dessous sont
// ecrits pour rester lisibles s'ils s'affichent.
//
// ⚠️  `request_prescription_signature` VALIDE, elle ne reserve rien : elle
// rend `void` et ne pose aucun etat. Ce n'est pas un verrou — c'est un
// controle amont. **L'unicite de la transition se joue ici, pas la-bas.**
//
// ---------------------------------------------------------------------
// L'ORDRE DES GESTES, ET POURQUOI IL EST CELUI-CI
// ---------------------------------------------------------------------
//     lire la base -> empreinte du CONTENU -> signer -> fabriquer le PDF
//     -> empreinte du FICHIER -> deposer -> UN SEUL UPDATE conditionnel
//
// La signature vient AVANT le PDF parce que le PDF imprime l'URL de
// verification, qui contient la signature. L'inverse etait circulaire ; c'est
// explique dans `_partage/signature-ordonnance.ts`, et c'est la seule raison
// pour laquelle la chaine signee couvre le contenu medical plutot que le
// fichier. Le dispositif y gagne : **une modification du traitement en base
// casse la signature, sans que la verification publique lise le traitement.**
//
// La contrainte `presc_signed_has_pdf` exige que `pdf_sha256`,
// `doctor_signature_hmac` et `pdf_storage_path` soient TOUS presents a
// l'instant ou `status` devient `signed`. On ne peut donc pas « reserver »
// l'ordonnance avant d'avoir le PDF : le dernier geste est un **echange
// conditionnel** —
//     UPDATE … WHERE id = … AND status = 'draft'
// Si deux clics partent ensemble, un seul gagne ; le perdant ne trouve aucune
// ligne et rend `already_signed`. C'est la base qui arbitre, pas nous.
//
// **Le PDF est deterministe**, et c'est ce qui rend le depot anodin : meme
// ordonnance, memes octets, meme empreinte. Deux appels concurrents ecrivent
// le meme contenu au meme chemin. D'ou : aucune date de generation dans le
// document, et des dates de metadonnees forcees a la date d'emission.
//
// ---------------------------------------------------------------------
// CE QUE CETTE FONCTION REFUSE DE FAIRE
// ---------------------------------------------------------------------
// - **Elle ne fait confiance a rien de ce que le client envoie**, sauf
//   l'identifiant de l'ordonnance. Medicaments, dates, numero : tout est relu
//   en base. Un PDF fabrique depuis le corps de la requete serait un PDF
//   dicte par le navigateur.
// - **Elle ne signe pas sans cle.** Pas de repli, pas de signature « vide ».
// - **Elle ne rend jamais la cle, ni un extrait, ni sa longueur** (regles 4
//   et 6). Quand elle manque, la reponse dit `signing_key_missing` et le
//   journal nomme la VARIABLE, jamais la valeur.
// - **Elle n'imprime pas ce qu'elle ne sait pas rendre.** Voir ci-dessous.
//
// ---------------------------------------------------------------------
// ⚠️  LIMITE CONNUE ET ASSUMEE : L'ECRITURE ARABE
// ---------------------------------------------------------------------
// Les 14 polices standard du format PDF (ici Helvetica) sont limitees au
// codage WinAnsi — **latin uniquement**. Un nom de medicament, un diagnostic
// ou un nom de medecin en arabe n'y a aucun glyphe.
//
// Deux conduites possibles. Celle que je n'ai PAS prise : remplacer les
// caracteres inconnus par `?`. Sur une ordonnance, mutiler un nom de
// medicament en silence est un defaut de securite du patient, pas un defaut
// d'affichage.
//
// Celle que j'ai prise : **refuser la signature** avec
// `unsupported_characters`, en nommant le champ fautif. Le medecin voit
// pourquoi, et rien de faux n'est produit.
//
// **C'est une limite produit reelle en Algerie, et elle se decide** :
// embarquer une police Unicode (Noto Naskh Arabic, licence OFL, ~300 Ko dans
// le depot) avec `@pdf-lib/fontkit`, plus le rendu droite-a-gauche. C'est un
// lot a soi. Porte dans `docs/A_FAIRE_AGHILES.md`.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import {
  CleIndisponible,
  empreinteContenu,
  nomVariableCle,
  signer,
  versionCourante,
  type OrdonnanceSignable,
} from '../_partage/signature-ordonnance.ts';

const BUCKET = 'prescriptions';
const VALIDITE_LIEN_SECONDES = 24 * 60 * 60;

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function echec(req: Request, statut: number, code: string, detail?: string): Response {
  const corps: Record<string, unknown> = { success: false, error: code };
  if (detail) corps.detail = detail;
  return new Response(JSON.stringify(corps), { status: statut, headers: enTetes(req) });
}

// ─────────────────────────────────────────────────────────────────────
// Ce que la police standard sait rendre
// ─────────────────────────────────────────────────────────────────────
// On teste par l'ensemble des points de code, pas par une liste de langues :
// c'est le rendu qui decide, pas notre idee de ce qu'un medecin ecrit.
// WinAnsi = Latin-1 (0x20-0xFF) plus ces signes typographiques.
const TYPOGRAPHIQUES = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function caracteresNonRendables(texte: string): string[] {
  const trouves = new Set<string>();
  for (const c of texte) {
    const p = c.codePointAt(0)!;
    if (p === 0x0a || p === 0x0d || p === 0x09) continue;
    if (p >= 0x20 && p <= 0xff) continue;
    if (TYPOGRAPHIQUES.has(p)) continue;
    trouves.add(c);
  }
  return [...trouves];
}

/** Leve si un champ destine au PDF contient un caractere non rendable. */
function exigerRendable(champ: string, texte: string | null | undefined): string {
  const t = (texte ?? '').toString();
  const mauvais = caracteresNonRendables(t);
  if (mauvais.length) {
    const e = new Error(`champ « ${champ} » : ${mauvais.slice(0, 8).join(' ')}`);
    e.name = 'NonRendable';
    throw e;
  }
  return t;
}

// ─────────────────────────────────────────────────────────────────────
// Le PDF
// ─────────────────────────────────────────────────────────────────────
interface Medicament {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  notes?: string | null;
}

interface DonneesPdf {
  numero: string;
  dateEmission: string;
  datePeremption: string | null;
  medecin: string;
  specialite: string;
  patient: string;
  diagnostic: string;
  notes: string;
  medicaments: Medicament[];
  urlVerification: string;
}

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 56;
const OR = rgb(0.831, 0.643, 0.216);    // #d4a437, l'or de la marque
const GRIS = rgb(0.333, 0.376, 0.439);  // #556070, le gris de la marque
const NOIR = rgb(0.1, 0.1, 0.1);

/** Coupe un texte a la largeur disponible, sans jamais couper un mot en deux. */
function enLignes(
  texte: string,
  police: { widthOfTextAtSize(t: string, s: number): number },
  taille: number,
  largeur: number,
): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split(/\r?\n/)) {
    let courante = '';
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur) {
        courante = essai;
      } else {
        if (courante) lignes.push(courante);
        courante = mot;
      }
    }
    lignes.push(courante);
  }
  return lignes;
}

async function fabriquerPdf(d: DonneesPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  // DETERMINISME : pdf-lib date les metadonnees a `now()` par defaut, ce qui
  // donnerait une empreinte differente a chaque appel. On fige tout sur la
  // date d'emission — meme ordonnance, memes octets.
  const figee = new Date(`${d.dateEmission}T00:00:00Z`);
  doc.setCreationDate(figee);
  doc.setModificationDate(figee);
  doc.setProducer('Tabibi.doctor');
  doc.setCreator('Tabibi.doctor');
  doc.setTitle(`Ordonnance ${d.numero}`);

  const page = doc.addPage([A4.largeur, A4.hauteur]);
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);
  const italique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const largeur = A4.largeur - 2 * MARGE;

  let y = A4.hauteur - MARGE;
  const ecrire = (t: string, taille: number, police = normale, couleur = NOIR, decalage = 0) => {
    page.drawText(t, { x: MARGE + decalage, y, size: taille, font: police, color: couleur });
    y -= taille + 4;
  };
  const trait = () => {
    y -= 4;
    page.drawLine({ start: { x: MARGE, y }, end: { x: MARGE + largeur, y }, thickness: 0.7, color: OR });
    y -= 12;
  };

  ecrire('ORDONNANCE MEDICALE', 18, grasse, NOIR);
  ecrire(d.medecin, 12, grasse, GRIS);
  if (d.specialite) ecrire(d.specialite, 10, normale, GRIS);
  trait();

  ecrire(`Numero : ${d.numero}`, 10, normale, GRIS);
  ecrire(`Date d'emission : ${d.dateEmission}`, 10, normale, GRIS);
  if (d.datePeremption) ecrire(`Valable jusqu'au : ${d.datePeremption}`, 10, normale, GRIS);
  y -= 6;
  ecrire(`Patient : ${d.patient}`, 12, grasse, NOIR);
  trait();

  if (d.diagnostic) {
    ecrire('Diagnostic', 11, grasse, GRIS);
    for (const l of enLignes(d.diagnostic, normale, 10, largeur)) ecrire(l, 10);
    y -= 6;
  }

  ecrire('Traitement', 11, grasse, GRIS);
  y -= 2;
  d.medicaments.forEach((m, i) => {
    ecrire(`${i + 1}. ${m.name}`, 11, grasse, NOIR);
    const details = [m.dosage, m.frequency, m.duration].filter(Boolean).join(' — ');
    if (details) ecrire(details, 10, normale, GRIS, 14);
    if (m.notes) for (const l of enLignes(m.notes, italique, 9, largeur - 14)) ecrire(l, 9, italique, GRIS, 14);
    y -= 4;
  });

  if (d.notes) {
    y -= 4;
    ecrire('Remarques', 11, grasse, GRIS);
    for (const l of enLignes(d.notes, normale, 10, largeur)) ecrire(l, 10);
  }

  // Pied : ce que le document est, et ce qu'il n'est pas. L'URL porte la
  // signature : c'est elle qui rend la verification possible sans nous
  // telephoner.
  const bas = MARGE + 42;
  page.drawLine({ start: { x: MARGE, y: bas + 30 }, end: { x: MARGE + largeur, y: bas + 30 }, thickness: 0.7, color: OR });
  const pied = [
    'Document genere et signe electroniquement par Tabibi.doctor.',
    "La signature atteste que ce document n'a pas ete modifie depuis son emission.",
    "Elle ne vaut pas signature electronique qualifiee.",
    `Verification : ${d.urlVerification}`,
  ];
  pied.forEach((t, i) => {
    page.drawText(t, { x: MARGE, y: bas + 16 - i * 10, size: 7.5, font: normale, color: GRIS });
  });

  return await doc.save({ useObjectStreams: false });
}

function hexSha256(octets: ArrayBuffer): string {
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: enTetes(req) });
  if (req.method !== 'POST') return echec(req, 405, 'method_not_allowed');

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!urlSupabase || !cleService || !cleAnon) {
    console.error('[generate-prescription-pdf] configuration Supabase incomplete');
    return echec(req, 500, 'server_misconfigured');
  }

  // La cle de signature est verifiee AVANT tout travail : inutile de fabriquer
  // un PDF qu'on ne pourra pas signer, et le medecin doit le savoir tout de suite.
  try {
    versionCourante();
  } catch (e) {
    const v = e instanceof CleIndisponible ? e.version : '(inconnue)';
    console.error(`[generate-prescription-pdf] version de cle de signature absente ou invalide : ${v}`);
    return echec(req, 500, 'signing_key_missing');
  }

  // ── 1. Qui appelle ? ────────────────────────────────────────────────
  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation.toLowerCase().startsWith('bearer ')) return echec(req, 401, 'not_authenticated');

  const clientAppelant = createClient(urlSupabase, cleAnon, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: errUser } = await clientAppelant.auth.getUser();
  if (errUser || !user) return echec(req, 401, 'not_authenticated');

  // ── 2. Quelle ordonnance ? ──────────────────────────────────────────
  let idOrdonnance = '';
  try {
    const corps = await req.json();
    idOrdonnance = typeof corps?.prescription_id === 'string' ? corps.prescription_id.trim() : '';
  } catch {
    // Corps illisible : `idOrdonnance` reste vide et on tombe dans le refus
    // ci-dessous. Ce `catch` n'est pas muet — il a une suite, juste apres.
    idOrdonnance = '';
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrdonnance)) {
    return echec(req, 400, 'invalid_params');
  }

  const service = createClient(urlSupabase, cleService, { auth: { persistSession: false } });

  // ── 3. On relit TOUT en base. Rien du corps de la requete n'entre au PDF. ──
  const { data: ordo, error: errOrdo } = await service
    .from('prescriptions')
    .select('id, prescription_number, doctor_id, patient_id, issue_date, expiry_date, status, medications, diagnosis, clinical_notes')
    .eq('id', idOrdonnance)
    .maybeSingle();
  if (errOrdo) {
    console.error('[generate-prescription-pdf] lecture ordonnance :', errOrdo.message);
    return echec(req, 500, 'server_error');
  }
  if (!ordo) return echec(req, 404, 'not_found');

  // Proprietaire d'abord : un non-proprietaire n'apprend meme pas l'etat du document.
  if (ordo.doctor_id !== user.id) return echec(req, 403, 'not_owner');
  if (ordo.status === 'signed' || ordo.status === 'delivered') return echec(req, 409, 'already_signed');
  if (ordo.status !== 'draft') return echec(req, 409, 'not_signable');

  const medicaments = Array.isArray(ordo.medications) ? (ordo.medications as Medicament[]) : [];
  if (medicaments.length === 0) return echec(req, 400, 'invalid_medications');

  // ── 4. Le medecin a-t-il le droit de prescrire ? ────────────────────
  // `medecin-ordonnance.html` desactive le bouton quand `is_verified` est faux.
  // **Un bouton desactive n'est pas une garde** : on le revalide ici.
  const { data: medecin, error: errMed } = await service
    .from('users')
    .select('first_name, last_name, specialty_fr, role, is_verified')
    .eq('id', ordo.doctor_id)
    .maybeSingle();
  if (errMed || !medecin) {
    console.error('[generate-prescription-pdf] profil medecin introuvable');
    return echec(req, 500, 'server_error');
  }
  if (medecin.role !== 'medecin' && medecin.role !== 'doctor') return echec(req, 403, 'not_a_doctor');
  if (!medecin.is_verified) return echec(req, 403, 'doctor_not_verified');

  const { data: patient, error: errPat } = await service
    .from('users').select('first_name, last_name').eq('id', ordo.patient_id).maybeSingle();
  if (errPat) {
    console.error('[generate-prescription-pdf] lecture patient :', errPat.message);
    return echec(req, 500, 'server_error');
  }

  // ── 5. Signer AVANT de fabriquer — le PDF imprime l'URL qui la contient ──
  const aSigner: OrdonnanceSignable = {
    id: ordo.id,
    prescription_number: ordo.prescription_number,
    doctor_id: ordo.doctor_id,
    patient_id: ordo.patient_id,
    issue_date: String(ordo.issue_date),
    expiry_date: ordo.expiry_date ? String(ordo.expiry_date) : null,
    contenu_sha256: await empreinteContenu(ordo.medications, ordo.diagnosis, ordo.clinical_notes),
  };

  let signature: string;
  try {
    signature = await signer(aSigner);
  } catch (e) {
    if (e instanceof CleIndisponible) {
      console.error(`[generate-prescription-pdf] ${nomVariableCle(e.version)} absente ou trop courte`);
      return echec(req, 500, 'signing_key_missing');
    }
    throw e;
  }

  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://tabibi.doctor').replace(/\/+$/, '');
  // Sans `.html` : Cloudflare Pages redirige 308 la forme avec extension. Un
  // document imprime ne doit pas embarquer une redirection.
  const urlVerification = `${siteUrl}/verify-prescription?id=${ordo.id}&sig=${encodeURIComponent(signature)}`;

  // ── 6. Tout ce qui ira au PDF doit etre rendable ────────────────────
  let donnees: DonneesPdf;
  try {
    donnees = {
      numero: exigerRendable('numero', ordo.prescription_number),
      dateEmission: String(ordo.issue_date),
      datePeremption: ordo.expiry_date ? String(ordo.expiry_date) : null,
      medecin: exigerRendable('medecin', `Dr ${medecin.first_name ?? ''} ${medecin.last_name ?? ''}`.trim()),
      specialite: exigerRendable('specialite', medecin.specialty_fr ?? ''),
      patient: exigerRendable('patient', `${patient?.first_name ?? ''} ${patient?.last_name ?? ''}`.trim() || '-'),
      diagnostic: exigerRendable('diagnostic', ordo.diagnosis ?? ''),
      notes: exigerRendable('remarques', ordo.clinical_notes ?? ''),
      medicaments: medicaments.map((m, i) => ({
        name: exigerRendable(`medicament ${i + 1}`, m.name),
        dosage: exigerRendable(`medicament ${i + 1} (dosage)`, m.dosage),
        frequency: exigerRendable(`medicament ${i + 1} (frequence)`, m.frequency),
        duration: exigerRendable(`medicament ${i + 1} (duree)`, m.duration),
        notes: exigerRendable(`medicament ${i + 1} (note)`, m.notes),
      })),
      urlVerification,
    };
  } catch (e) {
    if (e instanceof Error && e.name === 'NonRendable') {
      // Le detail nomme le champ et les caracteres — rien au-dela de ce que le
      // medecin vient lui-meme de saisir a l'ecran.
      return echec(req, 422, 'unsupported_characters', e.message);
    }
    throw e;
  }

  // ── 7. Le PDF, puis son empreinte ───────────────────────────────────
  let octets: Uint8Array;
  try {
    octets = await fabriquerPdf(donnees);
  } catch (e) {
    console.error('[generate-prescription-pdf] fabrication du PDF :', e instanceof Error ? e.message : String(e));
    return echec(req, 500, 'pdf_generation_failed');
  }
  const pdfSha256 = hexSha256(await crypto.subtle.digest('SHA-256', octets));

  // ── 8. Depot au bucket prive ────────────────────────────────────────
  const chemin = `${ordo.doctor_id}/${ordo.id}.pdf`;
  const { error: errDepot } = await service.storage.from(BUCKET).upload(chemin, octets, {
    contentType: 'application/pdf',
    // `upsert` est sans danger ici PARCE QUE le PDF est deterministe et qu'on a
    // refuse plus haut toute ordonnance qui n'est pas `draft` : les octets
    // reecrits sont les memes. Voir l'en-tete.
    upsert: true,
  });
  if (errDepot) {
    console.error('[generate-prescription-pdf] depot au bucket :', errDepot.message);
    return echec(req, 500, 'pdf_upload_failed');
  }

  // ── 9. LA transition, en un seul echange conditionnel ───────────────
  const { data: majs, error: errMaj } = await service
    .from('prescriptions')
    .update({
      status: 'signed',
      pdf_storage_path: chemin,
      pdf_sha256: pdfSha256,
      pdf_size_bytes: octets.byteLength,
      doctor_signature_hmac: signature,
    })
    .eq('id', ordo.id)
    .eq('status', 'draft')      // ← l'arbitrage : la base tranche, pas nous
    .select('id');
  if (errMaj) {
    console.error('[generate-prescription-pdf] passage a signed :', errMaj.message);
    return echec(req, 500, 'sign_failed');
  }
  if (!majs || majs.length === 0) {
    // Personne n'a perdu de donnee : le PDF depose est identique a celui du
    // gagnant. On le dit au medecin plutot que d'annoncer une seconde signature.
    return echec(req, 409, 'already_signed');
  }

  // ── 10. Lien de telechargement, valable 24 h ────────────────────────
  const { data: lien, error: errLien } = await service.storage
    .from(BUCKET).createSignedUrl(chemin, VALIDITE_LIEN_SECONDES);
  if (errLien || !lien?.signedUrl) {
    // L'ordonnance EST signee. Ne pas transformer un lien manquant en echec de
    // signature : ce serait demander au medecin de recommencer une chose faite.
    console.error('[generate-prescription-pdf] lien signe :', errLien?.message ?? 'vide');
  }

  return new Response(JSON.stringify({
    success: true,
    prescription_number: ordo.prescription_number,
    pdf_sha256: pdfSha256,
    pdf_url_signed_24h: lien?.signedUrl ?? null,
    verify_url: urlVerification,
  }), { status: 200, headers: enTetes(req) });
});
