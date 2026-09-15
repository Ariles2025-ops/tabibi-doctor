# CLAUDE.md — Règles projet Tabibi.doctor

Ce fichier est lu automatiquement par Claude Code à chaque session. Respecte-le en toutes circonstances.

## Contexte
- **Tabibi.doctor** : plateforme de prise de RDV médical en Algérie. Phase **pré-launch** (lancement congrès médical 3-5 déc 2026).
- **Stack** : site statique HTML/CSS/JS vanilla (~38 pages app + 490 pages SEO) · backend **Supabase EU (Frankfurt)**, projet `pudugodhiofqrctcdwfl` · hébergement **Cloudflare Pages** (projet `tabibi-doctor`, compte `13fe89e298e7bd78eeaf3223cd6b5dd5`). ~~Netlify ne sert QUE les deploy previews des PR — ce n'est pas la prod.~~ **FAUX, mesuré le 13/09/2026 — voir ci-dessous.**
- **Prod** : https://tabibi.doctor (DNS pas encore pointé) · **Netlify** : https://effulgent-kelpie-e48e81.netlify.app

> ⚠️ **NETLIFY SERT L'APPLICATION COMPLÈTE, PAS SEULEMENT DES PREVIEWS.** Mesuré le
> 13/09/2026, cache contourné : la **racine** `effulgent-kelpie-e48e81.netlify.app`
> rend « Trouvez votre médecin… », **115 196 octets**, sans balise `tabibi-porte` —
> l'application, branchée sur la base de **production** (même clé anon, même projet).
> Chaque *Deploy Preview* de PR fait de même.
>
> Dix minutes après la fusion de #105 — qui a inversé la porte, `index.html` étant
> désormais la page fermée — **la racine Netlify servait toujours l'application**, et
> une version antérieure à `4f6a027`. Elle est donc **figée sur un ancien build, ou
> branchée ailleurs que sur `main`.**
>
> **Configuration de production Netlify : INCONNUE DEPUIS LE DÉPÔT.** `netlify.toml`
> porte `publish = "."` sans `command`, mais la branche de production, l'état des
> builds et le verrouillage éventuel d'un déploiement ne se lisent **qu'en console**.
> À lire et à trancher là-bas : supprimer le site, ou le déconnecter.
>
> Ce qui est acquis : **la prochaine fois que Netlify construit `main`, il servira la
> porte fermée.** L'inversion est bonne ; elle attend un build qui ne vient pas.

## Déploiement — À LIRE AVANT TOUT MERGE

> ⚠️ **CE PARAGRAPHE ÉTAIT FAUX. Conservé tel quel, corrigé dessous.**
>
> > **Le projet Cloudflare Pages n'a AUCUNE connexion Git.**
> > Merger une PR sur `main` ne déploie **RIEN**. Chaque mise en production est un
> > `wrangler pages deploy` lancé à la main. Procédure complète : `DEPLOY_FRONTEND.md`.
> > Erreur déjà commise le 03/09/2026 : merge fait en croyant déployer, une heure
> > perdue à chercher un problème de cache inexistant.

> ⚠️ **CORRECTION DU 13/09/2026 — FUSIONNER SUR `main` DÉPLOIE.**
>
> Mesuré sur la console Cloudflare : **91 déploiements, un par fusion.** Le projet
> Pages EST connecté au dépôt et redéploie automatiquement à chaque `merge` sur
> `main`. La règle ci-dessus a peut-être été vraie ; elle ne l'est plus, et elle a
> été citée de bonne foi toute la journée du 13/09 dans des rapports qui en
> concluaient qu'une fusion était sans effet.
>
> **Ce que ça change, concrètement :**
> - Une fusion sur `main` est un **déploiement**. Elle se traite comme tel :
>   mesures annoncées avant, constatées après, ligne au journal.
> - Les déploiements numérotés du journal sont ceux lancés **à la main**. Ils sont
>   noyés dans une série continue d'auto-déploiements que personne ne comptait.
> - **La porte doit survivre à une fusion faite par quelqu'un qui ne pense pas
>   déployer.** C'est la raison d'être de l'inversion du 13/09 : depuis, `index.html`
>   à la racine **est** la page fermée, et `npm run verifier:porte` échoue sinon.
>
> **TRANCHÉ, console en main, le 13/09/2026 : elle n'a JAMAIS été retirée.** La
> connexion Git est active, branche `main`, et les 91 déploiements remontent à un
> mois au moins — les `fix(seo)` d'août sont des auto-déploiements.
>
> Le paragraphe conservé plus haut n'a donc **jamais** décrit la réalité de cette
> période. Il a servi de référence pendant des semaines, et il a été cité de bonne
> foi, par moi, toute la journée du 13/09.
>
> **La leçon, et elle vaut pour ce fichier entier : une règle de référence n'est
> pas une mesure.** Un document qui dit « il n'y a pas de X » doit porter la date
> et la méthode de la mesure qui l'établit, sinon il n'établit rien — il répète.

