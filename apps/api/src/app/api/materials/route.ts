import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MaterialsFilter, MaterialItem } from '@/types/user-management'
import type { EnhancedMaterial } from '@/types/google-drive'
import { getConnection } from '@/lib/db/connection' // ✅ Use centralized connection pool
import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context'
import { getTenantContextOrNull } from '@/lib/db/tenant-context'
import { tenantSql, type TenantContext } from '@/lib/db/tenant-scope'
import { logger } from '@/lib/logger'

// Validation schema for materials request
const MaterialsRequestSchema = z.object({
  board: z.enum(['CBSE', 'ICSE', 'STATE_BOARD']).optional(),
  medium: z.enum(['ENGLISH', 'HINDI']).optional(),
  class: z.number().min(1).max(12).optional(),
  stream: z.enum(['HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE']).optional(),
  subject: z.string().optional(),
  type: z.enum(['notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference']).optional(),
  searchQuery: z.string().optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['title', 'date', 'downloads', 'relevance']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
})

/**
 * GET /api/materials
 * Fetch materials based on user profile and filters, scoped to the organization
 */
export async function GET(request: NextRequest) {
  try {
    // B2B2C: institution members see their org + global; individual (B2C/D2C)
    // learners see global (NCERT base) content. No more blanket 403 for no-org users.
    const ctx = await getTenantContextOrNull();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId, orgId } = ctx;

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    // Convert string numbers to actual numbers
        // @ts-ignore
    if (queryParams.class) queryParams.class = parseInt(queryParams.class)
        // @ts-ignore
    if (queryParams.page) queryParams.page = parseInt(queryParams.page)
        // @ts-ignore
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit)
        // @ts-ignore
    if (queryParams.tags) queryParams.tags = (queryParams.tags as string).split(',')

    // Validate request
    const validatedParams = MaterialsRequestSchema.parse(queryParams)

    // The user profile only supplies DEFAULT filters when the caller omits them.
    // It must never block browsing — individual/B2C learners may have no profile,
    // and the fetch is best-effort (returns null on any error). No 400/500 here.
    const userProfile = await getUserProfile(userId, orgId)

    // Apply user profile defaults if not specified
    const filter: MaterialsFilter = {
      board: validatedParams.board || userProfile?.board,
      medium: validatedParams.medium || userProfile?.medium,
      class: validatedParams.class || userProfile?.class,
      stream: validatedParams.stream || userProfile?.stream,
      subject: validatedParams.subject,
      type: validatedParams.type,
      searchQuery: validatedParams.searchQuery,
      tags: validatedParams.tags,
      difficulty: validatedParams.difficulty
    }

    // Fetch materials, scoped to this caller (org + global, or global for B2C)
    const materials = await getMaterials(filter, {
      page: validatedParams.page,
      limit: validatedParams.limit,
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder
    }, ctx)

    // Log access for analytics
    await logMaterialAccess(userId, 'browse', filter, orgId)

    return NextResponse.json({
      success: true,
      data: materials.items,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        // @ts-ignore
        total: materials.total,
        // @ts-ignore
        totalPages: Math.ceil(materials.total / validatedParams.limit)
      },
      filter: filter
    })

  } catch (error) {
        // @ts-ignore
    logger.error('Error fetching materials:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/materials
 * Create or update material (admin only)
 */
export const POST = withOrgContext(async (request: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await request.json()
    
    // Validate material data
    const materialData = validateMaterialData(body)
    
    // Create or update material scoped to org
    const material = await createOrUpdateMaterial({ ...materialData, organizationId: orgContext.orgId })
    
    return NextResponse.json({
      success: true,
      data: material
    })

  } catch (error) {
        // @ts-ignore
    logger.error('Error creating/updating material:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
        // @ts-ignore
}, { requireOrg: true, roles: ['admin', 'org_admin', 'owner'] });

// Helper functions (these would typically be in separate service files)

async function getUserProfile(userId: string, orgId: string | null) {
  const connection = await getConnection()

  try {
    const [rows] = await connection.execute(
      'SELECT board, medium, class, stream, is_onboarding_complete FROM user_profiles WHERE user_id = ? AND organization_id = ?',
      [userId, orgId]
    ) as any[]

    if (rows.length === 0) {
      // Fallback to legacy global profiles if no org-specific profile exists
      const [legacyRows] = await connection.execute(
        'SELECT board, medium, class, stream, is_onboarding_complete FROM user_profiles WHERE user_id = ?',
        [userId]
      ) as any[]

      if (legacyRows.length > 0) return legacyRows[0]
      return null
    }

    const profile = rows[0]
    return {
      userId,
      board: profile.board,
      medium: profile.medium,
      class: profile.class,
      stream: profile.stream,
      isOnboardingComplete: profile.is_onboarding_complete
    }
  } catch (error) {
    // Best-effort: the profile only supplies default filters. Never fail browsing
    // because of it (e.g. missing/legacy table, or a B2C user with no profile).
        // @ts-ignore
    logger.warn('getUserProfile failed (continuing without profile defaults):', error)
    return null
  } finally {
    connection.release() // ✅ Release connection back to pool
  }
}

async function createDefaultUserProfile(userId: string, orgId: string | null) {
  const connection = await getConnection()

  try {
    // Create a default profile for testing
    await connection.execute(`
      INSERT INTO user_profiles (id, user_id, organization_id, board, medium, class, stream, is_onboarding_complete)
      VALUES (gen_random_uuid()::text, ?, ?, 'CBSE', 'ENGLISH', 10, NULL, TRUE)
    `, [userId, orgId])

    logger.info(`Default user profile created for user: ${userId} in org: ${orgId}`)

    // Return the created profile
    return {
      userId,
      board: 'CBSE',
      medium: 'ENGLISH',
      class: 10,
      stream: null,
      isOnboardingComplete: true
    }
  } catch (error) {
        // @ts-ignore
    logger.error('Error creating default user profile:', error)
    return null
  } finally {
    connection.release() // ✅ Release connection back to pool
  }
}

async function getMaterials(
  filter: MaterialsFilter,
  pagination: {
    page: number
    limit: number
    sortBy: string
    sortOrder: string
  },
  ctx: TenantContext
) {
  const connection = await getConnection()

  try {
    // Build WHERE clause based on filters
    const whereConditions: string[] = []
    const queryValues: any[] = []

    // 🔒 Tenant isolation (B2B2C): org member → org + global; B2C → global; staff → all
    const orgScope = tenantSql(ctx, 'm').orgOrGlobal()
    whereConditions.push(orgScope.clause)
    queryValues.push(...orgScope.params)

    // Only show approved and active materials to users
    whereConditions.push('m.status = ? AND m.is_active = TRUE')
    queryValues.push('approved')

    if (filter.board) {
      whereConditions.push('m.board = ?')
      queryValues.push(filter.board)
    }

    if (filter.medium) {
      whereConditions.push('m.medium = ?')
      queryValues.push(filter.medium)
    }

    if (filter.class) {
      whereConditions.push('m.class = ?')
      queryValues.push(filter.class)
    }

    if (filter.stream) {
      whereConditions.push('m.stream = ?')
      queryValues.push(filter.stream)
    }

    if (filter.subject) {
      whereConditions.push('m.subject = ?')
      queryValues.push(filter.subject)
    }

    if (filter.type) {
      whereConditions.push('m.type = ?')
      queryValues.push(filter.type)
    }

    if (filter.difficulty) {
      whereConditions.push('m.difficulty = ?')
      queryValues.push(filter.difficulty)
    }

    if (filter.searchQuery) {
      whereConditions.push('(m.title LIKE ? OR m.description LIKE ? OR m.subject LIKE ?)')
      const searchTerm = `%${filter.searchQuery}%`
      queryValues.push(searchTerm, searchTerm, searchTerm)
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => 'JSON_CONTAINS(m.tags, ?)').join(' OR ')
      whereConditions.push(`(${tagConditions})`)
      filter.tags.forEach(tag => {
        queryValues.push(JSON.stringify(tag))
      })
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Build ORDER BY clause
    let orderByClause = ''
    switch (pagination.sortBy) {
      case 'title':
        orderByClause = `ORDER BY m.title ${pagination.sortOrder.toUpperCase()}`
        break
      case 'date':
        orderByClause = `ORDER BY m.created_at ${pagination.sortOrder.toUpperCase()}`
        break
      case 'downloads':
        orderByClause = `ORDER BY m.download_count ${pagination.sortOrder.toUpperCase()}`
        break
      default:
        orderByClause = `ORDER BY m.created_at ${pagination.sortOrder.toUpperCase()}`
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM materials m ${whereClause}`
    const [countResult] = await connection.execute(countQuery, queryValues) as any[]
    const total = countResult[0]?.total || 0

    // Calculate pagination. LIMIT/OFFSET are inlined as validated integers —
    // mysql2 prepared statements reject `LIMIT ? OFFSET ?` (ER_WRONG_ARGUMENTS),
    // and these come from zod-validated numbers so there's no injection risk.
    const totalPages = Math.ceil(total / pagination.limit)
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(pagination.limit) || 20)))
    const offset = Math.max(0, (pagination.page - 1) * safeLimit)

    // Get materials with pagination
    const materialsQuery = `
      SELECT
        m.id, m.title, m.description, m.type, m.board, m.medium, m.class, m.stream, m.subject, m.sm_type,
        m.google_drive_file_id as fileId, m.file_name as fileName, m.file_size as fileSize,
        m.download_url as downloadUrl, m.view_url as viewerUrl, m.thumbnail_url as thumbnailUrl,
        m.download_count as downloadCount, m.tags, m.difficulty, m.metadata,
        m.created_at as createdAt, m.updated_at as updatedAt
      FROM materials m
      ${whereClause}
      ${orderByClause}
      LIMIT ${safeLimit} OFFSET ${offset}
    `

    const [materialsResult] = await connection.execute(
      materialsQuery,
      [...queryValues]
    ) as any[]

    // Transform database results to MaterialItem format
    const materials: MaterialItem[] = materialsResult.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      board: row.board,
      medium: row.medium,
      class: row.class,
      stream: row.stream,
      subject: row.subject,
      smType: row.sm_type,
      fileId: row.fileId,
      fileName: row.fileName,
      fileSize: row.fileSize,
      downloadUrl: row.downloadUrl,
      viewerUrl: row.viewerUrl,
      thumbnailUrl: row.thumbnailUrl,
      downloadCount: row.downloadCount || 0,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: {
        ...row.metadata ? JSON.parse(row.metadata) : {},
        difficulty: row.difficulty
      },
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }))

    return {
      items: materials,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages
      }
    }
  } finally {
    connection.release() // ✅ Release connection back to pool
  }
}

async function logMaterialAccess(
  userId: string,
  accessType: string,
  filter: MaterialsFilter,
  orgId: string | null
) {
  const connection = await getConnection()

  try {
    await connection.execute(`
      INSERT INTO user_material_access (user_id, organization_id, access_type, filter_data, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      orgId,
      accessType,
      JSON.stringify(filter),
      'unknown', // In real implementation, get from request headers
      'unknown'  // In real implementation, get from request headers
    ])
  } catch (error) {
        // @ts-ignore
    logger.warn('Failed to log material access:', error)
  } finally {
    connection.release() // ✅ Release connection back to pool
  }
}

function validateMaterialData(data: any) {
  return data
}

async function createOrUpdateMaterial(data: any) {
  return data
}
