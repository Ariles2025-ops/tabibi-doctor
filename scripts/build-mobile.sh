#!/bin/bash
# =====================================================================
# build-mobile.sh — Copie les assets web vers www/ pour Capacitor
# =====================================================================
# Usage : bash scripts/build-mobile.sh
# Ce script copie uniquement les fichiers web nécessaires vers www/
# en excluant node_modules, ios/, android/, docs/, etc.
# Exécuter AVANT npx cap sync.
# =====================================================================

set -e

WWW="www"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔨 Build mobile — copie assets web vers $WWW/"
cd "$ROOT"

# Nettoyer www/ proprement
rm -rf "$WWW"
mkdir -p "$WWW"

# Copier les fichiers HTML à la racine
echo "  → HTML pages..."
find . -maxdepth 1 -name "*.html" ! -path "./node_modules/*" -exec cp {} "$WWW/" \;

# Copier les dossiers web
echo "  → Dossiers web..."
for dir in js css styles images assets api blog brand legal seo sitemaps templates scripts; do
  if [ -d "$dir" ]; then
    cp -r "$dir" "$WWW/$dir"
  fi
done

# Copier les fichiers PWA et configs
echo "  → Assets racine..."
for f in manifest.json sw.js robots.txt sitemap.xml favicon.ico _redirects; do
  if [ -f "$f" ]; then
    cp "$f" "$WWW/"
  fi
done

# Exclure build-mobile.sh lui-même de www/scripts si copié
rm -f "$WWW/scripts/build-mobile.sh" 2>/dev/null || true

echo "✅ www/ prêt — $(find "$WWW" -name "*.html" | wc -l | tr -d ' ') pages HTML copiées"
echo "   Taille totale : $(du -sh "$WWW" | cut -f1)"
echo ""
echo "Prochaine étape : npx cap sync"
