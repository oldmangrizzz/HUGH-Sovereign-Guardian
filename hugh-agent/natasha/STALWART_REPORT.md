# STALWART MAIL SERVER — TECHNICAL & OPERATIONAL REPORT
### Prepared for: GrizzlyMedicine AI/EMS Research Lab
### Operator: Grizz | Agents: Natasha, MJ, Lucius, Tony, Bruce
### Target Domain: grizzlymedicine.icu | Scope: Agent email infrastructure
### Date: 2025 | Classification: Internal Technical Assessment

---

## 1. PRODUCT OVERVIEW

**What Stalwart Is**

Stalwart is a modern, all-in-one mail and collaboration server written entirely in Rust. Unlike legacy mail stacks (Postfix + Dovecot + SpamAssassin + DKIM milter + etc.), it is a **single binary** providing SMTP, IMAP, JMAP, POP3, ManageSieve, CalDAV, CardDAV, WebDAV, an HTTP management API, and a web admin UI — zero external dependencies, no glue scripts.

**Maintainer:** Stalwart Labs Ltd (commercial entity backing open-source development)
**Repository:** `github.com/stalwartlabs/stalwart`
**Current Version (mid-2025):** 0.15.5 — actively releasing; ~monthly cadence
**1.0 Target:** Late 2025 — will lock database schema and guarantee migration paths
**License:** AGPL-3.0 (community edition); enterprise license available for commercial hosting use-cases

**Notable Endorsements:**
- Privacy Guides (privacyguides.org) uses Stalwart for their own internal mail infrastructure and recommends it explicitly
- Thunderbird Pro (Thundermail) — Mozilla's paid email hosting service — runs Stalwart as its backend, making it a reference implementation for JMAP in production at commercial scale

**Community vs. Mailcow:**

| Metric | Stalwart | Mailcow |
|---|---|---|
| GitHub Stars | ~12,000+ | ~9,000+ |
| GitHub Forks | ~700 | ~600 |
| Age | ~2021 (modern rewrite) | ~2014 |
| Community Forums | GitHub Discussions (active) | Official forum + Discord (large) |
| Reddit Presence | r/selfhosted discussions | Strong dedicated following |
| Documentation Quality | Good, improving rapidly | Mature, extensive |
| Third-party guides | Growing fast | Very extensive |

**Verdict on maturity gap:** Real but narrowing. Stalwart's community is smaller but highly engaged. Mailcow has a decade-long support ecosystem. For a lab running 5 agent mailboxes, Stalwart's GitHub Discussions coverage is sufficient.

---

## 2. FEATURE SET (COMPREHENSIVE)

### Protocols

**SMTP (Full)**
- SMTP + ESMTP inbound/outbound
- DANE, MTA-STS, SMTP TLS Reporting
- Inbound throttling, per-user/per-domain virtual queues
- Delayed/prioritized delivery
- Milter integration for external filters
- Full DKIM signing, SPF, DMARC, ARC verification on inbound

**IMAP4rev1 + IMAP4rev2**
- Full protocol compliance with major extensions
- Fast mailbox synchronization
- ManageSieve server (port 4190) for client-side filter management

**POP3**
- Legacy support — present but not the operational focus

**JMAP (RFC 8620/8621)**
- First-class implementation — reference quality
- JMAP Mail, JMAP for Sieve Scripts
- Real-time push via WebSockets
- JMAP for Calendars/Contacts actively shipping in 0.12+ series

### Admin UI
- Web-based, ships with Stalwart — accessible via HTTP/HTTPS
- Manages: users, domains, aliases, quotas, DKIM keys, spam rules, queues, server config
- Two-factor authentication for admin accounts
- Shows auto-generated DNS records (MX, SPF, DKIM, DMARC) — copy-paste to registrar
- Limitation: No per-user webmail — admin UI only, not end-user mail reading

### Anti-Spam
- **Built-in Bayes classifier** — learns from user actions (mark spam/ham)
- **LLM-driven spam filtering** — AI-powered message analysis (configurable hook)
- DNSBL integration (multiple blacklists simultaneously)
- Greylisting
- Pyzor collaborative filtering
- Phishing-specific detection
- All spam rules configurable in TOML or via web admin

### Email Authentication
- **DKIM:** Automatic key generation and signing — configured via web admin; keys displayed for DNS deployment
- **SPF:** Checked inbound; configured outbound via DNS (Stalwart provides the correct record)
- **DMARC:** Full inbound enforcement + aggregate report reception; outbound policy shown in admin
- **ARC:** Full support for authenticated received chain
- **MTA-STS + DANE:** Enforced secure transport
- **BIMI:** Supported via DNS

