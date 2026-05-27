**Version** : 1.0
**Date** : 27 mai 2026
**Statut** : EN VIGUEUR — interne

---

# Plan de lancement — Juin 2026

Plan opérationnel du **lancement public** de Tabibi.doctor, prévu en **juin 2026**. Document vivant, mis à jour au fil de l'avancement.

---

## Objectifs du lancement

### Objectif principal

**100 médecins actifs** (≥ 1 RDV confirmé / semaine) à **J+90 du lancement**.

### Objectifs secondaires

- 500 patients inscrits J+30 ;
- Couverture des **5 plus grandes wilayas** (Alger, Oran, Constantine, Annaba, Sétif) ;
- 3 retombées presse algérienne ;
- 0 incident sécurité majeur.

### Hypothèses

- 79 000 fiches médecins disponibles → si on convertit 0,13 % à J+90, on atteint l'objectif.
- Adoption patient assez naturelle dès que ≥ 5 médecins actifs par grande wilaya.

---

## J-30 à J-1 — Préparation (mai → début juin 2026)

### Tech & Produit

- [ ] Audit complet UX desktop + mobile (responsive).
- [ ] Tests E2E des parcours critiques (inscription, claim, prise RDV, annulation).
- [ ] Audit sécurité (RLS Supabase, headers HTTPS, CSP).
- [ ] Tests de charge (objectif : 1000 visiteurs simultanés sans dégradation).
- [ ] Page d'erreur / offline propres.
- [ ] Sitemap + robots.txt + meta SEO en place sur les wilayas/spécialités top.
- [ ] Monitoring (UptimeRobot ou BetterStack).
- [ ] Sauvegardes automatiques Supabase vérifiées.

### Légal & Conformité

- [ ] Validation de tous les documents légaux par avocat.
- [ ] Immatriculation SARL Tabibi finalisée (RC + NIF + NIS).
- [ ] Mise à jour des mentions légales avec coordonnées définitives.
- [ ] Politique de confidentialité actualisée.
- [ ] Bannière cookies fonctionnelle.

### Onboarding médecin pré-launch

- [ ] **20 médecins « ambassadeurs »** signés en avance (J-30 à J-1) — couvrir au moins 3 spécialités x 3 wilayas.
- [ ] Témoignages vidéo de 3 d'entre eux (30 s chacun).
- [ ] Coordonnées et photos professionnelles vérifiées.

### Marketing

- [ ] Page d'accueil orientée conversion.
- [ ] Blog amorcé (5 articles SEO publiés à J0).
- [ ] LinkedIn page Tabibi créée + 10 posts pré-écrits.
- [ ] Compte Twitter / X (optionnel).
- [ ] Dossier de presse préparé (PDF — 2 pages).
- [ ] Liste de 20 journalistes santé / tech à contacter (TSA, El Watan, Liberté, Algérie Eco, El Khabar, Maghreb Emergent…).
- [ ] Vidéo explicative 90 secondes prête.

### Support

- [ ] Templates emails finalisés (`docs/templates-emails/`).
- [ ] WhatsApp Business configuré avec réponses automatiques en français et arabe.
- [ ] FAQ patient et médecin publiées.
- [ ] Équipe formée sur la procédure de modération.

---

## J0 — Jour de lancement (date à confirmer)

### Matin

- [ ] **Vérification finale** : déploiement OK, monitoring vert, support prêt.
- [ ] **Activation publique** : retrait des éventuelles restrictions « beta », ouverture inscription.
- [ ] **Post LinkedIn d'Aghiles** : annonce personnelle + lien.
- [ ] **Communiqué de presse** envoyé à la liste de journalistes (avec embargo levé à 10h).
- [ ] **Email aux médecins ambassadeurs** : « C'est parti, partagez ! »

### Après-midi

- [ ] **Posts sur LinkedIn page Tabibi**.
- [ ] **Annonce sur groupes Facebook médecins algériens** (avec mesure et respect des règles de ces groupes).
- [ ] **Première session live AMA** sur LinkedIn (optionnel).
- [ ] **Surveillance active** : commentaires, signalements, bugs.

### Soir

- [ ] **Bilan jour 1** : inscriptions, visites, premiers retours.
- [ ] **Remerciements publics** aux médecins ambassadeurs et premiers patients.

---

## J+1 à J+30 — Phase de signature (juin 2026)

### Objectif : 50 médecins actifs

### Actions principales

