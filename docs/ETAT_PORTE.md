# L'état de porte du site — « fermée » ou « ouverte »

**État déclaré aujourd'hui : PORTE FERMÉE.**
Le site sert une page « Bientôt disponible » à la racine. Les pages internes restent servies.
Le lancement public est annoncé pour **décembre 2026**.

Ce fichier est la **déclaration versionnée** de cet état. Si la production ne lui correspond pas,
c'est la production qui a tort.

---

## Pourquoi ce fichier existe

Le 13/09/2026 à 3 h du matin, en préparant le déploiement de la vague, on a découvert que
**la production servait une page qui n'était plus dans `main`**.

| Date | Événement |
|---|---|
| 26/08/2026 | PR #51 remplace `index.html` par la page « Bientôt disponible » (commit `f06aa3d`) |
| ~26/08/2026 | Déploiement Cloudflare Pages `59b36480` depuis cet état |
| 03/09/2026 | PR #55 rétablit l'accueil public sur `main` (commit `3532be5`) |
| — | **Aucun redéploiement.** La production reste figée sur l'état « porte fermée » |
| 13/09/2026 | On s'apprête à déployer `main`. Personne ne sait que cela **ouvrirait le site** |

Vérifié : la page servie est **identique au bit près** à `f06aa3d:index.html`, 4 919 octets,
`sha256 f37749f8…`. Et cinq autres fichiers échantillonnés en production correspondent
exactement à `f06aa3d`.

**Le problème n'était pas la page.** Elle existait, dans l'historique et sur la branche
`claude/home-coming-soon`. Le problème est que **l'état de porte n'était écrit nulle part** :
il dépendait de quel commit avait été déployé en dernier. Un `wrangler pages deploy` depuis
`main` aurait ouvert le site sans que personne l'ait décidé.

---

## Comment on choisit, désormais

L'état de porte est appliqué **après le build**, sur `dist-web`, par un script unique.

```bash
npm run build:porte-fermee     # accueil = « Bientôt disponible »
npm run build:porte-ouverte    # accueil = l'application publique
```

ou, si `dist-web` est déjà construit :

```bash
npm run porte:fermee
npm run porte:ouverte
```

En CI, l'étape lit la variable de dépôt `TABIBI_PORTE`. **Elle vaut `fermee` par défaut** :
si personne ne se prononce, la porte reste fermée. Ouvrir le site demande un geste explicite.

### Ce que fait chaque état

| | `fermee` | `ouverte` |
|---|---|---|
| `dist-web/index.html` | la page « Bientôt disponible » | l'accueil public complet |
| `dist-web/accueil-public.html` | l'accueil public, déployé mais pas en page d'entrée | — |
| pages internes (`login`, `reservation`, tableaux de bord…) | **servies**, inchangées | servies |

Porte fermée ne veut donc **pas** dire site éteint : c'est l'état réel de la production depuis
le 26/08. Les pages internes sont accessibles par URL directe. C'est un choix à assumer, pas
un effet de bord — et c'est une raison de plus de l'écrire ici.

## Le marqueur, vérifiable de l'extérieur

Les deux états posent une balise dans `index.html` :

```html
<meta name="tabibi-porte" content="fermee|ouverte" data-genere="…">
```

Contrôle après n'importe quel déploiement :

```bash
curl -s "https://tabibi.doctor/?cb=$RANDOM" | grep -o 'name="tabibi-porte" content="[a-z]*"'
```

Tant que ce marqueur n'existe pas en production, c'est que le déploiement est antérieur à ce
mécanisme — c'est le cas aujourd'hui.

## Ce qu'il reste à faire avant d'ouvrir

Ouvrir la porte suppose ces quatre points, aucun n'est fait au 13/09/2026 :

1. **la revendication médecin n'existe pas** — un médecin ne peut pas rattacher sa fiche ;
2. **aucun e-mail transactionnel ne part** ;
3. **personne ne peut réinitialiser son mot de passe** ;
4. **la conformité 25-11 n'est pas faite**.
