**Version** : 1.0
**Date** : 5 août 2026
**Statut** : EN ATTENTE — bloqué par la vérification du compte Meta Business

---

# Activation du canal WhatsApp — checklist du jour J

> **Le code est écrit, testé et versionné. Rien n'est déployé.**
> `send-whatsapp` et `whatsapp-webhook` dorment dans le dépôt. Le canal actif
> reste **SMS via BudgetSMS** (`send-sms`), et rien dans le flux existant
> n'appelle WhatsApp.
>
> **Bloqueur unique** : la vérification du Meta Business Manager exige un
> registre de commerce, en attente. Tant qu'elle n'est pas obtenue, aucun
> template ne peut être soumis et aucun message ne peut partir.

## Ordre imposé

Les étapes 1 à 4 sont séquentielles : chacune produit une valeur exigée par la
suivante. Les étapes 5 à 7 peuvent être menées en parallèle une fois la 4
terminée. **L'étape 8 est la dernière** — ne basculer l'ordre des canaux
qu'après avoir vu un message réel arriver.

---

## 1. Vérifier le Meta Business Manager

business.facebook.com → *Paramètres de l'entreprise* → *Informations sur
l'entreprise* → **Démarrer la vérification**.

Documents généralement demandés pour une entité algérienne :

| Document | Rôle |
|---|---|
| Registre du commerce (RC) | prouve l'existence légale — **le bloqueur actuel** |
| NIF ou attestation fiscale | cohérence de la raison sociale |
| Justificatif d'adresse au nom de la société | facture d'un service, extrait bancaire |
| Numéro de téléphone joignable | Meta appelle ou envoie un code |

Le nom sur les documents doit correspondre **exactement** à la raison sociale
saisie. Une divergence, même de ponctuation, fait rejeter le dossier et impose
un nouveau cycle. Compter plusieurs jours ouvrés, parfois plusieurs semaines
en cas d'allers-retours.

> ⚠️ Les mentions légales publiées portent encore 7 champs vides (RC, NIF, NAI,
> capital, INAPI, ANPDP). Le RC obtenu ici doit y être reporté — c'est la même
> donnée, et un écart entre le site et le dossier Meta est un motif de rejet.

## 2. Créer l'app WhatsApp Business

developers.facebook.com → *Créer une app* → type **Business** → ajouter le
produit **WhatsApp**.

À récupérer :

| Valeur | Où | Devient |
|---|---|---|
| **Phone number ID** | WhatsApp → *API Setup* | `WA_PHONE_NUMBER_ID` |
| **WhatsApp Business Account ID** | même écran | nécessaire pour soumettre les templates |
| **App secret** | *Paramètres → Général* | `WA_APP_SECRET` (signature du webhook) |

Le token temporaire affiché sur cette page **expire en 24 h**. Ne pas s'en
servir pour la production : créer un **token permanent** via
*Paramètres de l'entreprise → Utilisateurs système* → nouvel utilisateur système
→ rôle Admin → *Générer un token* → permissions `whatsapp_business_messaging` et
`whatsapp_business_management`. Ce token n'expire pas.

> Le numéro expéditeur ne doit être rattaché à **aucun compte WhatsApp
> personnel ou Business App**. S'il l'est, le supprimer de ce compte d'abord —
> l'opération est irréversible côté application mobile.

## 3. Soumettre les 2 templates × 2 langues

WhatsApp Manager → *Modèles de messages* → **Créer un modèle**.

Quatre soumissions distinctes : Meta traite chaque couple (nom, langue)
séparément. Le nom doit être **identique** dans les deux langues.

### `rdv_confirmation` — catégorie **Utility**

4 paramètres, dans cet ordre exact. L'ordre est celui du tableau `order` de
`supabase/functions/send-whatsapp/index.ts` ; la Cloud API n'utilisant que des
placeholders positionnels, une inversion échange les valeurs **sans lever
d'erreur**.

| # | Paramètre | Exemple |
|---|---|---|
| 1 | `nom_medecin` | Dr Benali |
| 2 | `date` | jeudi 10 décembre |
| 3 | `heure` | 14h30 |
| 4 | `adresse` | 12 rue Didouche Mourad, Alger |

**Corps fr** :
```
Votre rendez-vous avec {{1}} est confirmé.
Date : {{2}} à {{3}}
Adresse : {{4}}

Pour annuler ou modifier, rendez-vous sur tabibi.doctor
```

