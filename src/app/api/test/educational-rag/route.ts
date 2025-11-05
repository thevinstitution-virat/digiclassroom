/**
 * Educational RAG Testing API Endpoint
 * Provides comprehensive testing for NCERT content retrieval optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { educationalRAGTester } from '@/lib/ai/rag/educational-rag-tester'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Educational RAG Testing API called')
    
    // Run comprehensive educational RAG tests
    const testResults = await educationalRAGTester.runComprehensiveTest()
    
    // Format response with detailed analysis
    const response = {
      timestamp: new Date().toISOString(),
      testType: 'Educational RAG Comprehensive Test',
      status: testResults.overallScore >= 0.7 ? 'PASS' : 'NEEDS_IMPROVEMENT',
      overallScore: testResults.overallScore,
      summary: testResults.summary,
      results: testResults.results,
      recommendations: generateRecommendations(testResults),
      nextSteps: generateNextSteps(testResults)
    }
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('❌ Educational RAG testing error:', error)
    
    return NextResponse.json({
      error: 'Educational RAG testing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, subject, classLevel, expectedKeywords } = body
    
    if (!query || !subject || !classLevel) {
      return NextResponse.json({
        error: 'Missing required fields: query, subject, classLevel'
      }, { status: 400 })
    }
    
    console.log(`🔍 Testing single educational query: "${query}"`)
    
    // Test single query
    const testQuery = {
      query,
      subject,
      classLevel,
      expectedKeywords: expectedKeywords || [],
      category: 'custom' as const
    }
    
    // This would require exposing the testSingleQuery method or creating a new one
    // For now, we'll use the comprehensive test and filter results
    const testResults = await educationalRAGTester.runComprehensiveTest()
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      testType: 'Single Educational Query Test',
      query: testQuery,
      // Note: This is a simplified response - in a full implementation,
      // we'd add a method to test single queries
      message: 'Single query testing requires additional implementation'
    }, { status: 200 })
    
  } catch (error) {
    console.error('❌ Single query testing error:', error)
    
    return NextResponse.json({
      error: 'Single query testing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

function generateRecommendations(testResults: any): string[] {
  const recommendations: string[] = []
  const { summary, overallScore } = testResults
  
  if (overallScore < 0.7) {
    recommendations.push('Overall RAG performance needs improvement')
  }
  
  if (summary.averageRelevance < 0.6) {
    recommendations.push('Consider adjusting similarity thresholds - relevance scores are low')
    recommendations.push('Review embedding model configuration for educational content')
  }
  
  if (summary.averageCompleteness < 0.5) {
    recommendations.push('Increase topK values to retrieve more comprehensive content')
    recommendations.push('Optimize chunking strategy for educational content structure')
  }
  
  if (summary.averageCurriculumAlignment < 0.7) {
    recommendations.push('Improve metadata filtering for NCERT curriculum alignment')
    recommendations.push('Enhance subject and class-level detection accuracy')
  }
  
  if (summary.failed > summary.passed) {
    recommendations.push('Critical: More tests failing than passing - review core RAG logic')
    recommendations.push('Consider implementing hybrid search approach')
  }
  
  // Positive recommendations
  if (overallScore >= 0.8) {
    recommendations.push('Excellent performance! Consider fine-tuning for edge cases')
  }
  
  return recommendations
}

function generateNextSteps(testResults: any): string[] {
  const nextSteps: string[] = []
  const { summary, results } = testResults
  
  // Analyze failed tests for patterns
  const failedTests = results.filter((r: any) => !r.success)
  const failurePatterns = analyzeFailurePatterns(failedTests)
  
  if (failurePatterns.noResults > 0) {
    nextSteps.push(`Fix ${failurePatterns.noResults} queries returning no results`)
  }
  
  if (failurePatterns.lowRelevance > 0) {
    nextSteps.push(`Improve relevance for ${failurePatterns.lowRelevance} queries`)
  }
  
  if (failurePatterns.incompleteResponses > 0) {
    nextSteps.push(`Enhance completeness for ${failurePatterns.incompleteResponses} queries`)
  }
  
  // Implementation priorities
  if (summary.averageRelevance < 0.6) {
    nextSteps.push('Priority 1: Implement similarity threshold optimization')
  }
  
  if (summary.averageCompleteness < 0.5) {
    nextSteps.push('Priority 2: Implement educational chunking strategy')
  }
  
  if (summary.averageCurriculumAlignment < 0.7) {
    nextSteps.push('Priority 3: Enhance metadata filtering and curriculum alignment')
  }
  
  // Testing and monitoring
  nextSteps.push('Set up automated testing pipeline for continuous RAG optimization')
  nextSteps.push('Implement real-time performance monitoring for educational queries')
  
  return nextSteps
}

function analyzeFailurePatterns(failedTests: any[]): {
  noResults: number
  lowRelevance: number
  incompleteResponses: number
  errors: number
} {
  const patterns = {
    noResults: 0,
    lowRelevance: 0,
    incompleteResponses: 0,
    errors: 0
  }
  
  failedTests.forEach(test => {
    if (test.retrievedResults === 0) patterns.noResults++
    if (test.relevanceScore < 0.6) patterns.lowRelevance++
    if (test.responseCompleteness < 0.5) patterns.incompleteResponses++
    if (test.searchMethod === 'error') patterns.errors++
  })
  
  return patterns
}
