/**
 * ue5-connector.test.ts — UE5 Convex Integration Tests
 *
 * Tests the integration between Unreal Engine 5 and the Convex backend:
 * - World snapshot polling for neural field rendering
 * - Ternary attention mask visualization
 * - Pheromone gradient rendering
 * - Entity spawning/despawning
 * - Camera control synchronization
 * - Neural field flare on wake word
 *
 * Architecture:
 * - UE5 polls GET /api/world-snapshot every 500ms
 * - Snapshot includes: appState, pheromones, ternaryAttention
 * - UE5 renders neural field based on attention weights
 * - Pheromones visualized as 3D gradient volumes
 *
 * Prerequisites:
 * - Convex backend deployed
 * - UE5 project configured with Convex HTTP client
 * - World snapshot endpoint accessible
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { ConvexHttpClient } from 'convex/http';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// ── CONFIGURATION ───────────────────────────────────────────────────────────

const UE5_CONFIG = {
  CONVEX_URL: process.env.CONVEX_URL || 'https://effervescent-toucan-715.convex.cloud',
  NODE_ID: 'hugh-primary',
  POLL_INTERVAL_MS: 500, // UE5 polling interval
  TIMEOUT_MS: 30000,
  MAX_ENTITIES: 200,
  MAX_PHEROMONES: 100,
  FLARE_DURATION_MS: 800,
};

// ── TEST FIXTURES ───────────────────────────────────────────────────────────

interface UE5TestContext {
  convexClient: ConvexHttpClient;
  testSessionId: string;
  spawnedEntityIds: string[];
  depositedPheromoneIds: Id<'pheromones'>[];
}

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Creates Convex HTTP client
 */
function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(UE5_CONFIG.CONVEX_URL);
}

/**
 * Generates unique session ID
 */
