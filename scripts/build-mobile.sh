#!/bin/bash
# =====================================================================
# build-mobile.sh — Construit www/ (bundle web de l'app Capacitor)
# =====================================================================
# Usage : bash scripts/build-mobile.sh [--no-sync]
#
# LISTE BLANCHE STRICTE — seules les pages GRAND PUBLIC / PATIENT sont
# embarquées. Même principe que desktop/build-dist.sh (qui, lui, ne
# retient que les pages PRO).
#
# POURQUOI : l'ancienne version copiait `find . -maxdepth 1 -name "*.html"`
# puis des dossiers en bloc. L'APK public de juillet contenait donc :
#   • scripts/deploy-web.sh, build-zip.sh, otp-spike.sh  (scripts internes)
#   • seo/ — 490 pages inutiles à l'app (et Disallow dans robots.txt)
#   • admin-*.html — la console d'administration, lisible hors ligne
#   • secretaire-*, medecin-*, doctor-dashboard — espaces pro
# Aucun secret n'a fuité (vérifié), mais cette surface n'a pas lieu d'être.
# Les garde-fous en fin de script font ÉCHOUER le build si l'un de ces
# éléments réapparaît.
#
# Les espaces PRO (médecin / secrétariat) ne sont volontairement PAS dans
# l'app mobile : ils vivent dans le logiciel desktop Tauri.
# =====================================================================

set -euo pipefail

WWW="www"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🔨 Build mobile — bundle grand public vers $WWW/"

# ── PAGES (liste blanche explicite) ──────────────────────────────────
# Parcours patient + public. Toute page ajoutée ici doit être atteignable
# depuis l'app ; toute page atteignable doit être ici, sinon 404 dans la
# WebView (bug « asset not found » déjà rencontré côté desktop).
# doctor-claim.html est inclus volontairement : doctor-profile.html charge
# js/tabibi-claim.js qui y redirige (médecin qui découvre sa fiche).
PAGES="
index.html
login.html signup.html forgot-password.html reset-password.html
verify-email.html email-verified.html
doctor-profile.html doctor-claim.html
reservation.html mes-rdv.html
patient-dashboard.html patient-profile.html patient-ordonnances.html patient-waitinglist.html
dawini.html dawini-pharmacie.html
notifications.html messages.html conversation.html
verify-prescription.html
about.html cas-grave.html waiting-list.html
success.html offline.html 404.html
"

# ── DOSSIERS (liste blanche explicite) ───────────────────────────────
#   legal/ : OBLIGATOIRE — js/tabibi-footer.js pointe vers legal/*
#   blog/, brand/ : liés depuis les pages publiques, poids négligeable
# NON copiés : seo/ scripts/ api/ templates/ sitemaps/ android/ ios/
#              desktop/ docs/ migrations/ fixtures/ supabase/ tests/
DIRS="js css styles images assets legal blog brand"

# ── FICHIERS RACINE ──────────────────────────────────────────────────
# Volontairement PAS copiés : sw.js, robots.txt, sitemap.xml, _redirects
# → propres au web. Le service worker ne s'enregistre de toute façon pas
#   sur « localhost » (js/tabibi-sw-register.js), or c'est l'origine de la
#   WebView Capacitor (androidScheme:'https' → https://localhost).
ROOT_FILES="manifest.json favicon.ico"

rm -rf "$WWW"
mkdir -p "$WWW"

echo "  → pages..."
missing=0
for f in $PAGES; do
  if [ -f "$f" ]; then
    cp "$f" "$WWW/"
  else
    echo "     ⚠️  page absente de la liste blanche, ignorée : $f"
    missing=$((missing + 1))
  fi
done

echo "  → dossiers..."
for d in $DIRS; do
  [ -d "$d" ] && cp -R "$d" "$WWW/$d"
done

echo "  → fichiers racine..."
for f in $ROOT_FILES; do
  [ -f "$f" ] && cp "$f" "$WWW/"
done

# =====================================================================
# GARDE-FOUS — le build ÉCHOUE si un élément interdit est présent.
# La liste blanche seule ne suffirait pas : un `cp -R` mal placé ou un
# nouveau dossier suffirait à tout ramener sans que personne ne le voie.
# =====================================================================
fail() { echo "❌ ERREUR bundle : $1"; exit 1; }

for forbidden in seo scripts api templates sitemaps migrations supabase docs tests fixtures; do
  [ -d "$WWW/$forbidden" ] && fail "$forbidden/ présent dans le bundle"
done

# Pages pro / admin — contrôle limité à la RACINE du bundle (-maxdepth 1).
# Les pages pro sont toutes des pages racine ; une recherche récursive
# produisait un faux positif sur un article de blog légitime
# (blog/articles/medecin-liberal-algerie-digitaliser-cabinet-2026.html).
for pattern in 'admin-*.html' 'secretaire-*.html' 'medecin-*.html' \
               'doctor-dashboard.html' 'doctor-analytics.html' \
               'agenda-cabinet.html' \
               'onboarding-medecin.html' 'api-docs.html'; do
  found=$(find "$WWW" -maxdepth 1 -name "$pattern" 2>/dev/null | head -1)
  [ -n "$found" ] && fail "page pro/admin dans le bundle : $found"
done

# Filet large : aucun script shell, aucun SQL.
found_sh=$(find "$WWW" -name "*.sh" 2>/dev/null | head -1)
[ -n "$found_sh" ] && fail "script shell dans le bundle : $found_sh"
found_sql=$(find "$WWW" -name "*.sql" 2>/dev/null | head -1)
[ -n "$found_sql" ] && fail "fichier SQL dans le bundle : $found_sql"

# =====================================================================
echo ""
echo "✅ $WWW/ prêt"
echo "   pages HTML : $(find "$WWW" -name '*.html' | wc -l | tr -d ' ')"
echo "   fichiers   : $(find "$WWW" -type f | wc -l | tr -d ' ')"
echo "   taille     : $(du -sh "$WWW" | cut -f1)"
[ "$missing" -gt 0 ] && echo "   ⚠️  $missing page(s) de la liste blanche introuvable(s)"
echo "   garde-fous : OK (ni seo/, ni scripts/, ni api/, ni page pro)"

# ── Sync Capacitor (optionnel) ───────────────────────────────────────
if [ "${1:-}" = "--no-sync" ]; then
  echo ""
  echo "⏭  --no-sync : 'npx cap sync' non lancé."
  exit 0
fi
if ! command -v npx > /dev/null 2>&1; then
  echo ""
  echo "⏭  npx introuvable (Node non installé) — bundle prêt."
  echo "   Sync à lancer une fois Node en place :  npx cap sync"
  exit 0
fi
echo ""
echo "🔄 Sync Capacitor (iOS + Android)..."
npx cap sync
echo "✅ Sync terminé"
