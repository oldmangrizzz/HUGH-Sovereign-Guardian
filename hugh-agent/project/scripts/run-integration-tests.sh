#!/bin/bash
#
# run-integration-tests.sh — H.U.G.H. Integration Test Runner
#
# Executes the complete cognitive loop integration test suite.
# Supports multiple test modes: full, quick, specific file, or single test.
#
# Usage:
#   ./scripts/run-integration-tests.sh              # Run all tests
#   ./scripts/run-integration-tests.sh --quick      # Run quick tests only
#   ./scripts/run-integration-tests.sh --file wake-word.test.ts
#   ./scripts/run-integration-tests.sh --test "should spike dopamine"
#   ./scripts/run-integration-tests.sh --coverage   # Run with coverage report
#   ./scripts/run-integration-tests.sh --watch      # Watch mode for development
#
# Environment Variables:
#   CONVEX_URL          — Convex deployment URL
#   HUGH_GATEWAY_URL    — Gateway API URL
#   LFM_GATEWAY_SECRET  — Gateway authentication secret
#   MCP_SECRET          — MCP authentication secret
#   KVM_AGENT_URL       — KVM agent URL (optional)
#   KVM_AGENT_SECRET    — KVM agent secret (optional)
#   NODE_ENV            — Set to 'test' for test configuration
#
# Prerequisites:
#   - Node.js 18+
#   - npm dependencies installed
#   - Convex backend deployed and accessible
#   - Environment variables configured
#

set -e

# ── CONFIGURATION ───────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_DIR/tests/integration"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_TIMEOUT=60000  # 60 seconds per test
MAX_WORKERS=4       # Parallel test workers

# ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  H.U.G.H. Integration Test Suite${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick           Run only quick tests (skip long-running tests)"
    echo "  --file <FILE>     Run specific test file"
    echo "  --test <PATTERN>  Run tests matching pattern"
    echo "  --coverage        Generate coverage report"
    echo "  --watch           Watch mode for development"
    echo "  --verbose         Verbose output"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                              # Run all tests"
    echo "  $0 --quick                      # Quick test run"
    echo "  $0 --file cognitive-loop.test.ts"
    echo "  $0 --test \"wake word\""
    echo "  $0 --coverage"
    echo ""
}

check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required (found: $(node -v))"
        exit 1
    fi
    log_success "Node.js $(node -v)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    log_success "npm $(npm -v)"

    # Check test directory
    if [ ! -d "$TEST_DIR" ]; then
        log_error "Test directory not found: $TEST_DIR"
        exit 1
    fi
    log_success "Test directory found"

    # Check for test files
    TEST_FILES=$(find "$TEST_DIR" -name "*.test.ts" -type f 2>/dev/null | wc -l)
    if [ "$TEST_FILES" -eq 0 ]; then
        log_error "No test files found in $TEST_DIR"
        exit 1
    fi
    log_success "Found $TEST_FILES test file(s)"

    # Check for node_modules
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        log_warning "node_modules not found. Running npm install..."
        cd "$PROJECT_DIR" && npm install
    fi
    log_success "Dependencies installed"
}

check_environment() {
    log_step "Checking environment configuration..."

    # Required variables
    if [ -z "$CONVEX_URL" ]; then
        log_warning "CONVEX_URL not set. Using default."
        export CONVEX_URL="https://effervescent-toucan-715.convex.cloud"
    fi
    log_success "CONVEX_URL: $CONVEX_URL"

    if [ -z "$HUGH_GATEWAY_URL" ]; then
        log_warning "HUGH_GATEWAY_URL not set. Gateway tests may be skipped."
    else
        log_success "HUGH_GATEWAY_URL: $HUGH_GATEWAY_URL"
    fi

    if [ -z "$LFM_GATEWAY_SECRET" ] && [ -z "$MCP_SECRET" ]; then
        log_warning "No gateway secret set. Some tests may be skipped."
    else
        log_success "Gateway secret configured"
    fi

    # Optional variables
    if [ -n "$KVM_AGENT_URL" ]; then
        log_success "KVM_AGENT_URL: $KVM_AGENT_URL"
    else
        log_info "KVM_AGENT_URL not set. KVM tests will be skipped."
    fi
}

