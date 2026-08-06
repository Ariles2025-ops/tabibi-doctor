# Inventaire RPC — front appelant × existence en production

**Date** : 2026-07-29 · **Base** : projet Supabase `pudugodhiofqrctcdwfl` (EU)
**Méthode** :
- Côté front — `grep -rE "\.rpc\(\s*['\"]…" --include='*.js' --include='*.html'` (hors `node_modules`) → **39 RPC** distinctes.
- Côté prod — inventaire lecture seule de `pg_proc` (schéma `public`, `prokind='f'`) → **97 fonctions**, toutes propriété de `postgres`.

> **Pourquoi ce document** : le dossier `migrations/` n'est **pas** un miroir de la base
> (31 fichiers SQL manuels marqués « non auto-run »). 25 RPC appelées par le front n'y ont
> aucune définition — ce tableau tranche, pour chacune, si elle existe **réellement en prod**.

## Résultat en une ligne

**38 des 39 RPC appelées par le front existent en production.** Les seules absentes sont les
**4 RPC d'ordonnances**, ce qui casse **deux** pages (côté médecin *et* côté patient).

| Statut | Nombre |
|---|---|
| ✅ OK (présente en prod) | 35 |
| 🔴 MANQUANTE-EN-PROD | 4 |

---

## Tableau complet

| RPC | En prod | Fichier(s) front appelant | Statut |
|---|:---:|---|---|
| `accept_cabinet_invitation` | OUI | `signup.html` | ✅ OK |
| `admin_doctor_doc_paths` | OUI | `admin-doctor-validation.html` | ✅ OK — exposée `anon`, garde interne vérifiée (cf. `SECURITY_RPC_AUDIT.md`) |
| `admin_validate_doctor` | OUI | `admin-dashboard.html`, `admin-doctor-validation.html` | ✅ OK — idem |
| `admin_validation_counts` | OUI | `admin-doctor-validation.html` | ✅ OK — idem |
| `admin_validation_list` | OUI | `admin-doctor-validation.html` | ✅ OK — idem |
| `admin_validation_total` | OUI | `admin-doctor-validation.html` | ✅ OK — idem |
| `can_review_doctor` | OUI | `js/tabibi-reviews.js` | ✅ OK — inactive côté produit (`TABIBI_FEATURES.reviews = false`) |
| `claim_my_doctor_profile` | OUI | `js/tabibi-claim.js` | ✅ OK — existe en prod, **non versionnée** (créée en Phase 0) |
| **`create_prescription_draft`** | **NON** | `medecin-ordonnance.html` | 🔴 **MANQUANTE-EN-PROD** |
| `dawini_cancel_alert` | OUI | `dawini.html` | ✅ OK |
| `dawini_create_alert` | OUI | `dawini.html` | ✅ OK |
| `dawini_create_request` | OUI | `js/tabibi-dawini.js` | ✅ OK |
| `dawini_expire_old` | OUI | `js/tabibi-dawini.js` | ✅ OK |
| `dawini_get_patient_contact` | OUI | `js/tabibi-dawini.js` | ✅ OK |
| `dawini_pharmacy_stats` | OUI | `js/tabibi-dawini.js` | ✅ OK |
| `dawini_respond` | OUI | `js/tabibi-dawini.js` | ✅ OK |
| `dawini_shortage_by_wilaya` | OUI | `dawini.html` | ✅ OK |
| `dawini_top_missing` | OUI | `dawini.html` | ✅ OK |
| `doctor_set_ordre_number` | OUI | `js/tabibi-claim.js` | ✅ OK |
| `ensure_conversation` | OUI | `js/tabibi-messaging.js` | ✅ OK — inactive (`messaging = false`) |
| `generate_api_key_pair` | OUI | `admin-api-keys.html` | ✅ OK |
| `get_available_slots` | OUI | `js/tabibi-booking.js` | ✅ OK |
| `get_my_cabinets` | OUI | `admin-cabinet.html`, `js/tabibi-agenda.js`, `secretaire-dashboard.html` | ✅ OK — **critique** : porte l'espace secrétariat et le mode cabinet de l'agenda |
| `get_my_doctor_profile` | OUI | `js/tabibi-agenda.js`, `js/tabibi-doctor-dashboard.js` | ✅ OK |
| `get_patient_medical_data` | OUI | `js/tabibi-pii-migration.js`, `legal/rgpd-droits.html` | ✅ OK — exposée `anon`, garde `auth.uid()` vérifiée |
| `get_video_session` | OUI | `teleconsultation.html` | ✅ OK — **change l'état de TODO-SQL-008** (cf. note ci-dessous) |
| `invite_cabinet_member` | OUI | `admin-cabinet.html` | ✅ OK |
| **`mark_prescription_delivered`** | **NON** | `patient-ordonnances.html` | 🔴 **MANQUANTE-EN-PROD** |
| `mark_video_session_ended` | OUI | `teleconsultation.html` | ✅ OK |
| `mark_video_session_started` | OUI | `teleconsultation.html` | ✅ OK |
| `remove_cabinet_member` | OUI | `admin-cabinet.html` | ✅ OK |
| **`request_prescription_signature`** | **NON** | `medecin-ordonnance.html` | 🔴 **MANQUANTE-EN-PROD** |
| `revoke_api_key` | OUI | `admin-api-keys.html` | ✅ OK |
| `rotate_api_key` | OUI | `admin-api-keys.html` | ✅ OK |
| `set_video_recording_consent` | OUI | `teleconsultation.html` | ✅ OK |
| `update_my_doctor_profile` | OUI | `js/tabibi-doctor-dashboard.js` | ✅ OK |
| **`update_prescription_draft`** | **NON** | `medecin-ordonnance.html` | 🔴 **MANQUANTE-EN-PROD** |
| `upsert_patient_medical_data` | OUI | `js/tabibi-pii-migration.js` | ✅ OK — exposée `anon`, garde `auth.uid()` vérifiée |
| `validate_cabinet_invitation` | OUI | `signup.html` | ✅ OK |

