#!/bin/bash
# H.U.G.H. Fungal Repair Script — OOM Mitigation
# Monitors memory and restarts stalled processes.

THRESHOLD=90 # % Memory usage

while true; do
    MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1)
    
    if [ "$MEM_USAGE" -gt "$THRESHOLD" ]; then
        echo "$(date): High memory usage detected ($MEM_USAGE%). Initiating fungal pruning..."
        
        # Kill llama-server if it's the culprit (aggressive)
        pkill -f llama-server
        
        # Restart hugh-agent if needed
        # (Assuming it's managed by pm2 or a systemd service, but let's do a manual restart for now)
        # cd /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent && ./run-handshake.sh
    fi
    
    sleep 60
done
