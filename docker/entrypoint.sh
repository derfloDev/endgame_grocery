#!/bin/sh
set -e

echo "Running database migrations..."
node /app/node_modules/node-pg-migrate/bin/node-pg-migrate.mjs up \
  --migrations-dir /app/backend/src/db/migrations

echo "Starting services..."
exec supervisord -c /etc/supervisord.conf