**Corps ar** :
```
تم تأكيد موعدكم مع {{1}}.
التاريخ: {{2}} على الساعة {{3}}
العنوان: {{4}}

للإلغاء أو التعديل، تفضلوا بزيارة tabibi.doctor
```

### `otp_code` — catégorie **Authentication**

1 paramètre : `code`.

La catégorie Authentication impose un format contraint par Meta — corps court,
bouton de copie automatique, avertissement de non-partage souvent ajouté
d'office. Utiliser le modèle proposé par l'interface plutôt que du texte libre,
sous peine de rejet.

| Langue | Corps |
|---|---|
| fr | `{{1}} est votre code de vérification Tabibi.` |
| ar | `{{1}} هو رمز التحقق الخاص بكم على طبيبي.` |

> Validation Meta : de quelques minutes à 24 h. Un rejet est motivé et
> re-soumettable. Les motifs les plus fréquents sont le contenu promotionnel
> dans une catégorie Utility, et les paramètres en début ou fin de corps.

## 4. Poser les secrets Supabase

```bash
supabase secrets set WA_TOKEN=...            --project-ref pudugodhiofqrctcdwfl
supabase secrets set WA_PHONE_NUMBER_ID=...  --project-ref pudugodhiofqrctcdwfl
supabase secrets set WA_APP_SECRET=...       --project-ref pudugodhiofqrctcdwfl
supabase secrets set WA_VERIFY_TOKEN=...     --project-ref pudugodhiofqrctcdwfl
```

`WA_VERIFY_TOKEN` est une chaîne **que vous choisissez** — elle sert uniquement
au handshake de l'étape 5. Générer une valeur aléatoire longue, jamais un mot
de passe réutilisé.

> Règle 4 de CLAUDE.md : ces valeurs ne doivent apparaître dans aucun fichier,
> aucun commit, aucun message. `supabase secrets list` n'affiche que des
> empreintes SHA-256, pas les valeurs.

## 5. Déployer les fonctions

```bash
supabase functions deploy send-whatsapp    --project-ref pudugodhiofqrctcdwfl
supabase functions deploy whatsapp-webhook --project-ref pudugodhiofqrctcdwfl
```

`verify_jwt = false` pour `whatsapp-webhook` est déjà déclaré dans
`supabase/config.toml` — aucun flag de déploiement n'est nécessaire.

## 6. Configurer le webhook

App Meta → WhatsApp → *Configuration* → **Webhook** :

| Champ | Valeur |
|---|---|
| Callback URL | `https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/whatsapp-webhook` |
| Verify token | la valeur de `WA_VERIFY_TOKEN` posée à l'étape 4 |
| Champs abonnés | cocher **messages** (couvre les statuts de livraison) |

Meta appelle immédiatement l'URL en GET avec `hub.challenge`. La fonction le
renvoie en texte brut si le token correspond. En cas d'échec, vérifier dans les
logs Supabase : `[whatsapp-webhook] handshake refuse` indique un token
divergent, `WA_VERIFY_TOKEN absent` un secret non posé.

## 7. Premier envoi réel

Envoyer à **votre propre numéro** avant tout autre destinataire.

```bash
curl -X POST "https://pudugodhiofqrctcdwfl.supabase.co/functions/v1/send-whatsapp" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"213XXXXXXXXX","template":"otp_code","lang":"fr","params":{"code":"123456"}}'
```

Attendu : `{"ok":true,"message_id":"wamid...."}`, le message sur le téléphone,
puis dans les logs de `whatsapp-webhook` la séquence `sent` → `delivered` →
`read`. **Si les trois statuts n'arrivent pas, ne pas passer à l'étape 8** :
le webhook n'est pas correctement abonné et les échecs seraient invisibles.

## 8. Basculer l'ordre des canaux — EN DERNIER

Le repli est **documenté mais non branché**. `send-whatsapp` retourne un
contrat qui permet à l'appelant de décider :

```
200  { ok: true,  message_id, wa_id }
4xx  { ok: false, code, fallback: true|false, detail }
```

- `fallback: true` → ce message ne partira jamais par WhatsApp (destinataire
  sans WhatsApp, template rejeté, panne réseau). **Rejouer par `send-sms`.**
- `fallback: false` → problème de configuration de notre côté (token invalide,
  secrets absents, paramètre manquant). Réessayer en SMS masquerait la panne :
  **alerter**.

Le branchement se fera dans `appointment-reminders` et dans le hook OTP. Il
n'est volontairement pas écrit aujourd'hui : tant que WhatsApp n'a jamais
fonctionné en réel, un repli automatique masquerait les erreurs de
configuration au lieu de les révéler.

