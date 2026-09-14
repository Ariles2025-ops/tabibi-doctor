# Proposition — la RLS de `public.prescriptions`

**14/09/2026. PROPOSITION. Rien n'est applique, aucune politique n'est touchee.**
Tu tranches, puis on applique en deux paires d'yeux.

---

## 0. ⚠️ JE CORRIGE D'ABORD MON PROPRE RAPPORT

Dans `DESIGN_ordonnances.md` §0.1, j'ai ecrit :

> *« le chemin direct par la table reste ouvert : un medecin authentifie peut ecrire dans
> `prescriptions` sans passer par les RPC »*

**C'EST FAUX. Il n'y a pas de porte ouverte.**

Mesure faite depuis — celle que j'aurais du faire avant d'ecrire cette phrase :

```
information_schema.role_table_grants, public.prescriptions :
  authenticated  ->  SELECT            ← ET C'EST TOUT
  postgres       ->  SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  service_role   ->  idem
```

**`authenticated` n'a AUCUN droit d'ecriture.** Et la RLS ne s'evalue qu'**APRES** le
controle de privilege : sans `GRANT INSERT`/`UPDATE`, PostgREST ne peut rien ecrire dans
cette table, quelles que soient les politiques.

**Ce que j'avais vu** : `rls/force/grants = true / false / authenticated,postgres,
service_role`. J'ai lu « `authenticated` est dans la liste » et conclu « il peut ecrire ».
**Je n'ai pas regarde QUELS privileges.** C'est exactement l'erreur que j'ai moi-meme
relevee sur `audit_log` deux sequences plus tot — une politique inatteignable faute de
`GRANT` — et je l'ai refaite dans l'autre sens.

### Ce que ca change, et ce que ca ne change pas

| | |
|---|---|
| **Ne change pas** | Les quatre politiques d'ecriture **s'annulent bien entre elles** : `rx_insert_doctor` et `rx_update_doctor` sont plus laxistes que `presc_insert_doctor` et `presc_update`, et toutes sont `PERMISSIVE`, donc combinees en **OU**. Le constat est exact. |
| **Change** | Ce n'est **pas** un trou ouvert aujourd'hui. Les quatre sont **inatteignables** : personne ne peut ecrire par la table. |
| **Donc** | Ce n'est plus une **correction urgente**. C'est de la **profondeur de defense** : le jour ou quelqu'un ajoute `GRANT INSERT, UPDATE ... TO authenticated` — pour un ecran, pour un essai — **la regle laxiste gagnera en silence**. |

**Je ne descends pas la priorite pour autant.** Un piege arme qui attend un `GRANT` est
precisement ce qui se declenche un vendredi soir.

---

## 1. LES SIX POLITIQUES, TELLES QU'ELLES SONT

Toutes `PERMISSIVE`, toutes sur le role `authenticated`.

| # | nom | cmd | regle |
|---|---|---|---|
| 1 | `presc_insert_doctor` | INSERT | `doctor_id=uid` **ET** `patient_id<>uid` **ET** `status='draft'` **ET** `doctor_signature_hmac IS NULL` **ET** `pdf_sha256 IS NULL` |
| 2 | `rx_insert_doctor` | INSERT | `doctor_id = uid` |
| 3 | `presc_select` | SELECT | `patient_id=uid` **OU** `doctor_id=uid` **OU** `is_admin()` |
| 4 | `rx_select_visible` | SELECT | idem **OU** (`cabinet_id IS NOT NULL` **ET** `is_cabinet_doctor(cabinet_id)`) |
| 5 | `presc_update` | UPDATE | `(doctor_id=uid ET status ∈ {draft,signed,delivered})` **OU** `(patient_id=uid ET status ∈ {signed,delivered})` **OU** `is_admin()` · CHECK `doctor_id=uid OU patient_id=uid OU is_admin()` |
| 6 | `rx_update_doctor` | UPDATE | `doctor_id=uid` **OU** `is_admin()` |

**Trois observations qui ne sont pas dans le tableau :**

1. **En INSERT et en UPDATE, la laxiste absorbe la stricte.** 1 ∪ 2 = 2. 5 ∪ 6 ⊋ 5.
   Les politiques 1 et 5 ne decrivent donc qu'une intention.
2. **En SELECT, 4 ⊇ 3.** `rx_select_visible` est un sur-ensemble strict de `presc_select` :
   elle ajoute les medecins du cabinet. `presc_select` est **redondante**, pas nuisible.
3. **`presc_update` laisse le PATIENT modifier** une ordonnance `signed` ou `delivered` —
   son `CHECK` n'interdit que de changer de proprietaire. Si un `GRANT UPDATE` arrivait,
   **un patient pourrait reecrire `medications` de sa propre ordonnance signee.**
   Ce n'est pas la politique laxiste `rx_*` qui pose ca : **c'est la « stricte ».**

---

## 2. LES DEUX BASCULES POSSIBLES

### Option A — rendre les `presc_*` `RESTRICTIVE`

`AS RESTRICTIVE` s'applique en **ET** apres le **OU** des permissives.

```
  autorise  =  (OU des PERMISSIVE)  ET  (ET des RESTRICTIVE)
