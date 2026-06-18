#!/bin/bash
# =====================================================================
# deploy-web.sh — Déploiement web Tabibi → Cloudflare Pages
# ---------------------------------------------------------------------
# Build PROPRE via `git archive` : le `.gitattributes` (export-ignore)
# exclut automatiquement migrations/, docs/, scripts/, tests/, android/,
# ios/, *.md, package*.json, etc. → aucune fuite de contenu interne.
# Le `_headers` (sécurité OWASP + no-store SW/HTML) est, lui, inclus.
#
# Usage : bash scripts/deploy-web.sh [ref]   (défaut: origin/main)
# Prérequis : `npx wrangler login` fait au préalable.
# =====================================================================
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REF="${1:-origin/main}"

echo "🔨 Build dist/ depuis '$REF' (export-ignore appliqué)…"
rm -rf dist && mkdir -p dist
git archive --format=tar "$REF" | tar -x -C dist

echo "   → taille dist/ : $(du -sh dist | cut -f1)"
echo "   → _headers présent : $([ -f dist/_headers ] && echo OUI || echo '⚠ NON')"
echo "   → fuite interne (.sql/.md) : $(find dist -type f \( -name '*.sql' -o -name '*.md' \) | wc -l | tr -d ' ') fichier(s) (attendu 0)"

echo "🚀 Déploiement Cloudflare Pages (projet tabibi-doctor)…"
npx wrangler pages deploy dist --project-name=tabibi-doctor --branch=main --commit-dirty=true

echo "✅ Déployé."
