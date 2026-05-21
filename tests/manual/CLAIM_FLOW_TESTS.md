# Tests manuels — Flow de réclamation de fiche médecin

> **Phase** : 1 (PROGRESS.md)
> **Date** : 2026-05-21
> **RPC backend** : `claim_my_doctor_profile(legacy_id_input INT)` (en base, ne pas modifier)
> **Fichiers impactés** :
> - `doctor-profile.html` (bandeau + bouton)
> - `signup.html` (auto-claim post-signup)
> - `js/tabibi-claim.js` (logique partagée)

## Pré-requis

- Site déployé sur Netlify preview (ou `python3 -m http.server` local)
- Au moins 1 fiche médecin **non revendiquée** (`is_claimed=false`) avec un `legacy_id` connu
  (ex : `legacy_id=42`, fiche d'un médecin scrappé)
- Au moins 1 compte patient existant en base (pour scénario 3)
- Console DevTools ouverte pour observer les logs `[claim]` et `[signup]`

---

## Scénario 1 — Visiteur non authentifié → signup → auto-claim

**Objectif** : un visiteur non connecté clique sur le bandeau et est redirigé vers signup avec auto-claim.

### Étapes

1. Déconnexion totale (ouvrir une fenêtre privée pour éviter toute session résiduelle).
2. Naviguer vers `doctor-profile.html?id=42` (ou tout `legacy_id` non revendiqué).
3. **Vérifier** : bandeau jaune visible en haut avec texte « Vous êtes ce médecin ? » et bouton **« Reclamer ma fiche »**.
4. Cliquer sur le bouton.
5. **Vérifier** : redirection vers `signup.html?role=medecin&claim_legacy_id=42`.
6. **Vérifier** : tile « Médecin » pré-sélectionnée + bandeau bleu d'info « Vous réclamez la fiche médecin #42 ».
7. Remplir le formulaire d'inscription complet (prénom, nom, email unique, mot de passe ≥ 8 char, wilaya, spécialité, N° Ordre, tous les consentements).
8. Soumettre.

### Résultat attendu

- Console : `[signup] auto-claim OK legacy_id=42`
- Modale « Bienvenue Dr ... » s'affiche (compte en attente de validation manuelle).
- En base : `public_doctors` ligne avec `legacy_id=42` est désormais `is_claimed=true` et `claimed_by_user_id=<id du nouveau médecin>`.
- `localStorage.tabibi_pending_claim_legacy_id` est **absent** (clean).

### Échec attendu (sous-cas)

- Si réseau HS au moment de l'auto-claim : `localStorage.tabibi_pending_claim_legacy_id=42` et console log `[signup] auto-claim failed: network_error -> stored for retry`. Le retry se fait au prochain login médecin via `window.tabibiClaim.consumePending()`.

---

## Scénario 2 — Médecin déjà authentifié → claim direct

**Objectif** : un médecin déjà connecté (compte actif validé) clique sur le bandeau d'une autre fiche et la réclame instantanément.

### Pré-requis spécifique

- Un compte médecin **actif** (`status='active'`) qui n'a **pas encore** réclamé de fiche
  (`claimed_legacy_id IS NULL` dans `public.users`).

### Étapes

1. Se connecter avec ce compte médecin via `login.html`.
2. Vérifier dans la console : `window.tabibi.supabase.auth.getSession()` retourne bien une session.
3. Naviguer vers `doctor-profile.html?id=42` (fiche non revendiquée).
4. **Vérifier** : bandeau visible + bouton **« Reclamer ma fiche »**.
5. Cliquer sur le bouton.

### Résultat attendu

- Toast info : « Réclamation en cours... »
- Toast success : « Fiche réclamée avec succès ! Redirection vers votre tableau de bord... »
- Redirection vers `doctor-dashboard.html` après 1.5s.
- En base : la fiche `legacy_id=42` est `is_claimed=true` + liée au compte médecin connecté.

---

## Scénario 3 — Patient authentifié → erreur claire

**Objectif** : un patient connecté ne doit pas pouvoir réclamer de fiche médecin.

### Étapes

1. Se connecter avec un compte **patient** existant.
2. Naviguer vers `doctor-profile.html?id=43` (autre fiche non revendiquée).
3. Cliquer sur le bouton **« Reclamer ma fiche »**.

### Résultat attendu

- Toast error : « Vous êtes connecté en tant que patient. Pour réclamer une fiche médecin, créez un compte médecin (déconnectez-vous d'abord). »
- **Aucune** modification en base.
- Aucun appel RPC (vérifier l'onglet Network DevTools : pas de POST `/rest/v1/rpc/claim_my_doctor_profile`).

---

## Scénario 4 — Fiche déjà réclamée → erreur explicite

**Objectif** : si deux médecins tentent de réclamer la même fiche, le second doit recevoir un message clair.

### Pré-requis

- Fiche `legacy_id=42` a été réclamée au Scénario 1 ou 2.
- Un **deuxième** compte médecin actif, qui n'a rien réclamé.

### Étapes

1. Se déconnecter, se reconnecter avec le deuxième compte médecin.
2. Naviguer vers `doctor-profile.html?id=42`.

### Résultat attendu

- **Aucun bandeau** ne s'affiche (car `_claimable=false` puisque `is_claimed=true`).
- La fiche montre les vraies infos du médecin qui a réclamé (nom complet, adresse si renseignée).

### Sous-cas : forcer le clic via URL directe

Si on force malgré tout `signup.html?role=medecin&claim_legacy_id=42` avec un nouveau compte :
- Auto-claim renvoie `error: 'profile_already_claimed'`.
- Console : `[signup] auto-claim failed: profile_already_claimed -> stored for retry at next login`.
- **Important** : `consumePending()` au prochain login détectera cet error code et **nettoiera** le storage (situation définitive, pas de retry boucle infinie).
- L'utilisateur garde un compte médecin valide mais sans fiche associée — il peut compléter sa fiche manuellement depuis `doctor-dashboard.html`.

---

## Codes d'erreur RPC à vérifier (référence)

| Code retourné par RPC          | Message FR affiché à l'utilisateur                                                                  |
|--------------------------------|------------------------------------------------------------------------------------------------------|
| `not_authenticated`            | Vous devez d'abord créer un compte médecin pour réclamer cette fiche.                               |
| `user_not_found`               | Compte introuvable. Reconnectez-vous puis réessayez.                                                |
| `not_a_doctor_account`         | Seul un compte médecin peut réclamer une fiche. Créez un compte avec le rôle « médecin ».           |
| `already_claimed_another_profile` | Vous avez déjà réclamé une autre fiche. Contactez le support si c'est une erreur.                |
| `profile_not_found`            | Fiche introuvable. Le lien est peut-être obsolète.                                                  |
| `profile_already_claimed`      | Cette fiche a déjà été réclamée par un autre médecin. Si c'est une erreur, écrivez à support@tabibi.doctor. |

---

## Checklist rapide avant prod

- [ ] Scénario 1 OK (signup + auto-claim)
- [ ] Scénario 2 OK (médecin déjà co → claim direct)
- [ ] Scénario 3 OK (patient bloqué proprement)
- [ ] Scénario 4 OK (fiche déjà réclamée → message clair)
- [ ] Vérifier qu'aucune fiche réclamée par erreur ne reste en base après tests (cleanup SQL si besoin)
- [ ] Vérifier que `js/tabibi-claim.js` est bien servi par Netlify (pas de 404 dans Network)
- [ ] Vérifier que la console est silencieuse (pas d'exception JS) sur les 4 scénarios

## Cleanup SQL (post-tests)

```sql
-- Annuler une réclamation faite par erreur durant les tests
update public.public_doctors_master
   set is_claimed = false,
       claimed_at = null,
       claimed_by_user_id = null
 where legacy_id in (42, 43);  -- adapter aux ids testés

update public.users
   set claimed_legacy_id = null
 where email like '%@example-test.tabibi%';  -- adapter au pattern de tes emails de test
```