## Règles absolues (non négociables)
1. **Ne jamais commit/push directement sur `main`.** `main` est protégé (ruleset `protect-main` : force push et suppression bloqués). Toujours créer une branche + ouvrir une PR.
2. **Ne jamais merger en prod sans validation humaine explicite.** Tu prépares, l'humain approuve.
3. **Toute action destructive sur la base (DELETE, DROP, REVOKE, UPDATE massif) → STOP et demande confirmation avant.** Ajoute toujours un garde-fou (WHERE ciblé + RETURNING) et propose-la, ne l'exécute pas seul.
4. **Ne jamais logguer, écrire sur disque, ni committer un secret** (service_role key, access token, secret Turnstile). Variables d'environnement uniquement, jamais dans un fichier.
5. **Ne rien valider sans preuve empirique** : sortie DB réelle, réponse HTTP, run navigateur, scores mesurés. Jamais "ça devrait marcher".
6. **Aucune sortie de commande contenant un champ nommé `secret`, `token`, `key`, `password` (ou une valeur qui en a la forme : JWT `eyJ…`, `sb_secret_…`, hexadécimal long) n'est affichée telle quelle, jamais, même en lecture.** Toute réponse d'API ou de CLI est filtrée avant affichage (champs choisis explicitement, ou remplacés par une empreinte SHA-256 tronquée). Incident du 10/09/2026 : `GET /v1/projects/…/postgrest` renvoyait `jwt_secret` et il a été affiché ; rotation déclenchée.
7. **Quand un blocage de sécurité se déclenche sur une commande (classifieur, permission refusée, garde-fou de l'outil), STOP : tu t'arrêtes et tu demandes à Aghiles.** Tu ne reformules pas la commande pour passer, même si la nouvelle version te paraît plus sûre ou plus étroite. Aghiles préfère lancer lui-même ce type de script : tu l'écris, tu le montres, il le lance. Incident du 12/09/2026 : commande de création de comptes de test via l'API admin bloquée, puis relancée sous une forme réduite — c'est exactement ce qu'il ne faut pas faire. Second incident, 12/09/2026 au soir : un script d'inspection du DOM (mesure de la position et de la visibilité d'un bandeau, lecture d'un attribut `href`) a été refusé avec le motif « Cookie/query string data ». Aucun secret n'était en jeu : **faux positif**. La règle a été appliquée quand même — arrêt, script montré à Aghiles, décision rendue par lui, aucune reformulation et aucun contournement par capture d'écran. Conduite à tenir sur un faux positif : c'est toujours Aghiles qui tranche, pas moi.
8. **Toute mesure au navigateur se fait avec un cache-bust** (paramètre d'URL unique, ex. `?cb=<horodatage>`, ou rechargement forçé sans cache). Un rechargement d'URL simple peut servir une copie en cache et te faire conclure l'inverse de la réalité. Incident du 12/09/2026 : la modale « Mes horaires » avait été corrigée (déplacée sous `<body>`), mais un rechargement simple servait l'ancienne page en cache et la modale semblait toujours cassée — la preuve « avant/après » ne vaut que sur une page fraîchement chargée.
9. **On ajoute au dépôt PAR CHEMIN. Jamais `git add -A`, jamais `git add .`, jamais `git commit -a`.** `git add <chemin> <chemin>` uniquement, et on relit `git show --stat` avant de pousser. Incident du 13/09/2026 : un `git add -A` lancé pour committer **trois** fichiers de mesure a emporté **23 fichiers étrangers** dans la branche — l'état sqlite local de wrangler/miniflare (9), les livraisons déposées par l'application dans le dossier du projet (6, dont du SQL destiné à être collé en base), une corbeille `_to_delete/` (5, dont **deux archives de 2,8 Mo chacune**), et trois documents à la racine non suivis depuis des jours. Plus une capture de preuve e2e régénérée par un run : **une preuve ne se régénère pas par accident.** Le coût n'est pas le désordre, c'est que **le bruit cache la revue** : 31 fichiers au lieu de 7, et le relecteur ne lit plus rien — la même faute que le `catch` muet, à l'échelle du dépôt. Et un objet git ne se supprime pas d'un `git rm` : un dépôt qui grossit de 5,6 Mo d'archives ne redevient pas petit. `npm run verifier:proprete` et le `.gitignore` sont le **filet** ; cette règle-ci est la **cause**.

10. **Aucun correctif fusionné sans sa garde.** Chaque bug corrigé ajoute — ou pointe — un test/porte qui **échoue si le problème réapparaît**, plus une ligne dans `docs/REGISTRE_PROBLEMES.md`. Un correctif sans garde n'est pas une correction, c'est un sursis : le défaut reviendra, et personne ne saura qu'il était déjà connu. La garde arrive **avec** le correctif, dans le même lot, pas « plus tard » — c'est la seule façon de la voir échouer avant de la croire. Et quand il n'existe pas de garde possible (essai réel à deux navigateurs, PDF qu'un humain doit regarder), la ligne du registre l'écrit noir sur blanc : **« garde manquante » est une information, pas un oubli.** Incident fondateur : le cron des rappels a envoyé le mot `TA_CLE` pendant 47 jours en affichant 4 531 exécutions « succeeded » — le tableau de bord était vert parce que personne ne regardait la bonne chose.

## Sécurité — état à jour (NE PAS refaire)
Ces points sont **déjà réglés et prouvés** (session du 26 juil 2026). Ne les re-propose pas :
- **CRIT-4** : `doctor_profiles` verrouillé — `REVOKE SELECT FROM anon` appliqué. Les listings publics passent par la vue `public_doctors`. La table `doctor_profiles_backup_*` a été supprimée (DROP).
- **CRIT-5** : captcha Turnstile enforced côté serveur + confirmation email active. Nouvelle site key dans `js/config.js` : `0x4AAAAAADR6IhCWO9RLIipE`.
- **CRIT-1** : isolation RLS cross-user prouvée (aucune fuite). Les 94 policies scopent par `auth.uid()`.
- **Hardening** : leaked passwords (HIBP) ON, longueur mini 8, comptes anonymes OFF, branche `main` protégée.
- Intégration GitHub App "Cloudflare Workers and Pages" désinstallée (les ❌ Workers passés étaient parasites).

## Front / design
- **Ne pas toucher** au layout, aux features, ni à la logique Supabase lors de tâches de "quick wins" ou d'optimisation.
- **Couleurs de marque à préserver** : or `#d4a437` (accent principal), gris neutre foncé `#556070` (texte). Ne les modifie pas sans demande explicite.
- Accessibilité cible : niveau AA. Performance : viser Lighthouse ≥ 85 sans sacrifier le rendu.

## Base de données
- Ne jamais modifier une policy RLS ni une permission sans expliquer l'impact et demander validation. La RLS actuelle est saine.
- Note fonctionnelle à surveiller (pas urgent) : `prescriptions` et `doctor_schedule` comparent `doctor_id = auth.uid()` (user id), alors que les autres tables utilisent `doctor_profiles.id`. À vérifier au 1er onboarding médecin réel.

## Exclusions grep de dates
Lors d'un changement de date de lancement, un `grep` sur un nom de mois remonte
ces lignes. Elles sont **légitimes et ne doivent JAMAIS être modifiées** — ce
sont des noms de mois, pas des dates de lancement :

| Emplacement | Quoi | Pourquoi y toucher casserait quelque chose |
|---|---|---|
| `reservation.html:276` | `_AR_MONTHS` — table des 12 mois en arabe | Utilisée l.305 et l.353 pour les libellés du calendrier. Remplacer `سبتمبر` afficherait un mauvais mois sur tout RDV de septembre. |
| `reservation.html:351` | commentaire sur un bug de grille de calendrier | Le mois cité est un exemple illustrant le bug, pas une date produit. |
| `js/tabibi-i18n.js` | clés `month_*` (`month_september`, `month_sep`…) fr/ar/en | Dictionnaires de noms de mois du sélecteur de dates. |

Tout autre résultat est une vraie date de lancement à aligner.
Grep de contrôle (sans année, sinon les mentions sans millésime passent
inaperçues — cas rencontré le 04/08/2026, 6 occurrences ratées) :
```bash
git grep -niE "(septembre|september|سبتمبر|juin|june)" -- . \
  ':!desktop' ':!android' ':!www' ':!dist' ':!tests' ':!node_modules'
```
`www/` et `dist/` sont des sorties de build **non versionnées** : inutile de les
éditer, elles sont régénérées par `scripts/build-mobile.sh` et `git archive`.

## Comment rapporter
- Style : concis, factuel, en actions/tableaux. Pas de flatterie, pas de pavé.
- Après chaque tâche : donne les **preuves** (diff, scores avant/après, SHA de commit, réponse API), l'**URL de PR**, et ce qui reste à décider.
- Signale tout risque de casser la prod **avant** d'agir.
