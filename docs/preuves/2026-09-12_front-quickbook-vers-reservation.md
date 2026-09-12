# Front — l'accueil ne réserve plus sur une grille codée en dur (12/09/2026)

## Le double bug corrigé
1. **Grille codée en dur** : `js/home-app.js` proposait `["08:00",…,"16:30"]` (`generateSlots`) sans consulter
   `working_hours` ni le jour d'ouverture → un RDV pouvait être pris un dimanche fermé (mesuré le 12/09).
2. **Décalage d'une heure** : `finalBooking` construisait `scheduled_at` via `new Date(isoDate + 'T' + slot)`, parsé
   dans le **fuseau du navigateur** puis `toISOString()`. « 09:00 » affiché devenait 08:00 Alger en base. `tabibi-booking.js`
   (chemin `reservation.html`), lui, ancre explicitement sur `Africa/Algiers`.

## Le correctif : un seul chemin de disponibilité
`showBookingModal` (le point de passage de TOUTES les entrées de réservation de l'accueil : carte de recherche,
modale profil, bouton « Réserver ») ne construit plus de modale à grille codée en dur : il **route vers
`reservation.html`** avec les paramètres du médecin, exactement comme `doctor-profile.html`. `reservation.html`
appelle `get_available_slots` et ancre le fuseau sur Alger. `generateSlots` renvoie désormais `[]`. `finalBooking`
(qui portait le décalage horaire) devient du code mort, inatteignable.

Résultat : la disponibilité vit à un seul endroit, `get_available_slots`. Les deux bugs disparaissent ensemble
parce que leur cause commune — une seconde implémentation de la disponibilité dans le front — est supprimée.

## Preuve navigateur (branche servie, cache-bust)
`bookDoc(<id>)` (déclenché par « Prendre RDV ») navigue vers
`reservation.html?doctor_id=…&doctor_name=…&prix=…&spec=…` — le calendrier réel. Vérifié le 12/09 :
la barre d'adresse passe de `index.html` à `reservation.html` avec les bons paramètres, titre « Réservation en cours ».

## Mobile Capacitor
Le bundle embarque `js/home-app.js` (mêmes 3 copies : `android/app/src/main/assets/public`, `ios/App/App/public`, `www`).
Avant ce correctif, la grille codée en dur y était présente (grep : 1 occurrence par copie) — le même bug était donc
embarqué. Ces copies sont des **sorties de build** régénérées par `scripts/build-mobile.sh` / `cap sync` : ce correctif
sur `js/home-app.js` les corrige au prochain build. Sans build/run, on ne peut pas exercer l'app native en direct, mais
la source partagée garantit le même comportement.
