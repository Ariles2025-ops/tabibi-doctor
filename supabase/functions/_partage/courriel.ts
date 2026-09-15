// supabase/functions/_partage/courriel.ts
// =====================================================================
// L'envoi d'e-mail — la brique que `RESEND_API_KEY` attend depuis le 20/05
// =====================================================================
// `README_APP.md` le dit depuis des mois, et c'est la raison d'etre de ce
// fichier :
//
//   > « secret `RESEND_API_KEY` present depuis le 20/05 ; **l'edge `send-email`
//   >   qui doit l'utiliser n'existe pas** ; les trois parcours qui l'appellent
//   >   affichent « Email envoye » a tort »
//
// Trois ecrans annoncent donc un envoi qui n'a jamais lieu. C'est la meme
// famille que le « 500+ » et le « e-mail envoye » du mot de passe oublie.
// **Ce lot n'en corrige qu'un** — l'invitation medecin — et laisse les trois
// autres ouverts, signales au stratege. Mais la brique, elle, existe enfin.
//
// ⚠️ DEPLOIEMENT : dependance relative, a passer avec chaque `index.ts` qui
// l'importe.
//
// ---------------------------------------------------------------------
// CE QUI EST TESTABLE ICI, ET CE QUI NE L'EST PAS
// ---------------------------------------------------------------------
// `composerInvitationMedecin()` est **pur** : memes entrees, meme sortie,
// aucun reseau. `tests/courriel-invitation.test.mjs` l'execute sous Node.
// `envoyerCourriel()` parle a Resend : elle n'est pas essayee ici, et elle est
// ecrite pour que ca ne soit pas grave — elle ne decide de rien, elle relaie.
// =====================================================================

export interface Courriel {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type Envoi =
  | { ok: true; id: string | null }
  | { ok: false; erreur: string };

/**
 * Envoie via Resend. **La cle ne quitte jamais cette fonction** et n'apparait
 * dans aucun journal : en cas d'echec on rend le statut et le debut du corps
 * de reponse, jamais l'en-tete d'autorisation.
 */
export async function envoyerCourriel(cle: string, de: string, m: Courriel): Promise<Envoi> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    let corps: Record<string, unknown> = {};
    try { corps = await res.json(); } catch { /* reponse non JSON : le statut suffit */ }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, id: typeof corps.id === 'string' ? corps.id : null };
    }
    const detail = typeof corps.message === 'string' ? corps.message : '';
    return { ok: false, erreur: `resend ${res.status}${detail ? ' ' + detail.slice(0, 120) : ''}` };
  } catch (e) {
    return { ok: false, erreur: `reseau: ${(e as Error).message}`.slice(0, 160) };
  }
}

/** Echappe ce qui part dans du HTML. Un nom de medecin vient de la base. */
export function echapper(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export interface InvitationVue {
  nomMedecin: string;
  lien: string;
  expireLe: string;   // ISO
  langue?: string;
}

const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

/** « 28 septembre 2026 » — sans dependance, et lisible par un humain. */
export function dateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Le message d'invitation. **Il ne promet que ce que le lien fait vraiment** :
 * rattacher un compte a une fiche. Pas « votre compte est cree », pas « vous
 * etes verifie ».
 *
 * ⚠️ Le lien porte le jeton. Il n'est donc ni journalise, ni renvoye a
 * l'appelant, ni conserve : il n'existe que dans ce message.
 */
export function composerInvitationMedecin(v: InvitationVue): Omit<Courriel, 'to'> {
  const nom = echapper(v.nomMedecin || 'Docteur');
  const lien = echapper(v.lien);
  const jusqu = dateLisible(v.expireLe);

  const subject = `${v.nomMedecin || 'Docteur'} — votre acces Tabibi.doctor`;

  const text = [
    `Bonjour ${v.nomMedecin || 'Docteur'},`,
    '',
    'Vous etes invite(e) a rejoindre le pilote de Tabibi.doctor.',
    'Ce lien rattache votre compte a votre fiche dans l\'annuaire :',
    '',
    v.lien,
    '',
    jusqu ? `Ce lien est valable jusqu'au ${jusqu}.` : '',
    '',
    "Il vous sera demande de vous connecter avec l'adresse a laquelle ce",
    "message a ete envoye. C'est volontaire : le lien seul ne suffit pas.",
    '',
    "Si vous n'attendiez pas cette invitation, ignorez ce message — rien ne",
    'sera fait sans votre connexion.',
    '',
    'Tabibi.doctor',
  ].filter((l) => l !== null).join('\n');

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid #e2e8f0">
      <p style="margin:0 0 18px;font-size:16px">Bonjour <strong>${nom}</strong>,</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">
        Vous etes invite(e) a rejoindre le pilote de <strong>Tabibi.doctor</strong>.
        Ce lien rattache votre compte a votre fiche dans l'annuaire.
      </p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${lien}" style="display:inline-block;background:#0F7560;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Rattacher ma fiche</a>
      </p>
      ${jusqu ? `<p style="margin:0 0 18px;font-size:13px;color:#556070">Ce lien est valable jusqu'au <strong>${echapper(jusqu)}</strong>.</p>` : ''}
      <p style="margin:0 0 18px;font-size:13px;color:#556070;line-height:1.6">
        Il vous sera demande de vous connecter avec l'adresse a laquelle ce message a ete
        envoye. C'est volontaire : <strong>le lien seul ne suffit pas</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#556070;line-height:1.6">
        Si vous n'attendiez pas cette invitation, ignorez ce message — rien ne sera fait
        sans votre connexion.
      </p>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#556070">Tabibi.doctor</p>
  </div>
</body></html>`;

  return { subject, html, text };
}
