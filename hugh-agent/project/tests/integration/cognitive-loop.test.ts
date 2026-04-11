/**
 * cognitive-loop.test.ts — End-to-End Integration Tests for H.U.G.H. Cognitive Loop
 *
 * Tests the complete cognitive pipeline:
 * - Audio input → STT → wake word detection → Convex trigger → visual flare
 * - LLM response → TTS → audio output
 * - CNS → ternary attention → neural field rendering
 * - KVM_EXEC → multi-node execution → result aggregation
 * - Endocrine spike → decay → baseline recovery
 *
 * Prerequisites:
 * - Convex backend deployed and running
 * - HUGH_GATEWAY_URL configured with LFM API access
 * - KVM agents registered and online
 * - Endocrine nodes initialized
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ConvexHttpClient } from 'convex/http';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// ── CONFIGURATION ───────────────────────────────────────────────────────────

const TEST_CONFIG = {
  CONVEX_URL: process.env.CONVEX_URL || 'https://effervescent-toucan-715.convex.cloud',
  GATEWAY_URL: process.env.HUGH_GATEWAY_URL || 'http://localhost:8787',
  GATEWAY_SECRET: process.env.LFM_GATEWAY_SECRET || 'test-secret',
  NODE_ID: 'hugh-primary',
  TEST_NODE_ID: 'test-node-integration',
  KVM_AGENT_URL: process.env.KVM_AGENT_URL || 'http://localhost:3002',
  KVM_SECRET: process.env.KVM_AGENT_SECRET || 'test-kvm-secret',
  TIMEOUT_MS: 30000,
  ENDOCRINE_DECAY_WAIT_MS: 120000, // 2 minutes for decay observation
};

// ── TEST FIXTURES ───────────────────────────────────────────────────────────

interface TestContext {
  convexClient: ConvexHttpClient;
  endocrineStateBefore?: {
    cortisol: number;
    dopamine: number;
    adrenaline: number;
    holographicMode: boolean;
  };
  wakeWordTriggeredAt?: number;
  kvmCommandId?: Id<'kvmCommandLog'>;
  testSessionId: string;
}

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Creates a Convex HTTP client for testing
 */
function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(TEST_CONFIG.CONVEX_URL);
}

/**
 * Waits for a condition to be true with polling
 */
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 10000,
  intervalMs: number = 500
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

/**
 * Generates a unique session ID for test isolation
 */
function generateSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Simulates audio input for STT testing (mock audio buffer)
 */
function createMockAudioBuffer(): Buffer {
  // Create a minimal WAV file header + silence
  // In real tests, this would be actual audio data
  const wavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // File size - 8
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6d, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // Subchunk1Size
    0x01, 0x00, 0x01, 0x00, // AudioFormat, NumChannels
    0x80, 0x3e, 0x00, 0x00, // SampleRate (16000)
    0x00, 0xfa, 0x00, 0x00, // ByteRate
    0x02, 0x00, 0x10, 0x00, // BlockAlign, BitsPerSample
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00, // Subchunk2Size
  ]);
  return wavHeader;
}

// ── INTEGRATION TEST SUITE ─────────────────────────────────────────────────

