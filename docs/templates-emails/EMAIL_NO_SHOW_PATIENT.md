**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Notification No-Show Patient

**Trigger** : médecin a marqué le patient en « no-show » après l'heure du RDV.
**Expéditeur** : `contact@tabibi.doctor`

3 sous-variantes selon le rang (1er, 2ème, 3ème).

---

## Variables

- `{{prenom}}` : prénom du patient
- `{{titre_medecin}}`, `{{nom_medecin}}`
- `{{date_rdv}}`, `{{heure_rdv}}`
- `{{nb_noshow_6_mois}}` : nombre total de no-show sur la fenêtre glissante
- `{{lien_contestation}}` : lien pour signaler un cas de force majeure
- `{{date_fin_blocage}}` : si applicable

---

## Variante A — 1er no-show

### Objet

```
ℹ️ Vous avez manqué votre RDV du {{date_rdv}}
```

### Corps

```
Bonjour {{prenom}},

Nous remarquons que vous n'avez pas honoré votre rendez-vous prévu le {{date_rdv}} à {{heure_rdv}} avec {{titre_medecin}} {{nom_medecin}}, et n'avez pas annulé à l'avance.

Ce n'est pas grave — ça arrive. Voici un petit rappel de notre fonctionnement :

🔵 Si vous êtes empêché, annulez idéalement 24h avant — c'est rapide depuis "Mes RDV".
🔵 3 absences non excusées en 6 mois bloquent temporairement votre compte. C'est pour préserver la disponibilité des créneaux pour tous les patients.

Vous avez été empêché par un cas de force majeure (hospitalisation, accident, deuil) ? Faites-nous signe avec un justificatif :
→ {{lien_contestation}}

À très vite,
L'équipe Tabibi 🩺
```

---

## Variante B — 2ème no-show (blocage 7 jours)

### Objet

```
⚠️ 2ème absence — votre compte est bloqué 7 jours pour les nouveaux RDV
```

### Corps

```
Bonjour {{prenom}},

Vous n'avez pas honoré votre rendez-vous du {{date_rdv}} avec {{titre_medecin}} {{nom_medecin}}. C'est votre 2ème absence non excusée en 6 mois.

Pour préserver le service pour tous les patients, **votre compte est bloqué pour la prise de nouveaux RDV pendant 7 jours**, jusqu'au {{date_fin_blocage}}.

🔵 Vos RDV déjà confirmés restent valides.
🔵 Après cette période, vous pourrez reprendre normalement.

Une absence justifiée par un cas de force majeure peut être levée :
→ {{lien_contestation}}

Nous comprenons que la vie réserve des imprévus. Annuler à l'avance, même dans la dernière heure, évite ce blocage.

L'équipe Tabibi 🩺
```

---

## Variante C — 3ème no-show (suspension 30 jours)

### Objet

```
🛑 3ème absence — votre compte est suspendu 30 jours
```

### Corps

```
Bonjour {{prenom}},

Vous n'avez pas honoré votre rendez-vous du {{date_rdv}} avec {{titre_medecin}} {{nom_medecin}}. C'est votre 3ème absence non excusée sur une période de 6 mois.

Conformément à la Charte Patient, **votre compte est suspendu pour 30 jours**, jusqu'au {{date_fin_blocage}}.

Pendant cette période :
🔵 Vous ne pouvez pas prendre de nouveaux RDV.
🔵 Vos RDV déjà confirmés restent valides.
🔵 Vous pouvez toujours nous contacter pour le support.

À l'issue, votre compte sera réactivé automatiquement. Une réinscription n'est pas nécessaire.

Si vous estimez qu'une de ces absences était due à un cas de force majeure, écrivez-nous avec un justificatif :
→ {{lien_contestation}}

Nous restons à votre disposition.
L'équipe Tabibi 🩺
```

---

## Notes d'implémentation

- Les seuils 1 / 2 / 3 portent sur les **6 derniers mois glissants**.
- Si le patient ne fait pas de no-show pendant 6 mois, le compteur retombe à 0.
- En cas de contestation acceptée, retirer le no-show du compteur (et déloguer dans `moderation_log`).
- Ne **jamais** mentionner le motif médical éventuel du RDV manqué.
