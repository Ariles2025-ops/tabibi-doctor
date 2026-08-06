# Audit sécurité — fonctions SECURITY DEFINER exposées à `anon`

**Date** : 2026-07-29 · **Base** : `pudugodhiofqrctcdwfl` (EU) · **Méthode** : lecture seule
(`pg_proc.proacl`, `prosecdef`, puis relecture du corps de chaque fonction concernée).

## Verdict

> ✅ **SAFE — aucun correctif urgent.**
> Les 7 fonctions sensibles accessibles au rôle `anon` sont toutes `SECURITY DEFINER`, mais
> **chacune porte sa propre garde interne**. Le `GRANT` à `anon` ne donne donc accès à rien :
> un appelant non authentifié est rejeté **par le corps de la fonction**, pas par les
> permissions.

Rappel du modèle : dans Supabase, `anon` est le rôle porté par **toute** requête venant du
navigateur *avant* authentification — mais aussi le rôle de départ d'une session
authentifiée avant que le JWT ne soit appliqué. Beaucoup de RPC légitimes sont donc
`GRANT`ées à `anon` par construction ; ce qui compte est la garde interne.

---

## Les 7 fonctions auditées

| Fonction | Garde interne constatée | Verdict |
|---|---|---|
| `admin_validate_doctor` | `is_admin()` | ✅ safe |
| `admin_validation_list` | `is_admin()` | ✅ safe |
| `admin_validation_counts` | `is_admin()` | ✅ safe |
| `admin_validation_total` | `is_admin()` | ✅ safe |
| `admin_doctor_doc_paths` | `is_admin()` | ✅ safe |
| `get_patient_medical_data` | `auth.uid()` + filtre sur `patient_id` | ✅ safe |
| `upsert_patient_medical_data` | `auth.uid()` + filtre sur `patient_id` | ✅ safe |

**Lecture** : un appel anonyme à `admin_validation_list` ne renvoie pas la liste des médecins
en attente — il échoue sur `is_admin()`. Un patient authentifié appelant
`get_patient_medical_data` ne peut lire que **ses** données : le filtre `patient_id = auth.uid()`
est appliqué à l'intérieur de la fonction, pas laissé à l'appelant.

---

## Recommandation optionnelle — défense en profondeur

Le dispositif actuel repose sur **une seule ligne de défense** : la garde interne. Elle est
correcte aujourd'hui, mais une refonte future d'une de ces fonctions qui oublierait le
`is_admin()` exposerait immédiatement des données d'administration à Internet.

Retirer `EXECUTE` au rôle `anon` ajoute une **seconde barrière** sans rien changer au
fonctionnement : ces 7 fonctions ne sont jamais appelées sans session (pages `admin-*`
et parcours patient connecté).

### SQL prêt à exécuter — ⚠️ NON EXÉCUTÉ

Le bloc découvre lui-même les signatures (utile en cas de surcharges) :

```sql
-- 1. ÉTAT AVANT — qui a le droit d'exécuter quoi
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       coalesce(array_to_string(p.proacl, ' | '), '(défaut)') AS droits
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('admin_validate_doctor','admin_validation_list',
                     'admin_validation_counts','admin_validation_total',
                     'admin_doctor_doc_paths',
                     'get_patient_medical_data','upsert_patient_medical_data')
 ORDER BY p.proname;

-- 2. REVOKE (toutes surcharges incluses)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('admin_validate_doctor','admin_validation_list',
                         'admin_validation_counts','admin_validation_total',
                         'admin_doctor_doc_paths',
                         'get_patient_medical_data','upsert_patient_medical_data')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    RAISE NOTICE 'REVOKE anon → %', r.sig;
  END LOOP;
END $$;

-- 3. VÉRIFICATION — 'anon=X/postgres' doit avoir disparu (relancer la requête 1)
```

**Rollback** — remplacer `REVOKE EXECUTE ... FROM anon` par
`GRANT EXECUTE ... TO anon` dans la boucle ci-dessus.

### Test de non-régression avant/après

À faire une fois connecté sur chaque parcours concerné :

1. `admin-doctor-validation.html` avec un compte **admin** → la liste se charge toujours.
2. `patient-profile.html` avec un compte **patient** → les données médicales se chargent
   et s'enregistrent toujours.
3. `legal/rgpd-droits.html` connecté → l'export des données fonctionne toujours.

Si l'un de ces parcours casse après le REVOKE, c'est qu'un appel se fait sans session
authentifiée — ce serait alors un **bug à corriger côté front**, pas une raison de rétablir
le `GRANT`.

---

## Item connexe — RPC orpheline exposée à `anon`

Signalé lors de l'audit du 29/07 et **toujours ouvert** :
`public.match_doctor_for_claim(BIGINT, TEXT)` est `GRANT`ée à `anon`
(`migrations/CRIT-4_step3_rpc_claim.sql:60`) mais **n'est appelée nulle part** dans le front
(0 occurrence dans `js/` et `*.html` — le parcours de réclamation utilise
`claim_my_doctor_profile`). Surface d'attaque sans contrepartie fonctionnelle.

```sql
REVOKE EXECUTE ON FUNCTION public.match_doctor_for_claim(BIGINT, TEXT) FROM anon;
```

*(non exécuté — voir `AUDIT_RESTANT_2026-07-29.md`)*

---

## Périmètre non couvert

Cet audit porte sur les **droits d'exécution** des fonctions. Il ne remplace pas :
- l'audit des **policies RLS** table par table (requête (d) du dump de schéma) ;
- la vérification de `security_invoker` sur les **vues** `public_doctors` / `public_doctor_full`
  (item ouvert de `SQL_TODO.md`) ;
- le test **cross-user A↔B** (nécessite `service_role`, tracé dans `ETAT_DES_LIEUX.md` CRIT-1).
