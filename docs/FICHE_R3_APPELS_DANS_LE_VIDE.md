# Fiche R3 — Les appels dans le vide (mesuré le 12/09/2026)

Le front appelle des fonctions qui n'existent pas côté serveur. Chaque appel échoue à l'exécution ; ce que voit l'utilisateur
dépend de la façon dont l'appelant avale l'erreur. Relevé par comparaison entre `grep rpc(` / `functions/v1/` dans le code et
`pg_proc` / la liste des edge functions déployées (`send-sms` v17, `verify-turnstile` v7, `appointment-reminders` v7, `sms-dlr` v4).

## A. Cinq RPC appelées par le front et absentes de la base

| RPC | Appelant | Drapeau | Ce que vit l'utilisateur |
|---|---|---|---|
| `validate_cabinet_invitation` | `signup.html:498` (inscription secrétaire, avant `accept_cabinet_invitation`) | aucun | appel enveloppé dans un `try{}catch(_v){}` vide : erreur 404 avalée, l'inscription continue avec `accept_cabinet_invitation` (qui existe). Appel mort, sans effet visible. |
| `mark_prescription_delivered` | `patient-ordonnances.html:241` (`trackDelivery`, best-effort) | `prescriptions: false` | jamais atteint tant que le drapeau est à false ; sinon erreur avalée en silence (« traçage non bloquant »). |
| `create_prescription_draft` | `medecin-ordonnance.html:524` (bouton « Enregistrer le brouillon », nouvelle ordonnance) | `prescriptions: false` | si la page est ouverte malgré le drapeau (lien direct `doctor-dashboard.html:207` « Ordonnance » dans le bandeau vert, `tabibi-pro-sidebar.js:38`), l'erreur est levée → `throw` → toast d'erreur. Le brouillon n'est jamais créé. |
| `update_prescription_draft` | `medecin-ordonnance.html:514` (même bouton, brouillon existant) | `prescriptions: false` | idem : toast d'erreur, rien d'écrit. |
| `request_prescription_signature` | `medecin-ordonnance.html:564` (bouton « Signer ») | `prescriptions: false` | erreur avant même l'appel à l'edge `generate-prescription-pdf`, elle-même **non déployée**. La signature est impossible de bout en bout. |

Point d'attention — **mesuré le 12/09** (compte B) : le bouton « Ordonnance » est affiché dans le bandeau vert du tableau de
bord médecin alors que ses quatre RPC n'existent pas. La page `medecin-ordonnance.html` affiche un bandeau « Fonctionnalité
bientôt disponible » et le clic sur « Sauvegarder brouillon », patient valide renseigné, **n'émet aucune requête** : le drapeau
`prescriptions: false` bloque l'appel côté client avant qu'il n'atteigne `create_prescription_draft`. **Ce n'est donc pas un
cinquième faux succès** — le bandeau prévient, le drapeau garde. Réserve : si `prescriptions` passe à `true` sans que ces 4 RPC
ni l'edge `generate-prescription-pdf` existent, le bouton deviendra un vrai faux succès. Le drapeau est le seul garde-fou.

## B. Six edge functions appelées par le front et non déployées

| Edge function | Appelant | Effet |
|---|---|---|
| `send-email` | `js/tabibi-brevo.js` (liste d'attente, confirmations) | aucun e-mail ne part ; la liste d'attente enregistre la ligne puis échoue en silence (mesuré le 12/09 : INSERT 201, e-mail jamais envoyé). |
| `verify-prescription` | `verify-prescription.html` | la page publique de vérification d'ordonnance ne peut rien vérifier. |
| `request-account-deletion` | `legal/rgpd-droits.html` | la demande de suppression de compte (R4) n'arrive nulle part. |
| `generate-prescription-pdf` | `medecin-ordonnance.html` | voir A. |
| `create-video-room` | `teleconsultation.html` | la téléconsultation (Daily) ne peut pas ouvrir de salle ; page « bientôt disponible » en pratique. |
| `contact-partner` | `api-docs.html` | le formulaire partenaires API n'envoie rien. |

> **Remesure du 13/09/2026.** Les lignes ci-dessus datent du 12/09 et sont conservees telles quelles.
> Une d'entre elles ne decrit plus le code : **`request-account-deletion` n'est plus appelee par
> `legal/rgpd-droits.html`.** L'appel a ete retire le 12/09/2026 et ne survit qu'en commentaire dans
> la page. Verifie sur la production du 13/09 (`https://tabibi.doctor/legal/rgpd-droits`, cache-bust) :
> une seule occurrence de la chaine, dans un commentaire qui documente le retrait, zero `<form>`,
> zero `onclick` avec `alert(` ou `confirm(`.
>
> La suppression de compte y est passee a un **canal humain** assume : demande ecrite a
> `contact@tabibi.doctor` ou appel au `+213 777 16 90 74` (en clair dans le HTML, non obfusque),
> accuse de reception sous 72 h ouvrees, suppression sous 30 jours. L'ancien code inserait dans une
> table inexistante (`account_deletion_requests`), appelait l'edge non deployee, puis affichait
> « Vous recevrez un email de confirmation » et deconnectait l'utilisateur — alors que rien ne partait.
>
> Cette ligne reste donc a l'inventaire pour la **reintroduction** du parcours automatique, pas comme
> un appel mort en production. Les cinq autres lignes n'ont pas ete remesurees.

## Ce que R3 demande

1. Décider fonction par fonction : déployer (le code existe-t-il sous `supabase/functions/` ?) ou retirer l'appel et le bouton.
2. Tant que la décision n'est pas prise : masquer les entrées qui mènent à un appel mort (bouton « Ordonnance » du bandeau,
   entrée `rx` de la barre latérale pro, formulaire partenaires), pour ne pas fabriquer de nouveaux faux succès.
3. Le contrôle qui tient dans le temps : un script qui compare les `rpc('…')` et `functions/v1/…` du code aux objets réellement
   présents, sur le modèle de `verifier:grants`. À écrire après accord, pas en CI avant d'en avoir parlé.

Relié : `README_APP.md` (R1–R5), `VERIF_NAVIGATEUR.md` (faux succès 1–4), PR #71 (`docs/preuves/2026-09-12_GRANTS_apres_schema_public.md`).
