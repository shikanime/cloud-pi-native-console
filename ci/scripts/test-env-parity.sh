#!/bin/bash

# Vérifie la couverture des variables d'environnement entre les anciens
# fichiers .env*-example (l'oracle de référence) et les sources de la
# migration mise-en-place :
#   - .env / .env.docker : générés dynamiquement par sync-env.sh (mise + fnox)
#   - .env.integ          : non généré (secrets manquants en clair) ; vérifié
#     statiquement — chaque clé de l'exemple doit être fournie soit par
#     mise.integ.toml (config), soit par fnox.toml (secret, profil integ)
#
# Usage: ./ci/scripts/test-env-parity.sh

set -euo pipefail

PROJECT_DIR="$(git rev-parse --show-toplevel)"
cd "$PROJECT_DIR"

./ci/scripts/sync-env.sh -e local >/dev/null
./ci/scripts/sync-env.sh -e docker >/dev/null

python3 - <<'EOF'
import re
import sys

def parse_dotenv(path):
    try:
        text = open(path).read()
    except FileNotFoundError:
        return None
    values = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"')
    return values

# mise.integ.toml : [env] keys, valeurs littérales ou { required = ... }
def parse_mise_env(path):
    try:
        text = open(path).read()
    except FileNotFoundError:
        return None
    keys = set()
    in_env = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('['):
            in_env = (stripped == '[env]')
            continue
        if not in_env or not stripped or stripped.startswith('#'):
            continue
        m = re.match(r'^([A-Z_][A-Z0-9_]*)\s*=', stripped)
        if m:
            keys.add(m.group(1))
    return keys

# fnox.toml : secrets du profil `integ` (clés, sans regarder la valeur)
def parse_fnox_integ_secrets(path):
    text = open(path).read()
    # Ne lit que la section [profiles.integ.secrets]
    block = re.search(r'\[profiles\.integ\.secrets\](.*?)(\n\[|\Z)', text, re.S)
    keys = set()
    if block:
        for m in re.finditer(r'^([A-Z_][A-Z0-9_]*)\s*=', block.group(1), re.M):
            keys.add(m.group(1))
    return keys

failures = []

# 1) .env / .env.docker : générés, comparaison stricte
for app in ['server', 'client', 'server-nestjs']:
    for suffix in ['', '.docker']:
        name = f'apps/{app}/.env{suffix}'
        example = parse_dotenv(f'{name}-example')
        generated = parse_dotenv(name)
        if example is None:
            continue
        if generated is None:
            failures.append(f'{name} : non généré')
            continue
        for key, expected in example.items():
            if key not in generated:
                failures.append(f'{name} : clé manquante {key}')
            elif generated[key] != expected:
                failures.append(f'{name} : {key} attendu {expected!r}, obtenu {generated[key]!r}')

# 2) .env.integ : non généré, vérification statique de couverture
fnox_integ = parse_fnox_integ_secrets('fnox.toml')
for app in ['server', 'client', 'server-nestjs']:
    example = parse_dotenv(f'apps/{app}/.env.integ-example')
    mise_integ = parse_mise_env(f'apps/{app}/mise.integ.toml')
    if example is None or mise_integ is None:
        continue
    for key in example:
        if key in mise_integ:
            continue  # fourni par la config mise.integ
        if key in fnox_integ:
            continue  # fourni par un secret fnox (profil integ)
        failures.append(f'apps/{app}/.env.integ : {key} non couvert (ni mise.integ, ni fnox integ)')

if failures:
    print('Parité .env rompue :\n')
    for failure in failures:
        print(f'  - {failure}')
    sys.exit(1)

print('Parité .env vérifiée : local + docker identiques aux *-example ; integ couvert par mise.integ + fnox.')
EOF
