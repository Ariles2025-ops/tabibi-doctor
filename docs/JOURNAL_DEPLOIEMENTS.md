# Journal des déploiements — tabibi.doctor

## ⚠️ 13/09/2026 — `main` EST RESTÉ ROUGE DE #108 À #111, SANS QUE PERSONNE LE VOIE

**Constaté**, runs `verification` lus sur GitHub Actions :

| Run | Fusion | Résultat | Durée |
|---|---|---|---|
| #86 | #106 `fix/succes-sur-refus` | **FAILED** | 29 s |
| #87 | #107 | succès | 3 min 35 |
| #88 | #108 `fix/verifier-toutes` | **FAILED** | 1 min 13 |
| #89 | #109 `fix/portes-a-venir` | **FAILED** | 1 min 15 |
| #90 | #110 `fix/garde-rpc` | **FAILED** | 1 min 05 |
| #91 | #111 `docs/regle-suppression-et-20-catch` | **FAILED** | 1 min 14 |

**Quatre fusions sur porte rouge, et le déploiement 9 est parti d'un `main` rouge.**

**La cause**, pour #88 à #91 : `.github/workflows/verification.yml` lançait
`npm run verifier:toutes` — qui exécute e2e — **avant** le pas « Installer le navigateur de test ».
En CI, Playwright n'avait aucun Chromium à cet instant : les 25 tests tombaient en 30 secondes sur
une **absence**, pas sur une régression. En local le navigateur existe, d'où 66/66 chez nous et rouge
chez eux. **C'est la CI qui a raison sur ce que la CI fait.**

**Pourquoi personne ne l'a vu** : la durée des runs est passée de 2-3 minutes à 1 minute, et rien ne
le crie. Un run qui raccourcit ressemble à un progrès.

C'est le défaut exact de la règle « ce qui contrôle doit être contrôlé », écrite **le jour même**,
deux pas plus bas dans ce fichier. **Une porte a disparu en silence le jour où on a écrit qu'une
porte ne doit pas disparaître en silence.** Le pas lisait bien les codes de sortie — il les lisait
dans un environnement incomplet.

**Corrigé** par `a474d51` : le navigateur s'installe avant les portes.

**#86 : LU, et la chaine est complete.** Etape « Aucun litteral de cle hors config.js », 25 s :

```
> node scripts/verifier-cles.mjs
✗ index-baseline.html : JWT Supabase (ancienne cle anon/service_role) (3 occurrences)
1 fichier(s) portent un litteral de cle hors js/config.js, v2/src/lib/config.ts.
```

C'est `index-baseline.html`, commis contre la regle le matin meme, puis retire par #107
(`fix/retirer-index-baseline`) — ce qui explique que **#87 soit le seul vert de la serie**.

**La chaine, de bout en bout :**

| Run | Fusion | Cause de l'echec |
|---|---|---|
| #86 | #106 | `index-baseline.html` portait un JWT — `verifier:cles` rouge |
| #87 | #107 | **vert** — #107 retirait justement `index-baseline.html` |
| #88–#91 | #108–#111 | `verifier:toutes` lancait e2e avant l'installation du navigateur |

**Deux causes distinctes, separees par un seul run vert.** C'est ce qui a rendu la serie
illisible : elle ne ressemblait pas a une panne unique, donc elle n'a ressemble a rien.

---

## ⚠️ 13/09/2026 — LA PORTE EST OUVERTE SUR UN AUTRE HOTE

**Constaté :** `https://effulgent-kelpie-e48e81.netlify.app` et chaque *Deploy Preview* de PR
servent **l'application complète, porte ouverte** — recherche, prise de rendez-vous, connexion,
téléchargement APK — **branchée sur la base de PRODUCTION** (même clé anon, même projet).

**Toutes les entrées « porte fermée » des déploiements 1 à 9 de ce journal ne valent que pour
Cloudflare Pages.** Elles sont vraies pour l'hôte qu'elles décrivent et fausses pour l'ensemble.

**Pourquoi**, mesuré : `netlify.toml:6` porte `publish = "."` et **aucune `command`**. Netlify sert
la racine du dépôt telle quelle. Or la porte n'est pas dans le code : `scripts/porte.mjs` copie
`porte/porte-fermee.html` **par-dessus `dist-web/index.html`, après le build**, et seule la procédure
manuelle `wrangler` l'exécute. À la racine, `index.html` est l'application entière — 115 765 octets.

**La porte n'est pas une propriété du code. C'est une propriété d'UN geste de déploiement.** Tout
hébergeur qui sert le dépôt sans passer par ce geste sert l'application ouverte.

Action à Aghiles : supprimer ou déconnecter le ou les sites Netlify. Analyse et proposition dans
`.claude/RETOUR.md` du 13/09.

---

Une ligne par déploiement de production, à partir du 13/09/2026. Avant cette date, les déploiements
n'étaient consignés nulle part : c'est ce qui a permis à la production de rester dix-huit jours sur un
état que `main` ne décrivait plus (cf. `PLAN_FUSION.md` §3 quater et `docs/ETAT_PORTE.md`).

Le journal couvre **deux cibles**. Une migration appliquée en production est un déploiement : elle a
son commit, sa date et sa cible de retour, et elle peut casser la production aussi surement qu'un
artefact. Jusqu'au 13/09/2026 le journal ne traçait que Cloudflare — c'est pourquoi la fermeture C1
du 09/09, qui a cassé les avis pendant quatre jours, n'apparaît nulle part.

- **Cloudflare Pages** — l'artefact servi. Table ci-dessous.
- **Base Supabase** — les migrations appliquées. Table « Déploiements de base ».

Hébergement : **Cloudflare Pages**, projet `tabibi-doctor`, branche de production **`main`**, sans
connexion Git — tous les déploiements sont poussés à la main par `wrangler pages deploy`.

Le **retour arrière n'est pas une commande wrangler** : il se fait au tableau de bord,
Workers & Pages → tabibi-doctor → Deployments → menu `···` du déploiement visé → *Rollback to this
deployment*. Atomique, sans reconstruction.

---

