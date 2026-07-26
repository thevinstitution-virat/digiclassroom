import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import type { AdminDashboardStats } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

/**
 * GET /api/super-admin/materials/stats
 * Get comprehensive statistics for materials dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Get total materials count
      const [totalMaterialsResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM materials WHERE is_active = TRUE'
      ) as any[]
      const totalMaterials = totalMaterialsResult[0]?.total || 0

      // Get pending approvals count
      const [pendingApprovalsResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM materials WHERE status = ? AND is_active = TRUE',
        ['pending_review']
      ) as any[]
      const pendingApprovals = pendingApprovalsResult[0]?.total || 0

      // Get total downloads
      const [totalDownloadsResult] = await connection.execute(
        'SELECT SUM(download_count) as total FROM materials WHERE is_active = TRUE'
      ) as any[]
      const totalDownloads = totalDownloadsResult[0]?.total || 0

      // Get total views
      const [totalViewsResult] = await connection.execute(
        'SELECT SUM(view_count) as total FROM materials WHERE is_active = TRUE'
      ) as any[]
      const totalViews = totalViewsResult[0]?.total || 0

      // Get storage used (sum of file sizes)
      const [storageUsedResult] = await connection.execute(
        'SELECT SUM(file_size) as total FROM materials WHERE is_active = TRUE'
      ) as any[]
      const storageUsed = storageUsedResult[0]?.total || 0

      // Get recent uploads (last 7 days)
      const [recentUploadsResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM materials WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND is_active = TRUE'
      ) as any[]
      const recentUploads = recentUploadsResult[0]?.total || 0

      // Get materials by board
      const [materialsByBoardResult] = await connection.execute(
        'SELECT board, COUNT(*) as count FROM materials WHERE is_active = TRUE GROUP BY board'
      ) as any[]
      const materialsByBoard: Record<string, number> = {}
      materialsByBoardResult.forEach((row: any) => {
        materialsByBoard[row.board] = row.count
      })

      // Get materials by type
      const [materialsByTypeResult] = await connection.execute(
        'SELECT type, COUNT(*) as count FROM materials WHERE is_active = TRUE GROUP BY type'
      ) as any[]
      const materialsByType: Record<string, number> = {}
      materialsByTypeResult.forEach((row: any) => {
        materialsByType[row.type] = row.count
      })

      // Get materials by class
      const [materialsByClassResult] = await connection.execute(
        'SELECT class, COUNT(*) as count FROM materials WHERE is_active = TRUE GROUP BY class ORDER BY class'
      ) as any[]
      const materialsByClass: Record<string, number> = {}
      materialsByClassResult.forEach((row: any) => {
        materialsByClass[row.class.toString()] = row.count
      })

      const stats: AdminDashboardStats = {
        totalMaterials,
        pendingApprovals,
        totalDownloads,
        totalViews,
        storageUsed,
        recentUploads,
        materialsByBoard,
        materialsByType,
        materialsByClass
      }

      return NextResponse.json({
        success: true,
        data: stats
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error fetching materials stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials statistics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/super-admin/materials/stats
 * Refresh and recalculate statistics (for manual refresh)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Update view counts from access logs
      await connection.execute(`
        UPDATE materials m 
        SET view_count = (
          SELECT COUNT(*) 
          FROM user_material_access uma 
          WHERE uma.material_id = m.id 
          AND uma.access_type = 'view'
        )
      `)

      // Update download counts from access logs
      await connection.execute(`
        UPDATE materials m 
        SET download_count = (
          SELECT COUNT(*) 
          FROM user_material_access uma 
          WHERE uma.material_id = m.id 
          AND uma.access_type = 'download'
        )
      `)

      return NextResponse.json({
        success: true,
        message: 'Statistics refreshed successfully'
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error refreshing materials stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh statistics' },
      { status: 500 }
    )
  }
}
