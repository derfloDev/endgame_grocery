#!/bin/sh
set -e

APP_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('/app/package.json','utf8')).version")
echo "Version: ${APP_VERSION}"

echo "Running database migrations..."
node /app/node_modules/node-pg-migrate/bin/node-pg-migrate.mjs up \
  --migrations-dir /app/backend/src/db/migrations

echo "Starting services..."
exec supervisord -c /etc/supervisord.conf
