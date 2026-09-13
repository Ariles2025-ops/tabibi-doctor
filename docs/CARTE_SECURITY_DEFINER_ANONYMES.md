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
