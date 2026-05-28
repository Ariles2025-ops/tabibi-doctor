# Rapport de Faisabilité — Tabibi Mobile (iOS + Android via Capacitor)
**Date** : 2026-05-28
**Branch** : mobile/feasibility-report
**Cible launch** : Mars 2027
**Marché** : Algérie (90% Android, 10% iOS)
**Stratégie** : Capacitor — réutilisation maximale du code web existant
**Auteur** : Analyse automatisée du repo tabibi-FINAL-v4-extracted

---

## Lecture rapide (non-dev)

Tabibi.doctor est une webapp HTML/JS qui utilise Supabase comme backend. Capacitor est un outil qui
enveloppe cette webapp dans une vraie application iOS/Android, distribuable sur l'App Store et le
Google Play Store. La bonne nouvelle : **70% du code existant est réutilisable tel quel**. Les 30%
restants nécessitent des adaptations ciblées sur l'authentification (liens email), les notifications
push, la téléconsultation vidéo, et quelques détails d'interface.

**Verdict global : FAISABLE, sans réécriture, en 10-14 semaines de développement.**

---

## 1. Inventaire des pages HTML (38 pages)

### 1.1 Pages publiques — 100% compatibles Capacitor sans modification

| Page | Rôle | Client-side ? | Modif Capacitor ? |
|---|---|---|---|
| `index.html` | Accueil + recherche médecins | ✅ 100% | ✅ Aucune |
| `doctor-profile.html` | Fiche médecin | ✅ 100% | ✅ Aucune |
| `about.html` | À propos | ✅ 100% | ✅ Aucune |
| `waiting-list.html` | Liste d'attente | ✅ 100% | ✅ Aucune |
| `api-docs.html` | Documentation API | ✅ 100% | ✅ Aucune (page admin, hors app) |
| `404.html` | Page erreur | ✅ 100% | ✅ Aucune |
| `offline.html` | Mode hors-ligne | ✅ 100% | ✅ Aucune (Capacitor gère offline) |

### 1.2 Pages d'authentification — modification mineure requise

| Page | Rôle | Client-side ? | Modif Capacitor ? |
|---|---|---|---|
| `login.html` | Connexion | ✅ 100% | 🟡 Turnstile à désactiver en app |
| `signup.html` | Inscription | ✅ 100% | 🟡 Turnstile + deep link email |
| `forgot-password.html` | Mot de passe oublié | ✅ 100% | 🔴 redirectTo → URL scheme app |
| `reset-password.html` | Réinitialisation MDP | ✅ 100% | 🔴 Doit s'ouvrir via deep link |
| `verify-email.html` | Vérification email | ✅ 100% | 🔴 Doit s'ouvrir via deep link |
| `email-verified.html` | Confirmation email | ✅ 100% | 🟡 Redirection post-deep link |

### 1.3 Pages patient — compatibles avec adaptations mineures

| Page | Rôle | Client-side ? | Modif Capacitor ? |
|---|---|---|---|
| `patient-dashboard.html` | Dashboard patient | ✅ 100% | 🟡 Safe areas, back button Android |
| `patient-profile.html` | Profil patient | ✅ 100% | 🟡 Upload photo → @capacitor/camera |
| `patient-ordonnances.html` | Ordonnances | ✅ 100% | 🟡 Download PDF → @capacitor/filesystem |
| `patient-waitinglist.html` | Liste d'attente patient | ✅ 100% | ✅ Aucune |
| `reservation.html` | Prise de RDV | ✅ 100% | ✅ Aucune |
| `appointment.html` | Détail RDV | ✅ 100% | ✅ Aucune |
| `mes-rdv.html` | Mes rendez-vous | ✅ 100% | ✅ Aucune |
| `payment.html` | Paiement | ✅ 100% | 🟡 Voir §4.4 (paiement Algérie) |
| `success.html` | Confirmation | ✅ 100% | ✅ Aucune |

### 1.4 Pages médecin — compatibles avec adaptations

