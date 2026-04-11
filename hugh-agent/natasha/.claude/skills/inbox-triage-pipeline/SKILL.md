---
name: inbox-triage-pipeline
description: "Triage inbound email with LLM scoring, multi-system stage sync, human approval gates, and guarded draft generation."
---

# Inbox Triage Pipeline

## Goal

Describe a reproducible, safety-first pipeline that ingests inbound email threads, scores and classifies leads, keeps pipeline stages aligned across three stores (email provider labels, local database, CRM), routes sensitive transitions through a serial human approval queue with deduplication, and produces context-aware reply drafts using a writer plus reviewer LLM pair. The pattern generalizes beyond any single vendor: swap the email API and CRM SDK while keeping the same stage machine, quarantine rules, and approval semantics.

## When to Use

Use this kit when you need:

- High-volume B2B or partnership inboxes where automation must not auto-commit CRM writes or outbound sends.
- Lead scoring driven by an editable rubric and structured extraction, not brittle regex-only routing.
- Pipeline stages that must stay consistent between what operators see in the inbox, what the local system of record stores, and what the CRM shows.
- Human-in-the-loop for stage changes, CRM sync, and high-signal escalations without notification spam (one approval at a time, deduped proposals).
- Reply assistance that personalizes from full thread context but blocks unsafe or over-committed drafts.

## Inputs

- **Email provider access:** Authenticated API or CLI to list threads, read messages, and apply labels or folders (implementation-specific).
- **CRM access:** Read/write APIs for deals or opportunities, scoped so automation never writes without explicit approval where policy requires it.
- **Human approval channel:** A single queue consumer surface (chat bot, ticketing UI, or messaging topic) that can approve, reject, and optionally attach notes.
- **Policy artifacts:** Scoring rubric document, stage name map (canonical IDs to provider label names), reply templates with guardrails, per-account feature flags (labels, stages, drafts, escalations, archive-on-ignore).
- **Runtime:** Node.js, local or managed SQLite (optionally encrypted), filesystem for locks and run-state, terminal or job runner for scheduled or manual refresh.

## Setup

### Models

- **Primary reasoning:** Anthropic Claude Sonnet-class model for extraction, scoring, frontier risk scan, stage signal inference, draft writing, and draft review.
- **Embeddings:** Local `all-MiniLM-L6-v2` (384 dimensions) via @huggingface/transformers — no API key needed.

### Environment

- Node 18+
- `ANTHROPIC_API_KEY` for Anthropic cloud API
- SQLite: auto-created on first use

## Steps (summary)

1. Poll email for new threads
2. Deterministic quarantine and sanitization
3. LLM frontier scan for injection/risk
4. Extract lead fields and score with rubric
5. Split-thread detection
6. Apply score labels in email provider
7. Stage signal scanning with approval queue
8. CRM drift detection and sync proposals
9. Context-aware drafts (writer + reviewer)
10. Escalation for high-signal leads

Full guide: inbox-triage-pipeline/kit.md
Source files: inbox-triage-pipeline/src/
