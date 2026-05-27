**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Suspension de compte

**Trigger** : décision de suspension par l'équipe modération (hors automatique no-show).
**Expéditeur** : `contact@tabibi.doctor`

Deux variantes : compte patient / compte médecin.

---

## Variables communes

- `{{prenom_ou_titre_nom}}` : selon profil
- `{{motif_resume}}` : résumé factuel du grief
- `{{duree_suspension}}` : ex. « 30 jours », « illimitée »
- `{{date_fin}}` : si applicable, sinon « jusqu'à nouvel ordre »
- `{{lien_contestation}}` : lien sécurisé vers le formulaire de contestation
- `{{date_decision}}` : date de la décision

---

## Variante A — Patient

### Objet

```
⚠️ Suspension de votre compte Tabibi
```

### Corps

```
Bonjour {{prenom_ou_titre_nom}},

À la suite d'un examen, votre compte Tabibi est suspendu pour {{duree_suspension}}, à compter du {{date_decision}}.

📝 Motif :
{{motif_resume}}

Pendant la suspension :
🔵 Vous ne pouvez pas prendre de nouveaux rendez-vous.
🔵 Vos RDV déjà confirmés restent valides.
🔵 L'accès à vos données reste possible (consultation, demande RGPD).

📨 Contester
Si vous estimez que cette décision n'est pas justifiée, vous pouvez nous écrire en envoyant tout élément utile :
→ {{lien_contestation}}
Nous vous répondrons sous 5 jours ouvrés.

Cette décision est prise dans un cadre proportionné et au regard des engagements de la Charte Patient que vous avez acceptés lors de votre inscription.

Cordialement,
L'équipe Modération Tabibi
contact@tabibi.doctor
```

---

## Variante B — Médecin

### Objet

```
⚠️ Suspension de votre compte Médecin Tabibi
```

### Corps

```
Docteur {{prenom_ou_titre_nom}},

À la suite d'un examen, votre compte Médecin sur Tabibi est suspendu pour {{duree_suspension}}, à compter du {{date_decision}}.

📝 Motif :
{{motif_resume}}

Conséquences immédiates :
🔵 Votre fiche n'est plus visible dans les recherches publiques.
🔵 La prise de nouveaux RDV est désactivée.
🔵 Vos RDV déjà confirmés sont, selon le motif, soit maintenus, soit annulés avec information aux patients concernés.
🔵 Votre dashboard reste accessible en lecture seule.

📨 Vous pouvez exercer votre droit à la défense
Nous vous invitons à présenter vos observations dans un délai de 7 jours :
→ {{lien_contestation}}

Nous examinerons attentivement votre réponse avant toute décision définitive.

Conformément à votre Contrat de Partenariat (article 11.2 — Résiliation pour faute), cette mesure conservatoire ne préjuge pas de la décision finale.

En cas de manquement déontologique présumé grave, nous nous réservons par ailleurs le droit de signaler le dossier au Conseil National de l'Ordre des Médecins.

Pour toute question : contact@tabibi.doctor

Cordialement,
L'équipe Tabibi
```

---

## Notes d'implémentation

- **Toute suspension est tracée** dans `moderation_log` (qui, quand, motif, durée).
- **Pas de divulgation** de l'identité du signalant.
- **Pas de qualification pénale** dans le motif (« vous avez agressé… ») — toujours factuel (« propos signalés comme injurieux »).
- À la fin de la suspension, **email de réactivation** automatique avec rappel des règles.
- Pour les médecins, prévoir un appel téléphonique du Gérant en complément de l'email si la situation est grave (humanité + médiation).
- En cas de suspicion d'infraction pénale : tenir au courant l'avocat avant tout envoi.
