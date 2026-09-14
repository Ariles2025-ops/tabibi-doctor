# Audit bout en bout — 14/09/2026

> ## ⚠️ DEUX DE MES PROPRES CONSTATS ETAIENT FAUX — corriges le 14/09 au lot suivant
>
> En **corrigeant** M-1 et M-2, je les ai mesures de plus pres et **les deux tombent**.
> Les entrees d'origine sont conservees telles quelles plus bas, avec leur correction.
>
> | | |
> |---|---|
> | **M-1** | La pagination n'est pas « cassee » : `buildDocPagination()` **n'est APPELEE NULLE PART** et la page n'a **aucun conteneur de pagination**. C'est du **code mort portant une reference pendante**, pas une fonctionnalite en panne. → **MINEUR**, et le code mort a ete retire. |
> | **M-2** | `doctor-dashboard.html` **n'est pas « la seule page pro sans barre laterale »** : elle a **la sienne**. A partir de 1024 px, son CSS transforme `.dash-tabs` en colonne fixe a gauche (`position:fixed; left:0; width:230px`) avec `main.page{margin-left:230px}`. `agenda-cabinet.html` fait pareil et le documente. → **PAS UN DEFAUT.** |
>
> **Et c'est M-2 qui explique BUG-1.** En ajoutant la barre partagee pour « corriger »,
> j'ai mesure ce qui se passe : deux colonnes fixes se superposent a `x=0`, la barre
> partagee (z-index 150) **recouvre les onglets**, et
> `document.elementFromPoint(centre du bouton « Profil »)` rend **`DIV.sb-spacer`**.
> **Les onglets deviennent incliquables** — l'onglet actif ne change pas, le contenu non
> plus. **L'ajout a ete annule.** Voir le §BUG-1 corrige en bas.

**INVENTAIRE. Aucune correction dans ce lot.** Chaque entree porte sa preuve mesuree :
une sortie de console, une reponse HTTP, une requete en base, ou `fichier:ligne`.
**Quand je n'ai pas pu reproduire, je l'ecris** — je n'invente pas de cause.

**Methode** : serveur local `:8080`, 40 pages visitees en 400 px et 1400 px, console et
reseau captures par Playwright ; parcours authentifies via bouchon de `js/auth.js`
(aucun compte cree, aucun reseau reel vers Supabase) ; mesures en base par MCP en
lecture ; analyse statique par parsing acorn pour les `onclick`.

---

## Le compte

| Gravite | n |
|---|---|
| **BLOQUANT** | **2** |
| **MAJEUR** | **3** |
| MINEUR | 4 |
| COSMETIQUE | 0 |
| **NON-BUGS a ne plus signaler** | 3 |
| dette inscrite | 1 |

---

# BLOQUANT

## B-1 — La page « liste d'attente » annonce **500+ inscrits**. Il y en a **0**.

| | |
|---|---|
| **Page** | `waiting-list.html` — **publique**, ouverte a tous |
| **Reproduction** | ouvrir la page. Le compteur affiche `500+`. |
| **Gravite** | **BLOQUANT** — c'est une affirmation chiffree fausse, faite a des visiteurs |

**Preuve, trois mesures :**

```
1. reseau, au chargement :
   404  https://…supabase.co/rest/v1/waiting_list_count?select=total_count

2. en base : il n'existe PAS d'objet `waiting_list_count`.
   Ce qui existe : table `waiting_list`, vue `waiting_list_stats`.

3. select count(*) from public.waiting_list;   ->   0
```

**Cause racine** — `waiting-list.html:815-826` :

```js
const { data } = await window.tabibi.supabase
  .from('waiting_list_count').select('total_count').single();
if (data && data.total_count != null) { … }
else { document.getElementById('stat-total').textContent = '500+'; }
```

Le repli n'est pas un repli : **il se declenche a chaque chargement**, parce que la vue
n'existe pas. Et il n'affiche pas « — » ou « indisponible » : il affiche **un nombre
plausible**. Le defaut ne ressemble pas a un defaut.

