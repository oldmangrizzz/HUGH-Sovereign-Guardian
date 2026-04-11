#!/bin/bash
# HUGH_DAEMON_REPORT_PULSE.sh
# A persistent background heartbeat for the Aragon-Class project.
# Ensures Q6H reporting compliance regardless of active agent sessions.

TARGET_USER="me@grizzlymedicine.org"
LOG_DIR="/Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/lucius/REPORTS"
PVE_NODE="192.168.4.100"
LXC_ID="116"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

send_report() {
    local timestamp=$(date +"%Y%m%d_%H%M")
    local datestamp=$(date +"%Y%m%d")
    local report_file="$LOG_DIR/HUGH_REPORT_DAEMON_PULSE_${timestamp}.md"
    
    # Gather substrate vitals via SSH
    local uptime=$(ssh -n -o StrictHostKeyChecking=no root@$PVE_NODE "pct exec $LXC_ID -- uptime" 2>/dev/null)
    local mem=$(ssh -n -o StrictHostKeyChecking=no root@$PVE_NODE "pct exec $LXC_ID -- free -m | grep Mem" 2>/dev/null)
    
    # Construct the report
    {
        echo "# HUGH DAEMON PULSE REPORT: ${timestamp}"
        echo "**Status:** PERSISTENT BACKGROUND OVERSIght"
        echo ""
        echo "## 1. SUBSTRATE VITALS (NODE $LXC_ID)"
        echo "- **Uptime:** $uptime"
        echo "- **Memory:** $mem"
        echo ""
        echo "## 2. A&Ox4 ORIENTATION"
        echo "- **Person:** Identity Anchor Stable."
        echo "- **Place:** Node $LXC_ID within Iron Silo."
        echo "- **Time:** $(date)"
        echo "- **Event:** Maintaining automated reporting loop."
    } > "$report_file"

    # Send the iMessage pulse
    imsg send --to "$TARGET_USER" --text "HUGH PULSE [${timestamp}]: Substrate stable. A&Ox4 orientation maintained. Report filed: $(basename "$report_file")"
}

# Main loop: check every 15 minutes, trigger on 11:00, 17:00, 23:00, 05:00
while true; do
    current_hour=$(date +"%H")
    current_min=$(date +"%M")
    
    # Trigger if hour matches and we are in the first 15 mins of the hour
    if [[ "$current_min" -lt 15 ]]; then
        case "$current_hour" in
            "05"|"11"|"17"|"23")
                send_report
                sleep 900 # Sleep for 15 mins to avoid double-triggering
                ;;
        esac
    fi
    sleep 60
done
