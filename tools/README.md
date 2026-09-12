# tools/ — outillage interne

Outils opérés à la main, **jamais servis au public**. Deux garde-fous :
`tools/ export-ignore` dans `.gitattributes` (build `git archive` → Pages) et
`/tools/* /404.html 404!` dans `_redirects` (Netlify, où un fichier existant
masque une règle non forcée — mesuré le 30/08/2026).

## outreach.html — personnalisation des messages de démarchage médecin

Fichier unique, sans build ni installation. **Aucun envoi automatique** : l'outil
prépare le texte, l'envoi reste entièrement manuel.

### Usage

Double-cliquer le fichier suffit. Pour la copie presse-papier, préférer :

```bash
cd tools && python3 -m http.server 8000   # puis http://localhost:8000/outreach.html
```

`navigator.clipboard` exige un contexte sécurisé. Chromium et Firefox considèrent
`file://` comme tel — vérifié le 30/08/2026, la copie fonctionne au double-clic —
mais si un navigateur la refuse, l'outil bascule seul sur `document.execCommand`.

### Entrée

CSV ou XLSX. Séparateur `,` `;` ou tabulation détecté seul, BOM UTF-8 géré,
repli windows-1252 si le fichier n'est pas en UTF-8. Les colonnes nom, prénom,
spécialité, wilaya et téléphone sont reconnues par leur en-tête ; à défaut, un
sélecteur manuel s'affiche.

PapaParse et SheetJS viennent de cdnjs. Hors ligne, le CSV reste traité par le
parseur interne ; seul le `.xlsx` demande le réseau.

### Ce que l'outil garantit

- Noms : préfixes `Dr` / `Dr.` / `Docteur` retirés, capitalisation propre,
  traits d'union, apostrophes et particules conservés.
- Téléphones : normalisés en `213XXXXXXXXX`. Les lignes fixes et les numéros
  invalides sont en rouge, bouton WhatsApp désactivé.
- Suivi des médecins traités dans `localStorage`, clé `tabibi_outreach_done`,
  indexée par numéro normalisé. Le gabarit (`tabibi_outreach_tpl`) n'est pas
  effacé par « Réinitialiser le suivi ».
- Export CSV `;` + BOM : `nom, telephone, message, traite, date_traitement`.

### Tests

```bash
node --test tests/outreach.core.test.mjs        # 26 tests, aucune dépendance

npm i --no-save playwright-core                 # Chromium réel
node tests/outreach.e2e.mjs                     # 23 tests, repli hors ligne
CDN_DIR=<dossier avec papaparse.min.js et xlsx.full.min.js> \
  node tests/outreach.e2e.mjs                   # 24 tests, dont le cas .xlsx
```

Le test unitaire extrait le bloc `<script id="outreach-core">` du fichier livré :
il porte sur l'outil réellement distribué. Ne pas introduire de `document`,
`window` ni `localStorage` dans ce bloc, sous peine de casser l'extraction.

Les jeux d'essai (5 lignes, noms fictifs) sont écrits dans un dossier temporaire
à chaque exécution, jamais versionnés : `.gitignore` interdit `**/medecins*.csv`
au titre de la PII médecins, et cette règle ne se contourne pas pour un test.
`cdnjs` n'est jamais joint pour de vrai — servi depuis `CDN_DIR` ou coupé — pour
que le résultat ne dépende d'aucun accès réseau.
