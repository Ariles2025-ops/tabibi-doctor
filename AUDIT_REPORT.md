# AUDIT_REPORT — Phase 2 (PROGRESS.md)

> **Date** : 2026-05-21
> **Auditeur** : Claude (Sonnet 4.5)
> **Périmètre** : `~/Downloads/tabibi-FINAL-v4-extracted/` — 38 pages HTML root + 26 scripts JS + 490 pages SEO
> **Méthode** : audit statique (grep + parse) — Lighthouse runtime exécuté côté user (cf. § Lighthouse)
> **Status** : ✅ Audit OK — 2 P0/P1 fixés en Phase 2 — 5 P2 documentés pour phases ultérieures

---

## 🟢 Conformes (verified)

| Catégorie | Vérification | Status |
|---|---|---|
| **Sécurité — secrets** | Service role key Supabase exposé en client | ✅ 0 occurrence |
| **Sécurité — secrets** | Turnstile Secret Key exposée en client | ✅ 0 occurrence (uniquement site key publique en config.js) |
| **Sécurité — secrets** | Sentry DSN en clair | ✅ Placeholder `REPLACE_WITH_SENTRY_DSN` (désactivé tant que pas remplacé) |
| **Sécurité — headers** | HSTS 1 an + preload + includeSubDomains | ✅ `netlify.toml` ligne 15 |
| **Sécurité — headers** | X-Frame-Options DENY | ✅ ligne 18 |
| **Sécurité — headers** | X-Content-Type-Options nosniff | ✅ ligne 21 |
| **Sécurité — headers** | Content-Security-Policy stricte | ✅ ligne 40 (default-src 'self', frame-ancestors 'none') |
| **Sécurité — headers** | Permissions-Policy restrictive | ✅ ligne 32 |
| **Sécurité — headers** | COOP same-origin + CORP same-origin | ✅ lignes 36-37 |
| **RGPD — données** | Table interdite `doctor_profiles` référencée côté client | ✅ 0 occurrence |
| **RGPD — données** | Pages SEO bloquées par `X-Robots-Tag: noindex` | ✅ `netlify.toml` ligne 97 |
| **RGPD — données** | Pas de CSV PII commitable (`.gitignore`) | ✅ blocage `**/medecins*.csv` |
| **Liens** | Hrefs internes pointant vers fichier inexistant | ✅ 24/24 cibles résolues |
| **i18n** | `<html lang>` présent sur pages clés | ✅ `lang="fr"` (5/5 pages auditées) |
| **SEO basique** | Meta description présente | ✅ 5/5 pages clés |
| **SEO basique** | OG tags présents | ✅ 4/5 (patient-dashboard manque og:title — P2) |
| **A11y basique** | Images sans `alt=` | ✅ 0/5 pages |

---

## 🔴 P0 / P1 — Fixés dans cette phase

### P0 #1 — `robots.txt` manquant à la racine [FIXÉ]

- **Symptôme** : aucun fichier `robots.txt` à la racine du site
- **Impact** : Google ne reçoit pas d'indication de chemin pour le sitemap ; les 490 pages `/seo/*` ne sont protégées QUE par le header `X-Robots-Tag noindex` (le header est respecté mais le robots.txt est un signal supplémentaire que Google consulte AVANT de crawler)
- **Fix** : créé `robots.txt` à la racine avec :
  - `Disallow: /seo/` (garde-fou RGPD)
  - `Disallow:` sur toutes les pages utilisateur privées (`patient-dashboard`, `doctor-dashboard`, admin, profils, etc.)
  - `Disallow: /api/`, `/tests/`, `/migrations/`
  - `Sitemap:` pointant vers `sitemap.xml` + sitemaps enfants

### P1 #2 — `index.html:1367` fallback dead code `from('profiles')` [FIXÉ]

- **Symptôme** : bloc try/catch tentant un fallback `supabase.from('profiles')` qui n'existe pas en base (table canonique = `users`)
- **Impact** : code mort dangereux — si `users` lève une erreur RLS un jour, le code tape une 2e fois sur une table fantôme. Le 2e catch silencieux masque l'erreur sans rien remonter.
- **Fix** : suppression du fallback. Désormais `users` upsert + `console.warn` propre en cas d'erreur.

---

## 🟡 P2 — Documentés, à traiter en phases ultérieures

### P2 #3 — Meta `<meta name="robots" content="index,follow">` dans `/seo/*` contradictoire

- **Symptôme** : les 490 pages SEO ont un meta robots `index,follow` dans le HTML, contradictoire avec le `X-Robots-Tag: noindex` du header
- **Mitigation actuelle** : Google applique la directive la plus restrictive en cas de conflit → `noindex` gagne. **Le RGPD est respecté.**
- **Risque résiduel** : signal mixte qui pourrait être mal interprété par d'autres crawlers (Bing, DuckDuckGo) ou par Googlebot en cas de dysfonctionnement de la propagation des headers Netlify
- **Action** : à fixer en **Phase 10** lors de la régénération des pages SEO avec noms anonymisés (`scripts/generate_seo_pages.py`)
- **Périmètre respecté** : la consigne user "ne pas toucher aux pages SEO" est respectée — flagué pour Phase 10

### P2 #4 — `js/tabibi-claim.js` absent de `PRECACHE_URLS` du service worker

