> ⚠️ **DISCLAIMER** : document de travail interne, destiné à l'avocat conseil. Ne pas publier. Exclu du déploiement par `.gitattributes` (`docs/` en `export-ignore`).

**Version** : 1.0
**Date** : 5 août 2026
**Statut** : À ENVOYER
**Échéance impérative** : 3 décembre 2026 (congrès, stand payé)

---

# Note de cadrage — validation juridique

13 documents contractuels et légaux · Plateforme de prise de rendez-vous médicaux · Droit algérien

## 1. Objet de la consultation

Tabibi SARL exploitera à partir de décembre 2026 une plateforme en ligne de prise de rendez-vous médicaux en Algérie. Treize documents contractuels et légaux ont été rédigés en interne. Ils portent tous la mention « DRAFT — en attente de validation par avocat » et n'ont jamais été soumis à un juriste.

La consultation demandée a deux objets distincts, dont le second est prioritaire :

- valider ou corriger les treize documents listés en section 3, pour qu'ils puissent être signés et publiés ;
- se prononcer sur les huit points de droit listés en section 4, dont certains conditionnent la viabilité même du modèle et ne relèvent pas d'une simple relecture.

## 2. Contexte factuel

| Élément | Situation |
|---|---|
| Société | Tabibi SARL, constituée. Gérant : Aghiles Haddadene. Le modèle de contrat porte encore la mention « en cours de constitution » et un n° de registre du commerce à compléter. |
| Activité | Annuaire de médecins et prise de rendez-vous en ligne. Gratuit pour les patients. Gratuit pour les médecins au lancement, avec une évolution tarifaire par abonnement prévue. |
| Base de données | Environ 79 700 fiches de médecins constituées à partir de sources publiques (annuaire de l'Ordre, sites institutionnels), sans consentement préalable des intéressés. |
| Visibilité publique | Seules les fiches revendiquées et validées sont affichées publiquement. Les autres restent en base, invisibles, et servent au pré-remplissage lors de la revendication. |
| Hébergement | Supabase, infrastructure située dans l'Union européenne (Allemagne). Aucune donnée n'est hébergée en Algérie. |
| Données traitées | Identité du patient, numéro de téléphone, motif de consultation le cas échéant, historique des rendez-vous, identité du praticien consulté. |
| Authentification | Code à usage unique par SMS pour les patients et les médecins. |
| Revendication de fiche | Deux parcours : à distance par WhatsApp avec validation manuelle, ou physiquement au cabinet avec signature du formulaire de consentement. |
| Mentions légales | **Publiées incomplètes** — 7 champs non renseignés en production à la date de la note : n° RC, NIF, NAI, capital social, n° de dépôt INAPI, n° de déclaration ANPDP. |
| Échéance | Congrès médical du 3 au 5 décembre 2026, stand déjà payé. Les contrats doivent pouvoir être signés sur place. |

## 3. Documents soumis

Tous sont rédigés en français, versionnés dans le dépôt, convertibles en tout format souhaité. Tous portent la mention DRAFT.

### Documents légaux publiés sur le site — `docs/legal/`

| Fichier | Volume | Point d'attention signalé |
|---|---|---|
| `CGU.md` | 162 lignes | Articulation avec le code de déontologie ; clause de responsabilité médicale |
| `POLITIQUE_CONFIDENTIALITE.md` | 143 lignes | Fondement légal du traitement ; transfert hors Algérie |
| `CHARTE_DEONTOLOGIQUE_MEDECIN.md` | 129 lignes | Renvoi au décret exécutif 92-276 |
| `CHARTE_PATIENT.md` | 117 lignes | — |
| `POLITIQUE_COOKIES.md` | 105 lignes | Recueil du consentement ; pixel publicitaire Meta |
| `MENTIONS_LEGALES.md` | 94 lignes | Mentions obligatoires de l'éditeur ; n° RC à compléter |
| `POLITIQUE_REMBOURSEMENT.md` | 71 lignes | Service gratuit au lancement — utilité à confirmer |

### Documents publiés sans source markdown — `legal/`

Ces deux documents sont **en ligne** mais n'ont pas d'équivalent rédigé dans
`docs/legal/`. Ils ont été omis du décompte initial de onze.

| Fichier | Volume | Point d'attention signalé |
|---|---|---|
| `legal/dpa.html` | 270 lignes | **Rattaché au point 4.2** — c'est le document qui traite du transfert de données hors du territoire national |
| `legal/rgpd-droits.html` | 340 lignes | Exercice des droits des personnes concernées ; articulation entre le RGPD européen et la loi 18-07 |

### Contrats à faire signer — `docs/contrats/`

| Fichier | Volume | Point d'attention signalé |
|---|---|---|
| `CONTRAT_PARTENARIAT_MEDECIN.md` | 228 lignes | **Document critique** — sera signé au congrès. Art. 5 : gratuité puis tarification avec préavis de 60 jours |
| `CONTRAT_PRESTATAIRE.md` | 148 lignes | — |
| `ACCORD_CONFIDENTIALITE_EQUIPE.md` | 151 lignes | — |
| `CONSENTEMENT_CLAIM_FICHE.md` | 115 lignes | Signé au cabinet. Conservation 90 jours de la photo de la carte de l'Ordre |

## 4. Points de droit à trancher

Classés par gravité. Les trois premiers ne sont pas des questions de rédaction : une réponse négative impose de modifier le produit avant le lancement.

### 4.1 — Licéité de la base de 79 700 fiches non consenties

La base a été constituée par extraction de sources publiques. Les médecins concernés n'ont ni consenti, ni été informés. La loi n° 18-07 du 10 juin 2018 exige un fondement licite pour tout traitement de données à caractère personnel.

**Questions** : le caractère public de la source constitue-t-il un fondement suffisant en droit algérien ? La conservation de fiches non revendiquées et non affichées est-elle licite ? Une information préalable des personnes concernées est-elle obligatoire, et sous quelle forme ? Le fait de ne rendre publiques que les fiches revendiquées suffit-il à écarter le risque ?

*Rattachement documentaire* : `docs/legal/POLITIQUE_CONFIDENTIALITE.md`, `docs/contrats/CONSENTEMENT_CLAIM_FICHE.md` (Contexte, art. 3).

### 4.2 — Hébergement hors d'Algérie et autorisation ANPDP

L'intégralité des données, y compris les données de rendez-vous rattachant un patient identifié à un praticien identifié, est hébergée dans l'Union européenne.

**Questions** : un transfert de données à caractère personnel hors du territoire national requiert-il l'autorisation préalable de l'Autorité nationale de protection des données personnelles ? Cette autorité est-elle opérationnelle et cette autorisation obtenable dans le délai disponible ? À défaut, un hébergement en Algérie est-il juridiquement obligatoire, et sous quel délai ? Quelle est l'exposition en cas d'exploitation sans autorisation ?

*Rattachement documentaire* : `docs/legal/POLITIQUE_CONFIDENTIALITE.md`, `legal/dpa.html` (270 lignes, joint — document central sur ce point).

### 4.3 — Qualification des données de rendez-vous

Un rendez-vous associe un patient identifié à un médecin dont la spécialité est publique. L'information « ce patient consulte un cardiologue » se déduit sans autre traitement.

**Questions** : ces données constituent-elles des données de santé au sens de la loi 18-07 ? Si oui, quelles obligations renforcées s'appliquent — autorisation préalable plutôt que déclaration, mesures de sécurité, durée de conservation, désignation d'un délégué à la protection des données ? Le motif de consultation, lorsqu'il est renseigné, change-t-il la qualification ?

### 4.4 — Modèle économique et code de déontologie

Le décret exécutif n° 92-276 encadre la publicité médicale et prohibe le compérage. Tabibi ne perçoit aucune commission sur les honoraires, mais prévoit un abonnement forfaitaire payé par le praticien, ainsi qu'un classement des fiches dans les résultats de recherche.

Le modèle économique est **exclusivement un abonnement forfaitaire, jamais une commission** — ni sur les honoraires de consultation, ni sur le volume de rendez-vous, sous aucune forme. L'article 5.2 du contrat de partenariat mentionnait encore la commission parmi les évolutions tarifaires envisageables, en contradiction avec l'article 5.3 qui l'exclut ; cette mention a été retirée le 5 août 2026 et les deux articles concordent désormais.

**Questions** : l'abonnement forfaitaire est-il licite au regard du décret 92-276 ? Un référencement mis en avant contre rémunération serait-il assimilable à de la publicité prohibée ou à du compérage ? La publication d'avis de patients sur un praticien nommément désigné est-elle admissible, et quel régime de responsabilité pèse sur la plateforme ?

*Rattachement documentaire* : `docs/contrats/CONTRAT_PARTENARIAT_MEDECIN.md` art. 5, `docs/legal/CHARTE_DEONTOLOGIQUE_MEDECIN.md`, `legal/cgu.html` (clause « aucune commission »).

### 4.5 — Contrat de partenariat médecin

Ce contrat sera signé en série au congrès. Il doit être irréprochable avant le 3 décembre.

**Questions** : la clause d'évolution tarifaire unilatérale avec préavis de 60 jours est-elle opposable ? La répartition de responsabilité entre la plateforme et le praticien en cas de litige sur un rendez-vous est-elle correctement construite ? Les clauses de durée, de résiliation et de sort des données en fin de contrat sont-elles complètes ? Les mentions de la société doivent être mises à jour : la SARL est constituée et le numéro de registre du commerce doit y figurer.

### 4.6 — Formulaire de consentement de revendication

Le formulaire prévoit la conservation d'une photographie de la carte de l'Ordre pendant 90 jours à des fins probatoires, puis sa suppression.

**Questions** : cette conservation est-elle proportionnée et sa durée justifiable ? Le consentement recueilli couvre-t-il valablement l'affichage public du nom, de la photographie, de l'adresse du cabinet et des tarifs déclarés ? La déclaration sur l'honneur d'inscription à l'Ordre suffit-elle, ou une vérification auprès de l'Ordre est-elle requise ?

*Rattachement documentaire* : `docs/contrats/CONSENTEMENT_CLAIM_FICHE.md` art. 2 et 3.

### 4.7 — Revendication par WhatsApp

Le parcours à distance transite par WhatsApp, service opéré par Meta. Des pièces d'identité et la carte de l'Ordre y circulent.

**Questions** : ce canal est-il acceptable pour la transmission de pièces d'identité ? Le consentement recueilli par ce moyen a-t-il la même valeur probante qu'une signature manuscrite ? Faut-il un écrit signé dans tous les cas ?

*Rattachement documentaire* : `docs/PROCEDURE_CLAIM_WHATSAPP.md`.

### 4.8 — Points annexes

- **Téléconsultation** : envisagée mais non garantie au lancement. Conditions posées par la loi n° 18-11 du 2 juillet 2018 relative à la santé, et opportunité de la reporter.
- **Mineurs** : prise de rendez-vous pour un mineur — recueil et preuve du consentement parental.
- **Pixel publicitaire Meta** : chargé uniquement après consentement, et restreint à la page d'accueil et à la page d'inscription. Il est délibérément absent des pages de profil praticien et de réservation, afin qu'aucune URL identifiant un praticien ne soit transmise à Meta. Cette architecture est-elle suffisante ?
- **Rappels de rendez-vous par SMS** : contenu admissible, et mentions obligatoires.

## 5. Livrables attendus

- Un avis écrit sur les huit points de la section 4, indiquant pour chacun si le modèle actuel est licite en l'état, licite sous réserve de modification, ou non licite.
- Les treize documents relus et corrigés, prêts à signature et à publication.
- La liste des formalités administratives à accomplir avant le lancement — déclaration ou autorisation ANPDP, transfert hors territoire, toute autre autorisation sectorielle — avec les délais correspondants.
- Une estimation d'honoraires et un délai de remise.

## 6. Contrainte de calendrier

Le stand du congrès des 3, 4 et 5 décembre 2026 est déjà payé. Le contrat de partenariat médecin doit être validé avant cette date, faute de quoi aucun praticien ne pourra être engagé sur place et l'investissement sera perdu. **Si un seul document devait être traité en priorité, c'est le contrat de partenariat médecin.**

Le point 4.2, relatif à l'hébergement hors d'Algérie, est celui dont une réponse défavorable aurait les conséquences techniques les plus lourdes. Il mérite d'être traité en premier, avant même la relecture documentaire.

---

**Contact** — Aghiles Haddadene, gérant, Tabibi SARL
