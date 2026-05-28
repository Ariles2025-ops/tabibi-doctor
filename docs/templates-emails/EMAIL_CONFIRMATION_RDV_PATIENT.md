**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Confirmation de RDV (Patient)

**Trigger** : médecin a confirmé le RDV.
**Expéditeur** : `contact@tabibi.doctor`

---

## Variables

- `{{prenom}}` : prénom du patient
- `{{titre_medecin}}` : `Dr.`
- `{{nom_medecin}}` : Nom complet du médecin
- `{{specialite}}` : spécialité
- `{{date_rdv}}` : `lundi 12 septembre 2026`
- `{{heure_rdv}}` : `14:30`
- `{{adresse_cabinet}}` : adresse complète
- `{{telephone_cabinet}}` : téléphone direct du cabinet
- `{{lien_annulation}}` : lien sécurisé d'annulation
- `{{lien_modif}}` : `https://tabibi.doctor/mes-rdv`

---

## Objet

```
✅ RDV confirmé avec {{titre_medecin}} {{nom_medecin}} — {{date_rdv}}
```

---

## Corps

```
Bonjour {{prenom}},

Votre rendez-vous est confirmé.

📅 {{date_rdv}} à {{heure_rdv}}
👨‍⚕️ {{titre_medecin}} {{nom_medecin}} — {{specialite}}
📍 {{adresse_cabinet}}
📞 {{telephone_cabinet}}

→ Ajouter à mon calendrier : [Google] [Apple] [Outlook]

À préparer
──────────
• Pièce d'identité
• Ordonnances précédentes, examens utiles
• Mode de paiement (espèces / chèque / CIB selon le médecin)
• Arriver 5 à 10 min en avance

Empêchement ?
─────────────
• Annuler ou modifier : {{lien_modif}}
• Préavis minimum recommandé : 24 heures
• Au-delà de 3 absences non excusées sur 6 mois, votre compte est temporairement bloqué.

Vous recevrez un rappel automatique 24 heures avant.

Belle journée,
L'équipe Tabibi 🩺

P.S. : Tabibi n'est pas un service d'urgence. En cas d'urgence : 14 (SAMU).
```

---

## Notes

- Inclure les boutons « Ajouter au calendrier » avec lien `.ics` ou URL Google Calendar.
- Le lien d'annulation contient un token unique signé (expiration au moment du RDV).
- Si le RDV est dans moins de 24h : envoi immédiat sans rappel ultérieur.
