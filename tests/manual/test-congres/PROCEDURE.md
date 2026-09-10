# Test réel de la chaîne complète — « TEST-CONGRES-20260910 »

Objectif : en production, une fois #62, #64 et #58 exécutés, dérouler une fois la chaîne
revendication → validation → rendez-vous → confirmation → **SMS reçu pour de vrai**, sur des
données marquées, puis prouver qu'il n'en reste rien.

**Marque unique** : la chaîne `TEST-CONGRES-20260910`. Elle est portée par :
`doctor_profiles.source`, `doctor_profiles.full_name`, `doctor_profiles.legacy_id = 9000001`,
`users.first_name = 'TEST-CONGRES'` et `users.last_name = '20260910'`, `users.is_test = true`,
`appointments.reason`, l'adresse e-mail `test-congres-20260910+…@tabibi.doctor`.
`verification.sql` compte tout ce qui la porte : **avant** le test la sortie doit être à zéro,
**après** le nettoyage aussi.

Le nettoyage (`nettoyage.sql`) a été écrit avant le test. Il est à exécuter par Aghiles, étape
par étape, en lisant chaque `RETURNING`. Rien n'est exécuté par l'agent.

## Déroulé

| # | Qui | Action | Preuve attendue |
|---|---|---|---|
| 0 | Aghiles | `verification.sql` | toutes les lignes à 0 |
| 1 | Aghiles | `creation.sql` : insère la fiche de test (legacy 9000001, Alger, généraliste, horaires 09-12) | `RETURNING id` noté |
| 2 | Aghiles, navigateur | Inscription **médecin** par e-mail + mot de passe : prénom `TEST-CONGRES`, nom `20260910`, e-mail `test-congres-20260910+medecin@tabibi.doctor` | compte créé, `users.role = medecin` |
| 3 | Aghiles, navigateur | `doctor-claim.html` : revendiquer la fiche **9000001**, saisir un n° d'Ordre | `is_claimed = true`, `ordre_number` écrit, ligne `audit_log doctor_profile_claimed` |
| 4 | agent (SELECT) | contrôle : la fiche est dans `admin_validation_list('pending')`, non réservable | |
| 5 | Aghiles, navigateur admin | `admin-doctor-validation.html` : valider | `validation_status = approved`, `is_doctor_bookable = true`, présente dans `public_doctors_listed` |
| 6 | Aghiles, navigateur | Inscription **patient** par téléphone (ton numéro) : prénom `TEST-CONGRES`, nom `20260910` | **OTP reçu** ; `sms_log` : 1 ligne, DLR revenu |
| 7 | Aghiles, navigateur | Prendre un RDV chez le médecin de test, motif `TEST-CONGRES-20260910`, dans 2 jours ou plus (J-1 doit tomber avant) | ligne `appointments` pending, notification `rdv_new` au médecin |
| 8 | Aghiles, navigateur médecin | Confirmer le RDV | `status = confirmed`, ligne `appointment_notifications kind = confirmation` |
| 9 | attendre ≤ 15 min | le cron des rappels draine l'outbox | **SMS de confirmation reçu** ; `appointment_notifications.status = sent`, `provider_msg_id` ; `sms_log` ; `ops_sante.last_status = 200` |
| 10 | Aghiles | marquer les deux comptes : `update public.users set is_test = true where first_name = 'TEST-CONGRES' and last_name = '20260910' returning id, role;` | 2 lignes |
| 11 | Aghiles | `nettoyage.sql`, étape par étape | chaque `RETURNING` lu |
| 12 | Aghiles | `verification.sql` | toutes les lignes à 0 |

Ce qui reste volontairement après nettoyage, et pourquoi : les lignes `audit_log` (journal
append-only, elles référencent des identifiants qui n'existent plus) et, au choix, `sms_log`
(preuve d'envoi ; contient ton numéro : à supprimer si tu préfères, ligne prévue en commentaire).

Coût : 3 SMS (OTP patient, confirmation, éventuellement J-1 si le RDV est à J+1) ≈ 0,27 €.