```

Donc `(rx_insert) ET (presc_insert)` = `presc_insert`, qui est la plus stricte. Ca marche.

**Mais ca cree une dependance invisible.** Une table qui n'a **que** des RESTRICTIVE et
aucune PERMISSIVE **refuse tout**. Ici, la base permissive serait `rx_insert_doctor` : si
quelqu'un la supprime un jour en la croyant redondante, **tout se ferme d'un coup**, et
rien dans le nom des politiques ne l'annonce.

Et il faut connaitre la semantique OU/ET de PostgreSQL pour lire la regle. **Toute la
semaine a montre que les gardes doivent etre lisibles.**

### Option B — supprimer les deux laxistes d'ecriture ✅ **recommandee**

```sql
DROP POLICY rx_insert_doctor  ON public.prescriptions;
DROP POLICY rx_update_doctor  ON public.prescriptions;
```

Il reste **une seule politique par commande d'ecriture**, celle dont le nom dit ce qu'elle
fait. Pas de semantique a connaitre, pas de dependance cachee.

`rx_select_visible` **reste** (elle porte l'acces des medecins du cabinet).
`presc_select` **reste aussi** : elle est redondante mais inoffensive, et **supprimer est
l'operation dangereuse de ce depot** — on ne supprime pas ce qui ne gene pas.

**Ce que B ne corrige PAS, et qu'il faut decider a part** : le point 1.3 — `presc_update`
autorise le patient a modifier une ordonnance signee. Voir §3.

### Pourquoi B plutot que A

| | A (RESTRICTIVE) | B (supprimer les laxistes) |
|---|---|---|
| lisibilite | il faut connaitre OU/ET | une regle par commande |
| dependance cachee | **oui** — supprimer la permissive ferme tout | non |
| nombre de politiques | 6 | 4 |
| retour arriere | `ALTER POLICY` impossible sur `PERMISSIVE/RESTRICTIVE` → il faut DROP + CREATE | recreer les deux, definitions conservees ci-dessous |

---

## 3. CE QUE JE PROPOSE EN PLUS, ET QUE TU N'AS PAS DEMANDE

**`presc_update` laisse le patient modifier `medications` d'une ordonnance signee.**
Aujourd'hui inatteignable (pas de `GRANT UPDATE`), mais c'est la politique « stricte » qui
le permet — donc l'option B seule ne le ferme pas.

Un patient n'a **aucune** raison d'ecrire dans une ordonnance. Ce qu'il fait
legitimement — marquer une remise — passe par `mark_prescription_delivered`, qui est
`SECURITY DEFINER` et ne dependra jamais de cette politique.

```sql
-- remplacerait presc_update
CREATE POLICY presc_update ON public.prescriptions FOR UPDATE TO authenticated
  USING      (doctor_id = auth.uid() AND status IN ('draft','signed','delivered') OR is_admin())
  WITH CHECK (doctor_id = auth.uid() OR is_admin());
```

**Je ne l'ecris pas dans la migration tant que tu n'as pas tranche** : c'est un
changement de regle, pas un nettoyage.

---

## 4. L'ORDRE, ET LE RETOUR ARRIERE

1. `DROP POLICY rx_insert_doctor` · `DROP POLICY rx_update_doctor`
2. *(si tu retiens le §3)* `DROP POLICY presc_update` puis recreation sans la branche patient
3. `COMMENT ON POLICY` sur les quatre restantes, pour dire **qu'elles sont inatteignables
   sans `GRANT`** — comme on l'a fait pour « Only admins read audit ». Une politique qui ne
   s'applique jamais doit le dire, sinon le prochain lecteur conclura qu'elle protege.

**Definitions conservees MOT POUR MOT pour le retour arriere** (relevees le 14/09) :

```sql
CREATE POLICY rx_insert_doctor ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY rx_update_doctor ON public.prescriptions FOR UPDATE TO authenticated
  USING      (doctor_id = auth.uid() OR is_admin())
  WITH CHECK (doctor_id = auth.uid() OR is_admin());

