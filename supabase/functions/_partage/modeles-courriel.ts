// supabase/functions/_partage/modeles-courriel.ts
// =====================================================================
// Les messages de validation medecin — composes COTE SERVEUR
// =====================================================================
// ⚠️ POURQUOI LES MODELES SONT ICI, ET PAS DANS LE NAVIGATEUR
//
// `js/tabibi-brevo.js` composait le HTML dans la page et l'envoyait a
// `send-email`. Ecrire la fonction sur ce contrat aurait produit **un relais
// ouvert** : n'importe quel compte connecte aurait pu faire partir n'importe
// quel HTML, vers n'importe quelle adresse, **signe `contact@tabibi.doctor`**.
// C'est la definition d'un outil d'hameconnage, et il aurait porte notre nom
// de domaine.
//
// Le serveur n'accepte donc pas de HTML. Il accepte **un nom de modele et des
// parametres**, et compose lui-meme. Ce qui n'est pas dans cette liste ne
// s'envoie pas.
//
// Les textes sont repris a l'identique de `js/tabibi-brevo.js` (fr/ar/en) :
// meme contenu, meme intention. Ce lot ne reecrit pas les messages, il change
// l'endroit ou ils sont fabriques.
// =====================================================================
import { echapper } from './courriel.ts';

export type Langue = 'fr' | 'ar' | 'en';

export interface Message { subject: string; html: string; text: string }

const MARQUE = '#0F7560';
const SITE = 'https://tabibi.doctor';

const PIED: Record<Langue, { equipe: string; auto: string }> = {
  fr: { equipe: "L'equipe Tabibi", auto: 'Message automatique — merci de ne pas y repondre.' },
  ar: { equipe: 'فريق طبيبي', auto: 'رسالة آلية — يرجى عدم الرد عليها.' },
  en: { equipe: 'The Tabibi team', auto: 'Automated message — please do not reply.' },
};

