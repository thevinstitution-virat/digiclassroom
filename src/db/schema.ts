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

// Phase 4.1 — legacy `tenants` and `users` tables removed. All fields
// migrated to Better Auth `organization` and `user` respectively. Legacy
// SQL endpoints in app/api/teacher/* and app/api/super-admin/teachers/* still
// query these tables with raw SQL and will throw at runtime until they are
// refactored (Phase 4.1b). See identity-federation-design.md §8.3.

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
    clerkId: varchar('clerk_id', { length: 255 }), // @deprecated Legacy Clerk column — use userId instead
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
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
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

    // ── Ownership / scope ─────────────────────────────────────────────────
    organizationId: varchar('organization_id', { length: 255 })
      .references(() => organization.id, { onDelete: 'cascade' }),

    // Changed from text → varchar(255) so it can participate in a unique index
    userId: varchar('user_id', { length: 255 }),

    // ── Material reference (NEW) ──────────────────────────────────────────
    // NULL = legacy search-log row created before Phase 2b
    materialId: varchar('material_id', { length: 36 })
      .references(() => materials.id, { onDelete: 'cascade' }),

    // ── Access tracking (NEW) ─────────────────────────────────────────────
    accessCount: int('access_count').default(1).notNull(),

    // ── Legacy search-log columns (kept — do not drop) ────────────────────
    // Existing rows use these; new access rows leave them null.
    accessType: text('access_type'),
    filterData: json('filter_data'),
    ipAddress:  text('ip_address'),
    userAgent:  text('user_agent'),

    // ── Timestamps ────────────────────────────────────────────────────────
    // Renamed accessedAt alias for clarity in new code — maps to created_at
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  },
  (table) => ({
    // Unique: one row per user per material (drives the upsert in access/route.ts)
    // MySQL unique indexes treat NULL as distinct — legacy rows with NULL materialId
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
    // CASA (page-level citation) — edition-pinned, anchor-resolved against the NCERT corpus.
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

// Append-only attempt events — the SOURCE OF TRUTH for question analytics.
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

// Wiki-link graph edges (Phase 2). Each row = one [[link]] from source → target note.
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
    // Phase 4.1 — columns previously on legacy `users` table. Legacy domain
    // code (teacher verification, admissions) reads/writes these fields. See
    // identity-federation-design.md §8.3.
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
    // Phase 4.1 — columns previously on legacy `tenants` table.
    subscriptionPlan: mysqlEnum("subscription_plan", subscriptionPlanEnums).default("starter"),
    subscriptionStatus: mysqlEnum("subscription_status", subscriptionStatusEnums).default("trial"),
    settings: json("settings"),
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

// ── B2B2C: student → institution join requests (self-select, admin-approved) ──
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
// PHASE 4.2 — LEGACY DOMAIN TABLES (previously declared only in
// src/lib/db/schema.sql). Now mirrored in Drizzle for type-safety. Tenant
// FKs migrated to organization. See identity-federation-design.md §8.3.
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
