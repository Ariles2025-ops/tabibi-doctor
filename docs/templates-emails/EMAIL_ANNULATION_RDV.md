**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Annulation de RDV

**Trigger** : annulation d'un RDV (par patient, par médecin, ou automatique).
**Expéditeur** : `contact@tabibi.doctor`

3 sous-variantes selon qui annule.

---

## Variables communes

- `{{prenom_patient}}`, `{{nom_patient}}`
- `{{titre_medecin}}`, `{{nom_medecin}}`, `{{specialite}}`
- `{{date_rdv}}`, `{{heure_rdv}}`
- `{{motif_annulation}}` (optionnel — sanitisé, sans donnée sensible)
- `{{lien_reprise_rdv}}` : suggestions de créneaux alternatifs

---

## Variante A — Annulé par le patient → notif au médecin

### Objet

```
❌ RDV annulé par le patient — {{date_rdv}} à {{heure_rdv}}
```

### Corps

```
{{titre_medecin}} {{nom_medecin}},

Un patient a annulé un rendez-vous.

📅 {{date_rdv}} à {{heure_rdv}}
👤 {{prenom_patient}} {{nom_patient}}
{{#motif_annulation}}📝 Motif : {{motif_annulation}}{{/motif_annulation}}

Le créneau a été libéré dans votre agenda et est de nouveau disponible.

L'équipe Tabibi
```

---

## Variante B — Annulé par le médecin → notif au patient

### Objet

```
❌ RDV du {{date_rdv}} annulé par le cabinet
```

### Corps

```
Bonjour {{prenom_patient}},

Votre rendez-vous avec {{titre_medecin}} {{nom_medecin}} prévu le {{date_rdv}} à {{heure_rdv}} a malheureusement été annulé par le cabinet.

{{#motif_annulation}}📝 Motif communiqué : {{motif_annulation}}{{/motif_annulation}}

Nous comprenons que c'est désagréable, et nous en sommes désolés.

→ Reprendre rendez-vous avec {{titre_medecin}} {{nom_medecin}} : {{lien_reprise_rdv}}

→ Voir d'autres médecins en {{specialite}} : {{lien_specialite}}

Une question ?
→ contact@tabibi.doctor
→ WhatsApp +213 777 169 074

L'équipe Tabibi 🩺
```

---

## Variante C — Annulation automatique (médecin n'a pas confirmé sous 72h)

### Objet

```
ℹ️ Votre demande de RDV n'a pas été confirmée — autre créneau ?
```

### Corps

```
Bonjour {{prenom_patient}},

Votre demande de rendez-vous avec {{titre_medecin}} {{nom_medecin}} prévue le {{date_rdv}} à {{heure_rdv}} n'a pas été confirmée à temps par le cabinet. Nous l'avons annulée pour ne pas vous laisser dans l'attente.

→ Reprendre un autre créneau avec {{titre_medecin}} {{nom_medecin}} : {{lien_reprise_rdv}}

→ Voir d'autres médecins en {{specialite}} : {{lien_specialite}}

Nous sommes désolés du désagrément.

L'équipe Tabibi 🩺
```

---

## Notes d'implémentation

- Envoi instantané au déclenchement de l'annulation.
- `motif_annulation` est facultatif et **toujours filtré** pour éliminer toute donnée médicale identifiante.
- L'historique de l'annulation est conservé (qui, quand, motif) dans la table `appointments` pour les statistiques.
- Si le patient a annulé plusieurs fois récemment : envisager un email d'accompagnement séparé sur les règles no-show.
