# Runbook — Déploiement du site (Cloudflare Pages)

**Projet Cloudflare Pages** : `tabibi-doctor` · **Domaines servis** : `tabibi.doctor`,
`www.tabibi.doctor`, `tabibi-doctor.pages.dev`
**Compte Cloudflare** : `13fe89e298e7bd78eeaf3223cd6b5dd5`

> **Le projet n'a AUCUNE connexion Git.** Merger une PR sur `main` ne déploie rien.
> Chaque mise en production est un `wrangler pages deploy` lancé à la main.

> **Le projet est en mode Functions + assets** depuis le 04/08/2026. Le dossier
> `functions/` est compilé en un Worker qui s'exécute **avant** le service des
> assets statiques. Voir « Les trois barrières » plus bas.

---


> **[09/09/2026] Deux chemins de déploiement coexistent désormais.**
> - *Manuel (celui-ci)* : `git archive` → purge → `wrangler pages deploy`. Il sert les **sources**
>   telles quelles : l'accueil y charge ses scripts un par un (aucun bundle).
> - *Automatique (préparé)* : `.github/workflows/deploiement.yml` construit `dist-web` avec Vite,
>   rejoue les 30 tests Playwright dessus et déploie. Inactif tant que `DEPLOIEMENT_AUTO=oui` et
>   les secrets Cloudflare ne sont pas posés. Pour le reproduire à la main :
>   `npm run build && npm run test:e2e:build && npx wrangler pages deploy dist-web --project-name=tabibi-doctor --branch=main`.
> Depuis ce jour, `v2/`, `src/` et les configurations d'outillage sont en `export-ignore` :
> ils ne partent dans aucun des deux chemins.

## La procédure (à jour 2026-08-04)

```bash
cd ~/Desktop/tabibi-doctor
git checkout main && git pull origin main

# 1. Export propre : git archive n'exporte que le CONTENU VERSIONNÉ,
#    filtré par les règles export-ignore de .gitattributes (cf. plus bas)
rm -rf /tmp/tabibi-deploy && mkdir -p /tmp/tabibi-deploy
git archive main | tar -x -C /tmp/tabibi-deploy

# 2. Purge des dossiers non-web — CHEMINS ANCRÉS OBLIGATOIRES
cd /tmp/tabibi-deploy
rm -rf ./desktop ./supabase     # le ./ protège functions/supabase et functions/desktop

# 3. Contrôle avant envoi
ls functions/seo functions/supabase functions/migrations functions/desktop  # les 4
ls api/openapi.yaml api/tabibi_api.postman_collection.json     # doivent exister
ls -d supabase desktop 2>/dev/null                             # doit ne rien renvoyer
du -sh . && ls   # attendu : ~12 Mo, ~740 fichiers, _headers _redirects 404.html
                 # index.html js css assets blog seo legal functions

# 3 bis. SUPPRESSIONS PUBLIQUES — bloquant tant que non justifié
cd ~/Desktop/tabibi-doctor
./scripts/check-deleted-public-files.sh main
# sortie 0 = rien à signaler · sortie 2 = suppressions à justifier (voir plus bas)

# 4. Déploiement
npx wrangler pages deploy /tmp/tabibi-deploy \
  --project-name=tabibi-doctor --branch=main --commit-dirty=true
```

Attendre `Compiled Worker successfully` + `Uploading Functions bundle` +
`Deployment complete!`.

> ⚠️ **`rm -rf desktop supabase` sans `./` est un piège.** Lancé depuis un
> autre répertoire, ou avec un glob, il peut emporter `functions/supabase/`
> et `functions/desktop/` — le correctif partirait alors vide, sans erreur
> visible. Toujours ancrer, toujours vérifier à l'étape 3.

> ⚠️ **Ne purge PAS `api/`.** Ce dossier est servi : `api-docs.html` lie
> `/api/openapi.yaml` et `/api/tabibi_api.postman_collection.json` (3 liens
> chacun). Les purger casse la page de doc API. Erreur commise le 03/08,
> corrigée le 04/08.

> ℹ️ **`Compiled Worker successfully` ne compte pas les Functions.** wrangler
> compile tout `functions/` en un seul Worker : la sortie est identique avec
> 2 ou 3 Functions. Seul le `ls` de l'étape 3 fait foi.

