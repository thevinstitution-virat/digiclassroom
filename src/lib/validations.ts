import { z } from "zod"

// Simplified user role validation
export const UserRole = z.enum(["admin", "user"])
export type UserRole = z.infer<typeof UserRole>

// Database user role (includes teacher, student, parent)
export const DatabaseUserRole = z.enum(["admin", "teacher", "student", "parent"])
export type DatabaseUserRole = z.infer<typeof DatabaseUserRole>

// Teacher approval status
export const ApprovalStatus = z.enum(["pending", "approved", "rejected"])
export type ApprovalStatus = z.infer<typeof ApprovalStatus>

// AI persona validation for response customization
export const UserPersona = z.enum(["teacher", "student", "guardian"])
export type UserPersona = z.infer<typeof UserPersona>

// Validate persona and provide fallback
export function validatePersona(persona: string | undefined): UserPersona {
  if (persona && ['teacher', 'student', 'guardian'].includes(persona)) {
    return persona as UserPersona
  }
  return 'student' // Default fallback
}

// Tenant validation
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Tenant name is required"),
  domain: z.string().optional(),
  subscriptionPlan: z.enum(["starter", "pro", "enterprise"]),
  subscriptionStatus: z.enum(["active", "inactive", "trial"]),
})

// User validation with persona
export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email("Invalid email address"),
  role: UserRole,
  persona: UserPersona,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  classId: z.string().uuid().optional(),
})

// Class validation
export const ClassSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1, "Class name is required"),
  gradeLevel: z.number().min(1).max(12),
  pineconeIndexName: z.string().min(1),
  subjects: z.array(z.string()).optional(),
})

// Vector embedding validation
export const VectorEmbeddingSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  classId: z.string().uuid(),
  contentId: z.string().uuid(),
  pineconeId: z.string(),
  subject: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// Content validation
export const ContentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  subject: z.string().min(1, "Subject is required"),
  type: z.enum(["lesson", "exercise", "assessment", "resource"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  tags: z.array(z.string()).optional(),
})

// Assessment validation
export const AssessmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string().min(1, "Assessment title is required"),
  description: z.string().optional(),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string().min(1),
    type: z.enum(["multiple_choice", "true_false", "short_answer", "essay"]),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
    points: z.number().min(0),
  })),
  totalPoints: z.number().min(0),
  timeLimit: z.number().optional(), // in minutes
})

// Learning progress validation
export const LearningProgressSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  classId: z.string().uuid(),
  contentId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  timeSpent: z.number().min(0), // in minutes
  lastAccessed: z.date(),
  completed: z.boolean(),
})

export type Tenant = z.infer<typeof TenantSchema>
export type User = z.infer<typeof UserSchema>
export type Class = z.infer<typeof ClassSchema>
export type VectorEmbedding = z.infer<typeof VectorEmbeddingSchema>
export type Content = z.infer<typeof ContentSchema>
export type Assessment = z.infer<typeof AssessmentSchema>
export type LearningProgress = z.infer<typeof LearningProgressSchema>

// ============================================================================
// TEACHER VALIDATION SYSTEM SCHEMAS
// ============================================================================

// Teacher registration schema
export const TeacherRegistrationSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  specialization: z.array(z.string()).min(1, "At least one specialization is required"),
  qualification: z.string().min(1, "Qualification is required"),
  experienceYears: z.number().min(0).max(50),
  phone: z.string().optional(),
})

// Teacher approval schema
export const TeacherApprovalSchema = z.object({
  teacherId: z.string().uuid(),
  approvalStatus: ApprovalStatus,
  rejectionReason: z.string().optional(),
})

// Class creation schema
export const TeacherClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  subject: z.string().min(1, "Subject is required"),
  gradeLevel: z.number().min(1).max(12),
  section: z.string().optional(),
  description: z.string().optional(),
})

// Student assignment schema
export const StudentAssignmentSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
})

// Content validation schema
export const ContentValidationSchema = z.object({
  contentId: z.string().uuid(),
  validationStatus: z.enum(["approved", "rejected", "needs_improvement"]),
  validationScore: z.number().min(0).max(100).optional(),
  feedback: z.string().optional(),
  improvementNotes: z.string().optional(),
})

// Activity log schema
export const ActivityLogSchema = z.object({
  teacherId: z.string().uuid(),
  activityType: z.enum([
    "class_created",
    "class_updated",
    "class_deleted",
    "student_assigned",
    "student_removed",
    "content_validated",
    "content_approved",
    "content_rejected",
    "login",
    "profile_updated"
  ]),
  activityDescription: z.string(),
  metadata: z.record(z.any()).optional(),
})

export type TeacherRegistration = z.infer<typeof TeacherRegistrationSchema>
export type TeacherApproval = z.infer<typeof TeacherApprovalSchema>
export type TeacherClass = z.infer<typeof TeacherClassSchema>
export type StudentAssignment = z.infer<typeof StudentAssignmentSchema>
export type ContentValidation = z.infer<typeof ContentValidationSchema>
export type ActivityLog = z.infer<typeof ActivityLogSchema>