CREATE POLICY presc_update ON public.prescriptions FOR UPDATE TO authenticated
  USING      (((doctor_id = auth.uid()) AND (status = ANY (ARRAY['draft','signed','delivered'])))
              OR ((patient_id = auth.uid()) AND (status = ANY (ARRAY['signed','delivered'])))
              OR is_admin())
  WITH CHECK ((doctor_id = auth.uid()) OR (patient_id = auth.uid()) OR is_admin());
```

**Verification apres application** — et c'est elle qui compte, pas le compte de politiques :

```sql
-- 1. il ne reste qu'une politique par commande d'ecriture
select cmd, count(*), string_agg(policyname, ', ')
  from pg_policies where schemaname='public' and tablename='prescriptions'
 group by cmd order by cmd;
-- attendu : INSERT 1 (presc_insert_doctor) · UPDATE 1 (presc_update) · SELECT 2

-- 2. LE POINT QUI COMPTE : aucune ecriture n'est ouverte a authenticated
select grantee, string_agg(privilege_type, ', ')
  from information_schema.role_table_grants
 where table_schema='public' and table_name='prescriptions' group by grantee;
-- attendu, INCHANGE : authenticated -> SELECT seul
```

⚠️ **Une non-regression a lire au navigateur, pas a deduire** : un medecin doit toujours
voir ses ordonnances, et un patient les siennes. On ne touche pas aux politiques SELECT,
donc le risque est faible — **il n'est pas nul**, et ce qu'on casserait serait l'acces d'un
patient a son ordonnance.

---

## 5. BLOQUE, PLUS TARD — la signature et la verification

**Je ne commence pas ce chantier.** Voici seulement ce qu'il faut, pour que la liste
existe.

### Ce qui manque

| | |
|---|---|
| `generate-prescription-pdf` | **non deployee.** Appelee par `medecin-ordonnance.html:568`. Sans elle, aucune ordonnance ne passe a `signed` : le `CHECK presc_signed_has_pdf` exige `pdf_sha256`, `doctor_signature_hmac` et `pdf_storage_path`. |
| `verify-prescription` | **non deployee.** Appelee par `verify-prescription.html:234`. La verification publique d'une ordonnance est cassee de bout en bout. |

Mesure du 14/09 — edge functions deployees : `send-sms` (v17), `verify-turnstile` (v7),
`appointment-reminders` (v7), `sms-dlr` (v4). **C'est tout.**

### Ce qu'il faudra, et dans quel ordre

1. **UN SECRET DE SIGNATURE, pose par Aghiles.** Meme famille que
   `app.tabibi_2fa_pepper` et `app.tabibi_ip_pepper` : une cle HMAC qui ne vit **que** dans
   la configuration, jamais dans le depot. **Je ne le poserai pas et je ne le lirai pas**
   (regles 4 et 6).
   - a trancher : GUC de base (`ALTER DATABASE ... SET`) ou variable d'environnement de
     l'edge function ? La seconde est plus naturelle pour du Deno, et evite qu'un
     `SECURITY DEFINER` puisse lire la cle par `current_setting`.
   - et sa **rotation** : une ordonnance signee avec l'ancienne cle doit rester
     verifiable. Il faut donc un identifiant de version de cle dans la signature.
     **C'est la vraie difficulte, et elle se decide avant la premiere signature**, pas apres.

2. **`generate-prescription-pdf`** (service_role) : lit l'ordonnance, refuse si
   `status <> 'draft'`, produit le PDF, le depose dans le bucket, calcule `pdf_sha256`,
   signe en HMAC, **puis** pose `status='signed'` avec les trois champs — en une seule
   transaction. C'est elle, et elle seule, qui fait la transition.
   `request_prescription_signature` reste le verrou en amont.

3. **`verify-prescription`** (publique, sans JWT) : prend `id` + `sig`, recalcule le HMAC,
   rend un verdict **sans jamais exposer le contenu medical** — un numero, une date, un
   etat, un nom de medecin. **Pas les medicaments.** Une page de verification publique qui
   afficherait le traitement serait une fuite de donnees de sante par conception.

4. **Un bucket de stockage** pour les PDF, avec sa politique : le patient et le medecin
   lisent, personne n'ecrit sauf `service_role`.

### Ce que ca implique pour le drapeau

`prescriptions: false` ne peut pas s'ouvrir tant que le point 2 n'existe pas : le medecin
verrait « Signer », l'appel partirait, et **le bouton annoncerait ce qu'il ne fait pas.**
C'est precisement la classe de defauts de la semaine.
