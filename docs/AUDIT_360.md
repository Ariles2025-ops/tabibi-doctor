# Audit 360 — chaque page, chaque bouton : le fil est-il branché ?

**15/09/2026.** Audit **statique** : le code est lu, rien n'est cliqué.
Outil : `node scripts/audit-360.mjs` — versionné, rejouable, et **contre-éprouvé**.

> ## ⚠️ Ce que ce rapport peut dire, et ce qu'il ne peut pas
>
> Il peut dire **« ce bouton appelle une fonction qui n'existe nulle part »** : c'est un fait
> vérifiable. Il ne peut pas dire **« ce bouton marche »** — une fonction qui existe peut se
> tromper, une RPC qui existe peut refuser, un écran qui s'affiche peut mentir.
>
> **Un audit statique borne le problème par le bas.** Ce qu'il trouve est réellement cassé ;
> ce qu'il ne trouve pas n'est pas pour autant sain. L'audit **live** du stratège et les
> essais réels (P-31) restent la seule preuve que le produit fonctionne.

---

## Le résumé, en chiffres mesurés

| mesure | valeur |
|---|---|
| pages inventoriées | **73** (dont **35** sans aucun élément interactif : pages de contenu, légal, blog) |
| éléments interactifs (`onclick`/`onsubmit`/`onchange`/…) | **357** |
| **gestionnaires morts** (handler appelé, défini nulle part) | **0** |
| liens internes | **249**, dont **8 cassés** |
| déréférencements sans filet (`getElementById('x').…`, `id` absent) | **3** |
| RPC appelées par le front | **46**, dont **5 hors référence** — *toutes existent en base, c'est la référence qui est périmée* |
| fonctions edge appelées | **4**, dont **1 sans code** |

### Le classement

| | nombre | |
|---|---|---|
| 🔴 **bloquant** | **2** | un parcours qui ne peut pas aboutir, ou qui ment à l'utilisateur |
| 🟠 **important** | **4** | casse dans un cas réaliste, ou trompe le lecteur du code |
| 🟡 **cosmétique** | **3** | gêne sans empêcher |

**Zéro bouton mort sur 357.** C'est le résultat le plus important de cet audit, et il a
demandé de corriger l'outil quatre fois avant d'être vrai — voir « Ce que l'outil s'est
trompé à croire ».

---

# 🔴 BLOQUANT

## 🔴-1 · `send-email` est appelée, et **n'existe pas**

| | |
|---|---|
| **où** | `js/tabibi-brevo.js:619` — `functions.invoke('send-email', …)` |
| **pages touchées** | `login.html`, `signup.html`, `admin-dashboard.html`, `admin-doctor-validation.html`, plus tout ce que charge `src/entries/index.js` |
| **fait** | `supabase/functions/` contient 11 fonctions. **`send-email` n'en fait pas partie.** L'appel part vers un 404 |
| **ce que voit l'utilisateur** | selon l'appelant : « E-mail envoyé » alors que rien n'est parti |
| **correctif proposé** | soit écrire la fonction (la brique existe : `_partage/courriel.ts`, utilisée par `invite-doctor`), soit **retirer l'appel et le message qui l'accompagne**. Les deux sont acceptables ; laisser un bouton qui promet un envoi ne l'est pas |
| **garde à poser avec le correctif** | une porte qui compare les `functions.invoke('x')` du front aux répertoires de `supabase/functions/` — c'est déjà ce que fait `audit-360.mjs`, il suffit de l'ajouter à `verifier:toutes` |

> C'est **P-28** au registre, ouvert depuis le 14/09, et c'est la première fois qu'on le voit
> avec son fichier et sa ligne.

## 🔴-2 · Le blog envoie vers **six articles qui n'existent pas**

| | |
|---|---|
| **où** | `blog/index.html:77, 87, 97, 107, 117, 127` |
| **fait** | les six liens pointent sur `blog/comment-choisir-medecin-alger.html`, `blog/hypertension-algerie.html`, `blog/vaccins-enfants-algerie.html`, `blog/cnas-casnos-tiers-payant.html`, `blog/ramadan-sante.html`, `blog/sante-mentale-algerie.html` — **aucun de ces fichiers n'existe**. Les six articles réels sont dans `blog/articles/`, sous d'autres noms |
| **ce que voit le visiteur** | six 404 sur la page qui existe pour amener du trafic |
| **correctif proposé** | rebrancher les six `href` sur les fichiers de `blog/articles/`, ou refaire l'index à partir du contenu du répertoire |
| **garde** | le contrôle de liens internes d'`audit-360.mjs`, en porte |

