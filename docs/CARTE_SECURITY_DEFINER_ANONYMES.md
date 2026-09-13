# Carte — les fonctions `SECURITY DEFINER` exécutables par un visiteur anonyme

**Ouverte le 13/09/2026**, après la fermeture d'une porte de DDL anonyme mesurée ouverte en
production. C'est **la prochaine liste blanche, et elle est plus grande que celle des tables.**

## Pourquoi elle existe

La liste blanche du 12/09 a explicitement **exclu les fonctions de son périmètre** : *« EXECUTE
intact, 289 fonctions »*. Le raisonnement tenait tant que les fonctions n'étaient qu'un moyen d'accès
aux tables — or une fonction `SECURITY DEFINER` **n'est pas soumise aux droits de son appelant**.
Elle s'exécute avec ceux de son propriétaire. Verrouiller les tables et laisser les fonctions
ouvertes, c'est fermer la porte et laisser la fenêtre.

Ce qui l'a déclenchée : `api_usage_log_ensure_partition`, `SECURITY DEFINER`, corps faisant
`CREATE TABLE`, **exécutable par `anon`**. Prouvé de l'extérieur avec la clé anon publique — HTTP 204.
N'importe qui pouvait créer une table par date, sans limite. Fermée le jour même (B4).

## Les chiffres, mesurés le 13/09 après les deux `REVOKE`

| | |
|---|---|
| Fonctions de `public` exécutables par `anon` | **321** |
| dont `SECURITY DEFINER` | **57** (59 avant B4) |
| dont fonctions de **déclencheur** | **17** |
| **Surface réellement appelable par RPC** | **40** |
| avec DDL | **0** — les deux seules sont fermées |
| avec `DELETE` / `TRUNCATE` | **0** |

**Les 17 fonctions de déclencheur ne sont pas une porte.** PostgREST refuse d'exposer une fonction
qui retourne `trigger` : `has_function_privilege` dit `EXECUTE`, l'API ne les sert pas. Les compter
dans la surface aurait gonflé le chiffre de 40 % sans qu'une seule soit atteignable. **Un droit qui
existe et un chemin qui existe sont deux choses différentes.**

## Ce que l'inventaire automatique a trouvé — et où il s'est trompé

Classification par lecture des corps : ce que la fonction écrit (`INSERT`/`UPDATE`/`DELETE`) et
quelle garde elle lit (`auth.uid()`, `is_admin`, rôle).

**Sept des quarante écrivent.** Quatre portent une garde directe et explicite
(`admin_validate_doctor`, `claim_my_doctor_profile` ×2, `dawini_cancel_alert`, `dawini_create_alert`,
`dawini_create_request`, `upsert_patient_medical_data` — toutes lisent `auth.uid()`).

**Trois sont sorties « sans aucune garde ». Une des trois est un faux positif, et il faut le dire
avant le reste :**

- **`dawini_respond`** — `INSERT` + `UPDATE`, aucun `auth.uid()` dans son corps. **Elle est pourtant
  gardée** : sa première ligne est `v_pharm_id := public.dawini_my_pharmacy_id()`, suivie de
  `IF v_pharm_id IS NULL THEN RAISE EXCEPTION 'not_a_pharmacy'`. La garde est **un appel plus loin**,
  et mon motif ne regardait qu'un niveau. Elle vérifie ensuite la wilaya, le statut et l'expiration
  de la demande. Rien à corriger.

C'est la limite à retenir : **un balayage statique de gardes produit des faux négatifs dès que la
garde est indirecte.** La colonne « aucune garde » est un *tri*, pas un verdict. Les quarante corps
doivent être lus un par un — le balayage dit seulement par lesquels commencer.

Restent deux écritures réellement sans garde :

