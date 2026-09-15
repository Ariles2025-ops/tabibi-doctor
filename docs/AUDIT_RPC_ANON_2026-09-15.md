# Audit — les RPC exécutables par `anon`

**15/09/2026.** Relevé sur la base de production, en lecture seule (MCP).
**Aucun `GRANT`/`REVOKE` n'a été exécuté.** Le fichier
`supabase/migrations/20260915_revoke_rpc_anon.sql` propose les révocations ; le stratège
relit et applique.

---

## Le chiffre de départ n'était pas le bon

La consigne parlait de « 57 RPC exécutables par anon ». Mesure :

```
fonctions de public exécutables par anon ............... 319
       dont SECURITY DEFINER ...........................  57   <- celles qui comptent
       dont SECURITY INVOKER ........................... 262
```

**Les 262 autres ne sont pas un problème** : `SECURITY INVOKER` signifie qu'elles
s'exécutent avec les droits de l'appelant. Pour `anon`, elles ne peuvent donc rien lire que
la RLS ne laisse déjà passer. Ce sont des fonctions d'extension (`cash_dist`, `date_dist`…)
et des utilitaires immuables. Les révoquer serait du bruit.

**Seules les `SECURITY DEFINER` franchissent la RLS.** Ce sont les 57 de cet audit.

| | |
|---|---|
| accès anon **LÉGITIME** | **10** |
| **À RÉVOQUER** — appelables par PostgREST | **30** |
| **À RÉVOQUER** — fonctions de déclencheur | **17** |

---

## ⚠️ Le risque que j'ai vérifié avant de proposer quoi que ce soit

Révoquer `EXECUTE` à `anon` sur une fonction **citée dans une politique RLS** casserait la
lecture pour les visiteurs anonymes : l'expression de la politique s'évalue avec les droits
du rôle qui interroge.

Huit des fonctions proposées à la révocation sont citées dans des politiques. J'ai vérifié
**chacune** :

```
is_admin                   17 politiques   aucune ne vise anon/public
current_doctor_profile_id   3 politiques   aucune ne vise anon/public
dawini_my_pharmacy_wilaya   2 politiques   aucune ne vise anon/public
_api_is_admin_safe          2 politiques   aucune ne vise anon/public
dawini_my_pharmacy_id       2 politiques   aucune ne vise anon/public
dawini_can_view_object      1 politique    ne vise pas anon/public
is_doctor_bookable          1 politique    ne vise pas anon/public
presc_can_read_pdf          1 politique    ne vise pas anon/public
```

**Toutes visent `authenticated`.** La révocation ne touche donc aucune lecture anonyme.
C'est la seule raison pour laquelle je propose de les révoquer ; sans cette vérification,
il aurait fallu les laisser.

---

## LÉGITIMES — 10

Le parcours public réel : chercher un médecin, voir sa fiche et ses créneaux, consulter
Dawini, s'inscrire à la liste d'attente.

| RPC | pourquoi anon en a besoin |
|---|---|
| `chercher_praticiens` | Recherche de l'annuaire. Appelee par `js/home-app.js`, charge par `accueil-public.html` — c'est LA fonction du parcours public. |
| `praticien` | Fiche d'un praticien. Rend `SETOF public_doctors`, la vue assainie, pas la table. |
| `praticiens_carte` | Points de la carte publique. Meme vue assainie. |
| `praticiens_par_ids` | Fiches par lot (favoris, resultats). Meme vue assainie. |
| `stats_publiques` | Compteurs affiches sur l'accueil public. |
| `waiting_list_count` | Nombre d'inscrits, affiche sur `waiting-list.html`. Rend UN entier et rien d'autre — c'est pourquoi elle existe (voir 20260914_waiting_list_count.sql). |
| `get_available_slots` | Creneaux libres d'un medecin. Consultes AVANT connexion sur `reservation.html` : le visiteur choisit son creneau, puis on lui demande de se connecter. Aucune garde de session autour de l'appel — verifie. |
| `dawini_zone_active` | Dit si Dawini est ouvert dans une wilaya. Information publique par nature. |
| `dawini_shortage_by_wilaya` | Statistiques publiques de penurie, affichees sur `dawini.html`. |
| `dawini_top_missing` | Medicaments les plus demandes — meme page publique. |