**Pourquoi 🔴 et pas 🟠** : c'est une page publique, indexée, dont la seule fonction est de
mener quelque part. Six liens sur six sont morts.

---

# 🟠 IMPORTANT

## 🟠-1 · Deux liens légaux pointent à la racine, les fichiers sont dans `legal/`

`blog/index.html:146-147` → `cgu.html` et `confidentialite.html`. Ils sont dans
`legal/cgu.html` et `legal/confidentialite.html`. **Deux 404 sur des mentions légales**, dans
le pied de page. Correctif : `../legal/cgu.html`, `../legal/confidentialite.html`.

## 🟠-2 · Trois déréférencements sans filet sur le tableau de bord patient

`patient-dashboard.html:271, 272, 635` — `getElementById('notif-count').textContent`,
`.style`, et `getElementById('user-init').textContent`.

Ces ids **existent**, mais ils sont **injectés à l'exécution par `js/tabibi-header.js`**. Si
l'en-tête n'est pas encore posé quand ces lignes tournent, elles lèvent
« Cannot read properties of null » — et **tout le script s'arrête à cette ligne**. Les
branchements déclarés plus bas ne sont jamais faits : la page se fige à moitié vivante, sans
message.

Correctif : `const el = document.getElementById('notif-count'); if (el) …` — la forme déjà
utilisée partout ailleurs dans le même fichier. Coût : trois lignes.

## 🟠-3 · La référence des RPC est périmée — et elle est censée détecter le faux

`supabase/rpc/existantes.txt` ignore cinq RPC que le front appelle :
`accepter_invitation_medecin`, `create_prescription_draft`, `update_prescription_draft`,
`request_prescription_signature`, `mark_prescription_delivered`.

**Les cinq existent en base** (relevé en lecture seule le 15/09). Le fichier le dit lui-même :
la référence ne peut pas être régénérée parce que le jeton `--base` est révoqué.

⚠️ **Ce n'est plus vrai** : le MCP lit `pg_proc`. La référence peut être régénérée
aujourd'hui. Tant qu'elle ne l'est pas, `verifier:rpc` compare le front à une photo de la
base qui a **deux jours de retard** — et une porte qui compare à un état périmé finit par
crier sur ce qui va bien, donc par être ignorée.

## 🟠-4 · `v2/index.html` charge `src/main.tsx`, qui n'existe pas

Page de chantier, non liée depuis le produit. Elle ne casse rien aujourd'hui ; elle **casse
la lecture du dépôt** : quelqu'un qui l'ouvre voit une page blanche et cherche pourquoi.
Correctif : la supprimer, ou écrire en tête ce qu'elle est.

---

# 🟡 COSMÉTIQUE

- **35 pages sur 73 n'ont aucun élément interactif.** C'est normal (légal, blog, contenu) —
  noté pour que le chiffre « 357 éléments » se lise sur **38 pages**, pas 73.
- **14 `TODO`/`FIXME`** dans le produit, sur 10 fichiers. Aucun ne masque un bouton mort
  (vérifié : les 357 handlers sont définis). Ce sont des notes, pas des trous.
- **`js/tabibi-features.js` documente 7 drapeaux** (`video`, `payments`, `notifications`,
  `reviews`, `analytics`, `sentry`, `dawini`). ⚠️ `reviews` a déjà été trouvé **lu par
  personne** (P-14) : un drapeau qui ne commande rien est pire qu'un drapeau absent, parce
  qu'on croit tenir un interrupteur. Les six autres n'ont pas été re-vérifiés un par un ici.

---

# Ce que l'outil s'est trompé à croire — quatre fois

Le premier passage annonçait **20 gestionnaires morts** et **106 liens cassés**. Les deux
chiffres étaient faux, et chaque correction a une leçon :

```
106 -> 8 liens   les URL absolues (https://tabibi.doctor/...) — canoniques et partages —
                 étaient comptées comme des liens internes cassés.

  ? -> 0 liens   les chemins relatifs d'un sous-répertoire (blog/, legal/) étaient
                 résolus depuis la racine. `../index.html` devenait introuvable.

 20 -> 8 morts   `document.getElementById(...)` et `event.preventDefault()` étaient lus
                 comme des appels à NOUS. Un nom précédé d'un point est une MÉTHODE.

  8 -> 0 morts   `accueil-public.html` ne charge pas `js/home-app.js` : il charge
                 `src/entries/index.js`, QUI L'IMPORTE. Sans suivre les `import`,
                 douze fonctions parfaitement définies étaient déclarées mortes.
```

