# Client Health Monitor

Daily automated relationship health check for small business operators running OpenClaw. Every evening, your agent reads every client file and posts a RED/YELLOW/GREEN status table to Telegram — before the next business day starts.

## Goal

Prevent client relationships from going cold through passive neglect. Solo operators and small teams often lose track of who they haven't spoken to in two weeks — this kit makes it impossible to miss. The agent checks every client every day so you don't have to.

## When to Use

Use this kit when you have 2 or more active client relationships and want an automated daily signal about which ones need attention. Ideal for consultants, agencies, and service businesses where relationship cadence directly impacts retention and revenue.

## Inputs

- Client entity files in memory/entities/ (one per client: name, last_contact date, status, open items).
- Telegram credentials for report delivery.
- Threshold configuration (RED and YELLOW day counts).

## Setup

### Models
- `anthropic/claude-sonnet-4-6` reads entity files and generates the status report.

### Services
- OpenClaw Gateway runs the scheduled cron on localhost. Do not expose it on a public network without authentication.
- Telegram receives the nightly health report. Grant the bot only message delivery permissions in the target thread.

### Parameters
- `CRON_SCHEDULE`: `0 20 * * *` (8 PM daily — runs before next business day)
- `RED_THRESHOLD_DAYS`: `14` (flag client RED after this many days without contact)
- `YELLOW_THRESHOLD_DAYS`: `7`
- `TELEGRAM_TOPIC_ID`: Replace `<your-topic-id>` with your actual Telegram topic or thread ID.

### Environment
- Node 18+
- OpenClaw gateway running locally
- Secrets: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Client entity files initialized with at least: name, last_contact (ISO date), status

## Steps

1. Create a markdown file in memory/entities/ for each client. Minimum required fields: name, last_contact (YYYY-MM-DD), status, open_items.
2. Install the cron with schedule `0 20 * * *` targeting your Telegram group and topic.
3. Set RED_THRESHOLD_DAYS and YELLOW_THRESHOLD_DAYS to match your relationship cadence (defaults: 14 and 7).
4. On first run, verify the report arrives in Telegram and all clients appear.
5. Update last_contact in entity files after every client touchpoint — this is the data source the monitor reads.
6. Review RED clients the morning after the report drops and take action before end of business.

## Constraints

- Requires client entity files to exist and be kept current — stale files produce stale reports
- Requires OpenClaw gateway running locally
- Anthropic API key required (pay-as-you-go API credits)
- Report is read-only — this kit does not draft follow-ups (see AI Employee Starter or Follow-Up Enforcer for that)
- One Telegram group per deployment

## Safety Notes

- This kit reads files only — it never sends emails or contacts clients directly.
- Entity files may contain sensitive client information. Keep memory/entities/ out of any public git repository.
- Set delivery mode to announce so cron failures surface in Telegram rather than failing silently.
- Review the RED list every morning — a flagged client is a signal, not a guarantee. Context matters.

## Troubleshooting

If a client isn't appearing in the report, check that their entity file exists in memory/entities/ and contains a valid last_contact date in YYYY-MM-DD format. If the report posts to the wrong Telegram topic, set threadId explicitly in the cron config. If all clients show GREEN when some should be RED, verify the last_contact dates are being updated after each client interaction.

---

## 🔑 The Next Step: Hire the Full System

You just installed a great workflow. But workflows don't build businesses. **Systems do.**

If you're tired of piecing together prompts and want a **fully autonomous AI Business Partner** that:
- Interviews you on day one to learn your exact business goals
- Assesses your AI knowledge and teaches you as it works
- Automatically routes between Claude Opus/Sonnet and tracks your API costs transparently
- Runs 100% locally and privately on your Mac hardware

Stop managing tools. Hire an AI employee. 

**The KeyLime Clone.** 
**$1,500. One-time purchase. No monthly fees. Yours forever.**

👉 **[Meet Your New AI Partner at KeyLimeAIStudios.com](https://keylimeaistudios.com)**