# Audit en profondeur — 9 septembre 2026 (second passage)

> Le premier audit (`AUDIT_ET_MIGRATION_2026-09-09.md`) lisait le code. Celui-ci ouvre ce qui
> n'avait pas été ouvert : l'historique git, les dépendances, les flux d'authentification et de
> réservation, les edge functions, les manifestes natifs, l'APK réellement distribué, la
> production réelle, et ce que le déploiement publie vraiment. Chaque constat est adossé à une
> commande. Trois conclusions du matin sont **corrigées** en partie B — c'est le prix d'avoir
> cherché mieux.

---

## A — Découvertes nouvelles

Classées par ce qu'elles coûtent, pas par ce qu'elles impressionnent.

### 🔴 A1. L'API partenaires n'a aucune surface HTTP

`api/openapi.yaml` déclare `servers: https://tabibi.doctor/api/v1`. Il existe une console
d'administration des clés (`admin-api-keys.html`), 7 fonctions SQL (`generate_api_key_pair`,
`verify_api_key`, `check_api_rate_limit`, `log_api_call`…), une table `api_usage_log` **partitionnée
par jour**, une collection Postman.

```
GET https://tabibi.doctor/api/v1/doctors   → 404
GET https://tabibi.doctor/api/v1/          → 404
```

Aucune edge function, aucune Pages Function, aucune règle `_redirects` ne route `/api/v1`. Le
service worker **contourne** même `/api/` (`sw.js:94`) — comme si l'API existait. C'est une
fonctionnalité complète côté base et côté documentation, **sans aucun point d'entrée**.

Indice supplémentaire : les partitions `api_usage_log_2026MMDD` vont du **18 mai au 2 juin**, puis
s'arrêtent. Le job `api_usage_log_ensure_partition` est mort il y a trois mois. Si l'API était
branchée demain, chaque insertion échouerait faute de partition du jour.

**Décision à prendre** : soit servir l'API (une edge function `api-v1` + routage), soit retirer
`api-docs.html`, l'OpenAPI et la console de clés du produit. Un partenaire qui lit la doc
aujourd'hui obtient un 404.

### 🔴 A2. La page de téléchargement ment sur la version

`telecharger.html` affiche « Version 1.0.2 (build 4) ». L'APK **réellement servi** depuis le bucket
Supabase, téléchargé et inspecté :

```
versionCode='3'  versionName='1.0.1'    (9 168 570 octets)
local dans android/app/build/outputs :  versionCode 4, 1.0.2  (9 110 900 octets)
```

Le build du 31/08 n'a **jamais été mis en ligne**. Deux binaires différents, deux versions,
une page qui annonce celle que personne ne peut télécharger. Bonne nouvelle vérifiée à
l'`apksigner` : **les deux sont signés par la clé officielle** (`b6df5822…`).

### 🔴 A3. Le tableau de bord patient promet cinq moyens de paiement qui n'existent pas

`patient-dashboard.html:600` affiche **Espèces · Edahabia · Carte CIB · Paymee · CNAS/CASNOS**.
Le flag `payments` vaut `false`, mais **aucun élément de cette page n'est gaté** par
`data-feature="payments"` (seule `payment.html`, orpheline, l'est). Un patient voit « Paiement
sécurisé » sur une plateforme où aucun paiement n'est possible. Sur un produit de santé, une
promesse d'interface non tenue est un sujet de confiance, pas de finition.

### 🟠 A4. Les données personnelles de session sont extractibles

Trois faits qui se combinent :

1. `localStorage['tabibi_user']` contient `id`, `email`, `role` et les champs d'identité, **en clair**,
   et il est écrit par **trois fichiers différents** (`auth.js:131`, `home-app.js:397`,
   `tabibi-avatar.js:140`) — trois écrivains d'un même cache finissent par diverger.
2. `AndroidManifest.xml:4` : **`android:allowBackup="true"`**. Sur un appareil déverrouillé,
   `adb backup` exporte l'intégralité du stockage de l'app — jeton de session Supabase compris.
   Aucun `backup_rules.xml`, aucun `dataExtractionRules`.
3. Sur natif, le jeton Supabase reste dans le `localStorage` de la WebView
   (`capacitor-bridge.js:260` le dit lui-même : « Supabase JS SDK gère déjà sa session via
   localStorage »). Le wrapper `Preferences` existe mais le SDK ne l'utilise pas.

Individuellement, chaque point est courant. Ensemble, sur une app médicale : un téléphone perdu
et déverrouillé livre la session et l'identité.

### 🟠 A5. La performance réelle est pire que documentée — et le bundling seul ne la corrige pas

Lighthouse mobile, mesuré aujourd'hui (serveur local, **sans compression** — les valeurs absolues
sont pessimistes, la comparaison reste valide) :

