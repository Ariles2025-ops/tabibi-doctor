**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Playbook de gestion de crise

Document interne. Conduite à tenir face à un événement majeur susceptible d'affecter Tabibi, ses utilisateurs ou sa réputation.

---

## Principes directeurs (à relire avant toute action)

1. **Prendre 10 minutes** avant d'agir : recueillir les faits, ne pas réagir à chaud.
2. **Préserver les preuves** (captures, logs, copies d'écran horodatées).
3. **Centraliser la communication** : une seule voix vers l'extérieur (Aghiles ou délégué nommé).
4. **Honnêteté > minimisation** : un mensonge se paie plus cher que le problème initial.
5. **Documenter** : tout est tracé dans `docs/operations/incidents/YYYY-MM-DD-titre.md`.
6. **Apprendre** : post-mortem systématique.

---

## Scénario 1 — Médecin malhonnête signalé

**Symptôme** : signalement crédible d'usurpation de titre, escroquerie, agression, violation du secret médical.

### Heure H

1. **Geler** immédiatement le compte du médecin (statut `suspended_pending_investigation`).
2. **Désactiver la fiche** publique (ne plus apparaître dans les recherches).
3. **Annuler les RDV futurs** + informer les patients par email courtois (« RDV annulé pour des raisons internes — nous vous accompagnons pour trouver un autre praticien »).

### H+24h

4. **Contacter le médecin** par email recommandé électronique : présentation des griefs, demande d'explication sous 7 jours.
5. **Documenter** l'enquête dans `docs/operations/incidents/`.
6. **Vérifier** auprès du CNOM le statut d'inscription effectif.

### Selon résultat

- **Fraude confirmée (faux titre)** :
  - Résiliation immédiate du Contrat de Partenariat.
  - Signalement au **CNOM**.
  - Dépôt de plainte au **Procureur de la République** d'Alger.
  - Suppression de la fiche.
  - Communication interne (équipe), pas publique.
- **Manquement déontologique grave** :
  - Suspension prolongée.
  - Signalement au CNOM.
- **Faux signalement / pas de fondement** :
  - Réactiver le compte.
  - Excuses au médecin.
  - Sanction de l'auteur du faux signalement si malveillance.

### Communication

- **Patients impactés** : email transparent mais factuel, sans nommer le médecin si pas encore prouvé.
- **Externe** : pas de communication publique sauf demande médias ou autorité.

---

## Scénario 2 — Faux compte patient / fraude

**Symptôme** : multi-comptes, faux nom, no-show systématique, harcèlement d'un médecin.

### Procédure

1. **Identifier les comptes liés** : même IP, même téléphone, même email pattern.
2. **Geler tous les comptes** liés.
3. **Avertir le ou les médecins** harcelés.
4. **Conserver les preuves** (en cas de plainte).
5. **Si menaces ou harcèlement caractérisé** : déposer plainte. Tabibi peut être réquisitionné pour fournir IP / téléphone.
6. **Suppression définitive** des comptes après vérification.

---

## Scénario 3 — Attaque cyber / fuite de données

Voir `PROCEDURE_INCIDENT_TECHNIQUE.md` section 3.3.

### Résumé éclair

- **Confiner sous 1h** (rotation clés, blocage accès).
- **Évaluer sous 24h** (périmètre).
- **Notifier ANPDP sous 72h** + personnes concernées.
- **Communication publique** : sobre, factuelle, pas de panique mais pas de minimisation.
- **Avocat** mobilisé immédiatement.

### Communication type

> Tabibi a détecté le [date] un incident de sécurité ayant pu exposer [type de données] de [nombre approx] utilisateurs. Aucune donnée médicale n'est concernée [si applicable]. Nous avons immédiatement [actions prises]. L'ANPDP est informée. Les personnes concernées ont été contactées individuellement. Nous présentons nos excuses et restons à votre disposition.

---

## Scénario 4 — Plainte juridique reçue (mise en demeure, citation, sommation)

### Heure H

1. **NE PAS répondre à chaud.**
2. **Numériser** la lettre / signification.
3. **Vérifier les délais** mentionnés (souvent 8 à 30 jours).
4. **Contacter l'avocat sous 24h**.
5. **Préserver toutes les preuves** (logs, communications, contrats, signalements antérieurs).

### Décisions

- **Demande légitime** (RGPD non respecté, manquement contractuel avéré) : résolution amiable, transaction si pertinent.
- **Demande abusive ou non fondée** : réponse formelle de l'avocat, contestation.
- **Plainte pénale** : pleine coopération avec les autorités, pas de communication publique.

### Communication

- **Interne** : équipe informée mais consignée à la confidentialité.
- **Externe** : pas de communication sauf nécessité (et toujours sur conseil avocat).

---

## Scénario 5 — Bad press / crise médias

**Symptôme** : article négatif, post viral, accusations publiques.

### Heure H+0 à H+2

1. **Capturer** : screenshots, URL, contexte.
2. **Évaluer** : fondé ? Partiellement fondé ? Pas fondé ?
3. **NE PAS répondre dans la précipitation** sur les réseaux.

### H+2 à H+24

4. Réunir l'équipe : avis croisés.
5. Préparer une **position factuelle**, vérifiable, sans attaque ad hominem.
6. Si applicable : **contacter le journaliste** par email pour rectification / droit de réponse.

### Communication

- **Tonalité** : posée, factuelle, humaine.
- **Pas de défensif** : reconnaître ce qui est vrai, contester ce qui est faux avec preuves.
- **Canal principal** : un seul (LinkedIn ou page presse) — pas se disperser.

### Pièges à éviter

- ❌ Répondre individuellement à chaque commentaire négatif.
- ❌ Effacer / cacher les commentaires (sauf injurieux).
- ❌ Annoncer des actions sans pouvoir les tenir.

---

## Scénario 6 — Médecin influent demande à être déréférencé

**Symptôme** : un médecin avec une forte notoriété ou un réseau important menace publiquement de quitter Tabibi ou demande des conditions particulières.

### Approche

1. Écouter ses griefs.
2. Si griefs légitimes (bug, support trop lent) : corriger.
3. Si demande de conditions spéciales (visibilité supérieure, exclusivité) : **refuser poliment**, expliquer la politique d'équité.
4. S'il insiste à partir : **respecter sa décision**, désactiver la fiche proprement, ne pas escalader.

> Tabibi se veut équitable. Ne créer aucun précédent.

---

## Scénario 7 — Démission soudaine d'un collaborateur clé

### Procédure

1. **Calmement** : reconnaître le départ, ne pas insister si décision ferme.
2. **Restitution** : appliquer la procédure de départ (ONBOARDING_EQUIPE section départ).
3. **Cartographier les zones d'expertise** : qui peut reprendre quoi.
4. **Recruter / former** rapidement.
5. **Honorer les engagements** du collaborateur partant (clients, fournisseurs).

---

## Scénario 8 — Indisponibilité prolongée d'Aghiles (Gérant)

**Cas** : hospitalisation, voyage prolongé, accident.

### Préparation (à faire dès maintenant)

- **Procurations** bancaires limitées au compte courant Tabibi.
- **Délégation de signature** pour les contrats opérationnels en faveur d'un collaborateur de confiance.
- **Accès rotatifs** aux comptes critiques (au moins 2 personnes pour les accès vitaux).
- **Document de continuité** : `docs/operations/CONTINUITE_ACTIVITE.md` (à rédiger ultérieurement).

### En cas de survenance

- **Prendre des nouvelles** d'abord (humain).
- **Communication minimale** vers l'extérieur (pas de drame).
- **Décisions courantes** par le collaborateur délégué.
- **Décisions stratégiques** en attente du retour ou par référent désigné.

---

## Annuaire de crise

| Rôle | Personne | Contact | Disponibilité |
|---|---|---|---|
| Gérant / DPO | Aghiles | aghiles@tabibi.doctor / +213 777 169 074 | 24/7 lancement |
| Avocat | À nommer | | |
| Comptable / Expert-comptable | À nommer | | |
| Hébergeur Supabase | support@supabase.com | | 24/7 selon plan |
| Hébergeur Netlify | support@netlify.com | | 24/7 selon plan |
| ANPDP | À compléter | | |
| CNOM | À compléter | | |

---

## Après-crise — Post-mortem

Pour chaque crise traitée :

1. Rédiger `docs/operations/incidents/YYYY-MM-DD-titre.md` (voir template dans `PROCEDURE_INCIDENT_TECHNIQUE.md`).
2. **Apprendre** : 3 à 5 actions correctives chiffrées et datées.
3. **Mettre à jour ce playbook** avec les nouveaux enseignements.

Le but n'est pas d'éviter toute crise (impossible) mais d'**y répondre vite, proprement, et apprendre à chaque fois**.
