# Push Notifications — État & Limites connues

Dernière mise à jour : 29 mai 2026 — Phase 3 mobile (FCM Android)

## Ce qui fonctionne

- Table `device_tokens` en prod avec RLS strict (authenticated only) — voir `migrations/PUSH_step1_device_tokens.sql`
- `js/capacitor-bridge.js` chargé sur `index.html`, `doctor-dashboard.html`, `login.html` (après `auth.js`)
- `initPushNotifications()` : permission → register → token FCM/APNs
- `saveDeviceToken()` : UPSERT du token dans `device_tokens` (idempotent sur `user_id,token`)
- Déclencheur : au chargement de `doctor-dashboard.html` (`DOMContentLoaded`), si `bridge.isNative` ET session active. Garde `window._tabibiPushInitDone` contre le double-appel.

## Limites connues (à traiter ultérieurement)

### (a) Trigger sur le dashboard médecin uniquement
Le déclencheur push est **uniquement** câblé sur `doctor-dashboard.html`. Un médecin
qui se connecte et atterrit sur le dashboard enregistre son token. Aucun autre
parcours n'enregistre de token pour l'instant.

Raison : le trigger a été déplacé de `auth.js signIn()` vers le dashboard car le
redirect post-login détruit le contexte JS avant la fin du flow async (permission →
token → save). Le dashboard est le point d'atterrissage stable.

### (b) Flow patient sans push
Les patients atterrissent sur une page différente du dashboard médecin. Avec le
trigger actuel (dashboard only), **les patients n'enregistrent aucun token push**.

À faire : ajouter un trigger équivalent sur la page d'atterrissage patient
(ex. espace patient / liste RDV) quand le push patient sera requis.

### (c) Réception de notifications non câblée
`onPushNotification()` existe dans `capacitor-bridge.js` (listeners
`pushNotificationReceived` + `pushNotificationActionPerformed`) mais **n'est appelé
nulle part**. L'app enregistre les tokens mais ne gère pas encore l'affichage /
le routage des notifications reçues au premier plan ou au tap.

À faire : câbler `onPushNotification()` quand un **backend d'envoi** existera
(Edge Function Supabase ou service serveur lisant `device_tokens` et postant à FCM/APNs).
Définir alors le payload (deep link cible, badge, son) et le routage in-app.

## Prérequis backend (non encore en place)

- Fonction serveur d'envoi (Edge Function / cron) lisant `device_tokens` et appelant
  l'API FCM (Android) / APNs (iOS)
- `google-services.json` présent sur la machine de build (voir `FIREBASE_SETUP.md`) — OK Android
- iOS : APNs key/certificat + entitlement push (non configuré — bloqué sur compte Apple Developer)

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `migrations/PUSH_step1_device_tokens.sql` | Table + RLS |
| `js/capacitor-bridge.js` | `initPushNotifications()`, `saveDeviceToken()`, `onPushNotification()` |
| `index.html`, `login.html` | Chargent le bridge (features natives) |
| `doctor-dashboard.html` | Charge le bridge + déclenche le push (trigger inline) |
| `docs/mobile/FIREBASE_SETUP.md` | Setup `google-services.json` |
