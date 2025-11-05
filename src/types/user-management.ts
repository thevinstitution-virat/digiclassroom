// User Management Types for Virat Gyankosh Platform

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'guardian'
export type UserStatus = 'active' | 'suspended' | 'pending' | 'inactive'
export type EducationBoard = 'CBSE' | 'ICSE' | 'STATE_BOARD'
export type Medium = 'ENGLISH' | 'HINDI'
export type Stream = 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE'
export type MaterialType = 'notes' | 'summaries' | 'mind_maps' | 'quizzes' | 'textbooks' | 'reference'

export interface UserProfile {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string
  email: string
  profileImageUrl: string | null
  role: UserRole
  status: UserStatus
  createdAt: Date
  lastSignInAt: Date | null
  emailVerified: boolean
  phoneNumber: string | null
  metadata: {
    role?: UserRole
    department?: string
    grade?: string
    subjects?: string[]
    permissions?: string[]
  }
}

// Enhanced User Profile for Materials Dashboard
export interface EnhancedUserProfile {
  userId: string
  clerkId: string
  role: UserRole
  board: EducationBoard
  medium: Medium
  class: number // 1-12
  stream?: Stream // Only for classes 11-12
  subjects?: string[]
  isOnboardingComplete: boolean
  preferences: {
    language: string
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
    difficulty: 'easy' | 'medium' | 'hard' | 'adaptive'
  }
  subscription: {
    plan: 'starter' | 'pro' | 'enterprise'
    features: string[]
    expiresAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}

// Onboarding Form Data
export interface OnboardingFormData {
  role: UserRole
  board: EducationBoard
  medium: Medium
  class: number
  stream?: Stream
  subjects?: string[]
}

// Material Item
export interface MaterialItem {
  id: string
  title: string
  description?: string
  type: MaterialType
  board: EducationBoard
  medium: Medium
  class: number
  stream?: Stream
  subject: string
  smType?: string // Study Material Type
  fileId: string // Google Drive file ID
  fileName: string
  fileSize: number
  thumbnailUrl?: string
  downloadUrl?: string
  viewerUrl?: string
  downloadCount: number
  tags: string[]
  metadata: {
    author?: string
    publisher?: string
    isbn?: string
    edition?: string
    language: string
    pageCount?: number
    difficulty: 'easy' | 'medium' | 'hard'
  }
  createdAt: Date
  updatedAt: Date
}

// Materials Filter
export interface MaterialsFilter {
  board?: EducationBoard
  medium?: Medium
  class?: number
  stream?: Stream
  subject?: string
  type?: MaterialType
  searchQuery?: string
  tags?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
}

// Materials Dashboard State
export interface MaterialsDashboardState {
  materials: MaterialItem[]
  filteredMaterials: MaterialItem[]
  loading: boolean
  error?: string
  currentFilter: MaterialsFilter
  selectedMaterial?: MaterialItem
  viewMode: 'grid' | 'list'
  sortBy: 'title' | 'date' | 'downloads' | 'relevance'
  sortOrder: 'asc' | 'desc'
}

export interface UserListFilters {
  search: string
  role: UserRole | 'all'
  status: UserStatus | 'all'
  dateRange: {
    from: Date | null
    to: Date | null
  }
  sortBy: 'name' | 'email' | 'createdAt' | 'lastSignInAt' | 'role'
  sortOrder: 'asc' | 'desc'
}

export interface UserListResponse {
  users: UserProfile[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BulkUserAction {
  userIds: string[]
  action: 'changeRole' | 'changeStatus' | 'delete' | 'sendEmail'
  payload?: {
    role?: UserRole
    status?: UserStatus
    emailTemplate?: string
    message?: string
  }
}

export interface UserUpdateData {
  firstName?: string
  lastName?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  metadata?: Record<string, any>
}

export interface UserInvitation {
  email: string
  role: UserRole
  firstName?: string
  lastName?: string
  message?: string
}

export interface UserActivityLog {
  id: string
  userId: string
  action: string
  details: string
  timestamp: Date
  performedBy: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

// Component Props Types
export interface UserTableProps {
  users: UserProfile[]
  loading: boolean
  onUserSelect: (userId: string) => void
  onUserEdit: (user: UserProfile) => void
  onUserDelete: (userId: string) => void
  onRoleChange: (userId: string, role: UserRole) => void
  onStatusChange: (userId: string, status: UserStatus) => void
  selectedUsers: string[]
  onSelectionChange: (userIds: string[]) => void
}

export interface UserModalProps {
  user: UserProfile | null
  isOpen: boolean
  onClose: () => void
  onSave: (userData: UserUpdateData) => void
  loading: boolean
}

export interface UserFiltersProps {
  filters: UserListFilters
  onFiltersChange: (filters: Partial<UserListFilters>) => void
  onReset: () => void
}

export interface BulkActionsProps {
  selectedUsers: string[]
  onBulkAction: (action: BulkUserAction) => void
  loading: boolean
}

// Constants
export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrator', description: 'Full system access and management' },
  { value: 'teacher', label: 'Teacher', description: 'Content creation and student management' },
  { value: 'student', label: 'Student', description: 'Learning access and progress tracking' }
]

export const USER_STATUSES: { value: UserStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'suspended', label: 'Suspended', color: 'red' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'inactive', label: 'Inactive', color: 'gray' }
]

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'createdAt', label: 'Registration Date' },
  { value: 'lastSignInAt', label: 'Last Login' },
  { value: 'role', label: 'Role' }
]

// Utility Functions
export function getUserDisplayName(user: UserProfile): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }
  if (user.firstName) return user.firstName
  if (user.lastName) return user.lastName
  return user.email.split('@')[0]
}

export function getUserRoleColor(role: UserRole): string {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-800'
    case 'teacher': return 'bg-blue-100 text-blue-800'
    case 'student': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function getUserStatusColor(status: UserStatus): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'suspended': return 'bg-red-100 text-red-800'
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'inactive': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function formatDate(date: Date | null): string {
  if (!date) return 'Never'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
