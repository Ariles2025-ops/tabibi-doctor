# Journal des déploiements — tabibi.doctor

Une ligne par déploiement de production, à partir du 13/09/2026. Avant cette date, les déploiements
n'étaient consignés nulle part : c'est ce qui a permis à la production de rester dix-huit jours sur un
état que `main` ne décrivait plus (cf. `PLAN_FUSION.md` §3 quater et `docs/ETAT_PORTE.md`).

Hébergement : **Cloudflare Pages**, projet `tabibi-doctor`, branche de production **`main`**, sans
connexion Git — tous les déploiements sont poussés à la main par `wrangler pages deploy`.

Le **retour arrière n'est pas une commande wrangler** : il se fait au tableau de bord,
Workers & Pages → tabibi-doctor → Deployments → menu `···` du déploiement visé → *Rollback to this
deployment*. Atomique, sans reconstruction.

---

| # | Date (UTC) | Commit déployé | Déploiement Cloudflare | Porte | Retour arrière vers | Lancé par |
|---|---|---|---|---|---|---|
| 3 | 2026-09-13 ~08:58 | `dc133ebd9dc1a7427fc5bce367112d810080335d` | `eeeeef33-…` | **fermée** | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | Claude, sur go d'Aghiles |
| 2 | 2026-09-13 ~01:30 | `5cec711f90f5b982f4b100eb30ff456753ae97a8` | `5e3d8d18-9b03-43e2-837b-943926cd4c0e` | **fermée** | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | Claude, sur go d'Aghiles |
| 1 | 2026-08-26 (reconstitué) | `f06aa3d` (PR #51) | `59b36480-2e0b-44ca-ab8b-86e04bbc06cd` | fermée | — | non consigné à l'époque |

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

**Six d'entre eux affirment une action qui n'a pas lieu** (détail et verdict dans le rapport de session).
Aucun n'est une régression : tous précèdent la vague. Aucun n'est corrigé par ce déploiement.

