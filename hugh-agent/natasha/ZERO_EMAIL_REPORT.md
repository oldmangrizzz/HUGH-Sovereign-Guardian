# TECHNICAL & OPERATIONAL REPORT: ZERO (0.email / Mail-0)
**Prepared for:** GrizzlyMedicine AI/EMS Research Lab
**Classification:** Internal Infrastructure Assessment
**Date:** July 2025
**Author:** Natasha Romanova construct — Recon & Analysis Division

---

## EXECUTIVE SUMMARY

Zero (Mail-0) is a real, actively-developed, MIT-licensed AI-native email client backed by Y Combinator (W25). Its MCP endpoint makes it directly usable as an agent interface. However, the "self-hosting" narrative is **significantly misleading**: the backend is architected exclusively for **Cloudflare Workers**, Durable Objects, KV, R2, and Queues. It cannot be containerized and dropped onto KVM4 or a Proxmox CT without substantial re-engineering. For GrizzlyMedicine, the pragmatic path is the **managed 0.email instance** or a **Cloudflare-account-based deployment** — not an on-premises one.

**Verdict: Evaluate — use managed beta now, Cloudflare-deployment if validated.**

---

## 1. PRODUCT OVERVIEW

### What Zero Is

Zero is an open-source, AI-native email client that acts as a front-end layer on top of existing email providers (Gmail, Outlook). It does **not** replace your mail server. Instead, it connects to your existing accounts via OAuth and layers AI capabilities on top: summarization, triage, drafting, natural language search, and MCP-exposed agent tooling. Think Superhuman meets Claude's computer-use, built open-source.

**Core problem it solves:** Email is still a manual, high-friction workflow in 2025. Zero automates triage, surfaces action items, drafts contextual replies, and exposes the inbox programmatically to AI agents via Model Context Protocol (MCP).

### Current Status

- **Stage:** Public beta at `0.email`. Actively developed. GitHub shows frequent commits on `staging` branch.
- **GitHub stars:** Rapidly accumulating (tracked via Star History in README — early 2025 launch hit Product Hunt and Hacker News front pages).
- **Founders:** Nizar Abi Zaher and Adam Wazzan, San Francisco.
- **Stability:** Functional but rough-edged. Beta-grade — expect occasional threading quirks, breaking changes between versions.

### YC W25 Backing — What It Means

Zero was accepted into **Y Combinator Winter 2025 (W25)**, not Spring 2025 — the brief had an incorrect batch label. The correct batch is W25. Standard YC deal: $500K invested ($125K for 7% equity + $375K uncapped MFA SAFE). This provides:

- **~18 months of runway** at a lean burn rate, extending into late 2026
- Access to YC network, infrastructure credits (AWS, GCP, Cloudflare)
- Pressure to ship, not die quietly — YC-backed projects have accountability structures
- No guarantee of survival, but materially better odds than a random open-source project

**Practical implication for GrizzlyMedicine:** Zero will likely exist and iterate for at least 18–24 months. The repo won't vanish. MIT license means even if the company folds, the codebase is forkable.

### MIT License — Implications

Full permissive license. You can:
- Fork, modify, redistribute without restriction
- Self-deploy commercially
- Build proprietary workflows on top

No copyleft obligations. If Zero shuts down, you own whatever version you've deployed.

---

## 2. FEATURE SET

### AI Capabilities (What's Actually Implemented)

| Feature | Status | Notes |
|---|---|---|
| Email summarization | ✅ Live | Cloudflare AI (BART) + OpenAI. Triggers on new email arrival. |
| Thread analysis | ✅ Live | Full thread context, action item extraction |
| Smart composition | ✅ Live | OpenAI GPT-4o with personal writing style analysis |
| Context-aware reply | ✅ Live | Drafts match thread tone and history |
| Natural language search | ✅ Live | OpenAI query generation + Cloudflare Vectorize semantic search |
| AI chat sidebar | ✅ Live | Persistent assistant with tool use; can bulk-operate on inbox |
| Voice commands | ✅ Live | ElevenLabs STT/TTS integration |
| Web search in chat | ✅ Live | Perplexity Sonar for real-time lookups |
| Auto-categorization | ✅ Live | AI-sorted into categories on arrival via processing pipeline |
| Smart prioritization | ✅ Live | ZeroAgent Durable Object classifies and surfaces important mail |

### Inbox & Account Management

