# Known Issues — Tabibi Mobile
**Dernière mise à jour** : 2026-05-28

Format : `[PLATEFORME] [CRITICITÉ] Titre — Statut`
Criticité : 🔴 Bloquant | 🟡 Important | 🟢 Mineur

---

## Issues actives

### [ANDROID] 🟡 Gradle sync échoue sans Java Runtime

**Symptôme** :
```
Error running gradle sync: The operation couldn't be completed.
Unable to locate a Java Runtime.
```

**Cause** : Android Studio en cours d'installation sur la machine de dev. JDK absent du PATH.

**Workaround** : Ouvrir Android Studio → File → Sync Project with Gradle Files.
Android Studio embarque son propre JDK (JetBrains Runtime).

**Fix permanent** : Installer JDK 17+ via `brew install openjdk@17` et configurer `JAVA_HOME`.

**Statut** : ⏳ Android Studio installation en cours — résolution attendue

---

### [IOS] 🟡 CocoaPods non installés sur machine fraîche

**Symptôme** :
```
[error] Could not find "Podfile" in ios directory.
```
Ou après `npx cap open ios` : Xcode ne peut pas résoudre les dépendances Swift.

**Cause** : CocoaPods requis mais non installé par défaut.

**Fix** :
```bash
sudo gem install cocoapods
cd ios/App && pod install
```

**Statut** : ✅ Documenté dans SETUP_GUIDE.md — pas de fix code nécessaire

---

### [IOS] 🟡 Teleconsultation Daily.co — WebRTC à valider en device réel

**Symptôme** : Écran noir ou erreur permissions dans `teleconsultation.html`.

**Cause** : Daily.co utilise WebRTC via `<iframe>`. WKWebView iOS supporte WebRTC
depuis iOS 14.5, mais les permissions caméra/micro doivent être explicitement déclarées
dans `Info.plist` ET demandées au runtime.

**Workaround** : `Info.plist` déjà configuré avec `NSCameraUsageDescription` et
`NSMicrophoneUsageDescription`. Permissions déclarées.

**Test requis** : Tester sur device réel iOS avec un RDV téléconsultation actif.
Si échec → intégrer `@daily-co/daily-js` mobile SDK (fallback natif, +5 jours dev).

**Statut** : ⏳ NON TESTÉ — à prioriser en Phase 3

---

### [IOS + ANDROID] 🟡 Turnstile captcha incompatible WebView

**Symptôme** : Le widget Turnstile ne s'affiche pas, ou affiche une erreur, ou bloque
l'inscription sur `signup.html`.

**Cause** : Cloudflare Turnstile détecte les environnements non-browser (WebView) et
peut refuser de se rendre correctement.

**Workaround** : `capacitor-bridge.js` expose `shouldShowTurnstile()` qui retourne
`false` en mode natif. Mais il faut encore :
1. Modifier `signup.html` pour appeler `shouldShowTurnstile()` avant d'afficher le widget
2. Modifier l'Edge Function `verify-turnstile` pour accepter les appels sans token
   depuis l'app native (header `X-App-Platform: capacitor`)

**Statut** : ⏳ Logic bridge créée — intégration dans signup.html à faire (Phase 2)

---

### [ANDROID] 🟡 Deep links — assetlinks.json non encore déployé

**Symptôme** : Les liens email Supabase s'ouvrent dans Chrome au lieu de l'app.

**Cause** : `https://tabibi.doctor/.well-known/assetlinks.json` n'existe pas encore.
Sans ce fichier, Android App Links ne fonctionnent pas et le fallback est le navigateur.

**Fix** :
1. Générer le SHA-256 du keystore de production :
   ```bash
   keytool -list -v -keystore tabibi-release.keystore -alias tabibi
   # Copier le "SHA256:" affiché
   ```
2. Créer `/.well-known/assetlinks.json` à la racine du site avec le fingerprint
3. Déployer sur Netlify (le fichier est déjà dans `.gitignore` à NE PAS ignorer)
4. Configurer Supabase Auth → Redirect URLs : `com.tabibi.doctor://`

**Statut** : ⏳ À faire avant premier test deep links Android

---

### [IOS] 🟡 Universal Links — apple-app-site-association non déployé

**Symptôme** : Même problème que assetlinks.json côté iOS — liens email ouvrent Safari.

**Fix** :
1. Obtenir le Team ID dans Apple Developer Portal
2. Créer `/.well-known/apple-app-site-association` avec le bon `appID`
3. Déployer sur Netlify
4. Activer Associated Domains dans Xcode : Signing & Capabilities → +
   → Associated Domains → `applinks:tabibi.doctor`

**Statut** : ⏳ Requiert compte Apple Developer actif

---

### [IOS] 🟢 Orientation paysage désactivée sur iPhone

**Symptôme** : L'app ne pivote pas en paysage sur iPhone (voulu).

**Cause** : `Info.plist` configuré portrait uniquement sur iPhone, toutes orientations sur iPad.

**Note** : C'est le comportement voulu. Si à reconsidérer pour la téléconsultation (paysage
naturel pour les visios), modifier `UISupportedInterfaceOrientations` dans `Info.plist`.

**Statut** : ✅ Comportement intentionnel — documenter si UX change

---

### [ANDROID] 🟢 Commentaires dans variables.gradle causent un warning Gradle

**Symptôme** :
```
warning: comments in Groovy DSL are not supported for Kotlin value assignment
```

**Cause** : Le fichier `android/variables.gradle` utilise la syntaxe Groovy avec des
commentaires inline `// ...` après les assignations de valeurs.

**Fix** : Déplacer les commentaires sur la ligne précédente :
```groovy
// Android 8.0 minimum
minSdkVersion = 26
```

**Statut** : 🟢 Warning non bloquant — à corriger lors du premier build Android Studio

---

### [IOS + ANDROID] 🟢 www/ non versionné — risque de confusion

**Symptôme** : `www/` est dans `.gitignore` mais certains devs essaient de le committer.

**Cause** : `www/` est généré par `build-mobile.sh` et ne doit pas être versionné.

**Fix** : Toujours relancer `bash scripts/build-mobile.sh && npx cap sync` après
un `git pull`. Le README et SETUP_GUIDE.md le mentionnent.

**Statut** : ✅ Documenté — à rappeler en onboarding

---

## Issues résolues

| Date | Issue | Résolution |
|---|---|---|
| 2026-05-28 | `webDir: "./"` invalide pour Capacitor | Créé `www/` + `scripts/build-mobile.sh` |
| 2026-05-28 | TypeScript manquant pour `capacitor.config.ts` | `npm install -D typescript` |
| 2026-05-28 | `ios platform already exists` après first fail | `rm -rf ios && npx cap add ios` |

---

## Template pour reporter un nouveau bug

```markdown
### [PLATEFORME] CRITICITÉ Titre court

**Symptôme** : Ce que l'utilisateur voit / le message d'erreur exact

**Reproductible sur** :
- [ ] iOS Simulateur
- [ ] iOS Device réel
- [ ] Android Émulateur
- [ ] Android Device réel

**Étapes pour reproduire** :
1. ...
2. ...

**Cause** : Explication technique (si connue)

**Workaround** : Solution temporaire (si disponible)

**Fix** : Ce qui doit être fait

**Statut** : ⏳ En cours / ✅ Résolu / 🚫 Won't fix
```
