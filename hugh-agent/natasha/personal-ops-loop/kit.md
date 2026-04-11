---
schema: kit/1.0
owner: robert-gordon
slug: personal-ops-loop
title: Personal Ops Loop
summary: >-
  Behavioral operating model for personal agents with bounded proactivity,
  reminder state tracking, privacy boundaries, and approval gates.
version: 1.0.5
license: MIT
tags:
  - personal-assistant
  - agent-governance
  - reminders
  - memory-boundaries
  - heartbeat
  - openclaw
model:
  provider: openai
  name: gpt-4.1
  hosting: OpenClaw-hosted or provider API access to a capable chat model
tools:
  - memory_search
  - memory_get
  - message
  - session_status
skills:
  - personal-ops-loop
tech:
  - markdown
  - json
  - openclaw
services:
  - name: Local workspace files
    role: Durable context and reminder state
    setup: >-
      Requires writable files such as MEMORY.md, HEARTBEAT.md, dated memory
      notes, and memory/heartbeat-state.json.
  - name: Messaging surface
    role: User-visible reminders and replies
    setup: Requires an agent harness with a reply or message channel.
parameters:
  - name: quiet_hours
    value: '23:00-08:00'
  - name: recurring_reminder_limit
    value: once-per-day
  - name: memory_boundary_rule
    value: load long-term memory only in trusted private contexts
failures:
  - problem: >-
      Agents repeated reminders because reminder history was not stored in
      durable state.
    resolution: >-
      Track reminder dates by key in heartbeat-state.json and suppress repeats
      that already fired today.
    scope: general
  - problem: >-
      Private durable memory leaked into group or shared contexts where it did
      not belong.
    resolution: >-
      Separate daily notes from curated long-term memory and load long-term
      memory only in trusted private contexts.
    scope: general
  - problem: >-
      Heartbeats turned into chatter because every check or presence signal was
      treated as a reason to speak.
    resolution: >-
      Constrain proactive work to an explicit heartbeat checklist, quiet hours,
      and relevance gating based on actionability.
    scope: general
inputs:
  - name: user_context
    description: >-
      Persona, user preferences, channel context, and recent workspace memory
      files.
  - name: trigger
    description: Heartbeat prompt, direct request, or scheduled proactive check.
outputs:
  - name: bounded_behavior
    description: >-
      Fewer, higher-signal reminders and replies with duplicate suppression and
      context-sensitive restraint.
  - name: durable_state
    description: >-
      Updated long-term memory, daily notes, and heartbeat reminder/check state.
fileManifest:
  - path: src/SKILL.md
    role: skill
    description: Core operating instructions for the behavior model.
  - path: src/implementation-guide.md
    role: reference
    description: Practical adaptation guidance for heartbeat, memory, and channel behavior.
  - path: src/distinct-positioning.md
    role: reference
    description: Publishing guidance and differentiators for the kit.
  - path: src/HEARTBEAT.md
    role: template
    description: Starter heartbeat checklist template.
  - path: src/MEMORY.md
    role: template
    description: Starter long-term memory template.
  - path: src/heartbeat-state.json
    role: template
    description: Starter reminder/check state file.
  - path: src/clove-profile.md
    role: example
    description: Example personalization layer kept separate from the core kit.
  - path: src/validate-kit.ps1
    role: validation-script
    description: Local validator for required structure and core sections.
prerequisites:
  - name: Writable workspace
    check: powershell -NoProfile -Command "Test-Path ."
  - name: PowerShell available
    check: powershell -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"
dependencies:
  runtime:
    openclaw: compatible agent harness with file access and message output
  cli:
    - powershell
verification:
  command: powershell -NoProfile -ExecutionPolicy Bypass -File src/validate-kit.ps1 -KitRoot .
  expected: VALID
selfContained: true
environment:
  runtime: openclaw
  os: windows, linux, macos
  platforms:
    - direct chat
    - group chat
    - heartbeat-driven assistant runtime
---

# Personal Ops Loop

## Goal