| Cible | Perf | FCP | LCP | CLS | JS transféré |
|---|---:|---:|---:|---:|---:|
| Sources (ce qui est déployable) | **54** | 3,2 s | **12,0 s** | 0,29 | 935 Ko |
| Sortie Vite (pilote accueil) | **47** | 5,6 s | 10,2 s | 0,29 | 716 Ko |

Le pilote Vite du matin **réduit les octets et les requêtes, mais dégrade le score** : un seul
bundle de 461 Ko allonge le chemin critique plus que 27 petits fichiers parallèles. J'avais
annoncé « −21 % d'octets » comme un gain ; c'est vrai et insuffisant.

L'élément LCP est un simple `<p>` : la page n'a rien de lourd à peindre, elle **attend**. Ce qu'elle
attend, dans l'ordre :

- **Font Awesome 6 complet** depuis cdnjs sur **42 pages** (~100 Ko CSS + polices), en
  `<link>` bloquant, pour **219 icônes** utilisées ;
- deux familles Google Fonts en `<link>` bloquant ;
- `tabibi-i18n.js` (356 Ko, trois langues) avant que les **107 éléments `data-i18n`** ne reçoivent
  leur texte.

Le CLS de 0,29 (seuil « bon » : 0,1) vient du même mécanisme : le texte se remplace après coup.

> Note : Lighthouse sur https://tabibi.doctor donne 100/100 — parce que la production sert la page
> « Bientôt disponible » (4 919 octets, 1 requête). Ce score ne dit rien de l'application.

### 🟠 A6. `supabase/config.toml` bloque tout dump du schéma

```
[auth.hook.send_sms]
secrets = "env(SEND_SMS_HOOK_SECRETS)"
```

Sans cette variable dans le shell, le CLI refuse **toute** commande base :
`LegacyDbConfigLoadError: auth.hook.send_sms.secrets must be formatted as "v1,whsec_…"`.
C'est la raison mécanique pour laquelle `migrations/PROD_SCHEMA_DUMP.sql` n'a jamais été
produit malgré trois tentatives documentées. Le problème n'était pas la volonté, c'était un
fichier de configuration.

### 🟠 A7. Le déploiement publiait les sources d'outillage — régression que j'ai introduite ce matin

`git archive` est la base du déploiement. Simulation sur `HEAD` avant correction :

```
25 fichiers  v2/        sources React, tests, package.json
 3 fichiers  src/       points d'entrée Vite
             eslint.config.mjs · playwright.config.js · vite.config.mjs
```

Mes commits du matin auraient mis `v2/src/*.tsx` en ligne sur tabibi.doctor. **Corrigé dans ce
commit** (`v2/**`, `src/**` et les trois configs en `export-ignore`, vérifié par
`git archive --worktree-attributes`). Une leçon au passage : le pattern `v2/` avec barre finale
ne fonctionne **pas** dans `.gitattributes` — il faut `v2/**`.

Restent exportés **volontairement** et couverts par les barrières `_redirects` + `functions/` :
`desktop/` (29 fichiers) et `supabase/` (19 fichiers, dont le code des edge functions).
Défense en profondeur assumée, mais chaque nouveau dossier doit choisir son camp.

### 🟡 A8. Le cache des assets hachés n'est pas configuré

`_headers` pose `no-cache` sur `/js/*` et `/styles/*` — juste. Mais **rien** sur `/assets/build/*`,
où Vite écrit des fichiers à empreinte (`index-BizkUnhP.js`). Ils héritent du défaut Cloudflare
(4 h) alors qu'ils devraient être `Cache-Control: public, max-age=31536000, immutable`. Tout le
bénéfice du hachage est perdu.

### 🟡 A9. `sms_log` et `email_log` ne sont jamais alimentées

Aucune edge function n'écrit dans `sms_log`. `send-sms` ne persiste pas le `smsid` que BudgetSMS
lui renvoie ; `sms-dlr` reçoit les accusés de livraison et **les journalise sans les stocker**. Le
diagnostic « OTP jamais reçu ou OTP ignoré ? » — celui qui a rendu si long le réglage de
l'expéditeur — reste impossible à faire après coup.