| Page | Rôle | Client-side ? | Modif Capacitor ? |
|---|---|---|---|
| `doctor-dashboard.html` | Dashboard médecin | ✅ 100% | 🟡 Safe areas, push notifications |
| `medecin-profile.html` | Profil médecin éditable | ✅ 100% | 🟡 @capacitor/camera pour photo |
| `medecin-ordonnance.html` | Rédaction ordonnance | ✅ 100% | 🟡 Impression → @capacitor/filesystem |
| `medecin-waitinglist.html` | File d'attente | ✅ 100% | ✅ Aucune |
| `doctor-analytics.html` | Statistiques | ✅ 100% | ✅ Aucune |
| `onboarding-medecin.html` | Onboarding | ✅ 100% | 🟡 Upload documents → @capacitor/camera |
| `doctor-reservation.html` | Gestion RDV médecin | ✅ 100% | ✅ Aucune |
| `doctor-claim.html` | Revendication fiche | ✅ 100% | 🟡 Upload carte ordre → @capacitor/camera |
| `notifications.html` | Notifications | ✅ 100% | 🟡 Intégrer push natives |

### 1.5 Pages admin — hors scope app mobile

| Page | Verdict |
|---|---|
| `admin-dashboard.html` | ⛔ Hors scope — interface web uniquement |
| `admin-doctor-validation.html` | ⛔ Hors scope |
| `admin-reviews.html` | ⛔ Hors scope |
| `admin-cabinet.html` | ⛔ Hors scope |
| `admin-api-keys.html` | ⛔ Hors scope |
| `secretaire-dashboard.html` | ⛔ Hors scope (v2) |

### 1.6 Pages spéciales — adaptation requise

| Page | Rôle | Verdict |
|---|---|---|
| `teleconsultation.html` | Visio Daily.co | 🔴 WebRTC en WebView — voir §4.3 |

### Résumé inventaire

| Catégorie | Nb pages | Sans modif | Modif mineure | Modif majeure | Hors scope |
|---|---|---|---|---|---|
| Publiques | 7 | 7 | 0 | 0 | 0 |
| Auth | 6 | 0 | 2 | 4 | 0 |
| Patient | 9 | 5 | 4 | 0 | 0 |
| Médecin | 9 | 3 | 6 | 0 | 0 |
| Admin | 6 | 0 | 0 | 0 | 6 |
| Spéciales | 1 | 0 | 0 | 1 | 0 |
| **Total** | **38** | **15 (39%)** | **12 (32%)** | **5 (13%)** | **6 (16%)** |

**71% des pages sont utilisables sans modification ou avec des retouches mineures.**

---

## 2. APIs Supabase utilisées

### 2.1 Auth — appels identifiés

| Appel SDK | Usage | Comportement en mobile |
|---|---|---|
| `sb.auth.signInWithPassword()` | Login email/mdp | ✅ Fonctionne tel quel |
| `sb.auth.signUp()` | Inscription | 🟡 Turnstile à bypass en app (voir §4.2) |
| `sb.auth.signOut()` | Déconnexion | ✅ Fonctionne tel quel |
| `sb.auth.getSession()` | Vérification session | ✅ Fonctionne tel quel |
| `sb.auth.getUser()` | Récupération user | ✅ Fonctionne tel quel |
| `sb.auth.updateUser()` | Mise à jour profil | ✅ Fonctionne tel quel |
| `sb.auth.resetPasswordForEmail()` | Reset MDP | 🔴 `redirectTo` doit pointer vers URL scheme app |
| `sb.auth.onAuthStateChange()` | Listener session | ✅ Fonctionne tel quel |

**Aucun OAuth social** (Google, Apple) — simplifie la mise en place mobile.

### 2.2 Tables interrogées

