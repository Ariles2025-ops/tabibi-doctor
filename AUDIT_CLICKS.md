# AUDIT CLICKS — Phase 13.2 staging Netlify

**URL** : https://zingy-treacle-fbd47c.netlify.app/
**Repo local** : HEAD `3d905d1` (fix CRIT inclus)
**Date** : 2026-05-23
**Méthode** : audit statique (grep + parse handlers) + introspection schéma API live + reproduction logique du crash. Pas de browser headless dispo → exécution runtime DOM/CSS non vérifiable.

---

## 🚨 ÉTAPE 1 — Bug card médecin : ROOT CAUSE TROUVÉE + FIX LANDÉ

### Diagnostic complet

**Symptôme user** : clic sur card médecin sur la home → rien ne se passe.

**Tracing du handler** :
1. `docCard()` (index.html:1890) → `onclick="goDoc('${d.id}')"` ✅ correct
2. `goDoc(id)` (index.html:1923) → `DOCTORS.find(x=>x.id===id)` ✅ trouvé (DOCTORS contient les 20 cards loadées) → `showDoctorModal(d)`
3. `showDoctorModal(d)` (index.html:1935) → construit `modal.innerHTML = ...` qui contient :
   - **Ligne 1962** : `${d.prix.toLocaleString()} DA` ← **CRASH** si `d.prix === null`

**Pourquoi c'était null** : Phase 13a (commit `dc8c5a9`) a refactoré `loadDoctorCards()` pour respecter la sémantique DB :
```js
prix: (d.consultation_fee_dzd != null && d.consultation_fee_dzd > 0)
      ? parseInt(d.consultation_fee_dzd, 10)
      : null
```

En M0, **0/79 746 médecins ont `consultation_fee_dzd` renseigné** (sera rempli au claim médecin). Donc `d.prix = null` pour 100% des médecins.

**Mécanisme du crash silencieux** :
- `null.toLocaleString()` lève `TypeError: Cannot read properties of null (reading 'toLocaleString')`
- L'exception se produit pendant l'évaluation du template literal pour `modal.innerHTML = ...`
- Le DOM `modal` (créé via `createElement`) est `appendChild`-é mais reste **vide** car innerHTML n'a jamais été assigné
- L'overflow:hidden body est appliqué → page semble "bloquée" → l'user voit "rien ne se passe" ET ne peut plus scroller

### Fix landé — commit `3d905d1`

3 callsites protégés contre `null`/`undefined` dans `showDoctorModal` + `showBookingModal` :

| Ligne | Avant | Après |
|---|---|---|
| 1962 (showDoctorModal) | `${d.prix.toLocaleString()} DA` | `${d.prix != null ? \`${d.prix.toLocaleString()} DA\` : 'Tarif à confirmer'}` |
| 2051 (showBookingModal) | idem | idem |
| 1949-1954 (note/avis bloc) | `${stars(d.note)}` + `${d.note}` + `${d.avis} avis` | early-return : si `d.note != null` → stars+note+avis, sinon "Pas encore noté" |

**Validation** : `grep -E "d\.prix\.toLocaleString|d\.note\." index.html` retourne 0 occurrence non-protégée après le fix.

**Test E2E à valider en browser** :
1. Ouvrir / → la liste médecin s'affiche
2. Cliquer une card → la **modale doctor s'ouvre** avec créneaux, à propos, bouton "Prendre un RDV"
3. Cliquer "Prendre un RDV" → modale booking s'ouvre

---

## ÉTAPE 2 — Audit exhaustif clicables (méthode statique)

### Total handlers détectés par page

| Page | `onclick=` | `href=` | Notes |
|---|---|---|---|
| index.html | 39 | 47 | home la plus dense |
| reservation.html | 10 | 8 | wizard 4 steps Phase 5.2.3 |
| doctor-profile.html | 6 | 6 | claim banner + book + retour |
| patient-dashboard.html | 71 | 25 | dashboard riche (favoris/RDV/docs/notif) |
| mes-rdv.html | 6 | 7 | 3 tabs + cancel |
| login.html | 2 | 10 | submit form + nav |
| signup.html | 6 | 13 | submit + role select |
| teleconsultation.html | 0 | 10 | feature OFF, page placeholder |
| payment.html | 3 | 7 | select method + confirm |
| notifications.html | 2 | 6 | mark all + back |

### Vérif systématique handlers index.html — fonctions définies ?

Script de check : extraire toutes les fonctions appelées dans `onclick=...(...)` puis vérifier qu'elles sont définies via `function NAME` ou `window.NAME=`.

**Résultat** : 0 fonction manquante détectée sur index.html. Toutes les fonctions appelées en onclick (`goDoc`, `bookDoc`, `filterBySpec`, `doFilter`, `toggleFav`, `selectProfileSlot`, `confirmFromProfile`, `goPage`, `onLangChange`, `triggerInstall`, `dismissInstall`, `openModal`, `closeModal`, `switchAuthTab`, `resetFilters`, etc.) sont toutes définies ET exposées via `window.*`.

### Audit logique des flows clés

