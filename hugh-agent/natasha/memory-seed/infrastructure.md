# Infrastructure State — GrizzlyMedicine

Last verified: 2026-04-10

## Workshop Charlie (76.13.146.61) — YOUR HOST
Ubuntu 24.04.3 LTS (6.8.0-94-generic x86_64)
Hostinger VPS, Frankfurt
26 pending apt updates + system restart required as of 2026-04-10

Running Docker containers (all healthy as of 2026-04-10):
- pangolin (fosrl/pangolin:latest) — reverse tunnel + SSO auth wall
- gerbil (fosrl/gerbil) — WireGuard companion to Pangolin
- traefik (traefik:v3.6) — reverse proxy, TLS via Let's Encrypt
- natasha-zero (frdel/agent-zero-run:latest) — YOU, port 50001
- natasha-pocket-tts — voice synthesis
- natasha-stt — speech-to-text
- natasha-voice-worker — voice pipeline

Compose files:
- /opt/pangolin/docker-compose.yml (Pangolin stack)
- /opt/natasha-zero/docker-compose.yml (Natasha stack)

Config directories:
- /opt/pangolin/config/ — Pangolin config, db.sqlite, traefik dynamic configs
- /opt/natasha-zero/prompts/ — Agent Zero system prompts (mounted :ro)

## Workshop Alpha (192.168.4.100) — iMac
Proxmox PVE 8, 38GB RAM, 3TB
Cluster: grizzlab (primary node)
Runs: CTs and VMs for homelab services
LAN only — not directly internet-exposed

## Workshop Beta (192.168.4.151) — Dell Latitude 3189
Proxmox PVE 8
Cluster: grizzlab (secondary node)
LAN only

## Workshop Delta (187.124.28.147) — Hostinger VPS
BlackArch security lab
DO NOT cluster with grizzlab
DO NOT deploy unrelated services here

## KVM2 (76.13.146.61) — SAME AS WORKSHOP CHARLIE
Note: KVM2 and Workshop Charlie are the same host.

## Domains
- grizzlymedicine.org — public facing
- grizzlymedicine.icu — backend APIs and infrastructure
- *.grizzlymedicine.icu subdomain services protected by Pangolin auth wall

## Pangolin Resources (db.sqlite)
| ID | Subdomain | SSO | Notes |
|----|-----------|-----|-------|
| 1  | hugh-gateway | 0 | |
| 2  | proxmox (alpha+beta) | 0 | |
| 3  | workshop | 1 | |
| 4  | obsidian | 0 | |
| 5  | natasha.grizzlymedicine.icu | 1 | YOU |

## Critical Config Note — Pangolin Auth
workshop.yml Badger middleware MUST use:
  resourceSessionRequestParam: "resource_session_request_param"
NOT "p_session_request" — that mismatch causes a redirect loop.
Token in URL is raw; Pangolin hashes with SHA256 before DB lookup.
Cookie domain = specific subdomain, not wildcard.

## Traefik Network
natasha-zero container must be on network: pangolin_default (not 'pangolin' named network)
label: traefik.docker.network=pangolin_default is required

## Credential Locations
Runtime: /opt/natasha-zero/.env
Master: /opt/natasha-zero/secrets.env
Mac local copy: /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/natasha/secrets.env

## Cloud Resources
- GCP Dev: free tier
- Convex Pro: active
- Google Workspace: active
- HuggingFace Pro: active (no inference allocation)
