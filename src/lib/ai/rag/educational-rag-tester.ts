/**
 * Educational RAG Testing Framework
 * Comprehensive testing for NCERT content retrieval and educational query optimization
 */

import { EnhancedRAGPipeline } from './enhanced-rag-pipeline'
import { QdrantRAGSearch } from './qdrant-search'

interface TestQuery {
  query: string
  subject: string
  classLevel: string
  expectedKeywords: string[]
  category: 'basic' | 'complex' | 'multilingual' | 'mathematical'
}

interface TestResult {
  query: string
  success: boolean
  relevanceScore: number
  responseCompleteness: number
  curriculumAlignment: number
  retrievedResults: number
  searchMethod: string
  executionTime: number
  issues: string[]
}

export class EducationalRAGTester {
  private testQueries: TestQuery[] = [
    // Economics queries
    {
      query: 'What is organisation of production?',
      subject: 'Economics',
      classLevel: 'Class IX',
      expectedKeywords: ['factors of production', 'land', 'labour', 'capital', 'palampur'],
      category: 'basic'
    },
    {
      query: 'Explain factors of production with examples',
      subject: 'Economics',
      classLevel: 'Class IX',
      expectedKeywords: ['land', 'labour', 'physical capital', 'human capital', 'production'],
      category: 'complex'
    },
    {
      query: 'Village Palampur story',
      subject: 'Economics',
      classLevel: 'Class IX',
      expectedKeywords: ['palampur', 'farming', 'production', 'village', 'economic activity'],
      category: 'basic'
    },
    
    // Geography queries
    {
      query: 'Physical features of India',
      subject: 'Geography',
      classLevel: 'Class IX',
      expectedKeywords: ['mountains', 'plains', 'plateaus', 'himalayas', 'physical'],
      category: 'basic'
    },
    {
      query: 'What is drainage system?',
      subject: 'Geography',
      classLevel: 'Class IX',
      expectedKeywords: ['rivers', 'drainage', 'basin', 'water', 'flow'],
      category: 'basic'
    },
    
    // History queries
    {
      query: 'French Revolution causes',
      subject: 'History',
      classLevel: 'Class IX',
      expectedKeywords: ['revolution', 'france', 'causes', 'social', 'economic'],
      category: 'complex'
    },
    
    // Political Science queries
    {
      query: 'What is democracy?',
      subject: 'Political Science',
      classLevel: 'Class IX',
      expectedKeywords: ['democracy', 'government', 'people', 'elections', 'rights'],
      category: 'basic'
    },
    
    // Mathematical queries
    {
      query: 'Solve quadratic equation',
      subject: 'Mathematics',
      classLevel: 'Class X',
      expectedKeywords: ['quadratic', 'equation', 'formula', 'roots', 'solve'],
      category: 'mathematical'
    }
  ]

