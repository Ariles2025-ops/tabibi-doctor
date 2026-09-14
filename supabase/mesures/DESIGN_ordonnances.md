# Design — les quatre RPC d'ordonnance

**14/09/2026. PROPOSITION, rien n'est applique.** Le brouillon SQL est
`supabase/migrations/20260914_ordonnances_rpc.sql` : il est **ECRIT et NON APPLIQUE**, et
il ne compte pas comme migre tant que le stratege ne l'a pas relu ligne a ligne.

Le drapeau `prescriptions: false` **n'est pas touche**.

---

## 0. TROIS CHOSES A LIRE AVANT LE RESTE

Elles changent ce qu'on peut promettre, et deux d'entre elles n'etaient dans aucune liste.

### 0.1 ⚠️ La RLS de `prescriptions` s'annule elle-meme

**Six politiques, toutes `PERMISSIVE`** — donc combinees en **OU**. Deux familles se
superposent, et la laxiste efface la stricte :

| cmd | stricte (`presc_*`) | laxiste (`rx_*`) | effet reel |
|---|---|---|---|
| INSERT | `doctor_id=auth.uid()` **ET** `patient_id<>auth.uid()` **ET** `status='draft'` **ET** pas de signature **ET** pas de pdf | `doctor_id = auth.uid()` | **la laxiste gagne** : un medecin peut inserer une ligne deja `signed`, ou se prescrire a lui-meme |
| UPDATE | `doctor_id=auth.uid()` **ET** `status ∈ (draft,signed,delivered)` | `doctor_id = auth.uid()` | **la laxiste gagne** : une ordonnance `cancelled` reste modifiable |
| SELECT | patient, medecin, admin | + les medecins du cabinet | elargissement, probablement voulu |

> **`presc_insert_doctor` et `presc_update` ne servent a rien aujourd'hui.** Elles decrivent
> la regle qu'on veut ; `rx_insert_doctor` et `rx_update_doctor` l'autorisent quand meme.
> C'est la meme famille que la politique « Only admins read audit » : **un dispositif
> present qui ne fait pas ce que son nom annonce.**

**Consequence pour ce design** : les quatre RPC sont `SECURITY DEFINER`, donc elles
contournent la RLS de toute facon. Elles porteront la machine a etats **dans leur corps**.
Mais **le chemin direct par la table reste ouvert** tant que les `rx_*` sont la : un
medecin authentifie peut ecrire dans `prescriptions` sans passer par les RPC.

> **A TRANCHER, ET CE N'EST PAS DANS CE LOT** : supprimer `rx_insert_doctor` et
> `rx_update_doctor`, ou fusionner les deux familles. Tant que ce n'est pas fait, les RPC
> sont une porte bien gardee **a cote d'une porte ouverte.**

### 0.2 ⚠️ Aucune RPC ne peut faire passer une ordonnance a `signed`

```sql
CHECK ((status <> 'signed') OR (pdf_sha256 IS NOT NULL
                            AND doctor_signature_hmac IS NOT NULL
                            AND pdf_storage_path IS NOT NULL))
```

Les trois champs ne peuvent venir que du PDF. **Et le PDF n'a pas de producteur** :

```
Edge functions deployees, mesure du 14/09 : send-sms (v17), verify-turnstile (v7),
appointment-reminders (v7), sms-dlr (v4).   C'EST TOUT.
```

**`generate-prescription-pdf` n'existe pas. `verify-prescription` non plus** — et c'est
elle qu'appelle `verify-prescription.html:234`. La verification publique d'une ordonnance
est donc cassee de bout en bout, en plus de la signature.

**Ce design ne promet donc PAS la signature.** `request_prescription_signature` est un
**verrou de porte**, pas une transition : elle valide que l'ordonnance est signable et
refuse si elle ne l'est pas. **Le passage a `signed` appartient a l'edge function**, avec
le `service_role`, quand elle existera.

Dire l'inverse fabriquerait exactement le defaut de la journee : un bouton qui annonce ce
qu'il ne fait pas.

