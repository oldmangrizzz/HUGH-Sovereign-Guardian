# Sponsor Lead Scoring Rubric (Template)

Version: YYYY-MM-DD-v1

This rubric defines how to score inbound sponsor leads (0 to 100).

## Core idea

High score = real sponsor with clear ask, credible company, relevant audience fit,
potential to close quickly with reasonable terms.

Low score = spam, generic blasts, affiliate offers, link-only pitches, unclear asks.

## Scoring dimensions (approximate weighting)

1) Fit (0-25)
   - Strong: AI practitioners, dev tools, research tooling, productivity for builders
   - Moderate: consumer AI products (photo tools, writing assistants)
   - Weak: mass-market products with no AI angle

2) Clarity and completeness (0-25)
   - Deliverables requested are clear
   - Success criteria stated (CTA, goals, tracking)
   - Timing or target window shared

3) Budget and seriousness (0-20)
   - Strong: budget range provided, or asking for rate card
   - Neutral: no budget in first-touch (this is normal)
   - Weak: affiliate-only or free offers

4) Company trust and recognition (0-20)
   - Well-known brand is a strong positive
   - Real company domain, real person, specific role
   - Agency is OK when represented brand is explicitly named

5) Close likelihood (0-10)
   - Wants next steps (call, confirmation, contract)
   - Near-term timeline

## Flags (always set when applicable)

- possible_spam
- missing_budget
- missing_deliverables
- missing_timeline
- unknown_company_profile
- agency_without_named_brand
- needs_human_review
- likely_templated

## Buckets

- 90-100: exceptional, escalate
- 75-89: high, escalate
- 50-74: medium, reply with qualification questions
- 25-49: low, likely not a fit
- 0-24: spam/noise, ignore

## Recommended actions

- escalate: high/exceptional bucket
- reply_send_sponsor_options: legit but incomplete
- reply_not_a_fit: legit but poor fit
- reply_soft_decline: short decline for low-risk threads
- ignore: spam/noise or disallowed categories