### 🟡 A10. Dépendances : 11 vulnérabilités, Node non épinglé

`npm audit` : **1 critique** (`tar`, via `@capacitor/cli`), 8 hautes (`sharp`, `minimatch`,
`xmldom`, `brace-expansion`…), 2 modérées. Toutes dans la chaîne de **build**, aucune dans le code
livré au navigateur — le risque est sur la machine qui construit, pas sur l'utilisateur. Aucun
`engines` dans `package.json`, pas de `.nvmrc` : deux machines peuvent builder avec deux Node.

### 🟡 A11. Internationalisation : quatre dictionnaires, un trou

`tabibi-i18n.js` : fr 1 246 clés, ar 1 246, **en 1 225** — 21 clés manquantes en anglais, qui
tombent en français silencieusement. Et `home-app.js` porte son **propre** dictionnaire `TR` avec
sa propre fonction `t()` : quatrième système de traduction après le central et les 8 locaux.

### 🟡 A12. Divers, tous vérifiés

| Constat | Preuve |
|---|---|
| **389** gestionnaires `onclick=` inline | inaccessibles au clavier sans `tabindex`, et ce sont eux qui imposent `'unsafe-inline'` |
| Sentry : `release: 'tabibi@v10.27.0'` en dur | `tabibi-sentry.js:70` — sixième numéro de version du projet, aucun n'est le bon |
| Aucun source map envoyé à Sentry | les traces de production pointent sur du code minifié |
| CSP `img-src https:` | autorise n'importe quelle image de n'importe quel domaine |
| `?demo=1` ouvert en production web | `tabibi-agenda.js:142`, verrouillé desktop uniquement |
| Aucune stratégie de sauvegarde documentée | 0 mention de PITR ou de plan Supabase dans 57 documents |
| `tests/reports/*.json` (900 Ko) versionnés | rapports Lighthouse dans le dépôt |
| Dernier déploiement Cloudflare : « 1 week ago », **sans commit source** | déploiement d'un répertoire local, non traçable |

---

## B — Ce que je corrige de mes conclusions du matin

**B1. Les « rendez-vous masqués par `starts_at` » — risque revu à la baisse.**
`migrations/PHASE5_1bis_alter_appointments.sql` montre que `starts_at` est un **alias de
`scheduled_at` posé par trigger** (`appointments_sync_slot_times`). Sauf si ce trigger manque en
production, la colonne ne peut pas être nulle et l'agenda v1 ne masque rien. L'incohérence
(filtrer sur une colonne, afficher l'autre) reste réelle et la v2 fait mieux, mais le diagnostic
`P1_diagnostic_starts_at.sql` mesurera vraisemblablement **zéro**. Je l'avais présenté comme un
bug probable ; c'est une dette de cohérence.

**B2. Le pilote Vite n'est pas un gain de performance.** Voir A5. Il est un **préalable** (sans
bundler, ni le découpage i18n ni la CSP stricte ne sont possibles), pas un résultat.

**B3. `claim_my_doctor_profile` existe.** Absente des types générés, présente en base (elle
répond `P0001 Non authentifié`). La méthode « absente des types = absente » est fausse ; le README
le dit désormais.

---

## C — Ce qui est sain, et vérifié aujourd'hui

Un audit qui ne dit que ce qui va mal fait prendre de mauvaises décisions. Ceci **tient** :

| Point | Preuve |
|---|---|
| Aucune clé `service_role` dans l'historique git public | scan complet : un seul JWT, rôle `anon` |
| Le mot de passe du keystore n'a **pas** fuité | l'occurrence `storePassword=V…` de l'historique est un exemple de doc ; le vrai commence par une autre lettre |
| Les deux APK sont signés par la clé officielle | `apksigner` : `b6df5822…` sur le local **et** sur celui en ligne |
| `send-sms` vérifie la signature du webhook | `standardwebhooks`, 401 si secret absent |
| `appointment-reminders` est `dry_run=true` par défaut | il faut passer `false` explicitement pour écrire |
| iOS ATS : `NSAllowsArbitraryLoads=false` | pas de trafic en clair |
| Contrainte d'exclusion anti-double-réservation en base | `EXCLUDE USING gist (doctor_id, tstzrange)` + `23P01` mappé côté front |
| Le dictionnaire arabe est complet | 1 246 / 1 246 clés |
| `_headers` et `netlify.toml` alignés | CSP identique |
| Rien de `v2/`, `src/` ni des configs ne partira plus en production | corrigé et vérifié dans ce commit |

