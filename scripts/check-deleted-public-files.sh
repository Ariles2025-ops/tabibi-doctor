#!/usr/bin/env bash
# =====================================================================
# check-deleted-public-files.sh — garde-fou pré-déploiement
# ---------------------------------------------------------------------
#   ./scripts/check-deleted-public-files.sh [ref_a_deployer]
#
# Liste tout fichier PUBLIC supprimé entre le dernier déploiement en
# Production et la référence à déployer (par défaut : main).
#
# POURQUOI — incident du 06/08/2026, documenté dans DEPLOY_FRONTEND.md.
# La couche d'assets de Cloudflare Pages continue de servir un fichier
# SUPPRIMÉ du déploiement, pour l'URL exacte sans query string, pendant
# s-maxage = 7 jours, immunisé contre Purge Everything.
#
# Conséquence : supprimer une page publique ne la retire PAS du web. Elle
# reste servie une semaine. Quand cette page contient des données
# personnelles — cas des 490 anciennes pages /seo/ et de leurs 891
# patronymes — la suppression donne l'illusion d'un retrait qui n'a pas eu
# lieu, et le retrait du garde-fou robots.txt les rend indexables.
#
# LA RÈGLE : remplacer, jamais supprimer.
#   ✅ écraser le fichier par un contenu vide//neutre de MÊME NOM — l'asset
#      existe, il est écrasé, la nouvelle version est servie immédiatement ;
#   ❌ supprimer le fichier — l'ancien contenu survit jusqu'à 7 jours.
#
# Ce script ne bloque rien tout seul : il EXIGE une justification écrite.
# Sortie 0 = rien à signaler. Sortie 2 = des suppressions publiques, à
# justifier avant d'envoyer.
# =====================================================================

set -uo pipefail
cd "$(dirname "$0")/.."

REF="${1:-main}"
PROJECT="tabibi-doctor"

# Chemins servis au public. `.` couvre la racine ; les répertoires non
# publics sont exclus plus bas plutôt qu'énumérés ici, pour qu'un nouveau
# dossier public soit couvert par défaut et non oublié.
PUBLIC_PATHS=(blog legal seo api assets js styles)
ROOT_GLOB='*.html'

echo "═══ Contrôle des suppressions publiques ═══"

# ── Référence du dernier déploiement Production ──────────────────────
LAST=$(npx wrangler pages deployment list --project-name="$PROJECT" 2>/dev/null \
  | awk -F'│' '$3 ~ /Production/ {gsub(/ /,"",$5); print $5; exit}')

if [ -z "${LAST:-}" ]; then
  echo "  ⚠️  Dernier déploiement introuvable (wrangler non authentifié ?)."
  echo "     Reprendre à la main :"
  echo "       npx wrangler pages deployment list --project-name=$PROJECT"
  echo "       git diff --diff-filter=D --name-only <SHA> $REF -- ${PUBLIC_PATHS[*]} '$ROOT_GLOB'"
  exit 2
fi

if ! git cat-file -e "${LAST}^{commit}" 2>/dev/null; then
  echo "  ⚠️  Le SHA déployé ($LAST) est absent du dépôt local."
  echo "     Faire 'git fetch --all' puis relancer."
  exit 2
fi

echo "  déployé en Production : $LAST ($(git log -1 --format=%ad --date=short "$LAST"))"
echo "  à déployer            : $REF ($(git rev-parse --short "$REF"))"
echo

# ── Suppressions ─────────────────────────────────────────────────────
DELETED=$(git diff --diff-filter=D --name-only "$LAST" "$REF" -- \
  "${PUBLIC_PATHS[@]}" "$ROOT_GLOB" 2>/dev/null | sort)

if [ -z "$DELETED" ]; then
  echo "  ✅ Aucun fichier public supprimé. Rien à justifier."
  exit 0
fi

COUNT=$(printf '%s\n' "$DELETED" | wc -l | tr -d ' ')
echo "  ⛔ $COUNT fichier(s) public(s) supprimé(s) :"
echo
printf '%s\n' "$DELETED" | sed 's/^/       /' | head -40
[ "$COUNT" -gt 40 ] && echo "       … et $((COUNT - 40)) autre(s)"
echo

# ── Les suppressions portant des données personnelles ────────────────
# Détection sur le CONTENU d'origine, pas sur le nom : c'est le contenu
# qui restera servi.
echo "  ── Parmi elles, celles qui contenaient des données personnelles ──"
SENSITIVE=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if git show "$LAST:$f" 2>/dev/null \
     | grep -qE 'itemprop="name"|schema\.org/Physician|\bDr[.[:space:]]|\bPr[.[:space:]]'; then
    echo "       🔴 $f"
    SENSITIVE=$((SENSITIVE + 1))
  fi
done <<< "$DELETED"
[ "$SENSITIVE" -eq 0 ] && echo "       (aucune)"
echo

# ── Verdict ──────────────────────────────────────────────────────────
cat <<TXT
  ─────────────────────────────────────────────────────────────────
  JUSTIFICATION REQUISE AVANT ENVOI

  Ces fichiers resteront servis par la couche d'assets Cloudflare Pages
  jusqu'à 7 jours après le déploiement, sur leur URL exacte sans query
  string, sans que Purge Everything y puisse quoi que ce soit.

  Pour chaque suppression, répondre :
    1. l'URL est-elle censée disparaître, ou est-ce un renommage ?
       → renommage : garder l'ancien nom avec une redirection, ou
         écraser l'ancien fichier par un contenu neutre.
    2. le contenu supprimé porte-t-il des données personnelles ?
       → oui : NE PAS se contenter de supprimer. Écraser le fichier par
         un contenu vide de même nom, déployer, PUIS supprimer au
         déploiement suivant. Ou poser un filtre de sortie en Pages
         Function, comme functions/seo/[[path]].js.
    3. après déploiement, vérifier l'URL supprimée en GET **et** en HEAD :
         curl -s -o /dev/null -w '%{http_code}\\n' https://tabibi.doctor/<chemin>
         curl -sI https://tabibi.doctor/<chemin> | head -1
       Les deux doivent renvoyer 404. Un 200 signifie que la copie
       périmée est servie.
  ─────────────────────────────────────────────────────────────────
TXT

[ "$SENSITIVE" -gt 0 ] && echo "  ⛔ $SENSITIVE fichier(s) contenaient des données personnelles — ne pas déployer sans traitement."
exit 2
