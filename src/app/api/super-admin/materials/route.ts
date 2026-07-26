import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { z } from 'zod'
import type { EnhancedMaterial, MaterialSearchFilters, MaterialsListResponse } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

// Validation schema for admin materials request
const AdminMaterialsRequestSchema = z.object({
  board: z.enum(['CBSE', 'ICSE', 'STATE_BOARD']).optional(),
  medium: z.enum(['ENGLISH', 'HINDI']).optional(),
  class: z.number().min(1).max(12).optional(),
  stream: z.enum(['HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE']).optional(),
  subject: z.string().optional(),
  type: z.enum(['notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference']).optional(),
  status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'archived']).optional(),
  searchQuery: z.string().optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['title', 'date', 'downloads', 'views', 'relevance']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  createdBy: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
})

/**
 * GET /api/super-admin/materials
 * Get materials list with admin-specific filters and information
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

    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert string numbers to actual numbers
    if (queryParams.class) queryParams.class = parseInt(queryParams.class)
    if (queryParams.page) queryParams.page = parseInt(queryParams.page)
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit)

    const validatedParams = AdminMaterialsRequestSchema.parse(queryParams)

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Build WHERE clause based on filters
      const whereConditions: string[] = []
      const queryValues: any[] = []

      // Always include active materials for admin view
      whereConditions.push('m.is_active = TRUE')

      if (validatedParams.board) {
        whereConditions.push('m.board = ?')
        queryValues.push(validatedParams.board)
      }

      if (validatedParams.medium) {
        whereConditions.push('m.medium = ?')
        queryValues.push(validatedParams.medium)
      }

      if (validatedParams.class) {
        whereConditions.push('m.class = ?')
        queryValues.push(validatedParams.class)
      }

      if (validatedParams.stream) {
        whereConditions.push('m.stream = ?')
        queryValues.push(validatedParams.stream)
      }

      if (validatedParams.subject) {
        whereConditions.push('m.subject = ?')
        queryValues.push(validatedParams.subject)
      }

      if (validatedParams.type) {
        whereConditions.push('m.type = ?')
        queryValues.push(validatedParams.type)
      }

      if (validatedParams.status) {
        whereConditions.push('m.status = ?')
        queryValues.push(validatedParams.status)
      }

      if (validatedParams.difficulty) {
        whereConditions.push('m.difficulty = ?')
        queryValues.push(validatedParams.difficulty)
      }

      if (validatedParams.createdBy) {
        whereConditions.push('m.created_by = ?')
        queryValues.push(validatedParams.createdBy)
      }

      if (validatedParams.dateFrom) {
        whereConditions.push('m.created_at >= ?')
        queryValues.push(validatedParams.dateFrom)
      }

      if (validatedParams.dateTo) {
        whereConditions.push('m.created_at <= ?')
        queryValues.push(validatedParams.dateTo)
      }

      if (validatedParams.searchQuery) {
        whereConditions.push('(m.title LIKE ? OR m.description LIKE ? OR m.subject LIKE ?)')
        const searchTerm = `%${validatedParams.searchQuery}%`
        queryValues.push(searchTerm, searchTerm, searchTerm)
      }

      if (validatedParams.tags && validatedParams.tags.length > 0) {
        const tagConditions = validatedParams.tags.map(() => 'JSON_CONTAINS(m.tags, ?)').join(' OR ')
        whereConditions.push(`(${tagConditions})`)
        validatedParams.tags.forEach(tag => {
          queryValues.push(JSON.stringify(tag))
        })
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // Build ORDER BY clause
      let orderByClause = ''
      switch (validatedParams.sortBy) {
        case 'title':
          orderByClause = `ORDER BY m.title ${validatedParams.sortOrder.toUpperCase()}`
          break
        case 'date':
          orderByClause = `ORDER BY m.created_at ${validatedParams.sortOrder.toUpperCase()}`
          break
        case 'downloads':
          orderByClause = `ORDER BY m.download_count ${validatedParams.sortOrder.toUpperCase()}`
          break
        case 'views':
          orderByClause = `ORDER BY m.view_count ${validatedParams.sortOrder.toUpperCase()}`
          break
        default:
          orderByClause = `ORDER BY m.created_at ${validatedParams.sortOrder.toUpperCase()}`
      }

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM materials m 
        ${whereClause}
      `
      const [countResult] = await connection.execute(countQuery, queryValues) as any[]
      const total = countResult[0]?.total || 0

      // Calculate pagination
      const totalPages = Math.ceil(total / validatedParams.limit)
      const offset = (validatedParams.page - 1) * validatedParams.limit

      // Get materials with pagination
      const materialsQuery = `
        SELECT
          m.*
        FROM materials m
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `

      const [materialsResult] = await connection.execute(
        materialsQuery, 
        [...queryValues, validatedParams.limit, offset]
      ) as any[]

      // Transform database results to EnhancedMaterial format
      const materials: EnhancedMaterial[] = materialsResult.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        board: row.board,
        medium: row.medium,
        class: row.class,
        stream: row.stream,
        subject: row.subject,
        googleDriveFileId: row.google_drive_file_id,
        googleDriveFolderId: row.google_drive_folder_id,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        downloadUrl: row.download_url,
        viewUrl: row.view_url,
        thumbnailUrl: row.thumbnail_url,
        downloadCount: row.download_count || 0,
        viewCount: row.view_count || 0,
        tags: row.tags ? JSON.parse(row.tags) : [],
        difficulty: row.difficulty,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        status: row.status,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at
      }))

      const response: MaterialsListResponse = {
        materials,
        pagination: {
          page: validatedParams.page,
          limit: validatedParams.limit,
          total,
          totalPages
        },
        filters: {
          board: validatedParams.board,
          medium: validatedParams.medium,
          class: validatedParams.class,
          stream: validatedParams.stream,
          subject: validatedParams.subject,
          type: validatedParams.type,
          status: validatedParams.status,
          difficulty: validatedParams.difficulty,
          searchQuery: validatedParams.searchQuery,
          tags: validatedParams.tags
        }
      }

      return NextResponse.json({
        success: true,
        data: response.materials,
        pagination: response.pagination,
        filters: response.filters
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching admin materials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/super-admin/materials
 * Bulk update materials (status, tags, etc.)
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { materialIds, updates } = body

    if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Material IDs are required' },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Updates object is required' },
        { status: 400 }
      )
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Build update query
      const updateFields: string[] = []
      const updateValues: any[] = []

      if (updates.status) {
        updateFields.push('status = ?')
        updateValues.push(updates.status)
      }

      if (updates.tags) {
        updateFields.push('tags = ?')
        updateValues.push(JSON.stringify(updates.tags))
      }

      if (updates.difficulty) {
        updateFields.push('difficulty = ?')
        updateValues.push(updates.difficulty)
      }

      if (updates.isActive !== undefined) {
        updateFields.push('is_active = ?')
        updateValues.push(updates.isActive)
      }

      if (updateFields.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid update fields provided' },
          { status: 400 }
        )
      }

      updateFields.push('updated_at = NOW()')

      // Add approval fields if status is being approved
      if (updates.status === 'approved') {
        updateFields.push('approved_by = ?', 'approved_at = NOW()')
        updateValues.push(userId)
      }

      // Create placeholders for material IDs
      const placeholders = materialIds.map(() => '?').join(',')
      updateValues.push(...materialIds)

      const updateQuery = `
        UPDATE materials 
        SET ${updateFields.join(', ')}
        WHERE id IN (${placeholders})
      `

      const [result] = await connection.execute(updateQuery, updateValues) as any[]

      return NextResponse.json({
        success: true,
        message: `Updated ${result.affectedRows} materials`,
        affectedRows: result.affectedRows
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error updating materials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update materials' },
      { status: 500 }
    )
  }
}
