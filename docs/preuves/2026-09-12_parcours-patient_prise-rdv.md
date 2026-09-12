# Parcours patient — prise de RDV chez le Dr Test, écran contre base (12/09/2026)

Compte patient C `0361f225…` (tél `0555000103`, `TEST-CONGRES-20260910`), localhost:8080, cache-bust systématique.
Fiche Dr Test `39000325…` (legacy 9000001), rattachée au compte médecin A `078dcb66…`, horaires lun/mar/jeu matin+après-midi,
mer/sam matin, ven/dim fermés.

## Observation préalable : le bandeau patient sans nom n'est PAS un profil qui échoue en silence

- Écran : tableau de bord patient affiche « Bonjour / Bienvenue » et l'en-tête « Mon espace », sans nom.
- Base : `users.first_name = 'TEST-CONGRES'`, `last_name = '20260910'`.
- Mesuré : `localStorage.tabibi_user` contient bien `name:"TEST-CONGRES 20260910"`, `firstName:"TEST-CONGRES"`, `fromSupabase:true`,
  et la requête `users` sous la session de C renvoie le profil. **Le profil est lu et stocké.** Rejouer `renderOverview()` à la
  main affiche aussitôt « TEST-CONGRES » et « Bonjour, TEST-CONGRES ». L'en-tête de l'accueil (`index.html`) montre d'ailleurs le
  nom correctement.
- Cause : `patient-dashboard.html` (`renderOverview`, ligne ~885) lit `tabibi_user.name` et peint son repli « Bienvenue » **avant**
  que le pont asynchrone (`tabibi-bridge.js`) n'ait écrit le nom, et ne re-rend jamais. Le tableau de bord médecin, lui, re-rend
  après le chargement du profil (`_refreshDoctorGreet`).
- **Verdict : bug d'ordre de rendu, pas un faux succès ni une lecture qui échoue.** Le nom est connu, il n'est simplement pas
  réaffiché. Correctif : rappeler `renderOverview()` après l'écriture de `tabibi_user`, ou écouter un événement du pont.
  Capture `2026-09-12_patientC_01_bandeau-sans-nom.png`.

## 1. La prise de RDV par l'accueil (« Prendre RDV » du bandeau) — L'ÉCRAN MENT

- Écran : recherche « TEST-CONGRES » → carte Dr Test → « Prendre RDV » ouvre une modale « Confirmer le RDV » pré-remplie à
  **09:00**, motif saisi, Espèces, « Confirmer le RDV » → toast **« RDV confirmé pour le dimanche 13 septembre 2026 à 09:00 »**.
- Base : `POST /rest/v1/appointments` **201**. Ligne créée : patient_id = C, doctor_id = **fiche** (39000325, bon espace d'id),
  `starts_at = 2026-09-13 07:00 UTC = dimanche 13/09 08:00 Alger`, status `pending`.
- **Trois mensonges** :
  1. **Jour fermé** : `get_available_slots(fiche, '2026-09-13')` = **0** (dimanche fermé dans la fiche). Le créneau réservé
     n'a jamais été proposé par la RPC. L'accueil ne consulte pas `get_available_slots`.
  2. **Heure fausse** : la modale et le toast affichent **09:00**, la base stocke **08:00 Alger** (décalage d'une heure).
     « Mes RDV » affiche ensuite 08:00 — donc l'app se contredit elle-même.
  3. **Créneau inexistant dans l'agenda réel** : la grille de la modale est **codée en dur** (`js/home-app.js:347` :
     `["08:00",…,"16:30"]`) et la date est le lendemain par défaut, sans vérifier ni le jour d'ouverture ni `working_hours`.
- Côté serveur, le trigger `validate_appointment_time` ne vérifie que « au moins 30 min dans le futur » : **aucune** garde sur
  les horaires d'ouverture. Ni le front ni la base n'empêchent une réservation hors disponibilité.
- Conséquence supplémentaire : le RDV étant le lendemain (<24 h), le bouton « Annuler » de « Mes RDV » est **désactivé**
  (« Annulation impossible <24h »). Le patient a réservé un créneau invalide qu'il ne peut pas annuler lui-même.
- Captures `…_patientC_02_confirmation-dimanche.png`, `…_03_mes-rdv.png`, `…_04_annulation-bloquee.png`.

## 2. La prise de RDV par la fiche (`reservation.html`) — COHÉRENT

Chemin atteint depuis la fiche médecin (`doctor-profile.html:577`). C'est le chemin correct.

- Écran : calendrier → **lundi 14** → `POST rpc/get_available_slots` **200**, 12 créneaux affichés **exactement** ceux de la
  fiche (09:00–11:30 le matin, 14:00–16:30 l'après-midi). Choix **09:00**, motif, Espèces, « Confirmer le RDV » →
  « **RDV confirmé !** lun. 14 septembre 2026 · 09:00 ».
- Base : `POST appointments` **201**. patient_id = C, doctor_id = fiche, `starts_at = 2026-09-14 08:00 UTC = lundi 14/09 09:00
  Alger` (**l'affichage correspond à la base**, pas de décalage sur ce chemin), status `pending`.
- Verdict : **cohérent**. Capture `…_05_confirmation-lundi.png`.

## 3. Effets de bord (sur le RDV du lundi, chemin correct)

| Effet | Attendu | Mesuré | Verdict |
|---|---|---|---|
| `get_available_slots(lundi 14)` | 12 → 11, 09:00 retiré | 11, 09:00 absent | cohérent |
| Notification | créée pour le médecin | 1 ligne, `user_id` = compte A, type `rdv_new`, « Nouvelle demande de rendez-vous » | cohérent |
| « Mes RDV » côté patient | le RDV apparaît | apparaît, « lundi 14 septembre 2026 · 09:00 », En attente | cohérent |
| **Agenda côté médecin A** | le RDV apparaît | **N'APPARAÎT PAS** | **l'écran ment** |

**Bug agenda médecin (confirmé en base).** `doctor-dashboard.html:555` interroge
`appointments?doctor_id=eq.<session.user.id>` — l'**id d'authentification** du médecin (078dcb66), alors que les RDV portent
`doctor_id = id de la fiche` (39000325). Mesure : `count(doctor_id = user_id A)` = **0**, `count(doctor_id = fiche)` = **2**.
Le médecin reçoit la notification mais son agenda liste **zéro** RDV. C'est le mélange d'espaces d'id déjà noté dans CLAUDE.md
(« Base de données ») et le correctif médecin 2 à venir. La preuve d'interface complète côté A exige une connexion sur A ;
la requête que son agenda exécute renvoie 0, c'est mesuré.

## 4. Annulation depuis l'espace patient (sur le RDV du lundi) — COHÉRENT

- Écran : « Mes RDV » → « Annuler ce RDV » (actif car >24 h) → modale « Annuler ce rendez-vous ? » → « Oui, annuler le RDV »
  → `PATCH appointments?id=eq.7a11ea89…` **200**. Le RDV passe de « À venir » à l'onglet « Annulés ».
- Base : status `cancelled`, `cancelled_at` renseigné, `cancelled_by_user_id` = patient C.
- Effet de bord : `get_available_slots(lundi 14)` **revient à 12**, 09:00 de nouveau présent.
- Verdict : **cohérent**. Capture `…_06_apres-annulation.png`.

## Reste à nettoyer

Le RDV **dimanche** (short_id `b2ff0de1`, pending, réservé par l'accueil) ne peut pas être annulé par l'interface (<24 h). Il est
marqué `TEST-CONGRES-20260910` et sera purgé par `tests/manual/test-congres/nettoyage.sql` (PR #65), avec le RDV lundi annulé.
