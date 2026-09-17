# AUDIT SOURCE EXHAUSTIF — 17/09/2026, mode nuit

**Lecture seule.** Aucun fichier de l'application n'est modifié par ce lot ; ce document est le seul
livrable. Méthode : lecture du source par surface **et par état**, complétée par des **lectures en
base** (MCP, `select` uniquement) chaque fois qu'une affirmation portait sur une RPC, une signature
ou une politique RLS.

> ⚠️ **Ce que cet audit vaut, et ce qu'il ne vaut pas.** Il lit du code et interroge la base. Il n'a
> ouvert aucun navigateur sur un compte réel, n'a testé aucun parcours humain de bout en bout, et ne
> dit donc rien de ce qui casse **à l'usage** sans laisser de trace dans le source. Une lecture n'est
> pas une recette (P-31).

**Légende de sévérité**

| | |
|---|---|
| **bloquant** | la fonction ne marche pas du tout, ou trompe sur un acte médical / un paiement / un consentement |
| **majeur** | un parcours utile est cassé, mort ou mensonger, sans contournement évident |
| **mineur** | gêne, incohérence, dette de garde ; rien ne se perd |

**VENDEUR — NE PAS TOUCHER** : les 75 035 fiches importées, le badge « Vérifié », les quatre
praticiens de `#sec-vitrine`, les noms « Dr Dr / Cabinet », `convertDoctor`, la téléconsultation
annoncée « Disponible ». **Intentionnel, exclu du décompte.**
**SUPERVISÉ** : plomberie `window.tabibiRpc`, démantèlement `home-app.js`, `SECR-RDV` (doctor_id),
picker patient ordonnance, refonte archi, suppression de pages, allègement CI.

---

## ⚠️ AVANT LA LISTE : TROIS LOTS DE LA FILE NUIT REPOSENT SUR UN DIAGNOSTIC FAUX

Vérifié **en base** le 17/09 (`pg_get_function_result`) :

| lot nuit | ce que le lot suppose | ce que la base dit | conséquence |
|---|---|---|---|
| **N8** DAWINI-RPC | « `createAlerts` ne lit pas `r.data.error` (métier) » | `dawini_create_alert` → **`uuid`**. `dawini_cancel_alert` → **`boolean`**. **Aucune enveloppe `{error}`** | **Il n'y a rien à lire.** Et `dawini.html:643` traite déjà `r.error` *et* le cas `too_many_alerts`, `cancelAlert` teste déjà `r.data === false`. **Lot sans objet** |
| **N9** APIKEY-RPC | « tester `data.error` pour éviter `Nouvelle clé : undefined` » | `rotate_api_key` → **`TABLE(new_secret, expires_old_at)`**, `revoke_api_key` → **`void`** | Pas d'`data.error` non plus. Le vrai défaut est ailleurs : **`data` vide** (`row` `undefined` → `TypeError`), voir `APIKEY-VIDE` |
| **N13** ORDO-RPC | « create/update/request lisent seulement `res.error` ; tester `data.error` » | `create_prescription_draft` → **`uuid`** · `update_prescription_draft`, `request_prescription_signature`, `mark_prescription_delivered` → **`void`** | Pas d'enveloppe. Le vrai contrôle est **`data` non nul** pour la création, voir `ORDO-UUID-NUL` |

**Écrire `if (data.error)` sur une fonction qui rend un `uuid` ajoute du code mort qui a l'air d'une
garde.** C'est la faute que ce dépôt connaît sous le nom « une garde qui pleure sur du code juste
finit désactivée », dans l'autre sens : une garde qui ne pleurera jamais.

---

## 1. DÉCONNECTÉ / PUBLIC

| sév. | code | fichier:ligne | symptôme | cause | correctif (1 phrase) | risque |
|---|---|---|---|---|---|---|
| mineur | `ARIA-CLE-ACCUEIL` | `accueil-public.html:1074` | un lecteur d'écran annonce « ph_hero_search » | `aria-label` reçoit la **clé** i18n au lieu du libellé | poser un vrai libellé traduit (`data-i18n-aria` + application) | isolé |
| mineur | `DEVISE-EN` | `js/home-app.js:1770` | le prix s'affiche « DZD » en anglais, « DA » ailleurs | `const unit = (lang === 'en' ? ' DZD' : ' DA')` — **branche volontaire**, pas un mélange accidentel | **décision produit avant code** : garder le code ISO en EN (cohérent avec `legal/cgu.html`) ou passer à « DA » partout | isolé |
| mineur | `AR-NOMBRES` | `accueil-public.html:1069,1080,1316,1430` | en arabe, « 75 000+ » se lit « +000 75 » | les nombres latins héritent du sens RTL du paragraphe | isoler le sens (`<bdi>` ou `dir="ltr"`) sur les seuls nombres | isolé |
| mineur | `TELE-CTA` | `doctor-profile.html:713-714` | un bouton visio ouvre une `alert()` « Fonctionnalité en beta » | aucun flux réel derrière | masquer le bouton tant qu'il n'y a pas de session vidéo | isolé |
| mineur | `CLAIM-ALERT` | `doctor-claim.html:428` | `alert('Module de réclamation indisponible. Rechargez la page.')` | le module `tabibiClaim` peut manquer | message dans la page plutôt qu'une `alert()` bloquante | isolé |

