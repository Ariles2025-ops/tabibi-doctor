# supabase-js auto-hébergé

Fichier : `supabase-js-2.116.0.min.js`
Source  : https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js
Build   : `dist/umd/supabase.js` publié sur npm (pas la minification à la volée de jsdelivr)
SHA-256 : 84ee9bf45695c1dd3ba1595b6bcfb0f09672434631351ffc8ebe9140545d5ff6
Posé le : 2026-09-09

## Pourquoi ce fichier est ici et plus sur un CDN

Les 38 pages chargeaient `.../@supabase/supabase-js@2` — un tag **flottant**.
Trois problèmes, tous constatés le 09/09/2026 :

1. **La version changeait sans commit.** Le tag `@2` servait 2.116.0 en production,
   alors que `v2/package-lock.json` résolvait 2.115.0 et qu'une page épinglait encore
   2.39.0. Trois clients Supabase différents dans un même produit.
2. **Aucune intégrité vérifiable.** jsdelivr écrit lui-même en tête de ses fichiers
   auto-minifiés : « Do NOT use SRI with dynamically generated files ». Un SRI n'était
   donc pas posable sur l'URL utilisée.
3. **Point de défaillance unique, et il est hors d'Algérie.** L'app mobile Capacitor
   embarque `assets/` mais allait chercher ce script sur le réseau à chaque démarrage :
   jsdelivr injoignable = impossible de créer le client Supabase = application morte,
   même pour un écran déjà en cache.

Le projet auto-héberge déjà Leaflet (`assets/vendor/leaflet/`). Même traitement ici.

## Mettre à jour

1. Télécharger le dist officiel de la version voulue :
   `curl -sL -o assets/vendor/supabase/supabase-js-<VER>.min.js \
      https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<VER>/dist/umd/supabase.js`
2. Vérifier que le global est exposé : `window.supabase.createClient` doit être une fonction.
3. Remplacer la référence dans les pages (le nom de fichier porte la version : le cache
   se casse tout seul, aucun purge à faire).
4. Supprimer l'ancien fichier et mettre à jour ce README.

⚠️ Ne jamais revenir à un tag flottant. La version doit être lisible dans un `git diff`.
