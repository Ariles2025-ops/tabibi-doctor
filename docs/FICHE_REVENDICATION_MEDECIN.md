# Fiche — la revendication d'une fiche par un médecin

> Établie le 10 septembre 2026 par lecture du schéma de production (`pg_proc`, `pg_policies`,
> `pg_trigger`) et par **simulation complète d'une revendication dans une transaction annulée**
> (`BEGIN … ROLLBACK`, base vérifiée intacte ensuite). Objectif : savoir ce qui casse le jour où le
> premier médecin revendique sa fiche, avant que ce soit devant lui.

## 1. Le fait de départ

`doctor_profiles.user_id` est **nul sur les 75 034 lignes**. 28 comptes ont le rôle `medecin`, aucun
n'est relié à une fiche. Toute règle d'accès « le médecin propriétaire » compare `doctor_profiles.user_id`
à `auth.uid()` : aujourd'hui elle ne correspond à personne, et le modèle d'accès médecin n'a **jamais
été exercé** en production.

Traces vérifiées : `audit_log` sur `doctor_profiles` = 0, `claim_requests` = 0, `claimed_at` non nul = 0,
`users.is_claimed` = 0, `pg_stat_user_functions` pour `claim*` = 0 (le suivi des fonctions est actif,
`fn_cleanup_old_logs` y figure). **La fonction de revendication n'a jamais tourné une seule fois.**

## 2. Ce qui dépend de `doctor_profiles.user_id`

| Objet | Type | Rôle |
|---|---|---|
| `doctor_profiles_select_owner_or_admin` | policy SELECT `doctor_profiles` | le médecin lit sa fiche |
| `Doctors can update their own profile` | policy UPDATE `doctor_profiles` (rôle `public`) | le médecin modifie sa fiche, toutes colonnes, sous réserve du trigger de verrouillage |
| `appointments_select_doctor`, `appointments_update_doctor` | policies `appointments` | agenda du médecin |
| `dus_insert_owner`, `dus_update_owner`, `dus_delete_owner` (+ `dus_select_owner` proposée par R2) | policies `doctor_unavailable_slots` | absences |
| `medical_records` (2), `payments` (1), `prescriptions` `rx_select_visible` | policies via `current_doctor_profile_id()` | dossiers, paiements, ordonnances |
| `current_doctor_profile_id`, `get_my_doctor_profile`, `update_my_doctor_profile`, `doctor_set_ordre_number`, `ensure_conversation`, `admin_validate_doctor`, `tg_notify_appointment`, `claim_my_doctor_profile` | fonctions | tout le côté médecin |
| `doctor_patients_directory` | vue | noms des patients dans l'agenda |

Ce qui **ne** dépend pas de `user_id` : les documents du bucket `doctor-docs` (dossier nommé par
`auth.uid()`), la validation admin (par `id` de fiche), la fiche publique.

## 3. Qui écrit `user_id`

Une seule fonction : `claim_my_doctor_profile(legacy_id_input integer)` (SECURITY DEFINER). Elle
vérifie la session, le rôle `medecin`/`doctor`, qu'aucune fiche `is_claimed = true` n'est déjà liée à
ce compte, que la fiche existe et n'est pas revendiquée, puis :

```sql
UPDATE public.doctor_profiles
   SET user_id = v_auth_uid, is_claimed = true, claimed_at = now(), updated_at = now()
 WHERE id = v_profile_id;
```

La surcharge sans argument `claim_my_doctor_profile()` ne touche pas `doctor_profiles` : elle pose
`users.is_claimed = true` sur le compte (colonne dupliquée, jamais lue par les policies).

## 4. La simulation, étape par étape

Compte : le plus ancien `users.role = 'medecin'`. Fiche : `legacy_id = 1`. Session simulée par
`SET LOCAL ROLE authenticated` + `request.jwt.claims`. Tout annulé par `ROLLBACK`.