---

## D — Les technologies, révisées par cet audit

Le plan du matin tient (Vite 8, React 19, TanStack Query, Capacitor + OTA, Supabase conservé).
Ce second passage y ajoute ce que les nouvelles découvertes imposent, et **retire** une illusion.

### Performance — ce qui compte vraiment (A5)

| Chantier | Effet attendu | Pourquoi celui-là |
|---|---|---|
| **Découper `tabibi-i18n.js` par langue**, charger à la demande | −340 Ko/page, LCP libéré | C'est ce qui bloque le texte, donc le LCP |
| **Font Awesome → sprite SVG des 219 icônes** (ou `lucide`) | −250 Ko bloquants sur 42 pages | Un `<link>` CSS externe bloque le rendu ; un sprite inline ne bloque rien |
| Polices en `preload` + `font-display: swap`, ou auto-hébergées | FCP | Deux `<link>` Google Fonts bloquants aujourd'hui |
| Texte de l'accueil **présent dans le HTML** dans la langue par défaut | CLS 0,29 → ~0 | Le remplacement `data-i18n` après coup est la cause du décalage |
| `Cache-Control: immutable` sur `/assets/build/*` | Retours instantanés | A8 |
| Découpage de bundle par page (Vite `manualChunks`) | Chemin critique court | Un bundle unique de 461 Ko est pire que 27 fichiers |

### Sécurité — outillage qui empêche la récidive

| Outil | Ferme |
|---|---|
| **gitleaks** en pre-commit + en CI | Dépôt public : aucun secret ne doit pouvoir être committé. Vérifie aussi rétroactivement |
| **Renovate** (ou Dependabot) | Les 11 vulnérabilités, et celles de demain — PR automatiques, groupées |
| `engines` + `.nvmrc` (ou **Volta**) | Builds reproductibles entre machines et CI |
| `android:allowBackup="false"` + `dataExtractionRules` | A4 |
| Jeton de session en **stockage sécurisé natif** (`@capacitor-community/secure-storage` branché sur `auth.storage` de supabase-js) | A4 — Keychain iOS / Keystore Android au lieu du localStorage de la WebView |
| `@sentry/vite-plugin` : release = SHA git, source maps envoyés | Traces lisibles, versions vraies |
| CSP : `img-src` restreint, puis retrait de `unsafe-inline` **après** migration des 389 `onclick` | A12 |

### Base et données

| Outil | Ferme |
|---|---|
| Corriger `config.toml` (`SEND_SMS_HOOK_SECRETS` posé, ou bloc sorti du fichier versionné) | A6 — débloque `supabase db dump`, donc le schéma versionné |
| **Supabase CLI migrations** (`db pull` / `db diff` / `db push`) + **branches de base** | Staging réel, rollback possible |
| **pgTAP** pour les policies RLS | Les 94 policies n'ont aucun test ; le cross-user A↔B est « à faire » depuis mai |
| Persister le `smsid` dans `sms_log` depuis `send-sms`, et les DLR depuis `sms-dlr` | A9 |
| Réactiver ou supprimer `api_usage_log_ensure_partition` | A1 |

### Ce que cet audit ne change pas

**Supabase reste.** Ce second passage a lu les edge functions, les gardes, les contraintes :
c'est du travail sérieux, correctement fait. Le migrer vers Azure détruirait les 94 policies et
6 edge functions vérifiées ici pour reconstruire l'équivalent sans gain identifiable.

---

## E — Ordre d'exécution

```
Immédiat      Corriger telecharger.html OU uploader l'APK 1.0.2       (A2, 10 min)
              Masquer les 5 moyens de paiement derrière le flag        (A3, 20 min)
              config.toml : débloquer le CLI, dumper le schéma         (A6, 30 min)
              allowBackup=false + backup_rules                         (A4, 20 min)
              immutable sur /assets/build/*                            (A8, 5 min)

Cette semaine Découpage i18n par langue                               (A5, 1-2 j)
              Font Awesome → sprite SVG                                (A5, 1 j)
              gitleaks + Renovate + engines                            (A10, 2 h)
              Décider le sort de l'API partenaires                     (A1, décision)

Ensuite       Stockage sécurisé natif du jeton                         (A4)
              sms_log / DLR persistés                                  (A9)
              Sentry : release + source maps                           (A12)
              pgTAP sur les RLS · migrations CLI · branches            (D)
              Migration des 389 onclick → CSP sans unsafe-inline       (A12)
```

