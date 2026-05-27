> ⚠️ **DISCLAIMER** : Document en attente de validation par avocat. Ne pas diffuser publiquement avant validation.

**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : DRAFT

---

# Politique de Confidentialité

Tabibi SARL (ci-après « Tabibi », « nous ») accorde une importance fondamentale à la protection des données personnelles de ses Utilisateurs. La présente Politique de Confidentialité a pour objet d'informer les Utilisateurs des traitements effectués sur leurs données, conformément à la **loi algérienne n° 18-07 du 10 juin 2018** relative à la protection des personnes physiques dans le traitement des données à caractère personnel et au **Règlement (UE) 2016/679** (RGPD), applicable en raison de l'hébergement européen.

## 1. Responsable de traitement

- **Identité** : Tabibi SARL (en cours de constitution)
- **Adresse** : siège social à confirmer après immatriculation
- **Email** : contact@tabibi.doctor
- **Délégué à la protection des données (DPO)** : Aghiles Haddadene — dpo@tabibi.doctor

## 2. Données collectées

### 2.1 Données collectées auprès des Patients

| Catégorie | Données | Source |
|---|---|---|
| Identité | Nom, prénom, date de naissance, sexe | Formulaire d'inscription |
| Contact | Email, téléphone, wilaya | Formulaire d'inscription |
| Authentification | Mot de passe (haché), token de session | Système |
| Usage | Historique des rendez-vous, médecins consultés, évaluations | Système |
| Technique | Adresse IP, user-agent, logs de connexion | Système |

### 2.2 Données collectées auprès des Médecins

| Catégorie | Données | Source |
|---|---|---|
| Identité professionnelle | Nom, prénom, photo, n° d'ordre, spécialité, diplômes | Formulaire + claim |
| Activité | Adresse cabinet, téléphone, horaires, tarifs | Formulaire |
| Justificatifs | Photo carte CNOM (archivée 90 jours) | Procédure de claim |
| Authentification | Mot de passe (haché), token | Système |
| Usage | Statistiques de RDV, taux de no-show | Système |

### 2.3 Données collectées auprès du personnel administrateur

Identifiants nominatifs, logs d'actions sur la console d'administration (audit trail).

## 3. Finalités et bases légales

| Finalité | Base légale (art. 6 RGPD / loi 18-07) |
|---|---|
| Création et gestion du compte | Exécution du contrat (CGU) |
| Mise en relation Patient ↔ Médecin | Exécution du contrat |
| Envoi de notifications de rendez-vous | Exécution du contrat |
| Lutte contre la fraude et abus | Intérêt légitime |
| Statistiques anonymes d'amélioration du Service | Intérêt légitime |
| Communication marketing | Consentement explicite (opt-in) |
| Respect des obligations légales (réquisition, contrôle ANPDP) | Obligation légale |

## 4. Durées de conservation

| Donnée | Durée |
|---|---|
| Compte actif Patient | Durée d'utilisation du compte |
| Compte Patient inactif | 36 mois après dernière connexion, puis suppression |
| Compte Médecin actif | Durée du Contrat de Partenariat |
| Compte Médecin résilié | 5 ans (obligations comptables et probatoires) |
| Historique des rendez-vous | 5 ans à compter de la consultation |
| Justificatifs de claim (photo CNOM) | 90 jours après validation |
| Logs techniques (IP, sessions) | 12 mois |
| Données comptables | 10 ans (obligation fiscale algérienne) |

## 5. Destinataires des données

- **Équipe interne Tabibi** : accès strictement limité au besoin opérationnel (3 personnes au lancement, sous engagement de confidentialité).
- **Hébergeurs** :
  - **Supabase Inc.** (base de données, region Frankfurt — UE)
  - **Netlify Inc.** (hébergement frontal, CDN mondial)
- **Prestataires techniques** liés par contrat de sous-traitance (envoi d'emails transactionnels, monitoring), liste tenue à jour et disponible sur demande.
- **Autorités** : sur réquisition légale uniquement (autorité judiciaire, ANPDP).

**Aucune donnée n'est vendue ni cédée à des tiers à des fins commerciales.**

## 6. Transferts hors Algérie

Les données sont hébergées sur **Supabase**, dans des datacenters situés à **Frankfurt (Allemagne, Union Européenne)**, pays bénéficiant d'un niveau de protection des données reconnu comme adéquat. Les transferts sont encadrés par des **clauses contractuelles types** au sens de l'article 46 du RGPD et de l'article 44 de la loi 18-07.

Une copie des engagements de notre hébergeur est disponible sur demande à dpo@tabibi.doctor.

## 7. Droits des personnes

Conformément à la loi 18-07 (articles 32 à 38) et au RGPD (articles 15 à 22), tout Utilisateur dispose des droits suivants :

- **Droit d'accès** : obtenir une copie de ses données.
- **Droit de rectification** : corriger des données inexactes.
- **Droit à l'effacement** (« droit à l'oubli ») : sous réserve des obligations légales de conservation.
- **Droit à la limitation** du traitement.
- **Droit d'opposition** pour motif légitime.
- **Droit à la portabilité** : recevoir ses données dans un format structuré et lisible.
- **Droit de retrait du consentement** à tout moment lorsque le traitement est fondé sur le consentement.
- **Droit de définir des directives post-mortem** sur le sort des données.

### Procédure d'exercice

- Envoyer une demande à **dpo@tabibi.doctor** avec copie d'une pièce d'identité.
- Délai de réponse : **30 jours maximum**, pouvant être prolongé à 60 jours pour les demandes complexes (avec information préalable).
- En cas de réponse insatisfaisante, l'Utilisateur peut saisir l'**ANPDP (Autorité Nationale de Protection des Données Personnelles)** — adresse à compléter, ou son équivalent européen pour les résidents UE.

## 8. Sécurité

Tabibi met en œuvre les mesures techniques et organisationnelles appropriées :

- chiffrement TLS 1.3 de toutes les communications ;
- chiffrement au repos des bases de données (AES-256, Supabase) ;
- politique de mots de passe robustes + hachage bcrypt ;
- contrôle d'accès par rôle (RLS Supabase) ;
- audit logs de toutes les actions administratives ;
- sauvegardes chiffrées quotidiennes ;
- revue régulière des accès (trimestrielle) ;
- formation à la sécurité de tous les collaborateurs ;
- engagement de confidentialité (NDA) signé par tout collaborateur.

En cas de **violation de données** susceptible d'engendrer un risque pour les droits et libertés, Tabibi notifiera l'ANPDP dans un délai de **72 heures** et informera les personnes concernées dans les meilleurs délais.

## 9. Cookies

Voir la **Politique Cookies** dédiée. Les cookies non essentiels ne sont déposés qu'après consentement explicite via bannière (opt-in).

## 10. Mineurs

L'inscription en tant que Patient mineur (moins de 18 ans) requiert l'autorisation préalable d'un représentant légal. Les données de mineurs font l'objet d'une vigilance renforcée.

## 11. Modifications

La présente Politique peut être mise à jour. Les modifications substantielles seront notifiées par email et/ou bandeau. La version en vigueur est toujours datée en en-tête.

## 12. Contact

- DPO : dpo@tabibi.doctor
- Standard : contact@tabibi.doctor
- WhatsApp : +213 777 169 074

---

*Document généré le 27 mai 2026 — version 1.0 — DRAFT en attente de validation juridique.*