### 0.3 Une contrainte mal nommee, signalee sans etre corrigee

```sql
presc_cancelled_has_reason  CHECK ((status <> 'cancelled') OR (cancelled_at IS NOT NULL))
```

Elle s'appelle **`has_reason`** et ne verifie **que `cancelled_at`**. `cancelled_reason`
peut rester `NULL`. Le nom promet plus que le CHECK.
**Je ne la renomme pas** (ce serait un `ALTER TABLE` hors perimetre) ; les RPC, elles,
**exigeront un motif non vide** — la regle vit dans la fonction, et le nom cesse de mentir.

---

## 1. CE QUE LE FRONT ENVOIE, EXACTEMENT

C'est lui qui fixe les signatures : on ne change pas le front dans ce lot.

### `medications` — la forme du `jsonb` (`medecin-ordonnance.html:381-395`)

```js
meds.push({
  name,                                   // string, requis (ligne ignoree si vide)
  dosage:    ... || null,                 // string | null
  frequency: ... || null,
  duration:  ... || null,
  notes:     ... || null,
});
```

Un **tableau d'objets**. `name` est le seul champ requis (`maxlength="200"`, `required`).
Le front plafonne a **30 lignes** (`medecin-ordonnance.html:611`) et refuse un envoi vide
(`mo_med_required`).

### Les quatre appels

| RPC | Arguments envoyes | Ce que le front fait du retour |
|---|---|---|
| `create_prescription_draft` | `p_patient_id` (uuid, requis) · `p_appointment_id` (uuid \| **null**) · `p_medications` (tableau) · `p_diagnosis` (text\|null) · `p_clinical_notes` (text\|null) · `p_validity_days` (int, defaut 30) | **`currentPrescriptionId = data`** → attend **l'identifiant nu**, pas un objet |
| `update_prescription_draft` | `p_prescription_id` · `p_medications` · `p_diagnosis` · `p_clinical_notes` · `p_validity_days` | `if (error) throw` — ne lit que le transport |
| `request_prescription_signature` | `p_prescription_id` | `if (gateErr) throw` — puis appelle l'edge |
| `mark_prescription_delivered` | `p_prescription_id` · `p_channel` | **rien** — best-effort, `catch` vide |

**`p_channel`** vaut `'download'` ou `'whatsapp'` (`patient-ordonnances.html:255,270`).

> **`create_prescription_draft` doit rendre un `uuid` nu**, pas un `jsonb {ok,id}`. Le
> front fait `currentPrescriptionId = data`. Rendre un objet casserait la page.

---

## 2. CE QUI EXISTE DEJA EN BASE

| | |
|---|---|
| `public.prescriptions` | 24 colonnes, **0 ligne**, RLS active, `FORCE` false, grants `authenticated, postgres, service_role` |
| `status` | `CHECK ∈ {draft, signed, delivered, cancelled}`, defaut `'draft'` |
| `validity_days` | `CHECK 1..365`, defaut 30 |
| `prescription_number` | `NOT NULL`, **UNIQUE** |
| `medications` | `jsonb NOT NULL DEFAULT '[]'` |
| `next_prescription_number()` | `SECURITY DEFINER`, `search_path` fige. Remet la sequence a 1 au changement d'annee, sous `FOR UPDATE`. Rend `RX-2026-000001` |
| `prescriptions_set_expiry()` | declencheur `BEFORE INSERT OR UPDATE OF issue_date, validity_days` : `expiry_date := issue_date + validity_days`. **Rien a faire dans les RPC** |
| `tabibi_touch_updated_at()` | declencheur `BEFORE UPDATE`. **Idem** |

---

## 3. LA MACHINE A ETATS

```
            create_prescription_draft
                      │
                      ▼
                  ┌───────┐   update_prescription_draft  (boucle, brouillon seul)
                  │ draft │◄──────────────┐
                  └───┬───┘               │
                      │                   │
   request_prescription_signature ────────┘   (VERROU : valide, ne change PAS le statut)
                      │
                      ▼
             [ edge generate-prescription-pdf, service_role ]   ← N'EXISTE PAS
                      │
                      ▼
                  ┌────────┐   mark_prescription_delivered
                  │ signed │──────────────┐
                  └───┬────┘              ▼
                      │             ┌───────────┐
                      │             │ delivered │
                      │             └───────────┘
                      ▼
                 (cancelled — hors de ce lot : aucune RPC du front ne l'appelle)
```

