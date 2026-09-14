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

## LA MESURE EST FAITE — 13/09/2026, et elle déplace la question

`supabase/mesures/20260913_capacite_connexions.sql`, blocs 1-5 et 7 (le 6 omis, sans effet sur la
conclusion). Lancée par le stratège.

| | |
|---|---|
| `max_connections` | **60** · `superuser_reserved` 3 · `reserved` 0 |
| ouvertes, toutes bases | **13** · cette base 7 · **marge 47** |
| états | interne 8 · active 1 · idle 4 |
| qui | PostgREST 2 · mgmt-api 1 · pg_net 1 · supabase_admin 2 · pg_cron 1 · exporter 1 |
| Supavisor | **0** · adresses clientes distinctes 2 |
| transactions restées ouvertes | **aucune** |

### La conclusion, et ce n'est pas celle qu'on attendait

> **La limite n'est pas les connexions. C'est le gabarit de calcul, et l'absence de pooler.**

47 places libres au calme, aucune transaction pendante, un pool PostgREST de **2** à vide. Le
chiffre qui compte n'est pas l'occupation, c'est **`max_connections = 60`** : c'est la valeur du
plus petit gabarit Supabase — **Micro**. Et `Supavisor 0` avec deux adresses clientes distinctes
dit que **personne ne passe par le pooler**.

**Deux réglages de console. Zéro ligne de code.** Ce qui limite ce projet en décembre ne se corrige
pas dans le dépôt — et c'est la première fois de la journée qu'on peut le dire.

### Deux choses que la mesure ne dit pas, et qu'il ne faut pas lui faire dire

1. **Elle ne dit rien du congrès.** Elle est prise au calme, sur une base dont presque toutes les
   tables métier sont vides (`cabinets`, `video_sessions`, `consents_log`, `dawini_requests` : zéro
   ligne). Un chiffre au repos ne prédit pas une charge.
