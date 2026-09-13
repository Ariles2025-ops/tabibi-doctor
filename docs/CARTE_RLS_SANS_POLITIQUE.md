# Carte — RLS active partout, et les tables en refus par défaut

**Ouverte le 13/09/2026.** Née d'une divergence de vérification sur `audit_log_echecs`, refermée le
même jour sur des mesures. Hors code.

## Le fait, mesuré et non déduit

Le schéma `public` compte **55 tables, 55 avec RLS active, 0 sans**. Ce n'est pas nous : un
`CREATE TABLE public.temoin (id int)` **nu**, relu dans la même transaction annulée, sort déjà en
`relrowsecurity = true`.

> **Ce paragraphe était FAUX. Conservé tel quel, corrigé dessous.**
>
> Les 7 déclencheurs d'événement du projet concernent `pg_cron`, `pg_graphql`, `pg_net` et
> PostgREST — aucun ne mentionne `row level security`. **Toutes les explications au niveau SQL
> sont éliminées** : l'activation a lieu en dessous, dans une bibliothèque préchargée.
> `supautils` est l'hypothèse — les GUC `supautils.*` sont présents, `shared_preload_libraries`
> ne le nomme pas — et elle reste écrite comme hypothèse.

**Correction du 13/09/2026.** L'activation vient bien d'un déclencheur d'événement, au niveau SQL.
Mesure directe sur `pg_event_trigger`, rapportée par le stratège :

