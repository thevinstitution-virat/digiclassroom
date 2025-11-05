/**
 * Google Drive Integration Types for VG Kosh
 */

export interface GoogleDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface GoogleDriveCredentials {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
}

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  size: string
  createdTime: string
  modifiedTime: string
  parents: string[]
  webViewLink: string
  webContentLink: string
  thumbnailLink?: string
  description?: string
}

export interface GoogleDriveFolder {
  id: string
  name: string
  parents: string[]
  createdTime: string
  modifiedTime: string
  webViewLink: string
}

export interface MaterialUploadData {
  title: string
  description?: string
  type: 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'
  board: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  medium: 'ENGLISH' | 'HINDI'
  class: number
  stream?: 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE'
  subject: string
  smType?: 'Chapter Notes' | 'Important Terms & Formula Sheet' | 'Exam Ready Material' | 'PYQs (Previous Year Questions)' | 'NCERT Insights'
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  file: File
}

export interface MaterialMetadata {
  pageCount?: number
  language?: string
  author?: string
  publisher?: string
  isbn?: string
  edition?: string
  publicationYear?: number
  keywords?: string[]
  topics?: string[]
}

export interface UploadSession {
  id: string
  sessionName: string
  uploadedBy: string
  totalFiles: number
  processedFiles: number
  successfulUploads: number
  failedUploads: number
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled'
  uploadMetadata: Record<string, any>
  errorLog: string[]
  createdAt: string
  updatedAt: string
}

export interface UploadSessionFile {
  id: string
  sessionId: string
  materialId?: string
  originalFilename: string
  googleDriveFileId?: string
  fileSize?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  processingMetadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface FolderStructure {
  id: string
  folderId: string
  folderName: string
  parentFolderId?: string
  folderPath: string
  board?: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  class?: number
  subject?: string
  materialType?: 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BatchUploadRequest {
  sessionName: string
  files: MaterialUploadData[]
  autoApprove?: boolean
  notifyOnComplete?: boolean
}

export interface BatchUploadResponse {
  sessionId: string
  totalFiles: number
  estimatedTime: number
  message: string
}

export interface MaterialApprovalRequest {
  materialId: string
  action: 'approve' | 'reject'
  comments?: string
  adminId: string
}

export interface GoogleDriveApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface DriveFileListResponse {
  files: GoogleDriveFile[]
  nextPageToken?: string
  incompleteSearch: boolean
}

export interface FolderCreationRequest {
  name: string
  parentId?: string
  board?: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  class?: number
  subject?: string
  materialType?: 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'
}

export interface MaterialSearchFilters {
  board?: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  medium?: 'ENGLISH' | 'HINDI'
  class?: number
  stream?: 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE'
  subject?: string
  type?: 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'
  difficulty?: 'easy' | 'medium' | 'hard'
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  searchQuery?: string
  tags?: string[]
}

export interface MaterialSortOptions {
  sortBy: 'title' | 'date' | 'downloads' | 'views' | 'relevance'
  sortOrder: 'asc' | 'desc'
}

export interface PaginationOptions {
  page: number
  limit: number
}

export interface MaterialsListResponse {
  materials: EnhancedMaterial[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: MaterialSearchFilters
}

export interface EnhancedMaterial {
  id: string
  title: string
  description?: string
  type: 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'
  board: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  medium: 'ENGLISH' | 'HINDI'
  class: number
  stream?: 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE'
  subject: string
  
  // Google Drive Fields
  googleDriveFileId: string
  googleDriveFolderId?: string
  fileName: string
  fileSize: number
  mimeType: string
  
  // URLs
  downloadUrl?: string
  viewUrl?: string
  thumbnailUrl?: string
  
  // Analytics
  downloadCount: number
  viewCount: number
  
  // Metadata
  tags: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  metadata: MaterialMetadata
  
  // Status
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  isActive: boolean
  
  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy?: string
  approvedBy?: string
  approvedAt?: string
}

export interface AdminDashboardStats {
  totalMaterials: number
  pendingApprovals: number
  totalDownloads: number
  totalViews: number
  storageUsed: number
  recentUploads: number
  materialsByBoard: Record<string, number>
  materialsByType: Record<string, number>
  materialsByClass: Record<string, number>
}

export interface GoogleDriveQuota {
  limit: string
  usage: string
  usageInDrive: string
  usageInDriveTrash: string
}

export interface SystemHealthCheck {
  googleDriveConnected: boolean
  databaseConnected: boolean
  quotaStatus: 'healthy' | 'warning' | 'critical'
  lastSyncTime: string
  pendingUploads: number
  failedUploads: number
}
