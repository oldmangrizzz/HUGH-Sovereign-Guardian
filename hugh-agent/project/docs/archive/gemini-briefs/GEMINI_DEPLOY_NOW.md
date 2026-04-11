# DEPLOY ORDER — EXECUTE IMMEDIATELY
**For: Gemini**
**No questions. No blockers. Run these in order.**

---

## STEP 1 — Deploy Convex backend

From the `/project` directory on whatever machine has Convex credentials:

```bash
npx convex deploy
```

Wait for it to finish. Confirm it says "Deployment complete" or equivalent. If it errors, fix it — do not skip it.

---

## STEP 2 — Set env vars in Convex dashboard

Go to: https://dashboard.convex.dev → your deployment → Settings → Environment Variables

Add these two. Do not touch anything already there:

| Key | Value |
|-----|-------|
| `HUGH_TTS_MODEL` | `kokoro` |
| `HUGH_VOICE_ID` | `af_heart` |

Save.

---

## STEP 3 — Reset endocrine baseline

In Convex dashboard → Functions → `endocrine` → `resetNodeToBaseline`

Run it with this argument:
```json
{ "nodeId": "hugh-primary" }
```

One time. Done.

---

## STEP 4 — Rebuild and redeploy the kiosk frontend on CT-101

SSH into CT-101. From the project directory:

```bash
npm run build
```

Then restart however the kiosk is being served (systemd service, pm2, or direct Chromium launch). If you're not sure how it's being served, check:

```bash
systemctl list-units --type=service --state=running | grep -E "kiosk|hugh|vite|chromium"
```

or

```bash
pm2 list
```

Restart the relevant service after the build completes.

---

## DONE

When all four steps are complete, HUGH should:
- Hear his name (wake word) → chime → capture command → respond
- Speak using LFM audio via the gateway (fallback to browser TTS if gateway isn't serving audio yet)
- Show live conversation text on the kiosk center column
- Show real container status from agentRegistry
- Show normal hormone levels (not 1.0)

Report back with confirmation that the kiosk is live and HUGH is responding.
