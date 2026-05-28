# Deployment Checklist — Tabibi Mobile Release
**Dernière mise à jour** : 2026-05-28
**Utiliser avant chaque soumission App Store et Google Play**

---

## PRÉ-REQUIS COMPTES (à faire une seule fois)

- [ ] Compte Apple Developer Program actif (99$/an) — `developer.apple.com`
- [ ] D-U-N-S Number obtenu pour SARL (2-4 semaines — à lancer immédiatement)
- [ ] App créée dans App Store Connect (`appstoreconnect.apple.com`)
  - Bundle ID : `com.tabibi.doctor`
  - Nom : `Tabibi`
  - Catégorie principale : `Medical`
- [ ] Compte Google Play Developer actif (25$ once) — `play.google.com/console`
- [ ] App créée dans Google Play Console
  - Package : `com.tabibi.doctor`
  - Nom : `Tabibi — طبيبي`
  - Catégorie : `Medical`
- [ ] Certificat APNs créé (Apple Developer → Certificates, IDs & Profiles)
- [ ] Projet Firebase créé, `google-services.json` placé dans `android/app/`
- [ ] Keystore Android créé et sauvegardé dans un endroit sécurisé :
  ```bash
  keytool -genkey -v -keystore tabibi-release.keystore \
    -alias tabibi -keyalg RSA -keysize 2048 -validity 10000
  # CONSERVER CE FICHIER — impossible de soumettre sans lui si perdu
  ```

---

## CHECKLIST AVANT CHAQUE BUILD RELEASE

### Code

- [ ] Tous les tests passent (voir TESTING_GUIDE.md)
- [ ] `capacitor-bridge.shouldShowTurnstile()` retourne `false` en natif
- [ ] `webContentsDebuggingEnabled: false` dans `capacitor.config.ts`
- [ ] Aucun `console.log` critique visible en prod
- [ ] Aucune clé secrète dans le code (clé anon Supabase = publique ✅)
- [ ] Branche mergée sur `main`

### Versions — à incrémenter OBLIGATOIREMENT

**iOS** (`ios/App/App.xcodeproj/project.pbxproj`) :
- [ ] `MARKETING_VERSION` mis à jour (ex: 1.0.0 → 1.1.0)
- [ ] `CURRENT_PROJECT_VERSION` incrémenté (+1 à chaque soumission)

**Android** (`android/app/build.gradle`) :
- [ ] `versionCode` incrémenté (+1 à chaque soumission)
- [ ] `versionName` mis à jour

### Build web

```bash
bash scripts/build-mobile.sh
npx cap sync
```

- [ ] `www/` généré sans erreur
- [ ] Nombre de pages HTML correct (39 attendues)
- [ ] `npx cap sync` sans erreur pour iOS et Android

---

## CHECKLIST iOS — App Store

### Build & Archive

```bash
# 1. Ouvrir Xcode
npx cap open ios

# 2. Dans Xcode :
# - Sélectionner "Any iOS Device (arm64)" comme destination
# - Product → Archive
# - Attendre la fin de l'archive (5-10 min)
# - Window → Organizer → Distribute App
# - Choisir "App Store Connect" → Upload
```

- [ ] Archive créée sans erreur
- [ ] Upload vers App Store Connect réussi
- [ ] Build visible dans TestFlight dans les 30 min

### App Store Connect — Métadonnées

- [ ] **Nom** : `Tabibi` (max 30 chars)
- [ ] **Sous-titre** : `Médecin en ligne — Algérie` (max 30 chars)
- [ ] **Description FR** : rédigée (4000 chars max) — voir MARKETING docs
- [ ] **Description AR** : rédigée
- [ ] **Mots-clés** : `médecin,algérie,rdv,docteur,santé,hôpital,طبيب,الجزائر`
- [ ] **URL Support** : `https://tabibi.doctor`
- [ ] **URL Politique de confidentialité** : `https://tabibi.doctor/legal/confidentialite.html`
- [ ] **Catégorie principale** : `Medical`
- [ ] **Âge** : 13+

### Screenshots App Store (OBLIGATOIRES)

Tailles requises :
- [ ] iPhone 6.9" (iPhone 16 Pro Max) : 1320 × 2868 px — 3 à 10 screenshots
- [ ] iPhone 6.5" (iPhone 14 Plus / 15 Plus) : 1242 × 2688 px — 3 à 10 screenshots
- [ ] iPad Pro 13" : 2048 × 2732 px — 3 à 10 screenshots (si universel)