| # | Date (UTC) | Commit déployé | Déploiement Cloudflare | Porte | Retour arrière vers | Lancé par |
|---|---|---|---|---|---|---|
| 8 | 2026-09-13 ~11:36 | `47a4b39e10e7b77b220222f0ed7bb4179f3256cb` | `4e66ec32-…` | **fermée** | *aucun — on repare en avant* | Claude, sur go d'Aghiles |
| 7 | 2026-09-13 ~11:02 | `088e166c1baef3d541a3d6b83c04ce55f3a0b4dd` | `42ef43df-…` | **fermée** | `66da5afc-a3af-484f-a02f-4ea96a018d75` | Claude, sur go d'Aghiles |
| 6 | 2026-09-13 ~10:31 | `c37f4e0d8b1d10be6a2a60065523d06328cdd191` | `66da5afc-…` | **fermée** | `55c94431-82f8-48df-80fb-dd91a67637f2` | Claude, sur go d'Aghiles |
| 5 | 2026-09-13 ~10:16 | `8c24384ccd511d4bac455ce1e70e5d1ea02dbd7f` | `55c94431-…` | **fermée** | `1c7f727a-b16f-428a-8add-48e064458a39` | Claude, sur go d'Aghiles |
| 4 | 2026-09-13 ~09:19 | `e94ca04263c9b621160111be9c16cd15fbb09881` | `1c7f727a-…` | **fermée** | `eeeeef33-65c9-4204-b2fe-b66735b6aa9c` | Claude, sur go d'Aghiles |
| 3 | 2026-09-13 ~08:58 | `dc133ebd9dc1a7427fc5bce367112d810080335d` | `eeeeef33-…` | **fermée** | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | Claude, sur go d'Aghiles |
| 2 | 2026-09-13 ~01:30 | `5cec711f90f5b982f4b100eb30ff456753ae97a8` | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | **fermée** | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | Claude, sur go d'Aghiles |
| 1 | 2026-08-26 (reconstitué) | `f06aa3d` (PR #51) | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | fermée | — | non consigné à l'époque |

---

## Déploiements de base

Projet Supabase `pudugodhiofqrctcdwfl` (EU/Francfort). Une ligne par migration appliquée en
production. La migration est écrite et présentée par Claude, **lancée par Aghiles** dans l'éditeur
SQL, jamais appliquée par Claude.

**Le retour arrière n'existe que s'il a été capturé avant.** `CREATE OR REPLACE FUNCTION` écrase
sans laisser de trace : Postgres ne garde aucune version précédente d'un corps de fonction. La
cible de retour n'est donc pas un identifiant fourni par la plateforme, comme chez Cloudflare —
c'est **un fichier du dépôt, généré avant la migration**, contenant les définitions d'avant.
Pas de fichier capturé = pas de retour arrière, quel que soit le plan de sauvegarde.

| # | Date | Migration | Commit | Cible de retour | Vérification | Lancée par |
|---|---|---|---|---|---|---|
| B1 | 2026-09-13 ~14:45 UTC | `20260913_reparation_plpgsql_check.sql` — 15 `CREATE OR REPLACE` | `8e3b05d` (fichier), `e3f1956` (retour arrière) | `20260913_reparation_RETOUR_ARRIERE.sql`, capture `pg_get_functiondef` du 13/09 14:22 UTC, fraîcheur prouvée par 15 empreintes `md5` → 0 ligne | `20260913_reparation_VERIFICATION.sql` → **0 ligne** | Aghiles |
| B4 | 2026-09-13 ~18:00 UTC | `20260913_revoke_ddl_anonyme.sql` — fermeture d'une porte de DDL anonyme | `(consigné après coup)` | `GRANT EXECUTE … TO anon, authenticated` (rouvre la porte) | base : `anon=false` · **sonde HTTP : 401, 42501** | Aghiles, **avant le fichier** |
| B3 | 2026-09-13 ~17:00 UTC | `20260913_audit_log_echecs_politique.sql` — déclarer la permissivité | `d5501e3` | `DROP POLICY audit_log_echecs_insert_permissif ON public.audit_log_echecs` | **3 contrôles sur 3 conformes** | Aghiles |
| B2 | 2026-09-13 ~15:20 UTC | `20260913_audit_log_echecs.sql` — table de rebut | `400f464` | `DROP TABLE public.audit_log_echecs` (additive, aucune donnée) | 6 contrôles conformes — **divergence `rls_active` refermée par mesure** | Aghiles |
| B0 | 2026-09-13 | `20260913_plpgsql_check.sql` (`CREATE EXTENSION`) | — | *sans objet — extension seule* | `plpgsql_check_function_tb` sur le schéma | Aghiles |

### B1 — les cinq mesures fonctionnelles, 13/09/2026

Le balayage à 0 ligne prouve que les quinze corps **compilent**. Les cinq mesures ci-dessous prouvent
qu'ils **fonctionnent**. Lancées dans une transaction annulée d'office (bloc `DO` qui lève toujours) :
rien n'a persisté.

| # | Mesure | Avant | Après | Verdict |
|---|---|---|---|---|
| A | `INSERT` dans `reviews`, statut `published` → déclencheur `fn_update_doctor_rating` | `review_count` = 0 | `rating` = **5.00**, `review_count` = **1** | le déclencheur a **écrit** — dans la table, plus dans la vue |
| B | `tabibi_pii_encrypt` puis `tabibi_pii_decrypt` | — | chiffré **83 octets**, déchiffré = le témoin **exact** | aller-retour **fidèle**, pour la première fois |
| B bis¹ | `tabibi_pii_decrypt(NULL)` | — | `NULL` | la garde explicite tient : **absente** |
| B bis² | `tabibi_pii_decrypt('\x0badc0ffee')` | rendait `NULL` en silence | **lève `39000`** | **illisible** — une panne de déchiffrement se voit enfin |
| C | `record_consent('health_data_processing', …, 'signup')` → `INSERT` d'audit | `audit_log` `consent:grant` = 0 | = **1** | **ligne d'audit écrite** |

B bis¹ et B bis² sont la même fonction sur deux entrées : c'est ce couple qui prouve le retrait du
`EXCEPTION WHEN OTHERS THEN RETURN NULL`. Avant, les deux rendaient `NULL` — **« absente » et
« illisible » étaient la même réponse sur une donnée de santé.** Elles ne le sont plus.

Mesure A : le `INSERT` abouti ne suffisait pas comme preuve. C'est le passage de `review_count` de
0 à 1 qui tranche — un `INSERT` qui passe avec un déclencheur sans effet se serait lu comme un
succès. Même raison pour C : le retour `{"ok": true}` de `record_consent` ne prouve rien seul, c'est
le compteur d'`audit_log` qui prouve.

**Ce que B1 ne fait pas :** aucun régime d'erreur n'a changé. Les sept `EXCEPTION WHEN OTHERS THEN
NULL` des handlers d'audit sont intacts. La table `audit_log_echecs` et les régimes
constitutive/preuve sont la migration suivante — et ce débat cesse d'être théorique maintenant que
l'écriture d'audit fonctionne.

### B2 — la table de rebut, et la divergence restée ouverte

Appliquée au deuxième essai. Le premier a échoué sur `FATAL 53300 — too many clients already` :
échec **à la connexion**, avant toute exécution, rien n'avait été tenté (cf.
`docs/CARTE_CAPACITE_CONNEXIONS.md`).

