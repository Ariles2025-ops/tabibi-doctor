# Preuve d'interface « Mes horaires » — 12/09/2026, localhost:8080 (branche fix/medecin-1-faux-succes, PR #69)

Comptes de test marqués `TEST-CONGRES-20260910` (purge : `tests/manual/test-congres/nettoyage.sql`, PR #65).
Navigateur : Chrome d'Aghiles, connexion par téléphone + mot de passe, captcha Turnstile actif.
Règle : un correctif du parcours médecin n'est prouvé que par un passage dans l'interface, écran contre base.

## Compte A — `0555000101`, fiche `39000325…` (legacy 9000001) liée

### Défaut trouvé avant la première étape : depuis l'onglet « Aujourd'hui », « Mes horaires » ouvre une modale invisible

- Écran : clic sur « Mes horaires » dans le bandeau vert (onglet « Aujourd'hui ») → rien ne se passe visuellement.
- DOM : `#schedule-modal` passe bien en `display:flex`, mais son rectangle mesure **0 × 0** parce qu'il est placé **à l'intérieur de
  `#tab-agenda`** (panneau `display:none` tant que l'onglet Agenda n'est pas actif). Chaîne mesurée :
  `#schedule-modal (flex) → #tab-agenda.tab-panel (none) → main.page → .app-root`.
- Depuis l'onglet « Agenda », la même modale s'affiche (1280 × 690).
- Conclusion : **l'écran ment par omission** sur l'onglet d'accueil du médecin — le bouton semble mort. Correctif requis pour #69 :
  sortir `#schedule-modal` du panneau (le monter sous `body`), comme la modale « Bloquer un créneau ». À ajouter aux trois
  « requis » de la revue.

### 1. Affichage de la modale contre `doctor_profiles.working_hours`

Capture : `2026-09-12_mes-horaires_A_01_modale.png` (onglet Agenda).

| Jour | Écran (case, matin, après-midi) | Base (`working_hours`) | Verdict |
|---|---|---|---|
| Lundi | cochée, 09:00–12:00, 14:00–17:00 | `[09:00–12:00, 14:00–17:00]` | cohérent |
| Mardi | cochée, 09:00–12:00, 14:00–17:00 | `[09:00–12:00, 14:00–17:00]` | cohérent |
| Mercredi | cochée, 09:00–12:00, après-midi vide | `[09:00–12:00]` | cohérent |
| Jeudi | cochée, 09:00–12:00, 14:00–17:00 | `[09:00–12:00, 14:00–17:00]` | cohérent |
| Vendredi | décochée, « Fermé » | `[]` | cohérent |
| Samedi | cochée, 09:00–12:00, après-midi vide | `[09:00–12:00]` | cohérent |
| Dimanche | décochée, « Fermé » | `[]` | cohérent |

Lecture : `window._docSchedule` (rempli par `loadDoctorScheduleFromDb`) ; `localStorage.tabibi_doctor_schedule` et
`tabibi_doc_slots` = `null` (plus de source locale). **La deuxième plage d'après-midi n'est pas perdue à l'affichage** : le
point de la revue de #69 est levé pour la lecture (il reste ouvert pour `medecin-profile.html`, non testé ici).

### 2. Modification, enregistrement, base

- Action : samedi, fin de matinée 12:00 → **13:00**, « Enregistrer mes horaires ».
- Écran : modale fermée, toast **« Horaires enregistrés »** ; requête `POST /rest/v1/rpc/update_my_doctor_profile` → **200**.
- Base : `updated_at = 2026-09-12 12:45:45+00`, `working_hours->'sat' = [{"open":"09:00","close":"13:00"}]` ; lundi, mercredi,
  vendredi inchangés.
- Réouverture de la modale : samedi affiche 09:00–13:00 (relu depuis la base).
- Retour à 12:00 par le même chemin : toast « Horaires enregistrés » (capture `2026-09-12_mes-horaires_A_02_apres-enregistrement.png`),
  base `updated_at = 12:47:02+00`, `sat = [{"open":"09:00","close":"12:00"}]`. Fiche remise dans son état initial.
- Conclusion : **cohérent** — le succès annoncé correspond à une écriture réelle, dans les deux sens.

## Compte B — `0555000102`, sans fiche liée

À faire après connexion d'Aghiles sur B (même écran, attendu : message honnête « Réclamez votre fiche… », aucun toast de succès).

## Compte C — patient `0555000103`, prise de RDV chez le Dr Test

À faire après connexion d'Aghiles sur C.
