import { relations, sql } from "drizzle-orm";
import {
    mysqlTable,
    index,
    uniqueIndex,
    serial,
    varchar,
    text,
    timestamp,
    boolean,
    json,
    int,
    bigint,
    decimal,
    mysqlEnum,
    date,
    foreignKey,
} from 'drizzle-orm/mysql-core';

// ============================================================================
// SHARED ENUMS
// ============================================================================

export const roleEnums = ['student', 'teacher', 'parent', 'admin', 'parent_guardian'] as const;
export const subscriptionPlanEnums = ['starter', 'pro', 'enterprise'] as const;
export const subscriptionStatusEnums = ['active', 'inactive', 'trial', 'pending', 'expired', 'cancelled'] as const;
export const approvalStatusEnums = ['approved', 'pending', 'rejected'] as const;
export const verificationStatusEnums = ['verified_email', 'unverified', 'manual'] as const;
export const boardEnums = ['CBSE', 'ICSE', 'STATE_BOARD', 'ALL', 'State'] as const;
export const mediumEnums = ['ENGLISH', 'HINDI'] as const;
export const streamEnums = ['HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE'] as const;
export const planTypeEnums = ['free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access'] as const;
export const classAccessTypeEnums = ['single', 'all'] as const;
export const billingCycleEnums = ['monthly', 'quarterly', 'yearly'] as const;
export const paymentStatusEnums = ['paid', 'pending', 'failed', 'refunded'] as const;
export const materialTypeEnums = ['notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference'] as const;
export const materialStatusEnums = ['draft', 'pending_review', 'approved', 'rejected', 'archived'] as const;

// ============================================================================
// LEGACY USERS & TENANTS (WILL INTERACT WITH BETTER AUTH)
// ============================================================================

// Phase 4.1 â€” legacy `tenants` and `users` tables removed. All fields
// migrated to Better Auth `organization` and `user` respectively. Legacy
// SQL endpoints in app/api/teacher/* and app/api/super-admin/teachers/* still
// query these tables with raw SQL and will throw at runtime until they are
// refactored (Phase 4.1b). See identity-federation-design.md Â§8.3.

// Map userProfiles directly to enhanced_user_profiles
export const enhancedUserProfiles = mysqlTable('enhanced_user_profiles', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).unique(), // Can reference BetterAuth ID
    role: mysqlEnum('role', roleEnums).default('student'),
    boardType: mysqlEnum('board_type', boardEnums).default('CBSE'),
    medium: mysqlEnum('medium', mediumEnums).default('ENGLISH'),
    gradeLevel: int('grade_level'),
    stream: mysqlEnum('stream', streamEnums),
    subjects: json('subjects'),
    preferences: json('preferences'),
    learningStyle: varchar('learning_style', { length: 50 }).default('mixed'),
    learningPace: varchar('learning_pace', { length: 50 }).default('average'),
    preferredExplanationComplexity: varchar('preferred_explanation_complexity', { length: 50 }).default('intermediate'),
    languagePreference: varchar('language_preference', { length: 50 }).default('english'),

    // Additional fields for enhanced context (teacher/parents)
    teachingExperienceYears: int('teaching_experience_years'),
    specializationSubjects: json('specialization_subjects'),
    classroomSizePreference: int('classroom_size_preference'),
    childGradeLevels: json('child_grade_levels'),
    involvementLevel: varchar('involvement_level', { length: 50 }),
    supportPreferences: json('support_preferences'),
    interactionHistory: json('interaction_history'),
    performanceMetrics: json('performance_metrics'),
    difficultyPreferences: json('difficulty_preferences'),
    isOnboardingComplete: boolean('is_onboarding_complete').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============================================================================
// SUBSCRIPTIONS & MONETIZATION
// ============================================================================

export const subscriptionPlans = mysqlTable('subscription_plans', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    planName: varchar('plan_name', { length: 100 }).unique().notNull(),
    planCode: varchar('plan_code', { length: 50 }).unique().notNull(),
    planType: mysqlEnum('plan_type', planTypeEnums).notNull(),
    board: mysqlEnum('board', boardEnums).notNull(),
    classLevel: int('class_level'),
    classAccessType: mysqlEnum('class_access_type', classAccessTypeEnums).default('single'),
    includedSubjects: json('included_subjects'),
    monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).default('0.00').notNull(),
    quarterlyPrice: decimal('quarterly_price', { precision: 10, scale: 2 }),
    yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }),
    dailyQuestionLimit: int('daily_question_limit').default(30),
    features: json('features'),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    description: text('description'),
    highlightText: varchar('highlight_text', { length: 255 }),
    displayOrder: int('display_order').default(0),
    isActive: boolean('is_active').default(true),
    isFeatured: boolean('is_featured').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const userSubscriptions = mysqlTable('user_subscriptions', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(), // Refs BetterAuth user or legacy users
    clerkId: varchar('clerk_id', { length: 255 }), // @deprecated Legacy Clerk column â€” use userId instead
    subscriptionPlanId: varchar('subscription_plan_id', { length: 36 }).references(() => subscriptionPlans.id),
    subscriptionType: mysqlEnum('subscription_type', planTypeEnums).notNull(),
    subscriptionStatus: mysqlEnum('subscription_status', subscriptionStatusEnums).default('trial').notNull(),
    purchasedBoard: mysqlEnum('purchased_board', boardEnums),
    purchasedClass: int('purchased_class'),
    classAccessType: mysqlEnum('class_access_type', classAccessTypeEnums).default('single'),
    purchasedSubjects: json('purchased_subjects'),
    planName: varchar('plan_name', { length: 100 }).notNull(),
    planCode: varchar('plan_code', { length: 50 }).notNull(),
    monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(),
    billingCycle: mysqlEnum('billing_cycle', billingCycleEnums).default('monthly'),
    dailyQuestionLimit: int('daily_question_limit').default(30),
    startDate: timestamp('start_date').defaultNow().notNull(),
    expiryDate: timestamp('expiry_date').notNull(),
    lastPaymentDate: timestamp('last_payment_date'),
    nextBillingDate: timestamp('next_billing_date'),
    cancelledAt: timestamp('cancelled_at'),
    paymentStatus: mysqlEnum('payment_status', paymentStatusEnums).default('pending'),
    paymentGateway: varchar('payment_gateway', { length: 50 }),
    transactionId: varchar('transaction_id', { length: 255 }),
    paymentMetadata: json('payment_metadata'),
    autoRenew: boolean('auto_renew').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),

    // New Sarvagya Integrations
    sarvagyaCredits: int('sarvagya_credits').default(0),
    sarvagyaMonthlyQuota: int('sarvagya_monthly_quota').default(100),
    sarvagyaDailyLimit: int('sarvagya_daily_limit').default(10),
    lastCreditsReset: timestamp('last_credits_reset').defaultNow(),
});

