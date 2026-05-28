# Testing Guide — Tabibi Mobile
**Dernière mise à jour** : 2026-05-28

---

## 1. Tests sur simulateurs iOS

### Simulateurs recommandés

| Simulateur | Pourquoi |
|---|---|
| iPhone 16 Pro | Device actuel, Dynamic Island |
| iPhone 15 | Dernier modèle sans Dynamic Island |
| iPhone SE (3rd gen) | Petit écran (4.7"), nombreux en Algérie |
| iPhone 14 Pro Max | Grand écran |
| iPad Air (M2) | Test tablette |

### Lancer un simulateur

```bash
# Lister les simulateurs disponibles
xcrun simctl list devices available | grep iPhone

# Démarrer un simulateur spécifique
xcrun simctl boot "iPhone 16 Pro"

# Installer et lancer l'app depuis le terminal (après build Debug)
xcrun simctl install booted ios/App/build/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.tabibi.doctor

# Screenshot simulateur
xcrun simctl io booted screenshot tests/visual/ios-$(date +%Y%m%d).png
```

### Points à vérifier sur simulateur iOS

- [ ] Affichage correct sur toutes les tailles d'écran
- [ ] Safe areas respectées (notch, Dynamic Island, home indicator)
- [ ] Orientation portrait uniquement sur iPhone
- [ ] Clavier ne cache pas les champs de formulaire
- [ ] Scroll fluide dans les listes de médecins
- [ ] Animations et transitions fluides
- [ ] Splash screen affiché et masqué correctement
- [ ] Status bar couleur #0F7560

---

## 2. Tests sur simulateur Android

### AVD recommandés (créer dans Android Studio → AVD Manager)

| AVD | API | Pourquoi |
|---|---|---|
| Pixel 7 | 34 | Device cible principal |
| Pixel 4a | 30 | Android 11, device populaire |
| Samsung Galaxy A54 (Generic) | 33 | Marché algérien dominant |
| Generic Android 8.0 | 26 | minSdkVersion — device limite |

### Lancer un émulateur

```bash
# Lister les AVD disponibles
emulator -list-avds

# Démarrer un AVD
emulator -avd Pixel_7_API_34 &

# Installer l'APK debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Screenshot émulateur
adb exec-out screencap -p > tests/visual/android-$(date +%Y%m%d).png

# Logs de l'app
adb logcat | grep -i "tabibi\|capacitor\|com.tabibi.doctor"
```

### Points à vérifier sur émulateur Android

- [ ] Back button fonctionne (navigate back, pas fermer l'app)
- [ ] Barre de navigation (gesture ou boutons) ne cache pas le contenu
- [ ] Deep links s'ouvrent dans l'app (pas dans Chrome)
- [ ] Permissions demandées au bon moment (caméra, localisation, notifications)
- [ ] RTL arabe correct
- [ ] WhatsApp links ouvrent WhatsApp

---

## 3. Tests sur devices réels

### iOS — iPhone réel

```bash
# Connecter via USB, Trust this computer
# Dans Xcode : sélectionner l'iPhone dans la liste
# Cmd+R pour builder et installer
```

**Checklist device iOS réel :**

- [ ] Face ID / Touch ID (si page de login avec biométrie)
- [ ] Notifications push reçues (après configuration APNs)
- [ ] WhatsApp s'ouvre correctement depuis l'app
- [ ] Appel téléphonique depuis lien `tel:`
- [ ] Caméra fonctionnelle (photo profil médecin)
- [ ] Deep links depuis email (reset password, verify email)
- [ ] Comportement en arrière-plan (notifications)
- [ ] Mode avion → message offline

### Android — Device réel

```bash
# Activer Developer Options + USB Debugging
adb devices   # vérifier détection
cd android && ./gradlew installDebug
```

**Checklist device Android réel :**

- [ ] Back gesture et back button hardware
- [ ] Notifications push FCM reçues
- [ ] Caméra fonctionnelle
- [ ] Deep links depuis email
- [ ] Google Play Store installé (test depuis store en interne)
- [ ] Mode avion → reconnexion automatique

---

## 4. Tests fonctionnels — Flux critiques

### Flux 1 — Recherche médecin (non connecté)

1. Ouvrir l'app
2. Rechercher "Cardiologue Alger"
3. Vérifier : résultats affichés, photos, spécialités
4. Taper sur une fiche → profil médecin s'ouvre
5. Bouton WhatsApp → WhatsApp s'ouvre

**Attendu** : aucun chargement full-table (vérifier dans logs réseau < 50KB)

---

### Flux 2 — Inscription patient

1. Signup.html → remplir email + mot de passe
2. **Turnstile doit être absent** en mode natif
3. Email de vérification reçu
4. Taper le lien → deep link → l'app s'ouvre sur email-verified.html

**Attendu** : inscription sans friction, deep link fonctionne

---

### Flux 3 — Prise de RDV

1. Se connecter (patient)
2. Chercher un médecin avec créneaux
3. Réserver un créneau
4. Notification push reçue (confirmation RDV)
5. Mes RDV → RDV visible

**Attendu** : flow complet sans erreur JS

---

### Flux 4 — Dashboard médecin

1. Se connecter (médecin avec fiche claimée)
2. Dashboard → statistiques visibles
3. Gérer les RDV → accepter/refuser
4. Modifier profil → upload photo via caméra

**Attendu** : permissions caméra demandées proprement

---

### Flux 5 — Reset password

1. forgot-password.html → entrer email
2. Email reçu avec lien `com.tabibi.doctor://reset-password`
3. Taper le lien → deep link → reset-password.html dans l'app
4. Nouveau mot de passe → connexion

**Attendu** : lien ouvre l'app et non le navigateur

---

## 5. Tests de performance

```bash
# iOS : Instruments (dans Xcode)
# Product → Profile → Time Profiler

# Android : profiling ADB
adb shell am start-activity -W -n com.tabibi.doctor/.MainActivity
# Mesure du temps de cold start
```

**Cibles de performance :**

| Métrique | Cible | Critique |
|---|---|---|
| Cold start (première ouverture) | < 3s | > 6s inacceptable |
| Recherche médecin (résultats) | < 2s | > 4s inacceptable |
| Navigation entre pages | < 300ms | > 1s inacceptable |
| Upload photo profil | < 5s (3G) | > 15s inacceptable |
| Taille APK debug | < 50MB | > 100MB à optimiser |
| Taille IPA debug | < 60MB | > 120MB à optimiser |

---

## 6. Tests réseau dégradé (Algérie)

Simuler les conditions réseau algériennes (3G, connexion instable) :

```bash
# iOS Simulator : Hardware → Network Link Conditioner
# Activer "3G" ou "Edge"

# Android Emulator : Extended Controls (... bouton) → Cellular → 3G
```

**Points à vérifier en réseau dégradé :**
- [ ] Message offline affiché proprement
- [ ] Retry automatique des requêtes Supabase (tabibi-network.js)
- [ ] Pas de crash
- [ ] Splash screen ne reste pas bloqué

---

## 7. Rapport de test

Remplir après chaque cycle de test :

```
Date : ___________
Testeur : ___________
Version app : ___________

iOS :
  Simulateur iPhone 16 Pro : PASS / FAIL
  Device réel : PASS / FAIL
  Notes : ___________

Android :
  Émulateur Pixel 7 : PASS / FAIL
  Device réel : PASS / FAIL
  Notes : ___________

Flux critiques :
  Flux 1 — Recherche : PASS / FAIL
  Flux 2 — Inscription : PASS / FAIL
  Flux 3 — RDV : PASS / FAIL
  Flux 4 — Dashboard médecin : PASS / FAIL
  Flux 5 — Reset password : PASS / FAIL
```
