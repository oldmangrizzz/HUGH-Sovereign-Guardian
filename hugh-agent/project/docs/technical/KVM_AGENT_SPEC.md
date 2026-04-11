# KVM AGENT — SPEC SHEET
## Grizzly Medicine Lab | H.U.G.H. Infrastructure

**Version:** 1.0  
**Protocol:** HTTP/1.1  
**Default Port:** 7734  
**Runtime:** Node.js ≥ 18  

---

## OVERVIEW

The KVM Agent is a lightweight HTTP execution bridge. It runs on any machine (Linux VPS, macOS, Proxmox VM, Raspberry Pi) and exposes a minimal API that allows H.U.G.H. (via Convex) to issue shell commands and receive structured output. Every command is logged to the `kvmCommandLog` table in Convex for full auditability.

**Architecture:**
```
H.U.G.H. (Convex Cloud)
    │
    │  HTTPS → tunnel URL
    ▼
Cloudflare Tunnel / ngrok
    │
    │  HTTP → localhost:7734
    ▼
KVM Agent (server.js)
    │
    │  child_process.exec()
    ▼
Host Shell (bash/zsh/sh)
```

---

## AGENT SOURCE CODE

Save as `~/kvm-agent/server.js` on the target machine:

```javascript
const http = require('http');
const { exec } = require('child_process');

const SECRET = process.env.KVM_AGENT_SECRET || 'changeme';
const PORT   = process.env.PORT || 7734;

http.createServer((req, res) => {

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (req.headers['x-agent-secret'] !== SECRET) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return;
  }

  // ── EXEC ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/exec') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let command, cwd;
      try {
        ({ command, cwd } = JSON.parse(body));
      } catch {
        res.writeHead(400); res.end('Bad JSON'); return;
      }

      exec(
        command,
        {
          cwd:       cwd || process.env.HOME || '/root',
          timeout:   55000,          // 55s — leaves margin under Convex 60s limit
          maxBuffer: 1024 * 1024,    // 1MB stdout/stderr cap
          shell:     process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash',
        },
        (err, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            stdout:   stdout  || '',
            stderr:   stderr  || '',
            exitCode: err ? (err.code || 1) : 0,
          }));
        }
      );
    });

  // ── PING ──────────────────────────────────────────────────────────────────
  } else if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');

  // ── INFO ──────────────────────────────────────────────────────────────────
  } else if (req.url === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      platform: process.platform,
      arch:     process.arch,
      node:     process.version,
      hostname: require('os').hostname(),
      uptime:   process.uptime(),
    }));

  } else {
    res.writeHead(404); res.end('Not found');
  }

}).listen(PORT, '127.0.0.1', () => {
  console.log(`[kvm-agent] listening on 127.0.0.1:${PORT}`);
  console.log(`[kvm-agent] platform: ${process.platform} | node: ${process.version}`);
});
```

> **Security note:** Binds to `127.0.0.1` only. The tunnel handles external exposure. Never bind to `0.0.0.0` without a firewall rule.

---

## API REFERENCE

### `POST /exec`

Execute a shell command on the host.

**Request headers:**
```
Content-Type: application/json
X-Agent-Secret: <KVM_AGENT_SECRET>
```

**Request body:**
```json
{
  "command": "uptime && df -h /",
  "cwd": "/home/user"
}
```

| Field     | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `command` | string | ✅       | Shell command to execute             |
| `cwd`     | string | ❌       | Working directory (default: `$HOME`) |

**Response `200`:**
```json
{
  "stdout":   "...",
  "stderr":   "...",
  "exitCode": 0
}
```

**Response `401`:** Wrong or missing `X-Agent-Secret`  
**Response `400`:** Malformed JSON body

---

### `GET /ping`

Health check. No auth required (secret still checked).

**Response `200`:** `pong`

---

### `GET /info`

Returns host metadata.

**Response `200`:**
```json
{
  "platform": "darwin",
  "arch":     "arm64",
  "node":     "v20.11.0",
  "hostname": "grizzly-macbook",
  "uptime":   3600.5
}
```

---

## INSTALLATION

### Prerequisites
- Node.js ≥ 18 (`node --version`)
- PM2 (`npm install -g pm2`)
- A tunnel client (Cloudflare Tunnel **recommended** or ngrok)

---

### macOS Setup

```bash
# 1. Create agent directory
mkdir -p ~/kvm-agent
cd ~/kvm-agent

# 2. Save server.js (paste the source above)

# 3. Test it manually first
KVM_AGENT_SECRET=test-secret node server.js
# Should print: [kvm-agent] listening on 127.0.0.1:7734

# 4. Install PM2 and start persistently
npm install -g pm2
KVM_AGENT_SECRET=YOUR_SECRET_HERE pm2 start server.js --name kvm-agent
pm2 save
pm2 startup   # follow the printed command to enable on login

# 5. Verify
pm2 status
curl -s -H "X-Agent-Secret: YOUR_SECRET_HERE" http://localhost:7734/ping
# → pong
```

