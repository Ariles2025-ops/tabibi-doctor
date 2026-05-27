**Date** : 27 mai 2026
**Source** : `tests/audit/06-screenshots.spec.js`
**Output** : `tests/visual/`

---

# Rapport — Captures visuelles full-page

## 1. Statut

⚠️ Le run multi-viewport (desktop + tablet + mobile) a été **partiel** dans cette campagne :

- **Desktop (1920×1080) Chromium** : 10 / 14 pages capturées ✅
- **Tablet (iPad)** : 0 capturée (timeout sandbox)
- **Mobile (iPhone 13)** : 0 capturée (timeout sandbox)

Le spec est en place et opérationnel — à relancer en CI ou poste local pour compléter.

## 2. Captures disponibles (desktop 1920×1080)

| Page | Fichier |
|---|---|
| `appointment.html` | `tests/visual/appointment_chromium-desktop.png` |
| `doctor-profile.html?id=241` | `tests/visual/doctor-profile_chromium-desktop.png` |
| `index.html` | `tests/visual/index_chromium-desktop.png` |
| `legal/confidentialite.html` | `tests/visual/legal-confid_chromium-desktop.png` |
| `legal/cookies.html` | `tests/visual/legal-cookies_chromium-desktop.png` |
| `login.html` | `tests/visual/login_chromium-desktop.png` |
| `reservation.html` | `tests/visual/reservation_chromium-desktop.png` |
| `signup.html` | `tests/visual/signup_chromium-desktop.png` |
| `teleconsultation.html` | `tests/visual/teleconsult_chromium-desktop.png` |
| `waiting-list.html` | `tests/visual/waiting-list_chromium-desktop.png` |

## 3. Pages encore à capturer

| Manquant (desktop) |
|---|
| `about.html`, `doctor-claim.html`, `forgot-password.html`, `legal/cgu.html` |

## 4. Comment relancer

```bash
# Toutes les pages × 3 viewports
npx playwright test 06-screenshots.spec.js \
  --project=chromium-desktop \
  --project=chromium-tablet \
  --project=chromium-mobile \
  --workers=2

# Une seule plateforme
npx playwright test 06-screenshots.spec.js --project=chromium-mobile

# Augmenter le timeout
PLAYWRIGHT_TEST_TIMEOUT=60000 npx playwright test 06-screenshots.spec.js
```

## 5. Revue humaine

Pour chaque capture, vérifier :

- ✅ Cohérence visuelle (alignement, typographie, palette)
- ✅ Absence de débordement
- ✅ Présence des éléments clés (logo, navigation, CTA principal)
- ✅ Pas de « FOUC » (flash of unstyled content)
- ✅ Cohérence entre les 3 viewports

À documenter dans un suivi visuel régulier (Percy / Chromatic / Argos en CI, à envisager post-launch).
