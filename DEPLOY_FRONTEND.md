# Runbook — Déploiement du site (Cloudflare Pages)

**Projet Cloudflare Pages** : `tabibi-doctor` · **Domaines servis** : `tabibi.doctor`,
`www.tabibi.doctor`, `tabibi-doctor.pages.dev`
**Compte Cloudflare** : `13fe89e298e7bd78eeaf3223cd6b5dd5`

> **Le projet n'a AUCUNE connexion Git.** Merger une PR sur `main` ne déploie rien.
> Chaque mise en production est un `wrangler pages deploy` lancé à la main.

---

## La procédure (2026-08-03)

```bash
cd ~/Desktop/tabibi-doctor
git checkout main && git pull origin main

# 1. Export propre : git archive n'exporte que le CONTENU VERSIONNÉ,
#    filtré par les règles export-ignore de .gitattributes (cf. plus bas)
rm -rf /tmp/tabibi-deploy && mkdir -p /tmp/tabibi-deploy
git archive main | tar -x -C /tmp/tabibi-deploy

# 2. Purge des dossiers non-web
cd /tmp/tabibi-deploy
rm -rf desktop supabase        # les seuls non-web encore présents dans l'archive
rm -f *.md capacitor.config.ts

# 3. Contrôle avant envoi : doit contenir _headers, _redirects, 404.html,
#    index.html, js, css, assets, blog, seo, legal
du -sh . && ls

# 4. Déploiement
cd ~/Desktop/tabibi-doctor
npx wrangler pages deploy /tmp/tabibi-deploy \
  --project-name=tabibi-doctor --branch=main --commit-dirty=true
```

> ⚠️ **Ne purge PAS `api/`.** Ce dossier est servi : `api-docs.html` lie
> `/api/openapi.yaml` et `/api/tabibi_api.postman_collection.json` (3 liens
> chacun). Les deux fichiers existent dans l'archive (24 Ko et 12 Ko) et
> répondent 200 en ligne. Les purger casse la page de doc API.

Attendre `Deployment complete!`, puis vérifier :

```bash
curl -s https://tabibi.doctor/sw.js | grep CACHE_VERSION
```

La version doit correspondre au `CACHE_VERSION` de `sw.js` sur `main`.

---

## Ce que `git archive` filtre déjà

Le mécanisme n'est pas le `.gitignore` mais les règles **`export-ignore`**
de `.gitattributes`, qui retirent de l'archive : `migrations/ fixtures/
scripts/ docs/ tests/ templates/ android/ ios/ .github/ *.md package.json
package-lock.json netlify.toml capacitor.config.ts .gitignore .gitattributes`.

Sur les onze dossiers que purgeait la version initiale de ce runbook,
**trois seulement** subsistent réellement dans l'archive :

| Cible | Dans `git archive main` |
|---|---|
| `desktop/` | ✅ 384 Ko — sources seules, les 1,4 Go de build sont gitignorés |
| `supabase/` | ✅ 72 Ko — à purger |
| `api/` | ✅ 44 Ko — **à conserver**, servi par `api-docs.html` |
| android, ios, migrations, tests, docs, .github, .claude, fixtures | déjà absents |
| `*.md`, `capacitor.config.ts` | déjà absents |

Conséquence : le plus gros fichier de l'archive pèse **356 Ko**
(`js/tabibi-i18n.js`). La limite Pages de 25 Mo n'est plus atteignable par
cette voie — c'était uniquement un problème de `deploy .`.

---

## Ne PAS faire : `wrangler pages deploy .`

C'était la méthode utilisée jusqu'au 03/08/2026. Elle échoue désormais :

```
ERROR  Pages only supports files up to 25 MiB in size
       desktop/src-tauri/target/release/deps/libtauri_utils-*.rlib is 31.6 MiB
