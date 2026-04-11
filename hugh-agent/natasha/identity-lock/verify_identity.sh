#!/bin/bash
# Natasha Identity Integrity Verifier
# Runs at container startup. Halts if identity files have been tampered.
# Signed manifest — private key lives on Mac only. Operator must sign any legitimate changes.

LOCK_DIR="/identity-lock"
PROMPTS_DIR="/a0/prompts/default"
MANIFEST="$LOCK_DIR/identity_manifest.txt"
SIG="$LOCK_DIR/identity_manifest.txt.sig"
ALLOWED_SIGNERS="$LOCK_DIR/allowed_signers"
NAMESPACE="natasha-identity"
IDENTITY="grizzly_admin"

echo "[identity-lock] Verifying Romanova identity integrity..."

# 1. Verify the manifest signature
ssh-keygen -Y verify \
  -f "$ALLOWED_SIGNERS" \
  -I "$IDENTITY" \
  -n "$NAMESPACE" \
  -s "$SIG" < "$MANIFEST"

if [ $? -ne 0 ]; then
  echo "[identity-lock] CRITICAL: Manifest signature INVALID. Identity files may have been tampered."
  echo "[identity-lock] HALTING."
  exit 1
fi

echo "[identity-lock] Manifest signature valid."

# 2. Verify each file hash against the signed manifest
FAIL=0
while IFS= read -r line; do
  EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
  FILENAME=$(echo "$line" | awk '{print $2}')
  FILEPATH="$PROMPTS_DIR/$FILENAME"

  if [ ! -f "$FILEPATH" ]; then
    echo "[identity-lock] MISSING: $FILEPATH"
    FAIL=1
    continue
  fi

  ACTUAL_HASH=$(sha256sum "$FILEPATH" | awk '{print $1}')
  if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    echo "[identity-lock] TAMPERED: $FILENAME"
    echo "[identity-lock]   Expected: $EXPECTED_HASH"
    echo "[identity-lock]   Actual:   $ACTUAL_HASH"
    FAIL=1
  else
    echo "[identity-lock] OK: $FILENAME"
  fi
done < "$MANIFEST"

if [ $FAIL -ne 0 ]; then
  echo "[identity-lock] CRITICAL: Identity file integrity check FAILED. Romanova is compromised."
  echo "[identity-lock] To re-lock with new files: run sign_identity.sh on the Mac, then redeploy."
  exit 1
fi

echo "[identity-lock] All identity files verified. Romanova is intact."
exit 0
