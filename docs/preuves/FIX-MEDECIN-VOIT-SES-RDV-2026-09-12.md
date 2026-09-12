# Correctif — le médecin voit enfin les rendez-vous de ses patients

Défaut trouvé par le parcours 3 de la recette, le 12/09/2026
(`docs/preuves/RECETTE-P3-2026-09-12.md`). **Ce n'est pas une régression de la vague** : la production
porte déjà ce défaut. Il est petit, il touche la promesse centrale du produit, donc il est corrigé
tout de suite, sans retenir la vague.

## Le défaut

`appointments.doctor_id` porte `doctor_profiles.id`, l'identifiant de **fiche**. C'est ce que le front de
réservation écrit, ce que `get_available_slots` utilise, et ce sur quoi la politique RLS est écrite :

```sql
appointments_select_doctor (SELECT) :
  doctor_id IN (SELECT doctor_profiles.id FROM doctor_profiles WHERE user_id = auth.uid())
```

Mais `fetchDoctorRdvsFromSupabase()` interrogeait avec l'identifiant de **compte** :

```js
'/rest/v1/appointments?select=*&doctor_id=eq.' + encodeURIComponent(userId)   // userId = session.user.id
```

Mesure sur un vrai rendez-vous créé pendant la recette :

| Requête | Lignes |
|---|---|
| `doctor_id = <identifiant de compte>` (l'ancien code) | **0** |
| `doctor_id = <identifiant de fiche>` (ce qui est stocké) | **1** |

`refreshDoctorRdvs()` appelle cette fonction pour **trois** vues à la fois : « Aujourd'hui »
(`renderToday`), l'agenda (`renderAgenda`) et « Mes RDV » (`filtMRdv`). Les trois étaient aveugles.
C'est ce qui expliquait le « 0 RDV aujourd'hui » pris pour un agenda vide au parcours 1.

**La base avait raison depuis le début.** Seul le front se trompait d'espace d'identifiants.

## Le correctif

On résout la fiche, exactement comme le font déjà deux autres appels du même fichier (le badge de
validation et la section des blocages) :

```js
let docId = null;
if (window.tabibiDoctor && typeof window.tabibiDoctor.getMyDoctorId === 'function') {
  docId = await window.tabibiDoctor.getMyDoctorId();
}
if (!docId) return null;   // médecin sans fiche liée : aucun RDV ne peut lui être rattaché
```

Rien d'autre n'est réécrit. Le jeton de session reste celui de l'authentification, la suite de la
fonction est inchangée. Quatorze lignes ajoutées dont sept de commentaire, une ligne modifiée.

## Preuves

### Réservation depuis R3

| Mesure | Valeur |
|---|---|
| session au moment de réserver | `49d22433-…`, `recette-20260912.patient@tabibi.doctor` |
| rendez-vous créé | `a7be539b-…`, lundi 14/09 **10:00** heure d'Alger, `pending` |
| `doctor_id` écrit | `85a6972c-…`, l'identifiant de fiche |

### Vu depuis R1 — les trois vues, le 13/09 à 00h16 heure de Paris

Session vérifiée avant mesure : `2ed31cea-…`, `recette-20260912.medecin-fiche@tabibi.doctor`,
et `getMyDoctorId()` résout bien `85a6972c-…`.

Ce que la base contient pour cette fiche :

| Rendez-vous | Statut | Heure d'Alger |
|---|---|---|
| `a7be539b` | `pending` | lundi 14/09 **10:00** |
| `2750cd25` | `cancelled` | lundi 14/09 **09:00** |

| Vue | Le rendez-vous apparaît | Écran contre base | Verdict |
|---|---|---|---|
| **Aujourd'hui** | sans objet, rien aujourd'hui | « RDV aujourd'hui 0 » = base 0 ✔ ; cloche 3 = 3 notifications ✔ ; **« Ce mois » 2 alors que 1 seul RDV n'est pas annulé** | l'écran ment sur un compteur |
| **Agenda, lundi 14** | **oui, les deux** | « RDV DU LUNDI 14 SEPTEMBRE (2) », 10:00 et 11:00 | **le correctif fonctionne**, mais l'heure est fausse et un annulé s'affiche comme valide |
| **Mes RDV** | **oui, les deux** | « lun. 14 sept. · 11:00 · En attente » et « lun. 14 sept. · 10:00 · Annulé » | **le correctif fonctionne**, statut honnête, heure fausse |

**Le défaut visé est corrigé** : avant, les trois vues étaient vides ; elles affichent maintenant les
rendez-vous de la fiche. La lecture par identifiant de fiche fonctionne, et la RLS la laisse passer.

---

## Trois défauts restants, trouvés en vérifiant le correctif

Aucun n'est causé par cette PR. Tous sont dans `doctor-dashboard.html`, aucun n'est corrigé ici.

### A. L'heure est rendue dans le fuseau du navigateur, pas dans celui du cabinet

`normDoctorRow` calcule l'heure avec `dt.getHours()`, donc dans le fuseau de la machine :

```js
const dt   = new Date(r.scheduled_at);
const date = dt.toISOString().split('T')[0];        // date en UTC
const time = String(dt.getHours()).padStart(2,'0')  // heure LOCALE du navigateur
```

Mesure : navigateur sur **Europe/Paris**, UTC+2 en heure d'été. Le rendez-vous stocké à `09:00Z`
vaut **10:00 à Alger** et s'affiche **11:00**.

Le même rendez-vous, la même minute, sur deux écrans :

| Écran | Heure affichée |
|---|---|
| côté patient (`reservation.html`, `mes-rdv.html`) | **10:00**, heure d'Alger |
| côté médecin (les trois vues) | **11:00**, heure du navigateur |

Pour un produit de rendez-vous médicaux, c'est grave : un médecin en déplacement, ou dont la machine
n'est pas réglée sur Alger, lit une heure fausse. Le correctif est de formater en `Africa/Algiers`
comme le fait déjà le côté patient.

Note de rigueur : sur une machine réglée sur Alger (UTC+1), ce défaut ne se voit pas. Il a été mesuré
sur une machine à Paris.

### B. Date et heure ne sont pas calculées dans le même fuseau

Dans les deux lignes ci-dessus, `date` sort de `toISOString()` (UTC) et `time` de `getHours()` (local).
Les deux ne peuvent pas être cohérents. Conséquence visible immédiatement, à 00h16 heure de Paris :

- `currentDay` (ligne 381) et la bande de semaine de `renderAgenda` (ligne 700) valent **la veille** ;
- la bande affiche « lun. 7 … dim. 13 » mais ses cellules appellent `selDay('2026-09-06')` …
  `selDay('2026-09-12')` : **chaque cellule charge le jour précédent celui qu'elle affiche** ;
- l'agenda s'était ouvert sur « SAMEDI 12 SEPTEMBRE » alors qu'on était dimanche 13.

Ce décalage n'apparaît qu'entre minuit et l'heure du décalage UTC (une heure à Alger, deux à Paris en
été). C'est pour cela qu'il n'avait pas été vu jusqu'ici.