| # | Étape | Résultat | Verdict |
|---|---|---|---|
| 01 | fiches visibles avant revendication (policy SELECT) | 0 | attendu |
| 02 | `check_doctor_account_exists(1)` | `false` | la fonction compare `doctor_profiles.email` à `users.email` : elle ne dit pas « un compte a revendiqué cette fiche » mais « un compte médecin a le même e-mail que la fiche importée ». Sémantique douteuse, voir §6 |
| 03 | `claim_my_doctor_profile(1)` | `{"ok": true, "profile_id": …, "claimed_at": …}` | la fonction **croit** avoir réussi |
| 04 | **vérité en base** | `user_id` = le médecin ✔ · **`is_claimed = false`** ✘ · `claimed_at` posé | **le trigger `lock_doctor_protected_columns` (BEFORE UPDATE) remet `is_claimed` à l'ancienne valeur dès que `auth.uid()` n'est pas admin** ; SECURITY DEFINER ne change pas `auth.uid()`, donc il s'applique aussi à la fonction de revendication |
| 05 | lire sa fiche (policy) | 1 ligne | ✔ |
| 06 | `get_my_doctor_profile()` | rend la fiche | ✔ |
| 07 | `UPDATE doctor_profiles SET bio` direct (policy) | exécuté | ✔ (`bio` modifiée, vérifié en base) |
| 08 | `update_my_doctor_profile(p_bio)` | rend `bio = 'essai rpc'` | ✔ |
| 09 | `doctor_set_ordre_number('ESSAI-123')` | **`no_claimed_profile`** | ✘ la fonction exige `is_claimed = true` ; le numéro d'Ordre ne peut jamais être enregistré ; le front le garde indéfiniment dans `localStorage` (`js/tabibi-claim.js`, clé `tabibi_claim_ordre`) |
| 10 | poser une absence (policy INSERT) | exécuté | ✔ |
| 11-13 | agenda : `appointments`, `doctor_patients_directory`, `cabinet_calendar_view` | 0, 0, 0 | ✔ (vides, sans erreur) |
| 14 | `is_doctor_bookable(fiche)` | `false` | ✘ conséquence de 04 |
| 15 | présent dans `public_doctors_listed` ? | 0 | ✘ conséquence de 04 ; la fiche publique garde adresse et coordonnées à `NULL` |
| 16 | second `claim` d'une **autre** fiche par le même médecin | **erreur brute `23505 duplicate key … doctor_profiles_user_id_key`** | ✘ le garde-fou « déjà revendiqué » cherche `user_id = uid AND is_claimed = true` ; comme `is_claimed` est resté faux, il ne voit rien et l'UPDATE heurte l'index unique ; le front affiche le message PostgreSQL brut |
| 17-20 | vérité finale | 1 fiche liée, `is_claimed = false`, `ordre_number` nul | |

## 5. Ce qui casse le jour où le premier médecin revendique

1. **Il ne sera jamais validé.** `admin_validation_list('pending')` filtre `d.is_claimed` : la fiche
   n'apparaît pas dans la file admin. `admin-doctor-validation.html` reste vide, personne ne voit la
   demande.
2. **Son numéro d'Ordre n'est jamais enregistré** (`no_claimed_profile`), sans message clair pour lui.
3. **Il n'est pas réservable** (`is_doctor_bookable = false`), n'apparaît ni dans `public_doctors_listed`
   ni sur la carte (`is_claimed=eq.true`), et sa fiche publique n'affiche ni adresse ni position.
4. **Sa fiche reste « revendicable » pour les autres** : `doctor-claim.html` liste `is_claimed = false`,
   et un second médecin qui la revendique **remplace silencieusement son `user_id`** (la fonction ne
   vérifie que `is_claimed`, pas `user_id IS NULL`) : la fiche change de main, sans trace.
5. S'il se trompe et revendique une seconde fiche, il reçoit une erreur PostgreSQL brute.
6. Le reste fonctionne : lecture et modification de sa fiche (par policy et par RPC), absences,
   agenda vide sans erreur.