> **Comment « légitime » a été établi** : le nom de la fonction est cherché dans tout le
> front, puis on remonte des modules JS aux pages HTML qui les chargent, et on regarde si
> l'une de ces pages est atteignable sans compte. Les cas limites ont été lus à la main —
> `claim_my_doctor_profile` et `get_my_doctor_profile` apparaissent sur des pages publiques
> mais sont appelées **après** ouverture de session (le code le dit), donc elles sont dans
> la liste à révoquer.

---

## À RÉVOQUER — 30 appelables par PostgREST

Aucune n'a d'usage anonyme. La plupart sont déjà **closes en pratique** — elles lisent
`auth.uid()`, qui vaut NULL sans session — mais un droit qui ne sert à rien est un droit
qui traîne.

| RPC | famille | pourquoi |
|---|---|---|
| `_api_is_admin_safe` | administration | Aucun appelant front. Reservee a l'administration. |
| `admin_doctor_doc_paths` | administration | Rend les CHEMINS des pieces d'identite d'un medecin. Appelee depuis `admin-doctor-validation.html`, derriere connexion. |
| `admin_validate_doctor` | administration | Valide ou refuse un medecin. Ecriture d'administration. |
| `admin_validation_counts` | administration | Compteurs du tableau de validation. |
| `admin_validation_list` | administration | Rend `SETOF doctor_profiles` — la TABLE, pas la vue publique. `anon` n'a aucune raison d'y toucher. |
| `admin_validation_total` | administration | Total du meme tableau. |
| `is_admin` | garde interne | Garde citee par 17 politiques RLS, toutes sur `authenticated` — verifie : AUCUNE ne vise `anon` ni `public`. La revoquer ne casse donc aucune lecture anonyme. |
| `current_user_role` | garde interne | Lit le role de l'appelant. Sans session : NULL. Aucun appelant front. |
| `current_doctor_profile_id` | garde interne | Citee par 3 politiques (`medical_records`, `payments`), toutes sur `authenticated`. |
| `dawini_can_view_object` | garde interne | Citee par une politique de `storage.objects` visant `authenticated`. |
| `presc_can_read_pdf` | garde interne | Citee par `presc_pdf_select`, sur `authenticated`. Pour `anon`, `auth.uid()` est NULL : elle ne peut rendre que `false` — mais la posseder n'a aucun sens. |
| `dawini_my_pharmacy_id` | garde interne | Identifie la pharmacie de l'appelant. NULL sans session. |
| `dawini_my_pharmacy_wilaya` | garde interne | Idem, pour la wilaya. |
| `is_doctor_bookable` | garde interne | Citee par une politique de `appointments` sur `authenticated`. Aucun appelant front. |
| `appointment_slot_is_available` | garde interne | Aucun appelant front : le parcours public passe par `get_available_slots`. |
| `can_review_doctor` | compte requis | Dit si l'appelant peut noter ce medecin. Lit `auth.uid()` : sans session, la reponse est toujours non. |
| `claim_my_doctor_profile` | compte requis | Revendication de fiche. Le code le dit lui-meme : « l'auto-claim post-signup (RPC ..., authentifie) » — elle est appelee APRES creation du compte. |
| `claim_my_doctor_profile` | compte requis | Meme fonction, surcharge par identifiant historique. |
| `get_my_doctor_profile` | compte requis | Profil du medecin CONNECTE. Appelee depuis `signup.html` une fois la session ouverte — le commentaire du code precise « scope auth.uid() ». |
| `update_my_doctor_profile` | compte requis | Ecriture sur son propre profil. |
| `get_patient_medical_data` | compte requis | Donnees medicales du patient connecte — groupe sanguin, allergies, antecedents. |
| `upsert_patient_medical_data` | compte requis | Ecriture des memes donnees. |
| `dawini_create_request` | compte requis | Depose une demande Dawini. Lit `auth.uid()` : echoue sans session. |
| `dawini_create_alert` | compte requis | Cree une alerte de disponibilite. Idem. |
| `dawini_cancel_alert` | compte requis | Annule sa propre alerte. Idem. |
| `dawini_respond` | compte requis | Reponse d'une PHARMACIE a une demande. |
| `dawini_get_patient_contact` | compte requis | ⚠️ Rend le NOM et le TELEPHONE d'un patient. Gardee par `dawini_my_pharmacy_id()` (NULL sans session -> `not_a_pharmacy`), donc close aujourd'hui. Mais c'est la fonction la plus sensible de la liste : elle n'a rien a faire dans les droits d'`anon`. |
| `dawini_pharmacy_stats` | compte requis | Statistiques de LA pharmacie connectee. |
| `check_doctor_account_exists` | oracle inutile | Rend vrai/faux sur « ce medecin a-t-il deja un compte ? ». **Aucun appelant front.** Pour `anon`, c'est un oracle d'enumeration sur 75 035 fiches, sans contrepartie. |
| `seo_couples` | sans appelant | Couples specialite/wilaya pour les pages SEO. Aucun appelant front ni script : les 490 pages sont generees hors ligne. |

