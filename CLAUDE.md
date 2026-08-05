# CLAUDE.md — Règles projet Tabibi.doctor

Ce fichier est lu automatiquement par Claude Code à chaque session. Respecte-le en toutes circonstances.

## Contexte
- **Tabibi.doctor** : plateforme de prise de RDV médical en Algérie. Phase **pré-launch** (lancement congrès médical 3-5 déc 2026).
- **Stack** : site statique HTML/CSS/JS vanilla (~38 pages app + 490 pages SEO) · backend **Supabase EU (Frankfurt)**, projet `pudugodhiofqrctcdwfl` · hébergement **Netlify (primaire) + Vercel**. Ce n'est PAS un projet Cloudflare Workers.
- **Prod** : https://tabibi.doctor (DNS pas encore pointé) · **staging** : https://effulgent-kelpie-e48e81.netlify.app

## Règles absolues (non négociables)
1. **Ne jamais commit/push directement sur `main`.** `main` est protégé (ruleset `protect-main` : force push et suppression bloqués). Toujours créer une branche + ouvrir une PR.
2. **Ne jamais merger en prod sans validation humaine explicite.** Tu prépares, l'humain approuve.
3. **Toute action destructive sur la base (DELETE, DROP, REVOKE, UPDATE massif) → STOP et demande confirmation avant.** Ajoute toujours un garde-fou (WHERE ciblé + RETURNING) et propose-la, ne l'exécute pas seul.
4. **Ne jamais logguer, écrire sur disque, ni committer un secret** (service_role key, access token, secret Turnstile). Variables d'environnement uniquement, jamais dans un fichier.
5. **Ne rien valider sans preuve empirique** : sortie DB réelle, réponse HTTP, run navigateur, scores mesurés. Jamais "ça devrait marcher".

## Sécurité — état à jour (NE PAS refaire)
Ces points sont **déjà réglés et prouvés** (session du 26 juil 2026). Ne les re-propose pas :
- **CRIT-4** : `doctor_profiles` verrouillé — `REVOKE SELECT FROM anon` appliqué. Les listings publics passent par la vue `public_doctors`. La table `doctor_profiles_backup_*` a été supprimée (DROP).
- **CRIT-5** : captcha Turnstile enforced côté serveur + confirmation email active. Nouvelle site key dans `js/config.js` : `0x4AAAAAADR6IhCWO9RLIipE`.
- **CRIT-1** : isolation RLS cross-user prouvée (aucune fuite). Les 94 policies scopent par `auth.uid()`.
- **Hardening** : leaked passwords (HIBP) ON, longueur mini 8, comptes anonymes OFF, branche `main` protégée.
- Intégration GitHub App "Cloudflare Workers and Pages" désinstallée (les ❌ Workers passés étaient parasites).

## Front / design
- **Ne pas toucher** au layout, aux features, ni à la logique Supabase lors de tâches de "quick wins" ou d'optimisation.
- **Couleurs de marque à préserver** : or `#d4a437` (accent principal), gris neutre foncé `#556070` (texte). Ne les modifie pas sans demande explicite.
- Accessibilité cible : niveau AA. Performance : viser Lighthouse ≥ 85 sans sacrifier le rendu.

## Base de données
- Ne jamais modifier une policy RLS ni une permission sans expliquer l'impact et demander validation. La RLS actuelle est saine.
- Note fonctionnelle à surveiller (pas urgent) : `prescriptions` et `doctor_schedule` comparent `doctor_id = auth.uid()` (user id), alors que les autres tables utilisent `doctor_profiles.id`. À vérifier au 1er onboarding médecin réel.

## Exclusions grep de dates
Lors d'un changement de date de lancement, un `grep` sur un nom de mois remonte
ces lignes. Elles sont **légitimes et ne doivent JAMAIS être modifiées** — ce
sont des noms de mois, pas des dates de lancement :

| Emplacement | Quoi | Pourquoi y toucher casserait quelque chose |
|---|---|---|
| `reservation.html:276` | `_AR_MONTHS` — table des 12 mois en arabe | Utilisée l.305 et l.353 pour les libellés du calendrier. Remplacer `سبتمبر` afficherait un mauvais mois sur tout RDV de septembre. |
| `reservation.html:351` | commentaire sur un bug de grille de calendrier | Le mois cité est un exemple illustrant le bug, pas une date produit. |
| `js/tabibi-i18n.js` | clés `month_*` (`month_september`, `month_sep`…) fr/ar/en | Dictionnaires de noms de mois du sélecteur de dates. |

Tout autre résultat est une vraie date de lancement à aligner.
Grep de contrôle (sans année, sinon les mentions sans millésime passent
inaperçues — cas rencontré le 04/08/2026, 6 occurrences ratées) :
```bash
git grep -niE "(septembre|september|سبتمبر|juin|june)" -- . \
  ':!desktop' ':!android' ':!www' ':!dist' ':!tests' ':!node_modules'
```
`www/` et `dist/` sont des sorties de build **non versionnées** : inutile de les
éditer, elles sont régénérées par `scripts/build-mobile.sh` et `git archive`.

## Comment rapporter
- Style : concis, factuel, en actions/tableaux. Pas de flatterie, pas de pavé.
- Après chaque tâche : donne les **preuves** (diff, scores avant/après, SHA de commit, réponse API), l'**URL de PR**, et ce qui reste à décider.
- Signale tout risque de casser la prod **avant** d'agir.