### PGP Encryption at Rest
- Inbound messages can be automatically encrypted before writing to disk
- User uploads their **OpenPGP public key** or **S/MIME certificate** via the web portal
- **Private keys never stored on server** — only user can decrypt
- Uses AES-256 encryption
- Meaningfully stronger model than Dovecot mail-crypt (which may store private keys server-side)
- Caveat: This only protects stored mail — transit encryption is standard TLS; also means server-side search and spam scanning is limited after encryption

### Aliases, Domains, Forwarding, Catch-alls
- Full multi-domain support
- Per-domain DKIM keys
- Aliases (individual and wildcard catch-all)
- Forwarding rules with optional local copy retention
- Group addresses / distribution lists
- All manageable via web UI or management API

### Sieve Filters
- Full ManageSieve server implementation
- Compatible with Sieve clients (Thunderbird, etc.)
- Server-side rules for sorting, auto-reply, forwarding
- JMAP for Sieve Scripts for programmatic management

### Quotas
- Per-user and per-domain storage quotas
- Configurable enforcement levels

### 2FA/MFA
- TOTP (Time-based One-Time Password) for admin accounts
- OAuth2 authentication support
- Fail2Ban-compatible event logging

### Clustering / High Availability
- Built-in cluster support with node autodiscovery
- FoundationDB backend for distributed deployments
- For GrizzlyMedicine scale (5 mailboxes): irrelevant, but good to know it exists

### ActiveSync / CardDAV / CalDAV
- **CalDAV:** Shipping in 0.12+ series — calendar sync to mobile/desktop clients
- **CardDAV:** Shipping in 0.12+ series — contacts sync
- **WebDAV:** File storage/collaboration
- **ActiveSync:** Not explicitly listed; mobile access via IMAP/JMAP is the intended path
- Note: Mailcow ships SOGo which has full ActiveSync via the EAS protocol — Stalwart does not

---

## 3. TECHNICAL ARCHITECTURE

**Single Binary Model**
Stalwart is a single compiled Rust binary. All services — SMTP, IMAP, JMAP, POP3, ManageSieve, HTTP admin API, spam engine, DKIM signer — run in a single process under a single systemd service (or Docker container). This is architecturally opposite to Mailcow's 15+ Docker containers.

**Storage Backends**
Stalwart abstracts storage entirely:

| Backend | Use Case | Notes |
|---|---|---|
| **RocksDB** | Default, embedded | Zero external deps; mail data, metadata, search index — all in one directory; best for small/medium single-node |
| SQLite | Dev/minimal | Not for production |
| PostgreSQL | Production HA | External service required; enables robust backup/HA |
| MySQL/MariaDB | Production HA | Same as Postgres |
| FoundationDB | Distributed/cluster | Multi-node scale |
| Redis | Caching/queues | Supplementary |
| S3/Azure Blob | Object storage | Email body storage offload |
| Elasticsearch | Full-text search | Optional supplement to built-in search |

**For GrizzlyMedicine:** RocksDB is the correct choice. Single directory, zero deps, ~100MB idle, backup by rsync/snapshot.

**Memory Model**
- Static binary loaded once; asynchronous Tokio runtime
- Caches (mailbox metadata, auth sessions, spam models) are in-memory and bounded
- RocksDB uses memory-mapped files — kernel manages page cache, scales with available RAM but functions fine at 512MB

**Port Requirements**

| Port | Protocol | Required? |
|---|---|---|
| 25 | SMTP (inbound MX delivery) | CRITICAL — must be open and unblocked by VPS |
| 465 | SMTPS (implicit TLS submission) | Yes |
| 587 | STARTTLS submission | Yes |
| 143 | IMAP (unencrypted) | Optional, usually disabled |
| 993 | IMAPS (TLS) | Yes |
| 4190 | ManageSieve | Optional |
| 443 | HTTPS (JMAP + admin UI) | Yes |
| 8080 | HTTP admin (if not on 443) | Optional, proxy to 443 recommended |

**Critical port note:** Many budget/shared VPS providers block port 25 to prevent spam. Hostinger's KVM/VPS tiers generally allow port 25, but this must be confirmed for KVM4 before deployment. This is not a Stalwart issue — it's universal for all self-hosted mail.

**Configuration Format**
TOML. Hierarchical key-value with dot notation, arrays, and macro/expression support. The setup wizard generates an initial config interactively. Settings are modifiable at runtime via the web admin UI (stored in the data backend, not necessarily the static TOML file after initial setup).

**Docker vs. Bare Metal**
Both supported. Docker image: `stalwartlabs/stalwart:latest`. Single container, single volume mount. Bare metal: one-liner install script (`curl https://get.stalw.art/install.sh | sh`) or binary download + systemd unit.

---

## 4. HARDWARE REQUIREMENTS

### Official Minimums (stalw.art/docs/install/requirements/)
- 1 CPU core
- 512MB RAM (functional minimum)
- 10GB disk