  async runComprehensiveTest(): Promise<{
    overallScore: number
    results: TestResult[]
    summary: {
      totalTests: number
      passed: number
      failed: number
      averageRelevance: number
      averageCompleteness: number
      averageCurriculumAlignment: number
    }
  }> {
    console.log('🧪 Starting Educational RAG Comprehensive Testing...')
    console.log(`📊 Testing ${this.testQueries.length} educational queries`)
    
    const results: TestResult[] = []
    
    for (const testQuery of this.testQueries) {
      console.log(`\n🔍 Testing: "${testQuery.query}"`)
      const result = await this.testSingleQuery(testQuery)
      results.push(result)
      
      // Log immediate result
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${testQuery.query} - Relevance: ${result.relevanceScore.toFixed(2)}`)
    }
    
    // Calculate summary statistics
    const summary = this.calculateSummary(results)
    const overallScore = (summary.averageRelevance + summary.averageCompleteness + summary.averageCurriculumAlignment) / 3
    
    console.log('\n📈 Educational RAG Test Summary:')
    console.log(`Overall Score: ${overallScore.toFixed(2)}/1.0`)
    console.log(`Tests Passed: ${summary.passed}/${summary.totalTests}`)
    console.log(`Average Relevance: ${summary.averageRelevance.toFixed(2)}`)
    console.log(`Average Completeness: ${summary.averageCompleteness.toFixed(2)}`)
    console.log(`Average Curriculum Alignment: ${summary.averageCurriculumAlignment.toFixed(2)}`)
    
    return { overallScore, results, summary }
  }

  private async testSingleQuery(testQuery: TestQuery): Promise<TestResult> {
    const startTime = Date.now()
    const issues: string[] = []
    
    try {
      // Test main RAG search
      const enhancedRAG = new EnhancedRAGPipeline();
      const ragResult = await enhancedRAG.search(testQuery.query, {
        subject: testQuery.subject,
        classLevel: testQuery.classLevel,
        topK: 10,
        enableFallback: true
      });
      
      let searchMethod = 'main_rag'
      let retrievedResults = ragResult.results?.length || 0
      
      // If main search fails, test emergency search
        // @ts-ignore
      if (!ragResult.success || retrievedResults === 0) {
        console.log('  🔄 Main RAG failed, testing emergency search...')
        const qdrantSearch = new QdrantRAGSearch();
        const emergencyResult = await qdrantSearch.search(testQuery.query, {
          subject: testQuery.subject,
          classLevel: testQuery.classLevel,
          topK: 5
        });
        
        if (emergencyResult.results && emergencyResult.results.length > 0) {
          retrievedResults = emergencyResult.results.length
          searchMethod = `emergency_${emergencyResult.searchMethod}`
        } else {
          issues.push('Both main and emergency search failed')
        }
      }
      
      // Calculate scores
      const relevanceScore = this.calculateRelevanceScore(ragResult, testQuery)
      const responseCompleteness = this.calculateCompletenessScore(ragResult, testQuery)
      const curriculumAlignment = this.calculateCurriculumAlignment(ragResult, testQuery)
      
      // Determine success
      const success = relevanceScore >= 0.6 && responseCompleteness >= 0.5 && retrievedResults > 0
      
      if (!success) {
        if (relevanceScore < 0.6) issues.push('Low relevance score')
        if (responseCompleteness < 0.5) issues.push('Incomplete response')
        if (retrievedResults === 0) issues.push('No results retrieved')
      }
      
      return {
        query: testQuery.query,
        success,
        relevanceScore,
        responseCompleteness,
        curriculumAlignment,
        retrievedResults,
        searchMethod,
        executionTime: Date.now() - startTime,
        issues
      }
      
    } catch (error) {
      console.error(`❌ Error testing query "${testQuery.query}":`, error)
      return {
        query: testQuery.query,
        success: false,
        relevanceScore: 0,
        responseCompleteness: 0,
        curriculumAlignment: 0,
        retrievedResults: 0,
        searchMethod: 'error',
        executionTime: Date.now() - startTime,
        issues: [`Error: ${error}`]
      }
    }
  }

  private calculateRelevanceScore(result: any, testQuery: TestQuery): number {
    if (!result.results || result.results.length === 0)
  return 0
    
    // Check for expected keywords in retrieved content
    const content = result.results.map((r: any) => r.content || '').join(' ').toLowerCase()
    const foundKeywords = testQuery.expectedKeywords.filter(keyword => 
      content.includes(keyword.toLowerCase())
    )
    
    return foundKeywords.length / testQuery.expectedKeywords.length
  }

  private calculateCompletenessScore(result: any, testQuery: TestQuery): number {
    if (!result.results || result.results.length === 0)
  return 0
    
    // Basic completeness based on content length and structure
    const totalContent = result.results.map((r: any) => r.content || '').join(' ')
    const hasSubstantialContent = totalContent.length > 100
    const hasMultipleResults = result.results.length > 1
    
    let score = 0
    if (hasSubstantialContent) score += 0.6
    if (hasMultipleResults) score += 0.2
    if (result.confidence === 'high') score += 0.2
    
    return Math.min(score, 1.0)
  }

  private calculateCurriculumAlignment(result: any, testQuery: TestQuery): number {
    if (!result.results || result.results.length === 0)
  return 0
    
    let alignmentScore = 0
    const totalResults = result.results.length
    
    result.results.forEach((r: any) => {
      if (r.metadata?.Subject === testQuery.subject) alignmentScore += 0.4
      if (r.metadata?.Class === testQuery.classLevel) alignmentScore += 0.3
      if (r.metadata?.curriculum === 'NCERT' || r.metadata?.source === 'NCERT') alignmentScore += 0.3
    })
    
    return alignmentScore / totalResults
  }

  private calculateSummary(results: TestResult[]) {
    const totalTests = results.length
    const passed = results.filter(r => r.success).length
    const failed = totalTests - passed
    
    const averageRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / totalTests
    const averageCompleteness = results.reduce((sum, r) => sum + r.responseCompleteness, 0) / totalTests
    const averageCurriculumAlignment = results.reduce((sum, r) => sum + r.curriculumAlignment, 0) / totalTests
    
    return {
      totalTests,
      passed,
      failed,
      averageRelevance,
      averageCompleteness,
      averageCurriculumAlignment
    }
  }
}

// Export singleton instance
export const educationalRAGTester = new EducationalRAGTester()
