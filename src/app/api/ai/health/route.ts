import { NextResponse } from 'next/server'
import { connectionManager } from '@/lib/ai/rag/connection-manager'

export const runtime = 'nodejs'

export async function GET() {
  console.log('🏥 AI Health check called')
  
  try {
    // Initialize connection manager
    await connectionManager.initialize()
    
    // Perform comprehensive health check
    const healthStatus = await connectionManager.performHealthCheck()
    
    // Additional system checks
    const systemInfo = {
      timestamp: new Date().toISOString(),
      uptime: healthStatus.uptime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: {
        fullSystemAvailable: connectionManager.isFullyAvailable()
      }
    }

    // Determine HTTP status code based on health
    let statusCode = 200
    if (healthStatus.status === 'degraded') {
      statusCode = 206 // Partial Content
    } else if (healthStatus.status === 'unhealthy') {
      statusCode = 503 // Service Unavailable
    }

    return NextResponse.json({
      status: healthStatus.status,
      service: 'AI Services Health Check',
      ...systemInfo,
      services: healthStatus.services,
      capabilities: {
        chatCompletion: true,
        vectorSearch: connectionManager.isQdrantAvailable(),
        ragSearch: connectionManager.isFullyAvailable(),
        streamingResponses: true,
        roleBasedPrompting: true,
        contextAwareConversations: true,
        cbseCurriculumAlignment: connectionManager.isQdrantAvailable()
      },
      features: [
        'Enhanced RAG search with multiple strategies',
        'Role-based educational prompting',
        'Streaming chat responses',
        'CBSE curriculum alignment',
        'Multi-class support',
        'Cultural context adaptation',
        'Intelligent content formatting'
      ],
      recommendations: generateHealthRecommendations(healthStatus)
    }, { status: statusCode })

  } catch (error) {
    console.error('❌ Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      service: 'AI Services Health Check',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        qdrant: {
          status: 'unknown',
          lastChecked: new Date().toISOString(),
          error: 'Health check failed'
        }
      },
      capabilities: {
        chatCompletion: false,
        vectorSearch: false,
        ragSearch: false,
        streamingResponses: false,
        roleBasedPrompting: false,
        contextAwareConversations: false,
        cbseCurriculumAlignment: false
      },
      recommendations: [
        'Check environment variables configuration',
        'Verify API keys are valid and have proper permissions',
        'Ensure network connectivity to external services',
        'Review application logs for detailed error information'
      ]
    }, { status: 503 })
  }
}

// Generate health-based recommendations
function generateHealthRecommendations(healthStatus: any): string[] {
  const recommendations: string[] = []

  // Qdrant recommendations
  if (healthStatus.services.qdrant.status === 'unhealthy') {
    recommendations.push('Check Qdrant URL and collection configuration')
    recommendations.push('Verify Qdrant service is running and accessible')
    recommendations.push('Ensure Qdrant collection exists and has correct schema')
  } else if (healthStatus.services.qdrant.status === 'degraded') {
    recommendations.push('Monitor Qdrant query performance')
  }

  // Overall system recommendations
  if (healthStatus.status === 'unhealthy') {
    recommendations.push('System is not operational - immediate attention required')
    recommendations.push('Check all environment variables and API configurations')
  } else if (healthStatus.status === 'degraded') {
    recommendations.push('System is partially operational - monitor closely')
    recommendations.push('Consider implementing fallback mechanisms')
  } else {
    recommendations.push('System is healthy - continue monitoring')
    recommendations.push('Consider implementing proactive monitoring alerts')
  }

  return recommendations
}

// POST endpoint for manual health check trigger
export async function POST() {
  try {
    await connectionManager.initialize()
    const healthStatus = await connectionManager.performHealthCheck()
    
    return NextResponse.json({
      message: 'Manual health check completed',
      ...healthStatus,
      triggeredAt: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Manual health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      triggeredAt: new Date().toISOString()
    }, { status: 500 })
  }
}