### C. Un rendez-vous annulé s'affiche comme valide dans l'agenda, et se compte

- `renderAgenda` filtre `dayRdvs` **par date seulement**, jamais par statut : l'annulé est listé, et le
  titre annonce « (2) ».
- Le badge est choisi par `status==='Confirmed' ? bleu : status==='Pending' ? ambre : vert`. `Cancelled`
  tombe dans le **vert avec une coche**, c'est-à-dire l'apparence d'un rendez-vous honoré.
- Le compteur « Ce mois » (ligne 95) compte lui aussi sans filtrer le statut : il affiche **2** pour
  **1** rendez-vous réel.

« Mes RDV », en revanche, affiche correctement « Annulé ». Les deux vues du même fichier ne s'accordent
pas sur ce qu'est un rendez-vous.

### D. L'agenda n'a aucune navigation de semaine

`renderAgenda` reconstruit toujours la semaine de `new Date()`. Il n'existe ni bouton précédent ni
bouton suivant. Aujourd'hui dimanche 13, **lundi 14 n'est pas atteignable à l'écran** : il a fallu
appeler `selDay('2026-09-14')` pour afficher la journée qui contient les deux rendez-vous. Un médecin ne
peut pas consulter la semaine suivante.

**Aucun de ces quatre points n'est corrigé dans cette PR**, qui se limite à l'espace d'identifiants.
Ils forment un chantier cohérent : « le tableau de bord médecin dit l'heure du cabinet, et ne compte que
ce qui existe ».

