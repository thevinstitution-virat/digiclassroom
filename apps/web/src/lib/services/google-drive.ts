/**
 * Google Drive Integration Service for VG Kosh Materials Dashboard
 * Enhanced with OAuth2, batch operations, and comprehensive file management
 */

import { google } from 'googleapis'
import { MaterialItem, EducationBoard, Medium, Stream } from '@/types/user-management'
import type {
  GoogleDriveConfig,
  GoogleDriveCredentials,
  GoogleDriveFile,
  GoogleDriveFolder,
  DriveFileListResponse,
  FolderCreationRequest,
  GoogleDriveQuota,
  MaterialUploadData,
  UploadSession
} from '@/types/google-drive'

// Legacy interface for backward compatibility
interface DriveListResponse {
  files: GoogleDriveFile[]
  nextPageToken?: string
}

// Configuration for Google Drive folders
interface FolderStructure {
  board: EducationBoard
  class: number
  subject: string
  stream?: Stream
  folderId: string
  folderName: string
}

export class GoogleDriveService {
  private drive: any
  private auth: any
  private config: GoogleDriveConfig
  private apiKey: string
  private clientId: string
  private isInitialized: boolean = false

  constructor(credentials?: GoogleDriveCredentials) {
    // Legacy API key support
    this.apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
    this.clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

    // Enhanced OAuth2 configuration
    this.config = {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    }

    this.initializeAuth(credentials)
  }

  private initializeAuth(credentials?: GoogleDriveCredentials) {
    this.auth = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    )

    if (credentials) {
      this.auth.setCredentials(credentials)
    }

