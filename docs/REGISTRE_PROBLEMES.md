# Registre des problèmes

**Un problème réglé sans garde est un problème qui reviendra sans prévenir.**

Ce fichier existe pour qu'aucun défaut déjà payé ne se repaye. Une ligne par problème :
ce qu'on a **vu**, ce qui l'a **prouvé**, ce qui l'a **corrigé**, et surtout **ce qui
rougit s'il revient**.

> **Règle** (`CLAUDE.md`) : aucun correctif fusionné sans sa garde. Chaque bug corrigé
> ajoute — ou pointe — un test/porte qui échoue si le problème réapparaît, plus une ligne
> ici.

Créé le **15/09/2026**. Les gardes citées ont été **vérifiées présentes dans le dépôt**,
pas supposées. Quand il n'y en a pas, la colonne dit **« garde manquante »** : c'est une
information, pas un oubli de rédaction.

**Comment lire la colonne garde** :

| | |
|---|---|
| `npm run …` | une porte de `verifier:toutes` — elle bloque **avant** la fusion |
| `tests/…` | un essai, lancé par la porte `e2e` ou `unites` |
| *en base* | une garde côté PostgreSQL — **aucune porte CI ne la surveille** |
| **garde manquante** | rien ne détecte le retour du problème |

---

## Réglés, avec garde

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-01 | La liste d'attente annonçait « 500+ inscrits » | table `waiting_list` : **0 ligne** ; 404 réseau sur l'objet appelé | RPC `waiting_list_count()` + l'écran affiche « — » s'il ne sait pas | `tests/e2e/audit-corrections.spec.js` | réglé |
| P-02 | « E-mail envoyé » affiché même quand l'envoi échouait | rejeu avec un 429 `over_email_send_rate_limit` : l'écran disait quand même « envoyé » | succès affiché seulement après lecture de `r.error` | `tests/e2e/audit-corrections.spec.js` | réglé |
| P-03 | 80 des 106 éléments de l'accueil affichaient leur **clé i18n brute** | relevé horodaté : 0 brute à `DOMContentLoaded`, **80 à `load`** ; piège sur `textContent` → `js/home-app.js:389` | `T()` consulte le dictionnaire partagé ; on n'écrit jamais quand la valeur vaut la clé | `tests/e2e/i18n-cles-brutes.spec.js` (31 cas, 3 langues) | réglé |
| P-04 | Le cron des rappels recevait **401 depuis 47 jours** | `cron.job` envoyait `'TA_CLE'` ; `net._http_response` : 401 sur 24 réponses sur 24, alors que `cron.job_run_details` affichait 4 531 « succeeded » | secret lu dans le Vault ; la migration **refuse de s'appliquer** si le secret manque | `rappels_sentinelle()` *en base* (horaire → `audit_log_echecs`) — **aucune porte CI** | réglé |
| P-05 | `verify_jwt` de `appointment-reminders` non déclaré : un déploiement l'aurait remis à `true` et cassé le cron une 2ᵉ fois | le corps des 401 était `{"error":"unauthorized"}`, écrit par **la fonction** — donc elle était atteinte | entrée `[functions.appointment-reminders]` dans `supabase/config.toml` | **garde manquante** — aucune porte ne lit `config.toml` | réglé |
| P-06 | Les politiques d'écriture de `prescriptions` s'annulaient (permissives en OU) | `pg_policies` : INSERT 2 · UPDATE 2, la laxiste absorbant la stricte | une seule politique par commande d'écriture | requêtes de contrôle dans `20260914_rls_prescriptions.sql` — **aucune porte CI** | réglé |
| P-07 | La page publique de vérification d'ordonnance pouvait exposer un traitement | — (défaut de conception, évité avant mise en ligne) | réponse construite champ par champ **puis relue** avant envoi ; refus si un contenu médical s'y trouve | `tests/e2e/ordonnance-verification.spec.js` (sert une réponse fautive, vérifie que rien ne s'affiche) | réglé |
| P-08 | Une rotation de clé aurait invalidé toutes les ordonnances signées | — | identifiant de version **dans** la signature (`v1:…`) dès la première | `tests/signature-ordonnance.test.mjs` — vecteur figé + essai de rotation | réglé |
| P-09 | Le PDF d'ordonnance ne savait pas imprimer l'arabe, et la signature était **refusée** | `fontkit.layout` → 9 glyphes contextuels ; mapping naïf → 5 formes isolées | police Noto Naskh embarquée ; pdf-lib façonne via fontkit | `tests/pdf-arabe.test.mjs` — **compte les 9 glyphes** ; 5 = lettres détachées | réglé |
| P-10 | Un RDV recevait **deux** SMS (fenêtres j1/h2 qui se recouvraient) | constaté en essai réel | plancher j1 porté à 6 h, très au-dessus du plafond h2 | `tests/rappels-sms.test.mjs` — recouvrement vérifié **minute par minute sur 24 h** | réglé |
| P-11 | Un numéro de téléphone « réparé » aurait envoyé un rappel médical à un inconnu | — | `normalizePhoneDZ` rend `null` plutôt que de corriger | `tests/rappels-sms.test.mjs` — 9 formes acceptées, 10 refusées | réglé |
| P-12 | Le drapeau `video` ouvert sans que l'écran « bientôt disponible » disparaisse | — | drapeau + suppression de l'écran, la branche coming-soon **reste** dans le code | `tests/e2e/teleconsultation-salle.spec.js` + `npm run verifier:video` | réglé |
| P-13 | La CSP ne contenait **aucune** mention de `daily.co` : l'iframe aurait été bloquée | relevé sur `_headers` et `netlify.toml` | `frame-src`/`connect-src`/`media-src` + délégation caméra à l'origine exacte | `npm run verifier:video` — échoue si le drapeau s'ouvre avec un espace réservé | réglé |
| P-14 | Le drapeau `reviews` **n'était lu par personne** ; un `return []` caché fermait vraiment les avis | 0 occurrence de `TABIBI_FEATURES.reviews` dans le produit | court-circuit retiré **et** drapeau rendu lisible par le module | `tests/e2e/avis-patients.spec.js` (12 cas, drapeau ouvert **et** fermé) | réglé |
| P-15 | Un écran de succès atteignable **sans** succès (invitation médecin) | `tabibiRpc` rend `ok:true` dès qu'il n'y a pas d'`error` | la page exige `r.data.ok === true` | `tests/e2e/invitation-medecin.spec.js` — sert une réponse inattendue, exige l'absence d'écran de succès | réglé |
| P-16 | Un jeton d'invitation stocké en clair aurait ouvert toutes les invitations en cas de fuite | — | la base ne garde que le **SHA-256** ; l'adresse est vérifiée en plus du jeton | `tests/e2e/invitation-medecin.spec.js` + `tests/courriel-invitation.test.mjs` | réglé |
| P-17 | Un message d'erreur **serveur** rendu comme du HTML sur la page de réservation | `_bkServerError` concaténé puis passé à `innerHTML` | le message devient du **texte** ; l'icône est un nœud construit à part | `tests/e2e/xss-toast.spec.js` — 4 charges réellement injectées | réglé |
| P-18 | Le dépôt pollué : un `git add -A` a emporté 23 fichiers étrangers, dont 5,6 Mo d'archives | `git show --stat` : 31 fichiers au lieu de 7 | `.gitignore` + règle 9 de `CLAUDE.md` (ajout **par chemin**) | `npm run verifier:proprete` | réglé |
| P-19 | 173 `catch {}` muets sur 189 : Sentry ne recevait presque rien | recensement AST | catchs morts supprimés, les autres parlent | `npm run verifier:catch` | réglé |
| P-20 | Le front appelait des RPC **absentes** de la base | comparaison `pg_proc` ↔ appels du dépôt | référence versionnée + liste d'absences connues qui doit **maigrir** | `npm run verifier:rpc` | réglé |
| P-21 | CI rouge / local vert : les essais dépendaient de CDN tiers | CDN simulé à 20 s : `load` = 20,1 s/navigation contre 0,1 s en `domcontentloaded` | suite **hermétique** : aucune requête ne sort de localhost | `tests/e2e/hermeticite.spec.js` — `response.serverAddr()` prouve qu'aucun paquet ne part | réglé |
| P-22 | Pages publiques et parcours sous le niveau AA | axe : 19 violations publiques, puis 27 champs **sans étiquette programmatique** sur le profil patient | contrastes, `for` sur les labels, modale fermée rendue inerte au clavier | `tests/e2e/accessibilite.spec.js` | réglé |
| P-23 | `innerHTML` recevant une donnée non constante : 46 sites | compteur dédié, après trois corrections du compteur lui-même | 4 puits bouchés (3 toasts + `<option>` construit en DOM) | `npm run verifier:innerhtml` — **le compteur ne peut que baisser** | réglé, **46 restants** |

---

## Appliqués par le stratège, hors dépôt

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-24 | `search_path` non figé sur 16 fonctions ; 20 clés étrangères sans index | advisors Supabase | appliqué en prod via MCP | **garde manquante** côté CI — seul l'advisor Supabase le reverrait | réglé |
| P-25 | `video_sessions.daily_room_url` portait une URL **fabriquée** (`placeholder.daily.co`) | lecture de `create_video_session` | écrit `NULL` — « je ne sais pas encore » | requêtes de contrôle dans `20260914_video_daily.sql` — **aucune porte CI** | réglé |

---

## Appliqués et vérifiés après coup

| ID | symptôme | preuve mesurée | correctif | garde | statut |
|---|---|---|---|---|---|
| P-26 | 57 RPC `SECURITY DEFINER` exécutables par `anon` | `has_function_privilege('anon', …)` ; 319 au total, dont 262 `SECURITY INVOKER` sans effet | `20260915_revoke_rpc_anon.sql` — `REVOKE … FROM PUBLIC` **et** `FROM anon`, puis `GRANT` aux connectés. Appliqué en prod le 15/09 | **requête de comptage** (ci-dessous) + advisor Supabase — *en base*, **aucune porte CI** | **réglé — vérifié 57 → 10** |
| P-30 | `presc_can_read_pdf` restait exécutable par `anon` | ACL relue après application : `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — **`anon` n'y est plus** | réglé par P-26 | même requête de comptage — *en base* | **réglé** |
| P-32 | `REVOKE … FROM anon` **ne révoquait rien** : PUBLIC détenait `EXECUTE` | après le `REVOKE FROM anon` seul, **~47** des 57 fonctions restaient exécutables par `anon` — le compte n'avait pas bougé | `REVOKE … FROM PUBLIC` ajouté, plus `GRANT authenticated, service_role` pour ne pas fermer aux connectés | **la même requête de comptage** — c'est elle qui a attrapé le piège | **réglé** |

### La requête de garde, celle qui a attrapé P-32

Une migration qui s'applique ne prouve rien. **C'est ce compte qui le prouve** — à
relancer après toute migration qui crée une fonction :

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE');
-- attendu : 10.  Au-dessus : une fonction est née avec EXECUTE accordé à PUBLIC.
```

Relu en base le 15/09 après application : **10**, et ce sont exactement les dix du
parcours public. `authenticated` et `service_role` : **30/30 conservées, 0 perdue**.

> **P-32 est la vraie leçon de ce lot.** Un `REVOKE` qui réussit n'est pas un `REVOKE` qui
> révoque — comme le cron des rappels (P-04) disait « succeeded » en envoyant le mot
> `TA_CLE`. Deux fois le même piège : **la commande passe, l'effet n'existe pas.** Ce qui
> les a attrapés tous les deux, c'est d'être allé relire l'état après coup.

## Ouverts — aucune garde, et c'est le sujet

| ID | symptôme | preuve | correctif | garde | statut |
|---|---|---|---|---|---|
| P-27 | `accueil-public.html` affiche **4 fiches de médecins écrites en dur** — « ✓ Vérifié · ★ 4,9 » | ces médecins n'existent pas ; `reviews` contient 0 ligne | — | **garde manquante** | **ouvert** |
| P-28 | Trois parcours affichent « Email envoyé » alors que **rien ne part** | `README_APP.md` : `RESEND_API_KEY` posé le 20/05, `send-email` jamais écrite | la brique d'envoi existe (`_partage/courriel.ts`) et sert **un** parcours | **garde manquante** pour les trois autres | **ouvert** |
| P-29 | Le sélecteur de langue **disparaît** de l'accueil construit quand un tiers est injoignable | sources hermétique : 3 boutons · `dist-web` hermétique : **0** · `dist-web` serveur nu : 3 | — (mécanisme non élucidé) | **garde manquante** | **ouvert** |
| P-31 | Aucun essai réel : vidéo à deux navigateurs, avis sur données réelles, un PDF arabe **regardé**, un SMS de rappel reçu | — | — | **garde manquante par nature** — un humain doit regarder | **ouvert** |

---

## Ce que ce registre ne fait pas

Il ne prouve pas qu'un problème est réglé : il dit **où regarder**. Une garde peut exister
et être fausse — c'est arrivé trois fois en écrivant le compteur d'`innerHTML`, qui
accusait sa propre documentation, puis ignorait deux échappeurs sur onze.

Il ne remplace pas non plus les essais réels (P-31). **Une porte verte dit qu'aucune faute
connue n'est revenue ; elle ne dit pas que le produit marche.**