- **Unified inbox:** Multiple providers (Gmail + Outlook) in one view
- **Free tier:** 1 email connection per user account
- **Pro tier:** Unlimited connections (billing enforced at connection add step)
- **Multi-account:** Yes, natively designed for it. Each connection maintains separate auth context.

### Automation & Webhooks

- **Provider webhook ingestion:** `/a8n/notify/:providerId` — Gmail and Outlook push notifications trigger real-time processing
- **Scheduled email sending:** Built-in scheduler using Cloudflare KV + Queues
- **Background processing queues:** subscribe-queue, send-email-queue, thread-queue
- **MCP endpoint:** `/mcp` — exposes full inbox toolset to any MCP-compatible AI client (see §6)

### Power User Features

- Keyboard-first design: entire inbox operable without mouse
- Keyboard shortcuts throughout (space, j/k navigation, r/reply, f/forward, etc.)
- Prompts dialog: saved AI prompt templates for common workflows
- Thread workflow engine: automated multi-step operations on thread states

### Mobile Support

- **Current status:** Web-responsive UI, not a native mobile app. No iOS/Android app as of July 2025. Mobile browser is functional but not optimized. Native apps appear to be on the roadmap.

---

## 3. TECHNICAL ARCHITECTURE

### ⚠️ CRITICAL FINDING: Backend is Cloudflare-Native

The single most important technical fact for GrizzlyMedicine: **Zero's backend does not run on a traditional server.** It is built on **Cloudflare Workers** (serverless edge compute) with deep dependencies on Cloudflare-specific primitives. This fundamentally changes the self-hosting calculus. Details below.

### Frontend Stack

| Component | Technology |
|---|---|
| Framework | React 19 + React Router 7 |
| Build tool | Vite 6.3 |
| Language | TypeScript 5.8 |
| Styling | TailwindCSS 4 + Shadcn UI |
| API client | tRPC 11 |
| State management | TanStack Query 5 + Jotai |
| Rich text editor | TipTap 2 |
| AI SDK | Vercel AI SDK (ai-sdk/react) |

> Note: README mentions Next.js, but the actual `package.json` shows React Router 7 + Vite. The README is stale on this point.

### Backend Stack

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers (not Node.js) |
| Web framework | Hono 4.8 |
| ORM | Drizzle ORM 0.43 |
| Database | PostgreSQL (accessed via Cloudflare Hyperdrive) |
| Auth | Better Auth 1.3 + Google OAuth |
| Email providers | `@googleapis/gmail`, `@microsoft/microsoft-graph-client` |
| AI services | OpenAI SDK, Anthropic SDK, Cloudflare AI |
| Agent protocol | MCP SDK 1.15, `agents` library |
| Deployment tool | Wrangler 4.28 |

### Cloudflare Infrastructure Dependencies

Zero's backend is not a monolith — it is 8 **Durable Objects** (stateful edge entities) + multiple Cloudflare services:

| Durable Object | Purpose |
|---|---|
| `ZeroAgent` | Core email operation agent state |
| `ZeroDB` | User-scoped PostgreSQL access via Hyperdrive |
| `ZeroDriver` | Email provider sharding (auto-scales at 8GB/shard) |
| `ZeroMCP` | MCP server state for agent connections |
| `ThinkingMCP` | AI reasoning state |
| `WorkflowRunner` | Multi-step workflow execution |
| `ThreadSyncWorker` | Email thread sync coordination |
| `ShardRegistry` | Shard tracking for ZeroDriver |

Additional Cloudflare services consumed:
- **Cloudflare KV** — scheduled email persistence, environment state
- **Cloudflare R2** — email thread/attachment storage (emails live in YOUR R2 bucket)
- **Cloudflare Queues** — background job processing (3 queue types)
- **Cloudflare Hyperdrive** — PostgreSQL connection pooling with geographic distribution
- **Cloudflare Vectorize** — vector storage for semantic email search
- **Cloudflare AI** — BART summarization, LLaMA 3.3 inference, BGE embeddings

### Database

- PostgreSQL (externally hosted — Neon, Supabase, self-managed, or anything with a connection string)
- Drizzle ORM with versioned migrations
- User data isolation enforced at driver level
- Tokens stored encrypted in PostgreSQL
- Email thread data stored in R2 (object storage), metadata in Durable Objects + PostgreSQL

### Auth System