    this.drive = google.drive({ version: 'v3', auth: this.auth })
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(): string {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<GoogleDriveCredentials> {
    const { tokens } = await this.auth.getToken(code)
    this.auth.setCredentials(tokens)
    return tokens as GoogleDriveCredentials
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<GoogleDriveCredentials> {
    const { credentials } = await this.auth.refreshAccessToken()
    this.auth.setCredentials(credentials)
    return credentials as GoogleDriveCredentials
  }

  /**
   * Check if service is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.auth && this.auth.credentials && this.auth.credentials.access_token)
  }

  /**
   * Test connection to Google Drive
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: 'user' })
      return true
    } catch (error) {
      console.error('Google Drive connection test failed:', error)
      return false
    }
  }

  /**
   * Initialize Google Drive API (Legacy method for backward compatibility)
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized)
  return true

    try {
      // Load Google API client
      await this.loadGoogleAPI()
      
      // Initialize the client
      await window.gapi.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        scope: 'https://www.googleapis.com/auth/drive.readonly'
      })

      this.isInitialized = true
      console.log('✅ Google Drive API initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error)
      return false
    }
  }

  /**
   * Load Google API client library
   */
  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.gapi) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => {
        window.gapi.load('client', resolve)
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  /**
   * Get files from a specific Google Drive folder
   */
  async getFilesFromFolder(
    folderId: string, 
    options: {
      pageSize?: number
      pageToken?: string
      mimeType?: string
      orderBy?: string
    } = {}
  ): Promise<DriveListResponse> {
    if (!this.isInitialized) {
      throw new Error('Google Drive API not initialized')
    }

    try {
      const {
        pageSize = 50,
        pageToken,
        mimeType = 'application/pdf',
        orderBy = 'name'
      } = options

      const query = `'${folderId}' in parents and mimeType='${mimeType}' and trashed=false`

      const response = await window.gapi.client.drive.files.list({
        q: query,
        pageSize,
        pageToken,
        orderBy,
        fields: 'nextPageToken, files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,parents,createdTime,modifiedTime,description)'
      })

      return response.result as DriveListResponse
    } catch (error) {
      console.error('Error fetching files from folder:', error)
      throw new Error('Failed to fetch files from Google Drive')
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFileMetadata(fileId: string): Promise<GoogleDriveFile | null> {
    if (!this.isInitialized) {
      throw new Error('Google Drive API not initialized')
    }

    try {
      const response = await window.gapi.client.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,parents,createdTime,modifiedTime,description'
      })

      return response.result as GoogleDriveFile
    } catch (error) {
      console.error('Error fetching file metadata:', error)
      return null
    }
  }

  /**
   * Get download link for a file
   */
  async getDownloadLink(fileId: string): Promise<string | null> {
    try {
      const metadata = await this.getFileMetadata(fileId)
      return metadata?.webContentLink || metadata?.webViewLink || null
    } catch (error) {
      console.error('Error getting download link:', error)
      return null
    }
  }

  /**
   * Get viewer link for embedded PDF viewing
   */
  getViewerLink(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  /**
   * Search files across multiple folders
   */
  async searchFiles(
    query: string,
    folderIds: string[] = [],
    options: {
      mimeType?: string
      maxResults?: number
    } = {}
  ): Promise<GoogleDriveFile[]> {
    if (!this.isInitialized) {
      throw new Error('Google Drive API not initialized')
    }

    try {
      const {
        mimeType = 'application/pdf',
        maxResults = 20
      } = options

      let searchQuery = `name contains '${query}' and mimeType='${mimeType}' and trashed=false`
      
      if (folderIds.length > 0) {
        const folderConditions = folderIds.map(id => `'${id}' in parents`).join(' or ')
        searchQuery += ` and (${folderConditions})`
      }

      const response = await window.gapi.client.drive.files.list({
        q: searchQuery,
        pageSize: maxResults,
        orderBy: 'relevance',
        fields: 'files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,parents,createdTime,modifiedTime,description)'
      })

      return response.result.files || []
    } catch (error) {
      console.error('Error searching files:', error)
      throw new Error('Failed to search files in Google Drive')
    }
  }

  /**
   * Convert Google Drive file to MaterialItem
   */
  convertToMaterialItem(
    file: GoogleDriveFile,
    metadata: {
      board: EducationBoard
      medium: Medium
      class: number
      subject: string
      stream?: Stream
      type?: string
    }
  ): MaterialItem {
    // Extract material type from filename or description
    const type = this.extractMaterialType(file.name, file.description)
    
    // Extract tags from filename
    const tags = this.extractTags(file.name)

    return {
      id: file.id,
      title: this.cleanFileName(file.name),
      description: file.description || `${metadata.subject} study material for Class ${metadata.class}`,
      type: type as any,
      board: metadata.board,
      medium: metadata.medium,
      class: metadata.class,
      stream: metadata.stream,
      subject: metadata.subject,
      fileId: file.id,
      fileName: file.name,
      fileSize: parseInt(file.size || '0'),
      thumbnailUrl: file.thumbnailLink,
      downloadUrl: file.webContentLink,
      viewerUrl: this.getViewerLink(file.id),
      downloadCount: 0,
      tags,
      metadata: {
        language: metadata.medium.toLowerCase(),
        difficulty: this.extractDifficulty(file.name, file.description),
        pageCount: undefined
      },
      createdAt: new Date(file.createdTime || Date.now()),
      updatedAt: new Date(file.modifiedTime || Date.now())
    }
  }

  /**
   * Extract material type from filename or description
   */
  private extractMaterialType(fileName: string, description?: string): string {
    const text = `${fileName} ${description || ''}`.toLowerCase()
    
    if (text.includes('note') || text.includes('chapter'))
  return 'notes'
    if (text.includes('summary') || text.includes('revision'))
  return 'summaries'
    if (text.includes('mind map') || text.includes('mindmap'))
  return 'mind_maps'
    if (text.includes('quiz') || text.includes('test') || text.includes('mcq'))
  return 'quizzes'
    if (text.includes('textbook') || text.includes('book'))
  return 'textbooks'
    
    return 'reference'
  }

  /**
   * Extract tags from filename
   */
  private extractTags(fileName: string): string[] {
    const tags: string[] = []
    const text = fileName.toLowerCase()
    
    // Common educational tags
    if (text.includes('ncert')) tags.push('NCERT')
    if (text.includes('cbse')) tags.push('CBSE')
    if (text.includes('icse')) tags.push('ICSE')
    if (text.includes('sample')) tags.push('Sample Paper')
    if (text.includes('previous')) tags.push('Previous Year')
    if (text.includes('important')) tags.push('Important')
    if (text.includes('formula')) tags.push('Formulas')
    if (text.includes('solution')) tags.push('Solutions')
    
    return tags
  }

  /**
   * Extract difficulty level from filename or description
   */
  private extractDifficulty(fileName: string, description?: string): 'easy' | 'medium' | 'hard' {
    const text = `${fileName} ${description || ''}`.toLowerCase()
    
    if (text.includes('easy') || text.includes('basic') || text.includes('beginner'))
  return 'easy'
    if (text.includes('hard') || text.includes('advanced') || text.includes('difficult'))
  return 'hard'
    
    return 'medium'
  }

  /**
   * Clean filename for display
   */
  private cleanFileName(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .trim()
  }

  /**
   * Upload file to Google Drive using OAuth2
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    parentFolderId?: string,
    description?: string
  ): Promise<GoogleDriveFile> {
    const fileMetadata = {
      name: fileName,
      parents: parentFolderId ? [parentFolderId] : undefined,
      description
    }

    const media = {
      mimeType,
      body: fileBuffer
    }

    const response = await this.drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, thumbnailLink, description'
    })

    return response.data as GoogleDriveFile
  }

  /**
   * Create folder structure for materials organization
   */
  async createFolderStructure(request: FolderCreationRequest): Promise<GoogleDriveFolder> {
    const folderMetadata = {
      name: request.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: request.parentId ? [request.parentId] : undefined
    }

    const response = await this.drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, parents, createdTime, modifiedTime, webViewLink'
    })

    return response.data as GoogleDriveFolder
  }

  /**
   * List folders using OAuth2
   */
  async listFolders(parentId?: string): Promise<GoogleDriveFolder[]> {
    let q = "mimeType = 'application/vnd.google-apps.folder'"

    if (parentId) {
      q += ` and '${parentId}' in parents`
    }

    const response = await this.drive.files.list({
      q,
      fields: 'files(id, name, parents, createdTime, modifiedTime, webViewLink)'
    })

    return response.data.files as GoogleDriveFolder[]
  }

  /**
   * Move file to different folder
   */
  async moveFile(fileId: string, newParentId: string): Promise<GoogleDriveFile> {
    // Get current parents
    const file = await this.drive.files.get({
      fileId,
      fields: 'parents'
    })

    const previousParents = file.data.parents.join(',')

    // Move file
    const response = await this.drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, thumbnailLink, description'
    })

