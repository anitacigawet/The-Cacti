#!/usr/bin/env sh
set -eu

cd -- "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
[ -f .env ] || cp .env.example .env

echo "The server URL will be printed below."
exec node dist/index.js