export const aiTutorUsage = mysqlTable('ai_tutor_usage', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    date: timestamp('date').defaultNow(),
    questionsAsked: int('questions_asked').default(0),
    totalTokensUsed: int('total_tokens_used').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

/**
 * Append-only log of tutor interactions carrying a topic dimension.
 *
 * Exists because nothing previously persisted per-student topic signal for the
 * AI tutor: `ai_tutor_usage` stores only counters (questions_asked,
 * total_tokens_used) with no question, topic, or outcome; `learning_events`
 * covers video/quiz/session events only. Quiz correctness lived in
 * `practest_attempt_events` and `quiz_answers` but was never aggregated by topic.
 *
 * One row per chat request. Deliberately does NOT store question text — this is
 * a frequency signal, not a transcript, and keeping it free of free text avoids
 * a second copy of student content with its own retention concerns.
 *
 * Nullable topic fields on purpose: the tutor profile is assembled from
 * request-body fields (src/app/api/ai/chat/route.ts:62) that clients do not
 * always send. A row with a null subject is still useful for doubt-frequency
 * counts, so a partial row must never fail the write.
 */
export const tutorTopicEvents = mysqlTable('tutor_topic_events', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 100 }),
    chapter: varchar('chapter', { length: 255 }),
    topic: varchar('topic', { length: 255 }),
    board: mysqlEnum('board', ['CBSE', 'ICSE', 'STATE_BOARD']),
    // varchar (not int) to match user_notes.class_level and the tutor session,
    // which carry values like 'Class 10' as well as '10'.
    classLevel: varchar('class_level', { length: 20 }),
    // Enum rather than varchar so adding a future event type ('quiz_failed',
    // 're_explained') is a deliberate migration instead of a silent typo.
    eventType: mysqlEnum('event_type', ['doubt_asked']).notNull().default('doubt_asked'),
    /** Which tutor persona was active (menuIntent id), for per-agent breakdowns. */
    agentId: varchar('agent_id', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
    idx_user_time: index('idx_tte_user_time').on(t.userId, t.createdAt),
    idx_user_topic: index('idx_tte_user_subject_topic').on(t.userId, t.subject, t.topic),
}));