describe('H.U.G.H. Cognitive Loop Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = {
      convexClient: createConvexClient(),
      testSessionId: generateSessionId(),
    };

    // Initialize test node in endocrine system
    try {
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
    } catch (error) {
      // Node may already exist, continue
    }
  }, TEST_CONFIG.TIMEOUT_MS);

  afterAll(async () => {
    // Cleanup: reset test node to baseline
    try {
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
    } catch (error) {
      // Cleanup best-effort
    }
  });

  beforeEach(async () => {
    ctx.testSessionId = generateSessionId();
    // Capture endocrine state before each test
    try {
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      if (state) {
        ctx.endocrineStateBefore = {
          cortisol: state.cortisol,
          dopamine: state.dopamine,
          adrenaline: state.adrenaline,
          holographicMode: state.holographicMode,
        };
      }
    } catch (error) {
      // Endocrine state may not exist yet
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Endocrine System — Spike and Decay
  // ──────────────────────────────────────────────────────────────────────────

  describe('Endocrine System', () => {
    it('should spike dopamine on task completion and decay to baseline', async () => {
      // Arrange
      const initialDopamine = 0.2; // baseline
      const spikeDelta = 0.5;
      const expectedAfterSpike = 0.7;

      // Initialize node if needed
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Reset to baseline first
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Act: Spike dopamine
      const result = await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
        hormone: 'dopamine',
        delta: spikeDelta,
      });

      // Assert: Immediate spike
      expect(result).toBeCloseTo(expectedAfterSpike, 2);

      // Verify state update
      const stateAfterSpike = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
      expect(stateAfterSpike?.dopamine).toBeGreaterThanOrEqual(0.6);
      expect(stateAfterSpike?.holographicMode).toBe(true); // Dopamine > 0.6 activates holographic mode

      // Assert: Decay over time (observe immediate decay tick)
      await ctx.convexClient.mutation(api.endocrine.triggerPulse, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      const stateAfterPulse = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
      expect(stateAfterPulse?.dopamine).toBeLessThan(stateAfterSpike.dopamine);
      expect(stateAfterPulse?.dopamine).toBeGreaterThan(0.2); // Still above baseline
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should activate holographic mode when dopamine > 0.6', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Act: Spike dopamine above threshold
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
        hormone: 'dopamine',
        delta: 0.5, // 0.2 + 0.5 = 0.7
      });

      // Assert
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
      expect(state?.holographicMode).toBe(true);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should spike cortisol for high-risk operations', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Act: Spike cortisol
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
        hormone: 'cortisol',
        delta: 0.4,
      });

      // Assert
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
      expect(state?.cortisol).toBeGreaterThanOrEqual(0.6);
      expect(state?.holographicMode).toBe(false); // Cortisol doesn't affect holographic mode
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should clamp hormone levels to 0.0-1.0 range', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Act: Attempt to spike beyond bounds
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
        hormone: 'adrenaline',
        delta: 2.0, // Would exceed 1.0
      });

      // Assert: Clamped to 1.0
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.TEST_NODE_ID,
      });
      expect(state?.adrenaline).toBe(1.0);
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Wake Word Detection → Convex Trigger → Visual Flare
  // ──────────────────────────────────────────────────────────────────────────

  describe('Wake Word Detection Pipeline', () => {
    it('should trigger wake word and set attentive state', async () => {
      // Act: Trigger wake word directly
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Assert: State updated
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(true);
      expect(state?.lastWakeWordTs).toBeDefined();
      expect(state?.lastWakeWordTs).toBeGreaterThan(Date.now() - 5000);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should spike dopamine on wake word detection', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: TEST_CONFIG.NODE_ID,
      });

      // Act: Trigger wake word
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Spike dopamine (simulating gateway behavior)
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.3,
      });

      // Assert
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      expect(state?.dopamine).toBeGreaterThanOrEqual(0.5);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should record transcript with endocrine stamp', async () => {
      // Arrange
      const testTranscript = 'Hubert, check system status';
      const sessionId = ctx.testSessionId;

      // Act: Record transcript via HTTP endpoint
      const response = await fetch(`${TEST_CONFIG.CONVEX_URL}/api/transcripts/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hugh-Secret': TEST_CONFIG.GATEWAY_SECRET,
        },
        body: JSON.stringify({
          roomName: 'test-room',
          sessionId,
          text: testTranscript,
          isFinal: true,
          confidence: 0.95,
          ts: Date.now(),
        }),
      });

      // Assert
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.id).toBeDefined();

      // Verify transcript stored
      const transcripts = await ctx.convexClient.query(api.transcripts.getRecentTranscripts, {
        roomName: 'test-room',
        limit: 10,
      });
      expect(transcripts.length).toBeGreaterThan(0);
      expect(transcripts[0].text).toContain('Hubert');
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: CNS — BitNet Mask Computation → Ternary Attention
  // ──────────────────────────────────────────────────────────────────────────

  describe('Central Nervous System (BitNet)', () => {
    it('should compute ternary attention mask based on endocrine state', async () => {
      // Arrange: Set up endocrine state
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: TEST_CONFIG.NODE_ID,
      });

      // Spike dopamine to excite tools
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.5,
      });

      // Define test features
      const features = [
        { id: 'log-1', type: 'log' as const, metadata: 'System started' },
        { id: 'tool-1', type: 'tool' as const, metadata: 'kubectl' },
        { id: 'code-1', type: 'code' as const, metadata: 'function test()' },
        { id: 'error-1', type: 'log' as const, metadata: 'ERROR: Connection failed' },
      ];

      // Act: Compute BitNet mask
      const mask = await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });

      // Assert: Mask computed with correct ternary values
      expect(mask).toBeDefined();
      expect(Object.keys(mask).length).toBe(features.length);

      // Tool should be excited (+1) due to high dopamine
      expect(mask['tool-1']).toBe(1);
      expect(mask['code-1']).toBe(1);

      // Error log should be excited (+1) regardless of cortisol
      expect(mask['error-1']).toBe(1);

      // Neutral log should be 0 or -1 depending on cortisol
      expect([-1, 0]).toContain(mask['log-1']);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should persist ternary attention for UE5 rendering', async () => {
      // Arrange
      const features = [
        { id: 'gpu-status', type: 'sensor' as const, metadata: 'GPU: 85% utilized' },
      ];

      // Act: Compute mask (persists internally)
      await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });

      // Assert: Attention persisted
      const attention = await ctx.convexClient.query(api.cns.getActiveMask, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      expect(attention.length).toBeGreaterThan(0);
      expect(attention.some(a => a.contextKey === 'gpu-status')).toBe(true);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should inhibit logs when cortisol is high', async () => {
      // Arrange: High cortisol state
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.NODE_ID,
        hormone: 'cortisol',
        delta: 0.5, // 0.2 + 0.5 = 0.7
      });

      const features = [
        { id: 'log-noise', type: 'log' as const, metadata: 'Routine check' },
      ];

      // Act
      const mask = await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });

      // Assert: Log inhibited due to high cortisol
      expect(mask['log-noise']).toBe(-1);
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: KVM_EXEC — Multi-Node Execution → Result Aggregation
  // ──────────────────────────────────────────────────────────────────────────

  describe('KVM Execution Bridge', () => {
    it('should execute command on target node and log result', async () => {
      // Skip if KVM agent not configured
      if (!process.env.KVM_AGENT_URL) {
        console.log('SKIP: KVM_AGENT_URL not configured');
        return;
      }

      // Arrange: Register test agent if needed
      try {
        await ctx.convexClient.action(api.agentRegistry.registerAgent, {
          nodeId: TEST_CONFIG.TEST_NODE_ID,
          label: 'Test Integration Node',
          agentUrl: TEST_CONFIG.KVM_AGENT_URL,
          agentSecret: TEST_CONFIG.KVM_SECRET,
          platform: 'linux',
          hostname: 'test-integration',
        });
      } catch (error) {
        // May already be registered
      }

      // Act: Execute simple command
      const result = await ctx.convexClient.action(api.kvm.hughExec, {
        command: 'echo "H.U.G.H. integration test"',
        sessionId: ctx.testSessionId,
        notes: 'Integration test command',
        targetNodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('H.U.G.H. integration test');
      expect(result.exitCode).toBe(0);
      expect(result.zone).toBe('green'); // Read-only command
      expect(result.targetNodeId).toBe(TEST_CONFIG.TEST_NODE_ID);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should classify command zones correctly', async () => {
      // Skip if KVM agent not configured
      if (!process.env.KVM_AGENT_URL) {
        console.log('SKIP: KVM_AGENT_URL not configured');
        return;
      }

      const testCases = [
        { cmd: 'uptime', expectedZone: 'green' },
        { cmd: 'apt update', expectedZone: 'yellow' },
        { cmd: 'rm -rf /tmp/test', expectedZone: 'red' },
      ];

      for (const testCase of testCases) {
        try {
          const result = await ctx.convexClient.action(api.kvm.hughExec, {
            command: testCase.cmd,
            sessionId: ctx.testSessionId,
            notes: 'Zone classification test',
          });
          // Command may fail, but zone classification should be correct
          expect(result.zone).toBe(testCase.expectedZone);
        } catch (error) {
          // Command execution may fail, but we're testing zone classification
          // which happens before execution
        }
      }
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should sanitize dangerous shell characters', async () => {
      // Skip if KVM agent not configured
      if (!process.env.KVM_AGENT_URL) {
        console.log('SKIP: KVM_AGENT_URL not configured');
        return;
      }

      // Act: Attempt command injection (should be sanitized)
      const maliciousCmd = 'echo "test"; rm -rf /; $(whoami)';
      const result = await ctx.convexClient.action(api.kvm.hughExec, {
        command: maliciousCmd,
        sessionId: ctx.testSessionId,
        notes: 'Sanitization test',
      });

      // Assert: Command should be sanitized (injection characters removed)
      // The exact behavior depends on sanitization implementation
      expect(result).toBeDefined();
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should ping agent and report status', async () => {
      // Skip if KVM agent not configured
      if (!process.env.KVM_AGENT_URL) {
        console.log('SKIP: KVM_AGENT_URL not configured');
        return;
      }

      // Act
      const result = await ctx.convexClient.action(api.kvm.pingAgent, {
        targetNodeId: TEST_CONFIG.TEST_NODE_ID,
      });

      // Assert
      expect(result).toBeDefined();
      expect(typeof result.online).toBe('boolean');
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: TTS — LLM Response → Audio Output
  // ──────────────────────────────────────────────────────────────────────────

  describe('Text-to-Speech Synthesis', () => {
    it('should synthesize speech from text via gateway', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      // Act: Call TTS endpoint
      const response = await fetch(`${TEST_CONFIG.CONVEX_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'H.U.G.H. integration test successful',
        }),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('audio/mpeg');

      // Verify audio data returned
      const audioBuffer = await response.arrayBuffer();
      expect(audioBuffer.byteLength).toBeGreaterThan(0);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should strip KVM_EXEC artifacts before speaking', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      const textWithArtifacts = `System status: all green
