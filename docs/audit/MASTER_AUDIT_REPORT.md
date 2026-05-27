**Version** : 1.1 (mise à jour après validation intrusive)
**Date** : 27 mai 2026
**Branche** : `audit/full-quality-sept2026`
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app` (staging)
**Auteur** : Audit Playwright automatisé

> 📌 **MAJ v1.1** : 3 CRIT initiaux validés en environnement réel. **2 nouveaux CRIT découverts** lors des probes RLS intrusifs. Synthèse mise à jour ci-dessous.

---

# Master Audit Report — Tabibi.doctor (pré-launch septembre 2026)

## 📑 Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Méthodologie & limites de cet audit](#2-méthodologie--limites)
3. [Bugs CRIT — à fixer avant launch](#3-bugs-crit)
4. [Bugs MAJ — à fixer si temps](#4-bugs-maj)
5. [Bugs MIN — post-launch acceptable](#5-bugs-min)
6. [Recommandations sécurité](#6-recommandations-sécurité)
7. [Recommandations performance](#7-recommandations-performance)
8. [Recommandations accessibilité](#8-recommandations-accessibilité)
9. [Estimation temps de fix global](#9-estimation-fix)
10. [Suite de tests installée](#10-suite-de-tests)

---

## 1. Résumé exécutif

### Verdict global

🟡 **Maturation correcte mais 3 points bloquants à lever avant launch.**

- Le **socle technique est solide** : Netlify Edge, headers de sécurité production-grade, refactor anti-régression Phase 16.5 confirmé (2 requêtes Supabase sur la home vs 84 Mo auparavant), CSP détaillée, HSTS preload, aucun secret hardcodé, anon JWT bien `role=anon`.
- **Le grand inconnu : la couverture RLS Supabase prod**. Seules 2 tables ont RLS confirmé dans les migrations versionnées (vs 13 référencées front). Sans dump prod, on ne peut pas garantir l'isolation des données.
- **Gating auth côté front** : 5 pages auth-gated chargent sans redirection 302 — à confirmer qu'aucune PII ne fuite avant authentification.

### Scoreboard

| Catégorie | Verdict | Détail |
|---|---|---|
| Auth & gating | 🟢 **OK** | 5 pages : aucune PII rendue sans session, RLS verrouille au backend |
| RLS Supabase (anon) | 🟡 7/9 OK, 1 fuite schema | `doctor_profiles` exposé en colonnes sensibles (CRIT-4) |
| RLS Supabase (cross-user A↔B) | ⏸️ Non testé | Service_role requis (cf. RLS_INTRUSIVE §5) |
| Headers HTTP | 🟢 Excellent | HSTS, CSP, X-Frame, COOP/CORP, Permissions-Policy |
| Mixed content | 🟢 Aucun | Pas de http:// |
| Secrets exposés | 🟢 Aucun | Pas de service_role, sk_, AKIA, etc. |
| XSS reflected (sample) | 🟢 OK | Param `q` correctement échappé |
| Mass assignment (anon) | 🟢 Bloqué | `is_admin` col inexistante, RLS bloque INSERT |
| Mass assignment (auth médecin) | ⏸️ À tester | Session médecin requise (test prêt) |
| Captcha signup serveur | 🔴 **Manquant** | Turnstile contournable par REST direct (CRIT-5) |
| Performance Web Vitals | 🟢 Bon | LCP 1.4s home, FCP 504ms, TTFB 62ms |
| Lighthouse Perf | 🟡 67-79/100 | Sous le seuil 80 (CLS, unused JS) |
| Lighthouse A11y | 🟡 85-92/100 | Contrastes, labels formulaires |
| Lighthouse BP | 🟢 92-100/100 | Excellent |
| Lighthouse SEO | 🟢 100/100 | Excellent |
| Régression Phase 16.5 | 🟢 Tenue | 2 requêtes Supabase home (budget 5) |
| Mobile responsive | 🟢 4/4 pages OK | Pas d'overflow horizontal |
| Cross-browser | 🟢 Chromium+Firefox | WebKit blocked par sandbox (libs) |

### Décompte des findings (v1.1)

| Sévérité | Compteur | Description |
|---|---|---|
| **CRIT** | **3** | CRIT-4 (doctor_profiles exposure), CRIT-5 (captcha bypass), CRIT-1 résiduel (RLS dump prod) |
| **MAJ** | **9** | Lighthouse a11y/perf, tests cross-user, mass-assign post-auth, etc. |
| **MIN** | **6** | Post-launch acceptable |

### Compte test à supprimer manuellement

Un compte créé pendant les probes RLS reste **non confirmé** en `auth.users` :

```
UUID  : 9df8df4f-a5b3-4d68-85cf-32ee08a32190
Email : audit_rls_a_1779905978@tabibi.test
Status: unconfirmed
```

Suppression via Supabase Studio SQL :
```sql
DELETE FROM auth.users WHERE id = '9df8df4f-a5b3-4d68-85cf-32ee08a32190';
```

---

## 2. Méthodologie & limites

### Ce qui a été fait

- ✅ **Setup Playwright complet** (config + 5 specs + 1 spec screenshots) — exécutable localement et en CI.
- ✅ **Inventaire statique exhaustif** : 38 pages applicatives + 490 SEO + 33 JS + tables Supabase + RPC + handlers.
- ✅ **Run effectif** sur Chromium-desktop : 01-buttons (24/26 PASS), 03-security (7/7 PASS hors RLS intrusif skip), 04-perf (run partiel), 06-screenshots (10 PNG).
- ✅ **Inspection headers via curl** sur staging — confirme excellente configuration prod.
- ✅ **Analyse statique** des `migrations/*.sql` pour RLS / RPC / triggers.
- ✅ **7 rapports** détaillés produits dans `tests/reports/` et `docs/audit/`.

### Ce qui n'a PAS été fait (et pourquoi)

| Catégorie | Raison |
|---|---|
| Création de comptes test sur la DB staging | Risque de pollution prod + pas de DB test isolée. **Activable** via `RUN_DESTRUCTIVE=1`. |
| Probes RLS intrusifs (lecture cross-utilisateur) | Idem + considéré comme probing tant que pas de jeu de données dédié. Activable via `RUN_INTRUSIVE=1`. |
| Dump complet schéma Supabase prod | Pas d'accès direct depuis le sandbox audit. À faire en poste local. |
| Lighthouse | Non installé dans cette campagne. Spec à compléter. |
| Tests cross-browser (Firefox, WebKit) | Sandbox limité ; specs prêtes, à relancer. |
| Mobile/Tablet screenshots complets | Timeouts sandbox ; specs prêtes, à relancer. |
| Test fuites mémoire | Non implémenté ; pseudo-code dans PERF_REPORT. |

### Contraintes techniques de l'environnement

- Sandbox d'exécution avec proxy TLS interne → `ignoreHTTPSErrors: true` activé dans `playwright.config.js`. À **désactiver** pour les runs en environnement maître / CI réel.
- Chromium seul installé (Firefox, WebKit nécessitent `npx playwright install firefox webkit`).

---

## 3. Bugs CRIT — à fixer avant launch <a id="3-bugs-crit"></a>

### État des 3 CRIT initiaux (post-validation intrusive)

| ID | Description | Validation effectuée | Statut |
|---|---|---|---|
| **CRIT-1** | Audit RLS Supabase incomplet | 9 tables probées en anon : 7/9 retournent `[]` ou 401, **2 expositions trouvées** (cf. CRIT-4, CRIT-5) | 🟡 **Partiel** — voir CRIT-4 |
| **CRIT-2** | Gating auth pages applicatives | 5 pages chargées sans cookie, grep PII complet : seul `contact@tabibi.doctor` apparaît | ✅ **LEVÉ** — voir AUTH_GATING_REPORT |
| **CRIT-3** | Mass assignment sur `update_my_doctor_profile` | INSERT users avec `is_admin` → 400 (col inexistante) ; RPC sans auth → 401/not_authenticated | 🟢 **Mitigé** (anon-side). Test post-auth médecin reste à faire — voir MASS_ASSIGNMENT_REPORT |

### Nouveaux CRIT découverts (post v1.0)

| ID | Description | Source | Effort fix |
|---|---|---|---|
| **CRIT-4** | **`doctor_profiles` expose à anon des champs sensibles** : `email`, `phone`, `id_card_path`, `ordre_card_path`, `validation_rejected_reason`, `validation_*`, `user_id`. Actuellement seulement 10 emails populés, **0 paths documents**, mais **bombe à retardement** au launch. | RLS_INTRUSIVE_REPORT §4 | 2 h (révoquer SELECT direct + pousser front sur `public_doctors`) |
| **CRIT-5** | **L'endpoint `/auth/v1/signup` accepte les signups sans token Turnstile** (le captcha n'est imposé que côté UI). Permet la création illimitée de comptes unconfirmed depuis un script. | RLS_INTRUSIVE_REPORT §6 | 4-6 h (Edge function captcha-gated ou rate limit Supabase Pro) |

> ⚠️ **Avant le launch septembre 2026** : CRIT-4 et CRIT-5 doivent être adressés. CRIT-1 reste à compléter par un dump RLS prod exhaustif et un test cross-user A↔B avec `service_role`.

---

## 4. Bugs MAJ — à fixer si temps <a id="4-bugs-maj"></a>

| ID | Description | Source | Effort fix |
|---|---|---|---|
| MAJ-1 | Pages `/` et `/index.html` ont échoué à charger 2/26 fois (timeout/load issue) — à reproduire en environnement stable | BUTTONS_REPORT §2.2 | 2 h |
| MAJ-2 | Tests destructifs E2E non exécutés (signup, prise RDV, claim) — nécessite DB test | FLOWS_REPORT §4 | 1 jour (setup DB test) + 1 jour run |
| MAJ-3 | Audit RLS intrusif Playwright en attente | SECURITY_REPORT §8 | 0.5 jour |
| MAJ-4 | XSS testing étendu (motif RDV, bio médecin) | SECURITY_REPORT §11 | 0.5 jour |
| MAJ-5 | Audit upload fichiers (MIME, taille, malware scan) | SECURITY_REPORT §11 | 0.5 jour |
| MAJ-6 | Plan progressif retrait `'unsafe-inline'` CSP (migrer `onclick=` vers JS) | SECURITY_REPORT §2 | 2-3 jours post-launch |
| MAJ-7 | Lighthouse audit en CI sur 3 pages clés | PERF_REPORT §5 | 0.5 jour |
| MAJ-8 | Restreindre `pdm_select_all` policy | DB_AUDIT_REPORT §2 | 2 h |
| MAJ-9 | Run complet axe-core a11y + remédiation findings critiques | A11Y_REPORT §5 | 1-2 jours |

---

## 5. Bugs MIN — post-launch acceptable <a id="5-bugs-min"></a>

| ID | Description | Source | Effort fix |
|---|---|---|---|
| MIN-1 | Méthode CLICK_FAIL sur sélecteurs nth-button trop génériques | BUTTONS_REPORT §3 | 1 j (refonte sélecteurs) |
| MIN-2 | Préconnexion DNS pour Supabase et CDN | PERF_REPORT §7 | 30 min |
| MIN-3 | Test fuite mémoire en navigation 10× | PERF_REPORT §6 | 0.5 j |
| MIN-4 | Header `x-xss-protection` legacy → option `0` | SECURITY_REPORT §2 | 5 min |
| MIN-5 | `Cross-Origin-Embedder-Policy: require-corp` si SAB nécessaire | SECURITY_REPORT §2 | 30 min |
| MIN-6 | Documentation politique backup (RPO/RTO) | DB_AUDIT_REPORT §4 | 2 h |

---

## 6. Recommandations sécurité <a id="6-recommandations-sécurité"></a>

1. **Avant launch** : exécuter le dump prod RLS + audit (cf. CRIT-1).
2. **Avant launch** : confirmer ou corriger le gating auth (cf. CRIT-2).
3. **Avant launch** : auditer mass-assignment (cf. CRIT-3).
4. Mettre en place une **base de test isolée** pour les flows destructifs et probes RLS.
5. Versionner **tout objet DB** dans `migrations/` (policies, RPC, triggers — actuellement seulement partiel).
6. Programmer des **revues sécurité trimestrielles** post-launch.
7. Souscrire à un **bug bounty** léger (HackerOne lite, Yes We Hack) post-launch + 1 mois.

---

## 7. Recommandations performance <a id="7-recommandations-performance"></a>

1. ✅ La performance **actuelle est très bonne** (LCP 1.4 s, FCP 0.5 s, TTFB 62 ms).
2. Mettre Lighthouse en CI avec budgets Performance ≥ 80, Best Practices ≥ 90, SEO ≥ 90.
3. Ajouter `preconnect` Supabase + CDN.
4. Surveiller les futures pages (dashboard patient = 71 boutons) pour éviter une régression.
5. **Maintenir le budget de 5 requêtes Supabase max par page** — la régression de la Phase 16.5 a été coûteuse, l'éviter à nouveau.

---

## 8. Recommandations accessibilité <a id="8-recommandations-accessibilité"></a>

1. Exécuter le run complet de `05-a11y.spec.js`.
2. Pour chaque violation `critical`/`serious`, créer une issue GitHub avec template.
3. Audit clavier (Tab order, focus visible).
4. Audit lecteur d'écran (NVDA + VoiceOver) sur les 3 flows critiques (signup, login, reservation).
5. Vérifier les **tap targets** mobiles ≥ 44×44 px (WCAG 2.5.5 AAA — visé).

---

## 9. Estimation temps de fix global <a id="9-estimation-fix"></a>

| Bloc | Effort estimé |
|---|---|
| Confirmer/résoudre CRIT-1 (RLS audit) | **1-2 jours** |
| Confirmer/résoudre CRIT-2 (gating) | **0.5 jour** |
| Confirmer/résoudre CRIT-3 (mass assignment) | **0.5 jour** |
| Tous les MAJ | **5-7 jours** |
| Tous les MIN | **3-4 jours** (post-launch) |
| **TOTAL avant launch (CRIT + MAJ urgents)** | **~7 à 10 jours-homme** |

Avec une équipe de 3 personnes (Aghiles + 2 collaborateurs), c'est **réalisable en 3-4 semaines calendaires** avant le launch septembre 2026 — confortable.

---

## 10. Suite de tests installée <a id="10-suite-de-tests"></a>

### Fichiers produits

```
package.json                     — scripts npm
playwright.config.js             — config 5 projets
tests/audit/01-buttons.spec.js   — gating + clic boutons (26 tests)
tests/audit/02-flows.spec.js     — 8 flows E2E (non-destructifs par défaut)
tests/audit/03-security.spec.js  — headers, secrets, XSS, robots/sitemap
tests/audit/04-perf.spec.js      — budgets requêtes + Web Vitals
tests/audit/05-a11y.spec.js      — axe-core WCAG AA
tests/audit/06-screenshots.spec.js — captures 3 viewports
tests/reports/BUTTONS_REPORT.md  + .json
tests/reports/FLOWS_REPORT.md
tests/reports/SECURITY_REPORT.md + security-headers.json
tests/reports/PERF_REPORT.md     + perf-results.json
tests/reports/A11Y_REPORT.md
tests/reports/VISUAL_REPORT.md
tests/reports/DB_AUDIT_REPORT.md
tests/visual/*.png               — 10 captures desktop
docs/audit/INVENTORY.md
docs/audit/RLS_POLICIES.md
docs/audit/RPC_FUNCTIONS.md
docs/audit/TRIGGERS.md
docs/audit/MASTER_AUDIT_REPORT.md (ce document)
```

### Scripts utiles

```bash
# Suite complète
npm test

# Catégories
npm run test:buttons
npm run test:flows
npm run test:security
npm run test:perf
npm run test:a11y

# Avec navigateur visible
npm run test:headed

# Rapport HTML
npm run report

# Modes spéciaux
RUN_DESTRUCTIVE=1 npx playwright test 02-flows.spec.js
RUN_INTRUSIVE=1 npx playwright test 03-security.spec.js
BASE_URL=https://tabibi.doctor npx playwright test
```

### CI suggérée

GitHub Action `.github/workflows/audit.yml` (à créer) :

- Trigger : `workflow_dispatch`, `pull_request` sur `main`.
- Steps : checkout → install Node 22 → `npm ci` → `npx playwright install chromium` → `npm test` → upload reports.

---

## 11. Annexes

- **Comptes test prévus** : non créés dans cette campagne (politique non-destructive). Utiliser `audit-<timestamp>@test.tabibi.invalid` au prochain run destructif.
- **Cleanup DB** : aucun cleanup nécessaire (rien créé).
- **Limites environnement** : `ignoreHTTPSErrors: true` activé pour le sandbox — **désactiver en CI réel**.

---

> Cet audit a été conduit **sans modifier le code production**. Aucun fix n'a été appliqué, conformément à la mission. Toutes les recommandations sont à valider et implémenter dans des PR séparées.
