#!/bin/sh
# =====================================================================
# desktop/build-dist.sh — Construit desktop/dist (frontend de l'app Tauri)
# ---------------------------------------------------------------------
# LISTE BLANCHE STRICTE : pages PRO uniquement.
# Jamais : seo/ (490 pages), tabibi.apk, pages patient (index, signup,
# patient-*), blog/, legal/, docs/. Le site web n'est PAS modifié —
# ce script ne fait que COPIER vers desktop/dist (gitignoré).
# Lancé par tauri via beforeDevCommand / beforeBuildCommand.
# =====================================================================
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DIST="$HERE/dist"

rm -rf "$DIST"
mkdir -p "$DIST"

# ── Pages pro (liste blanche) ────────────────────────────────────────
# Auth (entrée de l'app) + espaces médecin/secrétariat + agenda + messagerie pro
PAGES="login.html forgot-password.html reset-password.html
agenda-cabinet.html
doctor-dashboard.html secretaire-dashboard.html
medecin-ordonnance.html medecin-profile.html doctor-profile.html
doctor-analytics.html medecin-waitinglist.html doctor-reservation.html
messages.html conversation.html notifications.html
offline.html 404.html"
# ⚠ SYNC : refléter toute modif de cette liste dans js/tabibi-desktop-nav.js (PAGES)

for f in $PAGES; do
  if [ -f "$ROOT/$f" ]; then
    cp "$ROOT/$f" "$DIST/"
  else
    echo "  (page absente, ignorée : $f)"
  fi
done

# ── Ressources partagées (petites : ~1,6 Mo au total) ────────────────
cp -R "$ROOT/js"     "$DIST/js"
cp -R "$ROOT/css"    "$DIST/css"
cp -R "$ROOT/styles" "$DIST/styles"
cp -R "$ROOT/images" "$DIST/images"
cp -R "$ROOT/assets" "$DIST/assets"
cp "$ROOT/manifest.json" "$DIST/" 2>/dev/null || true
cp "$ROOT/favicon.ico"   "$DIST/" 2>/dev/null || true

# ── Garde-fous anti-régression du périmètre ──────────────────────────
[ -d "$DIST/seo" ] && { echo "ERREUR: seo/ dans le bundle"; exit 1; }
[ -f "$DIST/tabibi.apk" ] && { echo "ERREUR: apk dans le bundle"; exit 1; }
[ -f "$DIST/patient-dashboard.html" ] && { echo "ERREUR: page patient dans le bundle"; exit 1; }

echo "dist prêt: $(find "$DIST" -type f | wc -l | tr -d ' ') fichiers, $(du -sh "$DIST" | cut -f1)"