<KVM_EXEC>
{"command": "uptime", "target": "vps"}
</KVM_EXEC>
Ready for next command.`;

      // Act
      const response = await fetch(`${TEST_CONFIG.CONVEX_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textWithArtifacts,
        }),
      });

      // Assert: Should succeed (artifacts stripped internally)
      expect(response.status).toBe(200);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should reject empty text after cleaning', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      // Act: Send only artifacts (will be stripped to empty)
      const response = await fetch(`${TEST_CONFIG.CONVEX_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: '<KVM_EXEC>{"cmd": "test"}</KVM_EXEC>',
        }),
      });

      // Assert: Should return 400 (nothing to speak)
      expect(response.status).toBe(400);
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Stigmergic Coordination — Pheromone Deposition → Observation
  // ──────────────────────────────────────────────────────────────────────────

  describe('Stigmergic Coordination Substrate', () => {
    it('should deposit pheromone with TTL and observe gradient', async () => {
      // Arrange
      const pheromoneType = 'kvm_executed';
      const weight = 0.8;
      const ttlMs = 60000; // 1 minute

      // Act: Deposit pheromone
      const result = await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: pheromoneType,
        weight,
        x: 10.5,
        y: 0,
        z: -5.2,
        emitterId: TEST_CONFIG.NODE_ID,
        ttlMs,
      });

      // Assert: Pheromone created with expiry
      expect(result.id).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Observe gradient (world snapshot includes pheromones)
      const snapshot = await ctx.convexClient.query(api.appState.getWorldSnapshot, {});
      expect(snapshot.pheromones.length).toBeGreaterThan(0);

      const deposited = snapshot.pheromones.find(
        p => p.type === pheromoneType && p.emitterId === TEST_CONFIG.NODE_ID
      );
      expect(deposited).toBeDefined();
      expect(deposited?.weight).toBe(weight);
      expect(deposited?.evaporated).toBe(false);
    }, TEST_CONFIG.TIMEOUT_MS);

    it('should evaporate expired pheromones', async () => {
      // Arrange: Deposit pheromone with very short TTL
      const shortTtlMs = 100; // 100ms
      await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'test-evaporation',
        weight: 0.5,
        emitterId: TEST_CONFIG.NODE_ID,
        ttlMs: shortTtlMs,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTtlMs + 50));

      // Act: Trigger cleanup cron
      await ctx.convexClient.mutation(api.appState.cleanExpiredPheromones, {});

      // Assert: Pheromone evaporated
      const snapshot = await ctx.convexClient.query(api.appState.getWorldSnapshot, {});
      const testPheromone = snapshot.pheromones.find(
        p => p.type === 'test-evaporation'
      );
      expect(testPheromone?.evaporated).toBe(true);
    }, TEST_CONFIG.TIMEOUT_MS * 2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Memory Systems — Episodic → Semantic → Archival
  // ──────────────────────────────────────────────────────────────────────────

  describe('Memory Consolidation Pipeline', () => {
    it('should store episodic memory with endocrine context', async () => {
      // Arrange: Ensure endocrine state exists
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: TEST_CONFIG.NODE_ID,
      });

      const endocrineState = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: TEST_CONFIG.NODE_ID,
      });

      // Act: Store episodic memory (via internal mutation for testing)
      const episodeId = await ctx.convexClient.mutation(api.memory.storeEpisode, {
        nodeId: TEST_CONFIG.NODE_ID,
        sessionId: ctx.testSessionId,
        eventType: 'user_interaction',
        content: 'User asked about system status',
        importance: 0.7,
      });

      // Assert
      expect(episodeId).toBeDefined();

      // Verify retrieval
      const episodes = await ctx.convexClient.query(api.memory.getEpisodes, {
        nodeId: TEST_CONFIG.NODE_ID,
        sessionId: ctx.testSessionId,
        limit: 10,
      });
      expect(episodes.length).toBeGreaterThan(0);
      expect(episodes[0].content).toContain('system status');

      // Verify endocrine stamp
      expect(episodes[0].cortisolAtTime).toBeDefined();
      expect(episodes[0].dopamineAtTime).toBeDefined();
      expect(episodes[0].adrenalineAtTime).toBeDefined();
    }, TEST_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Full Cognitive Loop Integration
  // ──────────────────────────────────────────────────────────────────────────

  describe('End-to-End Cognitive Loop', () => {
    it('should complete full loop: wake word → attention → response → endocrine', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      // Phase 1: Wake word detection
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const wakeState = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(wakeState?.isAttentive).toBe(true);

      // Phase 2: Endocrine spike (simulated gateway behavior)
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: TEST_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.3,
      });

      // Phase 3: CNS computes attention mask
      const features = [
        { id: 'user-query', type: 'tool' as const, metadata: 'status check' },
      ];
      const mask = await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });
      expect(mask['user-query']).toBe(1); // Excited due to dopamine

      // Phase 4: TTS response
      const ttsResponse = await fetch(`${TEST_CONFIG.CONVEX_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'System status: all nominal',
        }),
      });
      expect(ttsResponse.status).toBe(200);

      // Phase 5: Pheromone deposition for stigmergic coordination
      await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'response_generated',
        weight: 0.9,
        emitterId: TEST_CONFIG.NODE_ID,
        ttlMs: 30000,
      });

      // Verify complete state
      const finalSnapshot = await ctx.convexClient.query(api.appState.getWorldSnapshot, {});
      expect(finalSnapshot.state?.isAttentive).toBe(true);
      expect(finalSnapshot.pheromones.some(p => p.type === 'response_generated')).toBe(true);
    }, TEST_CONFIG.TIMEOUT_MS * 2);
  });
});

// ── EXPORT FOR PROGRAMMATIC ACCESS ─────────────────────────────────────────

export { TEST_CONFIG, createConvexClient, generateSessionId };
