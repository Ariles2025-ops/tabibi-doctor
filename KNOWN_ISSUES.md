# KNOWN_ISSUES — Tabibi.doctor

## Turnstile — secret de l'edge function `verify-turnstile` (liste d'attente)
- **Depuis** : 2026-07-28 (changement de widget Cloudflare — le widget actif est
  `0x4AAAAAADR6IhCWO9RLIipE`, l'ancien `…-ME0-…` appartient à un compte inaccessible).
- **État** : le secret GoTrue (Supabase → Auth → Attack Protection → CAPTCHA) est à jour,
  mais l'edge function `verify-turnstile` (utilisée UNIQUEMENT par le formulaire
  liste d'attente, `waiting-list.html`) lit son propre secret
  `TURNSTILE_SECRET_KEY` dans les secrets Supabase (`supabase secrets set …`).
- **À faire (dashboard, par Aghiles)** : mettre à jour `TURNSTILE_SECRET_KEY` avec la
  Secret Key du widget `R6Ih…`. Tant que ce n'est pas fait, la soumission de la liste
  d'attente échoue en fail-closed ([CRIT-5]).
- **Vérif après correction** : soumettre le formulaire de waiting-list.html en prod →
  succès attendu.