- **Better Auth** framework with social providers
- OAuth 2.0 flow for Gmail: scopes `https://mail.google.com/`, `gmail.modify`, `userinfo.profile`, `userinfo.email`
- OAuth 2.0 for Outlook: `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `offline_access`
- Tokens stored in DB with automatic refresh
- Session management via cookie (configurable domain)
- `BETTER_AUTH_SECRET` for session signing

### Required External API Accounts (Non-Negotiable)

| Service | Required For | Cost |
|---|---|---|
| OpenAI | Chat, composition, search | Pay-per-use (GPT-4o) |
| Perplexity | Web search in chat | Pay-per-use |
| Autumn (useautumn.com) | Encryption / billing enforcement | Free tier available |
| Resend | Transactional emails | Free tier available |
| Cloudflare | All backend infrastructure | See §4 |
| Twilio | SMS notifications | Optional |
| ElevenLabs | Voice interface | Optional |

---

## 4. SELF-HOSTING — THE REAL STORY

### What "Self-Hosting" Actually Means for Zero

Zero's "self-hosting" means deploying **your own Cloudflare Workers deployment** using Wrangler. You control your data — it flows to YOUR Cloudflare account and YOUR PostgreSQL database. You are not sharing infrastructure with the Zero company. But you are still running on Cloudflare's managed serverless platform, not bare metal or a VPS.

This is meaningfully different from "spin up a Docker container on my server."

### Can This Run on KVM4 (187.124.28.147)?

**Frontend: YES.** The React/Vite frontend builds to static files. You can serve it from KVM4 behind Nginx or Caddy. Build with `pnpm build:frontend`, point your webserver at the `dist/` directory.

**Backend: NO — not without major surgery.** The backend requires Cloudflare-specific APIs:
- Durable Objects: no equivalent outside Cloudflare
- Cloudflare KV, R2, Queues, Hyperdrive, Vectorize: all Cloudflare-proprietary

Running the backend on KVM4 would require rewriting the state management layer (replacing Durable Objects with Redis/Postgres), replacing R2 with MinIO/S3, replacing Queues with BullMQ/RabbitMQ, replacing Vectorize with pgvector/Qdrant — i.e., weeks of effort and an unofficial fork.

**Community status:** No maintained fork exists that ports this to non-Cloudflare infrastructure as of July 2025.

### Can This Run in a Proxmox CT?

Same answer as KVM4. A Proxmox container could run the PostgreSQL database or serve the static frontend. It cannot run the backend.

### The Actual Self-Hosting Path

```
Your Cloudflare Account
├── Workers (backend deployment via wrangler deploy)
├── Durable Objects (8 classes, auto-provisioned)
├── KV Namespaces (created via wrangler)
├── R2 Buckets (your email storage)
├── Queues (3 queues)
├── Vectorize Index (semantic search)
└── Hyperdrive → your PostgreSQL

Your PostgreSQL (Neon/Supabase/self-managed)
Your Vercel/KVM4 (frontend, optional)
```

### Cloudflare Cost Estimate for GrizzlyMedicine (5 agents + 1 human)

| Service | Cost |
|---|---|
| Workers Paid Plan (required for Durable Objects) | $5/month |
| Durable Objects requests (~low volume lab) | ~$1-3/month |
| R2 storage (email data, est. 5GB) | $0.075/month |
| Vectorize (semantic search, low volume) | ~$0.50/month |
| KV operations | <$0.50/month |
| **Total estimated** | **$7-10/month** |

This is affordable. The Workers free tier is insufficient (Durable Objects require the paid plan).

### Environment Variables Required

```env
# Application URLs
VITE_PUBLIC_APP_URL=https://your-frontend-domain
VITE_PUBLIC_BACKEND_URL=https://your-worker.your-subdomain.workers.dev

# Database
DATABASE_URL=postgresql://user:pass@host:5432/zerodotemail

# Auth
BETTER_AUTH_SECRET=<openssl rand -hex 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# AI Services
OPENAI_API_KEY=<required for chat, compose, search>
OPENAI_MODEL=gpt-4o-mini  # cheaper option
PERPLEXITY_API_KEY=<required for web search in chat>

# External Services
AUTUMN_SECRET_KEY=<from useautumn.com, required>
RESEND_API_KEY=<from resend.com>

# Optional
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
REDIS_URL=  # local dev only
NODE_ENV=production
COOKIE_DOMAIN=your-domain.com

