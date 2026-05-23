# SQL TODO — Backend Supabase

Liste des besoins SQL identifiés pendant le développement frontend.
**NE PAS EXÉCUTER** depuis ici — tout passe par session Claude.ai dédiée.

---

## ✅ Résolus en Phase 13 (session SQL enrichissement vue `public_doctors`)

La vue `public_doctors` expose désormais **32 colonnes** (vs 15 initialement). Cela résout d'un coup les TODOs suivants :

- ~~TODO-SQL-001~~ : `entity_type` exposé ✅
- ~~TODO-SQL-002~~ : `full_name` brut confirmé (pas d'anonymisation SQL) ✅
- ~~TODO-SQL-003~~ : `my_upcoming_appointments` — à confirmer par audit live mais hors blocage M0
- ~~TODO-SQL-004~~ : `consultation_fee_dzd` exposé ✅ (valeurs NULL en M0, se rempliront au claim médecin)
- ~~TODO-SQL-005~~ : `rating` + `review_count` exposés ✅ (12 572/79 746 ont rating M0, 16 %)
- ~~TODO-SQL-006~~ : `entity_type` exposé ✅ (`is_urgent` + `gender` restent absents — chips correspondantes inutilisables, mais NON bloquant)
- ~~TODO-SQL-007~~ : profil patient `users` — best-effort frontend OK, à valider RLS si besoin de cross-device persistence

Le frontend Phase 13 (commits `dc8c5a9` + `c5e15a4`) exploite directement ces nouvelles colonnes — aucun workaround SQL futur nécessaire pour M0.

---

## 🔴 Restent ouverts (backend non-frontend)

### TODO-SQL-008 : RPCs téléconsultation Daily.co (Phase 7.1)
**Contexte** : `teleconsultation.html` est entièrement câblé côté front mais appelle 2 RPCs inexistantes en DB (PGRST202 confirmé) :
- `get_video_session(appointment_id uuid)` — retourne `{room_url, token, session_id, consent_patient_recording, expires_at, ...}`
- `set_video_recording_consent(p_appt uuid, p_consent bool)` — UPDATE consentement enregistrement

**Frontend bloqué proprement** via `TABIBI_FEATURES.video = false` → page redirige avec "Bientôt disponible" + CTA. Aucun appel RPC tenté.

**À créer** :
```sql
ALTER TABLE doctor_profiles ADD COLUMN video_enabled boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_video_session(appointment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
  -- Édge Function Daily.co pour générer room+token éphémère
$$;

CREATE OR REPLACE FUNCTION public.set_video_recording_consent(p_appt uuid, p_consent bool)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  -- UPDATE appointments SET consent_recording=p_consent WHERE id=p_appt AND patient_id=auth.uid();
$$;
```

**Après création SQL** → `TABIBI_FEATURES.video = true` + test E2E.

---

### TODO-SQL-009 : Paiements Stripe Test + Edge Function webhook (Phase 8.1/8.3)
**Contexte** : `payment.html` affiche 4 méthodes (espèces actif, Stripe/Edahabia/CIB grisés "BIENTÔT"). Quand backend prêt :

1. Créer compte Stripe Test (https://stripe.com)
2. Récupérer clé publique → ajouter à `js/config.js` ou `window.TABIBI_CONFIG`
3. Créer Edge Function `stripe-webhook` qui :
   - Vérifie signature Stripe-Signature
   - UPDATE `appointments.status` selon event (charge.succeeded → confirmed, charge.failed → cancelled, charge.refunded → cancelled+refund flag)
4. SQL : ajouter colonnes `appointments.{stripe_session_id, stripe_payment_intent, paid_at, refunded_at}` (nullable)
5. SQL : RLS confirmer que seul service_role peut UPDATE ces colonnes

**Pour SATIM/Edahabia** : pas d'API sandbox stable en Algérie. À documenter dans `DEPLOY_INSTRUCTIONS.md` quand contrat partenariat signé.

**Après backend prêt** → `TABIBI_FEATURES.payments = true` + test E2E.

---

### TODO-SQL-010 : Notifications in-app (Phase 9.1/9.2)
**Contexte** : `notifications.html` lit `sb.from('notifications').select(...)` quand `TABIBI_FEATURES.notifications=true`.

```sql
CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('rdv_confirmed','rdv_cancelled','rdv_reminder','prescription','claim','system')),
  title        text NOT NULL,
  message      text NOT NULL,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);
CREATE INDEX notifications_user_id_created_idx ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_self_read   ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notif_self_update ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Triggers** : appointments INSERT pending → notif rdv_confirmed (patient) ; appointments UPDATE status='cancelled' → notif rdv_cancelled ; pg_cron J-1 upcoming → notif rdv_reminder ; prescriptions INSERT → notif prescription.

**Après backend prêt** → `TABIBI_FEATURES.notifications = true`.

---

### TODO-SQL-011 : Avis & reviews (Phase 9.3/9.4/9.5)
**Contexte** : `js/tabibi-reviews.js` existe côté front, lit `from('reviews')`.

```sql
CREATE TABLE public.reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES auth.users(id),
  doctor_id       uuid NOT NULL REFERENCES public.doctor_profiles(id),
  rating          int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  verified        boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);
CREATE INDEX reviews_doctor_id_created_idx ON public.reviews(doctor_id, created_at DESC);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_public_read    ON public.reviews FOR SELECT USING (true);
CREATE POLICY reviews_patient_create ON public.reviews FOR INSERT WITH CHECK (
  patient_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.id = appointment_id AND a.patient_id = auth.uid() AND a.status = 'completed')
);
```

Une fois la table créée → recalcul vue `public_doctors.{rating, review_count}` depuis la vraie source au lieu des données pré-importées.

**Après backend prêt** → `TABIBI_FEATURES.reviews = true`.

---

## 📝 Notes M0 — colonnes vides en attente du claim médecin

Après enrichissement Phase 13, certaines colonnes existent dans la vue mais sont systématiquement NULL/false jusqu'à ce que le médecin réclame sa fiche et la complète :

| Colonne | Stats actuelles | Quand sera renseignée |
|---|---|---|
| `consultation_fee_dzd` | 0 / 79 746 | Au claim — médecin saisit son tarif dans medecin-profile.html |
| `telehealth_enabled` | 0 / 79 746 true | Au claim — toggle medecin-profile.html |
| `telehealth_fee_dzd` | 0 / 79 746 | Au claim |
| `photo_url` | 0 / 79 746 | Upload médecin via medecin-profile.html |
| `bio` | NULL pour la majorité | Au claim |
| `working_hours` | NULL pour la majorité | Au claim |
| `accepts_card/chifa/cash` | preset accepts_cash=true, autres false | Au claim |

Le frontend Phase 13 gère gracieusement TOUS ces NULL :
- Tarif null → "Tarif à confirmer"
- Rating null → "Pas encore noté"
- Photo null → initiales colorées
- Bio null → phrase générique "Spec exerçant à Wilaya"
- Working hours null → section masquée
- Téléconsult false → badge absent
- Tous les badges paiement absent → section masquée

Pas besoin de SQL pour faire fonctionner M0 — juste attendre la campagne claim.

---

## 🔵 Phase 12 hygiène (DB ops futurs, hors M0)

- DB hygiène : nettoyer doublon `claim_my_doctor_profile()` sans args
- DB sécurité : aligner `public_doctors`, `public_doctor_full` sur `security_invoker=true`
- Storage : durcir `doctor_photos_select_public` anti-énumération
- Audit log : tracer changements `phone`/`address` via `update_my_doctor_profile`

---

## Format pour nouveaux ajouts
Numéroter `TODO-SQL-NNN`. Inclure : contexte (quelle Phase a découvert le besoin), commande SQL de vérif, action recommandée, risque si non-traité.
