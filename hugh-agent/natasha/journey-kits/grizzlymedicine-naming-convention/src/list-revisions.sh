#!/usr/bin/env bash
# GrizzlyMedicine Lab — list-revisions.sh
#
# Lists all archived _vN revisions of a flat-named document,
# with modification timestamps and the current working version.
#
# Usage: ./list-revisions.sh <document-file>

set -euo pipefail

# --- help ---
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") <document-file>

Lists all archived _vN revisions of a flat-named document
with modification timestamps, ordered by version number.

Example:
  $(basename "$0") DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
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
DIR="$(cd "$(dirname "$INPUT")" && pwd)"
FILENAME="$(basename "$INPUT")"
BASE="${FILENAME%.*}"
EXT="${FILENAME##*.}"

# --- cross-platform timestamp (BSD macOS / GNU Linux) ---
ts() {
  stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$1" 2>/dev/null \
    || stat -c "%y" "$1" 2>/dev/null | cut -d'.' -f1 \
    || echo "(unknown)"
}

echo "Revision history: $FILENAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- collect matching archives ---
ARCHIVES=()
for f in "${DIR}/${BASE}_v"[0-9]*".${EXT}"; do
  if [[ -f "$f" && "$(basename "$f")" =~ ^.+_v[0-9]+\.${EXT}$ ]]; then
    ARCHIVES+=("$f")
  fi
done

# --- display sorted by version number ---
if [[ ${#ARCHIVES[@]} -eq 0 ]]; then
  echo "  (no archived revisions)"
else
  printf '%s\n' "${ARCHIVES[@]}" | sort -V | while IFS= read -r f; do
    printf "  %-60s  %s\n" "$(basename "$f")" "$(ts "$f")"
  done
fi

echo ""

# --- current working file ---
if [[ -f "${DIR}/${FILENAME}" ]]; then
  printf "  %-60s  %s  [current]\n" "$FILENAME" "$(ts "${DIR}/${FILENAME}")"
else
  echo "  (no current flat file found — was it renamed or deleted?)"
fi

echo ""
echo "Total archived revisions: ${#ARCHIVES[@]}"
