#!/usr/bin/env bash
set -e

echo "==> Abilito Yarn 1.22.22"
corepack enable
corepack prepare yarn@1.22.22 --activate

echo "==> Installo dipendenze locali"
yarn install --network-timeout 300000 --ignore-engines --non-interactive --no-progress

echo "==> Controllo Next"
test -x node_modules/.bin/next

echo "OK: ambiente locale pronto."
