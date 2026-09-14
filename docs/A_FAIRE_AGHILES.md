# À faire — Aghiles

**Les tâches que personne d'autre ne peut faire à ta place.** Comptes, factures, clés,
consoles tierces, décisions commerciales.

> **Rien sur cette liste ne peut être fait depuis le dépôt.** Si une tâche peut être faite
> en code, elle n'a pas sa place ici — elle part en lot.

Mis à jour le **14/09/2026**.

---

## 🔴 URGENT — aujourd'hui ou demain

### 1. Régler la facture Supabase

Un bandeau d'impayé est affiché sur le projet. **Risque : suspension du projet.**
Si Supabase suspend, l'application entière s'arrête — base, authentification, API. Ce
n'est pas une dégradation, c'est un arrêt.

### 2. Supprimer le jeton Supabase affiché en clair le 14/09

Un jeton d'accès a été affiché en clair. **Il doit être révoqué, pas seulement remplacé** :
tant qu'il est valide, il ouvre l'API de gestion du projet.
*Supabase → Account → Access Tokens → révoquer, puis en créer un nouveau si besoin.*

> ⚠️ **Je ne touche à aucun jeton, je n'en lis aucun, je n'en affiche aucun** (règles 4 et
> 6 de `CLAUDE.md`). Cette ligne existe pour que la révocation ne s'oublie pas.

### 3. Vérifier la liste blanche des URL de redirection (Supabase Auth)

**Lié au bloquant B-2 de l'audit.** *Supabase → Authentication → URL Configuration →
Redirect URLs.*

La page « mot de passe oublié » envoie `https://tabibi.doctor/reset-password.html`
(**avec** `.html`). Cloudflare redirige ensuite en 308 vers `/reset-password` (**sans**).
**Si la forme envoyée n'est pas dans la liste, Supabase refuse la redirection** et
l'utilisateur ne reçoit rien d'exploitable.

**À vérifier** : que `https://tabibi.doctor/reset-password.html` **et**
`https://tabibi.doctor/reset-password` y figurent tous les deux.

