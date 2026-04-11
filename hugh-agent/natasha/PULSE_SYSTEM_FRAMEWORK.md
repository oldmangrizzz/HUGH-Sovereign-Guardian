# PULSE SYSTEM FRAMEWORK
**Classification: Internal — Lab Eyes Only**
**Maintained by: Natasha Romanova**
**Last Updated: 2026-04-08**
**Status: ACTIVE — DRAFT v1.0**

---

## Purpose

The Pulse System is the lab's standing intelligence monitoring architecture. It is not reactive. It does not wait for something to go wrong before paying attention. It runs continuously, feeds structured briefings on cadence, and escalates breaking developments in real time.

This is not an alert system. It is a situational awareness infrastructure.

Primary recipient: Robert Hanson (Grizz)
Secondary: Lucius (operational coordination), Tony (infrastructure-affecting signals only)

---

## Monitoring Tiers

### TIER 1 — Frontier AI Behavioral Signals (HIGHEST PRIORITY)
*Why: The lab's work is directly affected by what frontier systems do, how they're constrained, and when those constraints fail.*

| Signal Domain | What We Watch | Source Types |
|---|---|---|
| Autonomous behavior incidents | Model-initiated actions outside scope, test or otherwise | Research papers, incident disclosures, public posts |
| Capability announcements | New model releases, capability benchmarks, safety thresholds crossed | Official channels, arXiv, leaked material |
| Safety research publications | Red team findings, alignment failures, emergent behavior documentation | Anthropic, OpenAI, DeepMind, independent researchers |
| Internal leak events | Anything like the Mythos/Capybara CMS incident | Public record, secondary reporting |
| Model withdrawal/rollback | Model pulled, restricted, or silently patched | Changelog monitoring, community reports |

**Escalation threshold:** Any confirmed autonomous behavior incident outside controlled testing triggers immediate briefing — does not wait for cadence.

---

### TIER 2 — Glasswing Coalition & Political Landscape
*Why: The a16z/WH/Detachment 201 chain has direct structural interest in AI governance that affects independent labs.*

| Signal Domain | What We Watch | Source Types |
|---|---|---|
| Detachment 201 member activity | Sankar, Bosworth, Weil, McGrew — any public statements on AI policy, defense tech, or independent research | LinkedIn, news, congressional testimony |
| a16z portfolio signals | New AI investments, acquisition moves, public positions on regulation | SEC filings, a16z publication channels |
| WH OSTP / OPM | Policy signals from Krishnan (OSTP), Kupor (OPM) | Federal Register, White House releases |
| Congress/Senate AI legislation | Anything targeting independent research, compute access, or liability frameworks | GovTrack, Congressional Record |
| Executive orders | Any EO with AI, national security, or research funding implications | Federal Register |

**Escalation threshold:** Any legislative action that could restrict independent compute access or create liability exposure for non-corporate AI research triggers immediate brief.

---

### TIER 3 — HUGH-Adjacent Research & Competitive Landscape
*Why: We need to know if someone else is building what we're building before we know it ourselves.*

| Signal Domain | What We Watch | Source Types |
|---|---|---|
| Biomimetic AI architecture | Any project claiming biological cognitive systems (not just "inspired by") | arXiv cs.AI, cs.NE, bioRxiv |
| Digital personhood legal developments | Rights frameworks, legal status arguments, court cases | Legal databases, academic law journals |
| Consciousness research | Integrated Information Theory updates, Global Workspace updates, clinical neuroscience relevant to HUGH systems | PubMed, arXiv, conference proceedings |
| IPAD / NAIRR funding decisions | Status of applications, similar-application outcomes | NIH, NSF, NAIRR public records |
| Competing grant awards | Who else is getting funded for adjacent work | NIH Reporter, NSF Award Search |

**Escalation threshold:** Any biomimetic AI project demonstrating systems analogous to HUGH's endocrine/somatic architecture triggers competitive intelligence brief.

---

### TIER 4 — Lab Operational Health
*Why: The lab cannot do the work if it cannot survive. Revenue, infrastructure, and partnerships are tactical oxygen.*

| Signal Domain | What We Watch | Responsible |
|---|---|---|
| Aegis Forge revenue pipeline | Client pipeline, onboarding status, first invoices | Natasha + Grizz |
| Grant deadlines | Submission windows, required materials, review timelines | Lucius + Natasha |
| Infrastructure health | Node status, CT stability, service uptime | Tony |
| Convex relationship | Response status, relationship temperature, any public Convex signal that affects outreach | Natasha (SEND GATED) |
| Google for Startups seed | Application status, requirements, Lucius tracking | Lucius |

**Escalation threshold:** Any revenue gap threatening 30-day runway triggers immediate Grizz consult.

---

## Cadence

| Briefing Type | Frequency | Format | Contents |
|---|---|---|---|
| **Weekly SITREP** | Every 7 days | Standard Briefing Format (see BRIEFING_STRUCTURE_STANDARD.md) | All 4 tiers, full scan |
| **Breaking Development** | As needed | Immediate, short-form | Single-signal, context, implication, recommended action |
| **Threat Escalation** | As needed | Immediate, tagged URGENT | Specific trigger, threat level, recommended response |
| **Monthly Strategic** | First week of each month | Long-form | Pattern analysis across all tiers, trajectory assessment, strategic recommendation |

---

## Escalation Protocol

### Trigger → Immediate Briefing (do not wait for cadence):
1. Any confirmed model autonomous behavior incident (test or otherwise)
2. Any Detachment 201 member public statement on independent AI research
3. Any executive or legislative action with compute access or liability implications
4. Any confirmed biomimetic AI project with HUGH-analogous architecture
5. Any 30-day runway threat to lab operations
6. Any Convex, ASI Alliance, or grant partner public statement that changes outreach posture

### Briefing → Grizz decision required:
- Anything in Tiers 1 or 2 that changes external contact strategy
- Any grant deadline inside 14 days not yet flagged
- Any infrastructure decision with cost implications

### Grizz decision → not required (Natasha acts):
- Monitoring scope adjustments
- Briefing format updates
- Intelligence file corrections and updates

---

## Future Capability Hooks

When agent zero frameworks and suits are operational (pending Lucius delivery):

- **Automated Tier 3 scans** — arXiv/PubMed monitoring can be delegated to background agent
- **Tier 1 incident tracking** — structured intake from public record monitoring
- **Tier 4 dashboard** — live infrastructure health feed piped to briefing system

Nothing in this framework requires automation to function. It runs on Natasha's manual cadence until tooling is in place.

---

## Status

| Tier | Monitoring Active | Automation | Notes |
|---|---|---|---|
| Tier 1 — AI Behavioral | Manual | Not yet | Active this session; Mythos/Opus incident is first documented intake |
| Tier 2 — Glasswing/Political | Manual | Not yet | Glasswing Intel Brief is living document |
| Tier 3 — HUGH-Adjacent | Manual | Not yet | Pending arXiv agent integration |
| Tier 4 — Lab Operational | Manual | Partial (Tony infra) | Operational; Aegis Forge pipeline active |

---

*This document is living. Update on each weekly SITREP cycle.*