| Fonction | Ce qu'elle fait | Gravité |
|---|---|---|
| `dawini_expire_old` | `UPDATE dawini_requests SET status='expired' WHERE status='pending' AND expires_at <= now()` | **faible** — idempotente, n'affecte que des lignes déjà échues ; un appelant anonyme ne peut qu'avancer un travail que le ménage ferait de toute façon |
| `fn_check_rate_limit` | `INSERT` + `UPDATE` sur `rate_limits` | **à lire** — non gardée *par conception*, puisqu'elle **est** la garde ; mais appelable par `anon` signifie qu'on peut alimenter des compteurs pour une clé arbitraire, donc potentiellement verrouiller un tiers |

`fn_check_rate_limit` est la seule à instruire. Un limiteur de débit qu'un anonyme peut alimenter
pour la clé de quelqu'un d'autre est un déni de service sur mesure.

## L'autre défaut, qui ne concerne pas les écritures

**Quatre fonctions `SECURITY DEFINER` exécutables par `anon` n'ont AUCUN `search_path` déclaré :**

`admin_validate_doctor` · `current_doctor_profile_id` · `current_user_role` · `refresh_doctor_rating`

C'est le vecteur d'escalade documenté : sans `search_path` fixé, une fonction `SECURITY DEFINER`
résout ses noms dans le chemin **de l'appelant**, qui peut y placer ses propres objets. Et
`admin_validate_doctor` **écrit**.

C'est `CE QUI DEPEND DE L'AMBIANCE N'EST PAS DECIDE, IL EST SUBI`, quatrième fois du jour — après le
fuseau du navigateur, la clé lue à l'évaluation du module, et les six appels pgcrypto. Le même défaut
a maintenant produit une panne fonctionnelle *et* une surface d'escalade.

**Ces quatre-là passent probablement avant les écritures**, parce qu'elles ne demandent aucune
décision : ajouter `SET search_path TO 'public','pg_temp'` ne change le comportement d'aucune, et
ferme le vecteur.

## Les trois listes — mesure du 13/09/2026, exécutée directement

**57 fonctions `SECURITY DEFINER` exécutables par `anon`** (59 avant les deux `REVOKE`).

Deux distinctions que le premier balayage n'avait pas, et qui changent le chiffre du simple au
décuple.

**Première : dix-sept sont des fonctions de DÉCLENCHEUR.** PostgREST n'expose pas les fonctions dont
le type de retour est `trigger` : un visiteur anonyme ne peut pas les appeler. Elles restent à
auditer pour ce qu'elles font *quand un déclencheur les invoque*, mais elles ne sont pas une porte.

**Seconde : la garde peut être INDIRECTE.** `dawini_respond` ne contient pas `auth.uid()`, et le
balayage l'avait donc classée « sans garde ». Son corps commence pourtant par :

```sql
v_pharm_id uuid := public.dawini_my_pharmacy_id();
IF v_pharm_id IS NULL THEN RAISE EXCEPTION 'not_a_pharmacy' USING ERRCODE = '28000'; END IF;
```

La garde est là, une fonction plus loin. Chercher `auth.uid()` littéralement produit des faux
positifs de gravité — exactement ce que la règle du dépôt dit de ne pas faire : **le balayage dit par
où commencer, il ne conclut pas.** La mesure ci-dessous résout un niveau d'indirection.

### A — Écrit SANS aucune garde : **2** (à fermer)

| Fonction | Ce qu'elle écrit | Ce qu'un anonyme peut en faire |
|---|---|---|
| `dawini_expire_old()` | `UPDATE dawini_requests SET status='expired' WHERE status='pending' AND expires_at <= now()` | **Rien de nuisible** : le `WHERE` est temporel, pas contrôlé par l'appelant. Appeler tôt ne fait rien de plus que le `pg_cron`. Écriture non authentifiée quand même — à réserver au rôle de tâche. |
| `fn_check_rate_limit(p_key text, …)` | `INSERT`/`UPDATE` sur `rate_limits`, **clé fournie par l'appelant** | **Réel.** Appeler en boucle avec la clé d'un tiers pousse `attempts` au-delà du plafond et pose `blocked_until` : **blocage ciblé d'un autre utilisateur**. Et toute chaîne acceptée comme clé ⇒ croissance non bornée de la table. |

