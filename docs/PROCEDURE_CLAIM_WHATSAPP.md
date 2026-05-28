# Procédure Claim WhatsApp — Équipe Tabibi

**Version** : 1.0
**Dernière mise à jour** : 26 mai 2026
**Responsable principal** : Aghiles Haddadene
**Équipe** : 3 personnes

## Vue d'ensemble

Tabibi n'a pas de système self-service de revendication de fiche médecin au lancement (septembre 2026). Tous les claims passent par WhatsApp avec validation manuelle.

Pourquoi : 0.07% des fiches scrapées ont un email exploitable. Le matching automatique est impossible.

Objectif : convertir les 100 premiers médecins en personne.

## SLA

- Premier accusé de réception : < 1h en journée (8h–20h)
- Validation complète identité : < 24h
- Création/liaison compte : < 48h

## Workflow

### Étape 1 — Réception
Le médecin envoie un message contenant #[LEGACY_ID] et son nom.
Action : répondre < 1h avec template T1, puis :

```sql
INSERT INTO public.claim_requests (legacy_id, requester_name, requester_phone, contact_method, status)
VALUES ([LEGACY_ID], '[Nom]', '[Téléphone]', 'whatsapp', 'pending');
```

### Étape 2 — Vérification fiche
```sql
SELECT legacy_id, full_name, specialty_fr, wilaya_fr, user_id
FROM public.doctor_profiles WHERE legacy_id = [LEGACY_ID];
```

Si user_id IS NOT NULL → fiche déjà claimée → envoyer T-REJECT-1.

### Étape 3 — Demande pièce
Envoyer T2 demandant UNE option :
- A : Carte Ordre des Médecins algérien (photo recto-verso)
- B : Rencontre physique au cabinet

### Étape 4 — Validation
Option A : vérifier nom, validité, croiser avec [www.cnom-dz.org](https://www.cnom-dz.org) si doute. Archiver dans Google Drive `claim-validations/[LEGACY_ID]_[date].jpg`.
Option B : sur place vérifier CIN + Carte Ordre, faire signer consentement.

```sql
UPDATE public.claim_requests SET status='verified', notes='[méthode]', resolved_by='[uuid_admin]'
WHERE legacy_id=[X] AND status='pending';
```

### Étape 5 — Création compte + liaison
Envoyer T3 avec https://tabibi.doctor/signup.html?role=medecin
Récupérer UUID :
```sql
SELECT id, email FROM public.users WHERE email = '[email]' AND role = 'medecin';
```

Lier :
```sql
UPDATE public.doctor_profiles SET user_id = '[uuid]', updated_at = now() WHERE legacy_id = [LEGACY_ID];
```

Finaliser :
```sql
UPDATE public.claim_requests SET status='claimed', doctor_profile_id=(SELECT id FROM public.doctor_profiles WHERE legacy_id=[X]), resolved_at=now()
WHERE legacy_id=[X] AND status='verified';
```

### Étape 6 — Confirmation
Envoyer T4 avec lien dashboard.

## Templates WhatsApp

### T1 — Accusé réception (< 1h)
```
Bonjour Docteur,
Merci pour votre demande de revendication de la fiche #[ID] sur Tabibi.
Pour valider votre identité, nous avons besoin d'une vérification rapide. Je vous recontacte dans les prochaines heures.
Cordialement,
[Prénom] — Équipe Tabibi
```

### T2 — Demande pièce
```
Docteur [Nom],
Pour finaliser, deux options :
OPTION 1 — Photo de votre Carte de l'Ordre des Médecins (recto-verso)
OPTION 2 — Rencontre à votre cabinet (indiquez un créneau de 15 min)
Toute information reste confidentielle.
Cordialement,
[Prénom] — Équipe Tabibi
```

### T3 — Création compte
```
Votre identité est validée ✅
Créez votre compte sur : https://tabibi.doctor/signup.html?role=medecin
Envoyez-moi ensuite l'email utilisé et je lie votre compte à votre fiche.
Cordialement,
[Prénom] — Équipe Tabibi
```

### T4 — Compte lié
```
Votre fiche est liée à votre compte ✅
Connectez-vous : https://tabibi.doctor/login.html
Étapes recommandées :
1. Compléter profil
2. Ajouter créneaux
3. Activer/non téléconsultation
Support 7j/7 sur ce WhatsApp.
Bienvenue sur Tabibi 🩺
[Prénom] — Équipe Tabibi
```

### T-REJECT-1 — Fiche déjà claimée
```
Docteur,
La fiche #[ID] est déjà associée à un compte Tabibi.
S'il s'agit d'une erreur ou litige, répondez avec votre Carte Ordre + explication. Traitement sous 48h.
Cordialement,
[Prénom] — Équipe Tabibi
```

### T-REJECT-2 — Identité non vérifiable
```
Docteur,
Nous n'avons pas pu valider votre identité (carte illisible/expirée/incohérence).
Renvoyez une photo plus nette ou proposez un créneau au cabinet.
Sans réponse sous 7 jours, demande archivée.
Cordialement,
[Prénom] — Équipe Tabibi
```

## Rotation équipe

| Plage horaire | Personne de garde |
|---|---|
| 8h–13h | À définir |
| 13h–18h | À définir |
| 18h–20h | À définir |

Hors 8h–20h : message auto WhatsApp Business + traitement lendemain.

## Escalades vers Aghiles
- Conflit entre deux revendiquants
- Modification fiche au-delà du standard
- Comportement inhabituel
- Cas légal (RGPD, suppression)

## KPI hebdomadaires (chaque dimanche)

```sql
SELECT status, COUNT(*), COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as last_7d
FROM public.claim_requests GROUP BY status;
```

Métriques : demandes reçues, claims finalisés, taux conversion, temps moyen, rejets et raisons.

## Sécurité & RGPD
- Jamais demander mot de passe, 2FA, infos bancaires
- Pièces justificatives uniquement dans Google Drive équipe
- Suppression pièces après 90 jours sauf litige
- Demande RGPD → escalade Aghiles, traitement sous 30 jours
- Conversations WhatsApp jamais partagées hors équipe
