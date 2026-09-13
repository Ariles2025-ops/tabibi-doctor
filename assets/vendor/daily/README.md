# Daily.co JS SDK — vendorisé

Fichier  : `daily-iframe-0.92.2.js`
Source   : https://unpkg.com/@daily-co/daily-js@0.92.2/dist/daily-iframe.js
Build    : `dist/daily-iframe.js` publié sur npm
sha256   : voir `git log` du commit d'ajout — le fichier est versionné, c'est git qui fait foi.

## Pourquoi vendorisé, et pas chargé depuis un CDN

1. **La version précédemment référencée n'a jamais existé.** `teleconsultation.html` pointait sur
   `@daily-co/daily-js@0.66.1`, qui rend **404** : `Package version not found`. Le registre npm compte
   175 versions publiées et la branche 0.66 s'arrête à **0.66.0**. `0.66.1` n'apparaît pas même dans
   l'historique des dates de publication : ce n'est pas une dépublication, c'est un numéro qui n'a
   jamais été publié. **Le SDK n'a donc jamais chargé, depuis le premier jour.**

2. **Aucune intégrité posable de façon fiable** sur un CDN qui reminifie à la volée — même raisonnement
   que pour `assets/vendor/supabase/`.

3. **Un CDN injoignable = fonctionnalité morte.** Servi par `'self'`, le fichier suit le sort du site.

4. **Cela vide `script-src` de tout CDN de script.** `unpkg.com` était le dernier. Un `script-src` sans
   origine tierce est une surface d'attaque en moins.

Servi par `'self'`, il n'y a plus de SRI à poser : l'intégrité est celle du dépôt et du déploiement.

## Mise à jour

```bash
curl -L "https://unpkg.com/@daily-co/daily-js@<VER>/dist/daily-iframe.js" \
  -o assets/vendor/daily/daily-iframe-<VER>.js
```
Puis mettre à jour le `src` dans `teleconsultation.html` et retirer l'ancien fichier.
