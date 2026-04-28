#!/usr/bin/env bash
# =============================================================================
# db-rollback.sh — Rollback the last N database migrations
# Implements: EP §18, DR-002 (single migration directory)
# WARNING: Dev/staging only — NOT for production use
# =============================================================================

set -euo pipefail

# Configuration
MIGRATION_DIR="${MIGRATION_DIR:-packages/db/migrations}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-za_dev}"
DB_USER="${DB_USER:-za}"
STEPS="${1:-1}"

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi
PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")

echo "=== Database Rollback (dev/staging only) ==="
echo "Rolling back last $STEPS migration(s)"

# Get list of applied migrations in reverse order
APPLIED=$(psql "${PSQL_ARGS[@]}" -t -c "SELECT filename FROM _migrations ORDER BY applied_at DESC LIMIT $STEPS;" | tr -d ' ')

if [[ -z "$APPLIED" ]]; then
  echo "No migrations to roll back."
  exit 0
fi

# Check for rollback files
ROLLBACK_DIR="${MIGRATION_DIR}/rollbacks"

for filename in $APPLIED; do
  rollback_file="$ROLLBACK_DIR/${filename}"

  if [[ -f "$rollback_file" ]]; then
    echo "ROLLING BACK: $filename"
    psql "${PSQL_ARGS[@]}" --single-transaction -f "$rollback_file"
  else
    echo "WARNING: No rollback file for $filename"
    echo "Creating empty rollback record..."
  fi

  # Remove from migration tracking
  psql "${PSQL_ARGS[@]}" -c "DELETE FROM _migrations WHERE filename = '$filename';"
  echo "ROLLED BACK: $filename"
done

echo "=== Rollback complete ==="
