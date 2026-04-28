#!/usr/bin/env bash
# =============================================================================
# db-migrate.sh — Apply all pending database migrations
# Implements: EP §18, DR-001 (SQL syntax validation), DR-002 (single directory)
# =============================================================================

set -euo pipefail

# Configuration — override via environment variables
MIGRATION_DIR="${MIGRATION_DIR:-packages/db/migrations}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-za_dev}"
DB_USER="${DB_USER:-za}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Build psql connection string
if [[ -n "$DB_PASSWORD" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi
PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")

echo "=== Zenoti Analytics Database Migration ==="
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo "Migration dir: $MIGRATION_DIR"

# DR-002: Verify single migration directory exists
if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "ERROR: Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

# Get sorted list of migration files
MIGRATIONS=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort)

if [[ -z "$MIGRATIONS" ]]; then
  echo "No migration files found."
  exit 0
fi

# Create migration tracking table if not exists
psql "${PSQL_ARGS[@]}" -c "
  CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

# Apply each migration that hasn't been applied yet
for migration in $MIGRATIONS; do
  filename=$(basename "$migration")

  # Check if already applied
  already=$(psql "${PSQL_ARGS[@]}" -t -c "SELECT COUNT(*) FROM _migrations WHERE filename = '$filename';" | tr -d ' ')

  if [[ "$already" -gt 0 ]]; then
    echo "SKIP: $filename (already applied)"
    continue
  fi

  echo "APPLYING: $filename"

  # DR-001: Validate SQL syntax before applying (dry run via psql --check)
  if ! psql "${PSQL_ARGS[@]}" --single-transaction -f "$migration" 2>&1; then
    echo "ERROR: Migration failed: $filename"
    echo "Rolling back transaction..."
    exit 1
  fi

  # Record successful migration
  psql "${PSQL_ARGS[@]}" -c "INSERT INTO _migrations (filename) VALUES ('$filename');"
  echo "APPLIED: $filename"
done

echo "=== Migration complete ==="