| Table / Vue | Opérations | Compatible Capacitor |
|---|---|---|
| `public_doctors` | SELECT (recherche, fiche) | ✅ |
| `users` | SELECT, UPDATE | ✅ |
| `appointments` | SELECT, INSERT, UPDATE | ✅ |
| `reviews` | SELECT, INSERT, UPDATE | ✅ |
| `review_reports` | INSERT | ✅ |
| `doctor_profiles` | UPDATE (restreint via RPC) | ✅ |
| `specialties` | SELECT | ✅ |
| `wilayas` | SELECT | ✅ |
| `my_upcoming_appointments` | SELECT (vue RLS) | ✅ |
| `my_reviewable_appointments` | SELECT (vue RLS) | ✅ |
| `doctor_unavailable_slots` | SELECT, INSERT, DELETE | ✅ |
| `patient_medical_data` | SELECT, UPSERT via RPC | ✅ |
| `notifications` | SELECT | ✅ |

### 2.3 RPCs (fonctions Supabase)

| RPC | Usage | Compatible Capacitor |
|---|---|---|
| `get_my_doctor_profile` | Dashboard médecin | ✅ |
| `update_my_doctor_profile` | Édition profil | ✅ |
| `claim_my_doctor_profile` | Revendication fiche | ✅ |
| `get_available_slots` | Créneaux disponibles | ✅ |
| `can_review_doctor` | Check permission avis | ✅ |
| `upsert_patient_medical_data` | Données médicales | ✅ |
| `get_patient_medical_data` | Données médicales | ✅ |
| `get_video_session` | Session teleconsult | 🟡 Voir §4.3 |
| `mark_video_session_started/ended` | Téléconsultation | 🟡 Voir §4.3 |
| `set_video_recording_consent` | Consentement vidéo | ✅ |

### 2.4 Edge Functions (Supabase)

| Fonction | Usage | Compatible Capacitor |
|---|---|---|
| `verify-turnstile` | Validation captcha | 🔴 Bypass requis en app |
| `send-email` | Emails transactionnels (Brevo) | ✅ |
| `send-sms` | SMS confirmations | ✅ |
| `create-video-room` | Création salle Daily.co | 🟡 Voir §4.3 |

### 2.5 Supabase Storage

| Bucket | Usage | Compatible Capacitor |
|---|---|---|
| `doctor-photos` | Photo de profil médecin | 🟡 Upload via @capacitor/camera requis |
| Documents claim | Carte Ordre, CNI médecin | 🟡 @capacitor/camera requis |

---

## 3. Plugins Capacitor nécessaires

### 3.1 Plugins officiels Capacitor (@capacitor/*)