> ⚠️ **Ne JAMAIS vérifier la version du service worker avec `head`.**
> `sw.js` a longtemps porté DEUX numéros : un commentaire d'en-tête figé à
> « v18 » depuis la phase 5.2.3, et la constante `CACHE_VERSION`, seule à faire
> foi. Le 2026-08-06, `curl … /sw.js | head -3` a renvoyé « v18 » sur un
> déploiement parfaitement à jour en v37 et a fait conclure à un échec de mise
> en ligne — diagnostic complet, liste des déploiements, vérification du
> domaine custom, tout ça pour un commentaire périmé. L'en-tête ne contient
> plus aucun numéro depuis (PR #48).
> ```bash
> curl -s https://tabibi.doctor/sw.js | grep CACHE_VERSION   # ✅
> curl -s https://tabibi.doctor/sw.js | head -3              # ❌ ment
> ```
>
> **Contrôle croisé imparable** si un doute persiste sur ce que sert vraiment
> le domaine : comparer l'`etag` de l'apex à celui du déploiement fraîchement
> créé. Identiques = c'est bien ce déploiement qui est servi. Cela tranche sans
> dépendre du contenu du fichier.
> ```bash
> curl -sI https://tabibi.doctor/sw.js                  | grep -i etag
> curl -sI https://<hash>.tabibi-doctor.pages.dev/sw.js | grep -i etag
> ```

> ℹ️ **`--branch=main` envoie bien en Production.** La branche de production du
> projet est `main` ; un `--branch` différent créerait un déploiement *Preview*,
> que le domaine custom ne sert pas. Vérifié le 2026-08-06 — les quatre
> derniers déploiements affichent `Environment: Production`. Pour lever un
> doute sur l'environnement :
> ```bash
> npx wrangler pages deployment list --project-name=tabibi-doctor | head -8
> ```

---

## Étape 3 bis — suppressions publiques : remplacer, jamais supprimer

> ⛔ **Supprimer une page publique ne la retire pas du web.**
> La couche d'assets de Cloudflare Pages continue de la servir sur son URL
> exacte, sans query string, pendant **`s-maxage` = 7 jours**, immunisée
> contre `Purge Everything`. Mécanisme établi le 06/08/2026 — section
> « Résolu » plus bas.

**La règle :**

| | |
|---|---|
| ✅ **Remplacer** le fichier par un contenu vide ou neutre, **même nom** | l'asset existe, il est écrasé, la nouvelle version est servie immédiatement |
| ❌ **Supprimer** le fichier | l'ancien contenu survit jusqu'à 7 jours, sans recours |

Quand la page contient des **données personnelles**, l'écart n'est pas
théorique : la Phase 10.1 a supprimé 454 pages publiques, dont **266
portaient des patronymes réels**, et a levé dans le même déploiement le
`Disallow: /seo/` qui les masquait. Résultat : des pages nominatives
servies *et* indexables. Il a fallu poser `functions/seo/[[path]].js` en
filtre de sortie pour fermer la brèche.

**Le contrôle :**

```bash
./scripts/check-deleted-public-files.sh main
```

Il lit le SHA du dernier déploiement *Production* via
`wrangler pages deployment list`, fait un `git diff --diff-filter=D` entre
ce SHA et la référence à déployer sur `blog/ legal/ seo/ api/ assets/ js/
styles/ *.html`, puis inspecte le **contenu d'origine** de chaque fichier
supprimé — c'est le contenu qui restera servi, pas le nom.

Sortie `0` : rien à signaler. Sortie `2` : suppressions à justifier, une par
une, avant d'envoyer :

1. **L'URL doit-elle disparaître, ou est-ce un renommage ?**
   Renommage → garder l'ancien nom avec une redirection, ou écraser
   l'ancien fichier par un contenu neutre.
2. **Le contenu supprimé porte-t-il des données personnelles ?**
   Oui → ne pas se contenter de supprimer. Écraser par un contenu vide de
   même nom, déployer, **puis** supprimer au déploiement suivant. Ou poser
   un filtre de sortie en Pages Function, comme `functions/seo/[[path]].js`.
3. **Après déploiement, vérifier en GET *et* en HEAD.**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://tabibi.doctor/<chemin>
   curl -sI https://tabibi.doctor/<chemin> | head -1
   ```
   Les deux doivent renvoyer 404. Un HEAD à 200 avec un GET à 404 est le
   symptôme exact rencontré le 06/08 : un filtre qui inspecte le corps est
   aveugle sur un HEAD, qui n'en a pas.

> ℹ️ Le script n'interrompt rien de lui-même : il refuse de décider à la
> place de l'opérateur. C'est délibéré — un renommage de page marketing et
> la suppression de 266 fiches nominatives sortent tous deux en « suppression
> publique », et seul un humain sait les distinguer.

---

## Les trois barrières

Trois chemins ne doivent jamais être servis : `/supabase/*`, `/migrations/*`,
`/desktop/*`. Chacun est couvert par trois mécanismes indépendants, dans cet
ordre d'exécution :

| # | Barrière | Où | Ce qu'elle ne couvre pas |
|---|---|---|---|
| 1 | Pages Function `onRequest()` → 404 | `functions/<nom>/[[path]].js` | rien — s'exécute avant tout service d'asset |
| 2 | Règle de routage | `_redirects` | **court-circuitée si un asset existe sur le chemin** |
| 3 | Absence du fichier | purge à l'étape 2 | dépend de l'opérateur et de la propagation |

**La barrière 2 a été prise en défaut le 04/08.** Sur l'apex, au même instant,
avec le même `_redirects` : `/migrations/x.sql` → 404 (la règle s'applique)
mais `/supabase/functions/send-sms/index.ts` → 200 (l'asset gagne). Dans
Cloudflare Pages, un asset statique existant a **priorité** sur `_redirects` ;
la règle n'est évaluée que si aucun fichier ne répond.

C'est la barrière 1 qui a fermé la fuite. Un `onRequest()` qui renvoie 404 sans
condition ne peut pas être court-circuité par un objet résiduel, quelle qu'en
soit l'origine.

---

## Ce que `git archive` filtre déjà

Le mécanisme n'est pas le `.gitignore` mais les règles **`export-ignore`**
de `.gitattributes`.

> ⚠️ **Un motif sans `/` initial se comporte comme en `.gitignore` : il matche
> à n'importe quelle profondeur.** `migrations/ export-ignore` élaguait aussi
> `functions/migrations/`, et cette Pages Function n'est jamais partie en
> production pendant deux déploiements — sans erreur, sans trace. Corrigé le
> 04/08 en `/migrations/ export-ignore` (PR #30). Les 15 autres motifs ont été
> vérifiés : aucune autre collision avec `functions/`.

> ⚠️ **Pour tester une modification de `.gitattributes` avant de committer**,
> il faut `git archive HEAD --worktree-attributes`. Sans ce flag, `git archive`
> lit le `.gitattributes` de l'arbre **commité** — la sortie « avant » et
> « après » est identique et la preuve ne vaut rien.

Sur les onze dossiers que purgeait la version initiale de ce runbook,
**trois seulement** subsistent réellement dans l'archive :

| Cible | Dans `git archive main` |
|---|---|
| `desktop/` | ✅ 384 Ko — sources seules, les 1,4 Go de build sont gitignorés — **à purger** |
| `supabase/` | ✅ 96 Ko — **à purger** |
| `api/` | ✅ 44 Ko — **à conserver**, servi par `api-docs.html` |
| `functions/` | ✅ 3 Functions — **à conserver impérativement** |
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
`node_modules/` (270 Mo) et `android/` (141 Mo) — tous uploadés à chaque
déploiement.

Deux conséquences, l'une bloquante, l'autre silencieuse :

1. **Échec** dès qu'un artefact dépasse 25 Mo.
2. **Fuite** : le code source était servi publiquement. Le 03/08,
   `https://tabibi.doctor/supabase/functions/send-sms/index.ts` renvoyait
   **200**. Aucun secret en clair (ils viennent de `Deno.env`), mais
   l'intégration BudgetSMS, l'URL d'appel et les noms de variables étaient
   lisibles par n'importe qui.

> ✅ **FERMÉE le 04/08/2026.** Vérifié sur les trois hôtes après le
> déploiement `7f8bc1a6` :
>
> ```
> tabibi.doctor            send-sms=404  migrations=404  desktop=404
> www.tabibi.doctor        send-sms=404  migrations=404  desktop=404
> tabibi-doctor.pages.dev  send-sms=404  migrations=404  desktop=404
> ```
>
> Fermée par la barrière 1 (Pages Functions). La purge au build et
> `_redirects` n'avaient pas suffi sur l'apex — voir « À investiguer ».

`.assetsignore` **ne corrige pas** ce problème : `wrangler pages deploy` ne le
lit pas (fonctionnalité Workers Assets, pas Pages). Testé le 03/08 puis écarté
du repo — le fichier n'existe plus (déplacé dans `_to_delete/` sous le nom
`assetsignore-inutile-pages`), l'affirmation n'est pas rejouable en l'état.

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

## Résolu le 06/08/2026 — la couche d'assets sert les fichiers supprimés

> **Le mécanisme derrière l'anomalie `DYNAMIC` + `age` est identifié.**
> Ce qui suit décrit d'abord les observations de début août, restées
> inexpliquées deux mois, puis l'explication trouvée en régénérant les pages
> SEO. Garder les deux : c'est la trace d'observations qui semblaient
> contradictoires et ne l'étaient pas.

### L'explication

> **La couche d'assets de Cloudflare Pages continue de servir un fichier
> SUPPRIMÉ du déploiement, pour l'URL exacte SANS query string — et cette
> copie reste atteignable DEPUIS L'INTÉRIEUR d'une Pages Function, via
> `context.next()`.**

Ce n'est donc ni le cache de zone, ni un Worker, ni le service worker — les
trois pistes éliminées à l'époque, à juste titre.

**Preuve décisive**, mesurée sur l'apex après la suppression des 490 anciennes
pages SEO :

| URL | Taille du 404 | Ce que ça signifie |
|---|---|---|
| `/seo/ceci-nexiste-pas` | **7 352 o** | page 404 de Tabibi → 404 authentique de Pages |
| `/seo/alger-cardiologie` | **9 o** | `Not Found` → réponse de **notre propre filtre** |

Le second chemin n'a jamais atteint le 404 de Pages : `context.next()` a
remis à la Function l'**ancienne page nominative**, que le filtre de
`functions/seo/[[path]].js` a interceptée. Sans ce filtre, elle aurait été
servie telle quelle, avec ses 891 patronymes.

### Ce que ça explique, point par point

| Observation d'août | Explication |
|---|---|
| Purge Everything et purge ciblée sans effet | l'objet ne réside pas dans le cache que le dashboard purge |
| 200 sans query string, 404 avec — six fois | la query string fait manquer l'entrée périmée de la couche d'assets |
| `www` et `pages.dev` en 404, apex en 200 | les entrées sont par hostname ; seules celles de l'apex étaient périmées |
| `cf-cache-status: DYNAMIC` avec un `age` croissant | l'`age` vient de l'amont, pas du cache Cloudflare — d'où la contradiction apparente |
| `cache-control: public, s-maxage=604800` alors qu'aucune config ne l'émet | en-tête gravé dans l'objet périmé, hérité d'un hébergeur antérieur — 7 jours |
| la barrière Function a « réglé » `/supabase/` | `functions/supabase/[[path]].js` est un **404 sec qui n'appelle jamais `context.next()`**. Elle n'a pas contourné le mécanisme : elle a évité de le solliciter. |

### ⚠️ La règle opérationnelle qui en découle

> **Ne jamais supprimer un fichier public contenant des données personnelles
> en comptant sur le déploiement pour le faire disparaître.**
> Le **remplacer** par un contenu vide de même nom est sûr — l'asset existe,
> il est écrasé. Le **supprimer** ne l'est pas : l'ancien contenu reste servi
> jusqu'à 7 jours, immunisé contre la purge.

Seul `/seo/` est protégé par un filtre. **`/blog/`, `/legal/` et la racine ne
le sont pas.** Une suppression de fichier sensible à ces emplacements exige
soit un écrasement par un contenu vide, soit une Function de filtrage
équivalente.

### Comment vérifier que la couche d'assets a fini par lâcher

Le jour où les deux formes ci-dessous renvoient toutes deux le 404 de
**7 352 octets** (et non le `Not Found` de 9 octets émis par notre filtre),
la copie périmée aura disparu et `functions/seo/[[path]].js` pourra être
retirée :

```bash
curl -s https://tabibi.doctor/seo/alger-cardiologie      | wc -c
curl -s "https://tabibi.doctor/seo/alger-cardiologie?x=1" | wc -c
```

---

## Les observations d'origine — août 2026

Entre le 03 et le 04/08, l'apex `tabibi.doctor` a servi
`/supabase/functions/send-sms/index.ts` en **200** alors que le fichier était
absent du bundle déployé, que `www` et `pages.dev` renvoyaient **404** sur le
même chemin, et que `sw.js` était à jour (`v35`) sur les trois hôtes.

En-têtes de cette réponse 200 :

```
cf-cache-status: DYNAMIC        ← Cloudflare déclare ne pas servir depuis son cache
age: 10050                      ← 2 h 47 de rétention : contradictoire
cache-control: public, s-maxage=604800
```

Éliminé par la mesure : cache de zone (Purge Everything **et** purge ciblée par
URL, tous deux sans effet), service worker (absent des deux caches, et le
comportement se reproduisait depuis une origine neutre), Cache Rules (une seule,
sur `.js`), Workers Routes (aucune), DNS (CNAME correct, proxied), custom
domains (les deux Active).

Comportement annexe observé : la même URL **sans** query string renvoyait 200,
**avec** n'importe quelle query string renvoyait 404. Reproductible six fois.

Depuis le déploiement des Pages Functions (04/08), ce comportement n'est plus
observable — les deux formes renvoient 404. L'anomalie est masquée, pas résolue.

~~Le mécanisme n'a pas été identifié.~~ **Il l'est depuis le 06/08/2026 — voir
la section précédente.** Les quatre pistes éliminées ci-dessus l'étaient à
juste titre : la copie ne venait d'aucune d'elles, mais de la couche d'assets
de Pages elle-même. Le comportement au query string, noté ici comme
« annexe », en était le symptôme le plus révélateur.

---

## Vérification post-déploiement

```bash
# Les 3 hôtes, les 5 colonnes
for h in tabibi.doctor www.tabibi.doctor tabibi-doctor.pages.dev; do
  printf "%s send-sms=%s openapi=%s migrations=%s desktop=%s sw=%s\n" "$h" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://$h/supabase/functions/send-sms/index.ts)" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://$h/api/openapi.yaml)" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://$h/migrations/x.sql)" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://$h/desktop/x.js)" \
    "$(curl -s https://$h/sw.js | grep -o 'tabibi-v[0-9]*-[0-9-]*')"
done
# Attendu sur les 3 lignes :
#   send-sms=404  openapi=200  migrations=404  desktop=404  sw=<version de main>

# Non-régression — utiliser les clean URLs, sinon Pages renvoie 308
for p in / /blog/ /js/tabibi-pixel.js /signup /api-docs /dawini \
         /legal/cookies /seo/alger-cardiologue; do
  printf "%s=%s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://tabibi.doctor$p)"
done
# Attendu : 200 partout
# ⚠️ /seo/alger-cardiologIE (ancien slug) n'existe plus depuis la Phase 10.1 :
# la base dit « cardiologue », pas « cardiologie ». Attendu 404, en GET ET en
# HEAD. S'il repasse à 200, la barrière functions/seo/ est tombée.

# Non-régression des pages SEO — GET et HEAD doivent concorder
for p in /seo/alger-cardiologue /seo/oran-medecin-generaliste; do
  printf "%s GET=%s HEAD=%s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://tabibi.doctor$p)" \
    "$(curl -sI https://tabibi.doctor$p | head -1 | tr -d '\r' | awk '{print $2}')"
done
# Attendu : GET=200 HEAD=200

curl -sI https://tabibi.doctor/ | grep -i content-security-policy   # Sentry + Facebook
```

Le Meta Pixel `1054246673971695` ne se charge que sur `index.html` et `signup.html`,
et uniquement après consentement marketing. Sur `doctor-profile.html` il ne doit
émettre **aucune** requête, même consentement accepté — l'URL y identifie un praticien.
