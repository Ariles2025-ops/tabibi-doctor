# Vérification d'après déploiement — porte fermée

À exécuter **immédiatement après** le déploiement, avant toute autre chose. Chaque ligne est un fait
mesurable, pas une impression. Si une seule échoue : **retour arrière immédiat**, explication ensuite.

Toutes les requêtes portent un cache-bust (`?cb=$RANDOM`).

## Etape obligatoire AVANT le build — les RPC appelees existent

**Si elle echoue, le deploiement ne part pas.**

```bash
SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) \
  node scripts/verifier-rpc.mjs --base
```

Attendu : aucune fonction de `supabase/rpc/existantes.txt` disparue de `pg_proc`.

**Pourquoi cet etage ne peut pas etre en CI.** Le structurel (`npm run verifier:rpc`, sans secret)
compare le code a une reference versionnee : il reste vert si une fonction est SUPPRIMEE en base,
puisque le depot est alors coherent avec lui-meme, et faux. Seul `--base` le voit.

Et le defaut qu'il attrape est **invisible** : PostgREST rend 404, le `catch` avale, l'ecran sort
vide comme s'il n'y avait rien a montrer. C'est arrive pendant la recette de septembre 2026, ou les
fonctions de la vague 1A ont tue la recherche de medecins sans que personne le remarque.

Mesure du 13/09/2026 : **44 RPC appelees, 5 absentes** — les cinq de
`docs/FICHE_R3_APPELS_DANS_LE_VIDE.md`, declarees comme absences connues dans le script. Cette liste
doit **maigrir, jamais grossir**.

## Etape obligatoire AVANT le build — l'enum des statuts

**Si elle echoue, le deploiement ne part pas.** C'est tout.

```bash
SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) \
  node scripts/verifier-statuts.mjs --base
```

Attendu : `Statuts alignes.`, sortie 0, les cinq valeurs de `appointment_status`.

**Pourquoi ici et pas en CI.** L'etage structurel (`npm run verifier:statuts`, sans secret) tourne dans
`verification.yml` avec les autres portes, mais il ne voit **pas** un `ALTER TYPE ... ADD VALUE` fait en
base : le depot reste coherent avec lui-meme, et faux. Seul `--base` l'attrape.

Et il n'a pas sa place dans `.github/workflows/deploiement.yml` : ce job est verrouille par
`if: vars.DEPLOIEMENT_AUTO == 'oui'` et deux secrets Cloudflare absents — il est reste « skipped » aux
quatre fusions du 13/09/2026. **Une garde qui ne se declenche jamais est pire que pas de garde : elle
rassure.** Le deploiement reel est la commande `wrangler` lancee a la main ; la garde vit donc dans
cette procedure-la.

Le jeton reste **local**, lu au trousseau au moment de l'appel. Le script ne lit rien du trousseau
lui-meme : il attend `SUPABASE_ACCESS_TOKEN` dans l'environnement. **Aucun secret Supabase n'est
ajoute au depot ni a la CI** — on y reviendra le jour ou le deploiement automatique sera reellement
branche.

Si la commande signale un statut inconnu : declarer la valeur dans `js/tabibi-statut-rdv.js`
(`TABLE` + `VALEURS`), ajouter ses libelles aux trois dictionnaires, mettre a jour
`supabase/enums/appointment_status.txt`. Sans quoi tous les ecrans afficheront « Statut inconnu » —
repli sur, mais pas un etat acceptable.

## Avant : l'état de référence