Et un cinquième, sur le contrôle des ids : la première version rendait **52 alertes dont ~45
fausses** (`getElementById('splash')` gardé par un `if`, `getElementById('tab-' + nom)` lu
comme un id littéral). Restreint aux **déréférencements directs**, il en rend **3**, et les
trois sont réelles.

> **Un rapport qui se trompe dix fois ne sera pas lu la onzième.** Le temps passé à corriger
> l'instrument n'est pas du temps perdu sur l'audit : c'est l'audit.

## La contre-épreuve — l'outil est prouvé ROUGE

Un fichier temporaire portant un défaut de chaque famille, ajouté puis retiré :

```
<button onclick="fonctionQuiNExistePas()">   -> MORT                    ✓
<a href="page-qui-nexiste-pas.html">          -> LIEN CASSE              ✓
getElementById('id-absent').textContent       -> DEREFERENCEMENT NUL     ✓
functions.invoke('fonction-edge-inexistante') -> EDGE SANS REPERTOIRE    ✓
rpc('rpc_qui_nexiste_pas')                    -> RPC HORS REFERENCE      ✓
<button onclick="fonctionQuiExiste()">        -> ignore, a raison        ✓
```

---

# Inventaire par page

`éléments` = attributs `onclick`/`onsubmit`/`onchange`/`oninput`/`onkeyup`/`onkeydown`.
`liens` = `href` internes vers un `.html`.

| page | éléments | liens | constat |
|---|---|---|---|
| `doctor-dashboard.html` | 50 | 15 | — |
| `medecin-profile.html` | 30 | 5 | — |
| `admin-doctor-validation.html` | 29 | 5 | — |
| `patient-dashboard.html` | 27 | 17 | 3 deref. nul(s) |
| `admin-dashboard.html` | 23 | 7 | — |
| `patient-profile.html` | 23 | 4 | — |
| `dawini.html` | 16 | 0 | — |
| `login.html` | 14 | 2 | — |
| `onboarding-medecin.html` | 13 | 3 | — |
| `legal/cookies.html` | 11 | 8 | — |
| `accueil-public.html` | 10 | 25 | — |
| `reservation.html` | 10 | 5 | — |
| `secretaire-dashboard.html` | 10 | 1 | — |
| `admin-api-keys.html` | 9 | 3 | — |
| `signup.html` | 8 | 8 | — |
| `admin-reviews.html` | 7 | 1 | — |
| `admin-cabinet.html` | 6 | 1 | — |
| `agenda-cabinet.html` | 6 | 4 | — |
| `dawini-pharmacie.html` | 6 | 1 | — |
| `doctor-profile.html` | 6 | 3 | — |
| `mes-rdv.html` | 6 | 4 | — |
| `doctor-claim.html` | 5 | 4 | — |
| `doctor-analytics.html` | 4 | 3 | — |
| `api-docs.html` | 3 | 2 | — |
| `legal/cgu.html` | 3 | 8 | — |
| `legal/confidentialite.html` | 3 | 6 | — |
| `legal/mentions-legales.html` | 3 | 9 | — |
| `payment.html` | 3 | 3 | — |
| `conversation.html` | 2 | 1 | — |
| `notifications.html` | 2 | 2 | — |
| `waiting-list.html` | 2 | 13 | — |
| `404.html` | 1 | 5 | — |
| `medecin-ordonnance.html` | 1 | 3 | — |
| `messages.html` | 1 | 1 | — |
| `offline.html` | 1 | 0 | — |
| `patient-ordonnances.html` | 1 | 2 | — |
| `success.html` | 1 | 2 | — |
| `verify-email.html` | 1 | 2 | — |
| `CHANTIER_MOBILE_2026-09-08.html` | 0 | 0 | — |
| `about.html` | 0 | 8 | — |
| `blog/articles/5-specialites-medicales-prise-rdv-en-ligne-algerie.html` | 0 | 0 | — |
| `blog/articles/bien-preparer-rendez-vous-medecin-algerie.html` | 0 | 0 | — |
| `blog/articles/carte-chifa-tiers-payant-ce-quil-faut-savoir.html` | 0 | 0 | — |
| `blog/articles/medecin-liberal-algerie-digitaliser-cabinet-2026.html` | 0 | 0 | — |
| `blog/articles/ramadan-sante-gerer-rendez-vous-medicaux.html` | 0 | 0 | — |
| `blog/articles/teleconsultation-algerie-ou-en-est-on-2026.html` | 0 | 0 | — |
| `blog/index.html` | 0 | 11 | 8 lien(s) casse(s) |
| `cas-grave.html` | 0 | 4 | — |
| `email-verified.html` | 0 | 4 | — |
| `forgot-password.html` | 0 | 2 | — |
| `index.html` | 0 | 0 | — |
| `invitation-medecin.html` | 0 | 3 | — |
| `legal/dpa.html` | 0 | 10 | — |
| `legal/rgpd-droits.html` | 0 | 5 | — |
| `medecin-pilote.html` | 0 | 1 | — |
| `medecin-waitinglist.html` | 0 | 3 | — |
| `patient-waitinglist.html` | 0 | 3 | — |
| `porte/porte-fermee.html` | 0 | 0 | — |
| `reset-password.html` | 0 | 1 | — |
| `telecharger.html` | 0 | 0 | — |
| `teleconsultation.html` | 0 | 6 | — |
| `templates/emails/01-bienvenue-patient.html` | 0 | 0 | — |
| `templates/emails/02-bienvenue-medecin.html` | 0 | 0 | — |
| `templates/emails/03-confirmation-rdv-patient.html` | 0 | 0 | — |
| `templates/emails/04-rappel-rdv-j-1-patient.html` | 0 | 0 | — |
| `templates/emails/05-annulation-rdv-par-patient-notif-medecin.html` | 0 | 0 | — |
| `templates/emails/06-annulation-rdv-par-medecin-notif-patient.html` | 0 | 0 | — |
| `templates/emails/07-demande-avis-post-rdv-patient.html` | 0 | 0 | — |
| `templates/emails/08-onboarding-medecin-j7.html` | 0 | 0 | — |
| `templates/emails/09-recap-mensuel-medecin.html` | 0 | 0 | — |
| `templates/emails/10-ordonnance-disponible-patient.html` | 0 | 0 | — |
| `v2/index.html` | 0 | 0 | script absent |
| `verify-prescription.html` | 0 | 0 | — |