Screenshots recommandés :
1. Écran d'accueil + barre de recherche
2. Liste de médecins (résultats recherche)
3. Fiche médecin (profil complet)
4. Prise de RDV (sélection créneau)
5. Dashboard patient (mes RDV)

### Informations de review Apple

```
Notes pour l'équipe de review :
- App de prise de rendez-vous médicaux en Algérie
- Pas de paiement in-app dans cette version
- Compte de test : test@tabibi.doctor / TestPassword123!
  (compte patient pré-configuré avec données fictives)
- La géolocalisation est utilisée pour rechercher les médecins proches
- La caméra est utilisée pour la photo de profil médecin
```

- [ ] Compte de test créé et fonctionnel dans Supabase
- [ ] Notes de review rédigées dans App Store Connect

### Points d'attention Apple

⚠️ Risques de rejet courants pour les apps Capacitor :
1. **"Wrapper web sans valeur native"** → Mitigation : mettre en avant push, camera, deep links
2. **Caméra déclarée mais non démontrée** → Montrer le flux dans les screenshots
3. **Crash au démarrage** → Tester sur device réel AVANT soumission
4. **Politiques de confidentialité incomplètes** → Vérifier tous les usages de données dans App Privacy

---

## CHECKLIST Android — Google Play

### Build AAB signé

```bash
# Configurer la signature dans android/app/keystore.properties
# (créer ce fichier, NE PAS le versionner)
cat > android/app/keystore.properties << EOF
storePassword=VOTRE_MOT_DE_PASSE
keyPassword=VOTRE_MOT_DE_PASSE_CLE
keyAlias=tabibi
storeFile=../../tabibi-release.keystore
EOF

# Builder l'AAB signé
cd android && ./gradlew bundleRelease
# Résultat : android/app/build/outputs/bundle/release/app-release.aab
```

- [ ] AAB généré sans erreur
- [ ] AAB signé avec le keystore de production
- [ ] Upload dans Google Play Console → Production (ou Internal Testing d'abord)

### Google Play Console — Métadonnées

- [ ] **Titre** : `Tabibi — طبيبي` (max 50 chars)
- [ ] **Description courte** : `Prenez RDV chez votre médecin en Algérie` (max 80 chars)
- [ ] **Description longue FR** : rédigée (4000 chars max)
- [ ] **Description longue AR** : rédigée
- [ ] **Email support** : `contact@tabibi.doctor`
- [ ] **Politique de confidentialité** : `https://tabibi.doctor/legal/confidentialite.html`
- [ ] **Catégorie** : `Medical`
- [ ] **Âge** : Everyone (ou 13+)
- [ ] Questionnaire "App content" rempli (données médicales → answer honestly)

### Screenshots Google Play (OBLIGATOIRES)

- [ ] Téléphone 16:9 ou 9:20 : 1080 × 1920 px minimum — 2 à 8 screenshots
- [ ] Icône haute résolution : 512 × 512 px PNG (fond #0F7560)
- [ ] Feature graphic : 1024 × 500 px PNG (bandeau en haut de la fiche store)

### Data Safety (Google Play — obligatoire)

Remplir honnêtement le questionnaire :
- [ ] Données collectées : email, nom, localisation (optionnelle)
- [ ] Données partagées : aucune avec des tiers (Supabase = backend propre)
- [ ] Chiffrement en transit : ✅ (HTTPS Supabase)
- [ ] Suppression des données : ✅ (sur demande via contact@tabibi.doctor)

---

## POST-SOUMISSION

### App Store — Timeline typique
- Soumission → Review : 1-7 jours (généralement 24-48h)
- En cas de rejet : corriger + re-soumettre (peut être accéléré via Resolution Center)

### Google Play — Timeline typique
- Review initiale : 1-3 jours
- Mise à jour : quelques heures à 1 jour

### Après approbation
- [ ] Tester l'app téléchargée depuis le store (pas seulement le build debug)
- [ ] Vérifier que les notifications push fonctionnent en production
- [ ] Monitorer Sentry pour les erreurs post-launch
- [ ] Communiquer le launch (PLAN_LAUNCH_JUIN2026.md)