> C'est la faute de la semaine, dehors et en chiffres : **un ecran qui presente une valeur
> fabriquee comme une mesure.**

**En prime, deux faits qui ferment la porte a une correction paresseuse :**
`waiting_list_stats` n'a **aucun `GRANT`** pour `anon`/`authenticated` — elle est
illisible depuis le web. Et `waiting_list` ne donne a `anon` que `INSERT`, jamais
`SELECT` — **a raison** : ce sont des e-mails, donc des donnees personnelles.

**Correction proposee** *(non appliquee)* : une RPC `SECURITY DEFINER`
`waiting_list_total()` qui rend **le seul nombre**, sans exposer la table ; et si elle
echoue, **afficher « — », pas un nombre.** Tant qu'elle n'existe pas, retirer le
compteur : ne rien afficher est honnete, « 500+ » ne l'est pas.

---

## B-2 — « Mot de passe oublie » dit « envoye » meme quand rien ne part

| | |
|---|---|
| **Page** | `forgot-password.html` |
| **Reproduction** | saisir un e-mail, valider. Le bandeau vert de confirmation s'affiche **dans tous les cas**. |
| **Gravite** | **BLOQUANT** — le parcours de recuperation de compte |

**Cause racine** — `forgot-password.html:117-135`, et l'ordre des lignes est tout :

```js
var r = await sb.auth.resetPasswordForEmail(email, { redirectTo, captchaToken });
okBox.style.display = 'block';        // ← ligne 122 : AVANT de regarder l'erreur
emailEl.value = '';
if (r && r.error) {
  console.warn('[forgot] reset error', r.error);   // ← et on ne fait QUE logger
}
} catch (e) {
  console.error('[forgot] exception', e);
  okBox.style.display = 'block';      // ← ligne 131 : meme sur exception
}
```

**L'intention est bonne et doit etre gardee** : ne jamais reveler si un compte existe
(anti-enumeration). **Mais elle est utilisee pour masquer autre chose que ca.** Un captcha
refuse, un quota d'envoi atteint, un SMTP en panne, une URL de redirection non autorisee —
**rien de tout cela ne dit si le compte existe**, et tout cela est cache de la meme facon.

> **Un echec systeme n'est pas une information sur le compte.** Les confondre, c'est
> transformer une protection en silence.

**Ce que j'ai verifie en plus, et qui innocente l'infrastructure :**

```
tabibi.doctor           -> resout (Cloudflare), HTTP 200
/reset-password.html    -> 308 -> /reset-password -> 200  « Nouveau mot de passe | Tabibi »
/forgot-password        -> 200   /login -> 200   /signup -> 200   /accueil-public -> 200
SITE_URL (js/config.js:29) = https://tabibi.doctor        ← correct
```

**Les pages sont en ligne et correctes.** Il reste **un point que je n'ai pas pu mesurer et
qu'il faut lire en console Supabase** : la liste blanche *Auth → URL Configuration →
Redirect URLs*. Le `redirectTo` envoye est `…/reset-password.html` (avec `.html`), et
Cloudflare le redirige en 308 vers `/reset-password` (sans). **Si la liste blanche ne
contient pas exactement la forme envoyee, Supabase refuse la redirection et retombe sur le
Site URL** — et l'utilisateur ne recoit rien d'exploitable. *Je ne conclus pas : je dis ou
regarder.*

**Correction proposee** *(non appliquee)* : separer les deux familles d'erreur. Tout ce
qui vient du compte reste masque ; tout ce qui vient du systeme (captcha, `429`,
`AuthRetryableFetchError`, erreur de configuration) s'affiche. **Supabase rend deja la meme
reponse pour un e-mail inconnu** — montrer une erreur systeme ne revele donc rien.

---

# MAJEUR

## M-1 — ~~La pagination de la recherche de medecins est morte~~ → **du code mort**

