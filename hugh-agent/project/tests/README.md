# H.U.G.H. Integration Test Suite

End-to-end integration tests for the complete cognitive loop of the H.U.G.H. cognitive architecture.

## Overview

This test suite validates the complete cognitive pipeline:

1. **Audio Input → STT → Wake Word → Convex Trigger → Visual Flare**
2. **LLM Response → TTS → Audio Output**
3. **CNS → Ternary Attention → Neural Field Rendering**
4. **KVM_EXEC → Multi-Node Execution → Result Aggregation**
5. **Endocrine Spike → Decay → Baseline Recovery**

## Test Files

| File | Description |
|------|-------------|
| `cognitive-loop.test.ts` | Full cognitive loop integration tests |
| `wake-word.test.ts` | STT → wake word detection → flare tests |
| `ue5-connector.test.ts` | UE5 Convex integration tests |

## Prerequisites

- **Node.js 18+**
- **npm** dependencies installed
- **Convex backend** deployed and accessible
- **Environment variables** configured (see below)

## Environment Variables

Required for full test coverage:

```bash
# Convex deployment
export CONVEX_URL="https://effervescent-toucan-715.convex.cloud"

# Gateway API (for STT/TTS tests)
export HUGH_GATEWAY_URL="http://localhost:8787"
export LFM_GATEWAY_SECRET="your-gateway-secret"

# MCP authentication
export MCP_SECRET="your-mcp-secret"

# KVM agent (optional, for execution tests)
export KVM_AGENT_URL="http://localhost:3002"
export KVM_AGENT_SECRET="your-kvm-secret"
```

## Installation

```bash
# Install dependencies
npm install

# Verify test setup
npm run test:jest -- --listTests
```

## Running Tests

### Full Test Suite

```bash
# Using npm script
npm test

# Or directly
./scripts/run-integration-tests.sh
```

### Quick Tests (Skip Long-Running)

```bash
npm run test:quick
```

### Specific Test File

```bash
npm run test:file -- cognitive-loop.test.ts
npm run test:file -- wake-word.test.ts
npm run test:file -- ue5-connector.test.ts
```

### Single Test Pattern

```bash
./scripts/run-integration-tests.sh --test "should spike dopamine"
```

### Watch Mode (Development)

```bash
npm run test:watch
```

### With Coverage Report

```bash
npm run test:coverage
```

Coverage report will be generated at `coverage/index.html`.

## Test Categories

### 1. Endocrine System Tests

- Hormone spike (cortisol, dopamine, adrenaline)
- Holographic mode activation
- Exponential decay to baseline
- Level clamping (0.0-1.0)

### 2. Wake Word Detection Tests

- Pattern matching (Hubert variants)
- Case-insensitive detection
- STT integration
- Convex trigger
- Transcript storage

### 3. Visual Flare Tests

- Attentive state activation
- Timestamp tracking
- World snapshot updates
- Flare duration timing

### 4. CNS (BitNet) Tests

- Ternary attention mask computation
- Feature excitation/inhibition
- Endocrine state mapping
- Persistence for UE5 rendering

### 5. KVM Execution Tests

- Multi-node command execution
- Zone classification (green/yellow/red)
- Command sanitization
- Agent ping/status

### 6. TTS Tests

- Speech synthesis via gateway
- Artifact stripping (KVM_EXEC blocks)
- Audio format validation

### 7. Stigmergic Coordination Tests

- Pheromone deposition
- TTL expiration
- Gradient observation
- Evaporation

### 8. Memory System Tests

- Episodic memory storage
- Endocrine stamping
- Session isolation

### 9. UE5 Integration Tests

- World snapshot polling
- Entity spawning/despawning
- Camera synchronization
- Pheromone gradient rendering
- Neural field flare

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION TEST SUITE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   cognitive  │    │   wake-word  │    │   ue5-conn   │      │
│  │   -loop.ts   │    │    .ts       │    │   ector.ts   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Convex HTTP    │                          │
│                    │     Client      │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌──────▼───────┐        │
│  │   Endocrine  │   │    CNS/      │   │    KVM/      │        │
│  │    System    │   │   BitNet     │   │   Gateway    │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Test Structure

Each test file follows this pattern:

```typescript
describe('Feature Category', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // Global setup
  });

  beforeEach(async () => {
    // Per-test setup
  });

  it('should do something specific', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  env:
    CONVEX_URL: ${{ secrets.CONVEX_URL }}
    HUGH_GATEWAY_URL: ${{ secrets.HUGH_GATEWAY_URL }}
    LFM_GATEWAY_SECRET: ${{ secrets.LFM_GATEWAY_SECRET }}
    MCP_SECRET: ${{ secrets.MCP_SECRET }}
  run: npm test
```

## Troubleshooting

### Tests Timeout

Increase timeout in `jest.config.js`:
```javascript
testTimeout: 120000, // 2 minutes
```

### Convex Connection Failed

Verify `CONVEX_URL` is correct and deployment is running:
```bash
npx convex dev
```

### Gateway Tests Skipped

Set `HUGH_GATEWAY_URL` and `LFM_GATEWAY_SECRET` environment variables.

### KVM Tests Skipped

KVM tests are optional. Set `KVM_AGENT_URL` to enable.

## Coverage Goals

Current thresholds (configurable in `jest.config.js`):

- **Statements**: 50%
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%

## Contributing

When adding new tests:

1. Follow existing test structure
2. Use descriptive test names
3. Include proper cleanup in `afterAll`
4. Mark optional tests with skip logic
5. Update this README for new test categories

## License

Same as main H.U.G.H. project.
