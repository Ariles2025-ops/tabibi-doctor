**Date** : 27 mai 2026
**Source** : `tests/audit/04-perf.spec.js`
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app` (Chromium desktop)

---

# Rapport — Performance

## 1. Synthèse

| Page | Requêtes | Supa | Bytes (~) | TTFB | FCP | LCP | Verdict |
|---|---|---|---|---|---|---|---|
| `index` | 33 | 2 | 572 KB | 62 ms | 504 ms | 1 364 ms | ✅ |
| `login` | 27 | 1 | 332 KB | 37 ms | 280 ms | 1 080 ms | ✅ |
| `signup` | — | — | — | — | — | — | (run partiel — voir §3) |
| `doctor-profile` | — | — | — | — | — | — | (run partiel — voir §3) |

> ⚠️ Le run perf de cette campagne a été partiel (2 workers en parallèle écrivant le même fichier ; la dernière sauvegarde a écrasé les autres). Les valeurs `index` et `login` sont confirmées et excellentes. Les deux autres pages doivent être ré-acquises avec `--workers=1`.

## 2. Budget retenu

| Page | Budget requêtes | Budget Supabase | Budget bytes |
|---|---|---|---|
| `index` | 60 | 5 | 1 500 KB |
| `doctor-profile` | 60 | 5 | 1 500 KB |
| `signup` / `login` | 50 | 3 | 1 000 KB |

## 3. Observations principales

### Très bon

- **`index` : 2 requêtes Supabase seulement** → confirme la régression Phase 16.5 (`loadAllDoctorsViaApi` → fetch unique paginé) est tenue. 🎯
- **TTFB ~ 60 ms** sur la home — Netlify Edge cache fonctionne.
- **LCP 1.36 s** sur la home avec 33 requêtes (incl. fonts, JS, images) — confortablement sous le seuil 2.5 s « bon » de Core Web Vitals.
- **FCP 504 ms** — perception rapide.

### À surveiller

- 33 requêtes sur la home : raisonnable mais ~20 sont des assets (fonts/CSS/JS). Une optimisation `preconnect` / `dns-prefetch` pour cdn.jsdelivr / fonts.gstatic pourrait gagner 50-100 ms.
- Pas de mesure de **Total Blocking Time (TBT)** dans cette campagne — à intégrer dans le prochain run.

## 4. Vérification anti-régression Phase 16.5

| Critère | Cible | Observé | Verdict |
|---|---|---|---|
| Requêtes Supabase ≤ 5 sur home | ≤ 5 | 2 | ✅ |
| Pas de full-table scan visible (84 Mo bug d'avant) | < 1.5 MB | 572 KB | ✅ |

## 5. Lighthouse

⚠️ **Non exécuté dans cette campagne.** Recommandation : intégrer `@playwright/test` + `lighthouse` ou `playwright-lighthouse`, ou lancer `npx lighthouse https://tabibi.doctor --view` sur les pages clés et reporter.

Objectifs proposés (Lighthouse mobile 3G simulé) :

| Catégorie | Cible |
|---|---|
| Performance | ≥ 80 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |
| SEO | ≥ 90 |

## 6. Fuites mémoire (event listeners)

Non audité dans cette passe. Méthodologie suggérée :

```js
// PSEUDO — à intégrer dans 04-perf.spec.js
const before = await page.evaluate(() => performance.memory?.usedJSHeapSize);
// ... naviguer 10x entre pages
const after = await page.evaluate(() => performance.memory?.usedJSHeapSize);
expect(after - before).toBeLessThan(20 * 1024 * 1024); // < 20 MB drift
```

⚠️ `performance.memory` n'est exposé que sur Chromium.

## 7. Recommandations

| # | Action | Priorité |
|---|---|---|
| P1 | Re-courir la campagne perf avec `--workers=1` pour capturer signup et doctor-profile | MAJ |
| P2 | Intégrer Lighthouse en CI (objectif Perf ≥ 80 mobile 3G) | MAJ |
| P3 | Ajouter `<link rel="preconnect">` pour Supabase et CDN | MIN |
| P4 | Test fuite mémoire en navigation 10x | MAJ (post-launch) |
| P5 | Mesurer TBT et CLS dans le prochain run | MAJ |

## 8. Comment relancer

```bash
# Run perf en sérialisé (recommandé)
npx playwright test 04-perf.spec.js --project=chromium-desktop --workers=1

# Lighthouse (à installer séparément)
npm i -D playwright-lighthouse lighthouse
# puis intégrer dans un nouveau spec
```