| Flow | Statut |
|---|---|
| Home → clic card → modale doctor | ✅ **fixé Phase 13.2** (CRIT crash null) |
| Home → clic "Prendre RDV" sur card → modale booking | ✅ idem fixé |
| Home → chip spécialité → filter via `_specUIToDB` puis loadDoctorCards | ✅ Phase 5.6 |
| Home → chip ville + spec → loadDoctorCards server-side | ✅ Phase 5.6 |
| Home → "Voir tous les médecins" reset | ✅ Phase 5.5 |
| Home → bouton coeur (toggleFav) | ✅ fonction présente, persist localStorage |
| Home → "Installer Tabibi" → triggerInstall | ✅ Phase 5.4 (matchMedia + auto-hide 12s) |
| Home → selector lang FR/AR/EN → onLangChange | ✅ fonction présente |
| doctor-profile → "Réserver un RDV" → reservation.html?doctor_id=... | ✅ Phase 5.2.2 (Option A snake_case) |
| doctor-profile → claim banner "Réclamer ma fiche" → tabibiClaim.handle | ✅ Phase 1 |
| reservation 4 steps wizard | ✅ Phase 5.2.3 |
| reservation → confirm → tabibiBooking.createAppointment INSERT | ✅ Phase 5.2.1 |
| patient-dashboard → tabs Réserver/Mes RDV (redirect external) | ✅ Phase 5.2.5 |
| patient-dashboard → Vue overview (default active) | ✅ Phase 5.4 + Phase 6.1 wire |
| mes-rdv → 3 sections + bouton Annuler | ✅ Phase 5.2.4 |
| login → submit → auth + redirect `?next=` | ✅ Phase 5.2.3 + login patch |
| signup → submit → users upsert + claim si médecin | ✅ Phase 1 |
| payment → select méthode (cash actif seul, autres BIENTÔT) | ✅ Phase 8.2 |
| notifications → markAllRead | ✅ Phase 9.1 (feature OFF → early return) |
| teleconsultation → page placeholder + CTA "Trouver médecin" | ✅ Phase 7.4 (feature OFF) |

---

## Tableau bugs identifiés Phase 13.2

| Page | Élément | Action attendue | Action réelle (AVANT fix) | Sévérité | Statut |
|---|---|---|---|---|---|
| index.html | Click carte médecin entière | Ouvre modale doctor | **Crash silencieux** (TypeError sur `null.toLocaleString()`) → modale vide + body scroll-locked | **CRIT** | ✅ FIXÉ `3d905d1` |
| index.html | Click "Prendre RDV" sur card | Ouvre modale booking | Idem crash (même bug) | **CRIT** | ✅ FIXÉ même commit |
| index.html | Bouton coeur (favori) | Ajoute aux favoris localStorage | (probablement OK, non testé runtime) | — | OK statique |
| index.html | Chips spécialité | Filtre cards | Phase 5.6 confirmée | — | OK |
| index.html | Banner installer Tabibi | Trigger PWA prompt | Phase 5.4 + audit Phase 5.4 OK | — | OK |
| Autres pages | Tous handlers | — | Pas de fonction manquante détectée par audit statique | — | OK statique |

### Limites de l'audit statique
- ❌ Pas de runtime browser → ne détecte pas les erreurs console JS
- ❌ Pas de test CSS (z-index, pointer-events:none, display:none cachant cliquables)
- ❌ Pas de test ordre d'événements (e.stopPropagation manquant, etc.)
- ❌ Pas de test des flows authentifiés (login + dashboard + RDV)

**À tester toi-même en browser après deploy** :
1. Card médecin → modale s'ouvre avec stars/avis OK + "Tarif à confirmer" lisible
2. Modale doctor → bouton "Prendre un RDV" → modale booking s'ouvre
3. Modale booking → "Confirmer le RDV" → INSERT DB OK
4. patient-dashboard authentifié → 5 stats remplies (cf Phase 6.1)
5. Tous les flows critiques user-facing

---

## Recommandation post-deploy

Le fix CRIT déployé suffit à débloquer l'usage principal (clic card médecin). Les autres handlers passent l'audit statique.

**À monitorer en runtime** : si tu vois d'autres "rien ne se passe" sur des boutons, ouvre DevTools Console — une `TypeError` similaire serait visible. Le pattern `null.someMethod()` est le risque principal post Phase 13 (où on a passé prix/note à `null` quand DB vide).

**Si nouveau crash similaire identifié** : grep `\.toLocaleString\|\.toFixed\|\.toUpperCase\|\.indexOf\|\.length` sur les champs nullable (prix, note, photoUrl, bio, workingHours) — ce sont les vecteurs identiques.

---

## Scan préventif post-fix (grep .toLocaleString/.toFixed/.toUpperCase sur champs nullable)

| Fichier | Ligne | Code | Statut |
|---|---|---|---|
| doctor-profile.html | 419 | `d.note.toFixed(1)` | ✅ SAFE — inside `if (d.note != null)` branch |
| doctor-profile.html | 430 | `d.prix.toLocaleString()` | ✅ SAFE — inside `if (d.prix != null)` branch |
| patient-dashboard.html | 430, 534, 580, 604 | `d.prix.toLocaleString()` | ⚠️ DEAD CODE — partie legacy booking neutralisée Phase 5.2.5 (`openBooking` redirige vers doctor-profile.html, `showBookingStep` n'est plus appelée). Aucun crash réel mais à protéger ou supprimer si on réactive un jour le booking inline. |
| index.html | 2476, 2691 | `.toUpperCase()` sur initials/languages | ✅ SAFE — fallback `|| ''` ou `|| 'MD'` en amont |
| patient-dashboard.html | 399 | `list.length.toLocaleString` | ✅ SAFE — `length` est toujours un number |

→ Le seul vrai risque restant est patient-dashboard.html legacy (dead code). Pas un bloquant Phase 13.2.
