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
| 7 | 2026-09-13 ~11:02 | `088e166c1baef3d541a3d6b83c04ce55f3a0b4dd` | `42ef43df-…` | **fermée** | `66da5afc-a3af-484f-a02f-4ea96a018d75` | Claude, sur go d'Aghiles |
| 6 | 2026-09-13 ~10:31 | `c37f4e0d8b1d10be6a2a60065523d06328cdd191` | `66da5afc-…` | **fermée** | `55c94431-82f8-48df-80fb-dd91a67637f2` | Claude, sur go d'Aghiles |
| 5 | 2026-09-13 ~10:16 | `8c24384ccd511d4bac455ce1e70e5d1ea02dbd7f` | `55c94431-…` | **fermée** | `1c7f727a-b16f-428a-8add-48e064458a39` | Claude, sur go d'Aghiles |
| 4 | 2026-09-13 ~09:19 | `e94ca04263c9b621160111be9c16cd15fbb09881` | `1c7f727a-…` | **fermée** | `eeeeef33-65c9-4204-b2fe-b66735b6aa9c` | Claude, sur go d'Aghiles |
| 3 | 2026-09-13 ~08:58 | `dc133ebd9dc1a7427fc5bce367112d810080335d` | `eeeeef33-…` | **fermée** | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | Claude, sur go d'Aghiles |
| 2 | 2026-09-13 ~01:30 | `5cec711f90f5b982f4b100eb30ff456753ae97a8` | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | **fermée** | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | Claude, sur go d'Aghiles |
| 1 | 2026-08-26 (reconstitué) | `f06aa3d` (PR #51) | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | fermée | — | non consigné à l'époque |

---

## Gabarit — a recopier pour chaque deploiement

### Avant d'envoyer — lignes a cocher

- [ ] **Enum des statuts de rendez-vous.** `SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) node scripts/verifier-statuts.mjs --base` → `Statuts alignes.`, sortie 0. **Si elle echoue, on n'envoie pas.** Jeton local, aucun secret en CI. Pourquoi cette etape vit ici et pas dans un workflow : `docs/VERIFICATION_DEPLOIEMENT_PORTE_FERMEE.md`.
- [ ] Les portes locales passent : `eslint`, `lint:dette`, `i18n:verifier`, `verifier:cles`, `verifier:c1`, `verifier:statuts`, `build`, `test:e2e`.
- [ ] **Parcours permanent « aucun bouton ne ment »** sur `dist-web` : `grep -rnE 'onclick="[^"]*(alert|confirm)\(' dist-web/*.html dist-web/legal/*.html` — zero menteur actif.
- [ ] **Parcours 4, fixture sale** : `npx playwright test tests/e2e/parcours-4-fixture-sale.spec.js --project=desktop` — 3 verts, **captures regardees**, pas seulement le vert du test.
- [ ] Branche de production du projet Pages verifiee (`main`).
- [ ] Etat de la porte decide et applique (`node scripts/porte.mjs fermee|ouverte`).
- [ ] **Les mesures annoncees, chiffrees, ECRITES avant l'envoi.** Une taille se mesure sur ce qui sera **servi**, pas sur ce qui est construit : Cloudflare reecrit les `mailto:` (+316 o constates au deploiement 4).
- [ ] Cible de retour arriere notee — l'identifiant du deploiement actuellement en production.

### Apres l'envoi — sur le domaine reel, cache-bust

- [ ] Les mesures constatees, en face des annoncees. **Toute divergence est expliquee, pas absorbee.**
- [ ] Parcours permanent rejoue **sur le domaine reel** : la production reecrit le HTML servi.
- [ ] Ligne ajoutee au tableau en tete de ce journal.

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

---

## Deploiement 5 — 13/09/2026, le statut de rendez-vous

**Ce qui est parti** : #96 (journal du deploiement 4) et #97 (source unique du statut de
rendez-vous). Premier deploiement conduit avec le gabarit ci-dessus.

### Etape obligatoire, cochee en premier

`node scripts/verifier-statuts.mjs --base` → `Statuts alignes.`, sortie 0, les cinq valeurs de
`appointment_status` dans le meme ordre que l'utilitaire. Jeton local, aucun secret en CI.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` **servi** | 116 268 o | 116 268 o | **116 268 o** |
| `doctor-dashboard` : `const STATUS_MAP =` | 1 | 0 | **0** |
| `doctor-dashboard` : ternaire au vert par defaut | 3 | 0 | **0** |
| `doctor-dashboard` : compteur « Absents » | 0 | 2 | **2** |
| `js/tabibi-statut-rdv.js` | absent | 200 | **200, 4 420 o** |
| boutons menteurs actifs | 0 | 0 | **0** |

**Aucune divergence.** La taille de `accueil-public.html` a ete annoncee a 116 268 o — soit les
115 952 o construits **plus les 316 o de la reecriture Cloudflare** des deux `mailto:`. C'est la
correction directe de l'erreur du deploiement 4, ou la taille du fichier construit avait ete annoncee
telle quelle. La regle tient : une taille annoncee se mesure sur ce qui sera servi.

### Ce que la production ne porte plus

Le ternaire `status==='Confirmed' ? bleu : status==='Pending' ? ambre : **vert**` a disparu des trois
endroits ou il vivait. Un rendez-vous annule, un absent, un statut inconnu ne peuvent plus sortir
verts. `STATUS_MAP`, qui inventait des valeurs capitalisees absentes de l'enum et repliait tout
inconnu sur « En attente », n'est plus servi.

Le tableau de bord medecin sert desormais deux compteurs distincts : « Consultations du mois »
(`completed` seul) et « Absents » (`no_show`). Il comptait jusqu'ici tous les rendez-vous du mois,
annules compris.

