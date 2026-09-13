# Journal des déploiements — tabibi.doctor

Une ligne par déploiement de production, à partir du 13/09/2026. Avant cette date, les déploiements
n'étaient consignés nulle part : c'est ce qui a permis à la production de rester dix-huit jours sur un
état que `main` ne décrivait plus (cf. `PLAN_FUSION.md` §3 quater et `docs/ETAT_PORTE.md`).

Hébergement : **Cloudflare Pages**, projet `tabibi-doctor`, branche de production **`main`**, sans
connexion Git — tous les déploiements sont poussés à la main par `wrangler pages deploy`.

Le **retour arrière n'est pas une commande wrangler** : il se fait au tableau de bord,
Workers & Pages → tabibi-doctor → Deployments → menu `···` du déploiement visé → *Rollback to this
deployment*. Atomique, sans reconstruction.

---

| # | Date (UTC) | Commit déployé | Déploiement Cloudflare | Porte | Retour arrière vers | Lancé par |
|---|---|---|---|---|---|---|
| 4 | 2026-09-13 ~09:19 | `e94ca04263c9b621160111be9c16cd15fbb09881` | `1c7f727a-…` | **fermée** | `eeeeef33-65c9-4204-b2fe-b66735b6aa9c` | Claude, sur go d'Aghiles |
| 3 | 2026-09-13 ~08:58 | `dc133ebd9dc1a7427fc5bce367112d810080335d` | `eeeeef33-…` | **fermée** | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | Claude, sur go d'Aghiles |
| 2 | 2026-09-13 ~01:30 | `5cec711f90f5b982f4b100eb30ff456753ae97a8` | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | **fermée** | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | Claude, sur go d'Aghiles |
| 1 | 2026-08-26 (reconstitué) | `f06aa3d` (PR #51) | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | fermée | — | non consigné à l'époque |

---

## Déploiement 2 — 13/09/2026, la vague de fusion, porte fermée

**Ce qui est parti** : la vague de fusion de #56 (dix-huit PR en trois paquets, plus #76, #77, #78),
plus le mécanisme d'état de porte (#91) et le correctif d'indexation de l'accueil public.

**Pourquoi porte fermée** : la revendication médecin n'existe pas, aucun e-mail transactionnel ne part,
personne ne peut réinitialiser son mot de passe, la conformité 25-11 n'est pas faite. Le lancement
public reste annoncé pour décembre 2026.

### Conditions vérifiées avant l'envoi

| Condition | Constat |
|---|---|
| branche de production du projet Pages | **`main`** — lu dans Settings → General. Un `--branch=main` part donc bien en production, pas en aperçu |
| `accueil-public.html` indexable ? | **oui, et corrigé avant l'envoi** : `index.html` porte `index,follow`, la copie l'héritait. `scripts/porte.mjs` force désormais `noindex,nofollow` sur la copie, et `robots.txt` gagne un `Disallow: /accueil-public.html` |

### Les cinq mesures, annoncées avant, constatées après

| Mesure | Avant | Annoncé | Constaté |
|---|---|---|---|
| taille de `/` | 4 919 o | ~5 004 o | **5 004 o** |
| titre | Bientôt disponible | inchangé | **inchangé** |
| balise `tabibi-porte` | absente | `fermee` | **`fermee`** |
| `/accueil-public.html` | 404 | 200 | **200** |
| `sha256` de `/` | `f37749f8…de469` | doit changer | **`742f7542…2dab4`** |

Aucune divergence.

### Contrôles complémentaires

- **Seize chemins testés**, tous en 200 : l'accueil fermé, l'accueil public, `login`, `signup`,
  `reservation`, les deux tableaux de bord, `mes-rdv`, `about`, `telecharger`, une page légale, `404`,
  `robots.txt`, `sitemap.xml`, `js/home-app.js`, `js/config.js`.
- **Marqueurs de la vague en ligne** : SDK Supabase local sur `login`, `ERR_SLOT_OUTSIDE_HOURS` sur
  `reservation`, `ID-ESPACE` et « DANS l'onglet Agenda » sur le tableau de bord médecin, `_tbCle` dans
  `js/home-app.js`.
- **CSP resserrée** comme prévu : `script-src` ne contient plus ni `cdn.jsdelivr.net` ni
  `cdnjs.cloudflare.com`.
- **Console propre** sur `/`, `login`, `reservation` et `accueil-public` : trois messages
  d'information, `env=production`, **zéro erreur, zéro violation CSP**.
- `accueil-public.html` sert bien les vraies données (59 wilayas, 40 spécialités) tout en portant
  `noindex,nofollow`.

### Ce que ce déploiement ne fait pas

Il ne touche pas à la base. Porte fermée, la page d'entrée est statique : une suspension Supabase ne
casserait pas ce qui est en ligne. C'est ce qui a permis de déployer sans attendre la facture.

---

## Deploiement 4 — 13/09/2026, les boutons honnetes

**Ce qui est parti** : #93 (aucun bouton n'annonce ce qu'il ne fait pas), #94 (vendorisation du SDK
Daily, retrait d'`unpkg.com` de `script-src`), #95 (documentation). Trois fusions locales, chacune
verifiee avant la suivante.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| titre | Bientot disponible | inchange | **inchange** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` | 200 + `noindex,nofollow` | 200 + `noindex,nofollow` | **200 + `noindex,nofollow`** |
| `script-src` contient `unpkg.com` | oui | **non** | **non** |
| boutons menteurs actifs | **6** | **0** | **0** |

### Une divergence, et ce qu'elle apprend

**Taille de `/accueil-public.html` : annoncee 115 952 o, servie 116 268 o. Ecart de 316 octets.**

Ce n'est pas un defaut de deploiement. J'avais annonce la taille du fichier **construit**, alors que
la production sert le fichier **reecrit** : Cloudflare transforme les 2 `href="mailto:"` de la page en
un `__cf_email__` et injecte la balise du decodeur. Verifie : `mailto:` = 2 dans `dist-web`, **0** dans
la page servie ; `__cf_email__` = 0 dans `dist-web`, **1** dans la page servie ; une balise
`email-decode.min.js` en plus.

C'est exactement le piege consigne le matin meme dans `DEPLOY_FRONTEND.md`, section « Reglages cote
hebergeur qui reecrivent le HTML servi » — et je l'ai refait dans l'heure. **Regle qui en decoule :
une taille annoncee doit etre mesuree sur ce qui sera servi, pas sur ce qui est construit.** Pour
toute page contenant un `mailto:`, prevoir l'ecart, ou comparer autre chose que la taille.

### Parcours permanent — zero bouton actif annoncant une action accomplie

Nouveau controle de la fiche de recette, mesure **sur le domaine reel** et pas seulement sur
`dist-web`, precisement parce que la production reecrit le HTML. Vingt pages balayees avec cache-bust :

| Page servie | `onclick` `alert`/`confirm` | Verdict |
|---|---|---|
| `patient-profile` | 1 | honnete — « Module mesures · Bientot disponible » |
| `doctor-dashboard` | 3 | honnetes — adresse du support, et deux vues de detail sur de vraies donnees |
| les dix-huit autres | 0 | — |

**Total : 4, tous honnetes. Zero menteur actif** — contre six avant ce deploiement.

Ce que la production portait encore hier et ne porte plus : les faux compteurs de la cloche admin
(supprimee), « Export CSV en cours... » et « Backup cree » (desactives), « Telechargement de … »
(desactive), « Demande envoyee — reponse sous 30 jours (RGPD) » (desactive, avec porte de sortie),
« Lien copie » (remplace par une vraie copie presse-papiers).

### Les portes de sortie, verifiees en ligne

`patient-profile` sert **2 notes visibles**, **2 liens `tel:+213777169074`**, **2 renvois vers
`legal/rgpd-droits.html`**, et **2 badges SUR DEMANDE**. Le telephone est la parce que `tel:` echappe
a la reecriture Cloudflare, contrairement au `mailto:` : c'est le seul element de la note qui reste
lisible si le decodeur ne s'execute pas. `doctor-profile` sert bien `clipboard.writeText`.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Porte fermee, la page d'entree reste statique.

---

## Déploiement 3 — 13/09/2026, #72 (suppression de compte par canal humain)

**Ce qui est parti** : la fusion de #72, restée ouverte pendant toute la vague. `medecin-profile.html`
portait encore deux boutons **actifs** — un `alert()` annonçant une mise en pause inexistante, et un
`confirm()` de suppression définitive qui ne supprimait rien. Ils étaient en production depuis toujours,
y compris après le déploiement 2.

### Les mesures

| Mesure | Avant | Annoncé | Constaté |
|---|---|---|---|
| taille de `/` | 5 004 o | inchangée | **5 004 o** |
| titre | Bientôt disponible | inchangé | **inchangé** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` | 200 + `noindex,nofollow` | inchangé | **200 + `noindex,nofollow`** |
| `medecin-profile.html`, boutons menteurs | **2** | **0** | **0** |

**Le `sha256` de `/` change à chaque déploiement même quand rien ne bouge** : la balise de porte
contient un `data-genere` horodaté. C'est voulu pour dater l'état en ligne, mais cela rend la
comparaison d'empreintes inutilisable pour détecter un vrai changement. La taille, elle, reste stable.

### Contrôle ajouté — les boutons qui annoncent au lieu d'agir

Une console propre ne détecte pas un bouton qui ment : il faut le chercher dans le HTML servi.
Audit sur 53 pages du dépôt, puis vérification sur le domaine réel.

| Page servie | Boutons `alert`/`confirm` |
|---|---|
| `patient-profile.html` | 3 |
| `admin-dashboard.html` | 3 |
| `doctor-dashboard.html` | 3 |
| `patient-dashboard.html` | 1 |
| `doctor-profile.html` | 1 |
| `medecin-profile.html` | **0** — corrigé par #72 |
| `index.html`, `accueil-public`, `secretaire-dashboard`, `mes-rdv`, `reservation`, `login`, `signup` | 0 |

Onze boutons au total. **Six affirment une action qui n'a pas lieu.** Aucun n'est une regression :
tous precedent la vague, et **aucun n'est corrige par ce deploiement** — les six sont actifs en
production au 13/09/2026 (aucun ne porte `disabled`).

| # | Fichier:ligne | Ce que le bouton annonce | Ce qu'il fait reellement |
|---|---|---|---|
| 1 | `admin-dashboard.html:39` | « 3 alertes admin · 7 medecins en attente · 5 signalements » | rien. Les trois nombres sont ecrits en dur ; la cle i18n s'appelle litteralement `alert_admin_notif_demo`. Des chiffres inventes presentes comme un etat reel. |
| 2 | `admin-dashboard.html:141` | « Export CSV en cours... » | rien. Aucune requete, aucun fichier. |
| 3 | `admin-dashboard.html:142` | « Backup cree » | rien. **Le plus grave des trois** : passe compose, il affirme une sauvegarde accomplie. |
| 4 | `patient-dashboard.html:853` | « Telechargement de \<nom du document\> » | rien. Aucun telechargement ne demarre. |
| 5 | `patient-profile.html:248` | « Demande envoyee — reponse sous 30 jours (RGPD) » | rien. **Le plus grave de tous** : le patient croit avoir exerce un droit legal. Rien n'est envoye, personne n'est saisi, le delai de 30 jours ne court pas. |
| 6 | `doctor-profile.html:60` | « Lien copie » (repli quand `navigator.share` est absent) | rien n'est ecrit dans le presse-papiers. Sur desktop, ou `navigator.share` n'existe pas, c'est le cas par defaut. |

Les cinq autres ne mentent pas et n'ont pas a etre touches : `patient-profile.html:99`
(« Module mesures · Bientot disponible ») annonce honnetement une absence ; `doctor-dashboard.html:182`
affiche l'adresse du support ; `doctor-dashboard.html:716` et `:883` affichent de vraies donnees de la
ligne cliquee (vue de detail du pauvre). Cas limite a part : `patient-profile.html:111` renvoie en
popup son propre libelle (« Prendre RDV vaccination ») — il n'affirme rien de faux, mais c'est un
bouton mort sans indication. A trancher avec les six autres.

---

### Piege de mesure — l'obfuscation d'e-mail de Cloudflare

Verification demandee le 13/09 : `contact@tabibi.doctor` est-il present sur `medecin-profile` en
production ? Un `grep` sur le HTML servi renvoie **0**. La conclusion evidente — « le medecin n'a
aucune porte de sortie indiquee » — est fausse.

Cloudflare a **Email Address Obfuscation** actif. Tout `href="mailto:…"` est reecrit dans la reponse :

    <a href="/cdn-cgi/l/email-protection#e5868a8b91848691a5…">
      <span class="__cf_email__" data-cfemail="781b17160c191b0c380c191a111a11561c171b0c170a">[email&#160;protected]</span></a>

Decodage (1er octet = cle, XOR sur les suivants) : **`contact@tabibi.doctor`**. Le decodeur
`/cdn-cgi/scripts/…/email-decode.min.js` est servi par la meme origine (HTTP 200, 1 239 o), donc
autorise par `'self'` sans elargir la CSP.

Trois consequences a retenir :

1. **Chercher une adresse e-mail par `grep` sur le HTML servi ne prouve rien.** Il faut decoder
   `data-cfemail`, ou mesurer le rendu apres execution du JS.
2. **`patient-profile` echappe a la reecriture parce qu'il n'utilise pas de lien.** Son adresse est
   dans un attribut `title` (survol seulement — invisible au doigt sur mobile) et dans une chaine JS
   d'un bouton desactive, donc inatteignable. Sa porte de sortie est en realite **plus faible** que
   celle de `medecin-profile`, qui porte une note visible sous les deux boutons.
3. **Le repli sans JS reste mauvais** : le medecin lit alors « [email protected] », inutilisable. Mais
   la meme note renvoie vers `legal/rgpd-droits.html` (HTTP 200), qui donne la procedure complete et
   le **telephone en clair** `+213 777 16 90 74` — non obfusque, lui. La porte de sortie survit donc
   a une panne de JS, par le telephone.

A decider : uniformiser les deux pages sur le modele visible de `medecin-profile`, et rendre le
telephone present des la page de profil plutot qu'a un clic de distance.