Cause unique : le trigger `lock_doctor_protected_columns`, écrit pour empêcher un médecin de se
mettre `is_claimed`/`is_verified` à `true` par un `UPDATE` direct (la policy UPDATE lui ouvre toutes
les colonnes), s'applique aussi à la seule fonction légitime qui pose `is_claimed`.

## 6. Correctif à proposer (SQL à présenter, non exécuté — hors de cette fiche)

- Le trigger laisse passer l'écriture quand un drapeau transactionnel est posé par la fonction de
  revendication (`set_config('tabibi.revendication', '1', true)` dans `claim_my_doctor_profile`, lu
  par `current_setting('tabibi.revendication', true)` dans le trigger), et continue de bloquer tout
  `UPDATE` direct.
- `claim_my_doctor_profile` : refuser si la fiche a déjà un `user_id` (pas seulement `is_claimed`),
  refuser si le compte a déjà une fiche liée (`user_id = uid`, sans condition sur `is_claimed`),
  attraper `unique_violation` et rendre `already_claimed_another_profile`.
- `check_doctor_account_exists` : à redéfinir (« cette fiche est-elle déjà liée à un compte ? » =
  `user_id IS NOT NULL`) ou à retirer ; son appelant est à identifier.
- Preuve : rejouer la simulation ci-dessus ; attendu : 04 `is_claimed = true`, 09 `ok`, 14 `true`,
  15 = 1 après validation admin, 16 = message propre.
- Puis décider du sort de `users.is_claimed` / `users.legacy_id` / `claim_my_doctor_profile()`
  (colonnes et fonction dupliquées, jamais lues).

## 7. Ce qui n'a pas été vérifié

- Le parcours navigateur complet (`doctor-claim.html` → OTP → RPC → `pushOrdre`) : la simulation est
  côté base ; le front a été lu, pas exécuté.
- La validation admin après un `is_claimed` correct : `admin_validate_doctor` ne touche pas `is_claimed`
  et propage le statut sur `users.status` ; non rejoué.
- Le comportement de `signup.html` en mode « inscription avec claim » (`[C3]`, `profile_id`).

## 8. Le tableau de bord d'un médecin sans fiche liée — mesuré en production le 10/09/2026

Compte réel connecté sur `tabibi.doctor/doctor-dashboard` (rôle `medecin`, inscrit par téléphone le
31/07, 0 fiche liée, pas un compte de test). Nom et spécialité viennent de **`public.users`**
(`first_name`, `last_name`, `specialty_fr` écrits par `signup.html`), puis du cache
`localStorage.tabibi_user` ; jamais de `doctor_profiles`. Observation dans le navigateur (requêtes
réseau, messages affichés, aucune soumission) recoupée avec le code.

