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

### Vu depuis R1

*(à compléter : les trois vues, écran contre base)*

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