> **CORRIGE LE 14/09.** `buildDocPagination()` **n'est appelee nulle part** (recherche
> par nom sur tout le perimetre : une seule occurrence, sa definition) et
> `patient-dashboard.html` **n'a aucun conteneur de pagination**. `#docs-list` est
> l'onglet **Documents**, rendu par `filtDoc()` — pas une liste de medecins.
> `docPage`, `DOC_PER_PAGE` et `currentSpec` etaient egalement declarees et jamais
> utilisees.
>
> **Aucun utilisateur ne pouvait cliquer ce bouton : il n'etait jamais rendu.**
> Gravite reelle : **MINEUR**. Le code mort a ete retire, avec la preuve de la
> recherche par nom. La pagination qui MARCHE est celle de `js/home-app.js`
> (`goPage`/`buildPagination`), utilisee par `accueil-public.html`.
>
> **La lecon m'appartient** : j'ai deduit « bouton mort » de « fonction absente »,
> sans verifier que le bouton etait rendu. Le constat technique etait juste ; la
> consequence annoncee ne l'etait pas.

### Le constat d'origine, conserve

| | |
|---|---|
| **Page** | `patient-dashboard.html`, onglet **Reserver** |
| **Reproduction** | chercher des medecins, cliquer une page (2, ›, »). Rien ne se passe. |
| **Gravite** | **MAJEUR** — au-dela de la premiere page, le catalogue est inaccessible |

**Preuve, mesuree dans le navigateur sur la page chargee :**

```json
{ "goDocPage": "undefined",  "buildDocPagination": "function",  "readNotif": "function" }
```

**La fonction qui CONSTRUIT la pagination existe. Celle qu'elle APPELLE n'existe pas.**

**Cause racine** — `patient-dashboard.html:304` genere
`onclick="goDocPage(${i})"`, et `goDocPage` **n'est definie nulle part** : ni dans la page,
ni dans `js/*.js`. Recherche sur tout le perimetre — trois occurrences, toutes ce meme
`onclick` (dont deux dans les copies `ios/` et `android/`).

Le clic leve une `ReferenceError` **dans le gestionnaire d'evenement**, donc rien ne
l'attrape et rien ne s'affiche : le bouton est inerte et la console reste muette pour qui
ne l'a pas ouverte.

**Correction proposee** *(non appliquee)* : definir `goDocPage(i)` qui relance
`window.tabibiDoctors.search()` a la page `i` et re-rend la liste — ou supprimer la
pagination si la recherche serveur ne la porte pas encore. **Ne pas laisser un bouton qui
ne fait rien.**

> ⚠️ `verifier:panneaux` garde « aucun bouton n'annonce ce qu'il ne fait pas » ; il ne
> garde pas « aucun `onclick` ne pointe dans le vide ». **Une porte manque**, et elle est
> ecrite au §Suites.

---

## M-2 — ~~la seule page pro sans barre laterale~~ → **elle a la sienne**