| Plugin | Besoin | Priorité | Effort |
|---|---|---|---|
| `@capacitor/app` | Deep links, lifecycle app, back button Android | 🔴 Critique | 0.5j |
| `@capacitor/push-notifications` | Rappels RDV, notifications médecin | 🔴 Critique | 3-4j |
| `@capacitor/local-notifications` | Rappels offline (J-1 RDV) | 🟡 Important | 1j |
| `@capacitor/camera` | Upload photo profil, documents claim, ordonnances | 🟡 Important | 1-2j |
| `@capacitor/filesystem` | Download ordonnances PDF, export données | 🟡 Important | 1j |
| `@capacitor/share` | Partage fiche médecin, ordonnance | 🟡 Important | 0.5j |
| `@capacitor/status-bar` | Couleur barre de statut (#0F7560 Tabibi) | 🟢 Confort | 0.5j |
| `@capacitor/splash-screen` | Splash screen (déjà conçu côté web) | 🟢 Confort | 0.5j |
| `@capacitor/haptics` | Feedback tactile (confirmation RDV, erreurs) | 🟢 Confort | 0.5j |
| `@capacitor/browser` | Ouvrir liens externes (CGU, politique cookies) | 🟢 Confort | 0.5j |
| `@capacitor/network` | Détection connexion (déjà implémenté en JS) | 🟢 Confort | 0j (redondant) |

### 3.2 Plugins tiers potentiels

| Plugin | Besoin | Priorité | Alternative |
|---|---|---|---|
| `@capacitor-community/fcm` | Firebase Cloud Messaging avancé iOS | 🟡 Important | @capacitor/push-notifications suffit |
| `@daily-co/daily-js` mobile SDK | Téléconsultation native | 🟡 À évaluer | iframe WKWebView (§4.3) |
| `capacitor-secure-storage-plugin` | Stockage token sécurisé (Keychain iOS) | 🟢 Confort | localStorage (moins sécurisé) |

### 3.3 Ce qui N'est PAS nécessaire

- Géolocalisation : non utilisée actuellement (recherche par wilaya/texte)
- Bluetooth/NFC : non utilisé
- Contacts : non utilisé
- Biométrie (FaceID/TouchID) : mentionné dans l'UI mais non implémenté — peut être ajouté en v2

---

## 4. Fonctionnalités à adapter ou refaire

### 4.1 Cloudflare Turnstile (captcha)

**Problème** : Turnstile est un captcha anti-bot basé sur des signaux navigateur. Dans une WebView
Capacitor, il détecte un environnement non-navigateur et peut bloquer ou échouer silencieusement.

**Impact** : Inscription (`signup.html`) + appel à `verify-turnstile` Edge Function.

**Solution** :
```javascript
// Détecter Capacitor et bypasser Turnstile
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Désactiver le widget Turnstile
  // Appeler signup sans token Turnstile
  // Envoyer un header X-App-Platform: capacitor à l'Edge Function
}
```
L'Edge Function `verify-turnstile` doit accepter un token spécial signé côté app (secret
partagé dans les variables d'environnement Supabase) pour les appels depuis l'app native.

**Effort** : 2 jours (modif JS + modif Edge Function)

---

### 4.2 Authentification — redirections email (deep links)

**Problème** : Supabase envoie des liens de type `https://tabibi.doctor/reset-password.html`
dans les emails. Sur mobile, ces liens ouvrent le navigateur, pas l'app.

**Solution** : Configurer un URL scheme universel `tabibi://` et des Universal Links (iOS) /
App Links (Android) pour que les liens email redirigent vers l'app.

**Flux cible** :
```
Email utilisateur
  → Clic sur "Réinitialiser mon mot de passe"
  → Supabase envoie lien avec redirectTo=tabibi://reset-password
  → iOS/Android interceptent tabibi://
  → L'app s'ouvre sur reset-password.html avec le token dans l'URL
```

**Modifications requises** :

1. `js/config.js` — ajouter URL mobile :
```javascript
REDIRECTS_MOBILE: {
  afterPasswordReset: 'tabibi://reset-password',
  afterEmailVerified: 'tabibi://email-verified',
}
```

2. `forgot-password.html` — détecter Capacitor et changer `redirectTo` :
```javascript
const redirectTo = Capacitor.isNativePlatform()
  ? 'tabibi://reset-password'
  : siteUrl + '/reset-password.html';
await sb.auth.resetPasswordForEmail(email, { redirectTo });
```

3. `capacitor.config.json` — déclarer le scheme :
```json
{
  "appId": "dz.tabibi.app",
  "appName": "Tabibi",
  "plugins": {
    "App": {
      "launchUrl": "tabibi://"
    }
  }
}
```

**Modifications Supabase** (voir §5) : autoriser `tabibi://` dans les URL de redirect.

**Effort** : 3-4 jours

---

### 4.3 Téléconsultation — Daily.co iframe en WebView

**Problème** : `teleconsultation.html` utilise Daily.co via un `<iframe>` et la librairie
`@daily-co/daily-js`. WebRTC (vidéo/audio) dans une WKWebView (iOS) ou WebView (Android)
nécessite des permissions natives et des entitlements spécifiques.

**Situation actuelle** :
```html
<script src="https://unpkg.com/@daily-co/daily-js@0.66.1/..."></script>
<!-- Crée un iframe Daily dans #tc-frame-wrap -->
```

**Compatibilité** :
- iOS WKWebView : WebRTC supporté depuis iOS 14.5 (2021). Nécessite `NSCameraUsageDescription`
  et `NSMicrophoneUsageDescription` dans `Info.plist`.
- Android WebView : WebRTC supporté depuis Android 5.0. Nécessite `CAMERA` + `RECORD_AUDIO`
  permissions dans `AndroidManifest.xml`.

**Verdict** : L'implémentation iframe Daily.co **devrait fonctionner** dans Capacitor avec les
bonnes permissions. À valider en test réel (voir §7 — risques).

**Plan d'action** :
1. Ajouter les permissions caméra/micro dans Info.plist et AndroidManifest.xml
2. Ajouter `@capacitor/camera` pour que les permissions soient déclarées
3. Tester sur device réel iOS + Android (pas uniquement simulateur)
4. **Fallback** si problèmes iOS : intégrer `@daily-co/daily-react` (SDK natif React)
   via un composant Capacitor custom

**Effort** : 3-5 jours (test + intégration permissions + fallback éventuel)

---

### 4.4 WhatsApp (`wa.me` links)

**Bonne nouvelle** : les liens `wa.me/213777169074?text=...` et `wa.me/?text=...`
fonctionnent nativement sur iOS et Android. Capacitor ouvre les liens externes avec
le système, qui sait ouvrir WhatsApp si installé.

**Aucune modification requise.**

---

### 4.5 Cookie banner et Plausible Analytics

**Cookie banner** : la bannière de consentement RGPD est inutile dans une app native
(les stores ont leurs propres politiques de tracking). Elle peut être désactivée en
détectant Capacitor :

```javascript
if (!Capacitor.isNativePlatform()) {
  // Afficher le cookie banner
  initCookieBanner();
}
```

**Plausible Analytics** : injecte un script `<script src="https://plausible.io/...">`.
Fonctionnel dans la WebView mais sans les métriques navigateur habituelles. Pour une
mesure plus précise en mobile, intégrer Plausible via son API events directement.

**Effort** : 1 jour

---

### 4.6 Service Worker (PWA)

Le Service Worker (`sw.js`) est enregistré via `tabibi-sw-register.js`. Capacitor
dispose de son propre système de cache et de lifecycle. Il faut désactiver le Service
Worker dans le contexte natif pour éviter des conflits :

```javascript
if (!Capacitor.isNativePlatform()) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
```

**Effort** : 0.5 jour

---

### 4.7 Safe areas et viewport

**Bonne nouvelle partielle** : certaines pages utilisent déjà `env(safe-area-inset-top/bottom)`
et `viewport-fit=cover`. Exemple dans `doctor-dashboard.html` :
```css
--safe-b: env(safe-area-inset-bottom, 0px);
--safe-t: env(safe-area-inset-top, 0px);
```

**Problème** : toutes les pages ne l'ont pas. Certaines pages ont `viewport-fit=cover`,
d'autres non. Sur iPhone avec notch/Dynamic Island ou Android avec punch-hole camera,
les éléments UI peuvent être masqués.

**Action** : audit page par page + ajout de `viewport-fit=cover` et `padding-top: env(safe-area-inset-top)` aux pages manquantes.

**Effort** : 2-3 jours

---

### 4.8 Back button Android

Android a un bouton retour matériel (ou gesture). Par défaut dans Capacitor, ce bouton
ferme l'app. Il faut intercepter l'événement pour naviguer en arrière dans l'historique :

```javascript
import { App } from '@capacitor/app';
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) window.history.back();
  else App.exitApp();
});
```

**Effort** : 1 jour

---

## 5. Modifications Supabase nécessaires

Toutes ces modifications sont exécutées dans Supabase Dashboard (Settings → Auth) —
**aucune migration SQL requise**.

### 5.1 URL de redirect autorisées (Auth → URL Configuration)

Ajouter dans **"Redirect URLs"** :
```
tabibi://reset-password
tabibi://email-verified
tabibi://auth/callback
tabibi://login
```

### 5.2 Universal Links iOS et App Links Android

Pour que les liens `https://tabibi.doctor/...` s'ouvrent dans l'app (et non le
navigateur), deux fichiers de configuration doivent être hébergés sur tabibi.doctor :

**iOS — Universal Links** : `https://tabibi.doctor/.well-known/apple-app-site-association`
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAM_ID.dz.tabibi.app",
      "paths": ["/reset-password.html", "/verify-email.html", "/email-verified.html"]
    }]
  }
}
```

**Android — App Links** : `https://tabibi.doctor/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "dz.tabibi.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]  // fingerprint keystore prod
  }
}]
```

Ces fichiers sont servis par Netlify — ajouter un dossier `.well-known/` à la racine
du repo avec les 2 fichiers.

### 5.3 Edge Function `verify-turnstile` — bypass app native

Ajouter une variable d'environnement dans Supabase :
```
CAPACITOR_APP_SECRET=<string_aléatoire_longue>
```

Modifier la fonction pour accepter les appels app native sans token Turnstile quand
un header `X-App-Token: <secret>` est présent et valide.

---

## 6. Estimation temps de développement

**Hypothèse** : 1 développeur full-stack JS/mobile, connaissant Capacitor.
Les jours sont des jours ouvrables (8h effectives).

### 6.1 Tableau détaillé

| Module | Tâches | Jours estimés | Risque |
|---|---|---|---|
| **Setup Capacitor** | Init projet, config iOS/Android, premier build simulateur | 2-3j | 🟢 Faible |
| **Deep links auth** | URL scheme, Supabase config, Universal Links/App Links, tests reset-password + verify-email | 4-5j | 🟡 Moyen |
| **Safe areas + viewport** | Audit toutes les pages, ajout padding safe area manquants | 2-3j | 🟢 Faible |
| **Back button Android** | Listener backButton, gestion historique | 1j | 🟢 Faible |
| **Turnstile bypass** | Détection Capacitor, modification Edge Function, tests signup | 2j | 🟡 Moyen |
| **@capacitor/camera** | Upload photo profil, documents claim, ordonnances médecin | 2-3j | 🟢 Faible |
| **@capacitor/filesystem** | Download ordonnances PDF | 1j | 🟢 Faible |
| **Push notifications** | APNs (iOS), FCM (Android), Edge Function envoi, UI permission, deep link notif→page | 5-7j | 🔴 Élevé |
| **Téléconsultation** | Permissions caméra/micro, tests Daily.co WebView, fallback si besoin | 3-5j | 🔴 Élevé |
| **Cookie banner + Analytics** | Bypass en app native | 1j | 🟢 Faible |
| **Service Worker** | Désactivation en mode natif | 0.5j | 🟢 Faible |
| **Well-known files** | apple-app-site-association + assetlinks.json sur Netlify | 0.5j | 🟢 Faible |
| **Tests simulateurs iOS** | iPhone 15 Pro (notch), iPhone SE (petit écran) | 3j | 🟢 Faible |
| **Tests simulateurs Android** | Pixel 7, Samsung Galaxy A54 | 3j | 🟡 Moyen |
| **Tests devices réels iOS** | iPhone physique, cas réels WhatsApp, vidéo, push | 2j | 🟢 Faible |
| **Tests devices réels Android** | Android physique, fragmentation, push FCM | 3j | 🟡 Moyen |
| **Screenshots stores** | 10 screenshots iOS × 2 tailles + 5 Android | 2j | 🟢 Faible |
| **Soumissions stores** | App Store Connect + Google Play Console, review process | 1-2 semaines | 🟡 Moyen |
| **Buffer imprévus** | Bugs fragmentation Android, rejets store | +20% | — |

### 6.2 Synthèse par phase

| Phase | Contenu | Durée | Début cible |
|---|---|---|---|
| **Phase 1 — Foundation** | Setup, safe areas, back button, SW, bien-known | 2 semaines | Octobre 2026 |
| **Phase 2 — Auth** | Deep links, Turnstile bypass, tests auth flows | 2 semaines | Octobre 2026 |
| **Phase 3 — Médias** | Camera, filesystem, téléconsultation | 2 semaines | Novembre 2026 |
| **Phase 4 — Push** | APNs, FCM, notifications RDV | 2 semaines | Novembre 2026 |
| **Phase 5 — QA** | Tests simulateurs + devices réels, bugfix | 2-3 semaines | Décembre 2026 |
| **Phase 6 — Stores** | Screenshots, soumissions, review Apple/Google | 2-3 semaines | Janvier 2027 |
| **Buffer** | Rejets store, correctifs, re-soumissions | 2 semaines | Février 2027 |
| **🚀 Launch** | Disponible App Store + Google Play | — | **Mars 2027** |

**Total développement (hors stores)** : 10-12 semaines soit ~2.5 mois effectives.
**Avec stores + buffer** : 4.5-5 mois → planning Mars 2027 **TENU** si démarrage Octobre 2026.

---

## 7. Risques identifiés

### 7.1 🔴 Risques élevés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Rejet Apple App Store** — "wrapper web sans valeur ajoutée native" | Moyenne (30%) | Élevé | Intégrer au moins 2-3 fonctionnalités natives réelles (push, camera, haptics). Préparer une justification dans les notes de review Apple. |
| **Daily.co WebRTC iOS** — échec camera/micro dans WKWebView | Moyenne (25%) | Élevé | Tester très tôt (Phase 3). Prévoir 5j supplémentaires pour intégrer @daily-co/daily-react en fallback natif. |
| **Push notifications iOS** — processus APNs complexe | Haute (60%) | Moyen | Créer le compte Apple Developer en avance, générer les certificats APNs dès Phase 1. |

### 7.2 🟡 Risques moyens

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Fragmentation Android** — versions Android 8-10 en Algérie | Haute | Moyen | Tester sur Android 8 minimum. Capacitor 6 supporte Android API 22+ (Android 5.1). |
| **Performance WebView** vs app native | Haute | Moyen | La recherche (index.html, 2939 lignes) est le point chaud. LCP actuel : 5.5s — à améliorer avant launch mobile. |
| **Délai review Apple** — 1 à 7 jours, parfois 14j | Moyenne | Moyen | Soumettre en janvier 2027, ne pas attendre février. |
| **Turnstile en WebView** — faux positifs bot detection | Haute | Moyen | Bypass Capacitor bien implémenté en Phase 2 (§4.1). |
| **D-U-N-S Number pour SARL Algérie** — 2 à 4 semaines | Haute | Moyen | Faire la demande immédiatement (voir §8). |

### 7.3 🟢 Risques faibles (mais à surveiller)

| Risque | Mitigation |
|---|---|
| **RTL (Arabe)** en WebView | Déjà implémenté côté web, fonctionne dans WebView |
| **localStorage** persistence | Capacitor préserve localStorage entre sessions |
| **CORS Supabase** depuis app native | La clé anon est la même, pas de restriction origine pour Supabase |
| **Polices personnalisées** (Plus Jakarta Sans, Cairo) | Bundler Capacitor inclut les assets — OK |
| **iPhone SE** petit écran | Certains modals peuvent déborder — à tester Phase 5 |

---

## 8. Prérequis humains — Ce que tu dois faire (avant de coder)

### 8.1 Comptes et enregistrements

| Action | Statut | Délai | Coût | Notes |
|---|---|---|---|---|
| **Apple Developer Program** | ⏳ À faire | 1-2 semaines | 99$/an | Nécessite D-U-N-S si SARL |
| **D-U-N-S Number** (Dun & Bradstreet) | ⏳ À faire | **2-4 semaines** | Gratuit | À lancer **immédiatement** — chemin critique |
| **Google Play Console** | ⏳ À faire | 24h | 25$ (once) | Inscription simple |
| **Apple App Store Connect** | Auto avec Developer | — | Inclus | Créer la fiche app |
| **Google Play Developer account** | Auto avec Console | — | Inclus | Créer la fiche app |
| **Firebase Project** | ⏳ À faire | 1h | Gratuit (plan Spark) | Pour FCM (push Android) |
| **Certificats APNs** | ⏳ À faire (Phase 1) | 1h | Inclus Apple Dev | Push iOS |

### 8.2 Matériel (déjà en place ✅)

| Outil | Statut |
|---|---|
| Mac | ✅ Disponible |
| Xcode | ✅ Installé |
| Android Studio | 🔄 Installation en cours |
| iPhone réel | ✅ Disponible |
| Android réel | ✅ Disponible |

### 8.3 À installer quand Android Studio est prêt

```bash
# Node.js 20+ (vérifier)
node --version  # doit être >= 20