/** Enveloppe commune, consciente du sens d'ecriture (l'arabe se lit a droite). */
function enveloppe(lang: Langue, titre: string, corps: string, cta?: { texte: string; url: string }): string {
  const rtl = lang === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const police = rtl ? "'Cairo','Tajawal',Arial,sans-serif" : "'Inter','Segoe UI',Arial,sans-serif";
  const bouton = cta
    ? `<p style="text-align:center;margin:28px 0"><a href="${echapper(cta.url)}" style="background:${MARQUE};color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${echapper(cta.texte)}</a></p>`
    : '';
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8f7;font-family:${police}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:${MARQUE};padding:18px 24px;color:#fff;font-size:18px;font-weight:800">Tabibi</td></tr>
<tr><td style="padding:26px 24px;color:#0f172a;font-size:15px;line-height:1.65;direction:${dir};text-align:${rtl ? 'right' : 'left'}">
<h2 style="margin:0 0 14px;font-size:19px;color:#0f172a">${titre}</h2>
${corps}
${bouton}
<p style="margin:24px 0 0;color:#475569">${echapper(PIED[lang].equipe)}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11.5px;text-align:center">${echapper(PIED[lang].auto)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Le meme message, en texte : certains clients n'affichent que celui-la. */
function enTexte(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function langueOu(l: unknown): Langue {
  return (l === 'ar' || l === 'en') ? l : 'fr';
}

// ─────────────────────────────────────────────────────────────────────
// medecin_validated
// ─────────────────────────────────────────────────────────────────────
const VALIDE: Record<Langue, (n: string) => { subject: string; titre: string; corps: string; cta: string }> = {
  fr: (n) => ({
    subject: '✅ Votre compte Tabibi est activé !',
    titre: `Félicitations ${n ? 'Dr ' + n : 'cher Docteur'} !`,
    corps: `<p style="margin:0 0 14px">✅ Votre compte Tabibi est désormais <strong>actif</strong>. Vous pouvez vous connecter et commencer à recevoir des rendez-vous.</p>
<p style="margin:0 0 8px;font-weight:700">🚀 Prochaines étapes :</p>
<ol style="margin:0 0 14px;padding-inline-start:20px"><li>Connectez-vous sur tabibi.doctor</li><li>Complétez votre profil (photo, spécialités, horaires)</li><li>Définissez vos disponibilités</li><li>Recevez vos premiers rendez-vous en ligne !</li></ol>
<p style="margin:0">Bienvenue dans la communauté Tabibi.</p>`,
    cta: 'Accéder à mon espace médecin',
  }),
  ar: (n) => ({
    subject: '✅ تم تفعيل حسابك في طبيبي !',
    titre: `تهانينا ${n ? 'د. ' + n : 'سيدي الطبيب'} !`,
    corps: `<p style="margin:0 0 14px">✅ حسابك في طبيبي أصبح <strong>نشطًا</strong>. يمكنك الآن تسجيل الدخول والبدء في استقبال المواعيد.</p>
<p style="margin:0 0 8px;font-weight:700">🚀 الخطوات التالية :</p>
<ol style="margin:0 0 14px;padding-inline-start:20px"><li>سجّل دخولك على tabibi.doctor</li><li>أكمل ملفك الشخصي (صورة، تخصصات، مواعيد)</li><li>حدد أوقات توفرك</li><li>استقبل أولى مواعيدك عبر الإنترنت !</li></ol>
<p style="margin:0">مرحبًا بك في مجتمع طبيبي.</p>`,
    cta: 'الدخول إلى حسابي',
  }),
  en: (n) => ({
    subject: '✅ Your Tabibi account is active!',
    titre: `Congratulations ${n ? 'Dr ' + n : 'dear Doctor'}!`,
    corps: `<p style="margin:0 0 14px">✅ Your Tabibi account is now <strong>active</strong>. You can sign in and start receiving appointments.</p>
<p style="margin:0 0 8px;font-weight:700">🚀 Next steps:</p>
<ol style="margin:0 0 14px;padding-inline-start:20px"><li>Sign in at tabibi.doctor</li><li>Complete your profile (photo, specialties, schedule)</li><li>Set your availability</li><li>Receive your first online appointments!</li></ol>
<p style="margin:0">Welcome to the Tabibi community.</p>`,
    cta: 'Go to my doctor space',
  }),
};

// ─────────────────────────────────────────────────────────────────────
// medecin_rejected
// ─────────────────────────────────────────────────────────────────────
const REFUSE: Record<Langue, (n: string, r: string) => { subject: string; titre: string; corps: string }> = {
  fr: (n, r) => ({
    subject: 'Concernant votre inscription Tabibi',
    titre: `Bonjour ${n ? 'Dr ' + n : 'cher Docteur'},`,
    corps: `<p style="margin:0 0 14px">Nous avons examiné votre demande d'inscription à Tabibi.</p>
<div style="background:#fdf2f2;border-inline-start:3px solid #D21010;padding:12px 14px;border-radius:8px;margin:0 0 14px">
<p style="margin:0 0 6px;font-weight:700;color:#D21010">Inscription non validée</p>
<p style="margin:0">Raison : ${r}</p></div>
<p style="margin:0 0 14px">Vous pouvez soumettre une nouvelle demande avec les documents complets à <a href="mailto:contact@tabibi.doctor" style="color:${MARQUE}">contact@tabibi.doctor</a>.</p>
<p style="margin:0">Pour toute question, n'hésitez pas à nous contacter.</p>`,
  }),
  ar: (n, r) => ({
    subject: 'بشأن تسجيلك في طبيبي',
    titre: `مرحبًا ${n ? 'د. ' + n : 'سيدي الطبيب'}،`,
    corps: `<p style="margin:0 0 14px">لقد قمنا بمراجعة طلب تسجيلك في طبيبي.</p>
<div style="background:#fdf2f2;border-inline-start:3px solid #D21010;padding:12px 14px;border-radius:8px;margin:0 0 14px">
<p style="margin:0 0 6px;font-weight:700;color:#D21010">لم يتم قبول التسجيل</p>
<p style="margin:0">السبب : ${r}</p></div>
<p style="margin:0 0 14px">يمكنك تقديم طلب جديد مع الوثائق الكاملة إلى <a href="mailto:contact@tabibi.doctor" style="color:${MARQUE}">contact@tabibi.doctor</a>.</p>
<p style="margin:0">لأي استفسار، لا تتردد في الاتصال بنا.</p>`,
  }),
  en: (n, r) => ({
    subject: 'About your Tabibi registration',
    titre: `Hello ${n ? 'Dr ' + n : 'dear Doctor'},`,
    corps: `<p style="margin:0 0 14px">We have reviewed your Tabibi registration request.</p>
<div style="background:#fdf2f2;border-inline-start:3px solid #D21010;padding:12px 14px;border-radius:8px;margin:0 0 14px">
<p style="margin:0 0 6px;font-weight:700;color:#D21010">Registration not approved</p>
<p style="margin:0">Reason: ${r}</p></div>
<p style="margin:0 0 14px">You may submit a new request with complete documents to <a href="mailto:contact@tabibi.doctor" style="color:${MARQUE}">contact@tabibi.doctor</a>.</p>
<p style="margin:0">If you have any question, please contact us.</p>`,
  }),
};

// ─────────────────────────────────────────────────────────────────────
// waiting_list_welcome
// ─────────────────────────────────────────────────────────────────────
// ⚠️ Le compte d'inscrits n'est envoye QUE s'il a ete MESURE. Le 14/09, ce
// modele expediait « 500+ » a une personne reelle alors que la liste etait
// vide : un chiffre fabrique sur une page est deja mauvais ; expedie, il
// devient une affirmation qu'on ne peut plus retirer. Sans compte, la phrase
// change — elle ne se rend pas avec un trou.
const ATTENTE: Record<Langue, (c: string) => { subject: string; titre: string; corps: string; cta: string }> = {
  fr: (c) => ({
    subject: 'Merci ! Vous êtes sur la liste Tabibi 🇩🇿',
    titre: 'Merci de votre intérêt !',
    corps: `<p style="margin:0 0 14px">${c ? `Vous faites désormais partie des <strong>${c}+ Algériens</strong> qui attendent Tabibi.` : 'Vous faites désormais partie des Algériens qui attendent Tabibi.'} 🎉</p>
<p style="margin:0 0 8px;font-weight:700">🚀 Ce qui vous attend :</p>
<ul style="margin:0 0 14px;padding-inline-start:20px"><li>Des médecins près de chez vous</li><li>Un rendez-vous en <strong>30 secondes</strong></li><li>Des rappels SMS et e-mail automatiques</li><li>100 % gratuit pour les patients</li></ul>
<p style="margin:0 0 10px">Nous vous préviendrons par e-mail dès le lancement.</p>
<p style="margin:0;color:#64748b;font-size:13.5px">En attendant, suivez-nous sur Instagram <a href="https://instagram.com/tabibi.dz" style="color:${MARQUE}">@tabibi.dz</a>.</p>`,
    cta: 'Suivre Tabibi sur Instagram',
  }),
  ar: (c) => ({
    subject: 'شكرًا ! أنت في قائمة طبيبي 🇩🇿',
    titre: 'شكرًا على اهتمامك !',
    corps: `<p style="margin:0 0 14px">${c ? `أنت الآن جزء من <strong>${c}+ جزائري</strong> ينتظرون طبيبي.` : 'أنت الآن من بين الجزائريين الذين ينتظرون طبيبي.'} 🎉</p>
<p style="margin:0 0 8px;font-weight:700">🚀 ما ينتظرك :</p>
<ul style="margin:0 0 14px;padding-inline-start:20px"><li>أطباء بالقرب منك</li><li>حجز موعد في <strong>30 ثانية</strong></li><li>تذكيرات SMS وبريد إلكتروني تلقائية</li><li>مجاني 100% للمرضى</li></ul>
<p style="margin:0 0 10px">سنُعلمك بالبريد الإلكتروني عند الإطلاق.</p>
<p style="margin:0;color:#64748b;font-size:13.5px">في انتظار ذلك، تابعنا على Instagram <a href="https://instagram.com/tabibi.dz" style="color:${MARQUE}">@tabibi.dz</a>.</p>`,
    cta: 'متابعة طبيبي على Instagram',
  }),
  en: (c) => ({
    subject: "Thanks! You're on the Tabibi list 🇩🇿",
    titre: 'Thanks for your interest!',
    corps: `<p style="margin:0 0 14px">${c ? `You're now one of <strong>${c}+ Algerians</strong> waiting for Tabibi.` : "You're now among the Algerians waiting for Tabibi."} 🎉</p>
<p style="margin:0 0 8px;font-weight:700">🚀 What awaits you:</p>
<ul style="margin:0 0 14px;padding-inline-start:20px"><li>Doctors near you</li><li>Book in <strong>30 seconds</strong></li><li>Automatic SMS and e-mail reminders</li><li>100% free for patients</li></ul>
<p style="margin:0 0 10px">We'll e-mail you at launch.</p>
<p style="margin:0;color:#64748b;font-size:13.5px">In the meantime, follow us on Instagram <a href="https://instagram.com/tabibi.dz" style="color:${MARQUE}">@tabibi.dz</a>.</p>`,
    cta: 'Follow Tabibi on Instagram',
  }),
};

/**
 * Les SEULS modeles qui existent. Un nom hors de cette liste ne s'envoie pas.
 *
 * ⚠️ `firstName` et `reason` sont ECHAPPES ici, pas chez l'appelant. Ils
 * viennent d'un formulaire d'administration : un motif de refus contenant du
 * balisage partirait tel quel dans la boite du medecin.
 */
export const MODELES = {
  medecin_validated(p: Record<string, unknown>): Message {
    const lang = langueOu(p.lang);
    const t = VALIDE[lang](echapper(p.firstName ?? ''));
    const html = enveloppe(lang, t.titre, t.corps, { texte: t.cta, url: `${SITE}/doctor-dashboard.html` });
    return { subject: t.subject, html, text: enTexte(html) };
  },
  waiting_list_welcome(p: Record<string, unknown>): Message {
    const lang = langueOu(p.lang);
    // Un compte n'est repris que s'il ressemble a un compte. Rien d'autre ne
    // passe : ce champ vient d'une page publique.
    const brut = String(p.count ?? '').trim();
    const compte = /^[\d  \u202f.,]{1,12}$/.test(brut) ? echapper(brut) : '';
    const t = ATTENTE[lang](compte);
    const html = enveloppe(lang, t.titre, t.corps, { texte: t.cta, url: 'https://instagram.com/tabibi.dz' });
    return { subject: t.subject, html, text: enTexte(html) };
  },
  medecin_rejected(p: Record<string, unknown>): Message {
    const lang = langueOu(p.lang);
    const defaut = { fr: 'documents insuffisants ou non conformes', ar: 'وثائق غير كافية أو غير مطابقة', en: 'incomplete or non-compliant documents' }[lang];
    const t = REFUSE[lang](echapper(p.firstName ?? ''), echapper(p.reason || defaut));
    const html = enveloppe(lang, t.titre, t.corps);
    return { subject: t.subject, html, text: enTexte(html) };
  },
} as const;

export type NomModele = keyof typeof MODELES;

export function modeleConnu(nom: unknown): nom is NomModele {
  return typeof nom === 'string' && Object.prototype.hasOwnProperty.call(MODELES, nom);
}