| | |
|---|---|
| `ensure_rls` | `ddl_command_end`, actif, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` |
| → `public.rls_auto_enable()` | `SECURITY DEFINER`, propriétaire `postgres`, `search_path pg_catalog` |

Le corps boucle sur `pg_event_trigger_ddl_commands()` et, pour tout objet créé dans `public` :

```sql
EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
```

**D'où venait l'erreur.** Le diagnostic rendait 19 lignes ; seule une partie a été lue, et
l'absence d'une ligne qui n'avait pas été cherchée jusqu'au bout a été rapportée comme un fait.
**Conclure sur ce qu'on a vu, pas sur ce qu'il y avait** — même classe d'erreur que le `sha256`
pris pour un MD5 et que le `mailto:` réécrit par Cloudflare. La bonne piste avait été donnée :
« un `ENABLE` qu'aucun fichier ne contient vient presque toujours d'un déclencheur d'événement
sur `ddl_command_end` ».

**Ce que ça ne change pas** : la décision C tient, la politique reste démontrée par E1/E2.
**Ce que ça ouvre** : `ensure_rls` est absent du dépôt et de l'historique git — installé hors
fichier. Il met 55 tables sur 55 sous RLS, donc il est probablement utile ; mais **un mécanisme
que personne n'a écrit dans le dépôt doit y être écrit, ou retiré.** À trancher, pas maintenant —
la ligne est ouverte dans `docs/CARTE_SECURITY_DEFINER_ANONYMES.md`.

## Les 19 en refus par défaut — ce n'est pas un trou

RLS active **et zéro politique** = refus par défaut. Dix-neuf tables sont dans ce cas :

| Tables | |
|---|---|
| `api_usage_log_20260518` … `api_usage_log_20260602` | 16, une par jour, du 18 mai au 2 juin |
| `appointment_notifications` | `[FORCE]` — même le propriétaire y serait refusé sans `BYPASSRLS` |
| `prescription_seq_year` | |
| `rate_limits` | |

**Droits `anon`/`authenticated` : AUCUN sur les dix-neuf.** Le refus par défaut ne protège donc rien
que les `REVOKE` ne ferment déjà : ce n'est pas un trou, c'est une **double fermeture sur des tables
internes**. À consigner, pas à corriger.

Elles étaient vingt avant la migration B3 : `audit_log_echecs` a quitté la liste en recevant sa
politique. C'est ce qui a servi de preuve d'état que B3 était en place.

## Ce que la RLS ne fait pas, et qu'on a cru deux fois

Un refus de **privilège** et un refus de **RLS** portent le même `SQLSTATE 42501`, avec deux messages
différents :

- `permission denied for table` → les `GRANT`/`REVOKE`, qui tranchent **en premier** ;
- `new row violates row-level security policy` → la RLS, qui ne s'exprime qu'après.

Toutes les mesures du 13/09 se sont arrêtées au premier contrôle, sauf une : celle qui accordait
délibérément `INSERT` au rôle témoin pour n'éprouver que la RLS. **C'est le seul moment de la journée
où la RLS a réellement été exercée.** Une barrière qu'on n'atteint jamais ne se mesure pas : elle se
suppose.

Corollaire retenu : `FORCE ROW LEVEL SECURITY` retire l'exemption du **propriétaire**, jamais
l'attribut de **rôle** `BYPASSRLS`. Une écriture qui passe « parce que c'est postgres » passe pour la
seconde raison, pas la première.

## Deux lignes sorties de cette mesure

### 1. L'outbox des confirmations — **refermée, V1**

`appointment_notifications` : un seul écrivain (`trg_appointment_confirmed_outbox` →
`tg_appointment_confirmed_outbox`, `SECURITY DEFINER`), **zéro ligne**, et un handler **nu**. On ne
pouvait pas distinguer *« aucun rendez-vous n'a jamais été confirmé »* de *« chaque confirmation a
échoué en silence depuis le premier jour »*.

Mesure `20260913_outbox_confirmations.sql`, transaction annulée, un rendez-vous réel poussé dans tous
les statuts de l'enum :

| Transition | Outbox |
|---|---|
| → `pending` | 0 → 0 |
| **→ `confirmed`** | **0 → 1 — la ligne arrive** |
| → `completed`, `cancelled`, `no_show` | 1 → 1 |

Le `WHEN` est `(old.status IS DISTINCT FROM 'confirmed') AND (new.status = 'confirmed')`. Déclencheur,
`WHEN`, `INSERT` et table sont **sains**.

**Le vide n'est pas un silence, c'est l'absence d'usage** : la base entière contient **un seul
rendez-vous**, créé le 13/09, statut `cancelled`. Porte fermée, zéro utilisateur — le chiffre est
cohérent.

C'est le contre-exemple qui manquait à la journée. `UN DURCISSEMENT DOIT ETRE SUIVI D'UN EXERCICE`
dit qu'une table à zéro ligne est un **soupçon**, jamais une donnée. Un soupçon peut se lever : ici,
il s'est levé par l'exercice, et la règle a fonctionné dans les deux sens.

### 2. L'arrêt des `api_usage_log_*` au 2 juin — **ouverte**

Quelque chose créait une table par jour et a cessé il y a trois mois. Fonctionnalité retirée (16
restes à purger) ou `pg_cron` mort en silence ? Mesure : `20260913_api_usage_log_arret.sql`.

## À traiter quand on fera les régimes d'erreur

**Le handler nu de `tg_appointment_confirmed_outbox` reste un défaut de conception, même s'il
n'avale rien aujourd'hui.** Le jour où l'`INSERT` échouera, ce sera en silence — et ce seront des
patients non prévenus.

Entrée **à part** des neuf changements de régime des fonctions d'audit, parce que l'enjeu n'est pas
le même : une trace d'audit perdue est un problème de preuve, une confirmation perdue est un
problème de soin.

> Un échec d'outbox doit **LEVER**, ou au minimum écrire dans `audit_log_echecs`.

À trancher au moment des régimes, pas avant.

## Une mesure à faire, sans urgence

Le rendez-vous unique du 13/09 : d'où vient-il ? Toutes nos mesures du jour ont été annulées. Soit un
test manuel, soit **un e2e qui écrit en production au lieu d'un environnement de test** — et ça, ce
serait un défaut. Mesure : `20260913_rdv_unique_origine.sql`.
