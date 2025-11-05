// Teacher Validation System Types

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type ActivityType = 
  | 'class_created'
  | 'class_updated'
  | 'class_deleted'
  | 'student_assigned'
  | 'student_removed'
  | 'content_validated'
  | 'content_approved'
  | 'content_rejected'
  | 'login'
  | 'profile_updated'

export type ValidationStatus = 'pending' | 'approved' | 'rejected' | 'needs_improvement'
export type ValidationPriority = 'low' | 'medium' | 'high'
export type ContentType = 'ai_answer' | 'quiz_question' | 'explanation' | 'summary'

export interface TeacherProfile {
  id: string
  userId: string
  clerkId: string
  email: string
  firstName: string
  lastName: string
  role: 'teacher'
  approvalStatus: ApprovalStatus
  approvedBy?: string
  approvedAt?: Date
  rejectionReason?: string
  specialization: string[]
  qualification: string
  experienceYears: number
  phone?: string
  createdAt: Date
  updatedAt: Date
}

export interface TeacherClass {
  id: string
  tenantId: string
  name: string
  subject: string
  gradeLevel: number
  section?: string
  description?: string
  teacherId: string
  qdrantNamespace: string
  studentCount: number
  createdAt: Date
  updatedAt: Date
}

export interface TeacherClassAssignment {
  id: string
  teacherId: string
  classId: string
  assignedBy: string
  assignedAt: Date
  isActive: boolean
  removedAt?: Date
  removedBy?: string
}

export interface TeacherActivityLog {
  id: string
  teacherId: string
  activityType: ActivityType
  activityDescription: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface ContentValidationItem {
  id: string
  contentId: string
  contentType: ContentType
  contentText: string
  subject: string
  gradeLevel: number
  board: string
  validationStatus: ValidationStatus
  priority: ValidationPriority
  assignedTo?: string
  assignedAt?: Date
  validatedBy?: string
  validatedAt?: Date
  validationScore?: number
  feedback?: string
  improvementNotes?: string
  sourceMetadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface TeacherStatistics {
  teacherId: string
  clerkId: string
  email: string
  teacherName: string
  approvalStatus: ApprovalStatus
  approvedAt?: Date
  totalClasses: number
  totalStudents: number
  totalActivities: number
  totalValidations: number
  approvedValidations: number
  lastActivityAt?: Date
}

export interface StudentInfo {
  id: string
  clerkId: string
  email: string
  firstName: string
  lastName: string
  classId?: string
  className?: string
  enrolledAt?: Date
}

// API Request/Response Types

export interface TeacherRegistrationRequest {
  email: string
  firstName: string
  lastName: string
  specialization: string[]
  qualification: string
  experienceYears: number
  phone?: string
}

export interface TeacherApprovalRequest {
  teacherId: string
  approvalStatus: 'approved' | 'rejected'
  rejectionReason?: string
}

export interface ClassCreationRequest {
  name: string
  subject: string
  gradeLevel: number
  section?: string
  description?: string
}

export interface ClassUpdateRequest {
  classId: string
  name?: string
  subject?: string
  gradeLevel?: number
  section?: string
  description?: string
}

export interface StudentAssignmentRequest {
  classId: string
  studentId: string
}

export interface ContentValidationRequest {
  contentId: string
  validationStatus: 'approved' | 'rejected' | 'needs_improvement'
  validationScore?: number
  feedback?: string
  improvementNotes?: string
}

export interface TeacherStatusResponse {
  isTeacher: boolean
  approvalStatus: ApprovalStatus
  approvedAt?: Date
  canAccessFeatures: boolean
  message: string
}

export interface PendingTeachersResponse {
  teachers: TeacherProfile[]
  total: number
}

export interface TeacherClassesResponse {
  classes: TeacherClass[]
  total: number
}

export interface TeacherStudentsResponse {
  students: StudentInfo[]
  total: number
}

export interface ValidationQueueResponse {
  items: ContentValidationItem[]
  total: number
  pending: number
  assigned: number
}

export interface TeacherActivityResponse {
  activities: TeacherActivityLog[]
  total: number
  statistics: {
    classesCreated: number
    studentsAssigned: number
    contentValidated: number
    lastLogin?: Date
  }
}

export interface TeacherDashboardStats {
  totalClasses: number
  totalStudents: number
  pendingValidations: number
  completedValidations: number
  approvalRate: number
  recentActivities: TeacherActivityLog[]
}

