**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Procédure — Incident technique

Document interne. Conduite à tenir face à un bug critique, une indisponibilité, ou une suspicion de fuite de données.

---

## 1. Classification des incidents

| Sévérité | Définition | Exemples |
|---|---|---|
| **P0 — Critique** | Service indisponible ou fuite de données suspectée | Site KO total, base de données inaccessible, fuite de données |
| **P1 — Majeur** | Fonctionnalité critique cassée, beaucoup d'utilisateurs touchés | Impossibilité de prendre RDV, login cassé, emails non envoyés |
| **P2 — Important** | Fonctionnalité dégradée ou bug touchant une minorité | Recherche imprécise, lenteurs, bug d'affichage |
| **P3 — Mineur** | Bug cosmétique ou contournable | Faute de frappe, alignement CSS, message peu clair |

---

## 2. Détection

### Sources

- **Monitoring** (à mettre en place : UptimeRobot, BetterStack, Sentry).
- **Signalement utilisateur** (email, WhatsApp).
- **Membre de l'équipe** lors d'une vérification.
- **Alertes Supabase / Netlify** automatiques.

### Statut public

Page de statut publique à prévoir (https://status.tabibi.doctor ou bandeau temporaire sur la home).

---

## 3. Procédure P0 — Critique

### 3.1 Indisponibilité totale du site

**Délai cible** : restauration sous 2 heures.

1. **Vérifier Netlify** (status.netlify.com) → si Netlify down : attendre + communiquer.
2. **Vérifier Supabase** (status.supabase.com) → si Supabase down : attendre + communiquer.
3. Si tout est OK chez les hébergeurs :
   - Vérifier les derniers déploiements (Netlify).
   - **Rollback** au dernier déploiement stable si récent (commande `netlify rollback`).
   - Vérifier les logs Netlify Functions / Supabase.
4. **Communiquer** sur le réseau social principal + bandeau si possible : « Service momentanément indisponible. Nous travaillons à la restauration. »
5. **Post-mortem** sous 48 h après résolution.

### 3.2 Indisponibilité Supabase prolongée (> 1 h)

1. Vérifier statut public Supabase.
2. Communiquer aux utilisateurs (Twitter / LinkedIn / bandeau).
3. Pas de rollback possible côté nous : attendre.
4. À l'issue : vérifier intégrité des données (sauvegardes les plus récentes).

### 3.3 Fuite de données suspectée

**PRIORITÉ ABSOLUE.**

#### Étape 1 — Confiner (sous 1 heure)

- Identifier le périmètre : quelle table, quelles données, combien d'enregistrements.
- **Couper** l'accès si possible : révoquer une clé API compromise, désactiver un compte, rotater les secrets.
- **Préserver les preuves** (logs, captures).

#### Étape 2 — Évaluer (sous 24 heures)

- Quelles données sont impliquées ? (nom, email, données médicales = sensible)
- Qui est touché ? Liste précise.
- Quel est l'impact (risque pour les personnes) ?

#### Étape 3 — Notifier (sous 72 heures)

- **ANPDP (Autorité Nationale de Protection des Données Personnelles)** : notification écrite avec description, périmètre, mesures prises (loi 18-07, RGPD).
- **Personnes concernées** : email transparent, sans minimiser, avec recommandations (changer mot de passe, vigilance sur phishing).
- **Conseil de l'avocat** : à activer immédiatement.

#### Étape 4 — Corriger et post-mortem

- Boucher la faille (patch, audit code).
- Audit de sécurité plus large.
- **Post-mortem détaillé** dans `docs/operations/incidents/YYYY-MM-DD-titre.md`.

---

## 4. Procédure P1 — Majeur

### Exemples : login cassé, prise de RDV impossible, emails non envoyés

**Délai cible** : correction sous 24 heures.

1. **Identifier le bug** : logs, reproduction, capture.
2. **Issue GitHub** créée avec label `bug-P1`.
3. **Communiquer** aux utilisateurs (bandeau ou réseau) si l'impact dure plus de 2 h.
4. **Corriger** : branche dédiée, fix, PR, review (autopossible si urgent), déploiement.
5. **Vérifier** la résolution sur prod.
6. **Mettre à jour** les utilisateurs concernés.

---

## 5. Procédure P2 / P3

### P2 — Important

- Issue GitHub `bug-P2`.
- Correction dans la sprint en cours.
- Pas de communication large nécessaire.

### P3 — Mineur

- Backlog.
- Correction lors d'une release suivante.

---

## 6. Communication aux utilisateurs

### Modèle bandeau (P0/P1 > 30 min)

> ⚠️ « Service partiellement indisponible. Nous travaillons à la résolution. Vos données sont en sécurité. »

### Modèle email (P0 résolu)

> Objet : Tabibi.doctor — Incident résolu — [date]
>
> Bonjour,
>
> Tabibi.doctor a connu une indisponibilité de [durée] le [date] entre [heure] et [heure]. Le service est désormais pleinement rétabli.
>
> [Description sobre de la cause]
>
> Aucune donnée n'a été perdue / compromise. Vos rendez-vous restent valides.
>
> Nous vous remercions pour votre patience.
>
> L'équipe Tabibi

### Cas fuite de données

Voir modèle dédié dans `docs/templates-emails/` (à rédiger si incident effectif).

---

## 7. Sauvegardes et résilience

- **Supabase** : sauvegarde automatique quotidienne (selon plan). Rétention : 7 jours minimum recommandé.
- **Export manuel** hebdomadaire des tables critiques (médecins, RDV) au format SQL chiffré dans Google Drive sécurisé.
- **Code** : sauvegardé sur GitHub. Tags de release à chaque déploiement majeur.
- **Configuration Netlify** : versionnée dans `netlify.toml`.
- **Secrets** : Bitwarden / 1Password (jamais en clair dans le repo).

---

## 8. Astreinte

Au lancement : pas d'astreinte 24/7. Engagement « best effort » dans les CGU.

À mesure que la base grandit, mettre en place :

- Rotation d'astreinte entre les 3 collaborateurs.
- Numéro d'astreinte unique.
- Alertes monitoring vers téléphone d'astreinte.

---

## 9. Contacts d'urgence

- **Aghiles (Gérant)** : aghiles@tabibi.doctor
- **Support Supabase** : support@supabase.com (selon plan : email / Slack / Discord)
- **Support Netlify** : support@netlify.com
- **Avocat (à définir)** :
- **DPO** : dpo@tabibi.doctor
- **ANPDP** : adresse à préciser

---

## 10. Template post-mortem

```
# Post-mortem : [titre] — YYYY-MM-DD

## Résumé
[2-3 phrases]

## Chronologie
- HH:MM — Détection
- HH:MM — ...

## Cause racine
[Description technique]

## Impact
- Durée
- Nombre d'utilisateurs touchés
- Données touchées (le cas échéant)

## Réponse
[Ce qui a été fait]

## Leçons
[3 à 5 points]

## Actions correctives
- [ ] Action 1 — responsable / délai
- [ ] Action 2 ...
```