**VENDEUR — NE PAS TOUCHER** : `#sec-vitrine` (4 praticiens inventés, notes ★ 4.9), le compteur
« 75 000+ », « Téléconsultation · Disponible », les noms « Dr Dr / Cabinet ». Signalés au registre
(**P-60**, **P-64**) comme décisions produit, **pas comptés ici**.

---

## 2. PATIENT CONNECTÉ

| sév. | code | fichier:ligne | symptôme | cause | correctif | risque |
|---|---|---|---|---|---|---|
| mineur | `PP-MESURES-MORT` | `patient-profile.html:103` | « Ajouter une mesure » ouvre `alert('Module mesures · Bientôt disponible')` | bouton sans fonctionnalité derrière | masquer le bouton, ou l'étiqueter « bientôt » **sans** le rendre cliquable | isolé |
| mineur | `RESA-ETAPE3` | `reservation.html:658-661` | l'étape « 3 · Paiement » affiche un titre et **rien** | `renderPayMethods("cash")` rend `''` (stub cash-only, `js/payments.js`) | renommer l'étape « Confirmation — paiement au cabinet » | isolé |

**Non trouvé** : rien de cassé sur `mes-rdv.html`, `patient-dashboard.html` (hors liens porte fermée,
cf. §6). L'opt-out rappels vit dans `notifications.html` — **aucune garde e2e** (cf. `QA-TROUS`).

---

## 3. MÉDECIN

