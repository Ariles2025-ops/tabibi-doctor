# SQL TODO — Phase 5.2 (à exécuter en session SQL dédiée)

Liste des besoins SQL identifiés pendant Phase 5.2 frontend.
**NE PAS EXÉCUTER** depuis le frontend — tout sera regroupé en fin de mission.

---

## Phase 5.2.3-fix (2026-05-22) — affichage nom médecin

### TODO-SQL-001 : Vérifier que `public_doctors` view expose `entity_type`
**Contexte** : Le helper `js/tabibi-doctor-name.js` (Task 0) conditionne le préfixe "Dr." sur `entity_type` (Médecin → préfixe ; Clinique/Laboratoire/Cabinet → pas de préfixe). On lit cette colonne via `select=*` sur la vue `public_doctors`.

**À vérifier en SQL** :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='public_doctors'
  AND column_name='entity_type';
```
- Si présent : ✅ OK rien à faire.
- Si absent : ajouter `entity_type` au `CREATE VIEW public_doctors` (sans casser les autres consumers).

**Risque sans fix** : `entity_type` arrive undefined côté JS → fallback "Dr." appliqué à tous (y compris cliniques/labos). Régression cosmétique uniquement, pas bloquant.

### TODO-SQL-002 : Investiguer la source de "Dr. م .ي." / "Dr. – . a." dans `full_name`
**Contexte** : Symptôme rapporté Phase 5.2.3-fix : la liste publique affiche des noms garblés ("Dr. م .ي.", "Dr. – . a.") même pour des fiches dont le `full_name` est censé être propre côté DB (ex : "Ouanza Dental Clinic"). Le fix JS (suppression de `_anonymizeName`) affiche désormais `full_name` tel quel — si la VUE elle-même renvoie une string anonymisée, le bug persistera côté affichage.

**À vérifier en SQL** :
```sql
-- 1. Lire la def de la vue
SELECT pg_get_viewdef('public.public_doctors', true);

-- 2. Comparer raw vs view pour un doctor connu
SELECT id, full_name, full_name_ar, entity_type, is_claimed
FROM public.doctor_profiles
WHERE full_name ILIKE '%Ouanza%' OR full_name ILIKE '%Dental%';

SELECT id, full_name, full_name_ar, entity_type, is_claimed
FROM public.public_doctors
WHERE full_name ILIKE '%Ouanza%' OR full_name ILIKE '%Dental%';

-- 3. Échantillon des full_name de fiches non-claim (suspect anonymisation SQL)
SELECT full_name, COUNT(*)
FROM public.public_doctors
WHERE is_claimed = false
GROUP BY full_name
ORDER BY COUNT(*) DESC
LIMIT 20;
```
- Si la vue anonymise via `CASE WHEN is_claimed THEN full_name ELSE initials END` → décider :
  - (a) Désactiver l'anonymisation SQL pour la M0 (RGPD à valider par juriste séparément)
  - (b) Améliorer l'algo d'anonymisation côté SQL pour gérer correctement l'arabe et les noms non-personnels (cliniques/labos affichés tels quels)
- Si la vue retourne `full_name` brut et la donnée DB est mauvaise → cleanup des `doctor_profiles.full_name` (script séparé, scope hors mission).

---

## Phase 12 (déjà tracé dans PROGRESS.md, recopié ici pour vue d'ensemble)
- DB hygiène : nettoyer doublon `claim_my_doctor_profile()` sans args
- DB sécurité : aligner `public_doctors`, `public_doctor_full` sur `security_invoker=true`
- Storage : durcir `doctor_photos_select_public` anti-énumération
- Audit log : tracer changements `phone`/`address` via `update_my_doctor_profile`

## Format pour nouveaux ajouts
Numéroter `TODO-SQL-NNN`. Inclure : contexte (quelle Phase a découvert le besoin), commande SQL de vérif, action recommandée, risque si non-traité.
