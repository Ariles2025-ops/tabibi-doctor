**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# KPI Dashboard — Reporting hebdomadaire

Document interne pour le suivi hebdomadaire des indicateurs clés de Tabibi.doctor. À reporter **chaque dimanche soir** par le Gérant, partagé avec l'équipe.

---

## 1. Cadence

| Type | Cadence | Responsable |
|---|---|---|
| KPI Pilote (snapshot) | **Hebdomadaire — dimanche soir** | Aghiles |
| KPI Reporting détaillé | Mensuel — 1er du mois | Aghiles |
| OKR | Trimestriel | Toute l'équipe |

---

## 2. KPI PILOTE (Nord)

### Médecins actifs

**Définition** : un médecin est « actif » sur la semaine s'il a **honoré au moins 1 RDV** confirmé dans la fenêtre des 7 derniers jours.

**Cible launch** : croissance hebdo, objectif **100 médecins actifs à J+90 du launch**.

```sql
-- Médecins actifs (semaine glissante)
SELECT COUNT(DISTINCT doctor_id) AS doctors_active_7d
FROM appointments
WHERE status = 'completed'
  AND completed_at >= NOW() - INTERVAL '7 days';
```

---

## 3. KPI SECONDAIRES

### 3.1 Funnel d'acquisition médecin

```sql
-- Claims pending (en attente de validation)
SELECT COUNT(*) AS claims_pending
FROM claim_requests
WHERE status = 'pending';

-- Claims validés cette semaine
SELECT COUNT(*) AS claims_validated_7d
FROM claim_requests
WHERE status = 'validated'
  AND validated_at >= NOW() - INTERVAL '7 days';

-- Médecins onboardés (cumulé)
SELECT COUNT(*) AS doctors_onboarded_total
FROM doctors
WHERE status = 'active';

-- Profil complet (photo + bio + tarifs + créneaux)
SELECT COUNT(*) AS doctors_profile_complete
FROM doctors
WHERE status = 'active'
  AND profile_photo_url IS NOT NULL
  AND bio IS NOT NULL
  AND price IS NOT NULL
  AND has_open_slots = true;
```

### 3.2 Acquisition patient

```sql
-- Nouveaux patients cette semaine
SELECT COUNT(*) AS patients_new_7d
FROM users
WHERE role = 'patient'
  AND created_at >= NOW() - INTERVAL '7 days';

-- Patients actifs (au moins 1 RDV pris dans 30 jours)
SELECT COUNT(DISTINCT patient_id) AS patients_active_30d
FROM appointments
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### 3.3 Activité RDV

```sql
-- RDV créés cette semaine
SELECT COUNT(*) AS rdv_created_7d
FROM appointments
WHERE created_at >= NOW() - INTERVAL '7 days';

-- RDV confirmés cette semaine
SELECT COUNT(*) AS rdv_confirmed_7d
FROM appointments
WHERE status IN ('confirmed', 'completed')
  AND created_at >= NOW() - INTERVAL '7 days';

-- Taux de confirmation
SELECT
  ROUND(100.0 * SUM(CASE WHEN status IN ('confirmed','completed') THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS conversion_rate_pct
FROM appointments
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### 3.4 No-show rate

```sql
-- Taux de no-show (RDV échus la semaine)
SELECT
  ROUND(100.0 * SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS no_show_rate_pct
FROM appointments
WHERE scheduled_at >= NOW() - INTERVAL '7 days'
  AND scheduled_at < NOW()
  AND status IN ('completed', 'no_show');
```

Cible : **< 8 %**. Au-dessus : déclencher campagne rappel J-1 plus appuyée.

### 3.5 Wilayas couvertes

```sql
SELECT
  COUNT(DISTINCT wilaya) AS wilayas_with_active_doctor
FROM doctors
WHERE status = 'active'
  AND id IN (
    SELECT DISTINCT doctor_id FROM appointments
    WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days'
  );
```

### 3.6 Modération

```sql
-- Signalements ouverts
SELECT severity, COUNT(*) FROM moderation_log
WHERE status = 'open' GROUP BY severity;

-- Suspensions actives
SELECT COUNT(*) FROM moderation_log
WHERE action LIKE 'suspend%' AND ends_at > NOW();
```

---

## 4. Template de rapport hebdo

À envoyer chaque **dimanche 20h** sur le canal WhatsApp interne.

```
📊 Tabibi — Semaine S## (du DD/MM au DD/MM)

🩺 Médecins actifs : ___ (Δ ±__ vs S-1)
👥 Patients actifs (30j) : ___
📅 RDV créés cette semaine : ___ (Δ ±__%)
✅ RDV confirmés / créés : ___% (cible >70%)
❌ Taux no-show : ___% (cible <8%)
🌍 Wilayas couvertes : __ / 58

🛠 Funnel médecin :
- Claims en attente : __
- Claims validés cette semaine : +__
- Profils complets : __ / __ (=__%)

🚨 Modération :
- Signalements ouverts : __
- Suspensions actives : __

💡 Faits saillants :
- ...

⚠️ Risques / blockers :
- ...

🎯 Prochain focus :
- ...
```

---

## 5. Outils

- **Source de vérité** : Supabase (requêtes ci-dessus).
- **Dashboard visuel** : Metabase / Grafana (à installer post-launch).
- **Snapshot** : copier les requêtes dans une Google Sheet `KPI Tabibi` mise à jour chaque semaine.
- **Historique** : conserver l'historique semaine après semaine pour observer les tendances.

---

## 6. OKR proposés (Q3 2026 = launch trimester)

### Objectif 1 — Atteindre la masse critique de médecins actifs

- KR1 : 100 médecins actifs (≥1 RDV/semaine) à fin Q3.
- KR2 : 80 % des médecins onboardés ont un profil complet.
- KR3 : Couverture des 5 plus grandes wilayas (Alger, Oran, Constantine, Annaba, Sétif).

### Objectif 2 — Construire la confiance utilisateur

- KR1 : Taux de no-show patient < 8 %.
- KR2 : NPS médecin > 30 (sondage mensuel).
- KR3 : 0 incident sécurité majeur, 100 % des demandes RGPD traitées sous 30 jours.

### Objectif 3 — Asseoir la marque

- KR1 : 3 articles presse / blog par mois.
- KR2 : 500 abonnés LinkedIn page Tabibi.
- KR3 : 30 témoignages médecins recueillis.

---

## 7. Anti-vanity metrics

À **NE PAS** suivre comme principal :

- ❌ Nombre total de médecins « référencés » (la base scrapée n'est qu'un point de départ).
- ❌ Pageviews sans contextualisation.
- ❌ Followers sociaux seuls.

Ce qui compte : **valeur effective délivrée** = RDV honorés × satisfaction.
