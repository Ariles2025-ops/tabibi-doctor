# Mesure — « forgot-password promet un e-mail qui ne part jamais » (12/09/2026)

Parcours « Mot de passe oublié » déclenché tel quel, sans rien réparer. Trois passages, code HTTP et corps bruts relevés
sur la requête `POST /auth/v1/recover` (capture `fetch` posée dans la page, jeton captcha masqué).

## 1. Un numéro de téléphone dans le champ (localhost:8080, build de la branche fix/medecin-1-faux-succes)

- Saisie : `+213555000199` (numéro de test, inexistant).
- Résultat : le contrôle local `forgot-password.html:97` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) refuse → bandeau rouge **« Email invalide. »**
- Code HTTP : **aucun** — aucune requête ne part. Un médecin inscrit par téléphone (27/28 le sont) n'a rien à saisir ici.

## 2. Un e-mail inexistant, depuis le navigateur intégré (production https://tabibi.doctor/forgot-password)

- Saisie : `test-congres-20260910.inexistant@tabibi.doctor`.
- Requête : `{"email":"…inexistant@tabibi.doctor","gotrue_meta_security":{"captcha_token":null}}` (Turnstile : `__ttErr = "timeout-5s"`).
- Réponse : **HTTP 400** — corps brut : `{"code":"captcha_failed","message":"captcha protection: request disallowed (no captcha_token found)"}`
- Écran : bandeau vert **« Si un compte existe avec cet email, vous recevrez un lien dans quelques minutes. Pensez à vérifier vos spams. »**
- Console : `[forgot] reset error … status: 400, code: captcha_failed` (avalé par `forgot-password.html:126`, message de succès affiché quand même).

## 3. Le même e-mail inexistant, depuis Chrome (production, jeton captcha obtenu)

- Requête : `{"email":"…inexistant@tabibi.doctor","gotrue_meta_security":{"captcha_token":"<présent>"}}`
- Réponse : **HTTP 200** — corps brut : `{}`
- Écran : le même bandeau vert.

## Ce que ça prouve

- L'écran affiche la même promesse quel que soit le résultat, y compris sur une erreur 400 (`forgot-password.html:121-131`, « on affiche TOUJOURS le même message »).
- GoTrue répond 200 `{}` pour un e-mail inconnu (anti-énumération) : aucun e-mail ne part, et rien ne le dit.
- Pour le compte réel d'Aghiles (`e3b9ba42…`, téléphone seul, `email = null`), ce parcours est sans issue : le champ n'accepte pas de numéro et aucune adresse n'existe côté GoTrue.
- Le captcha Turnstile ne rend pas de jeton dans le navigateur intégré de l'app (`timeout-5s`) ; dans Chrome, il en rend un sur production comme sur `localhost:8080` (vérifié sur login.html le 12/09).

Relié : fiche §9.1, correctif 1 ter ; carte Trello « forgot-password promet un e-mail qui ne part jamais ».
