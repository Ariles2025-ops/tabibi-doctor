# Setup Guide — Tabibi Mobile (Capacitor)
**Dernière mise à jour** : 2026-05-28
**Pour** : tout nouveau développeur rejoignant le projet mobile

---

## Prérequis système

| Outil | Version minimum | Vérification |
|---|---|---|
| macOS | 14.0 (Sonoma) | `sw_vers` |
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Xcode | 15+ | `xcode-select --version` |
| Android Studio | 2024.x | Via GUI |
| Java (JDK) | 17+ | `java -version` |
| CocoaPods | 1.14+ | `pod --version` |

---

## 1. Cloner le repo

```bash
git clone https://github.com/Ariles2025-ops/tabibi-doctor.git
cd tabibi-doctor
git checkout mobile/capacitor-setup   # ou la branche active
```

---

## 2. Installer les dépendances

```bash
npm install
```

> Installe Capacitor core, CLI, toutes les plateformes et les 12 plugins.

---

## 3. Installer CocoaPods (iOS uniquement)

```bash
sudo gem install cocoapods
# ou avec Homebrew :
brew install cocoapods
```

---

## 4. Installer les Pods iOS

```bash
cd ios/App
pod install
cd ../..
```

> Cette étape télécharge les dépendances natives Swift/Objective-C.
> Durée : 2-5 minutes selon la connexion.

---

## 5. Construire les assets web

```bash
bash scripts/build-mobile.sh
```

> Copie tous les fichiers HTML/JS/CSS/images vers `www/`.
> Doit être relancé à chaque modification du code web.

---

## 6. Synchroniser les plateformes natives

```bash
npx cap sync
```

> Copie `www/` dans les projets natifs iOS et Android.
> Toujours lancer après `build-mobile.sh` et après `npm install`.

---

## 7. Ouvrir dans Xcode (iOS)

```bash
npx cap open ios
```

Dans Xcode :
1. Sélectionner le target **App**
2. Signing & Capabilities → choisir votre équipe Apple Developer
3. Bundle Identifier : `com.tabibi.doctor` (déjà configuré)
4. Sélectionner un simulateur (ex: iPhone 16 Pro)
5. ▶ Build & Run

---

## 8. Ouvrir dans Android Studio (Android)

```bash
npx cap open android
```

Dans Android Studio :
1. Attendre l'indexation Gradle (1-3 min)
2. File → Sync Project with Gradle Files
3. Sélectionner un AVD (Pixel 7, API 34)
4. ▶ Run 'app'

---

## Variables d'environnement (aucune requise en local)

Le fichier `js/config.js` contient toutes les clés publiques (Supabase anon key, etc.).
Aucun fichier `.env` n'est nécessaire — les clés sont destinées au client.

---

## Structure du projet mobile

```
tabibi-doctor/
├── www/                    ← Assets web compilés (généré, non versionné)
├── ios/                    ← Projet Xcode (versionné sauf Pods et build/)
│   └── App/
│       ├── App/
│       │   ├── Info.plist  ← Permissions iOS
│       │   └── public/     ← Copie de www/ (généré)
│       └── Podfile         ← Dépendances CocoaPods
├── android/                ← Projet Android Studio (versionné)
│   └── app/
│       ├── build.gradle    ← Config build Android
│       └── src/main/
│           ├── AndroidManifest.xml  ← Permissions Android
│           └── assets/public/       ← Copie de www/ (généré)
├── js/
│   └── capacitor-bridge.js ← Bridge web/natif Tabibi
├── capacitor.config.ts     ← Config principale Capacitor
├── scripts/
│   └── build-mobile.sh     ← Script copie assets → www/
└── docs/mobile/            ← Documentation mobile (ce dossier)
```

---

## Workflow quotidien

```bash
# 1. Modifier du code web (HTML/JS/CSS)
# 2. Reconstruire www/
bash scripts/build-mobile.sh

# 3. Synchroniser vers les natifs
npx cap sync

# 4. Ouvrir l'IDE et builder
npx cap open ios     # ou android
```

---

## Problèmes fréquents

Voir `docs/mobile/KNOWN_ISSUES.md` pour la liste complète.

| Problème | Solution rapide |
|---|---|
| `pod install` échoue | `sudo gem update cocoapods` |
| Gradle sync échoue | File → Sync Project with Gradle Files dans AS |
| `npx cap sync` erreur webDir | Vérifier que `www/` existe (lancer `build-mobile.sh`) |
| Xcode : "No signing certificate" | Ajouter votre compte Apple dans Xcode Preferences |
