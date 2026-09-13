# Carte — capacité de connexions à la base

**Ouverte le 13/09/2026, née d'un incident réel.** Hors code : c'est du dimensionnement.

## L'incident

`CREATE TABLE public.audit_log_echecs` n'a pas échoué sur son contenu. Elle a échoué **avant**, à la
connexion : `FATAL 53300 — too many clients already`. Une dizaine d'onglets d'éditeur SQL ouverts
depuis le matin, chacun tenant sa connexion. Le pool était plein.

Rien n'a été tenté, rien n'est à moitié appliqué — un `FATAL` à la connexion précède toute exécution.

## Pourquoi cette carte n'est pas petite

**Toutes les trouvailles du 13/09 étaient des défauts de correction** : un déclencheur qui écrit dans
une vue, un `search_path` qui ne résout plus, huit colonnes qui n'existent pas, un SDK jamais chargé.
Chacune se corrige par un patch, et une recette bien faite les aurait vues.

**Celle-ci est un défaut de dimensionnement, et aucune recette ne l'aurait vue.** Elle n'apparaît pas
sur un environnement à un utilisateur. Elle n'a pas de « bon » ou « mauvais » code. Elle apparaît
quand plusieurs choses fonctionnent *en même temps* — c'est-à-dire précisément le jour du congrès.

Et son mode de panne n'est pas celui des autres :

> **Une application qui ne peut plus se connecter à sa base ne se dégrade pas. Elle s'arrête.**

Pas de page lente, pas de fonctionnalité manquante : `FATAL`, et plus rien ne répond. C'est la
première limite de capacité qu'on rencontre sur ce projet.

## Le second danger, plus vicieux que le premier

Aujourd'hui, le pool saturé nous a empêchés de **lancer une migration**.

S'il sature pendant le congrès, il nous empêchera d'**ouvrir un onglet pour comprendre ce qui se
passe** — au moment exact où on en a besoin. Un incident de capacité supprime l'outil de diagnostic
de l'incident de capacité. C'est la seule panne de la journée qui se referme sur elle-même.

D'où une exigence qui sort de cette carte : **des connexions réservées à l'exploitation**, et
l'interdiction de laisser traîner des sessions d'administration ouvertes.

## Ce qu'on ne sait pas

Aucune de ces questions n'a de réponse aujourd'hui :

1. `max_connections` de ce projet — jamais lu.
2. Combien de connexions sont ouvertes en régime normal, et par qui.
3. Si **Supavisor** (le pooler Supabase) est actif, et dans quel mode — transaction ou session.
4. Combien de connexions PostgREST, Auth, Realtime et Storage consomment chacun.
5. Ce que la charge du congrès implique réellement.

## La mesure

`supabase/mesures/20260913_capacite_connexions.sql` — **lecture seule**, un seul passage, aucun
`pg_terminate_backend`, aucun réglage modifié. Sept blocs : plafond, occupation, états, qui tient
quoi, indices de pooler, dormantes les plus vieilles, **transactions restées ouvertes**.

Le dernier bloc est le plus important : une session `idle in transaction` tient sa connexion *et* ses
verrous, indéfiniment. C'est exactement ce que produit un onglet d'éditeur SQL oublié après un
`BEGIN`.

**Ce que la requête ne peut pas dire :** si Supavisor est actif et dans quel mode. Ça ne se lit pas
depuis Postgres — c'est un fait de tableau de bord. Le bloc 5 donne des *indices* (`application_name`,
adresses clientes distinctes), pas la réponse. La réponse se lit dans **Project Settings > Database >
Connection pooling** (mode et *Pool Size*), et dans les ports des chaînes de connexion : **6543** =
pooler en mode transaction, **5432** = direct, ou pooler en mode session selon l'hôte.

Je le dis plutôt que de fabriquer une requête qui aurait l'air de répondre : une mesure qui n'atteint
pas le point observé est pire qu'une mesure absente.

## Ce que la charge du congrès implique — le raisonnement à vérifier, pas à croire

Il faut désamorcer une frayeur fausse avant de regarder la vraie.

**Un médecin ouvrant tabibi.doctor ne prend pas une connexion Postgres.** Le navigateur parle à
**PostgREST** en HTTPS ; c'est PostgREST qui détient un pool vers Postgres, et il le partage entre
toutes les requêtes. Cinq cents visiteurs simultanés ne font pas cinq cents connexions. L'arithmétique
« un utilisateur = une connexion » est fausse, et c'est une bonne nouvelle.

La vraie exposition est ailleurs, et elle est triple :

| Source | Ce qui la fait grossir | Ce qu'on en sait |
|---|---|---|
| Pool PostgREST | saturé → les requêtes **font la queue**, puis expirent | taille jamais lue |
| Auth, Realtime, Storage | chacun tient ses propres connexions | jamais compté |
| **Nos sessions à nous** | onglets SQL, scripts, migrations | **c'est ce qui a saturé aujourd'hui** |

Le mode de panne du congrès n'est donc probablement **pas** `53300` côté navigateur : c'est la file
d'attente du pool PostgREST qui s'allonge, des requêtes qui expirent, et une application qui paraît
lente avant de paraître cassée. `53300` reste réservé à ceux qui se connectent en direct — nous.

**Tout ceci est un raisonnement, pas une mesure.** Il fixe quoi regarder ; il ne remplace pas le
regard. La requête donne les chiffres ; on conclut après.

## Suites à instruire une fois la mesure faite

- [ ] Lire `max_connections` et l'occupation en régime calme, puis en régime de travail.
- [ ] Établir si Supavisor est actif, en quel mode, avec quelle taille de pool.
- [ ] Lire la taille du pool PostgREST (`db-pool`) et la comparer au plafond Postgres.
- [ ] Décider d'un `idle_in_transaction_session_timeout` non nul si ce n'est pas déjà le cas.
- [ ] Règle d'exploitation : **un onglet d'éditeur SQL se ferme après usage.** Aujourd'hui,
      une dizaine d'onglets a suffi à bloquer une migration.
- [ ] Réserver de la marge pour l'exploitation, pour que l'incident n'emporte pas son diagnostic.
- [ ] Rejouer la mesure sous charge avant décembre — un chiffre au calme ne dit rien du congrès.

## Le lien avec le reste de la journée

Cette carte est le pendant d'infrastructure de la leçon produit du jour
(`TROIS FONCTIONNALITES ANNONCEES N'AVAIENT JAMAIS FONCTIONNE`) : là, personne n'était allé au bout
d'un parcours ; ici, **personne n'a jamais fait tourner plusieurs choses à la fois**. Les deux se
découvrent de la même façon — en exerçant pour de vrai, pas en relisant.