- **Tournée terrain** : Aghiles + 2 collaborateurs visitent des cabinets dans Alger, Oran, Constantine. Objectif : 10 visites / semaine / personne, **soit 90 visites / semaine** = 60+ signatures attendues (taux 67 % en physique).
- **Outreach LinkedIn** : 30 médecins/jour contactés en messages personnalisés.
- **Groupes Facebook médecins** : post hebdomadaire utile (étude, conseil), pas d'auto-promo lourde.
- **Cibles prioritaires** : généralistes, dentistes, ophtalmologues (forte demande).

### Suivi quotidien

- KPI : nouveaux médecins signés, profils complets, patients inscrits.
- Daily 15 min équipe : revue terrain, blocages, ajustements.

### Adaptations

- Si conversion en visite < 30 % → revoir script de pitch.
- Si peu de patients → renforcer SEO + acquisition payante mesurée.

---

## J+30 à J+90 — Consolidation (juillet-août 2026)

### Objectif : atteindre 100 médecins actifs + 2000 patients inscrits

### Leviers

- **Témoignages vidéo** des premiers médecins satisfaits → réutilisés en social et site.
- **Référencement SEO** monté en puissance : 10-15 articles/mois.
- **Partenariats** : pharmacies (flyers en accord), assureurs santé, ordres locaux.
- **Presse** : 3 retombées articles + 1 reportage TV ou radio si possible.
- **Évènement public** lors de la Semaine de la Santé (à caler selon calendrier officiel).

### Risques à surveiller

- Saisonnalité (août = ralenti, surtout en santé non urgente).
- Concurrence (réaction de plateformes existantes).
- Bugs ou indisponibilité → impact massif sur la confiance early.

---

## Budget estimé (lancement + 90 jours)

Estimations en **DZD**, à ajuster selon trésorerie réelle.

| Poste | Estimation 90 jours |
|---|---|
| Hébergement Supabase + Netlify | ~60 000 |
| Domaine + SSL | ~5 000 |
| Outils (gestion mdp, monitoring, emails transactionnels) | ~30 000 |
| Communication / SEO (rédacteur freelance) | ~150 000 |
| Vidéos témoignages (vidéaste freelance) | ~120 000 |
| Outreach LinkedIn / Sales Navigator | ~40 000 |
| Frais déplacement (tournée cabinet Alger/Oran/Constantine) | ~80 000 |
| Imprimés (contrats, plaquettes) | ~20 000 |
| Honoraires avocat (validation légale + conseils) | ~150 000 |
| Comptable / expert-comptable (immatriculation + 3 mois) | ~80 000 |
| Réserve aléas (10 %) | ~80 000 |
| **Total** | **~815 000 DZD** |

> Estimation conservatrice — affiner avec devis réels. Ne pas inclure les salaires de l'équipe ici (couverts par autre poste).

---

## Canaux d'acquisition — Synthèse

### Côté médecin

1. **Face-à-face cabinet** — meilleur taux de conversion (30-70 %), le plus coûteux en temps.
2. **LinkedIn** — bon ROI pour médecins libéraux avec présence en ligne.
3. **Bouche-à-oreille** entre confrères — démarre lent, accélère après J+60.
4. **Groupes Facebook médecins** — sensibles à la pertinence, éviter le pitch agressif.
5. **Webinaire** — à tester après J+30.

### Côté patient

1. **SEO** (recherche « cardiologue Alger », « gynécologue Oran ») — meilleur ROI long terme.
2. **Bouche-à-oreille** depuis les premiers patients satisfaits.
3. **Réseaux sociaux organiques** (Facebook, Instagram, TikTok).
4. **Publicité ciblée mesurée** Google / Facebook (à envisager après J+60 si le funnel est propre).
5. **Pharmacies partenaires** (flyers).

---

## Indicateurs hebdo (cf. KPI_DASHBOARD.md)

- Médecins actifs
- Médecins signés / semaine
- Patients inscrits / semaine
- RDV créés / semaine
- Taux de conversion (création → confirmé)
- Taux de no-show

---

## Communication post-launch

### Tonalité

- Sobre, factuelle, fière mais pas arrogante.
- Pas d'hyperbole (« révolutionner », « disruptif »).
- Mettre en avant : utilité concrète, sécurité, ancrage algérien.

### Histoires à raconter

1. Le médecin qui dit : « J'ai diminué mes no-show de 30 % depuis Tabibi. »
2. Le patient qui dit : « J'ai trouvé un dermato en 2 min, RDV à 2 jours. »
3. L'équipe : « 3 personnes, 79 000 fiches, une mission. »
4. La conformité : « Hébergé en Europe, conforme à la loi 18-07. »

---

## Et après le J+90 ?

- Bilan détaillé.
- Décision : extension géographique, nouvelle fonctionnalité, ou doubler la mise sur l'existant.
- Trimestre suivant : focus rétention médecins + activation patients dormants.