| sév. | code | fichier:ligne | symptôme | cause | correctif | risque |
|---|---|---|---|---|---|---|
| majeur | `MAILTO-VIDE` | `doctor-dashboard.html:870` | « contacter par e-mail » ouvre le client mail **sans destinataire** | `'mailto:?subject=' + …` — l'adresse du patient n'est jamais mise | masquer le bouton tant que l'e-mail patient n'est pas disponible | isolé |
| mineur | `DD-DETAILS-ALERT` | `doctor-dashboard.html:787` | « Détails » d'un RDV ouvre une **boîte d'alerte** du navigateur | raccourci d'implémentation | remplacer par un panneau dans la page | isolé |
| mineur | `DD-DOSSIER-ALERT` | `doctor-dashboard.html:960` | « Dossier patient » ouvre une **alerte** avec trois lignes | idem | idem | isolé |
| mineur | `AGENDA-NOM` | `js/tabibi-agenda.js:191-194` | en mode cabinet, filtrer par médecin filtre sur une **sous-chaîne de nom** | la vue cabinet n'expose pas la FK ; repli sur `a.doctor.indexOf(name)` | filtrer par identifiant, ou exposer la FK dans la vue | isolé côté front, **étendu** si la vue doit changer |
| mineur | `ORDO-UUID-NUL` | `medecin-ordonnance.html:539` | une ordonnance « créée » sans identifiant passerait pour un succès | `create_prescription_draft` rend un **`uuid`** : il faut exiger `data` non nul (**pas** `data.error`, qui n'existe pas) | exiger l'uuid dans la réponse | isolé |

---

## 4. SECRÉTAIRE

| sév. | code | fichier:ligne | symptôme | cause | correctif | risque |
|---|---|---|---|---|---|---|
| **majeur** | `SECR-KPI-WAITING` | `secretaire-dashboard.html:415` | la tuile « liste d'attente » affiche **toujours 0** | la requête `waiting_list` n'a **aucun filtre**, et surtout : **RLS lue en base — `wl_admin_select` réserve le SELECT aux `admin`**. Une secrétaire ne lit donc **aucune ligne** | retirer la tuile, ou exposer un compteur autorisé pour ce rôle (**demande une décision RLS → supervisé**) | **étendu** (base) |
| mineur | `SECR-KPI-PORTEE` | `secretaire-dashboard.html:409-414` | les trois autres tuiles comptent bien par **cabinet** | — | **rien à corriger** : contrairement à ce qu'annonce N16, l'agrégation globale ne concerne **qu'une** tuile sur quatre | — |

⚠️ **N16 décrit l'inverse du défaut.** Il parle d'un compteur qui « agrège en global » : mesuré, trois
tuiles sont correctement filtrées par `cabinet_id`, et la quatrième ne sur-compte pas — **elle est
vide en permanence**. Corriger « la portée » ne changerait rien tant que la RLS ne laisse pas passer
une seule ligne.

**SUPERVISÉ — non traité ici** : `SECR-RDV` (doctor_id à la création d'un RDV par la secrétaire).

---

## 5. ADMIN

| sév. | code | fichier:ligne | symptôme | cause | correctif | risque |
|---|---|---|---|---|---|---|
| **bloquant** | `ADMIN-REJET-MORT` | `admin-dashboard.html:544-549` | **le rejet d'un médecin depuis le tableau de bord admin ne peut pas aboutir** | l'appel passe `p_reason` **et** `p_notes`. Signature lue en base : `admin_validate_doctor(p_doctor_id uuid, p_action text, p_notes text)` — **une seule**, sans `p_reason`. PostgREST n'apparie aucune fonction → refus | supprimer `p_reason` et passer le **motif réel** dans `p_notes` (aujourd'hui écrasé par « Rejeté via admin dashboard ») | isolé |
| majeur | `ADMIN-MOTIF-PERDU` | `admin-dashboard.html:548` | même corrigé, le **motif saisi ne serait pas enregistré** | `p_notes` porte un texte constant | passer `reason` dans `p_notes` | isolé |
| majeur | `APIKEY-VIDE` | `admin-api-keys.html:548-553` | « Nouvelle clé : undefined », ou une `TypeError` muette | `rotate_api_key` rend une **TABLE** ; si elle rend **zéro ligne**, `row` est `undefined` et `row.new_secret` lève | exiger une ligne avant d'afficher ; message clair sinon | isolé |
| mineur | `ADMIN-ALERTS` | `admin-api-keys.html:498,504,524,535,542,549,551` · `admin-reviews.html:201` | toute l'interface passe par `alert()` | raccourci | toasts comme le reste de l'app | isolé |
| mineur | `ADMIN-I18N` | `admin-api-keys.html` (0 clé / ~36 libellés) · `admin-doctor-validation.html` (0 / ~18) · `admin-dashboard.html` (2 / ~23) · `admin-reviews.html` (0 / ~6) | pages admin **en français seulement** | jamais internationalisées | `data-i18n` + clés FR/AR/EN | isolé, volumineux |
| mineur | `ARIA-CLE-CABINET` | `admin-cabinet.html:59` | `aria-label="back_to_dashboard"` (clé brute) | même famille que `ARIA-CLE-ACCUEIL` | vrai libellé traduit | isolé |

---

## 6. TRANSVERSAL

| sév. | code | fichier:ligne | symptôme | cause | correctif | risque |
|---|---|---|---|---|---|---|
| majeur | `PORTE-22-LIENS` | 22 emplacements, 18 pages (**P-92** au registre) | boutons « Trouver un médecin », « Retour à l'accueil », redirections de déconnexion → `index.html`, **la porte fermée** | l'inversion du 13/09 a fait d'`index.html` la page « Bientôt disponible » | repointer sur `accueil-public.html` — **déjà en file N1b** | isolé, répétitif |
| mineur | `ARIA-CLE-ORDO` | `medecin-ordonnance.html:343,348,352,356,361` | **5** `aria-label` = clés i18n brutes | idem | idem | isolé |
| mineur | `GARDE-I18N-TROUEE` | `tests/e2e/i18n-cles-brutes.spec.js:68-79` | **une garde nommée « clés brutes » ne voit pas les clés brutes** | elle n'inspecte que `textContent` et `placeholder` — **jamais `aria-label`** — et ne couvre que **10 pages** (aucune page derrière connexion) | ajouter les attributs accessibles ; étendre aux pages à session (recette de stub déjà disponible) | isolé |
| mineur | `RPC-CLIQUET-NON-ABAISSE` | `scripts/verifier-rpc-passage.mjs` | le cliquet dit lui-même : « ↓ 1 de moins que le plafond : abaissez-le à 50 » | plafond 51, réalité 50 | abaisser à 50 | isolé |
| mineur | `ABSENCE-PERIMEE` | `docs/FICHE_R3_APPELS_DANS_LE_VIDE.md` | `accepter_invitation_medecin` est listée « migration ÉCRITE, NON APPLIQUÉE » | **lue en base le 17/09 : elle EXISTE** (`p_token text` → `jsonb`) | retirer la ligne — « cette liste doit maigrir » | isolé |
| mineur | `QA-ATTENTE` | 10 specs, 21 occurrences | `waitForTimeout` : attentes arbitraires | héritage | remplacer par des faits (`expect.poll`) | isolé |
| mineur | `QA-TROUS` | — | **aucune garde e2e** sur `admin-api-keys`, `admin-reviews`, `notifications` (opt-out rappels) ; **une seule** sur `secretaire-dashboard`, `admin-cabinet`, `admin-doctor-validation` | surfaces internes, jamais couvertes | poser au moins un essai de non-régression par surface | isolé |

**Vérifié et SAIN** (mesuré, pas supposé) : parité i18n `fr/en/ar` = **1582 clés chacune, 0 manquante,
0 orpheline** · `praticiens_vitrine` **existe** en base · toutes les RPC appelées sont déclarées
(`verifier:rpc`) · aucun spec e2e sans assertion (39 fichiers) · `doctor-profile.html` désactive
correctement son bouton de réservation · `dawini.html` lit correctement ses deux RPC.

---

# SYNTHÈSE

## Compte par sévérité

| sévérité | nombre | codes |
|---|---|---|
| **bloquant** | **1** | `ADMIN-REJET-MORT` |
| **majeur** | **5** | `MAILTO-VIDE` · `SECR-KPI-WAITING` · `ADMIN-MOTIF-PERDU` · `APIKEY-VIDE` · `PORTE-22-LIENS` |
| **mineur** | **20** | §1 : 5 · §2 : 2 · §3 : 4 · §5 : 3 · §6 : 6 |
| **total** | **26** | |

`SECR-KPI-PORTEE` n'est pas compté : c'est une ligne **« rien à corriger »**, posée pour dire que
trois tuiles sur quatre sont saines — sans elle, on lirait N16 comme touchant les quatre.

*(hors VENDEUR, exclu par consigne ; hors SUPERVISÉ, signalé mais non compté comme corrigeable.)*

Le bloquant unique est `ADMIN-REJET-MORT` : **le rejet d'un médecin depuis `admin-dashboard.html`
appelle une signature qui n'existe pas en base.**

## Codes corrigeables en nuit, NON couverts par N1 → N18

Par ordre de valeur décroissante :

1. **`ADMIN-REJET-MORT`** *(bloquant)* — `admin-dashboard.html:544`. N5 touche le même appel mais le
   présente comme une « harmonisation de signature » : **c'est une fonction qui ne s'exécute jamais**.
   À traiter en priorité, et avec `ADMIN-MOTIF-PERDU` dans le même lot.
2. **`ADMIN-MOTIF-PERDU`** *(majeur)* — le motif de rejet saisi n'atteint pas la base.
3. **`APIKEY-VIDE`** *(majeur)* — `admin-api-keys.html:548`. **Remplace N9**, dont la cause annoncée
   (`data.error`) n'existe pas.
4. **`SECR-KPI-WAITING`** *(majeur)* — tuile toujours à zéro. ⚠️ La **moitié RLS est supervisée** ;
   côté nuit, on peut au plus **retirer la tuile** ou dire « non disponible pour ce rôle ».
5. **`ORDO-UUID-NUL`** *(mineur)* — **remplace N13**, même raison.
6. **`DD-DETAILS-ALERT`** / **`DD-DOSSIER-ALERT`** *(mineur)* — deux `alert()` en guise d'écran.
7. **`PP-MESURES-MORT`** *(mineur)* — bouton patient sans fonctionnalité.
8. **`CLAIM-ALERT`** *(mineur)*.
9. **`ARIA-CLE-ORDO`** + **`ARIA-CLE-CABINET`** *(mineur)* — **N12 n'en liste qu'un sur sept**.
10. **`GARDE-I18N-TROUEE`** *(mineur)* — à faire **avant** N12, sinon rien n'empêchera les six autres
    de revenir.
11. **`ADMIN-ALERTS`** *(mineur)*.
12. **`ABSENCE-PERIMEE`** + **`RPC-CLIQUET-NON-ABAISSE`** *(mineur)* — deux lignes, dette d'outillage.
13. **`QA-TROUS`** + **`QA-ATTENTE`** *(mineur)* — recouvrent partiellement N17/N18.

## Trois lots de la file à retirer ou réécrire

- **N8** — **sans objet** : `dawini.html` lit déjà correctement ses deux RPC, qui n'ont pas
  d'enveloppe d'erreur métier.
- **N9** — **à réécrire** en `APIKEY-VIDE`.
- **N13** — **à réécrire** en `ORDO-UUID-NUL`.

Et deux à corriger dans leur énoncé :

- **N5** : ce n'est pas une harmonisation, c'est **un appel mort**.
- **N16** : le compteur ne sur-compte pas, **il est vide** — et la cause est une RLS admin-seule.

---

## Ce que cet audit n'a pas fait

Il n'a **ouvert aucun navigateur** : rien n'a été cliqué, aucune session réelle n'a été jouée. Les
défauts qui ne laissent pas de trace dans le source — un texte qui déborde, un contraste illisible,
un clavier qui ne s'ouvre pas, un RDV qui part sur le mauvais fuseau — **ne sont pas ici**.

Il n'a pas non plus relu les **490 pages SEO**, ni `legal/`, ni le bundle desktop/mobile au-delà de
`tabibi-desktop-nav.js`.