**Conforme :** `existe` = 1 · droits `anon`/`authenticated`/`PUBLIC` = **AUCUN** · aucune clé
étrangère · aucun déclencheur · aucune politique.

**Divergence, désormais REFERMÉE par mesure.** `rls_active` = **TRUE**, attendu `false`, alors que la
migration ne contient aucun `ENABLE ROW LEVEL SECURITY` (vérifié par analyse du texte).

*Cause, ÉTABLIE — et la première réponse était fausse.* Un `CREATE TABLE public.temoin (id int)` nu,
relu dans la même transaction annulée, sort déjà en `relrowsecurity = true` : l'activation ne vient
d'aucun de nos fichiers. **Nous en avions conclu « en dessous du SQL, `supautils` comme hypothèse ».
C'était faux.** Elle vient d'un déclencheur d'événement, mesuré directement :

| | |
|---|---|
| `ensure_rls` | `ddl_command_end`, actif, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` |
| → `public.rls_auto_enable()` | `SECURITY DEFINER`, propriétaire `postgres`, `search_path pg_catalog` |

Son corps boucle sur `pg_event_trigger_ddl_commands()` et exécute, pour tout objet créé dans
`public` : `alter table if exists %s enable row level security`. C'est lui qui met **55 tables sur
55** sous RLS à leur création.

*Comment on s'est trompés.* Le diagnostic rendait 19 lignes ; une partie a été lue, et l'absence
d'une ligne qu'on n'avait pas cherchée jusqu'au bout a été rapportée comme un fait. Même classe
d'erreur que le `sha256` qui était un MD5 et que la taille servie du `mailto:` : **conclure sur ce
qu'on a vu, pas sur ce qu'il y avait.** La piste « un `ENABLE` qu'aucun fichier ne contient vient
presque toujours d'un déclencheur d'événement sur `ddl_command_end` » était la bonne, et elle a été
fermée d'un cran trop tôt.

*Ligne ouverte :* `ensure_rls` est **absent du dépôt et de l'historique git** — installé hors
fichier. Il est probablement utile. Mais un mécanisme que personne n'a écrit dans le dépôt doit y
être écrit, ou retiré. À décider, pas maintenant.

*Ce n'est pas propre à cette table.* `public` compte **55 tables, 55 avec RLS active, 0 sans**. Les
15 dernières créées sont toutes à `true`.

*La trouvaille « 20 tables en refus par défaut » se referme, elle aussi, sur une mesure et non sur
une lecture.* Elles sont **19** — `audit_log_echecs` a quitté la liste, ce qui prouve au passage que
la politique B3 est en place. Ces 19 sont **16 tables `api_usage_log_*`** (une par jour, du 18 mai au
2 juin), **`appointment_notifications`**, **`prescription_seq_year`** et **`rate_limits`**. Droits
`anon`/`authenticated` : **AUCUN sur les 19**. Le refus par défaut ne protège donc rien que les
`REVOKE` ne ferment déjà : ce n'est pas un trou, c'est une **double fermeture sur des tables
internes**. À consigner, pas à corriger.

Deux lignes en sortaient, indépendantes du rebut. **La première est refermée le jour même.**

*L'outbox `appointment_notifications` — verdict V1, le piège n'existe pas.* Un seul écrivain, zéro
ligne, handler nu : on ne pouvait pas distinguer « aucun rendez-vous n'a jamais été confirmé » de
« chaque confirmation a échoué en silence ». Mesure `20260913_outbox_confirmations.sql`, un
rendez-vous réel poussé dans tous les statuts : la transition vers `confirmed` **fait arriver la
ligne** (outbox 0 → 1), les quatre autres ne déclenchent rien, conformément au `WHEN`. Déclencheur,
`WHEN`, `INSERT` et table sont **sains**. Le vide venait de l'absence d'usage : **la base entière
contient un seul rendez-vous**, créé le 13/09, statut `cancelled`. Porte fermée, zéro utilisateur.

C'est le contre-exemple qui manquait à la journée : `une table à zéro ligne est un soupçon, jamais
une donnée` — et un soupçon peut se lever. Ici il s'est levé par l'exercice, pas par le raisonnement.

*L'arrêt net des `api_usage_log_*` au 2 juin* reste ouverte
(`supabase/mesures/20260913_api_usage_log_arret.sql`).

Cf. `docs/CARTE_RLS_SANS_POLITIQUE.md`, qui porte le détail et l'entrée de régime à trancher sur le
handler nu de l'outbox.

#### La propriété critique, prouvée et non déduite

La spécification de cette table est « elle ne peut échouer que sur disque plein ». Une RLS active
sans aucune politique est un refus par défaut : il fallait prouver que l'écriture arrive quand même,
pas le déduire du contournement par le propriétaire.

`supabase/mesures/20260913_rebut_ecriture_preuve.sql`, transaction annulée :

| Face | Chemin | Résultat |
|---|---|---|
| 1 | `authenticated`, `INSERT` **direct** | **REFUSÉ `42501`** — permission denied for table |
| 2 | `authenticated`, via fonction `SECURITY DEFINER` (régime exact des sept) | **ABOUTI** |
| — | relecture | lignes 0 → 1, contenu relu = `'ligne-temoin-13-09-2026'` |

État au moment de la mesure : `RLS=true`, propriétaire `postgres`, **0 politique**.

**Ce que la face 1 prouve exactement — et ce qu'elle ne prouve pas.** `42501 permission denied for
table` est un refus de **privilège**, pas de RLS : un refus RLS s'annonce
`new row violates row-level security policy`. Ce sont donc les `REVOKE` qui ferment la porte, et la
RLS n'a jamais été mise à l'épreuve — elle est derrière le contrôle de droits, qui tranche en
premier. La double fermeture existe ; une seule des deux a été exercée.

**Le mécanisme réel, et ma correction.** J'avais écrit que la face 2 réussissait grâce à l'exemption
du propriétaire, et qu'un `ALTER TABLE … FORCE ROW LEVEL SECURITY` ferait échouer toutes les
écritures de rebut. **Mesure D1 : avec `FORCE` et zéro politique, l'écriture passe encore.** `FORCE`
retire l'exemption du *propriétaire* ; il ne retire pas l'attribut de *rôle* `BYPASSRLS`, et
`postgres` le porte. Le scénario de panne que je décrivais ne peut pas se produire.

La conclusion survit, portée par autre chose que ce que je croyais : **ce qui porte l'écriture est
`BYPASSRLS`** — plus solide que l'exemption du propriétaire, et toujours pas déclaré. Rien dans le
schéma ne dit que cette table accepte les écritures. D'où B3.

---
### B3 — déclarer la permissivité, et la mesure qui la justifie

La politique existe : `audit_log_echecs` a **quitté** la liste des tables « RLS active, zéro
politique », qui est passée de 20 à 19. C'est une preuve d'état, pas une lecture de fichier.

**Ce qui justifie B3 n'est pas un raisonnement mais la mesure E1/E2**
(`20260913_politique_sans_bypassrls.sql`, lancée en production, transaction annulée). Un rôle
`NOLOGIN` **sans `BYPASSRLS`**, non propriétaire, possédant une fonction `SECURITY DEFINER`, avec
`FORCE` actif :

| | | |
|---|---|---|
| **E1** | sans politique | **REFUSÉ `42501` — `new row violates row-level security policy`** |
| **E2** | avec politique | **ABOUTI** |

**La politique porte l'écriture ; `BYPASSRLS` ne fait que la masquer.** Sans cette mesure, B3
déclarait une permissivité qu'on n'avait jamais vue agir.

Le `SQLSTATE` de E1 est le même `42501` que le refus du matin, mais **le message diffère** :
`permission denied for table` (refus de privilège) contre `new row violates row-level security
policy` (refus de RLS). C'est la première fois de la journée que la RLS est **réellement exercée**
sur cette table — tous les refus précédents s'arrêtaient au contrôle de droits, qui tranche avant.
Le dispositif accorde délibérément `INSERT` au rôle témoin pour cette raison : sans ce `GRANT`, E1
aurait échoué sur les privilèges et n'aurait rien appris.

*Deux corrections d'Aghiles ont été nécessaires pour que la mesure atteigne E1* (appartenance au rôle
créé, puis `CREATE` sur le schéma pour le transfert de propriété). Elles restent dans le fichier,
commentées. Ni l'appartenance ni `CREATE` sur un schéma ne sont `BYPASSRLS` ou une exemption de
politique — et `E1 refuse`, ce qui le prouve à l'exécution plutôt qu'au raisonnement.

**Vérification, passage séparé, trois contrôles sur trois conformes :**

| Contrôle | Valeur | Attendu |
|---|---|---|
| `politique_existe` | 1 | 1 |
| `commande` | `INSERT` | `INSERT` |
| `droits_anon_authenticated` | **AUCUN** | **AUCUN** |

Le troisième est le seul qui compte vraiment : il prouve que poser une politique permissive n'a
**rien ouvert**. Les `REVOKE` restent la porte ; la politique déclare seulement qu'une fois la porte
franchie, aucune ligne n'est filtrée.

Les deux premiers étaient nécessaires parce que quitter la liste des « zéro politique » prouve
qu'**une** politique existe, pas **laquelle**. B3 est close.

---
**Règles de la colonne « Cible de retour » :**
- Une migration qui remplace du code (`CREATE OR REPLACE`, `ALTER`) exige un fichier de capture
  **généré et versionné avant** son application. Il ne se lance pas ; il existe.
- Un fichier de capture se vérifie **fidèle** avant qu'on s'y fie : empreintes `md5` des définitions
  vivantes comparées à celles de la capture, en lecture seule, dans un passage séparé.
- Une migration additive (nouvelle table, nouvel index) note sa cible de retour en clair
  (`DROP TABLE ...`), pas « — ».
- *Sans objet* est une réponse valable, mais elle s'écrit et se justifie.

**Trois passages séparés, toujours** — l'éditeur SQL de Supabase enveloppe tout un script dans UNE
transaction, donc une vérification ajoutée au script peut annuler la migration en échouant :
1. la vérification de fraîcheur de la capture (lecture seule, doit rendre 0 ligne) ;
2. la migration, **seule** ;
3. la vérification, **seule**, qui doit rendre 0 ligne.

---

## Gabarit — a recopier pour chaque deploiement

### Avant d'envoyer — lignes a cocher

- [ ] **Enum des statuts de rendez-vous.** `SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) node scripts/verifier-statuts.mjs --base` → `Statuts alignes.`, sortie 0. **Si elle echoue, on n'envoie pas.** Jeton local, aucun secret en CI. Pourquoi cette etape vit ici et pas dans un workflow : `docs/VERIFICATION_DEPLOIEMENT_PORTE_FERMEE.md`.
- [ ] Les portes locales passent : `eslint`, `lint:dette`, `i18n:verifier`, `verifier:cles`, `verifier:c1`, `verifier:statuts`, `build`, `test:e2e`.
- [ ] **Parcours permanent « aucun bouton ne ment »** sur `dist-web` : `grep -rnE 'onclick="[^"]*(alert|confirm)\(' dist-web/*.html dist-web/legal/*.html` — zero menteur actif.
- [ ] **Parcours 4, fixture sale** : `npx playwright test tests/e2e/parcours-4-fixture-sale.spec.js --project=desktop` — 3 verts, **captures regardees**, pas seulement le vert du test.
- [ ] Branche de production du projet Pages verifiee (`main`).
- [ ] Etat de la porte decide et applique (`node scripts/porte.mjs fermee|ouverte`).
- [ ] **Les mesures annoncees, chiffrees, ECRITES avant l'envoi.** Une taille se mesure sur ce qui sera **servi**, pas sur ce qui est construit : Cloudflare reecrit les `mailto:` (+316 o constates au deploiement 4).
- [ ] Cible de retour arriere notee — l'identifiant du deploiement actuellement en production.

### Apres l'envoi — sur le domaine reel, cache-bust

- [ ] Les mesures constatees, en face des annoncees. **Toute divergence est expliquee, pas absorbee.**
- [ ] Parcours permanent rejoue **sur le domaine reel** : la production reecrit le HTML servi.
- [ ] Ligne ajoutee au tableau en tete de ce journal.

---

## Déploiement 2 — 13/09/2026, la vague de fusion, porte fermée

**Ce qui est parti** : la vague de fusion de #56 (dix-huit PR en trois paquets, plus #76, #77, #78),
plus le mécanisme d'état de porte (#91) et le correctif d'indexation de l'accueil public.

**Pourquoi porte fermée** : la revendication médecin n'existe pas, aucun e-mail transactionnel ne part,
personne ne peut réinitialiser son mot de passe, la conformité 25-11 n'est pas faite. Le lancement
public reste annoncé pour décembre 2026.

### Conditions vérifiées avant l'envoi

| Condition | Constat |
|---|---|
| branche de production du projet Pages | **`main`** — lu dans Settings → General. Un `--branch=main` part donc bien en production, pas en aperçu |
| `accueil-public.html` indexable ? | **oui, et corrigé avant l'envoi** : `index.html` porte `index,follow`, la copie l'héritait. `scripts/porte.mjs` force désormais `noindex,nofollow` sur la copie, et `robots.txt` gagne un `Disallow: /accueil-public.html` |

### Les cinq mesures, annoncées avant, constatées après

| Mesure | Avant | Annoncé | Constaté |
|---|---|---|---|
| taille de `/` | 4 919 o | ~5 004 o | **5 004 o** |
| titre | Bientôt disponible | inchangé | **inchangé** |
| balise `tabibi-porte` | absente | `fermee` | **`fermee`** |
| `/accueil-public.html` | 404 | 200 | **200** |
| `sha256` de `/` | `f37749f8…de469` | doit changer | **`742f7542…2dab4`** |

Aucune divergence.

### Contrôles complémentaires

- **Seize chemins testés**, tous en 200 : l'accueil fermé, l'accueil public, `login`, `signup`,
  `reservation`, les deux tableaux de bord, `mes-rdv`, `about`, `telecharger`, une page légale, `404`,
  `robots.txt`, `sitemap.xml`, `js/home-app.js`, `js/config.js`.
- **Marqueurs de la vague en ligne** : SDK Supabase local sur `login`, `ERR_SLOT_OUTSIDE_HOURS` sur
  `reservation`, `ID-ESPACE` et « DANS l'onglet Agenda » sur le tableau de bord médecin, `_tbCle` dans
  `js/home-app.js`.
- **CSP resserrée** comme prévu : `script-src` ne contient plus ni `cdn.jsdelivr.net` ni
  `cdnjs.cloudflare.com`.
- **Console propre** sur `/`, `login`, `reservation` et `accueil-public` : trois messages
  d'information, `env=production`, **zéro erreur, zéro violation CSP**.
- `accueil-public.html` sert bien les vraies données (59 wilayas, 40 spécialités) tout en portant
  `noindex,nofollow`.

### Ce que ce déploiement ne fait pas

Il ne touche pas à la base. Porte fermée, la page d'entrée est statique : une suspension Supabase ne
casserait pas ce qui est en ligne. C'est ce qui a permis de déployer sans attendre la facture.

---

## Déploiement 3 — 13/09/2026, #72 (suppression de compte par canal humain)

**Ce qui est parti** : la fusion de #72, restée ouverte pendant toute la vague. `medecin-profile.html`
portait encore deux boutons **actifs** — un `alert()` annonçant une mise en pause inexistante, et un
`confirm()` de suppression définitive qui ne supprimait rien. Ils étaient en production depuis toujours,
y compris après le déploiement 2.

### Les mesures

| Mesure | Avant | Annoncé | Constaté |
|---|---|---|---|
| taille de `/` | 5 004 o | inchangée | **5 004 o** |
| titre | Bientôt disponible | inchangé | **inchangé** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` | 200 + `noindex,nofollow` | inchangé | **200 + `noindex,nofollow`** |
| `medecin-profile.html`, boutons menteurs | **2** | **0** | **0** |

**Le `sha256` de `/` change à chaque déploiement même quand rien ne bouge** : la balise de porte
contient un `data-genere` horodaté. C'est voulu pour dater l'état en ligne, mais cela rend la
comparaison d'empreintes inutilisable pour détecter un vrai changement. La taille, elle, reste stable.

### Contrôle ajouté — les boutons qui annoncent au lieu d'agir

Une console propre ne détecte pas un bouton qui ment : il faut le chercher dans le HTML servi.
Audit sur 53 pages du dépôt, puis vérification sur le domaine réel.

| Page servie | Boutons `alert`/`confirm` |
|---|---|
| `patient-profile.html` | 3 |
| `admin-dashboard.html` | 3 |
| `doctor-dashboard.html` | 3 |
| `patient-dashboard.html` | 1 |
| `doctor-profile.html` | 1 |
| `medecin-profile.html` | **0** — corrigé par #72 |
| `index.html`, `accueil-public`, `secretaire-dashboard`, `mes-rdv`, `reservation`, `login`, `signup` | 0 |

Onze boutons au total. **Six affirment une action qui n'a pas lieu.** Aucun n'est une regression :
tous precedent la vague, et **aucun n'est corrige par ce deploiement** — les six sont actifs en
production au 13/09/2026 (aucun ne porte `disabled`).

| # | Fichier:ligne | Ce que le bouton annonce | Ce qu'il fait reellement |
|---|---|---|---|
| 1 | `admin-dashboard.html:39` | « 3 alertes admin · 7 medecins en attente · 5 signalements » | rien. Les trois nombres sont ecrits en dur ; la cle i18n s'appelle litteralement `alert_admin_notif_demo`. Des chiffres inventes presentes comme un etat reel. |
| 2 | `admin-dashboard.html:141` | « Export CSV en cours... » | rien. Aucune requete, aucun fichier. |
| 3 | `admin-dashboard.html:142` | « Backup cree » | rien. **Le plus grave des trois** : passe compose, il affirme une sauvegarde accomplie. |
| 4 | `patient-dashboard.html:853` | « Telechargement de \<nom du document\> » | rien. Aucun telechargement ne demarre. |
| 5 | `patient-profile.html:248` | « Demande envoyee — reponse sous 30 jours (RGPD) » | rien. **Le plus grave de tous** : le patient croit avoir exerce un droit legal. Rien n'est envoye, personne n'est saisi, le delai de 30 jours ne court pas. |
| 6 | `doctor-profile.html:60` | « Lien copie » (repli quand `navigator.share` est absent) | rien n'est ecrit dans le presse-papiers. Sur desktop, ou `navigator.share` n'existe pas, c'est le cas par defaut. |

Les cinq autres ne mentent pas et n'ont pas a etre touches : `patient-profile.html:99`
(« Module mesures · Bientot disponible ») annonce honnetement une absence ; `doctor-dashboard.html:182`
affiche l'adresse du support ; `doctor-dashboard.html:716` et `:883` affichent de vraies donnees de la
ligne cliquee (vue de detail du pauvre). Cas limite a part : `patient-profile.html:111` renvoie en
popup son propre libelle (« Prendre RDV vaccination ») — il n'affirme rien de faux, mais c'est un
bouton mort sans indication. A trancher avec les six autres.

---

### Piege de mesure — l'obfuscation d'e-mail de Cloudflare

Verification demandee le 13/09 : `contact@tabibi.doctor` est-il present sur `medecin-profile` en
production ? Un `grep` sur le HTML servi renvoie **0**. La conclusion evidente — « le medecin n'a
aucune porte de sortie indiquee » — est fausse.

Cloudflare a **Email Address Obfuscation** actif. Tout `href="mailto:…"` est reecrit dans la reponse :

    <a href="/cdn-cgi/l/email-protection#e5868a8b91848691a5…">
      <span class="__cf_email__" data-cfemail="781b17160c191b0c380c191a111a11561c171b0c170a">[email&#160;protected]</span></a>

Decodage (1er octet = cle, XOR sur les suivants) : **`contact@tabibi.doctor`**. Le decodeur
`/cdn-cgi/scripts/…/email-decode.min.js` est servi par la meme origine (HTTP 200, 1 239 o), donc
autorise par `'self'` sans elargir la CSP.

Trois consequences a retenir :

1. **Chercher une adresse e-mail par `grep` sur le HTML servi ne prouve rien.** Il faut decoder
   `data-cfemail`, ou mesurer le rendu apres execution du JS.
2. **`patient-profile` echappe a la reecriture parce qu'il n'utilise pas de lien.** Son adresse est
   dans un attribut `title` (survol seulement — invisible au doigt sur mobile) et dans une chaine JS
   d'un bouton desactive, donc inatteignable. Sa porte de sortie est en realite **plus faible** que
   celle de `medecin-profile`, qui porte une note visible sous les deux boutons.
3. **Le repli sans JS reste mauvais** : le medecin lit alors « [email protected] », inutilisable. Mais
   la meme note renvoie vers `legal/rgpd-droits.html` (HTTP 200), qui donne la procedure complete et
   le **telephone en clair** `+213 777 16 90 74` — non obfusque, lui. La porte de sortie survit donc
   a une panne de JS, par le telephone.

A decider : uniformiser les deux pages sur le modele visible de `medecin-profile`, et rendre le
telephone present des la page de profil plutot qu'a un clic de distance.

---

## Deploiement 4 — 13/09/2026, les boutons honnetes

**Ce qui est parti** : #93 (aucun bouton n'annonce ce qu'il ne fait pas), #94 (vendorisation du SDK
Daily, retrait d'`unpkg.com` de `script-src`), #95 (documentation). Trois fusions locales, chacune
verifiee avant la suivante.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| titre | Bientot disponible | inchange | **inchange** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` | 200 + `noindex,nofollow` | 200 + `noindex,nofollow` | **200 + `noindex,nofollow`** |
| `script-src` contient `unpkg.com` | oui | **non** | **non** |
| boutons menteurs actifs | **6** | **0** | **0** |

### Une divergence, et ce qu'elle apprend

**Taille de `/accueil-public.html` : annoncee 115 952 o, servie 116 268 o. Ecart de 316 octets.**

Ce n'est pas un defaut de deploiement. J'avais annonce la taille du fichier **construit**, alors que
la production sert le fichier **reecrit** : Cloudflare transforme les 2 `href="mailto:"` de la page en
un `__cf_email__` et injecte la balise du decodeur. Verifie : `mailto:` = 2 dans `dist-web`, **0** dans
la page servie ; `__cf_email__` = 0 dans `dist-web`, **1** dans la page servie ; une balise
`email-decode.min.js` en plus.

C'est exactement le piege consigne le matin meme dans `DEPLOY_FRONTEND.md`, section « Reglages cote
hebergeur qui reecrivent le HTML servi » — et je l'ai refait dans l'heure. **Regle qui en decoule :
une taille annoncee doit etre mesuree sur ce qui sera servi, pas sur ce qui est construit.** Pour
toute page contenant un `mailto:`, prevoir l'ecart, ou comparer autre chose que la taille.

### Parcours permanent — zero bouton actif annoncant une action accomplie

Nouveau controle de la fiche de recette, mesure **sur le domaine reel** et pas seulement sur
`dist-web`, precisement parce que la production reecrit le HTML. Vingt pages balayees avec cache-bust :

| Page servie | `onclick` `alert`/`confirm` | Verdict |
|---|---|---|
| `patient-profile` | 1 | honnete — « Module mesures · Bientot disponible » |
| `doctor-dashboard` | 3 | honnetes — adresse du support, et deux vues de detail sur de vraies donnees |
| les dix-huit autres | 0 | — |

**Total : 4, tous honnetes. Zero menteur actif** — contre six avant ce deploiement.

Ce que la production portait encore hier et ne porte plus : les faux compteurs de la cloche admin
(supprimee), « Export CSV en cours... » et « Backup cree » (desactives), « Telechargement de … »
(desactive), « Demande envoyee — reponse sous 30 jours (RGPD) » (desactive, avec porte de sortie),
« Lien copie » (remplace par une vraie copie presse-papiers).

### Les portes de sortie, verifiees en ligne

`patient-profile` sert **2 notes visibles**, **2 liens `tel:+213777169074`**, **2 renvois vers
`legal/rgpd-droits.html`**, et **2 badges SUR DEMANDE**. Le telephone est la parce que `tel:` echappe
a la reecriture Cloudflare, contrairement au `mailto:` : c'est le seul element de la note qui reste
lisible si le decodeur ne s'execute pas. `doctor-profile` sert bien `clipboard.writeText`.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Porte fermee, la page d'entree reste statique.

---

---

## Deploiement 5 — 13/09/2026, le statut de rendez-vous

**Ce qui est parti** : #96 (journal du deploiement 4) et #97 (source unique du statut de
rendez-vous). Premier deploiement conduit avec le gabarit ci-dessus.

### Etape obligatoire, cochee en premier

`node scripts/verifier-statuts.mjs --base` → `Statuts alignes.`, sortie 0, les cinq valeurs de
`appointment_status` dans le meme ordre que l'utilitaire. Jeton local, aucun secret en CI.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `/accueil-public.html` **servi** | 116 268 o | 116 268 o | **116 268 o** |
| `doctor-dashboard` : `const STATUS_MAP =` | 1 | 0 | **0** |
| `doctor-dashboard` : ternaire au vert par defaut | 3 | 0 | **0** |
| `doctor-dashboard` : compteur « Absents » | 0 | 2 | **2** |
| `js/tabibi-statut-rdv.js` | absent | 200 | **200, 4 420 o** |
| boutons menteurs actifs | 0 | 0 | **0** |

**Aucune divergence.** La taille de `accueil-public.html` a ete annoncee a 116 268 o — soit les
115 952 o construits **plus les 316 o de la reecriture Cloudflare** des deux `mailto:`. C'est la
correction directe de l'erreur du deploiement 4, ou la taille du fichier construit avait ete annoncee
telle quelle. La regle tient : une taille annoncee se mesure sur ce qui sera servi.

### Ce que la production ne porte plus

Le ternaire `status==='Confirmed' ? bleu : status==='Pending' ? ambre : **vert**` a disparu des trois
endroits ou il vivait. Un rendez-vous annule, un absent, un statut inconnu ne peuvent plus sortir
verts. `STATUS_MAP`, qui inventait des valeurs capitalisees absentes de l'enum et repliait tout
inconnu sur « En attente », n'est plus servi.

Le tableau de bord medecin sert desormais deux compteurs distincts : « Consultations du mois »
(`completed` seul) et « Absents » (`no_show`). Il comptait jusqu'ici tous les rendez-vous du mois,
annules compris.

### Parcours permanent, sur le domaine reel

Vingt pages, cache-bust : `patient-profile` 1, `doctor-dashboard` 3, zero ailleurs. **Quatre au
total, tous honnetes.** `mes-rdv` et `patient-dashboard` servent bien `tabibiStatutRdv`.

### Parcours 4 avant l'envoi

3 verts, et **les captures regardees** — pas seulement produites. C'est ainsi qu'on avait vu, la
veille, que les quatre cartes gardaient une bordure verte malgre des badges corrects. Cette fois les
bordures sont distinctes : grise pour l'honore, rouge pour l'annule, grise pour l'absent, neutre
hachuree pour l'inconnu.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Il ne contient ni le retrait de `googletagmanager` de la CSP, ni la
suppression du DOM mort : les deux PR attendent une validation.

---

## Deploiement 6 — 13/09/2026, la CSP et le DOM mort

**Ce qui est parti** : #98 (retrait de `googletagmanager` de `script-src`), #99 (suppression du DOM
mort de `patient-dashboard` et du panneau `#tab-stats`, plus la garde `verifier:panneaux`), #100
(journal du deploiement 5). Ces deux premieres changent ce qui est **servi** — la politique et le
DOM — donc elles ne valaient rien tant qu'elles n'etaient pas en ligne.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `script-src` : `googletagmanager` | 1 | 0 | **0** |
| `script-src` : origines `https` | 5 | 4 | **4** |
| `patient-dashboard` : `#tab-book` | 1 | 0 | **0** |
| `patient-dashboard` : `#tab-rdv` | 1 | 0 | **0** |
| `patient-dashboard` : `#book-modal` | 1 | 0 | **0** |
| `openBooking` defini | 2 | 1 | **1** |
| Favoris : cartes `onclick="openBooking` | 2 | 1 | **1** |
| boutons menteurs actifs | 0 | 0 | **0** |

Aucune divergence.

### La mesure qui pouvait casser, prouvee au navigateur sur le domaine reel

Un `grep` sur le HTML servi dit que le DOM mort n'y est plus. Il ne dit **pas** que les Favoris
fonctionnent encore. Or c'est precisement le risque : `openBooking` etait la seule fonction du bloc
supprime a avoir un appelant vivant — le panneau Favoris genere ses cartes avec
`onclick="openBooking(...)"`.

Mesure sur `https://tabibi.doctor`, avec un vrai medecin public mis en favori :

```
FAVORIS : {"cartes":1,
           "onclick":"openBooking('023bbccc-e2ba-45ad-8c9a-8fca85da18fa')",
           "texte":"OD Dr. Ouanza Dental Clinic Dentiste · Adrar 1,500 DA Reserver"}
erreurs : AUCUNE
apres clic ->  /doctor-profile?id=023bbccc-e
```

La chaine tient de bout en bout : la carte rend, le gestionnaire est en place, le clic mene bien a
la fiche du medecin. **Zero `pageerror`.** Les panneaux servis sont `tab-overview`, `tab-docs`,
`tab-favs` — les trois qui ont un declencheur.

### Parcours permanent, sur le domaine reel

Vingt pages, cache-bust : `patient-profile` 1, `doctor-dashboard` 3, zero ailleurs. Quatre au total,
tous honnetes.

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base. Il ne comble pas le manque produit revele par la suppression de
`#tab-stats` : ni les revenus par semaine, ni les types de consultation, ni les modes de paiement ne
sont couverts par `doctor-analytics.html` — mesure du 13/09, carte produit ouverte a part.

---

## Deploiement 7 — 13/09/2026, le fuseau du cabinet

**Ce qui est parti** : #101 (regle de fusion), #102 (journal 6) et #103 (le fuseau du cabinet).

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| taille de `/` | 5 004 o | 5 004 o | **5 004 o** |
| balise `tabibi-porte` | `fermee` | `fermee` | **`fermee`** |
| `secretaire` : `new Date(date+'T'+time)` a l'ECRITURE | 1 | 0 | **0** |
| `secretaire` : `instantDepuisJourEtHeure` | 0 | 1 | **1** |
| `js/tabibi-temps.js` | 404 | 200 | **200, 8 223 o** |
| `doctor-dashboard` : `toISOString().split('T')[0]` | 5 | 0 | **0** |
| boutons menteurs actifs | 4 honnetes | 4 honnetes | **4 honnetes** |

Aucune divergence.

### La mesure du fuseau, sur le domaine reel

Le rendez-vous **reel de la base** — `2026-09-14 08:00:00+00`, soit 09:00 pile heure cabinet — lu
depuis trois navigateurs depayses, sur `https://tabibi.doctor` :

```
UTC              heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
Europe/Paris     heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
Africa/Algiers   heure=09:00  | Dr. Reel lundi 14 septembre 2026 · 09:00 Cabinet Confirme
```

Depuis UTC, cette page affichait **08:00** avant ce deploiement. Captures :
`docs/preuves/deploiement7-*.png`, regardees.

### L'ecriture, qui est le point le plus grave

`secretaire-dashboard.html` ne sert plus `new Date(date + "T" + time + ":00").toISOString()`.
Depuis Paris, un rendez-vous saisi a 09:00 partait a `07:00Z`, soit **08:00 heure cabinet** : pas un
defaut d'affichage, une **donnee fausse**. Et un instant faux ecrit en base est indiscernable d'un
instant juste — aucun audit posterieur ne peut le retrouver.

La base ne contenait qu'une ligne, correcte. Avec six mois de rendez-vous, ce defaut aurait produit
des degats irreparables et invisibles. C'est pourquoi la garde vit au point d'ecriture, pas a la
lecture (`docs/RECETTE_VAGUE_2026-09.md`).

### Ce que ce deploiement ne fait pas

Il ne touche pas a la base — rien a rattraper, la seule ligne existante est juste. Il ne corrige pas
le fuseau code en dur dans les migrations SQL (`get_available_slots`, la garde de disponibilite, le
trigger de notifications) : le jour ou le fuseau deviendra une colonne, il faudra les deux couches.

---

## Deploiement 8 — 13/09/2026, la grille d'agenda cassee

**Deploiement correctif.** Le deploiement 7 a mis en ligne une regression que j'avais introduite :
`${dt.getDate()}` laisse dans le gabarit de la grille de semaine, ou `dt` n'existait plus.

**Pas de retour arriere.** Revenir a `66da5afc` aurait retabli la grille mais **re-expose l'ecriture
fausse en base** corrigee au deploiement 7 — decision d'Aghiles : on repare en avant.

### Les mesures, annoncees avant, constatees apres

| Mesure | Avant | Annonce | Constate |
|---|---|---|---|
| **grille d'agenda : cases affichees** | **0** | **7** | **7** |
| `doctor-dashboard` : `${dt.getDate()}` | 1 | 0 | **0** |
| `doctor-dashboard` : `function _todayLocalIso` | 1 | 0 | **0** |
| `doctor-dashboard` : composantes d'horloge locale | 9 | 0 | **0** |
| `patient-dashboard` : `getHours()` sur un creneau | 1 | 0 | **0** |
| taille de `/` · porte | 5 004 o · `fermee` | inchangees | **inchangees** |

Aucune divergence.

### La mesure qui compte, EXERCEE sur le domaine reel

```
cases : 7
jours : ["lun. 7","mar. 8","mer. 9","jeu. 10","ven. 11","sam. 12","dim. 13 1 RDV"]
erreurs : AUCUNE
```

Capture : `docs/preuves/deploiement8-agenda.png`, regardee.

**Avant ce deploiement, la meme mesure donnait `cases: 0` et `erreurs: AUCUNE`.** La console propre
ne prouvait rien. La regle est desormais en tete de la fiche de recette — *une page qui charge n'est
pas une page qui marche*.

### Ce que ce deploiement a fait apparaitre

L'inventaire des `try/catch` silencieux a trouve **un second defaut du meme type** :
`submitReview()` de `patient-dashboard` appelait `filtRdv(...)`, supprimee le meme jour. Le chemin
est atteignable — `openReview` retombe sur l'ancienne modale quand le `doctor_id` n'est pas un UUID
— et « Publier mon avis » levait une `ReferenceError`. Corrige avant ce deploiement. Voir
`docs/FICHE_CATCH_SILENCIEUX.md`.

**L'inventaire a trouve un bug que les tests n'avaient pas trouve.**

