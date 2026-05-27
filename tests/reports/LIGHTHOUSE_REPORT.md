**Version** : 1.0
**Date** : 27 mai 2026
**Outil** : Lighthouse 13.3
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`
**Conditions** : Desktop simulé, Chromium headless, 1 run

---

# Rapport — Lighthouse

## 1. Scores synthétiques

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` (home) | 🟡 **67** | 🟡 **85** | 🟢 100 | 🟢 100 |
| `/signup.html` | 🟡 **79** | 🟢 92 | 🟢 100 | 🟢 100 |
| `/doctor-profile.html?id=241` | 🟡 **79** | 🟢 90 | 🟢 92 | 🟢 100 |

### Cibles du brief

| Catégorie | Cible | Atteinte ? |
|---|---|---|
| Performance ≥ 80 | non sur les 3 pages | ❌ |
| Accessibility ≥ 90 | OK signup/doctor-profile, **fail home** | partiel |
| Best Practices ≥ 90 | ✅ atteinte sur 3/3 | ✅ |
| SEO ≥ 90 | ✅ atteinte sur 3/3 (100) | ✅ |

## 2. Top issues consolidées

### Home `/`

1. **Avoid large layout shifts** — CLS élevé.
2. **Background and foreground colors do not have a sufficient contrast ratio** — accessibilité (a11y).
3. **Form elements do not have associated labels**.
4. **Select elements do not have associated label elements**.
5. **Reduce unused JavaScript** — bundle non tree-shaké.

### Signup

1. **Avoid large layout shifts**.
2. **Insufficient contrast ratio**.
3. **Elements with visible text labels do not have matching accessible names**.
4. **Touch targets do not have sufficient size or spacing** — mobile.
5. **Minify JavaScript**.

### Doctor-profile

1. **Browser errors were logged to the console**.
2. **Reduce initial server response time**.
3. **Avoid large layout shifts**.
4. **Insufficient contrast ratio**.
5. **`<frame>` or `<iframe>` elements do not have a title** — embeds (carte ?) sans `title`.

## 3. Analyse

### Performance (cible ≥ 80)

- **Home à 67** : c'est principalement le **CLS** (Cumulative Layout Shift) qui plombe. La home charge progressivement des cartes médecin sans réserver l'espace.
- **Unused JavaScript** : 33 fichiers JS chargés sur la home, dont certains rarement utilisés (Sentry, 2FA, brevo, sms). À envisager : chargement conditionnel.
- **Doctor-profile à 79** : TTFB plus long que la home (page dynamique avec données médecin). Possible cache HTTP plus court ou requête Supabase au load.

### Accessibility

- Les 3 pages remontent toutes : **insufficient contrast ratio** et **labels manquants** sur les formulaires.
- À traiter en priorité pour le launch : un audit a11y manuel d'1 jour résoudrait la plupart.

### Best Practices & SEO

- 🟢 Excellent — rien à signaler de critique.
- Bénéficie des bons headers (HSTS, CSP, etc. cf. SECURITY_REPORT).
- Bonne structure des balises meta et open graph (présumée — Lighthouse SEO=100).

## 4. Plan de remédiation (effort indicatif)

| # | Item | Effort | Gain estimé |
|---|---|---|---|
| L1 | Réserver l'espace (CSS `min-height`, `aspect-ratio`) avant cartes médecin sur la home | 4 h | CLS → ~0, Perf +8 |
| L2 | Charger Sentry/Brevo/SMS/2FA en **lazy** (seulement si page concernée) | 4 h | Perf +5, transfert -100ko |
| L3 | Audit a11y manuel : ajouter `aria-label`, `<label for>`, augmenter contrastes | 1 j | A11y → 95+ sur 3 pages |
| L4 | Augmenter tap targets mobile à 48×48px | 4 h | Mobile UX, A11y +3 |
| L5 | Ajouter `title` sur les `<iframe>` (carte Google Maps ?) | 30 min | A11y +2 |
| L6 | Minifier les JS non encore minifiés | 1 h | Perf +3 |
| L7 | Investiguer les erreurs console sur doctor-profile | 2 h | BP +5 |
| L8 | Cache HTTP plus agressif pour doctor-profile (avec invalidation à l'update) | 2 h | Perf +5 |

**Total estimé** : ~3 jours-homme → atteindre Perf 85+, A11y 95+ partout.

## 5. Fichiers détaillés

Rapports JSON et HTML interactifs dans `tests/reports/lighthouse/` :

```
home.report.html
home.report.json
signup.report.html
signup.report.json
doctor-profile.html_id_241.report.html
doctor-profile.html_id_241.report.json
```

Ouvrir les HTML dans un navigateur pour le détail visuel et la liste exhaustive des audits.

## 6. Comment relancer

```bash
mkdir -p tests/reports/lighthouse
for URL in "/" "/signup.html" "/doctor-profile.html?id=241"; do
  npx lighthouse "https://effulgent-kelpie-e48e81.netlify.app$URL" \
    --output=json --output=html \
    --output-path="tests/reports/lighthouse/$(echo $URL | tr '/?=' '_-_')" \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
    --quiet
done
```

### Recommandation CI

Intégrer en GitHub Actions avec un budget assertion :

```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v12
  with:
    urls: |
      https://tabibi.doctor/
      https://tabibi.doctor/signup.html
      https://tabibi.doctor/doctor-profile.html?id=241
    budgetPath: ./lighthouse-budget.json
```

avec `lighthouse-budget.json` :

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.75}],
        "categories:accessibility": ["error", {"minScore": 0.90}],
        "categories:best-practices": ["error", {"minScore": 0.90}],
        "categories:seo": ["error", {"minScore": 0.90}]
      }
    }
  }
}
```