`fn_check_rate_limit` répond à la ligne laissée ouverte plus haut — « prouver que sa clé n'est pas
arbitrairement choisie par l'appelant ». **Elle l'est.** La signature est `p_key text`, sans aucune
dérivation depuis la session.

### B — Écrit AVEC une garde lue : **9** (à vérifier une par une, plus tard)

`admin_validate_doctor`, `claim_my_doctor_profile`, `dawini_cancel_alert`, `dawini_create_alert`,
`dawini_create_request`, `dawini_respond`, `update_my_doctor_profile`, `upsert_patient_medical_data`.

La garde est **lue** ; qu'elle soit *suffisante* reste à établir corps par corps. Une garde présente
n'est pas une garde correcte.

### C — Ne fait que lire : **29** (liste blanche candidate)

`_api_is_admin_safe`, `admin_doctor_doc_paths`, `admin_validation_counts`, `admin_validation_list`,
`admin_validation_total`, `appointment_slot_is_available`, `can_review_doctor`,
`check_doctor_account_exists`, `chercher_praticiens`, `current_doctor_profile_id`,
`current_user_role`, `dawini_can_view_object`, `dawini_get_patient_contact`, `dawini_my_pharmacy_id`,
`dawini_my_pharmacy_wilaya`, `dawini_pharmacy_stats`, `dawini_shortage_by_wilaya`,
`dawini_top_missing`, `dawini_zone_active`, `get_available_slots`, `get_my_doctor_profile`,
`get_patient_medical_data`, `is_admin`, `is_doctor_bookable`, `praticien`, `praticiens_carte`,
`praticiens_par_ids`, `seo_couples`, `stats_publiques`.

**Candidate, pas acquise** : `get_patient_medical_data` et `admin_doctor_doc_paths` lisent des
données sensibles. Ne rien écrire ne veut pas dire ne rien exposer.

### D — Déclencheurs, hors périmètre RPC : **17**

`appointments_secretaire_limit`, `appointments_set_cabinet_from_doctor`, `dawini_alerts_on_available`,
`doctor_schedule_protect`, `enforce_appointment_availability`, `fn_audit_changes`,
`fn_handle_review_report`, `fn_update_doctor_rating`, `fn_verify_review`, `handle_new_auth_user`,
`lock_doctor_protected_columns`, `notifications_protect`, `refresh_doctor_rating`,
`tg_appointment_confirmed_outbox`, `tg_message_after_insert`, `tg_notify_appointment`,
`video_sessions_protect_columns`.

## Ce qui reste à faire

- [ ] Lire les **40 corps** un par un sous l'angle « que peut en faire un visiteur anonyme ».
      Le balayage dit par où commencer, il ne conclut pas.
- [ ] Trancher `fn_check_rate_limit` : la retirer de `anon`, ou prouver que sa clé n'est pas
      arbitrairement choisie par l'appelant.
- [ ] Déclarer le `search_path` des quatre.
- [ ] Décider du sort d'`ensure_rls` : absent du dépôt, absent de l'historique git, et pourtant il
      met 55 tables sur 55 sous RLS. Utile, probablement — mais **un mécanisme que personne n'a écrit
      dans le dépôt doit y être écrit, ou retiré.**
- [ ] Purger les 16 partitions `api_usage_log_*` : 0 ligne, aucun appelant, l'API partenaires n'a
      jamais eu de point d'entrée.

## La règle que cette carte illustre

> **Un périmètre qu'on exclut d'un durcissement doit être nommé, daté, et rouvert.**

La liste blanche du 12/09 a écrit « EXECUTE intact, 289 fonctions ». C'était honnête : le périmètre
était borné et la borne était écrite. Ce qui a manqué, c'est la **reprise** — un mois plus tard,
personne n'était revenu sur la phrase, et une porte de DDL anonyme est restée ouverte derrière elle.

Un durcissement partiel est légitime. Un durcissement partiel dont l'exclusion n'a pas de date de
réexamen devient une couverture : la ligne rassure au lieu d'alerter.
