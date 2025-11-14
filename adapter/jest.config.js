/**
 * Jest configuration for @codebuff/adapter test suite
 *
 * Configures Jest to run TypeScript tests with proper coverage reporting
 * and optimized for testing the FREE mode Claude CLI adapter.
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Run tests in Node.js environment
  testEnvironment: 'node',

  // Look for tests in these directories
  roots: ['<rootDir>/tests', '<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage collection patterns
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],

  // Coverage thresholds - enforces minimum coverage
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage reporting formats
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Directory for coverage reports
  coverageDirectory: '<rootDir>/coverage',

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup/test-setup.ts'],

  // Test timeout (30 seconds for slower operations)
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Reset modules before each test
  resetModules: true,

  // Verbose output for better debugging
  verbose: true,

  // Display individual test results
  displayName: {
    name: 'ADAPTER',
    color: 'blue',
  },

  // Ignore patterns for test discovery
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],

  // Module path aliases (if you use path mapping)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Global test settings
  globals: {
    'ts-jest': {
      tsconfig: {
        // Override tsconfig for tests
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
}
