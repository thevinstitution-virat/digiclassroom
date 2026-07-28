/**
 * AI Tutor Integration Testing
 * 🧪 INTEGRATION: Tests the complete AI Tutor API with real textbook content
 * 🛡️ VALIDATION: Ensures accurate responses, proper citations, and zero hallucination
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
        // @ts-ignore
import request from 'supertest';
import { NextRequest } from 'next/server';

// Test configuration
const TEST_CONFIG = {
  timeout: 45000, // 45 seconds for integration tests
  apiEndpoint: '/api/ai-tutor/chat',
  testQueries: [
    {
      query: "Define latitude",
      expectedKeywords: ['latitude', 'parallel', 'equator', 'degrees'],
      expectedCitation: true,
      minWords: 50,
      maxWords: 100,
      complexity: 'basic'
    },
    {
      query: "Explain India's geographical location and its significance",
      expectedKeywords: ['India', 'location', 'latitude', 'longitude', 'significance'],
      expectedCitation: true,
      minWords: 100,
      maxWords: 200,
      complexity: 'intermediate'
    },
    {
      query: "Compare the border lengths of India with Pakistan and China",
      expectedKeywords: ['Pakistan', 'China', 'border', 'length', 'km'],
      expectedCitation: true,
      minWords: 80,
      maxWords: 150,
      complexity: 'intermediate'
    }
  ],
  invalidQueries: [
    "What is the capital of Mars?", // Completely unrelated
    "How to cook pasta?", // Not in textbook
    "Tell me a joke", // Not educational
  ]
};

// Mock Next.js request for testing
function createMockRequest(body: any): NextRequest {
  return {
    json: async () => body,
    method: 'POST',
    url: 'http://localhost:3000/api/ai-tutor/chat',
    headers: new Headers({
      'content-type': 'application/json'
    })
  } as NextRequest;
}

describe('AI Tutor Integration Tests', () => {
  beforeAll(async () => {
    console.log('🧪 Starting AI Tutor integration tests...');
    
    // Ensure test environment is ready
    // In a real test, you might want to seed the database with test content
    
    console.log('✅ AI Tutor integration test environment ready');
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    console.log('🧹 Cleaning up AI Tutor integration tests...');
    console.log('✅ AI Tutor integration test cleanup completed');
  });

  describe('🎯 Valid Query Processing', () => {
    TEST_CONFIG.testQueries.forEach((testCase, index) => {
      test(`should handle query ${index + 1}: "${testCase.query}"`, async () => {
        const requestBody = {
          message: testCase.query,
          userId: 'test-user-integration',
          context: {
            subject: 'Geography',
            class: 'Class IX',
            board: 'CBSE'
          }
        };

        // Create mock request
        const mockRequest = createMockRequest(requestBody);
        
        // Import and call the API handler
        // @ts-ignore
        const { POST } = await import('../app/api/ai-tutor/chat/route');
        const response = await POST(mockRequest);
        
        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        
        // Validate response structure
        expect(responseData).toHaveProperty('response');
        expect(responseData).toHaveProperty('sources');
        expect(responseData).toHaveProperty('processingTime');
        expect(responseData).toHaveProperty('fidelityScore');

        // Validate response content
        const responseText = responseData.response;
        expect(responseText).toBeDefined();
        expect(typeof responseText).toBe('string');
        expect(responseText.length).toBeGreaterThan(0);

        // Validate word count
        const wordCount = responseText.split(/\s+/).length;
        expect(wordCount).toBeGreaterThanOrEqual(testCase.minWords);
        expect(wordCount).toBeLessThanOrEqual(testCase.maxWords);

        // Validate expected keywords
        testCase.expectedKeywords.forEach(keyword => {
          expect(responseText.toLowerCase()).toContain(keyword.toLowerCase());
        });

        // Validate citations if expected
        if (testCase.expectedCitation) {
          expect(responseData.sources).toBeDefined();
          expect(Array.isArray(responseData.sources)).toBe(true);
          expect(responseData.sources.length).toBeGreaterThan(0);
          
          // Validate citation format
          const firstSource = responseData.sources[0];
          expect(firstSource).toHaveProperty('citation');
          expect(firstSource.citation).toMatch(/\[.*Ch \d+.*Pg \d+.*\]/);
        }

        // Validate fidelity score
        expect(responseData.fidelityScore).toBeGreaterThanOrEqual(0.8);
        
        // Validate processing time is reasonable
        expect(responseData.processingTime).toBeLessThan(30000); // Less than 30 seconds

        console.log(`✅ Query ${index + 1} processed successfully:`, {
          query: testCase.query,
          wordCount,
          fidelityScore: responseData.fidelityScore,
          processingTime: responseData.processingTime,
          sourcesCount: responseData.sources?.length || 0
        });
      }, TEST_CONFIG.timeout);
    });
  });

  describe('❌ Invalid Query Handling', () => {
    TEST_CONFIG.invalidQueries.forEach((invalidQuery, index) => {
      test(`should handle invalid query ${index + 1}: "${invalidQuery}"`, async () => {
        const requestBody = {
          message: invalidQuery,
          userId: 'test-user-integration',
          context: {
            subject: 'Geography',
            class: 'Class IX',
            board: 'CBSE'
          }
        };

        const mockRequest = createMockRequest(requestBody);
        
        // @ts-ignore
        const { POST } = await import('../app/api/ai-tutor/chat/route');
        const response = await POST(mockRequest);
        
        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        
        // Should return a polite refusal or redirect to textbook content
        expect(responseData.response).toBeDefined();
        expect(responseData.response).toContain('cannot find');
        expect(responseData.fidelityScore).toBe(0);
        expect(responseData.sources).toHaveLength(0);

        console.log(`✅ Invalid query ${index + 1} handled appropriately:`, {
          query: invalidQuery,
          response: responseData.response.substring(0, 100) + '...'
        });
      }, TEST_CONFIG.timeout);
    });
  });

  describe('🔍 Response Quality Validation', () => {
    test('should maintain consistent quality across multiple queries', async () => {
      const results = [];
      
      for (const testCase of TEST_CONFIG.testQueries) {
        const requestBody = {
          message: testCase.query,
          userId: 'test-user-consistency',
          context: {
            subject: 'Geography',
            class: 'Class IX',
            board: 'CBSE'
          }
        };

        const mockRequest = createMockRequest(requestBody);
        // @ts-ignore
        const { POST } = await import('../app/api/ai-tutor/chat/route');
        const response = await POST(mockRequest);
        const responseData = await response.json();
        
        results.push({
          query: testCase.query,
          fidelityScore: responseData.fidelityScore,
          wordCount: responseData.response.split(/\s+/).length,
          sourcesCount: responseData.sources?.length || 0,
          processingTime: responseData.processingTime
        });
      }
      
      // Validate consistency
      const avgFidelityScore = results.reduce((sum, r) => sum + r.fidelityScore, 0) / results.length;
      expect(avgFidelityScore).toBeGreaterThanOrEqual(0.85);
      
      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgProcessingTime).toBeLessThan(20000); // Average less than 20 seconds
      
      // All queries should have sources
      const queriesWithSources = results.filter(r => r.sourcesCount > 0).length;
      expect(queriesWithSources).toBe(results.length);

      console.log('📊 Quality consistency validation:', {
        avgFidelityScore: avgFidelityScore.toFixed(3),
        avgProcessingTime: avgProcessingTime.toFixed(0) + 'ms',
        avgWordCount: (results.reduce((sum, r) => sum + r.wordCount, 0) / results.length).toFixed(0),
        queriesWithSources
      });
    }, TEST_CONFIG.timeout * 2);

    test('should provide accurate citations with proper metadata', async () => {
      const testQuery = "What is the Tropic of Cancer and its significance for India?";
      
      const requestBody = {
        message: testQuery,
        userId: 'test-user-citations',
        context: {
          subject: 'Geography',
          class: 'Class IX',
          board: 'CBSE'
        }
      };

      const mockRequest = createMockRequest(requestBody);
        // @ts-ignore
      const { POST } = await import('../app/api/ai-tutor/chat/route');
      const response = await POST(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.sources).toBeDefined();
      expect(responseData.sources.length).toBeGreaterThan(0);
      
      const firstSource = responseData.sources[0];
      
      // Validate citation structure
      expect(firstSource).toHaveProperty('citation');
      expect(firstSource).toHaveProperty('chapter');
      expect(firstSource).toHaveProperty('page');
      expect(firstSource).toHaveProperty('confidence');
      
      // Validate citation format
      expect(firstSource.citation).toMatch(/\[.*Ch \d+.*Pg \d+.*\]/);
      
      // Validate metadata
      expect(firstSource.chapter).toBeGreaterThan(0);
      expect(firstSource.page).toBeGreaterThan(0);
      expect(firstSource.confidence).toBeGreaterThanOrEqual(0.8);

      console.log('✅ Citation validation passed:', {
        citation: firstSource.citation,
        chapter: firstSource.chapter,
        page: firstSource.page,
        confidence: firstSource.confidence
      });
    });
  });

  describe('⚡ Performance Validation', () => {
    test('should demonstrate caching benefits on repeated queries', async () => {
      const testQuery = "Define latitude";
      const requestBody = {
        message: testQuery,
        userId: 'test-user-performance',
        context: {
          subject: 'Geography',
          class: 'Class IX',
          board: 'CBSE'
        }
      };

      // First query (cold start)
      const mockRequest1 = createMockRequest(requestBody);
        // @ts-ignore
      const { POST } = await import('../app/api/ai-tutor/chat/route');
      
      const startTime1 = Date.now();
      const response1 = await POST(mockRequest1);
      const processingTime1 = Date.now() - startTime1;
      
      expect(response1.status).toBe(200);
      
      // Second query (should benefit from caching)
      const mockRequest2 = createMockRequest(requestBody);
      
      const startTime2 = Date.now();
      const response2 = await POST(mockRequest2);
      const processingTime2 = Date.now() - startTime2;
      
      expect(response2.status).toBe(200);
      
      // Second query should be faster (allowing for some variance)
      expect(processingTime2).toBeLessThan(processingTime1 * 1.2);

      console.log('⚡ Performance validation:', {
        firstQuery: processingTime1 + 'ms',
        secondQuery: processingTime2 + 'ms',
        improvement: ((processingTime1 - processingTime2) / processingTime1 * 100).toFixed(1) + '%'
      });
    });
  });

  describe('🛡️ Error Handling and Edge Cases', () => {
    test('should handle malformed requests gracefully', async () => {
      const malformedRequest = createMockRequest({
        // Missing required fields
        invalidField: 'test'
      });

        // @ts-ignore
      const { POST } = await import('../app/api/ai-tutor/chat/route');
      const response = await POST(malformedRequest);
      
      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty('error');
    });

    test('should handle empty queries appropriately', async () => {
      const emptyRequest = createMockRequest({
        message: '',
        userId: 'test-user-empty',
        context: {
          subject: 'Geography',
          class: 'Class IX',
          board: 'CBSE'
        }
      });

        // @ts-ignore
      const { POST } = await import('../app/api/ai-tutor/chat/route');
      const response = await POST(emptyRequest);
      
      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty('error');
    });

    test('should handle very long queries appropriately', async () => {
      const longQuery = 'What is latitude? '.repeat(100); // Very long query
      
      const longRequest = createMockRequest({
        message: longQuery,
        userId: 'test-user-long',
        context: {
          subject: 'Geography',
          class: 'Class IX',
          board: 'CBSE'
        }
      });

        // @ts-ignore
      const { POST } = await import('../app/api/ai-tutor/chat/route');
      const response = await POST(longRequest);
      
      // Should either handle it or return appropriate error
      expect([200, 400]).toContain(response.status);
    });
  });
});