### Parcours permanent, sur le domaine reel

Vingt pages, cache-bust : `patient-profile` 1, `doctor-dashboard` 3, zero ailleurs. **Quatre au
total, tous honnetes.** `mes-rdv` et `patient-dashboard` servent bien `tabibiStatutRdv`.

### Parcours 4 avant l'envoi

3 verts, et **les captures regardees** — pas seulement produites. C'est ainsi qu'on avait vu, la
veille, que les quatre cartes gardaient une bordure verte malgre des badges corrects. Cette fois les
bordures sont distinctes : grise pour l'honore, rouge pour l'annule, grise pour l'absent, neutre
hachuree pour l'inconnu.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Il ne contient ni le retrait de `googletagmanager` de la CSP, ni la
suppression du DOM mort : les deux PR attendent une validation.

---

## Deploiement 6 — 13/09/2026, la CSP et le DOM mort

**Ce qui est parti** : #98 (retrait de `googletagmanager` de `script-src`), #99 (suppression du DOM
mort de `patient-dashboard` et du panneau `#tab-stats`, plus la garde `verifier:panneaux`), #100
(journal du deploiement 5). Ces deux premieres changent ce qui est **servi** — la politique et le
DOM — donc elles ne valaient rien tant qu'elles n'etaient pas en ligne.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `script-src` : `googletagmanager` | 1 | 0 | **0** |
| `script-src` : origines `https` | 5 | 4 | **4** |
| `patient-dashboard` : `#tab-book` | 1 | 0 | **0** |
| `patient-dashboard` : `#tab-rdv` | 1 | 0 | **0** |
| `patient-dashboard` : `#book-modal` | 1 | 0 | **0** |
| `openBooking` defini | 2 | 1 | **1** |
| Favoris : cartes `onclick="openBooking` | 2 | 1 | **1** |
| boutons menteurs actifs | 0 | 0 | **0** |

Aucune divergence.

### La mesure qui pouvait casser, prouvee au navigateur sur le domaine reel

Un `grep` sur le HTML servi dit que le DOM mort n'y est plus. Il ne dit **pas** que les Favoris
fonctionnent encore. Or c'est precisement le risque : `openBooking` etait la seule fonction du bloc
supprime a avoir un appelant vivant — le panneau Favoris genere ses cartes avec
`onclick="openBooking(...)"`.

Mesure sur `https://tabibi.doctor`, avec un vrai medecin public mis en favori :

```
FAVORIS : {"cartes":1,
           "onclick":"openBooking('023bbccc-e2ba-45ad-8c9a-8fca85da18fa')",
           "texte":"OD Dr. Ouanza Dental Clinic Dentiste · Adrar 1,500 DA Reserver"}
erreurs : AUCUNE
apres clic ->  /doctor-profile?id=023bbccc-e
```

La chaine tient de bout en bout : la carte rend, le gestionnaire est en place, le clic mene bien a
la fiche du medecin. **Zero `pageerror`.** Les panneaux servis sont `tab-overview`, `tab-docs`,
`tab-favs` — les trois qui ont un declencheur.

### Parcours permanent, sur le domaine reel

Vingt pages, cache-bust : `patient-profile` 1, `doctor-dashboard` 3, zero ailleurs. Quatre au total,
tous honnetes.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Il ne comble pas le manque produit revele par la suppression de
`#tab-stats` : ni les revenus par semaine, ni les types de consultation, ni les modes de paiement ne
sont couverts par `doctor-analytics.html` — mesure du 13/09, carte produit ouverte a part.

---

## Deploiement 7 — 13/09/2026, le fuseau du cabinet

**Ce qui est parti** : #101 (regle de fusion), #102 (journal 6) et #103 (le fuseau du cabinet).

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `secretaire` : `new Date(date+'T'+time)` a l'ECRITURE | 1 | 0 | **0** |
| `secretaire` : `instantDepuisJourEtHeure` | 0 | 1 | **1** |
| `js/tabibi-temps.js` | 404 | 200 | **200, 8 223 o** |
| `doctor-dashboard` : `toISOString().split('T')[0]` | 5 | 0 | **0** |
| boutons menteurs actifs | 4 honnetes | 4 honnetes | **4 honnetes** |

Aucune divergence.

### La mesure du fuseau, sur le domaine reel

Le rendez-vous **reel de la base** — `2026-09-14 08:00:00+00`, soit 09:00 pile heure cabinet — lu
depuis trois navigateurs depayses, sur `https://tabibi.doctor` :

```
UTC              heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
Europe/Paris     heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
Africa/Algiers   heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
```

Depuis UTC, cette page affichait **08:00** avant ce deploiement. Captures :
`docs/preuves/deploiement7-*.png`, regardees.

### L'ecriture, qui est le point le plus grave

`secretaire-dashboard.html` ne sert plus `new Date(date + "T" + time + ":00").toISOString()`.
Depuis Paris, un rendez-vous saisi a 09:00 partait a `07:00Z`, soit **08:00 heure cabinet** : pas un
defaut d'affichage, une **donnee fausse**. Et un instant faux ecrit en base est indiscernable d'un
instant juste — aucun audit posterieur ne peut le retrouver.

La base ne contenait qu'une ligne, correcte. Avec six mois de rendez-vous, ce defaut aurait produit
des degats irreparables et invisibles. C'est pourquoi la garde vit au point d'ecriture, pas a la
lecture (`docs/RECETTE_VAGUE_2026-09.md`).

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base — rien a rattraper, la seule ligne existante est juste. Il ne corrige pas
le fuseau code en dur dans les migrations SQL (`get_available_slots`, la garde de disponibilite, le
trigger de notifications) : le jour ou le fuseau deviendra une colonne, il faudra les deux couches.

