import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import mysql from 'mysql2/promise'
import { GoogleDriveService } from '@/lib/services/google-drive'
import { v4 as uuidv4 } from 'uuid'
import type { MaterialUploadData, EnhancedMaterial } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

/**
 * POST /api/admin/materials/upload
 * Upload material to Google Drive and save metadata to database
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const metadataStr = formData.get('metadata') as string

    if (!file || !metadataStr) {
      return NextResponse.json(
        { success: false, error: 'File and metadata are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    let metadata: MaterialUploadData
    try {
      metadata = JSON.parse(metadataStr)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid metadata format' },
        { status: 400 }
      )
    }

    // Validate required metadata fields
    const requiredFields = ['title', 'subject', 'type', 'board', 'medium', 'class']
    for (const field of requiredFields) {
      if (!metadata[field as keyof MaterialUploadData]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Initialize Google Drive service
      const driveService = new GoogleDriveService()
      
      // Check if Google Drive is connected
      if (!driveService.isAuthenticated()) {
        return NextResponse.json(
          { success: false, error: 'Google Drive not connected. Please configure Google Drive integration first.' },
          { status: 400 }
        )
      }

      // Convert file to buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer())

      // Determine target folder based on metadata
      const folderPath = `${metadata.board}/Class_${metadata.class}/${metadata.subject}/${metadata.type}`
      
      // Get or create folder structure
      let folderId: string | undefined
      try {
        const [folderResult] = await connection.execute(
          'SELECT folder_id FROM google_drive_folders WHERE folder_path = ? AND is_active = TRUE',
          [folderPath]
        ) as any[]
        
        if (folderResult.length > 0) {
          folderId = folderResult[0].folder_id
        } else {
          // Create folder structure if it doesn't exist
          folderId = await createFolderStructure(driveService, connection, metadata)
        }
      } catch (error) {
        console.warn('Could not determine folder structure, uploading to root:', error)
      }

      // Upload file to Google Drive
      const uploadedFile = await driveService.uploadFile(
        fileBuffer,
        file.name,
        file.type,
        folderId,
        metadata.description
      )

      // Generate URLs
      const downloadUrl = driveService.getDirectDownloadLink(uploadedFile.id)
      const viewUrl = driveService.getEmbedViewerLink(uploadedFile.id)
      const publicLink = await driveService.createPublicLink(uploadedFile.id)

      // Save material metadata to database
      const materialId = uuidv4()
      const materialData = {
        id: materialId,
        title: metadata.title,
        description: metadata.description || null,
        type: metadata.type,
        board: metadata.board,
        medium: metadata.medium,
        class: metadata.class,
        stream: metadata.stream || null,
        subject: metadata.subject,
        sm_type: metadata.smType || 'Chapter Notes',
        google_drive_file_id: uploadedFile.id,
        google_drive_folder_id: folderId || null,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        download_url: downloadUrl,
        view_url: viewUrl,
        thumbnail_url: uploadedFile.thumbnailLink || null,
        tags: JSON.stringify(metadata.tags || []),
        difficulty: metadata.difficulty || 'medium',
        metadata: JSON.stringify({
          originalFileName: file.name,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          googleDriveFileId: uploadedFile.id,
          publicLink,
          smType: metadata.smType
        }),
        status: 'pending_review', // Default status for admin uploads
        created_by: userId
      }

      await connection.execute(`
        INSERT INTO materials (
          id, title, description, type, board, medium, class, stream, subject, sm_type,
          google_drive_file_id, google_drive_folder_id, file_name, file_size, mime_type,
          download_url, view_url, thumbnail_url, tags, difficulty, metadata, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        materialData.id, materialData.title, materialData.description, materialData.type,
        materialData.board, materialData.medium, materialData.class, materialData.stream,
        materialData.subject, materialData.sm_type, materialData.google_drive_file_id, materialData.google_drive_folder_id,
        materialData.file_name, materialData.file_size, materialData.mime_type,
        materialData.download_url, materialData.view_url, materialData.thumbnail_url,
        materialData.tags, materialData.difficulty, materialData.metadata,
        materialData.status, materialData.created_by
      ])

      // Log the upload activity
      await connection.execute(`
        INSERT INTO user_material_access (user_id, material_id, access_type, ip_address, user_agent)
        VALUES (?, ?, 'upload', ?, ?)
      `, [
        userId,
        materialId,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      ])

      return NextResponse.json({
        success: true,
        data: {
          materialId,
          googleDriveFileId: uploadedFile.id,
          downloadUrl,
          viewUrl,
          message: 'Material uploaded successfully and is pending review'
        }
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error uploading material:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload material' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to create folder structure in Google Drive
 */
async function createFolderStructure(
  driveService: GoogleDriveService,
  connection: mysql.Connection,
  metadata: MaterialUploadData
): Promise<string> {
  const folders = [
    { name: metadata.board, parent: null },
    { name: `Class_${metadata.class}`, parent: metadata.board },
    { name: metadata.subject, parent: `Class_${metadata.class}` },
    { name: metadata.type, parent: metadata.subject }
  ]

  let currentParentId: string | undefined
  let currentPath = ''

  for (const folder of folders) {
    currentPath = currentPath ? `${currentPath}/${folder.name}` : folder.name

    // Check if folder already exists in database
    const [existingFolder] = await connection.execute(
      'SELECT folder_id FROM google_drive_folders WHERE folder_path = ? AND is_active = TRUE',
      [currentPath]
    ) as any[]

    if (existingFolder.length > 0) {
      currentParentId = existingFolder[0].folder_id
      continue
    }

    // Create folder in Google Drive
    const createdFolder = await driveService.createFolderStructure({
      name: folder.name,
      parentId: currentParentId
    })

    // Save folder to database
    await connection.execute(`
      INSERT INTO google_drive_folders (
        id, folder_id, folder_name, parent_folder_id, folder_path,
        board, class, subject, material_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      createdFolder.id,
      folder.name,
      currentParentId || null,
      currentPath,
      folder.name === metadata.board ? metadata.board : null,
      folder.name === `Class_${metadata.class}` ? metadata.class : null,
      folder.name === metadata.subject ? metadata.subject : null,
      folder.name === metadata.type ? metadata.type : null
    ])

    currentParentId = createdFolder.id
  }

  return currentParentId!
}
