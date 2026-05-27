**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Bienvenue Patient

**Trigger** : à l'instant où le compte patient est confirmé (email validé).
**Expéditeur** : `contact@tabibi.doctor`
**Réponses possibles** : `support@tabibi.doctor`

---

## Variables

- `{{prenom}}` : prénom du patient
- `{{nom}}` : nom du patient
- `{{wilaya}}` : wilaya déclarée
- `{{site_url}}` : `https://tabibi.doctor`

---

## Objet

```
Bienvenue sur Tabibi, {{prenom}} 👋
```

---

## Corps (HTML — version simplifiée Markdown)

```
Bonjour {{prenom}},

Bienvenue sur Tabibi.doctor — nous sommes ravis de vous compter parmi nous.

Voici ce que vous pouvez faire dès maintenant :

🔍 Rechercher un médecin par spécialité et wilaya
📅 Prendre rendez-vous en quelques clics
📧 Recevoir des rappels avant vos consultations

→ Commencer maintenant : {{site_url}}

Quelques points utiles :

• Le service est entièrement gratuit pour vous.
• Vos données sont sécurisées et hébergées en Europe (RGPD + loi algérienne 18-07).
• Honorer vos RDV (ou les annuler à l'avance) garantit que d'autres patients puissent en bénéficier.

Besoin d'aide ?
→ contact@tabibi.doctor
→ WhatsApp +213 777 169 074

⚠️ Important : Tabibi n'est pas un service d'urgence. En cas d'urgence médicale, composez le 14 (SAMU).

Belle journée,
L'équipe Tabibi 🩺
```

---

## Version texte brut (fallback)

Identique au corps, sans formatage.

---

## Notes d'implémentation

- Délai d'envoi : immédiat après confirmation email.
- Si email non confirmé sous 48h : relance de validation (template séparé à prévoir).
- Tracking : taux d'ouverture, taux de clic CTA principal.
