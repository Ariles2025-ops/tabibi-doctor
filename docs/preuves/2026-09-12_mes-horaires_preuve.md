# Preuve d'interface « Mes horaires » et parcours médecin sans fiche — 12/09/2026

localhost:8080, branche `fix/medecin-1-faux-succes` (PR #69). Comptes marqués `TEST-CONGRES-20260910`
(purge : `tests/manual/test-congres/nettoyage.sql`, PR #65). Connexion par téléphone + mot de passe, captcha Turnstile actif.
Règle : un correctif du parcours médecin n'est prouvé que par un passage dans l'interface, écran contre base.
Note : le rechargement d'URL simple sert parfois une copie en cache ; toutes les captures « après correctif » utilisent un paramètre anti-cache (`?cb=…`).

## Correctif appliqué avant la preuve : la modale « Mes horaires » sortie des panneaux d'onglet

`#schedule-modal` était placé dans `#tab-agenda` (`display:none` hors de l'onglet Agenda). Depuis l'onglet « Aujourd'hui »,
la modale s'ouvrait à 0 × 0 : le bouton du bandeau vert semblait mort. Bloc déplacé sous `<body>`, comme `#unavail-modal`
(« Bloquer un créneau »). Preuve : chargement `?cb=B1`, `#schedule-modal.parentElement = BODY`, clic « Mes horaires » depuis
« Aujourd'hui » → modale 1280 × 690 (`2026-09-12_compteB_modale-depuis-aujourdhui.png`).

## Compte A — `0555000101`, fiche `39000325…` (legacy 9000001) liée, revendiquée, approuvée

### 1. Affichage contre `doctor_profiles.working_hours` — capture `…_A_01_modale.png`

| Jour | Écran | Base | Verdict |
|---|---|---|---|
| Lundi / Mardi / Jeudi | 09:00–12:00 **et** 14:00–17:00 | idem | cohérent |
| Mercredi / Samedi | 09:00–12:00, après-midi vide | `[09:00–12:00]` | cohérent |
| Vendredi / Dimanche | « Fermé » | `[]` | cohérent |

**La deuxième plage d'après-midi n'est pas perdue à l'affichage** : le point de la revue de #69 est levé pour la lecture.

### 2. Modification, enregistrement, base — capture `…_A_02_apres-enregistrement.png`

- Samedi 12:00 → 13:00, « Enregistrer » : toast « Horaires enregistrés », `POST rpc/update_my_doctor_profile` **200**,
  base `sat = [09:00–13:00]`, `updated_at 12:45:45`. Retour à 12:00 : base `sat = [09:00–12:00]`, `updated_at 12:47:02`.
- Verdict : **cohérent** — succès annoncé = écriture réelle, dans les deux sens.

## Compte B — `0555000102`, AUCUNE fiche liée — défaut principal du parcours médecin

Mesuré : `auth.uid()` = compte B, `select * from doctor_profiles` sous sa session → **0 ligne** ; `get_my_doctor_profile()` → `null`.

### Ce que B voit — capture `…_compteB_sans-fiche_dashboard.png`

Un tableau de bord médecin **complet** : bandeau « Bon après-midi, Dr. TEST-CONGRES 20260910 », boutons Mes horaires,
Ordonnance, Téléconsult., Mon cabinet, Mon profil ; menu latéral Agenda, Agenda cabinet, Mes RDV, Patients, Stats ;
compteurs à 0 ; « Aucun RDV aujourd'hui ». **Aucune bannière « Réclamez votre fiche »**, aucun signe qu'il n'est rattaché à rien.

### La modale « Mes horaires » sur B — capture `…_compteB_modale-depuis-aujourdhui.png`

Elle s'ouvre et affiche des horaires **par défaut** (`getDefaultSchedule()` : 08:00–12:00 / 14:00–17:00, tous les jours de
semaine cochés). Rien à l'écran ne distingue ces valeurs par défaut d'un vrai planning : la modale **ment par pré-remplissage**.

### L'enregistrement, lui, est honnête — capture `…_compteB_sans-fiche_save-honnete.png`

« Enregistrer mes horaires » → `POST rpc/update_my_doctor_profile` **403** ; message dans la modale
« Réclamez votre fiche dans l'annuaire pour pouvoir gérer vos disponibilités » + toast
« Vous devez d'abord réclamer votre fiche dans l'annuaire avant de pouvoir l'éditer ». **Le correctif #69 tient au moment de
l'écriture** : pas de faux succès sur le save.

### Verdict

**L'écran ment par omission, en amont de l'écriture.** Le point d'écriture est honnête (403 + message), mais tout le tableau
de bord présente un espace de travail médecin fonctionnel à quelqu'un qui n'est lié à aucune fiche, sans jamais lui offrir le
chemin pour en revendiquer une. Ce n'est pas un défaut d'affichage : **le tunnel de revendication n'existe pas**.
Relié : fiche de revendication (PR #63, `docs/FICHE_REVENDICATION_MEDECIN.md`).

## Compte C — patient `0555000103`, prise de RDV chez le Dr Test

À faire (parcours patient, vérification du RDV en base).