### Practical Real-World Numbers

| Scenario | RAM (Idle) | RAM (Active) | CPU |
|---|---|---|---|
| 5-mailbox lab, low traffic | ~100-120MB | ~250MB | <5% on 1 core |
| 10 users, moderate traffic | ~150MB | ~400MB | <10% on 1 core |
| 100 users, active | ~300MB | ~600MB | 1-2 cores |

These are community-verified numbers from GitHub Discussion #580 and deployment reports — not marketing claims.

### Comparison to Mailcow

| | Stalwart | Mailcow (full) | Mailcow (ClamAV disabled) |
|---|---|---|---|
| Idle RAM | **~100-200MB** | ~2-4GB | ~1.5-2GB |
| Minimum usable | **512MB** | 6GB official | 4GB with cuts |
| Container count | **1** | 14-16 | 12-14 |
| Docker overhead | Near-zero | Significant | Significant |

Mailcow's 6GB official minimum is real. Even with ClamAV disabled, it rarely runs below 1.5GB under any real load. This is a fundamental architectural difference, not configuration tuning.

### KVM4 Viability (187.124.28.147, Hostinger VPS)

Without knowing KVM4's exact RAM spec, the analysis is:
- If KVM4 has ≥2GB RAM: Stalwart runs with abundant headroom + room for other services
- If KVM4 has 1GB RAM: Stalwart + Snappymail webmail + Nginx reverse proxy will fit (~500-600MB total)
- If KVM4 has 4GB RAM: Trivially comfortable; could even run Stalwart + webmail + monitoring stack

**Stalwart will run on KVM4. Mailcow might not, depending on KVM4's RAM spec.**

### Proxmox LXC Option

If running on the Proxmox cluster (workshop 192.168.4.100 or loom 192.168.4.151):
- **Recommended CT spec:** 2 vCPU, 1GB RAM (512MB minimum), 20GB disk
- Use Debian 12 LXC template (unprivileged container works fine)
- Mount a dedicated ZFS dataset for `/opt/stalwart` to get snapshot-based backups for free
- Static IP + DNS configured at container creation

---

## 5. DEPLOYMENT

### Installation Methods

**Option A — One-line install script (recommended for bare metal/LXC):**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://get.stalw.art/install.sh | sh
```
Interactive wizard: sets hostname, admin credentials, storage backend, TLS. Generates systemd unit. Time: ~5 minutes.

**Option B — Docker:**
```bash
docker run -d --name stalwart \
  -p 25:25 -p 465:465 -p 587:587 \
  -p 993:993 -p 443:443 -p 8080:8080 \
  -v /opt/stalwart:/opt/stalwart \
  stalwartlabs/stalwart:latest
docker logs stalwart  # get initial admin credentials
```

**Option C — Package manager:** Available on OpenBSD ports, NixOS (nixpkgs), FreeBSD ports in progress. Not yet in mainstream apt/yum repos.

### DNS Setup

Stalwart **generates all required DNS records** and displays them in the web admin. You copy-paste into your registrar. It does **not** auto-provision DNS (would require registrar API integration) — manual DNS entry required.

Required DNS records:

```
# MX record
grizzlymedicine.icu.  MX 10 mail.grizzlymedicine.icu.

# A record
mail.grizzlymedicine.icu.  A  187.124.28.147

# SPF
grizzlymedicine.icu.  TXT "v=spf1 a:mail.grizzlymedicine.icu ~all"

# DKIM (Stalwart generates this key — shown in admin UI)
stalwart._domainkey.grizzlymedicine.icu.  TXT "v=DKIM1; k=rsa; p=<public_key>"

# DMARC
_dmarc.grizzlymedicine.icu.  TXT "v=DMARC1; p=none; rua=mailto:postmaster@grizzlymedicine.icu"