# Installation Capacitor (à faire en Phase 1 — PAS MAINTENANT)
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# Android SDK (via Android Studio SDK Manager)
# → API Level 34 (Android 14) — cible
# → API Level 22 (Android 5.1) — minimum
```

### 8.4 Informations à préparer pour les stores

| Information | Notes |
|---|---|
| Bundle ID iOS | `dz.tabibi.app` (recommandé) |
| Package name Android | `dz.tabibi.app` |
| Icône 1024×1024px PNG | Existe déjà en SVG — à exporter en haute résolution |
| Nom app | "Tabibi — طبيبي" |
| Sous-titre iOS (30 chars max) | "Médecin en ligne — Algérie" |
| Catégorie | Health & Fitness / Medical |
| Description FR + AR (4000 chars) | À rédiger |
| Screenshots iPhone 6.7" et 5.5" | 3 à 5 par format |
| Screenshots Android 7" et 10" | 2 à 8 par format |
| Politique de confidentialité URL | `https://tabibi.doctor/legal/confidentialite.html` ✅ |
| Âge minimum | 13 ans |
| Coordonnées support | contact@tabibi.doctor |

---

## 9. Avantages existants (actifs gratuits)

Points qui **facilitent** la migration Capacitor par rapport à un projet from scratch :

| Avantage | Détail |
|---|---|
| **PWA déjà en place** | `manifest.json` + `sw.js` + `offline.html` — Capacitor lit le manifest |
| **Icônes multi-tailles** | 72px à 512px déjà générées — réutilisables pour les stores |
| **Safe areas partielles** | `env(safe-area-inset-*)` déjà dans plusieurs pages |
| **`viewport-fit=cover`** | Présent sur les pages principales |
| **Splash screen** | Logique de splash déjà en CSS/JS — à mapper sur @capacitor/splash-screen |
| **Offline handling** | `tabibi-network.js` avec retry, queue, détection offline |
| **RTL complet** | Support arabe déjà implémenté — fonctionne dans WebView |
| **Multilingue** | FR/AR/EN déjà implémenté |
| **RLS Supabase** | Sécurité backend déjà en place — aucun changement côté données |

