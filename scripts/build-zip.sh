#!/usr/bin/env bash
# =====================================================================
# TABIBI.DOCTOR — build-zip.sh (Phase 4.B.4.0c)
# =====================================================================
# Pipeline anti-régression : refuse de générer un .zip déployable s'il
# contient une erreur de syntaxe JavaScript.
#
# Motivation : Phase 4.B.3-hotpatch a perdu 1 itération complète à cause
# d'une apostrophe française mal échappée (style SQL `''` au lieu de
# string en double-quote) dans js/tabibi-doctor-dashboard.js ligne 277,
# détectée seulement après déploiement Netlify et test utilisateur.
#
# Ce script garantit qu'un tel SyntaxError ne sera plus jamais déployé.
#
# Usage : depuis la racine du repo
#   ./scripts/build-zip.sh
#
# Output (succès) : dist/tabibi-deploy-YYYY-MM-DD-HHMM.zip
# Output (échec)  : exit 1 + message rouge avec fichier + ligne fautive
# =====================================================================
set -euo pipefail

# Couleurs (désactivées si pas de TTY)
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

# Racine du repo = parent de scripts/
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  TABIBI build-zip — pipeline anti-régression JS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# ─── 1. Vérif node disponible ───────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "${RED}❌ Erreur : node n'est pas installé.${NC}"
  echo "   Installez Node.js depuis https://nodejs.org puis relancez."
  exit 1
fi
echo "${GREEN}✓${NC} Node $(node --version) détecté"

# ─── 2. Vérif syntaxe de tous les .js du repo ──────────────────────────
echo ""
echo "─── Vérif syntaxe JavaScript (fichiers .js) ─────────────────────"

# Collecte les fichiers .js (exclut dirs build, vendor, secrets-locaux)
JS_FILES=$(find . -type f -name "*.js" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./dist/*" \
  -not -path "./_deploy_clean/*" \
  -not -path "./build/*" \
  -not -path "./.netlify/*" \
  | sort)

JS_COUNT=$(printf "%s\n" "$JS_FILES" | grep -c . || echo 0)
echo "  $JS_COUNT fichiers .js à vérifier"

FAILED=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! node --check "$f" >/dev/null 2>&1; then
    echo "${RED}❌ $f${NC}"
    node --check "$f" 2>&1 | sed 's/^/    /'
    FAILED=$((FAILED + 1))
  fi
done <<< "$JS_FILES"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "${RED}❌ ÉCHEC : $FAILED fichier(s) JS avec erreur de syntaxe.${NC}"
  echo "   Le ZIP NE sera PAS généré. Corrigez les erreurs ci-dessus puis re-lancez."
  exit 1
fi
echo "${GREEN}✓${NC} Tous les .js passent node --check"

# ─── 3. Vérif inline JS des HTML dashboards (gros scripts) ─────────────
# Limité aux fichiers connus pour avoir du JS inline conséquent (≥ 200 lignes).
# Pattern d'extraction : lignes entre `<script>` seul et `</script>` seul.
# Note : les <script src="..."> ne matchent pas (pas de contenu inline).
echo ""
echo "─── Vérif inline JS des HTML dashboards ─────────────────────────"

HTML_TO_CHECK=(
  "doctor-dashboard.html"
  "medecin-profile.html"
)

for h in "${HTML_TO_CHECK[@]}"; do
  if [ ! -f "$h" ]; then
    echo "${YELLOW}⚠${NC} $h introuvable, skip"
    continue
  fi
  TMP=$(mktemp -t tabibi_inline.XXXXXX) || { echo "${RED}❌ mktemp failed${NC}"; exit 1; }
  # Ajoute extension .js pour que node --check accepte
  TMP_JS="${TMP}.js"
  mv "$TMP" "$TMP_JS"

  # Extrait toutes les lignes entre `^<script>$` et `^</script>$` exclusifs
  awk '/^<script>$/{p=1;next} /^<\/script>$/{p=0} p' "$h" > "$TMP_JS"

  if [ ! -s "$TMP_JS" ]; then
    echo "${YELLOW}⚠${NC} $h : aucun bloc inline <script> trouvé (skip)"
    rm -f "$TMP_JS"
    continue
  fi

  if ! node --check "$TMP_JS" >/dev/null 2>&1; then
    echo "${RED}❌ $h (inline JS)${NC}"
    node --check "$TMP_JS" 2>&1 | sed 's/^/    /'
    rm -f "$TMP_JS"
    exit 1
  fi
  LINES=$(wc -l < "$TMP_JS" | tr -d ' ')
  echo "${GREEN}✓${NC} $h (inline JS, $LINES lignes)"
  rm -f "$TMP_JS"
done

# ─── 4. Création du ZIP ────────────────────────────────────────────────
echo ""
echo "─── Création du ZIP ─────────────────────────────────────────────"
mkdir -p dist
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
ZIP_NAME="tabibi-deploy-${TIMESTAMP}.zip"
ZIP_PATH="dist/${ZIP_NAME}"
ABS_ZIP_PATH="${ROOT}/${ZIP_PATH}"

# Exclusions alignées avec .gitignore (PII, secrets, build artifacts, ZIPs imbriqués)
zip -r "$ZIP_PATH" . \
  -x ".git/*" -x ".git" \
  -x "*.DS_Store" -x "**/.DS_Store" \
  -x "data/private/*" -x "data/cleaned/*" -x "data/raw/*" \
  -x "**/medecins*.csv" -x "**/outbound*.csv" -x "**/prospects*.csv" \
  -x ".env" -x ".env.*" -x "*.pem" -x "*.key" -x "*_secret*" -x "secrets.json" \
  -x "supabase/.env" -x "supabase/.temp/*" \
  -x "*.sql.gz" -x "*.dump" -x "backup_*.sql" -x "pg_dump_*" \
  -x "*.log" \
  -x "node_modules/*" -x "dist/*" -x "build/*" -x ".netlify/*" -x ".cache/*" \
  -x "tabibi-deploy-*.zip" -x "tabibi-FINAL-*.zip" -x "_deploy_clean/*" \
  -x "coverage/*" -x "test-results/*" -x "playwright-report/*" \
  -x "test-prescriptions/*" -x "*_test.pdf" \
  -x "~\$*" \
  -x "scripts/*" \
  -q

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1 | tr -d ' ')
FILE_COUNT=$(unzip -l "$ZIP_PATH" | tail -1 | awk '{print $2}')

echo "${GREEN}✓${NC} ZIP créé : $ZIP_NAME ($ZIP_SIZE, $FILE_COUNT fichiers)"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ${GREEN}BUILD OK${NC} — ZIP prêt pour Netlify Drop"
echo "  → $ABS_ZIP_PATH"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
