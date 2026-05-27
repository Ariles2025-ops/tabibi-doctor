**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Procédure RGPD / Loi 18-07 — Exercice des droits

Document interne décrivant la conduite à tenir lors d'une demande d'exercice de droits par un utilisateur, ou d'une notification d'incident données.

Références :
- **Loi algérienne n° 18-07** du 10 juin 2018 sur la protection des données personnelles
- **Règlement (UE) 2016/679 (RGPD)**
- Notre Politique de Confidentialité

---

## 1. Principes généraux

- **Délai légal** : **30 jours** pour répondre à une demande d'exercice de droits, prolongeable à 60 jours pour les demandes complexes (avec information préalable de la personne).
- **Gratuité** : la procédure est gratuite, sauf demande manifestement excessive ou répétée (à motiver).
- **Identification préalable** : vérifier que le demandeur est bien la personne concernée (ou son représentant légal).
- **Documenter** chaque demande dans le registre RGPD (table `rgpd_requests` Supabase).

---

## 2. Réception d'une demande

### Canaux

- Email à **dpo@tabibi.doctor**
- Formulaire web (à prévoir)
- Courrier postal (siège social)

### Premier réflexe (sous 48 heures)

1. **Accuser réception** par email à l'expéditeur.
2. **Vérifier l'identité** : copie pièce d'identité (CIN ou passeport) demandée si doute.
3. **Identifier le type** de demande (cf. ci-dessous).
4. **Enregistrer** dans le registre RGPD avec :
   - date, expéditeur, type de demande, références aux données, statut, deadline (date+30j).

---

## 3. Demande d'ACCÈS aux données

### Article 32 loi 18-07 / Article 15 RGPD

L'utilisateur peut demander quelles données nous détenons sur lui.

### Procédure

1. Vérifier l'identité.
2. Exporter depuis Supabase, pour l'utilisateur concerné :
   - profil complet (table `users` et tables associées) ;
   - historique des RDV (table `appointments`) ;
   - logs de connexion (table `auth_logs` si applicable) ;
   - tout autre enregistrement le concernant.
3. Mettre au format **lisible** (JSON ou CSV + résumé en français).
4. Envoyer par email **chiffré** (ou via un lien sécurisé à durée limitée).
5. **Délai cible** : sous 15 jours, max 30.

---

## 4. Demande de RECTIFICATION

### Article 33 loi 18-07 / Article 16 RGPD

### Procédure

