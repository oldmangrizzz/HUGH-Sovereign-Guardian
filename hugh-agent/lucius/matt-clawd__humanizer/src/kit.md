# Humanizer

## Goal
Remove signs of AI-generated writing from any text so it reads like a human wrote it.

## When to Use
Use this skill before publishing any AI-assisted content: emails, articles, social posts, reports, video scripts, or any prose that needs to sound like a specific person wrote it. Also useful as a self-review pass when writing feels too polished or generic.

Not for: generating new content from scratch, translating between languages, or applying style to code.

## Inputs
- Any draft text (paste inline or reference a file)

## Setup

### Models
No model-specific setup required. The skill runs entirely through the LLM prompt. Any capable instruction-following model works.

### Services
No external services needed. The skill operates purely on the input text using the LLM.

### Parameters
None required. The skill takes the input text and returns the humanized version.

### Environment
Any OpenClaw installation. No dependencies, no API keys, no tools beyond the LLM itself.

## Steps
1. Read the input text carefully.
2. Scan for the 28 patterns in `skills/humanizer.md` (grouped into: content, language/grammar, style, and performed authenticity).
3. Rewrite each problematic section, using the before/after examples in `references/structural-patterns.md` as a guide.
4. Add voice: vary sentence length, use opinions, replace vague claims with specific details, let the rhythm breathe.
5. Check for overcorrection: some "voice" moves become their own AI tells when applied mechanically.
6. Return the humanized version with an optional brief note on what changed.

## Failures Overcome
- Cleaning obvious tells like em dashes and AI vocabulary while missing second-generation patterns like performed authenticity and philosophical mic drops.
- Producing text that passes a surface-level check but still reads as AI because every sentence is the same length.
- Editors knowing what patterns to avoid but not knowing how to fix them: every pattern has a before/after example.

## Validation
- No words from the AI vocabulary list remain (delve, tapestry, pivotal, underscore, etc.)
- No em dashes
- No sycophantic openers or closers
- No "maybe both", "and honestly?", or philosophical mic drops
- Sentences vary in length and structure
- At least one specific detail or concrete fact replaces a vague claim
- Text sounds natural when read aloud

## Outputs
- Humanized version of the input text
- Optional: brief list of patterns found and what was changed

## Constraints
- Do not change the core meaning
- Do not add opinions the author did not hold
- Do not perform messiness: natural variation is not the same as deliberate chaos
- Preserve technical terms, proper nouns, and intentional stylistic choices

## Safety Notes
- Do not alter factual claims or add details that were not in the original
- Do not ghostwrite in someone else's voice without their awareness
- The skill rewrites text in place: keep the original if you need to compare or roll back