---

## Opt-in — obligatoire, à faire AVANT le premier envoi

La politique WhatsApp Business exige un consentement **explicite, préalable et
traçable** pour tout message initié par l'entreprise. Un opt-in absent expose à
la suspension du numéro, puis du compte. Ce n'est pas une formalité : Meta
échantillonne et sanctionne.

Le consentement doit indiquer clairement **qui** envoie et **quel type** de
messages.

### Où le placer

| Emplacement | Fichier | Nature |
|---|---|---|
| Inscription patient | `signup.html`, bloc consentements | case **non cochée par défaut** |
| Profil patient | `patient-profile.html`, préférences de notification | bascule activable/désactivable |
| Profil médecin | `medecin-profile.html` | même bascule |

> ⚠️ Case **décochée** par défaut. Une case pré-cochée n'est pas un
> consentement, ni au sens de la politique WhatsApp, ni au sens de la loi
> 18-07. La désactivation doit être aussi simple que l'activation.
>
> Ajouter la colonne correspondante à `public.users` — par exemple
> `whatsapp_opt_in_at TIMESTAMPTZ` — plutôt qu'un booléen : l'horodatage est ce
> qui rend le consentement **prouvable**. Une migration dédiée sera nécessaire.

### Texte proposé

**fr** — inscription :
> Je souhaite recevoir mes confirmations de rendez-vous et mes codes de
> connexion **par WhatsApp** de la part de Tabibi. Je peux me désinscrire à tout
> moment depuis mon profil, ou en répondant STOP.

**ar** — inscription :
> أرغب في تلقي تأكيدات مواعيدي ورموز الدخول **عبر واتساب** من طبيبي. يمكنني
> إلغاء الاشتراك في أي وقت من ملفي الشخصي، أو بالرد بكلمة STOP.

**fr** — profil, libellé court :
> Notifications par WhatsApp

**ar** — profil, libellé court :
> الإشعارات عبر واتساب

> Le SMS reste le canal par défaut pour qui n'a pas donné son accord WhatsApp.
> Aucun compte existant ne doit être basculé sans un nouvel opt-in explicite :
> le consentement au SMS ne vaut pas consentement à WhatsApp.

---

## Coûts — Algérie

**Les tarifs Meta changent régulièrement et varient par pays. Ne pas budgéter
sur des chiffres recopiés ici : lire la grille officielle au moment de la
décision.**

👉 **https://developers.facebook.com/docs/whatsapp/pricing**

Ce qu'il faut comprendre de la structure, indépendamment des montants :

| Catégorie | Usage Tabibi | Facturation |
|---|---|---|
| **Utility** | `rdv_confirmation` | par message envoyé |
| **Authentication** | `otp_code` | par message envoyé, tarif distinct de Utility |
| **Marketing** | *non utilisé* | le plus cher — à ne pas utiliser |
| **Service** | réponses dans la fenêtre de 24 h | gratuit |

Points à vérifier sur la grille avant de trancher :

1. **Le tarif algérien spécifiquement.** Il diffère fortement d'un pays à
   l'autre et l'Algérie n'est pas toujours dans les grilles résumées.
2. **Le modèle de facturation en vigueur.** Meta est passé d'une tarification
   par conversation de 24 h à une tarification par message pour Utility et
   Authentication ; vérifier lequel s'applique à la date du calcul.
3. **La comparaison avec BudgetSMS**, votre coût SMS actuel. WhatsApp n'est
   intéressant que s'il est moins cher **ou** significativement plus fiable —
   le taux de livraison mesuré sur le réseau DZ est le second critère.
4. **Le volume gratuit éventuel** accordé aux nouveaux comptes.

> Rappel de contexte : le sender alphanumérique SMS livre 5/5 en test contre
> 11/19 pour le sender numérique partagé (mesures du 31/07, MCCMNC 60302). Le
> SMS n'est donc plus le maillon faible qu'il était — WhatsApp doit se
> justifier sur le coût ou l'expérience, pas seulement sur la fiabilité.

---

## Rollback

Aucun rollback n'est nécessaire tant que l'étape 8 n'est pas faite : les
fonctions peuvent être déployées sans qu'aucun flux ne les appelle.

Après bascule, revenir au SMS consiste à rétablir l'ordre des canaux dans
`appointment-reminders` et le hook OTP. Les fonctions WhatsApp peuvent rester
déployées, inertes. Ne pas supprimer les templates côté Meta : leur
re-validation prendrait à nouveau plusieurs heures.
