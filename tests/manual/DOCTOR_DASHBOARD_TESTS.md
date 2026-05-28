# Tests manuels E2E — Dashboard médecin

> **Phase** : 4.B.4.2 (PROGRESS.md)
> **Date** : 2026-05-22
> **Version cible** : ≥ commit `881d236` (fixtures démo blocages)
> **Cible** : staging ou prod (https://fascinating-seahorse-f1f2dd.netlify.app)
>
> **Objectif** : checklist manuelle reproductible pour valider la non-régression
> du dashboard médecin **avant tout déploiement prod**. À lancer après chaque
> `./scripts/build-zip.sh` réussi.
>
> **Durée** : ~10-15 min pour les 7 scénarios.

---

## 🛠 Pré-requis communs (à faire UNE SEULE FOIS avant la 1re passe)

| # | Étape | Référence |
|---|---|---|
| 1 | ZIP généré et validé syntaxe JS | `./scripts/build-zip.sh` puis Netlify Drop |
| 2 | Seeds prod exécutés dans Supabase SQL Editor | `docs/PROD_SEEDS_REGISTRY.md` |
| 3 | Compte test `medecin.test@tabibi.doctor` créé en auth.users | signup.html |
| 4 | Fiche `legacy_id=1` claim par ce compte | `migrations/PHASE4B_seed_claim_test_doctor.sql` |
| 5 | 3 fixtures blocages chargées | `fixtures/test_doctor_blocages.sql` |
| 6 | Navigateur en mode privé (cache propre) ou Cmd+Shift+R | — |

**Si l'un de ces pré-requis manque, les tests T2/T3/T4/T5 échoueront avec un résultat KO différent de celui documenté.**

---

## T1 — LOGIN médecin

**Pré-requis** : pré-requis communs OK.

### Étapes
1. Ouvrir https://fascinating-seahorse-f1f2dd.netlify.app/login.html
2. Email : `medecin.test@tabibi.doctor`, mot de passe : (le password du compte test)
3. Cliquer **Se connecter**
4. Observer la redirection automatique

### Résultat attendu ✅
- Redirection vers `doctor-dashboard.html` en < 2s
- Onglet par défaut **"Aujourd'hui"** affiché (hero gradient vert + KPIs)
- Header : avatar avec initiales "OU" (Ouanza), bouton notification, bouton déconnexion
- Aucune erreur console (F12 → Console)

### Résultat KO connu
- Redirection vers `index.html` → session pas créée, vérifier le password
- Reste sur `login.html` avec toast rouge → email/password faux
- Page blanche → SyntaxError JS quelque part (lancer `./scripts/build-zip.sh` pour identifier)

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

---

## T2 — AGENDA load (claim OK + 3 fixtures)

**Pré-requis** : T1 ✅, fixtures `test_doctor_blocages.sql` chargées en prod.

### Étapes
1. Depuis `doctor-dashboard.html`, cliquer l'onglet **Agenda** dans la barre top
2. Scroller vers le bas jusqu'à la section **"Blocages exceptionnels"**
3. Attendre 3 secondes max

### Résultat attendu ✅
- La section affiche **exactement 3 cards** triées chronologiquement :
  1. **Mer 15 avril 2026 → Mer 22 avril 2026** + badge jaune **"Toute la journée"** + 🏷 "Vacances de Pâques"
  2. **Sam 30 mai 2026 → Dim 31 mai 2026** + badge jaune **"Toute la journée"** + 🏷 "Indisponible weekend"
  3. **Mer 10 juin 2026 09:00 → Mer 10 juin 2026 17:00** (sans badge) + 🏷 "Formation continue cardiologie"
- Chaque card a une icône poubelle rouge à droite
- Bouton **"+ Bloquer un créneau"** actif (pas grisé)
- Mini-bandeau jaune "Réclamez votre fiche d'abord" **invisible**

### Résultat KO connu
- "Chargement..." figé indéfiniment → bug Phase 4.B.3 réapparu (vérifier console pour `[unavail-validate]` / `[tabibiDoctor]` warnings, et `loadUnavailSlots` finally{} dans fix3)
- "Aucun blocage..." alors qu'on devrait avoir 3 cards → fixtures non chargées en prod (cf. PROD_SEEDS_REGISTRY.md)
- "— (réclamez votre fiche)" affiché → la fiche n'est pas claim, voir seed `claim_test_doctor.sql`
- "Service indisponible (recharger la page)" → `js/tabibi-doctor-dashboard.js` n'est pas chargé (SyntaxError potentiel)

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

---

## T3 — CREATE blocage (timed, sans all_day)

**Pré-requis** : T2 ✅.

### Étapes
1. Onglet Agenda → cliquer **"+ Bloquer un créneau"**
2. La modal s'ouvre, **ne pas cocher** "Toute la journée"
3. Remplir :
   - Du (date) : **2026-07-01**
   - Heure début : **14:00**
   - Au (date) : **2026-07-01**
   - Heure fin : **16:00**
   - Raison : **Test E2E**
4. Cliquer **"Bloquer ce créneau"**

### Résultat attendu ✅
- Bouton passe à "Enregistrement..." pendant ≤ 10s
- Modal se ferme automatiquement
- Toast vert haut écran : **"Blocage enregistré ✓"**
- Section "Blocages exceptionnels" rechargée → nouvelle 4e card visible :
  - **Mer 1 septembre 2026 14:00 → Mer 1 septembre 2026 16:00** + 🏷 "Test E2E"
- Vérif DB optionnelle dans Supabase SQL Editor :
  ```sql
  SELECT id, starts_at, ends_at, reason
    FROM public.doctor_unavailable_slots
   WHERE reason = 'Test E2E';
  ```
  → 1 ligne attendue.

### Résultat KO connu
- Bouton reste figé "Enregistrement..." sans toast et sans fermeture modal → bug 4.B.3-fix3 (hang Supabase) — `finally{}` aurait dû restaurer
- Modal se ferme mais 0 row en DB → bug `addUnavailableSlot` retournant ok:true à tort
- Toast rouge "Délai dépassé (>10s)..." → timeout `_withTimeout` déclenché, session expirée probable (re-login)
- Toast rouge "Erreur inattendue..." → vrai bug runtime, lire console (F12)

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

---

## T4 — CREATE blocage (all_day toggle)

**Pré-requis** : T3 ✅ (peut être joué directement après).

### Étapes
1. Onglet Agenda → cliquer **"+ Bloquer un créneau"**
2. Modal ouverte → cocher **"Toute la journée (cache les heures)"**
3. Observer : les 2 champs "Heure début" et "Heure fin" **disparaissent**
4. Remplir :
   - Du (date) : **2026-07-15**
   - Au (date) : **2026-07-15** (même jour)
   - Raison : **Test all-day**
5. Cliquer **"Bloquer ce créneau"**

### Résultat attendu ✅
- Modal se ferme, toast vert "Blocage enregistré ✓"
- Nouvelle card apparaît :
  - **Mer 15 septembre 2026 → Mer 15 septembre 2026** + badge jaune **"Toute la journée"** + 🏷 "Test all-day"
- En DB : `all_day = true`, `starts_at = 2026-07-15 00:00:00+01`, `ends_at = 2026-07-15 23:59:00+01`

### Résultat KO connu
- Erreur "La date de fin doit être ≥ à la date de début" en modal → bug allDay même-jour (bug fix2 originel)
- Le badge "Toute la journée" n'apparaît pas → mapping `all_day` côté `_fmtSlotDate` cassé
- Les heures restent visibles dans la modal après cochage → handler `toggleUnavailAllDay()` cassé

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

---

## T5 — DELETE blocage

**Pré-requis** : T3 ✅ (le blocage "Test E2E" doit exister).

### Étapes
1. Onglet Agenda → identifier la card **"Test E2E"** (créée en T3)
2. Cliquer l'icône **🗑 corbeille rouge** à droite de la card
3. Confirmation native du navigateur : **"Supprimer ce blocage ?..."** → cliquer **OK**

### Résultat attendu ✅
- Toast vert : **"Blocage supprimé ✓"**
- La card "Test E2E" disparaît immédiatement de la liste
- Vérif DB :
  ```sql
  SELECT count(*) AS remaining
    FROM public.doctor_unavailable_slots
   WHERE reason = 'Test E2E';
  ```
  → 0 ligne attendue.

### Résultat KO connu
- Card disparaît mais row toujours en DB → bug optimistic-UI (rare)
- Toast rouge "Permission refusée" → RLS `dus_delete_owner` bloque, vérifier user_id de la fiche
- Toast rouge "Délai dépassé (>8s)..." → timeout, session expirée
- Confirmation native ne s'affiche pas → onclick handler cassé (typo dans le `_esc(s.id)`)

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

### Cleanup post-test
Si T4 est ✅, supprimer aussi le blocage "Test all-day" via le même geste pour repartir d'un état propre (juste les 3 fixtures).

---

## T6 — ERROR handling (date fin avant date début)

**Pré-requis** : T2 ✅.

### Étapes
1. Onglet Agenda → cliquer **"+ Bloquer un créneau"**
2. Modal ouverte → **ne pas cocher** "Toute la journée"
3. Remplir avec une plage **rétroactive** :
   - Du (date) : **2026-08-15**
   - Heure début : **15:00**
   - Au (date) : **2026-08-15**
   - Heure fin : **10:00** (← avant l'heure début)
   - Raison : (vide ou n'importe quoi)
4. Cliquer **"Bloquer ce créneau"**

### Résultat attendu ✅
- **Aucun appel réseau** (validation client préemptive)
- Bandeau rouge inline dans la modal : **"La date/heure de fin doit être strictement après le début."**
- Modal reste ouverte (pas de fermeture)
- **1 seul toast rouge** en haut : "Erreur de création du blocage — voir détail dans la modal"
- **Pas de double-affichage** verbatim du même message (cf. 4.B.3-fix1-review)
- Pas de spinner figé sur le bouton

### Résultat KO connu
- Modal se ferme → validation côté frontend cassée, on a tapé sur Supabase à tort
- Toast rouge identique au message inline → régression dédupe fix1-review (commit `2128955`)
- "Erreur inattendue" → exception sur l'await (rare car validation pré-await)

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

---

## T7 — NON-CLAIM bandeau (compte médecin sans fiche)

**Pré-requis** :
- Soit : un 2e compte médecin créé en auth, jamais claim
- Soit : déclaim temporaire de medecin.test via le **rollback du seed** :
  ```sql
  -- Décommente puis exécute la section ROLLBACK de
  -- migrations/PHASE4B_seed_claim_test_doctor.sql
  UPDATE public.doctor_profiles
     SET user_id    = NULL,
         claimed_at = NULL,
         is_claimed = false
   WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor');
  ```
- **N.B.** : ce rollback supprimera aussi (via foreign key consideration) la visibilité des slots. Pour les ré-attacher après le test, relancer le seed `PHASE4B_seed_claim_test_doctor.sql`.

### Étapes
1. Login avec le compte médecin **sans fiche claim** (résultat du déclaim)
2. Aller sur `doctor-dashboard.html` → onglet **Agenda**
3. Scroller jusqu'à la section "Blocages exceptionnels"

### Résultat attendu ✅
- Mini-bandeau jaune visible : **"Réclamez votre fiche dans l'annuaire pour pouvoir gérer vos disponibilités. [Aller à mon profil]"**
- Bouton **"+ Bloquer un créneau"** est **grisé/disabled**
- La liste affiche : **"— (réclamez votre fiche pour activer cette section)"**
- Si on essaie de cliquer le bouton grisé → rien ne se passe

### Résultat KO connu
- Bouton actif alors qu'on n'a pas claim → bug `getMyDoctorId` qui retourne quand même un id (régression hotfix 4.B.2)
- Liste vide sans bandeau → branche `if (!docId)` cassée
- Modal s'ouvre si on clique le bouton (alors qu'il devrait être disabled) → `btnAdd.disabled = true` non appliqué

### Report
- [ ] ✅ Passé
- [ ] ❌ Échec — détail :

### Cleanup post-test (CRITIQUE)
**Re-claim** la fiche pour ne pas laisser medecin.test cassé :
```sql
-- Relance la section 2 de PHASE4B_seed_claim_test_doctor.sql
-- OU UPDATE manuel équivalent :
UPDATE public.doctor_profiles
   SET user_id    = (SELECT id FROM auth.users WHERE email = 'medecin.test@tabibi.doctor'),
       claimed_at = NOW(),
       is_claimed = true
 WHERE id = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';
```

---

## 📊 Récap final

Coche cette section seulement après avoir joué les 7 tests :

| # | Test | Status | Notes |
|---|---|---|---|
| T1 | LOGIN médecin | ☐ | |
| T2 | AGENDA load 3 fixtures | ☐ | |
| T3 | CREATE blocage timed | ☐ | |
| T4 | CREATE blocage all_day | ☐ | |
| T5 | DELETE blocage | ☐ | |
| T6 | ERROR handling date invalide | ☐ | |
| T7 | NON-CLAIM bandeau | ☐ | |

**Décision déploiement** :
- 7/7 ✅ → GO production
- 6/7 ✅ avec T6 ou T7 ❌ non-bloquant → GO + ticket Phase 12
- ≤ 5/7 ✅ → **STOP**, créer hotfix avant déploiement
- T1 ou T2 ❌ → **STOP IMMÉDIAT**, blocker majeur

---

## 🔗 Références

- **Pipeline build** : `scripts/build-zip.sh` (Phase 4.B.4.0c)
- **Audit RPC** : `docs/AUDIT_claim_rpc.md` (Phase 4.B.4.0a)
- **Registry seeds prod** : `docs/PROD_SEEDS_REGISTRY.md` (Phase 4.B.4.0b)
- **Seed claim fiche** : `migrations/PHASE4B_seed_claim_test_doctor.sql`
- **Fixtures blocages** : `fixtures/test_doctor_blocages.sql` (Phase 4.B.4.1)
- **Tests Phase 1 (claim flow)** : `tests/manual/CLAIM_FLOW_TESTS.md`
- **Commits clés** : `c7443be` (fix3 anti-hang), `2128955` (fix1-review dedupe toast), `c8cd0e2` (fix2 timezone Date)