**`cancelled` n'a pas de RPC dans ce lot** : le front n'en appelle aucune. La colonne et le
CHECK existent ; on ne fabrique pas une fonction pour un bouton qui n'existe pas.

---

## 4. LES QUATRE RPC

Toutes : `SECURITY DEFINER`, `SET search_path TO 'public','pg_temp'`, et **le regime
d'audit PREUVE** decrit au §5.

### 4.1 `create_prescription_draft(...) RETURNS uuid`

**Qui** — le medecin qui cree, et lui seul : `doctor_id := auth.uid()`. **Jamais un
parametre** — c'est la regle de toutes les gardes du depot : on cadre par la SESSION.

**Refus** (tous par `RAISE EXCEPTION`, car le front fait `if (error) throw`) :

| Cause | Code |
|---|---|
| pas de session | `not_authenticated` |
| l'appelant n'est pas medecin (`users.role ∉ {medecin,doctor}`) | `not_a_doctor` |
| `p_patient_id` absent, ou **egal a l'appelant** | `invalid_patient` |
| `p_appointment_id` fourni mais le RDV n'est pas celui de ce medecin **et** de ce patient | `appointment_mismatch` |
| `p_medications` n'est pas un tableau, est vide, ou depasse **30** | `invalid_medications` |
| un element sans `name` non vide, ou `name` > 200 | `invalid_medication_name` |
| `p_validity_days` hors **1..365** | `invalid_validity` |

**Fait** — un `INSERT` avec `status='draft'`, `prescription_number :=
next_prescription_number()`, `cabinet_id` repris du RDV s'il y en a un. **Rend l'`id`.**

> **Pourquoi `appointment_mismatch` :** sans ce controle, un medecin pourrait rattacher son
> ordonnance au rendez-vous d'un confrere. `appointment_id` est nullable, donc le controle
> **ne s'applique que si la valeur est fournie** — on ne rend pas obligatoire ce que le
> front laisse optionnel.

### 4.2 `update_prescription_draft(...) RETURNS void`

**Qui** — le medecin **proprietaire de l'ordonnance**, et **seulement en `draft`**.

| Cause | Code |
|---|---|
| introuvable, ou `doctor_id <> auth.uid()` | `not_found_or_not_owner` |
| `status <> 'draft'` | `not_a_draft` |
| memes controles de contenu qu'au 4.1 | idem |

**Le meme code pour « introuvable » et « pas a vous » est volontaire** : distinguer les
deux dirait a un medecin qu'une ordonnance existe chez un confrere.

**Ne touche jamais** a `prescription_number`, `doctor_id`, `patient_id`, `status`, ni aux
champs de PDF.

### 4.3 `request_prescription_signature(p_prescription_id uuid) RETURNS void`

**C'est un VERROU, pas une transition.** Elle ne change **aucun** statut — voir §0.2.

| Cause | Code |
|---|---|
| introuvable, ou pas le proprietaire | `not_found_or_not_owner` |
| `status = 'signed'` | `already_signed` |
| `status ∈ {delivered, cancelled}` | `not_signable` |
| aucun medicament | `invalid_medications` |
| `expiry_date < CURRENT_DATE` | `already_expired` |

