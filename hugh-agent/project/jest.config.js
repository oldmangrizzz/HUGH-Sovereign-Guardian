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
