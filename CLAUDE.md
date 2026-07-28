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

## Comment rapporter
- Style : concis, factuel, en actions/tableaux. Pas de flatterie, pas de pavé.
- Après chaque tâche : donne les **preuves** (diff, scores avant/après, SHA de commit, réponse API), l'**URL de PR**, et ce qui reste à décider.
- Signale tout risque de casser la prod **avant** d'agir.