### Celle qu'il faut regarder en premier

`dawini_get_patient_contact` **rend le nom et le téléphone d'un patient**. Elle est gardée
par `dawini_my_pharmacy_id()`, qui vaut NULL sans session : un appel anonyme lève
`not_a_pharmacy`. **Elle est donc close aujourd'hui.** Mais c'est la fonction la plus
sensible de la liste, et elle figure dans les droits d'`anon` sans raison.

---

## À RÉVOQUER — 17 fonctions de déclencheur

Elles rendent `trigger` : **PostgREST refuse de les exposer**, et un appel direct échouerait
faute de contexte de déclencheur. Les révoquer ne change donc rien au comportement.

C'est de l'hygiène, et ça a une valeur : la prochaine personne qui liste les droits d'`anon`
ne perdra pas son temps sur dix-sept fausses pistes.

```
appointments_secretaire_limit()
appointments_set_cabinet_from_doctor()
dawini_alerts_on_available()
doctor_schedule_protect()
enforce_appointment_availability()
fn_audit_changes()
fn_handle_review_report()
fn_update_doctor_rating()
fn_verify_review()
handle_new_auth_user()
lock_doctor_protected_columns()
notifications_protect()
refresh_doctor_rating()
tg_appointment_confirmed_outbox()
tg_message_after_insert()
tg_notify_appointment()
video_sessions_protect_columns()
```

---

## Ce que cet audit ne dit pas

- **Il ne remplace pas une lecture des corps.** J'ai lu ceux de
  `dawini_get_patient_contact`, `dawini_pharmacy_stats` et `check_doctor_account_exists`,
  et vérifié la présence de `auth.uid()` / `is_admin` dans les autres par recherche dans
  `prosrc`. Une garde peut être présente et fausse.
- **Il ne dit rien des 262 `SECURITY INVOKER`.** Elles dépendent de la RLS, qui est un
  autre sujet.
- **Les vues `SECURITY DEFINER` ne sont pas dans le périmètre** — elles sont voulues et
  analysées ailleurs.

## Après application

Vérification, sans rien exécuter d'autre :

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE');
-- attendu : 10  (contre 57 avant)
```

⚠️ **Et une lecture au navigateur, en navigation privée** : l'accueil affiche des médecins,
une fiche s'ouvre, les créneaux d'un médecin s'affichent, Dawini montre ses statistiques,
la liste d'attente montre son compteur. C'est ce qui prouve qu'aucune révocation n'a mordu
sur le parcours public — pas le compte ci-dessus.
