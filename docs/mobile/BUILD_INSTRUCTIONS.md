# Build Instructions — Tabibi iOS + Android
**Dernière mise à jour** : 2026-05-28

---

## Commandes de build — référence rapide

```bash
# Prérequis : toujours synchroniser avant de builder
bash scripts/build-mobile.sh && npx cap sync
```

---

## iOS — Build Simulateur

```bash
# Ouvrir Xcode
npx cap open ios

# Dans Xcode :
# 1. Product → Scheme → App
# 2. Sélectionner "iPhone 16 Pro" dans la liste des simulateurs
# 3. Cmd+R (ou ▶ Run)
```

**Build CLI (sans ouvrir Xcode GUI) :**

```bash
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -configuration Debug \
  build 2>&1 | grep -E "error:|warning:|BUILD"
```

---

## iOS — Build Device Réel (Debug)

```bash
# Dans Xcode :
# 1. Brancher l'iPhone via USB (ou WiFi si configuré)
# 2. Trust this computer sur l'iPhone
# 3. Sélectionner votre iPhone dans la liste de destinations
# 4. Signing & Capabilities → votre équipe Apple Developer
# 5. Cmd+R
```

---

## iOS — Build Archive (Release / App Store)

```bash
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/Tabibi.xcarchive \
  archive

# Exporter l'IPA
xcodebuild \
  -exportArchive \
  -archivePath build/Tabibi.xcarchive \
  -exportPath build/Tabibi-Release \
  -exportOptionsPlist ios/ExportOptions.plist
```

> **Note** : `ios/ExportOptions.plist` doit être créé avant la release.
> Voir `DEPLOYMENT_CHECKLIST.md` pour le template.

---

## Android — Build Simulateur (AVD)

```bash
# Ouvrir Android Studio
npx cap open android

# Dans Android Studio :
# 1. Tools → AVD Manager → Create Virtual Device
# 2. Sélectionner Pixel 7, API 34
# 3. ▶ Run 'app'
```

**Build CLI :**

```bash
cd android
./gradlew assembleDebug 2>&1 | grep -E "error|warning|BUILD"
# APK généré : android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Android — Build Device Réel (Debug)

```bash
# 1. Activer Developer Options sur l'Android (7 taps sur Build Number)
# 2. Activer USB Debugging
# 3. Brancher via USB
# 4. Vérifier détection ADB :
adb devices
# Doit afficher votre device

# Builder et installer directement :
cd android && ./gradlew installDebug
```

---

## Android — Build Release (APK / AAB Play Store)

```bash
cd android

# APK signé (pour tests internes)
./gradlew assembleRelease

# AAB signé (pour Google Play — format recommandé)
./gradlew bundleRelease
# AAB généré : android/app/build/outputs/bundle/release/app-release.aab
```

> **Signature requise** : configurer `android/app/keystore.properties` avant la release.
> Voir `DEPLOYMENT_CHECKLIST.md` pour la procédure de création du keystore.

---

## Numéros de version

### iOS
Fichier : `ios/App/App.xcodeproj/project.pbxproj`
- `MARKETING_VERSION` → version affichée (ex: 1.0.0)
- `CURRENT_PROJECT_VERSION` → build number (incrémenter à chaque soumission)

Ou via Xcode : Target App → General → Version / Build

### Android
Fichier : `android/app/build.gradle`
```groovy
versionCode 1       // incrémenter à chaque soumission Play Store
versionName "1.0.0" // version affichée
```

---

## Script de build complet (pré-release)

```bash
#!/bin/bash
# Exécuter depuis la racine du projet

echo "1. Build assets web..."
bash scripts/build-mobile.sh

echo "2. Sync Capacitor..."
npx cap sync

echo "3. Build Android AAB..."
cd android && ./gradlew bundleRelease && cd ..

echo "4. Build iOS archive..."
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/Tabibi.xcarchive \
  archive

echo "✅ Builds terminés"
echo "   Android AAB : android/app/build/outputs/bundle/release/app-release.aab"
echo "   iOS Archive : build/Tabibi.xcarchive"
```

---

## Temps de build estimés (machine M-series)

| Plateforme | Type | Durée estimée |
|---|---|---|
| iOS Debug Simulateur | Premier build | 3-5 min |
| iOS Debug Simulateur | Rebuild (incremental) | 30-60s |
| iOS Release Archive | Complet | 5-10 min |
| Android Debug APK | Premier build | 2-4 min |
| Android Debug APK | Rebuild (incremental) | 30-60s |
| Android Release AAB | Complet | 3-6 min |
