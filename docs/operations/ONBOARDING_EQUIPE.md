**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Onboarding d'un nouveau collaborateur Tabibi

Document interne destiné au Gérant (Aghiles) et à toute personne en charge d'accueillir un nouveau collaborateur (salarié, stagiaire, freelance long terme).

---

## Objectifs

- Intégrer rapidement et proprement le collaborateur.
- Garantir la **protection des données** dès le jour 1.
- Donner le **contexte business** suffisant pour être autonome.
- Tracer les accès donnés (et donc à retirer le jour du départ).

---

## J-7 — Avant l'arrivée

### Préparer

- [ ] Confirmer la **date de démarrage**.
- [ ] Préparer le **contrat** (salariat, stage, freelance).
- [ ] Préparer l'**Accord de Confidentialité (NDA)**.
- [ ] Préparer les **accès** à activer le jour J (cf. checklist accès ci-dessous).
- [ ] Informer l'équipe de l'arrivée (canal interne).

---

## J0 — Jour d'arrivée

### Documents à signer (papier ou signature électronique)

- [ ] **Contrat** (salariat / stage / freelance / prestation)
- [ ] **Accord de Confidentialité (NDA)** — `docs/contrats/ACCORD_CONFIDENTIALITE_EQUIPE.md`
- [ ] **Charte d'utilisation des outils internes** (à rédiger ultérieurement)
- [ ] **Politique de protection des données** internes
- [ ] Copie **CIN / passeport**
- [ ] **RIB** pour paiement (si salarié/freelance algérien)

> Archiver les documents signés dans Google Drive : `Equipe/[Nom_Collaborateur]/Documents/`.

### Briefing

Présenter (en environ 1h) :

1. **La mission** : faciliter l'accès aux soins en Algérie via une plateforme tech sobre et fiable.
2. **Le contexte** : 79 000 fiches scrapées, lancement juin 2026, modèle gratuit B2B2C.
3. **L'équipe** : Aghiles + 2 collaborateurs.
4. **L'organisation** : OKR trimestriels, point hebdo dimanche soir, canal WhatsApp Business.
5. **Les valeurs** : confidentialité absolue, respect du secret médical, qualité avant croissance.
6. **Lecture obligatoire** :
   - `docs/legal/CGU.md`
   - `docs/legal/POLITIQUE_CONFIDENTIALITE.md`
   - `docs/legal/CHARTE_DEONTOLOGIQUE_MEDECIN.md`
   - `docs/operations/PROCEDURE_RGPD.md`
   - `docs/operations/PROCEDURE_MODERATION.md`

---

## Accès à activer (checklist)

À adapter selon le rôle. Privilégier le **principe du moindre privilège** : ne donner que ce qui est strictement nécessaire.

| Outil | Niveau | Pour qui | Action |
|---|---|---|---|
| **Email pro** `prenom@tabibi.doctor` | Standard | Tous | Créer alias / boîte |
| **Supabase** | Lecture seule, Lecture/Écriture, Admin | Selon rôle | Inviter + définir rôle |
| **Netlify** | Lecture, Deploy | Dev / Ops | Inviter sur l'équipe |
| **GitHub** (org `Ariles2025-ops`) | Read, Write, Admin | Selon rôle | Inviter dans repo `tabibi-doctor` |
| **Google Drive** (équipe Tabibi) | Lecture, Édition | Tous, selon dossier | Partager les dossiers concernés |
| **WhatsApp Business** | — | Support | Ajouter à la ligne pro |
| **Notion / Linear / Trello** (si utilisé) | Workspace | Tous | Inviter |
| **Cloudflare** (DNS) | Lecture | Dev | Inviter en tant que collaborateur |
| **Compte registrar domaines** | Admin restreint | Aghiles seul | Ne PAS partager |
| **Bitwarden / 1Password** (gestionnaire mdp) | Collection partagée | Tous | Inviter |
| **Outils analytics** | Lecture | Tous | Inviter |

### Règles d'or

- ✅ **MFA / 2FA obligatoire** sur tous les comptes pro (Google, GitHub, Supabase, Netlify).
- ✅ Mot de passe unique par service via le gestionnaire de mots de passe.
- ❌ Pas de partage de compte personnel.
- ❌ Pas de copie de la base sur un terminal non chiffré.
- ❌ Pas d'envoi de données patients par email personnel.

---

## Formation opérationnelle (selon rôle)

### Pour rôle « Support / Ops »

- [ ] Procédure **claim WhatsApp** : `docs/PROCEDURE_CLAIM_WHATSAPP.md`
- [ ] Procédure **modération** : `docs/operations/PROCEDURE_MODERATION.md`
- [ ] Procédure **RGPD** : `docs/operations/PROCEDURE_RGPD.md`
- [ ] Tour du **dashboard admin** : `/admin-dashboard.html`
- [ ] Templates **WhatsApp / Email** : `docs/templates-emails/`

### Pour rôle « Dev »

- [ ] Stack : HTML/CSS/JS vanilla + Supabase + Netlify.
- [ ] Convention de commits.
- [ ] Workflow GitHub (branche, PR, review).
- [ ] Procédure **incident technique** : `docs/operations/PROCEDURE_INCIDENT_TECHNIQUE.md`.
- [ ] Tour des migrations SQL : `migrations/`.

### Pour rôle « Sales / Acquisition »

- [ ] **Script de pitch médecin** : `docs/marketing/SCRIPT_PITCH_MEDECIN.md`
- [ ] **Plan de launch** : `docs/marketing/PLAN_LAUNCH_JUIN2026.md`
- [ ] Tour du CRM / fichier prospects.
- [ ] Procédure de **signature de contrat** sur place.

---

## J+30 — Bilan d'intégration

- [ ] Point 1:1 de 30 min avec Aghiles.
- [ ] Le collaborateur lit-il et utilise-t-il les documents ?
- [ ] Quels accès sont effectivement utilisés ? Lesquels ne servent à rien ? (révoquer)
- [ ] Quels obstacles rencontrés ? Quels manques de documentation ?
- [ ] Objectifs à 90 jours.

---

## Départ d'un collaborateur

Procédure miroir, à exécuter **le jour même** du départ (ou en J-1) :

- [ ] Réunion de **debrief / restitution**.
- [ ] **Restitution des matériels** (laptop, badges, clé USB).
- [ ] **Révoquer tous les accès** (cf. checklist ci-dessus).
- [ ] **Changer les mots de passe partagés** auxquels la personne avait accès.
- [ ] **Désactiver** le compte email pro (mettre en archive 90 jours puis supprimer).
- [ ] **Rappeler** les obligations de confidentialité post-départ (NDA : 5 ans + illimité pour les données de santé).
- [ ] **Documenter** dans Google Drive `Equipe/[Nom]/Depart.md` : motif, date, accès révoqués.

---

## Contacts utiles

- **Gérant / DPO** : Aghiles Haddadene — aghiles@tabibi.doctor
- **Standard** : contact@tabibi.doctor
- **Support technique** : à définir
