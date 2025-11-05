/**
 * Jest Setup for DigiClassroom AI Tutor Tests
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.COHERE_API_KEY = 'test-cohere-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.QDRANT_URL = 'http://localhost:6333';
process.env.QDRANT_API_KEY = 'test-qdrant-key';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'test-redis-password';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_digiclassroom';
process.env.USE_UNIFIED_PROMPTS = 'true';
process.env.APM_ENABLED = 'true';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = jest.fn((...args) => {
  // Only log in verbose mode or for important messages
  if (process.env.JEST_VERBOSE === 'true' || args[0]?.includes('❌') || args[0]?.includes('✅')) {
    originalConsoleLog(...args);
  }
});

console.warn = jest.fn((...args) => {
  // Always log warnings in tests
  originalConsoleWarn(...args);
});

console.error = jest.fn((...args) => {
  // Always log errors in tests
  originalConsoleError(...args);
});

// Global test utilities
global.testUtils = {
  // Create mock student context
  createMockStudentContext: (overrides = {}) => ({
    grade_level: 7,
    subject: 'Science',
    board_type: 'CBSE',
    learning_preferences: {
      visual_learner: true,
      pace: 'moderate'
    },
    ...overrides
  }),

  // Create mock conversation context
  createMockConversationContext: (overrides = {}) => ({
    menu_intent: 'explain_topic',
    conversation_id: 'test-conv-123',
    previous_messages: [],
    context_metadata: {
      topic_area: 'Life Processes',
      difficulty_level: 'intermediate'
    },
    ...overrides
  }),

  // Create mock source chunks
  createMockSourceChunks: (count = 2) => {
    return Array.from({ length: count }, (_, i) => ({
      content: `Mock content ${i + 1} for testing purposes.`,
      source: `NCERT Science Class 7`,
      chapter: `${i + 1}`,
      page: 15 + i,
      section: 'Test Section',
      confidence_score: 0.9 - (i * 0.05)
    }));
  },

  // Create mock verification result
  createMockVerificationResult: (overrides = {}) => ({
    is_verified: true,
    overall_fidelity_score: 0.96,
    sentence_scores: [0.95, 0.97, 0.96],
    failed_sentences: [],
    verification_details: {
      total_sentences: 3,
      verified_sentences: 3,
      failed_sentences: 0,
      similarity_method: 'hybrid',
      source_chunks_used: 2,
      overall_score: 0.96,
      citations_found: 2,
      verification_passed: true
    },
    citations: ['Ch 1, Pg 15', 'Ch 2, Pg 16'],
    ...overrides
  }),

  // Create mock LLM response
  createMockLLMResponse: (overrides = {}) => ({
    text: 'Mock LLM response for testing.',
    model: 'command-r-08-2024',
    tokens_used: 50,
    confidence: 0.9,
    processing_time: 1000,
    ...overrides
  }),

  // Create mock search response
  createMockSearchResponse: (overrides = {}) => ({
    results: [
      {
        text: 'Mock search result content.',
        metadata: {
          source: 'NCERT Science',
          chapter: '1',
          page: 15,
          content_type: 'text'
        },
        score: 0.95
      }
    ],
    total_results: 1,
    search_strategy: 'hybrid',
    processing_time: 150,
    confidence: 0.95,
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock APM span
  createMockAPMSpan: (overrides = {}) => ({
    trace_id: 'test-trace-123',
    span_id: 'test-span-456',
    operation_name: 'test-operation',
    start_time: Date.now(),
    tags: {},
    logs: [],
    status: 'pending',
    ...overrides
  })
};

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('Mock response'),
  })
);

// Mock WebSocket for streaming tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
}));

// Mock EventSource for Server-Sent Events
global.EventSource = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123',
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  }
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  }
});

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset console mocks
  console.log.mockClear();
  console.warn.mockClear();
  console.error.mockClear();
  
  // Reset fetch mock
  fetch.mockClear();
});

afterEach(() => {
  // Clean up any timers
  jest.clearAllTimers();
  
  // Clean up any pending promises
  jest.runOnlyPendingTimers();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/test',
    query: {},
    asPath: '/test',
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/test',
    searchParams: new URLSearchParams(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));