2. **Elle n'explique pas l'incident du matin** — et c'est normal : elle est prise **après** la
   fermeture des onglets. Elle montre l'état sain, pas l'état saturé. Elle confirme le mécanisme
   (60 places, une dizaine d'onglets plus 13 connexions de service) sans le reproduire.

## La ligne ouverte : `idle_in_transaction_session_timeout = 0`

Elle signifie qu'**une transaction bloquée n'est jamais tuée**. Elle tient sa connexion *et* ses
verrous, et elle empêche `VACUUM` de nettoyer — indéfiniment.

**Mais il faut dire d'abord ce qu'elle n'est pas :**

> ⚠️ **Ce réglage n'aurait PAS empêché l'incident du matin.** Il ne coupe que les sessions
> `idle in transaction`. Le relevé en compte **zéro**. Les onglets qui ont saturé le pool étaient
> `idle` tout court — un état que ce réglage ne regarde pas.
>
> Le réglage qui mord sur cet incident-là s'appelle **`idle_session_timeout`**. Mesuré le 13/09 :
> **lui aussi vaut 0.** Il n'était dans aucune de nos listes.

### Ce qu'on propose, par rôle et pas globalement

Les deux réglages ont `context = user` : ils se posent **par rôle**, ce qui permet de protéger
l'application sans gêner l'opérateur. Un réglage global ferait les deux mal.

| Réglage | Rôle | Valeur proposée | Ce que ça peut casser |
|---|---|---|---|
| `idle_in_transaction_session_timeout` | `authenticator` (PostgREST) | **60 s** | Rien de connu. PostgREST fait une transaction par requête, déjà bornée par `statement_timeout` = 120 s ; une transaction *inactive* 60 s n'existe pas dans ce mode. |
| `idle_in_transaction_session_timeout` | `postgres` (nous) | **15 min, pas 60 s** | **60 s tuerait une migration interactive** : `BEGIN;` puis lecture d'une sortie avant `COMMIT`. C'est exactement le geste du stratège. La transaction serait annulée en silence, et l'écran dirait « déconnecté », pas « j'ai annulé votre transaction ». |
| `idle_session_timeout` | `postgres` **seulement** | **30 min** | Ferme les onglets oubliés — **le seul des trois qui aurait empêché l'incident**. Perte de l'état de session : tables temporaires, `SET` locaux, requêtes préparées. Négligeable pour notre usage. |

**À ne pas faire** : poser `idle_session_timeout` sur `authenticator`. Couper les connexions
oisives du pool PostgREST le forcerait à se reconnecter en boucle — on paierait de la latence pour
récupérer des places dont on a 47 de libres.

**À vérifier avant d'appliquer, et je ne le tranche pas** : les connexions `pg_cron scheduler` et
`postgres_exporter` apparaissent sous `postgres` dans `pg_stat_activity`. Si le délai s'applique à
elles, le poser sur le rôle `postgres` les ferait tourner en reconnexion permanente. À lire dans la
documentation de la version exacte, ou à mesurer sur une base de test — **pas à supposer.**

## Ce qu'on ne sait pas

Trois des cinq ont maintenant une réponse. Les deux qui restent sont les deux qui comptent.

1. ~~`max_connections` de ce projet — jamais lu.~~ **60 (gabarit Micro).** Mesuré le 13/09.
2. ~~Combien de connexions sont ouvertes en régime normal, et par qui.~~ **13, détail au tableau
   ci-dessus.** Mesuré le 13/09 — **au calme uniquement.**
3. ~~Si **Supavisor** est actif, et dans quel mode.~~ **Zéro connexion par Supavisor**, deux adresses
   clientes distinctes : personne ne passe par le pooler. Reste à lire en console *si* il est
   activé et avec quelle taille — l'absence de trafic ne prouve pas l'absence de service.
4. **Combien de connexions PostgREST, Auth, Realtime et Storage consomment chacun.** PostgREST tient
   **2** à vide ; sa taille de pool maximale (`db-pool`) n'est **pas** lue, et c'est elle qui
   plafonne sous charge. Auth, Realtime et Storage ne sont pas identifiables dans le relevé.
5. **Ce que la charge du congrès implique réellement.** Aucune mesure sous charge. Le relevé est
   pris sur une base dont les tables métier sont vides.

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

- [x] ~~Lire `max_connections` et l'occupation en régime calme~~ — **60 et 13, le 13/09.** Le régime
      de travail reste à mesurer.
- [ ] Établir si Supavisor est **activé** en console, en quel mode, avec quelle taille de pool.
      *(Mesuré : zéro connexion l'emprunte. Ce n'est pas la même question.)*
- [ ] Lire la taille du pool PostgREST (`db-pool`) et la comparer au plafond Postgres.
      **C'est devenu la question n° 1** : 2 connexions à vide ne disent rien du plafond sous charge.
- [x] ~~Décider d'un `idle_in_transaction_session_timeout` non nul~~ — **proposition écrite
      ci-dessus, par rôle.** Décision au stratège.
- [ ] **`idle_session_timeout` vaut 0 lui aussi** — il n'était dans aucune liste, et c'est le seul
      des deux qui aurait empêché l'incident du matin. Proposition écrite ; décision au stratège.
- [ ] Vérifier si un délai posé sur le rôle `postgres` s'applique aux connexions `pg_cron scheduler`
      et `postgres_exporter`. **À lire ou à mesurer, pas à supposer.**
- [ ] **Monter le gabarit de calcul** (Micro → au-dessus) avant décembre, ou établir que Micro
      suffit. C'est la conclusion de la mesure, et c'est un réglage de console.
- [ ] Règle d'exploitation : **un onglet d'éditeur SQL se ferme après usage.** Aujourd'hui,
      une dizaine d'onglets a suffi à bloquer une migration.
- [ ] Réserver de la marge pour l'exploitation, pour que l'incident n'emporte pas son diagnostic.
- [ ] Rejouer la mesure sous charge avant décembre — un chiffre au calme ne dit rien du congrès.

## Le lien avec le reste de la journée

Cette carte est le pendant d'infrastructure de la leçon produit du jour
(`TROIS FONCTIONNALITES ANNONCEES N'AVAIENT JAMAIS FONCTIONNE`) : là, personne n'était allé au bout
d'un parcours ; ici, **personne n'a jamais fait tourner plusieurs choses à la fois**. Les deux se
découvrent de la même façon — en exerçant pour de vrai, pas en relisant.