| Élément | Requête réelle | Résultat sans fiche | Verdict |
|---|---|---|---|
| En-tête | `users?id=eq.<compte>` | nom, spécialité | marche |
| Onglet « Aujourd'hui » / KPI | `appointments?doctor_id=eq.<id du compte>` (`doctor-dashboard.html:573`) | 0 | **vide, et le restera après un claim** : la colonne référence `doctor_profiles.id`, le front filtre sur l'identifiant du compte (`js/tabibi-agenda.js:199` a le correctif, le tableau de bord ne l'a jamais reçu) |
| Onglet « RDV », « Patients » | même requête, agrégat local | « Aucun rendez-vous », « Aucun patient » | idem |
| Onglet « Agenda » | grille depuis `localStorage.tabibi_doc_rdv` | « Aucun RDV ce jour » | vide sans erreur |
| Sous-section « Blocages » (onglet Agenda) | `get_my_doctor_profile` → vide, retry 1,5 s | « — (réclamez votre fiche pour activer cette section) », bouton « Bloquer un créneau » désactivé, mini-bandeau « Réclamer ma fiche » | dégradé proprement, mais enfoui |
| Onglet « Stats » → `doctor-analytics` | `appointments?doctor_id=in.(<compte>)` | « Statistiques indisponibles pour le moment. Vérifiez votre connexion et réessayez. » | vide, **message faux** (accuse la connexion) ; le drapeau `doctorStats=false` ne protège que la sidebar, pas cet onglet |
| Onglet « Profil » → « Mes horaires » | **`localStorage.tabibi_doctor_schedule`** | « Horaires enregistrés » | **faux succès** : rien en base, `update_my_doctor_profile(p_working_hours)` n'est jamais appelé ici |
| **Ajouter créneaux** → `doctor-reservation` | **`localStorage.tabibi_doc_slots`**, aucun appel Supabase | « Créneaux ajoutés ! » | **faux succès** : aucun patient ne verra jamais ces créneaux, avec ou sans fiche |
| Agenda cabinet | `get_my_cabinets` → 0, puis `appointments?doctor_id=in.(<compte>)` | grille vide, « Dr » sans nom | vide, silencieux |
| Ordonnance / Téléconsult. | aucune | « bientôt disponible » | masqués par drapeau |
| Mon cabinet → `admin-cabinet` | `get_my_cabinets` → 0 | toast « Vous n'êtes membre d'aucun cabinet. Créez-en un. » ; formulaires vides et actifs ; « Enregistrer » ne fait rien, sans message | **impasse** : la RPC `create_cabinet` existe en base, **aucun front ne l'appelle** |
| Mon profil → `medecin-profile` | `get_my_doctor_profile` → vide | bandeau « Votre fiche médecin n'est pas encore liée à votre compte » + bouton « Réclamer ma fiche » ; à l'enregistrement : « Vous devez d'abord réclamer votre fiche… » (`update_my_doctor_profile` lève `profile_not_found_or_not_claimed`) | le seul écran qui dit la vérité |
| Notifications (cloche) | `notifications?limit=20` → 0 | « Aucune notification » | **structurellement vides pour tout médecin** : `tg_notify_appointment` cherche le destinataire par `doctor_profiles.user_id` |
| Chemins vers la revendication | — | 3 seulement : bandeau de « Mon profil », mini-bandeau enfoui dans l'onglet Agenda, pied de page public ; **rien** dans la sidebar pro, le menu, l'onglet « Aujourd'hui », ni `onboarding-medecin.html` | parcours manquant |

Aucune erreur console, aucun chargement infini : tout échoue **poliment et à vide**, indiscernable
d'un cabinet qui démarre. Deux défauts survivraient à un claim réussi : le filtre `doctor_id` sur
l'identifiant du compte (tableau de bord, RDV, patients, stats) et l'absence d'appel à `create_cabinet`.
Deux faux succès sont indépendants de la fiche : « Créneaux ajoutés ! » et « Horaires enregistrés ».

Ordre de correction proposé, avant R3 : (1) le filtre `doctor_id` unifié sur l'identifiant de fiche
retourné par `get_my_doctor_profile` (quatre écrans) ; (2) un bandeau « Réclamer ma fiche » en tête du
tableau de bord tant que la fiche n'est pas liée, et une entrée dans la sidebar pro ; (3)
`doctor-reservation` et « Mes horaires » branchés sur `update_my_doctor_profile(p_working_hours)` et
`doctor_unavailable_slots`, ou retirés ; (4) `admin-cabinet` : soit brancher `create_cabinet`, soit
retirer le toast qui invite à créer.

## 9. Récupération de mot de passe : qui peut encore entrer au congrès

Mesuré le 11/09/2026 (`auth.users` joint à `public.users`).

| Comptes | Total | Téléphone seul (e-mail nul) | E-mail seul | Les deux |
|---|---|---|---|---|
| médecins | 28 | **1** (le compte connecté au tableau de bord, créé le 31/07) | 26 | 1 |
| patients | 11 | 2 | — | — |

- **L'inscription actuelle crée des comptes téléphone seul** : `signup.html:397` appelle
  `auth.signUp({ phone, password })` et écrit `email: NULL` (`:474`). Les 26 comptes médecin « e-mail
  seul » viennent d'anciens parcours ou de comptes de test ; tout médecin inscrit au congrès sera dans
  le cas « téléphone seul ».
- **Deux parcours de récupération coexistent, et ils ne se valent pas :**
  - « Mot de passe oublié ? » du formulaire principal de `login.html` (`showReset`, `:229`) : demande
    le **téléphone**, appelle `signInWithOtp({ phone, shouldCreateUser: false })` puis `verifyOtp`
    (`:369`, `:406`). C'est le bon parcours pour les comptes créés par téléphone : un code SMS, pas de
    promesse d'e-mail. Pour les 26 comptes e-mail seul, il échoue avec le message de `mapOtpError`
    (numéro inconnu). Ce parcours est aussi la seule porte d'entrée si le mot de passe est perdu.
  - `forgot-password.html` : demande un **e-mail**, appelle `resetPasswordForEmail`, et affiche quoi
    qu'il arrive « Si un compte existe avec cet email, vous recevrez un lien dans quelques minutes »
    (`:69-71`). Pour un compte téléphone seul, **le lien ne peut jamais arriver** : la promesse est
    tenue en apparence, fausse en fait. Cette page n'est atteignable que depuis le formulaire « Connexion
    admin » (`login.html:163`) et depuis `reset-password.html` en cas de lien expiré.
- **Conclusion** : un médecin inscrit par téléphone qui oublie son mot de passe au congrès a bien une
  issue, l'OTP SMS depuis le formulaire principal ; elle dépend entièrement de BudgetSMS (crédit,
  délivrabilité, hook `send-sms`). Le parcours e-mail doit soit disparaître pour les comptes sans
  e-mail, soit le dire (« ce compte a été créé par téléphone : utilisez le code SMS »), ce qui suppose
  de savoir côté client si l'identifiant existe, donc de passer par l'API (brique 1) plutôt que par
  une réponse anti-énumération.

