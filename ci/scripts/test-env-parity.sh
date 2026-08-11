#!/bin/bash

# Vérifie que les fichiers .env générés depuis mise + fnox sont équivalents aux
# anciens .env*-example. C'est le garde-fou de la migration : tant que ce test
# passe, remplacer init-env.sh par sync-env.sh ne change rien pour les apps.
#
# Usage: ./ci/scripts/test-env-parity.sh

set -euo pipefail

PROJECT_DIR="$(git rev-parse --show-toplevel)"
cd "$PROJECT_DIR"

./ci/scripts/sync-env.sh -e local >/dev/null
./ci/scripts/sync-env.sh -e docker >/dev/null

python3 - <<'EOF'
import sys

def parse(path):
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
        # Les *-example citent parfois les valeurs ("true"), mise ne le fait pas.
        values[key.strip()] = value.strip().strip('"')
    return values

failures = []

for app in ['server', 'client', 'server-nestjs']:
    for suffix in ['', '.docker']:
        name = f'apps/{app}/.env{suffix}'
        example = parse(f'{name}-example')
        generated = parse(name)

        if example is None:
            continue
        if generated is None:
            failures.append(f'{name} : non généré')
            continue

        for key, expected in example.items():
            if key not in generated:
                failures.append(f'{name} : clé manquante {key}')
            elif generated[key] != expected:
                failures.append(
                    f'{name} : {key} attendu {expected!r}, obtenu {generated[key]!r}'
                )

if failures:
    print('Parité .env rompue :\n')
    for failure in failures:
        print(f'  - {failure}')
    sys.exit(1)

print('Parité .env vérifiée : local + docker identiques aux *-example.')
EOF
