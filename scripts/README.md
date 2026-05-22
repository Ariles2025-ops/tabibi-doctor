# scripts/

Outils utilitaires pour le repo Tabibi.doctor.

## build-zip.sh

Pipeline anti-régression pour générer un .zip déployable sur Netlify.
**Refuse de générer le ZIP** si une seule erreur de syntaxe JavaScript est détectée.

### Pré-requis

- **Node.js** installé (`node --version` doit fonctionner — installer depuis [nodejs.org](https://nodejs.org) si absent)
- `zip` CLI (présent par défaut sur macOS et la plupart des Linux)

### Usage

Depuis la racine du repo :

```bash
./scripts/build-zip.sh
```

### Ce que le script fait, dans l'ordre

1. Vérifie que `node` est disponible (sinon exit 1 avec message)
2. Lance `node --check` sur **tous les fichiers `.js`** du repo
   (exclut `node_modules/`, `.git/`, `dist/`, `_deploy_clean/`, `build/`, `.netlify/`)
3. Lance `node --check` sur les **inline `<script>`** des HTML dashboards
   (`doctor-dashboard.html`, `medecin-profile.html`) — extraction via `awk` entre `^<script>$` et `^</script>$`
4. Si **≥ 1 erreur de syntaxe** trouvée → `exit 1`, **aucun ZIP généré**, message rouge avec fichier + ligne fautive
5. Sinon → crée `dist/tabibi-deploy-YYYY-MM-DD-HHMM.zip` avec toutes les exclusions standard (secrets, PII, build artifacts, ZIPs imbriqués)
6. Affiche le path absolu du ZIP créé

### Output

**Succès** :
```
✓ Tous les .js passent node --check
✓ ZIP créé : tabibi-deploy-2026-05-22-1430.zip (2.2M, 637 fichiers)
═══════════════════════════════════════════════════════════════════
  BUILD OK — ZIP prêt pour Netlify Drop
  → /Users/…/dist/tabibi-deploy-2026-05-22-1430.zip
═══════════════════════════════════════════════════════════════════
```

**Échec** (exemple : SyntaxError ligne X) :
```
❌ js/tabibi-doctor-dashboard.js
    /…/js/tabibi-doctor-dashboard.js:277
            console.warn('pas d''erreur');
                         ^^^^^^^^^^^^
    SyntaxError: missing ) after argument list

❌ ÉCHEC : 1 fichier(s) JS avec erreur de syntaxe.
   Le ZIP NE sera PAS généré. Corrigez les erreurs ci-dessus puis re-lancez.
```

### Pourquoi ce script existe

**Phase 4.B.3-fix2** (commit `c8cd0e2`) a introduit une apostrophe française mal échappée dans `js/tabibi-doctor-dashboard.js` ligne 277 :

```js
console.warn('[…] pas d''erreur mais aucune data retournée');
//                       ^^^^^ style SQL, pas valide en JS
```

JavaScript interprète `'pas d'` comme une string fermée puis `'erreur…'` comme une nouvelle string juxtaposée → `SyntaxError: missing ) after argument list` au parse → tout le fichier JS rejeté → `window.tabibiDoctor` undefined → `addUnavailableSlot` undefined → TypeError au call.

L'erreur n'a été détectée qu'**après** déploiement Netlify et test utilisateur (perte d'1 itération complète : commit + push + deploy + report bug + diagnostic).

Le hotpatch `phase4.B.3-fix2-hotpatch` (commit `884560b`) a fixé le bug. Ce script **garantit qu'un tel SyntaxError ne pourra plus jamais atteindre la prod**.

### Limites connues

- L'extraction d'inline JS via `awk '/^<script>$/{p=1;next} /^<\/script>$/{p=0} p'` matche **seulement** les balises `<script>` (sans attributs) et `</script>` exactement seuls sur leur ligne. Les `<script src="…">` (inclusion externe) ne contiennent pas d'inline et sont skip — mais ils sont déjà couverts par l'étape 2.
- `node --check` détecte les SyntaxError mais **pas** les erreurs runtime (TypeError sur appel d'undefined, ReferenceError, etc.). Pour ces dernières, on s'appuie sur les tests E2E manuels (cf. `tests/manual/`).
- Les autres types de fichiers (CSS, HTML, JSON) ne sont pas validés. À ajouter en Phase 12 si nécessaire (`htmlhint`, `csslint`, `jq -c .`).
