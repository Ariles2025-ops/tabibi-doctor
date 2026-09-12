# Défaut — la session disparaît, l'écran continue comme si de rien n'était

**Famille :** « l'écran ment » — même famille que les faux succès, mais dans l'autre sens.
Le faux succès affirme une écriture qui n'a pas eu lieu ; ici l'écran affirme une **identité** qui n'existe plus.

**Découvert le :** 12/09/2026, pendant le parcours 1 de la recette de la vague (compte R1, médecin avec fiche).
**Gravité :** moyenne à élevée sur un poste partagé (secrétariat, cabinet).
**Statut :** constaté et mesuré, non corrigé. Chantier séparé.

---

## 1. Ce qui se passe

La session Supabase disparaît du navigateur alors que la page reste ouverte. Ce n'est pas un cas de bord :
il suffit qu'un **autre onglet de la même origine** se déconnecte, ou qu'une autre page appelle `signOut()`.
Le stockage d'authentification est partagé par origine, donc la déconnexion vaut pour tous les onglets.

À partir de là :

- la page continue d'afficher **« Bonjour, RECETTE »**, le nom du médecin, ses compteurs, son agenda ;
- rien n'indique la déconnexion, ni bandeau, ni redirection, ni grisage ;
- l'utilisateur peut continuer à remplir des formulaires ;
- **l'échec n'apparaît qu'au premier écrit**, sous la forme d'un `403` muet : la modale reste ouverte,
  aucun toast, aucune explication. L'utilisateur croit avoir cliqué à côté et recommence.

## 2. Mesure du 12/09

| Observation | Valeur |
|---|---|
| Clés d'authentification dans le stockage local de `localhost:8080` | **aucune** |
| Expiration théorique du jeton | 19:38:56Z, soit ~50 min plus tard |
| Heure de l'incident | ~18:47Z |
| Appel `rpc/update_my_doctor_profile` | **403** |
| Écriture en base | aucune (`updated_at` inchangé) |
| Ce que la page affichait encore | « Bonjour, RECETTE », tableau de bord complet |
| Appel à `signOut()` dans le code du tableau de bord | seulement sur clic explicite de déconnexion |

La session n'a donc pas expiré : elle a été fermée ailleurs, dans la même origine.

## 3. Pourquoi — quatre causes qui se cumulent

1. **La garde d'authentification est une porte, pas une condition.** `requireAuth('medecin')` est appelée
   une seule fois, au chargement (`doctor-dashboard.html:980`). Elle redirige correctement vers la page de
   connexion si la session manque **à ce moment-là**. Après, plus rien ne revérifie, quelle que soit la durée
   pendant laquelle l'onglet reste ouvert.

2. **L'événement de déconnexion est reçu et volontairement ignoré.** Dans `js/tabibi-bridge.js:155`,
   `onAuthStateChange` traite `SIGNED_IN`, `TOKEN_REFRESHED` et `USER_UPDATED`, et laisse `SIGNED_OUT` de côté,
   avec le commentaire « on laisse `logout()` de l'app gérer le cleanup ». Or `logout()` n'est appelée que
   lorsque l'utilisateur clique sur Déconnexion **dans cet onglet-là**. Une déconnexion venue d'ailleurs
   déclenche bien l'événement, et personne ne l'écoute.

3. **Le repli sur la clé anonyme transforme un 401 en 403 muet.** `doctor-dashboard.html:543` et `:760`
   font `let token = SB_KEY;` puis remplacent par le jeton de session **s'il existe**. Sans session, la requête
   part quand même, signée avec la clé anonyme. PostgREST répond alors « permission refusée » plutôt que
   « non authentifié ». Le front ne peut plus distinguer « tu n'es plus connecté » de « tu n'as pas le droit ».
   Même repli dans `patient-dashboard.html:646` et `:785`.

4. **Aucune synchronisation entre onglets.** Il n'existe aucun écouteur de l'événement `storage` dans le dépôt.
   Un onglet ne sait jamais ce que les autres ont fait de la session.

## 4. Ce qu'il faudrait faire à la place

Par ordre de rapport valeur / effort.

1. **Écouter `SIGNED_OUT` et réagir** (`js/tabibi-bridge.js`). À la réception : vider l'affichage nominatif,
   afficher un bandeau « Votre session a été fermée. Reconnectez-vous pour continuer. » avec un bouton
   de reconnexion, et désactiver les boutons d'écriture. Ne pas rediriger brutalement : l'utilisateur peut
   avoir un formulaire en cours, et le perdre serait un second défaut.
   *C'est le correctif minimal, et il couvre à lui seul le cas mesuré.*

2. **Supprimer le repli sur la clé anonyme dans les pages authentifiées.** Sans session, on n'envoie pas la
   requête : on lève l'état « déconnecté » tout de suite. Un tableau de bord n'a aucune raison d'interroger
   la base en tant qu'anonyme. Cela rend aussi les erreurs lisibles : 401 = session, 403 = droits.

3. **Revalider la session aux moments qui comptent** : au retour de l'onglet au premier plan
   (`visibilitychange`), et juste avant tout écrit. Une revalidation avant écrit évite de perdre la saisie.

4. **Traiter tout `401`/`403` sur un appel authentifié comme un signal d'état, pas comme une erreur muette.**
   Aujourd'hui la modale des horaires reste ouverte sans rien dire. Elle devrait afficher le message
   correspondant, et conserver la saisie pour la rejouer après reconnexion.

5. **Écouter `storage`** pour propager le changement même si l'événement Supabase manque.

### Ce qu'il ne faut pas faire

Rediriger vers la page de connexion dès la perte de session, sans prévenir : cela détruit une saisie en cours
et donne l'impression d'un plantage. Le bandeau plus le blocage des écritures est le bon compromis.

## 5. Charge et rattachement

Le point 1 seul est une petite intervention, localisée dans `js/tabibi-bridge.js` plus un bandeau partagé.
Les points 2 et 4 touchent les deux tableaux de bord et méritent d'être faits ensemble, dans une branche
`fix/session-perdue-bandeau`. Rien de tout cela ne doit entrer dans la vague de fusion en cours :
c'est un chantier à part, à ouvrir après le déploiement.

À rapprocher de `docs/FICHE_R3_APPELS_DANS_LE_VIDE.md` et de `docs/preuves/2026-09-12_mes-horaires_preuve.md`,
qui recensent les « faux succès » déjà constatés, ainsi que du §9 bis de `docs/ARCHITECTURE_CIBLE.md`
(une règle métier vit à un seul endroit). La preuve de terrain de ce défaut-ci est dans
`docs/preuves/RECETTE-P1-2026-09-12.md`, section « Incident de fin de parcours ».
