#!/usr/bin/env sh
set -eu

cd -- "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
[ -f .env ] || cp .env.example .env

echo "The Cacti is starting at http://localhost:3002/"
exec node dist/index.js
