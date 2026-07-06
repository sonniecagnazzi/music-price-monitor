#!/usr/bin/env bash
set -e

if [ ! -x node_modules/.bin/next ]; then
  echo "Dipendenze mancanti: lancio scripts/local-setup.sh"
  ./scripts/local-setup.sh
fi

yarn build
