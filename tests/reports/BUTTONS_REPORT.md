**Date** : 27 mai 2026
**Source** : `tests/reports/BUTTONS_REPORT.json` (généré par `01-buttons.spec.js`)
**Projet exécuté** : `chromium-desktop` (Chromium 148, viewport 1920×1080)
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`

---

# Rapport — Boutons & gating des pages

## 1. Synthèse

- **Pages testées** : 26 (18 publiques + 8 auth-gated)
- **Résultat global** : 24 / 26 tests Playwright en succès, **2 tests `index` en échec ⚠️**
- **Anomalies remontées** (toutes confondues, dans le JSON) : **35 entrées non-PASS** :
  - 30 `CLICK_FAIL` (mineures à modérées — voir §3)
  - 5 `CHECK` sur le gating auth (potentiellement CRIT — voir §2)

## 2. ⚠️ Anomalies CRIT / MAJ à investiguer

### 2.1 Auth gating — pages chargées sans redirection (CRIT à confirmer)

Cinq pages auth-gated chargent leur HTML sans déclencher de redirection vers `/login.html` ni afficher un état « non connecté » détectable côté serveur :

| Page | URL | Comportement observé |
|---|---|---|
| `patient-dashboard.html` | `/patient-dashboard.html` | Page chargée, pas de redirect |
| `doctor-dashboard.html` | `/doctor-dashboard.html` | Page chargée, pas de redirect |
| `mes-rdv.html` | `/mes-rdv.html` | Page chargée, pas de redirect |
| `notifications.html` | `/notifications.html` | Page chargée, pas de redirect |
| `patient-profile.html` | `/patient-profile.html` | Page chargée, pas de redirect |

> **Hypothèses** :
> - (Probable) Gating effectué **uniquement côté JS** après chargement (visible UI placeholder). Sécurité **acceptable** car les requêtes API Supabase sont gouvernées par RLS.
> - (À écarter) Vraie fuite d'UI (PII visibles avant gating).
>
> **Action recommandée** : ajouter dans `01-buttons.spec.js` une seconde assertion qui vérifie qu'aucune donnée utilisateur réelle (nom, email, etc.) n'est rendue dans le DOM en l'absence d'auth — sinon CRIT confirmé.

### 2.2 Pages `index` et `index.html` en échec

- 2 tests en `FAIL` sur la home — **à investiguer** : possiblement timeout réseau (la home charge 33 requêtes incluant 2 appels Supabase) ou un script qui bloque `domcontentloaded`.
- Pas d'erreur fatale rapportée par contre dans le runs précédents, donc probablement environnemental (réseau sandbox).
- **Action** : relancer ces 2 tests isolés en mode `--debug` une fois en dehors du sandbox CI.

## 3. CLICK_FAIL — modérés à mineurs

Distribution des `CLICK_FAIL` (boutons identifiés mais non cliquables dans le timeout 2s) :

| Page | Nombre | Cause probable |
|---|---|---|
| `signup` | 8 | Boutons à l'intérieur d'une modale (rôle/sélecteur de compte) ou boutons cachés avant choix `Patient/Médecin/Secrétariat` |
| `doctor-profile-241` | 7 | Boutons d'actions inscrites uniquement après chargement async des données (`× close`, modale réservation) |
| `legal-cookies` | 7 | Boutons paramétrage cookies dans modale de consentement |
| `legal-cgu` | 4 | Possible bouton de navigation entre versions |
| Autres pages | 4 | Boutons cachés ou hors viewport |

**Interprétation** : la plupart de ces `CLICK_FAIL` ne sont pas des bugs réels, mais des artefacts de la méthodologie (boutons hors écran ou conditionnels). À recouvrir avec des sélecteurs plus précis par page.

## 4. Boutons « destructifs » volontairement non cliqués

5 boutons matchés par le pattern `(supprimer|delete|annuler.*compte|résilier|payer|envoyer.*sms)` ont été `SKIP` pour ne pas générer d'effet de bord. À couvrir dans des spécifications dédiées avec stubbing.

## 5. Tableau détaillé (top 20 anomalies)

| Page | Bouton | Type | Sévérité | Note |
|---|---|---|---|---|
| patient-dashboard | (auth gating) | CHECK | **CRIT** | Pas de redirect non-auth |
| doctor-dashboard | (auth gating) | CHECK | **CRIT** | Pas de redirect non-auth |
| mes-rdv | (auth gating) | CHECK | **CRIT** | Pas de redirect non-auth |
| notifications | (auth gating) | CHECK | MAJ | Pas de redirect non-auth |
| patient-profile | (auth gating) | CHECK | **CRIT** | Pas de redirect non-auth |
| index / index-html | (page load) | FAIL | MAJ | À reproduire hors sandbox |
| signup | Patient / Médecin / Secrétariat | CLICK_FAIL | MIN | Boutons radio masqués |
| signup | Create my account | CLICK_FAIL | MIN | Click hors séquence |
| signup | 🇬🇧 EN | CLICK_FAIL | MIN | Switch langue |
| legal-cookies | (×7) | CLICK_FAIL | MIN | Modale paramètres cookies |
| doctor-profile-241 | × close | CLICK_FAIL | MIN | Bouton fermer modale non rendue |

## 6. Recommandations

| # | Action | Priorité |
|---|---|---|
| 1 | Confirmer que le gating des 5 pages auth se fait **côté serveur ou via RLS** et qu'aucune PII n'est rendue avant auth | **CRIT** |
| 2 | Étendre `01-buttons` avec des sélecteurs explicites par page pour éviter les CLICK_FAIL d'artefact | MAJ |
| 3 | Ajouter un test dédié pour chaque modale (cookies, login, signup-role) | MAJ |
| 4 | Relancer la home en environnement de production-like (hors sandbox) pour confirmer l'échec | MAJ |
| 5 | Stubber les boutons destructifs et tester leur flux complet | MIN |

## 7. Comment relancer

```bash
# Smoke complet
npx playwright test 01-buttons.spec.js --project=chromium-desktop

# Toutes les plateformes
npx playwright test 01-buttons.spec.js

# Avec traces sur échec
npx playwright test 01-buttons.spec.js --trace=on
```

Résultats détaillés : `tests/reports/BUTTONS_REPORT.json`
