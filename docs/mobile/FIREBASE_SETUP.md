# Firebase / FCM — Setup Manuel

## Pourquoi ce fichier n'est pas versionné

`android/app/google-services.json` contient l'`api_key` du projet Firebase
(clé serveur FCM) et le `project_id` Tabibi Doctor.

Le dépôt étant **public**, committer ce fichier exposerait la clé à tous.
Il doit être placé **manuellement** sur chaque machine de build ou injecté
via un secret CI (GitHub Actions / Bitrise).

---

## Obtenir le fichier

1. Ouvrir la **Firebase Console** → [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionner le projet **Tabibi Doctor**
3. Engrenage ⚙️ → **Paramètres du projet** → onglet **Vos applications**
4. Section Android (`com.tabibi.doctor`) → bouton **Télécharger google-services.json**
5. Placer le fichier ici : `android/app/google-services.json`

---

## Vérification locale

```bash
ls -la android/app/google-services.json
# → doit exister et ne PAS être listé par git status
git check-ignore -v android/app/google-services.json
# → doit afficher .gitignore:XX:android/app/google-services.json
```

---

## CI/CD (GitHub Actions)

Stocker le contenu du fichier comme secret GitHub :
- Nom du secret : `GOOGLE_SERVICES_JSON`
- Dans le workflow, injecter avant le build :

```yaml
- name: Write google-services.json
  run: echo '${{ secrets.GOOGLE_SERVICES_JSON }}' > android/app/google-services.json
```

---

## Fonctionnement Gradle

`android/app/build.gradle` détecte automatiquement le fichier :

```groovy
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found — push notifications désactivées")
}
```

Si le fichier est absent, le build reste fonctionnel (les push notifications
sont simplement désactivées). Aucune erreur fatale.

---

## Plugins Capacitor concernés

- `@capacitor/push-notifications@8.1.1` — câblage JS côté app
- `com.google.gms:google-services:4.4.4` — plugin Gradle (déjà dans `build.gradle`)

## Dernière mise à jour

29 mai 2026 — Phase 3 mobile (FCM Android)
