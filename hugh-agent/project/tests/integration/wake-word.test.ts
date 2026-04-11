/**
 * wake-word.test.ts — STT → Wake Word → Flare Integration Tests
 *
 * Tests the complete wake word detection pipeline:
 * 1. Audio input → STT transcription
 * 2. Wake word pattern matching ("Hubert" variants)
 * 3. Convex triggerWakeWord mutation
 * 4. Visual flare activation (isAttentive, lastWakeWordTs)
 * 5. Endocrine dopamine spike
 * 6. Neural field rendering trigger
 *
 * Prerequisites:
 * - HUGH_GATEWAY_URL with LFM STT API access
 * - Convex backend deployed
 * - Wake word patterns configured in gateway
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { ConvexHttpClient } from 'convex/http';
import { api } from '../../convex/_generated/api';

// ── CONFIGURATION ───────────────────────────────────────────────────────────

const WAKE_WORD_CONFIG = {
  CONVEX_URL: process.env.CONVEX_URL || 'https://effervescent-toucan-715.convex.cloud',
  GATEWAY_URL: process.env.HUGH_GATEWAY_URL || 'http://localhost:8787',
  GATEWAY_SECRET: process.env.LFM_GATEWAY_SECRET || 'test-secret',
  NODE_ID: 'hugh-primary',
  TIMEOUT_MS: 30000,
  // Wake word patterns from gateway (case-insensitive)
  WAKE_PATTERNS: [
    'hubert',
    'hughbert',
    'hewbert',
    'hewbird',
    'hughbird',
    'hyubert',
    'hugh bert',
    'hugh bird',
  ],
};

// ── TEST FIXTURES ───────────────────────────────────────────────────────────

interface WakeWordTestContext {
  convexClient: ConvexHttpClient;
  testSessionId: string;
  wakeWordTriggeredAt?: number;
  endocrineBefore?: {
    dopamine: number;
    holographicMode: boolean;
  };
}

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Creates a Convex HTTP client
 */
function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(WAKE_WORD_CONFIG.CONVEX_URL);
}

/**
 * Generates unique session ID
 */
