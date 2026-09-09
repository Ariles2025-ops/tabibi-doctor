# Ce que je ne peux pas faire à ta place

**Mis à jour le 9 septembre 2026 — J−85 du congrès.**

Quatre points. Tout ce qui pouvait être préparé l'a été : il ne reste que les
gestes qui exigent tes identifiants, ta carte bancaire ou ta main.
Temps total estimé : **une heure**, plus deux formulaires à lancer.

---

## 1. Sortir la clé de signature du Mac — 15 min · irréversible

Les deux copies de la clé sont sur **le même disque**. Perdre ce Mac, c'est perdre
le droit de mettre à jour l'app chez tous ceux qui l'ont installée : il faudrait
republier sous un autre nom de package et repartir de zéro.

```bash
bash scripts/sauvegarder-keystore.sh /Volumes/TA_CLE_USB
```

Le script vérifie l'empreinte **avant et après** la copie. Il refuse de sauvegarder
le faux fichier `BACKUP` du dossier `COPIE-2-SECURITE` (autre clé, autre mot de passe).

- [ ] Support n°1 (clé USB, rangée **ailleurs** que près du Mac)
- [ ] Support n°2 (stockage chiffré, ou coffre-fort d'un gestionnaire de mots de passe)
- [ ] Mot de passe du keystore dans un gestionnaire de mots de passe — **jamais** à côté de la clé

> Un disque posé sur le bureau à côté de l'ordinateur ne survit pas au même vol,
> au même dégât des eaux, au même incendie. Ce n'est pas une deuxième copie.

---

## 2. Trois actions en base — 20 min · je prépare, tu exécutes

`CLAUDE.md` règle 3 : je ne lance aucune action destructive seul. Les trois fichiers
sont écrits, avec **une étape de lecture seule d'abord**, un `WHERE` ciblé et un
`RETURNING` qui prouve ce qui a été touché.

À coller dans le SQL Editor Supabase, **étape par étape, en lisant chaque sortie** :

| Ordre | Fichier | Effet |
|---|---|---|
| 1 | `migrations/P0_purge_comptes_sonde.sql` | Supprime les 2 comptes-sonde des audits (`9d419394…`, `9df8df4f…`) |
| 2 | `migrations/PURGE_comptes_test.sql` | Supprime les 5 comptes de test par e-mail |
| 3 | `migrations/P0_revoke_match_doctor_for_claim.sql` | Retire l'accès `anon` à une RPC jamais appelée |

**Deux choses à savoir avant de lancer :**

- `PURGE_comptes_test.sql` **ne couvrait pas** les deux comptes-sonde : il filtre par
  adresse e-mail sur une liste de 5 adresses en `@tabibi.doctor`, or l'un des sondes
  est en `@tabibi.test`. Le lancer seul les aurait laissés en base. D'où le fichier n°1.
- **La « rotation du mot de passe fuité » devient sans objet** si tu lances le n°2.
  Le mot de passe passé en clair dans l'historique git public appartient à
  `medecin.test.desktop@tabibi.doctor`, que cette purge **supprime**. Supprimer vaut
  mieux que faire tourner. Deux lignes de ta liste P0 n'en font qu'une.
  *Sauf* si ce compte sert encore à tester le logiciel desktop — dans ce cas, ne
  le purge pas et change son mot de passe.

- [ ] Étapes de lecture seule lues avant chaque suppression
- [ ] Sorties `RETURNING` conservées (c'est la preuve)

---

## 3. Mettre à jour `TURNSTILE_SECRET_KEY` — 5 min

Tant que ce n'est pas fait, **le formulaire de liste d'attente échoue en fail-closed** :
personne ne peut s'inscrire. C'est le formulaire de captation d'avant-lancement.

1. Cloudflare → Turnstile → widget `0x4AAAAAADR6IhCWO9RLIipE` → copier la **Secret Key**
2. Puis :

```bash
supabase secrets set TURNSTILE_SECRET_KEY=<la_secret_key> --project-ref pudugodhiofqrctcdwfl
```

3. Vérifier en soumettant le formulaire sur `waiting-list.html` en production.

- [ ] Secret posé
- [ ] Soumission réelle réussie

> La site key publique dans `js/config.js` est déjà la bonne. C'est **uniquement**
> le secret côté serveur de l'edge function `verify-turnstile` qui est resté sur
> l'ancien widget, dont le compte n'est plus accessible.

---

## 4. Les comptes développeur — 10 min de saisie, des semaines d'attente

C'est le seul point du dossier où **attendre coûte des semaines**, pas des heures.
À lancer aujourd'hui même si le travail iOS ne commence qu'en novembre.

| Compte | Coût | Délai | Pourquoi maintenant |
|---|---|---|---|
| **D-U-N-S** (pour la SARL) | gratuit | **2 à 4 semaines** | Obligatoire avant Apple. C'est lui qui commande tout le calendrier iOS |
| **Apple Developer Program** | 99 $/an | quelques jours *après* le D-U-N-S | Sans lui : pas de build iOS, pas de push APNs |
| **Google Play Developer** | 25 $ une fois | 1 à 2 jours | Débloque le test interne et les mises à jour automatiques |

**Calcul de calendrier** : D-U-N-S lancé le 9 septembre → réponse autour du 7 octobre
au pire → Apple validé mi-octobre → il reste ~6 semaines pour construire, tester et
faire relire l'app iOS avant le congrès. **Lancé en octobre, iOS ne sort pas pour décembre.**

Android n'attend rien de tout ça : l'AAB est déjà signé et prêt à monter en test interne.

- [ ] D-U-N-S demandé — date : ________
- [ ] Google Play Developer ouvert
- [ ] Apple Developer Program (après réception du D-U-N-S)

---

## Ce qui a été fait de mon côté aujourd'hui

| Commit | Effet |
|---|---|
| `d24ad8a` | SDK Supabase auto-hébergé — fin du CDN à tag flottant, et `admin-api-keys.html` réparée (elle n'avait jamais fonctionné en production) |
| `8375b9f` | Vite 8 en multi-pages, accueil converti : 1001 Ko → 794 Ko, 29 requêtes → 8 |
| `2a46a48` | ESLint 9 + cliquet de dette + vérification automatique des PR |
| `2265e6a` | Playwright installé, 2 tests faux corrigés, 30 tests verts sur les sources **et** sur le build |

Rien n'est poussé sur GitHub : le dépôt est public et `CLAUDE.md` demande une PR.

---

*Quand ces quatre points sont faits, plus rien de ce qui reste n'est irréversible.*
