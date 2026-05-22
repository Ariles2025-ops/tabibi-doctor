# Tests manuels — RPC `get_available_slots` Phase 5.1bis

> **Phase** : 5.1bis
> **Date** : 2026-05-22
> **Cible** : Supabase SQL Editor (prod)
> **Pré-requis exécutés** :
> - `migrations/PHASE5_1bis_alter_appointments.sql` ✅ (5 policies propres + starts_at/ends_at GENERATED)
> - `migrations/PHASE5_1bis_get_available_slots_rpc.sql` ✅ (RPC + fixture working_hours)
> - `fixtures/test_doctor_blocages.sql` (Aïd el-Fitr + Aïd el-Adha) ✅
> - Compte test medecin.test claim sur fiche `023bbccc...` ✅

---

## Constantes

```
DOCTOR_ID = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'  (medecin.test)
PATIENT_ID = (SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor')
  (on réutilise le compte med pour les tests d'INSERT — RLS bypass en SQL Editor)

Horaires :
  dim 09-13 + 14-18 → 16 slots/30min
  lun 09-13 + 14-18 → 16 slots
  mar 09-13 + 14-18 → 16 slots
  mer 09-13 + 14-18 → 16 slots
  jeu 09-13         → 8 slots
  ven FERMÉ         → 0
  sam FERMÉ         → 0

Blocages (fixtures Aïd) :
  Aïd el-Fitr : 2026-03-20 → 2026-03-22 all_day
  Aïd el-Adha : 2026-05-27 → 2026-05-29 all_day
  Formation   : 2026-06-10 09:00 → 17:00 timed
```

---

## T1 — Jour ouvré normal (dimanche 2026-06-07)

```sql
SELECT slot_start, slot_end
  FROM public.get_available_slots(
    '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
    '2026-06-07'::date,
    30
  )
 ORDER BY slot_start;
```

**Attendu ✅** : 16 lignes (8 matin + 8 après-midi). Matin 09:00→09:30 ... 12:30→13:00. Après-midi 14:00→14:30 ... 17:30→18:00. Affichage UTC = Algiers - 1h.

**KO connu** : 0 lignes → working_hours pas seedée. 32 lignes → pause midi non respectée.

- [ ] ✅ Passé (___ lignes)
- [ ] ❌ Échec :

---

## T2 — Jour fermé (vendredi 2026-06-05)

```sql
SELECT slot_start, slot_end
  FROM public.get_available_slots(
    '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
    '2026-06-05'::date,
    30
  );
```

**Attendu ✅** : 0 lignes (working_hours['fri'] = `[]`).

**KO connu** : ≥ 1 ligne → mapping DOW vendredi cassé.

- [ ] ✅ Passé (0)
- [ ] ❌ Échec :

---

## T3 — Jour bloqué all_day (jeudi 2026-05-28, dans Aïd el-Adha 27-29)

```sql
SELECT slot_start, slot_end
  FROM public.get_available_slots(
    '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
    '2026-05-28'::date,
    30
  );
```

**Attendu ✅** : 0 lignes (Aïd el-Adha couvre cette date avec all_day=true, masquant les 8 slots normaux du jeudi).

**KO connu** : 8 lignes → check all_day BETWEEN dates cassé (probable bug timezone sur dus.starts_at AT TIME ZONE).

**Vérif annexe** :
```sql
SELECT id, starts_at, ends_at, all_day, reason
  FROM public.doctor_unavailable_slots
 WHERE doctor_id='023bbccc-e2ba-45ad-8c9a-8fca85da18fa' AND reason='Fermeture Aïd el-Adha';
-- ATTENDU : 1 ligne, all_day=true
```

- [ ] ✅ Passé (0)
- [ ] ❌ Échec :

---

## T4 — Soustraction blocage timed + RDV inséré (mercredi 2026-06-10)

**Setup** : la formation 2026-06-10 09:00-17:00 couvre la quasi-journée. Plus on insère un RDV à 17:30 pour valider le filtrage des appointments.

### Étape 1 — INSERT RDV manuel

```sql
INSERT INTO public.appointments
  (short_id, doctor_id, patient_id, scheduled_at, duration_minutes, status, reason)
VALUES (
  'TEST-PHASE5-T4',
  '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
  (SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor'),
  '2026-06-10 17:30:00+01'::timestamptz,
  30,
  'confirmed'::appointment_status,
  'Test E2E Phase 5.1bis T4'
);

-- Vérif que starts_at + ends_at sont bien calculés via GENERATED :
SELECT short_id, scheduled_at, duration_minutes, starts_at, ends_at, status
  FROM public.appointments
 WHERE short_id = 'TEST-PHASE5-T4';
-- ATTENDU : 1 ligne, starts_at=scheduled_at, ends_at=starts_at+30min
```