---

# Ce qui n'est PAS couvert par cet audit, et qui compte

1. **Les gestionnaires posés par `addEventListener`** ne sont pas inventoriés élément par
   élément — seulement leurs déréférencements d'ids dans les scripts inline. Un bouton
   branché par `addEventListener` sur un id absent **n'est pas détecté** si le résultat est
   gardé par un `if`.
2. **Ce que fait vraiment un handler.** L'outil vérifie qu'il existe, pas qu'il tient sa
   promesse. Le libellé d'un bouton comparé à son effet demande une lecture humaine — ou un
   essai.
3. **Les états non gérés** (liste vide, hors-ligne, jeton expiré, double-clic, 4xx/5xx) : ils
   demandent de lire chaque handler. Signal partiel mesuré ici : **7 fichiers** posent un
   `addEventListener('submit', …)`, **23** désactivent un bouton quelque part — les deux
   ensembles ne se recouvrent pas entièrement, donc **des formulaires sont soumettables deux
   fois**. À instruire.
4. **Les fuites** : `innerHTML` recevant une valeur non prouvée sûre = **135** sites
   (compteur v2, P-38). Les secrets sont couverts par les portes existantes.
5. **L'accessibilité** au-delà de ce que `tests/e2e/accessibilite.spec.js` mesure déjà.

---

# Ce que je ferais dans cet ordre

| | quoi | pourquoi d'abord |
|---|---|---|
| 1 | **🔴-1 `send-email`** | c'est le seul défaut qui **ment à l'utilisateur**. Un lien mort se voit ; un « e-mail envoyé » qui n'est pas parti ne se voit jamais |
| 2 | **🔴-2 les six liens du blog** | page publique, indexée, et le correctif est mécanique |
| 3 | **🟠-3 régénérer la référence RPC** | une porte qui compare à un état périmé s'éteint toute seule. Et c'est maintenant possible |
| 4 | **🟠-2 les trois déréférencements** | trois lignes, et ça supprime une classe entière de « la page se fige à moitié » |
| 5 | **ajouter `audit-360` à `verifier:toutes`** | les cinq contrôles sont contre-éprouvés. Sans porte, ce rapport sera périmé dans une semaine |

**Aucun correctif n'est appliqué ici** — c'est un rapport, et la règle 10 veut que chaque
correctif parte dans un lot avec sa garde.
