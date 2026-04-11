# Mailcow: Technical & Operational Assessment
### GrizzlyMedicine Lab — grizzlymedicine.icu Email Infrastructure
**Prepared by:** Natalia Romanova | **Date:** 2025 | **Classification:** Internal Technical Brief

---

## Executive Summary

Mailcow (mailcow-dockerized) is the most feature-complete, battle-tested self-hosted email stack available today. It is a full groupware suite — not just an SMTP relay — running ~15 Docker containers covering every layer from spam filtering to calendaring. For **5 agent mailboxes** (natasha@, mj@, lucius@, tony@, bruce@ on grizzlymedicine.icu), it is **architecturally overkill but operationally viable** on KVM4 *if* 8 GB RAM is confirmed. The primary risk is not capability — it is the **RAM ceiling on a 4 GB host** and the **IP reputation burn-in** period on a fresh Hostinger VPS IP. Stalwart is the leaner alternative with a materially lower resource floor. Recommendation: **conditional deploy** on KVM4 with resource profiling first, or run on a dedicated Proxmox LXC/KVM with guaranteed 8 GB.

---

## 1. Product Overview

**What it is:** mailcow-dockerized is an open-source, Docker Compose–orchestrated mail server suite maintained by **The Infrastructure Company GmbH** (trading as **Servercow**, Germany). It bundles Postfix, Dovecot, Rspamd, SOGo, nginx, MariaDB, Redis, ClamAV, and a dozen supporting services into a unified deployment. A single `docker-compose pull && ./update.sh` keeps all components in sync.

**License:** GPLv2. Commercial support and "Stay Awesome Licenses" sold through Servercow to fund development.

**Project Health (as of late 2025):**
- GitHub: ~12,700 stars, ~1,676 forks
- 82 active contributors in last quarter; ~3 core contributors drive >50% of commits
- Monthly stable releases (format: `YYYY-MM`), plus hotfix revisions (`2025-03a`, etc.)
- Active Telegram, Mastodon (@doncow@mailcow.social), GitHub Discussions, and community forums
- Latest stable: `2025-12a` (December 2025)

**Reputation:** Considered the **gold standard** of self-hosted email in the homelab and SMB community. Used by thousands of production installations. The documentation at `docs.mailcow.email` is thorough, actively maintained, and covers every operational scenario. Community forums are responsive. Servercow provides paid support for critical deployments. Frequently referenced on r/selfhosted, HN, and privacy forums as the first recommendation for full-featured self-hosted mail.

---

## 2. Feature Set

### 2.1 Mail Protocols
| Protocol | Support | Notes |
|----------|---------|-------|
| SMTP (inbound) | ✅ | Postfix, port 25 with postscreen |
| SMTP submission | ✅ | Ports 465 (SMTPS), 587 (STARTTLS) |
| IMAP | ✅ | Dovecot, ports 143/993 |
| POP3 | ✅ | Dovecot, ports 110/995 (disableable) |
| ManageSieve | ✅ | Port 4190 — server-side filter management |

### 2.2 Webmail — SOGo
SOGo is a full groupware client, not a lightweight webmail wrapper.
- **Mail:** Compose, folders, search, tagging, labels
- **Calendar:** CalDAV, invitations, shared calendars, recurring events
- **Contacts:** CardDAV, address book sharing
- **Tasks:** To-do lists tied to calendars
- **ActiveSync (EAS):** Enabled by default via SogoActiveSyncPort; push email, contacts, calendar to iOS/Android natively
- **Known limitation:** SOGo's UI is dated (Angular 1.x era). Functional but not modern. Users who want a Roundcube-style minimal UI can replace it; Mailcow provides a Roundcube integration guide.