### Portes locales

| Porte | Résultat |
|---|---|
| `eslint --quiet` | 0 erreur |
| `lint:dette` | **échoue, 44 / 43 — hérité de #56**, corrigé par #76 |
| `i18n:verifier` | dictionnaires alignés |
| `verifier:cles` | aucun littéral hors `js/config.js` |
| `verifier:c1` | OK |
| `build` | OK |
| `test:e2e` | **2 échecs — le 401 de l'accueil, hérité**, corrigé par #77 |

Les deux échecs sont ceux de la branche de base, mesurés à l'identique. Cette PR n'en ajoute aucun.

## Inventaire — les autres endroits qui filtrent par `doctor_id`

Relevé sur tout le front v1, verdict par emplacement. **Un seul portait le défaut, et c'est celui-ci.**

| Emplacement | Identifiant utilisé | Verdict |
|---|---|---|
| `doctor-dashboard.html:568` | résolu par `getMyDoctorId()` | **corrigé par cette PR** |
| `js/tabibi-doctor-dashboard.js:262` | `getMyDoctorId()` | correct |
| `js/tabibi-agenda.js:242` | `S.profile.id` | correct |
| `js/tabibi-reviews.js:133` et `:143` | identifiant de fiche reçu en paramètre | correct |
| `patient-dashboard.html:480` | identifiant de fiche reçu en paramètre | **bon espace**, mais la RLS patient ne rend que ses propres lignes : ce cache de créneaux pris est quasi toujours vide. Sans effet depuis #74 |
| `js/home-app.js:328` | identifiant de fiche reçu en paramètre | **bon espace**, même remarque de RLS, et porte en plus le défaut de clé vide relevé dans `FIX-CLE-LUE-A-L-APPEL-2026-09-12.md` |
| `doctor-analytics.html:263` | interroge avec **les deux** identifiants, `[fiche, compte]` | **fonctionne**, mais c'est un contournement qui masque l'ambiguïté au lieu de la trancher. À nettoyer un jour |
| `medecin-ordonnance.html:456` | `currentDoctor = { id: user.id, … }` | **piège dormant** : un identifiant de compte rangé dans un champ nommé `id`. Il ne sert aujourd'hui qu'à afficher la spécialité, aucune requête ne le filtre. Le jour où quelqu'un écrira `doctor_id: currentDoctor.id`, le défaut renaîtra |

Quinze tables portent une colonne `doctor_id`, dont six avec une clé étrangère explicite vers
`doctor_profiles` : `appointments`, `conversations`, `doctor_unavailable_slots`, `medical_records`,
`payments`. Les chemins front qui les touchent passent tous par la résolution de fiche.

## Observation hors vague — clés de traduction rendues brutes

Sur l'accueil, plusieurs clés s'affichent telles quelles : `v4_rev_soon_t`, `v4_rev_soon_p`, `v4_pay`,
`v4_hsl1`, et des `bc_*` dans l'illustration du hero. Les six clés vérifiées **existent** dans
`js/i18n/fr.js` et le vérificateur d'alignement passe (1506 clés, 0 manquante, 0 orpheline).

Ce n'est donc pas un dictionnaire incomplet mais un **problème de moment** : ces nœuds sont rendus après
le passage du traducteur, qui ne repasse pas dessus. C'est la même famille que le défaut d'ordre corrigé
pour la clé publiable dans #77 : une valeur lue une fois, trop tôt, au lieu d'être appliquée au moment où
le contenu existe.

**Hors vague.** À traiter avec le chantier i18n, en même temps que la question plus large de savoir si le
traducteur doit observer le DOM plutôt que s'exécuter une fois.
