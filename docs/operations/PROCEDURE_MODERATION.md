**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Procédure de Modération

Document interne décrivant la conduite à tenir face à un signalement, un comportement inapproprié, ou tout incident sur la plateforme.

---

## 1. Principes directeurs

- **Proportionnalité** : sanction proportionnée à la gravité.
- **Contradictoire** : sauf urgence absolue, écouter la partie mise en cause avant de sanctionner.
- **Traçabilité** : tout signalement et toute décision sont consignés dans un journal interne.
- **Confidentialité** : pas de divulgation publique du contenu d'un signalement ou d'une enquête.
- **Pas de discrimination** : aucune sanction sur des critères protégés (origine, religion, sexe, opinion).

---

## 2. SLA de traitement

| Type | Délai de prise en compte | Délai de décision |
|---|---|---|
| Signalement critique (faux médecin, mise en danger, menace) | 1 heure ouvrée | 24 heures |
| Signalement standard (faux avis, conflit) | 24 heures ouvrées | 5 jours ouvrés |
| Signalement mineur (information à mettre à jour) | 48 heures ouvrées | 10 jours ouvrés |

---

## 3. Signalement par un patient

### 3.1 Canaux de réception

- Bouton **« Signaler »** depuis une fiche médecin ou un RDV.
- Email à **contact@tabibi.doctor**.
- WhatsApp **+213 777 169 074**.

### 3.2 Types fréquents

#### A. Médecin absent au RDV / cabinet fermé

1. Accusé de réception au patient sous 24h.
2. Vérifier en interne : combien de tels signalements pour ce médecin ?
   - 1 fois → contact direct du médecin, demande d'explication.
   - 2-3 fois en 6 mois → avertissement formel + audit.
   - Récidive → suspension temporaire 30 jours.
3. Si le médecin reste injoignable plus de 7 jours : suspension du compte.

#### B. Comportement inapproprié du médecin

1. Recueillir les faits **par écrit** (email).
2. **Ne pas qualifier** soi-même (« il était grossier » vs « il a tenu tels propos »).
3. Contact du médecin avec présentation **factuelle** des griefs (sans révéler l'identité du patient si possible).
4. Décision : avertissement / suspension / signalement CNOM selon gravité.
5. Si délit (agression, harcèlement) : orienter le patient vers le dépôt de plainte.

#### C. Tarification abusive

1. Tabibi ne se prononce pas sur le montant des honoraires (libre dans le cadre légal).
2. Vérifier que le tarif affiché correspond à celui facturé.
3. Si écart : demander explication au médecin. Le médecin doit aligner ou justifier.
4. Si litige financier persistant : orienter vers le CNOM.

### 3.3 Faux profils ou usurpation

Priorité absolue. Désactivation immédiate sous 24h dès suspicion sérieuse.

1. Geler la fiche signalée (statut « en vérification »).
2. Demander pièces justificatives à la personne se prétendant titulaire.
3. Comparer avec données CNOM.
4. Décision :
   - Si fraude confirmée → suppression + signalement CNOM + dépôt de plainte si applicable.
   - Si malentendu → réactivation et excuses.

---

## 4. Signalement par un médecin

### 4.1 Canaux

- Bouton **« Signaler »** depuis le dashboard.
- Email à **contact@tabibi.doctor**.

### 4.2 Types fréquents

#### A. Patient en no-show répété ou comportement abusif

1. Vérifier l'historique du patient (no-show, signalements antérieurs).
2. Si abus caractérisé : avertissement / suspension / suppression du compte.
3. Le patient doit pouvoir contester.

#### B. Faux avis / chantage à l'avis

1. Vérifier l'authenticité du compte patient.
2. Vérifier le contenu (manifestement diffamatoire, hors sujet, vulgaire).
3. Si abus : suppression de l'avis + avertissement / suspension du patient.

#### C. Demande de RDV factice ou agressive

Suspension du patient, signalement éventuel aux autorités si menaces.

---

## 5. Critères de suspension d'un compte

### Patient

- 3 no-shows en 6 mois → suspension 30 jours.
- Comportement abusif avéré → suspension 7 à 90 jours.
- Fraude (multi-comptes, fausse identité) → suspension définitive.

### Médecin

- 3 absences non justifiées au RDV en 6 mois → audit + suspension 30 jours.
- Manquement déontologique grave avéré → suspension immédiate + signalement CNOM.
- Fraude documentaire (faux titre) → résiliation immédiate + signalement CNOM + dépôt de plainte.
- Violation du secret médical sur Tabibi → résiliation immédiate.

---

## 6. Procédure de rétablissement

Un compte suspendu peut être rétabli si :

- la durée de suspension est écoulée **ET**
- aucun nouveau signalement n'est survenu pendant la période **ET**
- le compte présente un engagement écrit (pour les cas modérés à graves).

Procédure :

1. Le titulaire envoie une **demande écrite** à contact@tabibi.doctor.
2. L'équipe vérifie historique et engagement.
3. Décision sous 5 jours ouvrés.
4. Si rétablissement : compte réactivé, période de probation 3 mois.
5. Si refus : motivation écrite, possibilité de saisir à nouveau après 6 mois.

---

## 7. Outils de modération internes

À configurer dans le dashboard admin :

- Recherche par nom / email / téléphone.
- Vue historique RDV + signalements + sanctions.
- Boutons : suspendre 7 / 30 / 90 jours, résilier, supprimer définitivement.
- Modèles d'emails pré-rédigés (voir `docs/templates-emails/`).
- **Audit log** : toute action de modération est tracée (qui, quand, quoi, motif).

---

## 8. Communication avec les parties

- **Accuser réception** rapidement.
- **Tenir informé** des grandes étapes (« nous enquêtons », « décision sous X jours »).
- **Notifier** la décision finale, motivée.
- **Ne jamais** divulguer l'identité du signalant si la personne mise en cause n'a pas besoin de la connaître pour se défendre.

---

## 9. Cas particuliers à escalader au Gérant

- Menace de procédure judiciaire.
- Demande des autorités (police, parquet, CNOM, ANPDP).
- Affaire impliquant un médecin influent ou un signalement médiatique potentiel.
- Doute sérieux sur la procédure à suivre.

**Escalade à : aghiles@tabibi.doctor sous 24h.**

---

## 10. Journal de modération

À tenir dans Supabase (table `moderation_log`) avec :

- `id`, `timestamp`, `agent_id`, `subject_user_id`, `subject_type` (patient/medecin), `incident_type`, `severity`, `decision`, `motivation`, `attachments[]`.

Conservation : **5 ans**.