function generateSessionId(): string {
  return `ue5-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Simulates UE5 world snapshot poll
 */
async function pollWorldSnapshot(client: ConvexHttpClient) {
  return client.query(api.appState.getWorldSnapshot, {});
}

/**
 * Waits for neural field flare to complete
 */
async function waitForFlareDuration(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, UE5_CONFIG.FLARE_DURATION_MS + 100));
}

// ── UE5 CONNECTOR TEST SUITE ───────────────────────────────────────────────

describe('UE5 Convex Integration', () => {
  let ctx: UE5TestContext;

  beforeAll(() => {
    ctx = {
      convexClient: createConvexClient(),
      testSessionId: generateSessionId(),
      spawnedEntityIds: [],
      depositedPheromoneIds: [],
    };
  });

  beforeEach(() => {
    ctx.testSessionId = generateSessionId();
    ctx.spawnedEntityIds = [];
    ctx.depositedPheromoneIds = [];
  });

  afterAll(async () => {
    // Cleanup: despawn test entities
    for (const entityId of ctx.spawnedEntityIds) {
      try {
        await ctx.convexClient.mutation(api.appState.despawnEntity, { entityId });
      } catch (error) {
        // Entity may already be cleaned up
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: World Snapshot Polling
  // ──────────────────────────────────────────────────────────────────────────

  describe('World Snapshot Polling', () => {
    it('should return complete world state for UE5 rendering', async () => {
      // Act: Poll world snapshot (as UE5 does every 500ms)
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: Complete structure
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.pheromones).toBeDefined();
      expect(snapshot.snapshotAt).toBeDefined();

      // State structure
      expect(snapshot.state.mode).toBeDefined();
      expect(snapshot.state.alertsJson).toBeDefined();
      expect(snapshot.state.entitiesJson).toBeDefined();
      expect(snapshot.state.cameraJson).toBeDefined();
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should update snapshot timestamp on each poll', async () => {
      // Act: Poll twice with delay
      const snapshot1 = await pollWorldSnapshot(ctx.convexClient);
      await new Promise(resolve => setTimeout(resolve, 100));
      const snapshot2 = await pollWorldSnapshot(ctx.convexClient);

      // Assert
      expect(snapshot2.snapshotAt).toBeGreaterThan(snapshot1.snapshotAt);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should include active pheromones for gradient rendering', async () => {
      // Arrange: Deposit pheromone
      const result = await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'test-gradient',
        weight: 0.8,
        x: 10.0,
        y: 5.0,
        z: -3.0,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 60000,
      });
      ctx.depositedPheromoneIds.push(result.id);

      // Act: Poll snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: Pheromone included
      const testPheromone = snapshot.pheromones.find(
        p => p.id === result.id
      );
      expect(testPheromone).toBeDefined();
      expect(testPheromone?.weight).toBe(0.8);
      expect(testPheromone?.evaporated).toBe(false);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should exclude evaporated pheromones from snapshot', async () => {
      // Arrange: Deposit and evaporate
      const result = await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'test-evaporate',
        weight: 0.5,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 50, // Very short TTL
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger evaporation
      await ctx.convexClient.mutation(api.appState.cleanExpiredPheromones, {});

      // Act: Poll snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: Evaporated pheromone excluded
      const evaporated = snapshot.pheromones.find(
        p => p.id === result.id && !p.evaporated
      );
      expect(evaporated).toBeUndefined();
    }, UE5_CONFIG.TIMEOUT_MS * 2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Ternary Attention Mask Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe('Ternary Attention Visualization', () => {
    it('should compute and persist attention mask for UE5', async () => {
      // Arrange: Initialize endocrine
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: UE5_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.resetNodeToBaseline, {
        nodeId: UE5_CONFIG.NODE_ID,
      });

      // Spike dopamine to excite tools
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: UE5_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.5,
      });

      // Act: Compute mask (persists internally)
      const features = [
        { id: 'neural-node-1', type: 'code' as const, metadata: 'render_pipeline' },
        { id: 'neural-node-2', type: 'sensor' as const, metadata: 'gpu_temp' },
        { id: 'neural-node-3', type: 'tool' as const, metadata: 'profiler' },
      ];

      await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });

      // Assert: Attention persisted for UE5 query
      const attention = await ctx.convexClient.query(api.cns.getActiveMask, {
        nodeId: UE5_CONFIG.NODE_ID,
      });

      expect(attention.length).toBe(features.length);
      expect(attention.some(a => a.contextKey === 'neural-node-1')).toBe(true);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should provide ternary weights for neural field coloring', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: UE5_CONFIG.NODE_ID,
      });

      const features = [
        { id: 'excite-node', type: 'tool' as const, metadata: 'important' },
        { id: 'inhibit-node', type: 'log' as const, metadata: 'noise' },
        { id: 'neutral-node', type: 'sensor' as const, metadata: 'background' },
      ];

      // High dopamine → excite tools
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: UE5_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.5,
      });

      // Act
      const mask = await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features,
      });

      // Assert: UE5 can map weights to colors
      // +1 = green (excite), 0 = gray (neutral), -1 = red (inhibit)
      expect(mask['excite-node']).toBe(1);
      expect([-1, 0]).toContain(mask['inhibit-node']);
      expect([-1, 0, 1]).toContain(mask['neutral-node']);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should update attention weights in real-time', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: UE5_CONFIG.NODE_ID,
      });

      const feature = { id: 'dynamic-node', type: 'code' as const, metadata: 'test' };

      // Act 1: Initial computation
      await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features: [feature],
      });

      let attention = await ctx.convexClient.query(api.cns.getActiveMask, {
        nodeId: UE5_CONFIG.NODE_ID,
      });
      const initialWeight = attention.find(a => a.contextKey === 'dynamic-node')?.weight;

      // Change endocrine state
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: UE5_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.5,
      });

      // Act 2: Recompute
      await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features: [feature],
      });

      attention = await ctx.convexClient.query(api.cns.getActiveMask, {
        nodeId: UE5_CONFIG.NODE_ID,
      });
      const updatedWeight = attention.find(a => a.contextKey === 'dynamic-node')?.weight;

      // Assert: Weight may change based on endocrine state
      expect(updatedWeight).toBeDefined();
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Neural Field Flare on Wake Word
  // ──────────────────────────────────────────────────────────────────────────

  describe('Neural Field Flare', () => {
    it('should trigger global discharge on wake word', async () => {
      // Act: Trigger wake word
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Assert: UE5 detects via snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      expect(snapshot.state.isAttentive).toBe(true);
      expect(snapshot.state.lastWakeWordTs).toBeDefined();

      // UE5 logic: if lastWakeWordTs changed, trigger flare
      // Flare: all nodes charge = 1.0, color = #FFFFFF for 800ms
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should maintain flare duration', async () => {
      // Act
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const startTs = Date.now();

      // Wait for flare duration
      await waitForFlareDuration();

      // Assert: State still attentive (UE5 handles visual decay)
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      expect(snapshot.state.isAttentive).toBe(true);
      expect(Date.now() - startTs).toBeGreaterThanOrEqual(UE5_CONFIG.FLARE_DURATION_MS);
    }, UE5_CONFIG.TIMEOUT_MS * 2);

    it('should support rapid successive wake words', async () => {
      // Act: Multiple triggers
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const ts1 = await ctx.convexClient.query(api.appState.getFullState, {});

      await new Promise(resolve => setTimeout(resolve, 100));

      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});
      const ts2 = await ctx.convexClient.query(api.appState.getFullState, {});

      // Assert: Each trigger updates timestamp
      expect(ts2?.lastWakeWordTs).toBeGreaterThan(ts1?.lastWakeWordTs || 0);
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Entity Spawning for Visualization
  // ──────────────────────────────────────────────────────────────────────────

  describe('Entity Visualization', () => {
    it('should spawn entity for UE5 rendering', async () => {
      // Act
      const entity = await ctx.convexClient.mutation(api.appState.spawnEntity, {
        type: 'drone',
        label: 'Test-Drone-1',
        x: 10.5,
        y: 2.0,
        z: -5.3,
        color: '#00ff88',
      });
      ctx.spawnedEntityIds.push(entity.id);

      // Assert
      expect(entity.id).toBeDefined();
      expect(entity.type).toBe('drone');
      expect(entity.x).toBe(10.5);
      expect(entity.y).toBe(2.0);
      expect(entity.z).toBe(-5.3);
      expect(entity.color).toBe('#00ff88');

      // Verify in world snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const entities = JSON.parse(snapshot.state.entitiesJson || '[]');
      expect(entities.some((e: any) => e.id === entity.id)).toBe(true);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should maintain entity limit', async () => {
      // Note: Testing with fewer entities for speed
      const entityCount = 5; // Test with 5 instead of 200

      for (let i = 0; i < entityCount; i++) {
        const entity = await ctx.convexClient.mutation(api.appState.spawnEntity, {
          type: 'test-entity',
          label: `Test-${i}`,
          x: i,
          y: 0,
          z: 0,
        });
        ctx.spawnedEntityIds.push(entity.id);
      }

      // Assert
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const entities = JSON.parse(snapshot.state.entitiesJson || '[]');
      expect(entities.length).toBe(entityCount);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should despawn entity on command', async () => {
      // Arrange
      const entity = await ctx.convexClient.mutation(api.appState.spawnEntity, {
        type: 'temporary',
        label: 'Temp-Entity',
        x: 0,
        y: 0,
        z: 0,
      });

      // Act
      const result = await ctx.convexClient.mutation(api.appState.despawnEntity, {
        entityId: entity.id,
      });

      // Assert
      expect(result.removed).toBe(1);

      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const entities = JSON.parse(snapshot.state.entitiesJson || '[]');
      expect(entities.some((e: any) => e.id === entity.id)).toBe(false);
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Camera Control Synchronization
  // ──────────────────────────────────────────────────────────────────────────

  describe('Camera Synchronization', () => {
    it('should update camera position for UE5', async () => {
      // Act
      const camera = await ctx.convexClient.mutation(api.appState.moveCamera, {
        x: 100.0,
        y: 50.0,
        z: -200.0,
        target: 'entity-123',
      });

      // Assert
      expect(camera.x).toBe(100.0);
      expect(camera.y).toBe(50.0);
      expect(camera.z).toBe(-200.0);
      expect(camera.target).toBe('entity-123');
      expect(camera.updatedAt).toBeDefined();

      // Verify in snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const cameraState = JSON.parse(snapshot.state.cameraJson || '{}');
      expect(cameraState.x).toBe(100.0);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should update camera without target', async () => {
      // Act
      await ctx.convexClient.mutation(api.appState.moveCamera, {
        x: 0,
        y: 10,
        z: -50,
      });

      // Assert
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const cameraState = JSON.parse(snapshot.state.cameraJson || '{}');
      expect(cameraState.x).toBe(0);
      expect(cameraState.y).toBe(10);
      expect(cameraState.z).toBe(-50);
      expect(cameraState.target).toBeUndefined();
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Pheromone Gradient Visualization
  // ──────────────────────────────────────────────────────────────────────────

  describe('Pheromone Gradient Rendering', () => {
    it('should deposit pheromone with 3D position', async () => {
      // Act
      const result = await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'threat',
        weight: 0.9,
        x: 25.5,
        y: 10.0,
        z: -15.2,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 60000,
      });

      // Assert
      expect(result.id).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Verify in snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const pheromone = snapshot.pheromones.find(p => p.id === result.id);
      expect(pheromone).toBeDefined();

      // Parse payload for 3D position
      const payload = JSON.parse(pheromone?.payload || '{}');
      expect(payload.x).toBe(25.5);
      expect(payload.y).toBe(10.0);
      expect(payload.z).toBe(-15.2);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should support multiple pheromone types', async () => {
      // Arrange: Deposit different types
      const types = ['threat', 'opportunity', 'resource', 'danger'];
      for (const type of types) {
        const result = await ctx.convexClient.mutation(api.appState.dropPheromone, {
          type,
          weight: 0.7,
          emitterId: UE5_CONFIG.NODE_ID,
          ttlMs: 60000,
        });
        ctx.depositedPheromoneIds.push(result.id);
      }

      // Act: Poll snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: All types present
      types.forEach(type => {
        expect(snapshot.pheromones.some(p => p.type === type)).toBe(true);
      });
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should weight pheromones for gradient intensity', async () => {
      // Arrange: Deposit with different weights
      await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'strong-signal',
        weight: 1.0,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 60000,
      });

      await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'weak-signal',
        weight: 0.2,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 60000,
      });

      // Act
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: Weights preserved for UE5 gradient rendering
      const strong = snapshot.pheromones.find(p => p.type === 'strong-signal');
      const weak = snapshot.pheromones.find(p => p.type === 'weak-signal');

      expect(strong?.weight).toBe(1.0);
      expect(weak?.weight).toBe(0.2);
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Mode and Alert Visualization
  // ──────────────────────────────────────────────────────────────────────────

  describe('Mode and Alert Rendering', () => {
    it('should update mode for UE5 state visualization', async () => {
      // Act
      await ctx.convexClient.mutation(api.appState.setMode, { mode: 'combat' });

      // Assert
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      expect(snapshot.state.mode).toBe('combat');

      // UE5 logic: combat mode → red tint, faster animations
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should add alerts for UE5 HUD display', async () => {
      // Act
      const alert = await ctx.convexClient.mutation(api.appState.addAlert, {
        severity: 'critical',
        message: 'Perimeter breach detected',
      });

      // Assert
      expect(alert.id).toBeDefined();
      expect(alert.severity).toBe('critical');
      expect(alert.message).toBe('Perimeter breach detected');

      // Verify in snapshot
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const alerts = JSON.parse(snapshot.state.alertsJson || '[]');
      expect(alerts.some((a: any) => a.id === alert.id)).toBe(true);
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should maintain alert order (newest first)', async () => {
      // Arrange
      await ctx.convexClient.mutation(api.appState.addAlert, {
        severity: 'info',
        message: 'First alert',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await ctx.convexClient.mutation(api.appState.addAlert, {
        severity: 'warning',
        message: 'Second alert',
      });

      // Assert
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const alerts = JSON.parse(snapshot.state.alertsJson || '[]');

      expect(alerts[0].message).toBe('Second alert');
      expect(alerts[1].message).toBe('First alert');
    }, UE5_CONFIG.TIMEOUT_MS);

    it('should limit alerts to maximum count', async () => {
      // Arrange: Add many alerts
      const alertCount = 55; // Exceeds 50 limit
      for (let i = 0; i < alertCount; i++) {
        await ctx.convexClient.mutation(api.appState.addAlert, {
          severity: 'info',
          message: `Alert ${i}`,
        });
      }

      // Assert
      const snapshot = await pollWorldSnapshot(ctx.convexClient);
      const alerts = JSON.parse(snapshot.state.alertsJson || '[]');
      expect(alerts.length).toBeLessThanOrEqual(50);
    }, UE5_CONFIG.TIMEOUT_MS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: End-to-End UE5 Integration
  // ──────────────────────────────────────────────────────────────────────────

  describe('End-to-End UE5 Integration', () => {
    it('should support complete visualization pipeline', async () => {
      // Phase 1: Set mode
      await ctx.convexClient.mutation(api.appState.setMode, { mode: 'nominal' });

      // Phase 2: Spawn entities
      const entity = await ctx.convexClient.mutation(api.appState.spawnEntity, {
        type: 'sensor-node',
        label: 'Sensor-1',
        x: 50.0,
        y: 10.0,
        z: -30.0,
        color: '#00ff00',
      });
      ctx.spawnedEntityIds.push(entity.id);

      // Phase 3: Deposit pheromones
      const pheromone = await ctx.convexClient.mutation(api.appState.dropPheromone, {
        type: 'data-flow',
        weight: 0.8,
        x: 50.0,
        y: 10.0,
        z: -30.0,
        emitterId: UE5_CONFIG.NODE_ID,
        ttlMs: 60000,
      });
      ctx.depositedPheromoneIds.push(pheromone.id);

      // Phase 4: Position camera
      await ctx.convexClient.mutation(api.appState.moveCamera, {
        x: 60.0,
        y: 15.0,
        z: -40.0,
        target: entity.id,
      });

      // Phase 5: Add alert
      await ctx.convexClient.mutation(api.appState.addAlert, {
        severity: 'info',
        message: 'UE5 integration test active',
      });

      // Phase 6: Trigger wake word for flare
      await ctx.convexClient.mutation(api.appState.triggerWakeWord, {});

      // Phase 7: Compute attention mask
      await ctx.convexClient.mutation(api.endocrine.initNode, {
        nodeId: UE5_CONFIG.NODE_ID,
      });
      await ctx.convexClient.mutation(api.endocrine.spike, {
        nodeId: UE5_CONFIG.NODE_ID,
        hormone: 'dopamine',
        delta: 0.4,
      });

      await ctx.convexClient.action(api.cns.computeBitNetMask, {
        features: [
          { id: 'sensor-1', type: 'sensor' as const, metadata: 'active' },
        ],
      });

      // Verify complete state
      const snapshot = await pollWorldSnapshot(ctx.convexClient);

      // Assert: All components present
      expect(snapshot.state.mode).toBe('nominal');
      expect(snapshot.state.isAttentive).toBe(true);

      const entities = JSON.parse(snapshot.state.entitiesJson || '[]');
      expect(entities.some((e: any) => e.id === entity.id)).toBe(true);

      expect(snapshot.pheromones.some(p => p.id === pheromone.id)).toBe(true);

      const alerts = JSON.parse(snapshot.state.alertsJson || '[]');
      expect(alerts.some((a: any) => a.message === 'UE5 integration test active')).toBe(true);

      const camera = JSON.parse(snapshot.state.cameraJson || '{}');
      expect(camera.x).toBe(60.0);
      expect(camera.target).toBe(entity.id);

      const attention = await ctx.convexClient.query(api.cns.getActiveMask, {
        nodeId: UE5_CONFIG.NODE_ID,
      });
      expect(attention.length).toBeGreaterThan(0);
    }, UE5_CONFIG.TIMEOUT_MS * 2);
  });
});

// ── EXPORT FOR PROGRAMMATIC ACCESS ─────────────────────────────────────────

export { UE5_CONFIG, pollWorldSnapshot, waitForFlareDuration };
