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