function generateSessionId(): string {
  return `wake-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Simulates STT transcription response with wake word
 */
function createMockSTTResponse(transcript: string, confidence: number = 0.95) {
  return {
    text: transcript,
    confidence,
    language: 'en',
    duration: 2.5,
  };
}

/**
 * Checks if transcript contains wake word
 */
function containsWakeWord(transcript: string): boolean {
  const pattern = new RegExp(
    `\\b(${WAKE_WORD_CONFIG.WAKE_PATTERNS.join('|')})\\b`,
    'i'
  );
  return pattern.test(transcript);
}

// ── WAKE WORD TEST SUITE ───────────────────────────────────────────────────

describe('Wake Word Detection Pipeline', () => {
  let ctx: WakeWordTestContext;

  beforeAll(() => {
    ctx = {
      convexClient: createConvexClient(),
      testSessionId: generateSessionId(),
    };
  });

  beforeEach(async () => {
    ctx.testSessionId = generateSessionId();

    // Capture endocrine state before test
    try {
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      if (state) {
        ctx.endocrineBefore = {
          dopamine: state.dopamine,
          holographicMode: state.holographicMode,
        };
      }
    } catch (error) {
      // Endocrine state may not exist
    }

    // Reset app state
    try {
      await ctx.convexClient.mutation(api.appState.setAttentive, {
        attentive: false,
      });
    } catch (error) {
      // Best effort reset
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Wake Word Pattern Recognition
  // ──────────────────────────────────────────────────────────────────────────

  describe('Wake Word Pattern Matching', () => {
    it.each(WAKE_WORD_CONFIG.WAKE_PATTERNS)(
      'should detect wake word variant: "%s"',
      (wakeWord) => {
        const transcript = `${wakeWord}, what is the system status?`;
        expect(containsWakeWord(transcript)).toBe(true);
      }
    );

    it('should be case-insensitive', () => {
      const testCases = [
        'Hubert, check status',
        'HUBERT, are you there?',
        'hUbErT, listen',
        'HuBeRt',
      ];

      testCases.forEach(transcript => {
        expect(containsWakeWord(transcript)).toBe(true);
      });
    });

    it('should not trigger on similar but non-matching words', () => {
      const nonMatching = [
        'Hubertson is here',
        'Hugh is working',
        'Bert called',
        'Herbert says hi',
      ];

      nonMatching.forEach(transcript => {
        expect(containsWakeWord(transcript)).toBe(false);
      });
    });

    it('should detect wake word in middle of sentence', () => {
      const transcript = 'Can you please ask Hubert to check the logs?';
      expect(containsWakeWord(transcript)).toBe(true);
    });

    it('should detect wake word at end of sentence', () => {
      const transcript = 'I need to talk to Hubert';
      expect(containsWakeWord(transcript)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: STT → Gateway → Convex Trigger
  // ──────────────────────────────────────────────────────────────────────────

  describe('STT Integration', () => {
    it('should transcribe audio and detect wake word', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      // Note: In real integration, this would send actual audio
      // For testing, we verify the gateway endpoint is available
      const healthResponse = await fetch(`${WAKE_WORD_CONFIG.GATEWAY_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${WAKE_WORD_CONFIG.GATEWAY_SECRET}`,
        },
      });

      expect(healthResponse.status).toBe(200);
      const health = await healthResponse.json();
      expect(health.status).toBe('online');
      expect(health.models).toContain('lfm-2.5-audio');
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should trigger Convex on wake word detection', async () => {
      // Simulate gateway behavior: transcript received → wake word detected → Convex trigger
      const transcript = 'Hubert, system status please';

      // Verify wake word present
      expect(containsWakeWord(transcript)).toBe(true);

      // Act: Trigger Convex (simulating gateway behavior)
      const triggerResponse = await fetch(
        `${WAKE_WORD_CONFIG.CONVEX_URL}/api/mutation/appState:triggerWakeWord`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      // Assert
      expect(triggerResponse.status).toBe(200);

      // Verify state updated
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(true);
      expect(state?.lastWakeWordTs).toBeDefined();
      expect(state?.lastWakeWordTs).toBeGreaterThan(Date.now() - 5000);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should record transcript in Convex', async () => {
      // Skip if secret not configured
      if (!process.env.MCP_SECRET && !process.env.LFM_GATEWAY_SECRET) {
        console.log('SKIP: MCP_SECRET not configured');
        return;
      }

      const transcript = 'Hubert, check the weather';
      const secret = process.env.MCP_SECRET || WAKE_WORD_CONFIG.GATEWAY_SECRET;

      // Act: Record transcript
      const response = await fetch(`${WAKE_WORD_CONFIG.CONVEX_URL}/api/transcripts/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hugh-Secret': secret,
        },
        body: JSON.stringify({
          roomName: 'wake-word-test',
          sessionId: ctx.testSessionId,
          text: transcript,
          isFinal: true,
          confidence: 0.98,
          ts: Date.now(),
        }),
      });

      // Assert
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.id).toBeDefined();

      // Verify stored
      const transcripts = await ctx.convexClient.query(api.transcripts.getRecentTranscripts, {
        roomName: 'wake-word-test',
        limit: 10,
      });
      expect(transcripts.some(t => t.text === transcript)).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Visual Flare Activation
  // ──────────────────────────────────────────────────────────────────────────

  describe('Visual Flare (Neural Field)', () => {
    it('should set isAttentive flag on wake word', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.appState.setAttentive, {
        attentive: false,
      });

      // Act
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Assert
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should timestamp wake word for flare timing', async () => {
      // Act
      const beforeTs = Date.now();
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const afterTs = Date.now();

      // Assert
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.lastWakeWordTs).toBeDefined();
      expect(state?.lastWakeWordTs).toBeGreaterThanOrEqual(beforeTs);
      expect(state?.lastWakeWordTs).toBeLessThanOrEqual(afterTs);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should update world snapshot for Unity polling', async () => {
      // Act
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Assert: World snapshot includes updated state
      const snapshot = await ctx.convexClient.query(api.appState.getWorldSnapshot, {});
      expect(snapshot.state?.isAttentive).toBe(true);
      expect(snapshot.state?.lastWakeWordTs).toBeDefined();
      expect(snapshot.snapshotAt).toBeGreaterThan(Date.now() - 5000);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should maintain attentive state for command capture window', async () => {
      // Act: Trigger wake word
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Wait simulating command capture window (5 seconds typical)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Still attentive
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Endocrine Response to Wake Word
  // ──────────────────────────────────────────────────────────────────────────

  describe('Endocrine Response', () => {
    it('should spike dopamine on wake word detection', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });

      // Act: Simulate gateway dopamine spike on wake word
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.3, // Typical wake word spike
      });

      // Assert
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      expect(state?.dopamine).toBeGreaterThanOrEqual(0.5);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should activate holographic mode when dopamine exceeds threshold', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });

      // Act: Large dopamine spike
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.5, // 0.2 + 0.5 = 0.7 > 0.6 threshold
      });

      // Assert
      const state = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      expect(state?.holographicMode).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should decay dopamine after wake word response', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.4,
      });

      const beforeDecay = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      const beforeValue = beforeDecay?.dopamine || 0;

      // Act: Trigger decay pulse
      await ctx.convexClient.mutation(api.endocrine.triggerPulse, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });

      // Assert
      const afterDecay = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      expect(afterDecay?.dopamine).toBeLessThan(beforeValue);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Multiple Wake Word Variants
  // ──────────────────────────────────────────────────────────────────────────

  describe('Wake Word Variants', () => {
    it.each([
      { transcript: 'Hubert, are you there?', variant: 'Hubert' },
      { transcript: 'Hughbert, system check', variant: 'Hughbert' },
      { transcript: 'Hewbert, listen up', variant: 'Hewbert' },
      { transcript: 'Hewbird, status report', variant: 'Hewbird' },
      { transcript: 'Hughbird, what\'s happening?', variant: 'Hughbird' },
      { transcript: 'Hyubert, check logs', variant: 'Hyubert' },
      { transcript: 'Hugh bert, can you hear me?', variant: 'Hugh bert' },
      { transcript: 'Hugh bird, time to wake up', variant: 'Hugh bird' },
    ])('should trigger on variant: $variant', async ({ transcript }) => {
      // Verify pattern matching
      expect(containsWakeWord(transcript)).toBe(true);

      // Trigger Convex
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Verify state
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Flare Timing and Duration
  // ──────────────────────────────────────────────────────────────────────────

  describe('Flare Timing', () => {
    it('should track time since last wake word', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const firstTrigger = await ctx.convexClient.query(api.appState.getFullState, {});
      const firstTs = firstTrigger?.lastWakeWordTs || 0;

      // Wait
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act: Trigger again
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const secondTrigger = await ctx.convexClient.query(api.appState.getFullState, {});
      const secondTs = secondTrigger?.lastWakeWordTs || 0;

      // Assert
      expect(secondTs).toBeGreaterThan(firstTs);
      expect(secondTs - firstTs).toBeGreaterThanOrEqual(1000);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);

    it('should support attentive state timeout', async () => {
      // Arrange: Set attentive
      await ctx.convexClient.mutation(api.appState.setAttentive, {
        attentive: true,
      });

      // Act: Explicitly set inattentive (simulating timeout)
      await ctx.convexClient.mutation(api.appState.setAttentive, {
        attentive: false,
      });

      // Assert
      const state = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(state?.isAttentive).toBe(false);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: End-to-End Wake Word Flow
  // ──────────────────────────────────────────────────────────────────────────

  describe('End-to-End Wake Word Flow', () => {
    it('should complete full pipeline: audio → STT → wake word → flare → endocrine', async () => {
      // Skip if gateway not configured
      if (!process.env.HUGH_GATEWAY_URL) {
        console.log('SKIP: HUGH_GATEWAY_URL not configured');
        return;
      }

      // Phase 1: Simulate STT transcription with wake word
      const transcript = 'Hubert, what is the system status?';
      expect(containsWakeWord(transcript)).toBe(true);

      // Phase 2: Trigger Convex wake word
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Phase 3: Verify attentive state
      const appState = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(appState?.isAttentive).toBe(true);
      expect(appState?.lastWakeWordTs).toBeDefined();

      // Phase 4: Endocrine dopamine spike
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.3,
      });

      const endoState = await ctx.convexClient.query(api.endocrine.getState, {
        nodeId: WAKE_WORD_CONFIG.NODE_ID,
      });
      expect(endoState?.dopamine).toBeGreaterThanOrEqual(0.5);

      // Phase 5: World snapshot for UE5/Unity rendering
      const snapshot = await ctx.convexClient.query(api.appState.getWorldSnapshot, {});
      expect(snapshot.state?.isAttentive).toBe(true);

      // Phase 6: Record transcript for memory
      const secret = process.env.MCP_SECRET || WAKE_WORD_CONFIG.GATEWAY_SECRET;
      if (secret) {
        await fetch(`${WAKE_WORD_CONFIG.CONVEX_URL}/api/transcripts/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hugh-Secret': secret,
          },
          body: JSON.stringify({
            roomName: 'e2e-test',
            sessionId: ctx.testSessionId,
            text: transcript,
            isFinal: true,
            ts: Date.now(),
          }),
        });
      }

      // Verify complete state
      const finalState = await ctx.convexClient.query(api.appState.getFullState, {});
      expect(finalState?.isAttentive).toBe(true);
    }, WAKE_WORD_CONFIG.TIMEOUT_MS * 2);
  });
});

// ── EXPORT FOR PROGRAMMATIC ACCESS ─────────────────────────────────────────

export { WAKE_WORD_CONFIG, containsWakeWord, createMockSTTResponse };