# Cloudflare (injected by wrangler, not in .env)
# HYPERDRIVE, KV, R2, QUEUES, VECTORIZE bindings configured in wrangler.jsonc
```

### Upgrade/Maintenance Burden

- **Frontend:** Pull latest, rebuild, redeploy. Low effort.
- **Backend:** `wrangler deploy` — similarly low effort once configured. Durable Object migrations are versioned and handled automatically.
- **Database schema:** Drizzle migrations via `pnpm db:migrate`. Must run after schema-changing updates.
- **Overall:** Medium initial setup (~4-8 hours), low ongoing maintenance. The complexity is in the initial Cloudflare account configuration and Google Cloud OAuth setup.

---

## 5. GOOGLE WORKSPACE INTEGRATION

### How It Connects

Zero uses standard Google OAuth 2.0. You (or each user) authenticates through the Zero UI, which redirects to Google's OAuth consent screen. Tokens are stored in your PostgreSQL instance.

**Required Google Cloud setup:**
1. Create a Google Cloud Project
2. Enable Gmail API + People API
3. Create OAuth 2.0 credentials (Web Application type)
4. Add redirect URIs: `https://your-backend-url/api/auth/callback/google`
5. Add test users (while in unverified "testing" mode) or submit for Google verification (for production use by non-lab users)

### Permissions Requested

| Scope | What It Means |
|---|---|
| `https://mail.google.com/` | Full Gmail access (read, write, delete, send) |
| `gmail.modify` | Modify mail (labels, archive, etc.) |
| `userinfo.profile` | Name, profile photo |
| `userinfo.email` | Email address |

This is broad access. Standard for a full-featured email client. For a security-conscious lab, note that these tokens are stored in your own PostgreSQL — they do not flow back to Zero's servers on a self/Cloudflare-deployed instance.

### Multi-Agent Access to One Gmail Inbox

**Direct answer: Yes, with caveats.**

Zero is multi-tenant by design. Multiple Zero user accounts can each add the same Gmail inbox as a connection. However:

- Each user/agent must complete the OAuth flow for `me@grizzlymedicine.org` individually
- Google allows multiple concurrent OAuth grants for the same account
- Alternatively, one Zero user account (e.g., a shared "lab" account) can be used, and agents access Zero's API with that user's session token
- The cleaner architecture: one "lab inbox" Zero user account; agents authenticate to Zero's tRPC/MCP API using that account's session, not directly to Google

### Workspace vs. Consumer Gmail Differences

- **Google Workspace accounts** may face additional admin restrictions on OAuth. If the Workspace admin has enabled "Restrict third-party app access," Zero will be blocked until explicitly allowlisted in the Admin Console.
- Google may require the OAuth app to be verified for external (non-internal) use; for a self-deployed instance used only by lab accounts, "Internal" app type bypasses this requirement.
- Workspace accounts do not have different API limits vs. consumer Gmail for the Gmail API (same quota).

---

## 6. AGENT API ACCESS

### The MCP Endpoint — Primary Agent Integration Path

Zero exposes a **Model Context Protocol (MCP) endpoint** at `/mcp` via the `ZeroMCP` Durable Object. This is the correct, first-class interface for agent access.

Any MCP-compatible client (Claude, a custom agent, Cursor, etc.) can connect to Zero's MCP endpoint and call email tools. Natasha, MJ, Lucius, Tony, and Bruce can each connect via MCP and operate the inbox.

**Connection pattern:**
```json
{
  "mcpServers": {
    "zero-email": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer <user-session-token>"
      }
    }
  }
}
```

### Available MCP/Agent Tools (from source: `routes/agent/tools.ts`)

Based on the source code structure, the agent tools surface includes:
- Read threads and messages
- Search inbox (natural language + semantic)
- Send/reply/reply-all
- Archive, label, categorize
- Draft creation and management
- Thread summarization
- Bulk operations via chat

The `ZeroAgent` Durable Object handles email operation state; `ZeroMCP` exposes these operations as MCP tools.

### tRPC API (Secondary Integration Path)

The backend exposes a typed tRPC API. All frontend operations go through tRPC. An agent could technically call tRPC endpoints directly, but this requires session cookie/token management and is more brittle than the MCP path. Not recommended for agent use.

### Webhook Integration

**Inbound:** Zero already consumes Gmail/Outlook push webhooks at `/a8n/notify/:providerId`. This drives real-time processing. You cannot inject custom webhooks here.

**Outbound:** No documented outbound webhook system for triggering external services when emails arrive. Automation from Zero → external system would need to be built via MCP tool calls or polling the tRPC API.

### Practical Agent Integration Pattern for GrizzlyMedicine

