/**
 * Jest Configuration for DigiClassroom AI Tutor
 *
 * Uses next/jest for SWC-based TypeScript transformation.
 * The `projects` array is intentionally avoided — it creates isolated
 * Jest contexts that don't inherit the SWC transform from next/jest,
 * causing SyntaxError on TypeScript syntax.
 *
 * Instead, test:unit vs test:integration is separated via
 * testPathIgnorePatterns + package.json script flags.
 */

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

/** @type {import('jest').Config} */
const customJestConfig = {
  // Node environment for backend/agent tests (all current tests are server-side)
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    // Server-only / Next.js App Router mocks
    '^server-only$': '<rootDir>/src/__mocks__/server-only.ts',
    '^next/headers$': '<rootDir>/src/__mocks__/next-headers.ts',
    '^next/navigation$': '<rootDir>/src/__mocks__/next-navigation.ts',
    // ESM-only packages that need CJS mocks
    '^superjson$': '<rootDir>/src/__mocks__/superjson.js',
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/node_modules/**',
    '!src/**/.next/**',
    '!src/**/coverage/**',
    '!src/**/*.config.{js,ts}',
  ],

  // Coverage thresholds for enhanced features
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },

  // Test timeout
  testTimeout: 30000,

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    // Exclude integration/e2e tests from default runs
    '<rootDir>/src/__tests__/integration/',
    '<rootDir>/src/__tests__/end-to-end',
    '<rootDir>/src/__tests__/full-stack',
    '<rootDir>/src/__tests__/ai-tutor-integration',
    // Exclude golden/evaluation tests (use npm run test:golden)
    '<rootDir>/src/__tests__/evaluation/',
    '\\.golden\\.ts$',
    // Exclude non-test files that match the __tests__ glob
    'types\\.ts$',
    '\\.example$',
  ],

  // Transform ignore patterns — let SWC handle ESM packages
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@qdrant|redis|better-auth|@better-auth|superjson|drizzle-orm))',
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Error on deprecated features
  errorOnDeprecated: true,

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests complete
  forceExit: true,

  // Max workers for parallel testing
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache',

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'junit.xml',
        suiteName: 'DigiClassroom AI Tutor Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/test-results',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'DigiClassroom AI Tutor Test Report',
      },
    ],
  ],
}

// Create and export the Jest config — next/jest injects SWC transform automatically
module.exports = createJestConfig(customJestConfig)
