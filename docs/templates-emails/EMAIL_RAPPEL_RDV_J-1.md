**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Rappel de RDV à J-1

**Trigger** : 24 heures avant l'heure prévue du RDV.
**Expéditeur** : `contact@tabibi.doctor`
**Destinataire** : Patient (et optionnellement Médecin, version courte).

---

## Variables

- `{{prenom}}` : prénom du patient
- `{{titre_medecin}}`, `{{nom_medecin}}`, `{{specialite}}`
- `{{date_rdv}}`, `{{heure_rdv}}`
- `{{adresse_cabinet}}`, `{{telephone_cabinet}}`
- `{{lien_annulation}}`, `{{lien_modif}}`
- `{{lien_itineraire}}` : URL Google Maps avec coordonnées

---

## Objet

```
🔔 Rappel : RDV demain à {{heure_rdv}} avec {{titre_medecin}} {{nom_medecin}}
```

---

## Corps (Patient)

```
Bonjour {{prenom}},

Petit rappel pour votre rendez-vous demain :

📅 {{date_rdv}} à {{heure_rdv}}
👨‍⚕️ {{titre_medecin}} {{nom_medecin}} — {{specialite}}
📍 {{adresse_cabinet}}
📞 {{telephone_cabinet}}

→ Itinéraire : {{lien_itineraire}}

🛟 N'oubliez pas
• Votre pièce d'identité
• Vos documents médicaux utiles
• Le mode de paiement accepté par le cabinet
• D'arriver 5 à 10 min en avance

⚠️ Empêchement ?
Si vous ne pouvez pas y aller, annulez dès maintenant pour libérer le créneau :
→ {{lien_annulation}}

3 absences non excusées en 6 mois bloquent temporairement votre compte. C'est pour préserver la disponibilité des créneaux pour tous.

À demain,
L'équipe Tabibi 🩺

P.S. : urgence médicale ? Composez le 14 (SAMU).
```

---

## Corps (Médecin — version courte, optionnel)

```
{{titre_medecin}} {{nom_medecin}},

Récap de votre journée de demain :
{{liste_rdv}}

→ Dashboard : {{lien_dashboard}}

L'équipe Tabibi
```

---

## Notes d'implémentation

- Envoi entre 18h00 et 20h00 la veille (heure locale Algérie, UTC+1).
- Vérifier au moment de l'envoi que le RDV est toujours actif (statut `confirmed`).
- Si le RDV est annulé entre temps : ne pas envoyer.
- Tracking : taux de clics sur lien itinéraire (engagement) + taux d'annulation post-rappel.