export const freeTrials = mysqlTable('free_trials', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    trialStart: timestamp('trial_start').defaultNow(),
    trialEnd: timestamp('trial_end'),
    isConverted: boolean('is_converted').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const subscriptionHistory = mysqlTable('subscription_history', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    subscriptionId: varchar('subscription_id', { length: 36 }).references(() => userSubscriptions.id),
    action: varchar('action', { length: 50 }),
    previousStatus: varchar('previous_status', { length: 50 }),
    newStatus: varchar('new_status', { length: 50 }),
    reason: text('reason'),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const quotaAlerts = mysqlTable('quota_alerts', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    alertType: varchar('alert_type', { length: 50 }), // e.g., 'daily_limit', 'token_limit'
    message: text('message'),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = mysqlTable('notifications', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }),
    title: varchar('title', { length: 255 }),
    message: text('message'),
    isRead: boolean('is_read').default(false),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// CONTENT & MATERIALS
// ============================================================================

export const materials = mysqlTable('materials', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    type: mysqlEnum('type', materialTypeEnums).notNull(),
    board: mysqlEnum('board', boardEnums).notNull(),
    medium: mysqlEnum('medium', mediumEnums).notNull(),
    class: int('class').notNull(),
    stream: mysqlEnum('stream', streamEnums),
    subject: varchar('subject', { length: 100 }).notNull(),
    smType: varchar('sm_type', { length: 100 }).default('Chapter Notes'),
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }).unique().notNull(),
    googleDriveFolderId: varchar('google_drive_folder_id', { length: 255 }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: int('file_size').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).default('application/pdf'),
    downloadUrl: text('download_url'),
    viewUrl: text('view_url'),
    thumbnailUrl: text('thumbnail_url'),
    downloadCount: int('download_count').default(0),
    viewCount: int('view_count').default(0),
    tags: json('tags'),
    difficulty: varchar('difficulty', { length: 50 }).default('medium'),
    metadata: json('metadata'),
    status: mysqlEnum('status', materialStatusEnums).default('draft'),
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by', { length: 255 }),
    approvedBy: varchar('approved_by', { length: 255 }),
    rejectedBy: varchar('rejected_by', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    rejectedAt: timestamp('rejected_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const googleDriveFolders = mysqlTable('google_drive_folders', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    folderId: varchar('folder_id', { length: 255 }).unique().notNull(),
    folderName: varchar('folder_name', { length: 255 }).notNull(),
    parentFolderId: varchar('parent_folder_id', { length: 255 }),
    folderPath: text('folder_path').notNull(),
    board: mysqlEnum('board', boardEnums),
    class: int('class'),
    subject: varchar('subject', { length: 100 }),
    materialType: mysqlEnum('material_type', materialTypeEnums),
    status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
});


export const materialApprovalLog = mysqlTable('material_approval_log', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    materialId: varchar('material_id', { length: 36 }).references(() => materials.id),
    adminId: text('admin_id'),
    action: text('action'),
    comments: text('comments'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const googleDriveConfig = mysqlTable('google_drive_config', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenType: text('token_type'),
    scope: text('scope'),
    expiryDate: timestamp('expiry_date'),
    configuredBy: text('configured_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const adminActivityLog = mysqlTable('admin_activity_log', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    adminId: text('admin_id'),
    action: text('action'),
    details: json('details'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const userMaterialAccess = mysqlTable(
  'user_material_access',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),

    // â”€â”€ Ownership / scope â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    organizationId: varchar('organization_id', { length: 255 })
      .references(() => organization.id, { onDelete: 'cascade' }),

    // Changed from text â†’ varchar(255) so it can participate in a unique index
    userId: varchar('user_id', { length: 255 }),

    // â”€â”€ Material reference (NEW) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // NULL = legacy search-log row created before Phase 2b
    materialId: varchar('material_id', { length: 36 })
      .references(() => materials.id, { onDelete: 'cascade' }),

    // â”€â”€ Access tracking (NEW) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    accessCount: int('access_count').default(1).notNull(),

    // â”€â”€ Legacy search-log columns (kept â€” do not drop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Existing rows use these; new access rows leave them null.
    accessType: text('access_type'),
    filterData: json('filter_data'),
    ipAddress:  text('ip_address'),
    userAgent:  text('user_agent'),

    // â”€â”€ Timestamps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Renamed accessedAt alias for clarity in new code â€” maps to created_at
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  },
  (table) => ({
    // Unique: one row per user per material (drives the upsert in access/route.ts)
    // MySQL unique indexes treat NULL as distinct â€” legacy rows with NULL materialId
    // will not conflict with each other or with new access rows.
    uqUserMaterial: uniqueIndex('uq_uma_user_material').on(
      table.userId,
      table.materialId,
    ),

    // Composite index for history GET: WHERE user_id = ? AND organization_id = ?
    idxOrgUser: index('idx_uma_org_user').on(
      table.organizationId,
      table.userId,
    ),

    // Index for FK lookups on material deletes (CASCADE performance)
    idxMaterial: index('idx_uma_material').on(table.materialId),
  }),
);

// ============================================================================
// PRACTEST TABLES
// ============================================================================

export const practestQuestionBank = mysqlTable('practest_question_bank', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    questionText: text('question_text'),
    questionType: text('question_type'),
    optionA: text('option_a'),
    optionB: text('option_b'),
    optionC: text('option_c'),
    optionD: text('option_d'),
    correctOption: text('correct_option'),
    modelAnswer: text('model_answer'),
    markingRubric: json('marking_rubric'),
    keywords: json('keywords'),
    explanation: text('explanation'),
    maxMarks: int('max_marks'),
    timeLimitSeconds: int('time_limit_seconds'),
    questionImageUrl: text('question_image_url'),
    optionImages: json('option_images'),
    explanationImageUrl: text('explanation_image_url'),
    hasMathContent: boolean('has_math_content').default(false),
    hasChemicalFormulas: boolean('has_chemical_formulas').default(false),
    hasDiagrams: boolean('has_diagrams').default(false),
    board: text('board'),
    classLevel: int('class_level'),
    subject: text('subject'),
    chapter: text('chapter'),
    topic: text('topic'),
    subtopic: text('subtopic'),
    difficultyLevel: text('difficulty_level'),
    bloomLevel: text('bloom_level'),
    // CASA (page-level citation) â€” edition-pinned, anchor-resolved against the NCERT corpus.
    casaBook: varchar('casa_book', { length: 255 }),
    casaEdition: varchar('casa_edition', { length: 50 }),
    casaPage: int('casa_page'),
    casaAnchor: varchar('casa_anchor', { length: 255 }),
    casaVerified: boolean('casa_verified').default(false).notNull(),
    usageCount: int('usage_count'),
    totalAttempts: int('total_attempts'),
    correctAttempts: int('correct_attempts'),
    averageTimeSeconds: int('average_time_seconds'),
    validationStatus: text('validation_status'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const practestTestConfigurations = mysqlTable('practest_test_configurations', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    name: text('name'),
    description: text('description'),
    board: text('board'),
    classLevel: int('class_level'),
    subject: text('subject'),
    chapters: json('chapters'),
    topics: json('topics'),
    totalQuestions: int('total_questions'),
    durationMinutes: int('duration_minutes'),
    maxMarks: int('max_marks'),
    negativeMarking: int('negative_marking'),
    partialMarking: boolean('partial_marking').default(false),
    difficultyDistribution: json('difficulty_distribution'),
    questionTypeDistribution: json('question_type_distribution'),
    bloomDistribution: json('bloom_distribution'),
    randomizeQuestions: boolean('randomize_questions').default(false),
    randomizeOptions: boolean('randomize_options').default(false),
    allowReview: boolean('allow_review').default(false),
    showResultsImmediately: boolean('show_results_immediately').default(false),
    instructions: text('instructions'),
    rules: json('rules'),
    isActive: boolean('is_active').default(false),
    isPublic: boolean('is_public').default(false),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const practestTestSessions = mysqlTable('practest_test_sessions', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }),
    configurationId: varchar('configuration_id', { length: 36 }),
    customParameters: json('custom_parameters'),
    selectedQuestions: json('selected_questions'),
    maxPossibleScore: int('max_possible_score'),
    startTime: timestamp('start_time'),
    status: text('status'),
    currentQuestionIndex: int('current_question_index'),
    userResponses: json('user_responses'),
    timeRemainingSeconds: int('time_remaining_seconds'),
    totalScore: int('total_score'),
    percentage: int('percentage'),
    endTime: timestamp('end_time'),
    durationSeconds: int('duration_seconds'),
    questionWiseResults: json('question_wise_results'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Append-only attempt events â€” the SOURCE OF TRUTH for question analytics.
// Each row is one student's response to one question; never mutated. Per-question
// stats (usage, accuracy, discrimination) are DERIVED from this table so they are
// always recomputable (vs. the denormalized counters cached on the question row).
export const practestAttemptEvents = mysqlTable('practest_attempt_events', {
    id: varchar('id', { length: 36 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }),
    sessionId: varchar('session_id', { length: 36 }).notNull(),
    questionId: varchar('question_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    selectedAnswer: text('selected_answer'),
    isCorrect: boolean('is_correct').default(false).notNull(),
    marksAwarded: int('marks_awarded').default(0).notNull(),
    timeSpentSeconds: int('time_spent_seconds'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    index('pae_question_idx').on(table.questionId),
    index('pae_session_idx').on(table.sessionId),
    index('pae_user_idx').on(table.userId),
]);

// ============================================================================
// SANCHIKA (NOTES) TABLES
// ============================================================================

export const userNotes = mysqlTable('user_notes', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    clerkId: varchar('clerk_id', { length: 255 }),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content').notNull(),
    subject: varchar('subject', { length: 100 }),
    chapter: varchar('chapter', { length: 255 }),
    board: mysqlEnum('board', ['CBSE', 'ICSE', 'STATE_BOARD']),
    classLevel: varchar('class_level', { length: 20 }),
    orientation: mysqlEnum('orientation', ['portrait', 'landscape']).default('portrait'),
    tags: json('tags'),
    sourceType: mysqlEnum('source_type', ['ai_tutor', 'manual', 'imported']).default('manual'),
    sourceQuery: text('source_query'),
    sourceAnswer: text('source_answer'),
    sourceVisualizations: json('source_visualizations'),
    folderId: varchar('folder_id', { length: 36 }),
    contentFormat: mysqlEnum('content_format', ['plain', 'markdown', 'html']).default('markdown'),
    isFavorite: boolean('is_favorite').default(false),
    isArchived: boolean('is_archived').default(false),
    isPinned: boolean('is_pinned').default(false),
    coverDesign: varchar('cover_design', { length: 50 }).default('solid-blue'),
    spineColor: varchar('spine_color', { length: 20 }).default('#3B82F6'),
    pageSize: varchar('page_size', { length: 16 }).default('A4'),
    pageMargins: varchar('page_margins', { length: 16 }).default('normal'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
});

// Wiki-link graph edges (Phase 2). Each row = one [[link]] from source â†’ target note.
export const noteLinks = mysqlTable('note_links', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    sourceNoteId: varchar('source_note_id', { length: 36 })
        .notNull()
        .references(() => userNotes.id, { onDelete: 'cascade' }),
    targetNoteId: varchar('target_note_id', { length: 36 }),
    linkText: varchar('link_text', { length: 500 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const noteFolders = mysqlTable('note_folders', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    clerkId: varchar('clerk_id', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 20 }).default('blue'),
    icon: varchar('icon', { length: 50 }).default('folder'),
    parentFolderId: varchar('parent_folder_id', { length: 36 }),
    folderPath: text('folder_path'),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const noteShares = mysqlTable('note_shares', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    noteId: varchar('note_id', { length: 36 }).notNull().references(() => userNotes.id),
    sharedByUserId: varchar('shared_by_user_id', { length: 255 }).notNull(),
    sharedWithUserId: varchar('shared_with_user_id', { length: 255 }),
    permission: mysqlEnum('permission', ['view', 'edit', 'comment']).default('view'),
    isPublic: boolean('is_public').default(false),
    shareLink: varchar('share_link', { length: 255 }).unique(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    accessedAt: timestamp('accessed_at'),
});

export const noteActivityLog = mysqlTable('note_activity_log', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    noteId: varchar('note_id', { length: 36 }).notNull().references(() => userNotes.id),
    userId: varchar('user_id', { length: 255 }).notNull(),
    activityType: mysqlEnum('activity_type', ['created', 'updated', 'viewed', 'shared', 'exported', 'deleted']).notNull(),
    changesSummary: text('changes_summary'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const noteTemplates = mysqlTable('note_templates', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    templateContent: text('template_content').notNull(),
    category: mysqlEnum('category', ['general', 'subject_notes', 'exam_prep', 'revision', 'summary']).default('general'),
    subject: varchar('subject', { length: 100 }),
    classLevel: varchar('class_level', { length: 20 }),
    isPublic: boolean('is_public').default(false),
    createdByUserId: varchar('created_by_user_id', { length: 255 }),
    usageCount: int('usage_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============================================================================
// DICTIONARY TABLES
// ============================================================================

export const dictionaryWords = mysqlTable('dictionary_words', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    word: varchar('word', { length: 255 }).notNull().unique(),
    pronunciation: varchar('pronunciation', { length: 255 }),
    partOfSpeech: mysqlEnum('part_of_speech', ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection']).notNull(),
    englishDefinition: text('english_definition').notNull(),
    englishSynonyms: json('english_synonyms'),
    englishAntonyms: json('english_antonyms'),
    hindiTranslation: varchar('hindi_translation', { length: 500 }).notNull(),
    hindiSynonyms: json('hindi_synonyms'),
    devanagariScript: varchar('devanagari_script', { length: 500 }),
    amarkoshaCategory: varchar('amarkosha_category', { length: 100 }),
    semanticCluster: varchar('semantic_cluster', { length: 100 }),
    etymology: text('etymology'),
    examples: json('examples'),
    culturalContext: text('cultural_context'),
    regionalUsage: json('regional_usage'),
    audioUrl: varchar('audio_url', { length: 500 }),
    audioAccent: mysqlEnum('audio_accent', ['indian', 'british', 'american']).default('indian'),
    difficultyLevel: mysqlEnum('difficulty_level', ['beginner', 'intermediate', 'advanced']).default('intermediate'),
    frequencyRank: int('frequency_rank'),
    source: varchar('source', { length: 100 }).default('system'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const userVocabProgress = mysqlTable('user_vocab_progress', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    wordId: bigint('word_id', { mode: 'number', unsigned: true }).notNull().references(() => dictionaryWords.id),
    efactor: decimal('efactor', { precision: 3, scale: 2 }).default('2.50'),
    intervalDays: int('interval_days').default(1),
    repetitions: int('repetitions').default(0),
    nextDueDate: date('next_due_date').notNull(),
    lastReviewed: timestamp('last_reviewed'),
    correctAttempts: int('correct_attempts').default(0),
    totalAttempts: int('total_attempts').default(0),
    accuracyPercentage: decimal('accuracy_percentage', { precision: 5, scale: 2 }).default('0.00'),
    status: mysqlEnum('status', ['new', 'learning', 'review', 'mastered']).default('new'),
    firstLearnedAt: timestamp('first_learned_at'),
    masteredAt: timestamp('mastered_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => {
    return {
        uniqueUserWord: uniqueIndex('unique_user_word').on(table.userId, table.wordId),
    };
});

export const communityPhrases = mysqlTable('community_phrases', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    wordId: bigint('word_id', { mode: 'number', unsigned: true }).notNull().references(() => dictionaryWords.id),
    userId: varchar('user_id', { length: 255 }).notNull(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    phrase: text('phrase').notNull(),
    context: text('context'),
    region: varchar('region', { length: 100 }),
    languageVariant: varchar('language_variant', { length: 50 }),
    isApproved: boolean('is_approved').default(false),
    approvedBy: varchar('approved_by', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    upvotes: int('upvotes').default(0),
    downvotes: int('downvotes').default(0),
    reports: int('reports').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const dictionaryUserStats = mysqlTable('dictionary_user_stats', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).unique(),
    totalWordsLearned: int('total_words_learned').default(0),
    wordsMastered: int('words_mastered').default(0),
    currentStreakDays: int('current_streak_days').default(0),
    longestStreakDays: int('longest_streak_days').default(0),
    lastActivityDate: date('last_activity_date'),
    totalQuizAttempts: int('total_quiz_attempts').default(0),
    correctQuizAnswers: int('correct_quiz_answers').default(0),
    averageAccuracy: decimal('average_accuracy', { precision: 5, scale: 2 }).default('0.00'),
    totalPoints: int('total_points').default(0),
    level: int('level').default(1),
    badgesEarned: json('badges_earned'),
    achievements: json('achievements'),
    phrasesContributed: int('phrases_contributed').default(0),
    phrasesApproved: int('phrases_approved').default(0),
    communityReputation: int('community_reputation').default(0),
    dailyGoalWords: int('daily_goal_words').default(5),
    preferredDifficulty: mysqlEnum('preferred_difficulty', ['beginner', 'intermediate', 'advanced', 'mixed']).default('mixed'),
    notificationPreferences: json('notification_preferences'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const dictionarySearchHistory = mysqlTable('dictionary_search_history', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    searchQuery: varchar('search_query', { length: 255 }).notNull(),
    searchType: mysqlEnum('search_type', ['exact', 'fuzzy', 'phonetic', 'semantic']).notNull(),
    resultsCount: int('results_count').default(0),
    selectedWordId: bigint('selected_word_id', { mode: 'number', unsigned: true }),
    searchContext: mysqlEnum('search_context', ['learning', 'quiz', 'browse', 'community']).default('browse'),
    deviceType: mysqlEnum('device_type', ['mobile', 'tablet', 'desktop']).default('desktop'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
    return {
        wordFk: foreignKey({ name: 'dict_search_word_fk', columns: [table.selectedWordId], foreignColumns: [dictionaryWords.id] })
    };
});

export const dictionaryOfflineSync = mysqlTable('dictionary_offline_sync', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    syncVersion: int('sync_version').default(1),
    lastFullSync: timestamp('last_full_sync'),
    lastIncrementalSync: timestamp('last_incremental_sync'),
    wordsSynced: int('words_synced').default(0),
    audioFilesCached: int('audio_files_cached').default(0),
    totalCacheSizeMb: decimal('total_cache_size_mb', { precision: 8, scale: 2 }).default('0.00'),
    autoSyncEnabled: boolean('auto_sync_enabled').default(true),
    wifiOnlySync: boolean('wifi_only_sync').default(true),
    maxCacheSizeMb: int('max_cache_size_mb').default(100),
    pendingProgressUpdates: json('pending_progress_updates'),
    pendingPhraseSubmissions: json('pending_phrase_submissions'),
    pendingSearchHistory: json('pending_search_history'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============================================================================
// SARVAGYA (SURFSENSE) INTEGRATION APP-SIDE TABLES
// ============================================================================

export const sarvagyaCreditTransactions = mysqlTable('sarvagya_credit_transactions', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    amount: int('amount').notNull(),
    type: varchar('type', { length: 50 }).notNull(), // 'deduction', 'grant', 'purchase'
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const sarvagyaSpaces = mysqlTable('sarvagya_spaces', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    internalSpaceId: varchar('internal_space_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const sarvagyaDocuments = mysqlTable('sarvagya_documents', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    spaceId: varchar('space_id', { length: 36 }).references(() => sarvagyaSpaces.id),
    internalDocId: varchar('internal_doc_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    url: text('url'),
    fileType: varchar('file_type', { length: 50 }),
    size: int('size'),
    status: varchar('status', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow(),
});

export const sarvagyaQueries = mysqlTable('sarvagya_queries', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    spaceId: varchar('space_id', { length: 36 }).references(() => sarvagyaSpaces.id),
    userId: varchar('user_id', { length: 255 }).notNull(),
    query: text('query').notNull(),
    response: text('response'),
    tokensUsed: int('tokens_used').default(0),
    creditsDeducted: int('credits_deducted').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// BETTER AUTH CORE TABLES
// ============================================================================

export const user = mysqlTable("user", {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(), // must use varchar for unique constraint in MySQL
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    role: varchar("role", { length: 255 }).default("student"),
    classId: varchar("class_id", { length: 255 }),
    // Phase 4.1 â€” columns previously on legacy `users` table. Legacy domain
    // code (teacher verification, admissions) reads/writes these fields. See
    // identity-federation-design.md Â§8.3.
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    approvalStatus: mysqlEnum("approval_status", approvalStatusEnums),
    verificationStatus: mysqlEnum("verification_status", verificationStatusEnums),
    verificationMethod: varchar("verification_method", { length: 255 }),
    emailDomain: varchar("email_domain", { length: 255 }),
    isEducationalDomain: boolean("is_educational_domain").default(false),
    verifiedAt: timestamp("verified_at"),
    preferences: json("preferences"),
    lastLogin: timestamp("last_login"),
    // Teacher approval workflow columns (used by app/api/teacher/* and app/api/super-admin/teachers/*).
    approvedBy: varchar("approved_by", { length: 255 }),
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),
});

export const session = mysqlTable("session", {
    id: varchar("id", { length: 255 }).primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: varchar("active_organization_id", { length: 255 }),
}, (table) => [
    index("session_userId_idx").on(table.userId),
]);

export const account = mysqlTable("account", {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
    index("account_userId_idx").on(table.userId),
]);

export const verification = mysqlTable("verification", {
    id: varchar("id", { length: 255 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
    index("verification_identifier_idx").on(table.identifier),
]);

export const organization = mysqlTable("organization", {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
    // Phase 4.1 â€” columns previously on legacy `tenants` table.
    subscriptionPlan: mysqlEnum("subscription_plan", subscriptionPlanEnums).default("starter"),
    subscriptionStatus: mysqlEnum("subscription_status", subscriptionStatusEnums).default("trial"),
    settings: json("settings"),
    // Phase 16 â€” Razorpay integration
    razorpayLinkedAccountId: varchar('razorpay_linked_account_id', { length: 255 }),
    platformFeeRate: decimal('platform_fee_rate', { precision: 5, scale: 4 }).default('0.0500'),
});

export const member = mysqlTable("member", {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organization.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }).default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
}, (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex('uq_member_user_org').on(table.userId, table.organizationId),
]);

export const invitation = mysqlTable("invitation", {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organization.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 255 }),
    status: varchar("status", { length: 255 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: varchar("inviter_id", { length: 255 }).notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
]);

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    members: many(member),
    invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
    members: many(member),
    invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
    organization: one(organization, {
        fields: [member.organizationId],
        references: [organization.id],
    }),
    user: one(user, {
        fields: [member.userId],
        references: [user.id],
    }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
    organization: one(organization, {
        fields: [invitation.organizationId],
        references: [organization.id],
    }),
    user: one(user, {
        fields: [invitation.inviterId],
        references: [user.id],
    }),
}));

// ============================================================================
// ANSWER FEEDBACK
// ============================================================================

export const answerFeedback = mysqlTable('answer_feedback', {
    organizationId: varchar('organization_id', { length: 255 }).references(() => organization.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }),
    questionText: text('question_text'),
    answerText: text('answer_text'),
    subject: varchar('subject', { length: 100 }),
    classLevel: int('class_level'),
    board: varchar('board', { length: 50 }),
    starRating: int('star_rating'),
    thumbsRating: varchar('thumbs_rating', { length: 10 }),
    feedbackText: text('feedback_text'),
    validationStatus: varchar('validation_status', { length: 20 }).default('pending'),
    validatedBy: varchar('validated_by', { length: 255 }),
    validatedAt: timestamp('validated_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============================================================================
// PHASE 2 & 4: INSTITUTION ENTITIES & ACADEMIC HIERARCHY
// ============================================================================

export const institutionProfiles = mysqlTable('institution_profiles', {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull()
        .unique(),
    type: mysqlEnum('type', ['school', 'college', 'tuition_center']).default('school').notNull(),
    address: text('address'),
    website: varchar('website', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    establishedYear: int('established_year'),

    // Branding
    primaryColor: varchar('primary_color', { length: 50 }),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),

    // Onboarding
    onboardingCompleted: boolean('onboarding_completed').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Phase 4.2: duplicate institutionClasses / institutionSections /
// studentEnrollments / institutionProfiles declarations removed (canonical
// versions live above).

// â”€â”€ B2B2C: student â†’ institution join requests (self-select, admin-approved) â”€â”€
export const institutionJoinRequests = mysqlTable('institution_join_requests', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    organizationId: varchar('organization_id', { length: 255 }).notNull().references(() => organization.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | rejected
    message: text('message'),
    requestedClass: int('requested_class'),
    requestedBoard: varchar('requested_board', { length: 50 }),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => [
    index('ijr_org_idx').on(table.organizationId),
    index('ijr_user_idx').on(table.userId),
    index('ijr_status_idx').on(table.status),
]);

// ============================================================================
// PHASE 4.2 â€” LEGACY DOMAIN TABLES (previously declared only in
// src/lib/db/schema.sql). Now mirrored in Drizzle for type-safety. Tenant
// FKs migrated to organization. See identity-federation-design.md Â§8.3.
// ============================================================================

export const classes = mysqlTable('classes', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    organizationId: varchar('organization_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    gradeLevel: int('grade_level').notNull(),
    qdrantNamespace: varchar('qdrant_namespace', { length: 255 }),
    subjects: json('subjects'),
    teacherIds: json('teacher_ids'),
    studentCount: int('student_count').default(0),
    settings: json('settings'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const teacherClassAssignments = mysqlTable('teacher_class_assignments', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    teacherId: varchar('teacher_id', { length: 255 })
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(),
    classId: varchar('class_id', { length: 36 })
        .references(() => classes.id, { onDelete: 'cascade' })
        .notNull(),
    assignedBy: varchar('assigned_by', { length: 255 }),
    isActive: boolean('is_active').default(true),
    assignedAt: timestamp('assigned_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const teacherActivityLogs = mysqlTable('teacher_activity_logs', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    teacherId: varchar('teacher_id', { length: 255 })
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(),
    activityType: varchar('activity_type', { length: 100 }).notNull(),
    activityDescription: text('activity_description'),
    metadata: json('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const teacherVerificationDocuments = mysqlTable('teacher_verification_documents', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    teacherId: varchar('teacher_id', { length: 255 })
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(),
    documentType: varchar('document_type', { length: 100 }).notNull(),
    filePath: text('file_path').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: int('file_size'),
    mimeType: varchar('mime_type', { length: 100 }),
    status: varchar('status', { length: 50 }).default('pending').notNull(),
    notes: text('notes'),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: timestamp('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// ============================================================================
// PHASE 5: LMS ARCHITECTURE (INTELLIGENT HYBRID MODEL)
// ============================================================================

export const taxonomyDomains = mysqlTable('taxonomy_domains', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const taxonomyCourses = mysqlTable('taxonomy_courses', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    domainId: varchar('domain_id', { length: 36 })
        .references(() => taxonomyDomains.id, { onDelete: 'cascade' })
        .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const taxonomyLevels = mysqlTable('taxonomy_levels', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    courseId: varchar('course_id', { length: 36 })
        .references(() => taxonomyCourses.id, { onDelete: 'cascade' })
        .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const taxonomySubjects = mysqlTable('taxonomy_subjects', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    levelId: varchar('level_id', { length: 36 })
        .references(() => taxonomyLevels.id, { onDelete: 'cascade' })
        .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const batchTemplates = mysqlTable('batch_templates', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    levelId: varchar('level_id', { length: 36 })
        .references(() => taxonomyLevels.id, { onDelete: 'restrict' })
        .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    uniqueIndex('batch_templates_name_levelId_idx').on(table.name, table.levelId)
]);

export const batches = mysqlTable('batches', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    templateId: varchar('template_id', { length: 36 })
        .references(() => batchTemplates.id, { onDelete: 'set null' }),
    orgId: varchar('org_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    levelId: varchar('level_id', { length: 36 })
        .references(() => taxonomyLevels.id, { onDelete: 'cascade' })
        .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).default('0.00'),
    startDate: date('start_date'),
    isActive: boolean('is_active').default(true),
    joinCode: varchar('join_code', { length: 8 }).unique(),
    maxStudents: int('max_students'),
    createdAt: timestamp('created_at').defaultNow()
});

export const enrollments = mysqlTable('enrollments', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    batchId: varchar('batch_id', { length: 36 })
        .references(() => batches.id, { onDelete: 'cascade' })
        .notNull(),
    userId: varchar('user_id', { length: 255 })
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(),
    orgId: varchar('org_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    status: mysqlEnum('status', ['pending_payment', 'active', 'suspended', 'completed', 'revoked']).default('active'),
    enrolledAt: timestamp('enrolled_at').defaultNow(),
    emailOptOut: boolean('email_opt_out').default(false).notNull(),
}, (table) => {
    return {
        uniqueBatchUser: uniqueIndex('uq_enrollments_batch_user').on(table.batchId, table.userId)
    };
});

export const videoAssets = mysqlTable('video_assets', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    tenantId: varchar('tenant_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' }), // NULLABLE for global platform content
    
    // Legacy Taxonomy Placement
    // Note: Pre-Phase-6 rows contain human-readable strings (e.g. "BAMS Final Year").
    // Post-Phase-6 rows contain raw taxonomy UUIDs as a bridging mechanism for legacy logic.
    domain: varchar('domain', { length: 100 }).notNull(),
    course: varchar('course', { length: 100 }).notNull(),
    level: varchar('level', { length: 100 }).notNull(),
    subject: varchar('subject', { length: 100 }).notNull(),
    book: varchar('book', { length: 100 }).notNull(),
    
    // New Normalized Taxonomy FKs
    levelId: varchar('level_id', { length: 36 })
        .references(() => taxonomyLevels.id, { onDelete: 'set null' }),
    subjectId: varchar('subject_id', { length: 36 })
        .references(() => taxonomySubjects.id, { onDelete: 'set null' }),
    bookTag: text('book_tag'),
    
    // Video Metadata & Webhook Tracking
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    provider: varchar('provider', { length: 50 }).notNull().default('bunny'),
    providerVideoId: varchar('provider_video_id', { length: 255 }).notNull(),
    durationSeconds: int('duration_seconds'),
    thumbnailUrl: varchar('thumbnail_url', { length: 512 }),
    status: mysqlEnum('status', ['uploading', 'processing', 'ready', 'failed']).default('uploading'),
    sortOrder: int('sort_order').default(0),
    isFreePreview: boolean('is_free_preview').default(false),
    
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
}, (table) => {
    return {
        tenantProviderUnique: uniqueIndex('tenant_provider_idx').on(table.tenantId, table.providerVideoId)
    };
});

export const studentVideoProgress = mysqlTable('student_video_progress', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    tenantId: varchar('tenant_id', { length: 255 })
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    userId: varchar('user_id', { length: 255 })
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(),
    videoId: varchar('video_id', { length: 36 })
        .references(() => videoAssets.id, { onDelete: 'cascade' })
        .notNull(),
    maxWatchedSeconds: int('max_watched_seconds').default(0),
    completionPercentage: decimal('completion_percentage', { precision: 5, scale: 2 }).default('0.00'),
    lastWatchedAt: timestamp('last_watched_at').defaultNow()
}, (table) => {
    return {
        // Required for ON DUPLICATE KEY UPDATE in videoProgress.upsert
        uniqueUserVideo: uniqueIndex('uq_svp_user_video').on(table.userId, table.videoId),
        // Tenant-scoped lookups
        idxTenantUser: index('idx_svp_tenant_user').on(table.tenantId, table.userId),
    };
});

// â”€â”€ PHASE 5.1: VIDEO CHAPTERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stores named timestamps (chapters) for any video (Bunny or YouTube).
// The player renders these as a clickable sidebar and tick-marks on the
// progress bar. Chapters are saved via full-replace (delete + reinsert)
// through videoChapters.saveChapters â€” the unique index prevents
// duplicate start times on the same video.
export const videoChapters = mysqlTable('video_chapters', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    videoAssetId: varchar('video_asset_id', { length: 36 })
        .references(() => videoAssets.id, { onDelete: 'cascade' })
        .notNull(),
    tenantId: varchar('tenant_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    startSeconds: int('start_seconds').notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => {
    return {
        videoAssetIdx: index('idx_video_chapters_asset').on(table.videoAssetId),
        tenantIdx: index('idx_video_chapters_tenant').on(table.tenantId),
        uniqueVideoStart: uniqueIndex('uq_chapter_video_start').on(table.videoAssetId, table.startSeconds),
    };
});

// â”€â”€ PHASE 15: IA ANNOUNCEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const announcements = mysqlTable('announcements', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    batchId: varchar('batch_id', { length: 36 })
        .notNull()
        .references(() => batches.id, { onDelete: 'cascade' }),
    orgId: varchar('org_id', { length: 36 }).notNull(),
    authorId: varchar('author_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    body: text('body'),
    isPinned: boolean('is_pinned').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
    return {
        batchIdx: index('idx_announcements_batch').on(table.batchId),
        orgIdx: index('idx_announcements_org').on(table.orgId),
    };
});

// ============================================================================
// PHASE 16 â€” RAZORPAY PAYMENT INTEGRATION
// ============================================================================

export const orders = mysqlTable('orders', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    studentId: varchar('student_id', { length: 255 }).notNull().references(() => user.id),
    batchId: varchar('batch_id', { length: 36 }).notNull().references(() => batches.id),
    orgId: varchar('org_id', { length: 255 }).notNull().references(() => organization.id),

    // Financials (stored in paise)
    amountPaise: int('amount_paise').notNull(),
    platformFeePaise: int('platform_fee_paise').notNull(),
    platformFeeRate: decimal('platform_fee_rate', { precision: 5, scale: 4 }).notNull(),
    institutionPaise: int('institution_paise').notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),

    status: mysqlEnum('status', ['created', 'authorized', 'captured', 'failed', 'refunded']).notNull().default('created'),
    razorpayOrderId: varchar('razorpay_order_id', { length: 255 }).unique().notNull(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
});

export const payments = mysqlTable('payments', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    orderId: varchar('order_id', { length: 36 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }).unique().notNull(),
    razorpayTransferId: varchar('razorpay_transfer_id', { length: 255 }), // Populated after Route split executes

    status: mysqlEnum('status', ['captured', 'failed', 'refunded']).notNull(),
    capturedAt: timestamp('captured_at'),
    refundId: varchar('refund_id', { length: 255 }),
    refundedAt: timestamp('refunded_at'),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================================================
// PHASE 21 â€” COUPONS
// ============================================================================

export const batchCoupons = mysqlTable('batch_coupons', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    batchId: varchar('batch_id', { length: 36 }).notNull().references(() => batches.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    discountType: mysqlEnum('discount_type', ['percentage', 'fixed']).notNull(),
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    usageLimit: int('usage_limit'),
    usageCount: int('usage_count').default(0).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => {
    return {
        uniqueBatchCode: uniqueIndex('uq_batch_coupons_code').on(table.batchId, table.code)
    };
});

// ============================================================================
// PHASE 22B â€” CERTIFICATES
// ============================================================================

export const certificates = mysqlTable('certificates', {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id),
    batchId: varchar('batch_id', { length: 36 }).notNull().references(() => batches.id),
    orgId: varchar('org_id', { length: 36 }).notNull(),
    certificateNumber: varchar('certificate_number', { length: 50 }).notNull().unique(),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
    uq_cert_user_batch: uniqueIndex('uq_cert_user_batch').on(t.userId, t.batchId),
}));

// ============================================================================
// PHASE 23A â€” WAITLIST
// ============================================================================

export const batchWaitlist = mysqlTable('batch_waitlist', {
    id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
    batchId: varchar('batch_id', { length: 36 }).notNull().references(() => batches.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    orgId: varchar('org_id', { length: 255 }).notNull().references(() => organization.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    notifiedAt: timestamp('notified_at'),
}, (t) => ({
    uq_waitlist_batch_user: uniqueIndex('uq_waitlist_batch_user').on(t.batchId, t.userId),
}));

export const quizzes = mysqlTable('quizzes', {
  id:                    varchar('id', { length: 36 }).primaryKey(),
  batchId:               varchar('batch_id', { length: 36 }).notNull()
                           .references(() => batches.id, { onDelete: 'cascade' }),
  orgId:                 varchar('org_id', { length: 36 }).notNull(),
  title:                 varchar('title', { length: 200 }).notNull(),
  timeLimitMinutes:      int('time_limit_minutes'),
  passingScore:          decimal('passing_score', { precision: 5, scale: 2 }),
  shuffleQuestions:      boolean('shuffle_questions').notNull().default(false),
  allowMultipleAttempts: boolean('allow_multiple_attempts').notNull().default(true),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
});

export const quizQuestions = mysqlTable('quiz_questions', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  quizId:       varchar('quiz_id', { length: 36 }).notNull()
                  .references(() => quizzes.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  explanation:  text('explanation'),
  sortOrder:    int('sort_order').notNull().default(0),
});

export const quizOptions = mysqlTable('quiz_options', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  questionId: varchar('question_id', { length: 36 }).notNull()
                .references(() => quizQuestions.id, { onDelete: 'cascade' }),
  optionText: varchar('option_text', { length: 500 }).notNull(),
  isCorrect:  boolean('is_correct').notNull().default(false),
  sortOrder:  int('sort_order').notNull().default(0),
});

export const quizAttempts = mysqlTable('quiz_attempts', {
  id:             varchar('id', { length: 36 }).primaryKey(),
  quizId:         varchar('quiz_id', { length: 36 }).notNull()
                    .references(() => quizzes.id, { onDelete: 'cascade' }),
  userId:         varchar('user_id', { length: 36 }).notNull(),
  orgId:          varchar('org_id', { length: 36 }).notNull(),
  score:          decimal('score', { precision: 5, scale: 2 }),
  totalQuestions: int('total_questions').notNull(),
  correctAnswers: int('correct_answers'),
  startedAt:      timestamp('started_at').notNull().defaultNow(),
  completedAt:    timestamp('completed_at'),
}, (t) => ({
  idx_user: index('idx_quiz_attempts_user').on(t.userId),
}));

export const quizAnswers = mysqlTable('quiz_answers', {
  id:               varchar('id', { length: 36 }).primaryKey(),
  attemptId:        varchar('attempt_id', { length: 36 }).notNull()
                      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId:       varchar('question_id', { length: 36 }).notNull(),
  selectedOptionId: varchar('selected_option_id', { length: 36 }),
  isCorrect:        boolean('is_correct').notNull().default(false),
});

// ============================================================================
// PHASE 25A — STUDENT ANALYTICS
// ============================================================================

export const learningEvents = mysqlTable('learning_events', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  userId:    varchar('user_id', { length: 36 }).notNull(),
  batchId:   varchar('batch_id', { length: 36 }),
  orgId:     varchar('org_id', { length: 36 }).notNull(),
  eventType: mysqlEnum('event_type', [
    'video_play', 'video_pause', 'video_seek', 'video_complete',
    'video_speed_change', 'quiz_start', 'quiz_submit',
    'session_start', 'session_end'
  ]).notNull(),
  metadata:  json('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  idx_user_time:  index('idx_le_user_time').on(t.userId, t.createdAt),
  idx_batch_time: index('idx_le_batch_time').on(t.batchId, t.createdAt),
}))

export const studentEngagementSnapshots = mysqlTable('student_engagement_snapshots', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  userId:          varchar('user_id', { length: 36 }).notNull(),
  batchId:         varchar('batch_id', { length: 36 }).notNull(),
  orgId:           varchar('org_id', { length: 36 }).notNull(),
  weekOf:          date('week_of').notNull(),
  engagementScore: decimal('engagement_score', { precision: 5, scale: 2 }).default('0'),
  riskScore:       decimal('risk_score', { precision: 5, scale: 2 }).default('0'),
  videosWatched:   int('videos_watched').default(0),
  quizzesTaken:    int('quizzes_taken').default(0),
  avgQuizScore:    decimal('avg_quiz_score', { precision: 5, scale: 2 }),
  minutesActive:   int('minutes_active').default(0),
  streakDays:      int('streak_days').default(0),
}, (t) => ({
  uq_snapshot: uniqueIndex('uq_snapshot_user_batch_week').on(t.userId, t.batchId, t.weekOf),
}))

export const studentYearlyGrowth = mysqlTable('student_yearly_growth', {
  id:                 varchar('id', { length: 36 }).primaryKey(),
  userId:             varchar('user_id', { length: 36 }).notNull(),
  year:               int('year').notNull(),
  totalMinutes:       int('total_minutes').default(0),
  coursesEnrolled:    int('courses_enrolled').default(0),
  coursesCompleted:   int('courses_completed').default(0),
  avgQuizScore:       decimal('avg_quiz_score', { precision: 5, scale: 2 }),
  certificatesEarned: int('certificates_earned').default(0),
  computedAt:         timestamp('computed_at').notNull().defaultNow(),
}, (t) => ({
  uq_growth: uniqueIndex('uq_growth_user_year').on(t.userId, t.year),
}))

export const appConfig = mysqlTable('app_config', {
  id: int('id').primaryKey().default(1),
  maintenanceMode: boolean('maintenance_mode').default(false).notNull(),
  debugMode: boolean('debug_mode').default(false).notNull(),
  sessionTimeoutMinutes: int('session_timeout_minutes').default(60).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
