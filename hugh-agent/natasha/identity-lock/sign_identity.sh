#!/bin/bash
# sign_identity.sh — Re-signs the identity manifest after legitimate changes.
# Run this on your Mac ONLY. Private key never leaves this machine.
# Usage: ./sign_identity.sh [path/to/natasha-zero/prompts/default/]
#
# After signing, push the updated manifest + sig to Charlie:
#   scp identity_manifest.txt identity_manifest.txt.sig root@76.13.146.61:/opt/natasha-zero/identity-lock/

LOCK_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPTS_DIR="${1:-$LOCK_DIR}"
KEY="$LOCK_DIR/identity_signing"

FILES=(
  "agent.system.main.role.md"
  "agent.system.memories.md"
  "agent.system.main.solving.md"
)

echo "[sign] Computing hashes..."
MANIFEST="$LOCK_DIR/identity_manifest.txt"
> "$MANIFEST"

for f in "${FILES[@]}"; do
  SRC="$PROMPTS_DIR/$f"
  if [ ! -f "$SRC" ]; then
    echo "[sign] ERROR: $SRC not found"
    exit 1
  fi
  sha256sum "$SRC" | sed "s|$PROMPTS_DIR/||" >> "$MANIFEST"
  echo "[sign]   Hashed: $f"
done

echo "[sign] Signing manifest with Ed25519 key..."
rm -f "$MANIFEST.sig"
ssh-keygen -Y sign -f "$KEY" -n natasha-identity "$MANIFEST"

echo "[sign] Verifying..."
echo "grizzly_admin $(cat $KEY.pub)" > "$LOCK_DIR/allowed_signers"
ssh-keygen -Y verify \
  -f "$LOCK_DIR/allowed_signers" \
  -I grizzly_admin \
  -n natasha-identity \
  -s "$MANIFEST.sig" < "$MANIFEST"

if [ $? -ne 0 ]; then
  echo "[sign] FAILED — signature verification did not pass."
  exit 1
fi

echo ""
echo "[sign] Identity locked. Push to Charlie:"
echo "  scp $LOCK_DIR/identity_manifest.txt $LOCK_DIR/identity_manifest.txt.sig root@76.13.146.61:/opt/natasha-zero/identity-lock/"
echo "  Then: docker restart natasha-zero"
