# AUDIT PHASE 5.4 — Staging Netlify

**URL auditée** : https://zingy-treacle-fbd47c.netlify.app/
**Repo local audité** : commit `96480c7` (Phase 5.3 cleanup)
**Date** : 2026-05-23
**Méthode** : audit statique (code + curl) — pas d'outil headless (Playwright/Puppeteer) disponible dans cet environnement. Les bugs visuels nécessitant rendu réel sont basés sur les screenshots fournis par l'utilisateur.

## Méthodologie
- **HTTP** : curl HEAD/GET sur les 8 pages cibles
- **Static analysis** : grep + `node --check` (JS), `new Function()` (inline scripts)
- **Diff** : comparaison local ↔ staging (Phase 5.3 cleanup non encore déployé sur staging)
- **Limites** : pas de console errors browser, pas de Network tab, pas de tests responsive interactifs

## État des 8 pages staging

| Page | HTTP | Taille staging | Taille local | Diff | Notes |
|---|---|---|---|---|---|
| / (index.html) | 200 | 166 792 | 166 869 | -77 b | Phase 5.3 cleanup pas encore push |
| /reservation.html | 200 | 28 774 | 28 787 | -13 b | idem |
| /doctor-profile.html | 200 | 29 690 | 29 690 | = | identique |
| /patient-dashboard.html | 200 | 85 779 | 85 807 | -28 b | idem |
| /mes-rdv.html | 200 | 23 663 | 23 663 | = | identique |
| /login.html | 200 | 14 298 | 14 306 | -8 b | idem |
| /signup.html | 200 | 26 642 | 26 654 | -12 b | idem |
| /doctor-analytics.html | 200 | 14 540 | 14 544 | -4 b | idem |

→ Tous accessibles. Diffs négligeables (commentaires Phase 5.3 i18n cleanup).

## Tableau des bugs identifiés

| # | Page | Bug | Sévérité | Cause hypothèse | Fix proposé |
|---|---|---|---|---|---|
| 1 | index.html | Liste "Médecins certifiés en Algérie" vide ("0 médecin(s) trouvé(s)") | **CRITIQUE** | `loadRealDoctors()` désactivé en commit `a7d4ee4` pour fix le compteur ; cette fonction populait aussi le tableau `DOCTORS` qui alimente `renderDocs()` via `filtered = DOCTORS.filter(...)`. Aucun remplaçant. | NEW fonction `loadDoctorCards()` : 1 fetch `select=*&limit=20&order=full_name`, push dans `DOCTORS`, call `doFilter()` ; **n'écrit jamais** sur `hero-doc-count` / `stats-doc-count` / `foot-doc-count` (réservés à `animateCounters`). |
| 2 | patient-dashboard.html | Contenu blanc sous header + tab-bar | **CRITIQUE** | Régression commit `97d1097` (Phase 5.2.5) : `active` déplacé du bouton tab `#tab-book` → `#tab-overview` mais le PANEL `#tab-overview` n'a jamais reçu `class="active"`. CSS `.tab-panel { display:none } ; .tab-panel.active { display:block }` → 0 panel actif → tout caché. | Ajouter `active` à `<div id="tab-overview" class="tab-panel">` (ligne 183 actuelle). |
| 3 | toutes (banner global) | Install banner "Installer Tabibi" recouvre les CTA en bas | MINEUR | `position:fixed bottom:0 z-index:400`, paddingBottom dynamique appliqué mais OK ; le vrai problème : (a) X petit (30×30, rgba .18), (b) **pas de check `display-mode: standalone`** → s'affiche même quand PWA déjà installée, (c) pas d'auto-hide. | matchMedia standalone check + X plus visible (40×40 + bg .35 + bold) + auto-hide 12s sans interaction + dismiss déjà persistant 7j. |
| 4 | patient-dashboard.html | Tab bar "Favoris" coupé à "Favori" | MINEUR | `.app-root { max-width:480px }` (mobile-first même sur desktop) → 5 tabs avec `padding:12px 16px` + container `padding:0 16px` = ~555 px nécessaires sur 448 px utiles → "Favoris" overflow droit. `overflow-x:auto` présent mais user ne voit pas qu'il faut scroller. | Réduire `.dash-tab` padding-horizontal 16px→10px + container `.dash-tabs` padding-horizontal 16px→8px → ~465 px, fit dans 448 px (Documents reste le plus large mais entre dans les bounds). |

## Bugs additionnels trouvés en audit statique

| # | Page | Bug | Sévérité | Statut |
|---|---|---|---|---|
| 5 | TOUTES | **Service Worker non enregistré** : `sw.js` existe mais aucune page ne fait `navigator.serviceWorker.register('/sw.js')`. Toutes les bumps v17→v18 ont été sans effet. PWA install marche partiellement (manifest présent), mais pas d'offline / pas de cache assets. | MAJEUR | ⏸️ **SKIP Phase 5.4** : impact = perte de la fonctionnalité PWA offline. Pas un blocker pour M0 (les utilisateurs cibles sont en réseau). Fix Phase 6 + test E2E PWA install. |
| 6 | reservation.html, mes-rdv.html, patient-dashboard.html, doctor-profile.html | 404 sur `scripts/app.js`, `scripts/seed.js`, `scripts/payments.js` — référencés mais fichiers inexistants depuis longtemps | MINEUR | ⏸️ **SKIP** : préexistant (legacy mocks remplacés par `tabibi-*` system) ; les pages chargent malgré tout. Cleanup script tags Phase 12. |
| 7 | index.html | 4 inline scripts retournent "Unexpected token ':'" sur `new Function()` | INFO | ✅ **N/A** : faux positifs sur littéraux d'objets HTML/i18n top-level (déjà confirmé Phase 5.3). Ces scripts s'exécutent correctement en browser. |

## Vérifications **NON** réalisées (limites de l'environnement)

| Domaine | Pourquoi pas | À faire manuellement |
|---|---|---|
| Console errors runtime | Pas de browser headless | Ouvrir DevTools sur chaque page après deploy Phase 5.4 |
| Network tab (requêtes échouées, doublons, lenteurs >2s) | idem | Idem + Network tab |
| Tests visuels responsive (375 px, 1440 px) | Pas de rendu réel | Chrome DevTools Device Toolbar |
| Changement de langue FR↔AR↔EN | JS runtime nécessaire | Tester le sélecteur de langue après deploy |
| Service Worker scope + fetch behavior | SW non-enregistré (cf bug #5) | Voir bug #5 ; à faire après fix register() |
| Login + dashboard authentifié | Nécessite création compte test + flow login | À tester avec credentials existants `patient.test@tabibi.doctor` |

## Recommandations priorisées

1. **Maintenant** (Phase 5.4) : Fix bugs #1, #2, #3, #4 → 4 commits atomiques + ZIP + drag-drop staging
2. **Après deploy** : Audit interactif des 6 vérifs non réalisées par toi-même via Chrome DevTools
3. **Phase 6** : Fix bug #5 (Service Worker register) + cleanup bug #6 (script tags 404)
4. **Phase 12** : audit i18n FR/AR/EN exhaustif (toutes les clés actives), cleanup `scripts/app.js`/`seed.js`/`payments.js` morts

## Contraintes respectées
- ✅ Compteur 79 746 non touché
- ✅ Aucun hardcode `14 508` / `14 500` / `79 746` réintroduit
- ✅ Aucun SQL Supabase modifié
- ✅ `loadRealDoctors()` non supprimée (gardée pour rollback, juste rendue dormante)
