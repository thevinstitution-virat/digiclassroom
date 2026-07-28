export interface QuickReply {
    id: string
    text: string
    value: string
    icon?: string
}

export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    quickReplies?: QuickReply[]
    messageType?: 'text' | 'options' | 'confirmation' | 'voice' | 'error'
    fileAttachment?: {
        name: string
        size: number
        type: string
    }
    voiceCommand?: any
    isAgentResponse?: boolean
    agentType?: string
    visualizations?: Array<{
        type: 'comparison_table' | 'concept_map' | 'flowchart' | 'timeline' | 'hierarchical_tree' | 'text_flowchart'
        format: 'markdown' | 'mermaid'
        priority: 1 | 2 | 3
        content: string
        caption: string
        educationalValue: string
    }>
    keyTerms?: Array<{
        term: string
        definition: string
        source?: string
    }>
    sources?: Array<{
        id: string
        title: string
        chapter: string
        page: string | number
        subject: string
        class: string
        content_preview: string
        confidence: number
        content_type: string
        citation_validated?: boolean
        validation_errors?: string[]
        // Role-aware citation enhancements
        display_format?: 'student_friendly' | 'academic' | 'accessible'
        trust_indicator?: {
            level: 'high' | 'medium' | 'low'
            visual: string
            description: string
            userFriendlyExplanation: string
        }
        role_explanation?: string
        verification_level?: 'simplified' | 'detailed' | 'clear'
        language_adaptation?: {
            hindiTranslation?: string
            culturalContext?: string
            simplifiedExplanation?: string
        }
    }>
    metadata?: {
        total_results: number
        confidence: string
        search_time: number
        search_strategies: string[]
    }
    // Performance and routing metadata for feedback
    performanceMetrics?: {
        responseTimeMs?: number
        cacheHit?: boolean
        cacheType?: 'semantic' | 'openai' | 'pre-generated' | 'none'
        routeType?: string
        complexity?: string
        intentType?: string
        // RAGAS quality scores
        faithfulnessScore?: number
        relevanceScore?: number
        contextPrecisionScore?: number
        contextRecallScore?: number
    }
}

export interface ConversationState {
    phase: 'initial_greeting' | 'awaiting_role_selection' | 'role_selected' | 'board_selected' | 'class_selected' | 'subject_selected' | 'menu_selected' | 'chatting'
    selectedRole?: UserRole
    selectedBoard?: EducationBoard
    selectedClass?: string
    selectedSubject?: string
    selectedMenuItem?: MenuItem
    hasUserSentFirstMessage: boolean
    context: {
        userName: string
        userRole?: UserRole
        educationBoard?: EducationBoard
        classLevel?: string
        subject?: string
        menuIntent?: string
    }
}

export type UserRole = 'student' | 'teacher' | 'parent'
export type EducationBoard = 'cbse' | 'icse' | 'state_board'

export interface MenuItem {
    id: string
    title: string
    description: string
    intent: string
}
