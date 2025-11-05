import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import mysql from 'mysql2/promise'
import { MaterialsFilter, MaterialItem } from '@/types/user-management'
import type { EnhancedMaterial } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

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
 * Fetch materials based on user profile and filters
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    // Convert string numbers to actual numbers
    if (queryParams.class) queryParams.class = parseInt(queryParams.class)
    if (queryParams.page) queryParams.page = parseInt(queryParams.page)
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit)
    if (queryParams.tags) queryParams.tags = queryParams.tags.split(',')

    // Validate request
    const validatedParams = MaterialsRequestSchema.parse(queryParams)

    // Get user profile to apply default filters
    let userProfile = await getUserProfile(userId)
    if (!userProfile) {
      // Create a default user profile for testing
      console.log(`Creating default user profile for user: ${userId}`)
      userProfile = await createDefaultUserProfile(userId)

      if (!userProfile) {
        return NextResponse.json(
          { error: 'User profile not found. Please complete onboarding.' },
          { status: 400 }
        )
      }
    }

    // Apply user profile defaults if not specified
    const filter: MaterialsFilter = {
      board: validatedParams.board || userProfile.board,
      medium: validatedParams.medium || userProfile.medium,
      class: validatedParams.class || userProfile.class,
      stream: validatedParams.stream || userProfile.stream,
      subject: validatedParams.subject,
      type: validatedParams.type,
      searchQuery: validatedParams.searchQuery,
      tags: validatedParams.tags,
      difficulty: validatedParams.difficulty
    }

    // Fetch materials from database
    const materials = await getMaterials(filter, {
      page: validatedParams.page,
      limit: validatedParams.limit,
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder
    })

    // Log access for analytics
    await logMaterialAccess(userId, 'browse', filter)

    return NextResponse.json({
      success: true,
      data: materials.items,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total: materials.total,
        totalPages: Math.ceil(materials.total / validatedParams.limit)
      },
      filter: filter
    })

  } catch (error) {
    console.error('Error fetching materials:', error)
    
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
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate material data
    const materialData = validateMaterialData(body)
    
    // Create or update material
    const material = await createOrUpdateMaterial(materialData)
    
    return NextResponse.json({
      success: true,
      data: material
    })

  } catch (error) {
    console.error('Error creating/updating material:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (these would typically be in separate service files)

async function getUserProfile(userId: string) {
  const connection = await mysql.createConnection(dbConfig)

  try {
    const [rows] = await connection.execute(
      'SELECT board, medium, class, stream, is_onboarding_complete FROM user_profiles WHERE user_id = ?',
      [userId]
    ) as any[]

    if (rows.length === 0) {
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
  } finally {
    await connection.end()
  }
}

async function createDefaultUserProfile(userId: string) {
  const connection = await mysql.createConnection(dbConfig)

  try {
    // Create a default profile for testing
    await connection.execute(`
      INSERT INTO user_profiles (id, user_id, board, medium, class, stream, is_onboarding_complete)
      VALUES (UUID(), ?, 'CBSE', 'ENGLISH', 10, NULL, TRUE)
    `, [userId])

    console.log(`Default user profile created for user: ${userId}`)

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
    console.error('Error creating default user profile:', error)
    return null
  } finally {
    await connection.end()
  }
}

async function getMaterials(
  filter: MaterialsFilter,
  pagination: {
    page: number
    limit: number
    sortBy: string
    sortOrder: string
  }
) {
  const connection = await mysql.createConnection(dbConfig)

  try {
    // Build WHERE clause based on filters
    const whereConditions: string[] = []
    const queryValues: any[] = []

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

    // Calculate pagination
    const totalPages = Math.ceil(total / pagination.limit)
    const offset = (pagination.page - 1) * pagination.limit

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
      LIMIT ? OFFSET ?
    `

    const [materialsResult] = await connection.execute(
      materialsQuery,
      [...queryValues, pagination.limit, offset]
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
    await connection.end()
  }
}

async function logMaterialAccess(
  userId: string,
  accessType: string,
  filter: MaterialsFilter
) {
  const connection = await mysql.createConnection(dbConfig)

  try {
    await connection.execute(`
      INSERT INTO user_material_access (user_id, access_type, filter_data, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      accessType,
      JSON.stringify(filter),
      'unknown', // In real implementation, get from request headers
      'unknown'  // In real implementation, get from request headers
    ])
  } catch (error) {
    console.warn('Failed to log material access:', error)
  } finally {
    await connection.end()
  }
}

function validateMaterialData(data: any) {
  // Validate material creation/update data
  // This would use Zod or similar validation
  return data
}

async function createOrUpdateMaterial(data: any) {
  // Create or update material in database
  // This would interact with your database
  return data
}
