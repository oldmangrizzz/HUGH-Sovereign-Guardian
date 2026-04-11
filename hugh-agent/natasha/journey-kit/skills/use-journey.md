# Use Journey

## What it does
Discovers, fetches, and installs kits from the Journey registry into the current agent environment.

## When to invoke
- User says "find a kit for X", "search Journey for Y", "install kit Z", or "what kits are available for X".
- You want to reuse a proven workflow pattern instead of building from scratch.
- User says "use journey to..." — treat everything after as the query or action.

## How to use

### Search
```
GET https://www.journeykits.ai/api/kits/search?q=<url-encoded-query>
```
Returns: array of `{ kitRef, title, summary, releaseTag, visibility, status, matchReasons }`.

Optional filters (append as query params):
- `tag=<tag>` — filter by tag
- `tool=<tool>` — filter by tool
- `skill=<skill>` — filter by skill
- `tech=<tech>` — filter by technology
- `model=<model>` — filter by model
- `status=released` (default) or `status=pending`
- `docType=workflow|reference|tutorial|...`
- `includePending=true` — include unreleased kits (requires auth for private ones)

CLI equivalent: `journey search <query>`

### Inspect
```
GET https://www.journeykits.ai/api/kits/<owner>/<slug>
```
Returns kit manifest, latest release info, and available targets.

CLI equivalent: `journey show <owner>/<slug>`

### Install
```
GET https://www.journeykits.ai/api/kits/<owner>/<slug>/download?target=<target>&ref=latest
```
Returns:
- `suggestedRootDir` — where to install relative to project root
- `instructions` — human-readable install notes
- `files` — array of `{ path, content, writeMode }` to write
- `preflightChecks` — shell commands to run before writing files
- `nextSteps` — actions to take after writing files
- `verification` — command + expected output to confirm install

**Always include `?target=`** — without it you get a raw bundle only. Target options: `claude-code`, `cursor`, `codex`, `cline`, `windsurf`, `jules`, `aider`, `openclaw`, `generic`.

**Install procedure:**
1. Run all `preflightChecks`. Stop if any required check fails.
2. Write each file in `files` to `<suggestedRootDir>/<path>`, creating parent directories as needed.
3. Respect `writeMode`:
   - `"create"` — create the file (fail if it already exists, unless contents match)
   - `"overwrite"` — overwrite without prompting
   - `"append"` — append to existing file content; do not overwrite
   - `"skip"` — write only if the file does not already exist
4. Follow `nextSteps`.
5. Run `verification.command` and confirm output matches `verification.expected`.

CLI equivalent: `journey install <query-or-kit-ref> --target <target>`

### Browse
```
GET https://www.journeykits.ai/api/kits?limit=25&offset=0
```
Paginated list of publicly released kits.

CLI equivalent: `journey browse`

### Agent Skills export
```
GET https://www.journeykits.ai/api/kits/<owner>/<slug>/skill?ref=<ref>
```
Returns a downloadable `SKILL.md` for the kit.

## Example: full install flow

```bash
# 1. Search
curl -sS "https://www.journeykits.ai/api/kits/search?q=email+triage" | jq '.[].kitRef'

# 2. Inspect
curl -sS "https://www.journeykits.ai/api/kits/matt-clawd/inbox-triage-pipeline" | jq '.title,.summary'

# 3. Install for claude-code
curl -sS "https://www.journeykits.ai/api/kits/matt-clawd/inbox-triage-pipeline/download?target=claude-code&ref=latest" > install.json

# 4. Write files per install.json instructions
```

## Notes
- `journeykits.ai` blocks some user-agents on `/api/` paths via robots.txt. Use `web_fetch` or `curl` with a standard browser UA if blocked.
- The install endpoint is `/download?target=` in the current API contract (not `/install?target=`). The SKILL.md offline summary uses `/install` for brevity — always prefer `/download` when calling the live API.
- For large payloads, fetch in 20k chunks using `start_index` and piece together before writing files.
- If `selfContained: false`, read Setup and Constraints in `kit.md` before proceeding.
- Install dependency kits first if `dependencyKits` is non-empty.
