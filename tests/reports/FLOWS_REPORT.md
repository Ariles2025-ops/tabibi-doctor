**Date** : 27 mai 2026
**Source** : `tests/audit/02-flows.spec.js`
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`

---

# Rapport — Flows utilisateurs E2E

## 1. Politique de test

Cet audit s'attache à **observer sans muter** la base staging :

- **Tests non-destructifs** (page renders, sélecteurs présents, gating fonctionnel) : ✅ exécutés.
- **Tests destructifs** (signup réel, prise RDV réelle, claim qui écrit en base) : `test.skip()` par défaut. Activables via `RUN_DESTRUCTIVE=1` lorsqu'une base de test isolée existera.

> Cette discipline préserve l'intégrité de la DB staging actuellement partagée avec d'autres acteurs (équipe, médecins en preview).

## 2. Synthèse par flow

| # | Flow | Étendue testée | Statut | Sévérité bugs |
|---|---|---|---|---|
| 1 | Signup patient | Render form, champs présents | ✅ render OK | — |
| 2 | Login patient | Render form, erreur invalid creds | ✅ render OK | — |
| 3 | Recherche médecin | Contrôles de recherche sur home | ✅ contrôles présents | — |
| 4 | Prise RDV patient | Profil médecin charge + CTA | ⚠️ à confirmer manuellement | MAJ |
| 5 | Claim WhatsApp | Lien `wa.me/213777169074` | ⚠️ à vérifier sur fiche réelle | MAJ |
| 6 | Dashboard médecin | Gating auth | ⚠️ Pas de redirect (cf. BUTTONS_REPORT §2.1) | **CRIT** |
| 7 | Dashboard admin | Gating auth + rôle | ⚠️ Pas de redirect | **CRIT** |
| 8 | Mobile responsive | Pas d'overflow horizontal sur 4 pages | ✅ OK pour `/`, `/signup`, `/login`, `/doctor-profile` | — |

## 3. Détails par flow

### FLOW 1 — Signup patient
- ✅ La page `signup.html` se charge avec le bon `<title>` correspondant à `/inscri|signup|tabibi/i`.
- ✅ Au moins un `input[type="email"]` et un `input[type="password"]` sont présents.
- ⏸️ La création effective d'un compte (`POST` Supabase auth) n'a **pas** été déclenchée pour ne pas polluer la DB. Test bloqué derrière `RUN_DESTRUCTIVE=1`.

**À couvrir lors du run destructif** : email confirmation (Brevo), insertion `users` + `patients`, redirection post-signup.

### FLOW 2 — Login patient
- ✅ Champs email + password présents et visibles.
- ✅ Soumission avec credentials invalides ne redirige pas et reste sur la page (comportement attendu).
- ⏸️ Le visuel exact du message d'erreur (toast, banner, alert natif) n'a **pas été asserté** — laissé en TODO de couverture.

### FLOW 3 — Recherche médecin
- ✅ Au moins un contrôle de recherche détecté sur la home.
- ℹ️ Le test direct `/?specialty=cardiologie&wilaya=alger` n'a **pas remonté de cartes** — il faut confirmer la **syntaxe de query string** acceptée par le routeur côté front (peut-être `?spec=` ou `?q=`). À vérifier dans `index.html` / `doctors-display.js`.

### FLOW 4 — Prise de RDV patient
- ✅ `/doctor-profile.html?id=241` charge et affiche un H1 ou un CTA de réservation.
- ⏸️ Le clic sur **« Prendre RDV »** + sélection créneau + confirmation n'a pas été exécuté (mode `RUN_DESTRUCTIVE`).
- **Action manuelle requise** : valider end-to-end avec un compte patient test.

### FLOW 5 — Claim WhatsApp
- ⚠️ La présence d'un lien `wa.me/213777169074` sur la fiche `id=241` est **conditionnelle** : selon que la fiche est `claimed` ou non, le CTA peut ne pas être visible.
- **À documenter** : URL d'une fiche **non claimed** explicite pour tester ce flow.

### FLOW 6 — Dashboard médecin
- 🔴 **`/doctor-dashboard.html`** charge sans redirection visible côté serveur. Probablement gating JS post-chargement → à confirmer que le DOM ne contient pas de PII.

### FLOW 7 — Dashboard admin
- 🔴 **`/admin-dashboard.html`** même observation que dashboard médecin. **Test impérativement** que le rôle Supabase (`role='admin'`) est exigé par la moindre requête de cette page.

### FLOW 8 — Mobile responsive
- ✅ Aucune des 4 pages testées (`/`, `/signup`, `/login`, `/doctor-profile?id=241`) ne produit d'overflow horizontal en viewport iPhone 13.
- ⏸️ Boutons ≥ 44×44px : pas vérifié par axe spécifique — voir A11Y_REPORT pour les tap targets.

## 4. Recommandations

| # | Action | Priorité |
|---|---|---|
| 1 | Mettre en place une **DB de test dédiée** + jeu de données reproductible | **CRIT** |
| 2 | Activer `RUN_DESTRUCTIVE=1` contre cette DB et compléter les tests skip | **CRIT** |
| 3 | Vérifier qu'aucune PII n'est rendue côté front sur les pages auth-gated avant authentification | **CRIT** |
| 4 | Confirmer la syntaxe query-string de la home pour les flux SEO-friendly | MAJ |
| 5 | Identifier une fiche **non claimed** stable pour les tests Flow 5 (claim) | MAJ |

## 5. Comment relancer

```bash
# Smoke tests non-destructifs
npx playwright test 02-flows.spec.js --project=chromium-desktop

# Avec flows destructifs (nécessite une DB de test isolée)
RUN_DESTRUCTIVE=1 npx playwright test 02-flows.spec.js
```
