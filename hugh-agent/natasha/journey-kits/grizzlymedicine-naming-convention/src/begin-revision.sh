#!/usr/bin/env bash
# GrizzlyMedicine Lab — begin-revision.sh
#
# Archives the current version of a flat-named document as _vN,
# leaving the flat name as the working copy for the next revision.
#
# Convention:
#   flat name   = current / active version
#   _vN suffix  = historical archive (N increments with each revision)
#
# Usage: ./begin-revision.sh <document-file>

set -euo pipefail

# --- help ---
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") <document-file>

Archives the current version of a flat-named document as _vN,
leaving the flat name as the working copy for the next revision.

Convention:
  flat name   = current / active version
  _vN suffix  = historical archive (N increments with each revision)

Example:
  $(basename "$0") DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md

  → Archives as: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
  → Working copy remains: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
EOF
  exit 0
fi

# --- validate input ---
if [[ $# -ne 1 ]]; then
  echo "Error: expected 1 argument, got $#." >&2
  echo "Run '$(basename "$0") --help' for usage." >&2
  exit 1
fi

INPUT="$1"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: '$INPUT' not found." >&2
  exit 1
fi

# Resolve absolute path so the script works from any directory
DIR="$(cd "$(dirname "$INPUT")" && pwd)"
FILENAME="$(basename "$INPUT")"
BASE="${FILENAME%.*}"
EXT="${FILENAME##*.}"

# --- warn on semver base names (e.g., SPEC_v2.2.md) ---
if [[ "$BASE" =~ _v[0-9]+\.[0-9]+$ ]]; then
  echo "⚠  '$FILENAME' uses semantic versioning in its name (_v[X].[Y])." >&2
  echo "   Revision archiving will append an integer _vN counter to the base name." >&2
  echo "   For specs and blueprints, consider incrementing the semantic version instead." >&2
  printf "   Proceed? [y/N]: " >&2
  read -r CONFIRM
  [[ "${CONFIRM:-n}" =~ ^[Yy]$ ]] || exit 0
fi

# --- count existing integer-suffix archives ---
# Only count files matching _vINTEGER.EXT — not semver files like _v2.0.md
EXISTING=0
for f in "${DIR}/${BASE}_v"[0-9]*".${EXT}"; do
  if [[ -f "$f" && "$(basename "$f")" =~ ^.+_v[0-9]+\.${EXT}$ ]]; then
    EXISTING=$((EXISTING + 1))
  fi
done

NEXT=$((EXISTING + 1))
ARCHIVE="${DIR}/${BASE}_v${NEXT}.${EXT}"

# --- safety check: don't overwrite an existing archive ---
if [[ -f "$ARCHIVE" ]]; then
  echo "Error: '$(basename "$ARCHIVE")' already exists." >&2
  echo "Check your revision history with list-revisions.sh before proceeding." >&2
  exit 1
fi

# --- archive: copy current → _vN (flat file remains as working copy) ---
cp "${DIR}/${FILENAME}" "$ARCHIVE"

echo "✓  Archived:     $(basename "$ARCHIVE")"
echo "✓  Working copy: $FILENAME  (ready for editing)"
echo ""

# --- show revision history ---
echo "Revision history:"
for f in "${DIR}/${BASE}_v"[0-9]*".${EXT}"; do
  if [[ -f "$f" && "$(basename "$f")" =~ ^.+_v[0-9]+\.${EXT}$ ]]; then
    printf "   %s\n" "$(basename "$f")"
  fi
done
printf "   → %s  [current]\n" "$FILENAME"
