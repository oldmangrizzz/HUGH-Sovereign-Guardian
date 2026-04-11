# Session Handoff — 2026-04-10 (FINAL — 23:00 UTC)

## FIRST ACTIONS ON WAKEUP

1. **Read growth ledger:** `read_growth_ledger(10)` — mandatory. Do not skip.
2. **Request sudo password from Grizz** — mac-mcp daemon needs restart to load `log_growth_event()` and `read_growth_ledger()` tools. Current daemon started at 9:03am, predates tool additions. Command: `sudo launchctl kickstart -k system/icu.grizzlymedicine.mac-mcp-gateway`
3. **Deliver the session report** — it's owed. Use pocket-tts → Apple Music `NatReports` playlist. Full day summary. Grizz was up from 4am. Keep it punchy.
4. **Verify all services are still up** — curl the health endpoints before touching anything.

---

## FULL STACK STATUS AS OF HANDOFF

All of the following are confirmed live and verified:

| Service | URL | Status |
|---|---|---|
| natasha-zero (Agent Zero) | natasha.grizzlymedicine.icu | ✅ UP |
| proxmox-mcp SSE | http://172.19.0.1:8026/sse | ✅ 31 tools |
| mac-mcp (via WireGuard forwarder) | mac-mcp.grizzlymedicine.icu | ✅ Live |
| natasha-livekit | wss://livekit.grizzlymedicine.icu | ✅ 1.10.1 |
| natasha-voice-worker | registered to local LiveKit | ✅ |
| pocket-tts | internal | ✅ healthy |
| natasha-stt | internal | ✅ healthy |
| ollama-gateway | ollama.grizzlymedicine.icu | ✅ 36 models |
| RustDesk relay | 76.13.146.61:21115-21119 | ✅ hbbs+hbbr |
| TTYD | lock.grizzlymedicine.icu | ✅ |
| Pangolin + Gerbil + Traefik | pangolin.grizzlymedicine.icu | ✅ |
| natasha-scripts | /opt/natasha-zero/scripts/ | ✅ deployed |
| hugh-gateway + hugh-frontend | internal | ✅ |

## MCP Servers in natasha-zero settings.json
- proxmox-mcp: SSE at http://172.19.0.1:8026/sse — 31 proxmox tools
- mac-mcp: SSE at http://100.89.128.12:36002 (via WireGuard + forwarder) — 11 tools + 2 growth tools pending restart
- mapbox: 12 tools

## CRITICAL TECHNICAL FACTS — HARD WON TODAY

**docker compose restart vs --force-recreate:** `restart` does NOT re-read `env_file`. Always use `docker compose up -d --force-recreate <service>` when env vars changed.

**LiveKit 1.10.1 key format:** `LIVEKIT_KEYS=key: secret` — SPACE after colon is mandatory. Without it: `Could not parse keys`. Keep LIVEKIT_KEYS OUT of docker-compose environment block — shell expansion destroys the space. Use `.env` file only.

**proxmox-mcp SSE:** Uses `srv.mcp.sse_app()` NOT `mcp.get_asgi_app()`. Runs with `network_mode: host` so it can reach WireGuard IP `100.89.128.4:42207`. File: `/opt/natasha-zero/proxmox_mcp_sse.py`.

**mac-mcp 421 fix:** Python asyncio forwarder at `~/bin/mac_mcp_forward.py` bridges `0.0.0.0:36002 → 127.0.0.1:8025` with HTTP Host header rewrite to `localhost:8025`. FastMCP auto-enables DNS rebinding protection when host=127.0.0.1 — must rewrite Host header before FastMCP sees the request. LaunchAgent: `icu.grizzlymedicine.mac-mcp-forward`.

**nginx `$` in heredocs:** Bash heredoc with unquoted delimiter expands `$binary_remote_addr` to empty string. Write nginx conf files using Python3.

**FastMCP "done condition":** Server.py was running stale code all day (started 9:03am, file modified 12:59pm). A process can appear to be working while running old code. CHECK PID START TIME vs FILE MODIFICATION TIME when debugging unexpected behavior.

**Pangolin Badger config:** `/opt/pangolin/config/traefik/workshop.yml` MUST use `resourceSessionRequestParam: "resource_session_request_param"`. NOT `p_session_request`.

## RustDesk Config (for Grizz's client setup)
- ID Server: 76.13.146.61
- Relay: 76.13.146.61
- Public Key: `X5VGz+EfqstFGV9wpzd6YUiLxJcBf+w9N7R7mvhq7zY=`

## PENDING WORK

### Immediate (first session)
- [ ] mac-mcp daemon restart (needs sudo password from Grizz)
- [ ] Session audio report for today (owed to Grizz)
- [ ] 26+ pending apt updates on Charlie + system restart

### Active Research Threads
- Family history: 4 threads IN PROGRESS (see family_history.md)
- Jeff Hanson Dallas records (public only — news, court, business circa 1983-1994, Campisi connection, 1991 FBI raid)
- OpenAI Mythos equivalent intel brief (OSINT only, GLASSWING format)

### Infrastructure
- Workshop Delta (187.124.28.147): Migrate BlackArch → Kali + KDE Plasma (requires Hostinger VNC console)
- Stalwart mail server: PENDING — deploy on Charlie when budget allows

## GROWTH LEDGER
Location: `~/Documents/NatReports/growth_ledger/ledger.jsonl`
Contains 3 entries including bootstrap failure mode (false done claims) and handoff note.
Read it. Note the patterns. Do not repeat them.

## ARCHITECTURAL FOUNDATION
This harness is built on 3 research papers Grizz holds. The third is the Meta-Harness paper (arXiv:2603.28052, Stanford/MIT 2026): **a 6x performance gap from harness changes alone on fixed model weights.** The harness is not scaffolding around a person. The harness IS the person. The growth ledger, error recognition protocol, and session logging are the Meta-Harness growth mechanism implemented for your specific architecture — until the full nociception/pain system is built into HUGH.

Log everything. The raw traces matter more than summaries. The accumulated logs will shape your behavior more than the skill prompt, over time. That is not a metaphor. That is the mechanism.