### Étape 2 — Appel RPC

```sql
SELECT slot_start, slot_end
  FROM public.get_available_slots(
    '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
    '2026-06-10'::date,
    30
  )
 ORDER BY slot_start;
```

**Attendu ✅** : EXACTEMENT 1 ligne (17:00 Algiers = 16:00 UTC).

Logique :
- Plage 09-13 : formation 09:00-17:00 chevauche → 0 slot
- Plage 14-18 :
  - 14:00, 14:30, ..., 16:30 → chevauchent formation → éliminés
  - **17:00→17:30 : libre** ✅ (formation finie à 17:00, slot commence après)
  - 17:30→18:00 : chevauche RDV inséré → éliminé

### Étape 3 — CLEANUP (CRITIQUE)

```sql
DELETE FROM public.appointments WHERE short_id = 'TEST-PHASE5-T4';
```

**KO connu** : 0 ligne → soustraction trop large (bug `&&` tstzrange `'[)'`). 2+ lignes → formation ou RDV pas vu.

- [ ] ✅ Passé (1 ligne, slot_start=17:00 Algiers)
- [ ] ❌ Échec :

---

## Garde-fous (6 tests rapides)

### G1 — Date passée → vide

```sql
SELECT count(*) FROM public.get_available_slots(
  '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid, '2020-01-01'::date, 30);
-- ATTENDU : 0
```
- [ ] ✅ Passé

### G2 — Date > J+90 → vide

```sql
SELECT count(*) FROM public.get_available_slots(
  '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid,
  (CURRENT_DATE + INTERVAL '100 days')::date, 30);
-- ATTENDU : 0
```
- [ ] ✅ Passé

### G3 — slot_duration hors range → exception

```sql
SELECT * FROM public.get_available_slots(
  '023bbccc-e2ba-45ad-8c9a-8fca85da18fa'::uuid, '2026-06-07'::date, 3);
-- ATTENDU : ERREUR "invalid_slot_duration" (SQLSTATE 22023)
```
- [ ] ✅ Passé (exception levée)

### G4 — Doctor inexistant → vide

```sql
SELECT count(*) FROM public.get_available_slots(
  '00000000-0000-0000-0000-000000000000'::uuid, '2026-06-07'::date, 30);
-- ATTENDU : 0 (guard is_claimed bloque silencieusement)
```
- [ ] ✅ Passé

### G5 — anon EXECUTE

Dans Supabase SQL Editor → change Role → `anon` → relance T1.
**ATTENDU** : 16 lignes (pas "permission denied").
- [ ] ✅ Passé

### G6 — Fiche non-claim → vide (anti-énumération)

```sql
-- Trouve une fiche non claim
SELECT id FROM public.doctor_profiles
 WHERE is_claimed = false OR is_claimed IS NULL
 LIMIT 1;
-- Note le id

-- Appelle la RPC avec
SELECT count(*) FROM public.get_available_slots(
  '<id-non-claim>'::uuid, '2026-06-07'::date, 30);
-- ATTENDU : 0 (guard is_claimed=true bloque)
```
- [ ] ✅ Passé

---

## 📊 Récap

| # | Test | Status |
|---|---|---|
| T1 | Dimanche ouvré → 16 slots | ☐ |
| T2 | Vendredi fermé → 0 | ☐ |
| T3 | Aïd el-Adha → 0 | ☐ |
| T4 | Formation + RDV → 1 slot (17:00) | ☐ |
| G1 | Date passée → 0 | ☐ |
| G2 | Date > J+90 → 0 | ☐ |
| G3 | slot_duration=3 → exception | ☐ |
| G4 | Doctor inexistant → 0 | ☐ |
| G5 | anon EXECUTE → 16 | ☐ |
| G6 | Fiche non-claim → 0 | ☐ |

**Décision Phase 5.2 (frontend booking patient)** :
- **10/10 ✅** → GO frontend `js/tabibi-booking.js` + flow modal réservation
- **≤ 8/10 ✅** → STOP hotfix RPC avant frontend

---

## 🔗 Références

- ALTER schema : `migrations/PHASE5_1bis_alter_appointments.sql`
- RPC + fixture : `migrations/PHASE5_1bis_get_available_slots_rpc.sql`
- Inspection initiale : `migrations/PHASE5_1bis_INSPECT_old_appointments.sql` + `..._v2_policies_and_enum.sql`
- Format working_hours : `migrations/PHASE4B_doc_working_hours_comment.sql`
- Blocages fixtures Aïd : `fixtures/test_doctor_blocages.sql`
- Registry seeds prod : `docs/PROD_SEEDS_REGISTRY.md` (à mettre à jour post-exec)