| Mesure | Valeur d'aujourd'hui, production = commit `f06aa3d` |
|---|---|
| accueil `/` | **4 919 octets**, `sha256 f37749f8a9b68729755969dd23796f3a` |
| balise `tabibi-porte` | **absente** (déploiement antérieur au mécanisme) |
| `/accueil-public.html` | **404** |
| déploiement Cloudflare | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd`, il y a 2 semaines |

## Après : ce qui doit être vrai

### 1. La porte est restée fermée

```bash
curl -s "https://tabibi.doctor/?cb=$RANDOM" | wc -c          # ≈ 5 004, pas 116 000
curl -s "https://tabibi.doctor/?cb=$RANDOM" | grep -o 'name="tabibi-porte" content="[a-z]*"'
```

| Attendu | |
|---|---|
| taille de `/` | **~5 004 octets** — la page « Bientôt disponible » plus la balise |
| titre | « Tabibi — Bientôt disponible » |
| balise | `name="tabibi-porte" content="fermee"` |

Le `sha256` **change** par rapport à `f37749f8…` : c'est normal et attendu, la balise `meta` est
ajoutée. Ce qui ne doit pas changer, c'est le **titre** et l'**ordre de grandeur** de la taille.
Si `/` fait 116 000 octets, la porte s'est ouverte : **retour arrière**.

### 2. L'accueil public est déployé mais pas en page d'entrée

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://tabibi.doctor/accueil-public.html?cb=$RANDOM"   # 200
```

Il doit répondre **200** et contenir la recherche. Il n'est simplement pas la porte.

### 3. Les trois pages portent les correctifs de la vague

Un marqueur par page, vérifiable de l'extérieur.

| Page | Marqueur à trouver | Aujourd'hui |
|---|---|---|
| `login.html` | `assets/vendor/supabase/supabase-js-2.116.0.min.js` (SDK servi en local) | sert `cdn.jsdelivr.net`, CDN externe |
| `reservation.html` | `ERR_SLOT_OUTSIDE_HOURS` (le front comprend le refus de la garde) | absent |
| `doctor-dashboard.html` | `ID-ESPACE` **et** `DANS l'onglet Agenda` (#78 et #76) | absents |

```bash
for p in login.html reservation.html doctor-dashboard.html; do
  echo "-- $p"; curl -s "https://tabibi.doctor/$p?cb=$RANDOM" \
   | grep -c -E "supabase-js-2.116.0.min.js|ERR_SLOT_OUTSIDE_HOURS|ID-ESPACE|DANS l'onglet Agenda"
done
```

Empreintes complètes, si tu préfères comparer au bit près :

| Page | `sha256` attendu | `sha256` d'aujourd'hui |
|---|---|---|
| `login.html` | `dd1aa3bf0dddadcb5eec0a50…` | `d3ad122e1fc4edc5a523ee18…` |
| `reservation.html` | `fa5e43a5076d65925a270a80…` | `0674e98c019facbeff234ce1…` |
| `doctor-dashboard.html` | `678f1faf2b7b873b261b2283…` | `9def920a46ef9047514ea87a…` |

### 4. Le point de vigilance : la CSP se resserre

La vague retire `cdn.jsdelivr.net` et `cdnjs.cloudflare.com` de `script-src`, parce que le SDK Supabase
et Font Awesome sont désormais servis en local. **Si une page appelle encore un de ces CDN, elle
cassera silencieusement**, bloquée par la politique.

```bash
curl -s -I "https://tabibi.doctor/?cb=$RANDOM" | grep -i content-security | grep -o "script-src[^;]*"
```

Attendu : plus de `jsdelivr`, plus de `cdnjs`. Puis, sur `login.html` et `reservation.html`, ouvrir la
console et vérifier **zéro erreur bloquée par CSP**.

### 5. La garde de disponibilité, côté base

Elle ne dépend pas du déploiement — elle est en base — mais on la revérifie, parce qu'elle est la
promesse la plus coûteuse à casser.

```sql
select public.appointment_slot_is_available(
  (select id from public.doctor_profiles where legacy_id = 9000002),
  timestamp '2026-09-20 09:00' at time zone 'Africa/Algiers',
  timestamp '2026-09-20 09:30' at time zone 'Africa/Algiers');   -- doit rendre false (dimanche)
```

## Le retour arrière

Si une seule ligne échoue :

```bash
npx wrangler pages deployment list --project-name=tabibi-doctor      # relever l'id précédent
```

Puis, dans le tableau de bord : Workers & Pages → tabibi-doctor → Deployments → menu `...` de
`59b36480-2e0b-44ca-ab8b-86e04bbc06cd` → **Rollback to this deployment**. Atomique, quasi instantané,
sans reconstruction.

**On revient d'abord, on explique ensuite.**
