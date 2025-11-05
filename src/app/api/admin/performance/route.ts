import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkDatabaseHealth } from '@/lib/db/connection'
import { getStartupReport } from '@/lib/monitoring/startup-monitor'
import os from 'os'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    let isAdmin = userRole === 'admin'

    // Special admin access for designated admin email
    if (!isAdmin) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server')
        const user = await clerkClient.users.getUser(userId)
        const userEmail = user.emailAddresses[0]?.emailAddress

        if (userEmail === 'thevinstitution@gmail.com') {
          isAdmin = true
        }
      } catch (error) {
        console.error('Error checking admin email:', error)
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Collect comprehensive system performance metrics
    const memoryUsage = process.memoryUsage()
    const cpuLoad = os.loadavg()

    const metrics = {
      timestamp: new Date().toISOString(),
      database: {
        status: 'unknown',
        responseTime: 0
      },
      system: {
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        cpuLoad: {
          "1m": cpuLoad[0],
          "5m": cpuLoad[1],
          "15m": cpuLoad[2]
        },
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length
      }
    }

    // Test database connection
    try {
      const dbStart = Date.now()
      const dbHealthy = await checkDatabaseHealth()
      metrics.database = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - dbStart
      }
    } catch (error) {
      metrics.database = {
        status: 'error',
        responseTime: 0
      }
    }



    // Get additional performance data
    const startupReport = getStartupReport()

    // Get bundle analysis if available
    let bundleAnalysis = null
    try {
      const buildManifestPath = path.join(process.cwd(), '.next', 'build-manifest.json')
      if (fs.existsSync(buildManifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))
        bundleAnalysis = {
          pages: Object.keys(manifest.pages || {}).length,
          totalChunks: Object.values(manifest.pages || {}).flat().length
        }
      }
    } catch (error) {
      console.log('Bundle analysis not available:', error)
    }

    return NextResponse.json({
      success: true,
      metrics,
      startup: startupReport,
      bundle: bundleAnalysis
    })

  } catch (error) {
    console.error('Performance metrics error:', error)
    return NextResponse.json({
      error: 'Failed to get performance metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