---

*Second passage établi le 09/09/2026 : historique git, `npm audit`, `apksigner`, `aapt2`,
Lighthouse 12 (mobile), production réelle, simulation `git archive`, lecture des edge functions
et des migrations. Les scripts et fichiers cités sont dans le dépôt.*

---

## F — État le soir même (8 commits, branche `fix/p0-securite-chaine-approvisionnement`)

| Découverte | État | Commit |
|---|---|---|
| A1 API partenaires sans surface | 🟡 **décision à prendre** (servir ou retirer) — rien de touché | — |
| A2 Page de téléchargement | ✅ annonce l'APK réellement servi (1.0.1, build 3) + détection iOS | `d450492` |
| A3 Moyens de paiement fictifs | ✅ filtrés par le flag : seul « Espèces au cabinet » reste | `d450492` |
| A4 `allowBackup`, session extractible | ✅ `allowBackup=false` + règles Android 12+/<12 · jeton natif : **reste en WebView** (stockage sécurisé = chantier suivant) | `d450492` |
| A5 Performance | ✅ mesurée : build perf 47 → **73**, FCP 5,1 → 2,3 s, LCP 12 → 4,7 s (titre), i18n 356 → 72 Ko, FA local non bloquant, SDK `defer`, bandeau immédiat | `1409c27`, `c640e4c` |
| A6 `config.toml` bloque le CLI | ✅ `supabase/.env.example` + procédure ; le dump exige en plus **Docker ou `pg_dump`** et le mot de passe — absents de cette machine | ce commit |
| A7 Sources d'outillage déployées | ✅ `v2/**`, `src/**`, configs en `export-ignore`, vérifié | `04ec775` |
| A8 Cache des assets hachés | ✅ `immutable` 1 an sur `/assets/build/*` et `/assets/vendor/*` | `d450492` |
| A9 `sms_log` jamais alimentée | 🟡 **code écrit** (`send-sms` insère, `sms-dlr` rattache par `provider_msg_id`), **déploiement à valider** — Deno absent ici, non exécuté | ce commit |
| A10 Dépendances, Node | ✅ 11 → 3 vulnérabilités modérées (chaîne CLI), `engines` + `.nvmrc`, `@capacitor/assets` retiré, Dependabot | `d450492`, ce commit |
| A11 i18n : 21 clés, 4 dictionnaires | ✅ 1 503 clés dans les 3 langues, parité en CI ; le dictionnaire de `home-app.js` subsiste | `1409c27` |
| A12 `onclick`, Sentry, CSP, demo, sauvegarde | ✅ Sentry lit `APP_VERSION` · `img-src` restreint · `?demo=1` fermé en prod · rapports retirés · gitleaks en CI · **389 `onclick` et sauvegarde DB : restent** | `d450492`, ce commit |
| README : `catch` vides, `innerHTML`, `aria-label` | ✅ 74 → 0 dans `js/` · données base/utilisateur échappées · 0 bouton-icône / 0 champ sans nom accessible | `1409c27`, `c640e4c` |
| Push mobile sans jeton | ✅ `tabibi-push-init.js` sur les pages du bundle | `d450492` |
| Icône / splash de marque | ✅ **déjà en place depuis le 29/05/2026** (`b68d585`) — `docs/mobile/KNOWN_ISSUES.md` était périmé. Régénération depuis `resources/` (versionné) : identique au bit près | — |
| Captcha iOS | 🟡 `ios.scheme = 'https'` posé — **à valider sur device** | ce commit |
| Déploiement automatique | 🟡 workflow **préparé, inactif** tant que `DEPLOIEMENT_AUTO` et les secrets ne sont pas posés | ce commit |

Ce qui n'est **pas** fait, et pourquoi : les 35 pages restantes à convertir à Vite (10 sont faites
via `scripts/vite-convertir-page.mjs` ; chaque page à JS inline dépendant des globales demande une lecture — le `defer` du SDK y
casserait `supabase-client.js`) ; la migration des 389 `onclick` (préalable à une CSP sans
`unsafe-inline`) ; le stockage natif sécurisé du jeton ; le sprite SVG ; l'auto-update Tauri ; le
chiffrement des notes médicales et le journal de consentement (décisions produit) ; tout ce qui
touche à la production (déploiements, purge des comptes, secrets) — validation humaine.
