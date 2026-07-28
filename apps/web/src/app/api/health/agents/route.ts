import { NextResponse } from 'next/server'
import { MenuRouter } from '@/lib/ai/menu/menu-router'

/**
 * Health Check Endpoint for Agent Initialization
 * 
 * This endpoint verifies that all specialized agents are properly initialized
 * and have their required methods available.
 * 
 * Usage:
 *   GET /api/health/agents
 * 
 * Returns:
 *   {
 *     status: 'healthy' | 'degraded' | 'unhealthy',
 *     timestamp: ISO timestamp,
 *     agents: {
 *       [agentName]: {
 *         initialized: boolean,
 *         hasMethod: boolean,
 *         methodName: string
 *       }
 *     }
 *   }
 */
export async function GET() {
  try {
    // Initialize MenuRouter to check agent availability
    const menuRouter = new MenuRouter()
    
    // Check each agent's initialization and method availability
    const checks = {
      doubtAgent: {
        initialized: !!(menuRouter as any).doubtAgent,
        hasMethod: typeof (menuRouter as any).doubtAgent?.resolve_doubt_professionally === 'function',
        methodName: 'resolve_doubt_professionally',
        expectedFor: 'clear_doubts menu intent'
      },
      homeworkAgent: {
        initialized: !!(menuRouter as any).homeworkAgent,
        hasMethod: typeof (menuRouter as any).homeworkAgent?.help_with_homework === 'function',
        methodName: 'help_with_homework',
        expectedFor: 'homework_help menu intent'
      },
      topicAgent: {
        initialized: !!(menuRouter as any).topicAgent,
        hasMethod: typeof (menuRouter as any).topicAgent?.explain_topic_legacy === 'function',
        methodName: 'explain_topic_legacy',
        expectedFor: 'explain_topic menu intent'
      },
      examAgent: {
        initialized: !!(menuRouter as any).examAgent,
        hasMethod: typeof (menuRouter as any).examAgent?.create_exam_strategy === 'function',
        methodName: 'create_exam_strategy',
        expectedFor: 'exam_prep menu intent'
      },
      studyCoach: {
        initialized: !!(menuRouter as any).studyCoach,
        hasMethod: typeof (menuRouter as any).studyCoach?.provide_study_guidance === 'function',
        methodName: 'provide_study_guidance',
        expectedFor: 'study_tips menu intent'
      }
    }
    
    // Determine overall health status
    const allInitialized = Object.values(checks).every(check => check.initialized)
    const allMethodsAvailable = Object.values(checks).every(check => check.hasMethod)
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (allInitialized && allMethodsAvailable) {
      status = 'healthy'
    } else if (allInitialized) {
      status = 'degraded' // Agents initialized but some methods missing
    } else {
      status = 'unhealthy' // Some agents failed to initialize
    }
    
    // Identify any issues
    const issues: string[] = []
    Object.entries(checks).forEach(([agentName, check]) => {
      if (!check.initialized) {
        issues.push(`${agentName} failed to initialize`)
      } else if (!check.hasMethod) {
        issues.push(`${agentName} missing method: ${check.methodName}`)
      }
    })
    
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      agents: checks,
      issues: issues.length > 0 ? issues : undefined,
      message: status === 'healthy' 
        ? 'All agents initialized and ready' 
        : `Health check ${status}: ${issues.join(', ')}`
    })
    
  } catch (error) {
    console.error('❌ [Health Check] Failed to initialize MenuRouter:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to initialize MenuRouter - check server logs'
    }, { status: 500 })
  }
}