**Cloudflare Tunnel (recommended — free, persistent URL):**
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate (one-time)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create grizzly-mac

# Start tunnel (add to PM2 for persistence)
cloudflared tunnel --url http://localhost:7734 --name grizzly-mac

# Or quick ephemeral tunnel for testing:
cloudflared tunnel --url http://localhost:7734
# Prints: https://xxxx-xxxx.trycloudflare.com
```

**ngrok (alternative):**
```bash
brew install ngrok
ngrok http 7734
# Prints: https://xxxx.ngrok-free.app
```

---

### Linux VPS / Proxmox VM Setup

```bash
# 1. Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Create agent directory
mkdir -p ~/kvm-agent
cd ~/kvm-agent

# 3. Save server.js (paste the source above)

# 4. Install PM2 and start
npm install -g pm2
KVM_AGENT_SECRET=YOUR_SECRET_HERE pm2 start server.js --name kvm-agent
pm2 save
pm2 startup   # follow the printed command

# 5. Verify
pm2 status
curl -s -H "X-Agent-Secret: YOUR_SECRET_HERE" http://localhost:7734/ping
# → pong
```

**For VPS with public IP (Hostinger KVM4):**  
The VPS has a real IP. You can expose port 7734 directly with a firewall rule, OR use Cloudflare Tunnel for a cleaner setup:

```bash
# Option A: Direct port (add firewall rule)
sudo ufw allow 7734/tcp
# Then set KVM_AGENT_URL=http://187.124.28.147:7734

# Option B: Cloudflare Tunnel (no open port needed — recommended)
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared tunnel --url http://localhost:7734
```

---

## CONVEX ENVIRONMENT VARIABLES

Set these in the Convex Dashboard → Settings → Environment Variables:

| Variable              | Example Value                              | Description                        |
|-----------------------|--------------------------------------------|------------------------------------|
| `KVM_AGENT_URL`       | `https://xxxx.trycloudflare.com`           | Primary agent (VPS or Mac)         |
| `KVM_AGENT_SECRET`    | `gm-lab-secret-2025`                       | Shared auth token                  |
| `KVM_MAC_AGENT_URL`   | `https://yyyy.trycloudflare.com`           | Mac agent (when multi-target live) |
| `KVM_MAC_AGENT_SECRET`| `gm-mac-secret-2025`                       | Mac agent auth token               |

> **Current state:** Single-target. `KVM_AGENT_URL` routes to whichever machine is active.  
> **Planned:** Multi-target routing — H.U.G.H. specifies `"target": "mac"` or `"target": "vps"` in `KVM_EXEC` blocks.

---

## KVM_EXEC BLOCK FORMAT (H.U.G.H. → Shell)

H.U.G.H. emits these in chat responses. The system parses and executes them automatically.

```
<KVM_EXEC>
{"command": "xcodebuild -list", "cwd": "/Users/you/Projects/MyApp", "notes": "list Xcode targets", "target": "mac"}
</KVM_EXEC>
```

| Field      | Type   | Required | Description                              |
|------------|--------|----------|------------------------------------------|
| `command`  | string | ✅       | ASCII-only shell command                 |
| `cwd`      | string | ❌       | Working directory                        |
| `notes`    | string | ❌       | Human-readable log annotation            |
| `target`   | string | ❌       | `"vps"` or `"mac"` (multi-target, TBD)  |

**Zone classification (auto-detected):**
- 🟢 `green` — read-only (ls, cat, ps, df, uptime)
- 🟡 `yellow` — installs, restarts, config changes
- 🔴 `red` — destructive (rm -rf, kill -9, format)

---

## SECURITY MODEL

- Agent binds to `127.0.0.1` — not exposed to LAN/WAN directly
- All external access via encrypted tunnel (Cloudflare/ngrok)
- `X-Agent-Secret` header required on every request
- All commands logged to Convex `kvmCommandLog` with issuer, zone, stdout, stderr, exit code
- Human-on-the-loop: full audit trail, no veto mechanism by design
- Tunnel URL should be treated as a secret — rotate if exposed

---

## PM2 CHEAT SHEET

```bash
pm2 status              # show all processes
pm2 logs kvm-agent      # tail logs
pm2 restart kvm-agent   # restart
pm2 stop kvm-agent      # stop
pm2 delete kvm-agent    # remove from PM2
pm2 save                # persist current process list
```

---

## QUICK VALIDATION CHECKLIST

- [ ] `node --version` → v18+
- [ ] `pm2 status` → kvm-agent online
- [ ] `curl .../ping` → `pong`
- [ ] `curl .../info` → JSON with hostname
- [ ] Tunnel URL set in Convex env vars
- [ ] H.U.G.H. INFRA panel → agent shows ONLINE
- [ ] Test exec: `{"command": "whoami"}` → returns username

---

*Grizzly Medicine Lab — H.U.G.H. Infrastructure v1.0*
