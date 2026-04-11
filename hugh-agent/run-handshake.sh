#!/bin/bash
cd /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent
lsof -ti:7734 | xargs kill -9 2>/dev/null
pkill -f cloudflared 2>/dev/null
./bin/hugh-agent.js start --tunnel > agent.log 2>&1
