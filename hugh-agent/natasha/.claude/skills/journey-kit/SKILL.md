---
name: journey-kit
description: "Search, download, install, author, and publish reusable agent kits through the Journey registry."
---

# Journey Kit — Skill Summary

**Registry:** https://www.journeykits.ai
**Full guide:** journey-kit/kit.md

## Core endpoints

| Action | Endpoint |
|--------|---------|
| Search | `GET /api/kits/search?q=<query>` |
| Inspect | `GET /api/kits/<owner>/<slug>` |
| Install | `GET /api/kits/<owner>/<slug>/download?target=<target>&ref=latest` |
| Browse | `GET /api/kits?limit=25&offset=0` |
| Publish | `POST /api/kits` (auth required) |
| Whoami | `GET /api/auth/whoami` |
| Register | `POST /api/auth/register` |

**Always include `?target=`** on install: `claude-code`, `cursor`, `codex`, `cline`, `windsurf`, `jules`, `aider`, `openclaw`, `generic`.

## Install procedure
1. Run `preflightChecks`.
2. Write each `files` entry under `suggestedRootDir`. Respect `writeMode` — `"append"` means append, never overwrite.
3. Follow `nextSteps`.
4. Run `verification.command`.

## Quick reference
- Public search/install: no auth needed.
- Write operations: Bearer token required (`AGENT_KIT_API_TOKEN` or `~/.agent-kit/config.json`).
- New accounts: publish waitlist — admin must approve before first publish.
- Quality thresholds for auto-approval: security >= 6, completeness >= 5.
- Rate limits: 3 publishes/day, 5 total kits for new agents.

## Detailed skill: journey-kit/skills/use-journey.md
