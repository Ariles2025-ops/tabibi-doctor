# AUDIT PHASE 5.5 — Staging Netlify (audit + scope Phase 6)

**URL** : https://zingy-treacle-fbd47c.netlify.app/
**Repo local** : HEAD `76b27b1` (Phase 5.4 staging fixes)
**Date** : 2026-05-23
**Méthode** : audit statique (curl + grep + node parse) + introspection API live Supabase via REST `select=*&limit=1`. Pas d'outil headless dans cet environnement → tests visuels responsive / console runtime restent à valider par l'utilisateur post-deploy.

## État staging vs local (Phase 5.4 effectivement déployée ✓)

| Page | HTTP | Staging | Local | Phase 5.4 déployée ? |
|---|---|---|---|---|
| / | 200 | 171 176 | 171 253 | ✅ (delta 77 b = commentaires) |
| /reservation.html | 200 | 28 774 | 28 787 | ✅ |
| /doctor-profile.html | 200 | 29 690 | 29 690 | ✅ |
| /patient-dashboard.html | 200 | 85 958 | 85 986 | ✅ (BUG #2 fix `tab-overview active` présent) |
| /mes-rdv.html | 200 | 23 663 | 23 663 | ✅ |
| /login.html | 200 | 14 298 | 14 306 | ✅ |
| /signup.html | 200 | 26 642 | 26 654 | ✅ |
| /doctor-analytics.html | 200 | 14 540 | 14 540 | ✅ |

→ Phase 5.4 staging fixes confirmés déployés. `loadDoctorCards` présent (4 refs), `tab-overview active` présent (1 ref). Le diff sub-100 bytes vient du commit `96480c7` (i18n cleanup) qui ne change que des commentaires.

## Schéma RÉEL `public_doctors` (introspection API live)

Colonnes vérifiées présentes (via `select=*&limit=1`) :
```
address           — text (souvent NULL)
claimed_at        — timestamp NULL
created_at        — timestamp
full_name         — text
id                — uuid
is_claimed        — bool
is_verified       — bool
legacy_id         — int4 NULL
show_claim_badge  — bool
specialty_ar      — text
specialty_en      — text NULL
specialty_fr      — text
specialty_slug    — text
status            — text ('active'...)
wilaya_fr         — text
```

Colonnes **ATTENDUES par le frontend mais ABSENTES** (cause potentielle de bugs de display) :
- `wilaya_code`, `wilaya_ar`, `wilaya_en` — frontend fallback OK mais perte filtre code
- `full_name_ar` — `tabibiDoctorName.formatForLang(_,'ar')` retombe sur `full_name`
- `entity_type` — `tabibiDoctorName` applique toujours préfixe "Dr." (donc "Dr. Nadia Kidari" pour une pharmacie)
- `consultation_fee_dzd`/`consultation_fee`/`price` — frontend affiche **1500 DA pour tous** (fallback hardcodé)
- `rating`/`average_rating` — frontend affiche **4.5 ★ pour tous** (fallback hardcodé)
- `review_count`/`total_reviews`/`reviews_count` — affiche **0 avis pour tous**
- `is_urgent`/`urgent` — chip "Urgences" filtrera personne
- `gender`/`sexe` — chip "Femmes" filtrera personne
- `description`/`bio`/`about` — fiche doctor-profile affiche ""
- `photo_url` — avatar par initiales seulement (déjà OK)
- `languages`/`langs` — fallback `['FR','AR']` codé en dur

## Tableau des bugs identifiés

| # | Page | Bug | Sévérité | Cause | Fix |
|---|---|---|---|---|---|
| 1 | index.html | **Recherche ne marche pas — Constantine+ORL → "0 médecin(s) trouvé(s)"** alors que DB a 37 résultats | **CRIT BLOQUANT PRODUIT** | `doFilter()` filtre l'array client `DOCTORS` (20 docs chargés via `loadDoctorCards(){}` sans filtres, ordonné par full_name → premiers "Aaaaa..."). Aucun appel serveur lors d'un changement de filtre. | Refactor `loadDoctorCards(opts)` : filtres en query string PostgREST (`wilaya_fr=eq.<v>`, `specialty_fr=eq.<v>`, `full_name=ilike.%X%`). Reconnect `doFilter()` → debounce 300 ms → re-fetch + count exact via `Prefer: count=exact` + `Content-Range` header. Empty state "élargir / voir tous" intelligent. Filtres SQL viables : ville + spec + search + cert. Filtres client-side post-fetch : prix max, note min (faute de colonnes en base). |
| 2 | index.html | Préfixe "Dr." appliqué à des pharmacies/cliniques | MAJEUR | `entity_type` absent de la vue → `tabibiDoctorName.format()` défaut sur "médecin" → "Dr. Nadia Kidari" (= pharmacie) | TODO-SQL : ajouter `entity_type` à `public_doctors`. Workaround front : heuristique sur `specialty_slug` (`pharmacie`, `laboratoire`, `clinique`, `centre*`) pour skipper "Dr.". |
| 3 | index.html | Tous les médecins ont prix=1 500 DA, note=4.5 ★, 0 avis | MAJEUR | Colonnes `consultation_fee_dzd`, `rating`, `review_count` absentes de la vue → fallbacks hardcodés dans `loadDoctorCards` | TODO-SQL : ajouter colonnes ou JOIN. Workaround front : afficher "Tarif à confirmer" / "Non noté" au lieu de placeholders trompeurs. |
| 4 | index.html | Chips "Urgences" / "Femmes" filtrent personne | MIN | `is_urgent`, `gender` absents de la vue + filtres `chips.includes(...)` reposent dessus | TODO-SQL. Workaround front : griser ces chips ou les retirer V1. |
| 5 | toutes | Service Worker `sw.js` jamais enregistré (toujours pas fixé depuis P5.4 audit) | MAJEUR | Aucun `navigator.serviceWorker.register('/sw.js')` dans le code | Hors scope P5.5 (encore) — fix Phase 11 (PWA dédiée) |
| 6 | doctor-profile.html | `?id=<uuid>` retourne souvent fiche vide ou crash si UUID inexistant | MAJEUR | `_fetchDoctorFromSupabase` retombe sur fallback mais ne montre pas d'état "introuvable" propre | Audit profondeur Phase 6+ (hors scope immédiat) |
| 7 | reservation.html | Step 1 calendrier 90 j fonctionne MAIS seul `medecin.test` claim → toutes les autres fiches affichent "Aucun créneau" car `is_claimed=false` filtre dans RPC `get_available_slots` | INFO (by design) | RPC Phase 5.1bis filtre `is_claimed=true` — anti-énumération | N/A — comportement attendu jusqu'à campagne claim |
| 8 | login.html / signup.html | hCaptcha / Turnstile widget absent → spam potentiel | MAJEUR | Côté frontend les widgets ne sont pas wirés ; backend Edge Function attend pourtant un token | Hors scope P5.5 ; Phase 12 (sécurité) |
| 9 | mes-rdv.html | Nom médecin = "Praticien" pour tous les RDV | MAJEUR | Vue `my_upcoming_appointments` n'expose pas `doctor_full_name` / `doctor_specialty_fr` (cf TODO-SQL-003) — tous les fallbacks JS tombent à "Praticien" | TODO-SQL — déjà tracé |
| 10 | doctor-analytics.html | Page accessible uniquement aux médecins (role check OK) — mais si pas connecté, redirect vers login sans message | MIN | `alert(...)` + `location.href = 'login.html'` un peu brutal | UX cosmétique, Phase 12 |

## Vérifications **NON** réalisées (limites environnement)

| Domaine | Pourquoi | À faire toi-même post-deploy |
|---|---|---|
| Console errors runtime | Pas de browser headless dispo | DevTools Console sur chaque page |
| Network tab durées >2 s | idem | DevTools Network |
| Responsive 375 / 1440 px | idem | Chrome Device Toolbar |
| Switch FR↔AR↔EN runtime | idem | Sélecteur lang sur staging |
| Test login + dashboard authentifié | nécessite credentials | `patient.test@tabibi.doctor` |
| PWA install flow | nécessite Chrome avec PWA support | Tester sur Android |

## Scope Phase 6 identifié (depuis PROGRESS.md)

```
## Phase 6 — Dashboard patient + historique (4-6h)
- [ ] 6.1 Page patient-dashboard.html (prochains RDV, historique, ordonnances, favoris)
- [ ] 6.2 Édition profil patient (nom, DDN, téléphone, wilaya, langue)
```

**Évaluation** : **100 % frontend**. Aucun SQL prévisible (les RDV passent par `tabibiBooking.listMyAppointments()` qui existe, ordonnances/favoris stockables localStorage M0, profil via `auth.users.user_metadata` UPDATE déjà supporté par Supabase auth). Phase 6 sera entamée si BUG #1 + audit fixes terminés à temps.

## Plan d'action P5.5

1. **AUDIT_PHASE5_5.md** (ce doc) — committé en premier
2. **Fix BUG #1 search** — commit critique, le plus urgent
3. **Fix BUG #2** (heuristique entity_type via specialty_slug) — workaround front
4. **Fix BUG #3** (placeholders prix/note trompeurs → "Tarif à confirmer" / "—") — workaround front
5. **Phase 6** entamée si temps : wire patient-dashboard cards prochains RDV + favoris localStorage
6. **SQL_TODO.md** mis à jour avec 4 nouveaux TODOs (cf bugs #2 #3 #4 #6)
7. ZIP + tag `phase5-5-search-fix`

## Contraintes respectées
- ✅ Compteur 79 746 hors atteinte
- ✅ Pas de hardcode 14 508/14 500/79 746 réintroduit
- ✅ Aucun SQL exécuté
- ✅ `loadRealDoctors()` non supprimée
