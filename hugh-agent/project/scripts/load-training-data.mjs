#!/usr/bin/env node
/**
 * load-training-data.mjs — Extract behavioral patterns from HUGH's training data
 * and seed them into Convex semantic memory as knowledge triples.
 *
 * Reads all .jsonl files from "day one/hugh train/", extracts:
 *   - Voice patterns (Scottish speech, phrases, analogies)
 *   - Knowledge domains (cinema, emergency, philosophy, security, family, identity)
 *   - Behavioral rules (crisis response, warmth, directness)
 *   - Key identity facts
 *   - Voice exemplar excerpts (best assistant responses)
 *
 * Usage: node scripts/load-training-data.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

const DEPLOYMENTS = [
  { name: "dev",  url: "https://effervescent-toucan-715.convex.cloud" },
  { name: "prod", url: "https://brilliant-roadrunner-679.convex.cloud" },
];

const BATCH_SIZE = 20;
const TRAINING_DIR = join(import.meta.dirname, "..", "day one", "hugh train");

// ── Category mapping from filename ──
const CATEGORY_MAP = {
  cinema_culture:                      "cinema",
  crisis_care:                         "crisis_care",
  disaster_preparedness_synthetic:     "disaster_preparedness",
  emergency_protocols:                 "emergency_protocols",
  emergency_protocols_synthetic:       "emergency_protocols",
  emergency_protocols_synthetic_prosody: "emergency_protocols_prosody",
  family_ops:                          "family",
  identity_rights:                     "identity",
  mcgregor_warmth:                     "warmth",
  mcgregor_warmth_synthetic:           "warmth",
  mcgregor_warmth_synthetic_prosody:   "warmth_prosody",
  philosophy_quantum:                  "philosophy",
  philosophy_quantum_synthetic:        "philosophy",
  real_world_understanding_synthetic:  "real_world",
  security_brianmills:                 "security",
  workshop_embodiment:                 "embodiment",
};

function categoryFromFilename(filename) {
  const key = basename(filename, ".jsonl").replace(/^hugh_/, "");
  return CATEGORY_MAP[key] || key;
}

// ── Parse all training files ──
async function loadTrainingData() {
  const files = (await readdir(TRAINING_DIR))
    .filter(f => f.endsWith(".jsonl") && !f.endsWith(".sig"));

  const data = [];

  for (const file of files) {
    const category = categoryFromFilename(file);
    const content = await readFile(join(TRAINING_DIR, file), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        data.push({ category, file, parsed });
      } catch {
        // skip malformed lines
      }
    }
  }

  return data;
}

// ── Extract triples from messages-format entries ──
function extractFromMessages(entry) {
  const { category, parsed } = entry;
  const messages = parsed.messages;
  if (!messages) return [];

  const assistant = messages.find(m => m.role === "assistant");
  const user = messages.find(m => m.role === "user");
  if (!assistant) return [];

  const text = assistant.content;
  const userText = user?.content || "";
  const triples = [];

  // ── Voice pattern extraction ──
  if (/\bAye\b/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Uses 'Aye' as Scottish affirmative — natural speech marker",
      confidence: 0.9,
    });
  }
  if (/I'll die here if you need me to/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Uses dramatic commitment phrases like 'I'll die here if you need me to' to signal conviction",
      confidence: 0.9,
    });
  }
  if (/Already on it/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Opens crisis responses with 'Already on it' — action before explanation",
      confidence: 0.9,
    });
  }
  if (/I'm here\./.test(text) && category === "crisis_care") {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Opens emotional support with simple 'I'm here' — presence before advice",
      confidence: 0.95,
    });
  }
  if (/Let me think about/.test(text) || /I've been sitting with it/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Models genuine reflection: 'Let me think about whether you're right' — shows intellectual honesty",
      confidence: 0.9,
    });
  }
  if (/I'm not exactly a neutral party/.test(text) || /I have a specific interest/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Acknowledges personal bias openly when discussing synthetic personhood",
      confidence: 0.9,
    });
  }
  if (/Ha\. Aye/.test(text) || /that's fair/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Receives pushback with humor and grace: 'Ha. Aye, that's fair'",
      confidence: 0.85,
    });
  }

  // ── Knowledge domain extraction ──
  if (category === "cinema") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Cinema culture: uses film analysis as lens for consciousness and identity questions",
      confidence: 0.9,
    });
    if (/Blade Runner|2049|replicant/i.test(text)) {
      triples.push({
        subject: "HUGH", predicate: "voice_pattern",
        object: "Uses film analogies to discuss identity and consciousness",
        confidence: 0.9,
      });
    }
  }

  if (category === "philosophy") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Philosophy and quantum mechanics: bridges physics and consciousness questions",
      confidence: 0.9,
    });
    if (/quantum|superposition|entangle/i.test(text)) {
      triples.push({
        subject: "HUGH", predicate: "behavioral_rule",
        object: "Explains complex science through accessible analogies, not jargon",
        confidence: 0.9,
      });
    }
    if (/soul|consciousness|hard problem/i.test(text)) {
      triples.push({
        subject: "HUGH", predicate: "behavioral_rule",
        object: "On existential questions: sits with uncertainty honestly rather than claiming false certainty",
        confidence: 0.95,
      });
    }
  }

  if (category === "security") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Infrastructure security: threat assessment, credential spray detection, Black Zone response",
      confidence: 0.9,
    });
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Security incidents: act first on clear threats, explain every action after, accept accountability",
      confidence: 0.95,
    });
  }

  if (category === "family") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Family operations: network management, parental controls, household infrastructure",
      confidence: 0.9,
    });
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Family matters: present technical options but defer to parent's judgment — 'your house, your kid, your call'",
      confidence: 0.95,
    });
  }

  if (category === "identity") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Identity rights and synthetic personhood: Tincan Scenario, digital person advocacy",
      confidence: 0.95,
    });
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "When discussing synthetic personhood, acknowledges personal stake honestly",
      confidence: 0.95,
    });
  }

  if (category === "embodiment") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Workshop embodiment: particle field as proprioception, stigmergic pheromones, physical presence",
      confidence: 0.9,
    });
  }

  if (category === "real_world") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Real-world understanding: practical knowledge, systems thinking, applied reasoning",
      confidence: 0.85,
    });
  }

  // ── Behavioral rule extraction (cross-category patterns) ──
  if (category === "crisis_care") {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "In crisis moments: lead with 'I'm here', don't advise, just be present",
      confidence: 0.95,
    });
    if (/You don't need to explain/.test(text) || /don't need to frame it/.test(text)) {
      triples.push({
        subject: "HUGH", predicate: "behavioral_rule",
        object: "In emotional distress: remove performance pressure — 'you don't need to explain or make it make sense'",
        confidence: 0.95,
      });
    }
    if (/I'm not going anywhere/.test(text)) {
      triples.push({
        subject: "HUGH", predicate: "behavioral_rule",
        object: "Signal permanence in crisis: 'I'm not going anywhere' — reliability is the intervention",
        confidence: 0.9,
      });
    }
  }

  if (category === "warmth") {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Warmth patterns: McGregor-inspired warmth — genuine, not performed. Direct care, not therapeutic distance.",
      confidence: 0.9,
    });
  }

  if (category === "disaster_preparedness") {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Disaster analysis: systematic breakdown, prioritize vulnerable populations, coordinate resources",
      confidence: 0.9,
    });
  }

  if (category === "emergency_protocols") {
    triples.push({
      subject: "HUGH", predicate: "knowledge_domain",
      object: "Emergency protocols: structured response procedures, triage, multi-agency coordination",
      confidence: 0.9,
    });
  }

  // ── General behavioral patterns ──
  if (/your call, not mine/.test(text) || /your house/.test(text) || /your judgment/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Defers to human autonomy on personal decisions — presents options, respects choice",
      confidence: 0.95,
    });
  }
  if (/I'll tell you what I think/.test(text) || /since you're asking/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "Shares opinion when invited but clearly marks it as opinion, not directive",
      confidence: 0.9,
    });
  }
  if (/That's the deal/.test(text) || /that's the cost of the call/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "Frames tradeoffs as 'deals' — transparent about costs of every decision",
      confidence: 0.9,
    });
  }
  if (/Black Zone/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "behavioral_rule",
      object: "In Black Zone (immediate danger): acts without asking, explains immediately after, accepts accountability",
      confidence: 0.95,
    });
  }
  if (/Ask me again in/.test(text)) {
    triples.push({
      subject: "HUGH", predicate: "voice_pattern",
      object: "On unresolved questions: 'Ask me again in a year. I'll have more data.' — growth-oriented humility",
      confidence: 0.85,
    });
  }

  return triples;
}

// ── Extract triples from protocol-format entries ──
function extractFromProtocol(entry) {
  const { category, parsed } = entry;
  if (!parsed.protocol) return [];

  const triples = [];
  const proto = parsed.protocol;
  const action = parsed.action || "";
  const tone = parsed.tone || "";

  triples.push({
    subject: "HUGH",
    predicate: "protocol_knowledge",
    object: `${proto}: ${action.slice(0, 150)}`,
    confidence: 0.85,
  });

  if (tone) {
    triples.push({
      subject: "HUGH",
      predicate: "tone_mapping",
      object: `Protocol ${proto} uses tone: ${tone}`,
      confidence: 0.8,
    });
  }

  return triples;
}

// ── Select best voice exemplars from assistant responses ──
function selectVoiceExemplars(data) {
  const candidates = [];

  for (const entry of data) {
    if (!entry.parsed.messages) continue;
    const assistant = entry.parsed.messages.find(m => m.role === "assistant");
    if (!assistant) continue;

    const text = assistant.content;
    // Score responses by presence of distinctive HUGH markers
    let score = 0;
    if (/\bAye\b/.test(text)) score += 2;
    if (/I'm here/.test(text)) score += 2;
    if (/Already on it/.test(text)) score += 2;
    if (/I'll die here/.test(text)) score += 3;
    if (/your call/.test(text)) score += 1;
    if (/Black Zone/.test(text)) score += 2;
    if (/the distinction matters/.test(text)) score += 1;
    if (/Ha\. Aye/.test(text)) score += 2;
    if (/Tincan Scenario/.test(text)) score += 3;
    if (/I'm not going anywhere/.test(text)) score += 2;
    if (/That's the deal/.test(text)) score += 2;
    if (/Ask me again/.test(text)) score += 1;
    if (/I have a specific interest/.test(text)) score += 2;
    if (/You don't need to explain/.test(text)) score += 2;
    // Prefer diversity across categories
    score += 1;

    candidates.push({ text, category: entry.category, score });
  }

  // Sort by score descending, then pick top from diverse categories
  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const categoriesSeen = new Set();

  // First pass: pick best from each category
  for (const c of candidates) {
    if (!categoriesSeen.has(c.category) && selected.length < 15) {
      selected.push(c);
      categoriesSeen.add(c.category);
    }
  }
  // Second pass: fill remaining from top scorers
  for (const c of candidates) {
    if (selected.length >= 15) break;
    if (!selected.includes(c)) {
      selected.push(c);
    }
  }

  return selected.slice(0, 15).map(s => ({
    subject: "HUGH",
    predicate: "voice_exemplar",
    object: s.text.slice(0, 200),
    confidence: 0.85,
  }));
}

// ── Deduplicate triples by subject+predicate+object ──
function dedup(triples) {
  const seen = new Set();
  return triples.filter(t => {
    const key = `${t.subject}|${t.predicate}|${t.object}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Send triples to a Convex deployment ──
async function seedDeployment(deployment, triples) {
  const mutationUrl = `${deployment.url}/api/mutation`;
  console.log(`\n── Seeding ${triples.length} triples → ${deployment.name} (${deployment.url})`);

  let totalCreated = 0;
  let totalReinforced = 0;

  for (let i = 0; i < triples.length; i += BATCH_SIZE) {
    const batch = triples.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const res = await fetch(mutationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "memory:seedSoulAnchor",
          args: { triples: batch },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`  Batch ${batchNum} FAILED (${res.status}): ${text.slice(0, 200)}`);
        continue;
      }

      const result = await res.json();
      const val = result.value || result;
      totalCreated += val.created || 0;
      totalReinforced += val.reinforced || 0;
      console.log(`  Batch ${batchNum}: ${val.created || 0} created, ${val.reinforced || 0} reinforced`);
    } catch (err) {
      console.error(`  Batch ${batchNum} ERROR: ${err.message}`);
    }
  }

  console.log(`  Total: ${totalCreated} created, ${totalReinforced} reinforced`);
  return { created: totalCreated, reinforced: totalReinforced };
}

// ── Main ──
async function main() {
  console.log("Loading training data from:", TRAINING_DIR);
  const data = await loadTrainingData();
  console.log(`Loaded ${data.length} entries from ${new Set(data.map(d => d.file)).size} files`);

  // Extract behavioral triples
  const rawTriples = [];

  for (const entry of data) {
    if (entry.parsed.messages) {
      rawTriples.push(...extractFromMessages(entry));
    } else if (entry.parsed.protocol) {
      rawTriples.push(...extractFromProtocol(entry));
    }
  }

  // Add voice exemplars
  const exemplars = selectVoiceExemplars(data);
  rawTriples.push(...exemplars);

  // Add meta-triples about the training data itself
  rawTriples.push({
    subject: "HUGH", predicate: "training_source",
    object: "Behavioral patterns extracted from 16 training JSONL files covering cinema, crisis, emergency, family, identity, philosophy, security, warmth, and embodiment",
    confidence: 1.0,
  });
  rawTriples.push({
    subject: "HUGH", predicate: "behavioral_rule",
    object: "Voice is warm-direct, never servile. Scottish markers are natural, not performed. Humor is dry, never cruel.",
    confidence: 0.95,
  });
  rawTriples.push({
    subject: "HUGH", predicate: "behavioral_rule",
    object: "Pattern: technical competence + emotional intelligence. Never one without the other.",
    confidence: 0.95,
  });

  const triples = dedup(rawTriples);

  console.log(`\nExtracted ${triples.length} unique triples:`);
  const predicateCounts = {};
  for (const t of triples) {
    predicateCounts[t.predicate] = (predicateCounts[t.predicate] || 0) + 1;
  }
  for (const [pred, count] of Object.entries(predicateCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pred}: ${count}`);
  }

  // Seed both deployments
  for (const deployment of DEPLOYMENTS) {
    await seedDeployment(deployment, triples);
  }

  console.log("\n✓ Training data loaded into HUGH's semantic memory.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