```

Cause : `deploy .` envoie le **dossier de travail**, pas le contenu versionné.
Depuis le premier build Tauri local, `desktop/` pèse 1,4 Go. S'ajoutaient
`node_modules/` (270 Mo) et `android/` (141 Mo) — tous uploadés à chaque déploiement.

Deux conséquences, l'une bloquante, l'autre silencieuse :

1. **Échec** dès qu'un artefact dépasse 25 Mo.
2. **Fuite** : le code source était servi publiquement. Vérifié le 03/08 —
   `https://tabibi.doctor/supabase/functions/send-sms/index.ts` renvoyait **200**.
   Aucun secret en clair (ils viennent de `Deno.env`), mais l'intégration BudgetSMS,
   l'URL d'appel et les noms de variables étaient lisibles par n'importe qui.

> ⚠️ **NON RÉSOLU — considérer la fuite comme OUVERTE.**
> La purge a bien été appliquée au déploiement du 03/08, et le 404 a été
> constaté juste après. Mais à la re-vérification du 04/08, sur le même
> chemin `/supabase/functions/send-sms/index.ts` :
>
> ```
> tabibi-doctor.pages.dev  →  404
> tabibi.doctor            →  200   (contenu du fichier réellement servi)
> ```
>
> L'apex ne sert donc pas le même contenu que le sous-domaine Pages.
> Tant que cet écart n'est pas expliqué, la fuite doit être considérée
> comme ouverte : c'est `tabibi.doctor` que voient les visiteurs.
> Cf. « À investiguer » en fin de document.

`.assetsignore` **ne corrige pas** ce problème : `wrangler pages deploy` ne le lit pas.
C'est une fonctionnalité Workers Assets, pas Pages. Testé, sans effet.

---

## Authentification

```bash
npx wrangler whoami          # vérifier
npx wrangler login           # OAuth navigateur si besoin
```

Alternative sans OAuth : token depuis dash.cloudflare.com → My Profile → API Tokens →
template **Edit Cloudflare Workers**, puis `CLOUDFLARE_API_TOKEN=... npx wrangler ...`.

---

## Projets à ne pas confondre

| Projet | Rôle | État |
|---|---|---|
| Pages `tabibi-doctor` (sans Git) | **la prod** | actif, déploiement manuel |
| Pages `tabibi-doctor` (relié à GitHub) | vestige | build en échec, aucune route — à supprimer |
| Vercel `tabibi-doctor` et `tabibi-dz` | vestiges | produisent 2 checks rouges sur chaque PR — à supprimer |

---

## À investiguer

Les trois URLs du même projet Pages devraient servir le même déploiement.
Mesuré le 04/08/2026, elles divergent :

```
tabibi.doctor                     send-sms.ts 200  ·  openapi.yaml 404
6d8d1e0b.tabibi-doctor.pages.dev  send-sms.ts 200  ·  openapi.yaml 200
tabibi-doctor.pages.dev           send-sms.ts 404  ·  openapi.yaml 404
```

Trois contenus différents pour trois alias du même projet. Piste la plus
probable : du cache de bord non purgé. Aucune vérification faite au-delà de
ces mesures. C'est l'apex — celui que voient les visiteurs — qui sert le
fichier le plus sensible des trois, d'où l'encadré ⚠️ plus haut.

---

## Vérification post-déploiement

```bash
curl -s  https://tabibi.doctor/sw.js | grep CACHE_VERSION          # version attendue
curl -sI https://tabibi.doctor/js/tabibi-pixel.js | head -1        # 200
curl -sI https://tabibi.doctor/supabase/functions/send-sms/index.ts | head -1   # 404 attendu
curl -sI https://tabibi.doctor/ | grep -i content-security-policy  # Sentry + Facebook
```

Le Meta Pixel `1054246673971695` ne se charge que sur `index.html` et `signup.html`,
et uniquement après consentement marketing. Sur `doctor-profile.html` il ne doit
émettre **aucune** requête, même consentement accepté — l'URL y identifie un praticien.
