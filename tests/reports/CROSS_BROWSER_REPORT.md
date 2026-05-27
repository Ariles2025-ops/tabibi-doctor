**Version** : 1.0
**Date** : 27 mai 2026
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`

---

# Rapport — Compatibilité cross-browser

## 1. Synthèse

| Navigateur | Test sandbox | Verdict |
|---|---|---|
| Chromium 148 | ✅ login page : 1 passed (13 s) | OK |
| Firefox 1522 | ✅ login page : 1 passed (13 s) | OK |
| WebKit 2287 | ❌ libs manquantes (`libx264.so`, etc.) | Blocked sandbox |

## 2. Détail

### Chromium ✅

Tests E2E (cf. `BUTTONS_REPORT.md`) : 24/26 passed sur l'ensemble du périmètre.

### Firefox ✅

```bash
$ npx playwright test 01-buttons.spec.js --project=firefox-desktop --grep "login"
Running 1 test using 1 worker
[1/1] [firefox-desktop] › 01-buttons.spec.js › … login
1 passed (13.3s)
```

Firefox passe le smoke. Pour relancer la suite complète :

```bash
npx playwright test 01-buttons.spec.js --project=firefox-desktop
```

### WebKit ❌ (limitation sandbox)

```
Error: missing dependencies (libavif.so, libx264.so, …)
```

Le sandbox Linux ne dispose pas des `libavif/libx264/libfreebl3` requises par WebKit. Pour exécuter WebKit, il faut un environnement avec :

```bash
sudo apt-get install -y \
  libavif15 libavif16 libffi-dev libgl1 libgles2 \
  libgstreamer-gl1.0-0 libgstreamer-plugins-bad1.0-0 \
  libharfbuzz-icu0 libhyphen0 libmanette-0.2-0 libnghttp2-14 \
  libwebpdemux2 libwoff1 libx264-* libxcomposite1 libxdamage1
```

Sur un poste local macOS ou Windows, WebKit fonctionne nativement sans cette installation. Sur GitHub Actions, l'ubuntu-latest image inclut généralement ces libs.

## 3. Recommandations

| # | Action | Priorité |
|---|---|---|
| CB-1 | Exécuter la suite complète sur Chromium + Firefox en CI (GitHub Actions) | MAJ |
| CB-2 | Exécuter WebKit en CI ou poste local macOS pour couverture Safari | MAJ |
| CB-3 | Capturer les screenshots full-page sur les 3 navigateurs | MIN |
| CB-4 | Smoke test ponctuel sur Safari mobile (iOS) via BrowserStack / Sauce | MIN |

## 4. Compatibilité connue à valider manuellement

Particularités à vérifier manuellement sur **Safari macOS** et **Safari iOS** (non couvertes par WebKit Playwright à 100 %) :

- Formulaires `date`/`time` (rendu spécifique iOS).
- Notifications push (non-supportées sur iOS Safari < 16.4).
- `position: sticky` (cassé sur certaines versions iOS).
- Polices custom (chargement async).
- Service Worker registration en mode privé.

À noter dans une checklist QA manuelle pré-launch.

## 5. Comment relancer

```bash
# Chromium + Firefox seuls (sandbox-friendly)
npx playwright test --project=chromium-desktop --project=firefox-desktop

# Tous les projets (nécessite WebKit deps)
npx playwright test

# Filtre par grep
npx playwright test --grep "login|signup|reservation"
```
