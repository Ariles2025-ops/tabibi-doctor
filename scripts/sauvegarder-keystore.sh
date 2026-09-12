#!/bin/bash
# =====================================================================
# sauvegarder-keystore.sh — copie VÉRIFIÉE de la clé de signature Android
# =====================================================================
# Usage :  bash scripts/sauvegarder-keystore.sh /Volumes/MA_CLE_USB
#
# POURQUOI CE SCRIPT
# Les deux copies de la clé (~/Desktop/TABIBI-KEYSTORE-SAUVEGARDE/ et
# android/tabibi-release.jks) sont sur LE MÊME DISQUE. Ce n'est pas une
# sauvegarde, c'est une copie : une panne, un vol ou un effacement de ce Mac
# détruit les deux. Sans cette clé, AUCUNE mise à jour n'est possible pour les
# utilisateurs qui ont déjà installé l'app — il faudrait republier sous un
# autre nom de package et perdre toute la base installée.
#
# Ce script ne remplace pas le geste : il le rend vérifiable. Une copie dont
# on n'a pas comparé l'empreinte n'est pas une sauvegarde, c'est un espoir.
#
# IL NE COPIE PAS LE MOT DE PASSE, ET C'EST VOULU.
# Le mot de passe vit dans android/keystore.properties (non versionné). Le
# stocker à côté de la clé annulerait l'intérêt des deux. Il va dans un
# gestionnaire de mots de passe, séparément.
# =====================================================================

set -euo pipefail

SOURCE="$HOME/Desktop/TABIBI-KEYSTORE-SAUVEGARDE/tabibi-release-CLE-OFFICIELLE.jks"
# Empreinte relevée le 31/08/2026, confirmée le 09/09/2026.
ATTENDU="1957fe126747d7a089f05c60feed4f2b6d478524872196252966955b8faa825e"

DEST="${1:-}"
if [ -z "$DEST" ]; then
  echo "Usage : bash scripts/sauvegarder-keystore.sh <dossier de destination>"
  echo
  echo "Exemples :"
  echo "  bash scripts/sauvegarder-keystore.sh /Volumes/MA_CLE_USB"
  echo "  bash scripts/sauvegarder-keystore.sh ~/Documents/coffre-temporaire"
  echo
  echo "Il faut DEUX destinations indépendantes de ce Mac. Lancer le script"
  echo "deux fois, sur deux supports différents."
  exit 2
fi

echo "── Source ────────────────────────────────────────────────"
if [ ! -f "$SOURCE" ]; then
  echo "INTROUVABLE : $SOURCE"
  echo "La clé n'est pas là où l'audit du 31/08 l'a laissée. Ne pas improviser :"
  echo "vérifier d'abord avec ~/Desktop/TABIBI-KEYSTORE-SAUVEGARDE/OU-SONT-LES-COPIES.txt"
  exit 1
fi

SHA_SOURCE=$(shasum -a 256 "$SOURCE" | cut -d' ' -f1)
echo "  $SOURCE"
echo "  SHA-256 : $SHA_SOURCE"

if [ "$SHA_SOURCE" != "$ATTENDU" ]; then
  echo
  echo "ARRÊT : l'empreinte ne correspond pas à la clé officielle."
  echo "  attendu : $ATTENDU"
  echo "  lu      : $SHA_SOURCE"
  echo
  echo "Deux fichiers du Mac portent le mot BACKUP et NE SONT PAS cette clé"
  echo "(empreinte 952590eb…, mot de passe différent, clé différente) :"
  echo "  ~/Desktop/COPIE-2-SECURITE/tabibi-upload-keystore-BACKUP.jks"
  echo "  ~/Desktop/Tabibi-Backup-2026-07-21/Desktop/tabibi-upload-keystore-BACKUP.jks"
  echo "Ne pas sauvegarder celle-là : elle ne signe pas l'app distribuée."
  exit 1
fi
echo "  Empreinte conforme à la clé officielle."

echo
echo "── Destination ───────────────────────────────────────────"
if [ ! -d "$DEST" ]; then
  echo "INTROUVABLE : $DEST"
  echo "Le support est-il bien monté ?"
  exit 1
fi

CIBLE_DIR="$DEST/TABIBI-KEYSTORE-$(date +%Y-%m-%d)"
mkdir -p "$CIBLE_DIR"
cp "$SOURCE" "$CIBLE_DIR/"
cp "$HOME/Desktop/TABIBI-KEYSTORE-SAUVEGARDE/OU-SONT-LES-COPIES.txt" "$CIBLE_DIR/" 2>/dev/null || true

CIBLE="$CIBLE_DIR/$(basename "$SOURCE")"
SHA_CIBLE=$(shasum -a 256 "$CIBLE" | cut -d' ' -f1)
echo "  $CIBLE"
echo "  SHA-256 : $SHA_CIBLE"

echo
if [ "$SHA_CIBLE" = "$ATTENDU" ]; then
  echo "COPIE VÉRIFIÉE — l'empreinte de la destination est identique à l'originale."
  echo
  echo "Il reste deux gestes que ce script ne peut pas faire :"
  echo "  1. Débrancher ce support et le ranger AILLEURS que près du Mac."
  echo "     Un disque posé à côté de l'ordinateur ne survit pas au même"
  echo "     dégât des eaux, au même vol, au même incendie."
  echo "  2. Mettre le mot de passe du keystore dans un gestionnaire de mots"
  echo "     de passe — jamais dans ce dossier."
  echo
  echo "Puis relancer ce script sur un SECOND support indépendant."
else
  echo "ÉCHEC : la copie ne correspond pas à l'original. Support défectueux ou plein ?"
  echo "  attendu : $ATTENDU"
  echo "  lu      : $SHA_CIBLE"
  exit 1
fi
