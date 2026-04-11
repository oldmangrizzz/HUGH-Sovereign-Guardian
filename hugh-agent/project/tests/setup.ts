/**
 * Test setup — H.U.G.H. Integration Tests
 *
 * Global setup and teardown for integration tests.
 */

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global beforeAll
beforeAll(() => {
  console.log('[TEST] Integration test suite starting...');
});

// Global afterAll
afterAll(() => {
  console.log('[TEST] Integration test suite completed.');
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[TEST] Unhandled Rejection at:', promise, 'reason:', reason);
});