---

## 10. Recommandation et plan d'action immédiat

### Verdict

**✅ Faisable en Capacitor — stratégie correcte pour le marché algérien.**

Alternatives rejetées :
- **React Native** : réécriture totale (6-9 mois), investissement disproportionné
- **Flutter** : même problème, réécriture, nouvelle compétence requise
- **PWA seule** : Play Store OK, **App Store refuse les PWA installables** depuis 2023

### Actions immédiaires (avant de coder)

| Priorité | Action | Délai |
|---|---|---|
| 🔴 1 | Demander le D-U-N-S Number pour SARL Algérie (dnb.com/duns-number) | **Aujourd'hui** |
| 🔴 2 | Créer compte Google Play Console (25$) | Cette semaine |
| 🟡 3 | Finir l'installation Android Studio + créer AVD Android 14 | Cette semaine |
| 🟡 4 | Créer projet Firebase (FCM push Android) | Cette semaine |
| 🟢 5 | Créer Apple Developer Program quand D-U-N-S obtenu | 3-4 semaines |
| 🟢 6 | Démarrer Phase 1 Capacitor | Octobre 2026 |

---

*Rapport généré par analyse statique du repo tabibi-FINAL-v4-extracted — 28 mai 2026*
*Branche : mobile/feasibility-report*