1. Vérifier l'identité.
2. Vérifier que la rectification demandée est légitime (ex. correction d'orthographe du nom, mise à jour adresse).
3. **Effectuer la rectification** dans Supabase.
4. **Confirmer** par email.
5. Si la rectification concerne des données partagées avec des tiers (médecin pour un patient, etc.), informer ces tiers le cas échéant.

---

## 5. Demande de SUPPRESSION (« droit à l'oubli »)

### Article 34 loi 18-07 / Article 17 RGPD

### Procédure

1. Vérifier l'identité.
2. **Identifier les obligations légales de conservation** qui s'imposeraient malgré la demande :
   - obligations comptables (10 ans pour les pièces comptables) ;
   - obligations probatoires (5 ans typiquement) ;
   - obligations médicales (sans objet pour Tabibi, car nous ne stockons pas de données médicales).
3. **Supprimer effectivement** :
   - les données du profil (nom, email, téléphone) — anonymiser ;
   - les RDV peuvent être anonymisés (garder agrégats mais retirer identifiants) ;
   - photo de profil le cas échéant.
4. **Conserver une trace** anonymisée de la suppression pour preuve (qui a demandé quoi quand).
5. Si le demandeur est un **médecin** : les RDV passés sont anonymisés du côté patient mais peuvent rester en compteur pour l'historique professionnel du médecin.
6. **Confirmer par email** la suppression effective.
7. **Délai** : sous 30 jours.

### Cas refus motivé

Possible si :
- obligation légale de conservation ;
- nécessité d'établir, exercer ou défendre un droit en justice ;
- demande manifestement abusive (multiples comptes, harcèlement).

Notifier le refus motivé par écrit.

---

## 6. Demande de LIMITATION du traitement

### Article 18 RGPD

L'utilisateur conteste l'exactitude des données ou la licéité du traitement et demande qu'on suspende temporairement le traitement.

### Procédure

1. Marquer le compte comme « limité » (flag dans Supabase).
2. Ne plus utiliser les données pour aucune autre opération que la conservation.
3. Examiner la situation et notifier la décision finale sous 30 jours.

---

## 7. Demande d'OPPOSITION

### Article 21 RGPD

L'utilisateur s'oppose à un traitement reposant sur un intérêt légitime (ex. analytics, suggestions). Pour les traitements fondés sur le consentement, c'est un **retrait du consentement** plutôt qu'une opposition.

### Procédure

1. Désactiver le traitement contesté pour ce compte (analytics, recommandations).
2. Confirmer par email.

---

## 8. Demande de PORTABILITÉ

### Article 20 RGPD

L'utilisateur veut récupérer ses données dans un format structuré.

### Procédure

1. Vérifier l'identité.
2. Exporter en **JSON** (ou CSV à défaut) :
   - profil ;
   - historique RDV ;
   - préférences.
3. Envoyer par email sécurisé.
4. Si demandé : transmettre directement à un autre responsable de traitement (tant que techniquement possible).

---

## 9. Demande RETRAIT DU CONSENTEMENT

Pour les traitements fondés sur le consentement (newsletter, cookies analytiques).

### Procédure

1. Désactiver le traitement immédiatement.
2. Confirmer par email.
3. Rappeler que le retrait n'affecte pas la licéité des traitements antérieurs.

---

## 10. Mineurs

Si la demande concerne un mineur :
- vérifier que le demandeur est le **représentant légal** (livret de famille, jugement, etc.) ;
- attention particulière à la suppression effective (les données de mineurs ne peuvent être conservées que dans des cas limités).

---

## 11. Notification d'une VIOLATION DE DONNÉES

### Délai légal : 72 heures à compter de la connaissance de la violation

### Procédure (cf. aussi PROCEDURE_INCIDENT_TECHNIQUE)

1. **Évaluer le risque** pour les droits et libertés des personnes :
   - Risque faible → traçabilité interne, pas de notification obligatoire.
   - Risque modéré ou élevé → notification ANPDP **et** personnes concernées.

2. **Notification ANPDP** (72 h) : courrier ou formulaire à adresser à :
   - *Adresse / Email ANPDP à compléter selon réglementation en vigueur*

3. **Notification aux personnes concernées** dans les meilleurs délais si risque élevé :
   - description claire et accessible,
   - mesures déjà prises,
   - mesures recommandées (changer mot de passe, vigilance).

4. **Documenter** la violation dans le registre (qu'elle ait été notifiée ou non).

---

## 12. Registre des traitements

Tenu à jour par le DPO, doit lister :

- finalités ;
- catégories de données ;
- catégories de personnes ;
- destinataires ;
- transferts hors UE / Algérie ;
- durées de conservation ;
- mesures de sécurité.

Format suggéré : tableur Google Drive `Equipe/Compliance/Registre_Traitements.xlsx`.

---

## 13. Templates emails

### Accusé de réception

> Bonjour,
>
> Nous accusons réception de votre demande relative à [type] datée du [date]. Conformément à la loi algérienne 18-07 et au RGPD, nous y répondrons sous **30 jours**.
>
> Pour valider votre identité, merci de nous transmettre une copie de votre pièce d'identité (vous pouvez occulter les informations non nécessaires sauf nom, prénom, photo).
>
> Cordialement,
> L'équipe DPO Tabibi — dpo@tabibi.doctor

### Réponse positive (suppression)

> Bonjour,
>
> Votre demande de suppression a bien été traitée le [date]. Vos données personnelles ont été anonymisées ou supprimées de nos systèmes.
>
> Conformément à nos obligations légales, certaines traces anonymisées peuvent être conservées (logs, statistiques agrégées) sans permettre de vous identifier.
>
> Nous vous remercions de la confiance accordée à Tabibi.

### Réponse de refus motivée

> Bonjour,
>
> Nous accusons réception de votre demande. Après examen, nous ne sommes pas en mesure d'y donner suite pour le motif suivant : [obligation légale / défense de droit / abus].
>
> Vous pouvez contester cette décision auprès de l'ANPDP : [adresse].

---

## 14. Contact

- DPO : **dpo@tabibi.doctor**
- Gérant : **aghiles@tabibi.doctor**