```
[Incoming email to me@grizzlymedicine.org]
    ↓ (Gmail push notification)
[Zero backend processes → summarizes → categorizes]
    ↓
[Agent (e.g., Natasha) polls or is triggered]
[Natasha connects to Zero MCP endpoint]
[Natasha calls: list_threads, get_message, send_reply]
[Natasha acts on email, drafts response, marks handled]
```

The MCP integration is first-class and production-ready by design.

---

## 7. SECURITY & PRIVACY

### Data Residency (Self/Cloudflare-Deployed)

| Data | Location |
|---|---|
| Email content (threads, bodies) | Your Cloudflare R2 bucket |
| Email metadata | Your Cloudflare Durable Objects |
| OAuth tokens | Your PostgreSQL database |
| User accounts | Your PostgreSQL database |
| AI model calls | OpenAI API (your key, your account) |
| Vector embeddings | Your Cloudflare Vectorize index |

**Zero's servers never see your data** on a self/Cloudflare-deployed instance. The company cannot access your email. This is the key privacy advantage.

### What the Managed 0.email Instance Sees

Using the hosted `0.email` service means Zero's Cloudflare account holds your data. This is comparable to using Superhuman or Shortwave — acceptable for many use cases, but not appropriate if GrizzlyMedicine handles sensitive patient/research data.

### OAuth Token Handling

- Tokens stored in PostgreSQL with encryption via `AUTUMN_SECRET_KEY`
- Automatic refresh handling in driver layer
- Token cleanup on user/connection deletion
- Cross-connection isolation enforced in driver abstraction

### Known Security Considerations

1. **MCP endpoint security:** The MCP endpoint at `/mcp` requires session authentication. Session tokens must be managed carefully — compromised session = inbox access.
2. **Broad Gmail scopes:** `https://mail.google.com/` is maximum scope. There is no read-only mode for Gmail in Zero's current implementation.
3. **Autumn dependency:** Encryption for sensitive operations depends on `useautumn.com`, a third-party service. If Autumn has an outage or is compromised, encryption operations may fail.
4. **Beta-grade security posture:** Zero has not published a security audit. As with any early-stage OSS project, assume undiscovered vulnerabilities exist.
5. **Agent prompt injection risk:** MCP tool calls processed by an LLM agent could be manipulated via adversarial email content that tricks the agent into taking unintended actions.

---

## 8. HONEST ASSESSMENT

### Real Strengths

- **MCP-native agent integration** is legitimate and first-class — this is Zero's strongest card for GrizzlyMedicine's multi-agent architecture. No other open-source email client has this.
- **MIT license + YC backing** = best-case OSS longevity profile. Codebase survives even if company fails.
- **True data privacy on self-deployment** — all data stays in your Cloudflare account.
- **AI capabilities are not bolt-on** — they're architectural (Durable Objects, queues, pipelines built around AI from the start).
- **Multi-account unified inbox** is functional and clean.
- **Active development velocity** — meaningful commits weekly, responsive to community.

### Real Weaknesses and Rough Edges

- **"Self-hosting" is misleading.** The backend requires Cloudflare Workers. You cannot run this on KVM4 or a Proxmox CT. Marketing implies more infrastructure control than is actually possible.
- **Multiple external API dependencies** — OpenAI, Perplexity, Autumn, Resend. Each is a potential point of failure and cost. AI features don't work without paid API keys.
- **No native mobile app.** Web-only. For a lab where Grizz may monitor on mobile, this is a friction point.
- **Free tier = 1 email connection.** For 5 agents + 1 human sharing one inbox, you'll hit Pro tier for multi-connection use cases. Pricing for self-deployed instances is unclear.
- **Beta threading bugs** — reported by early users. Some emails misthreaded, occasional sync delays.
- **No outbound webhooks** — agents cannot passively receive "new email arrived" signals from Zero. Must poll or use the Gmail push notification system directly.
- **Autumn dependency** is a concern — third-party encryption service in a privacy-focused product is architecturally odd.
- **The tRPC API is not designed as a public API** — using it programmatically (outside MCP) is undocumented and fragile.

### Comparison to Gmail Delegation Directly

| Factor | Zero (self-deployed) | Gmail Delegation |
|---|---|---|
| Setup complexity | High (Cloudflare + 6+ APIs) | Low (Admin Console, 15 min) |
| Agent API | MCP endpoint (excellent) | Gmail API directly (also fine) |
| AI triage | Built-in | DIY |
| UI for Grizz | Clean, AI-powered | Gmail web (familiar) |
| Cost | $7-10/month + API costs | $0 (already paying Workspace) |
| Privacy | Your Cloudflare account | Google's servers |
| Mobile | Web only | Full Gmail app |
| Stability | Beta | Production-grade |