    return response.data as GoogleDriveFile
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId })
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<GoogleDriveQuota> {
    const response = await this.drive.about.get({
      fields: 'storageQuota'
    })

    return response.data.storageQuota as GoogleDriveQuota
  }

  /**
   * Create public sharing link
   */
  async createPublicLink(fileId: string): Promise<string> {
    await this.drive.permissions.create({
      fileId,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    })

    const file = await this.getFileMetadata(fileId)
    return file?.webViewLink || ''
  }

  /**
   * Generate direct download link
   */
  getDirectDownloadLink(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }

  /**
   * Generate embed viewer link
   */
  getEmbedViewerLink(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  /**
   * Get folder structure for materials organization (Legacy static method)
   */
  static getFolderStructure(): FolderStructure[] {
    // This would typically come from a database or configuration
    // For demo purposes, returning sample structure
    return [
      {
        board: 'CBSE',
        class: 10,
        subject: 'Mathematics',
        folderId: '1ABC123_SAMPLE_FOLDER_ID',
        folderName: 'CBSE Class 10 Mathematics'
      },
      {
        board: 'CBSE',
        class: 10,
        subject: 'Science',
        folderId: '1DEF456_SAMPLE_FOLDER_ID',
        folderName: 'CBSE Class 10 Science'
      },
      {
        board: 'CBSE',
        class: 11,
        subject: 'Physics',
        stream: 'MATHEMATICS',
        folderId: '1GHI789_SAMPLE_FOLDER_ID',
        folderName: 'CBSE Class 11 Physics (PCM)'
      }
      // Add more folder mappings as needed
    ]
  }
}

// Global instance
export const googleDriveService = new GoogleDriveService()

// Type declarations for Google API
declare global {
  interface Window {
    gapi: any
  }
}
