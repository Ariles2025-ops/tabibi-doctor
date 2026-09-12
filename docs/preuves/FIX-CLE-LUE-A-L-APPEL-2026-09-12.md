# Correctif — la clé publiable est lue à l'appel, plus à l'évaluation du module

Défaut trouvé le 12/09/2026 en cherchant pourquoi le test « l'accueil se charge et affiche le hero »
faisait rougir la CI de #76.

## Le défaut

`src/entries/index.js` importe `js/home-app.js` **avant** `js/config.js`. Or `home-app.js` capturait la clé
au moment où le module s'évalue :

```js
const _SB_KEY = (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || '';
```

À cet instant `window.TABIBI_CONFIG` n'existe pas encore. `_SB_KEY` valait donc la chaîne vide **pour toute
la durée de vie de la page**, et la fabrique d'en-têtes envoyait `apikey:` vide.

```
401 POST /rest/v1/rpc/stats_publiques
{"message":"No API key found in request",
 "hint":"No `apikey` request header or url param was found."}
```

**Ce n'était pas intermittent : 12 chargements sur 12.** Seule la course entre l'erreur de console et
l'assertion du test l'était. L'échec était en outre **silencieux** : aucun message à l'écran, les listes de
filtres retombaient sur une liste figée.

## Le correctif

La clé est lue à chaque appel. L'ordre des imports n'a plus aucune influence.

```js
function _tbCle(){ return (window.TABIBI_CONFIG && window.TABIBI_CONFIG.SUPABASE_ANON_KEY) || ''; }
function _tbHdrs(extra){ var k = _tbCle(); return Object.assign({apikey:k,Authorization:'Bearer '+k},extra||{}); }
```

Une fonction ajoutée, une ligne modifiée. `src/entries/index.js` n'est **pas** touché : le but est que son
ordre cesse d'avoir un effet, pas de le rafistoler.

## Preuves, cache-bustées

### Avant / après, même mesure, deux serveurs en parallèle

| | branche #56 (port 8081) | avec le correctif (port 8080) |
|---|---|---|
| `stats_publiques` | **401** | **200** |
| `chercher_praticiens` (filtre Alger) | **401** | **200** |
| erreurs console | 1 | **aucune** |
| options du filtre spécialité | 31 (liste figée de repli) | **40 (la vraie liste, servie par la base)** |
| hero affiché | oui | oui |

Les 40 spécialités au lieu de 31 sont la preuve la plus parlante : la page affiche désormais des données
venues de la base, pas son repli.

### Parcours critiques Playwright

| Ordre des imports dans `src/entries/index.js` | Résultat |
|---|---|
| `home-app.js` puis `config.js` (l'ordre réel, celui qui cassait) | **30 passés**, 3 fois de suite |
| `config.js` puis `home-app.js` (inversé exprès) | **30 passés**, 3 fois de suite |

C'est la preuve demandée : la suite passe **quel que soit l'ordre**, donc la classe de défaut est morte.
Pour mémoire, sans le correctif et dans l'ordre réel, la même suite échouait 2 fois sur 4.
Le fichier d'entrée a été remis à l'identique après la mesure (0 ligne de différence).

### Suite rejouée sur la sortie de build

`npm run test:e2e:build` : **30 passés**.

## Portes locales

| Porte | Résultat |
|---|---|
| `eslint --quiet` | 0 erreur |
| `lint:dette` | **échoue, 44 / 43 — hérité de #56, pas de cette PR** |
| `i18n:verifier` | dictionnaires alignés |
| `verifier:cles` | aucun littéral hors `js/config.js` |
| `verifier:c1` | OK |
| `build` | OK |

Le cliquet échoue exactement comme sur la branche de #56, au même compteur, pour la même fonction morte
`getTakenSlots` laissée par #74. Cette PR n'ajoute aucune dette : `_tbCle` est utilisée, et le nombre
d'avertissements de `home-app.js` est inchangé. **Le job redeviendra vert dès que #76 sera fusionnée
dans #56 et cette branche rebasée.**

## Inventaire du même motif — relevé, non corrigé

Tous les endroits du front v1 qui lisent `SUPABASE_ANON_KEY`, avec pour chacun le moment de la lecture.

| Emplacement | Lue quand | Verdict |
|---|---|---|
| `js/home-app.js:1570` `const _SB_KEY` | évaluation du module, avant `config.js` | **même défaut** — la racine. Plus utilisée par les RPC publiques après ce correctif, mais la constante subsiste et vaut `''` |
| `js/home-app.js:327` (`loadTakenSlots`) | à l'appel, mais lit `_SB_KEY` en priorité, donc `''` | **même défaut, hérité.** Appelée en vrai depuis `showDoctorModal` (ligne 1206) : la requête part et prend 401. Effet visible nul depuis #74, qui a vidé la grille de créneaux, mais l'appel échoue quand même |
| `js/home-app.js:1291` (`finalBooking`) | à l'appel, lit directement la configuration | **dormant** : `finalBooking` est du code mort depuis #74, gardée seulement sur `window` |
| `doctor-claim.html:187` | script classique, après `js/config.js` (ligne 162) | **inoffensif** : l'ordre est garanti par la page |
| `doctor-dashboard.html:541` et `:759` | dans des fonctions async, à l'appel | **inoffensif pour l'ordre.** C'est l'autre défaut, celui de `FICHE_SESSION_PERDUE_ECRAN_SURVIT.md` : le repli fait partir une requête non authentifiée |
| `patient-dashboard.html:477, 623, 644, 784` | idem | idem |
| `medecin-ordonnance.html:573`, `teleconsultation.html:425` | accès direct sans garde, dans un objet d'en-têtes | **inoffensif pour l'ordre**, mais lèverait une `TypeError` si la configuration manquait, au lieu d'un message clair |
| `js/supabase-client.js:14` | dans une IIFE qui **teste** `window.TABIBI_CONFIG` et sort avec un message d'erreur | **inoffensif, et exemplaire** : c'est le modèle à suivre, il échoue bruyamment |

Et côté points d'entrée : sur les dix fichiers de `src/entries/`, **`index.js` est le seul** à importer
`config.js`. Les neuf autres sont des pages statiques qui ne la chargent pas. Le défaut d'ordre était donc
confiné à l'accueil.

**Deux familles à ne pas confondre.** Le défaut d'ordre (lignes 1570 et 327) fait partir une requête sans
aucune clé. Le repli des tableaux de bord fait partir une requête signée en anonyme quand la session a
disparu. Le premier est corrigé ici pour les RPC publiques ; le second attend la branche
`fix/session-perdue-bandeau`.
