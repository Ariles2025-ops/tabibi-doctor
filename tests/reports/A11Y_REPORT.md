**Date** : 27 mai 2026
**Source** : `tests/audit/05-a11y.spec.js` (axe-core 4.x)
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`

---

# Rapport — Accessibilité (WCAG 2.1 AA)

## 1. Statut d'exécution

⚠️ Le run a11y **n'a pas été exécuté complètement** dans cette campagne pour raisons de temps machine sandbox. Le spec est en place et prêt à tourner.

```bash
npx playwright test 05-a11y.spec.js --project=chromium-desktop
```

## 2. Couverture prévue

| Page | URL | Tags axe |
|---|---|---|
| `index` | `/` | wcag2a, wcag2aa, wcag21a, wcag21aa |
| `signup` | `/signup.html` | idem |
| `login` | `/login.html` | idem |
| `doctor-profile` | `/doctor-profile.html?id=241` | idem |
| `reservation` | `/reservation.html` | idem |
| `legal-cgu` | `/legal/cgu.html` | idem |
| `about` | `/about.html` | idem |

## 3. Méthode

Pour chaque page :
1. Goto + `domcontentloaded` + délai 1.5 s
2. `axe-core` analyse → violations, passes, incomplete
3. Top 10 violations enregistrées dans `tests/reports/a11y-results.json`
4. **Soft assertion** sur violations `critical` = 0 (n'échoue pas le run mais signale)

## 4. Heuristiques attendues (à confirmer après run)

D'après l'inventaire statique, les risques d'accessibilité identifiés :

### Risques forts

- **Boutons « onclick » sans rôle explicite** : nombreux `onclick="…"` sur `<div>` ou `<span>` détectés dans `patient-dashboard.html` (71 occurrences). À vérifier que ce sont bien des `<button>`.
- **Images sans `alt`** : à scanner. La directive de l'équipe : compléter alt pour photos médecin + icônes décoratives `alt=""`.
- **Contrastes** : palette violet/bleu Tabibi à valider sur fond clair.
- **Modales sans `role="dialog"` + `aria-modal`** : trouvé au moins un cas correct (`<div class="modal" id="modal" role="dialog" aria-modal="true">`) mais d'autres modales sans rôle.
- **Pages SEO programmatiques (490 pages)** : risque de duplication d'accessibilité issues à grande échelle si générées par template.

### Risques modérés

- **Tap targets ≥ 44×44 px** sur mobile (WCAG 2.5.5 AAA).
- **Skip-to-content** lien absent par défaut.
- **Hiérarchie des `<h1> → <h6>`** : à vérifier (pages dashboard ont souvent plusieurs `h1`).
- **Form labels** : auditer chaque `<input>` qu'il a soit un `<label for>` soit `aria-label`.

## 5. Recommandations méthodologiques

| # | Action | Priorité |
|---|---|---|
| A1 | Exécuter le run complet de `05-a11y.spec.js` et committer `a11y-results.json` | **CRIT (audit)** |
| A2 | Pour chaque violation `critical`/`serious`, créer une issue GitHub | MAJ |
| A3 | Ajouter test contraste manuel (axe ne couvre pas tous les cas) — Stark, WAVE, Color Oracle | MAJ |
| A4 | Audit clavier manuel sur les flows critiques (Tab order + Enter sur boutons) | MAJ |
| A5 | Audit lecteur d'écran (NVDA/VoiceOver) sur signup, login, reservation | MAJ |
| A6 | Étendre la couverture aux pages dashboard authentifiées (avec session stub) | MAJ |

## 6. Bonnes pratiques en place

(observées dans le code source — à confirmer après run axe)

- Présence de `lang="fr"` au top de plusieurs HTMLs (i18n active).
- `aria-modal="true"` sur au moins une modale.
- `noscript` fallback dans `index.html`.

## 7. Templates de remédiation

Pour les findings axe les plus fréquents prévus :

### `image-alt`
```html
<!-- AVANT -->
<img src="medecin.jpg">
<!-- APRÈS -->
<img src="medecin.jpg" alt="Photo du Dr Dupont, cardiologue à Alger">
<!-- décoratif -->
<img src="deco-vague.svg" alt="" role="presentation">
```

### `button-name`
```html
<!-- AVANT -->
<button>×</button>
<!-- APRÈS -->
<button aria-label="Fermer la modale">×</button>
```

### `color-contrast`
Utiliser au minimum un ratio 4.5:1 pour texte normal, 3:1 pour texte large.

### `label`
```html
<!-- AVANT -->
<input type="email" placeholder="Email">
<!-- APRÈS -->
<label for="email">Email</label>
<input type="email" id="email">
```
