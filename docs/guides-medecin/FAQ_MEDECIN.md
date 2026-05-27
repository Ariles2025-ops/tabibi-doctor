**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# FAQ Médecin — 30 questions/réponses

## A. Inscription et claim

### 1. Comment vérifiez-vous que je suis bien médecin ?
Nous vérifions votre carte d'inscription au Conseil National de l'Ordre des Médecins (CNOM) en cours de validité, votre pièce d'identité et, lorsque pertinent, votre diplôme. La vérification est faite à distance (photo via WhatsApp) ou physiquement au cabinet.

### 2. Je n'ai pas encore reçu ma carte d'Ordre (jeune diplômé), puis-je m'inscrire ?
Pas encore. Tabibi exige une carte CNOM en cours de validité au moment de l'activation. Revenez vers nous dès que vous l'obtenez.

### 3. Mon nom figure déjà sur Tabibi sans mon autorisation — que faire ?
La fiche provient de sources publiques (annuaire de l'Ordre, sources institutionnelles). Vous pouvez :
- la **revendiquer** (claim) pour la gérer ;
- ou demander sa **suppression** par email à dpo@tabibi.doctor.

### 4. Combien de temps prend l'onboarding ?
- Validation à distance : généralement **24 à 48 h ouvrées**.
- Validation au cabinet : selon planning de l'équipe, **3 à 10 jours**.

### 5. Suis-je obligé d'utiliser Tabibi exclusivement ?
Non. Vous pouvez être référencé sur d'autres plateformes ou continuer à prendre des RDV par téléphone.

---

## B. Tarifs et modèle économique

### 6. Combien ça coûte ?
**Gratuit** pour les médecins au lancement (juin 2026).

### 7. Allez-vous devenir payant un jour ?
Possiblement. Nous explorerons des modèles d'abonnement ou de services premium. Tout changement sera notifié **60 jours à l'avance** avec possibilité de résilier sans frais.

### 8. Prenez-vous une commission sur mes consultations ?
**Non.** Vos honoraires sont à 100 % pour vous.

### 9. Tabibi facture-t-il les patients ?
Non. Le service est gratuit pour les patients aussi. La consultation est réglée directement au médecin.

---

## C. Données et confidentialité

### 10. Où sont stockées mes données ?
Sur Supabase, dans des datacenters à **Frankfurt (Allemagne, UE)**, chiffrés au repos et en transit. Conforme RGPD et loi 18-07.

### 11. Qui voit mes données ?
- Les informations publiques de votre fiche (nom, photo, spécialité, adresse, tarifs, créneaux) sont visibles par tous.
- Vos données privées (téléphone non-pro, statistiques, RDV) sont visibles uniquement par vous et l'équipe Tabibi limitée (3 personnes max, sous NDA).

### 12. Mes patients voient-ils mes statistiques (taux d'occupation, no-show) ?
Non. Ces statistiques sont strictement internes.

### 13. Que se passe-t-il pour mes données si je quitte Tabibi ?
- Votre fiche est désactivée sous 7 jours.
- Vos données personnelles sont supprimées sous 30 jours.
- Les données historiques de RDV peuvent être conservées 5 ans pour obligations légales/probatoires, sous forme anonymisée le cas échéant.

### 14. Photo de ma carte d'Ordre — qu'en faites-vous ?
Conservée **90 jours maximum** à des fins probatoires (en cas de contrôle ordinal ou contestation), puis supprimée.

### 15. Y a-t-il un risque de fuite de données ?
Nous mettons en œuvre les meilleures pratiques (chiffrement, RLS Supabase, audit logs, NDA équipe). Le risque zéro n'existe pas. En cas de fuite, nous notifions sous 72h l'ANPDP et les personnes concernées.

---

## D. Fonctionnement quotidien

### 16. Combien de RDV maximum par jour ?
Aucune limite imposée par Tabibi. Vous configurez vos créneaux comme vous l'entendez.

### 17. Je suis en congrès / vacances, comment faire ?
Fermez vos créneaux dans **Dashboard → Agenda → Fermer une période**. Les RDV existants sur la période doivent être réaffectés ou annulés manuellement.

### 18. Un patient annule à la dernière minute, suis-je dédommagé ?
Non, Tabibi n'intervient pas dans la facturation. En revanche, le patient subit la politique no-show (avertissement, blocage).

### 19. Puis-je refuser un patient ?
Oui, avec un motif non discriminatoire (article 9 du code de déontologie interdit la discrimination). Voir la Charte Déontologique.

### 20. Comment gérer un patient qui revient régulièrement en no-show ?
Marquez chaque no-show. Au 3ème dans une fenêtre de 6 mois, son compte est suspendu 30 jours.

---

## E. Téléconsultation

### 21. La téléconsultation est-elle disponible ?
Pas garantie au lancement. Voir le **Guide Téléconsultation** pour le calendrier et les conditions.

### 22. Mon assurance RC pro couvre-t-elle la téléconsultation ?
À vérifier directement avec votre assureur — certaines polices la couvrent, d'autres non.

---

## F. Sécurité et conflits

### 23. Un patient laisse un faux avis diffamatoire — que faire ?
Signalez via le dashboard. Nous évaluons et supprimons les avis manifestement diffamatoires ou hors sujet sous 72h.

### 24. Un patient me harcèle hors plateforme (téléphone, WhatsApp) — que faire ?
- Bloquez son numéro.
- Signalez à Tabibi pour bloquer son compte.
- En cas de menaces, déposez plainte (Tabibi peut être réquisitionné pour fournir les informations légales).

### 25. Je découvre qu'un autre médecin se fait passer pour moi sur Tabibi (usurpation) — que faire ?
Contactez-nous immédiatement à contact@tabibi.doctor avec preuves. La fiche frauduleuse sera désactivée sous 24h.

### 26. Mon compte est piraté — que faire ?
1. Changez immédiatement votre mot de passe.
2. Envoyez un email à contact@tabibi.doctor.
3. Nous gelons le compte, analysons les logs, restaurons l'accès.

---

## G. Évolution du service

### 27. Quelles fonctionnalités prévues à venir ?
- Ordonnance électronique sécurisée (en cours)
- Téléconsultation (calendrier à confirmer)
- Application mobile native (post-launch)
- Multi-praticiens / secrétariat (post-launch)

### 28. Puis-je suggérer des fonctionnalités ?
Oui ! Envoyez vos retours à contact@tabibi.doctor ou via le formulaire de feedback du dashboard.

---

## H. Litiges et résiliation

### 29. Comment résilier ?
Email à contact@tabibi.doctor. Préavis 30 jours, sans frais.

### 30. En cas de litige avec Tabibi, quels recours ?
- D'abord, **médiation amiable** (30 jours).
- À défaut, **tribunaux d'Alger** (loi algérienne).
- Pour les questions données : recours à l'**ANPDP**.

---

Vous ne trouvez pas votre réponse ? **WhatsApp +213 777 169 074** ou **contact@tabibi.doctor**.
