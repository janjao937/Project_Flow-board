#!/bin/sh
set -e

# Reinstall only when package-lock changes (named volume keeps node_modules across restarts).
if [ -f package-lock.json ]; then
  LOCK_HASH=$(sha256sum package-lock.json | awk '{print $1}')
  if [ ! -f node_modules/.lockhash ] || [ "$(cat node_modules/.lockhash)" != "$LOCK_HASH" ]; then
    echo "[dev] Installing npm dependencies..."
    npm ci --no-fund --no-audit
    echo "$LOCK_HASH" > node_modules/.lockhash
  fi
fi

exec "$@"
