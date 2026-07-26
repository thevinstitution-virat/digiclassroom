import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to verify advanced components can be imported
 */
export async function GET(request: NextRequest) {
  try {
    // Test importing advanced components
    const componentTests = []

    try {
      const { AdvancedStructureParser } = await import('@/lib/content/advanced-structure-parser')
      componentTests.push({ name: 'AdvancedStructureParser', status: 'importable', class: !!AdvancedStructureParser })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'AdvancedStructureParser', status: 'error', error: error.message })
    }

    try {
      const { EntityAwareChunker } = await import('@/lib/content/entity-aware-chunker')
      componentTests.push({ name: 'EntityAwareChunker', status: 'importable', class: !!EntityAwareChunker })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'EntityAwareChunker', status: 'error', error: error.message })
    }

    try {
      const { HybridRetrievalEngine } = await import('@/lib/retrieval/hybrid-retrieval-engine')
      componentTests.push({ name: 'HybridRetrievalEngine', status: 'importable', class: !!HybridRetrievalEngine })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'HybridRetrievalEngine', status: 'error', error: error.message })
    }

    try {
      const { StrictTextbookGenerator } = await import('@/lib/generation/strict-textbook-generator')
      componentTests.push({ name: 'StrictTextbookGenerator', status: 'importable', class: !!StrictTextbookGenerator })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'StrictTextbookGenerator', status: 'error', error: error.message })
    }

    try {
      const { SentenceVerificationEngine } = await import('@/lib/verification/sentence-verification-engine')
      componentTests.push({ name: 'SentenceVerificationEngine', status: 'importable', class: !!SentenceVerificationEngine })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'SentenceVerificationEngine', status: 'error', error: error.message })
    }

    try {
      const { AccurateCitationGenerator } = await import('@/lib/citations/accurate-citation-generator')
      componentTests.push({ name: 'AccurateCitationGenerator', status: 'importable', class: !!AccurateCitationGenerator })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'AccurateCitationGenerator', status: 'error', error: error.message })
    }

    try {
      const { GoldenSetValidator } = await import('@/lib/quality/golden-set-validator')
      componentTests.push({ name: 'GoldenSetValidator', status: 'importable', class: !!GoldenSetValidator })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'GoldenSetValidator', status: 'error', error: error.message })
    }

    try {
      const { ContinuousQualityMonitor } = await import('@/lib/quality/continuous-quality-monitor')
      componentTests.push({ name: 'ContinuousQualityMonitor', status: 'importable', class: !!ContinuousQualityMonitor })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'ContinuousQualityMonitor', status: 'error', error: error.message })
    }

    try {
      const { ServiceLifecycleManager } = await import('@/lib/services/service-lifecycle-manager')
      componentTests.push({ name: 'ServiceLifecycleManager', status: 'importable', class: !!ServiceLifecycleManager })
    } catch (error) {
        // @ts-ignore
      componentTests.push({ name: 'ServiceLifecycleManager', status: 'error', error: error.message })
    }

    const successfulImports = componentTests.filter(test => test.status === 'importable').length
    const totalComponents = componentTests.length
    const successRate = (successfulImports / totalComponents) * 100

    return NextResponse.json({
      status: successRate === 100 ? 'all_components_ready' : 'some_issues_detected',
      timestamp: new Date().toISOString(),
      summary: {
        totalComponents,
        successfulImports,
        failedImports: totalComponents - successfulImports,
        successRate: `${successRate.toFixed(1)}%`
      },
      componentTests,
      systemReadiness: successRate >= 80 ? 'ready' : 'needs_attention'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Component test failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
