**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Confirmation de RDV (Médecin)

**Trigger** : nouvelle demande de RDV de la part d'un patient, ou confirmation par le médecin.
**Expéditeur** : `contact@tabibi.doctor`

---

## Variables

- `{{titre_medecin}}` : `Dr.`
- `{{nom_medecin}}` : Nom du médecin
- `{{prenom_patient}}` : prénom du patient
- `{{nom_patient}}` : nom du patient
- `{{telephone_patient}}` : téléphone du patient
- `{{date_rdv}}` : date complète
- `{{heure_rdv}}` : `14:30`
- `{{motif}}` : motif renseigné par le patient (peut être vide)
- `{{nb_rdv_passes}}` : nombre de RDV antérieurs avec ce patient
- `{{lien_dashboard}}` : lien direct vers le RDV dans le dashboard

---

## Objet (version « nouvelle demande »)

```
🆕 Nouvelle demande de RDV — {{date_rdv}} à {{heure_rdv}}
```

## Objet (version « confirmation »)

```
✅ RDV confirmé avec {{prenom_patient}} {{nom_patient}} — {{date_rdv}}
```

---

## Corps (nouvelle demande)

```
{{titre_medecin}} {{nom_medecin}},

Vous avez une nouvelle demande de rendez-vous.

📅 {{date_rdv}} à {{heure_rdv}}
👤 {{prenom_patient}} {{nom_patient}}
📞 {{telephone_patient}}
📝 Motif : {{motif|défaut: "non précisé"}}
🔁 RDV antérieurs avec ce patient : {{nb_rdv_passes}}

→ Confirmer ou décliner : {{lien_dashboard}}

Délai recommandé : confirmer sous 24 heures ouvrées.

Bonne journée,
L'équipe Tabibi
```

---

## Corps (confirmation enregistrée — récap auto)

```
{{titre_medecin}} {{nom_medecin}},

Votre RDV est confirmé.

📅 {{date_rdv}} à {{heure_rdv}}
👤 {{prenom_patient}} {{nom_patient}}
📞 {{telephone_patient}}
📝 Motif : {{motif|défaut: "non précisé"}}

→ Voir dans le dashboard : {{lien_dashboard}}

Le patient a été notifié.

L'équipe Tabibi
```

---

## Notes d'implémentation

- Les emails « nouvelle demande » et « confirmation » sont deux flux distincts.
- En cas d'absence de confirmation sous 48h, déclencher un rappel au médecin.
- Au-delà de 72h, basculer en « annulation automatique pour libérer le patient ».
- L'email n'expose **jamais** de données médicales (motif court non clinique uniquement).
