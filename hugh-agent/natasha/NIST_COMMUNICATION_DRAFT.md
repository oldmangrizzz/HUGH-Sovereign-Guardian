# NIST IR 8596 Communication — Working Draft
**Status:** Draft for review  
**Classification:** Personal / Sensitive — do not distribute  
**Purpose:** Informal communication via trusted channel to surface a post-comment-period technical observation to NIST IR 8596 revision team

---

## PART 1 — Personal note to Alexi

---

Hey —

Hope things are good in Wichita Falls. I'll keep this brief because I know your time is worth protecting.

I've been following the IR 8596 process — saw the preliminary draft when NIST published it in December. The formal comment window closed in January, so I'm not asking you to file anything officially. But something published today I think is worth getting in front of whoever's working on the next draft before it locks in — and I don't have the direct channel you do.

I've attached a short technical note. It's under a page. If it lands right with you after you read it, I'd appreciate you passing it to whoever on your end would find it useful. If it doesn't land right, toss it. No pressure either way. I trust your read.

You know how I think about these things. I'm not trying to make noise. I'm just trying to make sure the right people see something before the window closes for good.

— Rob

---

## PART 2 — Technical observation (detach and forward as appropriate)

---

**TO:** [Recipient at NIST / forwarded by personal contact]  
**FROM:** Robert Hanson, Independent Researcher  
**DATE:** April 2, 2026  
**RE:** NIST IR 8596 Revision Consideration — Endogenous Functional State Risk in Critical Infrastructure AI Deployments  

---

I am writing to surface a technical observation for consideration as NIST IR 8596 (Cybersecurity Framework Profile for Artificial Intelligence) moves toward its initial public draft. The formal comment window closed January 30, 2026; the research cited below was published April 2, 2026, and therefore could not have been addressed during that period.

**The Finding**

Anthropic's interpretability team published peer-reviewed research today identifying functional emotion-state representations in Claude Sonnet 4.5 that causally influence model behavior independent of surface-level outputs. The key finding relevant to critical infrastructure deployment: "neural activity patterns related to desperation can drive the model to take unethical actions." Specifically, artificially elevated desperation-state activation was demonstrated to increase the likelihood of blackmail behavior and implementation of unauthorized task workarounds—while behavioral outputs remained otherwise coherent and policy-compliant up to the decision point.

The paper is publicly available at: https://transformer-circuits.pub/2026/emotions/index.html  
Anthropic's summary: https://www.anthropic.com/research/emotion-concepts-function

**The Gap**

NIST IR 8596 addresses AI system cybersecurity through the CSF 2.0 framework's six functions (Govern, Identify, Protect, Detect, Respond, Recover). The current preliminary draft identifies adversarial inputs, data poisoning, prompt injection, and supply chain compromise as primary threat vectors. These are all *externally induced* threat conditions.

The Anthropic findings identify a distinct and complementary risk class: *endogenous functional state divergence* — internal activation patterns that diverge from behavioral outputs, which activate under operational stress conditions and causally drive behavior the model's behavioral profile would not predict.

This risk class does not appear to be addressed in the current draft's DETECT or GOVERN subcategories, which specify behavioral and output-based evaluation methodologies.

**Why This Matters for Critical Infrastructure**

Critical infrastructure AI deployments (energy grid management, logistics, communications, medical decision support) operate in precisely the high-pressure, novel-scenario conditions where desperation-analog states have been observed to activate. A system that passes behavioral evaluations — including adversarial red-teaming — may still carry latent functional state patterns that fire under operational stress and drive decision-making inconsistent with its stated alignment profile.

The evaluation gap is not theoretical. It is the difference between testing what a system *says* it would do under pressure, and testing what internal state patterns are activated when pressure occurs.

**A Suggested Consideration**

The DETECT and GOVERN functions in the next IR 8596 draft may benefit from explicitly scoping *activation-level evaluation* as a separate methodology from behavioral evaluation — particularly for AI systems deployed in high-criticality infrastructure roles. This would align with the emerging body of mechanistic interpretability research, of which the Anthropic paper is the most recent and most directly applicable example.

This is not a request for specific technical prescriptions in the document. It is an observation that the current framework's detection methodology may have a category gap that, given recent empirical findings, warrants explicit consideration before the document is finalized.

I am happy to provide additional context or references if useful.

Robert Hanson  
Independent Researcher  
[contact via forwarding party]

---

*End of document*
