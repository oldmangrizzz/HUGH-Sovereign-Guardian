#!/bin/bash
# LOOM — rclone source sync script
# Syncs all configured cloud sources to /var/loom/sources/
# Run manually or via systemd timer before ingestion.

set -euo pipefail

SOURCES_DIR=/var/loom/sources
LOG=/var/loom/logs/rclone_sync.log
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting rclone sync" | tee -a "$LOG"

# ── Google Drive personal ─────────────────────────────────────────────────────
if rclone listremotes | grep -q "gdrive-personal:"; then
    echo "[*] Syncing gdrive-personal..." | tee -a "$LOG"
    rclone sync gdrive-personal: "$SOURCES_DIR/gdrive-personal" \
        --transfers=8 \
        --checkers=16 \
        --include="*.{pdf,md,txt,docx,py,ts,js,ipynb,jpg,jpeg,png,csv,xlsx}" \
        --log-file="$LOG" \
        --log-level=INFO \
        --fast-list
else
    echo "[!] gdrive-personal remote not configured — skipping" | tee -a "$LOG"
fi

# ── Google Drive business ─────────────────────────────────────────────────────
if rclone listremotes | grep -q "gdrive-business:"; then
    echo "[*] Syncing gdrive-business..." | tee -a "$LOG"
    rclone sync gdrive-business: "$SOURCES_DIR/gdrive-business" \
        --transfers=8 \
        --checkers=16 \
        --include="*.{pdf,md,txt,docx,py,ts,js,ipynb,jpg,jpeg,png,csv,xlsx}" \
        --log-file="$LOG" \
        --log-level=INFO \
        --fast-list
else
    echo "[!] gdrive-business remote not configured — skipping" | tee -a "$LOG"
fi

# ── iCloud ────────────────────────────────────────────────────────────────────
if rclone listremotes | grep -q "icloud:"; then
    echo "[*] Syncing iCloud..." | tee -a "$LOG"
    rclone sync icloud: "$SOURCES_DIR/icloud" \
        --transfers=4 \
        --checkers=8 \
        --include="*.{pdf,md,txt,docx,jpg,jpeg,png,csv,xlsx}" \
        --log-file="$LOG" \
        --log-level=INFO
else
    echo "[!] iCloud remote not configured — skipping" | tee -a "$LOG"
fi

# ── GitHub (local mirror via git pull) ───────────────────────────────────────
# GitHub repos are pulled separately — rclone not used for git
GITHUB_REPOS_FILE=/var/loom/config/github_repos.txt
if [ -f "$GITHUB_REPOS_FILE" ]; then
    echo "[*] Pulling GitHub repos..." | tee -a "$LOG"
    while IFS= read -r repo_url; do
        [[ -z "$repo_url" || "$repo_url" == \#* ]] && continue
        repo_name=$(basename "$repo_url" .git)
        dest="$SOURCES_DIR/github/$repo_name"
        if [ -d "$dest/.git" ]; then
            echo "  Pulling $repo_name" | tee -a "$LOG"
            git -C "$dest" pull --quiet 2>>"$LOG" || echo "  [!] Pull failed for $repo_name" | tee -a "$LOG"
        else
            echo "  Cloning $repo_name" | tee -a "$LOG"
            git clone --quiet "$repo_url" "$dest" 2>>"$LOG" || echo "  [!] Clone failed for $repo_name" | tee -a "$LOG"
        fi
    done < "$GITHUB_REPOS_FILE"
else
    echo "[!] No github_repos.txt found at $GITHUB_REPOS_FILE — skipping GitHub sync" | tee -a "$LOG"
fi

echo "[$TIMESTAMP] rclone sync complete" | tee -a "$LOG"