### 9.1 Deux correctifs ajoutés au lot « faux succès » (décision du 11/09)

- **Correctif 1 bis — adresse de secours à l'inscription médecin.** Un champ e-mail **facultatif**,
  présenté comme « adresse de secours pour récupérer votre compte », jamais comme identifiant de
  connexion. Motif : chaque médecin du congrès n'aura sinon qu'une voie de récupération, l'OTP SMS ;
  si BudgetSMS tombe ou si le crédit s'épuise, ils sont tous enfermés dehors. Condition technique :
  GoTrue accepte un compte avec téléphone **et** e-mail (`auth.updateUser({ email })` après la
  vérification du téléphone ; l'e-mail est actif après confirmation par lien) sans changer le mode de
  connexion. Prérequis à vérifier avant : un SMTP réel côté GoTrue, sinon le lien de confirmation ne
  part pas (voir la mesure ci-dessous).
- **Correctif 1 ter — `forgot-password.html` ne promet plus un e-mail impossible.** Même famille que
  « Créneaux ajoutés ! ». Soit la page détecte le type de compte et renvoie vers l'OTP SMS, soit elle
  disparaît pour les comptes sans e-mail. La détection côté client n'est pas possible proprement
  (réponse anti-énumération de GoTrue) : passer par l'API (brique 1) ou retirer la page du parcours
  médecin.
  Mesuré le 12/09 (`docs/preuves/2026-09-12_forgot-password_mesure.md`) : numéro de téléphone → « Email invalide », aucune requête ; e-mail inexistant → HTTP 400 `captcha_failed` (navigateur intégré) ou HTTP 200 `{}` (Chrome), et dans les deux cas le bandeau « vous recevrez un lien ».