Si tout passe : elle **rend la main** (et ecrit sa trace d'audit). L'edge function prend le
relais. **Le jour ou elle existera**, c'est elle qui posera `status='signed'` avec les trois
champs de PDF, sous `service_role`.

### 4.4 `mark_prescription_delivered(p_prescription_id uuid, p_channel text) RETURNS void`

**Qui** — le **patient** de l'ordonnance, ou son medecin.

| Cause | Code |
|---|---|
| introuvable, ou ni patient ni medecin | `not_found_or_not_allowed` |
| `status <> 'signed'` et `<> 'delivered'` | `not_delivered_state` |
| `p_channel ∉ {download, whatsapp, email, print}` | `invalid_channel` |

**Fait** — `status := 'delivered'`, `delivered_at := COALESCE(delivered_at, now())`,
et **ajoute le canal** a `delivery_channels` s'il n'y est pas.

> **Idempotente, et c'est voulu** : le front l'appelle a chaque telechargement.
> `delivered_at` garde la **premiere** remise ; `delivery_channels` accumule les canaux.
> Une deuxieme remise n'ecrase pas la premiere date.
>
> **`{email, print}` sont admis bien que le front n'envoie que `download` et `whatsapp`** :
> la colonne existe pour ca, et une liste trop etroite obligerait a une migration pour un
> bouton. Toute autre valeur est refusee — on n'accepte pas une chaine libre dans une
> colonne qui sert de trace.

---

## 5. LE REGIME D'AUDIT — PREUVE, pour les quatre

Aucune de ces ecritures n'est CONSTITUTIVE au sens du critere
(`supabase/mesures/20260913_regime_audit_log.sql`) : **la table `prescriptions` porte
elle-meme tout le fait** — qui, quand, quoi, quel statut, quels canaux. L'audit est une
piece a cote, pas le seul exemplaire.

Les quatre portent donc le bloc standard, **jamais `THEN NULL`** :

```sql
  BEGIN
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, after_data)
    VALUES (v_actor, 'prescription:<verbe>', 'prescription', v_id, jsonb_build_object(...));
  EXCEPTION WHEN OTHERS THEN
    v_etat := SQLSTATE; v_msg := SQLERRM;
    BEGIN
      INSERT INTO public.audit_log_echecs(fonction, sqlstate, sqlerrm, user_id, action,
                                          table_name, record_id, after_data)
      VALUES (...);
      RAISE WARNING 'audit_log: prescription:<verbe> non ecrit (% %) — mis au rebut', v_etat, v_msg;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log: prescription:<verbe> non ecrit (% %) ET rebut en echec (% %)',
                    v_etat, v_msg, SQLSTATE, SQLERRM;
    END;
  END;
```

Actions : `prescription:create`, `prescription:update`, `prescription:sign_request`,
`prescription:deliver`.

**`after_data` ne contient JAMAIS `medications`, `diagnosis` ni `clinical_notes`** — ce
sont des donnees de sante, et `audit_log` est lisible par les administrateurs. On y met le
**nombre** de medicaments, le statut, le canal. **Une trace n'a pas besoin du contenu du
soin pour etre une trace.**

---

## 6. CE QUI N'EST PAS DANS CE LOT

- **La dispensation reelle** du medicament : hors sujet, ce lot ne couvre que le cycle de
  vie de l'ordonnance.
- **Le passage a `signed`** : il appartient a l'edge function, qui n'existe pas.
- **`cancelled`** : aucun bouton ne l'appelle.
- **Le drapeau `prescriptions: false`** : **on n'y touche pas.** Il ne s'ouvre qu'apres
  application + `plpgsql_check` a 0 defaut + un e2e du parcours.
- **La deduplication des politiques RLS** (§0.1) : c'est une decision, elle a sa propre
  migration, et elle doit venir **avant** l'ouverture du drapeau.

---

## 7. CE QUE JE DEMANDE AVANT D'ALLER PLUS LOIN

1. **Les codes de refus** : tu les prends tels quels, ou tu en renommes ?
2. **`{email, print}` dans `p_channel`** : on les admet d'avance, ou on s'en tient aux deux
   que le front envoie ?
3. **Les politiques `rx_*`** (§0.1) : on les supprime, on les fusionne, ou on assume ? **Ce
   n'est pas cosmetique** : tant qu'elles sont la, les RPC gardent une porte a cote d'une
   porte ouverte.
4. **La signature** (§0.2) : confirmes-tu que `request_prescription_signature` reste un
   verrou, et que le passage a `signed` attend l'edge function ?