### 2.3 Admin UI
The `mailcow-dockerized` admin panel (PHP/nginx) provides:
- Domain management (add, delete, configure per-domain settings)
- Mailbox creation with quota, password, display name
- Alias management (per-address and domain-wide catch-all)
- Forwarding rules with copy retention options
- DKIM key generation and rotation per domain
- Transport maps (route domain's mail through external relay)
- Rspamd Web UI access (full spam filter dashboard)
- Fail2ban / netfilter integration view
- Two-factor authentication management
- Resource usage graphs (optional via watchdog)
- API key management (read-only and read-write keys per admin)

### 2.4 Anti-Spam — Rspamd
Rspamd is the most capable OSS spam filter available. Mailcow's integration:
- **Greylisting** (configurable, enabled by default)
- **DKIM, SPF, DMARC, ARC** verification on inbound
- **DKIM signing** on outbound (per-domain key, auto-generated)
- **Bayes filtering** — learns from spam/ham corpus via admin-triggered training
- **RBL/DNSBL checks** (Spamhaus, etc.) via Unbound resolver
- **Neural network scoring** (rspamd_neural plugin)
- **Fuzzy hashing** — catches known spam variants
- **UI:** Full Rspamd Web UI at `/rspamd` — score breakdowns, history, training controls
- **Effectiveness:** Excellent for known spam patterns; requires corpus training for domain-specific patterns. Cold start will miss some spam until Bayes is trained (~200+ samples each direction recommended).

### 2.5 Anti-Virus — ClamAV
- Scans inbound SMTP stream before acceptance
- **Olefy** container handles OLE/macro detection in Office documents (Word, Excel, etc.)
- ClamAV updates signatures automatically via `freshclam`
- **Cost:** ~400–700 MB RAM **at idle**. The single largest RAM consumer in the stack
- **Configurable:** Can be fully disabled in `mailcow.conf` (`SKIP_CLAMD=y`) to reclaim RAM on memory-constrained hosts. If disabled, no virus scanning. For agent mailboxes receiving external email, this is a genuine security trade-off.

### 2.6 Two-Factor Authentication
- TOTP (Google Authenticator, Authy-compatible) supported for both admin and mailbox users
- U2F (WebAuthn) supported
- Enforced per-mailbox or globally

### 2.7 DKIM/SPF/DMARC Automation
- DKIM: Admin UI generates RSA-2048 (or larger) keypair per domain with one click. Provides the exact DNS TXT record to copy-paste.
- SPF: Not auto-generated (it's a DNS record you write once); UI shows status
- DMARC: Not auto-generated; UI shows alignment status for inbound messages
- ARC (Authenticated Received Chain): Validated and applied by Rspamd — important for forwarded mail deliverability
- DANE/MTA-STS: Manual configuration; documented

### 2.8 Aliases, Catch-Alls, Forwarding
- **Per-address aliases:** `anything@domain.tld → real@domain.tld`, unlimited
- **Domain catch-all:** Any address not matching a mailbox routes to a designated inbox
- **Forwarding:** Per-mailbox, with optional local copy retention
- **Shared mailboxes / ACLs:** Dovecot ACL system accessible from admin UI (grant other mailbox users read/write/delete on specific folders)
- **Sieve filters:** ManageSieve on port 4190; SOGo provides a GUI sieve editor; also scriptable directly

### 2.9 Multi-Domain Support
Full — unlimited domains per installation. Each domain gets independent DKIM key, spam settings, user list. Particularly useful if grizzlymedicine.icu and grizzlymedicine.org both need mailboxes from one installation.

### 2.10 API
Full REST API. See Section 7.

---

## 3. Technical Architecture

### 3.1 Docker Compose Service Inventory

| Container | Role | Base Image |
|-----------|------|------------|
| `postfix-mailcow` | MTA — inbound/outbound SMTP | Debian + Postfix |
| `dovecot-mailcow` | IMAP/POP3/LMTP delivery | Debian + Dovecot |
| `rspamd-mailcow` | Spam/AV filter, DKIM signer | Debian + Rspamd |
| `clamd-mailcow` | Antivirus daemon | Debian + ClamAV |
| `olefy-mailcow` | OLE/macro scanner | Alpine + Oletools |
| `sogo-mailcow` | Webmail + ActiveSync + CalDAV/CardDAV | Debian + SOGo |
| `nginx-mailcow` | Reverse proxy, SSL termination, admin UI | Alpine + nginx |
| `php-fpm-mailcow` | Admin panel backend | Alpine + PHP-FPM |
| `mariadb-mailcow` | Primary relational database | MariaDB official |
| `redis-mailcow` | Caching, Rspamd storage, sessions | Redis official |
| `memcached-mailcow` | SOGo session caching | Memcached official |
| `unbound-mailcow` | Internal DNSSEC-validating resolver | Unbound |
| `acme-mailcow` | Let's Encrypt cert automation | Custom |
| `netfilter-mailcow` | Fail2ban-style IP blocking | Custom Python |
| `watchdog-mailcow` | Health monitoring, alerting, auto-restart | Custom |
| `ofelia-mailcow` | Cron scheduler (internal tasks) | Ofelia |
| `dockerapi-mailcow` | Docker API bridge for admin operations | Custom |
| `solr-mailcow` | Full-text search index (optional, heavy) | Solr (disabled by default) |

**Network:** All containers share a custom Docker bridge network (`mailcow-network`) with static internal IPv4/IPv6 addresses. External port bindings handled by nginx and direct Postfix/Dovecot port maps.

### 3.2 Port Requirements

| Port | Protocol | Service | Direction |
|------|----------|---------|-----------|
| 25 | TCP | SMTP (MX inbound) | Inbound from internet |
| 80 | TCP | HTTP (ACME/redirect) | Inbound |
| 110 | TCP | POP3 (cleartext) | Inbound (disableable) |
| 143 | TCP | IMAP STARTTLS | Inbound |
| 443 | TCP | HTTPS (admin, webmail, API) | Inbound |
| 465 | TCP | SMTPS (implicit TLS) | Inbound |
| 587 | TCP | SMTP submission (STARTTLS) | Inbound |
| 993 | TCP | IMAPS | Inbound |
| 995 | TCP | POP3S | Inbound |
| 4190 | TCP | ManageSieve | Inbound |

**Hostinger KVM4 note:** Port 25 is the critical one. Many VPS providers block port 25 outbound on new accounts to prevent spam abuse. Verify Hostinger KVM4 allows **outbound TCP/25** before committing to this host. If blocked, outbound must relay through SES/Mailgun/Sendgrid (adds complexity and cost but actually improves deliverability on fresh IPs).

### 3.3 Mail Flow

```
INBOUND:
[Internet] → Postfix/postscreen (port 25)
           → Rspamd (spam scoring, DKIM/SPF/DMARC/ARC check)
           → ClamAV/Olefy (virus scan)
           → Postfix (accept/reject/quarantine)
           → Dovecot LMTP (mailbox delivery)
           → User Mailbox (vmail volume)

OUTBOUND/SUBMISSION:
[Client/Agent] → Postfix (port 587/465, SASL auth via Dovecot)
              → Rspamd (outbound spam check, DKIM signing)
              → [Internet MX servers]

USER ACCESS:
[Browser/Client] → nginx (443) → SOGo → Dovecot IMAP
[Mail client]    → Dovecot (143/993/110/995)
[Mobile EAS]     → SOGo ActiveSync (443)
[Sieve client]   → Dovecot ManageSieve (4190)
```

### 3.4 Database Schema (MariaDB)
MariaDB stores all configuration — not mail content (that lives in Dovecot's vmail volume):
- `mailbox` — mailbox accounts, quotas, passwords (bcrypt), attributes
- `alias` — address aliases, catch-alls, forwarding targets
- `domain` — domain entries with per-domain settings
- `dkim` — DKIM private keys per domain (stored in DB, auto-served to Rspamd)
- `sender_acl` — permitted sending addresses per user
- `tfa` — 2FA secrets
- `logs` — authentication and system event logs
- `api_keys` — REST API credentials

Mail content (IMAP folders, message bodies) lives entirely in the **vmail Docker volume** under Dovecot's directory structure (Maildir format). Database = configuration. vmail volume = data.

### 3.5 Redis Usage
Redis serves multiple functions:
- **Rspamd:** Bayes token storage, fuzzy hash cache, rate-limiting counters, greylisting state
- **SOGo:** Session/cache data via Memcached (separate container) and indirectly through Redis for some operations
- **Postfix:** Rate-limit data, BCC maps
- **Quota notifications:** Dovecot → Redis → Postfix quota enforcement
- Idle footprint: 30–60 MB. Grows slowly with spam corpus volume.

### 3.6 Memory Footprint by Service (Idle, Small Deployment)

| Service | Idle RAM | Notes |
|---------|----------|-------|
| ClamAV | 400–700 MB | Largest consumer; signature DB loads to memory |
| Rspamd | 250–600 MB | Grows to 1 GB+ with active traffic and Bayes corpus |
| MariaDB | 120–250 MB | Scales with DB size |
| SOGo | 150–300 MB | Scales with active user sessions |
| Postfix | 20–50 MB | Very lean |
| Dovecot | 40–120 MB | Scales with IMAP connections |
| nginx | 20–40 MB | Static |
| Redis | 30–60 MB | Scales with corpus |
| Unbound | 20–40 MB | Static |
| Supporting (watchdog, ofelia, acme, etc.) | ~100 MB total | Minimal |
| **Total Idle (all services)** | **~1.5–2.5 GB** | ClamAV+Rspamd disabled: ~600–900 MB |

**Practical RAM budget on an 8 GB host:**
- 2.5 GB Mailcow idle
- 1.5 GB OS + Docker overhead
- ~4 GB headroom for traffic bursts, Bayes corpus growth, and Solr (if enabled)
- Comfortable on 8 GB. **Tight on 4 GB — do not deploy full stack on 4 GB.**

---

## 4. Hardware Requirements

### 4.1 Official Minimums (docs.mailcow.email)
- **CPU:** 1 GHz (1 core minimum, 2+ recommended)
- **RAM:** 6 GB + 1 GB swap (absolute minimum for full stack)
- **Disk:** 20 GB (software only) + storage for mail
- **Architecture:** x86_64 or ARM64

### 4.2 Practical Minimums for Production
| Config | RAM | CPU | Disk |
|--------|-----|-----|------|
| Minimum (ClamAV disabled) | 4 GB | 2 cores | 40 GB SSD |
| Minimum (full stack) | 6 GB | 2 cores | 50 GB SSD |
| **Recommended (5-10 mailboxes)** | **8 GB** | **4 cores** | **80 GB SSD** |
| Comfortable (growing lab) | 12 GB | 4 cores | 100 GB+ SSD |

### 4.3 KVM4 Assessment (187.124.28.147, Hostinger, 4–8 GB RAM)

**If 8 GB:** ✅ Deploy is viable. Run full stack including ClamAV. Configure 2 GB swap. Monitor RAM weekly for first month.

**If 4 GB:** ⚠️ Borderline. **Must** disable ClamAV (`SKIP_CLAMD=y`) and Solr (`SKIP_SOLR=y`). Rspamd may push system to OOM under mail bursts. Not recommended for unmonitored production. Add 4 GB swap on disk as emergency buffer.

**Port 25:** Verify with Hostinger support that outbound TCP/25 is not blocked. This is a hard blocker for direct-delivery outbound email. Many budget VPS providers block it on new accounts.

**IP Reputation:** A fresh Hostinger IP is an unknown entity. Run `https://mxtoolbox.com/blacklists.aspx` on 187.124.28.147 before deploying. Hostinger's VPS IP blocks have had mixed reputation reports in community forums.

**PTR Record:** Hostinger allows custom PTR records in their VPS control panel. Set to `mail.grizzlymedicine.icu` before deploying — missing PTR is an instant spam-filter flag.

### 4.4 Disk Growth
- **Maildir storage:** Entirely depends on email volume and retention policy
- **5 active agent mailboxes, moderate volume:** Plan for 1–5 GB/year in mail data (agents sending/receiving operational emails, not storing large attachments)
- **Rspamd Bayes corpus:** Grows over time; can be pruned
- **ClamAV signatures:** ~300 MB + daily delta updates (small)
- **MariaDB:** Stays small for 5–10 users (<500 MB for years)
- **Logs:** Rotate aggressively; can easily consume 10+ GB if unmanaged
- **Practical planning:** Start with 80 GB SSD. Alarm at 70% utilization.

---

## 5. Deployment

### 5.1 Installation Process

**Prerequisites:** Debian 11/12 or Ubuntu 22.04+, Docker CE, Docker Compose v2, git, curl. Clean server, no existing web/mail services on required ports.

**Steps:**
```bash
# 1. Clone the repository
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized

# 2. Generate mailcow.conf (interactive — asks for FQDN, timezone)
./generate_config.sh

# 3. Edit mailcow.conf — set SKIP_CLAMD, SKIP_SOLR if RAM-constrained

# 4. Pull images and start
docker compose pull
docker compose up -d

# 5. First-run: admin UI at https://mail.grizzlymedicine.icu
#    Default credentials: admin / moohoo (change immediately)
```

**Time to first login:** 30–60 minutes on a fast connection (image pulls are large). Service stabilization takes a few minutes after startup.

**Complexity:** Low for a sysadmin comfortable with Docker. Medium for a non-technical operator. **Grizz cannot do this unassisted** — agent (Lucius or Natasha via CLI session) should execute the deployment. The install is genuinely ~6 commands plus DNS configuration. The complexity is in DNS propagation and deliverability tuning, not the install itself.

### 5.2 DNS Requirements

**Pre-deployment (before starting Mailcow):**
```
# A Record
mail.grizzlymedicine.icu.    A    187.124.28.147

# MX Record
grizzlymedicine.icu.    MX   10   mail.grizzlymedicine.icu.

# PTR Record (set at Hostinger control panel)
187.124.28.147 → mail.grizzlymedicine.icu

# SPF Record (TXT on grizzlymedicine.icu)
"v=spf1 mx a:mail.grizzlymedicine.icu -all"

# DMARC Record (TXT on _dmarc.grizzlymedicine.icu)
"v=DMARC1; p=quarantine; rua=mailto:postmaster@grizzlymedicine.icu; ruf=mailto:postmaster@grizzlymedicine.icu; adkim=s; aspf=s"
```

**Post-deployment (generated by Mailcow admin UI):**
```
# DKIM Record (TXT on dkim._domainkey.grizzlymedicine.icu)
"v=DKIM1; k=rsa; p=<2048-bit public key from Mailcow UI>"
```

**Optional but recommended:**
```
# MTA-STS Policy (requires _mta-sts subdomain + HTTPS hosting)
_mta-sts.grizzlymedicine.icu.  TXT  "v=STSv1; id=<timestamp>"

# TLS-RPT
_smtp._tls.grizzlymedicine.icu.  TXT  "v=TLSRPTv1; rua=mailto:postmaster@grizzlymedicine.icu"

# BIMI (optional brand indicator)
default._bimi.grizzlymedicine.icu.  TXT  "v=BIMI1; l=<logo URL>; a=<VMC URL>"
```

### 5.3 SSL/TLS — Certificate Automation
`acme-mailcow` container handles Let's Encrypt automatically:
- Requests cert for `mail.grizzlymedicine.icu` on first startup (requires port 80/443 accessible)
- Auto-renews before expiry (60-day LE certs, renewed at ~30 days)
- Supports wildcard certs via DNS-01 challenge (requires DNS API integration — optional)
- Zero operator action required after initial setup
- Brings its own nginx configuration — do not run a separate nginx/Caddy on the same host unless you configure SNI pass-through carefully

### 5.4 Update Process
```bash
cd /opt/mailcow-dockerized
./update.sh
```
- Pulls latest images, applies config migrations, restarts services
- Time: ~10–15 minutes depending on connection speed
- Downtime: Brief (seconds to minutes) per service restart
- **Read release notes before every update** — breaking changes occur (March 2025 update changed authentication system)
- Rollback: Git allows reverting `mailcow.conf` changes; Docker images are versioned. Not fully automated but documented.

---

## 6. Deliverability

### 6.1 What Affects Fresh-IP Deliverability

Self-hosted email on a fresh VPS IP starts at a reputation deficit. Major inbox providers (Gmail, Microsoft 365, Yahoo) apply strict heuristics to new senders:

| Factor | Status on Fresh Deploy | Action Required |
|--------|----------------------|-----------------|
| PTR record | ❌ Not set | Set at Hostinger panel |
| SPF | ❌ Not set | Add DNS TXT |
| DKIM | ❌ Not configured | Generate in Mailcow UI |
| DMARC | ❌ Not set | Add DNS TXT |
| IP age/reputation | ❌ Unknown | Time + warming |
| IP blocklist status | Unknown | Check before deploy |
| Port 25 open | Unknown | Verify with Hostinger |
| Reverse DNS match | ❌ | Set PTR = mail.grizzlymedicine.icu |

### 6.2 IP Warming
For **5 agent mailboxes** sending operational/research emails (not bulk):
- Warming is minimal compared to bulk email scenarios
- Week 1–2: Send only to known-good addresses (your own Gmail, test accounts). Keep daily volume under 50 emails/day total across all accounts.
- Week 3–4: Normal operational use. Monitor spam folder placement.
- **Google Postmaster Tools:** Register grizzlymedicine.icu domain — free dashboard showing IP reputation, domain reputation, spam rate, DMARC compliance from Gmail's perspective. Invaluable.
- **Full warming** for agent-scale traffic (~20–50 emails/day): 2–4 weeks to reach reliable inbox placement.

### 6.3 Common Blocklist Issues
- **Spamhaus XBL/SBL/PBL:** Most common. PBL is for ISP-assigned ranges not designated for direct mail. Many VPS IPs are on PBL by default. Removal is free via Spamhaus portal — do it immediately after PTR is set.
- **SORBS:** Older blocklist, less impactful but request removal anyway.
- **Microsoft SNDS (Smart Network Data Services):** Register at sendersupport.olc.protection.outlook.com for visibility into your IP's standing with Microsoft.
- **Barracuda:** Used by many corporate email gateways. Request delisting at barracuda.com if needed.
- **Hostinger-specific:** Research reports mixed reputation for Hostinger's /24 blocks. If the specific /24 that includes 187.124.28.147 has bad neighbors, deliverability to Microsoft may be impaired regardless of your own record. Consider requesting a different IP from Hostinger if initial MX test results are poor.

### 6.4 What Mailcow Does vs. What Requires Manual Action

**Mailcow handles automatically:**
- DKIM signing on all outbound mail
- SPF/DKIM/DMARC verification on inbound
- TLS negotiation (MTA-to-MTA)
- Spam scoring and classification
- ARC sealing
- Let's Encrypt cert lifecycle

**You must handle manually:**
- DNS record creation (SPF, DKIM TXT, DMARC, MX, PTR)
- Blocklist removal requests
- Google Postmaster Tools registration
- Microsoft SNDS registration
- DMARC report monitoring (consider a free service like dmarcian.com or parsedmarc self-hosted)
- Port 25 unblocking with Hostinger
- IP warming discipline

---

## 7. API

### 7.1 Authentication
- **API Keys:** Generated in admin UI → Configuration → Access → Edit admin → API
- **Types:** Read-only (`ro`) and Read-write (`rw`)
- **IP Whitelist:** Keys are tied to allowed source IPs; API calls from non-whitelisted IPs are rejected
- **Header:** All requests: `X-API-Key: <your-key>` in HTTP header
- **No OAuth/JWT** — simple API key model. Keys do not expire unless regenerated.

### 7.2 Endpoint Structure
```
https://mail.grizzlymedicine.icu/api/v1/{action}/{resource}/{identifier}
```
- **GET** → retrieve
- **POST** → create or update
- **DELETE** → remove

### 7.3 Key Endpoints (Agent-Relevant)

**Mailbox Management:**
```
GET    /api/v1/get/mailbox/all                    # List all mailboxes
GET    /api/v1/get/mailbox/{email}                # Get specific mailbox
POST   /api/v1/add/mailbox                        # Create mailbox (JSON body)
POST   /api/v1/edit/mailbox                       # Update mailbox (quota, password, etc.)
DELETE /api/v1/delete/mailbox                     # Delete mailbox(es)
POST   /api/v1/edit/mailbox-spam-score            # Per-mailbox spam threshold
POST   /api/v1/edit/mailbox-acl                   # Folder sharing permissions
```

**Alias Management:**
```
GET    /api/v1/get/alias/all                      # List all aliases
POST   /api/v1/add/alias                          # Create alias (JSON: address, goto)
POST   /api/v1/edit/alias                         # Modify alias
DELETE /api/v1/delete/alias                       # Delete alias(es)
```

**Domain Management:**
```
GET    /api/v1/get/domain/all                     # List domains
POST   /api/v1/add/domain                         # Add domain
POST   /api/v1/edit/domain                        # Edit domain settings
DELETE /api/v1/delete/domain                      # Remove domain
POST   /api/v1/add/dkim                           # Generate DKIM key for domain
GET    /api/v1/get/dkim/{domain}                  # Get DKIM public key
```

**Transport & Routing:**
```
POST   /api/v1/add/transport                      # Add transport map
GET    /api/v1/get/transports/all                 # List transports
```

**Live browsable Swagger/OpenAPI docs:** `https://mail.grizzlymedicine.icu/api` (after deployment) and at `https://demo.mailcow.email/api`.

**Full API blueprint:** `https://mailcow.docs.apiary.io/`

### 7.4 Agent Email via SMTP

Yes — agents (Natasha, MJ, Lucius, Tony, Bruce) can send and receive email via standard SMTP/IMAP credentials:

```python
# Outbound SMTP (authenticated submission)
import smtplib, ssl
context = ssl.create_default_context()
with smtplib.SMTP_SSL("mail.grizzlymedicine.icu", 465, context=context) as s:
    s.login("natasha@grizzlymedicine.icu", "password")
    s.sendmail("natasha@grizzlymedicine.icu", "grizz@grizzlymedicine.org", msg)

# Or via port 587 with STARTTLS
with smtplib.SMTP("mail.grizzlymedicine.icu", 587) as s:
    s.starttls(context=context)
    s.login("natasha@grizzlymedicine.icu", "password")
    s.sendmail(...)
```

```python
# Inbound IMAP (read received email)
import imaplib
mail = imaplib.IMAP4_SSL("mail.grizzlymedicine.icu", 993)
mail.login("natasha@grizzlymedicine.icu", "password")
mail.select("INBOX")
status, data = mail.search(None, "UNSEEN")
```

Agents can also manage their accounts (change password, set quota, create sub-aliases) via the REST API using their own credentials if granted API access, or through shared admin key.

### 7.5 Programmatic Mailbox Provisioning
Natasha could provision all 5 agent mailboxes via a single script:
```bash
curl -X POST https://mail.grizzlymedicine.icu/api/v1/add/mailbox \
  -H "X-API-Key: <rw-key>" \
  -H "Content-Type: application/json" \
  -d '{"local_part":"natasha","domain":"grizzlymedicine.icu","password":"<strong-pw>","password2":"<strong-pw>","quota":"2048","active":1}'
```
Repeat for each agent. Entire provisioning: ~2 minutes scripted.

---

## 8. Security

### 8.1 Attack Surface

With all ports open, the public attack surface includes:
| Port | Risk | Mitigation |
|------|------|-----------|
| 25 (SMTP) | Dictionary attacks, relay abuse | postscreen, Rspamd rate-limits, netfilter-mailcow |
| 80 (HTTP) | Redirect only; minimal surface | ACME use only |
| 443 (HTTPS) | Admin UI, webmail, API | 2FA enforcement, API key IP whitelist |
| 587/465 (submission) | Brute-force credential attacks | Fail2ban via netfilter-mailcow, rate-limiting |
| 993/995 (IMAP/POP3S) | Credential stuffing | Fail2ban, strong password policy |
| 4190 (ManageSieve) | Low-risk (requires prior auth) | Minimal |

### 8.2 Fail2ban Integration (netfilter-mailcow)
Mailcow replaces traditional fail2ban with its own `netfilter-mailcow` container:
- Watches Postfix, Dovecot, SOGo, nginx logs for failed authentication patterns
- Bans offending IPs via nftables (or iptables on older kernels)
- Configurable ban time, ban threshold, whitelist in admin UI
- **Default:** Ban after 10 failures, 30-minute ban, 24-hour escalation for repeat offenders
- Tighten thresholds for a lab environment: 5 failures → immediate 24h ban is reasonable

### 8.3 Known CVEs (Recent)

| CVE | Type | Severity | Fixed In | Notes |
|-----|------|----------|----------|-------|
| CVE-2024-31204 | XSS (admin panel exception rendering) | Medium | 2024-04 | Requires attacker to trigger exception with controlled input |
| CVE-2024-30270 | Path traversal / file overwrite (RCE potential) | Medium-High | 2024-04 | Requires authenticated admin; can overwrite files as www-data |
| CVE-2025-25198 | Host header poisoning (account takeover path) | High | 2025-01a | Remote user interaction required |
| CVE-2025-53909 | SSTI in notification templates | Critical | 2025-07 | Admin misconfiguration-triggered; server-side template injection |

**Assessment:** All fixed in current releases. This confirms a pattern: Mailcow has an active vulnerability surface due to its large PHP codebase and many admin features. Running an outdated version is dangerous. **Monthly updates are not optional — they are a security requirement.**

### 8.4 Hardening Recommendations for GrizzlyMedicine

1. **Restrict admin UI to trusted IPs:** Nginx allow/deny block for `/admin/` — only permit your known IPs
2. **API key IP whitelist:** Lock API keys to the specific IP(s) agents run from
3. **2FA on all admin accounts** (TOTP minimum)
4. **Disable POP3** (`POP_PORT=0` / `POPS_PORT=0`) — agents use IMAP; POP3 adds attack surface for no benefit
5. **Disable Solr** (not needed for 5 mailboxes, saves RAM)
6. **Change default admin password** immediately on first login (default is `moohoo`)
7. **Enable DMARC `p=reject`** after confirming all legitimate senders are aligned (start with `p=quarantine`)
8. **Firewall at host level:** Only the ports listed in Section 3.2 should be open; block everything else at the Hostinger firewall/security group layer
9. **IPv6:** If no proper IPv6 PTR is configured, set `SNAT6_TO_SOURCE=false` and `ENABLE_IPV6=n` to avoid deliverability and security issues on IPv6 interfaces
10. **Subscribe to mailcow security announcements** via GitHub releases or Mastodon — CVEs require same-day patching

---

## 9. Maintenance Burden

### 9.1 Routine Maintenance

| Task | Frequency | Effort |
|------|-----------|--------|
| Apply stable updates | Monthly | 5–15 min (one command + read release notes) |
| Review blocklist status | Monthly | 5 min (mxtoolbox, Spamhaus lookup) |
| Review DMARC reports | Weekly (initially), Monthly (steady state) | 10–15 min |
| Check disk usage | Monthly | 2 min |
| Prune old logs | Monthly | 2 min (or automated) |
| Backup verification | Monthly | Test restore from backup |
| ClamAV signature updates | Automatic | Zero effort |
| Let's Encrypt renewal | Automatic | Zero effort |

**Total: ~30–60 minutes/month** in steady state after initial setup.

### 9.2 Backup Strategy

**Official tool:** `./helper-scripts/backup_and_restore.sh`

```bash
# Full backup (run as root or docker user)
./helper-scripts/backup_and_restore.sh backup all

# Automate via cron (daily at 2am, retain 30 days)
0 2 * * * /opt/mailcow-dockerized/helper-scripts/backup_and_restore.sh backup all
                                --delete-days 30 >> /var/log/mailcow-backup.log 2>&1
```

**What gets backed up:**
- `vmail` — all email data (Maildir)
- `mysql` — full MariaDB dump (all configuration, users, keys)
- `redis` — Rspamd state, spam corpus
- `rspamd` — custom Rspamd configurations
- `postfix` — custom Postfix configurations
- `crypt` — mailbox encryption keys (if Dovecot encryption enabled)

**Cold standby:** `create_cold_standby.sh` via rsync to a second server — recommended for production.

**Offsite:** Sync backup archives to Backblaze B2 or Hetzner Storage Box via rclone after backup completes. Daily mail backups for a 5-mailbox lab will be <1 GB/month compressed.

### 9.3 Common Failure Modes

| Failure Mode | Root Cause | Detection | Recovery |
|-------------|------------|-----------|----------|
| OOM kill (ClamAV or Rspamd) | Insufficient RAM | Watchdog alert, `docker ps` shows restart | Add swap, disable ClamAV, or increase RAM |
| Cert renewal failure | Port 80 blocked or DNS mismatch | HTTPS stops working, watchdog alerts | Fix DNS/firewall, run `docker compose restart acme-mailcow` |
| Update breaks service | Skipped versions, local config modified | Service fail after update | Read migration notes, check `mailcow.conf` diff |
| Disk full (logs or vmail) | No rotation/quota | Mail delivery failures | Rotate logs, purge old mail, expand disk |
| IP blocklisted | New IP, spam leak | Bounce messages to external | Delist via blocklist portal, investigate outbound spam |
| Port 25 blocked | VPS provider policy change | Outbound delivery fails | Contact Hostinger, configure relay fallback |
| MariaDB corruption | Unclean shutdown | All mail functions fail | Restore from backup; MariaDB has recovery tools |

### 9.4 Update Strategy
- **Never skip more than 2 stable releases** without reading all intermediate release notes
- March 2025 (`2025-03`) changed the authentication system — significant migration
- Test on a staging clone before applying to production if the release notes contain "breaking changes"
- `git stash` any local customizations before running `./update.sh` to prevent merge conflicts

---

## 10. Honest Assessment

### 10.1 Real Strengths
- **Comprehensive:** Nothing is missing. Every protocol, every security feature, every management surface is present and production-grade.
- **Documentation quality:** Among the best-documented self-hosted projects. Covers every edge case with step-by-step instructions. Non-code-reading operators like Grizz can follow the admin UI guides without agent assistance.
- **Community density:** 12,700+ GitHub stars means a massive body of answered questions, community packages, tutorials, and troubleshooting posts. Any problem encountered has almost certainly been solved and documented.
- **Groupware integration:** SOGo providing CalDAV/CardDAV/ActiveSync means agents can use calendar and contact sync, not just email — relevant if you want shared lab calendars or task management.
- **Rspamd quality:** Best-in-class OSS spam filter. Effective, tunable, and actively maintained.
- **API:** Well-documented REST API enables programmatic management — directly relevant for AI agent infrastructure.
- **Multi-architecture:** ARM64 support means it can run on Raspberry Pi 5, Apple Silicon VMs, or Ampere-based cloud instances.

### 10.2 Real Weaknesses
- **RAM floor is high:** The full stack at idle consumes 1.5–2.5 GB. ClamAV alone is 400–700 MB. This is not a lean solution. On a 4 GB host, you're either disabling features or living on the edge.
- **Attack surface is large:** 15+ containers, a PHP admin panel, SOGo (Java-based), multiple listening ports. Active CVE history. Requires monthly patching discipline.
- **Complexity is real:** "Docker Compose" sounds simple until postscreen is rejecting your MX records, Rspamd is over-aggressively greylisting, or an update broke your custom nginx overlay. Debugging requires understanding each of the 15 services.
- **SOGo UI is dated:** Angular 1.x. Functional but aesthetically inferior to modern alternatives (Roundcube 2.x, Snappymail). Frequent source of user complaints.
- **Update cadence requires attention:** Monthly updates with occasional breaking changes mean this is not a set-and-forget deployment. It requires a technically-capable agent (Natasha/Lucius) to own ongoing maintenance.
- **No built-in monitoring/alerting:** Watchdog handles health restarts but doesn't integrate with Prometheus, Grafana, or PagerDuty out of the box. External monitoring is a separate exercise.
- **Solr (full-text search) is expensive:** Disabled by default for good reason — adds 1+ GB RAM. For 5 mailboxes, it's unnecessary.

### 10.3 Who Mailcow Is Actually For
- **IT professionals or technical operators** managing email for a small organization (5–200 mailboxes)
- **Self-hosted labs and homelab operators** who want production-grade email without cloud costs
- **Businesses wanting to own their data** — medical, legal, research contexts where data sovereignty matters
- **Technically capable teams** who understand Docker and DNS and have time to maintain monthly

### 10.4 Is It Overkill for 5 Agent Mailboxes?

**Yes, architecturally.** You are deploying a 15-container stack to serve 5 mailboxes. The same function could be achieved with Stalwart (1 binary, 200 MB RAM). The additional components — SOGo, ClamAV, Olefy, Solr, Memcached, Unbound — provide capabilities that 5 automated agents won't use (groupware, desktop calendar sync, Office macro scanning).

**But "overkill" is not disqualifying** if:
1. You want the reputation and community support of the most-tested OSS email stack
2. You anticipate the lab growing (more users, more domains)
3. You specifically want Rspamd's spam filtering quality for inbound protection
4. You want the admin UI for non-technical oversight by Grizz
5. You value the API for programmatic agent provisioning

---

## 11. Comparison to Stalwart

Stalwart Mail Server is a modern, Rust-based all-in-one mail server. Single binary. Version 0.10+ as of 2025.

| Dimension | Mailcow | Stalwart |
|-----------|---------|---------|
| **Architecture** | 15 Docker containers | 1 Rust binary (or single Docker container) |
| **Idle RAM** | 1.5–2.5 GB (full stack) | 100–300 MB |
| **Protocols** | SMTP, IMAP, POP3, ActiveSync, CalDAV, CardDAV | SMTP, IMAP, JMAP, ManageSieve, CalDAV, CardDAV, WebDAV |
| **Webmail** | SOGo (included) | Not included — needs external (Snappymail, Roundcube) |
| **Spam filter** | Rspamd (best-in-class) | Built-in sieve rules + spam/phish filter (improving, not Rspamd-level) |
| **Antivirus** | ClamAV (built-in, 500 MB RAM cost) | No built-in (can integrate ClamAV externally) |
| **Admin UI** | Mature, feature-complete | Modern, cleaner, but less mature |
| **API** | Well-documented REST API | REST API, actively developed |
| **DKIM/SPF/DMARC** | Via Rspamd + UI | Built-in, first-class |
| **2FA** | TOTP + U2F | TOTP + FIDO2 |
| **JMAP** | No | Yes (modern mail protocol, better mobile performance) |
| **Community size** | ~12,700 GitHub stars, huge forum | ~5,000 GitHub stars, growing |
| **Documentation** | Excellent, battle-tested | Good, improving |
| **Maturity** | 10+ years | ~4 years |
| **CVE history** | Active (large PHP surface) | Minimal (Rust memory safety advantage) |
| **Update complexity** | Monthly `./update.sh` | Binary swap or container pull |
| **Setup time** | 2–4 hours (DNS + tuning) | 1–2 hours |
| **Ongoing ops** | 30–60 min/month | 10–20 min/month |

### 11.1 For GrizzlyMedicine Specifically

**Stalwart advantages:**
- Fits comfortably on 4 GB RAM (critical if KVM4 is confirmed 4 GB)
- Lower attack surface — Rust binaries have lower CVE frequency
- JMAP support is forward-looking (better for agent-to-agent programmatic access)
- Faster to deploy and easier to maintain at small scale
- No webmail to maintain (agents don't need a browser UI)

**Mailcow advantages:**
- Rspamd spam filter is materially better — important if agents receive external email that must be reliably classified
- Admin UI that Grizz can use directly without agent assistance
- SOGo provides CalDAV/CardDAV if lab calendars are ever needed
- Larger community — more solved problems, more tutorials
- More proven for production email deliverability at scale

**Verdict for 5-mailbox AI lab:** Stalwart is the **technically superior fit** for the stated use case (agent automation, low maintenance, RAM-constrained VPS). Mailcow is the **operationally safer choice** if the RAM budget is confirmed at 8 GB and long-term growth is anticipated.

---

## 12. Recommendation

### 12.1 Decision Matrix

| Condition | Recommendation |
|-----------|---------------|
| KVM4 has confirmed 8 GB RAM | **Deploy Mailcow** |
| KVM4 has 4 GB RAM | **Deploy Stalwart** or request RAM upgrade |
| Need SOGo groupware / shared calendars | **Mailcow** |
| Agents only, no human webmail needed | **Stalwart** |
| Maximum deliverability / spam filtering quality | **Mailcow (Rspamd)** |
| Minimum ops overhead | **Stalwart** |
| Growing lab (>10 mailboxes eventual) | **Mailcow** |
| Pure agent infrastructure (5 fixed mailboxes) | **Stalwart** |

### 12.2 If Deploying Mailcow: Recommended Configuration

**Host:** Proxmox KVM VM (not LXC — Docker-in-LXC has cgroup complications), dedicated to mailcow.
- **RAM:** 8 GB guaranteed, 12 GB preferred
- **CPU:** 4 vCPUs
- **Disk:** 80 GB SSD-backed storage (Proxmox local-lvm or Ceph)
- **IP:** Dedicated public IP, not shared NAT. Request PTR set to `mail.grizzlymedicine.icu`

**Alternatively:** KVM4 (187.124.28.147) directly if confirmed 8 GB RAM. Trade-off is Mailcow shares resources with any other services already on KVM4.

**Disabled services (RAM optimization for lab scale):**
```bash
# In mailcow.conf
SKIP_CLAMD=n          # Keep if RAM allows — AV is real protection
SKIP_SOLR=y           # Disable — not needed for 5 mailboxes
```

### 12.3 Estimated Setup Time
- **DNS configuration:** 30 minutes (records + propagation wait = up to 48h for PTR)
- **Docker + Mailcow installation:** 1 hour
- **Initial configuration (domains, mailboxes, DKIM):** 30 minutes
- **Blocklist delisting + deliverability testing:** 2–4 hours over 1–2 weeks
- **Total to production-ready:** **4–8 hours of active work over 1–2 weeks** (majority is waiting for DNS propagation and IP warming)

### 12.4 Ongoing Maintenance Estimate
- **Steady state:** 30–60 minutes/month
- **After major updates (breaking changes):** 1–2 hours
- **Incident response (blocklist, OOM, cert issue):** 1–3 hours as-needed
- **Year 1 total estimate:** ~10–15 hours including setup and settling

### 12.5 Coexistence with Google Workspace
grizzlymedicine.icu and grizzlymedicine.org are separate domains. Google Workspace on `.org` is unaffected by running Mailcow on `.icu`. The `.icu` domain needs its own MX records pointing at KVM4. No conflict. Agents at `@grizzlymedicine.icu` operate independently from Grizz at `me@grizzlymedicine.org`.

---

## Appendix A: Quick Reference — mailcow.conf Key Variables

```bash
MAILCOW_HOSTNAME=mail.grizzlymedicine.icu   # Must match PTR record
MAILCOW_PASS_SCHEME=BLF-CRYPT               # bcrypt password hashing
SKIP_LETS_ENCRYPT=n                          # Keep n — use LE certs
SKIP_CLAMD=n                                 # y to disable AV (saves 500 MB RAM)
SKIP_SOLR=y                                  # Disable full-text search (saves 1 GB RAM)
ENABLE_IPV6=y                                # Set n if no IPv6 PTR configured
SNAT_TO_SOURCE=187.124.28.147               # Force outbound to use this IP
HTTP_PORT=80
HTTPS_PORT=443
SMTP_PORT=25
SMTPS_PORT=465
SUBMISSION_PORT=587
IMAP_PORT=143
IMAPS_PORT=993
POP_PORT=110
POPS_PORT=995
SIEVE_PORT=4190
```

## Appendix B: Agent Mailbox Provisioning Script

```bash
#!/bin/bash
API_URL="https://mail.grizzlymedicine.icu/api/v1"
API_KEY="<your-rw-api-key>"
DOMAIN="grizzlymedicine.icu"

AGENTS=("natasha" "mj" "lucius" "tony" "bruce")

for agent in "${AGENTS[@]}"; do
  echo "Provisioning ${agent}@${DOMAIN}..."
  curl -s -X POST "${API_URL}/add/mailbox" \
    -H "X-API-Key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"local_part\": \"${agent}\",
      \"domain\": \"${DOMAIN}\",
      \"password\": \"<generate-unique-strong-password>\",
      \"password2\": \"<same>\",
      \"quota\": \"4096\",
      \"active\": 1,
      \"name\": \"${agent^} Agent\"
    }"
  echo ""
done
echo "All agent mailboxes provisioned."
```

## Appendix C: Verification Checklist (Post-Deploy)

```
□ mail.grizzlymedicine.icu A record resolves to 187.124.28.147
□ PTR for 187.124.28.147 resolves to mail.grizzlymedicine.icu
□ MX record for grizzlymedicine.icu points to mail.grizzlymedicine.icu
□ SPF TXT record present on grizzlymedicine.icu
□ DKIM TXT record present (generated from Mailcow UI)
□ DMARC TXT record present on _dmarc.grizzlymedicine.icu
□ https://mail.grizzlymedicine.icu loads with valid SSL
□ Admin password changed from default 'moohoo'
□ 2FA enabled on admin account
□ API key created and IP-restricted
□ All 5 agent mailboxes created and testable via IMAP
□ Test email sent from natasha@grizzlymedicine.icu → external Gmail (check spam folder)
□ mail-tester.com score: aim for 9/10 or higher
□ mxtoolbox.com blacklist check: clean
□ Google Postmaster Tools domain registered
```

---

*Report compiled using official mailcow documentation (docs.mailcow.email), GitHub repository analysis (github.com/mailcow/mailcow-dockerized), CVE databases, community forum data, and Stalwart comparative research. All RAM figures are empirical from community benchmarks, not theoretical estimates.*
