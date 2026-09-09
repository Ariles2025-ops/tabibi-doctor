# Tabibi v2 — refonte progressive en React

> **Cette version ne remplace pas la production. Elle vit à côté.**
> Le site actuel (HTML/JS vanilla) reste la prod jusqu'au lancement de décembre
> et au-delà. La v2 se déploie sous `/v2/` et migre les écrans **un par un**.

## Pourquoi cette approche

Réécrire les 45 pages + 576 pages SEO d'un coup, c'est 2 à 3 mois pendant
lesquels rien ne sort et où le démarchage s'arrête. Ici, la prod continue de
tourner, et chaque écran migré est mis en ligne quand il est prêt et testé.
Si un écran v2 pose problème, on retire un lien : la version v1 est toujours là.

## Ce qui rend la cohabitation possible

- **Même projet Supabase.** Aucune donnée dupliquée, aucune policy RLS touchée.
- **Session partagée.** v1 et v2 sont sur le même domaine, donc le même
  `localStorage`. Un médecin connecté sur le site actuel est déjà connecté en
  v2, et inversement. Pas de double authentification.
- **Pas de page de login en v2.** On renvoie vers `login.html` de la v1.
- **Retour possible à tout moment** vers un écran v1 via un simple lien.

## Démarrer

```bash
cd v2
npm install
npm run dev      # http://localhost:5173/v2/agenda
```

Pour un build de production :

```bash
npm run build    # sort dans v2/dist/
```

## Déploiement

Le build produit des fichiers statiques. Deux options :

1. **Sous-chemin** — copier `v2/dist/` dans `v2/` à la racine du bundle
   déployé. La v2 est alors sur `tabibi.doctor/v2/`.
2. **Sous-domaine** — un projet Cloudflare Pages séparé pointant sur
   `beta.tabibi.doctor`, pratique pour faire tester à quelques ambassadeurs
   sans exposer la v2 au public.

Attention : `v2/` doit être **exclu** du bundle de la v1 (via `.gitattributes`
`export-ignore`) tant qu'il n'est pas destiné à être servi, sinon les sources
partiraient en production.

## Ordre de migration prévu

| Ordre | Écran | Pourquoi |
|---|---|---|
| 1 | **Agenda médecin** *(fait — squelette)* | Écran le plus complexe et le plus utilisé par les ambassadeurs. C'est là que React apporte réellement quelque chose. |
| 2 | Dashboard médecin | Beaucoup d'état, beaucoup de rafraîchissements. |
| 3 | Réservation patient | À migrer seulement après les premiers vrais retours d'usage. |
| — | Pages publiques et 576 pages SEO | **À ne pas migrer.** Elles sont rapides, elles ramènent du trafic organique gratuit, et React les rendrait plus lentes. |

## Chiffre à garder en tête

Le bundle actuel (React + Router + Supabase, un seul écran) pèse
**387 Ko / 113 Ko gzippé**. Le JavaScript de toute la page d'accueil v1 pèse
116 Ko non compressé. Autrement dit : React coûte plus cher en octets qu'il
n'en fait gagner. Son intérêt est la **maintenabilité** des écrans complexes,
pas la vitesse. C'est exactement pour ça qu'on ne migre pas les pages simples.

## Choix techniques et raisons

- **Vite, pas Next.js.** L'hébergement sert du statique, le backend est
  Supabase, et Capacitor embarque le build mobile. Le rendu serveur de Next
  n'apporte rien ici et compliquerait le build Android/iOS.
- **TypeScript en mode strict.** Sur un projet médical où un mauvais `doctor_id`
  vide un agenda, le typage attrape la classe de bugs la plus coûteuse.
- **Aucune librairie UI.** Les tokens de marque (`src/styles/tokens.css`)
  reprennent l'or `#d4a437`, le vert `#0F7560` et le gris `#556070` du site
  actuel. Règle projet : ces couleurs ne changent pas.

## Piège connu, hérité de la v1

`appointments.doctor_id` pointe vers `doctor_profiles.id`, **pas** vers
`auth.uid()`. Certaines lignes anciennes utilisent pourtant `auth.uid()`.
`Agenda.tsx` interroge donc les deux espaces d'identifiants, exactement comme
`js/tabibi-agenda.js`. Ne pas « simplifier » ce point sans avoir vérifié en
base avec un vrai compte médecin — c'est le bug qui vide un agenda sans erreur.
