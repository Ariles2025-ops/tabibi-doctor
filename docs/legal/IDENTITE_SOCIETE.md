**Version** : 1.0
**Date** : 6 août 2026
**Statut** : REGISTRE OPÉRATIONNEL — à tenir à jour

---

# Identité société — registre des emplacements à renseigner

Ce fichier existe pour une seule raison : le jour où les numéros
d'immatriculation de Tabibi SARL sont émis, **il ne doit pas falloir les
chercher**. Toutes les mentions dispersées dans le dépôt sont recensées ici,
avec leur emplacement exact et le format attendu.

> ⚠️ **Ce n'est pas une source de vérité juridique.** Les valeurs ci-dessous
> restent vides tant qu'elles ne sont pas officiellement émises. Ne jamais
> inventer, extrapoler ni « provisionner » un numéro : un contrat signé au
> congrès portant un faux RC est un faux en écriture, pas une approximation.

---

## 1. Valeurs de référence

| Donnée | Valeur | Source / statut |
|---|---|---|
| Dénomination sociale | **TABIBI SARL** | établie |
| Forme | SARL de droit algérien | établie |
| Gérant | **Aghiles HADDADENE** | établie |
| Capital social | **100 000 DZD** | déjà affiché dans `legal/cgu.html` et `legal/mentions-legales.html` |
| Registre du Commerce (RC) | _(non émis)_ | CNRC d'Alger |
| NIF — n° d'identification fiscale | _(non émis)_ | émis après RC |
| NIS — n° d'identification statistique | _(non émis)_ | émis après RC |
| Siège social | _(non arrêté)_ | Alger |
| Dépôt de marque INAPI (« Tabibi » / « طبيبي ») | _(non déposé)_ | INAPI |
| Déclaration ANPDP | _(non déposée)_ | obligatoire — traitement de données de santé |

---

## 2. Emplacements à renseigner — 16 occurrences dans 12 fichiers

### 2.1 Bloquant pour le congrès des 3-5 décembre 2026

Ces trois lignes sont sur les documents que le médecin **signe et emporte**.

| Fichier | Ligne | Attendu |
|---|---|---|
| `docs/contrats/CONTRAT_PARTENARIAT_MEDECIN.md` | 13 | n° RC + siège social (2 champs `_____`) |
| `docs/contrats/DOSSIER_SIGNATURE_CONGRES.md` | 47 | idem — **fichier généré, corriger la source puis régénérer** |
| `docs/contrats/DOSSIER_SIGNATURE_CONGRES.md` | 569, 598-599 | adresse postale + identité du responsable de traitement |

### 2.2 Pages légales publiques (servies en production)

| Fichier | Ligne | Placeholder actuel |
|---|---|---|
| `legal/mentions-legales.html` | 93 | `[À compléter après CNRC]` — N° RC |
| `legal/mentions-legales.html` | 94 | `[À compléter]` — NIF |
| `legal/mentions-legales.html` | 102 | ~~`[NOM DU GÉRANT]`~~ → **renseigné le 06/08/2026** |
| `legal/mentions-legales.html` | 120 | `[À COMPLÉTER]` — n° de dépôt INAPI |
| `legal/mentions-legales.html` | 126 | `[À COMPLÉTER]` — n° de déclaration ANPDP |
| `legal/mentions-legales.html` | 153 | `[Adresse à finaliser après immatriculation CNRC]` |
| `legal/mentions-legales.html` | 206 | `[TBC]` — NIF, version anglaise |
| `legal/cgu.html` | 126 | `[N° RC]` |

### 2.3 Documents internes et contractuels secondaires

| Fichier | Ligne | Attendu |
|---|---|---|
| `docs/legal/MENTIONS_LEGALES.md` | 15, 18-20, 90 | RC, NIF, NIS, siège |
| `docs/legal/CGU.md` | 13, 20, 158 | mention « en cours de constitution », siège |
| `docs/legal/POLITIQUE_CONFIDENTIALITE.md` | 15-16 | identité + adresse du responsable de traitement |
| `docs/contrats/ACCORD_CONFIDENTIALITE_EQUIPE.md` | 13 | mention « en cours de constitution » |
| `docs/contrats/CONTRAT_PRESTATAIRE.md` | 13 | idem |

*(`CONTRAT_PRESTATAIRE.md:21` et `PRESTATAIRE_ANNEXE2:23` attendent l'immatriculation **du prestataire**, pas celle de Tabibi — ne pas les confondir.)*

---

## 3. Procédure de renseignement — le jour où les numéros arrivent

1. Renseigner le tableau §1 de ce fichier **en premier**.
2. Propager dans les 8 emplacements publics (§2.2) — ce sont eux qui exposent
   Tabibi à un contrôle.
3. Propager dans les documents contractuels (§2.1, §2.3).
4. **Régénérer** `DOSSIER_SIGNATURE_CONGRES.md` depuis ses 4 sources — ne
   jamais l'éditer à la main, il porte un avertissement en tête.
5. Retirer partout la mention « en cours de constitution ».
6. Vérification finale :
   ```bash
   git grep -nIE "à compléter|À COMPLÉTER|\[TBC\]|\[N° RC\]|en cours de constitution" -- docs legal
   ```
   Doit ne rien renvoyer.

---

## 4. Si les numéros ne sont pas émis avant le congrès

C'est le scénario à préparer, pas à espérer éviter. Le pitch prévoit déjà
l'objection (O7 de `docs/marketing/SCRIPT_PITCH_MEDECIN.md`), mais un contrat
avec deux champs vides à l'endroit où le médecin cherche l'identité de son
cocontractant est un signal de fragilité au moment précis de la signature.

**Trois options, par ordre de préférence :**

| # | Option | Ce que ça coûte |
|---|---|---|
| 1 | **Immatriculation obtenue avant le 3 décembre** | démarche CNRC à lancer immédiatement — c'est la seule option qui supprime le problème |
| 2 | **Signer des lettres d'intention**, non des contrats | le médecin s'engage à rejoindre Tabibi à l'activation ; on repasse signer le contrat définitif une fois le RC émis. Honnête, mais double le travail commercial et perd l'effet « signé sur place » |
| 3 | **Signer le contrat avec mention manuscrite** « RC en cours d'immatriculation, communiqué au Médecin dès émission » paraphée par les deux parties | juridiquement fragile — **à ne faire que sur avis de l'avocat** |

⚠️ L'option 3 n'est pas validée. Elle figure ici parce qu'elle sera tentante
sur le stand ; elle doit être tranchée par l'avocat **avant** le congrès, pas
improvisée devant un médecin.

---

## 5. Conséquence sur l'objection O7 du pitch

La réponse actuelle (« le Registre est en cours d'enregistrement au CNRC
d'Alger ») reste vraie mais laisse le médecin sans rien de vérifiable. Tant que
le RC n'est pas émis, l'accompagner d'un élément tangible :

- le **récépissé de dépôt CNRC** (à avoir en photo sur le téléphone) ;
- l'engagement écrit de communiquer RC et NIF dès émission — déjà prévu par le
  pitch, à tenir dans les 48 h suivant l'émission ;
- ne **jamais** répondre « oui » à « vous avez un Registre du Commerce ? » avant
  qu'il existe. Le pitch l'interdit déjà (« ❌ Mentir sur un point
  réglementaire »), et un médecin qui découvre après signature que le RC
  n'existait pas résilie et le raconte à ses confrères.