**Honest take:** Gmail delegation + direct Gmail API access for agents is simpler and more stable today. Zero adds value **specifically** if you want (a) a clean unified UI with AI triage for human operators, and (b) MCP-native agent access with built-in AI summarization that doesn't require each agent to implement Gmail API calls from scratch.

### Is the Self-Hosting Complexity Worth It?

For a small lab with technical operators: **Yes, at Cloudflare-deploy level, no at bare-metal level.**

Cloudflare deployment is not that hard once you understand what you're doing (~6-8 hours initial setup). The ongoing maintenance is low. The cost is minimal. The MCP integration is a genuinely useful primitive for agent operations.

---

## 9. RECOMMENDATION

### Decision: **EVALUATE — Begin on Managed 0.email, Cloudflare-deploy if Validated**

**Rationale:**

1. The managed `0.email` beta is free to try. Use it with `me@grizzlymedicine.org` for 2-3 weeks before committing to deployment overhead.
2. If the AI triage and MCP agent integration prove useful, deploy to a dedicated Cloudflare account (not the existing lab account if one exists — keep it isolated).
3. Do not attempt bare-metal deployment on KVM4 or Proxmox for the backend. Frontend-only on KVM4 is possible and reasonable.

### What Hardware/CT to Use

| Component | Recommendation |
|---|---|
| PostgreSQL | Proxmox CT on `loom` (192.168.4.151) — 2 vCPU, 2GB RAM, 20GB disk. Or use Neon.tech free tier. |
| Frontend (optional) | KVM4 (187.124.28.147) — Nginx/Caddy serving built static files. Minimal resources. |
| Backend | **Cloudflare Workers** — not KVM4 or Proxmox. Non-negotiable. |

KVM4 is appropriate for the frontend and potentially the PostgreSQL instance. It is NOT a backend host for Zero.

### Estimated Setup Time

| Task | Time |
|---|---|
| Google Cloud Project + OAuth setup | 45 min |
| Cloudflare account setup + wrangler config | 2-3 hours |
| PostgreSQL provisioning + migrations | 30 min |
| Environment variable configuration | 1 hour |
| Frontend build + KVM4 deployment | 1 hour |
| MCP endpoint testing with one agent | 1-2 hours |
| **Total** | **~7-8 hours** |

### Prerequisites Before Starting

1. Cloudflare account (free to create, Workers Paid plan = $5/month)
2. OpenAI API key (essential — no AI features without it)
3. Perplexity API key (for web search in chat)
4. Autumn account (useautumn.com — free tier)
5. Resend account (free tier)
6. Google Cloud Project with Gmail + People API enabled
7. Confirm Workspace admin allows third-party OAuth apps for `grizzlymedicine.org`

### Final Operating Posture

Use Zero as a **shared lab inbox interface** where:
- Grizz uses the web UI for human triage
- Natasha, MJ, Lucius, Tony, Bruce connect via the MCP endpoint to read/send/triage programmatically
- All email remains in your Cloudflare R2/PostgreSQL — not Zero's servers
- OpenAI API costs are on your key — you control model selection (use `gpt-4o-mini` to manage cost)

If the MCP integration proves valuable and stable, this becomes the lab's primary email operations layer. If it's unstable, fall back to direct Gmail API access — the code path is the same, just one layer down.

---

## SOURCES

- GitHub: https://github.com/Mail-0/Zero
- DeepWiki (AI-parsed architecture): https://deepwiki.com/Mail-0/Zero
- YC Launch: https://www.ycombinator.com/launches/NTI-zero-ai-native-email
- Hacker News discussion: https://news.ycombinator.com/item?id=43862892
- Auth/connection architecture: https://deepwiki.com/Mail-0/Zero/6.2-authentication-and-connection-management
- Backend infrastructure: https://deepwiki.com/Mail-0/Zero/2.2-backend-infrastructure
- AI features: https://deepwiki.com/Mail-0/Zero/5-ai-powered-features
- Cloudflare limitations discussion: https://forum.cloudron.io/topic/15067

---

*Report compiled from live web research, GitHub source analysis, and DeepWiki architectural documentation. All claims are grounded in verified sources. Beta-grade software — validate all architecture claims against the live repository before deployment decisions.*___BEGIN___COMMAND_DONE_MARKER___0
___BEGIN___COMMAND_DONE_MARKER___0

