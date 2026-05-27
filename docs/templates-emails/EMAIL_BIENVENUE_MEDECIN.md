**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR

---

# Email — Bienvenue Médecin

**Trigger** : à l'activation du compte médecin (claim validé + contrat signé).
**Expéditeur** : `contact@tabibi.doctor`

---

## Variables

- `{{titre}}` : `Dr.`
- `{{nom_complet}}` : Nom complet du médecin
- `{{specialite}}` : spécialité principale
- `{{lien_dashboard}}` : `https://tabibi.doctor/doctor-dashboard.html`
- `{{lien_guide}}` : `https://tabibi.doctor/guides/medecin/demarrage`

---

## Objet

```
{{titre}} {{nom_complet}}, votre compte Tabibi est activé
```

---

## Corps

```
{{titre}} {{nom_complet}},

Votre compte Tabibi.doctor est activé. Merci pour votre confiance.

Voici les 3 prochaines étapes (~15 minutes) :

1. Connectez-vous à votre tableau de bord :
   → {{lien_dashboard}}

2. Complétez votre profil :
   • Photo professionnelle
   • Biographie courte
   • Tarifs et langues parlées
   • Adresse cabinet précise

3. Configurez vos créneaux pour les 2 à 4 prochaines semaines.

📖 Guide de démarrage complet :
   → {{lien_guide}}

À retenir
─────────
• Service entièrement gratuit pour vous au lancement.
• Aucune commission sur vos honoraires.
• Service non-exclusif : vous gardez votre liberté.
• Vos données et celles de vos patients sont chiffrées (RGPD + loi 18-07).
• Préavis 30 jours pour résilier à tout moment.

Notre engagement : un service utilitaire, sobre, respectueux de la déontologie.

Une question ?
→ contact@tabibi.doctor
→ WhatsApp +213 777 169 074

Bienvenue à bord, {{titre}}.

L'équipe Tabibi 🩺
```

---

## Pièces jointes

- Contrat de Partenariat signé (PDF) — copie pour archives du médecin
- Charte Déontologique signée (PDF)

---

## Notes d'implémentation

- Envoyé manuellement ou via flow automatisé après validation finale par l'équipe ops.
- Lien dashboard avec token de première connexion (changer mdp obligatoire).
- Inclure le rappel des identifiants (login = email pro) — JAMAIS le mot de passe en clair.