# PTR (set in Hostinger VPS control panel, not DNS registrar)
187.124.28.147 → mail.grizzlymedicine.icu
```

**PTR is critical.** Gmail and Microsoft reject mail from IPs without a matching PTR. Set this in Hostinger's VPS dashboard.

### SSL/TLS
Stalwart has built-in ACME/Let's Encrypt support. Configure your domain in the web admin → TLS section → ACME enabled → certificates auto-provisioned and renewed. Requires port 80 accessible for HTTP-01 challenge, or DNS-01 challenge if you have API access to your DNS registrar.

### Time from Zero to First Email
- Install: 5-10 minutes
- DNS propagation: 1-48 hours (plan for this)
- First email received: Same day if DNS propagates quickly
- Full hardening + DMARC enforcement: 2-4 weeks (warm IP, monitor DMARC reports, then move to `p=quarantine`)

### First-Run Complexity
Low by mail server standards. The interactive setup wizard handles 80% of configuration. The web admin handles the rest. Grizz does not need to read TOML for basic operation — the web UI is sufficient for user/domain management. TOML editing is only needed for advanced customization.

---

## 6. JMAP PROTOCOL

**What JMAP Is**
JSON Meta Application Protocol — an IETF standard (RFC 8620 for core, RFC 8621 for mail). Designed to replace IMAP with a modern, stateless, HTTP/JSON-based protocol. Key advantages over IMAP:
- Batch operations (fetch 50 messages in one HTTP request vs. multiple IMAP round-trips)
- Push notifications via WebSocket (no polling)
- Efficient delta sync (only get changes since last state)
- Native JSON — trivial to use from any HTTP library
- Designed for both client and programmatic access

**Why It Matters for GrizzlyMedicine**
JMAP is the AI agent integration path. Every agent (Natasha, MJ, Lucius, Tony, Bruce) can read, write, and manage email via standard HTTPS POST requests to `/jmap` with JSON payloads — no IMAP library, no weird encoding, no connection state management. A Python script using `requests` can interact with JMAP.

**Client Support (2025)**
JMAP client support is still catching up to IMAP, but production-ready options exist:

| Client | JMAP Support | Status |
|---|---|---|
| **Fastmail (web/mobile)** | Native | Production, years in use |
| **Thunderbird** | In development (Thundermail Pro) | Beta in 2025 |
| **Mailtemi** | JMAP-first | Production |
| **aerc** | JMAP support | Production |
| **Mimestream (macOS)** | No | IMAP only |
| **Apple Mail** | No | IMAP only |
| **Outlook** | No | IMAP/EAS only |

**Practical reality:** Most standard email clients still use IMAP. Thunderbird + IMAP works flawlessly with Stalwart today. JMAP is the programmatic API path — not the human webmail path.

**Is JMAP Production Ready?**
Yes — Fastmail has run JMAP at scale for years. Stalwart is the reference JMAP server implementation and is used by Thunderbird's commercial service. JMAP for Mail is production ready. JMAP for Calendars/Contacts is newer (shipping in Stalwart 0.12+) and less mature but functional.

---

## 7. REST/HTTP API

### Management API
Base path: `/api/`
Authentication: OAuth2 bearer token or HTTP Basic Auth
Authorization: Role-based with **400+ granular permission types**

**Documented Endpoint Groups:**

| Endpoint Prefix | Operations |
|---|---|
| `/api/management/user/*` | Create, read, update, delete mailboxes; set quotas, passwords, aliases |
| `/api/management/domain/*` | Add/remove domains, manage DKIM keys, domain settings |
| `/api/management/queue/*` | Inspect and manage outbound mail queue |
| `/api/management/report/*` | DMARC/TLS aggregate reports |
| `/api/telemetry/*` | Live metrics, historical system data |
| `/api/troubleshoot/*` | Diagnostics, MX lookup, deliverability checks |
| `/api/system/*` | Server config, restart, reload |

### JMAP API
Base path: `/jmap/`

| Endpoint | Purpose |
|---|---|
| `GET /jmap/session` | Auth, server capabilities, account list |
| `POST /jmap` | All mail operations (batch) |
| `GET /jmap/upload/{accountId}` | Upload blob (attachment) |
| `GET /jmap/download/{accountId}/{blobId}/{name}` | Download attachment |
| `GET /jmap/eventsource` | Server-Sent Events for push |

**What agents can do via JMAP:**

```python
# Example: Natasha reads unread mail via JMAP
import requests

session = requests.get('https://mail.grizzlymedicine.icu/jmap/session',
    auth=('natasha@grizzlymedicine.icu', 'password'))
account_id = session.json()['primaryAccounts']['urn:ietf:params:jmap:mail']

# Fetch unread emails
response = requests.post('https://mail.grizzlymedicine.icu/jmap', json={
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
        ["Email/query", {
            "accountId": account_id,
            "filter": {"inMailbox": "inbox_id", "notKeyword": "$seen"}
        }, "0"],
        ["Email/get", {"accountId": account_id, "#ids": {"resultOf": "0",
            "name": "Email/query", "path": "/ids"}}, "1"]
    ]
})
```

**Can Natasha/MJ programmatically read and send email via Stalwart?**
**Yes, absolutely.** This is one of Stalwart's primary advantages for this use case:
- Read mail: JMAP `Email/get` or IMAP via `imaplib`
- Send mail: SMTP with credential auth, or JMAP `EmailSubmission/set`
- Manage mailboxes: REST management API
- Set Sieve filters: JMAP for Sieve Scripts or ManageSieve
- Create new agent accounts: REST management API with admin credentials

This capability is native to the architecture, well-documented, and does not require any hacks or workarounds.

---

## 8. SECURITY

### Rust Memory Safety
Rust's ownership model eliminates entire classes of vulnerabilities at compile time: buffer overflows, use-after-free, null pointer dereferences, data races. This is not theoretical — the historical CVE record for C-based mail servers (Exim, Sendmail, even Postfix/Dovecot) shows recurring memory corruption vulns. Stalwart's attack surface in this dimension is structurally smaller.

### PGP Encryption at Rest — How It Actually Works
1. User or admin uploads user's **OpenPGP public key** (or S/MIME cert) to web portal
2. Stalwart intercepts inbound SMTP messages before writing to disk
3. Message body is encrypted with the user's public key (AES-256)
4. Encrypted blob stored in RocksDB
5. Only the user with their private key can decrypt

**What this protects:** A full disk compromise of the server (stolen drive, unauthorized data center access, VPS snapshot leak) does not expose mail content. The attacker gets ciphertext only.

**What this does NOT protect:** Messages in transit (standard TLS covers that), the mail before delivery (it's plaintext during SMTP handling), or metadata (subject lines, sender/recipient, timestamps are not encrypted by default).

**Operational implication for agents:** If agent accounts use PGP at rest, agents must decrypt messages client-side (or use JMAP without the at-rest encryption, treating storage encryption as a separate layer via disk encryption). For a lab running AI agents, the practical recommendation is to use full-disk encryption on the VPS instead, which is simpler and doesn't break server-side search and spam scanning.

### Known CVEs

| CVE | Severity | Description | Fixed In |
|---|---|---|---|
| CVE-2024-35187 | High | Privilege escalation via `RUN_AS_USER` — arbitrary file read if attacker has partial admin access | 0.8.0 |
| CVE-2024-35179 | High | Related privilege escalation — possible root access given prior code execution | 0.8.0 |

Both patched in 0.8.0. Any deployment on 0.15.x is protected. No CVEs found post-0.8.0 in current research (mid-2025).

**Context:** Two CVEs in ~3 years is a very clean record. Mailcow's component stack (Postfix, Dovecot, Rspamd, MariaDB, Redis) has a much longer CVE history across multiple packages that must each be tracked and updated.

### Attack Surface Comparison

| Vector | Stalwart | Mailcow |
|---|---|---|
| Language (memory safety) | Rust — inherently safer | C (Postfix, Dovecot), PHP (web components) |
| Running processes | 1 | 14-16 containers |
| Open source components to audit | 1 binary | Postfix + Dovecot + Rspamd + ClamAV + SOGo + MariaDB + Redis + Nginx + ... |
| CVE tracking surface | 1 project | 8+ projects |
| Remote code exec history | None current | Historical in components |

### Hardening Recommendations for GrizzlyMedicine
1. Run behind Nginx reverse proxy — don't expose admin UI directly on public IP
2. Restrict port 8080 to localhost; proxy to HTTPS on 443
3. Enable TOTP for the admin account
4. Disable unused listeners (POP3 unless needed, plain IMAP on 143)
5. Set `server.http.permissive-cors = false`
6. Use `fail2ban` on SSH; configure Stalwart's built-in rate limiting for SMTP/IMAP brute force
7. Set `PTR` record — both security hygiene and deliverability requirement
8. Keep Stalwart updated — single binary, single `systemctl stop stalwart && wget new_binary && systemctl start stalwart`

---

## 9. DELIVERABILITY

### Universal Requirements (same for all self-hosted mail)
Self-hosted email deliverability is not a Stalwart issue — it's a universal property of the IP, domain, and configuration:
1. **PTR record** — IP resolves to mail hostname (set in VPS provider panel)
2. **SPF** — authorizes the sending IP for the domain
3. **DKIM** — cryptographic signature on outbound mail
4. **DMARC** — policy enforcement and reporting
5. **Clean IP reputation** — new IP needs warming; blacklist check on first deploy
6. **Not on shared spam IP range** — Hostinger VPS IPs are generally clean; verify with `mxtoolbox.com/blacklists` before starting

### What Stalwart Does Better Than Mailcow for Deliverability
- **None, structurally.** Both implement SPF/DKIM/DMARC/ARC/MTA-STS/DANE correctly. Deliverability is IP and DNS configuration, not software.
- **Stalwart advantage:** DNS record generation in admin UI is clearer and guides you through exactly what to add. Less likely to misconfigure.
- **Stalwart advantage:** Single-binary update path means security patches ship faster — fewer moving parts to stay current on.

### What Stalwart Does Worse
- **No ClamAV integration** — Mailcow includes antivirus scanning. Stalwart does spam but not virus scanning. For a small lab, this is not significant.
- **Newer** — less community knowledge if you hit an edge-case deliverability issue (DKIM rotation edge case, DMARC reporting parsing bug, etc.)

### IP Warming for KVM4
KVM4 has a fresh or potentially repurposed Hostinger IP. Strategy:
- Week 1-2: Low volume (10-20 emails/day), send only to trusted addresses
- Week 3-4: Normal lab volume
- Monitor DMARC aggregate reports for rejection/quarantine signals
- Check: `mail-tester.com`, `mxtoolbox.com/deliverability`
- Do NOT bulk-send immediately; do NOT send to purchased lists ever
- For 5 agent mailboxes with legitimate transactional/notification email, full warm takes 2-3 weeks

---

## 10. MAINTENANCE BURDEN

### Single Binary Advantage
**This is the single largest operational advantage Stalwart has over Mailcow for GrizzlyMedicine.**

Mailcow maintenance:
```
docker-compose pull → stop → up -d → check 14 containers → verify each service
```
Potential issues: MariaDB migration, Redis config, Rspamd rule update, SOGo calendar breakage, ClamAV DB update failure, container networking issue...

Stalwart maintenance:
```bash
systemctl stop stalwart
wget https://get.stalw.art/stalwart -O /usr/local/bin/stalwart
chmod +x /usr/local/bin/stalwart
systemctl start stalwart
```
Done. No container orchestration, no service dependency chains, no migration scripts (until 1.0 schema changes). Updates are reviewed against the UPGRADING file in the repo — infrequent breaking changes clearly documented.

### Common Failure Modes
- **Port 25 blocked by VPS provider** — not Stalwart's fault; universal self-hosted mail problem
- **Certificate renewal failure** — ACME auto-renewal; monitor expiry, check logs
- **RocksDB corruption** — rare with Rust + clean shutdowns; why backups matter
- **Config changes between 0.x versions** — known risk pre-1.0; always read release notes before upgrading

### Backup Strategy

**RocksDB (default storage):**
```bash
# Option 1: Stop + rsync (simplest, requires brief downtime)
systemctl stop stalwart
rsync -a /opt/stalwart/ /backup/stalwart-$(date +%F)/
systemctl start stalwart

# Option 2: Stalwart CLI backup (online backup)
stalwart-cli database backup --destination /backup/stalwart/

# Option 3: Proxmox CT snapshot (if running in LXC)
pct snapshot <ctid> stalwart-$(date +%F)
```

Everything is in `/opt/stalwart/` — config, data, indexes. One directory, clean backup story.

**If using PostgreSQL backend:** Standard pg_dump schedule.

### Monitoring
- **Prometheus endpoint:** `/metrics/prometheus` — scraped by any Prometheus instance
- **Grafana:** Dashboard can be built from Prometheus metrics; community templates exist
- **Structured logs:** JSON logs to stdout/file; compatible with Loki/Elasticsearch
- **Built-in telemetry API:** `/api/telemetry/` for custom health checks
- **Alert recommendations:** Disk usage >80%, cert expiry <30 days, queue depth spike, auth failure rate spike

For GrizzlyMedicine: a lightweight `Uptime Kuma` instance on the Proxmox cluster pinging SMTP/IMAP availability is sufficient without a full observability stack.

---

## 11. WEBMAIL

**Confirmed: Stalwart has NO bundled webmail.**

The web admin UI is for server administration — it is not a user mail interface. The official roadmap mentions a built-in webmail after JMAP groupware features are finalized (post-1.0, late 2025/2026).

**For GrizzlyMedicine:** Whether webmail is needed depends on use case. If agents are accessing mail programmatically (JMAP/IMAP via code) and Grizz is using a desktop client (Thunderbird), webmail may be unnecessary entirely.

If webmail is wanted:

| Option | Setup Complexity | Resource Use | JMAP | Notes |
|---|---|---|---|---|
| **Snappymail** | Low (single container) | ~30-50MB | No (IMAP) | Clean UI, fast, lightweight. Recommended. |
| **Roundcube** | Medium | ~80-100MB | No (IMAP) | Mature, extensible, plugin ecosystem |
| **Rainloop** | Low | ~50MB | No | Unmaintained (forked as Snappymail) |
| **Cypht** | Medium | ~40MB | No | Privacy-focused, modular |
| **Bulwark** | Low | Minimal | Yes | JMAP-native webmail, newer |

**Recommended pairing:** Snappymail via Docker alongside Stalwart — 30 minutes to add, ~50MB RAM, connects via IMAP+SMTP. Proxied through Nginx on `mail.grizzlymedicine.icu`.

---

## 12. HONEST ASSESSMENT

### Real Strengths
1. **Resource efficiency is exceptional** — 100-200MB idle is not matched by any comparable full-stack solution
2. **JMAP for AI agents** — purpose-built programmatic email access, no library gymnastics required
3. **Single binary ops** — update, backup, monitor: trivially simple compared to multi-service stacks
4. **PGP at rest** — a genuine privacy feature not present in most competitors
5. **Security architecture** — Rust + minimal attack surface + clean CVE history
6. **Active development** — 12K stars, commercial backing, Thunderbird endorsement, NLnet grant funding
7. **Built-in anti-spam** — functional out of box with Bayes + DNSBL + LLM hook, no SpamAssassin/Rspamd setup required
8. **CalDAV/CardDAV shipped** — closing the groupware gap vs. Mailcow's SOGo

### Real Weaknesses
1. **Pre-1.0 (0.x) — schema migration risk.** Every major version upgrade requires reading the UPGRADING doc. Database schema can and does change. This is the biggest operational risk for production.
2. **Smaller ecosystem** — fewer community guides, fewer third-party integrations, fewer people to ask when things break compared to Mailcow/Postfix
3. **No bundled webmail** — extra component required; adds complexity even if manageable
4. **No ActiveSync/EAS** — if Grizz needs to sync phone calendar/contacts via ActiveSync (Outlook/iOS native protocol), Mailcow+SOGo handles this; Stalwart requires CalDAV-capable clients (iOS and Android both support CalDAV natively, so this is less critical than it sounds)
5. **AGPL license** — for internal lab use, completely irrelevant. AGPL matters if GrizzlyMedicine were to offer Stalwart as a hosted service to third parties; it does not affect self-hosting for your own use
6. **Monolithic debugging** — when something fails, you have one large log stream vs. multiple separated service logs. In practice, Stalwart's structured logging is excellent, but it's a different mental model from traditional Unix mail administration
7. **Smaller community knowledge base** — exotic edge cases (SPF-breaking CDN config, complex DKIM rotation, CalDAV client bugs) may require going directly to GitHub Issues vs. finding an existing StackOverflow thread

### Production Readiness for Small Lab (2025-2026)
**Acceptable with eyes open.** Stalwart is in active production at organizations including Privacy Guides' own infrastructure and backing Thunderbird Pro (commercial product). For 5-10 mailboxes with low to moderate volume, the failure risk is very low. The 0.x caveat means: keep automated backups, read release notes before every upgrade, and have a tested restore procedure. These are table-stakes for any self-hosted mail infrastructure regardless of software choice.

---

## 13. STALWART vs. MAILCOW — FULL COMPARISON

| Dimension | Stalwart | Mailcow | Edge |
|---|---|---|---|
| **Architecture** | Single Rust binary | 14-16 Docker containers | Stalwart |
| **RAM (idle)** | 100-200MB | 2-4GB | Stalwart |
| **RAM (minimum usable)** | 512MB | 4GB (degraded) / 6GB (full) | Stalwart |
| **CPU overhead** | Minimal | Moderate | Stalwart |
| **Language safety** | Rust | C + PHP + Python | Stalwart |
| **CVE surface** | 1 codebase | 8+ codebases | Stalwart |
| **SMTP** | Full | Full (Postfix) | Tie |
| **IMAP** | Full | Full (Dovecot) | Tie |
| **JMAP** | Full, reference impl | None | Stalwart |
| **POP3** | Yes | Yes | Tie |
| **ActiveSync/EAS** | No | Yes (SOGo) | Mailcow |
| **Webmail** | External required | SOGo included | Mailcow |
| **Calendar** | CalDAV (0.12+) | SOGo + ActiveSync | Mailcow |
| **Contacts** | CardDAV (0.12+) | SOGo + ActiveSync | Mailcow |
| **Anti-spam** | Built-in (Bayes + LLM + DNSBL) | Rspamd (mature, excellent) | Tie (different) |
| **Antivirus** | None | ClamAV | Mailcow |
| **DKIM/SPF/DMARC** | Native, admin-generated | Native + admin UI | Tie |
| **PGP at rest** | Yes, user-key model | No | Stalwart |
| **Let's Encrypt** | Built-in ACME | Built-in | Tie |
| **Web admin UI** | Yes, clean | Yes, mature | Tie |
| **Multi-domain** | Yes | Yes | Tie |
| **Aliases/catch-all** | Yes | Yes | Tie |
| **Quotas** | Yes | Yes | Tie |
| **Clustering/HA** | Yes (FoundationDB) | Limited (single-node) | Stalwart |
| **REST management API** | Yes (400+ permissions) | Yes (simpler) | Stalwart |
| **AI/programmatic access** | JMAP + REST API | IMAP + simpler API | Stalwart |
| **Update process** | Replace 1 binary | `docker-compose pull` + restart | Stalwart |
| **Backup** | 1 directory | Multiple DBs + volumes | Stalwart |
| **Monitoring** | Prometheus endpoint built-in | Requires custom setup | Stalwart |
| **Community size** | Growing (~12K GH stars) | Large, mature | Mailcow |
| **Documentation** | Good, improving | Excellent | Mailcow |
| **Production stability** | Pre-1.0 (0.x) | Battle-tested, stable | Mailcow |
| **License** | AGPL-3.0 | MIT | Tie (for self-use) |
| **VPS resource constraint** | Excellent fit | Poor fit (<4GB) | Stalwart |

### Which is Better for Each Criterion That Matters to GrizzlyMedicine

**Resource-constrained VPS (KVM4):** Stalwart, decisively. Mailcow may not run at all depending on KVM4's RAM.

**AI agent programmatic access:** Stalwart. JMAP is the only production HTTP/JSON email protocol that makes agent integration clean. IMAP works from agents too, but JMAP is superior for this use case.

**Security-first ops:** Stalwart. Single Rust binary, smaller CVE surface, PGP at rest, fewer moving parts to patch.

**Ease of maintenance:** Stalwart. One binary, one backup directory, one update step, built-in Prometheus. Mailcow requires Docker Compose orchestration and 15+ service monitoring.

**Full-featured groupware (calendar, contacts, mobile ActiveSync):** Mailcow. SOGo is mature and well-integrated. Stalwart's CalDAV/CardDAV is newer (functional but less battle-tested).

**Webmail out of the box:** Mailcow. No additional component needed.

**Absolute production stability:** Mailcow. Post-1.0, Stalwart likely closes this gap.

---

## 14. FINAL RECOMMENDATION

### Decision: **STALWART — Recommendation Validated**

The prior recommendation stands. For GrizzlyMedicine's specific requirements — 5 agent mailboxes, AI agent programmatic access, resource-constrained Hostinger VPS, security-first posture, minimal maintenance overhead — Stalwart is the correct choice. Mailcow is the wrong tool for this environment:

- **Mailcow's 4-6GB RAM requirement is potentially incompatible with KVM4**
- **JMAP for agent access is a genuine differentiator** — Stalwart is the only production self-hosted option
- **Single binary maintenance is appropriate for a research lab without dedicated ops staff**
- **AGPL is irrelevant for internal self-hosting**

### Deployment Target

**Primary: KVM4 (187.124.28.147) — public VPS, Hostinger**

Rationale: Email requires a publicly accessible IP for MX records and PTR configuration. The Proxmox cluster is on 192.168.4.x (private), which requires NAT/port-forwarding to receive external email — unnecessary complexity. KVM4 is the correct placement.

**Alternative: Proxmox LXC on `loom` (192.168.4.151)**
Only viable if KVM4 is too small for even Stalwart, or if you want Stalwart on a node with better HA/snapshot capabilities. Requires static IP, port-forwarding for 25/465/587/993/443 from a public IP.

**Recommended config for KVM4:**
- Stalwart: bare-metal install (systemd service), not Docker — simplest path, no container layer
- Snappymail: Docker container for webmail if browser access to mail needed
- Nginx: reverse proxy for HTTPS + web admin UI hardening
- Certbot or Stalwart ACME for TLS

### Estimated Effort

| Phase | Time |
|---|---|
| Install + initial config | 30 min |
| DNS entry + propagation wait | 1-48 hours |
| Add 5 agent mailboxes | 10 min |
| Configure Sieve filters for agent routing | 30 min |
| Add Snappymail webmail (optional) | 30 min |
| PTR record + deliverability verification | 30 min |
| DMARC monitoring + IP warm period | 2-3 weeks passive |
| **Total active effort** | **~2-3 hours** |

### Ongoing Maintenance Estimate
- Monthly: Check for Stalwart updates, review DMARC reports, verify certificate validity
- Actual time: 15-20 minutes/month
- Upgrade when new release: 10 minutes per update

### Risk Mitigation for Pre-1.0 Status
- Automated daily backup of `/opt/stalwart/` to a second location (Proxmox cluster NFS or S3)
- Read UPGRADING file in git before every major version bump
- Test in LXC on Proxmox before upgrading production KVM4 instance
- Pin to tested version (don't auto-update to latest without review)

### Bottom Line

Stalwart is the right call. It is resource-efficient enough to run on any Hostinger VPS Grizz has, exposes JMAP for clean agent integration without third-party libraries, requires less ongoing maintenance than any multi-service alternative, and has a strong security architecture backed by Rust memory safety and minimal attack surface. The pre-1.0 status requires a disciplined backup and update practice, but this is a lab infrastructure standard that should exist regardless. The recommendation is not overturned — it is confirmed.

---

*Report compiled from: stalw.art official documentation, GitHub stalwartlabs/stalwart issues and discussions, Privacy Guides self-hosting recommendations, Thunderbird Pro public announcements, LowEndTalk community threads, DEV Community deployment reports, CVE databases, and independent comparison analysis from techsaas.cloud, marchughes.ie, selfhosting.sh.*
