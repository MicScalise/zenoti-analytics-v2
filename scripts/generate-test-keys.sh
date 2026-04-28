#!/usr/bin/env bash
# =============================================================================
# generate-test-keys.sh — Generate real RSA keys for JWT signing
# Implements: DR-043 (real RSA keys, never fabricated)
# Generates RSA 2048-bit key pair and outputs base64-encoded PEM for .env
# =============================================================================

set -euo pipefail

echo "=== Generating RSA Test Keys for JWT (DR-043) ==="

# Create temporary directory for key generation
KEY_DIR=$(mktemp -d)
PRIVATE_KEY="$KEY_DIR/jwt_private.pem"
PUBLIC_KEY="$KEY_DIR/jwt_public.pem"

# Generate RSA 2048-bit private key
openssl genpkey -algorithm RSA -out "$PRIVATE_KEY" -pkeyopt rsa_keygen_bits:2048 2>/dev/null

# Extract public key from private key
openssl rsa -pubout -in "$PRIVATE_KEY" -out "$PUBLIC_KEY" 2>/dev/null

# Base64-encode for .env (DR-031: .env can't handle multiline PEM)
PRIVATE_B64=$(base64 -w 0 "$PRIVATE_KEY")
PUBLIC_B64=$(base64 -w 0 "$PUBLIC_KEY")

# Output for .env.test or .env
ENV_FILE="${1:-apps/api/.env.test}"

echo "Writing keys to $ENV_FILE"
{
  echo ""
  echo "# Auto-generated RSA keys for JWT (DR-043: real keys, not fabricated)"
  echo "# Generated: $(date -Iseconds)"
  echo "JWT_PRIVATE_KEY_B64=$PRIVATE_B64"
  echo "JWT_PUBLIC_KEY_B64=$PUBLIC_B64"
} >> "$ENV_FILE"

# Verify the keys are valid PEM (DR-043 check)
echo "Verifying generated keys..."
if openssl rsa -check -in "$PRIVATE_KEY" -noout 2>/dev/null; then
  echo "✓ Private key is valid RSA PEM"
else
  echo "✗ Private key validation failed!"
  exit 1
fi

if openssl rsa -pubin -in "$PUBLIC_KEY" -text -noout >/dev/null 2>&1; then
  echo "✓ Public key is valid RSA PEM"
else
  echo "✗ Public key validation failed!"
  exit 1
fi

# Cleanup
rm -rf "$KEY_DIR"

echo "=== Key generation complete ==="
echo "Keys written to $ENV_FILE as JWT_PRIVATE_KEY_B64 and JWT_PUBLIC_KEY_B64"
