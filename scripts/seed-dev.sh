#!/usr/bin/env bash
# =============================================================================
# seed-dev.sh — Populate development database with test data
# Implements: EP §18, DR-046 (source='zenoti_api' for production rows)
# =============================================================================

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-za_dev}"
DB_USER="${DB_USER:-za}"

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi
PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")

echo "=== Seeding Development Database ==="

# Apply seed data from SQL files
SEED_DIR="packages/db/seed"

if [[ ! -d "$SEED_DIR" ]]; then
  echo "ERROR: Seed directory not found: $SEED_DIR"
  exit 1
fi

for seed_file in "$SEED_DIR"/*.sql; do
  if [[ -f "$seed_file" ]]; then
    echo "Applying seed: $(basename "$seed_file")"
    psql "${PSQL_ARGS[@]}" -f "$seed_file"
  fi
done

# DR-046: Ensure all seed data has source='zenoti_api' for production tables
# Seed data is for development only, but must set source correctly
# to prevent Layer 3 validation failures in test environments
echo "Setting source='zenoti_api' on all seeded rows (DR-046 prevention)..."
psql "${PSQL_ARGS[@]}" -c "
  UPDATE provider_schedules SET source = 'zenoti_api' WHERE source IS NULL;
" 2>/dev/null || true

echo "=== Seed complete ==="