> **RETIRE LE 14/09. Ce n'etait pas un defaut.**
>
> `doctor-dashboard.html:56-78` : a partir de 1024 px, `.dash-tabs` devient
> `position:fixed; left:0; width:230px; flex-direction:column` — **sa propre
> navigation de gauche** — et `main.page` prend `margin-left:230px`. Le commentaire
> du fichier explique meme pourquoi (PR #12). `agenda-cabinet.html` fait de meme et
> le dit a sa ligne 170.
>
> **Sept pages chargent la barre partagee ; deux ont la leur.** Ce n'est pas une
> page oubliee, c'est deux dispositifs differents — une incoherence VISUELLE, au
> plus MINEURE, pas une navigation manquante.
>
> **Ce que j'ai omis de verifier** : si la page avait un equivalent. J'ai cherche la
> balise, pas la fonction.

### Le constat d'origine, conserve

| | |
|---|---|
| **Reproduction** | ≥1024 px : ouvrir `medecin-profile.html` (barre a gauche), puis « Tableau de bord ». **La barre disparait.** |
| **Gravite** | **MAJEUR** — la navigation apparait et disparait sur la page d'atterrissage du medecin |

**Preuve** :

```
Pages chargeant js/tabibi-pro-sidebar.js :
  agenda-cabinet · conversation · doctor-analytics · medecin-profile
  medecin-ordonnance · medecin-waitinglist · messages · notifications   (8)

doctor-dashboard.html : grep -c "tabibi-pro-sidebar" -> 0
```

Et mesure au navigateur en 1400 px, fixture medecin : `sidebar_presente: false`.

**Cause racine** : la balise n'a jamais ete ajoutee a cette page. Ce n'est pas une
condition d'affichage — le script n'est pas charge.

**Correction proposee** *(non appliquee)* : ajouter
`<script src="js/tabibi-pro-sidebar.js"></script>` a `doctor-dashboard.html`, puis
**verifier que la barre et la rangee d'onglets ne se marchent pas dessus** en ≥1024 px.

---

## M-3 — Six commentaires `TODO` affirment qu'un objet n'existe pas. Il existe.

| | |
|---|---|
| **Gravite** | **MAJEUR** — ces commentaires **justifient trois drapeaux de fonctionnalite** |

**Mesure en base, 14/09 :**

| ce que dit le code | realite |
|---|---|
| `tabibi-features.js:44` « RPC `get_video_session` : ❌ inexistante en DB » | **existe** |
| `tabibi-features.js:45` « RPC `set_video_recording_consent` : ❌ inexistante » | **existe** |
| `tabibi-features.js:69` « Table `reviews` : non creee » | **existe** |
| `tabibi-reviews.js:170` « Vue `my_reviewable_appointments` pas encore creee » | **existe** |
| `notifications.html:67` « Quand backend pret (table notifications…) » | **existe** |
| `tabibi-features.js:76-82` « les 4 RPC sont ABSENTES (verifie le 2026-07-29) » | **existent depuis aujourd'hui** |
| `onboarding-medecin.html:385` « creer table `doctor_applications` » | **n'existe toujours pas** ✔ le seul encore vrai |

**Cause racine** : ce sont des **mesures datees sans date de peremption**. `CLAUDE.md` le
dit deja pour lui-meme : *« une regle de reference n'est pas une mesure »*. Ici les
commentaires servent de **justification a `video: false`, `reviews: false` et
`prescriptions: false`** — et leur motif est faux.

> **Les drapeaux peuvent rester fermes pour de BONNES raisons** — le SDK Daily n'a jamais
> charge, les deux edge functions d'ordonnance manquent. **Mais ce n'est pas ce qui est
> ecrit.** Quelqu'un qui lit ces lignes et verifie en base conclura qu'on peut ouvrir.

**Correction proposee** *(non appliquee)* : reecrire les motifs avec la **vraie** raison
et la date de la mesure. Ne PAS ouvrir les drapeaux.

---

# MINEUR

## m-1 — « Teleconsult. » mene un medecin vers un ecran de patient *(dette, BUG-2)*

`doctor-dashboard.html` → `teleconsultation.html`, qui affiche « bientot » (drapeau
`video: false`). Pour un medecin, ce bouton devrait **conduire** une seance, pas proposer
d'en reserver une. **Inscrit comme dette**, a revoir avec le chantier video (stand-by).

## m-2 — `CLAUDE.md` dit « DNS pas encore pointe ». C'est faux.

```
tabibi.doctor  ->  188.114.96.2 / 188.114.97.2 (+ IPv6)   ← Cloudflare
https://tabibi.doctor/  ->  200  « Tabibi — Bientot disponible »
```

**Le domaine est en ligne et sert la porte fermee** — l'inversion du 13/09 fonctionne en
production, c'est la premiere fois qu'on le constate sur le vrai domaine. La ligne du
`CLAUDE.md` est perimee, **de la meme facon que les deux paragraphes deja marques FAUX**.

## m-3 — `presc_cancelled_has_reason` ne verifie pas le motif

`CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)` — **le nom promet un motif, le
CHECK ne regarde qu'une date.** Deja signale dans `DESIGN_ordonnances.md` §0.3. Repris ici
pour que l'inventaire soit complet.

## m-4 — 17 `TODO` dans le perimetre applicatif, pas 22

**Le compte de 22 venait probablement d'un `grep` incluant en partie les copies mobiles.**
Mesure : **50** occurrences sur le disque, dont **33 dans `ios/` et `android/`** — des
**sorties de build gitignorees**, regenerees par `scripts/build-mobile.sh`. Les corriger
n'aurait aucun effet. **17 sont reels.** Classement au §TODO.

---

# NON-BUGS — a ne plus signaler

## N-1 — `%c%d font-size:0;color:transparent NaN` sur **toutes** les pages, deux fois

**Ce n'est pas notre code.** Source tracee :

```
challenges.cloudflare.com/cdn-cgi/challenge-platform/…/turnstile/…  ligne 0, col 55700
```

C'est le script **Cloudflare Turnstile** qui logue une chaine de format malformee. Rien a
corriger chez nous, rien a chercher. *(21 des 40 pages remontaient « une erreur de
console » : c'etait celle-la, sur chacune.)*

## N-2 — « Reserver » mene a `index.html` *(BUG-3)*

En local, `index.html` **est** la porte fermee depuis l'inversion du 13/09. En production,
`https://tabibi.doctor/` sert bien la porte, et l'application vit sur les autres chemins.
**Comportement attendu.** Pour tester le public en local : `accueil-public.html`.

## N-3 — BUG-1 : non reproduit d'abord, **PUIS REPRODUIT ET EXPLIQUE**

> **RESOLU LE 14/09.** Il ne se reproduisait pas parce qu'il ne se produit pas dans
> l'etat actuel du depot — **il se produit des qu'on met DEUX navigations de gauche
> sur la meme page.**
>
> Mesure, en ajoutant la barre partagee a `doctor-dashboard.html` (1400 px) :
>
> ```
> sidebar        : fixed, x=0,  w=224, z-index 150
> .dash-tabs     : fixed, x=0,  w=230   ← la navigation PROPRE de la page
> bouton Profil  : x=12, y=360, w=205
> elementFromPoint(centre du bouton Profil)  ->  DIV.sb-spacer
> ```
>
> **La barre partagee recouvre les onglets. Le clic ne les atteint jamais** :
> l'onglet actif reste « Aujourd'hui », le contenu aussi. **L'ajout a ete annule**
> et la raison est ecrite dans `doctor-dashboard.html`, a l'endroit ou quelqu'un
> aura envie de refaire la meme chose.
>
> **Et l'hypothese des « deux Profil » se confirme, autrement** : dans l'espace
> medecin, le menu de gauche du tableau de bord porte **« Profil » = un onglet en
> page**, tandis que le menu de gauche des sept autres pages porte **« Mon profil »
> = un lien vers `medecin-profile.html`**. Deux menus qui se ressemblent, deux
> comportements. **C'est une incoherence de conception, pas un defaut de code.**

### Ce qui avait ete mesure d'abord

**Je l'ecris comme tel plutot que d'inventer une cause.**

Conditions essayees, fixture medecin, langue FR : **400 px, 1280 px, 1400 px** ; clics
successifs sur Agenda, RDV, Patients, Profil.

```
-- apres clic « Profil » --
{"panneauActif":["tab-profile"], "ongletActif":["Profil"], "sidebarActif":[]}
```

**Panneau et onglet suivent correctement, a chaque onglet.** Aucune exception, et le
`try/catch` de `sw()` ligne 414 **ne se declenche pas** : `renderProfile()` existe
(`doctor-dashboard.html:902`) et ne leve pas. Les cinq panneaux `tab-*` existent.

**Et la piste « sidebar desktop » ne tient pas ici** : la barre n'est pas chargee sur cette
page (voir **M-2**), et quand elle l'est ailleurs, elle marque l'actif **par URL de page**
(`tabibi-pro-sidebar.js:109`), jamais par onglet.

> **Ce qu'il me faut pour aller plus loin** : la largeur de fenetre, la langue, et si le
> clic venait de la rangee d'onglets ou d'ailleurs. **Une capture suffirait.**
> Hypothese a verifier avec toi : il y a **deux « Profil » differents** dans l'espace
> medecin — l'onglet (panneau en page) et le lien de la barre laterale
> (→ `medecin-profile.html`, une autre page). La confusion des deux expliquerait le
> symptome sans qu'il y ait de defaut de code.

---

# Ce qui a ete verifie et qui va bien

| | |
|---|---|
| **Arabe et RTL** | `dir="rtl"`, `lang="ar"`, texte arabe rendu, **aucun debordement** — verifie sur `accueil-public`, `login`, `patient-dashboard` |
| **Largeur 400 px** | **aucun debordement horizontal** sur les 10 pages publiques testees |
| **Gardes d'authentification** | 22 pages protegees redirigent bien vers `login.html` sans session |
| **Requetes locales** | **zero 404** sur les ressources servies localement (JS, CSS, polices, images) sur les 40 pages |
| **Exceptions non capturees** | **zero** `pageerror` sur les 40 pages |
| **Onglets du tableau de bord medecin** | les 5 basculent correctement (voir N-3) |
| **Tuile « rebut d'audit »** | eprouvee au lot #110 dans ses trois etats, dont l'erreur qui n'affiche pas 0 |
| **`onclick` morts** | 404 appels dans des attributs `on*` analyses ; **un seul** reellement mort (M-1) |

---

# Les TODO — 17 reels, classes

## Encore valides (5)

| | |
|---|---|
| `onboarding-medecin.html:385` | creer `doctor_applications` — **verifie : la table n'existe toujours pas** |
| `medecin-profile.html:829` | 2FA : envoyer le secret via Edge Function. `two_factor_secrets` **existe**, mais l'edge n'existe pas → **le TODO tient** |
| `payment.html:132` | webhook paiement — `payments: false`, coherent |
| `js/tabibi-doctor-dashboard.js:172` | UI multi-creneaux (pause midi) — vrai manque produit |
| `js/tabibi-doctor-dashboard.js:217` | purge des orphelins si la suppression echoue — **a transformer en ticket**, c'est un silence potentiel |

## Obsoletes — le code affirme une chose fausse (6) → **M-3**

`js/tabibi-features.js:44`, `:45`, `:69`, `:76-82` · `js/tabibi-reviews.js:170` ·
`notifications.html:67`

## A transformer en ticket (4)

| | |
|---|---|
| `js/home-app.js:1428` | **« Remplacer ces stats hardcodees par appel API »** — meme famille que **B-1**. A verifier : quelles stats, et sont-elles montrees au public ? |
| `js/tabibi-booking.js:24`, `:54` | codes d'erreur non alignes + `ERR_MSG_FR` non traduit → **les messages d'erreur de reservation ne sont pas en arabe** |
| `doctor-analytics.html:161` | note/`no_show` : `reviews` existe desormais, **le blocage a change de nature** |

## Deja traites ailleurs (2)

`teleconsultation.html:13` et `patient-profile.html:416` — couverts par les fiches
existantes (R3, PII).

---

# Suites proposees — a trier par toi

1. **B-1** puis **B-2** : les deux seuls qui trompent un utilisateur reel, et le premier
   est public.
2. **M-1** : un bouton mort sur le parcours d'achat.
3. **UNE PORTE QUI MANQUE** — `verifier:onclick-vivant` : tout `onclick="f(...)"` d'une
   page doit pointer vers une fonction qui existe. Le scanner de cet audit (parsing acorn,
   404 appels analyses, 1 vrai defaut) est ecrit et jetable ; **le transformer en garde
   coute peu et aurait attrape M-1 le jour ou il est ne.**
4. **M-3** : reecrire les motifs des drapeaux. **Sans ouvrir les drapeaux.**
5. **m-2** : corriger `CLAUDE.md` sur le DNS, en gardant la ligne fausse barree comme pour
   les deux autres.
6. **B-2, second volet** : lire la liste blanche *Redirect URLs* en console Supabase.
   **Seul Aghiles peut le faire.**