- **Symptôme** : `sw.js` ligne 9-13 liste 12 ressources à pré-cacher, mais pas `js/tabibi-claim.js` (créé en Phase 1)
- **Impact** : faible — la stratégie `cacheFirst` couvre tous les `.js` via le runtime cache au premier hit (cf. `sw.js` ligne 47)
- **Action** : à inclure si bump de `CACHE_VERSION`. Respect de la consigne user "ne pas toucher sw.js sauf bump version".

### P2 #5 — `patient-dashboard.html` manque `og:title`

- **Symptôme** : aucun tag `og:title` dans le head
- **Impact** : faible — page privée derrière authentification, non destinée au partage social
- **Action** : ajout en Phase 6 (dashboard patient + historique) lors du polish.

### P2 #6 — JSON-LD Schema.org Physician absent sur `doctor-profile.html`

- **Symptôme** : pas de `<script type="application/ld+json">` `@type: Physician` sur la fiche médecin publique
- **Impact** : SEO local — Google ne peut pas afficher les rich results (étoiles, horaires, adresse)
- **Action** : à ajouter en **Phase 10** (SEO & analytics) — cf. PROGRESS.md ligne 83

### P2 #7 — `SITE_URL` hardcodé `https://tabibi.doctor` dans `js/config.js`

- **Symptôme** : ligne 20 — utilisé pour générer les liens email Supabase Auth (verify, reset)
- **Impact** : sur Netlify preview (`superb-manatee-a950c4.netlify.app`), les emails de vérification pointeront vers `tabibi.doctor` qui n'est pas encore configuré
- **Action** : ajustement manuel pour les tests preview ; bascule définitive en **Phase 13** (déploiement domaine)

---

## 🗄️ Inventaire technique (référence)

### Tables Supabase utilisées côté client (24)

```
account_deletion_requests   doctor_reviews_public        review_reports
api_keys                    my_prescriptions             reviews
api_keys_analytics          my_reviewable_appointments   specialties
api_usage_log               my_upcoming_appointments     user_preferences
appointments                prescriptions                users
cabinet_calendar_view       profiles  (← supprimé en P2) waiting_list
cabinet_members_directory_view  public_doctors           waiting_list_count
cabinet_stats_view          doctor_ratings_summary       wilayas
cabinets
```

### RPCs Supabase appelées (22)

```
accept_cabinet_invitation        invite_cabinet_member
admin_validate_doctor            mark_prescription_delivered
can_review_doctor                mark_video_session_ended
claim_my_doctor_profile          mark_video_session_started
create_prescription_draft        remove_cabinet_member
generate_api_key_pair            request_prescription_signature
get_my_cabinets                  revoke_api_key
get_patient_medical_data         rotate_api_key
get_video_session                set_video_recording_consent
update_prescription_draft        validate_cabinet_invitation
upsert_patient_medical_data
```

### TODOs restants dans le code (3)

| Fichier | Ligne | TODO | Phase prévue |
|---|---|---|---|
| `medecin-profile.html` | 466 | Envoyer 2FA secret via Edge Function | Phase 12 (monitoring & sécurité) |
| `index.html` | 2208 | Remplacer stats hardcodées par API Supabase | Phase 10 (analytics) |
| `onboarding-medecin.html` | 380 | Créer table `doctor_applications` et envoyer | Phase 4 (dashboard médecin) |

---

## 📊 Lighthouse — checklist user-side

Lighthouse runtime nécessite un browser (non exécuté en CLI ici). À exécuter côté user **après deploy preview** :

```bash
# Preview Netlify : https://superb-manatee-a950c4.netlify.app
# Pages à auditer (objectif ≥ 80 partout sur Perf / A11y / SEO / Best Practices) :
1. https://superb-manatee-a950c4.netlify.app/
2. https://superb-manatee-a950c4.netlify.app/doctor-profile.html?id=42
3. https://superb-manatee-a950c4.netlify.app/signup.html
4. https://superb-manatee-a950c4.netlify.app/login.html
5. https://superb-manatee-a950c4.netlify.app/about.html
```

Procédure Chrome DevTools :
1. Ouvrir la page en navigation privée
2. F12 → onglet Lighthouse → Mobile + toutes catégories cochées
3. Cliquer "Analyze page load"
4. Reporter les 4 scores dans le tableau ci-dessous

**Template à remplir post-deploy** :

| Page | Perf | A11y | Best Practices | SEO | Notes |
|---|---|---|---|---|---|
| `/` | ___ | ___ | ___ | ___ | |
| `/doctor-profile.html?id=42` | ___ | ___ | ___ | ___ | |
| `/signup.html` | ___ | ___ | ___ | ___ | |
| `/login.html` | ___ | ___ | ___ | ___ | |
| `/about.html` | ___ | ___ | ___ | ___ | |

Cible : ≥ 80 dans chaque colonne. Tout score < 80 doit être noté en P2 dans ce rapport.

---

## ✅ Conclusion Phase 2

- **2 P0/P1 fixés** : `robots.txt` créé + dead code `from('profiles')` supprimé
- **5 P2 documentés** avec phase cible (la plupart sont des polish-items des phases 4, 6, 10, 12, 13)
- **Aucun bug bloquant restant** pour passer en Phase 3 (pages légales `/legal/`)
- **Sécurité prod-ready** : tous les headers OWASP en place, aucun secret exposé, aucune référence à la table interdite
- **Lighthouse runtime** : à exécuter par le user après déploiement preview (template fourni ci-dessus)

**→ GO Phase 3 (Pages légales `/legal/` + RGPD) sur validation user.**
