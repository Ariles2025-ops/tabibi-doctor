// =====================================================================
// verifier-video.mjs — le drapeau `video` ne s'ouvre pas sur une CSP fausse
// =====================================================================
// NE LE 14/09/2026, DE DEUX DEFAUTS DE LA MEME JOURNEE.
//
//   • le cron des rappels envoyait `'TA_CLE'` — un espace reserve jamais
//     remplace — depuis 47 jours, et recevait 401 a chaque tir ;
//   • la CSP ne contenait aucune mention de `daily.co` : meme avec une vraie
//     salle, l'iframe de teleconsultation aurait ete bloquee.
//
// Les deux ont la meme forme : **une valeur qu'il fallait penser a remplacer,
// et personne ne l'a fait.** Un commentaire « a remplacer » ne remplace rien.
//
// Cette porte transforme l'espace reserve en ECHEC DE BUILD, mais seulement
// quand il commence a compter — c'est-a-dire le jour ou `video` passe a
// `true`. Tant que le drapeau est ferme, elle rappelle l'etat sans echouer :
// une porte qui crie avant l'heure finit ignoree.
// =====================================================================
import { readFileSync } from 'node:fs';

const ROUGE = (s) => `\x1b[31m${s}\x1b[0m`;
const VERT = (s) => `\x1b[32m${s}\x1b[0m`;
const JAUNE = (s) => `\x1b[33m${s}\x1b[0m`;

const RESERVE = 'VOTRE-DOMAINE.daily.co';
const ENTETES = ['_headers', 'netlify.toml'];

// Ce que l'iframe Daily exige pour seulement s'afficher et se connecter.
// Releve sur la documentation du fournisseur et sur le comportement du SDK
// vendorise (assets/vendor/daily/daily-iframe-0.92.2.js).
const EXIGENCES = [
  ['frame-src', 'https://*.daily.co', "l'iframe elle-meme"],
  ['connect-src', 'https://*.daily.co', 'la signalisation'],
  ['connect-src', 'wss://*.daily.co', 'le canal temps reel'],
  ['media-src', 'blob:', 'les flux locaux'],
];

function drapeauVideo() {
  const src = readFileSync('js/tabibi-features.js', 'utf8');
  // On lit la valeur par defaut, pas un surcharge localStorage : c'est celle
  // qui part en production.
  const m = src.match(/^\s*video:\s*(true|false)\s*,/m);
  if (!m) {
    console.error(ROUGE("Le drapeau `video` est introuvable dans js/tabibi-features.js."));
    process.exit(1);
  }
  return m[1] === 'true';
}

const ouvert = drapeauVideo();
const fautes = [];
const remarques = [];

for (const fichier of ENTETES) {
  let contenu;
  try {
    contenu = readFileSync(fichier, 'utf8');
  } catch {
    fautes.push(`${fichier} : introuvable`);
    continue;
  }

  // La CSP et la Permissions-Policy vivent en double (Cloudflare + Netlify).
  // Une correction faite dans un seul fichier est une correction a moitie
  // faite — et c'est le fichier oublie qui sert en production ce jour-la.
  // On lit la CSP REELLE — la ligne d'en-tete — puis on la decoupe en
  // directives. Chercher « frame-src » au fil du fichier attraperait le
  // commentaire d'a cote, et une porte qui se lit elle-meme ne prouve rien.
  const ligneCsp = contenu.split('\n').find((l) => l.includes('Content-Security-Policy'));
  if (!ligneCsp) {
    fautes.push(`${fichier} : aucune Content-Security-Policy`);
  } else {
    const directives = new Map();
    for (const bout of ligneCsp.split(';')) {
      const mots = bout.trim().replace(/^.*Content-Security-Policy:?\s*=?\s*"?/, '').split(/\s+/);
      const nom = mots.shift();
      if (nom) directives.set(nom, mots);
    }
    for (const [directive, source, pourquoi] of EXIGENCES) {
      const valeurs = directives.get(directive);
      if (!valeurs) {
        fautes.push(`${fichier} : directive ${directive} absente (${pourquoi})`);
      } else if (!valeurs.includes(source)) {
        fautes.push(`${fichier} : ${directive} n'autorise pas ${source} (${pourquoi})`);
      }
    }
  }

  // Permissions-Policy : camera et micro doivent nommer une origine EXACTE.
  // `(self)` seul refuse de deleguer a une iframe d'une autre origine, et ce
  // champ n'accepte aucun joker.
  const pp = contenu.split('\n').find((l) => l.includes('Permissions-Policy'));
  if (!pp) {
    fautes.push(`${fichier} : aucune Permissions-Policy`);
  } else {
    for (const capacite of ['camera', 'microphone']) {
      if (!new RegExp(`${capacite}=\\(self\\s+"https://[^"]+"\\)`).test(pp)) {
        fautes.push(`${fichier} : Permissions-Policy ${capacite} ne delegue a aucune origine — l'iframe n'aura pas ${capacite === 'camera' ? 'la camera' : 'le micro'}`);
      }
    }
  }

  if (contenu.includes(RESERVE)) {
    (ouvert ? fautes : remarques).push(
      `${fichier} : « ${RESERVE} » est encore un espace reserve — a remplacer par la valeur de DAILY_DOMAIN`);
  }
}

console.log(`Controle VIDEO — drapeau \`video\` : ${ouvert ? 'OUVERT' : 'ferme'}`);

if (fautes.length) {
  console.error('');
  for (const f of fautes) console.error(ROUGE('  ✗ ') + f);
  console.error('');
  console.error(ROUGE(ouvert
    ? "Le drapeau `video` est ouvert : ces points ne sont plus theoriques, l'appel echouera."
    : 'La CSP ne permettrait pas la teleconsultation.'));
  process.exit(1);
}

for (const r of remarques) console.log(JAUNE('  ! ') + r);
if (remarques.length) {
  console.log('');
  console.log(JAUNE("  Sans consequence tant que `video` est ferme. Cette porte ECHOUERA le jour de l'ouverture."));
}
console.log('');
console.log(VERT('CSP et Permissions-Policy pretes pour la teleconsultation.'));