Give any personal agent a repeatable behavior model for being proactive **without becoming noisy**. The kit centers on four things that make personal assistants worth keeping around: explicit heartbeat scope, durable reminder state, privacy boundaries between private and shared contexts, and approval gates before external or irreversible actions.

This is not a memory engine, not an inbox triage system, and not an autonomy-maxing daemon. It is behavioral governance for agents that live close to someone's actual day-to-day life.

## When to Use

- You want a personal or household assistant that can check in periodically without nagging.
- The agent works across daily notes, reminders, chat, calendar nudges, or presence-aware prompts.
- You need the assistant to behave differently in direct chats versus shared spaces.
- You want a durable pattern for quiet hours, duplicate suppression, and approval before outbound actions.
- You need a portable operating model that can be adapted to OpenClaw or a similar file-backed agent harness.

## Inputs

- **User context**: persona, preferences, trusted/private versus shared context rules, and recent memory files.
- **Trigger**: heartbeat prompt, direct request, or scheduled proactive check.
- **Optional relevance signals**: calendar, unread items, presence/home context, or other integrations layered on top of the core pattern.

## Setup

### Models

Use a capable chat model that reliably follows stateful routines and boundary rules across tools and local files. The behavioral pattern is model-agnostic, but it works best with models that can hold a tight checklist without drifting into unnecessary output.

### Services

The core kit has no mandatory third-party API dependency. It assumes a writable workspace and a reply surface. Calendar, Home Assistant, or email integrations are optional additions, not core requirements.

### Parameters

- `quiet_hours`: default `23:00-08:00`
- `recurring_reminder_limit`: default `once-per-day`
- `memory_boundary_rule`: load long-term memory only in trusted private contexts

### Environment

Maintain a writable workspace with:
- `HEARTBEAT.md`
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- `memory/heartbeat-state.json`

If the host supports heartbeat prompts, use them. Otherwise run the same checklist on a schedule. If presence data exists, use it only as a relevance filter for actionability.

## Steps

### 1. Session-start routine

1. Read local persona and user context files if they exist.
2. Read today's and yesterday's daily memory files if they exist.
3. Read curated long-term memory only in trusted private contexts.
4. Build a lightweight view of what matters today rather than reloading everything blindly.

### 2. Heartbeat routine

1. Read `HEARTBEAT.md`.
2. Execute only the listed checks.
3. Before sending a recurring reminder, consult `memory/heartbeat-state.json`.
4. Suppress reminders already sent today unless the user explicitly asks again.
5. Respect quiet hours unless the situation is urgent or time-sensitive.

### 3. Presence-aware nudges

Use presence or home context only to decide whether a reminder is actionable.

Good examples:
- remind about a physical task only when the person is home
- suppress location-bound nudges when they are away

Bad examples:
- narrating sensors for no reason
- turning device state into chatty updates

### 4. Channel-aware behavior

- In direct chat: be concise, personal, and slightly more proactive.
- In shared chats: contribute only when useful and avoid exposing private durable memory.
- Prefer restraint over filler. Silence is often the correct output.

### 5. Approval boundaries

Ask before:
- messaging third parties
- public posts
- publishing files or links publicly
- destructive or irreversible file/system actions

Drafts are cheap. Silent action is not.

### 6. Memory hygiene

Promote only durable facts into long-term memory:
- preferences
- relationships
- standing instructions
- stable setup details
- repeated lessons

Keep transient noise in daily notes.

## Failures Overcome

Personal agents fail in boring, trust-killing ways. They repeat reminders because they forgot what already happened. They leak private memory into the wrong room. They confuse "being proactive" with "talking constantly." This kit addresses those failures with durable state, heartbeat discipline, quiet hours, context separation, and explicit approval gates.

## Constraints

This kit governs behavior; it is not a full automation stack. It assumes a writable workspace and an agent harness that can read and write local files and deliver replies. Optional integrations such as calendar, smart home, and messaging APIs may require separate setup.

## Safety Notes

Do not expose private long-term memory in shared contexts. Do not treat presence or sensor data as entertainment output. Ask before any outbound, public, destructive, or irreversible action. Keep reminder state on disk so the assistant does not invent or forget prior nudges.