---

## 🔴 Les 4 RPC manquantes — impact réel

Contrairement à ce que laissait penser leur nom, **deux pages distinctes** sont touchées :

| Page | RPC appelées | Effet |
|---|---|---|
| `medecin-ordonnance.html` | `create_prescription_draft`, `update_prescription_draft`, `request_prescription_signature` | Le médecin ne peut ni créer, ni modifier, ni faire signer une ordonnance |
| `patient-ordonnances.html` | `mark_prescription_delivered` | Le patient ne peut pas marquer une ordonnance comme délivrée |

**Aggravant** : ces appels ne sont protégés par **aucun feature flag** (contrairement à la
visio ou aux avis). L'échec est donc **silencieux côté produit** — l'utilisateur voit une
erreur générique, sans que rien n'indique que la fonctionnalité n'existe pas.

Réponse attendue de PostgREST pour ces 4 appels : `PGRST202` (fonction introuvable).

**Décision à prendre** (portée au backlog, cf. `AUDIT_RESTANT_2026-07-29.md`) :
1. **Créer les 4 fonctions** en prod + les versionner ici — si la fonctionnalité ordonnances
   doit exister au lancement (congrès 3-5 déc) ;
2. **ou neutraliser** les deux pages derrière un flag `TABIBI_FEATURES.prescriptions = false`,
   comme cela a été fait pour la visio et les avis — plus honnête vis-à-vis de l'utilisateur
   qu'un bouton qui échoue.

---

## Edge Functions (hors RPC)

| Fonction | Déployée | Appelée depuis | Statut |
|---|:---:|---|---|
| `send-sms` | OUI | `js/tabibi-sms.js` | ⚠️ **Hook OTP signé** — le contrat attendu par `tabibi-sms.js` (`{to, message, senderId}`) est incompatible ; ce module est désactivé (`enabled: false`) et ne doit pas être réparé en l'état |
| `verify-turnstile` | OUI | `js/tabibi-turnstile.js` | ✅ OK (formulaire liste d'attente) |
| `appointment-reminders` | OUI | *(pg_cron, jobid 2)* | ✅ OK — rappels SMS J-1 / H-2 / confirmation |
| `send-email` | **NON** | `js/tabibi-brevo.js:619` | 🔴 **Inexistante** — tout envoi email échoue. Canal email non retenu (décision SMS-only en DZ) |
| `request-account-deletion` | à vérifier | `legal/rgpd-droits.html` | ⚠️ Non couverte par cet inventaire (hors périmètre `pg_proc`) — **à confirmer**, c'est un parcours RGPD |

---

## Notes de mise à jour d'autres documents

- **`SQL_TODO.md` — TODO-SQL-008** (RPC téléconsultation) est à considérer comme **résolu** :
  `get_video_session`, `mark_video_session_started/ended` et `set_video_recording_consent`
  existent désormais en prod. Le front reste neutralisé par `TABIBI_FEATURES.video = false` —
  l'activation est donc devenue une simple décision produit.
- **`claim_my_doctor_profile`** existe en prod mais n'a **aucune définition versionnée** :
  à intégrer dans `migrations/PROD_SCHEMA_DUMP.sql`.
- Les **97 fonctions** de la prod dépassent largement les 39 appelées par le front : le reste
  est constitué de fonctions internes (triggers, helpers RLS) — normal et attendu.
