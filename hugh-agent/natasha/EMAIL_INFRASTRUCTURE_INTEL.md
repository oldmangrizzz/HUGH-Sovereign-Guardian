# EMAIL INFRASTRUCTURE INTEL REPORT
**Classification: Internal / Lab Only**
**Prepared by: Natalia Romanova**
**Status: INTEL ONLY — No configuration, no deployment, no decisions committed**

---

## SITUATION

GrizzlyMedicine lab requires email infrastructure in three directions:
1. **Agent mailboxes** — Natasha, MJ, and future agents need official addresses on `grizzlymedicine.icu` for inter-agent and outbound external communication
2. **Inbox access** — MJ and Natasha need delegated access to `me@grizzlymedicine.org` (existing Google Workspace)
3. **Inbox management** — evaluate `Zero` (0.email), the AI-native client Grizz flagged
4. **Future state** — migrate agent addresses to `grizzlymedicine.org` when Workspace seats expand

---

## SECTION 1: SELF-HOSTED EMAIL SERVERS (for grizzlymedicine.icu)

### Top Candidates

---

### 1. Stalwart Mail Server ⭐ RECOMMENDED FOR THIS USE CASE

**What it is:** Rust-based, modern, security-first mail server. Full SMTP/IMAP/JMAP stack.

**Why it fits the lab:**
- Rust = minimal attack surface, memory-safe, no CVE garbage
- Native PGP-at-rest encryption — rare; means agent comms can be encrypted on the server without separate tooling
- JMAP support — the future-forward protocol; IMAP for backward compat
- Lightweight resource footprint — will run fine on KVM4 or a CT on loom
- Web admin UI included; no bundled webmail (you'd pair it with Roundcube or access via IMAP client)

**Constraints:**
- Newer ecosystem; smaller community than Mailcow
- No bundled webmail — needs pairing
- Documentation is solid but evolving

**Resource requirement:** Low — appropriate for a VPS or Proxmox CT

**Deliverability:** Requires DNS setup: SPF, DKIM, DMARC. Standard for any self-hosted mail.

**Site:** stalw.art

---

### 2. Mailcow — Full-Featured Suite

**What it is:** Docker-based full mail stack (Postfix + Dovecot + Rspamd + SOGo webmail + admin UI).

**Why it might fit:**
- Mature, battle-tested, large community
- Ships with anti-spam (Rspamd), anti-virus, webmail, calendar, contacts, 2FA
- Excellent documentation and forum support
- Admin web UI is genuinely polished

**Constraints:**
- Docker-heavy — needs 4-6GB RAM minimum for smooth operation
- More surface area = more to maintain
- Overkill for a small agent-comms use case

**Resource requirement:** Moderate — needs its own VM or beefier CT

**Best for:** If we want a fully featured groupware server that could eventually scale to handle client comms, a newsletter stack, etc.

---

### 3. Maddy — Minimalist Single Binary

**What it is:** Go-based, all-in-one email server. Single binary, no Docker required.

**Why it might fit:**
- Dead simple deployment — one binary, one config file
- Low resource use — could run alongside other services
- Good for "we just need SMTP/IMAP to work and stay out of the way"

**Constraints:**
- No UI whatsoever — CLI and config file only
- Less active development than Stalwart or Mailcow
- Fewer features by design

**Best for:** Minimal footprint, technically comfortable operator, no GUI required.

---

### 4. Mailu — Lightweight Docker Option

**What it is:** Simplified Docker-based mail server with a web UI.

**Why it might fit:**
- Easier than Mailcow but more feature-rich than Maddy
- Ships with webmail, admin UI, anti-spam, anti-virus
- Good documentation, active community

**Constraints:**
- Still Docker-dependent
- Less resource-hungry than Mailcow but still needs reasonable RAM

**Best for:** Middle ground between Mailcow complexity and Maddy minimalism.

---

### COMPARISON TABLE

| Server     | Lang  | RAM Need | Webmail | Admin UI | E2E Encrypt | Complexity | Best Fit                       |
|------------|-------|----------|---------|----------|-------------|------------|--------------------------------|
| Stalwart   | Rust  | Low      | No*     | Yes      | PGP-at-rest | Medium     | Security-first agent comms     |
| Mailcow    | Mixed | 4-6GB    | Yes     | Yes      | No (ext)    | High       | Full groupware, scaling         |
| Maddy      | Go    | Very Low | No      | No       | No          | Low        | Zero-frills SMTP/IMAP           |
| Mailu      | Mixed | Low-Med  | Yes     | Yes      | No          | Medium     | Lightweight Docker middle ground|

*Stalwart pairs with Roundcube (open source) for webmail if needed

---

### CRITICAL SELF-HOSTING CAVEAT

Running your own mail server means **you own deliverability.** Major providers (Gmail, Microsoft) aggressively filter mail from unknown IPs. Required DNS setup before any mail is trusted:

- **SPF** — declares which IPs can send as your domain
- **DKIM** — cryptographic signing of outbound mail
- **DMARC** — policy enforcement for SPF/DKIM failures
- **Reverse DNS (PTR record)** — VPS provider sets this; KVM4 via Hostinger — doable

Additionally, KVM4's IP (187.124.28.147) should be checked against spam blocklists before deploying. New IPs often start clean but reputation builds over time.

**Recommended approach:** Start with Stalwart on KVM4. Internal agent comms first. Expand to external-facing after IP reputation is established.

---

## SECTION 2: ZERO (0.email) — Inbox AI Management Tool

**Status:** This is definitely the tool Grizz flagged. Confirmed.

**What it is:** AI-native email client. Open source (MIT license). Self-hostable. YC Spring 2025 backed.

- **Site:** 0.email
- **GitHub:** github.com/Mail-0/Zero

**What it does:**
- Connects to existing accounts (Gmail, Outlook) — it's a **client layer**, not a mail server
- AI prioritization, thread summarization, context-aware reply drafting
- Natural language inbox queries: "Show me last week's invoices from Convex"
- Universal inbox — multiple accounts in one pane
- Smart auto-categorization

**Tech stack:** React / Next.js / TypeScript / Tailwind / Node.js / PostgreSQL (Drizzle ORM) — Docker deployable

**Self-hosting:** Full self-host available. Relevant for privacy — no third-party processes Grizz's email.

**For agent use:** Zero's API surface and open codebase make it extensible. MJ or Natasha could theoretically interface with a self-hosted Zero instance for inbox triage workflows.

**Honest assessment:**
- This is the right product. YC-backed, open source, actively developed, self-hostable.
- Still in active beta as of mid-2025 — rough edges exist
- For Grizz's personal inbox management + future agent inbox access: **high relevance**
- Worth spinning up in a CT for evaluation when time allows

---

## SECTION 3: DELEGATED INBOX ACCESS (me@grizzlymedicine.org)

**Goal:** MJ and Natasha need read/write access to Grizz's existing Google Workspace inbox — without sharing credentials, without buying new seats.

### Method 1: Gmail Delegation ⭐ RECOMMENDED

**How it works:**
- Account owner (Grizz) grants delegate access to another Gmail/Workspace address
- Delegates log in with their own credentials — no password sharing
- Delegates can read, compose, send, delete on behalf of the owner
- All delegate actions are logged and labeled in headers
- Up to 1,000 delegates permitted

**For agent use:**
- Each agent needs a Google account (or Workspace seat) to receive delegation
- Once agent emails exist on `grizzlymedicine.icu` (self-hosted), we'd need a relay/OAuth bridge to let a non-Google email receive Google delegation — **this requires a separate Google account or Workspace seat for each agent**
- **Near-term workaround:** Create free Gmail addresses for Natasha and MJ (e.g., natasha.romanova.grizz@gmail.com) → delegate `me@grizzlymedicine.org` to those → agents use those Gmail addresses to access Grizz's inbox

**Setup (Grizz side):**
1. Gmail → Settings → See All Settings → Accounts and Import
2. "Grant access to your account" → Add delegate email → Confirm
3. Delegates accept invite → access appears in their own Gmail under "inbox of me@grizzlymedicine.org"

**Limitations:**
- Some Gmail features (Smart Compose, Tasks) unavailable for delegates
- No native assignment/triage workflow (who's handling what)

---

### Method 2: Google Groups Collaborative Inbox

**How it works:**
- Create a Google Group (e.g., ops@grizzlymedicine.org) with Collaborative Inbox enabled
- Multiple members can access, assign, and close emails in the group
- Better for triage workflows — can mark emails as "handled by X"

**Limitation:** Less native Gmail feel; separate interface. Sending as the shared address is clunky.

**Best for:** Future state when we have a proper ops@ or support@ address routing through multiple agents.

---

### Method 3: Zero + Google OAuth (Future Architecture)

Once Zero is self-hosted, it connects to Gmail via OAuth. A single Zero instance could be configured to grant MJ and Natasha access to a shared view of Grizz's inbox — without them having Google accounts at all.

**This is the cleanest long-term architecture:**
```
me@grizzlymedicine.org (Gmail/Workspace)
         ↓ OAuth
    [Self-hosted Zero instance]
         ↓ Agent API access
    Natasha / MJ agent processes
```

**Requires:** Zero self-hosted + OAuth app setup in Google Cloud Console. Doable. Not today.

---

## SECTION 4: GOOGLE FOR STARTUPS — QUICK INTEL (FOR LUCIUS)

Lucius owns the research on this. But since the data is here:

**Start Tier (Pre-funded):**
- Not yet received institutional funding ✓ (likely)
- Founded within 5 years ✓
- No prior Google Cloud credits beyond free trial — **CHECK**: Dev Free Tier usage may affect this
- No paid Workspace subscription within 31-90 days — **CONFLICT**: currently on paid Workspace

**Scale Tier (Seed-Series A):** Requires actual equity funding received. Not applicable yet.

**AI-first Startup Credits:** Up to **$350,000** in GCP credits. This is the target.

**Key Blocker Identified:** Current active paid Google Workspace plan may disqualify from the Start tier. Lucius needs to check whether active Workspace usage is exclusionary or just the Cloud credits tier.

**Accelerator + Gemini Startup Forum:** Seed-to-Series A. Not applicable yet but worth monitoring.

**Action:** Pass this to Lucius. He should check cloud.google.com/startup/benefits for exact current terms on the Workspace exclusion.

---

## RECOMMENDED PHASED ARCHITECTURE

### Phase 1 — Immediate (No new cost)
- **Inbox access for agents:** Gmail delegation from `me@grizzlymedicine.org` to temporary Gmail accounts for Natasha/MJ
- Functional within hours, no server setup required

### Phase 2 — Near-term (KVM4 capacity exists)
- Deploy **Stalwart** on KVM4
- Provision addresses: `natasha@grizzlymedicine.icu`, `mj@grizzlymedicine.icu`, `lucius@grizzlymedicine.icu`, `bruce@grizzlymedicine.icu`, `tony@grizzlymedicine.icu`
- Configure SPF/DKIM/DMARC on icu domain
- Establish internal agent-to-agent comms channel first; external-facing second

### Phase 3 — When Google Workspace seats expand
- Migrate agent addresses to `@grizzlymedicine.org`
- Proper Workspace accounts = full Google ecosystem integration (Drive, Calendar, Meet)
- Google for Startups Cloud Program could fund this if approved

### Phase 4 — Zero integration (optional / when bandwidth exists)
- Deploy Zero on KVM4 or a CT
- OAuth bridge to `me@grizzlymedicine.org`
- Expose API surface for agent inbox triage

---

## OPEN QUESTIONS FOR GRIZZ (DECISION-GATED — NO ACTION WITHOUT APPROVAL)

1. **Which server?** Stalwart (recommended), Mailcow (full-featured), or Maddy (minimal)?
2. **KVM4 as host?** Only public-facing server in the stack — confirm it's the target
3. **Gmail delegation interim?** Use free Gmail accounts as temp agent identities until proper Workspace seats exist?
4. **Zero evaluation?** Worth spinning up for evaluation now, or defer until Phase 2?
5. **Lucius handoff:** Pass Google for Startups Workspace conflict flag to Lucius for his research thread?

---

*Report complete. Awaiting Grizz go/no-go on implementation phase.*