setup_test_environment() {
    log_step "Setting up test environment..."

    # Set test mode
    export NODE_ENV="test"

    # Install test dependencies if needed
    if ! npm list @jest/globals &> /dev/null; then
        log_info "Installing Jest dependencies..."
        cd "$PROJECT_DIR"
        npm install --save-dev @jest/globals ts-jest jest @types/jest
    fi

    # Create Jest config if not exists
    if [ ! -f "$PROJECT_DIR/jest.config.js" ]; then
        log_info "Creating Jest configuration..."
        cat > "$PROJECT_DIR/jest.config.js" << 'EOF'
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
      }
    }]
  },
  moduleNameMapper: {
    '^convex/(.*)$': '<rootDir>/convex/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 60000,
  maxWorkers: 4,
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    'convex/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/_generated/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
EOF
    fi

    # Create test setup file if not exists
    if [ ! -f "$PROJECT_DIR/tests/setup.ts" ]; then
        log_info "Creating test setup file..."
        mkdir -p "$PROJECT_DIR/tests"
        cat > "$PROJECT_DIR/tests/setup.ts" << 'EOF'
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
EOF
    fi

    log_success "Test environment configured"
}

run_tests() {
    local test_args="$1"

    log_step "Running tests..."
    echo ""

    cd "$PROJECT_DIR"

    # Run Jest with arguments
    if [ -n "$test_args" ]; then
        npx jest $test_args
    else
        npx jest tests/integration/ \
            --max-workers=$MAX_WORKERS \
            --testTimeout=$TEST_TIMEOUT
    fi

    local exit_code=$?

    echo ""
    if [ $exit_code -eq 0 ]; then
        log_success "All tests passed!"
    else
        log_error "Some tests failed (exit code: $exit_code)"
    fi

    return $exit_code
}

run_quick_tests() {
    log_info "Running quick tests only (skipping long-running tests)..."

    run_tests "--testPathIgnorePatterns='cognitive-loop.test.ts' --testNamePattern='^(?!.*decay)(?!.*endocrine.*baseline).*'"
}

run_single_file() {
    local file="$1"

    if [ ! -f "$TEST_DIR/$file" ]; then
        log_error "Test file not found: $TEST_DIR/$file"
        exit 1
    fi

    log_info "Running single test file: $file"
    run_tests "tests/integration/$file"
}

run_single_test() {
    local pattern="$1"

    log_info "Running tests matching pattern: $pattern"
    run_tests "--testNamePattern=\"$pattern\""
}

run_with_coverage() {
    log_info "Running tests with coverage report..."

    run_tests "--coverage --coverageReporters=text --coverageReporters=html"

    if [ -d "$PROJECT_DIR/coverage" ]; then
        echo ""
        log_success "Coverage report generated: $PROJECT_DIR/coverage/index.html"
    fi
}

run_watch_mode() {
    log_info "Starting watch mode..."

    cd "$PROJECT_DIR"
    npx jest tests/integration/ --watch --max-workers=1
}

# ── MAIN EXECUTION ──────────────────────────────────────────────────────────

main() {
    print_header

    # Parse arguments
    local run_mode="full"
    local test_file=""
    local test_pattern=""
    local use_coverage=false
    local use_watch=false
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                run_mode="quick"
                shift
                ;;
            --file)
                run_mode="file"
                test_file="$2"
                shift 2
                ;;
            --test)
                run_mode="pattern"
                test_pattern="$2"
                shift 2
                ;;
            --coverage)
                use_coverage=true
                shift
                ;;
            --watch)
                use_watch=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    # Execute
    check_prerequisites
    check_environment
    setup_test_environment

    echo ""
    print_header

    case $run_mode in
        full)
            if [ "$use_coverage" = true ]; then
                run_with_coverage
            else
                run_tests ""
            fi
            ;;
        quick)
            run_quick_tests
            ;;
        file)
            run_single_file "$test_file"
            ;;
        pattern)
            run_single_test "$test_pattern"
            ;;
        watch)
            run_watch_mode
            ;;
    esac
}

# Run main function with all arguments
main "$@"
