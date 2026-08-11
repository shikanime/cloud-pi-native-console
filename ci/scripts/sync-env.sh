#!/bin/bash

# Génère les fichiers .env consommés par docker compose et les apps à partir
# de mise (configuration) et fnox (secrets).
#
# La configuration est déclarée dans les mise.toml de chaque app, les secrets
# dans fnox.toml. Ce script est le pont vers le format .env que docker compose
# et les images savent déjà lire : rien à changer côté conteneurs.
#
# Remplace ci/scripts/init-env.sh, qui copiait les *-example sans jamais les
# resynchroniser ensuite.

set -euo pipefail

PROJECT_DIR="$(git rev-parse --show-toplevel)"
APPS="client server server-nestjs"

TEXT_HELPER="\nGénère les fichiers .env depuis mise + fnox.
Les flags suivants sont disponibles :

  -e    Environnement à générer (défaut: local). Valeurs: local, docker, integ

  -h    Affiche l'aide\n\n"

print_help() {
  printf "$TEXT_HELPER"
}

ENVIRONMENT="local"

while getopts he: flag; do
  case "${flag}" in
    e)
      ENVIRONMENT=${OPTARG};;
    h | *)
      print_help
      exit 0;;
  esac
done

case "$ENVIRONMENT" in
  local)
    MISE_ENV=""
    FNOX_PROFILE="${FNOX_PROFILE:-default}"
    SUFFIX="";;
  docker)
    MISE_ENV="docker"
    FNOX_PROFILE="${FNOX_PROFILE:-docker}"
    SUFFIX=".docker";;
  integ)
    MISE_ENV="integ"
    FNOX_PROFILE="${FNOX_PROFILE:-integ}"
    SUFFIX=".integ";;
  *)
    printf "\nEnvironnement inconnu: '$ENVIRONMENT'\n"
    print_help
    exit 1;;
esac

export FNOX_PROFILE MISE_ENV

# Les secrets sont identiques pour toutes les apps : on les résout une fois.
#
# `fnox export` émet du shell (`export KEY='valeur'`) : on le normalise en
# KEY=valeur, seul format que docker compose env_file et parseEnv() acceptent.
# Un secret non résolvable est simplement omis de la sortie (et `fnox check`
# sort en 0) : on compare donc le total déclaré, présent dans l'en-tête, au
# nombre de lignes réellement exportées.
raw="$(cd "$PROJECT_DIR" && fnox export --format env 2>/dev/null)"

declared="$(printf '%s\n' "$raw" | sed -n 's/^# Total secrets: //p')"
SECRETS="$(printf '%s\n' "$raw" \
  | sed -e '/^#/d' -e '/^$/d' -e "s/^export //" -e "s/='\(.*\)'$/=\1/")"
exported="$(printf '%s' "$SECRETS" | grep -c . || true)"

if [ -z "$declared" ] || [ "$exported" -ne "$declared" ]; then
  printf "\nSecrets non résolvables pour le profil '%s' (%s/%s résolus) :\n\n" \
    "$FNOX_PROFILE" "$exported" "${declared:-?}"
  (cd "$PROJECT_DIR" && fnox export --format env >/dev/null) || true
  printf "\nRenseignez-les dans votre gestionnaire de secrets, puis relancez.\n"
  exit 1
fi

# Tout est généré dans un répertoire temporaire d'abord : un fichier partiel
# serait pire que pas de fichier du tout, l'application démarrerait avec une
# config tronquée.
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

for app in $APPS; do
  {
    printf '# Fichier généré par ci/scripts/sync-env.sh — ne pas éditer.\n'
    printf '# Configuration: apps/%s/mise.toml | Secrets: fnox.toml\n\n' "$app"
    (cd "$PROJECT_DIR/apps/$app" && mise env --dotenv)
    printf '\n%s\n' "$SECRETS"
  } > "$staging/$app"
done

# Tout s'est généré sans erreur : on publie.
for app in $APPS; do
  target="$PROJECT_DIR/apps/$app/.env$SUFFIX"
  mv "$staging/$app" "$target"
  printf "Généré: %s\n" "${target#"$PROJECT_DIR"/}"
done