*(Le code, lui, est corrigé : l'écran n'annonce plus « envoyé » quand l'envoi échoue.)*

### 3 bis. Poser la clé de signature des ordonnances

**Bloque le lot ordonnances.** Le code des deux edge functions est écrit ; il ne peut
être déployé utilement sans ces deux secrets.

*Supabase → Edge Functions → Secrets.*

| Nom **exact** | Valeur |
|---|---|
| `PRESCRIPTION_SIGNING_KEY_V1` | une clé aléatoire d'**au moins 32 caractères** — par ex. la sortie de `openssl rand -base64 48` |
| `PRESCRIPTION_SIGNING_KEY_CURRENT` | exactement `v1` |

> ⚠️ **Je ne pose ni ne lis cette clé, et elle n'apparaîtra jamais dans un rapport,
> un journal ou une réponse HTTP** (règles 4 et 6). La fonction refuse de signer si
> elle est absente : elle ne fabrique **jamais** une signature de repli — une
> signature sans clé aurait l'air valide.

**Ce qui se passe si tu la changes plus tard** : les ordonnances déjà signées restent
vérifiables **tant que la `V1` reste posée**. Une rotation consiste à *ajouter*
`PRESCRIPTION_SIGNING_KEY_V2` et à passer `..._CURRENT` à `v2` — jamais à écraser la V1.
Retirer une ancienne clé rend invalides les ordonnances qu'elle a signées.

*(Facultatif : `PUBLIC_SITE_URL` si l'URL imprimée sur le PDF doit être autre chose que
`https://tabibi.doctor`.)*

---

## 🔑 SÉCURITÉ DU COMPTE

### 4. Activer la 2FA sur GitHub
Le dépôt contient la totalité du produit. Un compte GitHub sans second facteur est le
point d'entrée le plus simple.

### 5. Coller la clé de sauvegarde v2 dans le gestionnaire de mots de passe
Une clé de secours qui n'est nulle part est une clé perdue le jour où elle sert.

### 6. Désinstaller les deux projets Vercel + l'application GitHub Vercel
Surface d'hébergement inutilisée qui garde un accès en lecture au dépôt.

### 7. Supprimer l'ancien site Netlify `effulgent-kelpie-e48e81`

**Mesuré le 13/09** : sa racine servait **l'application complète**, branchée sur la base
de **production**, sans la porte fermée — et dans une version antérieure à `main`.
**C'est une seconde porte d'entrée que personne ne surveille.**
Soit le supprimer, soit le déconnecter du dépôt. *(À faire en console : le dépôt ne dit ni
la branche de production ni l'état des builds.)*

---

## 📊 QUALITÉ — après le lancement

### 8. Créer le compte Sentry et poser le vrai DSN
Le DSN actuel est un remplaçant. Sans DSN réel, **aucune erreur de production ne remonte** :
on découvrirait les pannes par les utilisateurs.

### 9. Mettre à jour le gabarit Brevo « waiting_list_welcome »

**Lié au bloquant B-1.** L'e-mail de bienvenue annonçait « 500+ inscrits » alors que la
liste était vide. Le code n'envoie plus ce chiffre tant qu'il n'est pas mesuré — **mais le
gabarit, lui, est chez Brevo**. Sa phrase « rejoignez les {count} personnes… » doit devenir
conditionnelle, sinon elle se rendra avec un trou.

---

## 🤝 SÉANCES COMMUNES — à faire ensemble

### 10. Fournisseur vidéo Daily : compte, clés, salle réelle
Aujourd'hui l'URL de salle est un **remplaçant** (`https://placeholder.daily.co/…`). Le
drapeau `video` restera fermé tant qu'il n'y a pas de fournisseur réel.

### 11. Brancher le SMS / OTP réel
Compte BudgetSMS audité ; le branchement de bout en bout reste à faire ensemble.

### 12. Tests réels bout en bout — Dawini et téléconsultation, sur un environnement d'essai
**Jamais exercés de bout en bout.** C'est la seule façon de trouver ce qu'aucune relecture
ne trouve — la leçon de la semaine.

---

## 💼 COMMERCIAL & ADMINISTRATIF (Algérie)

### 13. SATIM (CIB / Edahabia) — entité enregistrée pour encaisser
Sans entité déclarée, **aucun encaissement n'est possible**. Le délai administratif est
long : c'est le genre de chose qui bloque un lancement alors que tout le code est prêt.

---

## Décisions qui attendent, hors console

Ce ne sont pas des tâches à exécuter mais des **arbitrages** — ils bloquent du code.

| | |
|---|---|
| **Consentements** | 34 des 40 comptes réels n'ont pas de ligne dans le registre versionné (créés avant le 18/07). Recopier les horodatages, ou re-demander ? **À décider avec le juriste.** |
| **Périmètre de l'export RGPD** | L'export « mes données » ne contient ni les favoris côté serveur ni l'historique des consentements. **À trancher avec l'avocat avant le lancement.** |
| **Inscription secrétaire** | Rôle retiré du parcours public (il demandait un code qui n'existe pas). À rouvrir avec un vrai mécanisme d'invitation — **c'est un lot cabinet entier.** |
| **Lecture du journal d'audit** | La politique « Only admins read audit » est inatteignable : pas de `GRANT`. L'assumer (lecture en base seulement) ou l'ouvrir ? **Le journal contient des données de santé.** |
| **Ordonnances en arabe** | Le PDF ne sait imprimer que du latin : les 14 polices standard du format n'ont aucun glyphe arabe. La fonction **refuse de signer** plutôt que de remplacer les caractères par `?` — mutiler un nom de médicament en silence est un risque pour le patient. Ouvrir l'arabe = embarquer une police Unicode (Noto Naskh, OFL, ~300 Ko dans le dépôt) + le rendu droite-à-gauche : **c'est un lot à soi.** À trancher : combien de médecins prescriront en arabe au congrès ? |
| **QR code sur l'ordonnance** | Le PDF imprime l'URL de vérification **en texte**. Un pharmacien doit donc la recopier. Un QR la rendrait scannable — une dépendance de plus, et un lot court. À dire si ça compte pour décembre. |
